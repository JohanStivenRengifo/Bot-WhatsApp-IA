import React, { useState, useEffect } from 'react';
import {
  Bot,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Wrench,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Users,
  TrendingUp,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Trash2,
  Zap,
  Database,
  FileText,
  Globe,
  Shield,
} from 'lucide-react';
import { apiClient } from '../services/api';

interface BotStatus {
  status: 'running' | 'paused' | 'maintenance' | 'error';
  uptime: number;
  uptimeFormatted: string;
  lastActivity: string;
  messagesProcessed: number;
  errorsCount: number;
  enabledFlows: string[];
  version: string;
  environment: string;
}

interface BotConfig {
  whatsappToken: string;
  phoneNumberId: string;
  webhookUrl: string;
  apiUrl: string;
  enabledFlows: string[];
  rateLimitEnabled: boolean;
  maintenanceMode: boolean;
  logLevel: string;
  environment: string;
}

interface Flow {
  name: string;
  enabled: boolean;
  description: string;
}

interface BotMetrics {
  messagesProcessed: number;
  errorsCount: number;
  averageResponseTime: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  details?: any;
}

interface Session {
  phoneNumber: string;
  startTime: string;
  lastActivity: string;
  currentFlow: string;
  botPaused: boolean;
}

const BotControlPage: React.FC = () => {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [metrics, setMetrics] = useState<BotMetrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | 'status'
    | 'config'
    | 'flows'
    | 'metrics'
    | 'logs'
    | 'sessions'
    | 'maintenance'
  >('status');
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadBotData(true);

    const interval = setInterval(() => {
      loadBotData(false);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const loadBotData = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const results = await Promise.allSettled([
        apiClient.getBotStatus(),
        apiClient.getBotConfig(),
        apiClient.getBotFlows(),
        apiClient.getBotMetrics(),
        apiClient.getBotLogs({ limit: 50 }),
        apiClient.getBotSessions(),
      ]);

      if (results[0].status === 'fulfilled') {
        setBotStatus(results[0].value.data.data || results[0].value.data);
      }
      if (results[1].status === 'fulfilled') {
        setBotConfig(results[1].value.data.data || results[1].value.data);
      }
      if (results[2].status === 'fulfilled') {
        const flowsData = results[2].value.data.data || results[2].value.data;
        setFlows(
          flowsData.flows || [
            {
              name: 'initialSelection',
              enabled: true,
              description: 'Menú inicial de selección',
            },
            {
              name: 'authentication',
              enabled: true,
              description: 'Flujo de autenticación',
            },
            { name: 'sales', enabled: true, description: 'Flujo de ventas' },
            {
              name: 'clientMenu',
              enabled: true,
              description: 'Menú de cliente',
            },
            {
              name: 'agentHandover',
              enabled: true,
              description: 'Transferencia a agente',
            },
            {
              name: 'debtInquiry',
              enabled: true,
              description: 'Consulta de deudas',
            },
            {
              name: 'paymentReceipt',
              enabled: true,
              description: 'Comprobantes de pago',
            },
            {
              name: 'ticketCreation',
              enabled: true,
              description: 'Creación de tickets',
            },
          ]
        );
      }
      if (results[3].status === 'fulfilled') {
        setMetrics(results[3].value.data.data || results[3].value.data);
      }
      if (results[4].status === 'fulfilled') {
        const logsData = results[4].value.data.data || results[4].value.data;
        setLogs(logsData.logs || []);
      }
      if (results[5].status === 'fulfilled') {
        const sessionsData =
          results[5].value.data.data || results[5].value.data;
        setSessions(sessionsData.sessions || []);
      }
    } catch (error) {
      console.error('Error cargando datos del bot:', error);
      setError('Error cargando datos del bot');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleBotAction = async (action: 'pause' | 'resume' | 'restart') => {
    try {
      setActionLoading(action);
      setError(null);

      if (action === 'pause') {
        await apiClient.pauseBot({ reason: 'Manual desde CRM' });
      } else if (action === 'resume') {
        await apiClient.resumeBot();
      } else if (action === 'restart') {
        await apiClient.restartBot();
      }

      await loadBotData(false);
    } catch (error) {
      console.error(`Error en acción ${action}:`, error);
      setError(
        `Error al ${
          action === 'pause'
            ? 'pausar'
            : action === 'resume'
            ? 'reanudar'
            : 'reiniciar'
        } el bot`
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleFlowToggle = async (flowName: string, enabled: boolean) => {
    try {
      setError(null);

      if (enabled) {
        await apiClient.enableBotFlow(flowName);
      } else {
        await apiClient.disableBotFlow(flowName);
      }

      await loadBotData(false);
    } catch (error) {
      console.error('Error cambiando estado del flujo:', error);
      setError('Error cambiando estado del flujo');
    }
  };

  const handleMaintenanceToggle = async (enable: boolean) => {
    try {
      setError(null);
      if (enable) {
        await apiClient.enableMaintenanceMode({ message: maintenanceMessage });
      } else {
        await apiClient.disableMaintenanceMode();
      }

      await loadBotData(false);
    } catch (error) {
      console.error('Error cambiando modo mantenimiento:', error);
      setError('Error cambiando modo mantenimiento');
    }
  };

  const handleSaveConfig = async () => {
    try {
      setActionLoading('config');
      setError(null);

      if (botConfig) {
        await apiClient.updateBotConfig(botConfig);
        await loadBotData();
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      setError('Error guardando configuración');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearSession = async (phoneNumber: string) => {
    try {
      setError(null);
      await apiClient.clearUserSession(phoneNumber);
      await loadBotData(false);
    } catch (error) {
      console.error('Error limpiando sesión:', error);
      setError('Error limpiando sesión');
    }
  };

  const handleClearAllSessions = async () => {
    try {
      setError(null);
      await apiClient.clearAllSessions();
      await loadBotData(false);
    } catch (error) {
      console.error('Error limpiando todas las sesiones:', error);
      setError('Error limpiando todas las sesiones');
    }
  };

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const renderStatusTab = () => (
    <div className="space-y-8 animate-fade-in">
      {/* Header con Estado Principal */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div
              className={`p-4 rounded-full ${
                botStatus?.status === 'running'
                  ? 'bg-green-500'
                  : botStatus?.status === 'paused'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              } shadow-lg`}
            >
              <Bot className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Bot WhatsApp</h2>
              <p className="text-blue-100 capitalize text-lg">
                {botStatus?.status === 'running'
                  ? '✅ Funcionando Correctamente'
                  : botStatus?.status === 'paused'
                  ? '⏸️ En Pausa'
                  : '❌ Con Problemas'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm">Versión</p>
            <p className="text-2xl font-bold">
              {botStatus?.version || '1.0.0'}
            </p>
          </div>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Tiempo Activo</p>
              <p className="text-3xl font-bold text-gray-900">
                {botStatus?.uptimeFormatted ||
                  formatUptime(botStatus?.uptime || 0)}
              </p>
              <p className="text-blue-600 text-xs mt-1">
                Desde el último reinicio
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-green-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">
                Mensajes Procesados
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {botStatus?.messagesProcessed || 0}
              </p>
              <p className="text-green-600 text-xs mt-1">Total acumulado</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <MessageSquare className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-purple-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">
                Flujos Activos
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {flows.filter((f) => f.enabled).length}
              </p>
              <p className="text-purple-600 text-xs mt-1">
                de {flows.length} totales
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Zap className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-red-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Errores</p>
              <p className="text-3xl font-bold text-gray-900">
                {botStatus?.errorsCount || 0}
              </p>
              <p className="text-red-600 text-xs mt-1">Últimas 24 horas</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Controles del Bot */}
      <div className="card">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Settings className="h-6 w-6 mr-3 text-blue-600" />
          Controles del Bot
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => handleBotAction('pause')}
            disabled={
              botStatus?.status === 'paused' ||
              botStatus?.status === 'maintenance' ||
              actionLoading === 'pause'
            }
            className="group relative overflow-hidden bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 disabled:transform-none disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-white opacity-20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            <div className="relative flex items-center justify-center">
              {actionLoading === 'pause' ? (
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Pause className="h-5 w-5 mr-2" />
              )}
              {actionLoading === 'pause' ? 'Pausando...' : 'Pausar Bot'}
            </div>
          </button>

          <button
            onClick={() => handleBotAction('resume')}
            disabled={
              botStatus?.status === 'running' || actionLoading === 'resume'
            }
            className="group relative overflow-hidden bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 disabled:transform-none disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-white opacity-20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            <div className="relative flex items-center justify-center">
              {actionLoading === 'resume' ? (
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              {actionLoading === 'resume' ? 'Reanudando...' : 'Reanudar Bot'}
            </div>
          </button>

          <button
            onClick={() => handleBotAction('restart')}
            disabled={actionLoading === 'restart'}
            className="group relative overflow-hidden bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 disabled:transform-none disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-white opacity-20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            <div className="relative flex items-center justify-center">
              {actionLoading === 'restart' ? (
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-5 w-5 mr-2" />
              )}
              {actionLoading === 'restart' ? 'Reiniciando...' : 'Reiniciar Bot'}
            </div>
          </button>

          <button
            onClick={() => loadBotData(false)}
            className="group relative overflow-hidden bg-gradient-to-r from-gray-400 to-gray-600 hover:from-gray-500 hover:to-gray-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
          >
            <div className="absolute inset-0 bg-white opacity-20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            <div className="relative flex items-center justify-center">
              <RefreshCw className="h-5 w-5 mr-2" />
              Actualizar
            </div>
          </button>
        </div>
      </div>

      {/* Estado de Conexiones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              WhatsApp API
            </h4>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                botStatus?.status === 'running'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {botStatus?.status === 'running' ? 'Conectado' : 'Desconectado'}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-full ${
                botStatus?.status === 'running' ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              <Globe
                className={`h-5 w-5 ${
                  botStatus?.status === 'running'
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              />
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {botStatus?.status === 'running'
                  ? 'Conexión estable con WhatsApp'
                  : 'Sin conexión a WhatsApp'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              Base de Datos
            </h4>
            <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              Conectada
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-green-100">
              <Database className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">
                MongoDB funcionando correctamente
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Servidor</h4>
            <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              Online
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-green-100">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Servidor Node.js activo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConfigTab = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Configuración del Bot
          </h3>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSensitiveData(!showSensitiveData)}
              className="inline-flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              {showSensitiveData ? (
                <EyeOff className="h-4 w-4 mr-1" />
              ) : (
                <Eye className="h-4 w-4 mr-1" />
              )}
              {showSensitiveData ? 'Ocultar' : 'Mostrar'} datos sensibles
            </button>
          </div>
        </div>

        {botConfig && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token de WhatsApp
              </label>
              <input
                type={showSensitiveData ? 'text' : 'password'}
                value={
                  showSensitiveData
                    ? botConfig.whatsappToken
                    : '***CONFIGURED***'
                }
                onChange={(e) =>
                  setBotConfig({ ...botConfig, whatsappToken: e.target.value })
                }
                className="input-field"
                disabled={!showSensitiveData}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number ID
              </label>
              <input
                type="text"
                value={botConfig.phoneNumberId}
                onChange={(e) =>
                  setBotConfig({ ...botConfig, phoneNumberId: e.target.value })
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook URL
              </label>
              <input
                type="text"
                value={botConfig.webhookUrl}
                onChange={(e) =>
                  setBotConfig({ ...botConfig, webhookUrl: e.target.value })
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API URL
              </label>
              <input
                type="text"
                value={botConfig.apiUrl}
                onChange={(e) =>
                  setBotConfig({ ...botConfig, apiUrl: e.target.value })
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nivel de Log
              </label>
              <select
                value={botConfig.logLevel}
                onChange={(e) =>
                  setBotConfig({ ...botConfig, logLevel: e.target.value })
                }
                className="input-field"
              >
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entorno
              </label>
              <input
                type="text"
                value={botConfig.environment}
                readOnly
                className="input-field bg-gray-100 text-gray-600"
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveConfig}
            disabled={actionLoading === 'config'}
            className="btn-primary disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {actionLoading === 'config'
              ? 'Guardando...'
              : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderFlowsTab = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 rounded-full">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Flujos de Conversación
              </h3>
              <p className="text-gray-600">
                Gestiona qué flujos están activos en el bot
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Flujos Activos</p>
            <p className="text-2xl font-bold text-purple-600">
              {flows.filter((f) => f.enabled).length}/{flows.length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {flows.map((flow, index) => (
            <div
              key={index}
              className={`relative p-6 rounded-xl border-2 transition-all duration-300 ${
                flow.enabled
                  ? 'border-green-200 bg-green-50 shadow-lg'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div
                      className={`p-2 rounded-lg ${
                        flow.enabled ? 'bg-green-100' : 'bg-gray-100'
                      }`}
                    >
                      <Zap
                        className={`h-5 w-5 ${
                          flow.enabled ? 'text-green-600' : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg capitalize">
                        {flow.name.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          flow.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {flow.enabled ? '✅ Activo' : '⏸️ Inactivo'}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {flow.description}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={flow.enabled}
                    onChange={(e) =>
                      handleFlowToggle(flow.name, e.target.checked)
                    }
                  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-400 peer-checked:to-blue-500 shadow-lg"></div>
                </label>
              </div>

              {flow.enabled && (
                <div className="absolute top-2 right-2">
                  <div className="h-3 w-3 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
                </div>
              )}
            </div>
          ))}
        </div>

        {flows.length === 0 && (
          <div className="text-center py-12">
            <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4">
              <Zap className="h-8 w-8 text-gray-400 mx-auto" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No hay flujos configurados
            </h4>
            <p className="text-gray-600">
              Los flujos aparecerán aquí cuando estén disponibles
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderMetricsTab = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Métricas del Bot
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">
              Mensajes Procesados
            </h4>
            <p className="text-2xl font-bold text-blue-600">
              {metrics?.messagesProcessed || botStatus?.messagesProcessed || 0}
            </p>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <h4 className="font-medium text-red-900 mb-2">Errores</h4>
            <p className="text-2xl font-bold text-red-600">
              {metrics?.errorsCount || botStatus?.errorsCount || 0}
            </p>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">
              Tiempo Respuesta Promedio
            </h4>
            <p className="text-2xl font-bold text-green-600">
              {metrics?.averageResponseTime || 150}ms
            </p>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2">Uso de Memoria</h4>
            <p className="text-2xl font-bold text-purple-600">
              {Math.round((metrics?.memoryUsage || 256) / 1024 / 1024)}MB
            </p>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-2">
              Sesiones Activas
            </h4>
            <p className="text-2xl font-bold text-yellow-600">
              {sessions.length}
            </p>
          </div>

          <div className="bg-indigo-50 rounded-lg p-4">
            <h4 className="font-medium text-indigo-900 mb-2">Tiempo Activo</h4>
            <p className="text-2xl font-bold text-indigo-600">
              {botStatus ? formatUptime(botStatus.uptime) : '0h 0m'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSessionsTab = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Sesiones Activas ({sessions.length})
          </h3>

          <button
            onClick={handleClearAllSessions}
            className="btn-danger text-sm"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Limpiar Todas
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flujo Actual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Última Actividad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map((session, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {session.phoneNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        session.botPaused
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {session.botPaused ? 'Pausado' : 'Activo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.currentFlow || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(session.lastActivity).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleClearSession(session.phoneNumber)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sessions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay sesiones activas
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderLogsTab = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Logs del Bot
          </h3>
          <button
            onClick={() => loadBotData(false)}
            className="btn-secondary text-sm"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Actualizar
          </button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg text-sm ${
                log.level === 'error'
                  ? 'bg-red-50 text-red-800'
                  : log.level === 'warn'
                  ? 'bg-yellow-50 text-yellow-800'
                  : log.level === 'info'
                  ? 'bg-blue-50 text-blue-800'
                  : 'bg-gray-50 text-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{log.message}</p>
                  {log.details && (
                    <pre className="mt-1 text-xs opacity-75 whitespace-pre-wrap">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
                <span className="text-xs opacity-60 ml-2 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay logs disponibles
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderMaintenanceTab = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Wrench className="h-5 w-5 mr-2" />
          Modo Mantenimiento
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje de Mantenimiento
            </label>
            <textarea
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              rows={3}
              className="input-field"
              placeholder="El bot está temporalmente en mantenimiento. Por favor, intenta más tarde."
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => handleMaintenanceToggle(true)}
              disabled={botStatus?.status === 'maintenance'}
              className="inline-flex items-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Wrench className="h-4 w-4 mr-2" />
              Activar Mantenimiento
            </button>

            <button
              onClick={() => handleMaintenanceToggle(false)}
              disabled={botStatus?.status !== 'maintenance'}
              className="inline-flex items-center px-4 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Desactivar Mantenimiento
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando datos del bot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bot className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Control del Bot
                  </h1>
                  <p className="text-sm text-gray-500">
                    Gestión y monitoreo del bot de WhatsApp
                  </p>
                </div>
              </div>

              {botStatus && (
                <div className="flex items-center space-x-2">
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${
                      botStatus.status === 'running'
                        ? 'bg-green-100 text-green-800'
                        : botStatus.status === 'paused'
                        ? 'bg-yellow-100 text-yellow-800'
                        : botStatus.status === 'maintenance'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {botStatus.status === 'running' ? (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    ) : botStatus.status === 'paused' ? (
                      <Pause className="h-4 w-4 mr-1" />
                    ) : botStatus.status === 'maintenance' ? (
                      <Wrench className="h-4 w-4 mr-1" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-1" />
                    )}
                    <span className="capitalize">{botStatus.status}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {[
              { id: 'status', label: 'Estado', icon: Activity },
              { id: 'config', label: 'Configuración', icon: Settings },
              { id: 'flows', label: 'Flujos', icon: Zap },
              { id: 'sessions', label: 'Sesiones', icon: Users },
              { id: 'metrics', label: 'Métricas', icon: TrendingUp },
              { id: 'logs', label: 'Logs', icon: FileText },
              { id: 'maintenance', label: 'Mantenimiento', icon: Wrench },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'config' && renderConfigTab()}
        {activeTab === 'flows' && renderFlowsTab()}
        {activeTab === 'sessions' && renderSessionsTab()}
        {activeTab === 'metrics' && renderMetricsTab()}
        {activeTab === 'logs' && renderLogsTab()}
        {activeTab === 'maintenance' && renderMaintenanceTab()}
      </div>
    </div>
  );
};

export default BotControlPage;
