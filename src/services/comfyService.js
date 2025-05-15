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
   * Create a Flux workflow with LoRA support
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
    
    // Process activation words from LoRAs if provided
    const activationWords = loraService.generateActivationWordsPrompt(loras);
    
    // Combine prompt with activation words if available
    const fullPrompt = activationWords 
      ? `${prompt}, ${activationWords}`
      : prompt;
    
    console.log('Full prompt with activation words:', fullPrompt);
    console.log("DEBUG PROMPT: Original prompt:", prompt);
    console.log("DEBUG PROMPT: Activation words:", activationWords);
    console.log("DEBUG PROMPT: Full prompt with activations:", fullPrompt);
    
    // Create the basic workflow
    let workflow = this._createBasicFluxWorkflow({
      prompt: fullPrompt,
      negativePrompt,
      steps,
      filenamePrefix,
      timestamp
    });
    
    // Apply LoRA configuration if provided
    if (loras && loras.length > 0) {
      console.log(`Adding ${loras.length} LoRAs to workflow. LoRA data:`, loras);
      
      try {
        // Add LoRAs to the workflow
        workflow = this._applyFluxLoras(workflow, loras);
      } catch (error) {
        console.error("Error applying LoRAs:", error);
        // Continue with the original workflow if there was an error
      }
    }
    
    // Final validation check
    workflow = this._verifyNodeReferences(workflow);
    
    console.log('Workflow created');
    // In createFluxWorkflow in comfyService.js, add this before returning
    console.log("DEBUG WORKFLOW: Final workflow with LoRAs:", workflow);
    console.log("DEBUG WORKFLOW: Looking for LoRA nodes...");
    const loraStackNode = Object.entries(workflow).find(([_, node]) => node.class_type === "easy loraStack")?.[1];
    const crApplyNode = Object.entries(workflow).find(([_, node]) => node.class_type === "CR Apply LoRA Stack")?.[1];
    console.log("DEBUG WORKFLOW: LoRA stack node:", loraStackNode);
    console.log("DEBUG WORKFLOW: CR Apply node:", crApplyNode);
    if (loraStackNode) {
      console.log("DEBUG WORKFLOW: LoRA paths in stack:", 
        Array.from({length: loraStackNode.inputs.num_loras}, (_, i) => i + 1)
          .map(i => loraStackNode.inputs[`lora_${i}_name`])
          .filter(path => path !== "None")
      );
}
    
    return {
      workflow,
      timestamp: timestamp.toString()
    };
  },

  /**
   * Apply LoRAs to workflow using FluxLoraLoader nodes
   * @param {Object} workflow - Original workflow
   * @param {Array} loras - LoRAs to apply
   * @returns {Object} Updated workflow with LoRAs
   */
  _applyFluxLoras(workflow, loras) {
    // Clone the workflow to avoid modifying the original
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow));
    
    if (!loras || loras.length === 0) {
      return updatedWorkflow;
    }
    
    console.log(`Adding ${loras.length} LoRAs to workflow using FluxLoraLoader nodes`);
    
    // Find the model node (UNETLoader) and CLIP node (DualCLIPLoader)
    let modelNodeId = null;
    let clipNodeId = null;
    
    for (const [id, node] of Object.entries(updatedWorkflow)) {
      if (node.class_type === "UNETLoader") {
        modelNodeId = id;
      } else if (node.class_type === "DualCLIPLoader") {
        clipNodeId = id;
      }
    }
    
    if (!modelNodeId || !clipNodeId) {
      console.error(`Required nodes not found. Model node: ${modelNodeId}, CLIP node: ${clipNodeId}`);
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
    
    console.log(`Found ${modelConsumers.length} nodes consuming model output:`, modelConsumers);
    
    // Start with a high node ID to avoid conflicts
    let nextNodeId = 100;
    
    // Create a chain of LoRA nodes
    let previousNodeId = modelNodeId;
    
    loras.forEach((lora, index) => {
      if (!lora.file_path || lora.file_path === "None") {
        console.log(`Skipping invalid LoRA: ${lora.name || 'unnamed'}`);
        return; // Skip invalid LoRAs
      }
      
      const currentNodeId = nextNodeId.toString();
      console.log(`Creating LoRA node ${currentNodeId} for ${lora.file_path}`);
      
      // Try using FluxLoraLoader first which is specifically made for Flux models
      try {
        updatedWorkflow[currentNodeId] = {
          "class_type": "FluxLoraLoader",
          "inputs": {
            "model": [previousNodeId, 0],
            "clip": [clipNodeId, 0],
            "lora_name": lora.file_path,
            "strength_model": parseFloat(lora.model_strength || 1.0),
            "strength_clip": parseFloat(lora.clip_strength || 1.0)
          },
          "_meta": {
            "title": `FluxLoraLoader: ${lora.name || lora.file_path}`
          }
        };
      } catch (error) {
        console.warn(`Error creating FluxLoraLoader, falling back to LoraLoader: ${error.message}`);
        
        // Fallback to standard LoraLoader if FluxLoraLoader is not available
        updatedWorkflow[currentNodeId] = {
          "class_type": "LoraLoader",
          "inputs": {
            "model": [previousNodeId, 0],
            "clip": [clipNodeId, 0],
            "lora_name": lora.file_path,
            "strength_model": parseFloat(lora.model_strength || 1.0),
            "strength_clip": parseFloat(lora.clip_strength || 1.0)
          },
          "_meta": {
            "title": `LoraLoader: ${lora.name || lora.file_path}`
          }
        };
      }
      
      // Update chain for next LoRA
      previousNodeId = currentNodeId;
      nextNodeId++;
    });
    
    // If we've added any LoRAs, update the connections
    if (previousNodeId !== modelNodeId) {
      console.log(`Updating ${modelConsumers.length} connections to point to last LoRA node ${previousNodeId}`);
      
      // Update all nodes that were previously connected to the model
      modelConsumers.forEach(consumer => {
        if (updatedWorkflow[consumer.nodeId] && 
            parseInt(consumer.nodeId) < 100) { // Don't update our own LoRA nodes
          console.log(`Updating node ${consumer.nodeId}, input ${consumer.inputName} to use LoRA node ${previousNodeId}`);
          updatedWorkflow[consumer.nodeId].inputs[consumer.inputName] = [previousNodeId, consumer.outputIndex];
        }
      });
    }
    
    return updatedWorkflow;
  },

  /**
   * Basic Flux workflow without image inputs - simplest working form
   */
  _createBasicFluxWorkflow({
    prompt,
    negativePrompt = 'low quality, bad anatomy, blurry, pixelated, distorted, deformed',
    steps = 20,
    filenamePrefix = 'Otherides-2d',
    timestamp = Date.now()
  }) {
    return {
      "1": {
        "inputs": {
          "unet_name": "blackforest/flux1-dev.sft",
          "weight_dtype": "fp8_e4m3fn"
        },
        "class_type": "UNETLoader",
        "_meta": {
          "title": "Load Diffusion Model"
        }
      },
      "2": {
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
      "3": {
        "inputs": {
          "vae_name": "ae.sft"
        },
        "class_type": "VAELoader",
        "_meta": {
          "title": "Load VAE"
        }
      },
      "4": {
        "inputs": {
          "text": prompt,
          "clip": [
            "2",
            0
          ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIP Text Encode (Prompt)"
        }
      },
      "5": {
        "inputs": {
          "text": negativePrompt,
          "clip": [
            "2",
            0
          ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIP Text Encode (Negative Prompt)"
        }
      },
      "6": {
        "inputs": {
          "width": 1024,
          "height": 1024,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage",
        "_meta": {
          "title": "Empty Latent Image"
        }
      },
      "7": {
        "inputs": {
          "seed": Math.floor(Math.random() * 1000000),
          "steps": steps,
          "cfg": 1.0,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1.0,
          "model": [
            "1",
            0
          ],
          "positive": [
            "4",
            0
          ],
          "negative": [
            "5",
            0
          ],
          "latent_image": [
            "6",
            0
          ]
        },
        "class_type": "KSampler",
        "_meta": {
          "title": "KSampler"
        }
      },
      "8": {
        "inputs": {
          "samples": [
            "7",
            0
          ],
          "vae": [
            "3", 
            0
          ]
        },
        "class_type": "VAEDecode",
        "_meta": {
          "title": "VAE Decode"
        }
      },
      "9": {
        "inputs": {
          "filename_prefix": `${filenamePrefix}_${timestamp}`,
          "images": [
            "8",
            0
          ]
        },
        "class_type": "SaveImage",
        "_meta": {
          "title": "Save Image"
        }
      }
    };
  },

  /**
   * Verifies that all node references in the workflow exist
   * @param {Object} workflow - The workflow to verify
   * @returns {Object} Validated workflow with fixes
   */
  _verifyNodeReferences(workflow) {
    const nodes = Object.keys(workflow);
    const fixedWorkflow = {...workflow};
    
    let modified = false;
    
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
              modified = true;
              
              // Try to find a suitable replacement
              if (node.class_type === "CLIPTextEncode") {
                // For CLIPTextEncode, try to find a CLIP model
                const clipNodes = nodes.filter(id => 
                  fixedWorkflow[id].class_type.includes("CLIP") ||
                  fixedWorkflow[id].class_type === "CheckpointLoaderSimple"
                );
                
                if (clipNodes.length > 0) {
                  console.log(`Fixing reference: replacing ${referencedNodeId} with ${clipNodes[0]}`);
                  node.inputs[inputKey] = [clipNodes[0], 1]; // Usually clip is output 1
                } else {
                  delete node.inputs[inputKey];
                }
              } else if (inputKey === "model") {
                // For model inputs, find a model node
                const modelNodes = nodes.filter(id => 
                  fixedWorkflow[id].class_type.includes("UNETLoader") ||
                  fixedWorkflow[id].class_type === "CheckpointLoaderSimple" ||
                  fixedWorkflow[id].class_type === "LoraLoader"
                );
                
                if (modelNodes.length > 0) {
                  console.log(`Fixing model reference: replacing ${referencedNodeId} with ${modelNodes[0]}`);
                  node.inputs[inputKey] = [modelNodes[0], 0]; // Model is usually output 0
                } else {
                  delete node.inputs[inputKey];
                }
              } else {
                // For other cases, just remove the reference
                console.log(`Removing invalid reference from node ${nodeId}, input ${inputKey}`);
                delete node.inputs[inputKey];
              }
            }
          }
        }
      }
    }
    
    if (modified) {
      console.log("Workflow was modified to fix invalid references");
    }
    
    return fixedWorkflow;
  },

    /**
   * Apply EasyLoraStack to workflow
   * @param {Object} workflow - Original workflow
   * @param {Array} loras - LoRAs to apply
   * @returns {Object} Updated workflow with EasyLoraStack
   */
  
