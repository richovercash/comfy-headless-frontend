// src/services/comfyService.js
import axios from 'axios';

// ComfyUI API base URL (configurable via environment variable)
export const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';

/**
 * Service for interacting with ComfyUI
 */
const ComfyService = {
  /**
   * Test connection to ComfyUI
   */
  async testConnection() {
    try {
      // Try to get object_info to verify the API is up
      const response = await axios.get(`${API_BASE_URL}/object_info`, {
        timeout: 5000 // 5 second timeout
      });
      
      return { 
        success: true, 
        data: response.data 
      };
    } catch (error) {
      console.error("ComfyUI connection test failed:", error);
      
      return { 
        success: false, 
        error: {
          message: error.message,
          details: error.response?.data || 'No response data'
        }
      };
    }
  },
  
  /**
   * Queue a workflow prompt to ComfyUI
   * @param {Object} workflow - The workflow definition
   * @returns {Promise<Object>} - The ComfyUI response
   */
  async queuePrompt(workflow) {
    try {
      const response = await axios.post(`${API_BASE_URL}/prompt`, {
        prompt: workflow,
        client_id: "nft-generator-" + Date.now()
      });
      
      return response.data;
    } catch (error) {
      console.error("Error queueing prompt:", error);
      
      const errorMessage = error.response?.data?.error?.message || error.message;
      const nodeErrors = error.response?.data?.node_errors || {};
      
      // Provide more detailed error info
      const errorDetails = Object.entries(nodeErrors).map(([nodeId, errors]) => {
        return `Node ${nodeId} (${errors.class_type}): ${errors.errors[0]?.message || 'Unknown error'}`;
      }).join('; ');
      
      throw new Error(`Failed to queue prompt: ${errorMessage} ${errorDetails ? `- ${errorDetails}` : ''}`);
    }
  },
  
  /**
   * Upload an image directly to ComfyUI server
   * @param {File} imageFile - The image file to upload
   * @returns {Promise<string>} - Filename on ComfyUI server
   */
  async uploadImageToComfyUI(imageFile) {
    try {
      // Create a unique filename
      const extension = imageFile.name.split('.').pop();
      const uniqueFilename = `uploaded_${Date.now()}.${extension}`;
      
      // Create FormData
      const formData = new FormData();
      formData.append('image', imageFile, uniqueFilename);
      formData.append('overwrite', 'true');
      
      // Upload to ComfyUI
      const response = await axios.post(`${API_BASE_URL}/upload/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.status === 200) {
        console.log("Image uploaded successfully to ComfyUI:", uniqueFilename);
        // Return just the filename for use in LoadImage node
        return uniqueFilename;
      } else {
        throw new Error(`Upload failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error uploading image to ComfyUI:", error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  },
  
  /**
   * Create a basic Flux workflow for image generation
   * @param {Object} params - Parameters for the workflow
   * @returns {Object} - The workflow definition and a timestamp
   */
  createFluxWorkflow({ prompt, negativePrompt = "", steps = 28, inputImageFilename = null, reduxImageFilename = null, filenamePrefix = "generated" }) {
    const timestamp = Date.now();
    
    // Define constants for image dimensions
    const width = 1024;
    const height = 1024;
    
    // Basic workflow definition based on the working example
    const workflow = {
      // Constants for dimensions
      "54": {
        "class_type": "INTConstant",
        "inputs": {
          "value": width
        }
      },
      "55": {
        "class_type": "INTConstant",
        "inputs": {
          "value": height
        }
      },
      
      // Model loaders
      "26": {
        "class_type": "DualCLIPLoader",
        "inputs": {
          "clip_name1": "Flux/t5xxl_fp8_e4m3fn.safetensors",
          "clip_name2": "clip_l.safetensors",
          "type": "flux",
          "device": "default"
        }
      },
      "27": {
        "class_type": "UNETLoader",
        "inputs": {
          "unet_name": "blackforest/flux1-dev.sft",
          "weight_dtype": "fp8_e4m3fn"
        }
      },
      "10": {
        "class_type": "VAELoader",
        "inputs": {
          "vae_name": "ae.sft"
        }
      },
      
      // Prompt encoding
      "50": {
        "class_type": "CLIPTextEncode",
        "inputs": {
          "text": prompt,
          "clip": ["26", 0]
        }
      },
      "51": {
        "class_type": "CLIPTextEncode",
        "inputs": {
          "text": negativePrompt || "",
          "clip": ["26", 0]
        }
      },
      
      "60": {
        "class_type": "FluxGuidance",
        "inputs": {
          "guidance": 15,
          "conditioning": ["50", 0]
        }
      },
      
      "19": {
        "class_type": "ModelSamplingFlux",
        "inputs": {
          "max_shift": 1.25,
          "base_shift": 0.5,
          "width": width,
          "height": height,
          "model": ["27", 0]
        }
      },
      
      // Decoding and saving
      "8": {
        "class_type": "VAEDecode",
        "inputs": {
          "samples": ["3", 0],
          "vae": ["10", 0]
        }
      },
      "9": {
        "class_type": "SaveImage",
        "inputs": {
          "filename_prefix": `${filenamePrefix}${timestamp}`,
          "images": ["8", 0]
        }
      }
    };
    
    if (inputImageFilename) {
      // If an input image is provided, use depth conditioning
      
      // Depth model loading
      workflow["61"] = {
        "class_type": "DownloadAndLoadDepthAnythingV2Model",
        "inputs": {
          "model": "depth_anything_v2_vitl_fp16.safetensors"
        }
      };
      
      // Add nodes for input image and depth conditioning
      workflow["56"] = {
        "class_type": "LoadImage",
        "inputs": {
          "image": inputImageFilename
        }
      };
      
      workflow["57"] = {
        "class_type": "ImageResize+",
        "inputs": {
          "width": ["54", 0],
          "height": ["55", 0],
          "interpolation": "bicubic",
          "method": "keep proportion",
          "condition": "always",
          "multiple_of": 16,
          "image": ["56", 0]
        }
      };
      
      workflow["62"] = {
        "class_type": "DepthAnything_V2",
        "inputs": {
          "da_model": ["61", 0],
          "images": ["57", 0]
        }
      };
      
      workflow["59"] = {
        "class_type": "InstructPixToPixConditioning",
        "inputs": {
          "positive": ["60", 0],
          "negative": ["51", 0],
          "vae": ["10", 0],
          "pixels": ["62", 0]
        }
      };
      
      // Empty latent image based on resized input image
      workflow["53"] = {
        "class_type": "EmptyLatentImage",
        "inputs": {
          "width": ["57", 1],
          "height": ["57", 2],
          "batch_size": 1
        }
      };
      
      // Optional preview image node
      workflow["58"] = {
        "class_type": "PreviewImage",
        "inputs": {
          "images": ["57", 0]
        }
      };
      
    } else {
      // If no input image, just use Empty Latent directly without any noise or image input
      
      // Empty latent image with fixed dimensions
      workflow["53"] = {
        "class_type": "EmptyLatentImage",
        "inputs": {
          "width": width,
          "height": height,
          "batch_size": 1
        }
      };
      
      // Simple conditioning without depth
      workflow["59"] = {
        "class_type": "CLIPTextEncode",
        "inputs": {
          "text": prompt,
          "clip": ["26", 0]
        }
      };
    }
    
    // Add KSampler node - must be added after node 59 is defined
    workflow["3"] = {
      "class_type": "KSampler",
      "inputs": {
        "seed": Math.floor(Math.random() * 1000000),
        "steps": steps,
        "cfg": 1,
        "sampler_name": "ddim",
        "scheduler": "ddim_uniform",
        "denoise": 1,
        "model": ["19", 0],
        "positive": ["59", 0],
        "negative": inputImageFilename ? ["59", 1] : ["51", 0],
        "latent_image": ["53", 0]
      }
    };
    
    // If a redux image filename is provided, add redux conditioning
    if (reduxImageFilename) {
      workflow["70"] = {
        "class_type": "LoadImage",
        "inputs": {
          "image": reduxImageFilename
        }
      };
      
      // Note: Redux implementation would need to be added based on actual ComfyUI workflow
    }
    
    return { workflow, timestamp };
  },
  
  /**
   * Create an advanced Flux workflow with depth conditioning
   * @param {Object} params - Parameters for the workflow
   * @returns {Object} - The workflow definition and a timestamp
   */
  createAdvancedFluxWorkflow({ prompt, negativePrompt = "", steps = 28, inputImageFilename = null, reduxImageFilename = null, filenamePrefix = "generated-adv" }) {
    // For advanced workflow, we'll just use the same workflow since it already includes depth conditioning
    return this.createFluxWorkflow({ 
      prompt, 
      negativePrompt, 
      steps, 
      inputImageFilename,
      reduxImageFilename,
      filenamePrefix 
    });
  },
  
  /**
   * Get the history of generated images
   * @returns {Promise<Array>} - List of generated images
   */
  async getHistory() {
    try {
      const response = await axios.get(`${API_BASE_URL}/history`);
      return response.data;
    } catch (error) {
      console.error("Error getting history:", error);
      throw new Error(`Failed to get history: ${error.message}`);
    }
  }
};

export default ComfyService;