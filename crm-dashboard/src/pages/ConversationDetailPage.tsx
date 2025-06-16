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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  ChatBubble as TemplateIcon,
  ChatBubble as ChatBubbleIcon,
  Done as DoneIcon,
  Label as LabelIcon,
  Star as PriorityIcon,
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

// Etiquetas disponibles para conversaciones
const conversationTags = [
  { id: 'urgente', label: 'Urgente', color: '#f44336', icon: '🚨' },
  { id: 'tecnico', label: 'Técnico', color: '#2196f3', icon: '🔧' },
  { id: 'facturacion', label: 'Facturación', color: '#ff9800', icon: '💰' },
  { id: 'comercial', label: 'Comercial', color: '#4caf50', icon: '💼' },
  { id: 'soporte', label: 'Soporte', color: '#9c27b0', icon: '🎧' },
  { id: 'reclamo', label: 'Reclamo', color: '#f44336', icon: '⚠️' },
  { id: 'consulta', label: 'Consulta', color: '#607d8b', icon: '❓' },
  { id: 'vip', label: 'VIP', color: '#ffc107', icon: '⭐' },
];

// Tipos de mensajes mejorados
const getMessageType = (message: any) => {
  // Priorizar el campo 'sender' si existe
  if (message.sender) {
    if (message.sender === 'agent' || message.sender === 'user') return 'agent';
    if (message.sender === 'customer' || message.sender === 'client')
      return 'customer';
    if (message.sender === 'bot' || message.sender === 'system') return 'bot';
  }

  // Usar direction como fallback
  if (message.direction === 'outbound') return 'agent';
  if (message.direction === 'inbound') return 'customer';

  // Detectar por contenido si es un mensaje automático/bot
  const botKeywords = ['menu', 'opciones', 'sistema', 'automático', 'bot'];
  const content = (message.content || '').toLowerCase();
  if (botKeywords.some((keyword) => content.includes(keyword))) {
    return 'bot';
  }

  // Por defecto, asumir que es del cliente
  return 'customer';
};

