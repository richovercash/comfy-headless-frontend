// src/components/AssetCard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import SupabaseService from '../services/supabaseService';

const Card = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  background-color: #f9f9f9;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
  height: 100%;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
`;

const AssetImage = styled.img`
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin-bottom: 12px;
  object-fit: cover;
  aspect-ratio: 16/9;
`;

const ImagePlaceholder = styled.div`
  width: 100%;
  aspect-ratio: 16/9;
  background-color: #e0e0e0;
  border-radius: 4px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #777;
  font-size: 0.9rem;
`;

const AssetTitle = styled.h3`
  margin: 0 0 8px 0;
  color: #333;
  word-break: break-word;
`;

const AssetType = styled.span`
  background-color: #e0e0e0;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #555;
  display: inline-block;
  margin-bottom: 8px;
`;

const TraitsList = styled.div`
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const TraitTag = styled.span`
  background-color: #007bff;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
`;

const ErrorMessage = styled.div`
  color: #d32f2f;
  font-size: 0.8rem;
  margin-top: 8px;
`;

const ViewLink = styled(Link)`
  margin-top: auto;
  display: inline-block;
  padding: 6px 12px;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 0.9rem;
  align-self: flex-start;
  
  &:hover {
    background-color: #0056b3;
    text-decoration: none;
  }
`;

const AssetInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const AssetMetadata = styled.div`
  margin-top: 8px;
  font-size: 0.8rem;
  color: #666;
`;

const AssetCard = ({ asset }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [traits, setTraits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAssetData = async () => {
      try {
        setLoading(true);
        setError(null);
        
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

        // Get URL using the most robust approach - try multiple methods
        try {
          // Try using getDownloadUrl from SupabaseService
          const url = await SupabaseService.getDownloadUrl(asset.storage_path);
          if (url) {
            setImageUrl(url);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('getDownloadUrl method failed, trying alternatives', e);
        }

        // Try using the public URL (for public buckets)
        try {
          const publicUrl = SupabaseService.getPublicUrl(bucket, path);
          if (publicUrl) {
            setImageUrl(publicUrl);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('getPublicUrl method failed, trying alternatives', e);
        }

        // Try signed URL as last resort
        try {
          const signedUrl = await SupabaseService.getSignedUrl(bucket, path, 3600);
          if (signedUrl) {
            setImageUrl(signedUrl);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('getSignedUrl method failed', e);
          setError('Could not generate URL for asset');
          setLoading(false);
        }

        // Process traits if available
        if (asset.traits && asset.traits.length > 0) {
          const processedTraits = asset.traits
            .map(t => t.traits)
            .filter(Boolean);
          setTraits(processedTraits);
        }
      } catch (err) {
        console.error('Error loading asset data:', err);
        setError(`Error: ${err.message}`);
        setLoading(false);
      }
    };

    loadAssetData();
  }, [asset]);

  const getAssetTypeLabel = (type) => {
    const typeMap = {
      'prompt': 'Prompt',
      'image_2d': '2D Image',
      'model_3d': '3D Model',
      'orthogonal_view': 'Orthogonal View',
      'final_model': 'Final Model'
    };
    return typeMap[type] || type;
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return 'Unknown date';
    }
  };

  const getPromptExcerpt = (metadata) => {
    if (!metadata || !metadata.prompt) return 'No prompt available';
    return metadata.prompt.length > 60 
      ? `${metadata.prompt.substring(0, 60)}...` 
      : metadata.prompt;
  };

  return (
    <Card>
      <AssetType>{getAssetTypeLabel(asset.asset_type)}</AssetType>
      
      {loading ? (
        <ImagePlaceholder>Loading asset...</ImagePlaceholder>
      ) : error ? (
        <ImagePlaceholder>Could not load asset</ImagePlaceholder>
      ) : (
        imageUrl && ['image_2d', 'orthogonal_view'].includes(asset.asset_type) && (
          <AssetImage src={imageUrl} alt={`Asset ${asset.id}`} />
        )
      )}
      
      <AssetInfo>
        <AssetTitle>
          {getPromptExcerpt(asset.metadata)}
        </AssetTitle>
        
        <AssetMetadata>
          Created: {formatDate(asset.created_at)}
        </AssetMetadata>
        
        {traits.length > 0 && (
          <TraitsList>
            {traits.slice(0, 3).map(trait => (
              <TraitTag key={trait.id}>
                {trait.trait_value}
              </TraitTag>
            ))}
            {traits.length > 3 && <TraitTag>+{traits.length - 3} more</TraitTag>}
          </TraitsList>
        )}
        
        {error && <ErrorMessage>{error}</ErrorMessage>}
        
        <ViewLink to={`/assets/${asset.id}`}>View Details</ViewLink>
      </AssetInfo>
    </Card>
  );
};

export default AssetCard;