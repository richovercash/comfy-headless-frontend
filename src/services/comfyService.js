// src/services/comfyService.js
import axios from 'axios';
// Update src/services/comfyService.js
// In src/services/comfyService.js
import { fluxWorkflow } from '../workflows';
import { fluxNodes } from '../workflows/flux-config';
import deepClone from 'lodash/cloneDeep';


// Remove the /api suffix
const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';

console.log("API URL:", API_BASE_URL)


export const ComfyService = {
  /**
   * Get the status of the ComfyUI server
   */
  async getStatus() {
    try {
      const response = await axios.get(`${API_BASE_URL}/system_stats`);
      return response.data;
    } catch (error) {
      console.error('Error getting ComfyUI status:', error);
      throw error;
    }
  },

  /**
   * Queue a prompt for processing in ComfyUI
   * @param {Object} workflow - The workflow to queue
   */
// In your comfyService.js, make sure your request format exactly matches what ComfyUI expects:

  // Make sure your queuePrompt function in comfyService.js has the right format
  async queuePrompt(workflow) {
    try {
      console.log("Queueing workflow:", workflow);
      
      // Format expected by ComfyUI API
      const payload = {
        prompt: workflow,
        client_id: "generator-" + Date.now()
      };
      
      console.log("Sending payload:", JSON.stringify(payload).substring(0, 200) + "...");
      
      // Use fetch for simplicity and better error handling
      const response = await fetch(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error response:", errorText);
        throw new Error(`Failed to queue prompt: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error queuing prompt:', error);
      throw error;
    }
  },

  /**
   * Get the history of generated images
   */
  async getHistory() {
    try {
      const response = await axios.get(`${API_BASE_URL}/history`);
      return response.data;
    } catch (error) {
      console.error('Error getting history:', error);
      throw error;
    }
  },

    // Add this to your ComfyService
  async getAvailableModels() {
    try {
      // This endpoint might be different depending on your ComfyUI version
      const response = await axios.get(`${API_BASE_URL}/object_info`);
      const data = response.data;
      
      // Extract available models from the response
      if (data && data.CheckpointLoaderSimple && data.CheckpointLoaderSimple.input.required.ckpt_name) {
        return data.CheckpointLoaderSimple.input.required.ckpt_name.options;
      }
      
      return [];
    } catch (error) {
      console.error('Error getting available models:', error);
      return [];
    }
  },

  /**
   * Get the output of a specific execution
   * @param {string} promptId - The prompt ID to get output for
   */
  async getOutput(promptId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/history/${promptId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting output:', error);
      throw error;
    }
  },

    // Add this method to your ComfyService
  async testConnection() {
    try {
      // First try a simple system_stats request to check connection
      const statsResponse = await fetch(`${this.baseUrl}/system_stats`);
      if (!statsResponse.ok) {
        return {
          success: false, 
          error: new Error(`System stats request failed with status: ${statsResponse.status}`)
        };
      }
      
      // Test with a simple valid workflow
      const testWorkflow = {
        "1": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512,
            "batch_size": 1
          }
        },
        "2": {
          "class_type": "VAELoader",
          "inputs": {
            "vae_name": "vae-ft-mse-840000-ema-pruned.safetensors"
          }
        },
        "3": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["1", 0],
            "vae": ["2", 0]
          }
        },
        "4": {
          "class_type": "SaveImage",
          "inputs": {
            "filename_prefix": "connection_test",
            "images": ["3", 0]
          }
        }
      };
      
      const payload = {
        prompt: testWorkflow,
        client_id: "test-" + Date.now()
      };
      
      console.log("Sending test workflow to ComfyUI:", JSON.stringify(payload).substring(0, 200) + "...");
      
      const response = await fetch(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Test connection error response:", errorText);
        return {success: false, error: new Error(errorText)};
      }
      
      const result = await response.json();
      console.log("Connection test successful!", result);
      return {success: true, result};
    } catch (error) {
      console.error("Connection test failed!", error);
      return {success: false, error};
    }
  },

  // Add this to src/services/comfyService.js

  /**
   * Generate a depth map from an input image
   * @param {string} imageUrl - URL or path to the input image
   * @returns {Promise<string>} - URL to the generated depth map
   */
  // async generateDepthMap(imageUrl) {
  //   try {
  //     console.log("Generating depth map for image:", imageUrl);
      
  //     // For now, we'll create a mock implementation
  //     // In a real implementation, you would:
  //     // 1. Create a simplified workflow that uses your DepthAnything_V2 node
  //     // 2. Execute that workflow with ComfyUI
  //     // 3. Return the URL to the generated depth map
      
  //     // Mock delay to simulate processing
  //     await new Promise(resolve => setTimeout(resolve, 1500));
      
  //     // For testing, return a placeholder depth map
  //     // You can replace this with actual depth map generation later
      
  //     // Option 1: Return a placeholder image URL
  //     return 'https://via.placeholder.com/512x512/333333/FFFFFF?text=Depth+Map';
      
  //     // Option 2: When you're ready to implement real depth map generation:
  //     /*
  //     // Create a simplified workflow for depth map generation
  //     const depthWorkflow = {
  //       // Nodes from your workflow that handle depth map generation
  //       // You'll need to extract these from your Redux-Simple.json
  //     };
      
  //     // Execute the workflow
  //     const result = await this.queuePrompt(depthWorkflow);
      
  //     // Wait for the workflow to complete
  //     // Implement polling or WebSocket monitoring here
      
  //     // Return the URL to the generated depth map
  //     return `http://localhost:8188/view?filename=depth_${Date.now()}.png`;
  //     */
  //   } catch (error) {
  //     console.error("Error generating depth map:", error);
  //     throw error;
  //   }
  // }




  /**
   * Create a simple workflow for generating a post-apocalyptic vehicle
   * @param {string} prompt - The text prompt for generation
   * @param {Array} traits - Array of traits to include in generation
   */
//   createFluxWorkflow({
//     prompt,
//     steps = 28,
//     inputImageUrl = null,
//     reduxImageUrl = null,
//     filenamePrefix = 'Otherides-2d_'
//   }) {
//     // Create a timestamp for the filename
//   const timestamp = Math.floor(Date.now()/1000);
  
//   // Clone the original workflow
//   const workflow = deepClone(fluxWorkflow);
  
//   // Check if workflow has nodes property - ComfyUI expects nodes directly, not wrapped in an object
//   const actualWorkflow = workflow.nodes ? workflow.nodes : workflow;
  
//   console.log("Workflow structure check:", {
//     hasNodesProperty: Boolean(workflow.nodes),
//     topLevelKeys: Object.keys(workflow),
//     firstNodeSample: actualWorkflow[Object.keys(actualWorkflow)[0]]
//   });
  
//   // Set prompt in CLIPTextEncode node (node 52)
//   if (actualWorkflow[52] && actualWorkflow[52].widgets_values) {
//     actualWorkflow[52].widgets_values = [prompt];
//   } else {
//     console.warn("Could not find CLIPTextEncode node for prompt");
//   }
  
//   // Set steps in BasicScheduler node (node 15)
//   if (actualWorkflow[15] && actualWorkflow[15].widgets_values) {
//     actualWorkflow[15].widgets_values = ["simple", steps, 1];
//   } else {
//     console.warn("Could not find BasicScheduler node for steps");
//   }
  
//   // Set filename prefix in Text Multiline node (node 25)
//   if (actualWorkflow[25] && actualWorkflow[25].widgets_values) {
//     actualWorkflow[25].widgets_values = [filenamePrefix];
//   } else {
//     console.warn("Could not find Text Multiline node for filename");
//   }
  
//   // Set random seed
//   if (actualWorkflow[16] && actualWorkflow[16].widgets_values) {
//     actualWorkflow[16].widgets_values = [Math.floor(Math.random() * 1000000), "fixed"];
//   } else {
//     console.warn("Could not find RandomNoise node for seed");
//   }
  
//   // Set input image if provided
//   if (inputImageUrl && actualWorkflow[79] && actualWorkflow[79].widgets_values) {
//     actualWorkflow[79].widgets_values = [inputImageUrl, "image", ""];
//   } else if (inputImageUrl) {
//     console.warn("Could not find LoadImage node for input image");
//   }
  
//   // Set redux image if provided
//   if (reduxImageUrl && actualWorkflow[59] && actualWorkflow[59].widgets_values) {
//     actualWorkflow[59].widgets_values = [reduxImageUrl, "image", ""];
//   } else if (reduxImageUrl) {
//     console.warn("Could not find LoadImage node for redux image");
//   }
  
//   // Make sure all nodes have class_type property
//   Object.keys(actualWorkflow).forEach(nodeId => {
//     const node = actualWorkflow[nodeId];
//     if (!node.class_type && node.type) {
//       // If missing class_type but has type, use that
//       node.class_type = node.type;
//     }
//     // Add error checking for missing class_type
//     if (!node.class_type) {
//       console.error(`Node ${nodeId} is missing class_type property:`, node);
//     }
//   });

//     console.log("Generated workflow structure:", {
//     nodeCount: Object.keys(workflow).length,
//     hasLinks: workflow.links !== undefined,
//     firstNodeSample: workflow[Object.keys(workflow)[0]]
//   });
  
//   // Return the appropriate workflow structure based on what ComfyUI expects
//   return { 
//     workflow: workflow.nodes ? workflow.nodes : workflow, 
//     timestamp 
//   };
// }
  createFluxWorkflow({
    prompt,
    steps = 28,
    inputImageUrl = null,
    reduxImageUrl = null,
    filenamePrefix = 'Otherides-2d/cycles_'
  }) {
    const timestamp = Math.floor(Date.now()/1000);
    
    // Extremely simple workflow - just to test the connection
    const workflow = {
      "1": {
        "class_type": "EmptyLatentImage",
        "inputs": {
          "width": 512,
          "height": 512,
          "batch_size": 1
        }
      },
      "2": {
        "class_type": "VAELoader",
        "inputs": {
          "vae_name": "vae-ft-mse-840000-ema-pruned.safetensors"
        }
      },
      "3": {
        "class_type": "VAEDecode",
        "inputs": {
          "samples": ["1", 0],
          "vae": ["2", 0]
        }
      },
      "4": {
        "class_type": "SaveImage",
        "inputs": {
          "filename_prefix": `${filenamePrefix}${timestamp}`,
          "images": ["3", 0]
        }
      }
    };
    
    return { workflow, timestamp };
  },

    // Add this to your ComfyService
  async testConnection() {
    try {
      // Test with a simple valid workflow
      const testWorkflow = {
        "1": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512,
            "batch_size": 1
          }
        },
        "2": {
          "class_type": "VAELoader",
          "inputs": {
            "vae_name": "vae-ft-mse-840000-ema-pruned.safetensors"
          }
        },
        "3": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["1", 0],
            "vae": ["2", 0]
          }
        },
        "4": {
          "class_type": "SaveImage",
          "inputs": {
            "filename_prefix": "connection_test",
            "images": ["3", 0]
          }
        }
      };
      
      const result = await this.queuePrompt(testWorkflow);
      console.log("Connection test successful!", result);
      return {success: true, result};
    } catch (error) {
      console.error("Connection test failed!", error);
      return {success: false, error};
    }
  }


};

export default ComfyService;

