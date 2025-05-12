// src/workflows/fluxAdvanced.js

/**
 * Advanced Flux workflow with depth conditioning and enhanced features
 * Based on the flux_easyplus_mode.json configuration
 */
export const fluxAdvancedWorkflow = {
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 4815162342,
      "steps": 43,
      "cfg": 1,
      "sampler_name": "ddim",
      "scheduler": "ddim_uniform",
      "denoise": 1,
      "model": ["19", 0],
      "positive": ["59", 0],
      "negative": ["59", 1],
      "latent_image": ["53", 0]
    }
  },
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
      "filename_prefix": "Flux/Image",
      "images": ["8", 0]
    }
  },
  "10": {
    "class_type": "VAELoader",
    "inputs": {
      "vae_name": "ae.sft"
    }
  },
  "19": {
    "class_type": "ModelSamplingFlux",
    "inputs": {
      "max_shift": 1.25,
      "base_shift": 0.5,
      "width": 1024,
      "height": 1024,
      "model": ["27", 0]
    }
  },
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
  "50": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "", // Will be replaced with actual prompt
      "clip": ["26", 0]
    }
  },
  "51": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "", // Will be replaced with negative prompt
      "clip": ["26", 0]
    }
  },
  "53": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": ["57", 1],
      "height": ["57", 2],
      "batch_size": 1
    }
  },
  "54": {
    "class_type": "INTConstant",
    "inputs": {
      "value": 1024
    }
  },
  "55": {
    "class_type": "INTConstant",
    "inputs": {
      "value": 1024
    }
  },
  "56": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "motobike.jpg" // Will be replaced with actual input image
    }
  },
  "57": {
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
  },
  "58": {
    "class_type": "PreviewImage",
    "inputs": {
      "images": ["57", 0]
    }
  },
  "59": {
    "class_type": "InstructPixToPixConditioning",
    "inputs": {
      "positive": ["60", 0],
      "negative": ["51", 0],
      "pixels": ["62", 0]
    }
  },
  "60": {
    "class_type": "FluxGuidance",
    "inputs": {
      "guidance": 15,
      "conditioning": ["50", 0]
    }
  },
  "61": {
    "class_type": "DownloadAndLoadDepthAnythingV2Model",
    "inputs": {
      "model": "depth_anything_v2_vitl_fp16.safetensors"
    }
  },
  "62": {
    "class_type": "DepthAnything_V2",
    "inputs": {
      "da_model": ["61", 0],
      "images": ["57", 0]
    }
  }
};

/**
 * Creates an advanced Flux workflow with depth conditioning
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.prompt - The text prompt
 * @param {number} options.steps - Number of sampling steps
 * @param {number} options.guidanceScale - Guidance scale for conditioning (default: 15)
 * @param {string} options.inputImageUrl - Required URL for depth map source image
 * @param {string} options.reduxImageUrl - Optional URL for redux reference image (not implemented in this version)
 * @param {string} options.filenamePrefix - Prefix for output filename
 * @param {string} options.samplerName - Sampler to use (default: "ddim")
 * @param {string} options.scheduler - Scheduler to use (default: "ddim_uniform")
 * @returns {Object} - Complete workflow and timestamp
 */
export const createFluxAdvancedWorkflow = (options) => {
  const {
    prompt,
    steps = 43,
    guidanceScale = 15,
    inputImageUrl,
    reduxImageUrl = null,
    filenamePrefix = 'Flux/Image_',
    samplerName = "ddim",
    scheduler = "ddim_uniform"
  } = options;
  
  // Input validation
  if (!inputImageUrl) {
    throw new Error("Input image is required for depth conditioning in advanced workflow");
  }
  
  const timestamp = Math.floor(Date.now()/1000);
  
  // Clone the workflow to avoid modifying the original
  const workflow = JSON.parse(JSON.stringify(fluxAdvancedWorkflow));
  
  // Set the positive prompt
  workflow["50"].inputs.text = prompt;
  
  // Set the negative prompt (using a default if not provided)
  workflow["51"].inputs.text = options.negativePrompt || 
    "low quality, bad anatomy, blurry, pixelated, distorted, deformed";
  
  // Set the guidance scale
  workflow["60"].inputs.guidance = guidanceScale;
  
  // Set the steps in the KSampler node
  workflow["3"].inputs.steps = steps;
  
  // Set the sampler and scheduler
  workflow["3"].inputs.sampler_name = samplerName;
  workflow["3"].inputs.scheduler = scheduler;
  
  // Set random seed if not provided
  workflow["3"].inputs.seed = options.seed || Math.floor(Math.random() * 1000000000);
  
  // Set the filename prefix in the SaveImage node
  workflow["9"].inputs.filename_prefix = `${filenamePrefix}${timestamp}`;
  
  // Set the input image for depth conditioning
  workflow["56"].inputs.image = inputImageUrl;
  
  return { workflow, timestamp };
};

// Export both named exports and default export
export default { createFluxAdvancedWorkflow, fluxAdvancedWorkflow };