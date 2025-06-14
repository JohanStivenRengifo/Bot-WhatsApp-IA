import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Paper,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Close as CloseIcon,
  ChatBubble as TemplateIcon,
  Done as DoneIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import {
  useConversation,
  useConversationMessages,
  useSendMessage,
  useEndConversation,
} from '../hooks/useApi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

// Plantillas de respuesta rápida
const messageTemplates = [
  {
    id: 'greeting',
    title: 'Saludo',
    content: 'Hola, soy un agente de soporte. ¿En qué puedo ayudarte hoy?',
    icon: '👋',
  },
  {
    id: 'checking',
    title: 'Revisando',
    content: 'Permíteme revisar tu información y te ayudo en un momento.',
    icon: '🔍',
  },
  {
    id: 'solved',
    title: 'Problema Resuelto',
    content:
      '¡Perfecto! Tu problema ha sido resuelto. ¿Hay algo más en lo que pueda ayudarte?',
    icon: '✅',
  },
  {
    id: 'technical',
    title: 'Soporte Técnico',
    content:
      'Voy a transferirte con nuestro equipo técnico especializado para una mejor atención.',
    icon: '🔧',
  },
  {
    id: 'callback',
    title: 'Te Contactamos',
    content:
      'Te estaremos contactando en las próximas horas para dar seguimiento a tu solicitud.',
    icon: '📞',
  },
  {
    id: 'thanks',
    title: 'Agradecimiento',
    content: 'Gracias por contactarnos. Que tengas un excelente día.',
    icon: '🙏',
  },
];

const ConversationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: conversationResponse, isLoading: conversationLoading } =
    useConversation(id!);
  const { data: messagesResponse, isLoading: messagesLoading } =
    useConversationMessages(id!);
  const sendMessageMutation = useSendMessage();
  const endConversationMutation = useEndConversation();
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id) return;

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: id,
        message: newMessage.trim(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  const handleUseTemplate = (template: (typeof messageTemplates)[0]) => {
    setNewMessage(template.content);
    setShowTemplates(false);
  };
  const handleEndConversation = async () => {
    if (!id) return;

    try {
      // Enviar mensaje de despedida
      await sendMessageMutation.mutateAsync({
        conversationId: id,
        message:
          'Gracias por contactarnos. Esta conversación ha sido finalizada. Si necesitas más ayuda, puedes escribir "menu" para activar el bot automático.',
      });

      // Esperar un momento para que se envíe el mensaje
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Finalizar la conversación usando el hook
      await endConversationMutation.mutateAsync({
        conversationId: id,
        reason: 'agent_ended_conversation',
      });

      // Redirigir de vuelta a la lista de conversaciones
      navigate('/conversations');
    } catch (error) {
      console.error('Error finalizando conversación:', error);
      alert('Error al finalizar la conversación');
    }
  };

  if (conversationLoading || messagesLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="200px"
      >
        <Typography>Cargando conversación...</Typography>
      </Box>
    );
  }

  const messages = messagesResponse?.data?.messages || [];
  const conversation =
    conversationResponse?.data?.conversation || conversationResponse?.data;
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Conversación
      </Typography>

      <Box display="flex" gap={3} flexWrap="wrap">
        {/* Información del cliente */}
        <Box flex="1" minWidth="300px" maxWidth="400px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ mr: 2, width: 56, height: 56 }}>
                  <PersonIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {conversation?.customerName || 'Cliente'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {conversation?.phoneNumber || 'N/A'}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Estado de la conversación
                </Typography>
                <Chip
                  label={conversation?.status || 'Desconocido'}
                  color={
                    conversation?.status === 'active' ? 'success' : 'default'
                  }
                  size="small"
                />
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Agente asignado
                </Typography>
                <Typography variant="body2">
                  {conversation?.assignedAgentName || 'Sin asignar'}
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Creada el
                </Typography>
                <Typography variant="body2">
                  {conversation?.createdAt
                    ? format(
                        new Date(conversation.createdAt),
                        'dd/MM/yyyy HH:mm',
                        { locale: es }
                      )
                    : 'N/A'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Chat */}
        <Box flex="2" minWidth="400px">
          <Card
            sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Mensajes */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
              {messages.length === 0 ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  height="100%"
                >
                  <Typography variant="body2" color="text.secondary">
                    No hay mensajes en esta conversación
                  </Typography>
                </Box>
              ) : (
                <List>
                  {messages.map((message: any, index: number) => (
                    <ListItem key={message.id || index} alignItems="flex-start">
                      <ListItemAvatar>
                        <Avatar>
                          {message.direction === 'inbound' ? (
                            <PersonIcon />
                          ) : (
                            <PhoneIcon />
                          )}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight="bold">
                              {message.direction === 'inbound'
                                ? 'Cliente'
                                : 'Agente'}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {message.timestamp
                                ? format(new Date(message.timestamp), 'HH:mm', {
                                    locale: es,
                                  })
                                : 'N/A'}
                            </Typography>
                            <Chip
                              label={message.status || 'sent'}
                              size="small"
                              variant="outlined"
                              color={
                                message.status === 'delivered'
                                  ? 'success'
                                  : 'default'
                              }
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="body1" sx={{ mt: 1 }}>
                            {message.content || 'Mensaje sin contenido'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
            {/* Botones de acción */}
            <Box
              sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Box display="flex" gap={1} flexWrap="wrap">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<TemplateIcon />}
                  onClick={() => setShowTemplates(!showTemplates)}
                >
                  Plantillas
                </Button>{' '}
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  startIcon={<CloseIcon />}
                  onClick={handleEndConversation}
                  disabled={endConversationMutation.isPending}
                >
                  {endConversationMutation.isPending
                    ? 'Finalizando...'
                    : 'Finalizar Chat'}
                </Button>
                {conversation?.status === 'active' && (
                  <Chip
                    icon={<DoneIcon />}
                    label="Conversación Activa"
                    color="success"
                    size="small"
                  />
                )}
              </Box>

              {/* Plantillas de respuesta rápida */}
              {showTemplates && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Plantillas de Respuesta Rápida
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {messageTemplates.map((template) => (
                      <Button
                        key={template.id}
                        variant="outlined"
                        size="small"
                        onClick={() => handleUseTemplate(template)}
                        sx={{ mb: 1 }}
                      >
                        {template.icon} {template.title}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>{' '}
            {/* Input para nuevo mensaje */}
            <Paper
              elevation={3}
              sx={{
                p: 2,
                borderRadius: 0,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box display="flex" gap={1} alignItems="flex-end">
                <TextField
                  fullWidth
                  placeholder="Escribe un mensaje..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  multiline
                  maxRows={4}
                  size="small"
                  disabled={
                    endConversationMutation.isPending ||
                    conversation?.status === 'closed'
                  }
                />
                <Button
                  variant="contained"
                  onClick={handleSendMessage}
                  disabled={
                    !newMessage.trim() ||
                    sendMessageMutation.isPending ||
                    endConversationMutation.isPending ||
                    conversation?.status === 'closed'
                  }
                  sx={{ minWidth: 'auto', px: 2, height: 'fit-content' }}
                >
                  {sendMessageMutation.isPending ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <SendIcon />
                  )}
                </Button>
              </Box>

              {/* Indicadores de estado */}
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mt={1}
              >
                <Typography variant="caption" color="text.secondary">
                  {newMessage.length > 0 && `${newMessage.length} caracteres`}
                </Typography>
                <Box display="flex" gap={1}>
                  {conversation?.status === 'closed' && (
                    <Chip
                      icon={<CloseIcon />}
                      label="Conversación Cerrada"
                      color="default"
                      size="small"
                    />
                  )}
                  {sendMessageMutation.isPending && (
                    <Chip
                      icon={<CircularProgress size={12} />}
                      label="Enviando..."
                      color="primary"
                      size="small"
                    />
                  )}
                </Box>
              </Box>
            </Paper>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default ConversationDetailPage;
