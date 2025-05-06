// src/components/ModelViewer.jsx
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF } from '@react-three/drei';
import styled from 'styled-components';

const ViewerContainer = styled.div`
  height: 400px;
  width: 100%;
  background-color: #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #555;
`;

const Model = ({ url }) => {
  const { scene } = useGLTF(url);
  
  return (
    <primitive 
      object={scene} 
      scale={1}
      position={[0, 0, 0]} 
    />
  );
};

const ModelViewer = ({ modelUrl }) => {
  return (
    <ViewerContainer>
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <pointLight position={[-10, -10, -10]} />
        <Suspense fallback={null}>
          <Model url={modelUrl} />
          <Environment preset="sunset" />
        </Suspense>
        <OrbitControls />
      </Canvas>
    </ViewerContainer>
  );
};

export default ModelViewer;