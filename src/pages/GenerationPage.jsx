// src/pages/GenerationPage.jsx
import React from 'react';
import styled from 'styled-components';
import GenerationForm from '../components/GenerationForm';
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
        <p>Create a new post-apocalyptic vehicle using ComfyUI</p>
      </PageHeader>

      <GenerationForm />

      <InfoSection>
        <h3>How it works</h3>
        <p>
          This tool uses ComfyUI to generate post-apocalyptic vehicles based on your description 
          and selected traits. First, provide a base description of the vehicle you want to create.
          Then select any additional traits to include in the generation.
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