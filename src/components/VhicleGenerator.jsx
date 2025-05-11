// src/components/VehicleGenerator.jsx
import React, { useState, useEffect } from 'react';
import comfyUIService from '../services/comfyUIService';
import reduxSimpleWorkflow from '../workflows/Redux-Simple.json';

const VehicleGenerator = () => {
  const [prompt, setPrompt] = useState('post-apocalyptic vehicle with large wheels and spikes');
  const [negativePrompt, setNegativePrompt] = useState('bad anatomy, bad proportions, blurry, deformed');
  const [steps, setSteps] = useState(30);
  const [width, setWidth] = useState(768);
  const [height, setHeight] = useState(768);
  const [guidanceScale, setGuidanceScale] = useState(3.5);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [connected, setConnected] = useState(false);

  // Check ComfyUI connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isConnected = await comfyUIService.checkConnection();
        setConnected(isConnected);
        if (!isConnected) {
          setError('Unable to connect to ComfyUI server. Please check that it is running.');
        }
      } catch (err) {
        setError('Error connecting to ComfyUI: ' + err.message);
      }
    };
    
    checkConnection();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);
    
    try {
      // Use the updated generateVehicleImage method with our workflow and parameters
      const result = await comfyUIService.generateVehicleImage(reduxSimpleWorkflow, {
        prompt,
        negativePrompt,
        steps,
        width,
        height,
        filenamePrefix: 'vehicle',
        guidanceScale
      });
      
      setResult(result);
      console.log('Generation queued successfully:', result);
      
      // If you want to automatically check for the result:
      // You could start polling for status here using the promptId
      
    } catch (error) {
      console.error('Generation error:', error);
      setError(error.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="vehicle-generator">
      <h2>Post-Apocalyptic Vehicle Generator</h2>
      
      {!connected && (
        <div className="error-message">
          {error || 'Not connected to ComfyUI. Please check your server connection.'}
        </div>
      )}
      
      <div className="form-group">
        <label>
          Prompt:
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={!connected || generating}
          />
        </label>
      </div>
      
      <div className="form-group">
        <label>
          Negative Prompt:
          <textarea 
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            rows={2}
            disabled={!connected || generating}
          />
        </label>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>
            Steps:
            <input 
              type="number" 
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              min={10}
              max={100}
              disabled={!connected || generating}
            />
          </label>
        </div>
        
        <div className="form-group">
          <label>
            Width:
            <input 
              type="number" 
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              min={512}
              max={1024}
              step={64}
              disabled={!connected || generating}
            />
          </label>
        </div>
        
        <div className="form-group">
          <label>
            Height:
            <input 
              type="number" 
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              min={512}
              max={1024}
              step={64}
              disabled={!connected || generating}
            />
          </label>
        </div>
        
        <div className="form-group">
          <label>
            Guidance Scale:
            <input 
              type="number" 
              value={guidanceScale}
              onChange={(e) => setGuidanceScale(Number(e.target.value))}
              min={1}
              max={10}
              step={0.1}
              disabled={!connected || generating}
            />
          </label>
        </div>
      </div>
      
      <button 
        onClick={handleGenerate}
        disabled={!connected || generating}
        className="generate-button"
      >
        {generating ? 'Generating...' : 'Generate Vehicle'}
      </button>
      
      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}
      
      {result && (
        <div className="result-section">
          <h3>Generation Queued!</h3>
          <p>Prompt ID: {result.prompt_id}</p>
          <p>Your image is being generated and will appear in ComfyUI's gallery when complete.</p>
        </div>
      )}
      
      {/* You could add an image display section here that polls for the result */}
    </div>
  );
};

export default VehicleGenerator;