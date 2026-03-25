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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    payment_method: 'transferencia',
    reference: '',
    payment_date: new Date().toISOString().split('T')[0]
  });
  
  const [form, setForm] = useState({
    category: "",
    account_code: "",
    amount: "",
    description: "",
    expense_date: new Date().toISOString().split('T')[0],
    vendor: "",
    payment_method: "",
    recurring: false,
    notes: ""
  });

  // Marketing Agency Expense Categories (mapped to chart of accounts)
  const expenseCategories = [
    { 
      id: "payroll", 
      name: "Nómina", 
      icon: "👥", 
      color: "from-red-500 to-pink-600", 
      budget: 110000,
      account_code: "6000",
      description: "Sueldos y salarios del equipo"
    },
    { 
      id: "meta_ads", 
      name: "Meta Ads", 
      icon: "📱", 
      color: "from-blue-500 to-cyan-600", 
      budget: 20000,
      account_code: "6001",
      description: "Facebook e Instagram Ads"
    },
    { 
      id: "google_ads", 
      name: "Google Ads", 
      icon: "🔍", 
      color: "from-yellow-500 to-orange-600", 
      budget: 15000,
      account_code: "6002",
      description: "Google Search y Display"
    },
    { 
      id: "tiktok_ads", 
      name: "TikTok Ads", 
      icon: "🎵", 
      color: "from-pink-500 to-rose-600", 
      budget: 10000,
      account_code: "6003",
      description: "TikTok Advertising"
    },
    { 
      id: "tools", 
      name: "Herramientas", 
      icon: "🛠️", 
      color: "from-purple-500 to-violet-600", 
      budget: 8000,
      account_code: "6004",
      description: "Canva, Adobe, Hootsuite, etc."
    },
    { 
      id: "assets", 
      name: "Assets/Stock", 
      icon: "📸", 
      color: "from-green-500 to-emerald-600", 
      budget: 3000,
      account_code: "6005",
      description: "Fotos, videos, música stock"
    },
    { 
      id: "freelancers", 
      name: "Freelancers", 
      icon: "✍️", 
      color: "from-indigo-500 to-blue-600", 
      budget: 15000,
      account_code: "6006",
      description: "Contratistas y colaboradores"
    },
    { 
      id: "marketing_own", 
      name: "Marketing Propio", 
      icon: "📢", 
      color: "from-orange-500 to-red-600", 
      budget: 5000,
      account_code: "6100",
      description: "Marketing de la agencia"
    },
    { 
      id: "rent", 
      name: "Renta Oficina", 
      icon: "🏢", 
      color: "from-teal-500 to-cyan-600", 
      budget: 15000,
      account_code: "6200",
      description: "Renta de espacio"
    },
    { 
      id: "internet", 
      name: "Internet", 
      icon: "📡", 
      color: "from-blue-500 to-indigo-600", 
      budget: 1500,
      account_code: "6230",
      description: "Internet y telefonía"
    },
    { 
      id: "software_subscriptions", 
      name: "Software/SaaS", 
      icon: "💻", 
      color: "from-purple-500 to-pink-600", 
      budget: 5000,
      account_code: "6240",
      description: "Suscripciones de software"
    },
    { 
      id: "other", 
      name: "Otros Gastos", 
      icon: "📦", 
      color: "from-gray-500 to-slate-600", 
      budget: 8000,
      account_code: "6999",
      description: "Gastos varios"
    }
  ];

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenses(res.data || []);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category) => {
    setForm(prev => ({
      ...prev,
      category: category.id,
      account_code: category.account_code
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const expenseData = {
        category: form.category,
        description: form.description || expenseCategories.find(c => c.id === form.category)?.name || 'Gasto',
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        vendor: form.vendor || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null
      };

      await axios.post(`${API_BASE_URL}/api/expenses/create`, expenseData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      alert("✅ Gasto registrado exitosamente");
      
      setForm({
        category: "",
        account_code: "",
        amount: "",
        description: "",
        expense_date: new Date().toISOString().split('T')[0],
        vendor: "",
        payment_method: "",
        recurring: false,
        notes: ""
      });
      
      fetchExpenses();
    } catch (err) {
      console.error("Error saving expense:", err);
      alert("❌ Error al registrar el gasto: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePayExpense = (expense) => {
    setSelectedExpense(expense);
    setPaymentData({
      payment_method: 'transferencia',
      reference: '',
      payment_date: new Date().toISOString().split('T')[0]
    });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    try {
      setLoading(true);
      
      await axios.post(
        `${API_BASE_URL}/api/expenses/${selectedExpense.id}/pay`,
        paymentData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`✅ Pago de ${formatCurrency(selectedExpense.amount)} registrado correctamente`);
      setShowPaymentModal(false);
      setSelectedExpense(null);
      fetchExpenses();
    } catch (err) {
      console.error("Error recording payment:", err);
      alert("❌ Error al registrar pago: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const analytics = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
    const byCategory = {};
    
    expenseCategories.forEach(cat => {
      const categoryExpenses = expenses.filter(e => e.category === cat.id);
      const spent = categoryExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
      byCategory[cat.id] = {
        spent,
        budget: cat.budget,
        percentage: (spent / cat.budget) * 100,
        count: categoryExpenses.length
      };
    });
    
    const totalBudget = expenseCategories.reduce((sum, cat) => sum + cat.budget, 0);
    
    return { total, byCategory, totalBudget };
  }, [expenses]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const paidExpenses = expenses.filter(e => e.status === 'paid');
  const pendingExpenses = expenses.filter(e => e.status !== 'paid');

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-black">💳 Gestión de Gastos</h1>
                <p className="text-gray-500 text-sm mt-1">Control de gastos operativos y contabilidad automática</p>
              </div>
              <button
                onClick={fetchExpenses}
                className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                🔄 Actualizar
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-zionx-secondary p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Gastos</p>
                  <p className="text-3xl font-bold text-red-600">{formatCurrency(analytics.total)}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">💸</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zionx-secondary p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Registros</p>
                  <p className="text-3xl font-bold text-blue-600">{expenses.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📋</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zionx-secondary p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Presupuesto</p>
                  <p className="text-3xl font-bold text-purple-600">{formatCurrency(analytics.totalBudget)}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zionx-secondary p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Restante</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(analytics.totalBudget - analytics.total)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Registration Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-zionx-secondary p-6">
                <h2 className="text-xl font-bold text-zionx-primary mb-6">📝 Registrar Nuevo Gasto</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Category Selection - Visual Cards */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Categoría del Gasto *</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {expenseCategories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleCategorySelect(cat)}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            form.category === cat.id
                              ? 'border-zionx-primary bg-lime-50 shadow-lg'
                              : 'border-gray-200 hover:border-gray-300 hover:shadow'
                          }`}
                        >
                          <div className="text-3xl mb-1">{cat.icon}</div>
                          <div className="font-medium text-sm">{cat.name}</div>
                          <div className="text-xs text-gray-500 mt-1">{formatCurrency(cat.budget)}</div>
                        </button>
                      ))}
                    </div>
                    {form.category && (
                      <p className="text-xs text-gray-500 mt-2">
                        💡 {expenseCategories.find(c => c.id === form.category)?.description}
                      </p>
                    )}
                  </div>

                  {/* Amount and Date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Monto *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          name="amount"
                          value={form.amount}
                          onChange={(e) => setForm({...form, amount: e.target.value})}
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary focus:border-transparent"
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fecha *</label>
                      <input
                        type="date"
                        name="expense_date"
                        value={form.expense_date}
                        onChange={(e) => setForm({...form, expense_date: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* Vendor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor / Vendor</label>
                    <input
                      type="text"
                      name="vendor"
                      value={form.vendor}
                      onChange={(e) => setForm({...form, vendor: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary focus:border-transparent"
                      placeholder="Nombre del proveedor"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Descripción *</label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={(e) => setForm({...form, description: e.target.value})}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary focus:border-transparent"
                      placeholder="Describe el gasto..."
                      required
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
                    <select
                      name="payment_method"
                      value={form.payment_method}
                      onChange={(e) => setForm({...form, payment_method: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary focus:border-transparent"
                    >
                      <option value="">Por pagar</option>
                      <option value="transferencia">🏦 Transferencia</option>
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="tarjeta">💳 Tarjeta</option>
                      <option value="cheque">📝 Cheque</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {form.payment_method ? '✅ Se registrará como pagado' : '⏳ Se registrará como por pagar'}
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
                    <input
                      type="text"
                      name="notes"
                      value={form.notes}
                      onChange={(e) => setForm({...form, notes: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary focus:border-transparent"
                      placeholder="Notas adicionales..."
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-zionx-primary text-black font-bold py-3 px-6 rounded-lg hover:bg-lime-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "⏳ Guardando..." : "💾 Registrar Gasto"}
                  </button>
                </form>
              </div>
            </div>

            {/* Categories Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-zionx-secondary p-6 sticky top-6">
                <h3 className="text-lg font-bold text-zionx-primary mb-4">📊 Presupuesto por Categoría</h3>
                <div className="space-y-4">
                  {expenseCategories.map(category => {
                    const data = analytics.byCategory[category.id] || { spent: 0, percentage: 0, count: 0 };
                    const remaining = category.budget - data.spent;
                    
                    return (
                      <div key={category.id} className="border-b border-gray-100 pb-3 last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{category.icon}</span>
                            <span className="font-medium text-sm">{category.name}</span>
                          </div>
                          <span className="text-xs text-gray-500">{data.count} gastos</span>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">
                          {formatCurrency(data.spent)} / {formatCurrency(category.budget)}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              data.percentage > 90 ? 'bg-red-600' :
                              data.percentage > 75 ? 'bg-orange-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(data.percentage, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{data.percentage.toFixed(1)}%</span>
                          <span className={remaining < 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
                            {remaining < 0 ? 'Excedido' : `Quedan ${formatCurrency(remaining)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Expenses List */}
          <div className="mt-8 bg-white rounded-xl border border-zionx-secondary overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zionx-primary">📋 Gastos Registrados</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'all' ? 'bg-black text-white' : 'bg-gray-100'}`}
                >
                  Todos ({expenses.length})
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'pending' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
                >
                  Por Pagar ({pendingExpenses.length})
                </button>
                <button
                  onClick={() => setActiveTab('paid')}
                  className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'paid' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
                >
                  Pagados ({paidExpenses.length})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {expenses
                    .filter(e => {
                      if (activeTab === 'pending') return e.status !== 'paid';
                      if (activeTab === 'paid') return e.status === 'paid';
                      return true;
                    })
                    .map((expense) => {
                    const category = expenseCategories.find(c => c.id === expense.category);
                    return (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {new Date(expense.expense_date || expense.created_at).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{category?.icon || '📦'}</span>
                            <span className="text-sm font-medium">{category?.name || expense.category}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium">{expense.description}</div>
                          {expense.vendor && (
                            <div className="text-xs text-gray-500 mt-1">Proveedor: {expense.vendor}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="font-bold text-zionx-primary">{formatCurrency(expense.amount)}</div>
                          {expense.payment_method && (
                            <div className="text-xs text-gray-500">{expense.payment_method}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            expense.status === 'paid' ? 'bg-green-100 text-green-800' :
                            expense.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {expense.status === 'paid' ? '✅ Pagado' :
                             expense.status === 'approved' ? '👍 Aprobado' :
                             '⏳ Pendiente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {expense.status !== 'paid' && (
                            <button
                              onClick={() => handlePayExpense(expense)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 mr-2"
                            >
                              💰 Pagar
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedExpense(expense);
                              setShowModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            👁️ Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <span className="text-4xl mb-2">📋</span>
                          <p>No hay gastos registrados</p>
                          <p className="text-xs mt-1">Registra tu primer gasto arriba</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedExpense && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-zionx-primary">💰 Registrar Pago de Gasto</h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600">Gasto</p>
                <p className="font-bold">{selectedExpense.description}</p>
                <p className="text-sm text-gray-600 mt-2">Categoría</p>
                <p className="font-medium">{expenseCategories.find(c => c.id === selectedExpense.category)?.name}</p>
                <div className="mt-3 pt-3 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Monto:</span>
                    <span className="font-bold text-lg">{formatCurrency(selectedExpense.amount)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago *</label>
                  <select
                    value={paymentData.payment_method}
                    onChange={(e) => setPaymentData({...paymentData, payment_method: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="transferencia">🏦 Transferencia Bancaria</option>
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                    <option value="cheque">📝 Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Referencia / No. Transacción</label>
                  <input
                    type="text"
                    value={paymentData.reference}
                    onChange={(e) => setPaymentData({...paymentData, reference: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ej: SPEI-123456, No. Cheque, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Pago</label>
                  <input
                    type="date"
                    value={paymentData.payment_date}
                    onChange={(e) => setPaymentData({...paymentData, payment_date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    📒 <strong>Asientos Contables:</strong> Al pagar, se crearán automáticamente:
                  </p>
                  <div className="text-xs text-blue-700 mt-2 space-y-1">
                    <div>• Debe: {selectedExpense.category ? expenseCategories.find(c => c.id === selectedExpense.category)?.account_code : '6999'} (Gasto) - {formatCurrency(selectedExpense.amount)}</div>
                    <div>• Haber: {paymentData.payment_method === 'efectivo' ? '1101 (Caja)' : '1102 (Banco)'} - {formatCurrency(selectedExpense.amount)}</div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRecordPayment}
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? 'Registrando...' : '✓ Registrar Pago'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Modal */}
        {showModal && selectedExpense && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-zionx-primary">📄 Detalle del Gasto</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Fecha</label>
                    <p className="font-medium">{new Date(selectedExpense.expense_date || selectedExpense.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Categoría</label>
                    <p className="font-medium">{expenseCategories.find(c => c.id === selectedExpense.category)?.name || selectedExpense.category}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Monto</label>
                    <p className="font-bold text-lg text-zionx-primary">{formatCurrency(selectedExpense.amount)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Estado</label>
                    <p className="font-medium">
                      {selectedExpense.status === 'paid' ? '✅ Pagado' : '⏳ Pendiente'}
                    </p>
                  </div>
                </div>
                
                {selectedExpense.vendor && (
                  <div>
                    <label className="text-sm text-gray-600">Proveedor</label>
                    <p className="font-medium">{selectedExpense.vendor}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm text-gray-600">Descripción</label>
                  <p>{selectedExpense.description || "Sin descripción"}</p>
                </div>

                {selectedExpense.notes && (
                  <div>
                    <label className="text-sm text-gray-600">Notas</label>
                    <p className="text-sm">{selectedExpense.notes}</p>
                  </div>
                )}

                {selectedExpense.payment_method && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <label className="text-sm text-green-800 font-medium">Información de Pago</label>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <div>
                        <span className="text-gray-600">Método:</span>
                        <span className="ml-2 font-medium">{selectedExpense.payment_method}</span>
                      </div>
                      {selectedExpense.payment_reference && (
                        <div>
                          <span className="text-gray-600">Ref:</span>
                          <span className="ml-2 font-medium">{selectedExpense.payment_reference}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                {selectedExpense.status !== 'paid' && (
                  <button
                    onClick={() => {
                      setShowModal(false);
                      handlePayExpense(selectedExpense);
                    }}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    💰 Pagar Ahora
                  </button>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminExpenses;
