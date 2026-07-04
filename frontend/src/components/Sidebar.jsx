import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import GlobalSearch from "./GlobalSearch";
import { API_BASE_URL } from "../utils/constants";
import { getRoleInfo } from "../config/roles";
import "./AdminShell.css";

// Pixel-cross brand mark (same as landing)
const PixelMark = ({ size = 10, fill = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 3 3" aria-hidden="true">
    <rect x="0" y="0" width="1" height="1" fill={fill} />
    <rect x="2" y="0" width="1" height="1" fill={fill} />
    <rect x="1" y="1" width="1" height="1" fill={fill} />
    <rect x="0" y="2" width="1" height="1" fill={fill} />
    <rect x="2" y="2" width="1" height="1" fill={fill} />
  </svg>
);

// Grouped nav. Every link carries the role-section key it belongs to,
// so design grouping and role visibility stay independent.
const NAV_GROUPS = [
  {
    label: "Contenido",
    links: [
      { href: "/social-hub", label: "Hub de Publicaciones", section: "social_media" },
      { href: "/content-calendar", label: "Calendario", section: "social_media" },
      { href: "/team-dashboard", label: "Tareas", section: "social_media" },
      { href: "/projects", label: "Proyectos", section: "social_media" },
      { href: "/social/accounts", label: "Cuentas Meta", section: "social_media" },
    ],
  },
  {
    label: "Clientes",
    links: [
      { href: "/leads-inbox", label: "Leads", section: "leads", badge: "leads" },
      { href: "/crm", label: "Directorio", section: "clients" },
      { href: "/briefs", label: "Creative Briefs", section: "clients" },
      { href: "/customers/import", label: "Importar Clientes", section: "clients" },
    ],
  },
  {
    label: "Finanzas",
    links: [
      { sub: "Facturación" },
      { href: "/income", label: "Ingresos", section: "ingresos" },
      { href: "/income/subscriptions", label: "Suscripciones", section: "ingresos" },
      { href: "/income/payments", label: "Pagos", section: "ingresos" },
      { href: "/income/invoices", label: "Facturas", section: "ingresos" },
      { href: "/income/cfdi", label: "CFDIs (fiscal)", section: "ingresos" },
      { href: "/income/addons", label: "Add-ons", section: "ingresos" },
      { href: "/income/reports", label: "Reportes", section: "ingresos" },
      { sub: "Contabilidad" },
      { href: "/admin/expenses", label: "Gastos", section: "finanzas" },
      { href: "/admin/budgets", label: "Presupuestos", section: "finanzas" },
      { href: "/hr/financials", label: "Estados Financieros", section: "finanzas" },
    ],
  },
  {
    label: "Equipo",
    links: [
      { href: "/people", label: "Gestión de Equipo", section: "hr" },
      { href: "/team-management", label: "Miembros", section: "hr" },
      { href: "/hr/payroll", label: "Nómina", section: "hr" },
    ],
  },
  {
    label: "Configuración",
    links: [
      { href: "/admin/user-management", label: "Usuarios", section: "settings" },
      { href: "/admin/create-user", label: "Crear Usuario", section: "settings" },
    ],
  },
];

const Sidebar = () => {
  const location = useLocation();
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [newLeadsCount, setNewLeadsCount] = useState(0);

  const [userRole, setUserRole] = useState(() => localStorage.getItem("userRole") || "admin");

  useEffect(() => {
    const handleRoleChange = () => setUserRole(localStorage.getItem("userRole") || "admin");
    window.addEventListener("roleChanged", handleRoleChange);
    return () => window.removeEventListener("roleChanged", handleRoleChange);
  }, []);

  // Unread + leads badges
  useEffect(() => {
    const fetchCounts = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [notifRes, msgRes, leadsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/notifications/unread-count`, { headers }).catch(() => ({ data: { count: 0 } })),
        axios.get(`${API_BASE_URL}/api/messages/unread-count`, { headers }).catch(() => ({ data: { count: 0 } })),
        axios.get(`${API_BASE_URL}/leads`, { headers, params: { status: "new", limit: 100 } }).catch(() => ({ data: [] })),
      ]);
      setUnreadNotifCount(notifRes.data?.count || 0);
      setUnreadMsgCount(msgRes.data?.count || 0);
      const leads = Array.isArray(leadsRes.data) ? leadsRes.data : leadsRes.data?.leads || [];
      setNewLeadsCount(leads.length);
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cmd/Ctrl+K opens global search
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close the mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const roleInfo = getRoleInfo(userRole);
  const allowedSections = roleInfo?.sections || [];
  const canSee = (section) => userRole === "admin" || allowedSections.includes(section);

  const userName = localStorage.getItem("userName") || "Usuario";
  const initials = userName
    .split(" ")
    .map((w) => w.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isActive = (href) => location.pathname === href;

  const badgeFor = (link) => {
    if (link.badge === "leads" && newLeadsCount > 0) {
      return <span className="badge hot">{newLeadsCount > 99 ? "99+" : newLeadsCount}</span>;
    }
    return null;
  };

  const visibleGroups = NAV_GROUPS.map((group) => {
    const links = [];
    let pendingSub = null;
    for (const item of group.links) {
      if (item.sub) {
        pendingSub = item;
        continue;
      }
      if (!canSee(item.section)) continue;
      if (pendingSub) {
        links.push(pendingSub);
        pendingSub = null;
      }
      links.push(item);
    }
    return { ...group, links };
  }).filter((group) => group.links.some((l) => !l.sub));

  const logout = () => {
    localStorage.clear();
    window.location.href = "/auth";
  };

  return (
    <>
      <button className="zxs-burger" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">☰</button>
      {mobileOpen && <button className="zxs-scrim show" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />}

      <aside className={`zxs${mobileOpen ? " open" : ""}`}>
        <div className="zxs-head">
          <Link to="/dashboard" style={{ display: "flex", alignItems: "center" }}>
            <img src="/landing/logo-wordmark-white.webp" alt="ZIONX" />
          </Link>
          <span className="tag">{roleInfo?.name || "Admin"}</span>
        </div>

        <button className="zxs-search" onClick={() => setShowGlobalSearch(true)}>
          <span>⌕</span>
          <span>Buscar clientes, equipo…</span>
          <span className="kbd">⌘K</span>
        </button>

        <GlobalSearch isOpen={showGlobalSearch} onClose={() => setShowGlobalSearch(false)} />

        <nav className="zxs-nav">
          <div className="zxs-group">
            <Link to="/dashboard" className={`zxs-dash${isActive("/dashboard") ? " active" : ""}`}>
              <PixelMark size={10} />
              Dashboard
            </Link>
            <Link to="/messages" className={`zxs-link${isActive("/messages") ? " active" : ""}`}>
              Mensajes
              {unreadMsgCount > 0 && <span className="badge hot">{unreadMsgCount > 9 ? "9+" : unreadMsgCount}</span>}
            </Link>
            <Link to="/notifications" className={`zxs-link${isActive("/notifications") ? " active" : ""}`}>
              Notificaciones
              {unreadNotifCount > 0 && <span className="badge hot">{unreadNotifCount > 9 ? "9+" : unreadNotifCount}</span>}
            </Link>
          </div>

          {visibleGroups.map((group) => (
            <div className="zxs-group" key={group.label}>
              <span className="zxs-group-label">{group.label}</span>
              {group.links.map((item, i) =>
                item.sub ? (
                  <span className="zxs-sub-label" key={`sub-${i}`}>{item.sub}</span>
                ) : (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`zxs-link${isActive(item.href) ? " active" : ""}`}
                  >
                    {item.label}
                    {badgeFor(item)}
                  </Link>
                )
              )}
            </div>
          ))}
        </nav>

        <div className="zxs-foot">
          <div className="zxs-avatar">{initials || "U"}</div>
          <div className="who">
            <div className="name">{userName}</div>
            <div className="role">{roleInfo?.name || "Usuario"}</div>
          </div>
          <button className="zxs-logout" onClick={logout} title="Cerrar sesión">⏻</button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
