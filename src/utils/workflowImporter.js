// src/utils/workflowImporter.js

/**
 * Flexible workflow importer for ComfyUI workflows
 * Allows loading workflows from JSON files and dynamically modifying parameters
 * without hardcoding node IDs
 */

import { convertEditorWorkflowToAPIFormat } from './workflowConverter';

// Registry of available workflows with metadata
export const workflowRegistry = {
  'vehicle-generation': {
    file: 'Redux-Simple.json',
    description: 'Generate post-apocalyptic vehicles',
    parameters: {
      prompt: { 
        type: 'string', 
        description: 'Text prompt for generation',
        nodeType: 'CLIPTextEncode',
        paramPath: 'widgets_values[0]',
        fallbackPath: 'inputs.text',
        condition: node => !node.inputs || !node.inputs.negative // Only target positive prompt nodes
      },
      negativePrompt: {
        type: 'string',
        description: 'Negative prompt to avoid unwanted elements',
        nodeType: 'CLIPTextEncode',
        paramPath: 'widgets_values[0]',
        fallbackPath: 'inputs.text',
        condition: node => node.inputs && node.inputs.negative // Only target negative prompt nodes
      },
      steps: {
        type: 'number',
        description: 'Number of sampling steps',
        nodeType: 'KSampler',
        paramPath: 'inputs.steps',
        fallbackPath: 'widgets_values[6]'
      },
      seed: {
        type: 'number',
        description: 'Random seed for generation',
        nodeType: 'KSampler',
        paramPath: 'inputs.seed',
        fallbackPath: 'widgets_values[0]'
      },
      width: {
        type: 'number',
        description: 'Image width',
        nodeType: 'EmptyLatentImage',
        paramPath: 'inputs.width',
        fallbackPath: 'widgets_values[0]'
      },
      height: {
        type: 'number',
        description: 'Image height',
        nodeType: 'EmptyLatentImage',
        paramPath: 'inputs.height',
        fallbackPath: 'widgets_values[1]'
      },
      // 1. Update the filenamePrefix parameter in the registry
      filenamePrefix: {
        type: 'string',
        description: 'Prefix for saved files',
        nodeType: 'SaveImage',
        paramPath: 'inputs.filename_prefix', // ComfyUI requires this as an input
        fallbackPath: 'widgets_values[0]',
        applyToNode: (node, value) => {
          // Ensure inputs exists
          if (!node.inputs) {
            node.inputs = {};
          }
          
          // Set the filename prefix in inputs.filename_prefix
          node.inputs.filename_prefix = value;
          
          // Also set in widgets_values for compatibility
          if (!node.widgets_values) {
            node.widgets_values = [];
          }
          node.widgets_values[0] = value;
          
          return true;
        }
      },
      
      cfgScale: {
        type: 'number',
        description: 'CFG scale for guidance',
        nodeType: 'KSampler',
        paramPath: 'inputs.cfg',
        fallbackPath: null
      },
      guidanceScale: {
        type: 'number',
        description: 'Guidance scale for Flux',
        nodeType: 'FluxGuidance',
        paramPath: 'widgets_values[0]',
        fallbackPath: null
      },
      // Special parameters for image inputs
      inputImageUrl: {
        type: 'string',
        description: 'URL to input image for depth map',
        nodeType: 'LoadImage',
        paramPath: 'widgets_values[0]',
        fallbackPath: null,
        condition: node => node.inputs && node.inputs.image_name === 'depth_input'
      },
      reduxImageUrl: {
        type: 'string',
        description: 'URL to redux reference image',
        nodeType: 'LoadImage',
        paramPath: 'widgets_values[0]',
        fallbackPath: null,
        condition: node => node.inputs && node.inputs.image_name === 'redux_reference'
      }
    }
  }
  // Add more workflows to the registry as needed
};

/**
 * Load a workflow from the registry by name
 * @param {string} workflowName - Name of the workflow in the registry
 * @returns {Promise<Object>} - The loaded workflow in API format
 */
export async function loadWorkflow(workflowName) {
  const registryEntry = workflowRegistry[workflowName];
  
  if (!registryEntry) {
    throw new Error(`Workflow "${workflowName}" not found in registry`);
  }
  
  try {
    // Dynamic import of the workflow JSON file
    const workflowModule = await import(/* @vite-ignore */ `../workflows/${registryEntry.file}`);
    const workflowData = workflowModule.default;
    
    // Convert to API format if needed
    const apiWorkflow = convertToAPIFormat(workflowData);
    
    return apiWorkflow;
  } catch (error) {
    console.error(`Error loading workflow "${workflowName}":`, error);
    throw new Error(`Failed to load workflow: ${error.message}`);
  }
}

