// src/services/comfyService.js
import axios from 'axios';
import { createDirectFluxWorkflow } from '../workflows/directFluxWorkflow';

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
      console.log("Queueing workflow:", workflow);
      
      // Format expected by ComfyUI API
      const payload = {
        prompt: workflow,
        client_id: "generator-" + Date.now()
      };
      
      console.log("Sending payload:", JSON.stringify(payload).substring(0, 200) + "...");
      
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
   * Get available models from ComfyUI
   */
  async getAvailableModels() {
    try {
      const response = await axios.get(`${API_BASE_URL}/object_info`);
      const data = response.data;
      
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
   * Create a Flux workflow with the provided options
   * Uses the original workflow with minimal changes
   */
  createFluxWorkflow(options) {
    return createDirectFluxWorkflow(options);
  },

  /**
   * Test connection to ComfyUI
   * Uses a very simple workflow to verify connectivity
   */
  async testConnection() {
    try {
      console.log("Testing connection to ComfyUI at:", API_BASE_URL);
      
      // Just do a simple API check
      const statsResponse = await fetch(`${API_BASE_URL}/system_stats`);
      if (!statsResponse.ok) {
        return {
          success: false, 
          error: new Error(`System stats request failed with status: ${statsResponse.status}`)
        };
      }
      
      return {
        success: true, 
        message: "Connected to ComfyUI API successfully"
      };
    } catch (error) {
      console.error("Connection test failed:", error);
      return {success: false, error};
    }
  }
};

export default ComfyService;