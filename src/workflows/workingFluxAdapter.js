// src/workflows/workingFluxAdapter.js

/**
 * This adapter loads and adapts your existing Redux-Simple.json workflow
 * to work with the ComfyUI API by ensuring type compatibility 
 */
import workflowData from './Redux-Simple.json';

/**
 * Convert the editor format of the workflow to the API format
 * @param {Object} workflow - The ComfyUI editor workflow
 * @returns {Object} - Workflow in API format
 */
export function convertEditorToAPIFormat(workflow) {
  const apiWorkflow = {};
  
  // If we have a workflow with nodes array (from the editor)
  if (workflow.nodes && Array.isArray(workflow.nodes)) {
    // Process each node
    workflow.nodes.forEach(node => {
      apiWorkflow[node.id] = {
        class_type: node.type,
        inputs: {}
      };
      
      // Copy widgets_values if they exist
      if (node.widgets_values) {
        apiWorkflow[node.id].widgets_values = [...node.widgets_values];
      }
      
      // Process inputs if they exist
      if (node.inputs && Array.isArray(node.inputs)) {
        node.inputs.forEach(input => {
          if (input.link !== null && input.link !== undefined) {
            // Find the source of this link
            const link = findLinkById(workflow.links, input.link);
            if (link) {
              // Format: [source_node_id, output_index]
              apiWorkflow[node.id].inputs[input.name] = [
                String(link[1]), // Source node ID 
                link[2]  // Output index
              ];
            }
          }
        });
      }
    });
    
    return apiWorkflow;
  }
  
  // Already in API format
  return workflow;
}

/**
 * Find a link in the workflow's links array
 * @param {Array} links - Array of links
 * @param {number} id - Link ID to find
 * @returns {Array|null} - Link data [id, source_node, source_slot, dest_node, dest_slot]
 */
function findLinkById(links, id) {
  if (!links || !Array.isArray(links)) return null;
  
  const link = links.find(l => l[0] === id);
  return link;
}

/**
 * Fix DualCLIPLoader type parameter and other potential issues in the workflow
 * @param {Object} workflow - API-format workflow
 * @returns {Object} - Fixed workflow
 */
export function fixWorkflowCompatibility(workflow) {
  // Clone to avoid modifying the original
  const fixedWorkflow = JSON.parse(JSON.stringify(workflow));
  
  // Look for DualCLIPLoader nodes
  Object.keys(fixedWorkflow).forEach(nodeId => {
    const node = fixedWorkflow[nodeId];
    
    // Fix DualCLIPLoader
    if (node.class_type === 'DualCLIPLoader') {
      // Ensure it has inputs
      if (!node.inputs) {
        node.inputs = {};
      }
      
      // Fix the type parameter to use 'flux' instead of 'dual'
      if (node.inputs.type === 'dual') {
        node.inputs.type = 'flux';
      }
    }
  });
  
  return fixedWorkflow;
}

/**
 * Get your working Redux-Simple workflow in API format
 * with compatibility fixes applied
 */
export function getFixedReduxWorkflow() {
  // Convert to API format
  const apiFormat = convertEditorToAPIFormat(workflowData);
  
  // Apply compatibility fixes
  const fixedWorkflow = fixWorkflowCompatibility(apiFormat);
  
  return fixedWorkflow;
}

/**
 * Creates a customized version of your working Redux workflow
 * @param {Object} options - Customization options
 * @param {string} options.prompt - Text prompt to use
 * @param {number} options.steps - Number of steps for sampling
 * @param {string} options.inputImageUrl - Optional input image URL
 * @param {string} options.reduxImageUrl - Optional redux image URL
 * @param {string} options.filenamePrefix - Optional filename prefix
 * @returns {Object} - Customized workflow and timestamp
 */
export function createCustomReduxWorkflow(options) {
  const {
    prompt,
    steps = 28,
    inputImageUrl = null,
    reduxImageUrl = null,
    filenamePrefix = 'Otherides-2d/redux_'
  } = options;
  
  const timestamp = Math.floor(Date.now()/1000);
  
  // Get the fixed workflow
  const workflow = getFixedReduxWorkflow();
  
  // Customize the workflow
  // Note: These node IDs and parameters need to match your actual workflow structure
  
  // Set the prompt (assuming node 52 is your CLIPTextEncode node)
  if (workflow[52] && workflow[52].class_type === 'CLIPTextEncode') {
    // If using widgets_values
    if (workflow[52].widgets_values) {
      workflow[52].widgets_values[0] = prompt;
    }
    // If using inputs
    else if (workflow[52].inputs && workflow[52].inputs.text !== undefined) {
      workflow[52].inputs.text = prompt;
    }
  }
  
  // Set the steps (assuming node 15 is your BasicScheduler or KSampler node)
  if (workflow[15] && workflow[15].widgets_values) {
    // Assuming second value in widgets_values is steps
    workflow[15].widgets_values[1] = steps;
  }
  
  // Set random seed (assuming node 16 is RandomNoise)
  if (workflow[16] && workflow[16].widgets_values) {
    workflow[16].widgets_values[0] = Math.floor(Math.random() * 1000000);
  }
  
  // Set filename prefix (assuming node 25 is Text Multiline)
  if (workflow[25] && workflow[25].widgets_values) {
    workflow[25].widgets_values[0] = `${filenamePrefix}${timestamp}`;
  }
  
  // Set input image if provided (assuming node 79 is LoadImage)
  if (inputImageUrl && workflow[79]) {
    if (workflow[79].widgets_values) {
      workflow[79].widgets_values[0] = inputImageUrl;
    }
  }
  
  // Set redux image if provided (assuming node 59 is LoadImage)
  if (reduxImageUrl && workflow[59]) {
    if (workflow[59].widgets_values) {
      workflow[59].widgets_values[0] = reduxImageUrl;
    }
  }
  
  return { workflow, timestamp };
}

export default { createCustomReduxWorkflow, getFixedReduxWorkflow };