import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import "./LeadsInbox.css";

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
      <div className="zxlead">
        <div className="zxlead-inner">
          {/* Header */}
          <header>
            <p className="zxlead-eyebrow">Bandeja de entrada</p>
            <h1 className="zxlead-h1">
              Leads <span className="zxlead-serif">Inbox</span>
            </h1>
          </header>

          {/* Status Filter */}
          <div className="zxlead-filters">
            {['all', 'new', 'contacted', 'qualified', 'converted'].map(status => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  fetchLeads();
                }}
                className={`zxlead-chip ${statusFilter === status ? 'active' : ''}`}
              >
                {status === 'all' ? 'Todos' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Two-pane shell */}
          <div className="zxlead-shell">
            {/* Left pane - Leads list */}
            <div className="zxlead-side">
              <div className="zxlead-list">
                {loading && leads.length === 0 ? (
                  <div className="zxlead-loading">
                    <div className="zxlead-spin"></div>
                  </div>
                ) : leads.length === 0 ? (
                  <div className="zxlead-empty-side">
                    <p className="title">No hay leads</p>
                    <p className="sub">Los nuevos leads aparecerán aquí</p>
                  </div>
                ) : (
                  <div>
                    {leads.map(lead => (
                      <button
                        key={lead.id}
                        onClick={() => handleSelectLead(lead)}
                        className={`zxlead-row ${selectedLead?.id === lead.id ? 'active' : ''}`}
                      >
                        <div className="zxlead-row-body">
                          {/* Avatar */}
                          <div className="zxlead-avatar">
                            {(lead.whatsapp_name || lead.phone_number || '?').charAt(0).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="zxlead-row-main">
                            <div className="zxlead-row-line">
                              <span className={`zxlead-row-name ${lead.unread_count > 0 ? 'unread' : ''}`}>
                                {lead.whatsapp_name || lead.phone_number}
                              </span>
                              <span className="zxlead-row-time">
                                {formatTime(lead.last_message_at || lead.created_at)}
                              </span>
                            </div>

                            <p className="zxlead-row-preview">
                              {lead.last_message || 'Sin mensajes'}
                            </p>

                            <div className="zxlead-row-line2">
                              <span className={`zxlead-pill status-${lead.status}`}>
                                {lead.status}
                              </span>
                              {lead.unread_count > 0 && (
                                <span className="zxlead-unread-dot">
                                  {lead.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right pane - Chat */}
            {selectedLead ? (
              <div className="zxlead-main">
                {/* Chat Header */}
                <div className="zxlead-chat-head">
                  <div className="zxlead-chat-who">
                    <div className="zxlead-avatar sm">
                      {(selectedLead.whatsapp_name || selectedLead.phone_number).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="zxlead-chat-name">{selectedLead.whatsapp_name || 'Sin nombre'}</div>
                      <div className="zxlead-chat-phone">{selectedLead.phone_number}</div>
                    </div>
                  </div>

                  <div className="zxlead-chat-actions">
                    <span className={`zxlead-pill status-${selectedLead.status}`}>
                      {selectedLead.status}
                    </span>
                    <button
                      onClick={() => window.location.href = `/leads/${selectedLead.id}`}
                      className="zxlead-profile-btn"
                    >
                      Ver Perfil
                    </button>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="zxlead-messages">
                  {messages.length === 0 ? (
                    <div className="zxlead-chat-empty">
                      <p>Aún no hay mensajes. Inicia la conversación.</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, index) => (
                        <div
                          key={msg.id || index}
                          className={`zxlead-msg-row ${msg.direction === 'outbound' ? 'mine' : 'theirs'}`}
                        >
                          <div className={`zxlead-bubble ${msg.direction === 'outbound' ? 'mine' : 'theirs'}`}>
                            <p>{msg.content}</p>
                            <div className="zxlead-meta">
                              <span className="zxlead-time">
                                {formatTime(msg.sent_at)}
                              </span>
                              {msg.direction === 'outbound' && (
                                <span className={`zxlead-tick ${msg.status === 'failed' ? 'failed' : ''}`}>
                                  {msg.status === 'sent' && '✓'}
                                  {msg.status === 'delivered' && '✓✓'}
                                  {msg.status === 'read' && '✓✓'}
                                  {msg.status === 'failed' && 'Fallido'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Message Input */}
                <div className="zxlead-composer">
                  <div className="zxlead-composer-row">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Escribe un mensaje..."
                      className="zxlead-textarea"
                      rows={2}
                      disabled={sending}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="zxlead-send"
                    >
                      {sending ? (
                        <>
                          <div className="zxlead-spin sm"></div>
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <span>Enviar</span>
                      )}
                    </button>
                  </div>
                  <p className="zxlead-hint">
                    Presiona Enter para enviar, Shift+Enter para nueva línea
                  </p>
                </div>
              </div>
            ) : (
              <div className="zxlead-noconv">
                <div>
                  <h2>Selecciona un lead</h2>
                  <p>Elige una conversación de la izquierda para empezar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LeadsInbox;
