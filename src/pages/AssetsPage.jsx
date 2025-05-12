// src/pages/AssetsPage.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import AssetCard from '../components/AssetCard';
import SupabaseService from '../services/supabaseService';
import { Spinner } from '../components/Spinner';
import { ErrorMessage } from '../components/ErrorMessage';
import AssetDetailView from '../components/AssetDetailView';

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

const RefreshButton = styled.button`
  padding: 8px 16px;
  border-radius: 4px;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  cursor: pointer;
  
  &:hover {
    background-color: #e0e0e0;
  }
`;

const SortSelect = styled(FilterSelect)`
  min-width: 150px;
`;

const AssetsPage = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assetTypeFilter, setAssetTypeFilter] = useState('');
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [selectedAsset, setSelectedAsset] = useState(null);
  
  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const options = {
        assetType: assetTypeFilter,
        sortBy: sortBy
      };
      
      const assetsData = await SupabaseService.getAssets(options);
      setAssets(assetsData);
    } catch (error) {
      console.error('Error loading assets:', error);
      setError('Failed to load assets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [assetTypeFilter, sortBy]);

  const handleAssetClick = (asset) => {
    setSelectedAsset(asset);
  };

  const handleCloseModal = () => {
    setSelectedAsset(null);
  };

  return (
    <PageContainer>
      <PageHeader>
        <h1>Asset Library</h1>
        <RefreshButton onClick={loadAssets}>
          Refresh Assets
        </RefreshButton>
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

        <SortSelect
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
        </SortSelect>
      </FilterContainer>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      
      {loading ? (
        <Spinner />
      ) : assets.length > 0 ? (
        <AssetsGrid>
          {assets.map(asset => (
            <AssetCard 
              key={asset.id} 
              asset={asset} 
              onClick={() => handleAssetClick(asset)}
            />
          ))}
        </AssetsGrid>
      ) : (
        <EmptyState>
          <h3>No assets found</h3>
          <p>Try changing your filters or generate new assets</p>
        </EmptyState>
      )}

      {selectedAsset && (
        <AssetDetailView 
          asset={selectedAsset} 
          onClose={handleCloseModal}
        />
      )}
    </PageContainer>
  );
};

export default AssetsPage;