import api from './index';

export const updateUserLanguage = async (arg1, arg2) => {
  const language = arg2 !== undefined ? arg2 : arg1;
  const response = await api.post('/update_language', { language });
  return response.data;
};

export const getUserProfile = async () => {
  const response = await api.get('/get_profile');
  return response.data;
};

export const updateUserProfile = async (arg1, arg2) => {
  const profileData = arg2 !== undefined ? arg2 : arg1;
  const response = await api.post('/update_profile', profileData);
  return response.data;
};

