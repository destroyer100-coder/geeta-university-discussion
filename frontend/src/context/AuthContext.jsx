import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, setAuthToken, removeAuthToken, getAuthToken } from '../services/api.js';

const AuthContext = createContext(null);
const GUEST_PREVIEW_KEY = 'guf-guest-session-preview';

const readGuestPreview = () => {
  try {
    const raw = localStorage.getItem(GUEST_PREVIEW_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const createGuestPreviewUser = () => ({
  _id: 'local-guest-preview',
  name: 'Guest',
  role: 'guest',
  department: 'University Community',
  year: '',
  avatar: '',
  isGuestPreview: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const initAuth = async () => {
    const guest = readGuestPreview();
    if (guest?.isGuestPreview) {
      setUser(guest);
      setLoading(false);
      return;
    }

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
      try { localStorage.removeItem(GUEST_PREVIEW_KEY); } catch { /* Continue with the authenticated session. */ }
      setAuthToken(response.token);
      setUser(response.user);
    }
    return response;
  };

  const loginPreview = () => {
    removeAuthToken();
    const guest = createGuestPreviewUser();
    try { localStorage.setItem(GUEST_PREVIEW_KEY, JSON.stringify(guest)); } catch { /* Current session still works in memory. */ }
    setUser(guest);
    setLoading(false);
    return { success: true, user: guest, isLocalPreview: true };
  };

  const register = async (userData) => {
    const response = await authApi.register(userData);
    if (response.success && response.token) {
      try { localStorage.removeItem(GUEST_PREVIEW_KEY); } catch { /* Continue with the authenticated session. */ }
      setAuthToken(response.token);
      setUser(response.user);
    }
    return response;
  };

  const updateUser = (updates) => setUser((current) => current ? { ...current, ...updates } : current);

  const logout = () => {
    removeAuthToken();
    try { localStorage.removeItem(GUEST_PREVIEW_KEY); } catch { /* Clear the in-memory session regardless. */ }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginPreview, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
