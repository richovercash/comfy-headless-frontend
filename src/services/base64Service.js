// src/services/base64Service.js

/**
 * Service for handling base64 image conversion as a fallback
 * when direct URL loading doesn't work in ComfyUI
 */
const Base64Service = {
  
  /**
   * Convert a File object to base64 string
   * @param {File} file - The file to convert
   * @returns {Promise<string>} - Promise resolving to base64 string
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Get just the base64 part without the data URL prefix
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  },
  
  /**
   * Convert a URL to base64 string by fetching the image
   * @param {string} url - The image URL
   * @returns {Promise<string>} - Promise resolving to base64 string
   */
  async urlToBase64(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      return await this.fileToBase64(blob);
    } catch (error) {
      console.error("Error converting URL to base64:", error);
      throw error;
    }
  },
  
  /**
   * Convert a workflow to use base64-encoded images
   * @param {Object} workflow - Original workflow object
   * @param {Object} imageMap - Object mapping node IDs to File objects
   * @returns {Object} - Modified workflow using base64 image nodes
   */
  async convertWorkflowToBase64(workflow, imageMap) {
    console.log("Converting workflow to use base64 images:", Object.keys(imageMap));
    
    // Clone the workflow to avoid modifying the original
    const modifiedWorkflow = JSON.parse(JSON.stringify(workflow));
    
    // Process each node in the image map
    for (const [nodeId, imageData] of Object.entries(imageMap)) {
      // Skip if node doesn't exist in workflow
      if (!modifiedWorkflow[nodeId]) {
        console.warn(`Node ${nodeId} not found in workflow, skipping base64 conversion`);
        continue;
      }
      
      console.log(`Converting node ${nodeId} to use base64 image`);
      
      // Get base64 string from image data
      let base64String;
      if (imageData instanceof File) {
        base64String = await this.fileToBase64(imageData);
      } else if (typeof imageData === 'string' && imageData.startsWith('http')) {
        base64String = await this.urlToBase64(imageData);
      } else if (typeof imageData === 'string') {
        // Already a base64 string
        base64String = imageData;
      } else {
        console.warn(`Unsupported image data type for node ${nodeId}`, typeof imageData);
        continue;
      }
      
      // Replace the node with a base64 version
      modifiedWorkflow[nodeId] = {
        "class_type": "LoadImageFromBase64",
        "inputs": {
          "data": base64String  // Changed from base64_data to data to match the node's requirements
        },
        "_meta": modifiedWorkflow[nodeId]._meta || {
          "title": `Base64 Image ${nodeId}`
        }
      };
      
      console.log(`Node ${nodeId} converted to LoadImageFromBase64`);
    }
    
    // Now connect the redux image to StyleModelApply if needed
    if (imageMap["94"] && modifiedWorkflow["108"]) {
      console.log("Adding clip_vision_output connection for redux image");
      modifiedWorkflow["108"]["inputs"]["clip_vision_output"] = ["93", 0];
    }
    
    return modifiedWorkflow;
  }
};

export default Base64Service;