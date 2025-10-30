import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { storage } from '../utils/storage';
import { useAuth } from './AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface MessagesContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const MessagesContext = createContext<MessagesContextType>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
});

export const useMessages = () => useContext(MessagesContext);

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const conversations = response.data;
      let totalUnread = 0;
      conversations.forEach((conv: any) => {
        if (conv.user1_id === user._id) {
          totalUnread += conv.unread_count_user1 || 0;
        } else {
          totalUnread += conv.unread_count_user2 || 0;
        }
      });
      
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error fetching unread messages count:', error);
    }
  };

  useEffect(() => {
    if (user) {
      refreshUnreadCount();
      
      // Refresh every 30 seconds
      const interval = setInterval(refreshUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <MessagesContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </MessagesContext.Provider>
  );
};
