// src/components/ReliableVehicleGenerator.jsx
import React, { useState, useEffect } from 'react';
import comfyService from '../services/comfyService';
import reduxSimpleWorkflow from '../workflows/Redux-Simple.json';

function ReliableVehicleGenerator() {
  const [formData, setFormData] = useState({
    prompt: 'post-apocalyptic vehicle with large wheels and spikes',
    negativePrompt: 'bad anatomy, bad proportions, blurry, deformed',
    steps: 30,
    seed: Math.floor(Math.random() * 1000000000),
    width: 768,
    height: 768,
    filenamePrefix: 'vehicle',
    guidanceScale: 3.5
  });
  
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({ checking: true, connected: false });

  // Check connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await comfyService.testConnection();
        setConnectionStatus({
          checking: false,
          connected: status.success,
          message: status.success ? 'Connected to ComfyUI' : status.error.message
        });
      } catch (error) {
        setConnectionStatus({
          checking: false,
          connected: false,
          message: error.message
        });
      }
    };
    
    checkConnection();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    // Convert numeric inputs to numbers
    const processedValue = type === 'number' 
      ? name === 'guidanceScale' ? parseFloat(value) : parseInt(value, 10)
      : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  const handleRandomSeed = () => {
    setFormData(prev => ({
      ...prev,
      seed: Math.floor(Math.random() * 1000000000)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setGenerating(true);
    
    try {
      // Use the reliable method for vehicle generation
      const result = await comfyService.createAndQueueReliableVehicleWorkflow(
        reduxSimpleWorkflow,
        formData
      );
      
      setResult(result);
    } catch (error) {
      console.error('Generation error:', error);
      setError(error.message);
    } finally {
      setGenerating(false);
    }
  };

  if (connectionStatus.checking) {
    return <div>Checking connection to ComfyUI...</div>;
  }

  if (!connectionStatus.connected) {
    return (
      <div className="error-container">
        <h2>Connection Error</h2>
        <p>Could not connect to ComfyUI: {connectionStatus.message}</p>
        <p>Please make sure ComfyUI is running and accessible.</p>
      </div>
    );
  }

  return (
    <div className="generator-container">
      <h2>Reliable Vehicle Generator</h2>
      <p>This uses a direct conversion approach for more reliable results.</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="prompt">Prompt:</label>
          <textarea
            id="prompt"
            name="prompt"
            value={formData.prompt}
            onChange={handleInputChange}
            disabled={generating}
            rows={3}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="negativePrompt">Negative Prompt:</label>
          <textarea
            id="negativePrompt"
            name="negativePrompt"
            value={formData.negativePrompt}
            onChange={handleInputChange}
            disabled={generating}
            rows={2}
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="steps">Steps:</label>
            <input
              id="steps"
              name="steps"
              type="number"
              min={10}
              max={100}
              value={formData.steps}
              onChange={handleInputChange}
              disabled={generating}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="seed">Seed:</label>
            <div className="seed-container">
              <input
                id="seed"
                name="seed"
                type="number"
                value={formData.seed}
                onChange={handleInputChange}
                disabled={generating}
              />
              <button 
                type="button" 
                onClick={handleRandomSeed}
                disabled={generating}
                className="seed-button"
              >
                🎲
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="guidanceScale">Guidance Scale:</label>
            <input
              id="guidanceScale"
              name="guidanceScale"
              type="number"
              min={1}
              max={10}
              step={0.1}
              value={formData.guidanceScale}
              onChange={handleInputChange}
              disabled={generating}
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="width">Width:</label>
            <input
              id="width"
              name="width"
              type="number"
              min={512}
              max={1024}
              step={64}
              value={formData.width}
              onChange={handleInputChange}
              disabled={generating}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="height">Height:</label>
            <input
              id="height"
              name="height"
              type="number"
              min={512}
              max={1024}
              step={64}
              value={formData.height}
              onChange={handleInputChange}
              disabled={generating}
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button 
            type="submit" 
            disabled={generating}
            className="generate-button"
          >
            {generating ? 'Generating...' : 'Generate Vehicle'}
          </button>
        </div>
      </form>
      
      {error && (
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}
      
      {result && (
        <div className="result-section">
          <h3>Generation Queued!</h3>
          <p>Prompt ID: <strong>{result.prompt_id}</strong></p>
          <p>Your image is being generated and will appear in ComfyUI's gallery when complete.</p>
        </div>
      )}
    </div>
  );
}

export default ReliableVehicleGenerator;