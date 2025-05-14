// src/components/AssetLoraDetails.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import loraService from '../services/loraService';

const AssetLoraDetails = ({ assetId }) => {
  const [loras, setLoras] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLoraDetails = async () => {
      if (!assetId) return;
      
      try {
        setIsLoading(true);
        const loraData = await loraService.getLorasForAsset(assetId);
        setLoras(loraData);
        setError(null);
      } catch (err) {
        console.error('Error fetching LoRA details:', err);
        setError('Failed to load LoRA details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLoraDetails();
  }, [assetId]);

  if (isLoading) {
    return <LoadingIndicator>Loading LoRA details...</LoadingIndicator>;
  }

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (!loras || loras.length === 0) {
    return <EmptyMessage>No LoRAs were used for this generation.</EmptyMessage>;
  }

  return (
    <LoraDetailsContainer>
      <LoraHeader>
        <h3>LoRAs Used ({loras.length})</h3>
      </LoraHeader>
      
      <LoraTable>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Strength</th>
            <th>Model</th>
            <th>CLIP</th>
            <th>Activation Words</th>
          </tr>
        </thead>
        <tbody>
          {loras.map((lora, index) => (
            <tr key={lora.id}>
              <td>{lora.lora_order}</td>
              <td>
                {lora.loras?.display_name || lora.loras?.name || 'Unknown LoRA'}
              </td>
              <td>{lora.strength.toFixed(2)}</td>
              <td>{lora.model_strength.toFixed(2)}</td>
              <td>{lora.clip_strength.toFixed(2)}</td>
              <td>
                {lora.activation_words || 
                 lora.loras?.activation_words || 
                 <EmptyCell>None</EmptyCell>}
              </td>
            </tr>
          ))}
        </tbody>
      </LoraTable>
      
      <ActivationWordsSection>
        <h4>Combined Activation Words</h4>
        <ActivationWordsBox>
          {loraService.generateActivationWordsPrompt(loras.map(lora => ({
            ...lora,
            activation_words: lora.activation_words || lora.loras?.activation_words
          }))) || <EmptyCell>No activation words were used</EmptyCell>}
        </ActivationWordsBox>
      </ActivationWordsSection>
    </LoraDetailsContainer>
  );
};

// Styled components
const LoraDetailsContainer = styled.div`
  margin-top: 24px;
  padding: 16px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
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

const LoraTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th, td {
    padding: 8px 12px;
    border: 1px solid #dee2e6;
    text-align: left;
  }
  
  th {
    background-color: #e9ecef;
    font-weight: bold;
  }
  
  tr:nth-child(even) {
    background-color: #f2f2f2;
  }
  
  tr:hover {
    background-color: #e9ecef;
  }
`;

const EmptyCell = styled.span`
  color: #6c757d;
  font-style: italic;
`;

const ActivationWordsSection = styled.div`
  margin-top: 20px;
  
  h4 {
    margin-top: 0;
    margin-bottom: 8px;
    color: #333;
  }
`;

const ActivationWordsBox = styled.div`
  padding: 12px;
  background-color: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-family: monospace;
`;

const LoadingIndicator = styled.div`
  padding: 16px;
  color: #6c757d;
  text-align: center;
`;

const ErrorMessage = styled.div`
  padding: 16px;
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
`;

const EmptyMessage = styled.div`
  padding: 16px;
  color: #6c757d;
  font-style: italic;
  text-align: center;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
`;

export default AssetLoraDetails;