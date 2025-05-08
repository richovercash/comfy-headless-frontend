// src/components/VehicleGenerator.jsx
import React, { useState, useEffect } from 'react';
import { useComfyUI } from '../hooks/useComfyUI';
import { supabase } from "../services/supabaseService";
import ProgressBar from './ProgressBar';
import ErrorDisplay from './ErrorDisplay';
import { getVehicleWorkflow } from '../workflows/vehicleWorkflow';

const VehicleGenerator = ({ onSuccess }) => {
  const [name, setName] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [attributes, setAttributes] = useState({
    condition: 'weathered',
    style: 'military',
    color: 'rust',
    features: []
  });
  
  // Initialize ComfyUI hook
  const { 
    isConnected, 
    isProcessing, 
    progress, 
    currentJob, 
    results, 
    error, 
    submitJob 
  } = useComfyUI();
  
  // Generate vehicle when form is submitted
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      alert('Not connected to ComfyUI. Please check the connection and try again.');
      return;
    }
    
    try {
      // Create workflow for ComfyUI
      console.log("Creating workflow with parameters:", { name, vehicleType, attributes });

      const workflow = getVehicleWorkflow({
        name,
        vehicleType,
        attributes
      });
      console.log("Generated workflow:", workflow);

      // Submit the job to ComfyUI
      console.log("Submitting workflow to ComfyUI...");
      console.log("Submit job result:", job);


      const job = await submitJob(workflow);
      
      if (!job) {
        throw new Error('Failed to submit vehicle generation job');
      }
      
      // Create a new generation session in the database
      const { data, error: dbError } = await supabase
        .from('generation_sessions')
        .insert([
          {
            status: 'in_progress',
            parameters: {
              name,
              vehicleType,
              attributes,
              workflow_id: job.prompt_id
            }
          }
        ])
        .select('id');
      
      if (dbError) {
        console.error('Error creating generation session:', dbError);
      }
      
      // No need to do anything else - the WebSocket will update us on progress
      
    } catch (err) {
      console.error('Error starting generation:', err);
      alert(`Error generating asset: ${err.message}. Please check the console for more details.`);

    }
  };
  
  // When results are available, save them to the database
  useEffect(() => {
    if (!results) return;
    
    const saveResults = async () => {
      try {
        // Find the generation session for this job
        const { data: sessions, error: sessionError } = await supabase
          .from('generation_sessions')
          .select('id')
          .eq('parameters->workflow_id', results.promptId)
          .limit(1);
        
        if (sessionError) {
          throw new Error(`Database error: ${sessionError.message}`);
        }
        
        if (!sessions || sessions.length === 0) {
          throw new Error('Could not find generation session for this job');
        }
        
        const sessionId = sessions[0].id;
        
        // For each image result, create an asset record
        for (const image of results.images) {
          // First, save the image file to Supabase storage
          const filename = `${sessionId}/${image.filename}`;
          const response = await fetch(image.url);
          const blob = await response.blob();
          
          const { data: storageData, error: storageError } = await supabase
            .storage
            .from('images-2d')
            .upload(filename, blob);
          
          if (storageError) {
            console.error('Storage error:', storageError);
            continue;
          }
          
          // Then create the asset record
          const { data: assetData, error: assetError } = await supabase
            .from('assets')
            .insert([
              {
                asset_type: 'image_2d',
                storage_path: filename,
                status: 'complete',
                metadata: {
                  nodeId: image.nodeId,
                  originalFilename: image.filename
                }
              }
            ])
            .select('id');
          
          if (assetError) {
            console.error('Asset creation error:', assetError);
            continue;
          }
          
          // Link the asset to the session
          const { error: junctionError } = await supabase
            .from('session_assets')
            .insert([
              {
                session_id: sessionId,
                asset_id: assetData[0].id
              }
            ]);
          
          if (junctionError) {
            console.error('Junction table error:', junctionError);
          }
        }
        
        // Update the session status
        const { error: updateError } = await supabase
          .from('generation_sessions')
          .update({ status: 'completed' })
          .eq('id', sessionId);
        
        if (updateError) {
          console.error('Session update error:', updateError);
        }
        
        // Call success callback
        if (onSuccess) {
          onSuccess(sessionId, results);
        }
        
      } catch (err) {
        console.error('Error saving results:', err);
      }
    };
    
    saveResults();
  }, [results, onSuccess]);
  
  return (
    <div className="vehicle-generator">
      <h2>Generate Post-Apocalyptic Vehicle</h2>
      
      {error && <ErrorDisplay message={error} />}
      
      <div className="connection-status">
        Connection Status: 
        <span className={isConnected ? 'connected' : 'disconnected'}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      {isProcessing ? (
        <div className="generation-status">
          <h3>Generating Vehicle...</h3>
          <ProgressBar value={progress} />
          <p>Please wait while your vehicle is being generated.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Vehicle Name:</label>
            <input 
              type="text" 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="vehicleType">Vehicle Type:</label>
            <select 
              id="vehicleType" 
              value={vehicleType} 
              onChange={(e) => setVehicleType(e.target.value)}
            >
              <option value="car">Car</option>
              <option value="truck">Truck</option>
              <option value="motorcycle">Motorcycle</option>
              <option value="tank">Tank</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="condition">Condition:</label>
            <select 
              id="condition" 
              value={attributes.condition} 
              onChange={(e) => setAttributes({...attributes, condition: e.target.value})}
            >
              <option value="weathered">Weathered</option>
              <option value="rusted">Heavily Rusted</option>
              <option value="damaged">Battle Damaged</option>
              <option value="restored">Survivor Restored</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="style">Style:</label>
            <select 
              id="style" 
              value={attributes.style} 
              onChange={(e) => setAttributes({...attributes, style: e.target.value})}
            >
              <option value="military">Military</option>
              <option value="scavenger">Scavenger</option>
              <option value="wasteland">Wasteland</option>
              <option value="tribal">Tribal</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="color">Base Color:</label>
            <select 
              id="color" 
              value={attributes.color} 
              onChange={(e) => setAttributes({...attributes, color: e.target.value})}
            >
              <option value="rust">Rust</option>
              <option value="camo">Camo</option>
              <option value="black">Black</option>
              <option value="multi">Multi-colored</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Special Features:</label>
            <div className="checkbox-group">
              <label>
                <input 
                  type="checkbox" 
                  checked={attributes.features.includes('spikes')} 
                  onChange={(e) => {
                    const updatedFeatures = e.target.checked 
                      ? [...attributes.features, 'spikes'] 
                      : attributes.features.filter(f => f !== 'spikes');
                    setAttributes({...attributes, features: updatedFeatures});
                  }} 
                />
                Spikes
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  checked={attributes.features.includes('armor')} 
                  onChange={(e) => {
                    const updatedFeatures = e.target.checked 
                      ? [...attributes.features, 'armor'] 
                      : attributes.features.filter(f => f !== 'armor');
                    setAttributes({...attributes, features: updatedFeatures});
                  }} 
                />
                Armor Plating
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  checked={attributes.features.includes('weapons')} 
                  onChange={(e) => {
                    const updatedFeatures = e.target.checked 
                      ? [...attributes.features, 'weapons'] 
                      : attributes.features.filter(f => f !== 'weapons');
                    setAttributes({...attributes, features: updatedFeatures});
                  }} 
                />
                Mounted Weapons
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  checked={attributes.features.includes('cage')} 
                  onChange={(e) => {
                    const updatedFeatures = e.target.checked 
                      ? [...attributes.features, 'cage'] 
                      : attributes.features.filter(f => f !== 'cage');
                    setAttributes({...attributes, features: updatedFeatures});
                  }} 
                />
                Protective Cage
              </label>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={!isConnected || isProcessing}
          >
            Generate Vehicle
          </button>
        </form>
      )}
      
      {results && (
        <div className="generation-results">
          <h3>Generated Vehicle</h3>
          <div className="result-images">
            {results.images.map((image, index) => (
              <div key={index} className="result-image">
                <img src={image.url} alt={`Generated vehicle ${index + 1}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleGenerator;