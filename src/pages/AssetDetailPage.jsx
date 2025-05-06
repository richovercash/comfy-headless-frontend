// src/pages/AssetDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import AssetRelationships from '../components/AssetRelationships';
import ModelViewer from '../components/ModelViewer';
import SupabaseService from '../services/supabaseService';

const PageContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
`;

const Breadcrumbs = styled.div`
  margin-bottom: 20px;
  color: #666;
  
  a {
    color: #007bff;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

const AssetHeader = styled.div`
  margin-bottom: 24px;
`;

const AssetType = styled.span`
  display: inline-block;
  background-color: #e0e0e0;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #555;
  margin-bottom: 8px;
`;

const AssetContent = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const AssetPreview = styled.div`
  background-color: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
`;

const AssetImage = styled.img`
  max-width: 100%;
  height: auto;
`;

const AssetInfo = styled.div`
  h2 {
    margin-top: 0;
  }
`;

const MetadataSection = styled.div`
  margin-top: 20px;
`;

const MetadataTitle = styled.h3`
  margin-bottom: 10px;
  color: #333;
`;

const MetadataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th, td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }
  
  th {
    color: #555;
    font-weight: normal;
  }
`;

const TraitsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
`;

const TraitTag = styled.span`
  background-color: #007bff;
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.9rem;
`;

const AssetDetailPage = () => {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assetUrl, setAssetUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAsset = async () => {
      try {
        setLoading(true);
        const assetData = await SupabaseService.getAsset(id);
        setAsset(assetData);
        
        // Get URL for image or model if applicable
        if (['image_2d', 'orthogonal_view', 'model_3d', 'final_model'].includes(assetData.asset_type)) {
          const url = await SupabaseService.getDownloadUrl(assetData.storage_path);
          setAssetUrl(url);
        }
      } catch (error) {
        console.error('Error loading asset:', error);
        setError('Failed to load asset. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadAsset();
  }, [id]);

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

  if (loading) {
    return (
      <PageContainer>
        <p>Loading asset...</p>
      </PageContainer>
    );
  }

  if (error || !asset) {
    return (
      <PageContainer>
        <p>{error || 'Asset not found'}</p>
        <Link to="/assets">Back to Assets</Link>
      </PageContainer>
    );
  }

  // Extract traits
  const traits = asset.traits?.map(t => t.traits).filter(Boolean) || [];

  return (
    <PageContainer>
      <Breadcrumbs>
        <Link to="/assets">Assets</Link> &gt; {getAssetTypeLabel(asset.asset_type)}
      </Breadcrumbs>

      <AssetHeader>
        <AssetType>{getAssetTypeLabel(asset.asset_type)}</AssetType>
        <h1>{asset.metadata?.prompt || `Asset ${asset.id.substring(0, 8)}`}</h1>
      </AssetHeader>

      <AssetContent>
        <AssetPreview>
          {assetUrl && ['image_2d', 'orthogonal_view'].includes(asset.asset_type) && (
            <AssetImage src={assetUrl} alt={`Asset ${asset.id}`} />
          )}
          
          {assetUrl && ['model_3d', 'final_model'].includes(asset.asset_type) && (
            <ModelViewer modelUrl={assetUrl} />
          )}
          
          {!assetUrl && asset.asset_type === 'prompt' && (
            <div style={{ padding: '20px' }}>
              <pre>{JSON.stringify(asset.metadata, null, 2)}</pre>
            </div>
          )}
        </AssetPreview>

        <AssetInfo>
          {traits.length > 0 && (
            <div>
              <h3>Traits</h3>
              <TraitsList>
                {traits.map(trait => (
                  <TraitTag key={trait.id}>
                    {trait.trait_type}: {trait.trait_value}
                  </TraitTag>
                ))}
              </TraitsList>
            </div>
          )}

          <MetadataSection>
            <MetadataTitle>Metadata</MetadataTitle>
            <MetadataTable>
              <tbody>
                <tr>
                  <th>Created</th>
                  <td>{new Date(asset.created_at).toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>{asset.status}</td>
                </tr>
                {asset.metadata && Object.entries(asset.metadata).map(([key, value]) => (
                  typeof value !== 'object' ? (
                    <tr key={key}>
                      <th>{key}</th>
                      <td>{value.toString()}</td>
                    </tr>
                  ) : null
                ))}
              </tbody>
            </MetadataTable>
          </MetadataSection>
        </AssetInfo>
      </AssetContent>

      <AssetRelationships 
        parent={asset.parent} 
        children={asset.children} 
      />
    </PageContainer>
  );
};

export default AssetDetailPage;