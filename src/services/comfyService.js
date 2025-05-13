// src/services/comfyService.js

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
   * Create a standard Flux workflow with optional image inputs
   */
  createFluxWorkflow({ prompt, steps = 20, filenamePrefix = 'Otherides-2d' }) {
    console.log("Creating standard Flux workflow with params:", { prompt, steps, filenamePrefix });
    
    // Add timestamp to make the generation unique
    const timestamp = new Date().getTime();
    
    // Base workflow object - simplified for example
    const workflow = {
      // This would contain the standard basic workflow nodes
      // Simplified for this example
      "3": {
        "inputs": {
          "text": filenamePrefix
        },
        "class_type": "Text",
      },
      "5": {
        "inputs": {
          "text": prompt
        },
        "class_type": "CLIPTextEncode",
      },
      "6": {
        "inputs": {
          "steps": steps
        },
        "class_type": "KSampler",
      },
      "7": {
        "inputs": {
          "filename_prefix": [
            "3",
            0
          ],
          "images": [
            "6",
            0
          ]
        },
        "class_type": "SaveImage",
      }
    };

    // We'll let Base64Service handle the image loading
    return { workflow, timestamp };
  },
  
  /**
   * Create an advanced Flux workflow with Redux styling and depth conditioning
   */
  createFluxAdvancedWorkflow({ 
    prompt, 
    steps = 20, 
    reduxStrength = 0.5,
    useDepth = true,
    filenamePrefix = 'Otherides-2d_' 
  }) {
    console.log("Creating advanced Flux workflow with params:", { 
      prompt, steps, reduxStrength, useDepth, filenamePrefix 
    });
    
    // Add timestamp to make the generation unique
    const timestamp = new Date().getTime();
    
    // Start with the base Redux workflow structure from the provided example
    const workflow = {
      "77": {
        "inputs": {
          "filename_prefix": [
            "82",
            0
          ],
          "images": [
            "81",
            0
          ]
        },
        "class_type": "SaveImage",
        "_meta": {
          "title": "Save Image"
        }
      },
      "78": {
        "inputs": {
          "unet_name": "blackforest/flux1-depth-dev.safetensors",
          "weight_dtype": "fp8_e4m3fn"
        },
        "class_type": "UNETLoader",
        "_meta": {
          "title": "Load Diffusion Model"
        }
      },
      "79": {
        "inputs": {
          "text": "",
          "clip": [
            "80",
            0
          ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIP Text Encode (Prompt)"
        }
      },
      "80": {
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
      "81": {
        "inputs": {
          "samples": [
            "100",
            0
          ],
          "vae": [
            "90",
            0
          ]
        },
        "class_type": "VAEDecode",
        "_meta": {
          "title": "VAE Decode"
        }
      },
      "82": {
        "inputs": {
          "text": `${filenamePrefix}_${timestamp}`
        },
        "class_type": "Text Multiline",
        "_meta": {
          "title": "Text Multiline"
        }
      },
      "83": {
        "inputs": {
          "value": 1024
        },
        "class_type": "INTConstant",
        "_meta": {
          "title": "Width"
        }
      },
      "84": {
        "inputs": {
          "value": 1024
        },
        "class_type": "INTConstant",
        "_meta": {
          "title": "Height"
        }
      },
      "85": {
        "inputs": {
          "image": "placeholder.png"  // This will be replaced by Base64Service
        },
        "class_type": "LoadImage",
        "_meta": {
          "title": "Load Image (Placeholder)"
        }
      },
      "86": {
        "inputs": {
          "width": [
            "83",
            0
          ],
          "height": [
            "84",
            0
          ],
          "interpolation": "bicubic",
          "method": "keep proportion",
          "condition": "always",
          "multiple_of": 16,
          "image": [
            "85", 
            0
          ]
        },
        "class_type": "ImageResize+",
        "_meta": {
          "title": "🔧 Image Resize"
        }
      },
      "88": {
        "inputs": {
          "width": [
            "86",
            1
          ],
          "height": [
            "86",
            2
          ],
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage",
        "_meta": {
          "title": "Empty Latent Image"
        }
      },
      "89": {
        "inputs": {
          "text": prompt,
          "clip": [
            "80",
            0
          ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIP Text Encode (Prompt)"
        }
      },
      "90": {
        "inputs": {
          "vae_name": "ae.sft"
        },
        "class_type": "VAELoader",
        "_meta": {
          "title": "Load VAE"
        }
      },
      "92": {
        "inputs": {
          "max_shift": 1.25,
          "base_shift": 0.5,
          "width": 1024,
          "height": 1024,
          "model": [
            "78",
            0
          ]
        },
        "class_type": "ModelSamplingFlux",
        "_meta": {
          "title": "ModelSamplingFlux"
        }
      },
      "94": {
        "inputs": {
          "image": "placeholder.png"  // This will be replaced by Base64Service
        },
        "class_type": "LoadImage",
        "_meta": {
          "title": "Load Redux Image (Placeholder)"
        }
      },
      "95": {
        "inputs": {
          "clip_name": "sigclip_vision_patch14_384.safetensors"
        },
        "class_type": "CLIPVisionLoader",
        "_meta": {
          "title": "Load CLIP Vision"
        }
      },
      "96": {
        "inputs": {
          "style_model_name": "flux1-redux-dev.safetensors"
        },
        "class_type": "StyleModelLoader",
        "_meta": {
          "title": "Load Style Model"
        }
      },
      "100": {
        "inputs": {
          "noise": [
            "102",
            0
          ],
          "guider": [
            "103",
            0
          ],
          "sampler": [
            "104",
            0
          ],
          "sigmas": [
            "109",
            0
          ],
          "latent_image": [
            "88",
            0
          ]
        },
        "class_type": "SamplerCustomAdvanced",
        "_meta": {
          "title": "SamplerCustomAdvanced"
        }
      },
      "102": {
        "inputs": {
          "noise_seed": Math.floor(Math.random() * 1000000)
        },
        "class_type": "RandomNoise",
        "_meta": {
          "title": "RandomNoise"
        }
      },
      "103": {
        "inputs": {
          "model": [
            "92",
            0
          ],
          "conditioning": [
            "108",
            0
          ]
        },
        "class_type": "BasicGuider",
        "_meta": {
          "title": "BasicGuider"
        }
      },
      "104": {
        "inputs": {
          "sampler_name": "euler"
        },
        "class_type": "KSamplerSelect",
        "_meta": {
          "title": "KSamplerSelect"
        }
      },
      "105": {
        "inputs": {
          "text": prompt.split(',').slice(0, 5).join(', '), // Use first few tags for condensed prompt
          "clip": [
            "80",
            0
          ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIP Text Encode (Prompt)"
        }
      },
      "109": {
        "inputs": {
          "scheduler": "simple",
          "steps": steps,
          "denoise": 1,
          "model": [
            "92",
            0
          ]
        },
        "class_type": "BasicScheduler",
        "_meta": {
          "title": "BasicScheduler"
        }
      },
      "111": {
        "inputs": {
          "model": "depth_anything_v2_vitl_fp16.safetensors"
        },
        "class_type": "DownloadAndLoadDepthAnythingV2Model",
        "_meta": {
          "title": "DownloadAndLoadDepthAnythingV2Model"
        }
      },
      "113": {
        "inputs": {
          "guidance": 15,
          "conditioning": [
            "114",
            0
          ]
        },
        "class_type": "FluxGuidance",
        "_meta": {
          "title": "FluxGuidance"
        }
      },
      "114": {
        "inputs": {
          "conditioning_to": [
            "105",
            0
          ],
          "conditioning_from": [
            "89",
            0
          ]
        },
        "class_type": "ConditioningConcat",
        "_meta": {
          "title": "Conditioning (Concat)"
        }
      }
    };
    
    // Add depth extraction if enabled
    if (useDepth) {
      workflow["106"] = {
        "inputs": {
          "da_model": [
            "111",
            0
          ],
          "images": [
            "86",
            0
          ]
        },
        "class_type": "DepthAnything_V2",
        "_meta": {
          "title": "Depth Anything V2"
        }
      };
      
      workflow["107"] = {
        "inputs": {
          "positive": [
            "113",
            0
          ],
          "negative": [
            "79",
            0
          ],
          "vae": [
            "90",
            0
          ],
          "pixels": [
            "106",
            0
          ]
        },
        "class_type": "InstructPixToPixConditioning",
        "_meta": {
          "title": "InstructPixToPixConditioning"
        }
      };
      
      // Connect to style application without depending on reduxImageUrl
      workflow["108"] = {
        "inputs": {
          "strength": reduxStrength,
          "conditioning": [
            "107",
            0
          ],
          "style_model": [
            "96",
            0
          ]
          // clip_vision_output will be added in the form handler if needed
        },
        "class_type": "StyleModelApplyAdvanced",
        "_meta": {
          "title": "🖌️ Style Model Apply (Advanced)"
        }
      };
    } else {
      // No depth conditioning - direct style application to conditioning
      workflow["108"] = {
        "inputs": {
          "strength": reduxStrength,
          "conditioning": [
            "89",
            0
          ],
          "style_model": [
            "96",
            0
          ]
          // clip_vision_output will be added in the form handler if needed
        },
        "class_type": "StyleModelApplyAdvanced",
        "_meta": {
          "title": "🖌️ Style Model Apply (Advanced)"
        }
      };
    }
    
    // Add CLIPVisionEncode node for Redux (will be connected in form handler if needed)
    workflow["93"] = {
      "inputs": {
        "crop": "center",
        "clip_vision": [
          "95",
          0
        ],
        "image": [
          "94",
          0
        ]
      },
      "class_type": "CLIPVisionEncode",
      "_meta": {
        "title": "CLIP Vision Encode"
      }
    };
    
    return { workflow, timestamp };
  }
};

export default ComfyService;