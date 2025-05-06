// src/pages/AssetsPage.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import AssetCard from '../components/AssetCard';
import SupabaseService from '../services/supabaseService';

const PageContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #ddd;
`;

const AssetsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  background-color: #f9f9f9;
  border-radius: 8px;
  color: #666;
`;

const AssetsPage = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assetTypeFilter, setAssetTypeFilter] = useState('');
  
  useEffect(() => {
    const loadAssets = async () => {
      try {
        setLoading(true);
        const options = {};
        
        if (assetTypeFilter) {
          options.assetType = assetTypeFilter;
        }
        
        const assetsData = await SupabaseService.getAssets(options);
        setAssets(assetsData);
      } catch (error) {
        console.error('Error loading assets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, [assetTypeFilter]);

  return (
    <PageContainer>
      <PageHeader>
        <h1>Asset Library</h1>
      </PageHeader>

      <FilterContainer>
        <FilterSelect 
          value={assetTypeFilter} 
          onChange={(e) => setAssetTypeFilter(e.target.value)}
        >
          <option value="">All Asset Types</option>
          <option value="prompt">Prompts</option>
          <option value="image_2d">2D Images</option>
          <option value="model_3d">3D Models</option>
          <option value="orthogonal_view">Orthogonal Views</option>
          <option value="final_model">Final Models</option>
        </FilterSelect>
      </FilterContainer>
      {loading ? (
        <p>Loading assets...</p>
      ) : assets.length > 0 ? (
        <AssetsGrid>
          {assets.map(asset => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </AssetsGrid>
      ) : (
        <EmptyState>
          <h3>No assets found</h3>
          <p>Try changing your filters or generate new assets</p>
        </EmptyState>
      )}
    </PageContainer>
  );
};

export default AssetsPage;