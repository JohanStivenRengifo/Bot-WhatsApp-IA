import React, { useState, useEffect } from 'react';
import axios from 'axios';

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    whatsapp: {
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 mb-1">API Token</label>
                <input
                  type="password