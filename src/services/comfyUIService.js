// src/services/comfyUIService.js
// Add this near the top of your main JS file
window.addEventListener('error', function(event) {
  console.error('Global error:', event.error);
});

// Also, add this to catch unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
});

/**
 * Convert Redux-Simple.json to the API format expected by ComfyUI
 * @param {Object} reduxSimpleWorkflow - The Redux Simple workflow JSON
 * @returns {Object} - The workflow in API format
 */
function convertReduxSimpleToAPI(reduxSimpleWorkflow) {
  // Start with an empty API workflow
  const apiWorkflow = {};
  
  // Manually map each node from the original workflow
  const nodes = reduxSimpleWorkflow.nodes;
  const links = reduxSimpleWorkflow.links;
  
  // Map node IDs to their API format
  nodes.forEach(node => {
    const apiNode = {
      class_type: node.type,
    };
    
    // Handle inputs
    if (node.inputs && node.inputs.length > 0) {
      apiNode.inputs = {};
      
      node.inputs.forEach(input => {
        if (input.link !== null && input.link !== undefined) {
          // Find the corresponding link
          const link = links.find(l => l[0] === input.link);
          
          if (link) {
            // Always use output index 0 to avoid "tuple index out of range" errors
            apiNode.inputs[input.name] = [link[1].toString(), 0];
          }
        }
      });
      
      // Special case for SaveImage - ensure filename_prefix is present
      if (node.type === 'SaveImage') {
        // Get the widget value for filename_prefix
        const prefix = node.widgets_values ? node.widgets_values[0] : 'output';
        apiNode.inputs.filename_prefix = prefix;
      }
    }
    
    // Copy widgets_values if they exist
    if (node.widgets_values) {
      apiNode.widgets_values = [...node.widgets_values];
    }
    
    // Add the node to the API workflow
    apiWorkflow[node.id] = apiNode;
  });
  
  return apiWorkflow;
}

/**
 * Create a workflow for vehicle generation with the specified parameters
 * @param {Object} workflow - The workflow JSON
 * @param {Object} parameters - The parameters to apply
 * @returns {Object} - The customized workflow
 */
function createVehicleWorkflow(workflow, parameters) {
  const {
    prompt = 'post-apocalyptic vehicle',
    negativePrompt = 'bad quality, blurry',
    steps = 30,
    seed = Math.floor(Math.random() * 1000000000),
    width = 768,
    height = 768,
    filenamePrefix = 'vehicle',
    guidanceScale = 3.5
  } = parameters;
  
  // Convert the workflow to API format (if needed)
  const apiWorkflow = workflow.nodes ? convertReduxSimpleToAPI(workflow) : { ...workflow };
  
  // Apply parameters - using specific node IDs that we know from the workflow
  
  // Set positive prompt (node 50)
  if (apiWorkflow[50] && apiWorkflow[50].class_type === 'CLIPTextEncode') {
    if (apiWorkflow[50].widgets_values) {
      apiWorkflow[50].widgets_values[0] = prompt;
    }
  }
  
  // Set negative prompt (node 51)
  if (apiWorkflow[51] && apiWorkflow[51].class_type === 'CLIPTextEncode') {
    if (apiWorkflow[51].widgets_values) {
      apiWorkflow[51].widgets_values[0] = negativePrompt;
    }
  }
  
  // Set KSampler parameters (node 3)
  if (apiWorkflow[3] && apiWorkflow[3].class_type === 'KSampler') {
    if (apiWorkflow[3].inputs) {
      apiWorkflow[3].inputs.steps = steps;
      apiWorkflow[3].inputs.seed = seed;
    }
  }
  
  // Set image dimensions (node 5)
  if (apiWorkflow[5] && apiWorkflow[5].class_type === 'EmptyLatentImage') {
    if (apiWorkflow[5].inputs) {
      apiWorkflow[5].inputs.width = width;
      apiWorkflow[5].inputs.height = height;
    }
  }
  
  // Set filename prefix (node 9)
  if (apiWorkflow[9] && apiWorkflow[9].class_type === 'SaveImage') {
    const timestamp = Math.floor(Date.now() / 1000);
    const fullPrefix = `${filenamePrefix}_${timestamp}`;
    
    // Set in both places to ensure it works
    if (apiWorkflow[9].inputs) {
      apiWorkflow[9].inputs.filename_prefix = fullPrefix;
    }
    
    if (apiWorkflow[9].widgets_values) {
      apiWorkflow[9].widgets_values[0] = fullPrefix;
    }
  }
  
  // Set guidance scale (node 52)
  if (apiWorkflow[52] && apiWorkflow[52].class_type === 'FluxGuidance') {
    if (apiWorkflow[52].widgets_values) {
      apiWorkflow[52].widgets_values[0] = guidanceScale;
    }
  }
  
  return {
    workflow: apiWorkflow,
    timestamp: Math.floor(Date.now() / 1000),
    payload: {
      prompt: apiWorkflow,
      client_id: `vehicle-gen-${Math.floor(Date.now() / 1000)}`
    }
  };
}

