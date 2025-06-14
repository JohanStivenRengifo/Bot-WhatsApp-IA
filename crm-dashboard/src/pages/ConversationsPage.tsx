import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  Avatar,
  Badge,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Message as MessageIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useConversations } from '../hooks/useApi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Conversation } from '../types';

const ConversationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');

  const {
    data: conversationsData,
    isLoading,
    error,
  } = useConversations({
    page,
    limit: 10,
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    agentId: agentFilter !== 'all' ? agentFilter : undefined,
  });

  const conversations = conversationsData?.data || [];
  const pagination = conversationsData?.pagination;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'closed':
        return 'default';
      case 'transferred':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Activa';
      case 'pending':
        return 'Pendiente';
      case 'closed':
        return 'Cerrada';
      case 'transferred':
        return 'Transferida';
      default:
        return status;
    }
  };

  const handleViewConversation = (conversationId: string) => {
    navigate(`/dashboard/conversations/${conversationId}`);
  };
  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error al cargar las conversaciones
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Conversaciones
      </Typography>

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} flexWrap="wrap">
            <TextField
              placeholder="Buscar por nombre o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Estado</InputLabel>
              <Select
                value={statusFilter}
                label="Estado"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="active">Activas</MenuItem>
                <MenuItem value="pending">Pendientes</MenuItem>
                <MenuItem value="closed">Cerradas</MenuItem>
                <MenuItem value="transferred">Transferidas</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Agente</InputLabel>
              <Select
                value={agentFilter}
                label="Agente"
                onChange={(e) => setAgentFilter(e.target.value)}
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="unassigned">Sin asignar</MenuItem>
                {/* Aquí puedes mapear los agentes disponibles */}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Tabla de conversaciones */}
      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Cliente</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Agente Asignado</TableCell>
                <TableCell>Último Mensaje</TableCell>
                <TableCell>Mensajes</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {conversations.map((conversation: Conversation) => (
                <TableRow
                  key={conversation.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleViewConversation(conversation.id)}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ mr: 2, width: 40, height: 40 }}>
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {conversation.customerName || 'Cliente'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {conversation.phoneNumber}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(conversation.status)}
                      color={getStatusColor(conversation.status) as any}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>{' '}
                  <TableCell>
                    {conversation.assignedAgentName ? (
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ mr: 1, width: 24, height: 24 }}>
                          {conversation.assignedAgentName[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">
                            {conversation.assignedAgentName}
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Sin asignar
                      </Typography>
                    )}
                  </TableCell>{' '}
                  <TableCell>
                    <Typography variant="body2">
                      {(() => {
                        try {
                          if (
                            !conversation.lastMessageAt ||
                            (typeof conversation.lastMessageAt === 'object' &&
                              Object.keys(conversation.lastMessageAt).length ===
                                0)
                          ) {
                            return 'Sin mensajes';
                          }
                          const date = new Date(conversation.lastMessageAt);
                          if (isNaN(date.getTime())) {
                            return 'Fecha inválida';
                          }
                          return format(date, 'dd/MM/yyyy HH:mm', {
                            locale: es,
                          });
                        } catch (error) {
                          return 'No disponible';
                        }
                      })()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Badge
                      badgeContent={conversation.unreadCount || 0}
                      color="error"
                      anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                      }}
                    >
                      <MessageIcon color="action" />
                    </Badge>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Ver conversación">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewConversation(conversation.id);
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Paginación */}
        {pagination && pagination.totalPages > 1 && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination
              count={pagination.totalPages}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
              color="primary"
            />
          </Box>
        )}

        {conversations.length === 0 && (
          <Box textAlign="center" p={4}>
            <Typography variant="body2" color="text.secondary">
              No se encontraron conversaciones
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
};

export default ConversationsPage;
