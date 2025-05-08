// src/components/GenerationForm.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ComfyService from '../services/comfyService';
import SupabaseService from '../services/supabaseService';
import { supabase } from '../lib/supabaseClient';

const FormContainer = styled.div`
  background-color: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 600px;
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

const TraitSelectionContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
`;

const TraitCheckbox = styled.div`
  display: flex;
  align-items: center;
  background-color: ${props => props.selected ? '#e6f3ff' : '#f5f5f5'};
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid ${props => props.selected ? '#b3d9ff' : '#e0e0e0'};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.selected ? '#d1e7ff' : '#e9e9e9'};
  }

  input {
    margin-right: 6px;
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

const GenerationForm = () => {
  const [prompt, setPrompt] = useState('');
  const [traits, setTraits] = useState([]);
  const [selectedTraits, setSelectedTraits] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState({ message: '', error: false });

  useEffect(() => {
    const loadTraits = async () => {
      try {
        const traitsData = await SupabaseService.getTraits();
        setTraits(traitsData);
      } catch (error) {
        console.error('Error loading traits:', error);
        setStatus({
          message: 'Failed to load traits. Please try again.',
          error: true
        });
      }
    };

    loadTraits();
  }, []);

  const handleTraitToggle = (trait) => {
    setSelectedTraits(prevTraits => {
      const isSelected = prevTraits.some(t => t.id === trait.id);
      if (isSelected) {
        return prevTraits.filter(t => t.id !== trait.id);
      } else {
        return [...prevTraits, trait];
      }
    });
  };

  // In src/components/GenerationForm.jsx, update the handleSubmit function:
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatus({ message: '', error: false });
  
    try {
      // Create a session first
      console.log("Creating generation session...");
      const session = await SupabaseService.createSession({
        prompt,
        traits: selectedTraits.map(t => t.id),
        source: 'web-ui'
      });
      console.log("Session created:", session);
  
      // Create and queue the workflow
      setStatus({ message: 'Creating workflow...', error: false });
      console.log("Creating workflow with prompt:", prompt, "and traits:", selectedTraits);
      const workflow = ComfyService.createVehicleWorkflow(prompt, selectedTraits);
      console.log("Workflow created:", workflow);
      
      // Queue the prompt in ComfyUI
      setStatus({ message: 'Queuing generation...', error: false });
      console.log("Submitting workflow to ComfyUI...");
      const promptResponse = await ComfyService.queuePrompt(workflow);
      console.log("ComfyUI response:", promptResponse);
      
      // Poll for completion
      setStatus({ message: 'Generation in progress...', error: false });
      
      // Wait for the generation to complete and get output
      // In a real app, you'd use WebSockets - we'll poll for simplicity
      // Replace the checkCompletion function with this improved version
      const checkCompletion = async () => {
        try {
          console.log("Checking generation status for prompt ID:", promptResponse.prompt_id);
          
          // Get the current status of the generation
          const result = await ComfyService.getOutput(promptResponse.prompt_id);
          console.log("ComfyUI status check result:", result);
          
          // Look for output images in the result
          let outputImage = null;
          let isComplete = false;
          
          // Check if the generation is complete by looking for output in node 9 (SaveImage)
          if (result && result.output && result.output["9"] && result.output["9"].length > 0) {
            outputImage = result.output["9"][0];
            isComplete = true;
            console.log("Found output image:", outputImage);
          }
          
          if (isComplete && outputImage) {
            console.log("Generation complete, processing output...");
            
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
            const storagePath = `generated-images/${session.id}/${filename}`;
            console.log("Uploading to Supabase storage:", storagePath);
            
            // Make sure the bucket exists
            try {
              // Check if the bucket exists first
              const { data: buckets } = await supabase.storage.listBuckets();
              const bucketExists = buckets.some(b => b.name === 'generated-images');
              
              if (!bucketExists) {
                console.log("Creating storage bucket 'generated-images'");
                await supabase.storage.createBucket('generated-images', {
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
              .from('generated-images')
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
                  storage_path: storagePath,
                  parent_asset_id: null, // This is an original generation
                  status: 'complete',
                  metadata: {
                    prompt: prompt,
                    model: workflow[4].inputs.ckpt_name,
                    seed: workflow[3].inputs.seed,
                    width: workflow[5].inputs.width,
                    height: workflow[5].inputs.height
                  }
                }
              ])
              .select()
              .single();
              
            if (assetError) {
              throw new Error(`Failed to create asset record: ${assetError.message}`);
            }
            
            // Link asset to traits if any were selected
            if (selectedTraits.length > 0) {
              const traitLinks = selectedTraits.map(trait => ({
                asset_id: assetData.id,
                trait_id: trait.id
              }));
              
              const { error: traitError } = await supabase
                .from('asset_traits')
                .insert(traitLinks);
                
              if (traitError) {
                console.error("Failed to link traits:", traitError);
              }
            }
            
            // Link asset to session
            console.log("Linking asset to session");
            const { error: sessionLinkError } = await supabase
              .from('session_assets')
              .insert([
                {
                  session_id: session.id,
                  asset_id: assetData.id
                }
              ]);
              
            if (sessionLinkError) {
              console.error("Failed to link asset to session:", sessionLinkError);
            }
            
            // Update session status
            console.log("Updating session status to completed");
            const { error: sessionUpdateError } = await supabase
              .from('generation_sessions')
              .update({ status: 'completed' })
              .eq('id', session.id);
              
            if (sessionUpdateError) {
              console.error("Failed to update session status:", sessionUpdateError);
            }
            
            setStatus({ 
              message: 'Generation completed! Check the assets page to see results.', 
              error: false 
            });
            setIsGenerating(false);
            return;
          }
          
          // If we reach here, the generation is not complete yet
          console.log("Generation not yet complete, polling again in 2 seconds...");
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
      console.error('Error details:', error.response?.data || error.message);
      setStatus({ 
        message: `Error generating asset: ${error.message}. Check console for details.`, 
        error: true 
      });
      setIsGenerating(false);
    }
  };

  return (
    <FormContainer>
      <h2>Generate New Vehicle</h2>
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="prompt">Base Description</Label>
          <TextArea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the vehicle (e.g., post-apocalyptic car with large wheels)"
            required
          />
        </FormGroup>

        <FormGroup>
          <Label>Vehicle Traits</Label>
          <TraitSelectionContainer>
            {traits.map(trait => (
              <TraitCheckbox 
                key={trait.id}
                selected={selectedTraits.some(t => t.id === trait.id)}
                onClick={() => handleTraitToggle(trait)}
              >
                <input 
                  type="checkbox"
                  checked={selectedTraits.some(t => t.id === trait.id)}
                  onChange={() => {}}
                />
                {trait.trait_type}: {trait.trait_value}
              </TraitCheckbox>
            ))}
          </TraitSelectionContainer>
        </FormGroup>

        <Button type="submit" disabled={isGenerating || !prompt}>
          {isGenerating ? 'Generating...' : 'Generate Vehicle'}
        </Button>
      </Form>

      <StatusMessage visible={status.message} error={status.error}>
        {status.message}
      </StatusMessage>
    </FormContainer>
  );
};

export default GenerationForm;