// src/components/AssetRelationships.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const RelationshipContainer = styled.div`
  margin: 20px 0;
`;

const RelationshipSection = styled.div`
  margin-bottom: 16px;
`;

const SectionTitle = styled.h3`
  margin-bottom: 8px;
  color: #333;
`;

const RelatedAssetsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

const RelatedAssetCard = styled.div`
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 12px;
  width: 200px;
  background-color: #f5f5f5;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #e9e9e9;
  }
`;

const AssetTypeLabel = styled.span`
  display: inline-block;
  background-color: #e0e0e0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #555;
  margin-bottom: 6px;
`;

const AssetRelationships = ({ parent, children }) => {
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
    <RelationshipContainer>
      {parent && (
        <RelationshipSection>
          <SectionTitle>Parent Asset</SectionTitle>
          <RelatedAssetsList>
            <RelatedAssetCard>
              <AssetTypeLabel>{getAssetTypeLabel(parent.asset_type)}</AssetTypeLabel>
              <div>{parent.metadata?.prompt || `Asset ${parent.id.substring(0, 8)}`}</div>
              <Link to={`/assets/${parent.id}`}>View Parent</Link>
            </RelatedAssetCard>
          </RelatedAssetsList>
        </RelationshipSection>
      )}

      {children && children.length > 0 && (
        <RelationshipSection>
          <SectionTitle>Child Assets</SectionTitle>
          <RelatedAssetsList>
            {children.map(child => (
              <RelatedAssetCard key={child.id}>
                <AssetTypeLabel>{getAssetTypeLabel(child.asset_type)}</AssetTypeLabel>
                <div>{child.metadata?.prompt || `Asset ${child.id.substring(0, 8)}`}</div>
                <Link to={`/assets/${child.id}`}>View Child</Link>
              </RelatedAssetCard>
            ))}
          </RelatedAssetsList>
        </RelationshipSection>
      )}
    </RelationshipContainer>
  );
};

export default AssetRelationships;