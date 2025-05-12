// src/pages/AssetDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  display: block;
`;

const LoadingContainer = styled.div`
  padding: 40px;
  text-align: center;
  color: #666;
`;

const ErrorContainer = styled.div`
  padding: 20px;
  background-color: #ffebee;
  color: #c62828;
  border-radius: 8px;
  margin-bottom: 20px;
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
    width: 40%;
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

const ActionButtons = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
`;

const Button = styled.button`
  padding: 10px 16px;
  background-color: ${props => props.variant === 'secondary' ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  
  &:hover {
    background-color: ${props => props.variant === 'secondary' ? '#5a6268' : '#0069d9'};
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const AssetDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);
  const [traits, setTraits] = useState([]);

  useEffect(() => {
    const loadAsset = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get asset details
        const assetData = await SupabaseService.getAsset(id);
        setAsset(assetData);
        
        // Process traits if available
        if (assetData.traits && assetData.traits.length > 0) {
          const processedTraits = assetData.traits
            .map(t => t.traits)
            .filter(Boolean);
          setTraits(processedTraits);
        }
        
        // Get URL for image or model if applicable
        if (['image_2d', 'orthogonal_view', 'model_3d', 'final_model'].includes(assetData.asset_type)) {
          try {
            const url = await SupabaseService.getDownloadUrl(assetData.storage_path);
            setImageUrl(url);
          } catch (urlError) {
            console.error('Error getting asset URL:', urlError);
            // Don't fail if just the URL fails
          }
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

  const handleConvertTo3D = () => {
    // This would typically start the 3D conversion process
    alert('3D conversion feature coming soon!');
  };

  if (loading) {
    return (
      <PageContainer>
        <LoadingContainer>
          <p>Loading asset...</p>
        </LoadingContainer>
      </PageContainer>
    );
  }

  if (error || !asset) {
    return (
      <PageContainer>
        <ErrorContainer>
          <p>{error || 'Asset not found'}</p>
          <Link to="/assets">Back to Assets</Link>
        </ErrorContainer>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Breadcrumbs>
        <Link to="/assets">Assets</Link> &gt; {getAssetTypeLabel(asset.asset_type)}
      </Breadcrumbs>

      <AssetHeader>
        <AssetType>{getAssetTypeLabel(asset.asset_type)}</AssetType>
        <h1>{asset.metadata?.prompt ? 
          (asset.metadata.prompt.length > 80 ? 
            `${asset.metadata.prompt.substring(0, 80)}...` : 
            asset.metadata.prompt) 
          : `Asset ${asset.id.substring(0, 8)}`}
        </h1>
      </AssetHeader>

      <AssetContent>
        <AssetPreview>
          {imageUrl && ['image_2d', 'orthogonal_view'].includes(asset.asset_type) && (
            <AssetImage src={imageUrl} alt={`Asset ${asset.id}`} />
          )}
          
          {imageUrl && ['model_3d', 'final_model'].includes(asset.asset_type) && (
            <ModelViewer modelUrl={imageUrl} />
          )}
          
          {!imageUrl && asset.asset_type === 'prompt' && (
            <div style={{ padding: '20px' }}>
              <pre>{JSON.stringify(asset.metadata, null, 2)}</pre>
            </div>
          )}
          
          {!imageUrl && ['image_2d', 'orthogonal_view', 'model_3d', 'final_model'].includes(asset.asset_type) && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <p>Image preview not available</p>
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
                <tr>
                  <th>ID</th>
                  <td><code>{asset.id}</code></td>
                </tr>
                {asset.metadata && Object.entries(asset.metadata).map(([key, value]) => (
                  typeof value !== 'object' ? (
                    <tr key={key}>
                      <th>{key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}</th>
                      <td>{value.toString()}</td>
                    </tr>
                  ) : null
                ))}
              </tbody>
            </MetadataTable>
          </MetadataSection>
          
          {asset.asset_type === 'image_2d' && (
            <ActionButtons>
              <Button onClick={handleConvertTo3D}>
                Convert to 3D Model
              </Button>
              
              {imageUrl && (
                <Button 
                  variant="secondary"
                  onClick={() => window.open(imageUrl, '_blank')}
                >
                  Download Image
                </Button>
              )}
            </ActionButtons>
          )}
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