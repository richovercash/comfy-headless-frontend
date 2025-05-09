// src/services/comfyService.js
import axios from 'axios';
// Import with explicit named import
import { createFluxSimplifiedWorkflow } from '../workflows/fluxSimplified';
import { validateWorkflow, convertEditorWorkflowToAPIFormat } from '../utils/workflowConverter';

// API base URL
export const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';

console.log("API URL:", API_BASE_URL);

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
      
      // Step 1: Validate the workflow
      const { isValid, errors } = validateWorkflow(workflow);
      if (!isValid) {
        const errorMsg = `Invalid workflow: ${errors.join(', ')}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Format expected by ComfyUI API
      const payload = {
        prompt: workflow,
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
   * Test connection with a very simple connection verification
   * Doesn't try to execute a workflow, just checks if the API is available
   */
  async checkConnectionOnly() {
    try {
      // Just do a simple system stats request to check connectivity
      const response = await fetch(`${API_BASE_URL}/system_stats`);
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
    } catch (error) {
      console.error("Connection check failed:", error);
      return {
        success: false,
        data: null,
        error
      };
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
   * Uses our simplified, robust workflow
   */
  createFluxWorkflow(options) {
    return createFluxSimplifiedWorkflow(options);
  },

  /**
   * Test connection to ComfyUI
   * Only checks if the API is reachable, doesn't try to execute any workflows
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
  },
  
  /**
   * Process a workflow JSON from the ComfyUI editor
   * Converts it to the format expected by the ComfyUI API
   * @param {Object} editorWorkflow - The workflow from ComfyUI editor
   * @returns {Object} - Processed workflow ready for the API
   */
  processEditorWorkflow(editorWorkflow) {
    try {
      return convertEditorWorkflowToAPIFormat(editorWorkflow);
    } catch (error) {
      console.error("Error processing editor workflow:", error);
      throw error;
    }
  }
};

export default ComfyService;