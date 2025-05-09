// src/utils/workflowLogger.js

/**
 * A utility for logging and debugging ComfyUI workflows
 */
export const WorkflowLogger = {
  /**
   * Logs a summary of a workflow with details about key nodes
   * @param {Object} workflow - The workflow to analyze
   * @param {string} label - Optional label for the log
   */
  logWorkflowSummary(workflow, label = 'Workflow Summary') {
    if (!workflow || typeof workflow !== 'object') {
      console.error('Invalid workflow provided to logWorkflowSummary');
      return;
    }
    
    const nodeCount = Object.keys(workflow).length;
    
    console.group(label);
    console.log(`Total nodes: ${nodeCount}`);
    
    // Check for common node types
    const nodeTypes = {};
    Object.entries(workflow).forEach(([nodeId, node]) => {
      const type = node.class_type;
      if (!nodeTypes[type]) {
        nodeTypes[type] = [];
      }
      nodeTypes[type].push(nodeId);
    });
    
    console.log('Node types found:');
    Object.entries(nodeTypes).forEach(([type, nodeIds]) => {
      console.log(`- ${type}: ${nodeIds.length} nodes (IDs: ${nodeIds.join(', ')})`);
    });
    
    // Look for potential issues
    this.checkForIssues(workflow);
    
    console.groupEnd();
  },
  
  /**
   * Check for common workflow issues
   * @param {Object} workflow - The workflow to check
   */
  checkForIssues(workflow) {
    const issues = [];
    
    // Check for missing class_type
    Object.entries(workflow).forEach(([nodeId, node]) => {
      if (!node.class_type) {
        issues.push(`Node ${nodeId} is missing class_type property`);
      }
    });
    
    // Check for invalid inputs
    Object.entries(workflow).forEach(([nodeId, node]) => {
      if (node.inputs) {
        Object.entries(node.inputs).forEach(([inputName, inputValue]) => {
          if (Array.isArray(inputValue) && inputValue.length === 2) {
            const [targetNodeId, outputIndex] = inputValue;
            
            // Check if referenced node exists
            if (!workflow[targetNodeId]) {
              issues.push(`Node ${nodeId} references non-existent node ${targetNodeId} in input ${inputName}`);
            }
          }
        });
      }
    });
    
    // Check DualCLIPLoader type parameter
    Object.entries(workflow).forEach(([nodeId, node]) => {
      if (node.class_type === 'DualCLIPLoader') {
        if (node.inputs && node.inputs.type === 'dual') {
          issues.push(`DualCLIPLoader (node ${nodeId}) has type="dual" which may not be supported - should be "flux"`);
        }
      }
    });
    
    if (issues.length > 0) {
      console.log('⚠️ Potential Issues:');
      issues.forEach(issue => {
        console.warn(`- ${issue}`);
      });
    } else {
      console.log('✅ No common issues detected in workflow');
    }
  },
  
  /**
   * Find all nodes of a specific type in a workflow
   * @param {Object} workflow - The workflow to search
   * @param {string} nodeType - The class_type to find
   * @returns {Array} - Array of [nodeId, node] pairs
   */
  findNodesByType(workflow, nodeType) {
    return Object.entries(workflow)
      .filter(([_, node]) => node.class_type === nodeType);
  },
  
  /**
   * Log details about a specific node
   * @param {Object} workflow - The workflow containing the node
   * @param {string} nodeId - The ID of the node to analyze
   */
  logNodeDetails(workflow, nodeId) {
    if (!workflow[nodeId]) {
      console.error(`Node ${nodeId} not found in workflow`);
      return;
    }
    
    const node = workflow[nodeId];
    
    console.group(`Node ${nodeId} (${node.class_type})`);
    
    // Log inputs
    if (node.inputs) {
      console.log('Inputs:');
      Object.entries(node.inputs).forEach(([inputName, inputValue]) => {
        if (Array.isArray(inputValue) && inputValue.length === 2) {
          const [targetNodeId, outputIndex] = inputValue;
          const targetNode = workflow[targetNodeId];
          console.log(`- ${inputName}: Connected to node ${targetNodeId} (${targetNode?.class_type || 'unknown'}) output ${outputIndex}`);
        } else {
          console.log(`- ${inputName}: ${JSON.stringify(inputValue)}`);
        }
      });
    } else {
      console.log('No inputs');
    }
    
    // Log widgets values
    if (node.widgets_values) {
      console.log('Widget Values:');
      node.widgets_values.forEach((value, index) => {
        console.log(`- Value ${index}: ${JSON.stringify(value)}`);
      });
    }
    
    console.groupEnd();
  }
};

export default WorkflowLogger;