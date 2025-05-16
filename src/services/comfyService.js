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
   * Import LoRAs from ComfyUI into the database
   * This will fetch all LoRAs available in ComfyUI and add them to your database
   * @returns {Promise<Object>} Import results
   */
  async importAllLorasFromComfyUI() {
    try {
      console.log("Importing all LoRAs from ComfyUI to database...");
      
      // Get all LoRAs available in ComfyUI
      const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';
      const response = await fetch(`${API_BASE_URL}/object_info`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data from ComfyUI API: ${response.status}`);
      }
      
      const data = await response.json();
      const loraOptions = [];
      
      // First try with EasyLoraStack
      if (data['easy loraStack']) {
        const easyLoraStack = data['easy loraStack'];
        
        if (easyLoraStack.input?.optional) {
          for (let i = 1; i <= 10; i++) {
            const loraField = `lora_${i}_name`;
            if (easyLoraStack.input.optional[loraField]) {
              // Extract options from the array format
              try {
                const fieldData = easyLoraStack.input.optional[loraField];
                
                if (Array.isArray(fieldData) && fieldData.length > 1 && Array.isArray(fieldData[1])) {
                  fieldData[1].forEach(path => {
                    if (path && path !== 'None') {
                      loraOptions.push(path);
                    }
                  });
                }
              } catch (err) {
                console.warn(`Error parsing LoRA options from field ${loraField}:`, err);
              }
            }
          }
        }
      }
      
      // Try LoraLoader
      if (data.LoraLoader?.input?.required?.lora_name?.options) {
        const options = data.LoraLoader.input.required.lora_name.options;
        Object.keys(options).forEach(path => {
          if (path !== 'None') {
            loraOptions.push(path);
          }
        });
      }
      
      // Try FluxLoraLoader
      if (data.FluxLoraLoader?.input?.required?.lora_name?.options) {
        const options = data.FluxLoraLoader.input.required.lora_name.options;
        Object.keys(options).forEach(path => {
          if (path !== 'None') {
            loraOptions.push(path);
          }
        });
      }
      
      // Remove duplicates
      const uniquePaths = [...new Set(loraOptions)];
      console.log(`Found ${uniquePaths.length} unique LoRAs in ComfyUI`);
      
      // Format LoRAs for database
      const lorasToInsert = uniquePaths.map(path => {
        // Extract name from path
        const name = path.split('/').pop().replace(/\.\w+$/, '');
        const category = path.includes('/') ? path.split('/')[0] : 'Default';
        
        return {
          name: name,
          file_path: path,
          display_name: name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: category,
          // Leave activation_words and description blank for manual editing
          activation_words: '',
          description: ''
        };
      });
      
      // Upsert to database
      if (lorasToInsert.length > 0) {
        console.log(`Upserting ${lorasToInsert.length} LoRAs to database`);
        const { data, error } = await supabase
          .from('loras')
          .upsert(lorasToInsert, { 
            onConflict: 'file_path',
            // Only update these fields if the row exists
            ignoreDuplicates: false
          })
          .select();
          
        if (error) {
          console.error("Error upserting LoRAs to database:", error);
          throw error;
        }
        
        return {
          success: true,
          message: `Successfully imported ${lorasToInsert.length} LoRAs from ComfyUI`,
          imported: lorasToInsert.length,
          loras: data
        };
      } else {
        return {
          success: false,
          message: "No LoRAs found in ComfyUI",
          imported: 0
        };
      }
    } catch (error) {
      console.error("Error importing LoRAs from ComfyUI:", error);
      return {
        success: false,
        error: error.message
      };
    }
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
    
    if (loras && loras.length > 0) {
      console.log("Using LoRAs in workflow:", loras.map(lora => ({
        name: lora.name || lora.file_path,
        file_path: lora.file_path,
        model_strength: lora.model_strength,
        clip_strength: lora.clip_strength
      })));
    }
    
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
    console.log("DEBUG PROMPT: Activation words:", activationWords || "<empty string>");
    console.log("DEBUG PROMPT: Full prompt with activations:", fullPrompt);
    
    // Create the basic workflow
    let workflow = this._createBasicFluxWorkflow({
      prompt: fullPrompt,
      negativePrompt,
      steps,
      filenamePrefix,
      timestamp
    });
    
    // IMPORTANT FIX: Apply LoRA configuration EXPLICITLY if provided
    if (loras && loras.length > 0) {
      console.log(`Explicitly adding ${loras.length} LoRAs to workflow`);
      try {
        // Add LoRAs to the workflow
        workflow = this._applyEasyLoraStackToWorkflow(workflow, loras);
        
        // Verify LoRAs were added
        const hasLoraStack = Object.values(workflow).some(node => 
          node.class_type === "easy loraStack"
        );
        
        if (!hasLoraStack) {
          console.error("Failed to add LoRAs to workflow!");
        } else {
          console.log("Successfully added LoRAs to workflow");
        }
      } catch (error) {
        console.error("Error applying LoRAs:", error);
        // Continue with the original workflow if there was an error
      }
    }
    
    // Final validation check
    workflow = this._verifyNodeReferences(workflow);
    
    console.log('Workflow created');
    
    // Diagnostics
    if (loras && loras.length > 0) {
      // Check if workflow has the LoRA stack node
      const loraStackNode = Object.entries(workflow).find(([_, node]) => 
        node.class_type === "easy loraStack"
      )?.[1];
      
      const crApplyNode = Object.entries(workflow).find(([_, node]) => 
        node.class_type === "CR Apply LoRA Stack"
      )?.[1];
      
      console.log("DEBUG WORKFLOW: LoRA stack node:", loraStackNode);
      console.log("DEBUG WORKFLOW: CR Apply node:", crApplyNode);
      
      if (loraStackNode) {
        console.log("DEBUG WORKFLOW: LoRA paths in stack:", 
          Array.from({length: loraStackNode.inputs.num_loras}, (_, i) => i + 1)
            .map(i => loraStackNode.inputs[`lora_${i}_name`])
            .filter(path => path !== "None")
        );
      }
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
 * Apply EasyLoraStack to workflow - Fixed for exact class name matching
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
    
    // Create EasyLoraStack node with the EXACT class name "easy loraStack" (with space, not underscore)
    updatedWorkflow[loraStackNodeId] = {
      "inputs": {
        "toggle": true,
        "mode": "simple",
        "num_loras": Math.min(loras.length, 10) // Maximum 10 LoRAs supported
      },
      "class_type": "easy loraStack", // EXACT class name with space
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
    
    // Create CR Apply LoRA Stack node with the EXACT class name "CR Apply LoRA Stack" (with spaces)
    updatedWorkflow[crApplyNodeId] = {
      "inputs": {
        "model": [modelNodeId, 0],
        "clip": [clipNodeId, 0],
        "lora_stack": [loraStackNodeId, 0]
      },
      "class_type": "CR Apply LoRA Stack", // EXACT class name with spaces
      "_meta": {
        "title": "CR Apply LoRA Stack"
      }
    };
    
    // Redirect all model consumers to use the CR Apply LoRA Stack output
    modelConsumers.forEach(consumer => {
      // Only update if this isn't one of our newly added nodes
      if (consumer.id !== loraStackNodeId && consumer.id !== crApplyNodeId) {
        // Update the connection to use the CR Apply LoRA Stack output
        if (updatedWorkflow[consumer.id]) {
          updatedWorkflow[consumer.id].inputs[consumer.inputName] = [crApplyNodeId, 0];
        }
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
    
    // Add debug logs to verify what was created
    console.log("Added LoRA nodes to workflow:", {
      loraStackNode: updatedWorkflow[loraStackNodeId].class_type,
      crApplyNode: updatedWorkflow[crApplyNodeId].class_type,
      loraCount: updatedWorkflow[loraStackNodeId].inputs.num_loras
    });
    
    return updatedWorkflow;
  },

  /**
   * Test function to directly verify EasyLoraStack integration
   * You can run this manually from the browser console
   */
  testLoraIntegration() {
    try {
      console.log("Running LoRA integration test...");
      
      // Create a minimal test workflow
      const testWorkflow = {
        "1": {
          "class_type": "UNETLoader",
          "inputs": {
            "unet_name": "blackforest/flux1-dev.sft",
            "weight_dtype": "fp8_e4m3fn"
          }
        },
        "2": {
          "class_type": "DualCLIPLoader",
          "inputs": {
            "clip_name1": "Flux/t5xxl_fp16.safetensors",
            "clip_name2": "Flux/clip_l.safetensors",
            "type": "flux"
          }
        },
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 123456,
            "steps": 20,
            "cfg": 1.0,
            "sampler_name": "euler",
            "scheduler": "normal",
            "denoise": 1.0,
            "model": ["1", 0],
            "positive": ["4", 0],
            "negative": ["5", 0],
            "latent_image": ["6", 0]
          }
        },
        "4": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test prompt",
            "clip": ["2", 0]
          }
        },
        "5": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "bad quality",
            "clip": ["2", 0]
          }
        },
        "6": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512,
            "batch_size": 1
          }
        }
      };
      
      // Create test LoRAs using real paths from your system
      const testLoras = [
        {
          id: "test1",
          name: "Neon Cyberpunk",
          file_path: "Flux/Neon_Cyberpunk_Cyberspace_FLUX.safetensors",
          model_strength: 1.0,
          clip_strength: 1.0
        },
        {
          id: "test2",
          name: "Gatling",
          file_path: "Flux/OtherRides/gatling-000008.safetensors",
          model_strength: 0.8, 
          clip_strength: 1.0
        }
      ];
      
      console.log("Test LoRAs:", testLoras);
      
      // Apply LoRAs to the workflow
      const updatedWorkflow = this._applyEasyLoraStackToWorkflow(testWorkflow, testLoras);
      
      // Check if the LoRA nodes were added
      const loraStackNode = Object.entries(updatedWorkflow).find(([_, node]) => 
        node.class_type === "easy loraStack"
      );
      
      const crApplyNode = Object.entries(updatedWorkflow).find(([_, node]) => 
        node.class_type === "CR Apply LoRA Stack"
      );
      
      console.log("LoRA stack node:", loraStackNode ? loraStackNode[0] : "Not found");
      console.log("CR Apply node:", crApplyNode ? crApplyNode[0] : "Not found");
      
      if (loraStackNode && crApplyNode) {
        console.log("LoRA integration test PASSED! ✅");
        console.log("LoRA stack class_type:", loraStackNode[1].class_type);
        console.log("CR Apply class_type:", crApplyNode[1].class_type);
        
        // Check if the KSampler node is now connected to CR Apply node
        const kSamplerNode = updatedWorkflow["3"];
        if (kSamplerNode && kSamplerNode.inputs.model[0] === crApplyNode[0]) {
          console.log("KSampler connections updated correctly! ✅");
        } else {
          console.log("KSampler connections NOT updated ❌");
        }
        
        return {
          success: true,
          workflow: updatedWorkflow
        };
      } else {
        console.log("LoRA integration test FAILED! ❌");
        return {
          success: false,
          workflow: updatedWorkflow
        };
      }
    } catch (error) {
      console.error("Error in LoRA integration test:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }














};


  

export default ComfyService;


