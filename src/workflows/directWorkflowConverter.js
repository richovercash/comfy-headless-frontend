// src/workflows/directWorkflowConverter.js
import workflowData from './Redux-Simple.json';

/**
 * List of UI-only node types to remove
 */
const UI_NODE_TYPES = [
  'SetNode',
  'GetNode',
  'Fast Groups Muter (rgthree)',
  'Bookmark (rgthree)',
  'Note', 
  'Note Plus (mtb)',
  'PreviewImage',
  'MaraScottDisplayInfo_v2'
];

/**
 * Directly convert a ComfyUI editor workflow to API format
 * by removing only UI nodes and preserving all execution nodes
 * @param {Object} editorWorkflow - ComfyUI editor workflow
 * @returns {Object} API-compatible workflow
 */
export function convertToAPIWorkflow(editorWorkflow) {
  // Create a map to track node ID remapping
  const nodeIdMap = new Map();
  
  // First pass: filter nodes and create a clean API workflow
  const apiWorkflow = {};
  let nodeCounter = 1;
  
  // Filter out UI nodes and create API nodes
  editorWorkflow.nodes.forEach(node => {
    if (!UI_NODE_TYPES.includes(node.type)) {
      // Create an API node with its original ID for now
      apiWorkflow[node.id] = {
        class_type: node.type,
        inputs: {}
      };
      
      // Copy widget values if they exist
      if (node.widgets_values) {
        apiWorkflow[node.id].widgets_values = [...node.widgets_values];
      }
      
      // Map the original node ID to a sequential ID
      nodeIdMap.set(node.id, nodeCounter++);
    }
  });
  
  // Build a map of links from source to target
  const linkMap = new Map();
  editorWorkflow.links.forEach(link => {
    const [_, sourceNodeId, sourceSlot, targetNodeId, targetSlot] = link;
    
    // Skip links involving UI nodes
    const sourceNode = editorWorkflow.nodes.find(n => n.id === sourceNodeId);
    const targetNode = editorWorkflow.nodes.find(n => n.id === targetNodeId);
    
    if (!sourceNode || !targetNode || 
        UI_NODE_TYPES.includes(sourceNode.type) || 
        UI_NODE_TYPES.includes(targetNode.type)) {
      return;
    }
    
    // Store the link information
    if (!linkMap.has(targetNodeId)) {
      linkMap.set(targetNodeId, []);
    }
    
    linkMap.get(targetNodeId).push({
      targetSlot,
      sourceNodeId,
      sourceSlot
    });
  });
  
  // Second pass: Set up input connections
  Object.keys(apiWorkflow).forEach(nodeId => {
    const apiNode = apiWorkflow[nodeId];
    const editorNode = editorWorkflow.nodes.find(n => n.id === parseInt(nodeId));
    
    if (!editorNode || !editorNode.inputs) return;
    
    // Get links targeting this node
    const links = linkMap.get(parseInt(nodeId)) || [];
    
    // Process each input
    editorNode.inputs.forEach((input, inputIndex) => {
      // Find a link that targets this input slot
      const link = links.find(l => l.targetSlot === inputIndex);
      
      if (link) {
        const sourceId = link.sourceNodeId;
        
        // Only add if the source is an execution node (not UI node)
        if (apiWorkflow[sourceId]) {
          apiNode.inputs[input.name] = [sourceId.toString(), link.sourceSlot];
        }
      }
    });
  });
  
  // Fix potential compatibility issues
  Object.values(apiWorkflow).forEach(node => {
    // Fix DualCLIPLoader
    if (node.class_type === 'DualCLIPLoader' && node.inputs.type === 'dual') {
      node.inputs.type = 'flux';
    }
  });
  
  return apiWorkflow;
}

/**
 * Create a workflow from the original with customizations applied
 * @param {Object} options - Customization options
 * @returns {Object} - { workflow, timestamp }
 */
export function createDirectWorkflow(options = {}) {
  const {
    prompt,
    steps = 28,
    filenamePrefix = 'Otherides-2d/direct_'
  } = options;
  
  const timestamp = Math.floor(Date.now()/1000);
  
  // Convert the editor workflow to API format
  const workflow = convertToAPIWorkflow(workflowData);
  
  // Apply customizations
  if (prompt) {
    // Find CLIPTextEncode nodes
    Object.values(workflow).forEach(node => {
      if (node.class_type === 'CLIPTextEncode' && node.widgets_values) {
        // Find the positive prompt node (typically has a longer prompt)
        if (node.widgets_values[0] && 
            typeof node.widgets_values[0] === 'string' && 
            node.widgets_values[0].length > 50) {
          // This is likely the main prompt node
          node.widgets_values[0] = prompt;
        }
      }
    });
  }
  
  // Set steps in sampler nodes
  Object.values(workflow).forEach(node => {
    if ((node.class_type === 'KSampler' || node.class_type === 'BasicScheduler') && 
        node.widgets_values && node.widgets_values.length > 1) {
      // Step count is typically the second widget value
      node.widgets_values[1] = steps;
    }
  });
  
  // Set random seed in RandomNoise nodes
  Object.values(workflow).forEach(node => {
    if (node.class_type === 'RandomNoise' && node.widgets_values) {
      node.widgets_values[0] = Math.floor(Math.random() * 1000000);
    }
  });
  
  // Set filename prefix in SaveImage nodes
  Object.values(workflow).forEach(node => {
    if (node.class_type === 'SaveImage') {
      if (node.inputs && node.inputs.filename_prefix) {
        node.inputs.filename_prefix = `${filenamePrefix}${timestamp}`;
      } else if (node.widgets_values) {
        node.widgets_values[0] = `${filenamePrefix}${timestamp}`;
      }
    }
  });
  
  return { workflow, timestamp };
}

export default { createDirectWorkflow };