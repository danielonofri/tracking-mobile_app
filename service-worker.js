// public/service-worker.js
const CACHE_NAME = 'tracking-mobile-cache-v1';
const LOCATION_STORE = 'location-store';
const API_CACHE_NAME = 'api-cache';

// Archivos a cachear para funcionamiento offline
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/js/vendors~main.chunk.js',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caché abierta');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Error al cachear archivos iniciales:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.filter((name) => {
            return name !== CACHE_NAME && name !== API_CACHE_NAME;
          }).map((name) => {
            return caches.delete(name);
          })
        );
      })
  );
});

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones a APIs
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retornar del caché si existe
        if (response) {
          return response;
        }
        
        // Si no está en caché, obtener de la red
        return fetch(event.request)
          .then((networkResponse) => {
            // Si la respuesta no es válida, devolver error
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // Clonar la respuesta para cachearla y devolverla
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          });
      })
      .catch((error) => {
        console.error('Error al recuperar recurso:', error);
        // Retornar página offline si es una solicitud HTML
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/offline.html');
        }
        return new Response('Error de red');
      })
  );
});

// Manejar sincronización en segundo plano
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-locations') {
    event.waitUntil(syncPendingLocations());
  }
});

// Manejar sincronización periódica
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-locations') {
    event.waitUntil(trackAndSendLocation());
  }
});

// Enviar ubicaciones pendientes
async function syncPendingLocations() {
  try {
    // Obtener datos almacenados
    const dbData = await getFromIndexedDB();
    
    if (!dbData || !dbData.pendingLocations || dbData.pendingLocations.length === 0) {
      console.log('No hay ubicaciones pendientes para sincronizar');
      return;
    }
    
    // Obtener configuración
    const config = dbData.config || {
      routesUrl: 'http://localhost:5000/api/routes'
    };
    
    // Obtener token
    const authData = dbData.auth || {};
    const token = authData.token;
    
    if (!token) {
      console.error('No hay token disponible para sincronizar');
      return;
    }
    
    console.log(`Sincronizando ${dbData.pendingLocations.length} ubicaciones pendientes`);
    
    // Enviar cada ubicación pendiente
    const results = await Promise.allSettled(
      dbData.pendingLocations.map(async (item) => {
        try {
          const response = await fetch(config.routesUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item.data)
          });
          
          if (!response.ok) {
            throw new Error('Error al enviar ubicación');
          }
          
          return { success: true, id: item.id };
        } catch (error) {
          console.error('Error al sincronizar ubicación:', error);
          return { success: false, id: item.id, error };
        }
      })
    );
    
    // Filtrar ubicaciones que no se pudieron enviar
    const successIds = results
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .map(result => result.value.id);
    
    // Actualizar la lista de pendientes
    const remainingLocations = dbData.pendingLocations.filter(
      item => !successIds.includes(item.id)
    );
    
    // Guardar ubicaciones que no se pudieron enviar
    await saveToIndexedDB({ 
      ...dbData, 
      pendingLocations: remainingLocations
    });
    
    // Mostrar notificación si hay permisos
    const syncedCount = successIds.length;
    if (syncedCount > 0 && self.registration.showNotification) {
      await self.registration.showNotification('TrackingMobile', {
        body: `Se sincronizaron ${syncedCount} ubicaciones`,
        icon: '/logo192.png'
      });
    }
    
    console.log(`Sincronización completada: ${syncedCount} ubicaciones enviadas, ${remainingLocations.length} pendientes`);
  } catch (error) {
    console.error('Error durante la sincronización:', error);
  }
}

// Obtener ubicación actual y enviarla
async function trackAndSendLocation() {
  try {
    // Verificar si el seguimiento está activo
    const dbData = await getFromIndexedDB();
    
    if (!dbData || !dbData.config || !dbData.config.autoTracking) {
      console.log('El seguimiento automático está desactivado');
      return;
    }
    
    // Obtener ubicación actual
    const position = await getCurrentPosition();
    
    if (!position) {
      console.error('No se pudo obtener la ubicación actual');
      return;
    }
    
    // Crear objeto de ubicación
    const locationData = {
      name: `Posición Automática`,
      coordinates: [{
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: new Date().toISOString()
      }],
      distance: 0
    };
    
    // Intentar enviar la ubicación
    try {
      // Obtener configuración y token
      const config = dbData.config;
      const authData = dbData.auth || {};
      const token = authData.token;
      
      if (!token) {
        throw new Error('No hay token disponible');
      }
      
      const response = await fetch(config.routesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(locationData)
      });
      
      if (!response.ok) {
        throw new Error('Error al enviar ubicación');
      }
      
      console.log('Ubicación enviada automáticamente con éxito');
    } catch (error) {
      console.error('Error al enviar ubicación automática:', error);
      
      // Guardar para envío posterior
      const pendingLocations = dbData.pendingLocations || [];
      pendingLocations.push({
        id: Date.now().toString(),
        data: locationData,
        timestamp: new Date().toISOString()
      });
      
      await saveToIndexedDB({
        ...dbData,
        pendingLocations
      });
      
      console.log('Ubicación guardada para envío posterior');
    }
  } catch (error) {
    console.error('Error en seguimiento automático:', error);
  }
}

// Obtener posición actual (promisificada)
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocalización no disponible'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// Funciones para acceder a IndexedDB
async function getFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCATION_STORE, 1);
    
    request.onerror = (event) => {
      console.error('Error al abrir IndexedDB:', event);
      reject(event);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('trackingData')) {
        db.createObjectStore('trackingData', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['trackingData'], 'readonly');
      const store = transaction.objectStore('trackingData');
      const dataRequest = store.get('appData');
      
      dataRequest.onsuccess = () => {
        resolve(dataRequest.result);
      };
      
      dataRequest.onerror = (event) => {
        console.error('Error al obtener datos de IndexedDB:', event);
        reject(event);
      };
    };
  });
}

async function saveToIndexedDB(data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCATION_STORE, 1);
    
    request.onerror = (event) => {
      console.error('Error al abrir IndexedDB:', event);
      reject(event);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('trackingData')) {
        db.createObjectStore('trackingData', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['trackingData'], 'readwrite');
      const store = transaction.objectStore('trackingData');
      
      // Asegurarse de que tenga un ID
      const dataToSave = { ...data, id: 'appData' };
      const saveRequest = store.put(dataToSave);
      
      saveRequest.onsuccess = () => {
        resolve();
      };
      
      saveRequest.onerror = (event) => {
        console.error('Error al guardar datos en IndexedDB:', event);
        reject(event);
      };
    };
  });
}

// Escuchar mensajes desde la aplicación principal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CONFIG_UPDATE') {
    console.log('Service Worker recibió actualización de configuración');
    
    // Actualizar configuración en IndexedDB
    getFromIndexedDB()
      .then(data => {
        const updatedData = {
          ...data,
          config: event.data.config,
          auth: event.data.auth
        };
        return saveToIndexedDB(updatedData);
      })
      .then(() => {
        console.log('Configuración actualizada en Service Worker');
      })
      .catch(error => {
        console.error('Error al actualizar configuración en Service Worker:', error);
      });
  }
});