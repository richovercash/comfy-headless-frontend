// src/components/WorkflowDebugger.jsx
import React, { useState } from 'react';
import styled from 'styled-components';
import ComfyService from '../services/comfyService';

const DebuggerContainer = styled.div`
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
`;

const CodeViewer = styled.pre`
  background-color: #222;
  color: #f8f8f2;
  padding: 15px;
  border-radius: 4px;
  overflow: auto;
  max-height: 500px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
`;

const Button = styled.button`
  background-color: ${props => props.secondary ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 15px;
  cursor: pointer;
  
  &:hover {
    background-color: ${props => props.secondary ? '#5a6268' : '#0069d9'};
  }
  
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const NodeInfoGroup = styled.div`
  margin-top: 15px;
  border-top: 1px solid #ddd;
  padding-top: 15px;
`;

/**
 * A component for debugging workflow generation
 */
const WorkflowDebugger = () => {
  const [workflowData, setWorkflowData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [focusNode, setFocusNode] = useState(null);
  
  /**
   * Generate a workflow with test settings
   */
  const generateWorkflow = () => {
    setIsGenerating(true);
    
    try {
      const { workflow, timestamp } = ComfyService.createFluxWorkflow({
        prompt: "Test debugging prompt",
        steps: 20,
        filenamePrefix: "debug_"
      });
      
      setWorkflowData(workflow);
    } catch (error) {
      console.error("Error generating workflow:", error);
      alert(`Error generating workflow: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  /**
   * Get statistics about the workflow
   */
  const getWorkflowStats = () => {
    if (!workflowData) return null;
    
    const nodeCount = Object.keys(workflowData).length;
    const nodeTypes = {};
    
    Object.entries(workflowData).forEach(([_, node]) => {
      const type = node.class_type;
      nodeTypes[type] = (nodeTypes[type] || 0) + 1;
    });
    
    return {
      nodeCount,
      nodeTypes
    };
  };
  
  const stats = workflowData ? getWorkflowStats() : null;
  
  /**
   * Display info about a specific node
   */
  const showNodeInfo = (nodeId) => {
    setFocusNode(nodeId);
  };
  
  return (
    <DebuggerContainer>
      <h2>Workflow Debugger</h2>
      
      <ButtonGroup>
        <Button onClick={generateWorkflow} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate Test Workflow'}
        </Button>
        {workflowData && (
          <Button 
            secondary 
            onClick={() => navigator.clipboard.writeText(JSON.stringify(workflowData, null, 2))}
          >
            Copy Workflow JSON
          </Button>
        )}
      </ButtonGroup>
      
      {stats && (
        <div>
          <h3>Workflow Statistics</h3>
          <p>Total nodes: {stats.nodeCount}</p>
          <h4>Node Types:</h4>
          <ul>
            {Object.entries(stats.nodeTypes).map(([type, count]) => (
              <li key={type}>{type}: {count}</li>
            ))}
          </ul>
        </div>
      )}
      
      {workflowData && (
        <div>
          <h3>Node Selection</h3>
          <p>Select a node to inspect:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '15px' }}>
            {Object.keys(workflowData).map(nodeId => (
              <button 
                key={nodeId}
                onClick={() => showNodeInfo(nodeId)}
                style={{ 
                  padding: '5px 10px',
                  backgroundColor: focusNode === nodeId ? '#28a745' : '#f0f0f0',
                  color: focusNode === nodeId ? 'white' : 'black',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                Node {nodeId} ({workflowData[nodeId].class_type})
              </button>
            ))}
          </div>
          
          {focusNode && (
            <NodeInfoGroup>
              <h3>Node {focusNode} Details</h3>
              <CodeViewer>
                {JSON.stringify(workflowData[focusNode], null, 2)}
              </CodeViewer>
            </NodeInfoGroup>
          )}
          
          <h3>Complete Workflow</h3>
          <CodeViewer>
            {JSON.stringify(workflowData, null, 2)}
          </CodeViewer>
        </div>
      )}
    </DebuggerContainer>
  );
};

export default WorkflowDebugger;