// src/pages/LoraToolsPage.jsx
import React from 'react';
import styled from 'styled-components';
import LoraDiagnostics from '../components/LoraDiagnostics';
import LoraDebugger from '../components/LoraDebugger';

const LoraToolsPage = () => {
  return (
    <Container>
      <h2>LoRA Tools and Diagnostics</h2>
      
      <Section>
        <h3>Basic LoRA Diagnostics</h3>
        <p>
          Use this tool to test basic connectivity with ComfyUI and 
          import LoRAs from your ComfyUI installation.
        </p>
        <LoraDiagnostics />
      </Section>
      
      <Section>
        <h3>Advanced LoRA Debugging</h3>
        <p>
          This advanced tool helps identify exactly where LoRA integration might be failing.
          It provides detailed diagnostics on workflow integration.
        </p>
        <LoraDebugger />
      </Section>
    </Container>
  );
};

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
`;

const Section = styled.div`
  margin-bottom: 40px;
  
  h3 {
    border-bottom: 1px solid #dee2e6;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }
  
  p {
    margin-bottom: 20px;
    color: #6c757d;
  }
`;

export default LoraToolsPage;