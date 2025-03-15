// src/pages/LoginPage.js
import React, { useState, useEffect } from 'react';
import authService from '../services/authService';
import configService from '../services/configService';
import '../styles/LoginPage.css';

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [routesUrl, setRoutesUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Cargar las URLs desde la configuración
    const loadConfig = async () => {
      const config = await configService.getConfig();
      setApiUrl(config.loginUrl || 'http://45.234.117.236:5000/api/login');
      setRoutesUrl(config.routesUrl || 'http://45.234.117.236:5000/api/routes');
    };
    
    loadConfig();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor ingresa email y contraseña');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Guardar las URLs si cambiaron
      const configUpdates = {};
      
      if (apiUrl && apiUrl !== configService.getConfig().loginUrl) {
        configUpdates.loginUrl = apiUrl;
      }
      
      if (routesUrl && routesUrl !== configService.getConfig().routesUrl) {
        configUpdates.routesUrl = routesUrl;
      }
      
      // Actualizar configuración si hay cambios
      if (Object.keys(configUpdates).length > 0) {
        await configService.updateConfig(configUpdates);
      }
      
      // Realizar login
      const userData = await authService.login(email, password, apiUrl);
      onLogin(userData);
    } catch (err) {
      console.error('Error de inicio de sesión:', err);
      setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="app-title">TrackingMobile</h1>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ingresa tu email"
              disabled={loading}
            />
          </div>
          
          <div className="form-group password-group">
            <label htmlFor="password">Contraseña</label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                disabled={loading}
              />
              <button 
                type="button" 
                className="toggle-password-button"
                onClick={togglePasswordVisibility}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="apiUrl">URL de API de Login</label>
            <input
              type="text"
              id="apiUrl"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="URL de la API de login"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="routesUrl">URL de API de Rutas</label>
            <input
              type="text"
              id="routesUrl"
              value={routesUrl}
              onChange={(e) => setRoutesUrl(e.target.value)}
              placeholder="URL de la API de rutas"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;