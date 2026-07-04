// =====================================================
// MARKETING AGENCY ROLE DEFINITIONS
// =====================================================
// Each role sees only what they need for a clean, focused experience

export const MARKETING_ROLES = {
  // ─────────────────────────────────────────────────────
  // ADMIN / DIRECTOR - Sees everything
  // ─────────────────────────────────────────────────────
  admin: {
    name: 'Administrador',
    description: 'Acceso completo a todo el sistema',
    icon: '👑',
    sections: ['social_media', 'clients', 'leads', 'ingresos', 'hr', 'finanzas', 'settings'],
    permissions: {
      canManageTeam: true,
      canApproveContent: true,
      canViewFinances: true,
      canManageClients: true,
      canViewAnalytics: true,
      canManagePayroll: true,
      canConfigureSystem: true,
    }
  },

  // ─────────────────────────────────────────────────────
  // ACCOUNT MANAGER - Client-facing, manages projects
  // ─────────────────────────────────────────────────────
  account_manager: {
    name: 'Account Manager',
    description: 'Gestiona clientes y proyectos',
    icon: '💼',
    sections: ['social_media', 'clients', 'leads'],
    permissions: {
      canManageClients: true,
      canApproveContent: true,
      canViewAnalytics: true,
      canManageTeam: false,
      canViewFinances: false,
    },
    visiblePages: [
      '/dashboard',
      '/clientes',
      '/clientes/:id',
      '/leads',
      '/content-calendar',
      '/team-dashboard',
      '/social-analytics',
      '/social-hub',
      '/notifications',
      '/messages',
    ]
  },

  // ─────────────────────────────────────────────────────
  // COMMUNITY MANAGER - Social media & content
  // ─────────────────────────────────────────────────────
  community_manager: {
    name: 'Community Manager',
    description: 'Gestiona contenido y redes sociales',
    icon: '📱',
    sections: ['social_media'],
    permissions: {
      canCreateContent: true,
      canSchedulePosts: true,
      canViewAnalytics: true,
      canApproveContent: false,
      canManageClients: false,
      canViewFinances: false,
    },
    visiblePages: [
      '/dashboard',
      '/employee/:employeeId',
      '/content-calendar',
      '/social-hub',
      '/social-analytics',
      '/team-dashboard',
      '/social/accounts',
      '/notifications',
      '/messages',
    ]
  },

  // ─────────────────────────────────────────────────────
  // DESIGNER - Creative work
  // ─────────────────────────────────────────────────────
  designer: {
    name: 'Diseñador',
    description: 'Crea contenido visual',
    icon: '🎨',
    sections: ['social_media'],
    permissions: {
      canCreateContent: true,
      canUploadFiles: true,
      canViewAnalytics: false,
      canApproveContent: false,
      canManageClients: false,
    },
    visiblePages: [
      '/dashboard',
      '/employee/:employeeId',
      '/content-calendar',
      '/team-dashboard',
      '/notifications',
      '/messages',
    ]
  },

  // ─────────────────────────────────────────────────────
  // COPYWRITER - Text content
  // ─────────────────────────────────────────────────────
  copywriter: {
    name: 'Copywriter',
    description: 'Crea contenido escrito',
    icon: '✍️',
    sections: ['social_media'],
    permissions: {
      canCreateContent: true,
      canViewAnalytics: false,
      canApproveContent: false,
    },
    visiblePages: [
      '/dashboard',
      '/employee/:employeeId',
      '/content-calendar',
      '/team-dashboard',
      '/notifications',
      '/messages',
    ]
  },

  // ─────────────────────────────────────────────────────
  // FINANCE / ACCOUNTANT - Money matters only
  // ─────────────────────────────────────────────────────
  accountant: {
    name: 'Contabilidad',
    description: 'Gestión financiera y contable',
    icon: '📊',
    sections: ['ingresos', 'finanzas', 'hr'],
    permissions: {
      canViewFinances: true,
      canManagePayroll: true,
      canCreateInvoices: true,
      canViewReports: true,
      canManageClients: false,
      canApproveContent: false,
    },
    visiblePages: [
      '/dashboard',
      '/income',
      '/income/invoices',
      '/income/payments',
      '/income/reports',
      '/accounting',
      '/balance-sheet',
      '/income-statement',
      '/payroll',
      '/notifications',
      '/messages',
    ]
  },

  // ─────────────────────────────────────────────────────
  // HR MANAGER - People management
  // ─────────────────────────────────────────────────────
  hr_manager: {
    name: 'Recursos Humanos',
    description: 'Gestión de personal y nómina',
    icon: '👥',
    sections: ['hr'],
    permissions: {
      canManageTeam: true,
      canManagePayroll: true,
      canViewFinances: false,
      canApproveContent: false,
    },
    visiblePages: [
      '/dashboard',
      '/people',
      '/payroll',
      '/team-management',
      '/notifications',
      '/messages',
    ]
  },
};

