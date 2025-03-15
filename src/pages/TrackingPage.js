// src/pages/TrackingPage.js
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import locationService from '../services/locationService';
import backgroundService from '../services/backgroundService';
import configService from '../services/configService';
import '../styles/TrackingPage.css';

function TrackingPage({ user, onLogout }) {
  const [location, setLocation] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [autoTracking, setAutoTracking] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState(5); // minutos
  const [config, setConfig] = useState({});
  
  // Usar el hook de ubicación para detectar navegación
  const routerLocation = useLocation();
  
  const watchIdRef = useRef(null);
  const intervalIdRef = useRef(null);
  const configLoadedRef = useRef(false);

  // Cargar configuración inicial o cuando se navega a esta página
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await configService.getConfig();
        setConfig(savedConfig);
        
        // Actualizar estado de seguimiento con los valores de configuración
        setAutoTracking(savedConfig.autoTracking || false);
        setTrackingInterval(savedConfig.trackingInterval || 5);
        
        configLoadedRef.current = true;
        console.log("Configuración cargada:", savedConfig);
      } catch (err) {
        console.error('Error al cargar configuración:', err);
      }
    };
    
    loadConfig();
  }, [routerLocation]); // Dependencia del router para recargar al navegar

  // Gestionar el seguimiento automático
  useEffect(() => {
    // Solo ejecutar este efecto si la configuración ya se cargó para evitar desactivar por defecto
    if (!configLoadedRef.current) return;
    
    if (autoTracking) {
      startTracking();
      
      // Configurar intervalo para enviar la ubicación
      if (!intervalIdRef.current) {
        intervalIdRef.current = setInterval(() => {
          getCurrentPosition().then(position => {
            if (position) {
              sendLocationToServer(position);
            }
          });
        }, trackingInterval * 60 * 1000);
      }
      
      // Intentar iniciar seguimiento en segundo plano
      backgroundService.startBackgroundTracking(trackingInterval);
    } else {
      stopTracking();
      
      // Limpiar intervalo
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      
      // Detener seguimiento en segundo plano
      backgroundService.stopBackgroundTracking();
    }
    
    // Guardar configuración
    configService.updateConfig({ 
      autoTracking, 
      trackingInterval 
    });
    
    return () => {
      stopTracking();
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [autoTracking, trackingInterval]);

  // Función para obtener la posición actual
  const getCurrentPosition = () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: new Date().toISOString()
            };
            setLocation(newLocation);
            setLastUpdate(new Date().toLocaleString());
            resolve(newLocation);
          },
          (err) => {
            console.error('Error de geolocalización:', err);
            setError(`Error al obtener ubicación: ${err.message}`);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      } else {
        setError('La geolocalización no está disponible en este dispositivo');
        resolve(null);
      }
    });
  };

  // Iniciar seguimiento de ubicación
  const startTracking = () => {
    if (navigator.geolocation && !watchIdRef.current) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date().toISOString()
          };
          setLocation(newLocation);
          setLastUpdate(new Date().toLocaleString());
          setError('');
        },
        (err) => {
          console.error('Error de seguimiento:', err);
          setError(`Error de seguimiento: ${err.message}`);
          stopTracking();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    }
  };

  // Detener seguimiento
  const stopTracking = () => {
    if (watchIdRef.current && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // Enviar ubicación al servidor
  const sendLocationToServer = async (positionToSend = null) => {
    try {
      setSendingLocation(true);
      setError('');
      setMessage('');
      
      // Usar la ubicación proporcionada o la actual
      let locationData = positionToSend || location;
      
      if (!locationData) {
        const newLocation = await getCurrentPosition();
        if (!newLocation) {
          throw new Error('No se pudo obtener la ubicación actual');
        }
        locationData = newLocation;
      }
      
      // Crear el objeto de ruta para enviar
      const routeData = {
        name: `Posición ${user.username}`,
        coordinates: [locationData],
        distance: 0
      };
      
      // Obtener la configuración actualizada antes de enviar
      const currentConfig = await configService.getConfig();
      
      // Enviar a la API usando la URL configurada
      const result = await locationService.sendLocation(routeData, currentConfig.routesUrl);
      
      if (result.success) {
        setMessage('Ubicación enviada correctamente');
      } else {
        throw new Error(result.message || 'Error al enviar ubicación');
      }
    } catch (err) {
      console.error('Error al enviar ubicación:', err);
      setError(err.message || 'Error al enviar la ubicación');
    } finally {
      setSendingLocation(false);
    }
  };

  // Toggle para activar/desactivar seguimiento automático
  const toggleAutoTracking = () => {
    const newValue = !autoTracking;
    setAutoTracking(newValue);
    
    // También guardar en configuración inmediatamente
    configService.updateConfig({ autoTracking: newValue });
  };

  // Manejar cambio en el intervalo de seguimiento
  const handleIntervalChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setTrackingInterval(value);
    
    // También guardar en configuración inmediatamente
    configService.updateConfig({ trackingInterval: value });
  };

  return (
    <div className="tracking-page">
      <header className="header">
        <h1>TrackingMobile</h1>
        <div className="user-info">
          <span>Conectado como: {user.username}</span>
          <button className="logout-button" onClick={onLogout}>
            CERRAR SESIÓN
          </button>
        </div>
      </header>
      
      <div className="content">
        <div className="location-panel">
          <h2>
            <i className="icon location-icon"></i>
            Ubicación Actual
          </h2>
          
          <div className="location-details">
            <div className="location-item">
              <span className="label">Latitud:</span>
              <span className="value">{location ? location.latitude.toFixed(5) : '-'}</span>
            </div>
            
            <div className="location-item">
              <span className="label">Longitud:</span>
              <span className="value">{location ? location.longitude.toFixed(5) : '-'}</span>
            </div>
            
            <div className="location-item">
              <span className="label">Última actualización:</span>
              <span className="value">{lastUpdate || '-'}</span>
            </div>
          </div>
          
          <button 
            className="send-location-button"
            onClick={() => sendLocationToServer()}
            disabled={loading || sendingLocation || !location}
          >
            <i className="icon send-icon"></i>
            {sendingLocation ? 'ENVIANDO...' : 'ENVIAR UBICACIÓN AHORA'}
          </button>
          
          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}
        </div>
        
        <div className="settings-panel">
          <h2>
            <i className="icon settings-icon"></i>
            Configuración
          </h2>
          
          <div className="setting-item">
            <span className="setting-label">Seguimiento automático:</span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={autoTracking}
                onChange={toggleAutoTracking}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="setting-value">{autoTracking ? 'Activado' : 'Desactivado'}</span>
          </div>
          
          <div className="setting-item">
            <span className="setting-label">
              <i className="icon time-icon"></i>
              Intervalo de seguimiento:
            </span>
            <span className="setting-value">{trackingInterval} minutos</span>
          </div>
          
          <div className="slider-container">
            <input 
              type="range" 
              min="1" 
              max="60" 
              value={trackingInterval}
              onChange={handleIntervalChange}
              className="slider"
            />
          </div>
          
          <Link to="/settings" className="settings-link">
            Configuración avanzada
          </Link>
        </div>
      </div>
    </div>
  );
}

export default TrackingPage;