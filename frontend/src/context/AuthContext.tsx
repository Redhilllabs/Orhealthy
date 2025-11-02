import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { storage } from '../utils/storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface User {
  _id: string;
  email: string;
  name: string;
  picture?: string;
  profile: {
    height?: number;
    weight?: number;
    allergies?: string[];
    expertise?: string;
  };
  points: number;
  inherent_points: number;
  star_rating: number;
  is_guide: boolean;
  guides: string[];
  guidees: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  processSessionId: (sessionId: string) => Promise<void>;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: any) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const processSessionId = async (sessionId: string) => {
    try {
      console.log('[AuthContext] Processing session ID:', sessionId);
      const response = await axios.get(`${API_URL}/auth/session-data`, {
        headers: { 'X-Session-ID': sessionId },
      });

      console.log('[AuthContext] Session data received:', response.data);
      const { session_token } = response.data;
      await storage.setItemAsync('session_token', session_token);
      console.log('[AuthContext] Session token stored');

      // Get user data
      await checkSession();
    } catch (error) {
      console.error('[AuthContext] Error processing session:', error);
      throw error;
    }
  };

  const checkSession = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUser(response.data);
    } catch (error) {
      console.error('Error checking session:', error);
      await storage.deleteItemAsync('session_token');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (token) {
        await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await storage.deleteItemAsync('session_token');
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const updateProfile = async (profile: any) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.put(`${API_URL}/users/profile`, profile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshUser();
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (token) {
        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(response.data);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        processSessionId,
        checkSession,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
