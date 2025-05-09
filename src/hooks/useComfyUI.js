// src/hooks/useComfyUI.js
import { useState, useEffect, useCallback } from 'react';
import comfyUIService from '../services/comfyUIService';
import comfyUIWebSocketService from '../services/comfyUIWebSocketService';

export const useComfyUI = (initialWorkflow = null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  // Initialize connection
  useEffect(() => {
    // Check API connection
    const checkConnection = async () => {
      try {
        const connected = await comfyUIService.checkConnection();
        setIsConnected(connected);
        if (!connected) {
          setError('Could not connect to ComfyUI API');
        }
      } catch (err) {
        setError(`Connection error: ${err.message}`);
      }
    };
    
    checkConnection();
    
    // Set up WebSocket
    comfyUIWebSocketService.connect();
    
    // WebSocket event listeners
    const handleStatusChange = (data) => {
      setIsConnected(data.connected);
      if (!data.connected && data.error) {
        setError(`WebSocket error: ${data.message || 'Unknown error'}`);
      }
    };
    
    const handleExecutionStart = (data) => {
      setIsProcessing(true);
      setProgress(0);
      setError(null);
    };
    
    const handleExecutionComplete = (data) => {
      setIsProcessing(false);
      setProgress(100);
      
      // Update results if the completed job matches our current job
      if (currentJob && data.prompt_id === currentJob.prompt_id) {
        // Fetch the results
        fetchResults(data);
      }
    };
    
    const handleExecutionError = (data) => {
      setIsProcessing(false);
      setError(`Execution error: ${data.error || 'Unknown error'}`);
    };
    
    const handleProgress = (data) => {
      if (data.value && data.max) {
        setProgress(Math.round((data.value / data.max) * 100));
      }
    };
    
    // Register event listeners
    comfyUIWebSocketService.addEventListener('status', handleStatusChange);
    comfyUIWebSocketService.addEventListener('execution_start', handleExecutionStart);
    comfyUIWebSocketService.addEventListener('execution_complete', handleExecutionComplete);
    comfyUIWebSocketService.addEventListener('execution_error', handleExecutionError);
    comfyUIWebSocketService.addEventListener('progress', handleProgress);
    
    // Cleanup function
    return () => {
      comfyUIWebSocketService.removeEventListener('status', handleStatusChange);
      comfyUIWebSocketService.removeEventListener('execution_start', handleExecutionStart);
      comfyUIWebSocketService.removeEventListener('execution_complete', handleExecutionComplete);
      comfyUIWebSocketService.removeEventListener('execution_error', handleExecutionError);
      comfyUIWebSocketService.removeEventListener('progress', handleProgress);
    };
  }, [currentJob]);
  
  // Function to fetch results after job completion
  const fetchResults = async (data) => {
    try {
      if (!data || !data.output) {
        setError('No output data in completion event');
        return;
      }
      
      // Find image outputs
      const images = [];
      for (const nodeId in data.output) {
        const nodeOutput = data.output[nodeId];
        if (Array.isArray(nodeOutput) && nodeOutput.length > 0) {
          for (const item of nodeOutput) {
            if (item.filename && item.type === 'image') {
              const imageUrl = await comfyUIService.getGeneratedImage(item.filename);
              images.push({
                nodeId,
                filename: item.filename,
                url: imageUrl
              });
            }
          }
        }
      }
      
      setResults({
        promptId: data.prompt_id,
        images,
        rawOutput: data.output
      });
    } catch (err) {
      setError(`Error fetching results: ${err.message}`);
    }
  };
  
  const submitJob = useCallback(async (workflowData = initialWorkflow) => {
    console.log("submitJob called with workflow:", workflowData);
    
    if (!workflowData) {
      console.error("No workflow data provided");
      setError('No workflow data provided');
      return null;
    }
    
    try {
      setError(null);
      setResults(null);
      
      console.log("Preparing to send request to ComfyUI at:", baseUrl || process.env.REACT_APP_COMFYUI_API_URL);
      
      const requestBody = {
        prompt: workflowData,
        client_id: "frontend-" + Date.now()
      };
      
      console.log("Sending request with body:", JSON.stringify(requestBody));
      
      const response = await fetch(`${baseUrl || process.env.REACT_APP_COMFYUI_API_URL}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log("Received response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error from ComfyUI:", errorText);
        throw new Error(`Failed to submit prompt: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Successful response from ComfyUI:", data);
      
      setCurrentJob({
        prompt_id: data.prompt_id,
        workflow: workflowData
      });
      
      return data;
    } catch (err) {
      console.error("Error submitting job to ComfyUI:", err);
      setError(`Error submitting job: ${err.message}`);
      return null;
    }
  }, [initialWorkflow, setCurrentJob, setError, setResults]);
  // Function to check job status manually (as a backup to WebSocket)
  const checkJobStatus = useCallback(async (promptId = null) => {
    const id = promptId || (currentJob ? currentJob.prompt_id : null);
    if (!id) {
      setError('No job ID to check');
      return null;
    }
    
    try {
      const status = await comfyUIService.getJobStatus(id);
      return status;
    } catch (err) {
      setError(`Error checking job status: ${err.message}`);
      return null;
    }
  }, [currentJob]);
  
  return {
    isConnected,
    isProcessing,
    progress,
    currentJob,
    results,
    error,
    submitJob,
    checkJobStatus
  };
};