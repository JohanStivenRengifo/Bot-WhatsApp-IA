import React, { useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

function TicketDetails({ ticket, onClose, onUpdate }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const addNote = async () => {
    if (!note.trim()) return;
    
    try {
      setLoading(true);
      await axios.put(`/api/tickets/${ticket.id}`, {
        note: note
      });
      setNote('');
      onUpdate();
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      setLoading(true);
      await axios.put(`/api/tickets/${ticket.id}`, {
        status: newStatus
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      open: 'bg-yellow-500',
      in_progress: 'bg-blue-500',
      closed: 'bg-green-500',
      cancelled: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getPriorityBadgeColor = (priority) => {
    const colors = {
      urgent: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-blue-500'
    };
    return colors[priority] || 'bg-gray-500';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-white">Ticket #{ticket.ticket_number}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-white text-sm ${getStatusBadgeColor(ticket.status)}`}>
                {ticket.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full text-white text-sm ${getPriorityBadgeColor(ticket.priority)}`}>
                {ticket.priority.toUpperCase()}
              </span>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-white mb-2">Customer Information</h3>
              <div className="grid grid-cols-2 gap-4 text-gray-300">
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p>{ticket.customer.name || ticket.customer.phone_number}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p>{ticket.customer.phone_number}</p>
                </div>
                {ticket.customer.email && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium">Email</p>
                    <p>{ticket.customer.email}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-white mb-2">Issue Details</h3>
              <p className="text-gray-300">{ticket.description}</p>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-white mb-2">Notes</h3>
              <div className="space-y-4 mb-4">
                {ticket.notes.map((note) => (
                  <div key={note.id} className="bg-gray-700 rounded-lg p-4">
                    <p className="text-gray-300">{note.content}</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2"
                />
                <button
                  onClick={addNote}
                  disabled={loading || !note.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  Add Note
                </button>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-white mb-2">Actions</h3>
              <div className="flex space-x-2">
                {ticket.status !== 'closed' && (
                  <button
                    onClick={() => updateStatus('closed')}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    Close Ticket
                  </button>
                )}
                {ticket.status === 'open' && (
                  <button
                    onClick={() => updateStatus('in_progress')}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    Mark In Progress
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TicketDetails;