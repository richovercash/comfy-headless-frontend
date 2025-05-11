// src/components/FluxGenerationForm.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ComfyService from '../services/comfyService';
import SupabaseService from '../services/supabaseService';
import { supabase } from "../services/supabaseService";
import ComfyUITroubleshooter from './ComfyUITroubleshooter';

export const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';

const FluxGenerationForm = () => {
  const [values, setValues] = useState({
    prompt: 'neon-mist, cpstyle, rock!, Gatling_mounted, madocalypse',
    steps: 28,
    inputImage: null,
    reduxImage: null,
    filenamePrefix: 'Otherides-2d',
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState({ message: '', error: false });
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const [generationTimestamp, setGenerationTimestamp] = useState(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [sessionId, setSessionId] = useState(null);

  const handleChange = (key, value) => {
    setValues(prev => ({...prev, [key]: value}));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatus({ message: 'Starting generation...', error: false });
    setPollingAttempts(0);

    try {
      // Create a session for tracking
      const session = await SupabaseService.createSession({
        prompt: values.prompt,
        steps: values.steps,
        filenamePrefix: values.filenamePrefix,
        source: 'flux-workflow'
      });
      
      console.log("Session created:", session);
      setSessionId(session.id);
      
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
      
      // Save the timestamp for later use in polling
      setGenerationTimestamp(timestamp);
      
      // Queue in ComfyUI
      setStatus({ message: 'Queueing workflow...', error: false });
      const response = await ComfyService.queuePrompt(workflow);
      
      setStatus({ 
        message: 'Generation in progress! Waiting for results...', 
        error: false 
      });
      
      // Begin polling for completion
      setTimeout(() => checkCompletion(response.prompt_id, timestamp, session.id), 2000);
      
    } catch (error) {
      console.error('Error generating asset:', error);
      setStatus({ 
        message: `Error: ${error.message}`, 
        error: true 
      });
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

  // Function to check if generation is complete and process results
  const checkCompletion = async (promptId, timestamp, sessionId) => {
    if (pollingAttempts >= 15) {
      setStatus({ 
        message: 'Generation timed out. Check assets page later for results.', 
        error: true 
      });
      setIsGenerating(false);
      return;
    }

    setPollingAttempts(prev => prev + 1);
    setStatus({ 
      message: `Generation in progress... (attempt ${pollingAttempts + 1}/15)`, 
      error: false 
    });

    try {
      console.log("Checking generation status for timestamp:", timestamp);
      
      // Try to find the generated file by testing different filename patterns
      const timeBasedFilenames = [
        `${values.filenamePrefix}${timestamp}.png`,
        `${values.filenamePrefix}${timestamp}_00001.png`,
        `${values.filenamePrefix}${timestamp}_00001_.png`
      ];

      let isComplete = false;
      let outputFilename = null;
      
      for (const filename of timeBasedFilenames) {
        try {
          const testUrl = `${API_BASE_URL}/view?filename=${encodeURIComponent(filename)}`;
          console.log("Testing URL:", testUrl);
          
          const testResponse = await fetch(testUrl, { method: 'HEAD' });
          
          if (testResponse.ok) {
            console.log("Found image at:", filename);
            outputFilename = filename;
            isComplete = true;
            break;
          }
        } catch (e) {
          console.log("Error checking filename:", filename, e);
        }
      }

      if (isComplete && outputFilename) {
        await processGeneratedImage(outputFilename, sessionId);
      } else {
        // Not found yet, continue polling
        setTimeout(() => checkCompletion(promptId, timestamp, sessionId), 2000);
      }
    } catch (error) {
      console.error("Error in checkCompletion:", error);
      setStatus({ 
        message: `Error checking generation status: ${error.message}`, 
        error: true 
      });
      setIsGenerating(false);
    }
  };

  // Function to process the generated image once found
  const processGeneratedImage = async (filename, sessionId) => {
    try {
      console.log("Processing generated image:", filename);
      setStatus({ message: 'Generation complete! Processing results...', error: false });
      
      // Get the image file from ComfyUI
      const imageUrl = `${API_BASE_URL}/view?filename=${encodeURIComponent(filename)}`;
      console.log("Fetching image from URL:", imageUrl);
      
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      
      const imageBlob = await imageResponse.blob();
      
      // Upload to Supabase storage
      const storagePath = `${sessionId}/${filename}`;
      console.log("Uploading to Supabase storage:", storagePath);
      
      // Make sure the bucket exists
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets.some(b => b.name === 'images-2d');
        
        if (!bucketExists) {
          console.log("Creating storage bucket 'images-2d'");
          await supabase.storage.createBucket('images-2d', {
            public: false,
            allowedMimeTypes: ['image/png'],
            fileSizeLimit: 10485760 // 10MB
          });
        }
      } catch (error) {
        console.error("Error handling bucket:", error);
        // Continue anyway, in case the error is just with checking/creating
      }
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('images-2d')
        .upload(storagePath, imageBlob);
        
      if (uploadError) {
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }
      
      // Create asset record in database
      console.log("Creating asset record in database");
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .insert([
          {
            asset_type: 'image_2d',
            storage_path: `images-2d/${storagePath}`, // Make sure path includes bucket name
            parent_asset_id: null, // This is an original generation
            status: 'complete',
            metadata: {
              prompt: values.prompt,
              steps: values.steps,
              filename: filename
            }
          }
        ])
        .select();
        
      if (assetError) {
        throw new Error(`Failed to create asset record: ${assetError.message}`);
      }
      
      console.log("Asset created:", assetData);
      
      // Link asset to session
      if (assetData && assetData.length > 0) {
        console.log("Linking asset to session");
        const { error: sessionLinkError } = await supabase
          .from('session_assets')
          .insert([
            {
              session_id: sessionId,
              asset_id: assetData[0].id
            }
          ]);
          
        if (sessionLinkError) {
          console.error("Failed to link asset to session:", sessionLinkError);
        }
      }
      
      // Update session status
      console.log("Updating session status to completed");
      const { error: sessionUpdateError } = await supabase
        .from('generation_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);
        
      if (sessionUpdateError) {
        console.error("Failed to update session status:", sessionUpdateError);
      }
      
      setStatus({ 
        message: 'Generation completed successfully! You can view the result on the Assets page.', 
        error: false 
      });
      
    } catch (error) {
      console.error("Error processing generated image:", error);
      setStatus({ 
        message: `Error processing generation results: ${error.message}`, 
        error: true 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Clear any existing file object URLs when component unmounts
  useEffect(() => {
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
      
      <TroubleshootingSection>
        <h3>Troubleshooting</h3>
        <Button 
          type="button"
          className="secondary"
          onClick={async () => {
            setStatus({ message: 'Testing connection...', error: false });
            try {
              console.log("Testing connection to ComfyUI...");
              console.log("ComfyService API URL:", API_BASE_URL);
              
              // Test connection using our improved method
              const result = await ComfyService.testConnection();
              console.log("Test connection result:", result);
              
              if (result && result.success) {
                setStatus({ message: 'Connection test successful! ComfyUI is reachable.', error: false });
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
        >
          Test ComfyUI Connection
        </Button>
        
        <Button
          type="button"
          className="secondary"
          onClick={() => setShowTroubleshooter(!showTroubleshooter)}
          style={{ marginLeft: '10px' }}
        >
          {showTroubleshooter ? 'Hide Troubleshooter' : 'Show Advanced Troubleshooter'}
        </Button>
      </TroubleshootingSection>
      
      {showTroubleshooter && <ComfyUITroubleshooter />}
      
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
  background-color: ${props => props.className === 'secondary' ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${props => props.className === 'secondary' ? '#5a6268' : '#0069d9'};
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

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

const StatusMessage = styled.div`
  padding: 12px;
  margin-top: 16px;
  border-radius: 4px;
  background-color: ${props => props.error ? '#ffebee' : '#e8f5e9'};
  color: ${props => props.error ? '#c62828' : '#2e7d32'};
  display: ${props => props.visible ? 'block' : 'none'};
`;

export default FluxGenerationForm;