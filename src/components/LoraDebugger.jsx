// src/components/LoraDebugger.jsx
import React, { useState } from 'react';
import styled from 'styled-components';
import loraService from '../services/loraService';
import ComfyService from '../services/comfyService';

const LoraDebugger = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [showRawData, setShowRawData] = useState(false);

  const runDeepDiagnostics = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {

        // DEBUGGING STEP 1: Check if ComfyUI can see the LoRAs
        console.log("STEP 1: Checking LoRAs available in ComfyUI...");
        const comfyLoras = await loraService.getAvailableLorasFromComfyUI();
        console.log("LoRAs available in ComfyUI:", comfyLoras);

        // DEBUGGING STEP 2: Check database LoRAs
        console.log("STEP 2: Checking LoRAs in database...");
        const dbLoras = await loraService.getAllLoras();
        console.log("LoRAs in database:", dbLoras);

        // DEBUGGING STEP 3: Compare paths
        console.log("STEP 3: Comparing LoRA paths between ComfyUI and database...");
        console.log("ComfyUI LoRA paths:", comfyLoras.map(l => l.path));
        console.log("Database LoRA paths:", dbLoras.map(l => l.file_path));

        // Check if any match
        const matches = dbLoras.filter(dbLora => 
        comfyLoras.some(comfyLora => comfyLora.path === dbLora.file_path)
        );

        console.log(`Found ${matches.length} matching LoRAs between ComfyUI and database`);

      // 1. Fetch available LoRAs
      const availableLoras = await loraService.getAllLoras();
      console.log("Available LoRAs from database:", availableLoras);
      
      // 2. Check connectivity
      const connectivityTest = await loraService.testLoraConnectivity();
      console.log("Connectivity test:", connectivityTest);
      
      // 3. Create a test workflow with a single LoRA
      const testLora = availableLoras.length > 0 ? [availableLoras[0]] : [];
      
      if (testLora.length > 0) {
        console.log("Using test LoRA:", testLora[0]);
        
        // Generate a simple workflow
        const workflowResult = ComfyService.createFluxWorkflow({
          prompt: "test prompt",
          steps: 10,
          filenamePrefix: "lora_debug_test",
        });
        
        // Debug the integration process
        const debugInfo = await loraService.debugLoraIntegration(
          workflowResult.workflow,
          testLora
        );
        
        // Analyze workflow with LoRAs
        const workflowWithLoras = loraService.updateWorkflowWithLoras(
          workflowResult.workflow,
          testLora
        );
        
        // Extract LoRA nodes for analysis
        const loraNodes = Object.entries(workflowWithLoras)
          .filter(([_, node]) => node.class_type === "FluxLoraLoader")
          .map(([id, node]) => ({
            id,
            inputs: node.inputs
          }));
        
        // Set final results
        setResults({
          connectivityTest,
          databaseLoras: availableLoras.length,
          testLora: testLora[0],
          debugInfo,
          loraNodesFound: loraNodes.length,
          workflowWithLoras: showRawData ? workflowWithLoras : null
        });
      } else {
        setResults({
          connectivityTest,
          databaseLoras: 0,
          error: "No LoRAs available in database for testing"
        });
      }
    } catch (error) {
      console.error("Error running deep diagnostics:", error);
      setResults({
        error: `Error: ${error.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <DebuggerContainer>
      <h3>LoRA Deep Debugging Tool</h3>
      
      <p>
        This tool performs detailed diagnostics on the LoRA integration, tracing exactly
        where any issues might be occurring.
      </p>
      
      <ActionButtons>
        <Button 
          onClick={runDeepDiagnostics} 
          disabled={isRunning}
        >
          {isRunning ? 'Running Deep Diagnostics...' : 'Run Deep Diagnostics'}
        </Button>
        
        <ToggleButton 
          onClick={() => setShowRawData(!showRawData)}
        >
          {showRawData ? 'Hide Raw Data' : 'Show Raw Data'}
        </ToggleButton>
      </ActionButtons>
      
      {results && (
        <ResultsContainer>
          <h4>Diagnostic Results</h4>
          
          {results.error ? (
            <ErrorMessage>{results.error}</ErrorMessage>
          ) : (
            <>
              <ResultSection>
                <h5>Basic Connectivity</h5>
                <StatusLabel success={results.connectivityTest?.success}>
                  {results.connectivityTest?.success ? '✅ ComfyUI Connection OK' : '❌ ComfyUI Connection Failed'}
                </StatusLabel>
                <InfoText>{results.connectivityTest?.message}</InfoText>
              </ResultSection>
              
              <ResultSection>
                <h5>Database LoRAs</h5>
                <InfoText>Found {results.databaseLoras} LoRAs in database</InfoText>
                {results.testLora && (
                  <DetailsList>
                    <DetailItem>
                      <strong>Test LoRA:</strong> {results.testLora.name || results.testLora.file_path}
                    </DetailItem>
                    <DetailItem>
                      <strong>Path:</strong> {results.testLora.file_path}
                    </DetailItem>
                    <DetailItem>
                      <strong>Strengths:</strong> Model {results.testLora.model_strength}, CLIP {results.testLora.clip_strength}
                    </DetailItem>
                  </DetailsList>
                )}
              </ResultSection>
              
              {results.debugInfo && (
                <>
                  <ResultSection>
                    <h5>ComfyUI LoRAs</h5>
                    <InfoText>Found {results.debugInfo.lorasAvailable.length} LoRAs in ComfyUI</InfoText>
                    
                    {results.testLora && (
                      <StatusLabel 
                        success={results.debugInfo.lorasAvailable.some(
                          l => l.path === results.testLora.file_path
                        )}
                      >
                        {results.debugInfo.lorasAvailable.some(
                          l => l.path === results.testLora.file_path
                        ) 
                          ? '✅ Test LoRA found in ComfyUI' 
                          : '❌ Test LoRA NOT found in ComfyUI'}
                      </StatusLabel>
                    )}
                    
                    {showRawData && results.debugInfo.lorasAvailable.length > 0 && (
                      <DetailsList>
                        <strong>Available LoRAs in ComfyUI:</strong>
                        {results.debugInfo.lorasAvailable.slice(0, 5).map((lora, idx) => (
                          <DetailItem key={idx}>
                            {lora.name} ({lora.path})
                          </DetailItem>
                        ))}
                        {results.debugInfo.lorasAvailable.length > 5 && 
                          <DetailItem>...and {results.debugInfo.lorasAvailable.length - 5} more</DetailItem>}
                      </DetailsList>
                    )}
                  </ResultSection>
                  
                  <ResultSection>
                    <h5>Workflow Integration</h5>
                    <StatusLabel success={results.loraNodesFound > 0}>
                      {results.loraNodesFound > 0 
                        ? `✅ ${results.loraNodesFound} LoRA nodes added to workflow` 
                        : '❌ No LoRA nodes added to workflow'}
                    </StatusLabel>
                    
                    {results.debugInfo.errors.length > 0 && (
                      <ErrorList>
                        <strong>Errors:</strong>
                        {results.debugInfo.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ErrorList>
                    )}
                  </ResultSection>
                </>
              )}
              
              {showRawData && results.workflowWithLoras && (
                <ResultSection>
                  <h5>Raw Workflow Data</h5>
                  <pre>{JSON.stringify(results.workflowWithLoras, null, 2)}</pre>
                </ResultSection>
              )}
            </>
          )}
        </ResultsContainer>
      )}
    </DebuggerContainer>
  );
};

// Styled components
const DebuggerContainer = styled.div`
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
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 15px;
  cursor: pointer;
  
  &:hover {
    background-color: #0069d9;
  }
  
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const ToggleButton = styled.button`
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 15px;
  cursor: pointer;
  
  &:hover {
    background-color: #5a6268;
  }
`;

const ResultsContainer = styled.div`
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 15px;
  background-color: white;
`;

const ResultSection = styled.div`
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
  
  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }
  
  h5 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #343a40;
  }
  
  pre {
    background-color: #f8f9fa;
    padding: 10px;
    border-radius: 4px;
    overflow: auto;
    font-size: 12px;
    max-height: 300px;
  }
`;

const StatusLabel = styled.div`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: ${props => props.success ? '#d4edda' : '#f8d7da'};
  color: ${props => props.success ? '#155724' : '#721c24'};
  margin-bottom: 10px;
  font-weight: bold;
`;

const InfoText = styled.p`
  margin: 5px 0;
  color: #495057;
`;

const DetailsList = styled.div`
  margin: 10px 0;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
`;

const DetailItem = styled.div`
  margin: 5px 0;
  font-size: 0.9rem;
`;

const ErrorMessage = styled.div`
  padding: 15px;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
`;

const ErrorList = styled.ul`
  margin: 10px 0;
  padding-left: 20px;
  color: #721c24;
`;

export default LoraDebugger;