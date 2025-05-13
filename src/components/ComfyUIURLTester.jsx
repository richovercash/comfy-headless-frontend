// src/components/ComfyUIURLTester.jsx
import React, { useState } from 'react';
import styled from 'styled-components';

const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';

/**
 * A component to test if ComfyUI can load images from URLs
 */
const ComfyUIURLTester = () => {
  const [testUrl, setTestUrl] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [outputImage, setOutputImage] = useState(null);

  // Simple workflow that tests URL loading and outputs a result
  const generateTestWorkflow = (imageUrl) => {
    const timestamp = new Date().getTime();
    
    // The most basic workflow possible:
    // 1. Load image from URL
    // 2. Save the result
    return {
      workflow: {
        "1": {
          "inputs": {
            "url": imageUrl
          },
          "class_type": "LoadImageFromURL",
          "_meta": {
            "title": "Load Image From URL"
          }
        },
        "2": {
          "inputs": {
            "filename_prefix": "url_test_" + timestamp,
            "images": [
              "1",
              0
            ]
          },
          "class_type": "SaveImage",
          "_meta": {
            "title": "Save Image"
          }
        }
      },
      outputFilename: "url_test_" + timestamp + ".png"
    };
  };
  
  // Alternative workflow that uses a different node if available
  const generateAltTestWorkflow = (imageUrl) => {
    const timestamp = new Date().getTime();
    
    return {
      workflow: {
        "1": {
          "inputs": {
            "image_url": imageUrl
          },
          "class_type": "AnyURL",
          "_meta": {
            "title": "AnyURL"
          }
        },
        "2": {
          "inputs": {
            "filename_prefix": "url_test_alt_" + timestamp,
            "images": [
              "1",
              0
            ]
          },
          "class_type": "SaveImage",
          "_meta": {
            "title": "Save Image"
          }
        }
      },
      outputFilename: "url_test_alt_" + timestamp + ".png"
    };
  };

  const runURLTest = async () => {
    if (!testUrl.trim()) {
      setTestResults({
        success: false,
        message: "Please enter a URL to test"
      });
      return;
    }

    setIsLoading(true);
    setTestResults(null);
    setOutputImage(null);
    
    try {
      // First, check if the image at the URL is accessible
      try {
        const response = await fetch(testUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`Image URL returned status ${response.status}`);
        }
        
        // Try to load the preview
        setPreviewImage(testUrl);
      } catch (error) {
        setTestResults({
          success: false,
          message: `URL is not accessible: ${error.message}`
        });
        setIsLoading(false);
        return;
      }
      
      // Next, test if ComfyUI is responsive
      try {
        const statsResponse = await fetch(`${API_BASE_URL}/system_stats`);
        if (!statsResponse.ok) {
          throw new Error(`ComfyUI returned status ${statsResponse.status}`);
        }
        
        // Get list of available nodes to choose the right workflow
        const modelsResponse = await fetch(`${API_BASE_URL}/object_info`);
        const modelsData = await modelsResponse.json();
        
        // Generate the appropriate workflow based on available nodes
        let testData;
        if (modelsData.LoadImageFromURL) {
          console.log("Using LoadImageFromURL node");
          testData = generateTestWorkflow(testUrl);
        } else if (modelsData.AnyURL) {
          console.log("Using AnyURL node");
          testData = generateAltTestWorkflow(testUrl);
        } else {
          throw new Error("Neither LoadImageFromURL nor AnyURL nodes are available in ComfyUI");
        }
        
        console.log("Test workflow:", testData.workflow);
        
        // Queue the workflow
        const promptResponse = await fetch(`${API_BASE_URL}/prompt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: testData.workflow }),
        });
        
        if (!promptResponse.ok) {
          const errorData = await promptResponse.json();
          throw new Error(`Failed to queue prompt: ${JSON.stringify(errorData)}`);
        }
        
        const promptResult = await promptResponse.json();
        console.log("Prompt queued:", promptResult);
        
        // Wait for a few seconds to allow processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Poll for the result image
        let found = false;
        let attempts = 0;
        while (!found && attempts < 10) {
          attempts++;
          try {
            const testImageUrl = `${API_BASE_URL}/view?filename=${encodeURIComponent(testData.outputFilename)}`;
            const imageCheckResponse = await fetch(testImageUrl, { method: 'HEAD' });
            
            if (imageCheckResponse.ok) {
              setOutputImage(testImageUrl);
              found = true;
              setTestResults({
                success: true,
                message: "URL loading test successful! ComfyUI can load images from this URL."
              });
            } else {
              console.log(`Attempt ${attempts}: Output image not ready yet`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (e) {
            console.log(`Error checking for output image:`, e);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!found) {
          throw new Error("Output image not found after multiple attempts");
        }
        
      } catch (error) {
        setTestResults({
          success: false,
          message: `ComfyUI error: ${error.message}`
        });
      }
      
    } catch (error) {
      setTestResults({
        success: false,
        message: `Test failed: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to test Node/Extension availability
  const checkNodeAvailability = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/object_info`);
      if (!response.ok) {
        throw new Error(`ComfyUI returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check for relevant nodes
      const nodeAvailability = {
        LoadImageFromURL: !!data.LoadImageFromURL,
        AnyURL: !!data.AnyURL,
        StyleModelLoader: !!data.StyleModelLoader,
        StyleModelApplyAdvanced: !!data.StyleModelApplyAdvanced,
        DepthAnything_V2: !!data.DepthAnything_V2,
        FluxGuidance: !!data.FluxGuidance
      };
      
      setTestResults({
        success: true,
        message: "Node availability check completed",
        nodeAvailability
      });
      
    } catch (error) {
      setTestResults({
        success: false,
        message: `Node availability check failed: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <h2>ComfyUI URL Loading Test</h2>
      
      <Description>
        This tool tests if your ComfyUI instance can load images directly from URLs.
        Enter a publicly accessible image URL below and click "Test URL" to verify.
      </Description>
      
      <InputGroup>
        <Label>Image URL to Test:</Label>
        <Input
          type="text"
          value={testUrl}
          onChange={(e) => setTestUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
        />
        <ButtonGroup>
          <Button onClick={runURLTest} disabled={isLoading}>
            {isLoading ? 'Testing...' : 'Test URL'}
          </Button>
          <Button 
            onClick={checkNodeAvailability} 
            disabled={isLoading}
            className="secondary"
          >
            Check Node Availability
          </Button>
        </ButtonGroup>
      </InputGroup>
      
      {previewImage && (
        <Section>
          <h3>Input Preview:</h3>
          <PreviewImage src={previewImage} alt="URL Preview" />
        </Section>
      )}
      
      {outputImage && (
        <Section>
          <h3>ComfyUI Output:</h3>
          <PreviewImage src={outputImage} alt="ComfyUI Output" />
        </Section>
      )}
      
      {testResults && (
        <ResultBox success={testResults.success}>
          <h3>{testResults.success ? '✅ Success' : '❌ Error'}</h3>
          <p>{testResults.message}</p>
          
          {testResults.nodeAvailability && (
            <NodeAvailability>
              <h4>Node Availability:</h4>
              <ul>
                {Object.entries(testResults.nodeAvailability).map(([node, available]) => (
                  <li key={node} className={available ? 'available' : 'missing'}>
                    {node}: {available ? '✅ Available' : '❌ Missing'}
                  </li>
                ))}
              </ul>
            </NodeAvailability>
          )}
        </ResultBox>
      )}
      
      <TroubleshootingGuide>
        <h3>Troubleshooting Guide</h3>
        <ul>
          <li>
            <strong>Missing Nodes:</strong> If LoadImageFromURL is not available, install the comfyui-url-loader extension:
            <code>git clone https://github.com/sprite-puppet/comfyui-url-loader</code>
          </li>
          <li>
            <strong>CORS Issues:</strong> Make sure your ComfyUI is started with CORS enabled:
            <code>python main.py --enable-cors-header="*"</code>
          </li>
          <li>
            <strong>URL Accessibility:</strong> The image URL must be publicly accessible without authentication
          </li>
          <li>
            <strong>Alternative:</strong> If URL loading continues to fail, consider using the Base64 encoding approach instead
          </li>
        </ul>
      </TroubleshootingGuide>
    </Container>
  );
};

// Styled components
const Container = styled.div`
  background-color: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 800px;
  margin: 0 auto;
`;

const Description = styled.p`
  color: #555;
  line-height: 1.5;
  margin-bottom: 20px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
`;

const Label = styled.label`
  font-weight: bold;
  color: #333;
`;

const Input = styled.input`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
`;

const Button = styled.button`
  background-color: ${props => props.className === 'secondary' ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px 20px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${props => props.className === 'secondary' ? '#5a6268' : '#0069d9'};
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const Section = styled.div`
  margin-top: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 15px;
  
  h3 {
    margin-top: 0;
    margin-bottom: 10px;
  }
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 300px;
  border-radius: 4px;
  display: block;
  margin: 0 auto;
`;

const ResultBox = styled.div`
  margin-top: 20px;
  border-radius: 4px;
  padding: 15px;
  background-color: ${props => props.success ? '#e8f5e9' : '#ffebee'};
  border: 1px solid ${props => props.success ? '#c8e6c9' : '#ffcdd2'};
  
  h3 {
    margin-top: 0;
    color: ${props => props.success ? '#2e7d32' : '#c62828'};
  }
`;

const NodeAvailability = styled.div`
  margin-top: 15px;
  
  ul {
    list-style-type: none;
    padding-left: 5px;
  }
  
  .available {
    color: #2e7d32;
  }
  
  .missing {
    color: #c62828;
  }
`;

const TroubleshootingGuide = styled.div`
  margin-top: 30px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  
  h3 {
    margin-top: 0;
  }
  
  ul {
    padding-left: 20px;
  }
  
  li {
    margin-bottom: 10px;
  }
  
  code {
    display: block;
    margin: 5px 0;
    padding: 10px;
    background-color: #272822;
    color: #f8f8f2;
    border-radius: 4px;
    font-family: monospace;
    white-space: pre-wrap;
  }
`;

export default ComfyUIURLTester;