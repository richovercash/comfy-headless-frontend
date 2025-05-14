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
   * Update workflow with LoRA nodes and connections
   * @param {Object} workflow - ComfyUI workflow JSON
   * @param {Array} loras - Array of LoRA objects with settings
   * @returns {Object} Updated workflow
   */
  updateWorkflowWithLoras(workflow, loras) {
    if (!loras || loras.length === 0) {
      console.log('No LoRAs to add to workflow');
      return workflow;
    }
    
    // Clone the workflow to avoid modifying the original
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow));
    console.log(`Adding ${loras.length} LoRAs to workflow`);
    
    // Add LoRA nodes starting from ID 200 to avoid conflicts
    let currentNodeId = 200;
    
    // Create a LoRA loader node - will be used by all LoRA nodes
    updatedWorkflow[currentNodeId] = {
      "class_type": "LoraLoader",
      "inputs": {
        "model": ["27", 0],
        "clip": ["26", 0],
        "lora_name": "None",
        "strength_model": 1.0,
        "strength_clip": 1.0
      }
    };
    const loraLoaderNodeId = currentNodeId;
    currentNodeId++;
    
    // Process each LoRA
    loras.forEach((lora) => {
      if (!lora.file_path || lora.file_path === "None") {
        console.log(`Skipping LoRA with missing file path: ${lora.name || 'unnamed'}`);
        return;
      }
      
      console.log(`Adding LoRA node for: ${lora.name || lora.file_path}`);
      
      // Create a LoRA node
      updatedWorkflow[currentNodeId] = {
        "class_type": "LoraLoader",
        "inputs": {
          "model": ["27", 0],
          "clip": ["26", 0],
          "lora_name": lora.file_path,
          "strength_model": lora.model_strength || 1.0,
          "strength_clip": lora.clip_strength || 1.0
        }
      };
      
      // If this is the first LoRA, connect it to model nodes
      // For subsequent LoRAs, chain them together
      if (currentNodeId === loraLoaderNodeId + 1) {
        // First LoRA gets connected directly to UNETLoader
        // Update nodes that previously connected to the UNET to now connect to this LoRA
        for (const nodeId in updatedWorkflow) {
          const node = updatedWorkflow[nodeId];
          
          if (node.inputs) {
            // Check each input for references to the model
            for (const inputName in node.inputs) {
              const input = node.inputs[inputName];
              if (Array.isArray(input) && input[0] === "27") {
                // This input is connected to the model, update it
                node.inputs[inputName] = [currentNodeId.toString(), 0];
              }
            }
          }
        }
      } else {
        // Chain LoRAs together - connect to previous LoRA
        const previousNodeId = currentNodeId - 1;
        // Update nodes that connected to the previous LoRA
        for (const nodeId in updatedWorkflow) {
          const node = updatedWorkflow[nodeId];
          
          if (node.inputs && nodeId !== currentNodeId.toString()) {
            // Check each input for references to the previous LoRA
            for (const inputName in node.inputs) {
              const input = node.inputs[inputName];
              if (Array.isArray(input) && input[0] === previousNodeId.toString()) {
                // This input is connected to the previous LoRA, update it
                node.inputs[inputName] = [currentNodeId.toString(), 0];
              }
            }
          }
        }
      }
      
      currentNodeId++;
    });
    
    return updatedWorkflow;
  }
  
  /**
   * Import LoRAs from ComfyUI's folder structure (server-side operation)
   * This is just a stub for the client - actual implementation requires server-side code
   * @returns {Promise<number>} Number of imported LoRAs
   */
  async importLorasFromComfyUI() {
    try {
      // Call backend API endpoint that scans ComfyUI directories
      const response = await fetch('/api/scan-lora-directories');
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to import LoRAs: ${error}`);
      }
      
      const { loras, count } = await response.json();
      
      // Process and insert the LoRAs into the database
      if (loras && loras.length > 0) {
        // Batch upsert LoRAs
        const { error } = await supabase
          .from('loras')
          .upsert(
            loras.map(lora => ({
              name: lora.name,
              file_path: lora.file_path,
              display_name: lora.display_name || lora.name,
              category: lora.category || 'Default'
            })),
            { onConflict: 'file_path' }
          );
          
        if (error) throw error;
      }
      
      return count;
    } catch (error) {
      console.error('Error importing LoRAs from ComfyUI:', error);
      throw error;
    }
  }
}

export default new LoraService();