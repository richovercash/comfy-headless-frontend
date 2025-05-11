// src/utils/workflowConverter.js

/**
 * Converts a ComfyUI editor workflow JSON to the API format expected by the backend
 * Handles the conversion of 'type' to 'class_type' and other necessary transformations
 * @param {Object} editorWorkflow - The workflow JSON from ComfyUI editor
 * @returns {Object} - Workflow in the format expected by ComfyUI API
 */
export const convertEditorWorkflowToAPIFormat = (editorWorkflow) => {
  // Create a new object for the API format
  const apiWorkflow = {};
  
  // If we're dealing with a workflow from the ComfyUI editor UI (has nodes array)
  if (editorWorkflow.nodes && Array.isArray(editorWorkflow.nodes)) {
    // Process each node in the array
    editorWorkflow.nodes.forEach(node => {
      // Create the API format node
      apiWorkflow[node.id] = {
        class_type: node.type, // Convert 'type' to 'class_type'
        inputs: {}
      };
      
      // Copy over any additional properties that might exist
      if (node.widgets_values) {
        apiWorkflow[node.id].widgets_values = [...node.widgets_values];
      }
      
      // Handle inputs if they exist
      if (node.inputs && Array.isArray(node.inputs)) {
        node.inputs.forEach(input => {
          if (input.link !== null && input.link !== undefined) {
            // Find the source node and output index from the links
            const sourceLink = findLinkById(editorWorkflow.links, input.link);
            if (sourceLink) {
              // Format: [source_node_id, output_index]
              apiWorkflow[node.id].inputs[input.name] = [
                sourceLink[0].toString(), // The source node ID
                sourceLink[2] // The output index
              ];
            }
          } else if (input.widget && input.widget.name) {
            // For widget inputs (values directly set in the node)
            const widgetIndex = node.widgets_values ? 
              node.widgets_values.findIndex(val => val === input.widget.value) : -1;
              
            if (widgetIndex >= 0) {
              apiWorkflow[node.id].inputs[input.name] = node.widgets_values[widgetIndex];
            }
          }
        });
      }
      
      // Special handling for SaveImage node
      if (node.type === 'SaveImage') {
        // Ensure filename_prefix is properly set in inputs
        if (node.widgets_values && node.widgets_values.length > 0) {
          apiWorkflow[node.id].inputs.filename_prefix = node.widgets_values[0];
        }
      }
    });
    
    return apiWorkflow;
  }
  
  // If the workflow is already in API format or close to it
  if (typeof editorWorkflow === 'object' && !Array.isArray(editorWorkflow)) {
    // Loop through all nodes
    Object.keys(editorWorkflow).forEach(nodeId => {
      const node = editorWorkflow[nodeId];
      
      // Ensure each node has class_type
      if (!node.class_type && node.type) {
        node.class_type = node.type; // Convert type to class_type if needed
      }
      
      // Validate that class_type exists
      if (!node.class_type) {
        console.error(`Node ${nodeId} is missing class_type property:`, node);
        throw new Error(`Node ${nodeId} is missing class_type property`);
      }
      
      // Make sure inputs is always an object
      if (!node.inputs) {
        node.inputs = {};
      }
    });
    
    return editorWorkflow;
  }
  
  // If we received something completely unexpected
  console.error("Unable to convert workflow format:", editorWorkflow);
  throw new Error("Invalid workflow format");
};

/**
 * Find a link in the links array by its ID
 * @param {Array} links - The array of links from the editor workflow
 * @param {number} linkId - The ID of the link to find
 * @returns {Array|null} - The link data [source_node, source_slot, dest_node, dest_slot] or null
 */
function findLinkById(links, linkId) {
  if (!links || !Array.isArray(links)) return null;
  
  const link = links.find(l => l[0] === linkId);
  if (link) {
    return [link[1], link[2], link[3], link[4]];
  }
  
  return null;
}

/**
 * Validates a workflow to ensure all nodes have the required properties
 * @param {Object} workflow - The workflow to validate
 * @returns {Object} - An object with isValid flag and any errors
 */
export const validateWorkflow = (workflow) => {
  let isValid = true;
  const errors = [];
  
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return { 
      isValid: false, 
      errors: ['Workflow must be an object'] 
    };
  }
  
  Object.keys(workflow).forEach(nodeId => {
    const node = workflow[nodeId];
    
    // Check if node has class_type
    if (!node.class_type) {
      isValid = false;
      errors.push(`Node ${nodeId} is missing class_type property`);
    }
    
    // Check if inputs is an object
    if (node.inputs && typeof node.inputs !== 'object') {
      isValid = false;
      errors.push(`Node ${nodeId} has invalid inputs (must be an object)`);
    }
  });
  
  return { isValid, errors };
};

// // Make both named exports and default export available
// export { convertEditorWorkflowToAPIFormat, validateWorkflow };

// Default export for convenience
export default {
  convertEditorWorkflowToAPIFormat,
  validateWorkflow
};
