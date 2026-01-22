import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { useSearchParams, useNavigate } from "react-router-dom";

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
      <div className="h-[calc(100vh-120px)] bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary flex">
        {/* Sidebar - Conversations List */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold flex items-center gap-2">
                💬 Mensajes
                {totalUnread > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {totalUnread}
                  </span>
                )}
              </h1>
              <button
                onClick={() => setShowNewConversation(true)}
                className="bg-black text-white p-2 rounded-lg hover:bg-gray-800"
                title="Nueva conversación"
              >
                ✏️
              </button>
            </div>
            <button
              onClick={() => navigate('/notifications')}
              className="w-full text-left text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2"
            >
              🔔 Ver notificaciones →
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              </div>
            ) : conversations.length > 0 ? (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {conv.display_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold truncate ${conv.unread_count > 0 ? 'text-black' : 'text-gray-700'}`}>
                          {conv.display_name || 'Conversación'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatLastMessage(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className={`text-sm truncate ${conv.unread_count > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                          {conv.last_message_preview || 'Sin mensajes'}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full ml-2">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 px-4 text-gray-500">
                <span className="text-4xl block mb-2">💬</span>
                <p>No hay conversaciones</p>
                <button
                  onClick={() => setShowNewConversation(true)}
                  className="mt-3 text-blue-600 hover:text-blue-800 text-sm"
                >
                  Iniciar una conversación →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {selectedConversation.display_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h2 className="font-semibold">{selectedConversation.display_name}</h2>
                    <p className="text-xs text-gray-500">
                      {selectedConversation.type === 'direct' ? 'Mensaje directo' : 'Grupo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-gray-100 rounded-lg" title="Buscar en conversación">
                    🔍
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg" title="Más opciones">
                    ⋮
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : messages.length > 0 ? (
                  Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date}>
                      {/* Date separator */}
                      <div className="flex items-center justify-center mb-4">
                        <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                          {formatDate(date)}
                        </span>
                      </div>
                      
                      {/* Messages */}
                      <div className="space-y-3">
                        {msgs.map((message) => {
                          const isOwnMessage = message.sender_id === currentUserId;
                          return (
                            <div
                              key={message.id}
                              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                                {!isOwnMessage && (
                                  <p className="text-xs text-gray-500 mb-1 ml-3">{message.sender_name}</p>
                                )}
                                <div
                                  className={`px-4 py-3 rounded-2xl ${
                                    isOwnMessage
                                      ? 'bg-blue-600 text-white rounded-br-md'
                                      : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'
                                  }`}
                                >
                                  {/* Shared item */}
                                  {message.shared_item_type && (
                                    <div className={`mb-2 p-2 rounded-lg ${isOwnMessage ? 'bg-blue-500' : 'bg-gray-100'}`}>
                                      <div className="flex items-center gap-2">
                                        <span>📎</span>
                                        <span className="text-sm font-medium">
                                          {message.shared_item_type} #{message.shared_item_id}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  
                                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                  
                                  <p className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-200' : 'text-gray-400'}`}>
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
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <span className="text-5xl block mb-3">👋</span>
                      <p>Inicia la conversación</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={sendMessage} className="bg-white border-t border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
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
                    className="flex-1 bg-gray-100 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? '⏳' : '➤'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* No conversation selected */
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <span className="text-6xl block mb-4">💬</span>
                <h2 className="text-xl font-semibold mb-2">Selecciona una conversación</h2>
                <p className="mb-4">O inicia una nueva con el botón ✏️</p>
                <button
                  onClick={() => setShowNewConversation(true)}
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800"
                >
                  Nueva Conversación
                </button>
              </div>
            </div>
          )}
        </div>

        {/* New Conversation Modal */}
        {showNewConversation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">✏️ Nueva Conversación</h2>
                <button
                  onClick={() => { setShowNewConversation(false); setSearchUser(""); }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <input
                type="text"
                placeholder="Buscar usuario..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />

              <div className="max-h-80 overflow-y-auto">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => startConversation(user.id)}
                      className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
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

