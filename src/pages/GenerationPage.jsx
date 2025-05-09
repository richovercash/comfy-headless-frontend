// src/pages/GenerationPage.jsx
import React, { useState } from 'react';
import styled from 'styled-components';
import FluxGenerationForm from '../components/FluxGenerationForm';
import DynamicWorkflowForm from '../components/DynamicWorkflowForm';
import { Link } from 'react-router-dom';

const PageContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
`;

const PageHeader = styled.div`
  margin-bottom: 24px;
  text-align: center;
`;

const InfoSection = styled.div`
  margin: 40px 0;
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #ddd;
  margin-bottom: 20px;
`;

const Tab = styled.button`
  padding: 10px 20px;
  background-color: ${props => props.active ? '#007bff' : '#f8f9fa'};
  color: ${props => props.active ? 'white' : '#333'};
  border: 1px solid #ddd;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  margin-right: 5px;
  cursor: pointer;
  font-weight: ${props => props.active ? 'bold' : 'normal'};
  
  &:hover {
    background-color: ${props => props.active ? '#007bff' : '#e9ecef'};
  }
`;

const GenerationPage = () => {
  const [activeTab, setActiveTab] = useState('flux');
  
  return (
    <PageContainer>
      <PageHeader>
        <h1>Generate New Vehicle</h1>
        <p>Create a new post-apocalyptic vehicle using ComfyUI workflows</p>
      </PageHeader>

      <TabContainer>
        <Tab 
          active={activeTab === 'flux'} 
          onClick={() => setActiveTab('flux')}
        >
          Flux Workflow (Original)
        </Tab>
        <Tab 
          active={activeTab === 'dynamic'} 
          onClick={() => setActiveTab('dynamic')}
        >
          Dynamic Workflow (New)
        </Tab>
      </TabContainer>

      {activeTab === 'flux' ? (
        <FluxGenerationForm />
      ) : (
        <DynamicWorkflowForm />
      )}

      <InfoSection>
        <h3>How it works</h3>
        <p>
          This tool uses ComfyUI workflows to generate post-apocalyptic vehicles based on your description.
          {activeTab === 'flux' ? (
            ' Upload an image for depth map conditioning and a reference image for Redux styling.'
          ) : (
            ' The dynamic workflow system allows importing any workflow from JSON files without hardcoding.'
          )}
        </p>
        <p>
          Once generated, you can view your vehicle in the <Link to="/assets">asset library</Link> 
          and proceed with the 3D conversion process.
        </p>
      </InfoSection>
    </PageContainer>
  );
};

export default GenerationPage;
