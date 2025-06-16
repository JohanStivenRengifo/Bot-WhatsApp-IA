import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAgents } from '../hooks/useApi';

const AgentsPage: React.FC = () => {
  const { data: agentsResponse, isLoading, error } = useAgents();

  const agents = agentsResponse?.data || [];

  const getStatusColor = (isOnline: boolean) => {
    return isOnline ? 'success' : 'default';
  };

  const getStatusLabel = (isOnline: boolean) => {
    return isOnline ? 'Online' : 'Offline';
  };

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="200px"
      >
        <Typography>Cargando agentes...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="200px"
      >
        <Typography color="error">Error al cargar agentes</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" fontWeight="bold">
          Gestión de Agentes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            // TODO: Implementar modal para agregar agente
            console.log('Agregar nuevo agente');
          }}
        >
          Nuevo Agente
        </Button>
      </Box>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Agente</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Conversaciones Activas</TableCell>
                  <TableCell>Total Conversaciones</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {agents.map((agent: any) => (
                  <TableRow key={agent.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ mr: 2 }}>
                          <PersonIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {agent.username || agent.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {agent.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {agent.email || 'N/A'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={agent.role || 'agent'}
                        size="small"
                        variant="outlined"
                        color={agent.role === 'admin' ? 'primary' : 'default'}
                      />
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={getStatusLabel(agent.isOnline || false)}
                        color={getStatusColor(agent.isOnline || false) as any}
                        size="small"
                      />
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {agent.activeConversations || 0}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {agent.totalConversations || 0}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Tooltip title="Editar agente">
                        <IconButton
                          size="small"
                          onClick={() => {
                            // TODO: Implementar modal para editar agente
                            console.log('Editar agente:', agent.id);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar agente">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            // TODO: Implementar confirmación para eliminar agente
                            console.log('Eliminar agente:', agent.id);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {agents.length === 0 && (
            <Box textAlign="center" p={4}>
              <Typography variant="body2" color="text.secondary">
                No hay agentes registrados
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ mt: 2 }}
                onClick={() => {
                  console.log('Agregar primer agente');
                }}
              >
                Agregar Primer Agente
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AgentsPage;
