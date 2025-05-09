// src/pages/GenerationPage.jsx
import React from 'react';
import styled from 'styled-components';
import FluxGenerationForm from '../components/FluxGenerationForm';
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

const GenerationPage = () => {
  return (
    <PageContainer>
      <PageHeader>
        <h1>Generate New Vehicle</h1>
        <p>Create a new post-apocalyptic vehicle using Flux workflow</p>
      </PageHeader>

      <FluxGenerationForm />

      <InfoSection>
        <h3>How it works</h3>
        <p>
          This tool uses the Flux workflow in ComfyUI to generate post-apocalyptic vehicles based on your description.
          Upload an image for depth map conditioning and a reference image for Redux styling.
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