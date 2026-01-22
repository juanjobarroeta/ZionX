import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import { MARKETING_ROLES } from "../config/roles";

// Role presets with permissions
const rolePresets = {
  admin: {
    name: "Administrador",
    icon: "👑",
    description: "Acceso completo a todo el sistema",
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
  account_manager: {
    name: "Account Manager",
    icon: "💼",
    description: "Gestiona clientes y proyectos",
    permissions: {
      canManageClients: true,
      canApproveContent: true,
      canViewAnalytics: true,
    }
  },
  community_manager: {
    name: "Community Manager",
    icon: "📱",
    description: "Gestiona contenido y redes sociales",
    permissions: {
      canCreateContent: true,
      canSchedulePosts: true,
      canViewAnalytics: true,
    }
  },
  designer: {
    name: "Diseñador",
    icon: "🎨",
    description: "Crea contenido visual",
    permissions: {
      canCreateContent: true,
      canUploadFiles: true,
    }
  },
  copywriter: {
    name: "Copywriter",
    icon: "✍️",
    description: "Crea contenido escrito",
    permissions: {
      canCreateContent: true,
    }
  },
  accountant: {
    name: "Contabilidad",
    icon: "📊",
    description: "Gestión financiera y contable",
    permissions: {
      canViewFinances: true,
      canManagePayroll: true,
      canCreateInvoices: true,
      canViewReports: true,
    }
  },
  hr_manager: {
    name: "Recursos Humanos",
    icon: "👥",
    description: "Gestión de personal y nómina",
    permissions: {
      canManageTeam: true,
      canManagePayroll: true,
    }
  },
};

const CreateUser = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "community_manager",
    store_id: "",
    permissions: "{}",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role || "community_manager",
      store_id: user.store_id || "",
      permissions: JSON.stringify(user.permissions || {}),
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setForm({
      name: "",
      email: "",
      password: "",
      role: "community_manager",
      store_id: "",
      permissions: "{}",
    });
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm("¿Estás seguro de desactivar este usuario?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE_URL}/admin/users/${userId}`,
        { is_active: false },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setMessage("Usuario desactivado");
    } catch (err) {
      console.error("Error deactivating user:", err);
      setError("Error al desactivar usuario");
    }
  };

  const handleChange = (e) => {
    if (e.target.name === "role") {
      const preset = rolePresets[e.target.value]?.permissions || {};
      setForm({
        ...form,
        [e.target.name]: e.target.value,
        permissions: JSON.stringify(preset),
      });
    } else {
      setForm({ ...form, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    
    if (!form.name || !form.email || (!editingUser && !form.password)) {
      setError("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      
      if (editingUser) {
        // Update existing user
        await axios.patch(
          `${API_BASE_URL}/admin/users/${editingUser.id}`,
          {
            name: form.name,
            email: form.email,
            role: form.role,
            permissions: JSON.parse(form.permissions || "{}"),
            ...(form.password ? { password: form.password } : {})
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage("Usuario actualizado correctamente");
        setEditingUser(null);
      } else {
        // Create new user
        const res = await axios.post(
          `${API_BASE_URL}/admin/create-user`,
          {
            ...form,
            permissions: JSON.parse(form.permissions || "{}")
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage("Usuario creado correctamente");
        if (res.data.user) {
          setUsers((prev) => [...prev, res.data.user]);
        }
      }
      
      setForm({
        name: "",
        email: "",
        password: "",
        role: "community_manager",
        store_id: "",
        permissions: "{}"
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Error al procesar la solicitud");
    }
  };

  const getRoleInfo = (role) => rolePresets[role] || { name: role, icon: "👤", description: "" };

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">👥 Gestión de Usuarios</h1>
            <p className="text-gray-500 mt-1">Crear y administrar usuarios del sistema</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create/Edit Form */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingUser ? "✏️ Editar Usuario" : "➕ Nuevo Usuario"}
                </h2>
                
                {message && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                    ✅ {message}
                  </div>
                )}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    ❌ {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      name="name"
                      placeholder="Juan Pérez"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black transition-all"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Correo electrónico *
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="juan@empresa.com"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black transition-all"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña {editingUser ? "(dejar vacío para no cambiar)" : "*"}
                    </label>
                    <input
                      type="password"
                      name="password"
                      placeholder="••••••••"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black transition-all"
                      value={form.password}
                      onChange={handleChange}
                      required={!editingUser}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rol del usuario *
                    </label>
                    <div className="space-y-2">
                      {Object.entries(rolePresets).map(([key, role]) => (
                        <label
                          key={key}
                          className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                            form.role === key
                              ? "border-black bg-gray-50 ring-2 ring-black"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="role"
                            value={key}
                            checked={form.role === key}
                            onChange={handleChange}
                            className="sr-only"
                          />
                          <span className="text-xl">{role.icon}</span>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{role.name}</p>
                            <p className="text-xs text-gray-500">{role.description}</p>
                          </div>
                          {form.role === key && (
                            <span className="text-black">✓</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    {editingUser && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 font-medium transition-colors"
                    >
                      {editingUser ? "💾 Guardar Cambios" : "➕ Crear Usuario"}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Users List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Usuarios del Sistema</h2>
                  <p className="text-sm text-gray-500 mt-1">{users.length} usuarios activos</p>
                </div>

                {loading ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black mx-auto"></div>
                    <p className="text-gray-500 mt-4">Cargando usuarios...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <span className="text-4xl block mb-3">👥</span>
                    <p>No hay usuarios registrados</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {users.map((user) => {
                      const roleInfo = getRoleInfo(user.role);
                      return (
                        <div
                          key={user.id}
                          className={`p-4 hover:bg-gray-50 transition-colors ${
                            editingUser?.id === user.id ? "bg-blue-50" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xl">
                                {roleInfo.icon}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{user.name}</p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                                    {roleInfo.name}
                                  </span>
                                  {user.is_active === false && (
                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                      Inactivo
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(user)}
                                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => handleDeactivate(user.id)}
                                className="px-4 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CreateUser;
