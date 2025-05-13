// src/components/Base64Tester.jsx
import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';

const API_BASE_URL = import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188';

/**
 * A component to test if ComfyUI's base64 image loading is working
 */
const Base64Tester = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [base64String, setBase64String] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [outputImage, setOutputImage] = useState(null);
  const [availableNodes, setAvailableNodes] = useState([]);
  const [selectedNodeType, setSelectedNodeType] = useState(null);
  const [base64TruncatedPreview, setBase64TruncatedPreview] = useState('');
  
  const fileInputRef = useRef(null);

  // Check available nodes when component mounts
  useEffect(() => {
    checkAvailableNodes();
  }, []);

  // When a file is selected, create a preview and convert to base64
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      setBase64String('');
      setBase64TruncatedPreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    // Convert to base64
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = () => {
      // Get the base64 part (remove the data:image/xyz;base64, prefix)
      const base64 = reader.result.split(',')[1];
      setBase64String(base64);
      setBase64TruncatedPreview(base64.substring(0, 50) + '...');
    };

    // Cleanup function
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  // Check which base64 nodes are available in ComfyUI
  const checkAvailableNodes = async () => {
    try {
      setIsTesting(true);
      const response = await fetch(`${API_BASE_URL}/object_info`);
      
      if (!response.ok) {
        throw new Error(`ComfyUI returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Look for different types of base64 nodes
      const base64Nodes = [];
      
      // Check for known base64 node types
      const nodeTypes = [
        'LoadImageFromBase64', 
        'Base64ToImage',
        'LoadBase64Image', 
        'ImageFromBase64'
      ];
      
      for (const nodeType of nodeTypes) {
        if (data[nodeType]) {
          base64Nodes.push({
            name: nodeType,
            inputParam: getBase64ParamName(nodeType, data[nodeType])
          });
        }
      }
      
      setAvailableNodes(base64Nodes);
      
      if (base64Nodes.length > 0) {
        setSelectedNodeType(base64Nodes[0]);
      }
      
      console.log("Available base64 nodes:", base64Nodes);
      
    } catch (error) {
      console.error("Error checking available nodes:", error);
      setTestResults({
        success: false,
        message: `Failed to check node availability: ${error.message}`
      });
    } finally {
      setIsTesting(false);
    }
  };
  
  // Try to determine the parameter name for base64 input
  const getBase64ParamName = (nodeType, nodeInfo) => {
    // Default values for different node types
    const defaultParams = {
      'LoadImageFromBase64': 'base64_data',
      'Base64ToImage': 'base64',
      'LoadBase64Image': 'image',
      'ImageFromBase64': 'base64_string'
    };
    
    // Try to get from nodeInfo if possible
    if (nodeInfo && nodeInfo.input && nodeInfo.input.required) {
      const params = Object.keys(nodeInfo.input.required);
      // Look for likely parameter names
      for (const param of params) {
        if (param.includes('base64') || param.includes('image') || param.includes('data')) {
          return param;
        }
      }
      // If no obvious parameter, return the first one
      if (params.length > 0) {
        return params[0];
      }
    }
    
    // Fall back to defaults
    return defaultParams[nodeType] || 'base64_data';
  };

  // Handle file selection
  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  // Create and run a test workflow
  const runBase64Test = async () => {
    if (!selectedFile || !base64String || !selectedNodeType) {
      setTestResults({
        success: false,
        message: "Please select a file and a node type first"
      });
      return;
    }

    setIsTesting(true);
    setTestResults(null);
    setOutputImage(null);

    try {
      // Generate a unique filename for the output
      const timestamp = new Date().getTime();
      const outputFilename = `base64_test_${timestamp}.png`;
      
      // Create a simple workflow that just loads and saves the image
      const workflow = {
        "1": {
          "inputs": {
            [selectedNodeType.inputParam]: base64String
          },
          "class_type": selectedNodeType.name,
          "_meta": {
            "title": "Load Image From Base64"
          }
        },
        "2": {
          "inputs": {
            "filename_prefix": "base64_test_" + timestamp,
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
      };
      
      console.log("Testing workflow:", workflow);
      
      // Queue the workflow
      const response = await fetch(`${API_BASE_URL}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: workflow }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to queue prompt: ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      console.log("Prompt queued:", data);
      
      // Wait for a few seconds to allow processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Poll for the result image
      let found = false;
      let attempts = 0;
      while (!found && attempts < 10) {
        attempts++;
        try {
          const testImageUrl = `${API_BASE_URL}/view?filename=${encodeURIComponent(outputFilename)}`;
          const imageCheckResponse = await fetch(testImageUrl, { method: 'HEAD' });
          
          if (imageCheckResponse.ok) {
            setOutputImage(testImageUrl);
            found = true;
            setTestResults({
              success: true,
              message: "Base64 image loading is working! The image was loaded and saved successfully."
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
      console.error("Error in base64 test:", error);
      setTestResults({
        success: false,
        message: `Base64 test failed: ${error.message}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Container>
      <h2>ComfyUI Base64 Image Loading Test</h2>
      
      <Description>
        This tool tests if your ComfyUI installation can load images using base64 encoding.
        Select an image file and click "Run Test" to verify the functionality.
      </Description>
      
      {availableNodes.length > 0 ? (
        <SuccessBox>
          <h3>✅ Base64 Nodes Available</h3>
          <p>Found {availableNodes.length} base64-compatible node types:</p>
          <ul>
            {availableNodes.map((node, index) => (
              <li key={index}>
                <strong>{node.name}</strong> (parameter: {node.inputParam})
              </li>
            ))}
          </ul>
        </SuccessBox>
      ) : (
        <ErrorBox>
          <h3>❌ No Base64 Nodes Found</h3>
          <p>
            Your ComfyUI installation doesn't have any base64 image loading nodes.
            Please install the extension first:
          </p>
          <CodeBlock>
            cd ComfyUI/custom_nodes<br />
            git clone https://github.com/glowcone/comfyui-base64-to-image<br />
            # Restart ComfyUI
          </CodeBlock>
        </ErrorBox>
      )}
      
      <FileSection>
        <h3>Step 1: Select an Image</h3>
        <FileInput
          type="file"
          onChange={handleFileChange}
          ref={fileInputRef}
          accept="image/*"
        />
        <Button 
          onClick={() => fileInputRef.current.click()}
          disabled={isTesting}
        >
          Choose Image
        </Button>
        
        {selectedFile && (
          <FileDetails>
            <p>
              <strong>Selected file:</strong> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
            {previewUrl && (
              <ImagePreview src={previewUrl} alt="Preview" />
            )}
          </FileDetails>
        )}
      </FileSection>
      
      {selectedFile && availableNodes.length > 0 && (
        <>
          <NodeSection>
            <h3>Step 2: Select Node Type</h3>
            <p>Choose which base64 node to test:</p>
            <NodeSelector>
              {availableNodes.map((node, index) => (
                <NodeOption 
                  key={index}
                  selected={selectedNodeType && selectedNodeType.name === node.name}
                  onClick={() => setSelectedNodeType(node)}
                >
                  {node.name}
                </NodeOption>
              ))}
            </NodeSelector>
          </NodeSection>
          
          <TestSection>
            <h3>Step 3: Run the Test</h3>
            
            {base64String && (
              <Base64Preview>
                <h4>Base64 Preview:</h4>
                <code>{base64TruncatedPreview}</code>
                <small>({(base64String.length / 1024).toFixed(2)} KB encoded)</small>
              </Base64Preview>
            )}
            
            <Button 
              primary
              onClick={runBase64Test}
              disabled={isTesting || !selectedNodeType}
            >
              {isTesting ? 'Testing...' : 'Run Base64 Test'}
            </Button>
          </TestSection>
        </>
      )}
      
      {testResults && (
        <ResultBox success={testResults.success}>
          <h3>{testResults.success ? '✅ Success' : '❌ Error'}</h3>
          <p>{testResults.message}</p>
        </ResultBox>
      )}
      
      {outputImage && (
        <OutputSection>
          <h3>Output Image:</h3>
          <OutputImage src={outputImage} alt="Output" />
          <p>
            <small>If the image appears correctly, base64 loading is working properly.</small>
          </p>
        </OutputSection>
      )}
      
      <TroubleshootingSection>
        <h3>Troubleshooting</h3>
        <ul>
          <li>
            <strong>No base64 nodes found:</strong> Make sure you've installed a compatible extension and restarted ComfyUI.
          </li>
          <li>
            <strong>Errors during testing:</strong> Check your ComfyUI logs for more detailed error messages.
          </li>
          <li>
            <strong>Large images fail:</strong> Try with a smaller image first, as some base64 implementations have size limits.
          </li>
        </ul>
      </TroubleshootingSection>
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

const FileSection = styled.div`
  margin: 20px 0;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  
  h3 {
    margin-top: 0;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const Button = styled.button`
  background-color: ${props => props.primary ? '#007bff' : '#6c757d'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 15px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: ${props => props.primary ? '#0069d9' : '#5a6268'};
  }
  
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const FileDetails = styled.div`
  margin-top: 15px;
`;

const ImagePreview = styled.img`
  max-width: 100%;
  max-height: 200px;
  display: block;
  margin: 10px 0;
  border-radius: 4px;
  border: 1px solid #ddd;
`;

const SuccessBox = styled.div`
  background-color: #d4edda;
  color: #155724;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  
  h3 {
    margin-top: 0;
  }
  
  ul {
    margin-bottom: 0;
  }
`;

const ErrorBox = styled.div`
  background-color: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  
  h3 {
    margin-top: 0;
  }
`;

const CodeBlock = styled.pre`
  background-color: #272822;
  color: #f8f8f2;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: monospace;
`;

const NodeSection = styled.div`
  margin: 20px 0;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  
  h3 {
    margin-top: 0;
  }
`;

const NodeSelector = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
`;

const NodeOption = styled.div`
  padding: 8px 15px;
  background-color: ${props => props.selected ? '#007bff' : '#e9ecef'};
  color: ${props => props.selected ? 'white' : '#333'};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${props => props.selected ? '#0069d9' : '#dee2e6'};
  }
`;

const TestSection = styled.div`
  margin: 20px 0;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  
  h3 {
    margin-top: 0;
  }
`;

const Base64Preview = styled.div`
  margin-bottom: 15px;
  
  code {
    display: block;
    background-color: #f1f1f1;
    padding: 10px;
    border-radius: 4px;
    font-family: monospace;
    overflow-x: auto;
    white-space: nowrap;
    margin: 5px 0;
  }
  
  small {
    color: #6c757d;
  }
`;

const ResultBox = styled.div`
  background-color: ${props => props.success ? '#d4edda' : '#f8d7da'};
  color: ${props => props.success ? '#155724' : '#721c24'};
  padding: 15px;
  border-radius: 4px;
  margin: 20px 0;
  
  h3 {
    margin-top: 0;
  }
`;

const OutputSection = styled.div`
  margin: 20px 0;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  
  h3 {
    margin-top: 0;
  }
`;

const OutputImage = styled.img`
  max-width: 100%;
  border-radius: 4px;
  border: 1px solid #ddd;
`;

const TroubleshootingSection = styled.div`
  margin-top: 30px;
  
  ul {
    padding-left: 20px;
  }
  
  li {
    margin-bottom: 10px;
  }
`;

export default Base64Tester;