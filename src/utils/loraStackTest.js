// src/tools/loraStackTest.js

/**
 * Test script to diagnose and fix EasyLoraStack integration
 * Run this in your browser console to see what's happening
 */

// Import the necessary modules (already available in your app)
import { detectLoraNodes } from '../services/easyLoraIntegration';
import loraService from '../services/loraService';
import ComfyService from '../services/comfyService';

/**
 * Run a complete diagnostic test of EasyLoraStack integration
 */
async function runLoraStackDiagnostic() {
  console.log("Running EasyLoraStack diagnostic...");
  
  // Step 1: Detect available LoRA nodes
  console.log("Step 1: Detecting LoRA nodes...");
  const nodeInfo = await detectLoraNodes();
  console.log("LoRA nodes detection result:", nodeInfo);
  
  // Step 2: Get available LoRAs
  console.log("Step 2: Getting available LoRAs...");
  const loras = await loraService.getAvailableLorasFromComfyUI();
  console.log(`Found ${loras.length} LoRAs:`, loras);
  
  // Select 2 LoRAs for testing
  const testLoras = loras.slice(0, 2).map((lora, index) => ({
    id: `test-${index}`,
    name: lora.name || lora.file_path.split('/').pop(),
    file_path: lora.file_path,
    model_strength: 0.8,
    clip_strength: 0.8,
    lora_order: index + 1
  }));
  
  console.log("Using test LoRAs:", testLoras);
  
  // Step 3: Create a simple test workflow
  console.log("Step 3: Creating test workflow...");
  const testWorkflow = {
    "1": {
      "class_type": "UNETLoader",
      "inputs": {
        "unet_name": "blackforest/flux1-dev.sft"
      }
    },
    "2": {
      "class_type": "DualCLIPLoader",
      "inputs": {
        "clip_name1": "Flux/t5xxl_fp8_e4m3fn.safetensors",
        "clip_name2": "clip_l.safetensors"
      }
    },
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["1", 0],
        "seed": 42,
        "steps": 20,
        "cfg": 8,
        "sampler_name": "euler",
        "scheduler": "normal",
        "latent_image": ["5", 0],
        "positive": ["6", 0],
        "negative": ["7", 0]
      }
    },
    "5": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "width": 512,
        "height": 512,
        "batch_size": 1
      }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": "test prompt",
        "clip": ["2", 0]
      }
    },
    "7": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": "bad quality",
        "clip": ["2", 0]
      }
    }
  };
  
  // Step 4: Apply EasyLoraStack to the workflow
  console.log("Step 4: Applying EasyLoraStack to workflow...");
  
  // 4a: First try with our new implementation
  const { applyEasyLoraStack } = await import('../services/easyLoraIntegration');
  const updatedWorkflow1 = await applyEasyLoraStack(testWorkflow, testLoras);
  console.log("Updated workflow (new implementation):", updatedWorkflow1);
  
  // Check if easy loraStack node was added
  const hasEasyLoraStack1 = Object.values(updatedWorkflow1).some(
    node => node.class_type === 'easy loraStack' || node.class_type === 'easy_loraStack'
  );
  
  console.log("EasyLoraStack added:", hasEasyLoraStack1);
  
  // 4b: Compare with the existing implementation
  console.log("Comparing with existing implementation...");
  
  // Create workflow with ComfyService
  const { workflow: updatedWorkflow2 } = ComfyService.createFluxWorkflow({
    prompt: "test prompt",
    steps: 20,
    filenamePrefix: "test",
    loras: testLoras
  });
  
  console.log("Updated workflow (existing implementation):", updatedWorkflow2);
  
  // Check if it added LoRA nodes
  const hasEasyLoraStack2 = Object.values(updatedWorkflow2).some(
    node => node.class_type === 'easy loraStack' || node.class_type === 'easy_loraStack'
  );
  
  console.log("EasyLoraStack added (existing):", hasEasyLoraStack2);
  
  // Step 5: Generate a solution
  console.log("\n========= DIAGNOSTIC RESULTS =========");
  
  if (!nodeInfo.hasEasyLoraStack) {
    console.log("PROBLEM: EasyLoraStack node not found in ComfyUI");
    console.log("SOLUTION: Install the ComfyUI_LoRA_Block extension");
  }
  
  if (!nodeInfo.hasCRApplyLoraStack) {
    console.log("PROBLEM: CR Apply LoRA Stack node not found in ComfyUI");
    console.log("SOLUTION: Install the ComfyUI_LoRA_Block extension");
  }
  
  if (loras.length === 0) {
    console.log("PROBLEM: No LoRAs found in ComfyUI");
    console.log("SOLUTION: Add LoRA files to your ComfyUI models/loras directory");
  }
  
  if (!hasEasyLoraStack1 && !hasEasyLoraStack2) {
    console.log("PROBLEM: Neither implementation can add EasyLoraStack nodes");
    console.log("SOLUTION: There's likely an issue with the node class names. Try installing ComfyUI_LoRA_Block");
  } else if (hasEasyLoraStack1 && !hasEasyLoraStack2) {
    console.log("SOLUTION: Use the new implementation from easyLoraIntegration.js");
  } else if (!hasEasyLoraStack1 && hasEasyLoraStack2) {
    console.log("SOLUTION: Continue using the existing implementation, but check why it's not working in practice");
  } else {
    console.log("Both implementations add EasyLoraStack nodes correctly");
    
    // Compare implementations
    const easyNodeId1 = Object.entries(updatedWorkflow1).find(
      ([_, node]) => node.class_type === 'easy loraStack' || node.class_type === 'easy_loraStack'
    )?.[0];
    
    const easyNodeId2 = Object.entries(updatedWorkflow2).find(
      ([_, node]) => node.class_type === 'easy loraStack' || node.class_type === 'easy_loraStack'
    )?.[0];
    
    if (easyNodeId1 && easyNodeId2) {
      console.log("Comparing EasyLoraStack nodes:");
      console.log("Node ID (new):", easyNodeId1);
      console.log("Node ID (existing):", easyNodeId2);
      
      const node1 = updatedWorkflow1[easyNodeId1];
      const node2 = updatedWorkflow2[easyNodeId2];
      
      console.log("Class type (new):", node1.class_type);
      console.log("Class type (existing):", node2.class_type);
      
      if (node1.class_type !== node2.class_type) {
        console.log("PROBLEM: Different class names being used");
        console.log(`SOLUTION: Update your comfyService.js to use "${node1.class_type}" instead of "${node2.class_type}"`);
      }
      
      // Check if LoRA paths are set correctly
      const lora1Path = node1.inputs?.lora_1_name;
      const lora1Path2 = node2.inputs?.lora_1_name;
      
      if (lora1Path !== lora1Path2) {
        console.log("PROBLEM: Different LoRA paths being used");
        console.log(`Path (new): ${lora1Path}`);
        console.log(`Path (existing): ${lora1Path2}`);
        console.log("SOLUTION: Make sure file_path in your LoRAs match exactly what ComfyUI expects");
      }
    }
  }
  
  // Final recommendation
  console.log("\n========= FINAL RECOMMENDATION =========");
  
  if (!nodeInfo.hasCRApplyLoraStack) {
    console.log(`
    Install the ComfyUI_LoRA_Block extension:
    1. Go to ComfyUI/custom_nodes directory
    2. Run: git clone https://github.com/ssitu/ComfyUI_LoRA_Block
    3. Restart ComfyUI
    `);
  } else {
    console.log(`
    Fix your _applyEasyLoraStackToWorkflow method in comfyService.js:
    1. Make sure the correct class names are used: "${nodeInfo.easyLoraStackClassName}" and "${nodeInfo.crApplyClassName}"
    2. Check all LoRA file paths match exactly what ComfyUI expects
    3. Make sure node IDs are high enough to avoid conflicts (e.g., 900+)
    4. Verify that all model consumers are properly redirected to use the LoRA output
    `);
  }
}

// Run the diagnostic
runLoraStackDiagnostic().catch(error => {
  console.error("Error running diagnostic:", error);
});

// Export for reuse
export default runLoraStackDiagnostic;
