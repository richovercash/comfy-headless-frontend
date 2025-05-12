// src/pages/SessionsPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import SupabaseService from '../services/supabaseService';
import AssetCard from '../components/AssetCard';

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

const SessionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const SessionCard = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`;

const SessionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  border-bottom: 1px solid #eee;
  padding-bottom: 16px;
`;

const SessionTitle = styled.h3`
  margin: 0;
  color: #333;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 50px;
  font-size: 0.8rem;
  background-color: ${props => {
    switch(props.status) {
      case 'completed': return '#e8f5e9';
      case 'in_progress': return '#fff8e1';
      case 'failed': return '#ffebee';
      default: return '#e0e0e0';
    }
  }};
  color: ${props => {
    switch(props.status) {
      case 'completed': return '#2e7d32';
      case 'in_progress': return '#f57c00';
      case 'failed': return '#c62828';
      default: return '#616161';
    }
  }};
`;

const SessionDetails = styled.div`
  margin-bottom: 16px;
`;

const DetailItem = styled.div`
  margin-bottom: 8px;
  display: flex;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DetailLabel = styled.span`
  font-weight: 500;
  width: 120px;
  color: #555;
`;

const DetailValue = styled.span`
  color: #333;
`;

const AssetsContainer = styled.div`
  margin-top: 20px;
`;

const AssetsTitle = styled.h4`
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
  font-size: 1.1rem;
`;

const AssetsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  background-color: #f9f9f9;
  border-radius: 8px;
  color: #666;
  margin-top: 20px;
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

const RefreshButton = styled.button`
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  
  &:hover {
    background-color: #0069d9;
  }
`;

const ExpandButton = styled.button`
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 4px 8px;
  margin-top: 12px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const SessionsPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSessions, setExpandedSessions] = useState({});
  const [sessionAssets, setSessionAssets] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const sessionsData = await SupabaseService.getSessions();
        setSessions(sessionsData || []);
      } catch (error) {
        console.error('Error loading sessions:', error);
        setError(`Failed to load sessions: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const toggleSession = async (sessionId) => {
    // Toggle expanded state
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
    
    // Load assets if expanding and not already loaded
    if (!expandedSessions[sessionId] && !sessionAssets[sessionId]) {
      try {
        const assets = await SupabaseService.getSessionAssets(sessionId);
        setSessionAssets(prev => ({
          ...prev,
          [sessionId]: assets
        }));
      } catch (error) {
        console.error(`Error loading assets for session ${sessionId}:`, error);
        // Set empty array to avoid repeated failed attempts
        setSessionAssets(prev => ({
          ...prev,
          [sessionId]: []
        }));
      }
    }
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'initiated': 'Initiated',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'failed': 'Failed'
    };
    return statusMap[status] || status;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getPromptExcerpt = (parameters) => {
    if (!parameters || !parameters.prompt) return 'No prompt';
    return parameters.prompt.length > 100 
      ? `${parameters.prompt.substring(0, 100)}...` 
      : parameters.prompt;
  };

  return (
    <PageContainer>
      <PageHeader>
        <h1>Generation Sessions</h1>
        <CreateButton to="/generate">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z"/>
          </svg>
          New Generation
        </CreateButton>
      </PageHeader>

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
          <p>Loading sessions...</p>
        </LoadingContainer>
      ) : sessions.length > 0 ? (
        <SessionsList>
          {sessions.map(session => (
            <SessionCard key={session.id}>
              <SessionHeader>
                <SessionTitle>
                  Session {session.id.substring(0, 8)}
                </SessionTitle>
                <StatusBadge status={session.status}>
                  {getStatusLabel(session.status)}
                </StatusBadge>
              </SessionHeader>
              
              <SessionDetails>
                <DetailItem>
                  <DetailLabel>Created:</DetailLabel>
                  <DetailValue>{formatDate(session.created_at)}</DetailValue>
                </DetailItem>
                <DetailItem>
                  <DetailLabel>Prompt:</DetailLabel>
                  <DetailValue>{getPromptExcerpt(session.parameters)}</DetailValue>
                </DetailItem>
                <DetailItem>
                  <DetailLabel>Source:</DetailLabel>
                  <DetailValue>{session.parameters?.source || 'Unknown'}</DetailValue>
                </DetailItem>
              </SessionDetails>
              
              <ExpandButton onClick={() => toggleSession(session.id)}>
                {expandedSessions[session.id] 
                  ? '▲ Hide Assets' 
                  : '▼ Show Assets'}
              </ExpandButton>
              
              {expandedSessions[session.id] && (
                <AssetsContainer>
                  <AssetsTitle>Session Assets</AssetsTitle>
                  
                  {!sessionAssets[session.id] ? (
                    <LoadingContainer>
                      <LoadingSpinner />
                      <p>Loading assets...</p>
                    </LoadingContainer>
                  ) : sessionAssets[session.id].length > 0 ? (
                    <AssetsGrid>
                      {sessionAssets[session.id].map(asset => (
                        <AssetCard key={asset.id} asset={asset} />
                      ))}
                    </AssetsGrid>
                  ) : (
                    <EmptyState>
                      <p>No assets found for this session</p>
                    </EmptyState>
                  )}
                </AssetsContainer>
              )}
            </SessionCard>
          ))}
        </SessionsList>
      ) : (
        <EmptyState>
          <h3>No generation sessions found</h3>
          <p>Start by creating a new generation</p>
          <CreateButton to="/generate">
            Generate Your First Vehicle
          </CreateButton>
        </EmptyState>
      )}
    </PageContainer>
  );
};

export default SessionsPage;