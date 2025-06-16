import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../services/api';

interface SystemSettings {
  // Configuración de WhatsApp
  whatsappToken: string;
  phoneNumberId: string;
  webhookUrl: string;

  // Configuración de notificaciones
  enableNotifications: boolean;
  notificationSound: boolean;
  emailNotifications: boolean;

  // Configuración del sistema
  autoAssignConversations: boolean;
  maxConversationsPerAgent: number;
  responseTimeAlert: number;

  // URLs de conexión
  apiUrl: string;
  wsUrl: string;
}

interface SettingsContextType {
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<boolean>;
  loadSettings: () => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: SystemSettings = {
  whatsappToken: '',
  phoneNumberId: '',
  webhookUrl: '',
  enableNotifications: true,
  notificationSound: true,
  emailNotifications: false,
  autoAssignConversations: true,
  maxConversationsPerAgent: 10,
  responseTimeAlert: 5,
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  wsUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
}) => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  // Cargar configuración al inicializar
  useEffect(() => {
    // Temporalmente deshabilitado para debug
    // loadSettings();
    setIsLoading(false);
  }, []);

  const loadSettings = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await apiClient.getSystemSettings();
      if (response.data.success) {
        setSettings({ ...defaultSettings, ...response.data.data });
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      // Cargar configuración local como fallback
      const localSettings = localStorage.getItem('systemSettings');
      if (localSettings) {
        try {
          const parsed = JSON.parse(localSettings);
          setSettings({ ...defaultSettings, ...parsed });
        } catch (e) {
          console.error('Error parseando configuración local:', e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (
    newSettings: Partial<SystemSettings>
  ): Promise<boolean> => {
    try {
      const updatedSettings = { ...settings, ...newSettings };

      // Intentar guardar en el servidor
      const response = await apiClient.updateSystemSettings(updatedSettings);

      if (response.data.success) {
        setSettings(updatedSettings);
        // Guardar también en localStorage como backup
        localStorage.setItem('systemSettings', JSON.stringify(updatedSettings));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      // Guardar localmente como fallback
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      localStorage.setItem('systemSettings', JSON.stringify(updatedSettings));
      return true;
    }
  };

  const value: SettingsContextType = {
    settings,
    updateSettings,
    loadSettings,
    isLoading,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings debe ser usado dentro de un SettingsProvider');
  }
  return context;
};
