// src/pages/SessionsPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
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

const SessionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SessionCard = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  background-color: white;
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

const SessionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const SessionTitle = styled.h3`
  margin: 0;
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
  margin-top: 8px;
  color: #666;
  font-size: 0.9rem;
`;

const SessionsPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);
        const sessionsData = await SupabaseService.getSessions();
        setSessions(sessionsData);
      } catch (error) {
        console.error('Error loading sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, []);

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

  return (
    <PageContainer>
      <PageHeader>
        <h1>Generation Sessions</h1>
        <Link to="/generate">
          <button>New Generation</button>
        </Link>
      </PageHeader>

      {loading ? (
        <p>Loading sessions...</p>
      ) : sessions.length > 0 ? (
        <SessionsList>
          {sessions.map(session => (
            <Link 
              to={`/sessions/${session.id}`} 
              key={session.id}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <SessionCard>
                <SessionHeader>
                  <SessionTitle>
                    Session {session.id.substring(0, 8)}
                  </SessionTitle>
                  <StatusBadge status={session.status}>
                    {getStatusLabel(session.status)}
                  </StatusBadge>
                </SessionHeader>
                
                <SessionDetails>
                  <div>Created: {formatDate(session.created_at)}</div>
                  <div>
                    Prompt: {session.parameters?.prompt?.substring(0, 50) || 'No prompt'}
                    {session.parameters?.prompt?.length > 50 ? '...' : ''}
                  </div>
                </SessionDetails>
              </SessionCard>
            </Link>
          ))}
        </SessionsList>
      ) : (
        <div>
          <p>No generation sessions found. Start by creating a new generation.</p>
          <Link to="/generate">
            <button>Create First Generation</button>
          </Link>
        </div>
      )}
    </PageContainer>
  );
};

export default SessionsPage;