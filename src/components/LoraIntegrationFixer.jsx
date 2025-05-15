// src/services/easyLoraIntegration.js

/**
 * Simple and clean EasyLoraStack integration for ComfyUI
 * Handles the case where the CR Apply LoRA Stack node might be missing
 */

/**
 * Find available LoRA nodes in ComfyUI
 * @returns {Promise<Object>} Information about available LoRA nodes
 */
async function detectLoraNodes() {
  const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';
  
  try {
    const response = await fetch(`${API_BASE_URL}/object_info`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch object_info: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for EasyLoraStack and CR Apply LoRA Stack
    const hasEasyLoraStack = !!(data['easy loraStack'] || data.easy_loraStack);
    const hasCRApplyLoraStack = !!(data['CR Apply LoRA Stack'] || data.CR_Apply_LoRA_Stack);
    
    // Figure out the exact class names to use
    const easyLoraStackClassName = data['easy loraStack'] ? 'easy loraStack' : 
                                   data.easy_loraStack ? 'easy_loraStack' : null;
                                   
    const crApplyClassName = data['CR Apply LoRA Stack'] ? 'CR Apply LoRA Stack' : 
                             data.CR_Apply_LoRA_Stack ? 'CR_Apply_LoRA_Stack' : null;
    
    return {
      hasEasyLoraStack,
      hasCRApplyLoraStack,
      easyLoraStackClassName,
      crApplyClassName
    };
  } catch (error) {
    console.error("Error detecting LoRA nodes:", error);
    return {
      hasEasyLoraStack: false,
      hasCRApplyLoraStack: false,
      error: error.message
    };
  }
}

/**
 * Apply the EasyLoraStack approach to a workflow
 * @param {Object} workflow - Original workflow
 * @param {Array} loras - LoRAs to apply
 * @returns {Promise<Object>} Updated workflow with EasyLoraStack
 */
async function applyEasyLoraStack(workflow, loras) {
  // Skip if no LoRAs or no workflow
  if (!workflow || !loras || !Array.isArray(loras) || loras.length === 0) {
    console.log('No LoRAs to add to workflow');
    return workflow;
  }
  
  // Filter out invalid LoRAs
  const validLoras = loras.filter(lora => lora && lora.file_path && lora.file_path !== 'None');
  
  if (validLoras.length === 0) {
    console.log('No valid LoRAs to add');
    return workflow;
  }
  
  console.log(`Applying ${validLoras.length} LoRAs using EasyLoraStack:`, 
    validLoras.map(l => l.file_path));
  
  // Detect available LoRA nodes
  const nodeInfo = await detectLoraNodes();
  
  if (!nodeInfo.hasEasyLoraStack) {
    console.error("EasyLoraStack node not found in ComfyUI");
    return workflow;
  }
  
  // Clone the workflow to avoid modifying the original
  const updatedWorkflow = JSON.parse(JSON.stringify(workflow));
  
  // Find the UNETLoader node (model node)
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
  
  if (!modelNodeId) {
    console.error("No UNETLoader node found in workflow");
    return workflow;
  }
  
  console.log(`Found model node: ${modelNodeId}, clip node: ${clipNodeId || 'none'}`);
  
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
  
  console.log(`Found ${modelConsumers.length} nodes connecting to model ${modelNodeId}`);
  
  // Generate high node IDs to avoid conflicts
  const loraStackNodeId = "991";
  
  // Create EasyLoraStack node with the correct class name
  updatedWorkflow[loraStackNodeId] = {
    "inputs": {
      "toggle": true,
      "mode": "simple",
      "num_loras": Math.min(validLoras.length, 10) // Maximum 10 LoRAs supported
    },
    "class_type": nodeInfo.easyLoraStackClassName || 'easy loraStack',
    "_meta": {
      "title": "EasyLoraStack"
    }
  };
  
  // Add each LoRA to the stack
  validLoras.forEach((lora, index) => {
    if (index < 10) { // Maximum 10 LoRAs in EasyLoraStack
      const loraIndex = index + 1;
      updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_name`] = lora.file_path || "None";
      updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_strength`] = parseFloat(lora.strength || 1.0);
      updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_model_strength`] = parseFloat(lora.model_strength || 1.0);
      updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_clip_strength`] = parseFloat(lora.clip_strength || 1.0);
    }
  });
  
  // Fill in remaining LoRA slots with "None"
  for (let i = validLoras.length + 1; i <= 10; i++) {
    updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_name`] = "None";
    updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_strength`] = 1.0;
    updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_model_strength`] = 1.0;
    updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_clip_strength`] = 1.0;
  }
  
  // If CR Apply LoRA Stack is available, use it
  if (nodeInfo.hasCRApplyLoraStack) {
    const crApplyNodeId = "992";
    
    // Create CR Apply LoRA Stack node
    updatedWorkflow[crApplyNodeId] = {
      "inputs": {
        "model": [modelNodeId, 0],
        "clip": [clipNodeId, 0],
        "lora_stack": [loraStackNodeId, 0]
      },
      "class_type": nodeInfo.crApplyClassName || 'CR Apply LoRA Stack',
      "_meta": {
        "title": "CR Apply LoRA Stack"
      }
    };
    
    // Redirect all model consumers to use the CR Apply LoRA Stack output
    modelConsumers.forEach(consumer => {
      // Don't update our own nodes
      if (consumer.id !== loraStackNodeId && consumer.id !== crApplyNodeId) {
        updatedWorkflow[consumer.id].inputs[consumer.inputName] = [crApplyNodeId, 0];
      }
    });
    
    // For nodes that need CLIP, update them to use CR Apply LoRA Stack CLIP output
    if (clipNodeId) {
      for (const [id, node] of Object.entries(updatedWorkflow)) {
        if (node.inputs) {
          for (const [inputName, inputValue] of Object.entries(node.inputs)) {
            if (Array.isArray(inputValue) && inputValue[0] === clipNodeId) {
              // Don't change connections in our LoRA nodes
              if (id !== loraStackNodeId && id !== crApplyNodeId) {
                updatedWorkflow[id].inputs[inputName] = [crApplyNodeId, 1];
              }
            }
          }
        }
      }
    }
  } else {
    // Without CR Apply LoRA Stack, we need an alternative approach
    // Log a warning for now - in a real implementation you'd handle this differently
    console.warn("CR Apply LoRA Stack node not found. This setup may not work properly.");
    
    // In a complete solution, you'd need to use FluxLoraLoader nodes as a fallback
    // or implement your own version of CR Apply LoRA Stack, but that's beyond the scope
    // of this simplified approach
  }
  
  return updatedWorkflow;
}

export {
  detectLoraNodes,
  applyEasyLoraStack
};

export default {
  detectLoraNodes,
  applyEasyLoraStack
};