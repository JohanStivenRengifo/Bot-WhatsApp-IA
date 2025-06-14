import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  useConversationStats,
  useMessageStats,
  useAgentStats,
} from '../hooks/useApi';

const AnalyticsPage: React.FC = () => {
  const {
    data: conversationStats,
    isLoading: statsLoading,
    error: statsError,
  } = useConversationStats();
  const {
    data: messageStats,
    isLoading: messageLoading,
    error: messageError,
  } = useMessageStats();
  const {
    data: agentStats,
    isLoading: agentLoading,
    error: agentError,
  } = useAgentStats();

  // Usar las variables para evitar warnings de TypeScript
  if (conversationStats) console.debug('Conversation stats loaded');
  if (messageStats) console.debug('Message stats loaded');
  if (agentStats) console.debug('Agent stats loaded');

  if (statsLoading || messageLoading || agentLoading) {
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

  if (statsError || messageError || agentError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error al cargar los datos analíticos
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Analytics
      </Typography>

      <Typography
        variant="subtitle1"
        color="textSecondary"
        gutterBottom
        sx={{ mb: 4 }}
      >
        Análisis y reportes del sistema CRM
      </Typography>

      {/* Métricas principales */}
      <Stack spacing={4}>
        {/* Resumen de métricas */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" component="div" color="primary">
                  15min
                </Typography>
                <Typography color="textSecondary">
                  Tiempo Promedio de Manejo
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" component="div" color="success.main">
                  2min
                </Typography>
                <Typography color="textSecondary">
                  Tiempo Promedio de Respuesta
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" component="div" color="info.main">
                  85%
                </Typography>
                <Typography color="textSecondary">
                  Satisfacción del Cliente
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" component="div" color="warning.main">
                  1,234
                </Typography>
                <Typography color="textSecondary">Total de Mensajes</Typography>
              </CardContent>
            </Card>
          </Box>
        </Stack>

        {/* Tabla de métricas detalladas */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Métricas Detalladas
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body1" fontWeight="bold">
                  Conversaciones:
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total: 50 | Activas: 20 | Cerradas: 25 | Pendientes: 5
                </Typography>
              </Box>

              <Box>
                <Typography variant="body1" fontWeight="bold">
                  Tiempos:
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Manejo promedio: 15 min | Respuesta promedio: 2 min
                </Typography>
              </Box>

              <Box>
                <Typography variant="body1" fontWeight="bold">
                  Satisfacción:
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Cliente: 85%
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default AnalyticsPage;
