import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [filter, setFilter] = useState("active");
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", role: "", department: "",
    employee_type: "full_time", monthly_wage: "", hire_date: "",
    contract_type: "permanent", payment_frequency: "monthly",
    bank_name: "", clabe: "", rfc: "", curp: "", imss_number: "",
    address: "", emergency_contact: "", emergency_phone: "", notes: ""
  });

  useEffect(() => {
    fetchEmployees();
  }, [filter]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = filter === "all" ? {} : { is_active: filter === "active" };
      
      const res = await axios.get(`${API_BASE_URL}/api/hr/employees`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setEmployees(res.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
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
        alert("Empleado actualizado exitosamente");
      } else {
        await axios.post(`${API_BASE_URL}/api/hr/employees`, formData, { headers });
        alert("Empleado creado exitosamente");
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
      role: employee.role || "",
      department: employee.department || "",
      employee_type: employee.employee_type || "full_time",
      monthly_wage: employee.monthly_wage || "",
      hire_date: employee.hire_date?.split('T')[0] || "",
      contract_type: employee.contract_type || "permanent",
      payment_frequency: employee.payment_frequency || "monthly",
      bank_name: employee.bank_name || "",
      clabe: employee.clabe || "",
      rfc: employee.rfc || "",
      curp: employee.curp || "",
      imss_number: employee.imss_number || "",
      address: employee.address || "",
      emergency_contact: employee.emergency_contact || "",
      emergency_phone: employee.emergency_phone || "",
      notes: employee.notes || ""
    });
    setShowModal(true);
  };

  const handleDeactivate = async (id) => {
    if (!confirm("¿Estás seguro de desactivar este empleado?")) return;
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

  const handleReactivate = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API_BASE_URL}/api/hr/employees/${id}`, { is_active: true }, {
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
      name: "", email: "", phone: "", role: "", department: "",
      employee_type: "full_time", monthly_wage: "", hire_date: "",
      contract_type: "permanent", payment_frequency: "monthly",
      bank_name: "", clabe: "", rfc: "", curp: "", imss_number: "",
      address: "", emergency_contact: "", emergency_phone: "", notes: ""
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
  };

  const employeeTypeLabels = {
    full_time: "Tiempo Completo",
    part_time: "Medio Tiempo",
    contractor: "Contratista",
    freelance: "Freelance",
    admin: "Administrativo"
  };

  const departmentColors = {
    "Diseño": "bg-purple-100 text-purple-800",
    "Community": "bg-blue-100 text-blue-800",
    "Ventas": "bg-green-100 text-green-800",
    "Administración": "bg-yellow-100 text-yellow-800",
    "Dirección": "bg-red-100 text-red-800"
  };

  // Stats
  const totalWages = employees.filter(e => e.is_active).reduce((sum, e) => sum + parseFloat(e.monthly_wage || 0), 0);
  const activeCount = employees.filter(e => e.is_active).length;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zionx-highlight"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-black">👥 Gestión de Empleados</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {activeCount} empleados activos • Nómina mensual: {formatCurrency(totalWages)}
                </p>
              </div>
              <div className="flex space-x-3">
                <Link to="/hr/payroll" className="bg-white border border-zionx-secondary px-4 py-2 rounded-lg hover:bg-gray-50">
                  💰 Nómina
                </Link>
                <Link to="/hr/financials" className="bg-white border border-zionx-secondary px-4 py-2 rounded-lg hover:bg-gray-50">
                  📊 Finanzas
                </Link>
                <button
                  onClick={() => { resetForm(); setShowModal(true); }}
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800"
                >
                  ➕ Nuevo Empleado
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Empleados</p>
                  <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">💵</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nómina Mensual</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalWages)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🎨</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Creativos</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {employees.filter(e => e.is_active && (e.department === 'Diseño' || e.department === 'Community')).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🏢</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Administrativos</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {employees.filter(e => e.is_active && e.department === 'Administración').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { key: "active", label: "Activos" },
              { key: "inactive", label: "Inactivos" },
              { key: "all", label: "Todos" }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === tab.key 
                    ? "bg-black text-white" 
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Employees Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.map(employee => (
              <div 
                key={employee.id} 
                className={`bg-white rounded-xl border p-6 ${
                  employee.is_active ? 'border-zionx-secondary' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {employee.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-zionx-primary">{employee.name}</h3>
                      <p className="text-sm text-gray-500">{employee.role || 'Sin rol'}</p>
                    </div>
                  </div>
                  {!employee.is_active && (
                    <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs">Inactivo</span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">📧</span>
                    <span className="text-gray-700">{employee.email}</span>
                  </div>
                  {employee.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">📱</span>
                      <span className="text-gray-700">{employee.phone}</span>
                    </div>
                  )}
                  {employee.department && (
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${departmentColors[employee.department] || 'bg-gray-100 text-gray-800'}`}>
                        {employee.department}
                      </span>
                      <span className="text-xs text-gray-500">
                        {employeeTypeLabels[employee.employee_type] || employee.employee_type}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="text-xs text-gray-500">Salario Mensual</p>
                    <p className="font-semibold text-green-600">{formatCurrency(employee.monthly_wage)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(employee)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      ✏️ Editar
                    </button>
                    {employee.is_active ? (
                      <button
                        onClick={() => handleDeactivate(employee.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        🗑️
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(employee.id)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        ✓ Activar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {employees.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center">
              <span className="text-4xl mb-4 block">👥</span>
              <p className="text-gray-500">No hay empleados registrados</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                Agregar primer empleado →
              </button>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-zionx-primary mb-4">
                {editingEmployee ? '✏️ Editar Empleado' : '➕ Nuevo Empleado'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Contratación</label>
                    <input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({...formData, hire_date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {/* Role & Department */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Puesto</label>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      placeholder="Ej: Diseñador Gráfico"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Diseño">Diseño</option>
                      <option value="Community">Community Management</option>
                      <option value="Ventas">Ventas</option>
                      <option value="Administración">Administración</option>
                      <option value="Dirección">Dirección</option>
                    </select>
                  </div>
                </div>

                {/* Employment Type */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Empleado</label>
                    <select
                      value={formData.employee_type}
                      onChange={(e) => setFormData({...formData, employee_type: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="full_time">Tiempo Completo</option>
                      <option value="part_time">Medio Tiempo</option>
                      <option value="contractor">Contratista</option>
                      <option value="freelance">Freelance</option>
                      <option value="admin">Administrativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Contrato</label>
                    <select
                      value={formData.contract_type}
                      onChange={(e) => setFormData({...formData, contract_type: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="permanent">Indefinido</option>
                      <option value="temporary">Temporal</option>
                      <option value="project">Por Proyecto</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia de Pago</label>
                    <select
                      value={formData.payment_frequency}
                      onChange={(e) => setFormData({...formData, payment_frequency: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="monthly">Mensual</option>
                      <option value="biweekly">Quincenal</option>
                      <option value="weekly">Semanal</option>
                    </select>
                  </div>
                </div>

                {/* Salary */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">💰 Salario Mensual</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monthly_wage}
                      onChange={(e) => setFormData({...formData, monthly_wage: e.target.value})}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2"
                    />
                  </div>
                </div>

                {/* Fiscal Info */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-medium text-gray-700 mb-3">📋 Información Fiscal</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">RFC</label>
                      <input
                        type="text"
                        value={formData.rfc}
                        onChange={(e) => setFormData({...formData, rfc: e.target.value.toUpperCase()})}
                        maxLength={13}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">CURP</label>
                      <input
                        type="text"
                        value={formData.curp}
                        onChange={(e) => setFormData({...formData, curp: e.target.value.toUpperCase()})}
                        maxLength={18}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Número IMSS</label>
                      <input
                        type="text"
                        value={formData.imss_number}
                        onChange={(e) => setFormData({...formData, imss_number: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Bank Info */}
                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-700 mb-3">🏦 Información Bancaria</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Banco</label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">CLABE</label>
                      <input
                        type="text"
                        value={formData.clabe}
                        onChange={(e) => setFormData({...formData, clabe: e.target.value})}
                        maxLength={18}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-700 mb-3">🆘 Contacto de Emergencia</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Nombre</label>
                      <input
                        type="text"
                        value={formData.emergency_contact}
                        onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Teléfono</label>
                      <input
                        type="tel"
                        value={formData.emergency_phone}
                        onChange={(e) => setFormData({...formData, emergency_phone: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                {/* Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
                  >
                    {editingEmployee ? 'Guardar Cambios' : 'Crear Empleado'}
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

export default EmployeeManagement;


