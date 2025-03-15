// src/services/configService.js
const CONFIG_KEY = 'tracking_mobile_config';

const defaultConfig = {
  loginUrl: 'http://45.234.117.236:5000/api/login',
  routesUrl: 'http://45.234.117.236:5000/api/routes',
  autoTracking: false,
  trackingInterval: 5 // minutos
};

const configService = {
  // Obtener configuración
  getConfig: () => {
    try {
      const configStr = localStorage.getItem(CONFIG_KEY);
      if (!configStr) {
        return defaultConfig;
      }
      
      // Combinar la configuración guardada con los valores predeterminados
      // para asegurar que siempre existan todas las propiedades
      return { ...defaultConfig, ...JSON.parse(configStr) };
    } catch (error) {
      console.error('Error al recuperar configuración:', error);
      return defaultConfig;
    }
  },
  
  // Actualizar configuración
  updateConfig: async (newConfig) => {
    try {
      const currentConfig = configService.getConfig();
      const updatedConfig = { ...currentConfig, ...newConfig };
      
      localStorage.setItem(CONFIG_KEY, JSON.stringify(updatedConfig));
      return true;
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      throw new Error('Error al guardar la configuración');
    }
  },
  
  // Restablecer configuración predeterminada
  resetConfig: () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(defaultConfig));
    return defaultConfig;
  }
};

export default configService;