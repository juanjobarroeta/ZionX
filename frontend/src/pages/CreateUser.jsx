import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import "./CreateUser.css";

// Role presets with permissions (no emojis — branded, per ZIONX).
const rolePresets = {
  admin: {
    name: "Administrador",
    description: "Acceso completo a todo el sistema",
    permissions: {
      canManageTeam: true, canApproveContent: true, canViewFinances: true,
      canManageClients: true, canViewAnalytics: true, canManagePayroll: true,
      canConfigureSystem: true,
    },
  },
  account_manager: {
    name: "Account Manager",
    description: "Gestiona clientes y proyectos",
    permissions: { canManageClients: true, canApproveContent: true, canViewAnalytics: true },
  },
  community_manager: {
    name: "Community Manager",
    description: "Gestiona contenido y redes sociales",
    permissions: { canCreateContent: true, canSchedulePosts: true, canViewAnalytics: true },
  },
  designer: {
    name: "Diseñador",
    description: "Crea contenido visual",
    permissions: { canCreateContent: true, canUploadFiles: true },
  },
  copywriter: {
    name: "Copywriter",
    description: "Crea contenido escrito",
    permissions: { canCreateContent: true },
  },
  accountant: {
    name: "Contabilidad",
    description: "Gestión financiera y contable",
    permissions: { canViewFinances: true, canManagePayroll: true, canCreateInvoices: true, canViewReports: true },
  },
  hr_manager: {
    name: "Recursos Humanos",
    description: "Gestión de personal y nómina",
    permissions: { canManageTeam: true, canManagePayroll: true },
  },
};

const initialsOf = (name) =>
  (name || "")
    .split(" ")
    .map((w) => w.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

const CreateUser = () => {
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "community_manager", store_id: "", permissions: "{}",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(Array.isArray(res.data) ? res.data : []);
      setListError("");
    } catch (err) {
      console.error("Error fetching users:", err);
      // Surface the cause instead of silently showing an empty list.
      const status = err.response?.status;
      setListError(
        status === 403
          ? "Sin permiso para ver los usuarios (se requiere rol de administrador)."
          : "No se pudieron cargar los usuarios. Intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name, email: user.email, password: "",
      role: user.role || "community_manager", store_id: user.store_id || "",
      permissions: JSON.stringify(user.permissions || {}),
    });
    setMessage(""); setError("");
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setForm({ name: "", email: "", password: "", role: "community_manager", store_id: "", permissions: "{}" });
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm("¿Desactivar este usuario?")) return;
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
      setForm({ ...form, role: e.target.value, permissions: JSON.stringify(preset) });
    } else {
      setForm({ ...form, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(""); setError("");

    if (!form.name || !form.email || (!editingUser && !form.password)) {
      setError("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (editingUser) {
        await axios.patch(
          `${API_BASE_URL}/admin/users/${editingUser.id}`,
          {
            name: form.name, email: form.email, role: form.role,
            permissions: JSON.parse(form.permissions || "{}"),
            ...(form.password ? { password: form.password } : {}),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage("Usuario actualizado correctamente");
        setEditingUser(null);
      } else {
        const res = await axios.post(
          `${API_BASE_URL}/admin/create-user`,
          { ...form, permissions: JSON.parse(form.permissions || "{}") },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage("Usuario creado correctamente");
        if (res.data.user) setUsers((prev) => [...prev, res.data.user]);
      }
      setForm({ name: "", email: "", password: "", role: "community_manager", store_id: "", permissions: "{}" });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Error al procesar la solicitud");
    }
  };

  const roleName = (role) => rolePresets[role]?.name || role || "—";

  return (
    <Layout>
      <div className="zxcu">
        <div className="zxcu-inner">
          <div className="zxcu-head">
            <div className="eyebrow">Configuración</div>
            <h1>Gestión de <span className="zxcu-serif">usuarios</span></h1>
            <div className="sub">Crear y administrar usuarios del sistema</div>
          </div>

          <div className="zxcu-grid">
            {/* Form */}
            <div className="zxcu-card form">
              <div className="zxcu-card-head">{editingUser ? "Editar usuario" : "Nuevo usuario"}</div>

              {message && <div className="zxcu-note ok">{message}</div>}
              {error && <div className="zxcu-note bad">{error}</div>}

              <form onSubmit={handleSubmit} className="zxcu-form">
                <label className="zxcu-label">Nombre completo *
                  <input className="zxcu-input" type="text" name="name" placeholder="Juan Pérez" value={form.name} onChange={handleChange} required />
                </label>

                <label className="zxcu-label">Correo electrónico *
                  <input className="zxcu-input" type="email" name="email" placeholder="juan@empresa.com" value={form.email} onChange={handleChange} required />
                </label>

                <label className="zxcu-label">Contraseña {editingUser ? "(dejar vacío para no cambiar)" : "*"}
                  <input className="zxcu-input" type="password" name="password" placeholder="••••••••" value={form.password} onChange={handleChange} required={!editingUser} />
                </label>

                <div className="zxcu-label">Rol del usuario *
                  <div className="zxcu-roles">
                    {Object.entries(rolePresets).map(([key, role]) => (
                      <label key={key} className={`zxcu-role${form.role === key ? " active" : ""}`}>
                        <input type="radio" name="role" value={key} checked={form.role === key} onChange={handleChange} className="zxcu-radio" />
                        <div className="zxcu-role-main">
                          <div className="n">{role.name}</div>
                          <div className="d">{role.description}</div>
                        </div>
                        {form.role === key && <span className="zxcu-check" aria-hidden="true">✓</span>}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="zxcu-actions">
                  {editingUser && (
                    <button type="button" className="zxcu-btn" onClick={handleCancelEdit}>Cancelar</button>
                  )}
                  <button type="submit" className="zxcu-btn primary">
                    {editingUser ? "Guardar cambios" : "Crear usuario"}
                  </button>
                </div>
              </form>
            </div>

            {/* Users list */}
            <div className="zxcu-card list">
              <div className="zxcu-card-head">
                Usuarios del sistema
                <span className="zxcu-count">{users.length} activo{users.length === 1 ? "" : "s"}</span>
              </div>

              {loading ? (
                <div className="zxcu-empty">Cargando usuarios…</div>
              ) : listError ? (
                <div className="zxcu-empty">
                  <div className="lead">No se pudo cargar la lista</div>
                  <div style={{ marginTop: 6 }}>{listError}</div>
                </div>
              ) : users.length === 0 ? (
                <div className="zxcu-empty">
                  <div className="lead">No hay usuarios registrados</div>
                </div>
              ) : (
                <div className="zxcu-users">
                  {users.map((user) => (
                    <div key={user.id} className={`zxcu-user${editingUser?.id === user.id ? " editing" : ""}`}>
                      <div className="zxcu-avatar">{initialsOf(user.name)}</div>
                      <div className="zxcu-user-main">
                        <div className="zxcu-user-name">{user.name}</div>
                        <div className="zxcu-user-email">{user.email}</div>
                        <div className="zxcu-user-tags">
                          <span className="zxcu-pill">{roleName(user.role)}</span>
                          {user.is_active === false && <span className="zxcu-pill bad">Inactivo</span>}
                        </div>
                      </div>
                      <div className="zxcu-user-actions">
                        <button className="zxcu-linkbtn" onClick={() => handleEdit(user)}>Editar</button>
                        <button className="zxcu-linkbtn danger" onClick={() => handleDeactivate(user.id)}>Desactivar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CreateUser;
