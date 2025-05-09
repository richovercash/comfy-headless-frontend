// src/components/FluxGenerationForm.jsx
import React, { useState } from 'react';
import styled from 'styled-components';
import { useEffect } from 'react';
import ComfyService from '../services/comfyService';
import SupabaseService from '../services/supabaseService';

const FluxGenerationForm = () => {
  const [values, setValues] = useState({
    prompt: 'neon-mist, cpstyle, rock!, Gatling_mounted, madocalypse',
    steps: 28,
    inputImage: null,
    reduxImage: null,
    filenamePrefix: 'Otherides-2d',
  });
  
  // const [depthMapPreview, setDepthMapPreview] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState({ message: '', error: false });

  const handleChange = (key, value) => {
    setValues(prev => ({...prev, [key]: value}));
  };

    // Update the handleSubmit function
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatus({ message: 'Starting generation...', error: false });

    try {
      // Create a session for tracking
      const session = await SupabaseService.createSession({
        prompt: values.prompt,
        steps: values.steps,
        filenamePrefix: values.filenamePrefix,
        source: 'flux-workflow'
      });
      
      console.log("Session created:", session);
      
      // Upload images if they exist
      let inputImagePath = null;
      let reduxImagePath = null;
      
      if (values.inputImage) {
        setStatus({ message: 'Uploading input image...', error: false });
        inputImagePath = await uploadFile(values.inputImage, 'input-images');
      }
      
      if (values.reduxImage) {
        setStatus({ message: 'Uploading redux image...', error: false });
        reduxImagePath = await uploadFile(values.reduxImage, 'redux-images');
      }
      
      // Create the workflow
      setStatus({ message: 'Creating workflow...', error: false });
      const { workflow, timestamp } = ComfyService.createFluxWorkflow({
        prompt: values.prompt,
        steps: values.steps,
        inputImageUrl: inputImagePath,
        reduxImageUrl: reduxImagePath,
        filenamePrefix: values.filenamePrefix
      });
      
      // Queue in ComfyUI
      setStatus({ message: 'Queueing workflow...', error: false });
      const response = await ComfyService.queuePrompt(workflow);
      
      setStatus({ 
        message: 'Generation in progress! Check the assets page for results when complete.', 
        error: false 
      });
      
      // Here you'd implement polling for completion
      // Similar to your existing GenerationForm implementation
      
    } catch (error) {
      console.error('Error generating asset:', error);
      setStatus({ 
        message: `Error: ${error.message}`, 
        error: true 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper function to upload a file to Supabase
  const uploadFile = async (file, bucket) => {
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const path = `${filename}`;
    
    await SupabaseService.uploadFile(bucket, path, file);
    return `${bucket}/${path}`;
  };

  // Modify your useEffect in FluxGenerationForm.jsx
  // Remove this entire useEffect or replace it with a simpler one
  useEffect(() => {
    // Clear any existing file object URLs when component unmounts
    return () => {
      if (values.inputImage instanceof File) {
        URL.revokeObjectURL(URL.createObjectURL(values.inputImage));
      }
      if (values.reduxImage instanceof File) {
        URL.revokeObjectURL(URL.createObjectURL(values.reduxImage));
      }
    };
  }, [values.inputImage, values.reduxImage]);









  
return (
  <FormContainer>
    <h2>Generate with Flux Workflow</h2>
    
    <Form onSubmit={handleSubmit}>
      <FormGroup>
        <Label>Prompt</Label>
        <TextArea
          value={values.prompt}
          onChange={(e) => handleChange('prompt', e.target.value)}
          placeholder="Enter your prompt"
          rows={4}
        />
      </FormGroup>
      
      <FormGroup>
        <Label>Steps</Label>
        <Input
          type="number"
          min="1"
          max="100"
          value={values.steps}
          onChange={(e) => handleChange('steps', parseInt(e.target.value))}
        />
      </FormGroup>
      
      <FormGroup>
        <Label>Input Image (for Depth Map)</Label>
        <FileInput
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files[0]) {
              handleChange('inputImage', e.target.files[0]);
            }
          }}
        />
        {values.inputImage && (
          <PreviewContainer>
            <h4>Input Image:</h4>
            <PreviewImage 
              src={URL.createObjectURL(values.inputImage)} 
              alt="Input Image" 
            />
            <small>This image will be used for depth-based conditioning</small>
          </PreviewContainer>
        )}
      </FormGroup>

      <FormGroup>
        <Label>Redux Reference Image</Label>
        <FileInput
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files[0]) {
              handleChange('reduxImage', e.target.files[0]);
            }
          }}
        />
        {values.reduxImage && (
          <PreviewContainer>
            <h4>Redux Reference:</h4>
            <PreviewImage 
              src={URL.createObjectURL(values.reduxImage)} 
              alt="Redux Reference" 
            />
          </PreviewContainer>
        )}
      </FormGroup>
      
      <FormGroup>
        <Label>Filename Prefix</Label>
        <Input
          type="text"
          value={values.filenamePrefix}
          onChange={(e) => handleChange('filenamePrefix', e.target.value)}
        />
      </FormGroup>
      
      <Button type="submit" disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Generate Image'}
      </Button>
    </Form>
    
    {/* Add the test connection section after the form */}
    <TroubleshootingSection>
      <h3>Troubleshooting</h3>
      <Button 
        type="button"
        onClick={async () => {
          setStatus({ message: 'Testing connection...', error: false });
          try {
            // Check if ComfyService exists and has the method
            if (!ComfyService) {
              console.error("ComfyService is undefined");
              setStatus({ message: "Error: ComfyService is undefined", error: true });
              return;
            }
            
            if (!ComfyService.testConnection) {
              console.error("ComfyService.testConnection method is missing");
              setStatus({ message: "Error: testConnection method is missing in ComfyService", error: true });
              return;
            }
            
            console.log("Calling ComfyService.testConnection...");
            const result = await ComfyService.testConnection();
            console.log("Test connection result:", result);
            
            if (result && result.success) {
              setStatus({ message: 'Connection test successful!', error: false });
            } else {
              const errorMsg = result?.error?.message || 'Unknown error';
              console.error("Test connection failed:", errorMsg);
              setStatus({ message: `Connection test failed: ${errorMsg}`, error: true });
            }
          } catch (error) {
            console.error("Error during test connection:", error);
            setStatus({ 
              message: `Connection test error: ${error.message || 'Unknown error'}`, 
              error: true 
            });
          }
        }}
        secondary
      >
        Test ComfyUI Connection
      </Button>
    </TroubleshootingSection>
    
    {status.message && (
      <StatusMessage visible={!!status.message} error={status.error}>
        {status.message}
      </StatusMessage>
    )}
  </FormContainer>
);
};

// Make sure you have these styled components at the top of your file, 
// along with your other styled components
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

const FileInput = styled.input`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
`;

const PreviewContainer = styled.div`
  margin-top: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
  background-color: #f9f9f9;
  
  h4 {
    margin-top: 0;
    margin-bottom: 8px;
  }
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 200px;
  border-radius: 4px;
  display: block;
`;

const Button = styled.button`
  background-color: ${props => props.secondary ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${props => props.secondary ? '#5a6268' : '#0069d9'};
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

// Add the missing TroubleshootingSection component
const TroubleshootingSection = styled.div`
  margin-top: 24px;
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
  
  h3 {
    margin-top: 0;
    margin-bottom: 12px;
    color: #333;
  }
`;



export default FluxGenerationForm;