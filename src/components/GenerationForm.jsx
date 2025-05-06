// src/components/GenerationForm.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ComfyService from '../services/comfyService';
import SupabaseService from '../services/supabaseService';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatus({ message: '', error: false });

    try {
      // Create a session first
      const session = await SupabaseService.createSession({
        prompt,
        traits: selectedTraits.map(t => t.id),
        source: 'web-ui'
      });

      // Create and queue the workflow
      setStatus({ message: 'Creating workflow...', error: false });
      const workflow = ComfyService.createVehicleWorkflow(prompt, selectedTraits);
      
      // Queue the prompt in ComfyUI
      setStatus({ message: 'Queuing generation...', error: false });
      const promptResponse = await ComfyService.queuePrompt(workflow);
      
      // Poll for completion
      setStatus({ message: 'Generation in progress...', error: false });
      
      // In a real app, you'd implement polling or WebSocket connection
      // For simplicity, we'll just wait a few seconds
      setTimeout(() => {
        setStatus({ 
          message: 'Generation completed! Check the assets page to see results.', 
          error: false 
        });
        setIsGenerating(false);
      }, 5000);
      
    } catch (error) {
      console.error('Error generating asset:', error);
      setStatus({ 
        message: 'Error generating asset. Please try again.', 
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