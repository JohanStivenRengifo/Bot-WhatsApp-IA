import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Search,
  Filter,
  User,
  Clock,
  Phone,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical,
  ArrowRight,
  Users,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { useConversations } from '../hooks/useApi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ConversationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: conversationsData,
    isLoading,
    error,
    refetch,
  } = useConversations({
    page,
    limit: 15,
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    agentId: agentFilter !== 'all' ? agentFilter : undefined,
  });

  const conversations = conversationsData?.data || [];
  const pagination = conversationsData?.pagination;

  // Stats calculadas
  const stats = {
    total: conversations.length,
    active: conversations.filter((c) => c.status === 'active').length,
    pending: conversations.filter((c) => c.status === 'pending').length,
    unread: conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 500);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          color: 'bg-green-100 text-green-800',
          icon: CheckCircle,
          label: 'Activa',
        };
      case 'pending':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: AlertCircle,
          label: 'Pendiente',
        };
      case 'closed':
        return {
          color: 'bg-gray-100 text-gray-800',
          icon: XCircle,
          label: 'Cerrada',
        };
      case 'transferred':
        return {
          color: 'bg-blue-100 text-blue-800',
          icon: ArrowRight,
          label: 'Transferida',
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800',
          icon: XCircle,
          label: status,
        };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return { color: 'bg-red-100 text-red-800', label: 'Alta' };
      case 'medium':
        return { color: 'bg-yellow-100 text-yellow-800', label: 'Media' };
      case 'low':
        return { color: 'bg-green-100 text-green-800', label: 'Baja' };
      default:
        return { color: 'bg-gray-100 text-gray-800', label: 'N/A' };
    }
  };

  const handleViewConversation = (conversationId: string) => {
    navigate(`/dashboard/conversations/${conversationId}`);
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando conversaciones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">
            Error al cargar las conversaciones
          </p>
          <button onClick={handleRefresh} className="btn-primary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </button>
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
                <MessageSquare className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Conversaciones
                  </h1>
                  <p className="text-sm text-gray-500">
                    Gestiona todas las conversaciones de WhatsApp
                  </p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-secondary"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
                />
                Actualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.total}
                </p>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Activas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.active}
                </p>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-yellow-500">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pendientes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.pending}
                </p>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-purple-500">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">No Leídos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.unread}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary text-sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-10"
              />
            </div>

            {showFilters && (
              <>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-field"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activas</option>
                  <option value="pending">Pendientes</option>
                  <option value="closed">Cerradas</option>
                  <option value="transferred">Transferidas</option>
                </select>

                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="input-field"
                >
                  <option value="all">Todos los agentes</option>
                  <option value="unassigned">Sin asignar</option>
                  <option value="agent1">Agente 1</option>
                  <option value="agent2">Agente 2</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="input-field"
                >
                  <option value="all">Todas las prioridades</option>
                  <option value="high">Prioridad Alta</option>
                  <option value="medium">Prioridad Media</option>
                  <option value="low">Prioridad Baja</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Conversaciones ({conversations.length})
            </h3>
          </div>

          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay conversaciones
              </h3>
              <p className="text-gray-500">
                {search || statusFilter !== 'all' || agentFilter !== 'all'
                  ? 'No se encontraron conversaciones con los filtros aplicados'
                  : 'Aún no hay conversaciones para mostrar'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {conversations.map((conversation) => {
                const statusConfig = getStatusConfig(conversation.status);
                const StatusIcon = statusConfig.icon;
                const priorityConfig = getPriorityConfig(conversation.priority);

                return (
                  <div
                    key={conversation.id}
                    onClick={() => handleViewConversation(conversation.id)}
                    className="group relative bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer"
                  >
                    {/* Unread indicator */}
                    {conversation.unreadCount > 0 && (
                      <div className="absolute top-2 right-2">
                        <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {conversation.unreadCount}
                        </div>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-blue-600" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900 truncate">
                              {conversation.customerName || 'Usuario Anónimo'}
                            </h4>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}
                              >
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig.label}
                              </span>
                              {conversation.priority && (
                                <span
                                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityConfig.color}`}
                                >
                                  {priorityConfig.label}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-1" />
                              {conversation.phoneNumber}
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {formatTime(conversation.lastMessageTime)}
                            </div>
                            {conversation.assignedAgent && (
                              <div className="flex items-center">
                                <Users className="h-4 w-4 mr-1" />
                                {conversation.assignedAgent}
                              </div>
                            )}
                          </div>

                          <p className="text-gray-700 text-sm mb-3 line-clamp-2">
                            {conversation.lastMessage ||
                              'Sin mensajes recientes'}
                          </p>

                          {conversation.tags &&
                            conversation.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {conversation.tags.map(
                                  (tag: string, index: number) => (
                                    <span
                                      key={index}
                                      className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded"
                                    >
                                      {tag}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewConversation(conversation.id);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle more actions
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-gray-500">
                Mostrando {(page - 1) * 15 + 1} a{' '}
                {Math.min(page * 15, pagination.total)} de {pagination.total}{' '}
                conversaciones
              </div>
              <div className="flex space-x-2">
                {Array.from(
                  { length: pagination.totalPages },
                  (_, i) => i + 1
                ).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationsPage;
