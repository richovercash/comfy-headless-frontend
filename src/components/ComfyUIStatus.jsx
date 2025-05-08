// src/components/ComfyUIStatus.jsx
import React, { useEffect, useState } from 'react';
import comfyUIService from '../services/comfyUIService';
import comfyUIWebSocketService from '../services/comfyUIWebSocketService';

const ComfyUIStatus = () => {
  const [apiStatus, setApiStatus] = useState({
    connected: false,
    checking: true,
    error: null
  });
  
  const [wsStatus, setWsStatus] = useState({
    connected: false,
    error: null
  });
  
  // Check API connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await comfyUIService.checkConnection();
        setApiStatus({
          connected,
          checking: false,
          error: connected ? null : 'Could not connect to ComfyUI API'
        });
      } catch (err) {
        setApiStatus({
          connected: false,
          checking: false,
          error: `Connection error: ${err.message}`
        });
      }
    };
    
    checkConnection();
    
    // Set up periodic connection check
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Monitor WebSocket connection
  useEffect(() => {
    const handleStatusChange = (data) => {
      setWsStatus({
        connected: data.connected,
        error: data.connected ? null : (data.message || 'WebSocket disconnected')
      });
    };
    
    // Register event listener
    comfyUIWebSocketService.addEventListener('status', handleStatusChange);
    
    // Connect WebSocket if not already connected
    if (!comfyUIWebSocketService.isConnected) {
      comfyUIWebSocketService.connect();
    } else {
      setWsStatus({
        connected: true,
        error: null
      });
    }
    
    // Cleanup function
    return () => {
      comfyUIWebSocketService.removeEventListener('status', handleStatusChange);
    };
  }, []);
  
  // Attempt to reconnect manually
  const handleReconnect = () => {
    setApiStatus(prev => ({ ...prev, checking: true }));
    comfyUIService.checkConnection().then(connected => {
      setApiStatus({
        connected,
        checking: false,
        error: connected ? null : 'Could not connect to ComfyUI API'
      });
    });
    
    comfyUIWebSocketService.connect();
  };
  
  return (
    <div className="comfyui-status">
      <h3>ComfyUI Connection Status</h3>
      
      <div className="status-indicators">
        <div className="status-indicator">
          <span className="indicator-label">API:</span>
          <span className={`indicator-value ${apiStatus.connected ? 'connected' : 'disconnected'}`}>
            {apiStatus.checking ? 'Checking...' : (apiStatus.connected ? 'Connected' : 'Disconnected')}
          </span>
          {apiStatus.error && <span className="error-message">{apiStatus.error}</span>}
        </div>
        
        <div className="status-indicator">
          <span className="indicator-label">WebSocket:</span>
          <span className={`indicator-value ${wsStatus.connected ? 'connected' : 'disconnected'}`}>
            {wsStatus.connected ? 'Connected' : 'Disconnected'}
          </span>
          {wsStatus.error && <span className="error-message">{wsStatus.error}</span>}
        </div>
      </div>
      
      <div className="status-actions">
        <button 
          onClick={handleReconnect}
          disabled={apiStatus.checking}
        >
          {apiStatus.checking ? 'Reconnecting...' : 'Reconnect'}
        </button>
      </div>
      
      <div className="troubleshooting-tips">
        <h4>Troubleshooting Tips:</h4>
        <ul>
          <li>Ensure ComfyUI is running on the configured URL</li>
          <li>Check for any error messages in the ComfyUI console</li>
          <li>Verify network connectivity between frontend and ComfyUI server</li>
          <li>Restart ComfyUI if issues persist</li>
        </ul>
      </div>
    </div>
  );
};

export default ComfyUIStatus;