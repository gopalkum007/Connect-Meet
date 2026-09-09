import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser as apiLogin, registerUser as apiRegister } from '../api/auth.api.js';
import { fetchMeetingHistory as apiFetchHistory, addMeetingToHistory as apiAddHistory, createMeeting as apiCreateMeeting, deleteMeetingFromHistory as apiDeleteHistory } from '../api/meeting.api.js';
import { getUserProfile, updateUserLanguage, updateUserProfile as apiUpdateProfile } from '../api/user.api.js';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      if (token) {
        try {
          const profile = await getUserProfile(token);
          setUser(profile);
          setPreferredLanguage(profile.preferredLanguage || 'en');
        } catch (error) {
          console.error("Failed to load user profile:", error);
          if (error.response?.status === 404 || error.response?.status === 401) {
            logout();
          }
        }
      }
    };
    loadProfile();
  }, [token]);

  const handleLogin = async (username, password) => {
    setLoading(true);
    try {
      const data = await apiLogin(username, password);
      if (data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        // Load profile immediately
        const profile = await getUserProfile(data.token);
        setUser(profile);
        setPreferredLanguage(profile.preferredLanguage || 'en');
        navigate('/home');
      }
      return data;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (name, username, password) => {
    setLoading(true);
    try {
      const data = await apiRegister(name, username, password);
      return data.message;
    } catch (error) {
      console.error("AuthContext registration error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getHistoryOfUser = async () => {
    try {
      const data = await apiFetchHistory();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.log("getHistoryOfUser error:", error);
      return [];
    }
  };

  const addToUserHistory = async (meetingCode) => {
    try {
      return await apiAddHistory(meetingCode);
    } catch (error) {
      throw error;
    }
  };

  const deleteFromHistory = async (idOrCode) => {
    try {
      return await apiDeleteHistory(idOrCode);
    } catch (error) {
      throw error;
    }
  };

  const createNewMeeting = async (meetingData) => {
    try {
      return await apiCreateMeeting(meetingData);
    } catch (error) {
      throw error;
    }
  };

  const updateLanguage = async (newLanguage) => {
    if (!token) return;
    try {
      const data = await updateUserLanguage(token, newLanguage);
      setPreferredLanguage(newLanguage);
      setUser(prev => prev ? { ...prev, preferredLanguage: newLanguage } : { preferredLanguage: newLanguage });
      return data;
    } catch (error) {
      console.error("Failed to update language:", error);
      throw error;
    }
  };

  const updateProfile = async (profileData) => {
    if (!token) return;
    try {
      const res = await apiUpdateProfile(token, profileData);
      if (res.user) {
        setUser(res.user);
      }
      return res;
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setPreferredLanguage('en');
    navigate('/auth');
  };

  const isAuthenticated = () => {
    return !!token;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        preferredLanguage,
        loading,
        handleLogin,
        handleRegister,
        getHistoryOfUser,
        addToUserHistory,
        deleteFromHistory,
        createNewMeeting,
        updateLanguage,
        updateProfile,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
