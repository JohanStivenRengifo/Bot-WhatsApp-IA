import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../services/api';
import { webSocketService } from '../services/websocket';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verificar token al cargar la aplicación
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('auth_token');
      if (savedToken) {
        setToken(savedToken);
        try {
          const response = await apiClient.getCurrentUser();
          if (response.data.success) {
            setUser(response.data.data);
          } else {
            // Token inválido
            localStorage.removeItem('auth_token');
            setToken(null);
          }
        } catch (error) {
          console.error('Error verificando token:', error);
          localStorage.removeItem('auth_token');
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await apiClient.login(email, password);

      if (response.data.success && response.data.data) {
        const { token: newToken, user: userData } = response.data.data;

        setToken(newToken);
        setUser(userData);
        localStorage.setItem('auth_token', newToken);

        // Reconectar WebSocket con el nuevo token
        webSocketService.reconnectWithAuth();

        return true;
      }
      return false;
    } catch (error) {
      console.error('Error en login:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('auth_token');

      // Desconectar WebSocket
      webSocketService.disconnect();
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
