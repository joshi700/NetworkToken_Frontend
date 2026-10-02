import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from './context/ConfigContext';
import Layout from './components/Layout';
import SettingsPage from './pages/SettingsPage';
import HomePage from './pages/HomePage';
import FlowPage from './pages/FlowPage';

function App() {
  return (
    <ConfigProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/settings" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/flow/:flowId" element={<FlowPage />} />
            <Route path="*" element={<Navigate to="/settings" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

export default App;
