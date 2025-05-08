// src/services/comfyService.js
import axios from 'axios';


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
  async queuePrompt(workflow) {
    try {
      // Wrap the workflow in the expected format
      const payload = {
        prompt: workflow,
        client_id: "generator-" + Date.now()
      };
      
      console.log("Sending workflow to ComfyUI:", payload);
      
      const response = await axios.post(`${API_BASE_URL}/prompt`, payload);
      return response.data;
    } catch (error) {
      console.error('Error queuing prompt:', error);
      console.error('Error details:', error.response?.data || error.message);
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

  /**
   * Create a simple workflow for generating a post-apocalyptic vehicle
   * @param {string} prompt - The text prompt for generation
   * @param {Array} traits - Array of traits to include in generation
   */
  createVehicleWorkflow(prompt, traits = []) {
    // Combine traits into prompt
    const traitPrompts = traits.map(trait => 
      trait.parameters?.prompt_fragment || ''
    ).filter(p => p.length > 0);

    const fullPrompt = [prompt, ...traitPrompts].join(', ');
    
    console.log("Creating workflow with prompt:", fullPrompt);

    // Fixed workflow to include VAEDecode before SaveImage
    return {
      "3": {
        "inputs": {
          "seed": Math.floor(Math.random() * 1000000),
          "steps": 30,
          "cfg": 7,
          "sampler_name": "euler_ancestral",
          "scheduler": "normal",
          "denoise": 1,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        },
        "class_type": "KSampler"
      },
      "4": {
        "inputs": {
          "ckpt_name": "sdxl/sd_xl_base_1.0.safetensors"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "5": {
        "inputs": {
          "width": 1024,
          "height": 1024,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      "6": {
        "inputs": {
          "text": fullPrompt,
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "text": "low quality, bad anatomy, blurry, pixelated",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "8": {
        "inputs": {
          "samples": ["3", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": {
          "filename_prefix": "postapoc_vehicle",
          "images": ["8", 0]  // Now correctly points to VAEDecode output
        },
        "class_type": "SaveImage"
      }
    };
  }
};

export default ComfyService;