/**
 * Convert a workflow to the API format expected by ComfyUI
 * @param {Object} workflow - The workflow to convert
 * @returns {Object} - The workflow in API format
 */
export function convertToAPIFormat(workflow) {
  // If the workflow is already in API format (object with nodes as keys)
  if (!workflow.nodes && typeof workflow === 'object' && !Array.isArray(workflow)) {
    return workflow;
  }
  
  // If it's in editor format (with nodes array), convert it
  if (workflow.nodes && Array.isArray(workflow.nodes)) {
    return convertEditorWorkflowToAPIFormat(workflow);
  }
  
  throw new Error('Unsupported workflow format');
}

/**
 * Find all nodes of a specific type in a workflow
 * @param {Object} workflow - The workflow in API format
 * @param {string} classType - The class_type to search for
 * @returns {Array} - Array of objects with node id and node data
 */
export function findNodesByType(workflow, classType) {
  return Object.entries(workflow)
    .filter(([, node]) => node.class_type === classType)
    .map(([id, node]) => ({ id, node }));
}

/**
 * Get a value from an object using a path string
 * @param {Object} obj - The object to get the value from
 * @param {string} path - The path to the value (e.g., 'inputs.text' or 'widgets_values[0]')
 * @returns {any} - The value at the path, or undefined if not found
 */
export function getValueByPath(obj, path) {
  if (!path) return undefined;
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (part.includes('[')) {
      const [arrayName, indexStr] = part.split('[');
      const index = parseInt(indexStr.replace(']', ''));
      
      if (!current[arrayName] || !Array.isArray(current[arrayName])) {
        return undefined;
      }
      
      current = current[arrayName][index];
    } else {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }
  }
  
  return current;
}

/**
 * Set a value in an object using a path string
 * @param {Object} obj - The object to set the value in
 * @param {string} path - The path to set (e.g., 'inputs.text' or 'widgets_values[0]')
 * @param {any} value - The value to set
 * @returns {boolean} - True if the value was set, false otherwise
 */
function setValueByPath(obj, path, value) {
  if (!path) return false;
  
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part.includes('[')) {
      const [arrayName, indexStr] = part.split('[');
      const index = parseInt(indexStr.replace(']', ''));
      
      if (i === parts.length - 1) {
        // Last part, set the value
        if (!current[arrayName]) {
          current[arrayName] = [];
        }
        
        // Ensure the array is long enough
        while (current[arrayName].length <= index) {
          current[arrayName].push(undefined);
        }
        
        current[arrayName][index] = value;
        return true;
      } else {
        // Not the last part, navigate deeper
        if (!current[arrayName]) {
          current[arrayName] = [];
        }
        
        if (!current[arrayName][index]) {
          current[arrayName][index] = {};
        }
        
        current = current[arrayName][index];
      }
    } else {
      if (i === parts.length - 1) {
        // Last part, set the value
        current[part] = value;
        return true;
      } else {
        // Not the last part, navigate deeper
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }
  
  return false;
}

/**
 * Apply parameters to a workflow based on parameter mappings
 * @param {Object} workflow - The workflow in API format
 * @param {Object} parameters - The parameters to apply
 * @param {Object} parameterMappings - The parameter mappings from the registry
 * @returns {Object} - The modified workflow
 */
