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
  Avatar,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
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
    id: 'welcome',
    title: 'Bienvenida',
    content:
      '¡Hola! 👋 Soy un agente de soporte de Conecta2 Telecomunicaciones. Te voy a ayudar con tu consulta. ¿En qué puedo asistirte hoy?',
    icon: '👋',
    isWelcome: true,
  },
  {
    id: 'checking',
    title: 'Revisando',
    content:
      'Permíteme revisar tu información en nuestro sistema. Te ayudo en un momento por favor. 🔍',
    icon: '🔍',
  },
  {
    id: 'technical_support',
    title: 'Soporte Técnico',
    content:
      'Entiendo tu situación. Voy a revisar tu conexión y configuración para ayudarte a resolver este problema técnico. 🔧',
    icon: '🔧',
  },
  {
    id: 'billing_inquiry',
    title: 'Consulta de Facturación',
    content:
      'Te ayudo con tu consulta de facturación. Permíteme revisar tu cuenta y el estado de tus pagos. 💰',
    icon: '💰',
  },
  {
    id: 'service_status',
    title: 'Estado del Servicio',
    content:
      'Voy a verificar el estado de tu servicio de internet y revisar si hay alguna incidencia en tu zona. 📡',
    icon: '📡',
  },
  {
    id: 'solved',
    title: 'Problema Resuelto',
    content:
      '¡Perfecto! ✅ Tu problema ha sido resuelto. ¿Hay algo más en lo que pueda ayudarte?',
    icon: '✅',
  },
  {
    id: 'escalation',
    title: 'Escalamiento',
    content:
      'Voy a escallar tu caso a nuestro equipo técnico especializado para una atención más detallada. Te contactarán en las próximas horas. 🚀',
    icon: '🚀',
  },
  {
    id: 'appointment',
    title: 'Agendar Cita',
    content:
      'Te voy a agendar una cita con nuestro técnico para que revise tu servicio en sitio. ¿Cuál es tu disponibilidad? 📅',
    icon: '�',
  },
  {
    id: 'callback',
    title: 'Te Contactamos',
    content:
      'Te estaremos contactando en las próximas 2 horas para dar seguimiento a tu solicitud. Mantén tu teléfono disponible. 📞',
    icon: '📞',
  },
  {
    id: 'thanks',
    title: 'Agradecimiento',
    content:
      'Gracias por contactarnos y por tu confianza en Conecta2 Telecomunicaciones. ¡Que tengas un excelente día! 🙏',
    icon: '🙏',
  },
];

const ConversationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [welcomeSent, setWelcomeSent] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const { data: conversationResponse, isLoading: conversationLoading } =
    useConversation(id!);
  const { data: messagesResponse, isLoading: messagesLoading } =
    useConversationMessages(id!);
  const sendMessageMutation = useSendMessage();
  const endConversationMutation = useEndConversation();

  // Scroll automático al final de los mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messagesResponse]);

  // Envío automático de mensaje de bienvenida cuando el agente abre el chat
  React.useEffect(() => {
    const sendWelcomeMessage = async () => {
      if (
        !welcomeSent &&
        id &&
        conversationResponse?.data &&
        !messagesLoading
      ) {
        const conversation =
          conversationResponse.data.conversation || conversationResponse.data;
        const messages = messagesResponse?.data?.messages || [];

        // Solo enviar bienvenida si la conversación está activa y no hay mensajes del agente
        const hasAgentMessages = messages.some(
          (msg: any) => msg.direction === 'outbound'
        );

        if (conversation?.status === 'active' && !hasAgentMessages) {
          const welcomeTemplate = messageTemplates.find((t) => t.isWelcome);
          if (welcomeTemplate) {
            try {
              await sendMessageMutation.mutateAsync({
                conversationId: id,
                message: welcomeTemplate.content,
              });
              setWelcomeSent(true);
            } catch (error) {
              console.error('Error enviando mensaje de bienvenida:', error);
            }
          }
        }
      }
    };

    sendWelcomeMessage();
  }, [
    id,
    conversationResponse,
    messagesResponse,
    messagesLoading,
    welcomeSent,
    sendMessageMutation,
  ]);
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
        {' '}
        {/* Información del cliente */}
        <Box flex="1" minWidth="300px" maxWidth="400px">
          <Card
            sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Avatar
                  sx={{
                    mr: 2,
                    width: 64,
                    height: 64,
                    backgroundColor: '#075e54',
                    fontSize: '1.5rem',
                  }}
                >
                  <PersonIcon sx={{ fontSize: '2rem' }} />
                </Avatar>
                <Box>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 'bold', color: '#075e54' }}
                  >
                    {conversation?.customerName || 'Cliente'}
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    📱 {conversation?.phoneNumber || 'N/A'}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box mb={3}>
                <Typography
                  variant="subtitle1"
                  gutterBottom
                  sx={{ fontWeight: 'bold', color: '#333' }}
                >
                  📊 Estado de la conversación
                </Typography>
                <Chip
                  label={
                    conversation?.status === 'active'
                      ? '🟢 Activa'
                      : conversation?.status === 'closed'
                      ? '🔴 Cerrada'
                      : '⚪ Pendiente'
                  }
                  color={
                    conversation?.status === 'active'
                      ? 'success'
                      : conversation?.status === 'closed'
                      ? 'default'
                      : 'warning'
                  }
                  size="medium"
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>

              <Box mb={3}>
                <Typography
                  variant="subtitle1"
                  gutterBottom
                  sx={{ fontWeight: 'bold', color: '#333' }}
                >
                  👨‍💼 Agente asignado
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: conversation?.assignedAgentName ? '#075e54' : '#666',
                    fontWeight: conversation?.assignedAgentName
                      ? 'bold'
                      : 'normal',
                  }}
                >
                  {conversation?.assignedAgentName || 'Sin asignar'}
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography
                  variant="subtitle1"
                  gutterBottom
                  sx={{ fontWeight: 'bold', color: '#333' }}
                >
                  📅 Fecha de creación
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {conversation?.createdAt
                    ? format(
                        new Date(conversation.createdAt),
                        'dd/MM/yyyy HH:mm',
                        { locale: es }
                      )
                    : 'N/A'}
                </Typography>
              </Box>

              {/* Información adicional */}
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic' }}
                >
                  💬 Chat ID: {id?.substring(0, 8)}...
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>{' '}
        {/* Chat */}
        <Box flex="2" minWidth="400px">
          <Card
            sx={{
              height: '75vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            {/* Mensajes */}
            <Box
              sx={{
                flexGrow: 1,
                overflow: 'auto',
                p: 2,
                bgcolor: '#f5f5f5',
                backgroundImage:
                  'linear-gradient(45deg, #f5f5f5 25%, transparent 25%), linear-gradient(-45deg, #f5f5f5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f5f5f5 75%), linear-gradient(-45deg, transparent 75%, #f5f5f5 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              }}
            >
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
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {messages.map((message: any, index: number) => {
                    const isFromCustomer = message.direction === 'inbound';
                    const isFromAgent = message.direction === 'outbound';

                    return (
                      <Box
                        key={message.id || index}
                        sx={{
                          display: 'flex',
                          justifyContent: isFromCustomer
                            ? 'flex-start'
                            : 'flex-end',
                          mb: 1,
                        }}
                      >
                        <Box
                          sx={{
                            maxWidth: '70%',
                            minWidth: '100px',
                            borderRadius: 2,
                            p: 1.5,
                            backgroundColor: isFromCustomer
                              ? '#ffffff'
                              : '#dcf8c6',
                            border: isFromCustomer
                              ? '1px solid #e0e0e0'
                              : 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            position: 'relative',
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              [isFromCustomer ? 'left' : 'right']: -8,
                              width: 0,
                              height: 0,
                              borderTop: '8px solid transparent',
                              borderBottom: '8px solid transparent',
                              [isFromCustomer ? 'borderRight' : 'borderLeft']:
                                isFromCustomer
                                  ? '8px solid #ffffff'
                                  : '8px solid #dcf8c6',
                            },
                          }}
                        >
                          {/* Etiqueta del remitente */}
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 'bold',
                              color: isFromCustomer ? '#075e54' : '#128c7e',
                              mb: 0.5,
                              display: 'block',
                            }}
                          >
                            {isFromCustomer ? '👤 Cliente' : '🧑‍💼 Agente'}
                          </Typography>

                          {/* Contenido del mensaje */}
                          <Typography
                            variant="body1"
                            sx={{
                              color: '#303030',
                              mb: 0.5,
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {message.content || 'Mensaje sin contenido'}
                          </Typography>

                          {/* Hora y estado */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 0.5,
                              mt: 0.5,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#666',
                                fontSize: '0.7rem',
                              }}
                            >
                              {message.timestamp
                                ? format(new Date(message.timestamp), 'HH:mm', {
                                    locale: es,
                                  })
                                : 'N/A'}
                            </Typography>

                            {/* Indicador de estado para mensajes del agente */}
                            {isFromAgent && (
                              <Box
                                sx={{ display: 'flex', alignItems: 'center' }}
                              >
                                {message.status === 'delivered' && (
                                  <Box sx={{ color: '#4fc3f7' }}>✓✓</Box>
                                )}
                                {message.status === 'read' && (
                                  <Box sx={{ color: '#2196f3' }}>✓✓</Box>
                                )}
                                {(!message.status ||
                                  message.status === 'sent') && (
                                  <Box sx={{ color: '#666' }}>✓</Box>
                                )}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                  {/* Referencia para scroll automático */}
                  <div ref={messagesEndRef} />
                </Box>
              )}
            </Box>
            {/* Botones de acción */}
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: '#f8f9fa',
              }}
            >
              <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
                <Button
                  variant={showTemplates ? 'contained' : 'outlined'}
                  size="small"
                  startIcon={<TemplateIcon />}
                  onClick={() => setShowTemplates(!showTemplates)}
                  sx={{
                    backgroundColor: showTemplates ? '#128c7e' : 'transparent',
                    '&:hover': {
                      backgroundColor: showTemplates ? '#0d7369' : '#e8f5e8',
                    },
                  }}
                >
                  {showTemplates ? 'Ocultar Plantillas' : 'Mostrar Plantillas'}
                </Button>

                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  startIcon={<CloseIcon />}
                  onClick={handleEndConversation}
                  disabled={endConversationMutation.isPending}
                  sx={{
                    '&:hover': {
                      backgroundColor: '#ffebee',
                    },
                  }}
                >
                  {endConversationMutation.isPending
                    ? 'Finalizando...'
                    : 'Finalizar Chat'}
                </Button>

                {conversation?.status === 'active' && (
                  <Chip
                    icon={<DoneIcon />}
                    label="🟢 Conversación Activa"
                    color="success"
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                )}

                {conversation?.status === 'closed' && (
                  <Chip
                    icon={<CloseIcon />}
                    label="🔴 Conversación Cerrada"
                    color="default"
                    size="small"
                  />
                )}
              </Box>
              {/* Plantillas de respuesta rápida */}
              {showTemplates && (
                <Box
                  sx={{
                    mt: 2,
                    p: 3,
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    border: '1px solid #e0e0e0',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  }}
                >
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ color: '#075e54', fontWeight: 'bold' }}
                  >
                    💬 Plantillas de Respuesta Rápida
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Haz clic en una plantilla para usarla como mensaje
                  </Typography>
                  <Box
                    display="grid"
                    gridTemplateColumns="repeat(auto-fill, minmax(280px, 1fr))"
                    gap={2}
                  >
                    {messageTemplates.map((template) => (
                      <Card
                        key={template.id}
                        sx={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border: '1px solid #e0e0e0',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            transform: 'translateY(-2px)',
                            borderColor: '#128c7e',
                          },
                        }}
                        onClick={() => handleUseTemplate(template)}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            mb={1}
                          >
                            <Typography variant="h6" component="span">
                              {template.icon}
                            </Typography>
                            <Typography
                              variant="subtitle1"
                              fontWeight="bold"
                              color="primary"
                            >
                              {template.title}
                            </Typography>
                            {template.isWelcome && (
                              <Chip
                                label="Bienvenida"
                                size="small"
                                color="success"
                              />
                            )}
                          </Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.4,
                            }}
                          >
                            {template.content}
                          </Typography>
                        </CardContent>
                      </Card>
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
                backgroundColor: '#f0f0f0',
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
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#ffffff',
                      borderRadius: 3,
                      '&:hover': {
                        '& > fieldset': {
                          borderColor: '#128c7e',
                        },
                      },
                      '&.Mui-focused': {
                        '& > fieldset': {
                          borderColor: '#075e54',
                        },
                      },
                    },
                  }}
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
                  sx={{
                    minWidth: 'auto',
                    px: 2,
                    height: 'fit-content',
                    borderRadius: 3,
                    backgroundColor: '#075e54',
                    '&:hover': {
                      backgroundColor: '#128c7e',
                    },
                    '&:disabled': {
                      backgroundColor: '#ccc',
                    },
                  }}
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
                  {conversation?.status === 'active' &&
                    ' • Presiona Enter para enviar'}
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
