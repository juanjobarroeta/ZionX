import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const PeopleManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // all, active, inactive
  const [viewMode, setViewMode] = useState("cards"); // cards, table
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  
  const [formData, setFormData] = useState({
    // Basic Info
    name: "", email: "", phone: "", avatar_url: "",
    // Role & Department
    role: "", department: "", employee_type: "full_time",
    // Payroll Info
    monthly_wage: "", payment_frequency: "monthly",
    bank_name: "", clabe: "",
    // Legal/Tax Info
    rfc: "", curp: "", imss_number: "",
    // Contract Info
    hire_date: "", contract_type: "permanent",
    // Team/Skills Info
    skills: [], max_daily_tasks: 5,
    // Contact Info
    address: "", emergency_contact: "", emergency_phone: "",
    // Notes
    notes: ""
  });

  const departments = [
    "Diseño", "Marketing", "Desarrollo", "Ventas", "Administración", 
    "Recursos Humanos", "Operaciones", "Atención al Cliente"
  ];

  const roles = [
    { value: "designer", label: "Diseñador", icon: "🎨" },
    { value: "community_manager", label: "Community Manager", icon: "📱" },
    { value: "copywriter", label: "Copywriter", icon: "✍️" },
    { value: "developer", label: "Desarrollador", icon: "💻" },
    { value: "manager", label: "Gerente", icon: "👔" },
    { value: "admin", label: "Administrador", icon: "⚙️" },
    { value: "sales", label: "Ventas", icon: "💼" },
    { value: "support", label: "Soporte", icon: "🎧" }
  ];

  const skillOptions = [
    "Photoshop", "Illustrator", "Figma", "After Effects", "Canva",
    "Instagram", "Facebook", "TikTok", "LinkedIn", "Analytics",
    "SEO", "Email Marketing", "Copywriting", "React", "Node.js",
    "Excel", "Ventas", "Atención al Cliente"
  ];

  useEffect(() => {
    fetchEmployees();
  }, [activeTab]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = activeTab === "all" ? {} : { is_active: activeTab === "active" };
      
      const res = await axios.get(`${API_BASE_URL}/api/hr/employees`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setEmployees(res.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
      // Mock data for development
      setEmployees([
        {
          id: 1, name: "Ana García", email: "ana@zionx.com", phone: "+52 555 1234",
          role: "designer", department: "Diseño", employee_type: "full_time",
          monthly_wage: 15000, skills: ["Photoshop", "Figma"], is_active: true,
          hire_date: "2024-01-15", current_tasks: 3
        },
        {
          id: 2, name: "Carlos López", email: "carlos@zionx.com", phone: "+52 555 5678",
          role: "community_manager", department: "Marketing", employee_type: "full_time",
          monthly_wage: 12000, skills: ["Instagram", "TikTok"], is_active: true,
          hire_date: "2024-03-01", current_tasks: 5
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      if (editingEmployee) {
        await axios.put(`${API_BASE_URL}/api/hr/employees/${editingEmployee.id}`, formData, { headers });
        alert("✅ Empleado actualizado");
      } else {
        await axios.post(`${API_BASE_URL}/api/hr/employees`, formData, { headers });
        alert("✅ Empleado creado");
      }
      
      setShowModal(false);
      resetForm();
      fetchEmployees();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name || "",
      email: employee.email || "",
      phone: employee.phone || "",
      avatar_url: employee.avatar_url || "",
      role: employee.role || "",
      department: employee.department || "",
      employee_type: employee.employee_type || "full_time",
      monthly_wage: employee.monthly_wage || "",
      payment_frequency: employee.payment_frequency || "monthly",
      bank_name: employee.bank_name || "",
      clabe: employee.clabe || "",
      rfc: employee.rfc || "",
      curp: employee.curp || "",
      imss_number: employee.imss_number || "",
      hire_date: employee.hire_date?.split('T')[0] || "",
      contract_type: employee.contract_type || "permanent",
      skills: employee.skills || [],
      max_daily_tasks: employee.max_daily_tasks || 5,
      address: employee.address || "",
      emergency_contact: employee.emergency_contact || "",
      emergency_phone: employee.emergency_phone || "",
      notes: employee.notes || ""
    });
    setShowModal(true);
  };

  const handleDeactivate = async (id) => {
    if (!confirm("¿Desactivar este empleado?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/api/hr/employees/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEmployees();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  const resetForm = () => {
    setEditingEmployee(null);
    setFormData({
      name: "", email: "", phone: "", avatar_url: "",
      role: "", department: "", employee_type: "full_time",
      monthly_wage: "", payment_frequency: "monthly",
      bank_name: "", clabe: "", rfc: "", curp: "", imss_number: "",
      hire_date: "", contract_type: "permanent",
      skills: [], max_daily_tasks: 5,
      address: "", emergency_contact: "", emergency_phone: "", notes: ""
    });
  };

  const toggleSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const getRoleInfo = (roleValue) => roles.find(r => r.value === roleValue) || { label: roleValue, icon: "👤" };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = departmentFilter === "all" || emp.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  // Stats
  const activeCount = employees.filter(e => e.is_active !== false).length;
  const totalPayroll = employees.reduce((sum, e) => sum + (parseFloat(e.monthly_wage) || 0), 0);
  const avgWage = employees.length > 0 ? totalPayroll / employees.length : 0;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">👥 Equipo</h1>
            <p className="text-gray-500">Gestión centralizada de empleados</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 flex items-center gap-2 font-medium"
          >
            ➕ Nuevo Empleado
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border shadow-sm">
            <p className="text-sm text-gray-500">Total Empleados</p>
            <p className="text-3xl font-bold text-gray-900">{employees.length}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border shadow-sm">
            <p className="text-sm text-gray-500">Activos</p>
            <p className="text-3xl font-bold text-green-600">{activeCount}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border shadow-sm">
            <p className="text-sm text-gray-500">Nómina Mensual</p>
            <p className="text-3xl font-bold text-blue-600">${totalPayroll.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border shadow-sm">
            <p className="text-sm text-gray-500">Salario Promedio</p>
            <p className="text-3xl font-bold text-purple-600">${avgWage.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="bg-white rounded-xl p-4 border shadow-sm mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="🔍 Buscar por nombre o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-black focus:outline-none"
              />
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border rounded-lg px-4 py-2"
            >
              <option value="all">Todos los departamentos</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Status Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {[
                { key: "all", label: "Todos" },
                { key: "active", label: "Activos" },
                { key: "inactive", label: "Inactivos" }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.key ? "bg-white shadow" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1.5 rounded-md ${viewMode === "cards" ? "bg-white shadow" : ""}`}
              >
                🎴
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-md ${viewMode === "table" ? "bg-white shadow" : ""}`}
              >
                📋
              </button>
            </div>

            {/* Quick Links */}
            <Link to="/hr/payroll" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              💵 Ir a Nómina →
            </Link>
          </div>
        </div>

        {/* Employee Cards View */}
        {viewMode === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredEmployees.map(emp => (
              <div key={emp.id} className="bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Card Header */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                      {getRoleInfo(emp.role).icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{emp.name}</h3>
                      <p className="text-sm text-gray-300">{getRoleInfo(emp.role).label}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      emp.is_active !== false ? "bg-green-500" : "bg-red-500"
                    }`}>
                      {emp.is_active !== false ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4">
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-600 flex items-center gap-2">
                      <span>📧</span> {emp.email || "—"}
                    </p>
                    <p className="text-gray-600 flex items-center gap-2">
                      <span>📱</span> {emp.phone || "—"}
                    </p>
                    <p className="text-gray-600 flex items-center gap-2">
                      <span>🏢</span> {emp.department || "—"}
                    </p>
                    <p className="text-gray-900 font-semibold flex items-center gap-2">
                      <span>💰</span> ${parseFloat(emp.monthly_wage || 0).toLocaleString()}/mes
                    </p>
                  </div>

                  {/* Skills */}
                  {emp.skills?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {emp.skills.slice(0, 3).map(skill => (
                        <span key={skill} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                          {skill}
                        </span>
                      ))}
                      {emp.skills.length > 3 && (
                        <span className="text-gray-400 text-xs">+{emp.skills.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleEdit(emp)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDeactivate(emp.id)}
                      className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table View */}
        {viewMode === "table" && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Empleado</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Rol</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Departamento</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Salario</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            {getRoleInfo(emp.role).icon}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{emp.name}</p>
                            <p className="text-sm text-gray-500">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getRoleInfo(emp.role).label}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{emp.department || "—"}</td>
                      <td className="px-4 py-3 text-sm font-medium">${parseFloat(emp.monthly_wage || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          emp.is_active !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {emp.is_active !== false ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(emp)} className="text-blue-600 hover:text-blue-800">✏️</button>
                          <button onClick={() => handleDeactivate(emp.id)} className="text-red-500 hover:text-red-700">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredEmployees.length === 0 && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <span className="text-6xl block mb-4">👥</span>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No hay empleados</h2>
            <p className="text-gray-500 mb-6">Agrega tu primer empleado para comenzar</p>
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="bg-black text-white px-6 py-3 rounded-lg"
            >
              ➕ Agregar Empleado
            </button>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {editingEmployee ? "✏️ Editar Empleado" : "➕ Nuevo Empleado"}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-500 text-2xl">×</button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    👤 Información Básica
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Juan Pérez"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="juan@empresa.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="+52 555 123 4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de contratación</label>
                      <input
                        type="date"
                        value={formData.hire_date}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Role & Department */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    🏢 Rol y Departamento
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                      <select
                        required
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">Seleccionar...</option>
                        {roles.map(r => (
                          <option key={r.value} value={r.value}>{r.icon} {r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                      <select
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">Seleccionar...</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de empleado</label>
                      <select
                        value={formData.employee_type}
                        onChange={(e) => setFormData({ ...formData, employee_type: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="full_time">Tiempo completo</option>
                        <option value="part_time">Medio tiempo</option>
                        <option value="contractor">Contratista</option>
                        <option value="intern">Practicante</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Payroll Info */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    💰 Información de Nómina
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Salario mensual *</label>
                      <input
                        type="number"
                        required
                        value={formData.monthly_wage}
                        onChange={(e) => setFormData({ ...formData, monthly_wage: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="15000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="BBVA, Santander, etc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CLABE</label>
                      <input
                        type="text"
                        value={formData.clabe}
                        onChange={(e) => setFormData({ ...formData, clabe: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="18 dígitos"
                      />
                    </div>
                  </div>
                </div>

                {/* Legal Info */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    📄 Información Fiscal
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
                      <input
                        type="text"
                        value={formData.rfc}
                        onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="XXXX000000XXX"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CURP</label>
                      <input
                        type="text"
                        value={formData.curp}
                        onChange={(e) => setFormData({ ...formData, curp: e.target.value.toUpperCase() })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="18 caracteres"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">No. IMSS</label>
                      <input
                        type="text"
                        value={formData.imss_number}
                        onChange={(e) => setFormData({ ...formData, imss_number: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="11 dígitos"
                      />
                    </div>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    🎯 Habilidades
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {skillOptions.map(skill => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          formData.skills.includes(skill)
                            ? "bg-black text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={3}
                    placeholder="Notas internas sobre el empleado..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-black text-white py-3 rounded-xl hover:bg-gray-800 font-medium"
                  >
                    {editingEmployee ? "💾 Guardar Cambios" : "➕ Crear Empleado"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PeopleManagement;

