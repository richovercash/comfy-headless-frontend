// src/components/ComfyUITroubleshooter.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../services/comfyService';

/**
 * A component to help diagnose and fix ComfyUI connection issues
 */
const ComfyUITroubleshooter = () => {
  const [systemInfo, setSystemInfo] = useState(null);
  const [nodeInfo, setNodeInfo] = useState(null);
  const [apiStatus, setApiStatus] = useState({ checking: false, status: null });
  const [modelStatus, setModelStatus] = useState({ checking: false, models: [] });
  const [urlLoaderStatus, setUrlLoaderStatus] = useState({ checking: false, status: null });
  
  useEffect(() => {
    // Initial status check on mount
    checkApiStatus();
  }, []);
  
  /**
   * Check if the ComfyUI API is accessible
   */
  const checkApiStatus = async () => {
    setApiStatus({ checking: true, status: null });
    
    try {
      const response = await axios.get(`${API_BASE_URL}/system_stats`, { timeout: 5000 });
      setApiStatus({ checking: false, status: 'connected', details: response.data });
      setSystemInfo(response.data);
    } catch (error) {
      console.error("Error checking ComfyUI API:", error);
      setApiStatus({ 
        checking: false, 
        status: 'error', 
        details: error.message || 'Unknown error'
      });
    }
  };
  
  /**
   * Check if required models are available
   */
  const checkModels = async () => {
    setModelStatus({ checking: true, models: [] });
    
    try {
      const response = await axios.get(`${API_BASE_URL}/object_info`, { timeout: 8000 });
      
      if (response.data && response.data.CheckpointLoaderSimple) {
        // Get the list of available models from the checkpoint loader
        const modelsData = response.data.CheckpointLoaderSimple.input.required.ckpt_name;
        
        if (modelsData && modelsData.options) {
          const availableModels = modelsData.options.map(model => ({
            name: model,
            isFlux: model.toLowerCase().includes('flux')
          }));
          
          setModelStatus({ 
            checking: false, 
            models: availableModels,
            hasFluxModel: availableModels.some(model => model.isFlux)
          });
          
          return;
        }
      }
      
      // If we couldn't find the models in the expected place
      setModelStatus({ 
        checking: false, 
        models: [],
        error: 'Could not retrieve model list from ComfyUI'
      });
      
    } catch (error) {
      console.error("Error checking models:", error);
      setModelStatus({ 
        checking: false, 
        models: [],
        error: error.message || 'Unknown error'
      });
    }
  };
  
  /**
   * Check if URL loader nodes are available
   */
  const checkUrlLoader = async () => {
    setUrlLoaderStatus({ checking: true, status: null });
    
    try {
      const response = await axios.get(`${API_BASE_URL}/object_info`, { timeout: 8000 });
      
      const hasUrlLoader = !!(response.data && (
        response.data.LoadImageFromUrlOrPath || 
        response.data.AnyURL || 
        response.data.LoadImageFromCivitai
      ));
      
      setUrlLoaderStatus({ 
        checking: false, 
        status: hasUrlLoader ? 'available' : 'missing',
        details: hasUrlLoader 
          ? 'URL loader nodes are available' 
          : 'URL loader nodes are missing. Install ComfyUI-URL-Loader extension.'
      });
      
      // Also store complete node info for display
      setNodeInfo(response.data);
      
    } catch (error) {
      console.error("Error checking URL loader:", error);
      setUrlLoaderStatus({ 
        checking: false, 
        status: 'error',
        details: error.message || 'Unknown error'
      });
    }
  };
  
  /**
   * Helper to test a URL to see if it's accessible from ComfyUI
   */
  const testImageUrl = async () => {
    const testUrl = prompt("Enter a Supabase image URL to test:", "");
    
    if (!testUrl) return;
    
    try {
      // First check if the URL is directly accessible
      const browserCheckResult = await fetch(testUrl, { method: 'HEAD' });
      const isBrowserAccessible = browserCheckResult.ok;
      
      // Now try to load it through ComfyUI
      const workflowToTest = {
        "1": {
          "class_type": "LoadImageFromUrlOrPath",
          "inputs": {
            "url": testUrl
          }
        },
        "2": {
          "class_type": "PreviewImage",
          "inputs": {
            "images": ["1", 0]
          }
        }
      };
      
      const response = await axios.post(`${API_BASE_URL}/prompt`, {
        prompt: workflowToTest,
        client_id: "troubleshooter-" + Date.now()
      });
      
      alert(`
URL Test Results:
- Browser direct access: ${isBrowserAccessible ? 'Success' : 'Failed'}
- ComfyUI access: ${response.data && !response.data.error ? 'Successfully queued' : 'Failed'}
- Prompt ID: ${response.data?.prompt_id || 'N/A'}

Check ComfyUI interface to see if image loaded successfully.
      `);
      
    } catch (error) {
      alert(`Error testing URL: ${error.message}`);
    }
  };
  
  return (
    <TroubleshooterContainer>
      <h3>ComfyUI Connection Troubleshooter</h3>
      
      <SectionContainer>
        <SectionTitle>1. API Connection</SectionTitle>
        <StatusDisplay status={apiStatus.status}>
          {apiStatus.checking ? 'Checking connection...' : 
            apiStatus.status === 'connected' ? 'Connected to ComfyUI API ✅' : 
            'Connection failed ❌'}
        </StatusDisplay>
        
        <Button onClick={checkApiStatus} disabled={apiStatus.checking}>
          {apiStatus.checking ? 'Checking...' : 'Check API Connection'}
        </Button>
        
        {apiStatus.status === 'connected' && systemInfo && (
          <InfoDisplay>
            <p><strong>System Information:</strong></p>
            <ul>
              <li>Platform: {systemInfo.platform || 'Unknown'}</li>
              <li>CPU Utilization: {systemInfo.cpu?.usage ? `${systemInfo.cpu.usage.toFixed(1)}%` : 'Unknown'}</li>
              <li>Total RAM: {systemInfo.ram?.total ? `${(systemInfo.ram.total / (1024 * 1024 * 1024)).toFixed(1)} GB` : 'Unknown'}</li>
              <li>Available RAM: {systemInfo.ram?.free ? `${(systemInfo.ram.free / (1024 * 1024 * 1024)).toFixed(1)} GB` : 'Unknown'}</li>
              {systemInfo.cuda && (
                <li>CUDA: {systemInfo.cuda.name || 'Available'} - {systemInfo.cuda.vram_free ? `${(systemInfo.cuda.vram_free / (1024 * 1024 * 1024)).toFixed(1)} GB Free` : 'Unknown VRAM'}</li>
              )}
            </ul>
          </InfoDisplay>
        )}
        
        {apiStatus.status === 'error' && (
          <ErrorMessage>
            <p>Error connecting to ComfyUI API: {apiStatus.details}</p>
            <p>Make sure:</p>
            <ul>
              <li>ComfyUI is running at: {API_BASE_URL}</li>
              <li>CORS is enabled: start ComfyUI with <code>--enable-cors-header="*"</code></li>
              <li>Your network allows connections to this address</li>
            </ul>
          </ErrorMessage>
        )}
      </SectionContainer>
      
      <SectionContainer>
        <SectionTitle>2. Model Availability</SectionTitle>
        <StatusDisplay status={modelStatus.hasFluxModel ? 'success' : 'pending'}>
          {modelStatus.checking ? 'Checking models...' : 
            modelStatus.error ? 'Error checking models ❌' : 
            modelStatus.hasFluxModel ? 'Flux model available ✅' : 
            'Flux model not detected ⚠️'}
        </StatusDisplay>
        
        <Button onClick={checkModels} disabled={modelStatus.checking}>
          {modelStatus.checking ? 'Checking...' : 'Check Model Availability'}
        </Button>
        
        {modelStatus.models.length > 0 && (
          <InfoDisplay>
            <p><strong>Available Models:</strong></p>
            <ul>
              {modelStatus.models.map((model, index) => (
                <li key={index}>
                  {model.name} {model.isFlux ? '✅ (Flux)' : ''}
                </li>
              ))}
            </ul>
          </InfoDisplay>
        )}
        
        {modelStatus.error && (
          <ErrorMessage>
            <p>Error checking models: {modelStatus.error}</p>
          </ErrorMessage>
        )}
      </SectionContainer>
      
      <SectionContainer>
        <SectionTitle>3. URL Loader Nodes</SectionTitle>
        <StatusDisplay status={urlLoaderStatus.status === 'available' ? 'success' : 'pending'}>
          {urlLoaderStatus.checking ? 'Checking URL loaders...' : 
            urlLoaderStatus.status === 'available' ? 'URL loader nodes available ✅' : 
            urlLoaderStatus.status === 'missing' ? 'URL loader nodes missing ⚠️' : 
            'URL loader status unknown ❓'}
        </StatusDisplay>
        
        <Button onClick={checkUrlLoader} disabled={urlLoaderStatus.checking}>
          {urlLoaderStatus.checking ? 'Checking...' : 'Check URL Loader Availability'}
        </Button>
        
        {urlLoaderStatus.details && (
          <InfoDisplay>
            <p>{urlLoaderStatus.details}</p>
            {urlLoaderStatus.status === 'missing' && (
              <div>
                <p>Install URL loader nodes with these commands:</p>
                <pre>
                  cd ComfyUI/custom_nodes{'\n'}
                  git clone https://github.com/sprite-puppet/comfyui-url-loader
                </pre>
                <p>Then restart ComfyUI</p>
              </div>
            )}
          </InfoDisplay>
        )}
        
        {urlLoaderStatus.status === 'available' && (
          <Button onClick={testImageUrl}>
            Test Image URL Access
          </Button>
        )}
      </SectionContainer>
      
      <SectionContainer>
        <SectionTitle>4. Troubleshooting Steps</SectionTitle>
        <InfoDisplay>
          <p><strong>If you're experiencing issues:</strong></p>
          <ol>
            <li>Make sure ComfyUI is running with <code>--enable-cors-header="*"</code></li>
            <li>Check that your Supabase buckets are set to "Public" for input images</li>
            <li>Install URL loader extensions for ComfyUI if needed</li>
            <li>Ensure your flux model is installed in ComfyUI's models folder</li>
            <li>Try a simpler workflow first before using advanced mode</li>
          </ol>
        </InfoDisplay>
      </SectionContainer>
    </TroubleshooterContainer>
  );
};

