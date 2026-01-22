import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const LeadsInbox = () => {
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchLeads();
    // Poll for new messages every 10 seconds
    const interval = setInterval(() => {
      if (selectedLead) {
        fetchMessages(selectedLead.id, true); // silent refresh
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedLead]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/leads${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLeads(response.data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (leadId, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/leads/${leadId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSelectLead = (lead) => {
    setSelectedLead(lead);
    fetchMessages(lead.id);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedLead) return;

    try {
      setSending(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/leads/${selectedLead.id}/send-message`,
        { message: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNewMessage('');
      fetchMessages(selectedLead.id);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error al enviar mensaje. Verifica que WhatsApp esté configurado.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-blue-100 text-blue-700',
      contacted: 'bg-yellow-100 text-yellow-700',
      qualified: 'bg-purple-100 text-purple-700',
      converted: 'bg-green-100 text-green-700',
      lost: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
  };

  return (
    <Layout>
      <div className="flex h-screen bg-white">
        {/* Left Sidebar - Leads List */}
        <div className="w-96 border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-black mb-4">💬 Leads Inbox</h1>
            
            {/* Status Filter */}
            <div className="flex flex-wrap gap-2">
              {['all', 'new', 'contacted', 'qualified', 'converted'].map(status => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    fetchLeads();
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'Todos' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Leads List */}
          <div className="flex-1 overflow-y-auto">
            {loading && leads.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              </div>
            ) : leads.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="mb-2">📭 No hay leads</p>
                <p className="text-sm">Los nuevos leads aparecerán aquí</p>
              </div>
            ) : (
              <div>
                {leads.map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => handleSelectLead(lead)}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedLead?.id === lead.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {(lead.whatsapp_name || lead.phone_number || '?').charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-black truncate">
                            {lead.whatsapp_name || lead.phone_number}
                          </p>
                          <span className="text-xs text-gray-500">
                            {formatTime(lead.last_message_at || lead.created_at)}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 truncate mb-2">
                          {lead.last_message || 'Sin mensajes'}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(lead.status)}`}>
                            {lead.status}
                          </span>
                          {lead.unread_count > 0 && (
                            <span className="bg-green-500 text-white text-xs rounded-full px-2 py-1 font-medium">
                              {lead.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Chat Area */}
        {selectedLead ? (
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                    {(selectedLead.whatsapp_name || selectedLead.phone_number).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-black">{selectedLead.whatsapp_name || 'Sin nombre'}</h3>
                    <p className="text-sm text-gray-500">{selectedLead.phone_number}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(selectedLead.status)}`}>
                    {selectedLead.status}
                  </span>
                  <button
                    onClick={() => window.location.href = `/leads/${selectedLead.id}`}
                    className="text-gray-600 hover:text-black px-3 py-2 rounded-lg hover:bg-gray-100"
                  >
                    ℹ️ Ver Perfil
                  </button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Aún no hay mensajes. ¡Inicia la conversación!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => (
                    <div
                      key={msg.id || index}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-2 rounded-lg ${
                          msg.direction === 'outbound'
                            ? 'bg-green-500 text-white'
                            : 'bg-white border border-gray-200 text-black'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className="flex items-center justify-end space-x-2 mt-1">
                          <p className={`text-xs ${msg.direction === 'outbound' ? 'text-green-100' : 'text-gray-500'}`}>
                            {formatTime(msg.sent_at)}
                          </p>
                          {msg.direction === 'outbound' && (
                            <span className="text-xs">
                              {msg.status === 'sent' && '✓'}
                              {msg.status === 'delivered' && '✓✓'}
                              {msg.status === 'read' && '✓✓'}
                              {msg.status === 'failed' && '❌'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe un mensaje..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    rows={2}
                    disabled={sending}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span>📤</span>
                      <span>Enviar</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: Presiona Enter para enviar, Shift+Enter para nueva línea
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-xl font-medium mb-2">Selecciona un lead</p>
              <p className="text-sm">Elige una conversación de la izquierda para empezar</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default LeadsInbox;