export function applyParametersToWorkflow(workflow, parameters, parameterMappings) {
  // Create a deep copy of the workflow to avoid modifying the original
  const modifiedWorkflow = JSON.parse(JSON.stringify(workflow));
  
  // Apply each parameter
  for (const [paramName, paramValue] of Object.entries(parameters)) {
    if (paramValue === undefined || paramValue === null) continue;
    
    const mapping = parameterMappings[paramName];
    if (!mapping) continue;
    
    // Special handling for image URLs
    if (paramName === 'inputImageUrl' || paramName === 'reduxImageUrl') {
      if (!paramValue) continue; // Skip if no image URL provided
      
      // Find LoadImage nodes
      const imageNodes = findNodesByType(modifiedWorkflow, 'LoadImage');
      
      // For inputImageUrl, find the node for depth input
      // For reduxImageUrl, find the node for redux reference
      let targetNodes = [];
      
      if (mapping.condition) {
        targetNodes = imageNodes.filter(({ node }) => mapping.condition(node));
      } else {
        // Fallback to using all LoadImage nodes if no condition specified
        targetNodes = imageNodes;
      }
      
      if (targetNodes.length === 0) {
        console.warn(`No LoadImage nodes found for ${paramName}`);
        continue;
      }
      
      // Apply the URL to each matching node
      for (const { id, node } of targetNodes) {
        let applied = false;
        
        // Try primary path first
        if (mapping.paramPath) {
          applied = setValueByPath(node, mapping.paramPath, paramValue);
        }
        
        // If primary path failed, try fallback path
        if (!applied && mapping.fallbackPath) {
          applied = setValueByPath(node, mapping.fallbackPath, paramValue);
        }
        
        if (applied) {
          console.log(`Applied ${paramName} to node ${id}`);
        } else {
          console.warn(`Could not apply ${paramName} to node ${id}`);
        }
      }
      
      continue; // Skip the regular parameter application for image URLs
    }
    
    // Regular parameter application
    const matchingNodes = findNodesByType(modifiedWorkflow, mapping.nodeType)
      .filter(({ node }) => mapping.condition ? mapping.condition(node) : true);
    
    if (matchingNodes.length === 0) {
      console.warn(`No nodes found for parameter "${paramName}" with type "${mapping.nodeType}"`);
      continue;
    }
    
    // Apply the parameter to each matching node
    for (const { id, node } of matchingNodes) {
      let applied = false;
      
      // Use custom apply function if available
      if (mapping.applyToNode) {
        applied = mapping.applyToNode(node, paramValue);
      } else {
        // Try primary path first
        if (mapping.paramPath) {
          applied = setValueByPath(node, mapping.paramPath, paramValue);
        }
        
        // If primary path failed, try fallback path
        if (!applied && mapping.fallbackPath) {
          applied = setValueByPath(node, mapping.fallbackPath, paramValue);
        }
      }
      
      if (applied) {
        console.log(`Applied parameter "${paramName}" to node ${id}`);
      } else {
        console.warn(`Could not apply parameter "${paramName}" to node ${id}`);
      }
    }
        // Add debug logging
    console.log('SaveImage nodes before sending to ComfyUI:');
    Object.entries(modifiedWorkflow).forEach(([id, node]) => {
      if (node.class_type === 'SaveImage') {
        console.log(`Node ${id}:`, JSON.stringify(node, null, 2));
      }
    });
  }
  
  return modifiedWorkflow;
}

/**
 * Apply parameters to a workflow from the registry
 * @param {Object} workflow - The workflow in API format
 * @param {Object} parameters - The parameters to apply
 * @param {string} workflowName - The name of the workflow in the registry
 * @returns {Object} - The modified workflow
 */
export function applyParameters(workflow, parameters, workflowName) {
  const registryEntry = workflowRegistry[workflowName];
  
  if (!registryEntry) {
    throw new Error(`Workflow "${workflowName}" not found in registry`);
  }
  
  return applyParametersToWorkflow(workflow, parameters, registryEntry.parameters);
}

/**
 * Load a workflow and apply parameters in one step
 * @param {string} workflowName - The name of the workflow in the registry
 * @param {Object} parameters - The parameters to apply
 * @returns {Promise<Object>} - The loaded and modified workflow
 */
export async function loadAndApplyParameters(workflowName, parameters) {
  const workflow = await loadWorkflow(workflowName);
  return applyParameters(workflow, parameters, workflowName);
}

/**
 * Generate a timestamp for use in filenames
 * @returns {number} - Unix timestamp in seconds
 */
export function generateTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Create a complete workflow payload for submission to ComfyUI
 * @param {string} workflowName - The name of the workflow in the registry
 * @param {Object} parameters - The parameters to apply
 * @returns {Promise<Object>} - The complete payload with workflow and client_id
 */
// Then update createWorkflowPayload to use these functions

