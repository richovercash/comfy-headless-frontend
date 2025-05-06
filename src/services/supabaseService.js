// src/services/supabaseService.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const SupabaseService = {
  /**
   * Get all assets with optional filtering
   * @param {Object} options - Filter options
   * @param {string} options.assetType - Filter by asset type
   * @param {string} options.sessionId - Filter by session ID
   * @param {string} options.parentId - Filter by parent asset ID
   */
  async getAssets(options = {}) {
    let query = supabase
      .from('assets')
      .select('*, traits:asset_traits(traits:trait_id(*))');

    if (options.assetType) {
      query = query.eq('asset_type', options.assetType);
    }

    if (options.sessionId) {
      // This assumes you've added a session_id column to the assets table
      query = query.eq('session_id', options.sessionId);
    }

    if (options.parentId) {
      query = query.eq('parent_asset_id', options.parentId);
    }

    // Order by creation date, newest first
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching assets:', error);
      throw error;
    }

    return data;
  },

  /**
   * Get a single asset by ID with related data
   * @param {string} id - Asset ID
   */
  async getAsset(id) {
    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        traits:asset_traits(traits:trait_id(*)),
        parent:parent_asset_id(*),
        children:assets!parent_asset_id(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching asset:', error);
      throw error;
    }

    return data;
  },

  /**
   * Get all generation sessions
   */
  async getSessions() {
    const { data, error } = await supabase
      .from('generation_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      throw error;
    }

    return data;
  },

  /**
   * Get session by ID with related assets
   * @param {string} id - Session ID
   */
  async getSession(id) {
    // Get the session
    const { data: session, error: sessionError } = await supabase
      .from('generation_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      throw sessionError;
    }

    // Get the assets for this session
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*, traits:asset_traits(traits:trait_id(*))')
      .eq('session_id', id)
      .order('created_at', { ascending: false });

    if (assetsError) {
      console.error('Error fetching session assets:', assetsError);
      throw assetsError;
    }

    return {
      ...session,
      assets
    };
  },

  /**
   * Create a new generation session
   * @param {Object} parameters - Session parameters
   */
  async createSession(parameters = {}) {
    const { data, error } = await supabase
      .from('generation_sessions')
      .insert({
        parameters,
        status: 'initiated'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      throw error;
    }

    return data;
  },

  /**
   * Get all traits, optionally filtered by type
   * @param {string} traitType - Optional trait type to filter by
   */
  async getTraits(traitType = null) {
    let query = supabase
      .from('traits')
      .select('*');

    if (traitType) {
      query = query.eq('trait_type', traitType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching traits:', error);
      throw error;
    }

    return data;
  },

  /**
   * Get a signed URL for downloading an asset
   * @param {string} assetPath - Storage path of the asset
   */
  async getDownloadUrl(assetPath) {
    // Parse storage path to get bucket and path
    const [bucket, ...pathParts] = assetPath.split('/');
    const path = pathParts.join('/');
    
    // Get signed URL
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour expiry
      
    if (error) {
      throw error;
    }
    
    return data.signedUrl;
  }
};

export default SupabaseService;