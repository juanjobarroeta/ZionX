import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { useNavigate } from "react-router-dom";

const NotificationHub = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, read

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const params = filter === 'unread' ? { unread_only: true } : {};
      const res = await axios.get(`${API_BASE_URL}/api/notifications`, { headers, params });
      
      let data = res.data;
      if (filter === 'read') {
        data = data.filter(n => n.is_read);
      }
      
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API_BASE_URL}/api/notifications/${id}/read`, {}, { headers });
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API_BASE_URL}/api/notifications/mark-all-read`, {}, { headers });
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_BASE_URL}/api/notifications/${id}`, { headers });
      
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const clearAll = async () => {
    if (!confirm("¿Eliminar todas las notificaciones?")) return;
    
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_BASE_URL}/api/notifications/clear-all`, { headers });
      
      setNotifications([]);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const createTestNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_BASE_URL}/api/notifications/test`, {}, { headers });
      
      alert("✅ Se crearon notificaciones de prueba");
      fetchNotifications();
    } catch (error) {
      console.error("Error creating test notifications:", error);
      alert("Error al crear notificaciones de prueba");
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    if (notification.link_type === 'conversation') {
      navigate(`/messages?conversation=${notification.link_id}`);
    } else if (notification.link_url) {
      navigate(notification.link_url);
    } else if (notification.link_type === 'loan') {
      navigate(`/loan/${notification.link_id}`);
    } else if (notification.link_type === 'customer') {
      navigate(`/customer-profile/${notification.link_id}`);
    } else if (notification.link_type === 'task') {
      navigate(`/tasks`);
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'ahora';
    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    return date.toLocaleDateString('es-MX');
  };

  const getTypeIcon = (type) => {
    const icons = {
      info: '📢',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      message: '💬',
      task: '📋',
      system: '⚙️'
    };
    return icons[type] || '📢';
  };

  const getTypeBgColor = (type) => {
    const colors = {
      info: 'bg-blue-100',
      success: 'bg-green-100',
      warning: 'bg-yellow-100',
      error: 'bg-red-100',
      message: 'bg-purple-100',
      task: 'bg-indigo-100',
      system: 'bg-gray-100'
    };
    return colors[type] || 'bg-gray-100';
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-black flex items-center gap-3">
                  🔔 Centro de Notificaciones
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full">
                      {unreadCount} nuevas
                    </span>
                  )}
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  Mantente al día con las actualizaciones del sistema
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={createTestNotifications}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
                >
                  🧪 Crear Pruebas
                </button>
                <button
                  onClick={() => navigate('/messages')}
                  className="bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  💬 Mensajes
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    ✓ Marcar todo como leído
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mt-4">
              {[
                { id: 'all', label: 'Todas', icon: '📋' },
                { id: 'unread', label: 'No leídas', icon: '🔵' },
                { id: 'read', label: 'Leídas', icon: '✓' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === f.id 
                      ? 'bg-black text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {f.icon} {f.label}
                </button>
              ))}
              
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="ml-auto text-red-600 hover:text-red-800 text-sm px-4 py-2"
                >
                  🗑️ Limpiar todo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-xl border overflow-hidden transition-all hover:shadow-md ${
                    notification.is_read 
                      ? 'border-gray-200' 
                      : 'border-l-4 border-l-blue-500 border-gray-200'
                  }`}
                >
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${getTypeBgColor(notification.type)}`}>
                        {notification.icon || getTypeIcon(notification.type)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className={`font-semibold ${notification.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                              {notification.title}
                            </h3>
                            <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                              <span>{formatTimeAgo(notification.created_at)}</span>
                              {notification.from_user_name && (
                                <>
                                  <span>•</span>
                                  <span>de {notification.from_user_name}</span>
                                </>
                              )}
                              {notification.link_type && (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-500">Ver {notification.link_type} →</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {!notification.is_read && (
                              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="Eliminar"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <span className="text-6xl block mb-4">🔔</span>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                {filter === 'unread' ? 'No hay notificaciones sin leer' : 'No hay notificaciones'}
              </h2>
              <p className="text-gray-500">
                {filter === 'unread' 
                  ? '¡Estás al día con todo!' 
                  : 'Las notificaciones aparecerán aquí cuando haya actividad'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default NotificationHub;

