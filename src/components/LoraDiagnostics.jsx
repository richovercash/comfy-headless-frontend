// src/components/LoraDiagnostics.jsx
import React, { useState } from 'react';
import styled from 'styled-components';
import loraService from '../services/loraService';

const LoraDiagnostics = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      const testResult = await loraService.testLoraConnectivity();
      setResults(testResult);
    } catch (error) {
      setResults({
        success: false,
        message: `Error running diagnostics: ${error.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runImport = async () => {
    setIsImporting(true);
    setImportResults(null);
    
    try {
      const importCount = await loraService.importLorasFromComfyUI();
      setImportResults({
        success: true,
        message: `Successfully imported ${importCount} LoRAs from ComfyUI`
      });
    } catch (error) {
      setImportResults({
        success: false,
        message: `Error importing LoRAs: ${error.message}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <DiagnosticsContainer>
      <h3>LoRA Connectivity Diagnostics</h3>
      
      <ActionButtons>
        <Button 
          onClick={runDiagnostics} 
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : 'Run Diagnostics'}
        </Button>
        
        <Button 
          onClick={runImport} 
          disabled={isImporting || (results && !results.success)}
          className={results && results.success ? 'success' : 'secondary'}
        >
          {isImporting ? 'Importing...' : 'Import LoRAs from ComfyUI'}
        </Button>
      </ActionButtons>
      
      {results && (
        <ResultBox success={results.success}>
          <h4>{results.success ? '✅ Success' : '❌ Error'}</h4>
          <p>{results.message}</p>
        </ResultBox>
      )}
      
      {importResults && (
        <ResultBox success={importResults.success}>
          <h4>{importResults.success ? '✅ Import Success' : '❌ Import Error'}</h4>
          <p>{importResults.message}</p>
        </ResultBox>
      )}
      
      <TroubleshootingGuide>
        <h4>Troubleshooting Guide</h4>
        <ol>
          <li>
            <strong>ComfyUI Connection</strong>: Make sure ComfyUI is running and accessible at the URL configured in your environment variables (default: http://localhost:8188).
          </li>
          <li>
            <strong>LoRA Installation</strong>: Verify that LoRA files (.safetensors) are in the correct location (usually ComfyUI/models/loras/).
          </li>
          <li>
            <strong>CORS Issues</strong>: Ensure ComfyUI was started with CORS enabled: <code>python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header="*"</code>
          </li>
          <li>
            <strong>Database Connection</strong>: Check that your Supabase connection is working properly.
          </li>
        </ol>
      </TroubleshootingGuide>
    </DiagnosticsContainer>
  );
};

// Styled components
const DiagnosticsContainer = styled.div`
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
`;

const Button = styled.button`
  background-color: ${props => 
    props.className === 'success' ? '#28a745' : 
    props.className === 'secondary' ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 15px;
  cursor: pointer;
  
  &:hover {
    background-color: ${props => 
      props.className === 'success' ? '#218838' : 
      props.className === 'secondary' ? '#5a6268' : '#0069d9'};
  }
  
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const ResultBox = styled.div`
  background-color: ${props => props.success ? '#d4edda' : '#f8d7da'};
  border: 1px solid ${props => props.success ? '#c3e6cb' : '#f5c6cb'};
  color: ${props => props.success ? '#155724' : '#721c24'};
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  
  h4 {
    margin-top: 0;
    margin-bottom: 10px;
  }
  
  p {
    margin: 0;
  }
`;

const TroubleshootingGuide = styled.div`
  background-color: #e9ecef;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 15px;
  
  h4 {
    margin-top: 0;
    margin-bottom: 10px;
  }
  
  ol {
    margin: 0;
    padding-left: 20px;
  }
  
  li {
    margin-bottom: 10px;
  }
  
  code {
    background-color: #f1f1f1;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: monospace;
  }
`;

export default LoraDiagnostics;