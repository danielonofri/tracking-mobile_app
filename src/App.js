// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import TrackingPage from './pages/TrackingPage';
import SettingsPage from './pages/SettingsPage';
import authService from './services/authService';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay un usuario autenticado al cargar la app
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error al verificar autenticación:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  if (loading) {
    return <div className="loading-container">Cargando...</div>;
  }

  return (
    <Router basename="/tracking-mobile_app">
      <div className="app-container">
        <Routes>
          <Route 
            path="/login" 
            element={
              user ? <Navigate to="/" /> : <LoginPage onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/" 
            element={
              user ? <TrackingPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            } 
          />
          <Route 
            path="/settings" 
            element={
              user ? <SettingsPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            } 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;