// src/workflows/directFluxWorkflow.js

// Import your original workflow
import workflowData from './Redux-Simple.json';

/**
 * Prepare a workflow from the original JSON file
 * Just fixing one issue: DualCLIPLoader type parameter
 * @param {Object} options - Customization options 
 * @returns {Object} The prepared workflow and timestamp
 */
export function createDirectFluxWorkflow(options = {}) {
  const {
    prompt = 'neon-mist, cpstyle, rock!, Gatling_mounted, madocalypse, truck',
    steps = 28,
    filenamePrefix = 'Otherides-2d'
  } = options;
  
  const timestamp = Math.floor(Date.now()/1000);
  
  // Start with the nodes from the original workflow
  let workflow = {};
  
  // Just use the nodes directly
  if (workflowData.nodes) {
    workflowData.nodes.forEach(node => {
      workflow[node.id] = {
        class_type: node.type
      };
      
      // Copy inputs if they exist
      if (node.inputs && Array.isArray(node.inputs)) {
        workflow[node.id].inputs = {};
        node.inputs.forEach((input, index) => {
          // Find the link for this input
          const link = workflowData.links?.find(l => 
            l[3] === node.id && l[4] === index
          );
          
          if (link) {
            // Format: [sourceNodeId, outputIndex]
            workflow[node.id].inputs[input.name] = [
              link[1].toString(), // Source node ID
              link[2] // Output index
            ];
          }
        });
      }
      
      // Copy widget values if they exist
      if (node.widgets_values) {
        workflow[node.id].widgets_values = [...node.widgets_values];
      }
    });
  }
  
  // Fix the DualCLIPLoader type
  Object.values(workflow).forEach(node => {
    if (node.class_type === 'DualCLIPLoader') {
      // Check if using inputs or widgets_values
      if (node.inputs && node.inputs.type === 'dual') {
        node.inputs.type = 'flux';
      }
    }
  });
  
  // Set the prompt in CLIPTextEncode node
  const promptNodes = Object.entries(workflow).filter(
    ([_, node]) => node.class_type === 'CLIPTextEncode'
  );
  
  // Find the main prompt node (typically node 52 based on your files)
  const mainPromptNode = workflow[52];
  if (mainPromptNode && mainPromptNode.widgets_values) {
    mainPromptNode.widgets_values[0] = prompt;
  }
  
  // Set steps in the scheduler node (typically node 15)
  const schedulerNode = workflow[15];
  if (schedulerNode && schedulerNode.widgets_values) {
    schedulerNode.widgets_values[1] = steps;
  }
  
  // Set random seed in the RandomNoise node (typically node 16)
  const noiseNode = workflow[16];
  if (noiseNode && noiseNode.widgets_values) {
    noiseNode.widgets_values[0] = Math.floor(Math.random() * 1000000);
  }
  
  // Set filename prefix in the Text Multiline node (typically node 25)
  const filenameNode = workflow[25];
  if (filenameNode && filenameNode.widgets_values) {
    filenameNode.widgets_values[0] = `${filenamePrefix}`;
  }
  
  return { workflow, timestamp };
}

export default { createDirectFluxWorkflow };