import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Chip,
  IconButton,
  Alert,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Assignment as AssignIcon,
  Close as CloseIcon,
  PersonAdd as PersonAddIcon,
  CheckCircle as OnlineIcon,
  Cancel as OfflineIcon,
  Schedule as BusyIcon,
  HourglassEmpty as AwayIcon,
} from '@mui/icons-material';
import type { Agent } from '../types';

interface AgentAssignmentProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  currentAgentId?: string;
  onAgentAssigned?: (agentId: string, agentName: string) => void;
}

const mockAgents: Agent[] = [
  {
    id: 'agent1',
    name: 'María González',
    email: 'maria@company.com',
    role: 'agent',
    isOnline: true,
    status: 'available',
    currentConversations: 2,
    maxConversations: 5,
    lastActivity: new Date().toISOString(),
    sessionId: 'session_123',
  },
  {
    id: 'agent2',
    name: 'Juan Pérez',
    email: 'juan@company.com',
    role: 'agent',
    isOnline: true,
    status: 'busy',
    currentConversations: 4,
    maxConversations: 5,
    lastActivity: new Date().toISOString(),
    sessionId: 'session_456',
  },
  {
    id: 'agent3',
    name: 'Carlos Rodríguez',
    email: 'carlos@company.com',
    role: 'supervisor',
    isOnline: false,
    status: 'offline',
    currentConversations: 0,
    maxConversations: 8,
    lastActivity: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'agent4',
    name: 'Ana Martínez',
    email: 'ana@company.com',
    role: 'agent',
    isOnline: true,
    status: 'available',
    currentConversations: 1,
    maxConversations: 5,
    lastActivity: new Date().toISOString(),
    sessionId: 'session_789',
  },
];

const getStatusConfig = (status: string, isOnline: boolean) => {
  if (!isOnline) {
    return {
      icon: OfflineIcon,
      color: '#9e9e9e',
      label: 'Desconectado',
      bgColor: '#f5f5f5',
    };
  }

  switch (status) {
    case 'available':
      return {
        icon: OnlineIcon,
        color: '#4caf50',
        label: 'Disponible',
        bgColor: '#e8f5e8',
      };
    case 'busy':
      return {
        icon: BusyIcon,
        color: '#ff9800',
        label: 'Ocupado',
        bgColor: '#fff3e0',
      };
    case 'away':
      return {
        icon: AwayIcon,
        color: '#2196f3',
        label: 'Ausente',
        bgColor: '#e3f2fd',
      };
    default:
      return {
        icon: OfflineIcon,
        color: '#9e9e9e',
        label: 'Desconocido',
        bgColor: '#f5f5f5',
      };
  }
};

