import axios from 'axios';
import server from '../environment';

const api = axios.create({
  baseURL: `${server}/api/v1/users`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/auth') &&
        !window.location.pathname.startsWith('/meeting')
      ) {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
