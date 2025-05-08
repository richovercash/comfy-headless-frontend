// src/components/ComfyUIDiagnosticTool.jsx
import React, { useState } from 'react';
import { useComfyUI } from '../hooks/useComfyUI';

const ComfyUIDiagnosticTool = () => {
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [testWorkflowResult, setTestWorkflowResult] = useState(null);
  
  const { 
    isConnected, 
    error: hookError,
    submitJob
  } = useComfyUI();
  
  // Run basic connection diagnostic
  const runConnectionDiagnostic = async () => {
    setIsRunningDiagnostics(true);
    setDiagnosticResults(null);
    console.log("ComfyUI API URL:", process.env.REACT_APP_COMFYUI_API_URL);
    console.log("ComfyUI WS URL:", process.env.REACT_APP_COMFYUI_WS_URL);
    
    try {
      const results = {
        apiEndpoint: false,
        wsEndpoint: false,
        systemStats: null,
        history: null,
        errors: []
      };
      
      // Test API endpoint
      try {
        const response = await fetch(`${process.env.REACT_APP_COMFYUI_API_URL}/system_stats`);
        results.apiEndpoint = response.ok;
        
        if (response.ok) {
          results.systemStats = await response.json();
        } else {
          results.errors.push(`API endpoint returned status: ${response.status}`);
        }
      } catch (err) {
        results.errors.push(`API connection error: ${err.message}`);
      }
      
      // Test history endpoint
      try {
        const response = await fetch(`${process.env.REACT_APP_COMFYUI_API_URL}/history`);
        
        if (response.ok) {
          results.history = await response.json();
        } else {
          results.errors.push(`History endpoint returned status: ${response.status}`);
        }
      } catch (err) {
        results.errors.push(`History endpoint error: ${err.message}`);
      }
      
      // Test WebSocket endpoint
      try {
        const ws = new WebSocket(process.env.REACT_APP_COMFYUI_WS_URL);
        
        // Create a promise that resolves on open or rejects on error
        const wsPromise = new Promise((resolve, reject) => {
          ws.onopen = () => {
            results.wsEndpoint = true;
            resolve();
          };
          
          ws.onerror = (error) => {
            results.errors.push('WebSocket connection error');
            reject(error);
          };
          
          // Set a timeout
          setTimeout(() => {
            reject(new Error('WebSocket connection timeout'));
          }, 5000);
        });
        
        await wsPromise.catch(err => {
          results.errors.push(`WebSocket error: ${err.message}`);
        });
        
        // Close the WebSocket
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      } catch (err) {
        results.errors.push(`WebSocket setup error: ${err.message}`);
      }
      
      setDiagnosticResults(results);
    } catch (err) {
      setDiagnosticResults({
        apiEndpoint: false,
        wsEndpoint: false,
        systemStats: null,
        history: null,
        errors: [`Diagnostic error: ${err.message}`]
      });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };
  
  // Run a simple test workflow
  const runTestWorkflow = async () => {
    setTestWorkflowResult({
      status: 'running',
      message: 'Submitting test workflow...',
      data: null,
      error: null
    });
    
    try {
      // Simple test workflow - just an empty latent image and an output
      const testWorkflow = {
        "1": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "batch_size": 1,
            "height": 512,
            "width": 512
          }
        },
        "2": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["1", 0],
            "vae": ["3", 0]
          }
        },
        "3": {
          "class_type": "VAELoader",
          "inputs": {
            "vae_name": "vae-ft-mse-840000-ema-pruned.safetensors"
          }
        },
        "4": {
          "class_type": "SaveImage",
          "inputs": {
            "filename_prefix": "test_image",
            "images": ["2", 0]
          }
        }
      };
      
      const result = await submitJob(testWorkflow);
      
      setTestWorkflowResult({
        status: 'success',
        message: 'Test workflow submitted successfully',
        data: result,
        error: null
      });
    } catch (err) {
      setTestWorkflowResult({
        status: 'error',
        message: 'Test workflow failed',
        data: null,
        error: err.message
      });
    }
  };
  
  return (
    <div className="comfyui-diagnostic-tool">
      <h2>ComfyUI Diagnostic Tool</h2>
      
      <div className="diagnostic-actions">
        <button 
          onClick={runConnectionDiagnostic}
          disabled={isRunningDiagnostics}
        >
          {isRunningDiagnostics ? 'Running Diagnostics...' : 'Run Connection Diagnostics'}
        </button>
        
        <button 
          onClick={runTestWorkflow}
          disabled={!isConnected || testWorkflowResult?.status === 'running'}
        >
          {testWorkflowResult?.status === 'running' ? 'Running Test...' : 'Run Test Workflow'}
        </button>
      </div>
      
      {hookError && (
        <div className="diagnostic-error">
          <h3>Hook Error:</h3>
          <pre>{hookError}</pre>
        </div>
      )}
      
      {diagnosticResults && (
        <div className="diagnostic-results">
          <h3>Diagnostic Results:</h3>
          
          <div className="result-item">
            <span className="result-label">API Endpoint:</span>
            <span className={`result-value ${diagnosticResults.apiEndpoint ? 'success' : 'failure'}`}>
              {diagnosticResults.apiEndpoint ? 'Connected' : 'Failed'}
            </span>
          </div>
          
          <div className="result-item">
            <span className="result-label">WebSocket Endpoint:</span>
            <span className={`result-value ${diagnosticResults.wsEndpoint ? 'success' : 'failure'}`}>
              {diagnosticResults.wsEndpoint ? 'Connected' : 'Failed'}
            </span>
          </div>
          
          {diagnosticResults.systemStats && (
            <div className="system-stats">
              <h4>System Stats:</h4>
              <pre>{JSON.stringify(diagnosticResults.systemStats, null, 2)}</pre>
            </div>
          )}
          
          {diagnosticResults.errors.length > 0 && (
            <div className="diagnostic-errors">
              <h4>Errors:</h4>
              <ul>
                {diagnosticResults.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {testWorkflowResult && (
        <div className={`test-workflow-results ${testWorkflowResult.status}`}>
          <h3>Test Workflow Results:</h3>
          <p><strong>Status:</strong> {testWorkflowResult.status}</p>
          <p><strong>Message:</strong> {testWorkflowResult.message}</p>
          
          {testWorkflowResult.error && (
            <div className="test-error">
              <h4>Error:</h4>
              <pre>{testWorkflowResult.error}</pre>
            </div>
          )}
          
          {testWorkflowResult.data && (
            <div className="test-data">
              <h4>Response Data:</h4>
              <pre>{JSON.stringify(testWorkflowResult.data, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
      
      <div className="configuration-info">
        <h3>Configuration:</h3>
        <p>ComfyUI API URL: {process.env.REACT_APP_COMFYUI_API_URL || 'Not configured'}</p>
        <p>ComfyUI WebSocket URL: {process.env.REACT_APP_COMFYUI_WS_URL || 'Not configured'}</p>
      </div>
      
      <div className="troubleshooting-guide">
        <h3>Troubleshooting Guide:</h3>
        <h4>Common Issues:</h4>
        <ul>
          <li>
            <strong>Cannot connect to API:</strong> Verify ComfyUI is running and the API URL is correctly configured
          </li>
          <li>
            <strong>WebSocket connection fails:</strong> Check if ComfyUI has WebSocket support enabled
          </li>
          <li>
            <strong>Test workflow fails:</strong> Verify VAE model is available in ComfyUI
          </li>
          <li>
            <strong>CORS issues:</strong> Ensure ComfyUI is configured to allow requests from your frontend domain
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ComfyUIDiagnosticTool;