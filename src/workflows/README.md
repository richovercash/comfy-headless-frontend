# Dynamic Workflow Import System

This system allows importing ComfyUI workflows from JSON files without hardcoding node IDs or structure. It provides a flexible way to use different workflows with dynamic parameter mapping.

## How It Works

1. **Workflow Registry**: Workflows are registered in the `workflowImporter.js` file with metadata about their parameters.
2. **Dynamic Parameter Mapping**: Parameters are mapped to specific node types rather than hardcoded node IDs.
3. **Automatic Node Finding**: The system finds nodes by their type and applies parameters accordingly.
4. **Flexible Path Resolution**: Parameters can be applied to different paths (widgets_values or inputs) with fallbacks.

## Using the System

### Adding a New Workflow

1. Export your workflow from ComfyUI as a JSON file
2. Place the JSON file in the `src/workflows` directory
3. Register the workflow in the `workflowRegistry` in `src/utils/workflowImporter.js`:

```javascript
'your-workflow-name': {
  file: 'YourWorkflow.json',
  description: 'Description of your workflow',
  parameters: {
    prompt: { 
      type: 'string', 
      description: 'Text prompt for generation',
      nodeType: 'CLIPTextEncode',
      paramPath: 'widgets_values[0]',
      fallbackPath: 'inputs.text',
      condition: node => !node.inputs || !node.inputs.negative // Only target positive prompt nodes
    },
    // Add more parameters as needed
  }
}
```

### Parameter Mapping

For each parameter, define:

- `type`: The data type ('string', 'number', etc.)
- `description`: Human-readable description
- `nodeType`: The class_type of nodes to target
- `paramPath`: Primary path to set the parameter (e.g., 'widgets_values[0]')
- `fallbackPath`: Alternative path if primary fails (e.g., 'inputs.text')
- `condition`: (Optional) Function to filter matching nodes

### Using in Components

```javascript
import ComfyService from '../services/comfyService';

// Create and queue a workflow
const result = await ComfyService.createAndQueueWorkflow('your-workflow-name', {
  prompt: 'Your prompt text',
  steps: 30,
  seed: 12345,
  // Other parameters as defined in the registry
});
```

## Available Workflows

### vehicle-generation

A workflow for generating post-apocalyptic vehicles.

**Parameters:**
- `prompt`: Text prompt for generation
- `negativePrompt`: Negative prompt to avoid unwanted elements
- `steps`: Number of sampling steps
- `seed`: Random seed for generation
- `width`: Image width
- `height`: Image height
- `filenamePrefix`: Prefix for saved files
- `guidanceScale`: Guidance scale for Flux

## Extending the System

To add support for new parameter types or node types:

1. Update the parameter mapping in the workflow registry
2. Extend the `applyParametersToWorkflow` function in `workflowImporter.js` if needed
3. Add any specialized handling in the `DynamicWorkflowForm.jsx` component

## Benefits

- No hardcoded node IDs that break when workflows change
- Easy to add new workflows without modifying code
- Consistent parameter handling across different workflows
- Better separation of concerns between UI and workflow logic
