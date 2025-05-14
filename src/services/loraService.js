// src/services/loraService.js - Updated for folder structure
import { supabase } from './supabaseService';

/**
 * Service for managing LoRAs
 */
class LoraService {
  /**
   * Fetch all available LoRAs
   * @returns {Promise<Array>} Array of LoRA objects
   */
  async getAllLoras() {
    const { data, error } = await supabase
      .from('loras')
      .select('*')
      .order('name');
      
    if (error) {
      console.error('Error fetching LoRAs:', error);
      throw error;
    }
    
    return data || [];
  }
  
  /**
   * Get a LoRA by ID
   * @param {string} id - LoRA UUID
   * @returns {Promise<Object>} LoRA object
   */
  async getLoraById(id) {
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
  }
  
  /**
   * Create or update a LoRA
   * @param {Object} lora - LoRA object
   * @returns {Promise<Object>} Created/updated LoRA
   */
  async saveLoRA(lora) {
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
  }
  
  /**
   * Get all LoRAs used in a specific asset
   * @param {string} assetId - Asset UUID
   * @returns {Promise<Array>} Array of LoRA objects with usage information
   */
  async getLorasForAsset(assetId) {
    const { data, error } = await supabase
      .from('asset_loras')
      .select(`
        id,
        model_strength,
        activation_words,
        lora_order,
        loras (*)
      `)
      .eq('asset_id', assetId)
      .order('lora_order');
      
    if (error) {
      console.error(`Error fetching LoRAs for asset ${assetId}:`, error);
      throw error;
    }
    
    return data || [];
  }
  
  /**
   * Save LoRA associations for an asset
   * @param {string} assetId - Asset UUID
   * @param {Array} loras - Array of LoRA objects with usage parameters
   * @returns {Promise<Array>} Saved LoRA associations
   */
  async saveAssetLoras(assetId, loras) {
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
    
    // Update the asset's lora_settings field with summary information
    const loraSummary = {
      count: loras.length,
      names: loras.map(l => l.name || 'Unnamed LoRA'),
      settings: loras.map(l => ({
        name: l.name,
        model_strength: l.model_strength,
        activation_words: l.activation_words,
        order: l.lora_order
      }))
    };
    
    await supabase
      .from('assets')
      .update({ lora_settings: loraSummary })
      .eq('id', assetId);
    
    return data || [];
  }
  
  /**
   * Update LoRA settings in ComfyService workflow
   * @param {Object} workflow - ComfyUI workflow JSON
   * @param {Array} loras - Array of LoRA objects with settings
   * @returns {Object} Updated workflow
   */
  updateWorkflowWithLoras(workflow, loras) {
    // Clone the workflow to avoid modifying the original
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow));
    
    // Find the EasyLoraStack node (node 91 in your example)
    const loraStackNode = Object.entries(updatedWorkflow).find(
      ([_, node]) => node.class_type === "easy loraStack"
    );
    
    if (!loraStackNode || !loraStackNode[1]) {
      console.warn("Could not find EasyLoraStack node in workflow");
      return updatedWorkflow;
    }
    
    const [nodeId, node] = loraStackNode;
    
    // Prepare LoRA stack settings
    const loraSettings = {
      toggle: true,
      mode: "simple",
      num_loras: Math.min(loras.length, 10) // Maximum 10 LoRAs
    };
    
    // Add individual LoRA settings
    loras.slice(0, 10).forEach((lora, index) => {
      const num = index + 1;
      loraSettings[`lora_${num}_name`] = lora.file_path;
      loraSettings[`lora_${num}_strength`] = lora.model_strength || 1.0;
      loraSettings[`lora_${num}_model_strength`] = lora.model_strength || 1.0;
      loraSettings[`lora_${num}_clip_strength`] = 1.0; // Default to 1.0
    });
    
    // Fill remaining LoRA slots with "None"
    for (let i = loras.length + 1; i <= 10; i++) {
      loraSettings[`lora_${i}_name`] = "None";
      loraSettings[`lora_${i}_strength`] = 1.0;
      loraSettings[`lora_${i}_model_strength`] = 1.0;
      loraSettings[`lora_${i}_clip_strength`] = 1.0;
    }
    
    // Update the node
    updatedWorkflow[nodeId].inputs = {
      ...node.inputs,
      ...loraSettings
    };
    
    return updatedWorkflow;
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
    return loras
      .filter(lora => lora.activation_words && lora.activation_words.trim() !== '')
      .map(lora => lora.activation_words.trim())
      .join(', ');
  }
  
  /**
   * Import LoRAs from ComfyUI's folder structure
   * @returns {Promise<number>} Number of imported LoRAs
   */
  async importLorasFromComfyUI() {
    try {
      // Call a backend endpoint that scans the Comfy/models/lora directory
      const response = await fetch('/api/scan-lora-directories');
      
      if (!response.ok) {
        throw new Error(`Failed to import LoRAs: ${response.statusText}`);
      }
      
      const { loras, count } = await response.json();
      
      // Batch insert the LoRAs into the database
      if (loras && loras.length > 0) {
        const { error } = await supabase
          .from('loras')
          .upsert(loras.map(lora => ({
            name: lora.name,
            file_path: lora.path, // This includes the folder structure
            display_name: lora.display_name || lora.name
          })), {
            onConflict: 'file_path',
            ignoreDuplicates: false
          });
          
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