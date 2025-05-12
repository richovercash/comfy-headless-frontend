import React from 'react';
import styled from 'styled-components';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 24px;
  border-radius: 8px;
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  
  &:hover {
    opacity: 0.7;
  }
`;

const AssetImage = styled.img`
  max-width: 100%;
  height: auto;
  margin-bottom: 20px;
`;

const AssetDetails = styled.div`
  margin-top: 20px;
`;

const DetailRow = styled.div`
  display: flex;
  margin-bottom: 12px;
  
  strong {
    width: 120px;
    margin-right: 12px;
  }
`;

const AssetModal = ({ asset, onClose }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <CloseButton onClick={onClose}>&times;</CloseButton>
        
        <h2>{asset.name || 'Asset Details'}</h2>
        
        {asset.url && (
          <AssetImage src={asset.url} alt={asset.name || 'Asset'} />
        )}

        <AssetDetails>
          <DetailRow>
            <strong>Type:</strong>
            <span>{asset.assetType}</span>
          </DetailRow>
          
          <DetailRow>
            <strong>Created:</strong>
            <span>{formatDate(asset.created_at)}</span>
          </DetailRow>
          
          {asset.description && (
            <DetailRow>
              <strong>Description:</strong>
              <span>{asset.description}</span>
            </DetailRow>
          )}
          
          {asset.metadata && (
            <DetailRow>
              <strong>Metadata:</strong>
              <pre>{JSON.stringify(asset.metadata, null, 2)}</pre>
            </DetailRow>
          )}
        </AssetDetails>
      </ModalContent>
    </ModalOverlay>
  );
};

export default AssetModal; 