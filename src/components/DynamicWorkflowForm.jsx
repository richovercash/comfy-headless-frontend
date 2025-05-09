// src/components/DynamicWorkflowForm.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ComfyService from '../services/comfyService';
import SupabaseService from '../services/supabaseService';
import { workflowRegistry } from '../utils/workflowImporter';

const DynamicWorkflowForm = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState('vehicle-generation');
  const [parameters, setParameters] = useState({
    prompt: 'post-apocalyptic vehicle with large wheels and spikes',
    negativePrompt: 'bad anatomy, bad proportions, blurry, deformed',
    steps: 30,
    seed: Math.floor(Math.random() * 1000000000),
    width: 768,
    height: 768,
    filenamePrefix: 'vehicle',
    guidanceScale: 3.5
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState({ message: '', error: false });
  const [availableWorkflows, setAvailableWorkflows] = useState([]);
  const [parameterDefs, setParameterDefs] = useState({});

  // Load available workflows from registry
  useEffect(() => {
    const workflows = Object.entries(workflowRegistry).map(([id, data]) => ({
      id,
      name: id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      description: data.description
    }));
    
    setAvailableWorkflows(workflows);
  }, []);

  // Update parameter definitions when selected workflow changes
  useEffect(() => {
    if (selectedWorkflow && workflowRegistry[selectedWorkflow]) {
      setParameterDefs(workflowRegistry[selectedWorkflow].parameters);
    }
  }, [selectedWorkflow]);

  const handleParameterChange = (key, value) => {
    setParameters(prev => ({...prev, [key]: value}));
  };

  const handleWorkflowChange = (e) => {
    const newWorkflow = e.target.value;
    setSelectedWorkflow(newWorkflow);
    
    // Reset parameters to defaults based on the new workflow
    const defaultParams = {};
    if (workflowRegistry[newWorkflow] && workflowRegistry[newWorkflow].parameters) {
      Object.entries(workflowRegistry[newWorkflow].parameters).forEach(([key, def]) => {
        // Set some reasonable defaults
        switch (def.type) {
          case 'string':
            defaultParams[key] = '';
            break;
          case 'number':
            if (key === 'seed') {
              defaultParams[key] = Math.floor(Math.random() * 1000000000);
            } else if (key === 'steps') {
              defaultParams[key] = 30;
            } else if (key === 'width' || key === 'height') {
              defaultParams[key] = 768;
            } else if (key === 'guidanceScale' || key === 'cfgScale') {
              defaultParams[key] = 3.5;
            } else {
              defaultParams[key] = 0;
            }
            break;
          default:
            defaultParams[key] = null;
        }
      });
    }
    
    setParameters(defaultParams);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatus({ message: 'Starting generation...', error: false });

    try {
      // Create a session for tracking
      const session = await SupabaseService.createSession({
        workflow: selectedWorkflow,
        parameters: JSON.stringify(parameters),
        source: 'dynamic-workflow'
      });
      
      console.log("Session created:", session);
      
      // Create and queue the workflow
      setStatus({ message: 'Creating and queueing workflow...', error: false });
      const result = await ComfyService.createAndQueueWorkflow(selectedWorkflow, parameters);
      
      console.log("Workflow queued:", result);
      
      // Start polling for completion
      setStatus({ message: 'Generation in progress...', error: false });
      
      // Poll for completion (similar to your existing implementation)
      const checkCompletion = async () => {
        try {
          console.log("Checking generation status for prompt ID:", result.prompt_id);
          
          // Get the status of the specific prompt execution
          const statusResult = await ComfyService.getOutput(result.prompt_id);
          console.log("ComfyUI status check result:", statusResult);

          // Look for output images in the result
          let outputImage = null;
          let isComplete = false;

          // Try to find the output image using the timestamp
          if (!isComplete) {
            console.log("Trying to find file with timestamp:", result.timestamp);

            // Try a few possible filename patterns
            const timeBasedFilenames = [
              `vehicle_${result.timestamp}.png`,
              `vehicle_${result.timestamp}_00001.png`,
              `vehicle_${result.timestamp}_00001_.png`,
              `${parameters.filenamePrefix}_${result.timestamp}.png`,
              `${parameters.filenamePrefix}_${result.timestamp}_00001.png`,
              `${parameters.filenamePrefix}_${result.timestamp}_00001_.png`
            ];

            for (const filename of timeBasedFilenames) {
              try {
                const testUrl = `http://localhost:8188/view?filename=${encodeURIComponent(filename)}`;
                console.log("Testing URL:", testUrl);
                
                const testResponse = await fetch(testUrl, { method: 'HEAD' });
                
                if (testResponse.ok) {
                  console.log("Found image at:", filename);
                  outputImage = { filename };
                  isComplete = true;
                  break;
                }
              } catch (e) {
                console.log("Error checking filename:", filename, e);
              }
            }
          }
          
          if (isComplete && outputImage) {
            console.log("Generation complete, processing output:", outputImage);
            
            // Get the image file
            const filename = outputImage.filename;
            const imageUrl = `http://localhost:8188/view?filename=${encodeURIComponent(filename)}`;
            
            console.log("Fetching image from URL:", imageUrl);
            const imageResponse = await fetch(imageUrl);
            
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }
            
            const imageBlob = await imageResponse.blob();
            
            // Upload to Supabase storage
            const storagePath = `${session.id}/${filename}`;
            console.log("Uploading to Supabase storage:", storagePath);
            
            // Upload the image to Supabase
            await SupabaseService.uploadFile('images-2d', storagePath, imageBlob);
            
            // Create asset record in database
            console.log("Creating asset record in database");
            const assetData = await SupabaseService.createAsset({
              asset_type: 'image_2d',
              storage_path: `images-2d/${storagePath}`,
              parent_asset_id: null,
              status: 'complete',
              metadata: {
                workflow: selectedWorkflow,
                parameters: parameters,
                prompt_id: result.prompt_id
              }
            });
            
            console.log("Asset created:", assetData);
            
            // Link asset to session
            if (assetData) {
              console.log("Linking asset to session");
              await SupabaseService.linkAssetToSession(session.id, assetData.id);
            }
            
            // Update session status
            console.log("Updating session status to completed");
            await SupabaseService.updateSessionStatus(session.id, 'completed');
            
            setStatus({ 
              message: 'Generation completed! Check the assets page to see results.', 
              error: false 
            });
            setIsGenerating(false);
            return;
          }
          
          // Count polling attempts to avoid infinite loop
          if (!window.pollingAttempts) window.pollingAttempts = 0;
          window.pollingAttempts++;
          
          if (window.pollingAttempts > 15) { // 30 seconds max
            console.log("Maximum polling attempts reached, giving up");
            setStatus({ 
              message: 'Generation may have completed, but we could not process the results. Check the assets page or try again.', 
              error: true 
            });
            setIsGenerating(false);
            window.pollingAttempts = 0;
            return;
          }
          
          // If we reach here, the generation is not complete yet or we couldn't find the output
          console.log("Generation not yet complete or output not found, polling again in 2 seconds...");
          console.log("Polling attempt:", window.pollingAttempts);
          setTimeout(checkCompletion, 2000);
          
        } catch (error) {
          console.error("Error in checkCompletion:", error);
          setStatus({ 
            message: `Error processing generation results: ${error.message}`, 
            error: true 
          });
          setIsGenerating(false);
        }
      };
      
      // Start polling for completion
      setTimeout(checkCompletion, 2000);
      
    } catch (error) {
      console.error('Error generating asset:', error);
      setStatus({ 
        message: `Error: ${error.message}`, 
        error: true 
      });
      setIsGenerating(false);
    }
  };

  // Render parameter inputs based on parameter definitions
  const renderParameterInputs = () => {
    if (!parameterDefs) return null;
    
    return Object.entries(parameterDefs).map(([key, def]) => {
      const value = parameters[key] !== undefined ? parameters[key] : '';
      
      switch (def.type) {
        case 'string':
          if (key === 'prompt' || key === 'negativePrompt') {
            return (
              <FormGroup key={key}>
                <Label>{def.description || key}</Label>
                <TextArea
                  value={value}
                  onChange={(e) => handleParameterChange(key, e.target.value)}
                  placeholder={`Enter ${key}`}
                  rows={4}
                />
              </FormGroup>
            );
          } else {
            return (
              <FormGroup key={key}>
                <Label>{def.description || key}</Label>
                <Input
                  type="text"
                  value={value}
                  onChange={(e) => handleParameterChange(key, e.target.value)}
                  placeholder={`Enter ${key}`}
                />
              </FormGroup>
            );
          }
        
        case 'number':
          return (
            <FormGroup key={key}>
              <Label>{def.description || key}</Label>
              <Input
                type="number"
                value={value}
                onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
                placeholder={`Enter ${key}`}
              />
            </FormGroup>
          );
          
        default:
          return null;
      }
    });
  };

  return (
    <FormContainer>
      <h2>Dynamic Workflow Generator</h2>
      
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label>Workflow</Label>
          <Select
            value={selectedWorkflow}
            onChange={handleWorkflowChange}
          >
            {availableWorkflows.map(workflow => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name} - {workflow.description}
              </option>
            ))}
          </Select>
        </FormGroup>
        
        {renderParameterInputs()}
        
        <Button type="submit" disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate Image'}
        </Button>
      </Form>
      
      <StatusMessage 
        visible={status.message ? true : false} 
        error={status.error}
      >
        {status.message}
      </StatusMessage>
    </FormContainer>
  );
};

// Styled components
const FormContainer = styled.div`
  background-color: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 800px;
  margin: 0 auto;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-weight: bold;
  color: #333;
`;

const Input = styled.input`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
`;

const TextArea = styled.textarea`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  min-height: 100px;
  font-family: inherit;
`;

const Select = styled.select`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  background-color: white;
`;

const Button = styled.button`
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #0069d9;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const StatusMessage = styled.div`
  padding: 12px;
  margin-top: 16px;
  border-radius: 4px;
  background-color: ${props => props.error ? '#ffebee' : '#e8f5e9'};
  color: ${props => props.error ? '#c62828' : '#2e7d32'};
  display: ${props => props.visible ? 'block' : 'none'};
`;

export default DynamicWorkflowForm;
