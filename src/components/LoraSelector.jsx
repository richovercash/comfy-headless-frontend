// src/components/LoraSelector.jsx (Simplified version)
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import loraService from '../services/loraService';

const LoraSelector = ({ 
  onLorasChange, 
  initialLoras = [], 
  maxLoras = 10,
  disabled = false 
}) => {
  const [availableLoras, setAvailableLoras] = useState([]);
  const [selectedLoras, setSelectedLoras] = useState(initialLoras.length > 0 ? initialLoras : []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch available LoRAs on component mount
  useEffect(() => {
    const fetchLoras = async () => {
      try {
        setIsLoading(true);
        const loras = await loraService.getAllLoras();
        setAvailableLoras(loras);
        setError(null);
      } catch (err) {
        console.error('Error fetching LoRAs:', err);
        setError('Failed to fetch available LoRAs. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLoras();
  }, []);

  // Update parent component when selected LoRAs change
  useEffect(() => {
    if (onLorasChange) {
      onLorasChange(selectedLoras);
    }
  }, [selectedLoras, onLorasChange]);

  // Handle adding a new LoRA
  const handleAddLora = () => {
    if (selectedLoras.length >= maxLoras) {
      alert(`Maximum ${maxLoras} LoRAs allowed`);
      return;
    }

    // Add a new empty LoRA entry
    setSelectedLoras([
      ...selectedLoras,
      {
        id: null,
        name: '',
        file_path: 'None',
        model_strength: 1.0,
        activation_words: '',
        lora_order: selectedLoras.length + 1
      }
    ]);
  };

  // Handle removing a LoRA
  const handleRemoveLora = (index) => {
    const newLoras = [...selectedLoras];
    newLoras.splice(index, 1);
    
    // Update ordering
    const reordered = newLoras.map((lora, idx) => ({
      ...lora,
      lora_order: idx + 1
    }));
    
    setSelectedLoras(reordered);
  };

  // Handle updating a LoRA's settings
  const handleLoraChange = (index, field, value) => {
    const newLoras = [...selectedLoras];
    
    if (field === 'lora_id' && value) {
      // When a LoRA is selected from dropdown, populate its details
      const selectedLora = availableLoras.find(lora => lora.id === value);
      if (selectedLora) {
        newLoras[index] = {
          ...newLoras[index],
          id: selectedLora.id,
          name: selectedLora.name,
          file_path: selectedLora.file_path,
          activation_words: selectedLora.activation_words || ''
        };
      }
    } else {
      // For other field updates
      newLoras[index] = {
        ...newLoras[index],
        [field]: value
      };
    }
    
    setSelectedLoras(newLoras);
  };

  // Move a LoRA up in the stack
  const handleMoveUp = (index) => {
    if (index === 0) return;
    
    const newLoras = [...selectedLoras];
    const temp = newLoras[index];
    newLoras[index] = newLoras[index - 1];
    newLoras[index - 1] = temp;
    
    // Update ordering
    const reordered = newLoras.map((lora, idx) => ({
      ...lora,
      lora_order: idx + 1
    }));
    
    setSelectedLoras(reordered);
  };

  // Move a LoRA down in the stack
  const handleMoveDown = (index) => {
    if (index === selectedLoras.length - 1) return;
    
    const newLoras = [...selectedLoras];
    const temp = newLoras[index];
    newLoras[index] = newLoras[index + 1];
    newLoras[index + 1] = temp;
    
    // Update ordering
    const reordered = newLoras.map((lora, idx) => ({
      ...lora,
      lora_order: idx + 1
    }));
    
    setSelectedLoras(reordered);
  };

  if (isLoading) {
    return <div>Loading LoRAs...</div>;
  }

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  return (
    <LoraContainer>
      <LoraHeader>
        <h3>LoRA Settings</h3>
        <AddButton 
          type="button" // Add this type attribute
          
            
          onClick={handleAddLora} 
          disabled={disabled || selectedLoras.length >= maxLoras}
        >
          Add LoRA
        </AddButton>
      </LoraHeader>
      
      {selectedLoras.length === 0 ? (
        <EmptyMessage>No LoRAs selected. Click "Add LoRA" to begin.</EmptyMessage>
      ) : (
        <LoraList>
          {selectedLoras.map((lora, index) => (
            <LoraItem key={index}>
              <LoraHeader>
                <LoraNumber>#{index + 1}</LoraNumber>
                <ButtonGroup>
                  <MoveButton 
                    type="button" // Add this type attribute
                    onClick={() => handleMoveUp(index)} 
                    disabled={disabled || index === 0}
                  >
                    ↑
                  </MoveButton>
                  <MoveButton 
                    type="button" // Add this type attribute
                    onClick={() => handleMoveDown(index)} 
                    disabled={disabled || index === selectedLoras.length - 1}
                  >
                    ↓
                  </MoveButton>
                  <RemoveButton 
                    type="button" // Add this type attribute
                    onClick={() => handleRemoveLora(index)}
                    disabled={disabled}
                  >
                    ×
                  </RemoveButton>
                </ButtonGroup>
              </LoraHeader>
              
              <LoraForm>
                <FormGroup>
                  <Label>LoRA</Label>
                  <Select
                    value={lora.id || ''}
                    onChange={(e) => handleLoraChange(index, 'lora_id', e.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Select a LoRA</option>
                    {availableLoras.map((availableLora) => (
                      <option key={availableLora.id} value={availableLora.id}>
                        {availableLora.display_name || availableLora.name}
                      </option>
                    ))}
                  </Select>
                </FormGroup>
                
                <SliderGroup>
                  <Label>Model Strength: {lora.model_strength.toFixed(2)}</Label>
                  <Slider
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={lora.model_strength}
                    onChange={(e) => handleLoraChange(index, 'model_strength', parseFloat(e.target.value))}
                    disabled={disabled}
                  />
                </SliderGroup>
                
                <FormGroup>
                  <Label>Activation Words</Label>
                  <Input
                    type="text"
                    value={lora.activation_words || ''}
                    onChange={(e) => handleLoraChange(index, 'activation_words', e.target.value)}
                    placeholder="Comma-separated activation words"
                    disabled={disabled}
                  />
                </FormGroup>
              </LoraForm>
            </LoraItem>
          ))}
        </LoraList>
      )}
      
      {selectedLoras.length > 0 && (
        <ActivationWordsPreview>
          <Label>Activation Words Preview:</Label>
          <PreviewText>
            {loraService.generateActivationWordsPrompt(selectedLoras)}
          </PreviewText>
        </ActivationWordsPreview>
      )}
    </LoraContainer>
  );
};

// Styled components
const LoraContainer = styled.div`
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
`;

const LoraHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  
  h3 {
    margin: 0;
    color: #333;
  }
`;

const AddButton = styled.button`
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  
  &:hover {
    background-color: #218838;
  }
  
  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const EmptyMessage = styled.div`
  color: #6c757d;
  font-style: italic;
  text-align: center;
  padding: 20px;
`;

const LoraList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const LoraItem = styled.div`
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 16px;
`;

const LoraForm = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
  margin-top: 12px;
`;

const LoraNumber = styled.div`
  font-weight: bold;
  font-size: 1.1rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 4px;
`;

const MoveButton = styled.button`
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  
  &:hover {
    background-color: #5a6268;
  }
  
  &:disabled {
    background-color: #adb5bd;
    cursor: not-allowed;
  }
`;

const RemoveButton = styled.button`
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  cursor: pointer;
  
  &:hover {
    background-color: #c82333;
  }
  
  &:disabled {
    background-color: #f1aeb5;
    cursor: not-allowed;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SliderGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Label = styled.label`
  font-weight: bold;
  font-size: 0.9rem;
  color: #333;
`;

const Select = styled.select`
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
`;

const Input = styled.input`
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
`;

const Slider = styled.input`
  width: 100%;
`;

const ActivationWordsPreview = styled.div`
  margin-top: 16px;
  padding: 12px;
  background-color: #e9ecef;
  border-radius: 4px;
`;

const PreviewText = styled.div`
  margin-top: 4px;
  font-family: monospace;
  padding: 8px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-height: 20px;
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin-bottom: 16px;
`;

export default LoraSelector;