import React from 'react';
import styled from 'styled-components';

const DetailViewContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  z-index: 1000;
`;

const DetailContent = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  padding: 40px;
  gap: 40px;
`;

const ImageSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  
  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
`;

const InfoSection = styled.div`
  width: 400px;
  background: white;
  padding: 24px;
  border-radius: 8px;
  overflow-y: auto;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  z-index: 1001;
  
  &:hover {
    opacity: 0.8;
  }
`;

const InfoTitle = styled.h2`
  margin: 0 0 20px 0;
  color: #333;
`;

const InfoRow = styled.div`
  margin-bottom: 16px;
  
  h4 {
    margin: 0 0 4px 0;
    color: #666;
    font-size: 0.9rem;
  }
  
  p {
    margin: 0;
    color: #333;
    word-break: break-word;
  }
`;

const MetadataSection = styled.div`
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #eee;
  
  pre {
    background: #f5f5f5;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
  }
`;

const AssetDetailView = ({ asset, onClose }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
    <DetailViewContainer onClick={onClose}>
      <CloseButton onClick={onClose}>&times;</CloseButton>
      
      <DetailContent onClick={e => e.stopPropagation()}>
        <ImageSection>
          {asset.url && (
            <img src={asset.url} alt={asset.metadata?.prompt || 'Asset'} />
          )}
        </ImageSection>
        
        <InfoSection>
          <InfoTitle>Asset Details</InfoTitle>
          
          <InfoRow>
            <h4>Type</h4>
            <p>{getAssetTypeLabel(asset.asset_type)}</p>
          </InfoRow>
          
          <InfoRow>
            <h4>Created</h4>
            <p>{formatDate(asset.created_at)}</p>
          </InfoRow>
          
          {asset.metadata?.prompt && (
            <InfoRow>
              <h4>Prompt</h4>
              <p>{asset.metadata.prompt}</p>
            </InfoRow>
          )}
          
          <MetadataSection>
            <h4>Metadata</h4>
            <pre>
              {JSON.stringify(asset.metadata, null, 2)}
            </pre>
          </MetadataSection>
        </InfoSection>
      </DetailContent>
    </DetailViewContainer>
  );
};

export default AssetDetailView; 