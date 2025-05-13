// src/pages/UrlTestPage.jsx
import React from 'react';
import styled from 'styled-components';
import ComfyUIURLTester from '../components/ComfyUIURLTester';

/**
 * Page for testing ComfyUI URL compatibility
 */
const UrlTestPage = () => {
  return (
    <PageContainer>
      <PageHeader>
        <h1>ComfyUI Compatibility Test</h1>
        <p>
          Use this page to verify that your ComfyUI setup can properly load images from URLs
          and has the necessary components for the Redux workflow.
        </p>
      </PageHeader>
      
      <ComfyUIURLTester />
      
      <NextStepsSection>
        <h2>Next Steps</h2>
        
        <StepBox>
          <h3>If URL Loading Works:</h3>
          <ol>
            <li>Proceed with implementing the Redux workflow using the LoadImageFromURL approach</li>
            <li>Ensure your Supabase buckets have proper CORS configuration</li>
            <li>Update your ComfyService to use the advanced workflow</li>
          </ol>
        </StepBox>
        
        <StepBox>
          <h3>If URL Loading Fails:</h3>
          <ol>
            <li>Use the Base64 approach by integrating the Base64Service</li>
            <li>Update your ComfyService to convert image files to base64 before sending to ComfyUI</li>
            <li>Ensure ComfyUI has the necessary nodes for base64 image loading</li>
          </ol>
        </StepBox>
      </NextStepsSection>
      
      <DocSection>
        <h2>Implementation Guide</h2>
        <p>
          Based on your test results, follow the appropriate integration path. 
          Both approaches will use the same UI components, but different backend methods
          for handling the image data.
        </p>
        
        <h3>URL-Based Approach</h3>
        <CodeExample>
          <code>
{`// In ComfyService.js
createFluxAdvancedWorkflow({
  // ...other params
  inputImageUrl, 
  reduxImageUrl 
}) {
  // Use LoadImageFromURL nodes
  workflow["85"] = {
    "inputs": {
      "url": inputImageUrl
    },
    "class_type": "LoadImageFromURL",
    "_meta": {
      "title": "Load Input Image"
    }
  };
  
  // Similarly for Redux image
  if (reduxImageUrl) {
    workflow["94"] = {
      "inputs": {
        "url": reduxImageUrl
      },
      "class_type": "LoadImageFromURL",
      "_meta": {
        "title": "Load Redux Image"
      }
    };
  }
  
  // Rest of the workflow creation...
}`}
          </code>
        </CodeExample>
        
        <h3>Base64 Approach</h3>
        <CodeExample>
          <code>
{`// In your form submission handler
import Base64Service from '../services/base64Service';

const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Create the workflow
  let workflowResult = ComfyService.createFluxAdvancedWorkflow({
    prompt: values.prompt,
    steps: values.steps,
    reduxStrength: values.reduxStrength,
    useDepth: values.useDepth,
    filenamePrefix: values.filenamePrefix
  });
  
  // Prepare image map for base64 conversion
  const imageMap = {};
  if (values.inputImage) {
    imageMap["85"] = values.inputImage;
  }
  if (values.reduxImage) {
    imageMap["94"] = values.reduxImage;
  }
  
  // Convert workflow to use base64
  const base64Workflow = await Base64Service.convertWorkflowToBase64(
    workflowResult.workflow,
    imageMap
  );
  
  // Queue the modified workflow
  const response = await ComfyService.queuePrompt(base64Workflow);
  
  // Continue with result handling...
}`}
          </code>
        </CodeExample>
      </DocSection>
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

const DocSection = styled.div`
  margin-top: 40px;
  
  h2 {
    border-bottom: 2px solid #eee;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }
  
  h3 {
    margin-top: 30px;
    color: #333;
  }
  
  p {
    color: #555;
    line-height: 1.6;
    margin-bottom: 20px;
  }
`;

const CodeExample = styled.pre`
  background-color: #272822;
  color: #f8f8f2;
  padding: 20px;
  border-radius: 5px;
  overflow-x: auto;
  margin-bottom: 30px;
  
  code {
    font-family: 'Fira Code', monospace;
    font-size: 14px;
    line-height: 1.5;
  }
`;

export default UrlTestPage;