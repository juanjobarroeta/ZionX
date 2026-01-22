import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const searchRef = useRef(null);

  // Fetch notifications and message counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        
        const headers = { Authorization: `Bearer ${token}` };
        
        const [notifRes, msgRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/notifications/unread-count`, { headers }).catch(() => ({ data: { count: 0 } })),
          axios.get(`${API_BASE_URL}/api/messages/unread-count`, { headers }).catch(() => ({ data: { count: 0 } }))
        ]);
        
        setUnreadNotifCount(notifRes.data.count || 0);
        setUnreadMsgCount(msgRes.data.count || 0);
      } catch (error) {
        console.log('Could not fetch notification counts');
      }
    };
    
    fetchCounts();
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (showNotifications) {
      fetchNotifications();
    }
  }, [showNotifications]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE_URL}/api/notifications?limit=10`, { headers });
      setNotifications(res.data);
    } catch (error) {
      console.log('Could not fetch notifications');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "k":
            e.preventDefault();
            setShowSearch(true);
            setTimeout(() => searchRef.current?.focus(), 100);
            break;
          case "d":
            e.preventDefault();
            window.location.href = "/dashboard";
            break;
          case "n":
            e.preventDefault();
            window.location.href = "/create-loan";
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown")) {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getBreadcrumbs = () => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    const breadcrumbs = [];
    
    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = segment
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      
      breadcrumbs.push({
        path: currentPath,
        label: label,
        isLast: index === pathSegments.length - 1
      });
    });

    return breadcrumbs;
  };

  const markNotificationAsRead = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API_BASE_URL}/api/notifications/${id}/read`, {}, { headers });
      
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, is_read: true } : notif
        )
      );
      setUnreadNotifCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.log('Could not mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API_BASE_URL}/api/notifications/mark-all-read`, {}, { headers });
      
      setNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })));
      setUnreadNotifCount(0);
    } catch (error) {
      console.log('Could not mark all as read');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "payment": return "💰";
      case "overdue": return "⚠️";
      case "approval": return "✅";
      case "message": return "💬";
      case "task": return "📋";
      case "success": return "✅";
      case "warning": return "⚠️";
      case "error": return "❌";
      default: return "📢";
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case "payment": return "text-primary-500";
      case "success": return "text-green-600";
      case "overdue": 
      case "warning": return "text-yellow-600";
      case "error": return "text-red-600";
      case "message": return "text-blue-600";
      default: return "text-neutral-600";
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
    return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  };

  return (
    <header className="w-full bg-gradient-to-r from-zionx-tertiary to-zionx-secondary text-zionx-primary px-6 py-4 rounded-tl-3xl rounded-tr-3xl shadow-lg border-b border-zionx-accent">
      <div className="flex items-center justify-between">
        {/* Left Section - Breadcrumbs & Search */}
        <div className="flex items-center gap-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm">
            <Link to="/dashboard" className="text-zionx-accent hover:text-zionx-highlight transition-colors">
              Dashboard
            </Link>
            {getBreadcrumbs().map((breadcrumb, index) => (
              <div key={breadcrumb.path} className="flex items-center space-x-2">
                <span className="text-zionx-accent">/</span>
                {breadcrumb.isLast ? (
                  <span className="text-primary-500 font-semibold">{breadcrumb.label}</span>
                ) : (
                  <Link 
                    to={breadcrumb.path} 
                    className="text-zionx-accent hover:text-zionx-highlight transition-colors"
                  >
                    {breadcrumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Global Search */}
          <div className="relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              <span>🔍</span>
              <span className="text-sm text-neutral-700">Buscar</span>
              <span className="text-xs text-gray-500">⌘K</span>
            </button>
            
            {showSearch && createPortal(
              <div className="fixed top-16 left-6 mt-2 w-96 bg-white rounded-lg shadow-xl border border-neutral-200 z-[999999]">
                <div className="p-4">
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Buscar préstamos, clientes, pagos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-700 text-neutral-800 px-4 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 focus:outline-none"
                    autoFocus
                  />
                  {searchTerm && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs text-neutral-600 uppercase tracking-wider">Resultados rápidos</div>
                      <div className="space-y-1">
                        <Link 
                          to="/create-loan" 
                          onClick={() => setShowSearch(false)}
                          className="block w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm"
                        >
                          💳 Crear nuevo préstamo
                        </Link>
                        <Link 
                          to="/create-customer" 
                          onClick={() => setShowSearch(false)}
                          className="block w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm"
                        >
                          👤 Crear nuevo cliente
                        </Link>
                        <Link 
                          to="/register-payment" 
                          onClick={() => setShowSearch(false)}
                          className="block w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm"
                        >
                          💰 Registrar pago
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>

        {/* Right Section - Actions & User */}
        <div className="flex items-center gap-4">
          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/create-loan"
              className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-neutral-800 font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              💳 Nuevo Préstamo
            </Link>
            <Link
              to="/register-payment"
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-cyan-500 hover:to-blue-500 text-neutral-800 font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              💰 Registrar Pago
            </Link>
            <Link
              to="/loan-quotes"
              className="bg-gradient-to-r from-purple-500 to-violet-500 hover:from-violet-500 hover:to-purple-500 text-neutral-800 font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              📊 Cotizar
            </Link>
          </div>

          {/* Messages */}
          <div className="relative dropdown">
            <button
              onClick={() => navigate('/messages')}
              className="relative p-2 text-neutral-700 hover:text-neutral-800 transition-colors duration-200"
              title="Mensajes"
            >
              <span className="text-xl">💬</span>
              {unreadMsgCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                </span>
              )}
            </button>
          </div>

          {/* Notifications */}
          <div className="relative dropdown">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-neutral-700 hover:text-neutral-800 transition-colors duration-200"
              title="Notificaciones"
            >
              <span className="text-xl">🔔</span>
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>

            {showNotifications && createPortal(
              <div className="fixed top-16 right-6 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-neutral-200 z-[999999]">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      🔔 Notificaciones
                      {unreadNotifCount > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {unreadNotifCount}
                        </span>
                      )}
                    </h3>
                    {unreadNotifCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Marcar todo como leído
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => {
                          markNotificationAsRead(notification.id);
                          // Navigate based on link_type
                          if (notification.link_type === 'conversation') {
                            navigate(`/messages?conversation=${notification.link_id}`);
                          } else if (notification.link_url) {
                            navigate(notification.link_url);
                          } else if (notification.link_type === 'loan') {
                            navigate(`/loan/${notification.link_id}`);
                          } else if (notification.link_type === 'customer') {
                            navigate(`/customer-profile/${notification.link_id}`);
                          }
                          setShowNotifications(false);
                        }}
                        className={`p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
                          notification.is_read ? "bg-gray-50" : "bg-blue-50 border-l-4 border-blue-500"
                        } hover:bg-gray-100`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg">{notification.icon || getNotificationIcon(notification.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{notification.title}</p>
                            <p className="text-sm text-gray-600 truncate">{notification.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-gray-400">{formatTimeAgo(notification.created_at)}</p>
                              {notification.from_user_name && (
                                <span className="text-xs text-gray-400">• de {notification.from_user_name}</span>
                              )}
                            </div>
                          </div>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-gray-500">
                        <span className="text-4xl block mb-2">🔔</span>
                        <p>No hay notificaciones</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-neutral-200 flex justify-between">
                    <Link 
                      to="/notifications" 
                      onClick={() => setShowNotifications(false)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Ver todas →
                    </Link>
                    <Link 
                      to="/messages" 
                      onClick={() => setShowNotifications(false)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      💬 Ir a mensajes
                    </Link>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* User Menu */}
          <div className="relative dropdown">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors duration-200"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-neutral-800 font-semibold">
                J
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold">Juan José</div>
                <div className="text-xs text-neutral-600">Administrador</div>
              </div>
              <span className="text-neutral-600">▼</span>
            </button>

            {showUserMenu && createPortal(
              <div className="fixed top-16 right-6 mt-2 w-64 bg-white rounded-lg shadow-xl border border-neutral-200 z-[999999]">
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-neutral-200">
                    <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-neutral-800 font-semibold text-lg">
                      J
                    </div>
                    <div>
                      <div className="font-semibold">Juan José Barroeta</div>
                      <div className="text-sm text-neutral-600">juan@crediya.com</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <button 
                      onClick={() => {
                        window.location.href = "/customer-profile";
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm"
                    >
                      👤 Mi Perfil
                    </button>
                    <button 
                      onClick={() => {
                        window.location.href = "/admin/settings";
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm"
                    >
                      ⚙️ Configuración
                    </button>
                    <button 
                      onClick={() => {
                        // Toggle dark mode logic here
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm"
                    >
                      🌙 Modo Oscuro
                    </button>
                    <div className="border-t border-neutral-200 my-2"></div>
                    <button
                      onClick={() => {
                        console.log("Logout button clicked");
                        // Clear all authentication data
                        localStorage.clear();
                        console.log("Cleared all localStorage");
                        // Force a hard redirect to ensure clean state
                        window.location.replace("/auth");
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-red-900 text-neutral-600 text-sm"
                    >
                      🚪 Cerrar Sesión
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;