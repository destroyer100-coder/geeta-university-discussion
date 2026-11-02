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
      const res = await authApi.getMe();
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        removeAuthToken();
        setUser(null);
      }
    } catch (error) {
      removeAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    if (res.success && res.token) {
      setAuthToken(res.token);
      setUser(res.user);
    }
    return res;
  };

  const register = async (userData) => {
    const res = await authApi.register(userData);
    if (res.success && res.token) {
      setAuthToken(res.token);
      setUser(res.user);
    }
    return res;
  };

  const logout = () => {
    removeAuthToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
