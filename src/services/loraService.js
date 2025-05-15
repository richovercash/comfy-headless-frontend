// src/services/loraService.js
import { supabase } from './supabaseService';

/**
 * Service for managing LoRAs (Low-Rank Adaptation models)
 */
class LoraService {
  /**
   * Fetch all available LoRAs
   * @returns {Promise<Array>} Array of LoRA objects
   */
  async getAllLoras() {
    try {
      console.log('Fetching all LoRAs from database');
      
      // Test connection first
      const testResponse = await supabase.from('loras').select('count(*)');
      console.log('Supabase test query response:', testResponse);
      
      // Now fetch the actual data
      const { data, error } = await supabase
        .from('loras')
        .select('*')
        .order('name');
        
      if (error) {
        console.error('Error fetching LoRAs:', error);
        throw error;
      }
      
      console.log(`Retrieved ${data?.length || 0} LoRAs from database`, data);
      return data || [];
    } catch (error) {
      console.error('Error in getAllLoras():', error);
      throw error;
    }
  }
  
  /**
   * Get a LoRA by ID
   * @param {string} id - LoRA UUID
   * @returns {Promise<Object>} LoRA object
   */
  async getLoraById(id) {
    try {
      const { data, error } = await supabase
        .from('loras')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        console.error(`Error fetching LoRA with ID ${id}:`, error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error(`Error in getLoraById(${id}):`, error);
      throw error;
    }
  }
  
  /**
   * Create or update a LoRA
   * @param {Object} lora - LoRA object
   * @returns {Promise<Object>} Created/updated LoRA
   */
  async saveLoRA(lora) {
    try {
      // If id is provided, update existing LoRA; otherwise create new one
      const { data, error } = lora.id 
        ? await supabase
            .from('loras')
            .update(lora)
            .eq('id', lora.id)
            .select()
        : await supabase
            .from('loras')
            .insert(lora)
            .select();
      
      if (error) {
        console.error('Error saving LoRA:', error);
        throw error;
      }
      
      return data?.[0];
    } catch (error) {
      console.error('Error in saveLoRA():', error);
      throw error;
    }
  }
  
  /**
   * Get all LoRAs used in a specific asset
   * @param {string} assetId - Asset UUID
   * @returns {Promise<Array>} Array of LoRA objects with usage information
   */
  async getLorasForAsset(assetId) {
    try {
      const { data, error } = await supabase
        .from('asset_loras')
        .select(`
          id,
          asset_id,
          lora_id,
          model_strength,
          clip_strength,
          activation_words,
          lora_order,
          loras(*)
        `)
        .eq('asset_id', assetId)
        .order('lora_order');
        
      if (error) {
        console.error(`Error fetching LoRAs for asset ${assetId}:`, error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error(`Error in getLorasForAsset(${assetId}):`, error);
      throw error;
    }
  }
  
  /**
   * Save LoRA associations for an asset
   * @param {string} assetId - Asset UUID
   * @param {Array} loras - Array of LoRA objects with usage parameters
   * @returns {Promise<Array>} Saved LoRA associations
   */
  async saveAssetLoras(assetId, loras) {
    try {
      console.log(`Saving ${loras.length} LoRAs for asset ${assetId}`);
      
      // First, delete any existing associations
      const { error: deleteError } = await supabase
        .from('asset_loras')
        .delete()
        .eq('asset_id', assetId);
        
      if (deleteError) {
        console.error(`Error deleting existing LoRAs for asset ${assetId}:`, deleteError);
        throw deleteError;
      }
      
      // Only proceed with insert if there are LoRAs to save
      if (!loras || loras.length === 0) {
        return [];
      }
      
      // Format LoRAs for insertion
      const lorasToInsert = loras.map((lora, index) => ({
        asset_id: assetId,
        lora_id: lora.id,
        model_strength: lora.model_strength || 1.0,
        clip_strength: lora.clip_strength || 1.0,
        activation_words: lora.activation_words || '',
        lora_order: lora.lora_order || index + 1
      }));
      
      const { data, error } = await supabase
        .from('asset_loras')
        .insert(lorasToInsert)
        .select();
        
      if (error) {
        console.error(`Error saving LoRAs for asset ${assetId}:`, error);
        throw error;
      }
      
      console.log(`Successfully saved ${data.length} LoRA associations for asset ${assetId}`);
      
      return data || [];
    } catch (error) {
      console.error(`Error in saveAssetLoras(${assetId}):`, error);
      throw error;
    }
  }
  
  /**
   * Generate activation words prompt from LoRAs
   * @param {Array} loras - Array of LoRA objects with activation words
   * @returns {string} Concatenated activation words
   */
  generateActivationWordsPrompt(loras) {
    if (!loras || loras.length === 0) {
      return '';
    }
    
    // Filter out empty activation words and join with commas
    const activationWords = loras
      .filter(lora => lora.activation_words && lora.activation_words.trim() !== '')
      .map(lora => lora.activation_words.trim())
      .join(', ');
      
    return activationWords;
  }
  
  /**
   * Import LoRAs directly from ComfyUI
   * @returns {Promise<number>} Number of imported LoRAs
   */
  async importLorasFromComfyUI() {
    try {
      console.log("Attempting to import LoRAs from ComfyUI");
      
      // Get LoRA information directly from ComfyUI's API
      const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';
      const response = await fetch(`${API_BASE_URL}/object_info`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data from ComfyUI API: ${response.status}`);
      }
      
      const data = await response.json();
      const loras = [];
      
      // Extract LoRA information from the API response
      if (data?.FluxLoraLoader?.input?.required?.lora_name?.options) {
        const loraOptions = data.FluxLoraLoader.input.required.lora_name.options;
        
        Object.entries(loraOptions).forEach(([filePath, displayName]) => {
          if (filePath === 'None') return;
          
          // Extract name from the file path
          const name = filePath.split('/').pop().replace(/\.\w+$/, '');
          const folder = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') : 'Default';
          
          loras.push({
            name,
            file_path: filePath,
            display_name: displayName,
            category: folder
          });
        });
        
        console.log(`Found ${loras.length} LoRAs in ComfyUI`);
        
        // Save these LoRAs to our database
        if (loras.length > 0) {
          const { error } = await supabase
            .from('loras')
            .upsert(loras, { onConflict: 'file_path' });
            
          if (error) {
            console.error("Error saving LoRAs to database:", error);
            throw error;
          }
          
          console.log(`Successfully imported ${loras.length} LoRAs from ComfyUI`);
        }
        
        return loras.length;
      } else {
        console.warn("No LoRAs found in ComfyUI API response");
        return 0;
      }
    } catch (error) {
      console.error("Error importing LoRAs from ComfyUI:", error);
      throw error;
    }
  }
  
  /**
   * Update workflow with LoRA nodes and connections
   * @param {Object} workflow - ComfyUI workflow JSON
   * @param {Array} loras - Array of LoRA objects with settings
   * @returns {Object} Updated workflow
   */

  updateWorkflowWithLoras(workflow, loras) {
    if (!workflow || !loras || !Array.isArray(loras) || loras.length === 0) {
      console.log('No LoRAs to add to workflow or invalid inputs');
      return workflow;
    }
    
    console.log(`Adding ${loras.length} LoRAs to workflow:`, loras);
    
    // Filter out invalid LoRAs
    const validLoras = loras.filter(lora => lora && lora.file_path && lora.file_path !== 'None');
    
    if (validLoras.length === 0) {
      console.log('No valid LoRAs to add');
      return workflow;
    }
    
    // Clone the workflow to avoid modifying the original
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow));
    
    // Find the UNETLoader node (model node)
    const modelNodeId = Object.entries(updatedWorkflow).find(
      ([_, node]) => node && node.class_type === "UNETLoader"
    )?.[0];
    
    if (!modelNodeId) {
      console.error("No UNETLoader node found in workflow");
      return workflow; // Return original if no model node
    }
    
    // Find the CLIPLoader node
    const clipNodeId = Object.entries(updatedWorkflow).find(
      ([_, node]) => node && (node.class_type === "DualCLIPLoader" || node.class_type === "CLIPLoader")
    )?.[0];
    
    if (!clipNodeId) {
      console.error("No CLIP model node found in workflow");
      return workflow; // Return original if no CLIP node
    }
    
    console.log(`Found model node: ${modelNodeId}, clip node: ${clipNodeId}`);
    
    // Find nodes that connect to the model
    const modelConsumers = [];
    
    for (const [nodeId, node] of Object.entries(updatedWorkflow)) {
      if (node && node.inputs) {
        for (const [inputName, input] of Object.entries(node.inputs)) {
          if (Array.isArray(input) && input[0] === modelNodeId) {
            modelConsumers.push({
              nodeId,
              inputName,
              outputIndex: input[1] || 0
            });
          }
        }
      }
    }
    
    console.log(`Found ${modelConsumers.length} nodes connected to model node ${modelNodeId}`);
    
    // Start with a high node ID to avoid conflicts
    let nextNodeId = 500;
    
    // Create LoRA nodes and chain them
    let previousNodeId = modelNodeId;
    
    validLoras.forEach((lora, index) => {
      const currentNodeId = nextNodeId.toString();
      console.log(`Creating LoRA node ${currentNodeId} for ${lora.file_path}`);
      
      // Create the LoRA loader node
      updatedWorkflow[currentNodeId] = {
        "class_type": "FluxLoraLoader",
        "inputs": {
          "model": [previousNodeId, 0],
          "clip": [clipNodeId, 0],
          "lora_name": lora.file_path,
          "strength_model": parseFloat(lora.model_strength || 1.0),
          "strength_clip": parseFloat(lora.clip_strength || 1.0)
        },
        "_meta": {
          "title": `LoRA: ${lora.name || lora.file_path}`
        }
      };
      
      // Update chain for next LoRA
      previousNodeId = currentNodeId;
      nextNodeId++;
    });
    
    // If we've added any LoRAs, update the connections
    if (previousNodeId !== modelNodeId) {
      console.log(`Updating ${modelConsumers.length} connections to point to last LoRA node ${previousNodeId}`);
      
      // Update all nodes that were previously connected to the model
      modelConsumers.forEach(consumer => {
        // Only update if the consumer node still exists and isn't one of our LoRA nodes
        if (updatedWorkflow[consumer.nodeId] && parseInt(consumer.nodeId) < 500) {
          updatedWorkflow[consumer.nodeId].inputs[consumer.inputName] = [previousNodeId, consumer.outputIndex];
        }
      });
    }
    
    return updatedWorkflow;
  }







  
  /**
   * Test LoRA connectivity with ComfyUI
   * @returns {Promise<Object>} Status of the test
   */
  async testLoraConnectivity() {
    try {
      const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';
      
      // Step 1: Test basic ComfyUI connectivity
      console.log("Testing ComfyUI connectivity...");
      const systemResponse = await fetch(`${API_BASE_URL}/system_stats`, { timeout: 5000 });
      if (!systemResponse.ok) {
        return {
          success: false,
          message: `Cannot connect to ComfyUI API (HTTP ${systemResponse.status})`
        };
      }
      
      // Step 2: Check if we can access object_info
      console.log("Testing object_info endpoint...");
      const objectResponse = await fetch(`${API_BASE_URL}/object_info`);
      if (!objectResponse.ok) {
        return {
          success: false,
          message: `Cannot access object_info endpoint (HTTP ${objectResponse.status})`
        };
      }
      
      const data = await objectResponse.json();
      
      // Step 3: Check if the FluxLoraLoader node exists
      if (!data.FluxLoraLoader) {
        return {
          success: false,
          message: "FluxLoraLoader node not found in ComfyUI. Check if LoRA support is installed."
        };
      }
      
      // Step 4: Check if we have LoRA options
      const loraOptions = data?.FluxLoraLoader?.input?.required?.lora_name?.options;
      if (!loraOptions || Object.keys(loraOptions).length <= 1) { // Only "None" exists
        return {
          success: false,
          message: "No LoRAs found in ComfyUI. Check your models/loras directory."
        };
      }
      
      // Success!
      const loraCount = Object.keys(loraOptions).length - 1; // Subtract "None" option
      return {
        success: true,
        message: `Success! Found ${loraCount} LoRAs in ComfyUI.`,
        loraCount
      };
    } catch (error) {
      console.error("Error testing LoRA connectivity:", error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }



  // Add this to src/services/loraService.js

  /**
   * Debug LoRA workflow integration
   * @param {Object} workflow - Original workflow
   * @param {Array} loras - LoRAs being added
   * @returns {Object} Debug information
   */
  async debugLoraIntegration(workflow, loras) {
    const debugInfo = {
      comfyConnected: false,
      lorasAvailable: [],
      databaseLoras: [],
      workflowNodes: {},
      nodeConnections: [],
      errors: []
    };

        // Check for missing parameters
    if (!workflow) {
      debugInfo.errors.push("No workflow provided to debugLoraIntegration");
      return debugInfo;
    }
    
    if (!loras || !Array.isArray(loras)) {
      debugInfo.errors.push(`Invalid loras parameter: ${loras}`);
      loras = []; // Set to empty array to avoid errors
    }
    
    try {
      // 1. Check connection to ComfyUI
      console.log("Testing ComfyUI connection...");
      const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';
      
      try {
        const systemResponse = await fetch(`${API_BASE_URL}/system_stats`, {timeout: 5000});
        debugInfo.comfyConnected = systemResponse.ok;
        if (!systemResponse.ok) {
          debugInfo.errors.push(`ComfyUI connection failed: ${systemResponse.status}`);
        }
      } catch (e) {
        debugInfo.errors.push(`ComfyUI connection error: ${e.message}`);
      }
      
      // 2. Check available LoRAs in ComfyUI
      try {
        if (debugInfo.comfyConnected) {
          const objectResponse = await fetch(`${API_BASE_URL}/object_info`);
          if (objectResponse.ok) {
            const data = await objectResponse.json();
            if (data?.FluxLoraLoader?.input?.required?.lora_name?.options) {
              const loraOptions = data.FluxLoraLoader.input.required.lora_name.options;
              debugInfo.lorasAvailable = Object.entries(loraOptions)
                .filter(([path]) => path !== 'None')
                .map(([path, name]) => ({path, name}));
                
              console.log(`Found ${debugInfo.lorasAvailable.length} LoRAs in ComfyUI`);
            } else {
              debugInfo.errors.push('FluxLoraLoader node exists but no LoRAs found');
            }
          } else {
            debugInfo.errors.push(`Failed to get object_info: ${objectResponse.status}`);
          }
        }
      } catch (e) {
        debugInfo.errors.push(`Error querying ComfyUI LoRAs: ${e.message}`);
      }
      
      // 3. Check selected LoRAs from database/UI
      debugInfo.databaseLoras = loras.map(lora => ({
        id: lora.id,
        name: lora.name,
        file_path: lora.file_path, 
        model_strength: lora.model_strength,
        clip_strength: lora.clip_strength
      }));
      
      // 4. Check if selected LoRAs exist in ComfyUI
      for (const lora of debugInfo.databaseLoras) {
        const found = debugInfo.lorasAvailable.some(
          availableLora => availableLora.path === lora.file_path
        );
        
        if (!found) {
          debugInfo.errors.push(`LoRA ${lora.file_path} not found in ComfyUI`);
        }
      }
      
      // 5. Validate workflow structure for LoRA integration
      if (workflow) {
        // Extract key nodes and connections
        const modelNode = Object.entries(workflow).find(
          ([_, node]) => node.class_type === "UNETLoader"
        );
        
        if (modelNode) {
          debugInfo.workflowNodes.modelNode = modelNode[0];
        } else {
          debugInfo.errors.push("No UNETLoader node found in workflow");
        }
        
        // Find nodes that connect to the model
        if (debugInfo.workflowNodes.modelNode) {
          for (const [nodeId, node] of Object.entries(workflow)) {
            if (node.inputs) {
              for (const [inputName, input] of Object.entries(node.inputs)) {
                if (Array.isArray(input) && input[0] === debugInfo.workflowNodes.modelNode) {
                  debugInfo.nodeConnections.push({
                    nodeId,
                    type: node.class_type,
                    inputName
                  });
                }
              }
            }
          }
        }
      } else {
        debugInfo.errors.push("No workflow provided");
      }
      
      // 6. Verify updateWorkflowWithLoras function
      const testWorkflow = this.updateWorkflowWithLoras(workflow, loras);
      const loraNodesAdded = Object.values(testWorkflow).filter(
        node => node.class_type === "FluxLoraLoader"
      ).length;
      
      debugInfo.loraNodesAdded = loraNodesAdded;
      
      if (loraNodesAdded === 0 && loras.length > 0) {
        debugInfo.errors.push("updateWorkflowWithLoras didn't add any FluxLoraLoader nodes");
      }
      
      return debugInfo;
    } catch (error) {
      console.error("Error in debugLoraIntegration:", error);
      debugInfo.errors.push(`Unexpected error: ${error.message}`);
      return debugInfo;
    }
  }

  
  




  // src/services/loraService.js - Improved EasyLoraStack integration

  /**
   * Update workflow with EasyLoraStack for handling multiple LoRAs
   * @param {Object} workflow - ComfyUI workflow JSON
   * @param {Array} loras - Array of LoRA objects with settings
   * @returns {Object} Updated workflow with EasyLoraStack
   */
  updateWorkflowWithEasyLoraStack(workflow, loras) {
    if (!loras || loras.length === 0) {
      console.log('No LoRAs to add to workflow');
      return workflow;
    }
    
    // Clone the workflow to avoid modifying the original
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow));
    console.log(`Adding ${loras.length} LoRAs using EasyLoraStack:`, loras.map(l => l.file_path));
    
    // Find the model and clip nodes
    const modelNodeEntry = Object.entries(updatedWorkflow).find(
      ([_, node]) => node && node.class_type === "UNETLoader"
    );
    
    const clipNodeEntry = Object.entries(updatedWorkflow).find(
      ([_, node]) => node && (node.class_type === "DualCLIPLoader" || node.class_type === "CLIPLoader")
    );
    
    if (!modelNodeEntry) {
      console.error("No UNETLoader node found in workflow");
      return workflow;
    }
    
    const modelNodeId = modelNodeEntry[0];
    const clipNodeId = clipNodeEntry ? clipNodeEntry[0] : null;
    
    console.log(`Found model node: ${modelNodeId}, clip node: ${clipNodeId || 'None'}`);
    
    // Find nodes that connect to the model (to be replaced with LoraStack output)
    const modelConsumers = [];
    for (const [nodeId, node] of Object.entries(updatedWorkflow)) {
      if (node && node.inputs) {
        for (const [inputName, input] of Object.entries(node.inputs)) {
          if (Array.isArray(input) && input[0] === modelNodeId) {
            modelConsumers.push({
              nodeId,
              inputName,
              outputIndex: input[1] || 0
            });
          }
        }
      }
    }

    console.log(`Found ${modelConsumers.length} nodes connected to model`);

    // Create the EasyLoraStack node (using ID 91 to match the reference workflow)
    const loraStackNodeId = "91";
    
    // Create the base LoraStack node
    updatedWorkflow[loraStackNodeId] = {
      "inputs": {
        "toggle": true,
        "mode": "simple",
        "num_loras": Math.min(loras.length, 10)
      },
      "class_type": "easy loraStack",
      "_meta": {
        "title": "EasyLoraStack"
      }
    };
    
    // Add each LoRA to the stack (up to 10)
    const lorasToAdd = loras.slice(0, 10); // EasyLoraStack supports up to 10 LoRAs
    
    lorasToAdd.forEach((lora, index) => {
      const loraIndex = index + 1;
      
      // Add this LoRA to the stack
      updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_name`] = lora.file_path || "None";
      updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_strength`] = parseFloat(lora.strength || 1.0);
      updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_model_strength`] = parseFloat(lora.model_strength || 1.0);
      updatedWorkflow[loraStackNodeId].inputs[`lora_${loraIndex}_clip_strength`] = parseFloat(lora.clip_strength || 1.0);
    });
    
    // Fill in remaining LoRA slots with "None"
    for (let i = lorasToAdd.length + 1; i <= 10; i++) {
      updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_name`] = "None";
      updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_strength`] = 1.0;
      updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_model_strength`] = 1.0;
      updatedWorkflow[loraStackNodeId].inputs[`lora_${i}_clip_strength`] = 1.0;
    }
    
    // Create a CR Apply LoRA Stack node (using ID 110 to match the reference workflow)
    const crApplyNodeId = "110";
    updatedWorkflow[crApplyNodeId] = {
      "inputs": {
        "model": [modelNodeId, 0],
        "clip": [clipNodeId, 0],
        "lora_stack": [loraStackNodeId, 0]
      },
      "class_type": "CR Apply LoRA Stack",
      "_meta": {
        "title": "💊 CR Apply LoRA Stack"
      }
    };
    
    // Update model connections to use the CR Apply LoRA Stack output
    for (const consumer of modelConsumers) {
      if (updatedWorkflow[consumer.nodeId]) {
        // Update to use the model output from CR Apply LoRA Stack
        updatedWorkflow[consumer.nodeId].inputs[consumer.inputName] = [crApplyNodeId, 0];
      }
    }
    
    // Update CLIP connections to use the CR Apply LoRA Stack CLIP output
    if (clipNodeId) {
      for (const [nodeId, node] of Object.entries(updatedWorkflow)) {
        if (node?.inputs) {
          for (const [inputName, input] of Object.entries(node.inputs)) {
            if (Array.isArray(input) && input[0] === clipNodeId && nodeId !== crApplyNodeId) {
              // Update to use the CLIP output from CR Apply LoRA Stack
              updatedWorkflow[nodeId].inputs[inputName] = [crApplyNodeId, 1];
            }
          }
        }
      }
    }
    
    return updatedWorkflow;
  }







  async getAvailableLorasFromComfyUI() {
    try {
      console.log("Getting available LoRAs from ComfyUI");
      
      const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';
      const response = await fetch(`${API_BASE_URL}/object_info`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data from ComfyUI API: ${response.status}`);
      }
      
