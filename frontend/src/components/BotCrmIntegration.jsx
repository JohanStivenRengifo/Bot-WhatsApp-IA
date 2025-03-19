import React, { useState } from 'react';
import axios from 'axios';

function BotCrmIntegration({ customer }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [botResponse, setBotResponse] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);

  const startConversation = async () => {
    try {
      setSending(true);
      const response = await axios.post('/api/crm/start-conversation', {
        customer_id: customer.id,
        phone_number: customer.phone_number
      });
      
      setConversationStarted(true);
      setSending(false);
      return response.data.conversation_id;
    } catch (error) {
      console.error('Error starting conversation:', error);
      setSending(false);
      alert('Error al iniciar la conversación con el cliente');
      return null;
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      setSending(true);
      
      let conversationId;
      if (!conversationStarted) {
        conversationId = await startConversation();
        if (!conversationId) return;
      }

      const response = await axios.post('/api/crm/send-message', {
        customer_id: customer.id,
        conversation_id: conversationId,
        message: message,
        source: 'crm'
      });

      setBotResponse(response.data);
      setShowResponseModal(true);
      setMessage('');
      setSending(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setSending(false);
      alert('Error al enviar el mensaje');
    }
  };

  const closeResponseModal = () => {
    setShowResponseModal(false);
    setBotResponse(null);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        <i className="fas fa-robot text-blue-500 mr-2"></i>
        Interacción con Bot
      </h2>
      
      <form onSubmit={sendMessage} className="mb-4">
        <div className="flex">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe un mensaje para enviar al cliente..."
            className="w-full bg-gray-700 text-white rounded-l-lg px-4 py-2 border border-gray-600"
            disabled={sending}
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-lg flex items-center"
            disabled={sending}
          >
            {sending ? (
              <span className="animate-pulse">Enviando...</span>
            ) : (
              <>
                <i className="fas fa-paper-plane mr-2"></i>
                Enviar
              </>
            )}
          </button>
        </div>
      </form>

      <div className="text-sm text-gray-400">
        <p>Puedes iniciar una conversación con el cliente directamente desde aquí.</p>
        <p>El bot utilizará la información del cliente para personalizar las respuestas.</p>
      </div>

      {/* Bot Response Modal */}
      {showResponseModal && botResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Respuesta del Bot</h3>
              <button
                onClick={closeResponseModal}
                className="text-gray-400 hover:text-white"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <p className="text-white">{botResponse.message}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={closeResponseModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BotCrmIntegration;