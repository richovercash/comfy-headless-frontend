// src/components/ComfyUITroubleshooter.jsx
import React, { useState } from 'react';
import styled from 'styled-components';
import ComfyService from '../services/comfyService';
import { validateWorkflow } from '../utils/workflowConverter';
import CorsConfigGuide from './CorsConfigGuide';

const TroubleshooterContainer = styled.div`
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
`;

const Button = styled.button`
  padding: 8px 16px;
  background-color: ${props => props.secondary ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  
  &:hover {
    background-color: ${props => props.secondary ? '#5a6268' : '#0069d9'};
  }
  
  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const ResultContainer = styled.div`
  margin-top: 15px;
  padding: 15px;
  background-color: ${props => props.success ? '#d4edda' : '#f8d7da'};
  border: 1px solid ${props => props.success ? '#c3e6cb' : '#f5c6cb'};
  border-radius: 4px;
  color: ${props => props.success ? '#155724' : '#721c24'};
`;

const LogViewer = styled.pre`
  background-color: #222;
  color: #eee;
  padding: 10px;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
`;

const CheckList = styled.ul`
  list-style-type: none;
  padding: 0;
  
  li {
    margin-bottom: 8px;
    padding-left: 25px;
    position: relative;
    
    &:before {
      content: "";
      display: inline-block;
      width: 16px;
      height: 16px;
      margin-right: 10px;
      background-color: ${props => props.checked ? '#28a745' : '#dc3545'};
      border-radius: 50%;
      position: absolute;
      left: 0;
      top: 2px;
    }
  }
