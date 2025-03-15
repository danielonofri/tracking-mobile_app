// src/services/authService.js
const TOKEN_KEY = 'tracking_mobile_token';
const USER_KEY = 'tracking_mobile_user';

const authService = {
  // Iniciar sesión
  login: async (email, password, apiUrl) => {
    try {
      const response = await fetch(apiUrl || 'http://45.234.117.236:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error de inicio de sesión');
      }

      // Guardar token y datos del usuario
      localStorage.setItem(TOKEN_KEY, data.token);
      
      const userData = {
        id: data.userId,
        username: data.username,
        token: data.token
      };
      
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Error en servicio de login:', error);
      throw error;
    }
  },

  // Cerrar sesión
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  // Obtener el token actual
  getToken: () => {
    return localStorage.getItem(TOKEN_KEY);
  },

  // Obtener el usuario actual
  getCurrentUser: () => {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) {
      return null;
    }
    
    try {
      const user = JSON.parse(userStr);
      
      // Verificar si el token aún existe
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        authService.logout();
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('Error al recuperar usuario:', error);
      return null;
    }
  },

  // Verificar si hay un usuario autenticado
  isAuthenticated: () => {
    return !!localStorage.getItem(TOKEN_KEY);
  }
};

export default authService;
