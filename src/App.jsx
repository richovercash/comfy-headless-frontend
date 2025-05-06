// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import styled from 'styled-components';
import AssetsPage from './pages/AssetsPage';
import AssetDetailPage from './pages/AssetDetailPage';
import GenerationPage from './pages/GenerationPage';
import SessionsPage from './pages/SessionsPage';

const AppContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const Header = styled.header`
  background-color: #212121;
  padding: 16px 24px;
  color: white;
`;

const NavContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
`;

const Logo = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
`;

const Nav = styled.nav`
  display: flex;
  gap: 24px;
`;

const NavLink = styled(Link)`
  color: white;
  text-decoration: none;
  padding: 8px 0;
  position: relative;
  
  &:after {
    content: '';
    position: absolute;
    width: 0;
    height: 2px;
    bottom: 0;
    left: 0;
    background-color: white;
    transition: width 0.3s;
  }
  
  &:hover:after {
    width: 100%;
  }
`;

const MainContent = styled.main`
  flex: 1;
  background-color: #f5f5f5;
`;

const Footer = styled.footer`
  background-color: #212121;
  color: white;
  padding: 24px;
  text-align: center;
`;

function App() {
  return (
    <Router>
      <AppContainer>
        <Header>
          <NavContainer>
            <Logo>Post-Apocalyptic Vehicle Generator</Logo>
            <Nav>
              <NavLink to="/assets">Assets</NavLink>
              <NavLink to="/sessions">Sessions</NavLink>
              <NavLink to="/generate">Generate</NavLink>
            </Nav>
          </NavContainer>
        </Header>
        
        <MainContent>
          <Routes>
            <Route path="/" element={<AssetsPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/generate" element={<GenerationPage />} />
          </Routes>
        </MainContent>
        
        <Footer>
          <p>Post-Apocalyptic Vehicle NFT Generator &copy; 2025</p>
        </Footer>
      </AppContainer>
    </Router>
  );
}

export default App;