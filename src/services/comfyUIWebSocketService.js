// src/services/comfyUIWebSocketService.js
class ComfyUIWebSocketService {
    constructor() {
      this.socket = null;
      this.isConnected = false;
      this.listeners = {
        'status': [],
        'execution_start': [],
        'execution_cached': [],
        'execution_error': [],
        'execution_complete': [],
        'progress': []
      };
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 3000; // ms
    }
    
    connect(url = process.env.REACT_APP_COMFYUI_WS_URL) {
      if (this.socket && this.isConnected) {
        console.log("WebSocket already connected");
        return;
      }
      
      console.log(`Connecting to ComfyUI WebSocket at ${url}...`);
      
      try {
        this.socket = new WebSocket(url);
        
        this.socket.onopen = () => {
          console.log("ComfyUI WebSocket connection established");
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this._notifyListeners('status', { connected: true });
        };
        
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle different message types
            if (data.type === 'execution_start') {
              this._notifyListeners('execution_start', data);
            } else if (data.type === 'execution_cached') {
              this._notifyListeners('execution_cached', data);
            } else if (data.type === 'execution_error') {
              this._notifyListeners('execution_error', data);
            } else if (data.type === 'execution_complete') {
              this._notifyListeners('execution_complete', data);
            } else if (data.type === 'progress') {
              this._notifyListeners('progress', data);
            }
            
            // Also send the raw message to any handlers interested in all messages
            this._notifyListeners('message', data);
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };
        
        this.socket.onerror = (error) => {
          console.error("ComfyUI WebSocket error:", error);
          this._notifyListeners('status', { 
            connected: false, 
            error: true, 
            message: "WebSocket connection error" 
          });
        };
        
        this.socket.onclose = (event) => {
          console.log(`ComfyUI WebSocket connection closed: ${event.code} - ${event.reason}`);
          this.isConnected = false;
          this._notifyListeners('status', { 
            connected: false, 
            code: event.code, 
            reason: event.reason 
          });
          
          // Attempt to reconnect
          this._attemptReconnect();
        };
      } catch (error) {
        console.error("Failed to create WebSocket connection:", error);
      }
    }
    
    disconnect() {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
        this.isConnected = false;
      }
    }
    
    addEventListener(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event].push(callback);
      } else {
        console.warn(`Unknown event type: ${event}`);
      }
    }
    
    removeEventListener(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    }
    
    _notifyListeners(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in WebSocket ${event} listener:`, error);
          }
        });
      }
    }
    
    _attemptReconnect() {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay/1000}s...`);
        
        setTimeout(() => {
          this.connect();
        }, this.reconnectDelay);
      } else {
        console.error("Failed to reconnect after multiple attempts");
        this._notifyListeners('status', { 
          connected: false, 
          reconnectFailed: true, 
          message: "Failed to reconnect after multiple attempts" 
        });
      }
    }
  }
  
  export default new ComfyUIWebSocketService();