export const AgentAssignment: React.FC<AgentAssignmentProps> = ({
  open,
  onClose,
  currentAgentId,
  onAgentAssigned,
}) => {
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    currentAgentId || ''
  );

  useEffect(() => {
    // Simular actualización de estado de agentes
    const interval = setInterval(() => {
      setAgents((prevAgents) =>
        prevAgents.map((agent) => ({
          ...agent,
          lastActivity: agent.isOnline
            ? new Date().toISOString()
            : agent.lastActivity,
        }))
      );
    }, 30000); // Actualizar cada 30 segundos

    return () => clearInterval(interval);
  }, []);

  const availableAgents = agents.filter(
    (agent) =>
      agent.isOnline &&
      agent.status === 'available' &&
      agent.currentConversations < agent.maxConversations
  );

  const handleAutoAssign = () => {
    if (availableAgents.length === 0) {
      return null;
    }

    // Algoritmo de asignación: agente con menos conversaciones activas
    const bestAgent = availableAgents.reduce((prev, current) =>
      prev.currentConversations <= current.currentConversations ? prev : current
    );

    return bestAgent;
  };

  const handleAssignAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      setSelectedAgentId(agentId);
      onAgentAssigned?.(agentId, agent.name);

      // Actualizar contador de conversaciones del agente
      setAgents((prevAgents) =>
        prevAgents.map((a) =>
          a.id === agentId
            ? { ...a, currentConversations: a.currentConversations + 1 }
            : a
        )
      );
    }
  };

  const handleAutoAssignClick = () => {
    const bestAgent = handleAutoAssign();
    if (bestAgent) {
      handleAssignAgent(bestAgent.id);
    }
  };

  const formatLastActivity = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} días`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <PersonAddIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Asignar Agente</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Asignación automática */}
        <Box mb={3}>
          <Alert
            severity={availableAgents.length > 0 ? 'info' : 'warning'}
            action={
              availableAgents.length > 0 && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleAutoAssignClick}
                  startIcon={<AssignIcon />}
                >
                  Asignar Automáticamente
                </Button>
              )
            }
          >
            {availableAgents.length > 0
              ? `${availableAgents.length} agente(s) disponible(s) para asignación automática`
              : 'No hay agentes disponibles en este momento'}
          </Alert>
        </Box>

        {/* Agente actual */}
        {currentAgentId && (
          <Box mb={3}>
            <Typography variant="subtitle1" gutterBottom>
              Agente Actual
            </Typography>
            <Box
              p={2}
              bgcolor="background.paper"
              border={1}
              borderColor="divider"
              borderRadius={1}
            >
              {(() => {
                const currentAgent = agents.find(
                  (a) => a.id === currentAgentId
                );
                if (!currentAgent)
                  return <Typography>Agente no encontrado</Typography>;

                const statusConfig = getStatusConfig(
                  currentAgent.status,
                  currentAgent.isOnline
                );
                const StatusIcon = statusConfig.icon;

                return (
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar>
                      <PersonIcon />
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="body1" fontWeight="bold">
                        {currentAgent.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {currentAgent.email}
                      </Typography>
                    </Box>
                    <Chip
                      icon={<StatusIcon />}
                      label={statusConfig.label}
                      size="small"
                      style={{
                        backgroundColor: statusConfig.bgColor,
                        color: statusConfig.color,
                      }}
                    />
                  </Box>
                );
              })()}
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Lista de agentes */}
        <Typography variant="subtitle1" gutterBottom>
          Agentes Disponibles
        </Typography>

        <List>
          {agents.map((agent) => {
            const statusConfig = getStatusConfig(agent.status, agent.isOnline);
            const StatusIcon = statusConfig.icon;
            const isSelected = selectedAgentId === agent.id;
            const canAssign =
              agent.isOnline &&
              agent.currentConversations < agent.maxConversations;

            return (
              <ListItem
                key={agent.id}
                sx={{
                  border: 1,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: isSelected
                    ? 'primary.50'
                    : 'background.paper',
                  opacity: !canAssign ? 0.6 : 1,
                }}
              >
                <ListItemIcon>
                  <Avatar>
                    <PersonIcon />
                  </Avatar>
                </ListItemIcon>

                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body1" fontWeight="bold">
                        {agent.name}
                      </Typography>
                      <Chip
                        label={
                          agent.role === 'supervisor' ? 'Supervisor' : 'Agente'
                        }
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        {agent.email}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                        <Typography variant="caption">
                          Conversaciones: {agent.currentConversations}/
                          {agent.maxConversations}
                        </Typography>
                        <Typography variant="caption">
                          Última actividad:{' '}
                          {formatLastActivity(agent.lastActivity || '')}
                        </Typography>
                      </Box>
                    </Box>
                  }
                />

                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    icon={<StatusIcon />}
                    label={statusConfig.label}
                    size="small"
                    style={{
                      backgroundColor: statusConfig.bgColor,
                      color: statusConfig.color,
                    }}
                  />

                  {canAssign && (
                    <Button
                      variant={isSelected ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => handleAssignAgent(agent.id)}
                      startIcon={<AssignIcon />}
                    >
                      {isSelected ? 'Asignado' : 'Asignar'}
                    </Button>
                  )}
                </Box>
              </ListItem>
            );
          })}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={onClose}
          variant="contained"
          disabled={!selectedAgentId}
        >
          Confirmar Asignación
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AgentAssignment;
