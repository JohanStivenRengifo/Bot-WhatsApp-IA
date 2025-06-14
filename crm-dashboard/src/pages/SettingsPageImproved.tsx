import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  RefreshCw,
  Wifi,
  Phone,
  CheckCircle,
  AlertCircle,
  Shield,
  MessageSquare,
  Users,
  Clock,
} from 'lucide-react';
import { useCurrentUser } from '../hooks/useApi';

interface SystemSettings {
  whatsappToken: string;
  whatsappPhoneId: string;
  webhookUrl: string;
  enableNotifications: boolean;
  enableAutoResponse: boolean;
  maxConcurrentChats: number;
  sessionTimeout: number;
  autoAssignConversations: boolean;
  enableChatHistory: boolean;
  maxMessageLength: number;
  officeHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

const SettingsPageImproved: React.FC = () => {
  const { data: currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings>({
    whatsappToken: '',
    whatsappPhoneId: '',
    webhookUrl: `${window.location.origin}/api/webhook/whatsapp`,
    enableNotifications: true,
    enableAutoResponse: true,
    maxConcurrentChats: 10,
    sessionTimeout: 30,
    autoAssignConversations: false,
    enableChatHistory: true,
    maxMessageLength: 4096,
    officeHours: {
      enabled: false,
      start: '09:00',
      end: '17:00',
      timezone: 'America/Lima',
    },
  });

  // Simular carga de configuración desde la API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Aquí se cargarían las configuraciones reales desde la API
        // const response = await apiClient.getSystemSettings();
        // setSettings(response.data);
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      // Aquí se guardarían las configuraciones en la API
      // await apiClient.updateSystemSettings(settings);

      // Simular guardado
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    field: string,
    value: string | boolean | number
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleOfficeHoursChange = (field: string, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      officeHours: { ...prev.officeHours, [field]: value },
    }));
  };

  const testWebhook = async () => {
    setLoading(true);
    try {
      // Simular test de webhook
      await new Promise((resolve) => setTimeout(resolve, 2000));
      alert('Webhook probado exitosamente');
    } catch (err) {
      alert('Error al probar webhook');
    } finally {
      setLoading(false);
    }
  };

  const systemStatus = {
    whatsapp: { status: 'connected', message: 'Conectado correctamente' },
    webhook: { status: 'active', message: 'Webhook funcionando' },
    database: { status: 'connected', message: 'Base de datos operativa' },
    websocket: { status: 'active', message: 'WebSocket activo' },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <Settings className="mr-3 text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">
              Configuración del Sistema
            </h1>
          </div>
          <p className="text-gray-600">
            Administra la configuración general del sistema CRM
          </p>
        </div>

        {/* Alertas */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-2" size={20} />
              <span className="text-green-800 font-medium">
                Configuración guardada exitosamente
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="text-red-600 mr-2" size={20} />
              <span className="text-red-800 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Estado del Sistema */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="mr-2 text-blue-600" size={24} />
            Estado del Sistema
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center p-4 bg-gray-50 rounded-lg">
              <Wifi className="text-green-500 mr-3" size={20} />
              <div>
                <div className="font-medium text-gray-900">WhatsApp API</div>
                <div className="text-sm text-green-600">
                  {systemStatus.whatsapp.message}
                </div>
              </div>
            </div>
            <div className="flex items-center p-4 bg-gray-50 rounded-lg">
              <Phone className="text-green-500 mr-3" size={20} />
              <div>
                <div className="font-medium text-gray-900">Webhook</div>
                <div className="text-sm text-green-600">
                  {systemStatus.webhook.message}
                </div>
              </div>
            </div>
            <div className="flex items-center p-4 bg-gray-50 rounded-lg">
              <Shield className="text-green-500 mr-3" size={20} />
              <div>
                <div className="font-medium text-gray-900">Base de Datos</div>
                <div className="text-sm text-green-600">
                  {systemStatus.database.message}
                </div>
              </div>
            </div>
            <div className="flex items-center p-4 bg-gray-50 rounded-lg">
              <MessageSquare className="text-green-500 mr-3" size={20} />
              <div>
                <div className="font-medium text-gray-900">WebSocket</div>
                <div className="text-sm text-green-600">
                  {systemStatus.websocket.message}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuración de WhatsApp */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <MessageSquare className="mr-2 text-green-600" size={24} />
              Configuración de WhatsApp
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token de WhatsApp Business API
                </label>
                <input
                  type="password"
                  value={settings.whatsappToken}
                  onChange={(e) =>
                    handleInputChange('whatsappToken', e.target.value)
                  }
                  placeholder="Ingresa tu token de acceso"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={settings.whatsappPhoneId}
                  onChange={(e) =>
                    handleInputChange('whatsappPhoneId', e.target.value)
                  }
                  placeholder="ID del número de teléfono"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL del Webhook
                </label>
                <div className="flex">
                  <input
                    type="url"
                    value={settings.webhookUrl}
                    onChange={(e) =>
                      handleInputChange('webhookUrl', e.target.value)
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={testWebhook}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Test
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Configuración General */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Settings className="mr-2 text-blue-600" size={24} />
              Configuración General
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">
                    Notificaciones
                  </span>
                  <p className="text-sm text-gray-600">
                    Habilitar notificaciones push
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableNotifications}
                    onChange={(e) =>
                      handleInputChange('enableNotifications', e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">
                    Respuesta Automática
                  </span>
                  <p className="text-sm text-gray-600">
                    Activar respuestas automáticas del bot
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableAutoResponse}
                    onChange={(e) =>
                      handleInputChange('enableAutoResponse', e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">
                    Asignación Automática
                  </span>
                  <p className="text-sm text-gray-600">
                    Asignar conversaciones automáticamente
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoAssignConversations}
                    onChange={(e) =>
                      handleInputChange(
                        'autoAssignConversations',
                        e.target.checked
                      )
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Límites y Configuración */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="mr-2 text-purple-600" size={24} />
              Límites del Sistema
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chats Simultáneos Máximos
                </label>
                <input
                  type="number"
                  value={settings.maxConcurrentChats}
                  onChange={(e) =>
                    handleInputChange(
                      'maxConcurrentChats',
                      parseInt(e.target.value)
                    )
                  }
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeout de Sesión (minutos)
                </label>
                <input
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) =>
                    handleInputChange(
                      'sessionTimeout',
                      parseInt(e.target.value)
                    )
                  }
                  min="5"
                  max="120"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitud Máxima de Mensaje
                </label>
                <input
                  type="number"
                  value={settings.maxMessageLength}
                  onChange={(e) =>
                    handleInputChange(
                      'maxMessageLength',
                      parseInt(e.target.value)
                    )
                  }
                  min="100"
                  max="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Horarios de Oficina */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="mr-2 text-yellow-600" size={24} />
              Horarios de Oficina
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">
                    Habilitar Horarios
                  </span>
                  <p className="text-sm text-gray-600">
                    Restringir atención a horarios específicos
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.officeHours.enabled}
                    onChange={(e) =>
                      handleOfficeHoursChange('enabled', e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {settings.officeHours.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hora de Inicio
                      </label>
                      <input
                        type="time"
                        value={settings.officeHours.start}
                        onChange={(e) =>
                          handleOfficeHoursChange('start', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hora de Fin
                      </label>
                      <input
                        type="time"
                        value={settings.officeHours.end}
                        onChange={(e) =>
                          handleOfficeHoursChange('end', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Zona Horaria
                    </label>
                    <select
                      value={settings.officeHours.timezone}
                      onChange={(e) =>
                        handleOfficeHoursChange('timezone', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="America/Lima">América/Lima (UTC-5)</option>
                      <option value="America/Bogota">
                        América/Bogotá (UTC-5)
                      </option>
                      <option value="America/Mexico_City">
                        América/México (UTC-6)
                      </option>
                      <option value="America/New_York">
                        América/Nueva York (UTC-5/-4)
                      </option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {currentUser?.data?.username && (
                <span>Configuración de: {currentUser.data.username}</span>
              )}
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="mr-2" size={16} />
                Restablecer
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2" size={16} />
                    Guardar Configuración
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPageImproved;
