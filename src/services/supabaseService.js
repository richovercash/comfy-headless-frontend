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
    const { data } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(path);
      
    return data.publicUrl;
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
   * Get assets for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} - Session assets
   */
  async getSessionAssets(sessionId) {
    try {
      const { data, error } = await supabase
        .from('session_assets')
        .select(`
          asset_id,
          assets:asset_id (
            id,
            asset_type,
            storage_path,
            parent_asset_id,
            status,
            metadata,
            created_at
          )
        `)
        .eq('session_id', sessionId);
        
      if (error) throw new Error(`Failed to get session assets: ${error.message}`);
      
      // Transform the result to get just the assets
      return data.map(item => item.assets);
    } catch (error) {
      console.error("Error getting session assets:", error);
      throw error;
    }
  },
  
  /**
   * Get all sessions with their assets
   * @returns {Promise<Array>} - Array of sessions with assets
   */
  async getSessions() {
    try {
      const { data, error } = await supabase
        .from('generation_sessions')
        .select(`
          *,
          session_assets (
            assets (
              id,
              asset_type,
              storage_path,
              metadata,
              created_at
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to get sessions: ${error.message}`);

      // Transform the data to flatten the structure
      return data.map(session => ({
        ...session,
        assets: session.session_assets?.map(sa => sa.assets) || []
      }));
    } catch (error) {
      console.error("Error getting sessions:", error);
      throw error;
    }
  },
  
  /**
   * Get all assets matching a filter with URLs
   * @param {Object} filter - Filter criteria
   * @returns {Promise<Array>} - Filtered assets with URLs
   */
  async getAssets(filter = {}) {
    try {
      let query = supabase
        .from('assets')
        .select('*');
        
      // Apply filters if provided
      if (filter.assetType) {
        query = query.eq('asset_type', filter.assetType);
      }
      
      // Apply sorting
      switch (filter.sortBy) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'name':
          query = query.order('metadata->prompt', { ascending: true });
          break;
        case 'name_desc':
          query = query.order('metadata->prompt', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
      }
      
      const { data, error } = await query;
      
      if (error) throw new Error(`Failed to get assets: ${error.message}`);
      
      // Add URLs to assets
      const assetsWithUrls = await Promise.all(data.map(async (asset) => {
        try {
          if (asset.storage_path) {
            const [bucket, ...pathParts] = asset.storage_path.split('/');
            const path = pathParts.join('/');
            
            // Try public URL first
            let url = this.getPublicUrl(bucket, path);
            
            // If not public, try signed URL
            if (!url) {
              url = await this.getSignedUrl(bucket, path);
            }
            
            return { ...asset, url };
          }
          return asset;
        } catch (err) {
          console.warn(`Warning: Could not get URL for asset ${asset.id}:`, err);
          return asset;
        }
      }));
      
      return assetsWithUrls;
    } catch (error) {
      console.error("Error getting assets:", error);
      throw error;
    }
  },
  
  /**
   * Get a signed URL for a private file
   * @param {string} bucket - Storage bucket name
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
      console.error("Error creating signed URL:", error);
      throw error;
    }
  },
  
  /**
   * Get an asset by ID
   * @param {string} assetId - Asset ID
   * @returns {Promise<Object>} - Asset data
   */
  async getAssetById(assetId) {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .single();
        
      if (error) throw new Error(`Failed to get asset: ${error.message}`);
      
      return data;
    } catch (error) {
      console.error("Error getting asset:", error);
      throw error;
    }
  },
  
  /**
   * Delete an asset and its file
   * @param {string} assetId - Asset ID
   * @returns {Promise<void>}
   */
  async deleteAsset(assetId) {
    try {
      // First get the asset to get its storage path
      const asset = await this.getAssetById(assetId);
      
      if (asset && asset.storage_path) {
        // Extract bucket and path from storage_path (format: "bucket/path")
        const [bucket, ...pathParts] = asset.storage_path.split('/');
        const path = pathParts.join('/');
        
        // Delete the file from storage
        const { error: storageError } = await supabase
          .storage
          .from(bucket)
          .remove([path]);
          
        if (storageError) {
          console.warn(`Warning: Could not delete file from storage: ${storageError.message}`);
          // Continue with database deletion even if file deletion fails
        }
      }
      
      // Delete the asset from the database
      const { error: dbError } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);
        
      if (dbError) throw new Error(`Failed to delete asset from database: ${dbError.message}`);
    } catch (error) {
      console.error("Error deleting asset:", error);
      throw error;
    }
  }
};

export default SupabaseService;