      const data = await response.json();
      const loras = [];
      
      // Check for 'easy loraStack' as it contains all the LoRAs
      if (data['easy loraStack']) {
        console.log("Found 'easy loraStack', extracting LoRAs");
        
        // In the easy loraStack node, LoRAs are stored in the lora_X_name optional fields
        const optional = data['easy loraStack'].input?.optional;
        
        if (optional) {
          for (let i = 1; i <= 10; i++) {
            const fieldName = `lora_${i}_name`;
            
            if (optional[fieldName] && Array.isArray(optional[fieldName])) {
              console.log(`Processing ${fieldName}`);
              
              // The actual array of LoRA options is in position 1 of the array, not 0
              // This is based on your console output showing "[0]" contains the array length
              if (optional[fieldName].length > 1 && Array.isArray(optional[fieldName][1])) {
                const loraOptions = optional[fieldName][1];
                
                loraOptions.forEach(option => {
                  if (option && option !== "None") {
                    // Avoid duplicates
                    if (!loras.some(l => l.file_path === option)) {
                      const name = option.split('/').pop().replace(/\.\w+$/, '');
                      const category = option.includes('/') ? option.split('/')[0] : 'Default';
                      
                      loras.push({
                        name,
                        file_path: option,
                        display_name: name,
                        category
                      });
                    }
                  }
                });
              }
            }
          }
        }
      }
      
