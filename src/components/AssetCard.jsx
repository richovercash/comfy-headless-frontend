// src/components/AssetCard.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { supabase } from '../services/supabaseService';

const AssetCard = ({ asset, onSelect }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAssetData();
  }, [asset]);

  const loadAssetData = async () => {
    try {
      if (!asset || !asset.storage_path) {
        setError('Invalid asset data');
        setLoading(false);
        return;
      }

      // Extract bucket and path from storage_path (format: "bucket/path")
      const [bucket, ...pathParts] = asset.storage_path.split('/');
      const path = pathParts.join('/');

      if (!bucket || !path) {
        setError('Invalid storage path format');
        setLoading(false);
        return;
      }

      // Get URL using the correct method for your Supabase version
      try {
        // Try the newer method first (getPublicUrl)
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (data && data.publicUrl) {
          setImageUrl(data.publicUrl);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.log('getPublicUrl method failed, trying alternative', e);
      }

      // Try signed URL as fallback (for private buckets)
      try {
        const { data, error: signedUrlError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600); // 1 hour expiry

        if (signedUrlError) throw signedUrlError;
        
        if (data && data.signedUrl) {
          setImageUrl(data.signedUrl);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.log('createSignedUrl method failed', e);
      }

      // Last resort - try the download URL (older versions)
      try {
        const { data: downloadData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(path);
          
        if (downloadError) throw downloadError;
        
        // Create object URL from the downloaded blob
        const objectUrl = URL.createObjectURL(downloadData);
        setImageUrl(objectUrl);
        
        // Clean up object URL on unmount
        return () => {
          URL.revokeObjectURL(objectUrl);
        };
      } catch (e) {
        throw new Error(`All URL retrieval methods failed: ${e.message}`);
      }
    } catch (err) {
      console.error('Error loading asset data:', err);
      setError(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <CardContainer onClick={() => onSelect && onSelect(asset)}>
      {loading && <LoadingIndicator>Loading...</LoadingIndicator>}
      
      {error && <ErrorMessage>{error}</ErrorMessage>}
      
      {!loading && !error && (
        <>
          <ImagePreview src={imageUrl} alt={`Asset ${asset.id}`} />
          
          <AssetInfo>
            <AssetType>{asset.asset_type}</AssetType>
            <AssetDate>{formatDate(asset.created_at)}</AssetDate>
            
            {asset.metadata && asset.metadata.prompt && (
              <AssetPrompt>
                {asset.metadata.prompt.length > 50 
                  ? asset.metadata.prompt.substring(0, 50) + '...' 
                  : asset.metadata.prompt}
              </AssetPrompt>
            )}
          </AssetInfo>
        </>
      )}
    </CardContainer>
  );
};

const CardContainer = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;

const ImagePreview = styled.img`
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-bottom: 1px solid #eee;
`;

const AssetInfo = styled.div`
  padding: 12px;
`;

const AssetType = styled.div`
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
`;

const AssetDate = styled.div`
  font-size: 0.8rem;
  color: #777;
  margin-bottom: 8px;
`;

const AssetPrompt = styled.div`
  font-size: 0.9rem;
  color: #555;
  font-style: italic;
`;

const LoadingIndicator = styled.div`
  padding: 20px;
  text-align: center;
  color: #777;
`;

const ErrorMessage = styled.div`
  padding: 20px;
  text-align: center;
  color: #e53935;
  font-size: 0.9rem;
`;

export default AssetCard;