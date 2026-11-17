import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, setAuthToken, removeAuthToken, getAuthToken } from '../services/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const initAuth = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await authApi.getMe();
      if (response.success && response.user) setUser(response.user);
      else {
        removeAuthToken();
        setUser(null);
      }
    } catch {
      removeAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { initAuth(); }, []);

  const login = async (email, password) => {
    const response = await authApi.login(email, password);
    if (response.success && response.token) {
      setAuthToken(response.token);
      setUser(response.user);
    }
    return response;
  };

  const register = async (userData) => {
    const response = await authApi.register(userData);
    if (response.success && response.token) {
      setAuthToken(response.token);
      setUser(response.user);
    }
    return response;
  };

  const updateUser = (updates) => setUser((current) => current ? { ...current, ...updates } : current);

  const logout = () => {
    removeAuthToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