      // Check FluxBlockLoraLoader if no LoRAs found yet
      if (loras.length === 0 && data.FluxBlockLoraLoader) {
        console.log("Checking FluxBlockLoraLoader");
        
        // Inspect the structure to see how LoRAs are defined
        console.log("FluxBlockLoraLoader structure:", data.FluxBlockLoraLoader.input);
        
        if (data.FluxBlockLoraLoader.input?.required?.lora_name?.[1]) {
          console.log("Found LoRA options in FluxBlockLoraLoader");
          
          // Try to parse the structure
          const loraOptions = data.FluxBlockLoraLoader.input.required.lora_name[1];
          
          // This could be an array of options
          if (Array.isArray(loraOptions)) {
            loraOptions.forEach(option => {
              if (option && option !== "None") {
                const name = typeof option === 'string' ? 
                            option.split('/').pop().replace(/\.\w+$/, '') : 'Unknown';
                
                // Avoid duplicates
                if (!loras.some(l => l.file_path === option)) {
                  loras.push({
                    name,
                    file_path: option,
                    display_name: name,
                    category: 'Flux'
                  });
                }
              }
            });
          }
        }
      }
      
      // Check LoraLoader as a fallback
      if (loras.length === 0 && data.LoraLoader?.input?.required?.lora_name?.options) {
        console.log("Found LoraLoader");
        const loraOptions = data.LoraLoader.input.required.lora_name.options;
        
        Object.entries(loraOptions).forEach(([filePath, displayName]) => {
          if (filePath === 'None') return;
          
          // Extract name from the file path
          const name = filePath.split('/').pop().replace(/\.\w+$/, '');
          const folder = filePath.includes('/') ? filePath.split('/')[0] : 'Default';
          
          // Avoid duplicates
          if (!loras.some(l => l.file_path === filePath)) {
            loras.push({
              name,
              file_path: filePath,
              display_name: displayName,
              category: folder
            });
          }
        });
      }
      