/**
 * Apply EasyLoraStack to workflow - Fixed for your setup
 * @param {Object} workflow - Original workflow
 * @param {Array} loras - LoRAs to apply
 * @returns {Object} Updated workflow with EasyLoraStack
 */
 /**
 * Apply EasyLoraStack to workflow - Fixed for your setup
 * @param {Object} workflow - Original workflow
 * @param {Array} loras - LoRAs to apply
 * @returns {Object} Updated workflow with EasyLoraStack
 */
  _applyEasyLoraStackToWorkflow(workflow, loras) {
    // Clone the workflow to avoid modifying the original
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow));
    
    console.log(`Applying ${loras.length} LoRAs to workflow using EasyLoraStack`);
    
    if (!loras || loras.length === 0) {
      console.log('No LoRAs to add to workflow');
      return updatedWorkflow;
    }
    
    // Log the LoRAs being added for debugging
    console.log("LoRAs being added:", loras.map(lora => ({
      file_path: lora.file_path,
      model_strength: lora.model_strength,
      clip_strength: lora.clip_strength
    })));
    
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
    
    // Use high node IDs to avoid conflicts (900+ range)
    const loraStackNodeId = "901";
    const crApplyNodeId = "902";
    
    // Create EasyLoraStack node
    updatedWorkflow[loraStackNodeId] = {
      "inputs": {
        "toggle": true,
        "mode": "simple",
        "num_loras": Math.min(loras.length, 10) // Maximum 10 LoRAs supported
      },
      "class_type": "easy loraStack", // Must match exactly what ComfyUI expects
      "_meta": {
        "title": "EasyLoraStack"
      }
    };
    
    // Add each LoRA to the stack
    loras.forEach((lora, index) => {
      if (index < 10) { // Maximum 10 LoRAs in EasyLoraStack
        const loraIndex = index + 1;
        
        // Make sure the lora_name has the correct path
        const loraPath = lora.file_path || "None";
        console.log(`Adding LoRA ${loraIndex}: ${loraPath}`);
        
        updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_name`] = loraPath;
        updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_strength`] = parseFloat(lora.strength || 1.0);
        updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_model_strength`] = parseFloat(lora.model_strength || 1.0);
        updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_clip_strength`] = parseFloat(lora.clip_strength || 1.0);
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
        "title": "CR Apply LoRA Stack"
      }
    };
    
    // Redirect all model consumers to use the CR Apply LoRA Stack output
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
            // Don't change connections in our LoRA nodes
            if (id !== loraStackNodeId && id !== crApplyNodeId) {
              // Update to use the CLIP output from CR Apply LoRA Stack node
              updatedWorkflow[id].inputs[inputName] = [crApplyNodeId, 1];
            }
          }
        }
      }
    }
    
    return updatedWorkflow;
  }

















};

export default ComfyService;