import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import GlobalSearch from "./GlobalSearch";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { MARKETING_ROLES, getSectionsForRole, getRoleInfo } from "../config/roles";

const sectionList = [
  {
    key: "social_media",
    icon: "📱",
    label: "Social Media & Contenido",
    color: "from-zionx-accent to-zionx-primary",
    links: [
      { href: "/social/accounts", label: "Cuentas Meta", icon: "🔗" },
      { href: "/social-hub", label: "Hub de Publicaciones", icon: "📱" },
      { href: "/content-calendar", label: "Calendario de Contenido", icon: "📅" },
      { href: "/team-dashboard", label: "Tareas del Equipo", icon: "✅" },
      { href: "/social-analytics", label: "Analíticas", icon: "📊" },
    ],
  },
  {
    key: "clients",
    icon: "🏢",
    label: "Clientes",
    color: "from-blue-400 to-blue-600",
    links: [
      { href: "/crm", label: "Directorio", icon: "📋" },
      { href: "/create-customer", label: "Nuevo Cliente", icon: "➕" },
      { href: "/customers/import", label: "Importar Clientes", icon: "📤" },
    ],
  },
  {
    key: "leads",
    icon: "💬",
    label: "Leads",
    color: "from-green-400 to-green-600",
    links: [
      { href: "/leads-inbox", label: "Inbox", icon: "💬" },
      { href: "/leads-capture", label: "Capturar Lead", icon: "➕" },
      { href: "/leads-manage", label: "Gestionar Leads", icon: "📊" },
      { href: "/leads-analytics", label: "Analíticas", icon: "📈" },
    ],
  },
  {
    key: "hr",
    icon: "👥",
    label: "Equipo & Nómina",
    color: "from-orange-400 to-orange-600",
    links: [
      { href: "/people", label: "Gestión de Equipo", icon: "👥" },
      { href: "/hr/payroll", label: "Nómina", icon: "💵" },
      { href: "/hr/financials", label: "Estados Financieros", icon: "📊" },
    ],
  },
  {
    key: "ingresos",
    icon: "💰",
    label: "Ingresos",
    color: "from-emerald-400 to-emerald-600",
    links: [
      { href: "/income", label: "Dashboard de Ingresos", icon: "📊" },
      { href: "/income/subscriptions", label: "Suscripciones", icon: "📋" },
      { href: "/income/payments", label: "Gestión de Pagos", icon: "💳" },
      { href: "/income/invoice-generator", label: "Generar Factura", icon: "📄" },
      { href: "/income/invoices", label: "Facturas", icon: "🧾" },
      { href: "/income/addons", label: "Catálogo Add-ons", icon: "➕" },
      { href: "/income/reports", label: "Reportes", icon: "📈" },
    ],
  },
  {
    key: "finanzas",
    icon: "💰",
    label: "Finanzas",
    color: "from-green-500 to-emerald-600",
    links: [
      { href: "/accounting", label: "Libro Diario", icon: "📒" },
      { href: "/admin/expenses", label: "Gastos", icon: "💸" },
      { href: "/admin/budgets", label: "Presupuestos", icon: "📊" },
      { href: "/income-statement", label: "Estado de Resultados", icon: "📈" },
      { href: "/balance-sheet", label: "Balance General", icon: "⚖️" },
    ],
  },
  {
    key: "settings",
    icon: "⚙️",
    label: "Configuración",
    color: "from-gray-400 to-gray-600",
    links: [
      { href: "/admin/create-user", label: "Gestión de Usuarios", icon: "👤" },
    ],
  },
];

const defaultOpenSections = {
  social_media: true,
  clients: false,
  leads: false,
  projects: false,
  finances: false,
  settings: false,
};

