import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  MoreVertical,
  Mail,
  Calendar,
  Activity,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Edit3,
  Trash2,
  Eye,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Helper function para formatear fechas de manera segura
const formatDateSafe = (
  dateValue: string | Date | null | undefined,
  formatString: string = 'dd/MM/yyyy HH:mm'
): string => {
  if (!dateValue) return 'Nunca';

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Fecha inválida';

    return format(date, formatString, { locale: es });
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'Error en fecha';
  }
};

interface Agent {
  id: string;
  username: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'busy';
  lastLogin: string;
  conversationsHandled: number;
  averageResponseTime: number;
  rating: number;
  createdAt: string;
}

const AgentsPageImproved: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAgents();
      setAgents(response.data.data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      // Datos de demo para desarrollo
      setAgents([
        {
          id: '1',
          username: 'María García',
          email: 'maria.garcia@empresa.com',
          role: 'supervisor',
          status: 'active',
          lastLogin: new Date().toISOString(),
          conversationsHandled: 45,
          averageResponseTime: 2.5,
          rating: 4.8,
          createdAt: '2024-01-15T00:00:00Z',
        },
        {
          id: '2',
          username: 'Carlos Rodríguez',
          email: 'carlos.rodriguez@empresa.com',
          role: 'agent',
          status: 'active',
          lastLogin: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          conversationsHandled: 32,
          averageResponseTime: 3.2,
          rating: 4.6,
          createdAt: '2024-02-01T00:00:00Z',
        },
        {
          id: '3',
          username: 'Ana López',
          email: 'ana.lopez@empresa.com',
          role: 'agent',
          status: 'busy',
          lastLogin: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          conversationsHandled: 28,
          averageResponseTime: 2.8,
          rating: 4.9,
          createdAt: '2024-01-20T00:00:00Z',
        },
        {
          id: '4',
          username: 'Diego Martín',
          email: 'diego.martin@empresa.com',
          role: 'agent',
          status: 'inactive',
          lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          conversationsHandled: 18,
          averageResponseTime: 4.1,
          rating: 4.3,
          createdAt: '2024-03-01T00:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'busy':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'busy':
        return <Clock className="h-4 w-4" />;
      case 'inactive':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'supervisor':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'agent':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredAgents = agents.filter(
    (agent) =>
      agent.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 font-medium">Cargando agentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Gestión de Agentes
              </h1>
              <p className="text-gray-600">
                Administra tu equipo de atención al cliente
              </p>
            </div>{' '}
            <button
              onClick={() =>
                alert('Funcionalidad de agregar agente próximamente')
              }
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              <span>Agregar Agente</span>
            </button>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Agentes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agents.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Activos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agents.filter((a) => a.status === 'active').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ocupados</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agents.filter((a) => a.status === 'busy').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Supervisores</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agents.filter((a) => a.role === 'supervisor').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar agentes por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Lista de agentes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Lista de Agentes ({filteredAgents.length})
            </h2>
          </div>

          {filteredAgents.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay agentes
              </h3>
              <p className="text-gray-500">
                {searchTerm
                  ? 'No se encontraron agentes que coincidan con tu búsqueda.'
                  : 'Aún no hay agentes registrados.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-lg">
                          {agent.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {agent.username}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              agent.status
                            )}`}
                          >
                            {getStatusIcon(agent.status)}
                            <span className="ml-1 capitalize">
                              {agent.status}
                            </span>
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(
                              agent.role
                            )}`}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            <span className="capitalize">{agent.role}</span>
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Mail className="h-4 w-4" />
                            <span>{agent.email}</span>
                          </div>{' '}
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />{' '}
                            <span>
                              Último acceso: {formatDateSafe(agent.lastLogin)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      {/* Métricas */}
                      <div className="text-right space-y-1">
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">
                              {agent.conversationsHandled}
                            </div>
                            <div className="text-gray-500">Conversaciones</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">
                              {agent.averageResponseTime}min
                            </div>
                            <div className="text-gray-500">Resp. promedio</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">
                              {agent.rating}/5
                            </div>
                            <div className="text-gray-500">Calificación</div>
                          </div>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center space-x-2">
                        <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentsPageImproved;
