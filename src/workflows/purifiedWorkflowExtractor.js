// src/workflows/improvedWorkflowExtractor.js

import workflowData from './Redux-Simple.json';

/**
 * List of node types that are UI-only and should not be included in the API workflow
 */
const UI_ONLY_NODE_TYPES = [
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
 * Extract only the execution nodes from the workflow, removing UI-only nodes
 * and properly mapping inputs and widget values
 * @param {Object} editorWorkflow - The workflow from the ComfyUI editor
 * @returns {Object} - A cleaned workflow containing only execution nodes
 */
export function extractExecutionWorkflow(editorWorkflow) {
  if (!editorWorkflow.nodes || !Array.isArray(editorWorkflow.nodes) || !editorWorkflow.links) {
    console.error('Invalid workflow format - missing nodes or links');
    return null;
  }
  
  // Filter out UI-only nodes
  const executionNodes = editorWorkflow.nodes.filter(
    node => !UI_ONLY_NODE_TYPES.includes(node.type)
  );
  
  // Get IDs of execution nodes
  const executionNodeIds = new Set(executionNodes.map(node => node.id.toString()));
  
  // Build a map of link data
  const linkMap = new Map();
  editorWorkflow.links.forEach(link => {
    // Link format: [id, sourceNodeId, sourceSlot, targetNodeId, targetSlot]
    const [id, sourceNodeId, sourceSlot, targetNodeId, targetSlot] = link;
    
    if (!linkMap.has(targetNodeId)) {
      linkMap.set(targetNodeId, []);
    }
    
    linkMap.get(targetNodeId).push({
      targetSlot,
      sourceNodeId,
      sourceSlot
    });
  });
  
  console.log(`Original workflow: ${editorWorkflow.nodes.length} nodes, ${editorWorkflow.links.length} links`);
  console.log(`Execution workflow: ${executionNodes.length} nodes`);
  
  // Create a lookup map for node data
  const nodeMap = new Map();
  executionNodes.forEach(node => {
    nodeMap.set(node.id, node);
  });
  
  // Convert to API format
  const apiWorkflow = {};
  
  // Process all execution nodes
  executionNodes.forEach(node => {
    // Skip UI-only nodes
    if (UI_ONLY_NODE_TYPES.includes(node.type)) {
      return;
    }
    
    // Create basic node structure
    const apiNode = {
      class_type: node.type,
      inputs: {}
    };
    
    // Handle node inputs
    if (node.inputs && Array.isArray(node.inputs)) {
      // Look for connections to this node's inputs
      const connections = linkMap.get(node.id) || [];
      
      // Process each input
      node.inputs.forEach((input, index) => {
        // Find connection for this input
        const connection = connections.find(conn => conn.targetSlot === index);
        
        if (connection) {
          // Only add if source node is an execution node
          if (executionNodeIds.has(connection.sourceNodeId.toString())) {
            apiNode.inputs[input.name] = [
              connection.sourceNodeId.toString(),
              connection.sourceSlot
            ];
          }
        } else if (input.widget && input.widget.name) {
          // For widget-based inputs, use the widget value if available
          if (node.widgets_values && node.widgets_values.length > index) {
            apiNode.inputs[input.name] = node.widgets_values[index];
          }
        }
      });
    }
    
    // Copy widgets_values if they exist
    if (node.widgets_values && node.widgets_values.length > 0) {
      apiNode.widgets_values = [...node.widgets_values];
    }
    
    // Add to API workflow
    apiWorkflow[node.id] = apiNode;
  });
  
  // Add required input values for common nodes
  addRequiredInputValues(apiWorkflow);
  
  return apiWorkflow;
}

/**
 * Add required input values that might be missing
 * @param {Object} workflow - The API workflow to fix
 */
function addRequiredInputValues(workflow) {
  // Fix DualCLIPLoader
  Object.entries(workflow).forEach(([nodeId, node]) => {
    if (node.class_type === 'DualCLIPLoader') {
      // Ensure type is set to 'flux'
      if (!node.inputs.type || node.inputs.type === 'dual') {
        node.inputs.type = 'flux';
      }
    }
    
    // Fix RandomNoise
    if (node.class_type === 'RandomNoise') {
      if (!node.inputs.noise_seed && (!node.widgets_values || node.widgets_values.length === 0)) {
        node.inputs.noise_seed = Math.floor(Math.random() * 1000000);
      }
    }
    
    // Fix SaveImage
    if (node.class_type === 'SaveImage') {
      if (!node.inputs.filename_prefix) {
        node.inputs.filename_prefix = `ComfyUI_${Date.now()}`;
      }
    }
    
    // Fix EmptyLatentImage
    if (node.class_type === 'EmptyLatentImage') {
      if (!node.inputs.width) {
        node.inputs.width = 512;
      }
      if (!node.inputs.height) {
        node.inputs.height = 512;
      }
      if (!node.inputs.batch_size) {
        node.inputs.batch_size = 1;
      }
    }
    
    // Fix KSampler
    if (node.class_type === 'KSampler') {
      if (!node.inputs.seed) {
        node.inputs.seed = Math.floor(Math.random() * 1000000);
      }
      if (!node.inputs.steps) {
        node.inputs.steps = 20;
      }
      if (!node.inputs.cfg) {
        node.inputs.cfg = 7;
      }
      if (!node.inputs.sampler_name) {
        node.inputs.sampler_name = 'euler_ancestral';
      }
      if (!node.inputs.scheduler) {
        node.inputs.scheduler = 'normal';
      }
      if (!node.inputs.denoise) {
        node.inputs.denoise = 1;
      }
    }
    
    // Fix CLIPTextEncode
    if (node.class_type === 'CLIPTextEncode') {
      if (!node.inputs.text && node.widgets_values && node.widgets_values.length > 0) {
        node.inputs.text = node.widgets_values[0];
      }
    }
  });
}

/**
 * Create a simplified workflow based on core nodes from the original
 * This builds a workflow from scratch rather than trying to fix the complex one
 */
export function createSimplifiedWorkflow(options = {}) {
  const {
    prompt = 'neon-mist, post-apocalyptic vehicle',
    negativePrompt = 'low quality, bad anatomy, blurry, pixelated',
    steps = 28,
    filenamePrefix = 'Otherides-2d/simple_'
  } = options;
  
  const timestamp = Math.floor(Date.now()/1000);
  const seed = Math.floor(Math.random() * 1000000);
  
  // Create a simplified workflow with only the essential nodes
  const workflow = {
    // Model loader
    "1": {
      "class_type": "UNETLoader",
      "inputs": {
        "unet_name": "blackforest/flux1-depth-dev.safetensors",
        "weight_dtype": "fp8_e4m3fn"
      }
    },
    // CLIP loader
    "2": {
      "class_type": "DualCLIPLoader",
      "inputs": {
        "clip_name1": "Flux/t5xxl_fp16.safetensors",
        "clip_name2": "Flux/clip_l.safetensors",
        "text_encoder_1_name": "flux",
        "text_encoder_2_name": "default",
        "type": "flux"
      }
    },
    // VAE loader
    "3": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": "ae.sft"
      }
    },
    // Empty latent
    "4": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "width": 1024,
        "height": 1024,
        "batch_size": 1
      }
    },
    // Positive prompt
    "5": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["2", 0]
      }
    },
    // Negative prompt
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": negativePrompt,
        "clip": ["2", 0]
      }
    },
    // KSampler
    "7": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": 7,
        "sampler_name": "euler_ancestral",
        "scheduler": "normal",
        "denoise": 1,
        "model": ["1", 0],
        "positive": ["5", 0],
        "negative": ["6", 0],
        "latent_image": ["4", 0]
      }
    },
    // VAE Decode
    "8": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["7", 0],
        "vae": ["3", 0]
      }
    },
    // Save Image
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": `${filenamePrefix}${timestamp}`,
        "images": ["8", 0]
      }
    }
  };
  
  return { workflow, timestamp };
}

export default { 
  createSimplifiedWorkflow,
  extractExecutionWorkflow
};