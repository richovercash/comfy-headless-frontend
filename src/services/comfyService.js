import loraService from './loraService';

// Base API URL for ComfyUI
export const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';

/**
 * Service for interacting with ComfyUI
 */
const ComfyService = {
  
  /**
   * Test connection to ComfyUI server
   */
  async testConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/system_stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        return { 
          success: false, 
          error: { 
            status: response.status, 
            message: `Server returned ${response.status}` 
          } 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: { 
          message: error.message || "Network error connecting to ComfyUI" 
        } 
      };
    }
  },

  /**
   * Queue a workflow prompt in ComfyUI
   */
  async queuePrompt(workflow) {
    console.log("Queueing prompt with workflow:", workflow);
    
    const response = await fetch(`${API_BASE_URL}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: workflow }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to queue prompt: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    return await response.json();
  },

  /**
   * Create a Flux workflow with LoRA support using EasyLoraStack
   * @param {Object} options - Workflow configuration options
   * @returns {Object} Workflow object and timestamp
   */
  createFluxWorkflow({
    prompt,
    negativePrompt = 'low quality, bad anatomy, blurry, pixelated, distorted, deformed',
    steps = 28,
    inputImageUrl = null,
    reduxImageUrl = null,
    filenamePrefix = 'Otherides-2d',
    loras = [] // LoRAs parameter
  }) {
    console.log('Creating Flux workflow with options:', {
      prompt,
      steps,
      inputImageUrl: inputImageUrl ? 'provided' : 'none',
      reduxImageUrl: reduxImageUrl ? 'provided' : 'none',
      filenamePrefix,
      loraCount: loras.length
    });
    
    // Generate timestamp for this workflow
    const timestamp = Date.now();
    
    // Process activation words from LoRAs
    const activationWords = loraService.generateActivationWordsPrompt(loras);
    
    // Combine prompt with activation words if available
    const fullPrompt = activationWords 
      ? `${prompt}, ${activationWords}`
      : prompt;
    
    console.log('Full prompt with activation words:', fullPrompt);
    
    // Get a workflow template based on depth conditioning options
    let workflow;
    
    if (inputImageUrl && reduxImageUrl) {
      // Advanced workflow...
      workflow = this._createAdvancedWorkflow({
        prompt: fullPrompt,
        negativePrompt,
        steps,
        inputImageUrl,
        reduxImageUrl,
        filenamePrefix,
        timestamp
      });
    } else if (inputImageUrl) {
      // Basic workflow...
      workflow = this._createBasicWorkflow({
        prompt: fullPrompt,
        negativePrompt,
        steps,
        inputImageUrl,
        filenamePrefix,
        timestamp
      });
    } else {
      // Simple workflow...
      workflow = this._createSimpleWorkflow({
        prompt: fullPrompt,
        negativePrompt,
        steps,
        filenamePrefix,
        timestamp
      });
    }
    
    // Apply LoRA configuration if provided - USE THE NEW METHOD
    if (loras && loras.length > 0) {
      console.log(`Adding ${loras.length} LoRAs to workflow using EasyLoraStack`);
      
      try {
        // Important: Use the new EasyLoraStack method
        workflow = this._applyEasyLoraStackToWorkflow(workflow, loras);
      } catch (error) {
        console.error("Error applying LoRAs with EasyLoraStack:", error);
        // Continue with the original workflow if there was an error
      }
    }
    
    // Verify all node references exist in the workflow
    workflow = this._verifyNodeReferences(workflow);
    
    console.log('Workflow created');
    
    return {
      workflow,
      timestamp: timestamp.toString()
    };
  },

  /**
   * Apply EasyLoraStack to workflow
   * Based on the flux_redux-lora_mode.json implementation
   * @param {Object} workflow - Original workflow
   * @param {Array} loras - LoRAs to apply
   * @returns {Object} Updated workflow with EasyLoraStack
   */
  _applyEasyLoraStackToWorkflow(workflow, loras) {
    // Clone the workflow to avoid modifying the original
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow));
    
    console.log(`Applying ${loras.length} LoRAs to workflow using EasyLoraStack`);
    
    // Find the UNETLoader node (modelNodeId) and DualCLIPLoader node (clipNodeId)
    let modelNodeId = null;
    let clipNodeId = null;
    
    // Find model and clip nodes
    for (const [id, node] of Object.entries(updatedWorkflow)) {
      if (node.class_type === "UNETLoader") {
        modelNodeId = id;
      } else if (node.class_type === "DualCLIPLoader" || node.class_type === "CLIPLoader") {
        clipNodeId = id;
      }
    }
    
    if (!modelNodeId || !clipNodeId) {
      console.error("Could not find required model and clip nodes");
      return updatedWorkflow;
    }
    
    console.log(`Found model node: ${modelNodeId}, clip node: ${clipNodeId}`);
    
    // Find all nodes that consume the model output
    const modelConsumers = [];
    
    for (const [id, node] of Object.entries(updatedWorkflow)) {
      if (node.inputs) {
        for (const [inputName, inputValue] of Object.entries(node.inputs)) {
          if (Array.isArray(inputValue) && inputValue[0] === modelNodeId) {
            modelConsumers.push({
              id,
              inputName,
              outputIndex: inputValue[1] || 0
            });
          }
        }
      }
    }
    
    console.log(`Found ${modelConsumers.length} nodes consuming model output`);
    
    // Generate high node IDs to avoid conflicts
    const loraStackNodeId = "91"; // EasyLoraStack node
    const crApplyNodeId = "110"; // CR Apply LoRA Stack node
    
    // Create EasyLoraStack node similar to the example workflow
    updatedWorkflow[loraStackNodeId] = {
      "inputs": {
        "toggle": true,
        "mode": "simple",
        "num_loras": Math.min(loras.length, 10) // Maximum 10 LoRAs supported
      },
      "class_type": "easy loraStack",
      "_meta": {
        "title": "EasyLoraStack"
      }
    };
    
    // Add each LoRA to the stack
    loras.forEach((lora, index) => {
      if (index < 10) { // Maximum 10 LoRAs in EasyLoraStack
        const loraIndex = index + 1;
        updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_name`] = lora.file_path || "None";
        updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_strength`] = lora.strength || 1.0;
        updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_model_strength`] = lora.model_strength || 1.0;
        updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_clip_strength`] = lora.clip_strength || 1.0;
      }
    });
    
    // Fill in remaining LoRA slots with "None"
    for (let i = loras.length + 1; i <= 10; i++) {
      updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_name`] = "None";
      updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_strength`] = 1.0;
      updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_model_strength`] = 1.0;
      updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_clip_strength`] = 1.0;
    }
    
    // Create CR Apply LoRA Stack node
    updatedWorkflow[crApplyNodeId] = {
      "inputs": {
        "model": [modelNodeId, 0],
        "clip": [clipNodeId, 0],
        "lora_stack": [loraStackNodeId, 0]
      },
      "class_type": "CR Apply LoRA Stack",
      "_meta": {
        "title": "💊 CR Apply LoRA Stack"
      }
    };
    
    // Redirect all model consumers to use the CR Apply LoRA Stack output instead
    modelConsumers.forEach(consumer => {
      // Only update if this isn't one of our newly added nodes
      if (consumer.id !== loraStackNodeId && consumer.id !== crApplyNodeId) {
        // Update the connection to use the CR Apply LoRA Stack output
        updatedWorkflow[consumer.id].inputs[consumer.inputName] = [crApplyNodeId, 0];
      }
    });
    
    // For nodes that need the CLIP model, update them to use the CR Apply LoRA Stack CLIP output
    for (const [id, node] of Object.entries(updatedWorkflow)) {
      if (node.inputs) {
        for (const [inputName, inputValue] of Object.entries(node.inputs)) {
          if (Array.isArray(inputValue) && inputValue[0] === clipNodeId) {
            // Update to use the CLIP output from CR Apply LoRA Stack node
            updatedWorkflow[id].inputs[inputName] = [crApplyNodeId, 1];
          }
        }
      }
    }
    
    return updatedWorkflow;
  },

  /**
   * Verifies that all node references in the workflow exist
   * @param {Object} workflow - The workflow to verify
   * @returns {Object} Validated workflow with fixes
   */
  _verifyNodeReferences(workflow) {
    const nodes = Object.keys(workflow);
    const fixedWorkflow = {...workflow};
    
    // Check each node's inputs
    for (const nodeId in fixedWorkflow) {
      const node = fixedWorkflow[nodeId];
      
      if (node.inputs) {
        // For each input that references another node
        for (const inputKey in node.inputs) {
          const input = node.inputs[inputKey];
          
          if (Array.isArray(input) && input.length >= 1 && typeof input[0] === 'string') {
            const referencedNodeId = input[0];
            
            // If the referenced node doesn't exist, log an error and fix it
            if (!nodes.includes(referencedNodeId)) {
              console.error(`Node ${nodeId} references non-existent node ${referencedNodeId} in input ${inputKey}`);
              
              // Try to find a suitable replacement or use a default approach
              if (node.class_type === "CLIPTextEncode") {
                // For CLIPTextEncode nodes, ensure the CLIP model is available
                const clipNodes = nodes.filter(id => 
                  fixedWorkflow[id].class_type === "DualCLIPLoader" || 
                  fixedWorkflow[id].class_type === "CLIPLoader"
                );
                
                if (clipNodes.length > 0) {
                  console.log(`Fixing reference: replacing ${referencedNodeId} with ${clipNodes[0]}`);
                  node.inputs[inputKey] = [clipNodes[0], input[1] || 0];
                } else {
                  // If we can't find a suitable replacement, remove the reference
                  delete node.inputs[inputKey];
                }
              } else {
                // For other node types, handle case by case or remove the reference
                console.log(`Removing invalid reference from node ${nodeId}, input ${inputKey}`);
                delete node.inputs[inputKey];
              }
            }
          }
        }
      }
    }
    
    return fixedWorkflow;
  },
  
  /**
   * Create a standard Flux workflow with optional image inputs
   */
  createSimpleFluxWorkflow({ prompt, steps = 20, filenamePrefix = 'Otherides-2d' }) {
    console.log("Creating standard Flux workflow with params:", { prompt, steps, filenamePrefix });
    
    // Add timestamp to make the generation unique
    const timestamp = new Date().getTime();
    
    // Base workflow object - simplified for example
    const workflow = {
      // This would contain the standard basic workflow nodes
      // Simplified for this example
      "3": {
        "inputs": {
          "text": filenamePrefix
        },
        "class_type": "Text",
      },
      "5": {
        "inputs": {
          "text": prompt
        },
        "class_type": "CLIPTextEncode",
      },
      "6": {
        "inputs": {
          "steps": steps
        },
        "class_type": "KSampler",
      },
      "7": {
        "inputs": {
          "filename_prefix": [
            "3",
            0
          ],
          "images": [
            "6",
            0
          ]
        },
        "class_type": "SaveImage",
      }
    };

    // We'll let Base64Service handle the image loading
    return { workflow, timestamp };
  },
  
  /**
   * Create an advanced Flux workflow with Redux styling and depth conditioning
   */
  createFluxAdvancedWorkflow({ 
    prompt, 
    steps = 20, 
    reduxStrength = 0.5,
    useDepth = true,
    filenamePrefix = 'Otherides-2d_' 
  }) {
    console.log("Creating advanced Flux workflow with params:", { 
    prompt, steps, reduxStrength, useDepth, filenamePrefix 
    });
    
    // Add timestamp to make the generation unique
    const timestamp = new Date().getTime();
    
    // Start with the base Redux workflow structure from the provided example
    const workflow = {
      "77": {
        "inputs": {
          "filename_prefix": [
            "82",
            0
          ],
          "images": [
            "81",
            0
          ]
        },
        "class_type": "SaveImage",
        "_meta": {
          "title": "Save Image"
        }
      },
      "78": {
        "inputs": {
          "unet_name": "blackforest/flux1-depth-dev.safetensors",
          "weight_dtype": "fp8_e4m3fn"
        },
        "class_type": "UNETLoader",
        "_meta": {
          "title": "Load Diffusion Model"
        }
      },
      "79": {
        "inputs": {
          "text": "",
          "clip": [
            "80",
            0
          ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIP Text Encode (Prompt)"
        }
      },
      "80": {
        "inputs": {
          "clip_name1": "Flux/t5xxl_fp16.safetensors",
          "clip_name2": "Flux/clip_l.safetensors",
          "type": "flux",
          "device": "default"
        },
        "class_type": "DualCLIPLoader",
        "_meta": {
          "title": "DualCLIPLoader"
        }
      },
      "81": {
        "inputs": {
          "samples": [
            "100",
            0
          ],
          "vae": [
            "90",
            0
          ]
        },
        "class_type": "VAEDecode",
        "_meta": {
          "title": "VAE Decode"
        }
      },
      "82": {
        "inputs": {
          "text": `${filenamePrefix}_${timestamp}`
        },
        "class_type": "Text Multiline",
        "_meta": {
          "title": "Text Multiline"
        }
      },
      "83": {
        "inputs": {
          "value": 1024
        },
        "class_type": "INTConstant",
        "_meta": {
          "title": "Width"
        }
      },
      "84": {
        "inputs": {
          "value": 1024
        },
        "class_type": "INTConstant",
        "_meta": {
          "title": "Height"
        }
      },
      "85": {
        "inputs": {
          "image": "placeholder.png"  // This will be replaced by Base64Service
        },
        "class_type": "LoadImage",
        "_meta": {
          "title": "Load Image (Placeholder)"
        }
      },
      "86": {
        "inputs": {
          "width": [
            "83",
            0
          ],
          "height": [
            "84",
            0
          ],
          "interpolation": "bicubic",
          "method": "keep proportion",
          "condition": "always",
          "multiple_of": 16,
          "image": [
            "85", 
            0
          ]
        },
        "class_type": "ImageResize+",
        "_meta": {
          "title": "🔧 Image Resize"
        }
      },
      "88": {
        "inputs": {
          "width": [
            "86",
            1
          ],
          "height": [
            "86",
            2
          ],
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage",
        "_meta": {
          "title": "Empty Latent Image"
        }
      },
      "89": {
        "inputs": {
          "text": prompt,
          "clip": [
            "80",
            0
          ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIP Text Encode (Prompt)"
        }
      },
      "90": {
        "inputs": {
          "vae_name": "ae.sft"
        },
        "class_type": "VAELoader",
        "_meta": {
          "title": "Load VAE"
        }
      },
      "92": {
        "inputs": {
          "max_shift": 1.25,
          "base_shift": 0.5,
          "width": 1024,
          "height": 1024,
          "model": [
            "78",
            0
          ]
        },
        "class_type": "ModelSamplingFlux",
        "_meta": {
          "title": "ModelSamplingFlux"
        }
      },
      "94": {
        "inputs": {
          "image": "placeholder.png"  // This will be replaced by Base64Service
        },
        "class_type": "LoadImage",
        "_meta": {
          "title": "Load Redux Image (Placeholder)"
        }
      },
      "95": {
        "inputs": {
          "clip_name": "sigclip_vision_patch14_384.safetensors"
        },
        "class_type": "CLIPVisionLoader",
        "_meta": {
          "title": "Load CLIP Vision"
        }
      },
      "96": {
        "inputs": {
          "style_model_name": "flux1-redux-dev.safetensors"
        },
        "class_type": "StyleModelLoader",
        "_meta": {
          "title": "Load Style Model"
        }
      },
      "100": {
        "inputs": {
          "noise": [
            "102",
            0
          ],
          "guider": [
            "103",
            0
          ],
          "sampler": [
            "104",
            0
          ],
          "sigmas": [
            "109",
            0
          ],
          "latent_image": [
            "88",
            0
          ]
        },
        "class_type": "SamplerCustomAdvanced",
        "_meta": {
          "title": "SamplerCustomAdvanced"
        }
      },
      "102": {
        "inputs": {
          "noise_seed": Math.floor(Math.random() * 1000000)
        },
        "class_type": "RandomNoise",
        "_meta": {
          "title": "RandomNoise"
        }
      },
      "103": {
        "inputs": {
          "model": [
            "92",
            0
          ],
          "conditioning": [
            "108",
            0
          ]
        },
        "class_type": "BasicGuider",
        "_meta": {
          "title": "BasicGuider"
        }
      },
      "104": {
        "inputs": {
          "sampler_name": "euler"
        },
        "class_type": "KSamplerSelect",
        "_meta": {
          "title": "KSamplerSelect"
        }
      },
      "105": {
        "inputs": {
          "text": prompt.split(',').slice(0, 5).join(', '), // Use first few tags for condensed prompt
          "clip": [
            "80",
            0
          ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIP Text Encode (Prompt)"
        }
      },
      "109": {
        "inputs": {
          "scheduler": "simple",
          "steps": steps,
          "denoise": 1,
          "model": [
            "92",
            0
          ]
        },
        "class_type": "BasicScheduler",
        "_meta": {
          "title": "BasicScheduler"
        }
      },
      "111": {
        "inputs": {
          "model": "depth_anything_v2_vitl_fp16.safetensors"
        },
        "class_type": "DownloadAndLoadDepthAnythingV2Model",
        "_meta": {
          "title": "DownloadAndLoadDepthAnythingV2Model"
        }
      },
      "113": {
        "inputs": {
          "guidance": 15,
          "conditioning": [
            "114",
            0
          ]
        },
        "class_type": "FluxGuidance",
        "_meta": {
          "title": "FluxGuidance"
        }
      },
      "114": {
        "inputs": {
          "conditioning_to": [
            "105",
            0
          ],
          "conditioning_from": [
            "89",
            0
          ]
        },
        "class_type": "ConditioningConcat",
        "_meta": {
          "title": "Conditioning (Concat)"
        }
      }
    };
    
    // Add depth extraction if enabled
    if (useDepth) {
      workflow["106"] = {
        "inputs": {
          "da_model": [
            "111",
            0
          ],
          "images": [
            "86",
            0
          ]
        },
        "class_type": "DepthAnything_V2",
        "_meta": {
          "title": "Depth Anything V2"
        }
      };
      
      workflow["107"] = {
        "inputs": {
          "positive": [
            "113",
            0
          ],
          "negative": [
            "79",
            0
          ],
          "vae": [
            "90",
            0
          ],
          "pixels": [
            "106",
            0
          ]
        },
        "class_type": "InstructPixToPixConditioning",
        "_meta": {
          "title": "InstructPixToPixConditioning"
        }
      };
      
      // Connect to style application without depending on reduxImageUrl
      workflow["108"] = {
        "inputs": {
          "strength": reduxStrength,
          "conditioning": [
            "107",
            0
          ],
          "style_model": [
            "96",
            0
          ]
          // clip_vision_output will be added in the form handler if needed
        },
        "class_type": "StyleModelApplyAdvanced",
        "_meta": {
          "title": "🖌️ Style Model Apply (Advanced)"
        }
      };
    } else {
      // No depth conditioning - direct style application to conditioning
      workflow["108"] = {
        "inputs": {
          "strength": reduxStrength,
          "conditioning": [
            "89",
            0
          ],
          "style_model": [
            "96",
            0
          ]
          // clip_vision_output will be added in the form handler if needed
        },
        "class_type": "StyleModelApplyAdvanced",
        "_meta": {
          "title": "🖌️ Style Model Apply (Advanced)"
        }
      };
    }
    
    // Add CLIPVisionEncode node for Redux (will be connected in form handler if needed)
    workflow["93"] = {
      "inputs": {
        "crop": "center",
        "clip_vision": [
          "95",
          0
        ],
        "image": [
          "94",
          0
        ]
      },
      "class_type": "CLIPVisionEncode",
      "_meta": {
        "title": "CLIP Vision Encode"
      }
    };
    
    return { workflow, timestamp };
  }
};

export default ComfyService;