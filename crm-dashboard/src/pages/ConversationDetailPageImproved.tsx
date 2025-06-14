import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Phone,
  User,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Zap,
  MoreVertical,
  PhoneCall,
  Video,
  Star,
  Archive,
} from 'lucide-react';
import {
  useConversation,
  useConversationMessages,
  useSendMessage,
  useEndConversation,
} from '../hooks/useApi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Plantillas de respuesta rápida con mejor diseño
const messageTemplates = [
  {
    id: 'greeting',
    title: 'Saludo Inicial',
    content: '¡Hola! Soy un agente de soporte. ¿En qué puedo ayudarte hoy?',
    icon: '👋',
    color: 'bg-blue-500',
  },
  {
    id: 'checking',
    title: 'Revisando Info',
    content: 'Permíteme revisar tu información y te ayudo en un momento.',
    icon: '🔍',
    color: 'bg-yellow-500',
  },
  {
    id: 'solved',
    title: 'Problema Resuelto',
    content:
      '¡Perfecto! Tu problema ha sido resuelto. ¿Hay algo más en lo que pueda ayudarte?',
    icon: '✅',
    color: 'bg-green-500',
  },
  {
    id: 'technical',
    title: 'Soporte Técnico',
    content: 'Voy a transferirte con nuestro equipo técnico especializado.',
    icon: '🔧',
    color: 'bg-purple-500',
  },
  {
    id: 'callback',
    title: 'Te Contactamos',
    content:
      'Te estaremos contactando en las próximas horas para dar seguimiento.',
    icon: '📞',
    color: 'bg-orange-500',
  },
  {
    id: 'thanks',
    title: 'Agradecimiento',
    content: 'Gracias por contactarnos. Que tengas un excelente día.',
    icon: '🙏',
    color: 'bg-pink-500',
  },
];

const ConversationDetailPageImproved: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const { data: conversationResponse, isLoading: conversationLoading } =
    useConversation(id!);
  const { data: messagesResponse, isLoading: messagesLoading } =
    useConversationMessages(id!);
  const sendMessageMutation = useSendMessage();
  const endConversationMutation = useEndConversation();

  const conversation =
    conversationResponse?.data?.conversation || conversationResponse?.data;
  const messages = messagesResponse?.data?.messages || [];

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

    const confirmEnd = window.confirm(
      '¿Estás seguro de que deseas finalizar esta conversación?'
    );
    if (!confirmEnd) return;

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: id,
        message:
          'Gracias por contactarnos. Esta conversación ha sido finalizada. Si necesitas más ayuda, puedes escribir "menu" para activar el bot automático.',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await endConversationMutation.mutateAsync({
        conversationId: id,
        reason: 'agent_ended_conversation',
      });

      navigate('/conversations');
    } catch (error) {
      console.error('Error finalizando conversación:', error);
      alert('Error al finalizar la conversación');
    }
  };

  if (conversationLoading || messagesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 font-medium">Cargando conversación...</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'closed':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/conversations')}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    {conversation?.customerName || 'Cliente'}
                  </h1>
                  <p className="text-sm text-gray-500 flex items-center space-x-1">
                    <Phone className="h-3 w-3" />
                    <span>{conversation?.phoneNumber || 'N/A'}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                  conversation?.status || 'unknown'
                )}`}
              >
                {getStatusIcon(conversation?.status || 'unknown')}
                <span className="ml-1 capitalize">
                  {conversation?.status || 'Desconocido'}
                </span>
              </span>

              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <MoreVertical className="h-5 w-5 text-gray-600" />
                </button>

                {showActions && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2">
                      <PhoneCall className="h-4 w-4" />
                      <span>Llamar Cliente</span>
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2">
                      <Video className="h-4 w-4" />
                      <span>Videollamada</span>
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2">
                      <Star className="h-4 w-4" />
                      <span>Marcar Importante</span>
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2">
                      <Archive className="h-4 w-4" />
                      <span>Archivar</span>
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                    <button
                      onClick={handleEndConversation}
                      disabled={endConversationMutation.isPending}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>
                        {endConversationMutation.isPending
                          ? 'Finalizando...'
                          : 'Finalizar Chat'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Información del cliente */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Información del Cliente
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {conversation?.customerName || 'Cliente'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {conversation?.phoneNumber || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Estado
                        </dt>
                        <dd className="mt-1">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(
                              conversation?.status || 'unknown'
                            )}`}
                          >
                            {getStatusIcon(conversation?.status || 'unknown')}
                            <span className="ml-1 capitalize">
                              {conversation?.status || 'Desconocido'}
                            </span>
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Agente Asignado
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {conversation?.assignedAgentName || 'Sin asignar'}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Creada el
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {conversation?.createdAt
                            ? format(
                                new Date(conversation.createdAt),
                                'dd/MM/yyyy HH:mm',
                                { locale: es }
                              )
                            : 'N/A'}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Total de Mensajes
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {messages.length} mensajes
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
              {/* Plantillas de respuesta rápida */}
              {showTemplates && (
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900">
                      Plantillas de Respuesta Rápida
                    </h4>
                    <button
                      onClick={() => setShowTemplates(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {messageTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleUseTemplate(template)}
                        className="p-3 text-left bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-lg">{template.icon}</span>
                          <span className="text-xs font-medium text-gray-900">
                            {template.title}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {template.content}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare className="h-12 w-12 text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">
                      No hay mensajes en esta conversación
                    </p>
                    <p className="text-gray-400 text-sm">
                      Los mensajes aparecerán aquí cuando lleguen
                    </p>
                  </div>
                ) : (
                  messages.map((message: any, index: number) => (
                    <div
                      key={message.id || index}
                      className={`flex ${
                        message.direction === 'inbound'
                          ? 'justify-start'
                          : 'justify-end'
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          message.direction === 'inbound'
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        <p className="text-sm">
                          {message.content || 'Mensaje sin contenido'}
                        </p>
                        <div className="flex items-center justify-between mt-1 space-x-2">
                          <span
                            className={`text-xs ${
                              message.direction === 'inbound'
                                ? 'text-gray-500'
                                : 'text-blue-100'
                            }`}
                          >
                            {message.timestamp
                              ? format(new Date(message.timestamp), 'HH:mm', {
                                  locale: es,
                                })
                              : 'N/A'}
                          </span>
                          {message.direction === 'outbound' && (
                            <span
                              className={`text-xs ${
                                message.status === 'delivered'
                                  ? 'text-blue-100'
                                  : 'text-blue-200'
                              }`}
                            >
                              {message.status === 'delivered' ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input para nuevo mensaje */}
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className={`p-2 rounded-lg transition-colors ${
                      showTemplates
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    <Zap className="h-5 w-5" />
                  </button>

                  <div className="flex-1 relative">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Escribe un mensaje..."
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={1}
                      disabled={
                        endConversationMutation.isPending ||
                        conversation?.status === 'closed'
                      }
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {newMessage.length > 0 && `${newMessage.length}/1000`}
                    </div>
                  </div>

                  <button
                    onClick={handleSendMessage}
                    disabled={
                      !newMessage.trim() ||
                      sendMessageMutation.isPending ||
                      endConversationMutation.isPending ||
                      conversation?.status === 'closed'
                    }
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sendMessageMutation.isPending ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {conversation?.status === 'closed' && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800 flex items-center">
                      <XCircle className="h-3 w-3 mr-1" />
                      Esta conversación ha sido cerrada
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationDetailPageImproved;
