import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

// Comprehensive permission definitions
const PERMISSION_CATEGORIES = {
  "Gestión de Préstamos": {
    icon: "💰",
    permissions: {
      canAccessLoanQuotes: "Acceder al Cotizador",
      canCreateLoans: "Crear Préstamos", 
      canApproveLoan: "Aprobar Préstamos",
      canRegisterPayments: "Registrar Pagos",
      canViewLoanDetails: "Ver Detalles de Préstamos",
      canResolveLoan: "Resolver Préstamos (Liquidar/Castigar)"
    }
  },
  "Inventario y Productos": {
    icon: "📦",
    permissions: {
      canManageInventory: "Administrar Inventario",
      canEditInventory: "Editar Inventario",
      canAssignIMEI: "Asignar IMEI",
      canTransferInventory: "Transferir Inventario",
      canReceiveInventory: "Recibir Inventario",
      canRequestInventory: "Solicitar Inventario"
    }
  },
  "Contabilidad y Finanzas": {
    icon: "📊",
    permissions: {
      canViewAccounting: "Ver Contabilidad",
      canViewReports: "Ver Reportes",
      canClosePeriods: "Cerrar Períodos Contables",
      canManualEntry: "Hacer Asientos Manuales",
      canViewBalanceSheet: "Ver Balance General",
      canViewIncomeStatement: "Ver Estado de Resultados"
    }
  },
  "Administración": {
    icon: "⚙️",
    permissions: {
      canManageUsers: "Gestionar Usuarios",
      canViewAuditLogs: "Ver Logs de Auditoría",
      canManageStores: "Gestionar Sucursales",
      canConfigureSystem: "Configurar Sistema",
      canResetDatabase: "Reiniciar Base de Datos",
      canManagePromotions: "Gestionar Promociones"
    }
  },
  "General": {
    icon: "🏠",
    permissions: {
      canViewDashboard: "Ver Dashboard",
      canAccessCRM: "Acceder al CRM",
      canManageCustomers: "Gestionar Clientes",
      canViewNotifications: "Ver Notificaciones"
    }
  }
};

