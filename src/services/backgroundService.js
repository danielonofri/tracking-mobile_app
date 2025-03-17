// src/services/backgroundService.js
import locationService from './locationService';
import configService from './configService';

const backgroundService = {
  // Registrar service worker para funcionamiento en segundo plano
  registerServiceWorker: async () => {
    if ('serviceWorker' in navigator) {
      try {
        // Determina la ruta base basada en la URL actual
        const fullPath = window.location.pathname;
        let basePath = '/';
        
        // Si estamos en GitHub Pages, la ruta incluye el nombre del repositorio
        if (fullPath.includes('/tracking-mobile_app')) {
          basePath = '/tracking-mobile_app/';
        }
        
        console.log('Registrando service worker con base path:', basePath);
        
        const registration = await navigator.serviceWorker.register(`${basePath}service-worker.js`, {
          scope: basePath
        });
        
        console.log('Service Worker registrado con éxito:', registration);
        return registration;
      } catch (error) {
        console.error('Error al registrar Service Worker:', error);
        throw error;
      }
    } else {
      console.warn('Service Workers no están soportados en este navegador');
      throw new Error('Este navegador no soporta Service Workers');
    }
  },

  // Iniciar seguimiento en segundo plano
  startBackgroundTracking: (intervalMinutes = 5) => {
    try {
      // Registrar para recibir eventos de sincronización periódica
      backgroundService.registerSync();

      // Utilizar la API de Background Sync si está disponible
      if ('BackgroundFetch' in window) {
        console.log('Usando Background Fetch API');
        // Implementación específica de Background Fetch
      } else if ('periodicSync' in navigator.serviceWorker.registration) {
        console.log('Usando Periodic Sync API');
        // Intentar registrar sincronización periódica
        backgroundService.registerPeriodicSync(intervalMinutes);
      } else {
        console.log('Usando setInterval en segundo plano con mantenimiento de Wake Lock');
        // Intentar usar Wake Lock API para mantener el dispositivo despierto
        backgroundService.requestWakeLock();
      }

      // Registrar listener para cambios de conectividad
      window.addEventListener('online', backgroundService.handleConnectivityChange);

      return true;
    } catch (error) {
      console.error('Error al iniciar seguimiento en segundo plano:', error);
      return false;
    }
  },

  // Detener seguimiento en segundo plano
  stopBackgroundTracking: () => {
    try {
      // Eliminar listeners
      window.removeEventListener('online', backgroundService.handleConnectivityChange);

      // Liberar Wake Lock si está activo
      if (backgroundService.wakeLock) {
        backgroundService.wakeLock.release();
        backgroundService.wakeLock = null;
      }

      return true;
    } catch (error) {
      console.error('Error al detener seguimiento en segundo plano:', error);
      return false;
    }
  },

  // Registrar para sincronización en segundo plano
  registerSync: async () => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-locations');
        console.log('Background Sync registrado');
      } catch (error) {
        console.error('Error al registrar Background Sync:', error);
      }
    }
  },

  // Registrar sincronización periódica (requiere permisos)
  registerPeriodicSync: async (intervalMinutes = 5) => {
    if ('serviceWorker' in navigator && 'periodicSync' in navigator.serviceWorker.registration) {
      try {
        const registration = await navigator.serviceWorker.ready;

        // Verificar si el permiso está concedido
        const status = await navigator.permissions.query({
          name: 'periodic-background-sync',
        });

        if (status.state === 'granted') {
          await registration.periodicSync.register('sync-locations', {
            minInterval: intervalMinutes * 60 * 1000, // convertir a milisegundos
          });
          console.log('Periodic Sync registrado');
        } else {
          console.log('Permiso de sincronización periódica no concedido');
        }
      } catch (error) {
        console.error('Error al registrar Periodic Sync:', error);
      }
    }
  },

  // Solicitar Wake Lock para mantener dispositivo activo
  requestWakeLock: async () => {
    if ('wakeLock' in navigator) {
      try {
        backgroundService.wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock adquirido');

        backgroundService.wakeLock.addEventListener('release', () => {
          console.log('Wake Lock liberado');
          backgroundService.wakeLock = null;

          // Intentar readquirir el wake lock si el seguimiento sigue activo
          const config = configService.getConfig();
          if (config.autoTracking) {
            backgroundService.requestWakeLock();
          }
        });
      } catch (error) {
        console.error('Error al solicitar Wake Lock:', error);
      }
    }
  },

  // Manejar cambios de conectividad
  handleConnectivityChange: async () => {
    if (navigator.onLine) {
      console.log('Conectividad restaurada, sincronizando...');
      try {
        // Obtener la configuración actual para usar la URL de rutas configurada
        const config = await configService.getConfig();
        const result = await locationService.syncPendingLocations(config.routesUrl);

        console.log('Sincronización completada:', result);

        // Mostrar notificación si el navegador lo soporta
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('TrackingMobile', {
            body: `Sincronización completada: ${result.synced} ubicaciones enviadas.`,
            icon: '/logo192.png'
          });
        }
      } catch (error) {
        console.error('Error durante la sincronización:', error);
      }
    }
  }
};

// Almacenar referencia al wake lock
backgroundService.wakeLock = null;

export default backgroundService;