const getMessageTypeInfo = (type: string) => {
  switch (type) {
    case 'agent':
      return {
        icon: '🧑‍💼',
        label: 'Agente',
        color: '#128c7e',
        bgColor: '#dcf8c6',
      };
    case 'bot':
      return { icon: '🤖', label: 'Bot', color: '#1976d2', bgColor: '#e3f2fd' };
    case 'customer':
    default:
      return {
        icon: '👤',
        label: 'Cliente',
        color: '#075e54',
        bgColor: '#ffffff',
      };
  }
};

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(
    null
  );
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
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: { xs: 2, md: 3 }, borderBottom: '1px solid #e0e0e0' }}>
        <Typography
          variant="h4"
          gutterBottom
          fontWeight="bold"
          sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}
        >
          💬 Conversación
        </Typography>
      </Box>

      {/* Layout responsivo */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: { xs: 2, md: 3 },
          p: { xs: 2, md: 3 },
          overflow: 'hidden',
        }}
      >
        {/* Panel de información del cliente - Responsive */}
        <Box
          sx={{
            width: { xs: '100%', lg: '350px' },
            minWidth: { lg: '350px' },
            maxHeight: { xs: '300px', lg: '100%' },
            overflowY: 'auto',
          }}
        >
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              height: 'fit-content',
            }}
          >
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Avatar
                  sx={{
                    mr: 2,
                    width: { xs: 48, md: 64 },
                    height: { xs: 48, md: 64 },
                    backgroundColor: '#075e54',
                    fontSize: { xs: '1.2rem', md: '1.5rem' },
                  }}
                >
                  <PersonIcon sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }} />
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 'bold',
                      color: '#075e54',
                      fontSize: { xs: '1.1rem', md: '1.25rem' },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {conversation?.customerName || 'Cliente'}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: { xs: '0.8rem', md: '0.875rem' },
                    }}
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
          </Card>{' '}
        </Box>

        {/* Panel de Chat - Responsivo */}
        <Box
          sx={{
            flex: 1,
            minWidth: { xs: '100%', lg: '400px' },
            height: { xs: 'calc(100vh - 400px)', lg: '100%' },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            {/* Header del chat */}
            <Box
              sx={{
                p: { xs: 1.5, md: 2 },
                bgcolor: '#128c7e',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <ChatBubbleIcon />
              <Typography
                variant="h6"
                sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}
              >
                Chat en Vivo
              </Typography>
              {conversation?.status === 'active' && (
                <Chip
                  label="En línea"
                  size="small"
                  sx={{
                    backgroundColor: '#dcf8c6',
                    color: '#075e54',
                    ml: 'auto',
                    fontSize: { xs: '0.7rem', md: '0.75rem' },
                  }}
                />
              )}
            </Box>
            {/* Área de mensajes */}
            <Box
              sx={{
                flexGrow: 1,
                overflow: 'auto',
                p: { xs: 1, md: 2 },
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
                  {' '}
                  {messages.map((message: any, index: number) => {
                    // Usar la nueva lógica mejorada para detectar tipos de mensaje
                    const messageType = getMessageType(message);
                    const typeInfo = getMessageTypeInfo(messageType);
                    const isFromCustomer = messageType === 'customer';
                    const isFromAgent = messageType === 'agent';
                    const isFromBot = messageType === 'bot';

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
                            maxWidth: { xs: '85%', sm: '75%', md: '70%' },
                            minWidth: '100px',
                            borderRadius: 2,
                            p: 1.5,
                            backgroundColor: typeInfo.bgColor,
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
                              [isFromCustomer
                                ? 'borderRight'
                                : 'borderLeft']: `8px solid ${typeInfo.bgColor}`,
                            },
                          }}
                        >
                          {/* Etiqueta del remitente mejorada */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              mb: 0.5,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 'bold',
                                color: typeInfo.color,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              {typeInfo.icon} {typeInfo.label}
                            </Typography>
                            {isFromBot && (
                              <Chip
                                label="AUTO"
                                size="small"
                                sx={{
                                  ml: 1,
                                  height: 16,
                                  fontSize: '0.6rem',
                                  backgroundColor: '#e3f2fd',
                                  color: '#1976d2',
                                }}
                              />
                            )}
                          </Box>

                          {/* Contenido del mensaje */}
                          <Typography
                            variant="body1"
                            sx={{
                              color: '#303030',
                              mb: 0.5,
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              fontSize: { xs: '0.9rem', sm: '1rem' },
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
            </Box>{' '}
            {/* Botones de acción mejorados */}
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: '#f8f9fa',
              }}
            >
              <Box
                display="flex"
                gap={1}
                flexWrap="wrap"
                alignItems="center"
                sx={{ mb: 2 }}
              >
                {/* Botón de plantillas */}
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
                  {showTemplates ? 'Ocultar' : 'Plantillas'}
                </Button>

                {/* Botón de etiquetas */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LabelIcon />}
                  onClick={() => setShowTagDialog(true)}
                  sx={{
                    '&:hover': {
                      backgroundColor: '#e8f5e8',
                    },
                  }}
                >
                  Etiquetas
                </Button>

                {/* Botón de prioridad */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PriorityIcon />}
                  onClick={(event) => setActionMenuAnchor(event.currentTarget)}
                  sx={{
                    '&:hover': {
                      backgroundColor: '#fff3e0',
                    },
                  }}
                >
                  Prioridad
                </Button>

                {/* Botón finalizar chat */}
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
                    : 'Finalizar'}
                </Button>
              </Box>
              {/* Segunda fila: Estado y etiquetas actuales */}
              <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
                {/* Estado de la conversación */}
                {conversation?.status === 'active' && (
                  <Chip
                    icon={<DoneIcon />}
                    label="🟢 Activa"
                    color="success"
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                )}

                {conversation?.status === 'closed' && (
                  <Chip
                    icon={<CloseIcon />}
                    label="🔴 Cerrada"
                    color="default"
                    size="small"
                  />
                )}

                {/* Etiquetas seleccionadas */}
                {selectedTags.map((tagId) => {
                  const tag = conversationTags.find((t) => t.id === tagId);
                  return tag ? (
                    <Chip
                      key={tagId}
                      label={`${tag.icon} ${tag.label}`}
                      size="small"
                      sx={{
                        backgroundColor: tag.color + '20',
                        color: tag.color,
                        fontWeight: 'bold',
                      }}
                      onDelete={() => {
                        setSelectedTags((prev) =>
                          prev.filter((id) => id !== tagId)
                        );
                      }}
                    />
                  ) : null;
                })}

                {/* Indicador de prioridad */}
                {priority !== 'medium' && (
                  <Chip
                    label={priority === 'high' ? '🔴 Alta' : '🟡 Baja'}
                    size="small"
                    sx={{
                      backgroundColor:
                        priority === 'high' ? '#ffebee' : '#fff8e1',
                      color: priority === 'high' ? '#d32f2f' : '#f57c00',
                      fontWeight: 'bold',
                    }}
                  />
                )}
              </Box>
              {/* Menu de prioridad */}
              <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={() => setActionMenuAnchor(null)}
              >
                <MenuItem
                  onClick={() => {
                    setPriority('low');
                    setActionMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <PriorityIcon sx={{ color: '#f57c00' }} />
                  </ListItemIcon>
                  <ListItemText>Prioridad Baja</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setPriority('medium');
                    setActionMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <PriorityIcon sx={{ color: '#666' }} />
                  </ListItemIcon>
                  <ListItemText>Prioridad Media</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setPriority('high');
                    setActionMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <PriorityIcon sx={{ color: '#d32f2f' }} />
                  </ListItemIcon>
                  <ListItemText>Prioridad Alta</ListItemText>
                </MenuItem>
              </Menu>
              {/* Dialog de etiquetas */}
              <Dialog
                open={showTagDialog}
                onClose={() => setShowTagDialog(false)}
                maxWidth="sm"
                fullWidth
              >
                <DialogTitle>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LabelIcon />
                    Gestionar Etiquetas
                  </Box>
                </DialogTitle>
                <DialogContent>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Selecciona las etiquetas que mejor describan esta
                    conversación:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {conversationTags.map((tag) => (
                      <Chip
                        key={tag.id}
                        label={`${tag.icon} ${tag.label}`}
                        clickable
                        variant={
                          selectedTags.includes(tag.id) ? 'filled' : 'outlined'
                        }
                        onClick={() => {
                          setSelectedTags((prev) =>
                            prev.includes(tag.id)
                              ? prev.filter((id) => id !== tag.id)
                              : [...prev, tag.id]
                          );
                        }}
                        sx={{
                          backgroundColor: selectedTags.includes(tag.id)
                            ? tag.color + '20'
                            : 'transparent',
                          color: selectedTags.includes(tag.id)
                            ? tag.color
                            : 'inherit',
                          borderColor: tag.color,
                          fontWeight: selectedTags.includes(tag.id)
                            ? 'bold'
                            : 'normal',
                          '&:hover': {
                            backgroundColor: tag.color + '10',
                          },
                        }}
                      />
                    ))}
                  </Box>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setShowTagDialog(false)}>
                    Cerrar
                  </Button>
                </DialogActions>
              </Dialog>
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
              )}{' '}
            </Box>
            {/* Input para nuevo mensaje - Mejorado y responsivo */}
            <Paper
              elevation={3}
              sx={{
                p: { xs: 1, md: 2 },
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
