// src/workflows/index.js

// Import the JSON file
import workflowData from './Redux-Simple.json';

// Export the workflow data
export const fluxWorkflow = workflowData;

// Utility function to get a validated workflow
export function getFluxWorkflow() {
  if (!workflowData || typeof workflowData !== 'object') {
    console.error('Invalid workflow JSON format');
    return {}; // Return empty object as fallback
  }
  
  console.log("Workflow data loaded successfully:", {
    topLevelKeys: Object.keys(workflowData),
    hasNodes: Boolean(workflowData.nodes)
  });
  
  return workflowData;
}

// Export default for convenience
export default {
  fluxWorkflow,
  getFluxWorkflow
};