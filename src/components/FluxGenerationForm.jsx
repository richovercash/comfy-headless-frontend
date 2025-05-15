// src/components/FluxGenerationForm.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ComfyService from '../services/comfyService';
import SupabaseService from '../services/supabaseService';
import { supabase } from "../services/supabaseService";
import ComfyUITroubleshooter from './ComfyUITroubleshooter';
import Base64Service from '../services/base64Service';

import loraService from '../services/loraService';
import LoraSelector from './LoraSelector';


export const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';

const FluxGenerationForm = () => {
  const [values, setValues] = useState({
    prompt: 'neon-mist, cpstyle, rock!, Gatling_mounted, madocalypse',
    negativePrompt: 'low quality, bad anatomy, blurry, pixelated, distorted, deformed',
    steps: 28,
    inputImage: null,
    reduxImage: null,
    reduxStrength: 0.5, // Default Redux influence strength
    filenamePrefix: 'Otherides-2d',
    useDepth: true, // Whether to use depth processing
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState({ message: '', error: false });
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const [generationTimestamp, setGenerationTimestamp] = useState(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [useAdvancedWorkflow, setUseAdvancedWorkflow] = useState(false);
  const [selectedLoras, setSelectedLoras] = useState([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  

  const handleChange = (key, value) => {
    setValues(prev => ({...prev, [key]: value}));
  };



  

  // Session Management Fix for FluxGenerationForm.jsx

  // 1. First, let's make sure the session creation is working correctly
  const createSessionRecord = async () => {
    console.log("Creating session record with parameters:", {
      prompt: values.prompt,
      negativePrompt: values.negativePrompt,
      steps: values.steps,
      filenamePrefix: values.filenamePrefix,
      reduxStrength: values.reduxImage ? values.reduxStrength : null,
      useDepth: values.useDepth,
      source: 'flux-workflow',
      workflowType: useAdvancedWorkflow ? 'advanced' : 'simple'
    });
    
    try {
      // Insert the session record
      const { data, error } = await supabase
        .from('generation_sessions')
        .insert([
          {
            status: 'initiated',
            parameters: {
              prompt: values.prompt,
              negativePrompt: values.negativePrompt,
              steps: values.steps, 
              filenamePrefix: values.filenamePrefix,
              reduxStrength: values.reduxImage ? values.reduxStrength : null,
              useDepth: values.useDepth,
              source: 'flux-workflow',
              workflowType: useAdvancedWorkflow ? 'advanced' : 'simple'
            }
          }
        ])
        .select();
      
      if (error) {
        console.error("Error creating session:", error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        throw new Error("No session data returned after insert");
      }
      
      console.log("Session created successfully:", data[0]);
      return data[0];
    } catch (error) {
      console.error("Failed to create session:", error);
      throw error;
    }
  };

  // 2. Now, let's update the handleSubmit function to ensure session creation and updating works
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatus({ message: 'Starting generation...', error: false });
    setPollingAttempts(0);
    
    let sessionRecord = null;
    
    try {
      // Create a new session record
      sessionRecord = await createSessionRecord();
      console.log("Session created with ID:", sessionRecord.id);
      setSessionId(sessionRecord.id);
      
      // Update session status to in_progress
      const { error: updateError } = await supabase
        .from('generation_sessions')
        .update({ status: 'in_progress' })
        .eq('id', sessionRecord.id);
        
      if (updateError) {
        console.error("Error updating session to in_progress:", updateError);
      } else {
        console.log("Session updated to in_progress");
      }
      
      // Upload images to Supabase for storage as before
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
      
      // Create workflow
      setStatus({ message: 'Creating workflow...', error: false });
      
      // Choose workflow type based on settings
      let workflowResult;
      
      if (useAdvancedWorkflow) {
        workflowResult = ComfyService.createFluxAdvancedWorkflow({
          prompt: values.prompt,
          steps: values.steps,
          reduxStrength: values.reduxStrength,
          useDepth: values.useDepth,
          filenamePrefix: values.filenamePrefix,
          loras: selectedLoras // This is the new line to add
        });
      } else {
        workflowResult = ComfyService.createFluxWorkflow({
          prompt: values.prompt,
          steps: values.steps,
          filenamePrefix: values.filenamePrefix,
          loras: selectedLoras // This is the new line to add
        });
      }
      
      // Save timestamp for later
      const timestamp = workflowResult.timestamp;
      setGenerationTimestamp(timestamp);
      
      // Convert workflow to use base64 images
      setStatus({ message: 'Processing images...', error: false });
      
      // Prepare image map for base64 conversion
      const imageMap = {};
      if (values.inputImage) {
        imageMap["85"] = values.inputImage;
      }
      if (values.reduxImage) {
        imageMap["94"] = values.reduxImage;
      }
      
      // Convert workflow to use base64
      const base64Workflow = await Base64Service.convertWorkflowToBase64(
        workflowResult.workflow,
        imageMap
      );
      
      // Queue in ComfyUI
      setStatus({ message: 'Queueing workflow...', error: false });
      const response = await ComfyService.queuePrompt(base64Workflow);
      
      setStatus({ 
        message: 'Generation in progress! Waiting for results...', 
        error: false 
      });
      
      // Begin polling for completion
      setTimeout(() => checkCompletion(response.prompt_id, timestamp, sessionRecord.id), 2000);
      
    } catch (error) {
      console.error('Error generating asset:', error);
      
      // Update session status to failed if we have a session record
      if (sessionRecord && sessionRecord.id) {
        const { error: updateError } = await supabase
          .from('generation_sessions')
          .update({ 
            status: 'failed', 
            parameters: {
              ...sessionRecord.parameters,
              error: error.message
            }
          })
          .eq('id', sessionRecord.id);
          
        if (updateError) {
          console.error("Error updating session to failed:", updateError);
        }
      }
      
      setStatus({ 
        message: `Error: ${error.message}`, 
        error: true 
      });
      setIsGenerating(false);
    }
  };

  // 3. Let's fix the checkCompletion function to better handle session updates
  const checkCompletion = async (promptId, timestamp, sessionId) => {
    if (pollingAttempts >= 15) {
      setStatus({ 
        message: 'Generation timed out. You can try manually saving the image.', 
        error: true 
      });
      
      // Update session status to failed
      try {
        const { error: updateError } = await supabase
          .from('generation_sessions')
          .update({ 
            status: 'failed',
            parameters: {
              error: 'Generation timed out'
            } 
          })
          .eq('id', sessionId);
          
        if (updateError) {
          console.error("Error updating session to failed:", updateError);
        } else {
          console.log("Session updated to failed");
        }
      } catch (updateError) {
        console.error("Error updating session status:", updateError);
      }
      
      setIsGenerating(false);
      return;
    }

    setPollingAttempts(prev => prev + 1);
    setStatus({ 
      message: `Generation in progress... (attempt ${pollingAttempts + 1}/15)`, 
      error: false 
    });

    try {
      console.log(`Checking generation for session ${sessionId}, timestamp: ${timestamp}`);
      
      // Extract the parts we know
      const prefix = values.filenamePrefix;
      
      // Check the ComfyUI output directory for matching files
      let isComplete = false;
      let outputFilename = null;
      
      // Try exact match first
      const exactFilename = `${prefix}_${timestamp}_00001_.png`;
      try {
        const testUrl = `${API_BASE_URL}/view?filename=${encodeURIComponent(exactFilename)}`;
        console.log("Testing URL:", testUrl);
        
        const testResponse = await fetch(testUrl, { method: 'HEAD' });
        
        if (testResponse.ok) {
          console.log("✅ FOUND IMAGE:", exactFilename);
          outputFilename = exactFilename;
          isComplete = true;
        }
      } catch (e) {
        console.log("Error checking filename:", exactFilename, e);
      }
      
      // If exact match not found, try other patterns
      if (!isComplete) {
        // Try variations with serial numbers
        const serials = ['00001', '00010', '00000', '00002', '00003'];
        
        for (const serial of serials) {
          const patternFilename = `${prefix}_${timestamp}_${serial}_.png`;
          try {
            const testUrl = `${API_BASE_URL}/view?filename=${encodeURIComponent(patternFilename)}`;
            console.log("Testing URL:", testUrl);
            
            const testResponse = await fetch(testUrl, { method: 'HEAD' });
            
            if (testResponse.ok) {
              console.log("✅ FOUND IMAGE:", patternFilename);
              outputFilename = patternFilename;
              isComplete = true;
              break;
            }
          } catch (e) {
            console.log("Error checking filename:", patternFilename, e);
          }
        }
      }

      if (isComplete && outputFilename) {
        console.log("Found output file, processing image:", outputFilename);
        await processGeneratedImage(outputFilename, sessionId);
      } else {
        // Not found yet, continue polling
        console.log(`No matching files found, will try again in 2 seconds...`);
        setTimeout(() => checkCompletion(promptId, timestamp, sessionId), 2000);
      }
    } catch (error) {
      console.error("Error in checkCompletion:", error);
      
      // Update session status to failed
      try {
        const { error: updateError } = await supabase
          .from('generation_sessions')
          .update({ 
            status: 'failed',
            parameters: {
              error: error.message
            } 
          })
          .eq('id', sessionId);
          
        if (updateError) {
          console.error("Error updating session to failed:", updateError);
        } else {
          console.log("Session updated to failed");
        }
      } catch (updateError) {
        console.error("Error updating session status:", updateError);
      }
      
      setStatus({ 
        message: `Error checking generation status: ${error.message}`, 
        error: true 
      });
      setIsGenerating(false);
    }
  };

  // 4. Finally, let's fix the processGeneratedImage function to properly update the session
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
      console.log(`Image blob size: ${imageBlob.size} bytes`);
      
      // Upload to Supabase storage
      const storagePath = `${sessionId}/${filename}`;
      console.log("Uploading to Supabase storage:", storagePath);
      
      // Ensure bucket exists
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
      }
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('images-2d')
        .upload(storagePath, imageBlob);
        
      if (uploadError) {
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }
      
      console.log("Upload successful:", uploadData);
      
      // Create asset record in database
      console.log("Creating asset record in database");
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .insert([
          {
            asset_type: 'image_2d',
            storage_path: `images-2d/${storagePath}`,
            parent_asset_id: null,
            status: 'complete',
            metadata: {
              prompt: values.prompt,
              negativePrompt: values.negativePrompt,
              steps: values.steps,
              reduxStrength: values.reduxImage ? values.reduxStrength : null,
              useDepth: values.useDepth,
              workflowType: useAdvancedWorkflow ? 'advanced' : 'simple',
              filename: filename
            },
            lora_settings: selectedLoras.length > 0 ? {
            count: selectedLoras.length,
            names: selectedLoras.map(l => l.name || 'Unnamed LoRA'),
            settings: selectedLoras.map(l => ({
              name: l.name,
              strength: l.strength,
              model_strength: l.model_strength,
              clip_strength: l.clip_strength,
              activation_words: l.activation_words,
              order: l.lora_order
            }))
          } : null
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
        // Save LoRA associations if any were used
        if (selectedLoras.length > 0 && assetData[0].id) {
          try {
            console.log("Saving LoRA associations for asset");
            await loraService.saveAssetLoras(assetData[0].id, selectedLoras);
          } catch (loraError) {
            console.error("Failed to save LoRA associations:", loraError);
          }
        }
          
        if (sessionLinkError) {
          console.error("Failed to link asset to session:", sessionLinkError);
        } else {
          console.log("Asset linked to session successfully");
        }
      }
      
      // Update session status to completed
      console.log("Updating session status to completed");
      const { error: sessionUpdateError } = await supabase
        .from('generation_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);
        
      if (sessionUpdateError) {
        console.error("Failed to update session status:", sessionUpdateError);
      } else {
        console.log("Session updated to completed successfully");
      }
      
      setStatus({ 
        message: 'Generation completed successfully! You can view the result on the Assets page.', 
        error: false 
      });
      
    } catch (error) {
      console.error("Error processing generated image:", error);
      
      // Update session status to failed
      try {
        const { error: updateError } = await supabase
          .from('generation_sessions')
          .update({ 
            status: 'failed',
            parameters: {
              error: error.message
            } 
          })
          .eq('id', sessionId);
          
        if (updateError) {
          console.error("Error updating session to failed:", updateError);
        } else {
          console.log("Session updated to failed");
        }
      } catch (updateError) {
        console.error("Error updating session status:", updateError);
      }
      
      setStatus({ 
        message: `Error processing generation results: ${error.message}`, 
        error: true 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // 5. Optional: Add a function to manually finalize the most recent session
  const finalizeLastSession = async () => {
    try {
      setStatus({ message: 'Looking up the most recent session...', error: false });
      
      // Get the most recent initiated session
      const { data: sessions, error: sessionsError } = await supabase
        .from('generation_sessions')
        .select('*')
        .eq('status', 'initiated')
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (sessionsError) {
        throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
      }
      
      if (!sessions || sessions.length === 0) {
        setStatus({ message: 'No initiated sessions found.', error: true });
        return;
      }
      
      const sessionId = sessions[0].id;
      console.log("Found session to finalize:", sessionId);
      
      // Prompt for the filename
      const filename = prompt(
        "Please enter the filename of the generated image (check ComfyUI output folder):",
        `${values.filenamePrefix}_00001_.png`
      );
      
      if (!filename) {
        setStatus({ message: 'Operation cancelled.', error: true });
        return;
      }
      
      // Process the image
      await processGeneratedImage(filename, sessionId);
      
    } catch (error) {
      console.error("Error finalizing session:", error);
      setStatus({ 
        message: `Error finalizing session: ${error.message}`, 
        error: true 
      });
    }
  };


    const uploadFile = async (file, bucket) => {
    // Generate a unique filename
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const filename = `${timestamp}-${safeFilename}`;
    
    // Ensure the bucket exists
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets.some(b => b.name === bucket);
      
      if (!bucketExists) {
        console.log(`Creating storage bucket '${bucket}'`);
        await supabase.storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 10485760 // 10MB
        });
      }
    } catch (error) {
      console.error("Error ensuring bucket exists:", error);
      // Continue anyway, in case the error is just with checking
    }
    
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
    
    // Return the storage path (bucket/filename)
    return `${bucket}/${filename}`;
  };

  const handleLorasChange = (loras) => {
    setSelectedLoras(loras);
  };

  return (
    <FormContainer>
      <h2>Generate with Flux Workflow</h2>
      
      <FormInfo>
        <InfoIcon>ℹ️</InfoIcon>
        <InfoText>
          This form allows you to generate images with the Flux model. Simply enter a prompt, 
          adjust the steps as needed, and optionally provide input images. 
          The advanced mode supports Redux image styling and depth conditioning for more structured results.
        </InfoText>
      </FormInfo>
      
      <WorkflowSelector>
        <WorkflowOption 
          active={!useAdvancedWorkflow} 
          onClick={() => setUseAdvancedWorkflow(false)}
        >
          Simple Mode
        </WorkflowOption>
        <WorkflowOption 
          active={useAdvancedWorkflow} 
          onClick={() => setUseAdvancedWorkflow(true)}
        >
          Advanced Mode
        </WorkflowOption>
      </WorkflowSelector>
      
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
          <Label>Input Image (Optional)</Label>
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
              {useAdvancedWorkflow && (
                <FormCheck>
                  <input
                    type="checkbox"
                    id="useDepth"
                    checked={values.useDepth}
                    onChange={(e) => handleChange('useDepth', e.target.checked)}
                  />
                  <label htmlFor="useDepth">Use depth conditioning</label>
                </FormCheck>
              )}
              <small>This image provides structure and layout guidance</small>
            </PreviewContainer>
          )}
        </FormGroup>

        {useAdvancedWorkflow && (
          <>
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
                  <SliderContainer>
                    <SliderLabel>Redux Influence: {values.reduxStrength.toFixed(2)}</SliderLabel>
                    <Slider 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={values.reduxStrength}
                      onChange={(e) => handleChange('reduxStrength', parseFloat(e.target.value))}
                    />
                    <SliderMarkers>
                      <span>Subtle</span>
                      <span>Strong</span>
                    </SliderMarkers>
                  </SliderContainer>
                  <small>This image influences the style and aesthetic of the generation</small>
                </PreviewContainer>
              )}
            </FormGroup>
          </>
        )}


        <ToggleContainer>
          <ToggleButton 
            type="button"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          >
            {showAdvancedOptions ? 'Hide Advanced Options' : 'Show Advanced Options'}
          </ToggleButton>
        </ToggleContainer>

        {showAdvancedOptions && (
          <AdvancedOptions>
            <h3>Advanced Options</h3>
            <LoraSelector onLorasChange={handleLorasChange} disabled={isGenerating} />
          </AdvancedOptions>
        )}

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
        <Button 
          type="button"
          className="secondary"
          onClick={async () => {
            setStatus({ message: 'Testing EasyLoraStack integration...', error: false });
            
            try {
              const result = await loraService.testEasyLoraStackIntegration();
              console.log("EasyLoraStack integration test result:", result);
              
              if (result.success) {
                setStatus({ 
                  message: `Success! Found ${result.lorasFound} LoRAs and created workflow with ${result.lorasUsed} LoRAs.`, 
                  error: false 
                });
              } else {
                setStatus({ 
                  message: `Integration test failed: ${result.error || 'Unknown error'}`, 
                  error: true 
                });
              }
            } catch (error) {
              console.error("Error testing integration:", error);
              setStatus({ 
                message: `Error: ${error.message}`, 
                error: true 
              });
            }
          }}
        >
          Test EasyLoraStack Integration
        </Button>

        <Button 
          type="button"
          className="secondary"
          onClick={async () => {
            setStatus({ message: 'Debugging ComfyUI Object Info...', error: false });
            
            try {
              const result = await loraService.debugObjectInfo();
              console.log("Object Info Debug Result:", result);
              
              setStatus({ 
                message: `Debug complete. Check console for details.`, 
                error: false 
              });
            } catch (error) {
              console.error("Error debugging object info:", error);
              setStatus({ 
                message: `Error: ${error.message}`, 
                error: true 
              });
            }
          }}
        >
          Debug ComfyUI API
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

const WorkflowSelector = styled.div`
  display: flex;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 20px;
`;

const WorkflowOption = styled.div`
  flex: 1;
  padding: 10px 15px;
  text-align: center;
  background-color: ${props => props.active ? '#007bff' : '#f5f5f5'};
  color: ${props => props.active ? 'white' : '#333'};
  cursor: pointer;
  transition: all 0.2s ease;
  border-right: 1px solid #ddd;
  
  &:last-child {
    border-right: none;
  }
  
  &:hover {
    background-color: ${props => props.active ? '#0069d9' : '#e9e9e9'};
  }
`;

const SliderContainer = styled.div`
  margin: 15px 0;
  padding: 10px;
  border-radius: 4px;
  background-color: white;
`;

const SliderLabel = styled.div`
  margin-bottom: 8px;
  font-weight: bold;
  color: #555;
`;

const Slider = styled.input`
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  outline: none;
  border-radius: 4px;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: #007bff;
    border-radius: 50%;
    cursor: pointer;
  }
  
  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #007bff;
    border-radius: 50%;
    cursor: pointer;
  }
`;

const SliderMarkers = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  font-size: 0.8rem;
  color: #666;
`;

const FormCheck = styled.div`
  display: flex;
  align-items: center;
  margin: 10px 0;
  
  input {
    margin-right: 8px;
  }
  
  label {
    font-size: 0.9rem;
  }
`;
const ToggleContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
`;

const ToggleButton = styled.button`
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 0.9rem;
  cursor: pointer;
  
  &:hover {
    background-color: #5a6268;
  }
`;

const AdvancedOptions = styled.div`
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
  
  h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
  }
`;

export default FluxGenerationForm;