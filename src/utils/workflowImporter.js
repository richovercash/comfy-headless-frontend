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
      filenamePrefix: {
        type: 'string',
        description: 'Prefix for saved files',
        nodeType: 'SaveImage',
        paramPath: 'inputs.filename_prefix',
        fallbackPath: 'widgets_values[0]'
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
    const workflowModule = await import(`../workflows/${registryEntry.file}`);
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
    
    // Find matching nodes
    const matchingNodes = findNodesByType(modifiedWorkflow, mapping.nodeType)
      .filter(({ node }) => mapping.condition ? mapping.condition(node) : true);
    
    if (matchingNodes.length === 0) {
      console.warn(`No nodes found for parameter "${paramName}" with type "${mapping.nodeType}"`);
      continue;
    }
    
    // Apply the parameter to each matching node
    for (const { id, node } of matchingNodes) {
      let applied = false;
      
      // Try primary path first
      if (mapping.paramPath) {
        applied = setValueByPath(node, mapping.paramPath, paramValue);
      }
      
      // If primary path failed, try fallback path
      if (!applied && mapping.fallbackPath) {
        applied = setValueByPath(node, mapping.fallbackPath, paramValue);
      }
      
      if (!applied) {
        console.warn(`Could not apply parameter "${paramName}" to node ${id}`);
      }
    }
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
export async function createWorkflowPayload(workflowName, parameters) {
  const timestamp = generateTimestamp();
  
  // Add timestamp to parameters if filename prefix is specified
  const paramsWithTimestamp = {
    ...parameters,
    filenamePrefix: parameters.filenamePrefix 
      ? `${parameters.filenamePrefix}_${timestamp}`
      : `output_${timestamp}`
  };
  
  const workflow = await loadAndApplyParameters(workflowName, paramsWithTimestamp);
  
  return {
    workflow,
    timestamp,
    payload: {
      prompt: workflow,
      client_id: `workflow-${workflowName}-${timestamp}`
    }
  };
}

export default {
  workflowRegistry,
  loadWorkflow,
  findNodesByType,
  applyParameters,
  loadAndApplyParameters,
  createWorkflowPayload
};
