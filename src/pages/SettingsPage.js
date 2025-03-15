// src/pages/SettingsPage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import configService from '../services/configService';
import '../styles/SettingsPage.css';

function SettingsPage({ user, onLogout }) {
  const [loginUrl, setLoginUrl] = useState('');
  const [routesUrl, setRoutesUrl] = useState('');
  const [autoTracking, setAutoTracking] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState(5);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Cargar configuración actual
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await configService.getConfig();
        setLoginUrl(config.loginUrl || 'http://45.234.117.236:5000/api/login');
        setRoutesUrl(config.routesUrl || 'http://localhost:5000/api/routes');
        setAutoTracking(config.autoTracking || false);
        setTrackingInterval(config.trackingInterval || 5);
      } catch (err) {
        console.error('Error al cargar configuración:', err);
        setError('Error al cargar la configuración');
      }
    };
    
    loadConfig();
  }, []);

  // Guardar configuración
  const saveSettings = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError('');
      setMessage('');
      
      // Validar URLs
      if (!loginUrl) {
        throw new Error('La URL de login es requerida');
      }
      
      if (!routesUrl) {
        throw new Error('La URL de rutas es requerida');
      }
      
      // Guardar configuración
      await configService.updateConfig({
        loginUrl,
        routesUrl,
        autoTracking,
        trackingInterval
      });
      
      setMessage('Configuración guardada correctamente');
    } catch (err) {
      console.error('Error al guardar configuración:', err);
      setError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  // Restablecer valores predeterminados
  const resetSettings = () => {
    setLoginUrl('http://45.234.117.236:5000/api/login');
    setRoutesUrl('http://localhost:5000/api/routes');
    setTrackingInterval(5);
    setMessage('Valores predeterminados restaurados. Haz clic en Guardar para aplicar.');
  };

  return (
    <div className="settings-page">
      <header className="header">
        <h1>Configuración</h1>
        <div className="user-info">
          <span>Conectado como: {user.username}</span>
          <button className="logout-button" onClick={onLogout}>
            CERRAR SESIÓN
          </button>
        </div>
      </header>
      
      <div className="content">
        <form onSubmit={saveSettings} className="settings-form">
          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="loginUrl">URL de API de Login</label>
            <input
              type="text"
              id="loginUrl"
              value={loginUrl}
              onChange={(e) => setLoginUrl(e.target.value)}
              placeholder="Ejemplo: http://45.234.117.236:5000/api/login"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="routesUrl">URL de API de Rutas</label>
            <input
              type="text"
              id="routesUrl"
              value={routesUrl}
              onChange={(e) => setRoutesUrl(e.target.value)}
              placeholder="Ejemplo: http://localhost:5000/api/routes"
            />
          </div>
          
          <div className="form-group toggle-group">
            <label>Seguimiento automático</label>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={autoTracking}
                onChange={() => setAutoTracking(!autoTracking)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-value">{autoTracking ? 'Activado' : 'Desactivado'}</span>
          </div>
          
          <div className="form-group">
            <label htmlFor="trackingInterval">
              Intervalo de seguimiento: {trackingInterval} minutos
            </label>
            <input
              type="range"
              id="trackingInterval"
              min="1"
              max="60"
              value={trackingInterval}
              onChange={(e) => setTrackingInterval(parseInt(e.target.value, 10))}
              className="slider"
            />
            <div className="range-values">
              <span>1 min</span>
              <span>60 min</span>
            </div>
          </div>
          
          <div className="button-group">
            <button
              type="submit"
              className="save-button"
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
            
            <button
              type="button"
              className="reset-button"
              onClick={resetSettings}
              disabled={saving}
            >
              Valores Predeterminados
            </button>
          </div>
        </form>
        
        <Link to="/" className="back-link">
          Volver al Seguimiento
        </Link>
      </div>
    </div>
  );
}

export default SettingsPage;
