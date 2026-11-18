import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { messagesApi, notificationsApi } from '../services/api';
import { useAuth } from './AuthContext';

const UnreadCountsContext = createContext({
  counts: { messages: 0, notifications: 0 },
  refreshCounts: async () => {},
});

export const UnreadCountsProvider = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 });

  const refreshCounts = useCallback(async () => {
    if (!user?._id) {
      setCounts({ messages: 0, notifications: 0 });
      return;
    }

    const [notificationResult, messageResult] = await Promise.allSettled([
      notificationsApi.getAll(),
      messagesApi.getConversations(),
    ]);

    const next = { messages: 0, notifications: 0 };
    if (notificationResult.status === 'fulfilled' && notificationResult.value?.success) {
      next.notifications = Number(notificationResult.value.unreadCount) || 0;
    }
    if (messageResult.status === 'fulfilled' && messageResult.value?.success && Array.isArray(messageResult.value.data)) {
      next.messages = messageResult.value.data.reduce(
        (sum, conversation) => sum + (Number(conversation.unreadCount) || 0),
        0
      );
    }
    setCounts(next);
  }, [user?._id]);

  useEffect(() => {
    refreshCounts();
    const handleRefresh = () => refreshCounts();
    window.addEventListener('notifications:changed', handleRefresh);
    window.addEventListener('messages:changed', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('notifications:changed', handleRefresh);
      window.removeEventListener('messages:changed', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [refreshCounts, location.pathname]);

  return (
    <UnreadCountsContext.Provider value={{ counts, refreshCounts }}>
      {children}
    </UnreadCountsContext.Provider>
  );
};

export const useUnreadCounts = () => useContext(UnreadCountsContext);
