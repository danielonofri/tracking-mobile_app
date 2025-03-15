// src/services/locationService.js
import authService from './authService';
import configService from './configService';

const locationService = {
  // Enviar ubicación al servidor
  sendLocation: async (routeData, customUrl = null) => {
    try {
      const token = authService.getToken();
      
      if (!token) {
        throw new Error('No hay sesión activa');
      }
      
      // Usar URL personalizada, o la configurada, o la predeterminada
      let apiUrl;
      
      if (customUrl) {
        apiUrl = customUrl;
      } else {
        const config = configService.getConfig();
        apiUrl = config.routesUrl || 'http://45.234.117.236:5000/api/routes';
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(routeData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al enviar ubicación');
      }
      
      return {
        success: true,
        data,
        message: 'Ubicación enviada correctamente'
      };
    } catch (error) {
      console.error('Error en servicio de ubicación:', error);
      
      // Almacenar para envío posterior si hay error de red
      if (!navigator.onLine) {
        locationService.storeLocationForLater(routeData);
      }
      
      return {
        success: false,
        message: error.message || 'Error al enviar ubicación'
      };
    }
  },
  
  // Almacenar ubicación para envío posterior
  storeLocationForLater: (routeData) => {
    try {
      const pendingLocations = JSON.parse(localStorage.getItem('pending_locations') || '[]');
      pendingLocations.push({
        data: routeData,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('pending_locations', JSON.stringify(pendingLocations));
      console.log('Ubicación almacenada para envío posterior');
    } catch (error) {
      console.error('Error al almacenar ubicación localmente:', error);
    }
  },
  
  // Sincronizar ubicaciones pendientes
  syncPendingLocations: async (customUrl = null) => {
    try {
      const pendingLocations = JSON.parse(localStorage.getItem('pending_locations') || '[]');
      
      if (pendingLocations.length === 0) {
        return { success: true, synced: 0 };
      }
      
      let successCount = 0;
      const failedLocations = [];
      
      // Si no hay URL personalizada, usar la configurada
      if (!customUrl) {
        const config = configService.getConfig();
        customUrl = config.routesUrl;
      }
      
      for (const item of pendingLocations) {
        try {
          const result = await locationService.sendLocation(item.data, customUrl);
          if (result.success) {
            successCount++;
          } else {
            failedLocations.push(item);
          }
        } catch (error) {
          failedLocations.push(item);
        }
      }
      
      // Guardar las que fallaron de nuevo
      localStorage.setItem('pending_locations', JSON.stringify(failedLocations));
      
      return {
        success: true,
        synced: successCount,
        pending: failedLocations.length
      };
    } catch (error) {
      console.error('Error al sincronizar ubicaciones pendientes:', error);
      return {
        success: false,
        message: 'Error al sincronizar ubicaciones pendientes'
      };
    }
  }
};

export default locationService;