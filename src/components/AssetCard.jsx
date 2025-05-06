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
`;

const AssetTitle = styled.h3`
  margin: 0 0 8px 0;
  color: #333;
`;

const AssetType = styled.span`
  background-color: #e0e0e0;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #555;
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

const AssetCard = ({ asset }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [traits, setTraits] = useState([]);

  useEffect(() => {
    const loadAssetData = async () => {
      try {
        // Get signed URL for the asset if it's an image or 3D model
        if (['image_2d', 'orthogonal_view', 'model_3d', 'final_model'].includes(asset.asset_type)) {
          const url = await SupabaseService.getDownloadUrl(asset.storage_path);
          setImageUrl(url);
        }

        // Process traits if available
        if (asset.traits && asset.traits.length > 0) {
          const processedTraits = asset.traits
            .map(t => t.traits)
            .filter(Boolean);
          setTraits(processedTraits);
        }
      } catch (error) {
        console.error('Error loading asset data:', error);
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

  return (
    <Card>
      <AssetType>{getAssetTypeLabel(asset.asset_type)}</AssetType>
      
      {imageUrl && ['image_2d', 'orthogonal_view'].includes(asset.asset_type) && (
        <AssetImage src={imageUrl} alt={`Asset ${asset.id}`} />
      )}
      
      <AssetTitle>
        {asset.metadata?.prompt || `Asset ${asset.id.substring(0, 8)}`}
      </AssetTitle>
      
      {traits.length > 0 && (
        <TraitsList>
          {traits.map(trait => (
            <TraitTag key={trait.id}>
              {trait.trait_value}
            </TraitTag>
          ))}
        </TraitsList>
      )}
      
      <Link to={`/assets/${asset.id}`}>View Details</Link>
    </Card>
  );
};

export default AssetCard;