class ComfyUIService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || process.env.REACT_APP_COMFYUI_API_URL || 'http://localhost:8188';
    this.connected = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000; // ms
    
    // Initialize connection check
    this.checkConnection();
    
    console.log("ComfyUI API URL:", this.baseUrl);
    console.log("ComfyUI WS URL:", process.env.REACT_APP_COMFYUI_WS_URL);
  }
  
  async checkConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`);
      this.connected = response.ok;
      if (this.connected) {
        console.log("ComfyUI connection established");
        this.retryCount = 0;
      } else {
        this.handleConnectionFailure();
      }
    } catch (error) {
      console.error("ComfyUI connection error:", error.message);
      this.connected = false;
      this.handleConnectionFailure();
    }
    
    return this.connected;
  }
  
  handleConnectionFailure() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Connection attempt failed. Retrying (${this.retryCount}/${this.maxRetries}) in ${this.retryDelay/1000}s...`);
      setTimeout(() => this.checkConnection(), this.retryDelay);
    } else {
      console.error("Failed to connect to ComfyUI after multiple attempts.");
      // Could dispatch an action or emit an event here to notify the UI
    }
  }
  
  async getHistory() {
    if (!this.connected) await this.checkConnection();
    try {
      const response = await fetch(`${this.baseUrl}/history`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error fetching ComfyUI history:", error);
      throw error;
    }
  }
  
  /**
   * Generate a vehicle image using the specified parameters
   * @param {Object} workflow - The workflow JSON from Redux-Simple.json
   * @param {Object} parameters - Generation parameters
   * @returns {Promise<Object>} - Response from ComfyUI
   */
  async generateVehicleImage(workflow, parameters) {
    console.log('Generating vehicle image with parameters:', parameters);
    
    try {
      // Create workflow with parameters
      const { payload } = createVehicleWorkflow(workflow, parameters);
      
      console.log('Prepared workflow for ComfyUI submission...');
      
      // Use the existing submitPrompt method to send to ComfyUI
      return await this.submitPrompt(payload);
    } catch (error) {
      console.error('Error generating vehicle image:', error);
      throw error;
    }
  }
  
  async submitPrompt(workflowData) {
    if (!this.connected) await this.checkConnection();
    try {
      console.log("Sending to ComfyUI:", JSON.stringify(workflowData));
      const response = await fetch(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflowData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("ComfyUI error response:", errorText);
        throw new Error(`Failed to submit prompt: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error submitting prompt to ComfyUI:", error);
      throw error;
    }
  }
  
  async getJobStatus(promptId) {
    if (!this.connected) await this.checkConnection();
    try {
      const response = await fetch(`${this.baseUrl}/history/${promptId}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error checking status for job ${promptId}:`, error);
      throw error;
    }
  }
  
  async getGeneratedImage(filename) {
    if (!this.connected) await this.checkConnection();
    try {
      const response = await fetch(`${this.baseUrl}/view?filename=${encodeURIComponent(filename)}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.url; // Return the URL to the image
    } catch (error) {
      console.error(`Error fetching image ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Fixes any Save Image nodes in the workflow to ensure compatibility with ComfyUI
   * @param {Object} workflow - The workflow to fix
   * @returns {Object} - The fixed workflow
   */
  fixWorkflowNodes(workflow) {
    // Create a deep copy of the workflow
    const fixedWorkflow = JSON.parse(JSON.stringify(workflow));
    
    // Fix all nodes with potential output index issues
    Object.entries(fixedWorkflow).forEach(([id, node]) => {
      // Fix any node that has inputs.images array
      if (node.inputs && node.inputs.images && Array.isArray(node.inputs.images) && node.inputs.images.length === 2) {
        // Always set output index to 0 to avoid "tuple index out of range" errors
        node.inputs.images = [node.inputs.images[0], 0];
      }
      
      // Special handling for SaveImage nodes
      if (node.class_type === 'SaveImage') {
        // Ensure both inputs.filename_prefix and widgets_values are set
        if (!node.inputs) {
          node.inputs = {};
        }
        
        // Get prefix from wherever it exists
        let prefix = "output";
        if (node.inputs.filename_prefix) {
          prefix = node.inputs.filename_prefix;
        } else if (node.widgets_values && node.widgets_values.length > 0) {
          prefix = node.widgets_values[0];
        }
        
        // Ensure it's set in both places
        node.inputs.filename_prefix = prefix;
        
        if (!node.widgets_values) {
          node.widgets_values = [];
        }
        node.widgets_values[0] = prefix;
      }
    });
    
    return fixedWorkflow;
  }
}

export default new ComfyUIService();