      // Check FluxLoraLoader if still no LoRAs found
      if (loras.length === 0 && data.FluxLoraLoader?.input?.required?.lora_name?.options) {
        console.log("Found FluxLoraLoader");
        const loraOptions = data.FluxLoraLoader.input.required.lora_name.options;
        
        Object.entries(loraOptions).forEach(([filePath, displayName]) => {
          if (filePath === 'None') return;
          
          // Extract name from the file path
          const name = filePath.split('/').pop().replace(/\.\w+$/, '');
          const folder = filePath.includes('/') ? filePath.split('/')[0] : 'Default';
          
          // Avoid duplicates
          if (!loras.some(l => l.file_path === filePath)) {
            loras.push({
              name,
              file_path: filePath,
              display_name: displayName,
              category: folder
            });
          }
        });
      }
      
      // If no LoRAs found through API methods, you might fall back to hardcoded values
      // but only as a last resort
      if (loras.length === 0) {
        console.warn("No LoRAs found through API methods, using hardcoded values as fallback");
        
        // Add some known Flux LoRAs as fallback
        const knownPaths = [
          "Flux/mjV6.safetensors", 
          "Flux/moody-fog.safetensors", 
          "Flux/neon-mist03-000015.safetensors"
        ];
        
        knownPaths.forEach(path => {
          const name = path.split('/').pop().replace(/\.\w+$/, '');
          
          loras.push({
            name,
            file_path: path,
            display_name: name,
            category: path.includes('/') ? path.split('/')[0] : 'Default'
          });
        });
      }
      