// ─────────────────────────────────────────────────────
// SIDEBAR SECTIONS CONFIGURATION
// ─────────────────────────────────────────────────────
export const SIDEBAR_SECTIONS = {
  social_media: {
    key: 'social_media',
    icon: '📱',
    label: 'Social Media & Contenido',
    color: 'from-pink-500 to-rose-500',
    links: [
      { href: '/social/accounts', label: 'Cuentas Meta', icon: '🔗' },
      { href: '/social-hub', label: 'Hub de Publicaciones', icon: '📱' },
      { href: '/content-calendar', label: 'Calendario de Contenido', icon: '📅' },
      { href: '/team-dashboard', label: 'Tareas del Equipo', icon: '✅' },
      { href: '/social-analytics', label: 'Analíticas', icon: '📊' },
    ],
  },
  clients: {
    key: 'clients',
    icon: '👥',
    label: 'Clientes',
    color: 'from-blue-500 to-cyan-500',
    links: [
      { href: '/clientes', label: 'Todos los Clientes', icon: '📋' },
      { href: '/clientes/nuevo', label: 'Nuevo Cliente', icon: '➕' },
    ],
  },
  leads: {
    key: 'leads',
    icon: '🎯',
    label: 'Leads & Prospectos',
    color: 'from-green-500 to-emerald-500',
    links: [
      { href: '/leads', label: 'Pipeline de Leads', icon: '🎯' },
      { href: '/leads/nuevo', label: 'Nuevo Lead', icon: '➕' },
    ],
  },
  ingresos: {
    key: 'ingresos',
    icon: '💰',
    label: 'Ingresos',
    color: 'from-green-500 to-teal-500',
    links: [
      { href: '/income', label: 'Dashboard Ingresos', icon: '📊' },
      { href: '/income/invoices', label: 'Facturas', icon: '🧾' },
      { href: '/income/payments', label: 'Pagos', icon: '💳' },
      { href: '/income/reports', label: 'Reportes', icon: '📈' },
    ],
  },
  hr: {
    key: 'hr',
    icon: '👥',
    label: 'Recursos Humanos',
    color: 'from-purple-500 to-violet-500',
    links: [
      { href: '/people', label: 'Gestión de Personal', icon: '👥' },
      { href: '/payroll', label: 'Nómina', icon: '💰' },
      { href: '/team-management', label: 'Equipo de Trabajo', icon: '🏢' },
    ],
  },
  finanzas: {
    key: 'finanzas',
    icon: '💰',
    label: 'Finanzas',
    color: 'from-green-500 to-emerald-600',
    links: [
      { href: '/admin/expenses', label: 'Gastos', icon: '💸' },
      { href: '/admin/budgets', label: 'Presupuestos', icon: '📊' },
      { href: '/income-statement', label: 'Estado de Resultados', icon: '📈' },
      { href: '/balance-sheet', label: 'Balance General', icon: '⚖️' },
    ],
  },
  settings: {
    key: 'settings',
    icon: '⚙️',
    label: 'Configuración',
    color: 'from-gray-500 to-gray-600',
    links: [
      { href: '/settings', label: 'Ajustes', icon: '⚙️' },
      { href: '/admin/users', label: 'Usuarios', icon: '👤' },
    ],
  },
};

// ─────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────

/**
 * Get sections visible to a specific role
 */
export const getSectionsForRole = (role) => {
  const roleConfig = MARKETING_ROLES[role];
  if (!roleConfig) return Object.values(SIDEBAR_SECTIONS); // Admin fallback
  
  return roleConfig.sections.map(sectionKey => SIDEBAR_SECTIONS[sectionKey]).filter(Boolean);
};

/**
 * Check if a user can access a specific page
 */
export const canAccessPage = (role, path) => {
  const roleConfig = MARKETING_ROLES[role];
  if (!roleConfig || role === 'admin') return true; // Admin can access everything
  
  if (roleConfig.visiblePages) {
    return roleConfig.visiblePages.some(allowedPath => {
      // Handle dynamic routes like /clientes/:id
      const regex = new RegExp('^' + allowedPath.replace(/:[^/]+/g, '[^/]+') + '$');
      return regex.test(path);
    });
  }
  
  return true;
};

/**
 * Check if a user has a specific permission
 */
export const hasPermission = (role, permission) => {
  const roleConfig = MARKETING_ROLES[role];
  if (!roleConfig || role === 'admin') return true;
  
  return roleConfig.permissions?.[permission] === true;
};

/**
 * Get role display info
 */
export const getRoleInfo = (role) => {
  return MARKETING_ROLES[role] || MARKETING_ROLES.admin;
};

export default MARKETING_ROLES;