const ROLE_TEMPLATES = {
  admin: {
    name: "Administrador",
    description: "Acceso completo al sistema",
    permissions: Object.values(PERMISSION_CATEGORIES).reduce((acc, category) => {
      Object.keys(category.permissions).forEach(key => acc[key] = true);
      return acc;
    }, {})
  },
  store_manager: {
    name: "Gerente de Sucursal",
    description: "Gestión completa de sucursal",
    permissions: {
      canViewDashboard: true,
      canAccessLoanQuotes: true,
      canCreateLoans: true,
      canApproveLoan: true,
      canRegisterPayments: true,
      canViewLoanDetails: true,
      canManageInventory: true,
      canEditInventory: true,
      canAssignIMEI: true,
      canTransferInventory: true,
      canReceiveInventory: true,
      canRequestInventory: true,
      canAccessCRM: true,
      canManageCustomers: true,
      canViewReports: true,
      canViewNotifications: true
    }
  },
  store_staff: {
    name: "Personal de Sucursal",
    description: "Operaciones básicas de sucursal",
    permissions: {
      canViewDashboard: true,
      canAccessLoanQuotes: true,
      canCreateLoans: true,
      canRegisterPayments: true,
      canViewLoanDetails: true,
      canAccessCRM: true,
      canManageCustomers: true,
      canViewNotifications: true
    }
  },
  warehouse: {
    name: "Personal de Almacén",
    description: "Gestión de inventario",
    permissions: {
      canViewDashboard: true,
      canManageInventory: true,
      canEditInventory: true,
      canAssignIMEI: true,
      canTransferInventory: true,
      canReceiveInventory: true,
      canRequestInventory: true,
      canViewNotifications: true
    }
  },
  accounting: {
    name: "Contabilidad",
    description: "Gestión financiera y contable",
    permissions: {
      canViewDashboard: true,
      canViewAccounting: true,
      canViewReports: true,
      canClosePeriods: true,
      canManualEntry: true,
      canViewBalanceSheet: true,
      canViewIncomeStatement: true,
      canViewNotifications: true
    }
  }
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "store_staff",
    store_id: "",
    phone: "",
    permissions: {},
    avatar_url: ""
  });

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // Load initial data
  useEffect(() => {
    fetchUsers();
    fetchStores();
    if (activeTab === "activity") {
      fetchUserActivity();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/admin/users`, { headers });
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/stores`, { headers });
      setStores(response.data || []);
    } catch (error) {
      console.error("Error fetching stores:", error);
      setStores([]);
    }
  };

  const fetchAuditLogs = async (userId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/users/${userId}/audit`, { headers });
      setAuditLogs(response.data);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      setAuditLogs([]);
    }
  };

  const fetchUserActivity = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/user-activity?days=30`, { headers });
      setUserActivity(response.data);
    } catch (error) {
      console.error("Error fetching user activity:", error);
      setUserActivity([]);
    }
  };

  const handleRoleChange = (role) => {
    const template = ROLE_TEMPLATES[role];
    setFormData({
      ...formData,
      role,
      permissions: template ? template.permissions : {}
    });
  };

  const handlePermissionToggle = (permission) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [permission]: !formData.permissions[permission]
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedUser) {
        // Update user
        await axios.put(`${API_BASE_URL}/admin/users/${selectedUser.id}`, formData, { headers });
      } else {
        // Create user
        await axios.post(`${API_BASE_URL}/admin/users`, formData, { headers });
      }
      
      fetchUsers();
      setShowCreateModal(false);
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving user:", error);
      alert(error.response?.data?.error || "Error al guardar usuario");
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("¿Estás seguro de que quieres desactivar este usuario?")) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/admin/users/${userId}`, { headers });
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "store_staff",
      store_id: "",
      phone: "",
      permissions: ROLE_TEMPLATES.store_staff.permissions,
      avatar_url: ""
    });
    setSelectedUser(null);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      store_id: user.store_id || "",
      phone: user.phone || "",
      permissions: user.permissions || {},
      avatar_url: user.avatar_url || ""
    });
    setShowEditModal(true);
  };

  const openAuditModal = (user) => {
    setSelectedUser(user);
    fetchAuditLogs(user.id);
    setShowAuditModal(true);
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesStatus = !filterStatus || 
                         (filterStatus === "active" && user.is_active) ||
                         (filterStatus === "inactive" && !user.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Get user avatar
  const getUserAvatar = (user) => {
    if (user.avatar_url) return user.avatar_url;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1f2937&color=ffffff&size=128`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (user) => {
    if (!user.is_active) {
      return <span className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded-full">Inactivo</span>;
    }
    
    const daysSinceLogin = user.last_login ? 
      Math.floor((new Date() - new Date(user.last_login)) / (1000 * 60 * 60 * 24)) : null;
    
    if (!user.last_login) {
      return <span className="px-2 py-1 text-xs bg-yellow-900 text-yellow-300 rounded-full">Nuevo</span>;
    }
    
    if (daysSinceLogin <= 1) {
      return <span className="px-2 py-1 text-xs bg-green-900 text-green-300 rounded-full">Activo</span>;
    }
    
    if (daysSinceLogin <= 7) {
      return <span className="px-2 py-1 text-xs bg-blue-900 text-blue-300 rounded-full">Reciente</span>;
    }
    
    return <span className="px-2 py-1 text-xs bg-gray-700 text-neutral-700 rounded-full">Inactivo</span>;
  };

  const PermissionMatrix = () => (
    <div className="space-y-6">
      {Object.entries(PERMISSION_CATEGORIES).map(([categoryName, category]) => (
        <div key={categoryName} className="bg-white rounded-lg p-4">
          <h4 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
            <span className="text-lg">{category.icon}</span>
            {categoryName}
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(category.permissions).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.permissions[key] || false}
                  onChange={() => handlePermissionToggle(key)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-neutral-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-neutral-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-gray-950 text-neutral-800 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-neutral-800 mb-2">👥 Gestión de Usuarios</h1>
              <p className="text-neutral-600">Administra usuarios, permisos y auditoría del sistema</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-neutral-800 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <span className="text-lg">➕</span>
              Crear Usuario
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gradient-to-br from-surface-50 to-surface-100 p-1 rounded-lg">
            {[
              { id: "users", label: "👥 Usuarios", count: users.length },
              { id: "activity", label: "📊 Actividad", count: null }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 rounded-md font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-neutral-800"
                    : "text-neutral-600 hover:text-neutral-800 hover:bg-white"
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className="ml-2 px-2 py-1 bg-gray-700 text-xs rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Filters */}
          {activeTab === "users" && (
            <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="🔍 Buscar usuarios..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Todos los roles</option>
                    {Object.entries(ROLE_TEMPLATES).map(([key, template]) => (
                      <option key={key} value={key}>{template.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Todos los estados</option>
                    <option value="active">Activos</option>
                    <option value="inactive">Inactivos</option>
                  </select>
                </div>
                <div className="text-sm text-neutral-600 flex items-center">
                  Mostrando {filteredUsers.length} de {users.length} usuarios
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          {activeTab === "users" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredUsers.map(user => (
                <div key={user.id} className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-gray-800">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={getUserAvatar(user)}
                        alt={user.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div>
                        <h3 className="font-semibold text-neutral-800">{user.name}</h3>
                        <p className="text-sm text-neutral-600">{user.email}</p>
                      </div>
                    </div>
                    {getStatusBadge(user)}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Rol:</span>
                      <span className="text-neutral-800 font-medium">
                        {ROLE_TEMPLATES[user.role]?.name || user.role}
                      </span>
                    </div>
                    {user.store_name && (
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-600">Sucursal:</span>
                        <span className="text-neutral-800">{user.store_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Último acceso:</span>
                      <span className="text-neutral-800">
                        {user.last_login ? formatDate(user.last_login) : "Nunca"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Sesiones:</span>
                      <span className="text-neutral-800">{user.login_count || 0}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-neutral-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => openAuditModal(user)}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-neutral-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      📋 Auditoría
                    </button>
                    {user.is_active && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="bg-red-600 hover:bg-red-700 text-neutral-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity Tab Content */}
          {activeTab === "activity" && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-neutral-800 mb-4">📊 Actividad del Sistema (Últimos 30 días)</h3>
                {userActivity.length > 0 ? (
                  <div className="space-y-3">
                    {userActivity.map((activity) => (
                      <div key={activity.id} className="bg-white rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-primary-500 font-medium">{activity.action}</span>
                              {activity.resource_type && (
                                <span className="px-2 py-1 bg-purple-900 text-purple-300 text-xs rounded">
                                  {activity.resource_type}
                                </span>
                              )}
                              {activity.resource_id && (
                                <span className="px-2 py-1 bg-gray-700 text-neutral-700 text-xs rounded">
                                  ID: {activity.resource_id}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-neutral-600">
                              <span className="font-medium text-neutral-800">{activity.user_name || 'Usuario desconocido'}</span>
                              {activity.ip_address && (
                                <span className="ml-3">🌐 {activity.ip_address}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-neutral-700">
                              {formatDate(activity.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-neutral-600 mb-2">📊</div>
                    <p className="text-neutral-600">No hay actividad registrada en los últimos 30 días</p>
                    <p className="text-sm text-gray-500 mt-2">
                      La actividad aparecerá aquí cuando los usuarios realicen acciones en el sistema
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create/Edit Modal */}
          {(showCreateModal || showEditModal) && createPortal(
            <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-neutral-800">
                    {selectedUser ? "✏️ Editar Usuario" : "➕ Crear Usuario"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      resetForm();
                    }}
                    className="text-neutral-600 hover:text-neutral-800 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4">📝 Información Básica</h3>
                      
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Nombre</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          {selectedUser ? "Nueva Contraseña (opcional)" : "Contraseña"}
                        </label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required={!selectedUser}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Teléfono</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Rol</label>
                        <select
                          value={formData.role}
                          onChange={(e) => handleRoleChange(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {Object.entries(ROLE_TEMPLATES).map(([key, template]) => (
                            <option key={key} value={key}>{template.name}</option>
                          ))}
                        </select>
                        {ROLE_TEMPLATES[formData.role] && (
                          <p className="text-sm text-neutral-600 mt-1">
                            {ROLE_TEMPLATES[formData.role].description}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Sucursal</label>
                        <select
                          value={formData.store_id}
                          onChange={(e) => setFormData({...formData, store_id: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Sin sucursal asignada</option>
                          {stores.map(store => (
                            <option key={store.id} value={store.id}>{store.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Permissions */}
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4">🔐 Permisos</h3>
                      <div className="max-h-96 overflow-y-auto">
                        <PermissionMatrix />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t border-neutral-200">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setShowEditModal(false);
                        resetForm();
                      }}
                      className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-neutral-800 rounded-lg font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-neutral-800 rounded-lg font-medium transition-colors"
                    >
                      {selectedUser ? "Actualizar Usuario" : "Crear Usuario"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* Audit Modal */}
          {showAuditModal && createPortal(
            <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-neutral-800">
                    📋 Auditoría de {selectedUser?.name}
                  </h2>
                  <button
                    onClick={() => setShowAuditModal(false)}
                    className="text-neutral-600 hover:text-neutral-800 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {auditLogs.map(log => (
                    <div key={log.id} className="bg-white rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-semibold text-neutral-800">{log.action}</span>
                          {log.resource_type && (
                            <span className="ml-2 px-2 py-1 bg-blue-900 text-blue-300 text-xs rounded">
                              {log.resource_type}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-neutral-600">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      {log.ip_address && (
                        <p className="text-sm text-neutral-600">IP: {log.ip_address}</p>
                      )}
                      {log.user_agent && (
                        <p className="text-sm text-neutral-600 truncate">
                          Usuario: {log.user_agent}
                        </p>
                      )}
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <div className="text-center text-neutral-600 py-8">
                      No hay registros de auditoría
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </Layout>
  );
};

export default UserManagement;
