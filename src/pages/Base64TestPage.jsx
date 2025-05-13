// src/pages/Base64TestPage.jsx
import React from 'react';
import styled from 'styled-components';
import Base64Tester from '../components/Base64Tester';

/**
 * Page for testing Base64 image loading in ComfyUI
 */
const Base64TestPage = () => {
  return (
    <PageContainer>
      <PageHeader>
        <h1>ComfyUI Base64 Integration Test</h1>
        <p>
          Use this tool to verify that your ComfyUI installation can properly load and process
          images encoded as base64 strings. This is essential for the Redux workflow integration.
        </p>
      </PageHeader>
      
      <Base64Tester />
      
      <NextStepsSection>
        <h2>Next Steps After Testing</h2>
        
        <StepBox>
          <h3>If Base64 Testing Succeeds:</h3>
          <ol>
            <li>Proceed with implementing the Base64 integration approach</li>
            <li>Update your ComfyService to use the base64 image handling</li>
            <li>Implement the Redux workflow with base64-encoded images</li>
          </ol>
        </StepBox>
        
        <StepBox>
          <h3>If Base64 Testing Fails:</h3>
          <ol>
            <li>Check ComfyUI logs for detailed error messages</li>
            <li>Verify that the base64 extension is properly installed</li>
            <li>Try different node types if multiple options are available</li>
            <li>Consider restarting ComfyUI after extension installation</li>
          </ol>
        </StepBox>
      </NextStepsSection>
      
      <InfoSection>
        <h2>How Base64 Integration Works</h2>
        <p>
          Base64 encoding allows us to embed image data directly in the workflow JSON
          instead of requiring ComfyUI to fetch images from URLs. This approach is:
        </p>
        <ul>
          <li><strong>More Reliable:</strong> Avoids URL loading issues</li>
          <li><strong>Self-Contained:</strong> All data is included in a single request</li>
          <li><strong>User-Isolated:</strong> Each workflow has its own image data</li>
          <li><strong>Compatible:</strong> Works with your existing asset management</li>
        </ul>
        <p>
          When implementing this approach, we'll still save images to Supabase for 
          storage and reuse, but we'll convert them to base64 before sending to ComfyUI.
        </p>
      </InfoSection>
    </PageContainer>
  );
};

// Styled components
const PageContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
`;

const PageHeader = styled.div`
  margin-bottom: 30px;
  
  h1 {
    color: #333;
    margin-bottom: 10px;
  }
  
  p {
    color: #666;
    font-size: 1.1rem;
    line-height: 1.5;
  }
`;

const NextStepsSection = styled.div`
  margin-top: 40px;
  
  h2 {
    border-bottom: 2px solid #eee;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }
`;

const StepBox = styled.div`
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  border-left: 5px solid #007bff;
  
  h3 {
    margin-top: 0;
    color: #007bff;
  }
  
  ol {
    padding-left: 20px;
  }
  
  li {
    margin-bottom: 10px;
    line-height: 1.5;
  }
`;

const InfoSection = styled.div`
  margin-top: 40px;
  background-color: #f3f8ff;
  border-radius: 8px;
  padding: 20px;
  
  h2 {
    margin-top: 0;
    color: #333;
  }
  
  p {
    color: #555;
    line-height: 1.6;
  }
  
  ul {
    padding-left: 20px;
  }
  
  li {
    margin-bottom: 8px;
    line-height: 1.5;
  }
`;

export default Base64TestPage;