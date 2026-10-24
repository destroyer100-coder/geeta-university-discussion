import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, setAuthToken, removeAuthToken, getAuthToken } from '../services/api.js';

const AuthContext = createContext(null);

export const DEMO_ACCOUNTS = [
  { name: 'Vansh Jawla', email: 'vansh@geeta.edu.in', role: 'student', title: '3rd Year CSE (Student)' },
  { name: 'Dr. Rakesh Sharma', email: 'rakesh@geeta.edu.in', role: 'faculty', title: 'CSE Dept Head (Owner)' },
  { name: 'Rahul Mehta', email: 'rahul@geeta.edu.in', role: 'student', title: '4th Year CSE (Moderator)' },
  { name: 'Sneha Arora', email: 'sneha@geeta.edu.in', role: 'student', title: '3rd Year CSE (Contributor)' },
  { name: 'Platform Admin', email: 'admin@geeta.edu.in', role: 'admin', title: 'Admin Override' },
];

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

   const switchPersona = async (email) => {
    if (!import.meta.env.DEV) {
      console.error('Demo persona switching is disabled outside development.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login(email, 'password123');
      if (res.success && res.token) {
        setAuthToken(res.token);
        setUser(res.user);
      }
    } catch (e) {
      console.error('Persona switch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    removeAuthToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, switchPersona, DEMO_ACCOUNTS }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
