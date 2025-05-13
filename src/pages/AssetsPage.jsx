// src/pages/AssetsPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

const FilterSection = styled.div`
  margin-bottom: 24px;
  padding: 16px;
  background-color: #f5f5f5;
  border-radius: 8px;
`;

const FilterTitle = styled.h3`
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 1.1rem;
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FilterLabel = styled.label`
  font-size: 0.9rem;
  color: #555;
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #ddd;
  min-width: 150px;
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

const CreateButton = styled(Link)`
  padding: 10px 16px;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  
  &:hover {
    background-color: #0069d9;
    text-decoration: none;
    color: white;
  }
  
  svg {
    margin-right: 8px;
  }
`;

const LoadingContainer = styled.div`
  text-align: center;
  padding: 40px;
`;

const LoadingSpinner = styled.div`
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 4px solid #007bff;
  width: 30px;
  height: 30px;
  margin: 0 auto 16px;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ErrorContainer = styled.div`
  background-color: #ffebee;
  color: #c62828;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
`;

const RefreshButton = styled.button`
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  margin-top: 12px;
  
  &:hover {
    background-color: #0069d9;
  }
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 32px;
  gap: 8px;
`;

const PageButton = styled.button`
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: ${props => props.active ? '#007bff' : '#fff'};
  color: ${props => props.active ? '#fff' : '#333'};
  cursor: ${props => props.active ? 'default' : 'pointer'};
  
  &:hover {
    background-color: ${props => props.active ? '#007bff' : '#f5f5f5'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AssetsPage = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assetTypeFilter, setAssetTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  useEffect(() => {
    const loadAssets = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const options = {};
        
        if (assetTypeFilter) {
          options.assetType = assetTypeFilter;
        }
        
        if (statusFilter) {
          options.status = statusFilter;
        }
        
        console.log("Fetching assets with options:", options);
        const assetsData = await SupabaseService.getAssets(options);
        console.log("Fetched assets:", assetsData);
        setAssets(assetsData || []);
      } catch (error) {
        console.error('Error loading assets:', error);
        setError(`Failed to load assets: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, [assetTypeFilter, statusFilter, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleAssetTypeChange = (e) => {
    setAssetTypeFilter(e.target.value);
  };
  
  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
  };

  return (
    <PageContainer>
      <PageHeader>
        <h1>Asset Library</h1>
        <CreateButton to="/generate">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z"/>
          </svg>
          Generate New Vehicle
        </CreateButton>
      </PageHeader>

      <FilterSection>
        <FilterTitle>Filter Assets</FilterTitle>
        <FilterContainer>
          <FilterGroup>
            <FilterLabel htmlFor="assetType">Asset Type</FilterLabel>
            <FilterSelect 
              id="assetType"
              value={assetTypeFilter} 
              onChange={handleAssetTypeChange}
            >
              <option value="">All Asset Types</option>
              <option value="prompt">Prompts</option>
              <option value="image_2d">2D Images</option>
              <option value="model_3d">3D Models</option>
              <option value="orthogonal_view">Orthogonal Views</option>
              <option value="final_model">Final Models</option>
            </FilterSelect>
          </FilterGroup>
          
          <FilterGroup>
            <FilterLabel htmlFor="status">Status</FilterLabel>
            <FilterSelect 
              id="status"
              value={statusFilter} 
              onChange={handleStatusChange}
            >
              <option value="">All Statuses</option>
              <option value="complete">Complete</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </FilterSelect>
          </FilterGroup>
        </FilterContainer>
      </FilterSection>

      {error && (
        <ErrorContainer>
          <p><strong>Error:</strong> {error}</p>
          <RefreshButton onClick={handleRefresh}>
            Try Again
          </RefreshButton>
        </ErrorContainer>
      )}
      
      {loading ? (
        <LoadingContainer>
          <LoadingSpinner />
          <p>Loading assets...</p>
        </LoadingContainer>
      ) : assets.length > 0 ? (
        <>
          <AssetsGrid>
            {assets.map(asset => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </AssetsGrid>
          
          {/* Pagination can be added here if needed */}
        </>
      ) : (
        <EmptyState>
          <h3>No assets found</h3>
          <p>Try changing your filters or generate new assets</p>
          <CreateButton to="/generate">
            Generate Your First Vehicle
          </CreateButton>
        </EmptyState>
      )}
    </PageContainer>
  );
};

export default AssetsPage;