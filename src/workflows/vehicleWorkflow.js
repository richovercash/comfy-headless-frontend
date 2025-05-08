// src/workflows/vehicleWorkflow.js

// This is a simplified example - you'll need to replace with your actual ComfyUI workflow
export const getVehicleWorkflow = (options) => {
    const { name, vehicleType, attributes } = options;
    
    // Build the prompt based on the options
    let prompt = `${attributes.condition} post-apocalyptic ${vehicleType}`;
    
    if (attributes.style) {
      prompt += ` in ${attributes.style} style`;
    }
    
    if (attributes.color) {
      prompt += `, ${attributes.color} coloration`;
    }
    
    if (attributes.features && attributes.features.length > 0) {
      prompt += `, with ${attributes.features.join(', ')}`;
    }
    
    // Add specific details based on vehicle type
    switch (vehicleType) {
      case 'car':
        prompt += ', modified survival car, detailed';
        break;
      case 'truck':
        prompt += ', heavy duty, reinforced';
        break;
      case 'motorcycle':
        prompt += ', rugged, all-terrain';
        break;
      case 'tank':
        prompt += ', imposing, powerful';
        break;
      default:
        break;
    }
    
    // Add general post-apocalyptic styling
    prompt += ', wasteland background, dramatic lighting, highly detailed, photorealistic';
    
    // Workflow is structured according to ComfyUI's expected format
    return {
      "3": {
        "class_type": "KSampler",
        "inputs": {
          "cfg": 8,
          "denoise": 1,
          "model": ["4", 0],
          "latent_image": ["5", 0],
          "negative": ["7", 0],
          "positive": ["6", 0],
          "sampler_name": "euler_ancestral",
          "scheduler": "normal",
          "seed": Math.floor(Math.random() * 1000000000),
          "steps": 30
        }
      },
      "4": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": {
          "ckpt_name": "epicrealism_naturalSinRC1VAE.safetensors"
        }
      },
      "5": {
        "class_type": "EmptyLatentImage",
        "inputs": {
          "batch_size": 1,
          "height": 768,
          "width": 768
        }
      },
      "6": {
        "class_type": "CLIPTextEncode",
        "inputs": {
          "clip": ["4", 1],
          "text": prompt
        }
      },
      "7": {
        "class_type": "CLIPTextEncode",
        "inputs": {
          "clip": ["4", 1],
          "text": "bad anatomy, bad proportions, blurry, cloned face, cropped, deformed, dehydrated, disfigured, duplicate, error, extra arms, extra fingers, extra limbs, fused fingers, gross proportions, jpeg artifacts, long neck, low quality, lowres, malformed limbs, missing arms, missing legs, morbid, mutated hands, mutation, mutilated, ugly"
        }
      },


    "8": {
        "class_type": "VAEDecode",
        "inputs": {
        "samples": ["3", 0],
        "vae": ["9", 0]
        }
    },
    "9": {
        "class_type": "VAELoader",
        "inputs": {
        "vae_name": "vae-ft-mse-840000-ema-pruned.safetensors"
        }
    },
    "10": {
        "class_type": "SaveImage",
        "inputs": {
        "filename_prefix": `vehicle_${vehicleType}_${name.replace(/\s+/g, '_')}`,
        "images": ["8", 0]  // Point to VAEDecode output, not directly to latent
        }
    }

    };
  };