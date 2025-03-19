import React, { useState } from "react";
import axios from "axios";
import { format } from "date-fns";

function TicketDetails({ ticket, onClose, onUpdate }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const addNote = async () => {
    if (!note.trim()) return;

    try {
      setLoading(true);
      await axios.put(`/api/tickets/${ticket.id}`, {
        note: note,
      });
      setNote("");
      onUpdate();
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      setLoading(true);
      await axios.put(`/api/tickets/${ticket.id}`, {
        status: newStatus,
      });
      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Ticket #{ticket.ticket_number}
              </h2>
              <p className="text-gray-400 text-sm">
                Detalles del ticket y seguimiento
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors duration-200 p-1"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  ticket.status === "open"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : ticket.status === "in_progress"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-green-500/20 text-green-400 border border-green-500/30"
                }`}
              >
                {ticket.status === "open"
                  ? "Abierto"
                  : ticket.status === "in_progress"
                  ? "En Progreso"
                  : "Cerrado"}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  ticket.priority === "urgent"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : ticket.priority === "high"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : ticket.priority === "medium"
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                }`}
              >
                {ticket.priority === "urgent"
                  ? "Urgente"
                  : ticket.priority === "high"
                  ? "Alta"
                  : ticket.priority === "medium"
                  ? "Media"
                  : "Baja"}
              </span>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Información del Cliente
              </h3>
              <div className="grid grid-cols-2 gap-6 text-gray-300">
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <p className="text-sm font-medium text-gray-400 mb-1">
                    Nombre
                  </p>
                  <p>{ticket.customer.name || ticket.customer.phone_number}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <p className="text-sm font-medium text-gray-400 mb-1">
                    Teléfono
                  </p>
                  <p>{ticket.customer.phone_number}</p>
                </div>
                {ticket.customer.email && (
                  <div className="col-span-2 bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                    <p className="text-sm font-medium text-gray-400 mb-1">
                      Email
                    </p>
                    <p>{ticket.customer.email}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Detalles del Problema
              </h3>
              <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <p className="text-gray-300">{ticket.description}</p>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">Notas</h3>
              <div className="space-y-4 mb-6">
                {ticket.notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-gray-700/50 rounded-lg p-4 border border-gray-600"
                  >
                    <p className="text-gray-300">{note.content}</p>
                    <p className="text-sm text-gray-400 mt-2 flex items-center">
                      <i className="fas fa-clock mr-2"></i>
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Agregar una nota..."
                  className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                />
                <button
                  onClick={addNote}
                  disabled={loading || !note.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 transition-colors duration-200 font-medium shadow-lg hover:shadow-indigo-500/30 flex items-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>Agregar Nota</>
                  )}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Acciones
              </h3>
              <div className="flex space-x-3">
                {ticket.status !== "closed" && (
                  <button
                    onClick={() => updateStatus("closed")}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 transition-colors duration-200 font-medium shadow-lg hover:shadow-green-500/30 flex items-center"
                  >
                    <i className="fas fa-check-circle mr-2"></i> Cerrar Ticket
                  </button>
                )}
                {ticket.status === "open" && (
                  <button
                    onClick={() => updateStatus("in_progress")}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 transition-colors duration-200 font-medium shadow-lg hover:shadow-blue-500/30 flex items-center"
                  >
                    <i className="fas fa-play-circle mr-2"></i> Marcar En
                    Progreso
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
