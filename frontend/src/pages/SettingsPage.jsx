import React, { useState, useEffect } from 'react';
import axios from 'axios';

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    whatsapp: {
      apiUrl: 'https://graph.facebook.com/v17.0',
      apiToken: '',
      phoneNumberId: '',
      webhookVerifyToken: ''
    },
    gemini: {
      apiKey: '',
      model: 'gemini-2.0-flash-lite'
    },
    database: {
      url: ''
    },
    notifications: {
      emailAlerts: false,
      emailRecipients: ''
    }
  });
  
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/settings');
      setSettings(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setLoading(false);
    }
  };

  const handleWhatsAppChange = (e) => {
    const { name, value } = e.target;
    setSettings({
      ...settings,
      whatsapp: {
        ...settings.whatsapp,
        [name]: value
      }
    });
  };

  const handleGeminiChange = (e) => {
    const { name, value } = e.target;
    setSettings({
      ...settings,
      gemini: {
        ...settings.gemini,
        [name]: value
      }
    });
  };

  const handleDatabaseChange = (e) => {
    const { name, value } = e.target;
    setSettings({
      ...settings,
      database: {
        ...settings.database,
        [name]: value
      }
    });
  };

  const handleNotificationsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [name]: type === 'checkbox' ? checked : value
      }
    });
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await axios.post('/api/settings', settings);
      setSaving(false);
      alert('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaving(false);
      alert('Error al guardar la configuración');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          <i className="fas fa-cog text-gray-400 mr-2"></i>
          Configuración
        </h1>
        <p className="text-gray-300">
          Configura los parámetros del sistema y las integraciones.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* WhatsApp API Settings */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              <i className="fab fa-whatsapp text-green-500 mr-2"></i>
              Configuración de WhatsApp Business API
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-gray-300 mb-1">API URL</label>
                <input
                  type="text"
                  name="apiUrl"
                  value={settings.whatsapp.apiUrl}
                  onChange={handleWhatsAppChange}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="URL de la API de WhatsApp"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">API Token</label>
                <input
                  type="password"
                  name="apiToken"
                  value={settings.whatsapp.apiToken}
                  onChange={handleWhatsAppChange}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="Ingresa el token de la API"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Phone Number ID</label>
                <input
                  type="text"
                  name="phoneNumberId"
                  value={settings.whatsapp.phoneNumberId}
                  onChange={handleWhatsAppChange}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="ID del número de WhatsApp"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Webhook Verify Token</label>
                <input
                  type="text"
                  name="webhookVerifyToken"
                  value={settings.whatsapp.webhookVerifyToken}
                  onChange={handleWhatsAppChange}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="Token de verificación del webhook"
                />
              </div>
            </div>
          </div>

          {/* Gemini AI Settings */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              <i className="fas fa-robot text-blue-500 mr-2"></i>
              Configuración de Gemini AI
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-gray-300 mb-1">API Key</label>
                <input
                  type="password"
                  name="apiKey"
                  value={settings.gemini.apiKey}
                  onChange={handleGeminiChange}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="Ingresa la clave de API de Gemini"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Modelo</label>
                <select
                  name="model"
                  value={settings.gemini.model}
                  onChange={handleGeminiChange}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                >
                  <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                  <option value="gemini-2.0-pro">Gemini 2.0 Pro</option>
                  <option value="gemini-2.0-vision">Gemini 2.0 Vision</option>
                </select>
              </div>
            </div>
          </div>

          {/* Database Settings */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              <i className="fas fa-database text-yellow-500 mr-2"></i>
              Configuración de Base de Datos
            </h2>
            <div>
              <label className="block text-gray-300 mb-1">URL de la Base de Datos</label>
              <input
                type="password"
                name="url"
                value={settings.database.url}
                onChange={handleDatabaseChange}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                placeholder="URL de conexión a la base de datos"
              />
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              <i className="fas fa-bell text-red-500 mr-2"></i>
              Configuración de Notificaciones
            </h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="emailAlerts"
                  checked={settings.notifications.emailAlerts}
                  onChange={handleNotificationsChange}
                  className="h-4 w-4 text-blue-600 rounded border-gray-600 bg-gray-700"
                />
                <label className="ml-2 text-gray-300">Activar alertas por correo</label>
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Destinatarios de correo</label>
                <input
                  type="text"
                  name="emailRecipients"
                  value={settings.notifications.emailRecipients}
                  onChange={handleNotificationsChange}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="Correos separados por comas"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg disabled:opacity-50 flex items-center"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;