import api from './index';

export const loginUser = async (username, password) => {
  const response = await api.post('/login', { username, password });
  return response.data; // Expected: { token }
};

export const registerUser = async (name, username, password) => {
  const response = await api.post('/register', { name, username, password });
  return response.data; // Expected: { message }
};
