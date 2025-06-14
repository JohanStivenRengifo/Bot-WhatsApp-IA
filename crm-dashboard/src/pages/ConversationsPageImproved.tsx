import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Avatar,
  Card,
  CardContent,
  Pagination,
  InputAdornment,
  Skeleton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Message as MessageIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useConversations } from '../hooks/useApi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Conversation } from '../types';

const ConversationsPageImproved: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: conversationsResponse, isLoading } = useConversations({
    page,
    search,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    agent: agentFilter !== 'all' ? agentFilter : undefined,
    refreshKey,
  });
  const conversations = conversationsResponse?.data || [];

  // Deduplicar conversaciones por ID
  const uniqueConversations = conversations.filter(
    (conversation: Conversation, index: number, self: Conversation[]) =>
      index === self.findIndex((c: Conversation) => c.id === conversation.id)
  );

  const totalPages = Math.ceil((uniqueConversations.length || 0) / 10);

  // Función para obtener el color del estado
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'assigned':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Función para obtener el icono del estado
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircleIcon className="w-4 h-4" />;
      case 'closed':
        return <CancelIcon className="w-4 h-4" />;
      case 'pending':
        return <ScheduleIcon className="w-4 h-4" />;
      case 'assigned':
        return <AssignmentIcon className="w-4 h-4" />;
      default:
        return <MessageIcon className="w-4 h-4" />;
    }
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleViewConversation = (conversationId: string) => {
    navigate(`/conversations/${conversationId}`);
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return 'N/A';
    // Formatear número de teléfono colombiano
    if (phone.startsWith('57') && phone.length > 10) {
      const number = phone.substring(2);
      return `+57 ${number.substring(0, 3)} ${number.substring(
        3,
        6
      )} ${number.substring(6)}`;
    }
    return phone;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Conversaciones
              </h1>
              <p className="text-gray-600">
                Gestiona y revisa todas las conversaciones de WhatsApp
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Tooltip title="Actualizar">
                <IconButton
                  onClick={handleRefresh}
                  className="bg-white shadow-sm hover:shadow-md transition-shadow"
                  size="large"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>{' '}
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm border">
                <div className="text-sm text-gray-500">Total</div>{' '}
                <div className="text-2xl font-bold text-gray-900">
                  {uniqueConversations.length}
                </div>
              </div>
            </div>
          </div>

          {/* Filtros mejorados */}
          <Card className="shadow-sm border-0">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Barra de búsqueda */}
                <div className="md:col-span-5">
                  <TextField
                    fullWidth
                    placeholder="Buscar por nombre, teléfono o mensaje..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon className="text-gray-400" />
                        </InputAdornment>
                      ),
                      className: 'bg-gray-50 rounded-lg border-0',
                    }}
                    variant="outlined"
                    size="medium"
                  />
                </div>

                {/* Filtro de estado */}
                <div className="md:col-span-3">
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Estado</InputLabel>
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      label="Estado"
                      className="bg-white"
                    >
                      <MenuItem value="all">Todos los estados</MenuItem>
                      <MenuItem value="active">Activas</MenuItem>
                      <MenuItem value="closed">Cerradas</MenuItem>
                      <MenuItem value="pending">Pendientes</MenuItem>
                      <MenuItem value="assigned">Asignadas</MenuItem>
                    </Select>
                  </FormControl>
                </div>

                {/* Filtro de agente */}
                <div className="md:col-span-3">
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Agente</InputLabel>
                    <Select
                      value={agentFilter}
                      onChange={(e) => setAgentFilter(e.target.value)}
                      label="Agente"
                      className="bg-white"
                    >
                      <MenuItem value="all">Todos los agentes</MenuItem>
                      <MenuItem value="assigned">Con agente asignado</MenuItem>
                      <MenuItem value="unassigned">Sin asignar</MenuItem>
                    </Select>
                  </FormControl>
                </div>

                {/* Botón de filtros avanzados */}
                <div className="md:col-span-1">
                  <Tooltip title="Filtros avanzados">
                    <IconButton
                      size="large"
                      className="bg-blue-50 text-blue-600 hover:bg-blue-100"
                    >
                      <FilterIcon />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de conversaciones mejorada */}
        <div className="space-y-4">
          {isLoading ? (
            // Skeleton loading
            Array.from({ length: 5 }).map((_, index) => (
              <Card key={index} className="shadow-sm border-0">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <Skeleton variant="circular" width={56} height={56} />
                    <div className="flex-1 space-y-2">
                      <Skeleton variant="text" width="40%" height={24} />
                      <Skeleton variant="text" width="60%" height={20} />
                      <Skeleton variant="text" width="30%" height={16} />
                    </div>
                    <div className="space-y-2">
                      <Skeleton variant="rectangular" width={80} height={24} />
                      <Skeleton variant="text" width={60} height={16} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : uniqueConversations.length === 0 ? (
            // Estado vacío mejorado
            <Card className="shadow-sm border-0">
              <CardContent className="p-12 text-center">
                <div className="mb-4">
                  <MessageIcon className="w-16 h-16 text-gray-300 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No hay conversaciones
                </h3>
                <p className="text-gray-500 mb-6">
                  {search || statusFilter !== 'all' || agentFilter !== 'all'
                    ? 'No se encontraron conversaciones que coincidan con los filtros aplicados.'
                    : 'Aún no hay conversaciones registradas en el sistema.'}
                </p>
                {(search ||
                  statusFilter !== 'all' ||
                  agentFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('all');
                      setAgentFilter('all');
                    }}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Limpiar filtros
                  </button>
                )}
              </CardContent>
            </Card>
          ) : (
            // Lista de conversaciones
            uniqueConversations.map((conversation: Conversation) => (
              <Card
                key={conversation.id}
                className="shadow-sm border-0 hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => handleViewConversation(conversation.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    {/* Información del cliente */}
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="relative">
                        <Avatar
                          className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold"
                          alt={conversation.customerName}
                        >
                          {conversation.customerName?.charAt(0).toUpperCase() ||
                            'U'}
                        </Avatar>
                        {conversation.status === 'active' && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {conversation.customerName || 'Cliente Anónimo'}
                          </h3>{' '}
                          {(conversation as any).unreadCount > 0 && (
                            <Badge
                              badgeContent={(conversation as any).unreadCount}
                              color="error"
                              className="ml-2"
                            />
                          )}
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <PhoneIcon className="w-4 h-4" />
                            <span>
                              {formatPhoneNumber(conversation.phoneNumber)}
                            </span>
                          </div>
                          {(conversation as any).lastMessage && (
                            <div className="flex items-center space-x-1 max-w-xs">
                              <MessageIcon className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">
                                "{(conversation as any).lastMessage}"
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <ScheduleIcon className="w-3 h-3" />{' '}
                            <span>
                              {conversation.lastMessageAt
                                ? format(
                                    new Date(conversation.lastMessageAt),
                                    'dd/MM/yyyy HH:mm',
                                    { locale: es }
                                  )
                                : 'N/A'}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <MessageIcon className="w-3 h-3" />
                            <span>
                              {(conversation as any).messageCount || 0} mensajes
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Estado y acciones */}
                    <div className="flex items-center space-x-4">
                      <div className="text-right space-y-2">
                        <div
                          className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            conversation.status
                          )}`}
                        >
                          {getStatusIcon(conversation.status)}
                          <span className="capitalize">
                            {conversation.status}
                          </span>
                        </div>

                        <div className="text-xs text-gray-500">
                          {conversation.assignedAgentName ? (
                            <div className="flex items-center space-x-1">
                              <PersonIcon className="w-3 h-3" />
                              <span>{conversation.assignedAgentName}</span>
                            </div>
                          ) : (
                            <span className="italic">Sin asignar</span>
                          )}
                        </div>
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip title="Ver conversación">
                          <IconButton
                            size="small"
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewConversation(conversation.id);
                            }}
                          >
                            <ViewIcon className="w-4 h-4" />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Paginación mejorada */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <Card className="shadow-sm border-0">
              <CardContent className="p-4">
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, newPage) => setPage(newPage)}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationsPageImproved;