const SIDEBAR_STATE_KEY = "sidebar-state";
const FAVORITES_KEY = "sidebar-favorites";
const RECENT_ITEMS_KEY = "sidebar-recent";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
      if (saved) {
        return { ...defaultOpenSections, ...JSON.parse(saved) };
      }
      return defaultOpenSections;
    } catch {
      return defaultOpenSections;
    }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [recentItems, setRecentItems] = useState(() => {
    try {
      const saved = localStorage.getItem(RECENT_ITEMS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const searchRef = useRef(null);
  
  // Notification & Message counts
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  // Fetch notification and message counts
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
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update recent items when location changes
  useEffect(() => {
    const currentPath = location.pathname;
    const currentItem = findItemByPath(currentPath);
    
    if (currentItem) {
      setRecentItems(prev => {
        const filtered = prev.filter(item => item.href !== currentPath);
        return [currentItem, ...filtered.slice(0, 4)];
      });
    }
  }, [location]);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(openSections));
  }, [openSections]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(recentItems));
  }, [recentItems]);

  const findItemByPath = (path) => {
    for (const section of sectionList) {
      for (const link of section.links) {
        if (link.href === path) {
          return { ...link, section: section.label, sectionIcon: section.icon };
        }
      }
    }
    return null;
  };

  const toggleSection = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleFavorite = (item) => {
    setFavorites(prev => {
      const exists = prev.find(fav => fav.href === item.href);
      if (exists) {
        return prev.filter(fav => fav.href !== item.href);
      } else {
        return [...prev, item];
      }
    });
  };

  const isFavorite = (href) => {
    return favorites.some(fav => fav.href === href);
  };

  const isActive = (href) => {
    return location.pathname === href;
  };

  // Get user role from localStorage (set during login or via role switcher)
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('userRole') || 'admin';
  });

  // Listen for role changes
  useEffect(() => {
    const handleRoleChange = () => {
      setUserRole(localStorage.getItem('userRole') || 'admin');
    };
    window.addEventListener('roleChanged', handleRoleChange);
    return () => window.removeEventListener('roleChanged', handleRoleChange);
  }, []);

  const roleInfo = getRoleInfo(userRole);
  const allowedSections = roleInfo?.sections || [];

  const filteredSections = sectionList.filter(section => {
    // Filter by user role
    if (userRole !== 'admin' && !allowedSections.includes(section.key)) return false;
    
    if (!searchTerm) return true;
    return section.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
           section.links.some(link => link.label.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const filteredFavorites = favorites.filter(item => 
    item.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRecent = recentItems.filter(item => 
    item.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-56'} min-h-screen flex-shrink-0 bg-white border-r border-gray-200 text-black transition-all duration-300 ease-in-out relative flex flex-col`}>
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        {/* Logo */}
        {!isCollapsed && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-black tracking-tight">ZIONX</h1>
            <p className="text-xs text-gray-500 mt-1">Marketing</p>
          </div>
        )}

        {/* Notifications & Messages Bar */}
        {!isCollapsed && (
          <div className="mb-6 flex items-center gap-2">
            <button
              onClick={() => navigate('/messages')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all ${
                location.pathname === '/messages'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title="Mensajes"
            >
              <span className="text-lg">💬</span>
              {unreadMsgCount > 0 && (
                <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/notifications')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all ${
                location.pathname === '/notifications'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title="Notificaciones"
            >
              <span className="text-lg">🔔</span>
              {unreadNotifCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Global Search Trigger */}
        {!isCollapsed && (
          <div className="mb-8">
            <button
              onClick={() => setShowGlobalSearch(true)}
              className="w-full bg-gray-50 text-gray-500 text-left px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              🔍 Buscar clientes, equipo...
            </button>
          </div>
        )}

        {/* Global Search Modal */}
        <GlobalSearch 
          isOpen={showGlobalSearch} 
          onClose={() => setShowGlobalSearch(false)} 
        />

        {/* Dashboard Link */}
        {!isCollapsed && (
          <div className="mb-8">
            <Link
              to="/dashboard"
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm ${
                isActive("/dashboard") 
                  ? "bg-black text-white font-medium" 
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-base">🏠</span>
              <span>Dashboard</span>
            </Link>
          </div>
        )}

        {/* Favorites Section */}
        {!isCollapsed && favorites.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-zionx-primary opacity-70 uppercase tracking-wider mb-3 px-3">
              Favorites
            </h3>
            <div className="space-y-1">
              {filteredFavorites.map((item, index) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    isActive(item.href)
                      ? "bg-gradient-to-r from-zionx-accent to-zionx-primary text-white font-semibold"
                      : "hover:bg-zionx-secondary text-zionx-primary hover:text-zionx-primary"
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-sm truncate">{item.label}</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleFavorite(item);
                    }}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-neutral-600 hover:text-red-300"
                  >
                    ❌
                  </button>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Items */}
        {!isCollapsed && recentItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-zionx-primary opacity-70 uppercase tracking-wider mb-3 px-3">
              Recent
            </h3>
            <div className="space-y-1">
              {filteredRecent.slice(0, 3).map((item, index) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    isActive(item.href)
                      ? "bg-gradient-to-r from-zionx-accent to-zionx-primary text-white font-semibold"
                      : "hover:bg-zionx-secondary text-zionx-primary hover:text-zionx-primary"
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-sm truncate">{item.label}</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleFavorite(item);
                    }}
                    className={`ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
                      isFavorite(item.href) ? "text-yellow-400" : "text-zionx-primary opacity-50 hover:text-yellow-400"
                    }`}
                  >
                    {isFavorite(item.href) ? "⭐" : "☆"}
                  </button>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="space-y-2">
          {filteredSections.map((section) => (
            <div key={section.key} className="space-y-1">
              <button
                onClick={() => toggleSection(section.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm group ${
                  openSections[section.key]
                    ? "bg-gray-100 text-black font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="text-lg">{section.icon}</span>
                {!isCollapsed && (
                  <>
                    <span className="font-semibold flex-1 text-left">{section.label}</span>
                    <span className={`transition-transform duration-200 ${openSections[section.key] ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </>
                )}
              </button>
              
              {openSections[section.key] && (
                <div className="ml-4 space-y-1 animate-slideDown">
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm group ${
                        isActive(link.href)
                          ? "bg-black text-white font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-black"
                      }`}
                    >
                      <span className="text-sm">{link.icon}</span>
                      {!isCollapsed && (
                        <>
                          <span className="text-sm flex-1">{link.label}</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              toggleFavorite({ ...link, section: section.label, sectionIcon: section.icon });
                            }}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
                              isFavorite(link.href) ? "text-yellow-400" : "text-zionx-primary opacity-50 hover:text-yellow-400"
                            }`}
                          >
                            {isFavorite(link.href) ? "⭐" : "☆"}
                          </button>
                        </>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* User Info & Logout at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white">
        {/* User Role Indicator */}
        {!isCollapsed && (
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                {roleInfo?.icon || '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {localStorage.getItem('userName') || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500">{roleInfo?.name || 'Usuario'}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Logout Button */}
        <div className="p-3">
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/auth';
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <span className="text-lg">🚪</span>
            {!isCollapsed && <span className="font-medium text-sm">Cerrar Sesión</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;