// src/services/comfyService.js
import axios from 'axios';
import { createCustomReduxWorkflow } from '../workflows/workingFluxAdapter';
import { createWorkflowPayload } from '../utils/workflowImporter';

// API base URL
export const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';

console.log("API URL:", API_BASE_URL);

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
 * Create a reliable vehicle generation workflow with the specified parameters
 * @param {Object} workflow - The workflow JSON
 * @param {Object} parameters - The parameters to apply
 * @returns {Object} - The customized workflow payload ready for submission
 */
function createReliableVehicleWorkflow(workflow, parameters) {
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
  
  // Convert the workflow to API format if needed
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
  
  // Create the payload expected by ComfyUI
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    workflow: apiWorkflow,
    timestamp,
    payload: {
      prompt: apiWorkflow,
      client_id: `reliable-vehicle-gen-${timestamp}`
    }
  };
}

/**
 * Fix common issues in workflows that might cause problems with ComfyUI
 * @param {Object} workflow - The workflow to fix
 * @returns {Object} - The fixed workflow
 */
function fixWorkflowIssues(workflow) {
  // Create a deep copy of the workflow
  const fixedWorkflow = JSON.parse(JSON.stringify(workflow));
  
  // Fix all nodes with potential output index issues
  Object.entries(fixedWorkflow).forEach(([id, node]) => {
    // Fix any node that has inputs.images array or similar arrays with indices
    if (node.inputs) {
      Object.entries(node.inputs).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'number') {
          // This is likely a node reference with an output index - set index to 0
          node.inputs[key] = [value[0], 0];
        }
      });
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
      console.log("Preparing workflow for ComfyUI submission...");
      
      // Fix any issues in the workflow that might cause problems
      const fixedWorkflow = fixWorkflowIssues(workflow);
      
      // Format expected by ComfyUI API
      const payload = {
        prompt: fixedWorkflow,
        client_id: "generator-" + Date.now()
      };
      
      console.log("Sending payload to ComfyUI:", JSON.stringify(payload).substring(0, 200) + "...");
      
      // Use fetch for better error handling
      const response = await fetch(`${API_BASE_URL}/prompt`, {
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
      
      const result = await response.json();
      console.log("ComfyUI submission successful:", result);
      return result;
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

  /**
   * Get the available node types and their configurations from ComfyUI
   * This is useful for diagnosing compatibility issues
   */
  async getNodeTypes() {
    try {
      const response = await fetch(`${API_BASE_URL}/object_info`);
      if (!response.ok) {
        throw new Error(`Failed to fetch node types: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching node types:", error);
      throw error;
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
   * Create a Flux workflow with the provided options
   * Uses your ORIGINAL workflow with compatibility fixes applied
   */
  createFluxWorkflow(options) {
    return createCustomReduxWorkflow(options);
  },
  
  /**
   * Create a workflow using the new dynamic workflow importer
   * @param {string} workflowName - Name of the workflow in the registry
   * @param {Object} parameters - Parameters to apply to the workflow
   * @returns {Promise<Object>} - The workflow payload ready for submission
   */
  async createWorkflow(workflowName, parameters) {
    try {
      console.log(`Creating workflow "${workflowName}" with parameters:`, parameters);
      const result = await createWorkflowPayload(workflowName, parameters);
      return result;
    } catch (error) {
      console.error(`Error creating workflow "${workflowName}":`, error);
      throw error;
    }
  },
  
  /**
   * Create and queue a workflow in one step
   * @param {string} workflowName - Name of the workflow in the registry
   * @param {Object} parameters - Parameters to apply to the workflow
   * @returns {Promise<Object>} - The result of queueing the workflow
   */
  async createAndQueueWorkflow(workflowName, parameters) {
    try {
      const { payload, timestamp } = await this.createWorkflow(workflowName, parameters);
      const result = await this.queuePrompt(payload.prompt);
      return { ...result, timestamp };
    } catch (error) {
      console.error(`Error creating and queueing workflow "${workflowName}":`, error);
      throw error;
    }
  },

  /**
   * Create a reliable vehicle workflow and queue it
   * Uses the direct conversion approach that's more reliable for specific workflows
   * @param {Object} workflow - The Redux-Simple.json workflow
   * @param {Object} parameters - The parameters to apply
   * @returns {Promise<Object>} - The result of queueing the workflow
   */
  async createAndQueueReliableVehicleWorkflow(workflow, parameters) {
    try {
      console.log("Creating reliable vehicle workflow with parameters:", parameters);
      const { payload } = createReliableVehicleWorkflow(workflow, parameters);
      const result = await this.queuePrompt(payload.prompt);
      return result;
    } catch (error) {
      console.error("Error creating and queueing reliable vehicle workflow:", error);
      throw error;
    }
  },

  /**
   * Test connection with a very simple connection verification
   * Just checks if the API is available
   */
  async checkConnectionOnly() {
    try {
      console.log("Checking connection to ComfyUI at:", API_BASE_URL);
      
      // Try with fetch first with CORS mode
      try {
        // Just do a simple system stats request to check connectivity
        const response = await fetch(`${API_BASE_URL}/system_stats`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        const isConnected = response.ok;
        let data = null;
        
        try {
          if (isConnected) {
            data = await response.json();
          }
        } catch (e) {
          console.warn("Could not parse system stats response:", e);
        }
        
        return {
          success: isConnected,
          data,
          error: isConnected ? null : new Error(`Failed to connect: ${response.status}`)
        };
      } catch (fetchError) {
        console.warn("Fetch attempt failed, trying axios as fallback:", fetchError);
        
        // If fetch fails, try with axios as a fallback
        try {
          const axiosResponse = await axios.get(`${API_BASE_URL}/system_stats`, {
            timeout: 5000 // 5 second timeout
          });
          
          return {
            success: true,
            data: axiosResponse.data,
            error: null
          };
        } catch (axiosError) {
          console.error("Axios fallback also failed:", axiosError);
          throw axiosError;
        }
      }
    } catch (error) {
      console.error("Connection check failed:", error);
      
      // Provide more helpful error messages based on error type
      let errorMessage = error.message;
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage = `Connection refused. Make sure ComfyUI is running at ${API_BASE_URL}`;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = `Connection timed out. ComfyUI server at ${API_BASE_URL} is not responding`;
      } else if (error.message.includes('NetworkError') || error.message.includes('Network Error')) {
        errorMessage = `Network error. This could be due to CORS issues. Make sure ComfyUI is running with --enable-cors-header="*"`;
      }
      
      return {
        success: false,
        data: null,
        error: new Error(errorMessage)
      };
    }
  },

  /**
   * Test connection to ComfyUI
   * Only checks if the API is reachable
   */
  async testConnection() {
    try {
      console.log("Testing connection to ComfyUI at:", API_BASE_URL);
      
      // Simply check if we can connect to the API
      const result = await this.checkConnectionOnly();
      
      if (result.success) {
        console.log("Connection to ComfyUI successful!");
        return {
          success: true, 
          message: "Connected to ComfyUI successfully",
          data: result.data
        };
      } else {
        console.error("Failed to connect to ComfyUI:", result.error);
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      return {
        success: false, 
        error: error
      };
    }
  }
};

export default ComfyService;