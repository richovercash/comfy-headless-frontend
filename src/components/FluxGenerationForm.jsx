// src/components/FluxGenerationForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import ComfyService from '../services/comfyService';
import SupabaseService from '../services/supabaseService';
import { supabase } from "../services/supabaseService";
import ComfyUITroubleshooter from './ComfyUITroubleshooter';

export const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';

const FluxGenerationForm = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    prompt: 'post-apocalyptic vehicle, rusted, armored, damaged, desert setting, dramatic lighting',
    negativePrompt: 'low quality, bad anatomy, blurry, pixelated, distorted, deformed',
    steps: 28,
    inputImage: null,
    reduxImage: null,
    filenamePrefix: 'Otherides-2d',
    useAdvancedMode: false
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState({ message: '', error: false });
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const [generationTimestamp, setGenerationTimestamp] = useState(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [createdAsset, setCreatedAsset] = useState(null);

  const handleChange = (key, value) => {
    setValues(prev => ({...prev, [key]: value}));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatus({ message: 'Starting generation...', error: false });
    setPollingAttempts(0);
    setCreatedAsset(null);

    try {
      // Create a session for tracking
      const session = await SupabaseService.createSession({
        prompt: values.prompt,
        negativePrompt: values.negativePrompt,
        steps: values.steps,
        filenamePrefix: values.filenamePrefix,
        source: values.useAdvancedMode ? 'flux-advanced' : 'flux-basic',
        useAdvancedMode: values.useAdvancedMode,
        timestamp: Date.now()
      });
      
      console.log("Session created:", session);
      setSessionId(session.id);
      
      // Upload images if they exist
      let inputImageUrl = null;
      let reduxImageUrl = null;
      
      if (values.inputImage) {
        setStatus({ message: 'Uploading input image...', error: false });
        inputImageUrl = await uploadFileAndGetPublicUrl(values.inputImage, 'input-images');
      }
      
      if (values.reduxImage) {
        setStatus({ message: 'Uploading redux image...', error: false });
        reduxImageUrl = await uploadFileAndGetPublicUrl(values.reduxImage, 'redux-images');
      }
      
      // Create the workflow
      setStatus({ message: 'Creating workflow...', error: false });
      
      // Choose between simple or advanced workflow
      const result = values.useAdvancedMode && inputImageUrl
        ? ComfyService.createAdvancedFluxWorkflow({
            prompt: values.prompt,
            negativePrompt: values.negativePrompt,
            steps: values.steps,
            inputImageUrl: inputImageUrl,
            reduxImageUrl: reduxImageUrl,
            filenamePrefix: values.filenamePrefix
          })
        : ComfyService.createFluxWorkflow({
            prompt: values.prompt,
            negativePrompt: values.negativePrompt,
            steps: values.steps,
            inputImageUrl: inputImageUrl,
            reduxImageUrl: reduxImageUrl,
            filenamePrefix: values.filenamePrefix
          });
      
      const { workflow, timestamp } = result;
      
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

  // Helper function to upload a file to Supabase and generate a public URL
  const uploadFileAndGetPublicUrl = async (file, bucket) => {
    try {
      // Generate a unique filename
      const timestamp = Date.now();
      const safeFilename = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filename = `${timestamp}-${safeFilename}`;
      
      // First, ensure the bucket exists and is configured for public access
      await SupabaseService.ensureBucketExists(bucket, true);
      
      // Upload the file to Supabase
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from(bucket)
        .upload(filename, file, {
          upsert: true,
          cacheControl: '3600'
        });
        
      if (uploadError) {
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }
      
      console.log("File uploaded successfully:", filename);
      
      // Get the public URL
      const { data: publicUrlData } = supabase
        .storage
        .from(bucket)
        .getPublicUrl(filename);
      
      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error("Failed to get public URL for uploaded file");
      }
      
      console.log("Public URL generated:", publicUrlData.publicUrl);
      
      return publicUrlData.publicUrl;
      
    } catch (error) {
      console.error("Error in uploadFileAndGetPublicUrl:", error);
      throw error;
    }
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
      
      // Create a file object from the blob
      const imageFile = new File([imageBlob], filename, { type: imageBlob.type });
      
      // Upload to Supabase storage
      const bucketName = 'images-2d';
      const storagePath = `${sessionId}/${filename}`;
      
      // Make sure the bucket exists
      await SupabaseService.ensureBucketExists(bucketName);
      
      // Use uploadFile from SupabaseService for better error handling
      await SupabaseService.uploadFile(bucketName, storagePath, imageFile);
      
      // Create asset record in database
      console.log("Creating asset record in database");
      
      const assetData = {
        asset_type: 'image_2d',
        storage_path: `${bucketName}/${storagePath}`,
        parent_asset_id: null, // This is an original generation
        status: 'complete',
        metadata: {
          prompt: values.prompt,
          negativePrompt: values.negativePrompt,
          steps: values.steps,
          advanced_mode: values.useAdvancedMode,
          filename: filename,
          timestamp: Date.now()
        }
      };
      
      // Create the asset record
      const asset = await SupabaseService.createAsset(assetData);
      
      console.log("Asset created:", asset);
      setCreatedAsset(asset);
      
      // Link asset to session
      await SupabaseService.linkAssetToSession(sessionId, asset.id);
      
      // Update session status
      await SupabaseService.updateSessionStatus(sessionId, 'completed');
      
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
      <h2>Generate Vehicle with Flux Workflow</h2>
      
      <FormInfo>
        <InfoIcon>ℹ️</InfoIcon>
        <InfoText>
          This tool uses the Flux workflow in ComfyUI to generate post-apocalyptic vehicle images. 
          Enter a prompt, adjust the settings, and optionally provide input images for more controlled results.
          The advanced mode uses depth conditioning for more structured vehicle generation.
        </InfoText>
      </FormInfo>
      
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label>Prompt</Label>
          <TextArea
            value={values.prompt}
            onChange={(e) => handleChange('prompt', e.target.value)}
            placeholder="Enter your prompt"
            rows={4}
          />
          <SmallHelp>Try keywords like: armored, rusted, desert, weaponized, mutant, cyberpunk</SmallHelp>
        </FormGroup>
        
        <FormGroup>
          <Label>Negative Prompt</Label>
          <TextArea
            value={values.negativePrompt}
            onChange={(e) => handleChange('negativePrompt', e.target.value)}
            placeholder="Enter negative prompt"
            rows={2}
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
          <SmallHelp>Higher values give better quality but take longer. Try 20-40 for good results.</SmallHelp>
        </FormGroup>
        
        <FormGroup>
          <Label>Advanced Mode</Label>
          <CheckboxContainer>
            <Checkbox
              type="checkbox"
              checked={values.useAdvancedMode}
              onChange={(e) => handleChange('useAdvancedMode', e.target.checked)}
              id="advancedMode"
            />
            <CheckboxLabel htmlFor="advancedMode">
              Use depth conditioning for better structure
            </CheckboxLabel>
          </CheckboxContainer>
          <SmallHelp>
            Advanced mode works best with an input image. It uses depth estimation to create more structured vehicles.
          </SmallHelp>
        </FormGroup>
        
        <FormGroup>
          <Label>Input Image {values.useAdvancedMode ? '(Recommended for Advanced Mode)' : '(Optional)'}</Label>
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
              <small>This image will influence the structure of the generated vehicle</small>
            </PreviewContainer>
          )}
        </FormGroup>

        <FormGroup>
          <Label>Redux Reference Image (Optional)</Label>
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
              <small>This image will influence the style of the generation</small>
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
          {isGenerating ? 'Generating...' : 'Generate Vehicle'}
        </Button>
      </Form>
      
      {createdAsset && (
        <SuccessContainer>
          <h3>Generation Successful!</h3>
          <p>Your vehicle has been generated and saved to the asset library.</p>
          <ButtonGroup>
            <Button onClick={() => navigate('/assets')}>View All Assets</Button>
            <Button onClick={() => navigate(`/assets/${createdAsset.id}`)} className="secondary">View This Asset</Button>
          </ButtonGroup>
        </SuccessContainer>
      )}
      
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
  
  small {
    display: block;
    margin-top: 8px;
    color: #666;
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

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 12px;
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

const FormInfo = styled.div`
  display: flex;
  align-items: flex-start;
  margin-bottom: 20px;
  padding: 10px 15px;
  background-color: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 4px;
`;

const InfoIcon = styled.span`
  font-size: 1.2rem;
  margin-right: 10px;
  margin-top: 2px;
`;

const InfoText = styled.p`
  margin: 0;
  color: #0d47a1;
  font-size: 0.9rem;
  line-height: 1.4;
`;

const SmallHelp = styled.small`
  color: #6c757d;
  font-size: 0.8rem;
  margin-top: 4px;
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
`;

const Checkbox = styled.input`
  margin-right: 8px;
`;

const CheckboxLabel = styled.label`
  font-weight: normal;
`;

const SuccessContainer = styled.div`
  margin-top: 20px;
  padding: 16px;
  background-color: #e8f5e9;
  border: 1px solid #c8e6c9;
  border-radius: 8px;
  text-align: center;
  
  h3 {
    color: #2e7d32;
    margin-top: 0;
  }
  
  p {
    margin-bottom: 16px;
  }
`;

export default FluxGenerationForm;