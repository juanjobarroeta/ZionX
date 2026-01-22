import { API_BASE_URL } from "../utils/constants";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Layout from "../components/Layout";

const AdminExpenses = () => {
  const token = localStorage.getItem("token");
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("register");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [filters, setFilters] = useState({
    store: "",
    type: "",
    status: "",
    dateRange: "all"
  });
  const [form, setForm] = useState({
    store_id: "",
    type: "",
    amount: "",
    description: "",
    days_of_credit: "",
    priority: "medium",
    category: "",
    budget_code: "",
    approval_required: true, // Default to true - all expenses require approval
    recurring: false,
    recurring_frequency: "monthly"
  });
  const [quoteFile, setQuoteFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Expense categories with icons and colors
  const expenseCategories = [
    { id: "payroll", name: "Nómina", icon: "👥", color: "from-red-500 to-pink-600", budget: 50000 },
    { id: "rent", name: "Renta", icon: "🏢", color: "from-blue-500 to-cyan-600", budget: 15000 },
    { id: "utilities", name: "Servicios", icon: "⚡", color: "from-yellow-500 to-orange-600", budget: 8000 },
    { id: "marketing", name: "Marketing", icon: "📢", color: "from-purple-500 to-violet-600", budget: 12000 },
    { id: "software", name: "Software", icon: "💻", color: "from-green-500 to-emerald-600", budget: 5000 },
    { id: "maintenance", name: "Mantenimiento", icon: "🔧", color: "from-gray-500 to-slate-600", budget: 3000 },
    { id: "security", name: "Seguridad", icon: "🔒", color: "from-indigo-500 to-blue-600", budget: 4000 },
    { id: "office", name: "Oficina", icon: "📁", color: "from-teal-500 to-green-600", budget: 2000 },
    { id: "other", name: "Otros", icon: "📦", color: "from-pink-500 to-rose-600", budget: 10000 }
  ];

  const expenseTypes = [
    { id: "payroll", name: "Nómina", category: "payroll" },
    { id: "rent", name: "Renta", category: "rent" },
    { id: "water", name: "Agua", category: "utilities" },
    { id: "electricity", name: "Luz", category: "utilities" },
    { id: "internet", name: "Internet", category: "utilities" },
    { id: "software", name: "Software", category: "software" },
    { id: "cleaning", name: "Limpieza", category: "maintenance" },
    { id: "security", name: "Seguridad", category: "security" },
    { id: "credit_bureau", name: "Buró de Crédito", category: "other" },
    { id: "advertising", name: "Pauta", category: "marketing" },
    { id: "flyers", name: "Flyers", category: "marketing" },
    { id: "stationery", name: "Papelería", category: "office" },
    { id: "other", name: "Otros Gastos", category: "other" }
  ];

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenses(res.data);
      
      // Separate pending approvals
      const pending = res.data.filter(expense => expense.status === 'pending' || !expense.status);
      setPendingApprovals(pending);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveExpense = async (expenseId) => {
    try {
      await axios.put(`${API_BASE_URL}/expenses/${expenseId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("✅ Gasto aprobado correctamente");
      fetchExpenses(); // Refresh the list
    } catch (err) {
      console.error("Error approving expense:", err);
      alert("❌ Error al aprobar el gasto");
    }
  };

  const handleRejectExpense = async (expenseId) => {
    const reason = prompt("Motivo del rechazo:");
    if (!reason) return;
    
    try {
      await axios.put(`${API_BASE_URL}/expenses/${expenseId}/reject`, {
        reason: reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("❌ Gasto rechazado correctamente");
      fetchExpenses(); // Refresh the list
    } catch (err) {
      console.error("Error rejecting expense:", err);
      alert("❌ Error al rechazar el gasto");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setQuoteFile(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setQuoteFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => {
        if (form[key] !== "") {
          formData.append(key, form[key]);
        }
      });
      if (quoteFile) {
        formData.append("quote", quoteFile);
      }

      await axios.post(`${API_BASE_URL}/expenses`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setForm({
        store_id: "", type: "", amount: "", description: "", days_of_credit: "",
        priority: "medium", category: "", budget_code: "", approval_required: false,
        recurring: false, recurring_frequency: "monthly"
      });
      setQuoteFile(null);
      fetchExpenses();
      
      // Show success notification
      alert("✅ Gasto registrado exitosamente");
    } catch (err) {
      console.error("Error saving expense:", err);
      alert("❌ Error al registrar el gasto");
    } finally {
      setLoading(false);
    }
  };

  const handleViewExpense = (expense) => {
    setSelectedExpense(expense);
    setShowModal(true);
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      if (filters.store && expense.store_id !== filters.store) return false;
      if (filters.type && expense.type !== filters.type) return false;
      if (filters.status && expense.status !== filters.status) return false;
      return true;
    });
  }, [expenses, filters]);

  const analytics = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
    const byCategory = expenses.reduce((acc, exp) => {
      const category = expenseTypes.find(t => t.id === exp.type)?.category || 'other';
      acc[category] = (acc[category] || 0) + parseFloat(exp.amount || 0);
      return acc;
    }, {});
    
    return { total, byCategory };
  }, [expenses]);

  useEffect(() => {
    fetchExpenses();
  }, []);

  return (
    <Layout>
      <div className="p-6 bg-white text-neutral-800 max-w-7xl mx-auto">
        {/* Header with Analytics */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-primary-500">Gestión de Gastos</h1>
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("register")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === "register" 
                    ? "bg-primary-500 text-neutral-800" 
                    : "bg-white text-neutral-800 hover:bg-gray-700"
                }`}
              >
                📝 Registrar
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === "analytics" 
                    ? "bg-primary-500 text-neutral-800" 
                    : "bg-white text-neutral-800 hover:bg-gray-700"
                }`}
              >
                📊 Análisis
              </button>
              <button
                onClick={() => setActiveTab("approvals")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === "approvals" 
                    ? "bg-primary-500 text-neutral-800" 
                    : "bg-white text-neutral-800 hover:bg-gray-700"
                }`}
              >
                ✅ Aprobaciones
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 rounded-lg">
              <div className="text-2xl font-bold">${analytics.total.toLocaleString()}</div>
              <div className="text-sm opacity-90">Total Gastos</div>
            </div>
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-4 rounded-lg">
              <div className="text-2xl font-bold">{expenses.length}</div>
              <div className="text-sm opacity-90">Registros</div>
            </div>
            <div className="bg-gradient-to-r from-purple-500 to-violet-600 p-4 rounded-lg">
              <div className="text-2xl font-bold">$85,000</div>
              <div className="text-sm opacity-90">Presupuesto</div>
            </div>
            <div className="bg-gradient-to-r from-orange-500 to-red-600 p-4 rounded-lg">
              <div className="text-2xl font-bold">${(85000 - analytics.total).toLocaleString()}</div>
              <div className="text-sm opacity-90">Restante</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {activeTab === "register" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Registration Form */}
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
                <h2 className="text-xl font-bold text-primary-500 mb-6">📝 Registrar Nuevo Gasto</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Sucursal</label>
                      <select
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        name="store_id"
                        value={form.store_id}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Selecciona Sucursal</option>
                        <option value="1">Atlixco</option>
                        <option value="2">Cholula</option>
                        <option value="3">Chipilo</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Categoría</label>
                      <select
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        name="category"
                        value={form.category}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Selecciona Categoría</option>
                        {expenseCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Tipo de Gasto</label>
                      <select
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        name="type"
                        value={form.type}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Selecciona Tipo</option>
                        {expenseTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Monto</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        placeholder="0.00"
                        name="amount"
                        value={form.amount}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Descripción</label>
                    <textarea
                      className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                      placeholder="Describe el gasto..."
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      rows="3"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Prioridad</label>
                      <select
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        name="priority"
                        value={form.priority}
                        onChange={handleChange}
                      >
                        <option value="low">🟢 Baja</option>
                        <option value="medium">🟡 Media</option>
                        <option value="high">🔴 Alta</option>
                        <option value="urgent">🚨 Urgente</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Días de Crédito</label>
                      <input
                        type="number"
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        placeholder="30"
                        name="days_of_credit"
                        value={form.days_of_credit}
                        onChange={handleChange}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Código de Presupuesto</label>
                      <input
                        type="text"
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        placeholder="BUD-001"
                        name="budget_code"
                        value={form.budget_code}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="approval_required"
                        checked={form.approval_required}
                        onChange={handleChange}
                        className="mr-2"
                        disabled // All expenses require approval by default
                      />
                      ✅ Requiere Aprobación (Obligatorio)
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="recurring"
                        checked={form.recurring}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      🔄 Gasto Recurrente
                    </label>
                  </div>

                  {form.recurring && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Frecuencia</label>
                      <select
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        name="recurring_frequency"
                        value={form.recurring_frequency}
                        onChange={handleChange}
                      >
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensual</option>
                        <option value="quarterly">Trimestral</option>
                        <option value="yearly">Anual</option>
                      </select>
                    </div>
                  )}

                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Comprobante</label>
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        dragActive ? 'border-primary-500 bg-green-900/20' : 'border-neutral-300'
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        {quoteFile ? (
                          <div>
                            <div className="text-primary-500 text-lg mb-2">✅ Archivo seleccionado</div>
                            <div className="text-sm text-neutral-600">{quoteFile.name}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-4xl mb-4">📎</div>
                            <div className="text-lg mb-2">Arrastra archivos aquí o haz clic</div>
                            <div className="text-sm text-neutral-600">PDF, PNG, JPG hasta 10MB</div>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-neutral-800 font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
                  >
                    {loading ? "⏳ Guardando..." : "💾 Guardar Gasto"}
                  </button>
                </form>
              </div>
            </div>

            {/* Categories Overview */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
                <h3 className="text-lg font-bold text-primary-500 mb-4">📊 Categorías</h3>
                <div className="space-y-3">
                  {expenseCategories.map(category => {
                    const spent = analytics.byCategory[category.id] || 0;
                    const percentage = (spent / category.budget) * 100;
                    return (
                      <div key={category.id} className="bg-white rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{category.icon}</span>
                            <span className="font-medium">{category.name}</span>
                          </div>
                          <span className="text-sm text-neutral-600">
                            ${spent.toLocaleString()} / ${category.budget.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full bg-gradient-to-r ${category.color} ${
                              percentage > 80 ? 'animate-pulse' : ''
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-neutral-600 mt-1">
                          {percentage.toFixed(1)}% del presupuesto
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
            <h2 className="text-xl font-bold text-primary-500 mb-6">📊 Análisis de Gastos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Charts and analytics would go here */}
              <div className="bg-white rounded-lg p-4">
                <h3 className="font-semibold mb-3">Gastos por Categoría</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.byCategory).map(([category, amount]) => (
                    <div key={category} className="flex justify-between">
                      <span>{category}</span>
                      <span className="font-semibold">${amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "approvals" && (
          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
            <h2 className="text-xl font-bold text-primary-500 mb-6">✅ Aprobaciones Pendientes</h2>
            
            {pendingApprovals.length === 0 ? (
              <div className="text-center text-neutral-600 py-8">
                <div className="text-4xl mb-4">🎉</div>
                <div className="text-lg mb-2">¡Excelente!</div>
                <div className="text-sm">No hay aprobaciones pendientes</div>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((expense) => (
                  <div key={expense.id} className="bg-white rounded-lg p-4 border border-neutral-300">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            expense.priority === 'urgent' ? 'bg-red-900 text-red-200' :
                            expense.priority === 'high' ? 'bg-orange-900 text-orange-200' :
                            expense.priority === 'medium' ? 'bg-yellow-900 text-yellow-200' :
                            'bg-green-900 text-green-200'
                          }`}>
                            {expense.priority === 'urgent' ? '🚨 Urgente' :
                             expense.priority === 'high' ? '🔴 Alta' :
                             expense.priority === 'medium' ? '🟡 Media' : '🟢 Baja'}
                          </span>
                          <span className="text-sm text-neutral-600">
                            {expense.created_at ? new Date(expense.created_at).toLocaleDateString() : "Sin fecha"}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <div className="text-sm text-neutral-600">Sucursal</div>
                            <div className="font-semibold">{expense.store_name || `ID ${expense.store_id}`}</div>
                          </div>
                          <div>
                            <div className="text-sm text-neutral-600">Categoría</div>
                            <div className="font-semibold">{expenseTypes.find(t => t.id === expense.type)?.name || expense.type}</div>
                          </div>
                          <div>
                            <div className="text-sm text-neutral-600">Monto</div>
                            <div className="font-semibold text-primary-500">
                              ${expense.amount ? parseFloat(expense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                            </div>
                          </div>
                        </div>
                        
                        {expense.description && (
                          <div className="mt-2">
                            <div className="text-sm text-neutral-600">Descripción</div>
                            <div className="text-sm">{expense.description}</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleApproveExpense(expense.id)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-neutral-800 rounded-lg font-semibold transition-colors"
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          onClick={() => handleRejectExpense(expense.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-neutral-800 rounded-lg font-semibold transition-colors"
                        >
                          ❌ Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expenses Table */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-primary-500">📋 Gastos Registrados</h2>
            
            {/* Filters */}
            <div className="flex gap-4">
              <select
                className="px-3 py-2 bg-white text-neutral-800 border border-neutral-300 rounded-lg"
                value={filters.store}
                onChange={(e) => setFilters(prev => ({ ...prev, store: e.target.value }))}
              >
                <option value="">Todas las Sucursales</option>
                <option value="1">Atlixco</option>
                <option value="2">Cholula</option>
                <option value="3">Chipilo</option>
              </select>
              
              <select
                className="px-3 py-2 bg-white text-neutral-800 border border-neutral-300 rounded-lg"
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              >
                <option value="">Todos los Tipos</option>
                {expenseTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl overflow-hidden border border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Sucursal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Categoría</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Monto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Prioridad</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-white transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {expense.created_at ? new Date(expense.created_at).toLocaleDateString() : "Sin fecha"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {expense.store_name || `ID ${expense.store_id}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {expenseTypes.find(t => t.id === expense.type)?.category || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {expenseTypes.find(t => t.id === expense.type)?.name || expense.type || "Sin tipo"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        ${expense.amount ? parseFloat(expense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          expense.priority === 'urgent' ? 'bg-red-900 text-red-200' :
                          expense.priority === 'high' ? 'bg-orange-900 text-orange-200' :
                          expense.priority === 'medium' ? 'bg-yellow-900 text-yellow-200' :
                          'bg-green-900 text-green-200'
                        }`}>
                          {expense.priority === 'urgent' ? '🚨 Urgente' :
                           expense.priority === 'high' ? '🔴 Alta' :
                           expense.priority === 'medium' ? '🟡 Media' : '🟢 Baja'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          expense.status === 'pending' || !expense.status ? 'bg-yellow-900 text-yellow-200' :
                          expense.status === 'approved' ? 'bg-green-900 text-green-200' :
                          expense.status === 'rejected' ? 'bg-red-900 text-red-200' :
                          expense.status === 'paid' ? 'bg-blue-900 text-blue-200' :
                          'bg-gradient-to-br from-surface-50 to-surface-100 text-gray-200'
                        }`}>
                          {expense.status === 'pending' || !expense.status ? '⏳ Pendiente' :
                           expense.status === 'approved' ? '✅ Aprobado' :
                           expense.status === 'rejected' ? '❌ Rechazado' :
                           expense.status === 'paid' ? '💰 Pagado' :
                           '❓ Desconocido'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleViewExpense(expense)}
                          className="text-primary-500 hover:text-emerald-400 mr-2"
                        >
                          👁️ Ver
                        </button>
                        <button className="text-primary-500 hover:text-blue-300 mr-2">
                          ✏️ Editar
                        </button>
                        <button className="text-neutral-600 hover:text-red-300">
                          🗑️ Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Detail Modal */}
      {showModal && selectedExpense && (
        <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-[999999]">
          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-primary-500">Detalles del Gasto</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-600 hover:text-neutral-800"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-neutral-600">Fecha</label>
                  <p>{selectedExpense.created_at ? new Date(selectedExpense.created_at).toLocaleDateString() : "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm text-neutral-600">Sucursal</label>
                  <p>{selectedExpense.store_name || `ID ${selectedExpense.store_id}`}</p>
                </div>
                <div>
                  <label className="text-sm text-neutral-600">Tipo</label>
                  <p>{selectedExpense.type || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm text-neutral-600">Monto</label>
                  <p className="font-semibold">${selectedExpense.amount ? parseFloat(selectedExpense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-neutral-600">Descripción</label>
                <p>{selectedExpense.description || "Sin descripción"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminExpenses;
