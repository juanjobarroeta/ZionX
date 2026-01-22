import { API_BASE_URL } from "../utils/constants";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Layout from "../components/Layout";

const BudgetManagement = () => {
  const token = localStorage.getItem("token");
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [form, setForm] = useState({
    category: "",
    amount: "",
    period: "monthly",
    start_date: "",
    end_date: "",
    description: "",
    store_id: "",
    is_active: true
  });

  // Budget categories with icons and colors
  const budgetCategories = [
    { id: "payroll", name: "Nómina", icon: "👥", color: "from-red-500 to-pink-600" },
    { id: "rent", name: "Renta", icon: "🏢", color: "from-blue-500 to-cyan-600" },
    { id: "utilities", name: "Servicios", icon: "⚡", color: "from-yellow-500 to-orange-600" },
    { id: "marketing", name: "Marketing", icon: "📢", color: "from-purple-500 to-violet-600" },
    { id: "software", name: "Software", icon: "💻", color: "from-green-500 to-emerald-600" },
    { id: "maintenance", name: "Mantenimiento", icon: "🔧", color: "from-gray-500 to-slate-600" },
    { id: "security", name: "Seguridad", icon: "🔒", color: "from-indigo-500 to-blue-600" },
    { id: "office", name: "Oficina", icon: "📁", color: "from-teal-500 to-green-600" },
    { id: "other", name: "Otros", icon: "📦", color: "from-pink-500 to-rose-600" }
  ];

  const periods = [
    { id: "weekly", name: "Semanal", icon: "📅" },
    { id: "monthly", name: "Mensual", icon: "📆" },
    { id: "quarterly", name: "Trimestral", icon: "📊" },
    { id: "yearly", name: "Anual", icon: "📈" }
  ];

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/budgets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBudgets(res.data);
    } catch (err) {
      console.error("Error fetching budgets:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenses(res.data);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const budgetData = {
        ...form,
        amount: parseFloat(form.amount)
      };

      if (selectedBudget) {
        await axios.put(`${API_BASE_URL}/budgets/${selectedBudget.id}`, budgetData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE_URL}/budgets`, budgetData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setForm({
        category: "", amount: "", period: "monthly", start_date: "", 
        end_date: "", description: "", store_id: "", is_active: true
      });
      setSelectedBudget(null);
      setShowBudgetModal(false);
      fetchBudgets();
      
      alert(selectedBudget ? "✅ Presupuesto actualizado" : "✅ Presupuesto creado");
    } catch (err) {
      console.error("Error saving budget:", err);
      alert("❌ Error al guardar el presupuesto");
    } finally {
      setLoading(false);
    }
  };

  const handleEditBudget = (budget) => {
    setSelectedBudget(budget);
    setForm({
      category: budget.category,
      amount: budget.amount.toString(),
      period: budget.period,
      start_date: budget.start_date,
      end_date: budget.end_date,
      description: budget.description,
      store_id: budget.store_id,
      is_active: budget.is_active
    });
    setShowBudgetModal(true);
  };

  const handleDeleteBudget = async (budgetId) => {
    if (confirm("¿Estás seguro de que quieres eliminar este presupuesto?")) {
      try {
        await axios.delete(`${API_BASE_URL}/budgets/${budgetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchBudgets();
        alert("✅ Presupuesto eliminado");
      } catch (err) {
        console.error("Error deleting budget:", err);
        alert("❌ Error al eliminar el presupuesto");
      }
    }
  };

  const budgetAnalytics = useMemo(() => {
    const analytics = {};
    
    budgets.forEach(budget => {
      const categoryExpenses = expenses.filter(exp => 
        exp.category === budget.category && 
        new Date(exp.created_at) >= new Date(budget.start_date) &&
        new Date(exp.created_at) <= new Date(budget.end_date)
      );
      
      const spent = categoryExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
      const remaining = budget.amount - spent;
      const percentage = (spent / budget.amount) * 100;
      
      analytics[budget.category] = {
        budget: budget.amount,
        spent,
        remaining,
        percentage,
        status: percentage > 90 ? 'danger' : percentage > 75 ? 'warning' : 'safe'
      };
    });
    
    return analytics;
  }, [budgets, expenses]);

  useEffect(() => {
    fetchBudgets();
    fetchExpenses();
  }, []);

  return (
    <Layout>
      <div className="p-6 bg-white text-neutral-800 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-primary-500">Gestión de Presupuestos</h1>
            <button
              onClick={() => {
                setSelectedBudget(null);
                setForm({
                  category: "", amount: "", period: "monthly", start_date: "", 
                  end_date: "", description: "", store_id: "", is_active: true
                });
                setShowBudgetModal(true);
              }}
              className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-neutral-800 font-bold py-2 px-4 rounded-lg transition-all duration-200"
            >
              ➕ Nuevo Presupuesto
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === "overview" 
                  ? "bg-primary-500 text-neutral-800" 
                  : "bg-white text-neutral-800 hover:bg-gray-700"
              }`}
            >
              📊 Resumen
            </button>
            <button
              onClick={() => setActiveTab("budgets")}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === "budgets" 
                  ? "bg-primary-500 text-neutral-800" 
                  : "bg-white text-neutral-800 hover:bg-gray-700"
              }`}
            >
              📋 Presupuestos
            </button>
            <button
              onClick={() => setActiveTab("forecasting")}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === "forecasting" 
                  ? "bg-primary-500 text-neutral-800" 
                  : "bg-white text-neutral-800 hover:bg-gray-700"
              }`}
            >
              🔮 Pronósticos
            </button>
          </div>
        </div>

        {/* Main Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 rounded-lg">
                <div className="text-2xl font-bold">
                  ${Object.values(budgetAnalytics).reduce((sum, a) => sum + a.budget, 0).toLocaleString()}
                </div>
                <div className="text-sm opacity-90">Presupuesto Total</div>
              </div>
              <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-4 rounded-lg">
                <div className="text-2xl font-bold">
                  ${Object.values(budgetAnalytics).reduce((sum, a) => sum + a.spent, 0).toLocaleString()}
                </div>
                <div className="text-sm opacity-90">Gastado</div>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-violet-600 p-4 rounded-lg">
                <div className="text-2xl font-bold">
                  ${Object.values(budgetAnalytics).reduce((sum, a) => sum + a.remaining, 0).toLocaleString()}
                </div>
                <div className="text-sm opacity-90">Restante</div>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-red-600 p-4 rounded-lg">
                <div className="text-2xl font-bold">
                  {budgets.filter(b => b.is_active).length}
                </div>
                <div className="text-sm opacity-90">Presupuestos Activos</div>
              </div>
            </div>

            {/* Budget Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(budgetAnalytics).map(([category, analytics]) => {
                const categoryInfo = budgetCategories.find(c => c.id === category);
                return (
                  <div key={category} className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{categoryInfo?.icon}</span>
                        <div>
                          <h3 className="font-semibold">{categoryInfo?.name}</h3>
                          <p className="text-sm text-neutral-600">{periods.find(p => p.id === budgets.find(b => b.category === category)?.period)?.name}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        analytics.status === 'danger' ? 'bg-red-900 text-red-200' :
                        analytics.status === 'warning' ? 'bg-yellow-900 text-yellow-200' :
                        'bg-green-900 text-green-200'
                      }`}>
                        {analytics.status === 'danger' ? '🚨' : analytics.status === 'warning' ? '⚠️' : '✅'}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Presupuesto:</span>
                        <span className="font-semibold">${analytics.budget.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Gastado:</span>
                        <span className="font-semibold">${analytics.spent.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Restante:</span>
                        <span className={`font-semibold ${
                          analytics.remaining < 0 ? 'text-neutral-600' : 'text-primary-500'
                        }`}>
                          ${analytics.remaining.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progreso</span>
                        <span>{analytics.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full bg-gradient-to-r ${categoryInfo?.color} ${
                            analytics.percentage > 90 ? 'animate-pulse' : ''
                          }`}
                          style={{ width: `${Math.min(analytics.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "budgets" && (
          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
            <h2 className="text-xl font-bold text-primary-500 mb-6">📋 Presupuestos Configurados</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Categoría</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Período</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Presupuesto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Gastado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Restante</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {budgets.map((budget) => {
                    const analytics = budgetAnalytics[budget.category];
                    const categoryInfo = budgetCategories.find(c => c.id === budget.category);
                    const periodInfo = periods.find(p => p.id === budget.period);
                    
                    return (
                      <tr key={budget.id} className="hover:bg-white transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{categoryInfo?.icon}</span>
                            <div>
                              <div className="font-medium">{categoryInfo?.name}</div>
                              <div className="text-sm text-neutral-600">{budget.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {periodInfo?.icon} {periodInfo?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          ${budget.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          ${analytics?.spent.toLocaleString() || '0'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={analytics?.remaining < 0 ? 'text-neutral-600' : 'text-primary-500'}>
                            ${analytics?.remaining.toLocaleString() || budget.amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            analytics?.status === 'danger' ? 'bg-red-900 text-red-200' :
                            analytics?.status === 'warning' ? 'bg-yellow-900 text-yellow-200' :
                            'bg-green-900 text-green-200'
                          }`}>
                            {analytics?.status === 'danger' ? '🚨 Excedido' : 
                             analytics?.status === 'warning' ? '⚠️ Cerca' : '✅ En Límite'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleEditBudget(budget)}
                            className="text-primary-500 hover:text-blue-300 mr-2"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleDeleteBudget(budget.id)}
                            className="text-neutral-600 hover:text-red-300"
                          >
                            🗑️ Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "forecasting" && (
          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
            <h2 className="text-xl font-bold text-primary-500 mb-6">🔮 Pronósticos de Gastos</h2>
            <div className="text-center text-neutral-600 py-8">
              <div className="text-4xl mb-4">📊</div>
              <p>Análisis predictivo de gastos próximos</p>
              <p className="text-sm mt-2">Basado en tendencias históricas y patrones de gasto</p>
            </div>
          </div>
        )}
      </div>

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-[999999]">
          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-primary-500">
                {selectedBudget ? "✏️ Editar Presupuesto" : "➕ Nuevo Presupuesto"}
              </h3>
              <button
                onClick={() => setShowBudgetModal(false)}
                className="text-neutral-600 hover:text-neutral-800"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {budgetCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Período</label>
                  <select
                    className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                    name="period"
                    value={form.period}
                    onChange={handleChange}
                    required
                  >
                    {periods.map(period => (
                      <option key={period.id} value={period.id}>{period.icon} {period.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Monto del Presupuesto</label>
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
                
                <div>
                  <label className="block text-sm font-medium mb-2">Sucursal</label>
                  <select
                    className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                    name="store_id"
                    value={form.store_id}
                    onChange={handleChange}
                  >
                    <option value="">Todas las Sucursales</option>
                    <option value="1">Atlixco</option>
                    <option value="2">Cholula</option>
                    <option value="3">Chipilo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Fecha de Inicio</label>
                  <input
                    type="date"
                    className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                    name="start_date"
                    value={form.start_date}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Fecha de Fin</label>
                  <input
                    type="date"
                    className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                    name="end_date"
                    value={form.end_date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Descripción</label>
                <textarea
                  className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                  placeholder="Describe el presupuesto..."
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="3"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                  className="mr-2"
                />
                <label className="text-sm">Presupuesto Activo</label>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-neutral-800 font-bold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? "⏳ Guardando..." : (selectedBudget ? "💾 Actualizar" : "💾 Crear Presupuesto")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-neutral-800 font-bold rounded-lg transition-all duration-200"
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default BudgetManagement; 