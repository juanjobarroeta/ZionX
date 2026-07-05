import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { useNavigate } from "react-router-dom";
import "./NotificationHub.css";

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
      <div className="zxntf">
        <div className="zxntf-inner">
          {/* Header */}
          <div className="zxntf-head">
            <div>
              <div className="zxntf-eyebrow">Actividad</div>
              <h1 className="zxntf-h1">
                Centro de <span className="zxntf-serif">notificaciones</span>
                {unreadCount > 0 && (
                  <span className="zxntf-count">{unreadCount} nuevas</span>
                )}
              </h1>
              <p className="zxntf-sub">
                Mantente al día con las actualizaciones del sistema
              </p>
            </div>
            <div className="zxntf-actions">
              <button
                onClick={createTestNotifications}
                className="zxntf-btn"
              >
                🧪 Crear Pruebas
              </button>
              <button
                onClick={() => navigate('/messages')}
                className="zxntf-btn"
              >
                💬 Mensajes
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="zxntf-btn solid"
                >
                  ✓ Marcar todo como leído
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="zxntf-filters">
            {[
              { id: 'all', label: 'Todas', icon: '📋' },
              { id: 'unread', label: 'No leídas', icon: '🔵' },
              { id: 'read', label: 'Leídas', icon: '✓' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`zxntf-chip ${filter === f.id ? 'active' : ''}`}
              >
                {f.icon} {f.label}
              </button>
            ))}

            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="zxntf-clear"
              >
                🗑️ Limpiar todo
              </button>
            )}
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="zxntf-loading">Cargando…</div>
          ) : notifications.length > 0 ? (
            <div className="zxntf-list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`zxntf-row ${notification.is_read ? '' : 'unread'}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Icon */}
                  <div className="zxntf-ico">
                    {notification.icon || getTypeIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="zxntf-body">
                    <div className="zxntf-top">
                      <div>
                        <div className={`zxntf-title ${notification.is_read ? 'read' : ''}`}>
                          {notification.title}
                        </div>
                        <p className="zxntf-msg">{notification.message}</p>
                        <div className="zxntf-meta">
                          <span>{formatTimeAgo(notification.created_at)}</span>
                          {notification.from_user_name && (
                            <>
                              <span className="dot">•</span>
                              <span>de {notification.from_user_name}</span>
                            </>
                          )}
                          {notification.link_type && (
                            <>
                              <span className="dot">•</span>
                              <span className="link">Ver {notification.link_type} →</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="zxntf-side">
                        {!notification.is_read && (
                          <span className="zxntf-unread-dot"></span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="zxntf-del"
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="zxntf-empty">
              <span className="big">🔔</span>
              <div className="lead">
                {filter === 'unread' ? 'No hay notificaciones sin leer' : 'No hay notificaciones'}
              </div>
              <p>
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

