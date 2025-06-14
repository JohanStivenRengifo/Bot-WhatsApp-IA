import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Chat as ChatIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  useRealTimeMetrics,
  useConversationStats,
  useAgentStats,
} from '../hooks/useApi';
import { getMetrics, getConversationStats, getAgentStats } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  color = 'primary',
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {value}
          </Typography>
        </Box>
        <Box sx={{ color: `${color}.main` }}>{icon}</Box>
      </Box>
    </CardContent>
  </Card>
);

const DashboardHome: React.FC = () => {
  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useRealTimeMetrics();
  const {
    data: conversationStats,
    isLoading: statsLoading,
    error: statsError,
  } = useConversationStats();
  const {
    data: agentStats,
    isLoading: agentLoading,
    error: agentError,
  } = useAgentStats();

  // Usar los helpers para acceder a los datos de forma segura
  const metricsData = getMetrics(metrics);
  const conversationData = getConversationStats(conversationStats);
  const agentData = getAgentStats(agentStats);

  if (metricsLoading || statsLoading || agentLoading) {
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

  if (metricsError || statsError || agentError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error al cargar los datos del dashboard
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard CRM
      </Typography>

      <Typography variant="subtitle1" color="textSecondary" gutterBottom>
        {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
      </Typography>

      {/* Métricas principales */}
      <Box sx={{ mb: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <Box sx={{ flex: 1 }}>
            <MetricCard
              title="Conversaciones Activas"
              value={metricsData?.activeConversations || 0}
              icon={<ChatIcon fontSize="large" />}
              color="primary"
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <MetricCard
              title="Mensajes Pendientes"
              value={metricsData?.pendingMessages || 0}
              icon={<ScheduleIcon fontSize="large" />}
              color="warning"
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <MetricCard
              title="Agentes Online"
              value={metricsData?.onlineAgents || 0}
              icon={<PeopleIcon fontSize="large" />}
              color="success"
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <MetricCard
              title="Mensajes Hoy"
              value={metricsData?.todayMessages || 0}
              icon={<TrendingUpIcon fontSize="large" />}
              color="secondary"
            />
          </Box>
        </Stack>
      </Box>

      {/* Estadísticas de conversaciones */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ mb: 4 }}>
        <Box sx={{ flex: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Estadísticas de Conversaciones
              </Typography>

              <Stack spacing={3}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Conversaciones Activas
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={
                      ((conversationData?.activeConversations || 0) /
                        (conversationData?.totalConversations || 1)) *
                      100
                    }
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption">
                    {conversationData?.activeConversations || 0} de{' '}
                    {conversationData?.totalConversations || 0}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Conversaciones Cerradas
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={
                      ((conversationData?.closedConversations || 0) /
                        (conversationData?.totalConversations || 1)) *
                      100
                    }
                    color="success"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption">
                    {conversationData?.closedConversations || 0} de{' '}
                    {conversationData?.totalConversations || 0}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Conversaciones Pendientes
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={
                      (((conversationData?.totalConversations || 0) -
                        (conversationData?.activeConversations || 0) -
                        (conversationData?.closedConversations || 0)) /
                        (conversationData?.totalConversations || 1)) *
                      100
                    }
                    color="warning"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption">
                    {(conversationData?.totalConversations || 0) -
                      (conversationData?.activeConversations || 0) -
                      (conversationData?.closedConversations || 0)}{' '}
                    de {conversationData?.totalConversations || 0}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={4} sx={{ mt: 3 }}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Tiempo Promedio de Manejo
                  </Typography>
                  <Typography variant="h6">
                    {conversationData?.averageHandlingTime || 0} min
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Satisfacción del Cliente
                  </Typography>
                  <Typography variant="h6">
                    {conversationData?.customerSatisfaction || 0}%
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Agentes
              </Typography>
              <List>
                {(agentData || [])
                  .slice(0, 5)
                  .map((agent: any, index: number) => (
                    <ListItem key={agent?.agentId || index} sx={{ px: 0 }}>
                      <ListItemIcon>
                        <Avatar>
                          <PersonIcon />
                        </Avatar>
                      </ListItemIcon>{' '}
                      <ListItemText
                        primary={agent?.agentName || 'Agente'}
                        secondary={
                          <Box
                            component="span"
                            sx={{
                              display: 'flex',
                              flexDirection: 'row',
                              gap: 1,
                              alignItems: 'center',
                            }}
                          >
                            <Chip
                              label={agent?.isOnline ? 'Online' : 'Offline'}
                              color={agent?.isOnline ? 'success' : 'default'}
                              size="small"
                            />
                            <Typography variant="caption" component="span">
                              {agent?.activeConversations || 0} conversaciones
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      </Stack>

      {/* Métricas adicionales */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Métricas Adicionales
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
            <Box sx={{ flex: 1 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" component="div" color="primary">
                    {metricsData?.averageResponseTime || 0}min
                  </Typography>
                  <Typography color="textSecondary">
                    Tiempo Promedio de Respuesta
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" component="div" color="success.main">
                    {(
                      ((conversationData?.closedConversations || 0) /
                        (conversationData?.totalConversations || 1)) *
                      100
                    ).toFixed(1)}
                    %
                  </Typography>
                  <Typography color="textSecondary">
                    Tasa de Resolución
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" component="div" color="info.main">
                    {(agentData || []).filter((agent: any) => agent?.isOnline)
                      .length || 0}
                  </Typography>
                  <Typography color="textSecondary">
                    Agentes Disponibles
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" component="div" color="warning.main">
                    {conversationData?.customerSatisfaction || 0}%
                  </Typography>
                  <Typography color="textSecondary">
                    Satisfacción General
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DashboardHome;