      console.log(`Found ${loras.length} LoRAs:`, loras);
      return loras;
    } catch (error) {
      console.error("Error getting available LoRAs from ComfyUI:", error);
      throw error;
    }
  }





  // Add this to loraService.js
  async testEasyLoraStackIntegration() {
    try {
      // 1. Fetch available LoRAs
      const loras = await this.getAvailableLorasFromComfyUI();
      console.log(`Found ${loras.length} LoRAs:`, loras);
      
      // 2. Create a test workflow
      const testWorkflow = {
        // Simple workflow with just a UNETLoader node to test LoRA integration
        "1": {
          "class_type": "UNETLoader",
          "inputs": {
            "unet_name": "blackforest/flux1-dev.sft"
          }
        },
        "2": {
          "class_type": "DualCLIPLoader",
          "inputs": {
            "clip_name1": "Flux/t5xxl_fp8_e4m3fn.safetensors",
            "clip_name2": "clip_l.safetensors"
          }
        }
      };
      
      // 3. Apply LoRAs using EasyLoraStack
      const testLoras = loras.slice(0, 3); // Just test with up to 3 LoRAs
      const workflowWithLoras = this.updateWorkflowWithEasyLoraStack(testWorkflow, testLoras);
      
      // 4. Verify the result
      const hasLoraStack = Object.values(workflowWithLoras).some(
        node => node.class_type === "easy loraStack"
      );
      
      const hasApplyStack = Object.values(workflowWithLoras).some(
        node => node.class_type === "apply_loraStack"
      );
      
      return {
        success: hasLoraStack && hasApplyStack,
        lorasFound: loras.length,
        lorasUsed: testLoras.length,
        hasLoraStack,
        hasApplyStack,
        workflow: workflowWithLoras
      };
    } catch (error) {
      console.error("Error testing EasyLoraStack integration:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

    // Add this to loraService.js
  async debugObjectInfo() {
    try {
      console.log("Getting raw object_info from ComfyUI");
      
      const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';
      const response = await fetch(`${API_BASE_URL}/object_info`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data from ComfyUI API: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if EasyLoraStack exists
      if (data.easyloraStack) {
        console.log("Found EasyLoraStack component:", data.easyloraStack);
        
        // Inspect each lora_X_name field to understand the structure
        for (let i = 1; i <= 10; i++) {
          const fieldName = `lora_${i}_name`;
          if (data.easyloraStack.input?.optional?.[fieldName]) {
            console.log(`Structure of ${fieldName}:`, JSON.stringify(data.easyloraStack.input.optional[fieldName]));
          }
        }
      } else {
        console.log("EasyLoraStack component not found");
      }
      
      // Also check for general LoRA information
      if (data.LoraLoader) {
        console.log("Found LoraLoader node:", data.LoraLoader.input?.required?.lora_name);
      }
      
      // Look for any field containing 'lora' to find where LoRAs might be defined
      console.log("Searching for 'lora' in object_info keys:");
      for (const key in data) {
        if (key.toLowerCase().includes('lora')) {
          console.log(`Found key '${key}'`);
        }
      }
      
      return {
        hasEasyLoraStack: !!data.easyloraStack,
        hasLoraLoader: !!data.LoraLoader,
        // Extract any fields that might contain LoRA paths
        possibleLoraFields: Object.keys(data).filter(key => 
          key.toLowerCase().includes('lora')
        )
      };
    } catch (error) {
      console.error("Error debugging object_info:", error);
      return {
        error: error.message
      };
    }
  }

    // Add this to your debug function
  async checkStandardLoraLoader() {
    try {
      const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';
      const response = await fetch(`${API_BASE_URL}/object_info`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data from ComfyUI API: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check LoraLoader specifically
      if (data.LoraLoader) {
        console.log("LoraLoader structure:", data.LoraLoader);
        
        if (data.LoraLoader.input?.required?.lora_name) {
          const loraNameField = data.LoraLoader.input.required.lora_name;
          console.log("LoraLoader.lora_name:", loraNameField);
          
          if (loraNameField.options) {
            console.log("LoraLoader options:", Object.keys(loraNameField.options));
            
            // Look for Flux LoRAs specifically
            const fluxLoras = Object.keys(loraNameField.options)
              .filter(key => key.includes("Flux/"));
              
            console.log("Flux LoRAs in LoraLoader:", fluxLoras);
            
            return {
              success: true,
              hasLoraLoader: true,
              loraCount: Object.keys(loraNameField.options).length - 1, // Subtract "None"
              fluxLoras
            };
          }
        }
      }
      
      return {
        success: false,
        hasLoraLoader: !!data.LoraLoader,
        message: "Could not find LoRA options in LoraLoader"
      };
    } catch (error) {
      console.error("Error checking LoraLoader:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

    /**
   * Debug EasyLoraStack integration
   * @returns {Promise<Object>} Debug information about EasyLoraStack usage
   */
  async debugEasyLoraStack() {
    try {
      const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';
      
      const debugInfo = {
        success: false,
        hasEasyLoraStack: false,
        hasCRApplyLoraStack: false,
        loraCount: 0,
        loraOptions: [],
        structure: null,
        errors: []
      };
      
      // Get the object_info to check for nodes
      const response = await fetch(`${API_BASE_URL}/object_info`);
      
      if (!response.ok) {
        debugInfo.errors.push(`Failed to fetch object_info: ${response.status}`);
        return debugInfo;
      }
      
      const data = await response.json();
      
      // Check for EasyLoraStack
      if (data['easy loraStack']) {
        debugInfo.hasEasyLoraStack = true;
        debugInfo.structure = data['easy loraStack'];
        
        // Examine the structure
        if (data['easy loraStack'].input?.optional) {
          console.log("Found EasyLoraStack options structure:", data['easy loraStack'].input.optional);
          
          // Log the detailed structure of the first LoRA field to understand format
          if (data['easy loraStack'].input.optional.lora_1_name) {
            console.log("LoRA field structure example:", 
              JSON.stringify(data['easy loraStack'].input.optional.lora_1_name));
            
            // Extract available LoRAs from the structure
            if (Array.isArray(data['easy loraStack'].input.optional.lora_1_name) && 
                data['easy loraStack'].input.optional.lora_1_name.length > 1) {
              
              const loraArray = data['easy loraStack'].input.optional.lora_1_name[1];
              if (Array.isArray(loraArray)) {
                debugInfo.loraCount = loraArray.length;
                debugInfo.loraOptions = loraArray.filter(name => name !== 'None');
                console.log(`Found ${debugInfo.loraOptions.length} LoRAs in EasyLoraStack`);
                
                // Check if the array contains Flux LoRAs specifically
                const fluxLoras = debugInfo.loraOptions.filter(name => 
                  name && name.includes('Flux/'));
                
                console.log(`Found ${fluxLoras.length} Flux LoRAs:`, fluxLoras);
                debugInfo.fluxLoras = fluxLoras;
              } else {
                debugInfo.errors.push("LoRA options not found in expected format");
              }
            }
          }
        }
      } else {
        debugInfo.errors.push("EasyLoraStack node not found");
      }
      
      // Check for CR Apply LoRA Stack
      if (data['CR Apply LoRA Stack']) {
        debugInfo.hasCRApplyLoraStack = true;
      } else {
        debugInfo.errors.push("CR Apply LoRA Stack node not found");
      }
      
      // If we have both required nodes, mark as success
      if (debugInfo.hasEasyLoraStack && debugInfo.hasCRApplyLoraStack) {
        debugInfo.success = true;
      }
      
      // Additional info - check for LoRAs in other nodes too
      const extraDebug = {};
      
      if (data.LoraLoader?.input?.required?.lora_name?.options) {
        extraDebug.loraLoaderCount = Object.keys(data.LoraLoader.input.required.lora_name.options).length;
      }
      
      if (data.FluxLoraLoader?.input?.required?.lora_name?.options) {
        extraDebug.fluxLoraLoaderCount = Object.keys(data.FluxLoraLoader.input.required.lora_name.options).length;
        extraDebug.fluxLoraLoaderNames = Object.keys(data.FluxLoraLoader.input.required.lora_name.options);
      }
      
      debugInfo.extraDebug = extraDebug;
      
      // Check loaded models to see if they might contain the necessary extensions
      if (data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.options) {
        const models = Object.keys(data.CheckpointLoaderSimple.input.required.ckpt_name.options);
        debugInfo.availableModels = models;
        console.log(`Found ${models.length} models`);
      }
      
      return debugInfo;
    } catch (error) {
      console.error("Error debugging EasyLoraStack:", error);
      return {
        success: false,
        errors: [`Error debugging EasyLoraStack: ${error.message}`]
      };
    }
  }




}
  

















export default new LoraService();