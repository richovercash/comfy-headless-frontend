// src/workflows/simpleFluxWorkflow.js

/**
 * A simplified version of the Flux workflow that's directly compatible with ComfyUI API
 * This is already in the format expected by the ComfyUI API, with all nodes having class_type
 */
export const simpleFluxWorkflow = {
  // First load the models
  "1": {
    "class_type": "UNETLoader",
    "inputs": {
      "unet_name": "blackforest/flux1-depth-dev.safetensors",
      "weight_dtype": "fp8_e4m3fn"
    }
  },
  "2": {
    "class_type": "DualCLIPLoader",
    "inputs": {
      "clip_name1": "Flux/t5xxl_fp16.safetensors", 
      "clip_name2": "Flux/clip_l.safetensors",
      "text_encoder_1_name": "flux",
      "text_encoder_2_name": "default",
      "type": "dual" 
    }
  },
  "3": {
    "class_type": "VAELoader",
    "inputs": {
      "vae_name": "ae.sft"
    }
  },
  
  // Set up the generation pipeline
  "4": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    }
  },
  "5": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "placeholder for prompt", // Will be replaced with actual prompt
      "clip": ["2", 0]
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "low quality, bad anatomy, blurry, pixelated",
      "clip": ["2", 0]
    }
  },
  "7": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 12345, // Will be replaced with random seed
      "steps": 30, // Will be replaced with user-selected steps
      "cfg": 7,
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["1", 0],
      "positive": ["5", 0],
      "negative": ["6", 0],
      "latent_image": ["4", 0]
    }
  },
  "8": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["7", 0],
      "vae": ["3", 0]
    }
  },
  "9": {
    "class_type": "SaveImage",
    "inputs": {
      "filename_prefix": "flux_vehicle_", // Will be replaced with actual prefix
      "images": ["8", 0]
    }
  }
};

/**
 * Creates a flux workflow with the specified parameters
 * @param {Object} options - Configuration options
 * @param {string} options.prompt - The text prompt
 * @param {number} options.steps - Number of sampling steps
 * @param {string} options.inputImageUrl - Optional URL for depth map image
 * @param {string} options.reduxImageUrl - Optional URL for redux reference image
 * @param {string} options.filenamePrefix - Prefix for output filename
 * @returns {Object} - Complete workflow and timestamp
 */
export const createFluxWorkflow = (options) => {
  const {
    prompt,
    steps = 28,
    inputImageUrl = null,
    reduxImageUrl = null,
    filenamePrefix = 'Otherides-2d/cycles_'
  } = options;
  
  const timestamp = Math.floor(Date.now()/1000);
  
  // Clone the workflow to avoid modifying the original
  const workflow = JSON.parse(JSON.stringify(simpleFluxWorkflow));
  
  // Set the prompt in the CLIPTextEncode node
  workflow["5"].inputs.text = prompt;
  
  // Set the steps in the KSampler node
  workflow["7"].inputs.steps = steps;
  
  // Set random seed
  workflow["7"].inputs.seed = Math.floor(Math.random() * 1000000);
  
  // Set the filename prefix in the SaveImage node
  workflow["9"].inputs.filename_prefix = `${filenamePrefix}${timestamp}`;
  
  // Add input image handling if provided
  let nodeCount = 10;
  
  if (inputImageUrl) {
    workflow[nodeCount] = {
      "class_type": "LoadImage",
      "inputs": {
        "image": inputImageUrl
      }
    };
    nodeCount++;
  }
  
  // Add redux image handling if provided
  if (reduxImageUrl) {
    workflow[nodeCount] = {
      "class_type": "LoadImage",
      "inputs": {
        "image": reduxImageUrl
      }
    };
    // Additional nodes would be added here to connect the redux image
    nodeCount++;
  }
  
  return { workflow, timestamp };
}

// // Make sure both the named export and default export are available
// export { createFluxWorkflow, simpleFluxWorkflow };

// Default export for convenience
export default { createFluxWorkflow, simpleFluxWorkflow };