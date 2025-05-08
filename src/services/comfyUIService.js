// src/services/comfyUIService.js
// Add this near the top of your main JS file
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
  });
  
// Also, add this to catch unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
console.error('Unhandled promise rejection:', event.reason);
});


class ComfyUIService {
    constructor(baseUrl) {
      this.baseUrl = baseUrl || process.env.REACT_APP_COMFYUI_API_URL;
      this.connected = false;
      this.retryCount = 0;
      this.maxRetries = 3;
      this.retryDelay = 2000; // ms
      
      // Initialize connection check
      this.checkConnection();
    }
    console.log("ComfyUI API URL:", process.env.REACT_APP_COMFYUI_API_URL);
    console.log("ComfyUI WS URL:", process.env.REACT_APP_COMFYUI_WS_URL);
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
  }
  
  export default new ComfyUIService();