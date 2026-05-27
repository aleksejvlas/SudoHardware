// Централізована конфігурація фронтенду.
const API_CONFIG = {
  getBaseURL: () => {
    if (window.API_BASE_URL && window.API_BASE_URL !== 'http://localhost:3000/api') {
      return window.API_BASE_URL;
    }

    const isDevelopment = window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1'
      || window.location.hostname.startsWith('192.168');

    if (!isDevelopment) {
      return `${window.location.protocol}//${window.location.host}/api`;
    }

    return 'http://localhost:3000/api';
  },

  VERSION: '1.0.0',
  CART_STORAGE_KEY: 'rtk_cart',
  USER_STORAGE_KEY: 'rtk_user',
  TOKEN_STORAGE_KEY: 'rtk_token',
  TIMEOUT: 10000
};

if (!window.API_BASE_URL) {
  window.API_BASE_URL = API_CONFIG.getBaseURL();
  console.log(`API Base URL: ${window.API_BASE_URL}`);
}

window.API_CONFIG = API_CONFIG;
