import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { useSearchParams, useNavigate } from "react-router-dom";
import "./MessageHub.css";

const MessageHub = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

  const currentUserId = JSON.parse(localStorage.getItem("user") || "{}").id;

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, []);

  // Handle URL parameter for opening specific conversation
  useEffect(() => {
    const convId = searchParams.get('conversation');
    if (convId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === parseInt(convId));
      if (conv) {
        selectConversation(conv);
      }
    }
  }, [searchParams, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      const interval = setInterval(() => {
        fetchMessages(selectedConversation.id, true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get(`${API_BASE_URL}/api/messages/conversations`, { headers });
      setConversations(res.data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId, silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get(`${API_BASE_URL}/api/messages/conversations/${conversationId}`, { headers });
      setMessages(res.data);
      
      // Update unread count in conversations list
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ));
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get(`${API_BASE_URL}/api/messages/users`, { headers });
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const selectConversation = (conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
    messageInputRef.current?.focus();
  };

  const startConversation = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.post(`${API_BASE_URL}/api/messages/conversations`, {
        user_id: userId,
        type: 'direct'
      }, { headers });
      
      setShowNewConversation(false);
      setSearchUser("");
      
      // Refresh conversations and select the new/existing one
      await fetchConversations();
      
      // Find and select the conversation
      const convRes = await axios.get(`${API_BASE_URL}/api/messages/conversations`, { headers });
      const conv = convRes.data.find(c => c.id === res.data.id);
      if (conv) {
        selectConversation(conv);
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || sending) return;
    
    try {
      setSending(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.post(
        `${API_BASE_URL}/api/messages/conversations/${selectedConversation.id}/messages`,
        { content: newMessage },
        { headers }
      );
      
      setMessages(prev => [...prev, res.data]);
      setNewMessage("");
      
      // Update conversation preview
      setConversations(prev => prev.map(c => 
        c.id === selectedConversation.id 
          ? { ...c, last_message_preview: newMessage.substring(0, 100), last_message_at: new Date().toISOString() }
          : c
      ));
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Error al enviar mensaje");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  };

  const formatLastMessage = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <Layout>
      <div className="zxmsg">
        <div className="zxmsg-inner">
          {/* Header */}
          <div>
            <div className="zxmsg-eyebrow">ZIONX · Comunicación</div>
            <h1 className="zxmsg-h1">
              Centro de <span className="zxmsg-serif">mensajes</span>
            </h1>
          </div>

          {/* Two-pane shell */}
          <div className="zxmsg-shell">
            {/* Sidebar - Conversations List */}
            <div className="zxmsg-side">
              {/* Header */}
              <div className="zxmsg-side-head">
                <div className="zxmsg-side-top">
                  <div className="zxmsg-side-title">
                    Mensajes
                    {totalUnread > 0 && (
                      <span className="zxmsg-badge">{totalUnread}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowNewConversation(true)}
                    className="zxmsg-new-btn"
                    title="Nueva conversación"
                  >
                    ✏️
                  </button>
                </div>
                <button
                  onClick={() => navigate('/notifications')}
                  className="zxmsg-side-link"
                >
                  🔔 Ver notificaciones →
                </button>
              </div>

              {/* Conversations List */}
              <div className="zxmsg-conv-list">
                {loading ? (
                  <div className="zxmsg-loading">
                    <div className="zxmsg-spin"></div>
                  </div>
                ) : conversations.length > 0 ? (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={`zxmsg-conv ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                    >
                      <div className="zxmsg-conv-body">
                        {/* Avatar */}
                        <div className="zxmsg-avatar">
                          {conv.display_name?.charAt(0).toUpperCase() || '?'}
                        </div>

                        {/* Content */}
                        <div className="zxmsg-conv-main">
                          <div className="zxmsg-conv-line">
                            <span className={`zxmsg-conv-name ${conv.unread_count > 0 ? 'unread' : ''}`}>
                              {conv.display_name || 'Conversación'}
                            </span>
                            <span className="zxmsg-conv-time">
                              {formatLastMessage(conv.last_message_at)}
                            </span>
                          </div>
                          <div className="zxmsg-conv-line2">
                            <p className={`zxmsg-conv-preview ${conv.unread_count > 0 ? 'unread' : ''}`}>
                              {conv.last_message_preview || 'Sin mensajes'}
                            </p>
                            {conv.unread_count > 0 && (
                              <span className="zxmsg-unread-dot">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="zxmsg-empty-side">
                    <span className="big">💬</span>
                    <p>No hay conversaciones</p>
                    <button
                      onClick={() => setShowNewConversation(true)}
                      className="link"
                    >
                      Iniciar una conversación →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Main Chat Area */}
            <div className="zxmsg-main">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="zxmsg-thread-head">
                    <div className="zxmsg-thread-who">
                      <div className="zxmsg-avatar sm">
                        {selectedConversation.display_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <h2 className="zxmsg-thread-name">{selectedConversation.display_name}</h2>
                        <p className="zxmsg-thread-type">
                          {selectedConversation.type === 'direct' ? 'Mensaje directo' : 'Grupo'}
                        </p>
                      </div>
                    </div>
                    <div className="zxmsg-thread-actions">
                      <button className="zxmsg-icon-btn" title="Buscar en conversación">
                        🔍
                      </button>
                      <button className="zxmsg-icon-btn" title="Más opciones">
                        ⋮
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="zxmsg-messages">
                    {loadingMessages ? (
                      <div className="zxmsg-loading">
                        <div className="zxmsg-spin"></div>
                      </div>
                    ) : messages.length > 0 ? (
                      Object.entries(groupedMessages).map(([date, msgs]) => (
                        <div key={date}>
                          {/* Date separator */}
                          <div className="zxmsg-datesep">
                            <span>{formatDate(date)}</span>
                          </div>

                          {/* Messages */}
                          <div className="zxmsg-bubbles">
                            {msgs.map((message) => {
                              const isOwnMessage = message.sender_id === currentUserId;
                              return (
                                <div
                                  key={message.id}
                                  className={`zxmsg-msg-row ${isOwnMessage ? 'mine' : 'theirs'}`}
                                >
                                  <div className="zxmsg-msg-wrap">
                                    {!isOwnMessage && (
                                      <p className="zxmsg-msg-sender">{message.sender_name}</p>
                                    )}
                                    <div className={`zxmsg-bubble ${isOwnMessage ? 'mine' : 'theirs'}`}>
                                      {/* Shared item */}
                                      {message.shared_item_type && (
                                        <div className="zxmsg-shared">
                                          <span>📎</span>
                                          <span>
                                            {message.shared_item_type} #{message.shared_item_id}
                                          </span>
                                        </div>
                                      )}

                                      <p>{message.content}</p>

                                      <p className="zxmsg-time">
                                        {formatTime(message.created_at)}
                                        {message.is_edited && ' (editado)'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="zxmsg-thread-empty">
                        <div>
                          <span className="big">👋</span>
                          <p>Inicia la conversación</p>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <form onSubmit={sendMessage} className="zxmsg-composer">
                    <div className="zxmsg-composer-row">
                      <button
                        type="button"
                        className="zxmsg-attach"
                        title="Adjuntar archivo"
                      >
                        📎
                      </button>
                      <input
                        ref={messageInputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        className="zxmsg-input"
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="zxmsg-send"
                      >
                        {sending ? 'Enviando…' : 'Enviar'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                /* No conversation selected */
                <div className="zxmsg-noconv">
                  <div>
                    <span className="big">💬</span>
                    <h2>Selecciona una conversación</h2>
                    <p>O inicia una nueva con el botón ✏️</p>
                    <button
                      onClick={() => setShowNewConversation(true)}
                      className="zxmsg-noconv-btn"
                    >
                      Nueva Conversación
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New Conversation Modal */}
        {showNewConversation && (
          <div className="zxmsg-modal-overlay">
            <div className="zxmsg-modal">
              <div className="zxmsg-modal-head">
                <h2>✏️ Nueva Conversación</h2>
                <button
                  onClick={() => { setShowNewConversation(false); setSearchUser(""); }}
                  className="zxmsg-modal-close"
                >
                  ×
                </button>
              </div>

              <input
                type="text"
                placeholder="Buscar usuario..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="zxmsg-modal-search"
                autoFocus
              />

              <div className="zxmsg-user-list">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => startConversation(user.id)}
                      className="zxmsg-user"
                    >
                      <div className="zxmsg-avatar sm">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="name">{user.name}</p>
                        <p className="email">{user.email}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="zxmsg-modal-empty">
                    {searchUser ? 'No se encontraron usuarios' : 'Escribe para buscar usuarios'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MessageHub;

