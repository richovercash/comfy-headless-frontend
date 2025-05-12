// src/services/supabaseService.js
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Service for interacting with Supabase database and storage
 */
const SupabaseService = {
  /**
   * Create a new generation session
   * @param {Object} sessionData - Session parameters
   * @returns {Promise<Object>} - Created session data
   */
  async createSession(sessionData) {
    try {
      const { data, error } = await supabase
        .from('generation_sessions')
        .insert([{
          parameters: sessionData,
          status: 'initiated'
        }])
        .select();
        
      if (error) throw new Error(`Failed to create session: ${error.message}`);
      
      return data[0];
    } catch (error) {
      console.error("Error creating session:", error);
      throw error;
    }
  },
  
  /**
   * Upload a file to Supabase storage with improved error handling
   * @param {string} bucket - Storage bucket name
   * @param {string} path - File path within bucket
   * @param {File} file - File to upload
   * @returns {Promise<Object>} - Upload result
   */
  async uploadFile(bucket, path, file) {
    try {
      console.log(`Uploading file to ${bucket}/${path}`);
      
      // Ensure the bucket exists with correct permissions
      await this.ensureBucketExists(bucket);
      
      // Upload the file
      const { data, error } = await supabase
        .storage
        .from(bucket)
        .upload(path, file, {
          upsert: true,
          cacheControl: '3600'
        });
        
      if (error) {
        console.error("Upload error:", error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }
      
      console.log("Upload successful:", data);
      return data;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  },
  
  /**
   * Ensure a storage bucket exists with proper permissions
   * @param {string} bucketName - Name of the bucket to create/check
   * @param {boolean} isPublic - Whether the bucket should be public
   * @returns {Promise<void>}
   */
  async ensureBucketExists(bucketName, isPublic = true) {
    try {
      console.log(`Checking if bucket '${bucketName}' exists`);
      
      // Check if bucket exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error("Error listing buckets:", listError);
        // Try to create anyway
      } else {
        console.log("Buckets found:", buckets ? buckets.length : 0);
        const bucketExists = buckets && buckets.some(b => b.name === bucketName);
        
        if (bucketExists) {
          console.log(`Bucket '${bucketName}' already exists`);
          
          // If bucket exists, update it if needed
          try {
            const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
              public: isPublic
            });
            
            if (updateError) {
              console.warn(`Could not update bucket permissions: ${updateError.message}`);
              // Continue anyway, this might be due to limited permissions
            } else {
              console.log(`Updated bucket '${bucketName}' to public=${isPublic}`);
            }
          } catch (updateErr) {
            console.warn("Error updating bucket:", updateErr);
            // Continue anyway
          }
          
          return;
        }
      }
      
      // Create the bucket if it doesn't exist
      console.log(`Creating storage bucket '${bucketName}'`);
      
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: isPublic,
        fileSizeLimit: 10485760 // 10MB
      });
      
      if (createError) {
        console.error("Error creating bucket:", createError);
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }
      
      console.log(`Successfully created bucket '${bucketName}'`);
    } catch (error) {
      console.error("Error ensuring bucket exists:", error);
      throw error;
    }
  },
  
  /**
   * Get a public URL for a file in storage
   * @param {string} bucket - Storage bucket name
   * @param {string} path - File path within bucket
   * @returns {string} - Public URL
   */
  getPublicUrl(bucket, path) {
    try {
      const { data } = supabase
        .storage
        .from(bucket)
        .getPublicUrl(path);
        
      return data.publicUrl;
    } catch (error) {
      console.error("Error getting public URL:", error);
      throw error;
    }
  },
  
  /**
   * Create an asset record in the database
   * @param {Object} assetData - Asset data
   * @returns {Promise<Object>} - Created asset data
   */
  async createAsset(assetData) {
    try {
      console.log("Creating asset with data:", assetData);
      
      const { data, error } = await supabase
        .from('assets')
        .insert([assetData])
        .select();
        
      if (error) {
        console.error("Error inserting asset:", error);
        throw new Error(`Failed to create asset: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error('Asset was created but no data was returned');
      }
      
      console.log("Asset created successfully:", data[0]);
      return data[0];
    } catch (error) {
      console.error("Error creating asset:", error);
      throw error;
    }
  },
  
  /**
   * Link an asset to a session
   * @param {string} sessionId - Session ID
   * @param {string} assetId - Asset ID
   * @returns {Promise<void>}
   */
  async linkAssetToSession(sessionId, assetId) {
    try {
      console.log(`Linking asset ${assetId} to session ${sessionId}`);
      
      const { error } = await supabase
        .from('session_assets')
        .insert([{
          session_id: sessionId,
          asset_id: assetId
        }]);
        
      if (error) {
        console.error("Error linking asset to session:", error);
        throw new Error(`Failed to link asset to session: ${error.message}`);
      }
      
      console.log("Successfully linked asset to session");
    } catch (error) {
      console.error("Error linking asset to session:", error);
      throw error;
    }
  },
  
  /**
   * Update a session's status
   * @param {string} sessionId - Session ID
   * @param {string} status - New status ('initiated', 'in_progress', 'completed', 'failed')
   * @returns {Promise<void>}
   */
  async updateSessionStatus(sessionId, status) {
    try {
      console.log(`Updating session ${sessionId} status to ${status}`);
      
      const { error } = await supabase
        .from('generation_sessions')
        .update({ status })
        .eq('id', sessionId);
        
      if (error) {
        console.error("Error updating session status:", error);
        throw new Error(`Failed to update session status: ${error.message}`);
      }
      
      console.log("Successfully updated session status");
    } catch (error) {
      console.error("Error updating session status:", error);
      throw error;
    }
  },
  
  /**
   * Get all assets with proper formatting and filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - List of assets
   */
  async getAssets(options = {}) {
    try {
      console.log("Getting assets with options:", options);
      
      let query = supabase
        .from('assets')
        .select('*, traits:asset_traits(traits:trait_id(*))');
        
      // Apply filters if provided
      if (options.assetType) {
        query = query.eq('asset_type', options.assetType);
      }
      
      if (options.sessionId) {
        query = query.eq('session_id', options.sessionId);
      }
      
      if (options.parentId) {
        query = query.eq('parent_asset_id', options.parentId);
      }
      
      if (options.status) {
        query = query.eq('status', options.status);
      }
      
      // Order by creation date, newest first
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching assets:", error);
        throw new Error(`Failed to fetch assets: ${error.message}`);
      }
      
      console.log(`Retrieved ${data.length} assets`);
      return data;
    } catch (error) {
      console.error("Error in getAssets:", error);
      throw error;
    }
  },
  
  /**
   * Get a single asset by ID with related data
   * @param {string} id - Asset ID
   * @returns {Promise<Object>} - Asset with related data
   */
  async getAsset(id) {
    try {
      console.log(`Getting asset with ID: ${id}`);
      
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
        console.error(`Error fetching asset ${id}:`, error);
        throw new Error(`Failed to fetch asset: ${error.message}`);
      }
      
      console.log("Retrieved asset:", data);
      return data;
    } catch (error) {
      console.error(`Error in getAsset(${id}):`, error);
      throw error;
    }
  },
  
  /**
   * Get all sessions with improved error handling
   * @returns {Promise<Array>} - List of sessions
   */
  async getSessions() {
    try {
      console.log("Getting all sessions");
      
      const { data, error } = await supabase
        .from('generation_sessions')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error("Error fetching sessions:", error);
        throw new Error(`Failed to fetch sessions: ${error.message}`);
      }
      
      console.log(`Retrieved ${data.length} sessions`);
      return data;
    } catch (error) {
      console.error("Error in getSessions:", error);
      throw error;
    }
  },
  
  /**
   * Get all assets for a specific session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} - List of assets belonging to the session
   */
  async getSessionAssets(sessionId) {
    try {
      console.log(`Getting assets for session ${sessionId}`);
      
      const { data, error } = await supabase
        .from('session_assets')
        .select(`
          assets:asset_id(*)
        `)
        .eq('session_id', sessionId);
        
      if (error) {
        console.error(`Error fetching assets for session ${sessionId}:`, error);
        throw new Error(`Failed to fetch session assets: ${error.message}`);
      }
      
      // Transform the result to get just the assets
      const assets = data.map(item => item.assets).filter(Boolean);
      console.log(`Retrieved ${assets.length} assets for session ${sessionId}`);
      
      return assets;
    } catch (error) {
      console.error(`Error in getSessionAssets(${sessionId}):`, error);
      throw error;
    }
  },
  
  /**
   * Get download URL for an asset in Supabase storage
   * This tries multiple methods to get a usable URL
   * @param {string} storagePath - Full storage path (bucket/path)
   * @returns {Promise<string>} - URL for accessing the file
   */
  async getDownloadUrl(storagePath) {
    try {
      console.log(`Getting download URL for ${storagePath}`);
      
      // Extract bucket and path
      const [bucket, ...pathParts] = storagePath.split('/');
      const path = pathParts.join('/');
      
      if (!bucket || !path) {
        throw new Error('Invalid storage path format');
      }
      
      // Try signed URL first (works for both public and private buckets)
      try {
        const { data, error } = await supabase
          .storage
          .from(bucket)
          .createSignedUrl(path, 3600); // 1 hour expiry
          
        if (error) {
          console.warn(`Could not create signed URL: ${error.message}`);
        } else if (data && data.signedUrl) {
          console.log("Got signed URL:", data.signedUrl);
          return data.signedUrl;
        }
      } catch (signedUrlError) {
        console.warn("Error creating signed URL:", signedUrlError);
      }
      
      // Try public URL as fallback
      try {
        const { data } = supabase
          .storage
          .from(bucket)
          .getPublicUrl(path);
          
        if (data && data.publicUrl) {
          console.log("Got public URL:", data.publicUrl);
          return data.publicUrl;
        }
      } catch (publicUrlError) {
        console.warn("Error getting public URL:", publicUrlError);
      }
      
      throw new Error('Could not generate URL for asset');
    } catch (error) {
      console.error(`Error in getDownloadUrl(${storagePath}):`, error);
      throw error;
    }
  },
  
  /**
   * Generate a signed URL for accessing a private file
   * @param {string} bucket - Storage bucket
   * @param {string} path - File path within bucket
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} - Signed URL
   */
  async getSignedUrl(bucket, path, expiresIn = 3600) {
    try {
      const { data, error } = await supabase
        .storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);
        
      if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
      
      return data.signedUrl;
    } catch (error) {
      console.error(`Error in getSignedUrl(${bucket}/${path}):`, error);
      throw error;
    }
  },
  
  /**
   * Check if the current Supabase connection is valid
   * @returns {Promise<boolean>} - Whether the connection is valid
   */
  async checkConnection() {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Supabase connection error:", error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error checking Supabase connection:", error);
      return false;
    }
  },
  
  /**
   * Get traits by type with improved error handling
   * @param {string} traitType - Type of traits to filter by (optional)
   * @returns {Promise<Array>} - List of traits
   */
  async getTraits(traitType = null) {
    try {
      let query = supabase
        .from('traits')
        .select('*');
        
      if (traitType) {
        query = query.eq('trait_type', traitType);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching traits:", error);
        throw new Error(`Failed to fetch traits: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error("Error in getTraits:", error);
      throw error;
    }
  }
};

export default SupabaseService;