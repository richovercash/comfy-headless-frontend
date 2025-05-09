// src/utils/workflowUtils.js
import deepClone from 'lodash/cloneDeep';

/**
 * Applies modifications to a workflow
 * @param {Object} baseWorkflow - The base workflow to modify
 * @param {Object} modifications - Object containing node IDs and properties to modify
 * @returns {Object} The modified workflow
 */
export const modifyWorkflow = (baseWorkflow, modifications) => {
  // Create a deep clone to avoid modifying the original
  const workflow = deepClone(baseWorkflow);
  
  // Apply each modification
  Object.entries(modifications).forEach(([nodeId, changes]) => {
    if (!workflow[nodeId]) {
      console.warn(`Node ${nodeId} not found in workflow`);
      return;
    }
    
    // Apply changes to the node
    Object.entries(changes).forEach(([key, value]) => {
      // Handle nested properties using paths (e.g., 'inputs.seed')
      if (key.includes('.')) {
        const parts = key.split('.');
        let target = workflow[nodeId];
        
        // Navigate to the target object
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!target[part]) {
            target[part] = {};
          }
          target = target[part];
        }
        
        // Set the value
        target[parts[parts.length - 1]] = value;
      } else {
        // Direct property
        workflow[nodeId][key] = value;
      }
    });
  });
  
  return workflow;
};