export async function createWorkflowPayload(workflowName, parameters) {
  const timestamp = generateTimestamp();
  
  // Add timestamp to parameters if filename prefix is specified
  const paramsWithTimestamp = {
    ...parameters,
    filenamePrefix: parameters.filenamePrefix 
      ? `${parameters.filenamePrefix}_${timestamp}`
      : `output_${timestamp}`
  };
  
  // Load and apply parameters
  let workflow = await loadAndApplyParameters(workflowName, paramsWithTimestamp);
  
  // Fix any issues in SaveImage nodes
  workflow = fixSaveImageNodes(workflow);
  
  // Validate SaveImage nodes
  const isValid = validateSaveImageNodes(workflow);
  
  if (!isValid) {
    console.warn('Workflow validation issues detected, but attempting to send anyway');
  }
  
  return {
    workflow,
    timestamp,
    payload: {
      prompt: workflow,
      client_id: `workflow-${workflowName}-${timestamp}`
    }
  };
}


/**
 * Validates all SaveImage nodes in a workflow
 * @param {Object} workflow - The workflow to validate
 * @returns {boolean} - Returns true if all SaveImage nodes are valid
 */
// 3. Update the validateSaveImageNodes function to check that filename_prefix is in inputs
export function validateSaveImageNodes(workflow) {
  let isValid = true;
  
  Object.entries(workflow).forEach(([id, node]) => {
    if (node.class_type === 'SaveImage') {
      // Check that inputs exists and contains required properties
      if (!node.inputs) {
        console.error(`Node ${id}: SaveImage missing inputs object`);
        isValid = false;
      } else {
        // Check that filename_prefix exists in inputs
        if (!node.inputs.filename_prefix) {
          console.error(`Node ${id}: SaveImage missing required input filename_prefix`);
          isValid = false;
        }
        
        // Check that images exists and has correct format
        if (!node.inputs.images) {
          console.error(`Node ${id}: SaveImage missing required input images`);
          isValid = false;
        } else if (!Array.isArray(node.inputs.images) || node.inputs.images.length !== 2) {
          console.error(`Node ${id}: SaveImage has invalid images format: ${JSON.stringify(node.inputs.images)}`);
          isValid = false;
        } else if (node.inputs.images[1] !== 0) {
          console.error(`Node ${id}: SaveImage has invalid output index in images: ${node.inputs.images[1]}, should be 0`);
          isValid = false;
        }
      }
      
      // Check that widgets_values exists and matches inputs.filename_prefix
      if (!node.widgets_values || !Array.isArray(node.widgets_values) || node.widgets_values.length === 0) {
        console.error(`Node ${id}: SaveImage missing or invalid widgets_values`);
        isValid = false;
      } else if (node.inputs && node.inputs.filename_prefix && node.widgets_values[0] !== node.inputs.filename_prefix) {
        console.error(`Node ${id}: SaveImage widgets_values[0] doesn't match inputs.filename_prefix`);
        isValid = false;
      }
    }
  });
  
  return isValid;
}


/**
 * Fixes issues in SaveImage nodes
 * @param {Object} workflow - The workflow to fix
 * @returns {Object} - The fixed workflow
 */
// 2. Update the fixSaveImageNodes function
export function fixSaveImageNodes(workflow) {
  // Create a deep copy to avoid modifying the original
  const fixedWorkflow = JSON.parse(JSON.stringify(workflow));
  
  // Fix all nodes with inputs.images to ensure correct output index
  Object.entries(fixedWorkflow).forEach(([id, node]) => {
    // Fix any node that has inputs.images array
    if (node.inputs && node.inputs.images && Array.isArray(node.inputs.images) && node.inputs.images.length === 2) {
      // Always set output index to 0 to avoid "tuple index out of range" errors
      node.inputs.images = [node.inputs.images[0], 0];
    }
    
    // Additional fixes specifically for SaveImage nodes
    if (node.class_type === 'SaveImage') {
      // Ensure filename_prefix is in inputs and matches widgets_values[0]
      if (!node.inputs) {
        node.inputs = {};
      }
      
      // Get the filename prefix from widgets_values[0] if it exists
      if (node.widgets_values && node.widgets_values.length > 0) {
        node.inputs.filename_prefix = node.widgets_values[0];
      } else if (!node.inputs.filename_prefix) {
        // Default fallback if no prefix is found
        node.inputs.filename_prefix = "output";
        
        // Also set widgets_values for consistency
        if (!node.widgets_values) {
          node.widgets_values = [];
        }
        node.widgets_values[0] = "output";
      }
    }
  });
  
  return fixedWorkflow;
}




// Update default export to include the new functions
export default {
  workflowRegistry,
  loadWorkflow,
  findNodesByType,
  applyParameters,
  loadAndApplyParameters,
  createWorkflowPayload,
  validateSaveImageNodes,
  fixSaveImageNodes
};