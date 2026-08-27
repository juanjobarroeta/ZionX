/**
 * Every place a person can go, named the way they'd say it.
 *
 * The app has ~68 routes and the sidebar shows 31 — the rest were reachable
 * only by typing a URL. Rather than growing the sidebar (a longer list is not
 * a better map), the command palette searches this. Keywords carry the words
 * people actually use, including the ones the label doesn't contain.
 *
 * `section` matches config/roles so a viewer is never offered a page they
 * cannot open.
 */
export const DESTINATIONS = [
  // Contenido
  { path: "/social-hub", label: "Hub de publicaciones", group: "Contenido", section: "social_media", keywords: "posts publicaciones cola programadas fallidas" },
  { path: "/content-calendar", label: "Calendario de contenido", group: "Contenido", section: "social_media", keywords: "calendario planear programar semana mes story reel" },
  { path: "/approvals", label: "Aprobaciones", group: "Contenido", section: "social_media", keywords: "aprobar cliente revisión visto bueno" },
  { path: "/social-analytics", label: "Rendimiento", group: "Contenido", section: "social_media", keywords: "métricas analytics vistas alcance interacciones gráficas" },

  // Trabajo
  { path: "/my-work", label: "Mi trabajo", group: "Trabajo", section: "social_media", keywords: "pendientes mis tareas etapas cola personal" },
  { path: "/tareas", label: "Tareas", group: "Trabajo", section: "social_media", keywords: "tareas equipo pendientes proyecto carpeta" },
  { path: "/projects", label: "Proyectos", group: "Trabajo", section: "social_media", keywords: "proyectos campañas entregables" },
  { path: "/team-dashboard", label: "Dashboard de equipo", group: "Trabajo", section: "social_media", keywords: "equipo carga trabajo supervisión" },

  // Clientes
  { path: "/crm", label: "Directorio de clientes", group: "Clientes", section: "clients", keywords: "clientes directorio crm cuentas" },
  { path: "/funnel", label: "Funnel", group: "Clientes", section: "leads", keywords: "embudo pipeline oportunidades" },
  { path: "/leads-inbox", label: "Leads", group: "Clientes", section: "leads", keywords: "prospectos bandeja whatsapp entrantes" },
  { path: "/leads-capture", label: "Capturar lead", group: "Clientes", section: "leads", keywords: "nuevo lead alta manual prospecto" },
  { path: "/leads-manage", label: "Gestión de leads", group: "Clientes", section: "leads", keywords: "administrar leads asignar etapa" },
  { path: "/leads-analytics", label: "Analíticas de leads", group: "Clientes", section: "leads", keywords: "conversión origen fuentes reporte leads" },
  { path: "/briefs", label: "Creative briefs", group: "Clientes", section: "clients", keywords: "brief creativo cuestionario" },
  { path: "/create-customer", label: "Nuevo cliente", group: "Clientes", section: "clients", keywords: "alta cliente crear registrar" },
  { path: "/customers/import", label: "Importar clientes", group: "Clientes", section: "clients", keywords: "importar excel csv masivo" },

  // Publicidad
  { path: "/ads/accounts", label: "Campañas", group: "Publicidad", section: "social_media", keywords: "anuncios ads inversión spend meta" },
  { path: "/conexiones", label: "Conexiones", group: "Publicidad", section: "social_media", keywords: "cuentas meta instagram facebook token reconectar sincronizar salud" },
  { path: "/social/accounts", label: "Conectar cuenta de Meta", group: "Publicidad", section: "social_media", keywords: "oauth conectar instagram facebook permisos" },

  // Finanzas
  { path: "/income", label: "Ingresos", group: "Finanzas", section: "ingresos", keywords: "ingresos revenue facturación resumen" },
  { path: "/income/subscriptions", label: "Suscripciones", group: "Finanzas", section: "ingresos", keywords: "planes mensualidad iguala recurrente" },
  { path: "/income/cobros", label: "Cobros", group: "Finanzas", section: "ingresos", keywords: "cobrar pendiente vencido cartera" },
  { path: "/income/payments", label: "Pagos", group: "Finanzas", section: "ingresos", keywords: "pagos abonos recibido" },
  { path: "/income/invoices", label: "Facturas", group: "Finanzas", section: "ingresos", keywords: "cfdi facturación timbrado" },
  { path: "/income/invoice-generator", label: "Generar factura", group: "Finanzas", section: "ingresos", keywords: "nueva factura cfdi timbrar emitir" },
  { path: "/income/addons", label: "Add-ons", group: "Finanzas", section: "ingresos", keywords: "servicios extras adicionales" },
  { path: "/income/reports", label: "Reportes de ingresos", group: "Finanzas", section: "ingresos", keywords: "reporte ingresos mensual" },
  { path: "/admin/expenses", label: "Gastos", group: "Finanzas", section: "finanzas", keywords: "egresos compras proveedores" },
  { path: "/bancos", label: "Bancos", group: "Finanzas", section: "finanzas", keywords: "conciliación estado de cuenta movimientos" },
  { path: "/admin/budgets", label: "Presupuestos", group: "Finanzas", section: "finanzas", keywords: "presupuesto budget" },
  { path: "/hr/financials", label: "Estados financieros", group: "Finanzas", section: "finanzas", keywords: "balance resultados p&l" },
  { path: "/finance/estados", label: "Estados fiscales", group: "Finanzas", section: "finanzas", keywords: "sat fiscal declaraciones" },

  // Equipo
  { path: "/people", label: "Empleados", group: "Equipo", section: "hr", keywords: "personal recursos humanos altas" },
  { path: "/team-management", label: "Gestión de equipo", group: "Equipo", section: "hr", keywords: "miembros roles accesos" },
  { path: "/hr/payroll", label: "Nómina", group: "Equipo", section: "hr", keywords: "pago sueldos periodo nómina" },
  { path: "/hr/nomina-fiscal", label: "Nómina fiscal", group: "Equipo", section: "hr", keywords: "cfdi nómina timbrado sat" },

  // Sistema
  { path: "/dashboard", label: "Dashboard", group: "Sistema", section: null, keywords: "inicio home resumen general" },
  { path: "/messages", label: "Mensajes", group: "Sistema", section: null, keywords: "chat conversaciones equipo" },
  { path: "/notifications", label: "Notificaciones", group: "Sistema", section: null, keywords: "avisos alertas" },
  { path: "/admin/create-user", label: "Crear usuario", group: "Sistema", section: "settings", keywords: "alta usuario acceso invitar" },
];