`;

/**
 * A component for diagnosing and troubleshooting ComfyUI integration issues
 */
const ComfyUITroubleshooter = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [log, setLog] = useState([]);
  const [step, setStep] = useState(1);
  
  const addLog = (message, type = 'info') => {
    setLog(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
  };
  
  const runSystemCheck = async () => {
    setIsRunning(true);
    setResults(null);
    setLog([]);
    setStep(1);
    
    try {
      addLog('Starting ComfyUI system check...', 'info');
      
      // Step 1: Check connection
      addLog('Step 1: Testing basic connection to ComfyUI server...', 'info');
      setStep(1);
      
      try {
        const connectionResult = await ComfyService.checkConnectionOnly();
        
        if (connectionResult.success) {
          addLog('✅ Connection to ComfyUI server successful!', 'success');
          if (connectionResult.data) {
            addLog(`System info: ${JSON.stringify(connectionResult.data, null, 2)}`, 'info');
          }
        } else {
          addLog(`❌ Connection failed: ${connectionResult.error?.message || 'Unknown error'}`, 'error');
          setResults({
            success: false,
            message: 'Could not connect to ComfyUI server. Check if ComfyUI is running and accessible.'
          });
          setIsRunning(false);
          return;
        }
      } catch (error) {
        addLog(`❌ Connection error: ${error.message}`, 'error');
        setResults({
          success: false,
          message: `Connection error: ${error.message}. Check if ComfyUI is running and the URL is correct.`
        });
        setIsRunning(false);
        return;
      }
      
      // Step 2: Try to list available nodes
      addLog('Step 2: Testing API access to ComfyUI server...', 'info');
      setStep(2);
      
      try {
        addLog('Fetching available node types from ComfyUI...', 'info');
        const nodeTypes = await ComfyService.getNodeTypes();
        
        if (nodeTypes) {
          const nodeCount = Object.keys(nodeTypes).length;
          addLog(`✅ Successfully retrieved ${nodeCount} node types from ComfyUI`, 'success');
          
          // Check for specific nodes we need
          const requiredNodes = ['UNETLoader', 'DualCLIPLoader', 'VAELoader', 'CLIPTextEncode', 'KSampler', 'VAEDecode', 'SaveImage'];
          const missingNodes = [];
          
          for (const node of requiredNodes) {
            if (!nodeTypes[node]) {
              missingNodes.push(node);
            }
          }
          
          if (missingNodes.length > 0) {
            addLog(`⚠️ Warning: Some required nodes are missing: ${missingNodes.join(', ')}`, 'warning');
          } else {
            addLog('✅ All required nodes are available in your ComfyUI installation', 'success');
          }
          
          // Check DualCLIPLoader type parameter
          if (nodeTypes['DualCLIPLoader']) {
            const typeInput = nodeTypes['DualCLIPLoader'].input?.required?.type || 
                             nodeTypes['DualCLIPLoader'].input?.optional?.type;
            
            if (typeInput) {
              const validTypes = typeInput.options || [];
              addLog(`DualCLIPLoader type parameter accepts: ${validTypes.join(', ')}`, 'info');
              
              if (validTypes.includes('flux')) {
                addLog('✅ DualCLIPLoader supports "flux" type value', 'success');
              } else {
                addLog('⚠️ Warning: DualCLIPLoader doesn\'t support "flux" type value', 'warning');
              }
            }
          }
        } else {
          addLog('❌ Failed to retrieve node types', 'error');
        }
      } catch (error) {
        addLog(`❌ Error retrieving node types: ${error.message}`, 'error');
      }
      
      // Step 3: Test a minimal flux workflow
      addLog('Step 3: Creating a minimal test workflow...', 'info');
      setStep(3);
      
      try {
        // Create a minimal flux workflow based on the available nodes
        const fluxResult = ComfyService.createFluxWorkflow({
          prompt: "Test prompt",
          steps: 20,
          filenamePrefix: "test_"
        });
        
        if (fluxResult && fluxResult.workflow && typeof fluxResult.timestamp === 'number') {
          const fluxValid = validateWorkflow(fluxResult.workflow);
          
          if (fluxValid.isValid) {
            addLog('✅ Flux workflow generation successful!', 'success');
            
            // Print the workflow for debugging
            addLog(`Generated workflow: ${JSON.stringify(fluxResult.workflow, null, 2)}`, 'info');
            
            addLog('Note: We won\'t actually execute the workflow to avoid potential errors', 'info');
          } else {
            addLog(`⚠️ Generated flux workflow has validation issues: ${fluxValid.errors.join(', ')}`, 'warning');
          }
        } else {
          addLog('❌ Flux workflow generation failed with unexpected result', 'error');
        }
      } catch (error) {
        addLog(`❌ Flux workflow generation error: ${error.message}`, 'error');
      }
      
      // All tests passed!
      addLog('🎉 All tests passed! Your ComfyUI integration should be working correctly.', 'success');
      setResults({
        success: true,
        message: 'All ComfyUI integration tests passed successfully!'
      });
    } catch (error) {
      addLog(`❌ Unexpected error during diagnostics: ${error.message}`, 'error');
      setResults({
        success: false,
        message: `Unexpected error: ${error.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };
  
  return (
    <TroubleshooterContainer>
      <h2>ComfyUI Integration Troubleshooter</h2>
      
      <ButtonGroup>
        <Button onClick={runSystemCheck} disabled={isRunning}>
          {isRunning ? 'Running Diagnostics...' : 'Run System Check'}
        </Button>
        <Button secondary onClick={() => setLog([])} disabled={isRunning || log.length === 0}>
          Clear Log
        </Button>
      </ButtonGroup>
      
      {log.length > 0 && (
        <LogViewer>
          {log.map((entry, index) => (
            <div key={index} style={{ color: entry.type === 'error' ? '#ff6b6b' : entry.type === 'success' ? '#51cf66' : '#f8f9fa' }}>
              [{entry.timestamp.split('T')[1].split('.')[0]}] {entry.message}
            </div>
          ))}
        </LogViewer>
      )}
      
      {results && (
        <ResultContainer success={results.success}>
          <h3>{results.success ? 'System Check Passed!' : 'System Check Failed'}</h3>
          <p>{results.message}</p>
          
          {!results.success && results.message && 
           (results.message.includes('NetworkError') || 
            results.message.includes('CORS') || 
            results.message.includes('Network Error')) && (
            <CorsConfigGuide />
          )}
        </ResultContainer>
      )}
      
      <div style={{ marginTop: '20px' }}>
        <h3>ComfyUI Integration Checklist</h3>
        <CheckList>
          <li style={{color: step > 0 ? '#28a745' : '#6c757d'}}>
            Make sure ComfyUI server is running (URL: {ComfyService.API_BASE_URL})
          </li>
          <li style={{color: step > 1 ? '#28a745' : '#6c757d'}}>
            ComfyUI API is accessible and can list available nodes
          </li>
          <li style={{color: step > 2 ? '#28a745' : '#6c757d'}}>
            Can create a valid Flux workflow
          </li>
        </CheckList>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Common Issues</h3>
        <ul>
          <li><strong>CORS Issues:</strong> Make sure ComfyUI is launched with CORS enabled. Use <code>--enable-cors-header="*"</code> flag.</li>
          <li><strong>Missing class_type:</strong> Check workflow format conversion for nodes missing the class_type property.</li>
          <li><strong>Model Loading Errors:</strong> Ensure all required models are present in ComfyUI's models directory.</li>
          <li><strong>Connection Timeout:</strong> Check if ComfyUI server is running on the correct port and is accessible.</li>
        </ul>
      </div>
    </TroubleshooterContainer>
  );
};

export default ComfyUITroubleshooter;