// Styled components
const TroubleshooterContainer = styled.div`
  margin-top: 20px;
  background-color: #f5f7f9;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 20px;
`;

const SectionContainer = styled.div`
  margin-bottom: 24px;
  border-bottom: 1px solid #e1e4e8;
  padding-bottom: 20px;
  
  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h4`
  margin-top: 0;
  margin-bottom: 12px;
  color: #24292e;
`;

const Button = styled.button`
  background-color: #0366d6;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  margin: 8px 8px 8px 0;
  cursor: pointer;
  font-size: 0.9rem;
  
  &:hover {
    background-color: #0258bd;
  }
  
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const StatusDisplay = styled.div`
  padding: 10px;
  margin-bottom: 12px;
  border-radius: 4px;
  background-color: ${props => 
    props.status === 'connected' || props.status === 'success' ? '#e6ffed' :
    props.status === 'error' ? '#ffeef0' :
    '#f6f8fa'};
  border: 1px solid ${props => 
    props.status === 'connected' || props.status === 'success' ? '#34d058' :
    props.status === 'error' ? '#d73a49' :
    '#e1e4e8'};
  color: ${props => 
    props.status === 'connected' || props.status === 'success' ? '#22863a' :
    props.status === 'error' ? '#cb2431' :
    '#24292e'};
`;

const InfoDisplay = styled.div`
  background-color: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 4px;
  padding: 12px;
  margin-top: 12px;
  font-size: 0.9rem;
  
  p {
    margin-top: 0;
    margin-bottom: 8px;
  }
  
  ul, ol {
    margin-top: 0;
    padding-left: 24px;
  }
  
  pre {
    background-color: #24292e;
    color: #e1e4e8;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
  }
`;

const ErrorMessage = styled.div`
  background-color: #ffeef0;
  border: 1px solid #f9d0d0;
  border-radius: 4px;
  padding: 12px;
  margin-top: 12px;
  color: #86181d;
  font-size: 0.9rem;
  
  p {
    margin-top: 0;
    margin-bottom: 8px;
  }
  
  ul {
    margin-top: 0;
    padding-left: 24px;
  }
`;

export default ComfyUITroubleshooter;