// src/utils/workflowAdapter.js
/**
 * A simpler adapter for Redux-Simple.json workflow
 * Focuses on reliable conversion rather than complete flexibility
 */

import reduxSimpleWorkflow from '../workflows/Redux-Simple.json';

/**
 * Convert Redux-Simple.json to the API format expected by ComfyUI
 * @returns {Object} - The workflow in API format
 */
export function convertReduxSimpleToAPI() {
  // Start with an empty API workflow
  const apiWorkflow = {};
  
  // Manually map each node from the original workflow
  const nodes = reduxSimpleWorkflow.nodes;
  const links = reduxSimpleWorkflow.links;
  
  // Map node IDs to their API format
  nodes.forEach(node => {
    const apiNode = {
      class_type: node.type,
    };
    
    // Handle inputs
    if (node.inputs && node.inputs.length > 0) {
      apiNode.inputs = {};
      
      node.inputs.forEach(input => {
        if (input.link !== null && input.link !== undefined) {
          // Find the corresponding link
          const link = links.find(l => l[0] === input.link);
          
          if (link) {
            // Always use output index 0 to avoid "tuple index out of range" errors
            apiNode.inputs[input.name] = [link[1].toString(), 0];
          }
        }
      });
      
      // Special case for SaveImage - ensure filename_prefix is present
      if (node.type === 'SaveImage') {
        // Get the widget value for filename_prefix
        const prefix = node.widgets_values ? node.widgets_values[0] : 'output';
        apiNode.inputs.filename_prefix = prefix;
      }
    }
    
    // Copy widgets_values if they exist
    if (node.widgets_values) {
      apiNode.widgets_values = [...node.widgets_values];
    }
    
    // Add the node to the API workflow
    apiWorkflow[node.id] = apiNode;
  });
  
  return apiWorkflow;
}

/**
 * Apply parameters to the ReduxSimple workflow
 * @param {Object} parameters - The parameters to apply
 * @returns {Object} - The customized workflow
 */
export function createReduxSimpleWorkflow(parameters) {
  const {
    prompt = 'post-apocalyptic vehicle',
    negativePrompt = 'bad quality, blurry',
    steps = 30,
    seed = Math.floor(Math.random() * 1000000000),
    width = 768,
    height = 768,
    filenamePrefix = 'vehicle',
    guidanceScale = 3.5
  } = parameters;
  
  // Convert the workflow to API format
  const workflow = convertReduxSimpleToAPI();
  
  // Apply parameters - using specific node IDs that we know from the workflow
  
  // Set positive prompt (node 50)
  if (workflow[50] && workflow[50].class_type === 'CLIPTextEncode') {
    if (workflow[50].widgets_values) {
      workflow[50].widgets_values[0] = prompt;
    }
  }
  
  // Set negative prompt (node 51)
  if (workflow[51] && workflow[51].class_type === 'CLIPTextEncode') {
    if (workflow[51].widgets_values) {
      workflow[51].widgets_values[0] = negativePrompt;
    }
  }
  
  // Set KSampler parameters (node 3)
  if (workflow[3] && workflow[3].class_type === 'KSampler') {
    if (workflow[3].inputs) {
      workflow[3].inputs.steps = steps;
      workflow[3].inputs.seed = seed;
    }
  }
  
  // Set image dimensions (node 5)
  if (workflow[5] && workflow[5].class_type === 'EmptyLatentImage') {
    if (workflow[5].inputs) {
      workflow[5].inputs.width = width;
      workflow[5].inputs.height = height;
    }
  }
  
  // Set filename prefix (node 9)
  if (workflow[9] && workflow[9].class_type === 'SaveImage') {
    const timestamp = Math.floor(Date.now() / 1000);
    const fullPrefix = `${filenamePrefix}_${timestamp}`;
    
    // Set in both places to ensure it works
    if (workflow[9].inputs) {
      workflow[9].inputs.filename_prefix = fullPrefix;
    }
    
    if (workflow[9].widgets_values) {
      workflow[9].widgets_values[0] = fullPrefix;
    }
  }
  
  // Set guidance scale (node 52)
  if (workflow[52] && workflow[52].class_type === 'FluxGuidance') {
    if (workflow[52].widgets_values) {
      workflow[52].widgets_values[0] = guidanceScale;
    }
  }
  
  return {
    workflow,
    timestamp: Math.floor(Date.now() / 1000),
    payload: {
      prompt: workflow,
      client_id: `redux-simple-${Math.floor(Date.now() / 1000)}`
    }
  };
}

export default { convertReduxSimpleToAPI, createReduxSimpleWorkflow };