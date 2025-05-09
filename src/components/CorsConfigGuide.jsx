// src/components/CorsConfigGuide.jsx
import React from 'react';
import styled from 'styled-components';

const GuideContainer = styled.div`
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  max-width: 800px;
`;

const Title = styled.h2`
  color: #343a40;
  margin-top: 0;
  margin-bottom: 16px;
`;

const Section = styled.div`
  margin-bottom: 16px;
`;

const SectionTitle = styled.h3`
  color: #495057;
  margin-top: 0;
  margin-bottom: 8px;
`;

const CodeBlock = styled.pre`
  background-color: #212529;
  color: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
`;

const List = styled.ul`
  padding-left: 20px;
  margin-bottom: 16px;
`;

const ListItem = styled.li`
  margin-bottom: 8px;
`;

const Alert = styled.div`
  background-color: #fff3cd;
  color: #856404;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
  border-left: 4px solid #ffc107;
`;

/**
 * A component that provides guidance on configuring CORS for ComfyUI
 */
const CorsConfigGuide = () => {
  return (
    <GuideContainer>
      <Title>ComfyUI CORS Configuration Guide</Title>
      
      <Alert>
        <strong>Connection Issues?</strong> If you're experiencing "Network Error" or "CORS" errors when connecting to ComfyUI, 
        you need to configure ComfyUI to allow cross-origin requests from this application.
      </Alert>
      
      <Section>
        <SectionTitle>What is CORS?</SectionTitle>
        <p>
          Cross-Origin Resource Sharing (CORS) is a security feature implemented by browsers that restricts web pages from making 
          requests to a different domain than the one that served the web page. ComfyUI needs to be configured to allow requests 
          from this application.
        </p>
      </Section>
      
      <Section>
        <SectionTitle>How to Enable CORS in ComfyUI</SectionTitle>
        <p>You need to start ComfyUI with the appropriate command-line flags:</p>
        
        <CodeBlock>python main.py --enable-cors-header="*" --host=0.0.0.0</CodeBlock>
        
        <p>This command does two important things:</p>
        <List>
          <ListItem>
            <strong>--enable-cors-header="*"</strong>: Allows requests from any origin (including this application)
          </ListItem>
          <ListItem>
            <strong>--host=0.0.0.0</strong>: Makes ComfyUI accessible from other devices on your network (optional, but recommended)
          </ListItem>
        </List>
      </Section>
      
      <Section>
        <SectionTitle>Verifying Your Configuration</SectionTitle>
        <p>After restarting ComfyUI with the correct flags:</p>
        <List>
          <ListItem>Click the "Test ComfyUI Connection" button to verify connectivity</ListItem>
          <ListItem>If successful, you should see a "Connection test successful!" message</ListItem>
          <ListItem>If you still see CORS errors, make sure ComfyUI is running with the correct flags</ListItem>
        </List>
      </Section>
      
      <Section>
        <SectionTitle>Common Issues</SectionTitle>
        <List>
          <ListItem>
            <strong>Wrong ComfyUI URL</strong>: Make sure the VITE_COMFY_UI_API environment variable is set correctly in your .env file
          </ListItem>
          <ListItem>
            <strong>ComfyUI Not Running</strong>: Ensure ComfyUI is actually running and accessible at the configured URL
          </ListItem>
          <ListItem>
            <strong>Firewall Issues</strong>: Check if a firewall is blocking connections to the ComfyUI port (default: 8188)
          </ListItem>
          <ListItem>
            <strong>Missing CORS Flags</strong>: Verify that ComfyUI was started with the --enable-cors-header flag
          </ListItem>
        </List>
      </Section>
      
      <Section>
        <SectionTitle>Advanced Configuration</SectionTitle>
        <p>If you need more specific CORS settings, you can restrict which origins are allowed:</p>
        
        <CodeBlock>python main.py --enable-cors-header="http://localhost:5173,http://localhost:3000"</CodeBlock>
        
        <p>This would only allow requests from those specific origins.</p>
      </Section>
    </GuideContainer>
  );
};

export default CorsConfigGuide;
