import api from './index';

export const loginUser = async (username, password) => {
  const response = await api.post('/login', { username, password });
  return response.data; // Expected: { token }
};

export const registerUser = async (name, username, password, email) => {
  const payload = { name, username, password };
  if (email) payload.email = email;
  const response = await api.post('/register', payload);
  return response.data; // Expected: { message }
};

export const forgotPassword = async (emailOrUsername) => {
  const response = await api.post('/forgot-password', { emailOrUsername });
  return response.data; // Expected: { message }
};

export const verifyResetToken = async (token) => {
  const response = await api.get(`/verify-reset-token/${token}`);
  return response.data; // Expected: { valid, username }
};

export const resetPassword = async (token, password) => {
  const response = await api.post(`/reset-password/${token}`, { password });
  return response.data; // Expected: { message }
};

