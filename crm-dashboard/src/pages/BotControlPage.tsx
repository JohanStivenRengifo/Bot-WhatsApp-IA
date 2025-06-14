import React, { useState, useEffect, useRef } from 'react';
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
  Server,
  Wifi,
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadBotData(true); // Cargar datos iniciales con loading

    // Actualizar cada 60 segundos sin mostrar loading (menos frecuente)
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
      ]); // Procesar resultados
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'paused':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'maintenance':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'error':
        return 'text-red-600 bg-red-100 border-red-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-4 w-4" />;
      case 'paused':
        return <Pause className="h-4 w-4" />;
      case 'maintenance':
        return <Wrench className="h-4 w-4" />;
      case 'error':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const renderStatusTab = () => (
    <div className="space-y-6">
      {/* Estado del Bot */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Bot className="h-5 w-5 mr-2" />
          Estado del Bot
        </h3>

        {botStatus && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Estado</p>
                  <p
                    className={`text-lg font-semibold capitalize ${
                      getStatusColor(botStatus.status).split(' ')[0]
                    }`}
                  >
                    {botStatus.status}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-full ${getStatusColor(
                    botStatus.status
                  )}`}
                >
                  {getStatusIcon(botStatus.status)}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Tiempo Activo
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {botStatus.uptimeFormatted ||
                      formatUptime(botStatus.uptime)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Mensajes Procesados
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {botStatus.messagesProcessed}
                  </p>
                </div>
                <MessageSquare className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Errores</p>
                  <p className="text-lg font-semibold text-red-600">
                    {botStatus.errorsCount}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Controles del Bot
        </h3>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleBotAction('pause')}
            disabled={
              botStatus?.status === 'paused' ||
              botStatus?.status === 'maintenance' ||
              actionLoading === 'pause'
            }
            className="inline-flex items-center px-4 py-2 border border-yellow-300 text-sm font-medium rounded-md text-yellow-700 bg-yellow-50 hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Pause className="h-4 w-4 mr-2" />
            {actionLoading === 'pause' ? 'Pausando...' : 'Pausar Bot'}
          </button>

          <button
            onClick={() => handleBotAction('resume')}
            disabled={
              botStatus?.status === 'running' || actionLoading === 'resume'
            }
            className="inline-flex items-center px-4 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-4 w-4 mr-2" />
            {actionLoading === 'resume' ? 'Reanudando...' : 'Reanudar Bot'}
          </button>

          <button
            onClick={() => handleBotAction('restart')}
            disabled={actionLoading === 'restart'}
            className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {actionLoading === 'restart' ? 'Reiniciando...' : 'Reiniciar Bot'}
          </button>
          <button
            onClick={() => loadBotData(false)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Health Check */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Estado del Sistema
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 text-green-600 rounded-full">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">WhatsApp API</p>
              <p className="text-sm text-green-600">Conectado</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 text-green-600 rounded-full">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Base de Datos</p>
              <p className="text-sm text-green-600">MongoDB Activa</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 text-green-600 rounded-full">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Servidor</p>
              <p className="text-sm text-green-600">Operativo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConfigTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Configuración del Bot
          </h3>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSensitiveData(!showSensitiveData)}
              className="inline-flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600"
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveConfig}
            disabled={actionLoading === 'config'}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="h-5 w-5 mr-2" />
          Flujos de Conversación
        </h3>

        <div className="space-y-4">
          {flows.map((flow, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div>
                <h4 className="font-medium text-gray-900 capitalize">
                  {flow.name.replace(/([A-Z])/g, ' $1').trim()}
                </h4>
                <p className="text-sm text-gray-500">{flow.description}</p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={flow.enabled}
                  onChange={(e) =>
                    handleFlowToggle(flow.name, e.target.checked)
                  }
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMetricsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
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
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Sesiones Activas ({sessions.length})
          </h3>

          <button
            onClick={handleClearAllSessions}
            className="inline-flex items-center px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
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
                      className="text-red-600 hover:text-red-900"
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
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Logs del Bot
          </h3>
          <button
            onClick={() => loadBotData(false)}
            className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
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
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="El bot está temporalmente en mantenimiento. Por favor, intenta más tarde."
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => handleMaintenanceToggle(true)}
              disabled={botStatus?.status === 'maintenance'}
              className="inline-flex items-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wrench className="h-4 w-4 mr-2" />
              Activar Mantenimiento
            </button>

            <button
              onClick={() => handleMaintenanceToggle(false)}
              disabled={botStatus?.status !== 'maintenance'}
              className="inline-flex items-center px-4 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      botStatus.status
                    )}`}
                  >
                    {getStatusIcon(botStatus.status)}
                    <span className="ml-2 capitalize">{botStatus.status}</span>
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
          <nav className="-mb-px flex space-x-8">
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
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
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
