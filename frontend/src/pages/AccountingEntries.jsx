import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AccountingEntries = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("entries");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const token = localStorage.getItem("token");

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const [entriesRes, accountsRes, analyticsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/accounting/journal-entries`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/accounting/chart-of-accounts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/accounting/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);
      
      setEntries(entriesRes.data);
      setAccounts(accountsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error("Error fetching accounting data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Filter entries based on search and filters
  const filteredEntries = useMemo(() => {
    let filtered = entries;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(entry => 
        entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.source_type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Account filter
    if (selectedAccount !== "all") {
      filtered = filtered.filter(entry => entry.account_code === selectedAccount);
    }

    // Source filter
    if (selectedSource !== "all") {
      filtered = filtered.filter(entry => entry.source_type === selectedSource);
    }

    // Date range filter
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        return entryDate >= startDate && entryDate <= endDate;
      });
    }

    return filtered;
  }, [entries, searchTerm, selectedAccount, selectedSource, dateRange]);

  // Calculate totals
  const totals = useMemo(() => {
    const totals = {
      totalDebits: 0,
      totalCredits: 0,
      netMovement: 0,
      byAccount: {},
      bySource: {},
      byType: {}
    };

    filteredEntries.forEach(entry => {
      const amount = parseFloat(entry.debit || 0) + parseFloat(entry.credit || 0);
      
      totals.totalDebits += parseFloat(entry.debit || 0);
      totals.totalCredits += parseFloat(entry.credit || 0);
      
      // By account
      if (!totals.byAccount[entry.account_name]) {
        totals.byAccount[entry.account_name] = { debits: 0, credits: 0, net: 0 };
      }
      totals.byAccount[entry.account_name].debits += parseFloat(entry.debit || 0);
      totals.byAccount[entry.account_name].credits += parseFloat(entry.credit || 0);
      totals.byAccount[entry.account_name].net += parseFloat(entry.debit || 0) - parseFloat(entry.credit || 0);
      
      // By source
      if (!totals.bySource[entry.source_type]) {
        totals.bySource[entry.source_type] = 0;
      }
      totals.bySource[entry.source_type] += amount;
      
      // By type
      const type = entry.debit > 0 ? 'debit' : 'credit';
      if (!totals.byType[type]) {
        totals.byType[type] = 0;
      }
      totals.byType[type] += amount;
    });

    totals.netMovement = totals.totalDebits - totals.totalCredits;
    return totals;
  }, [filteredEntries]);

  // Chart data
  const chartData = useMemo(() => {
    if (!analytics) return null;

    return {
      movementTrend: {
        labels: analytics.movementTrend?.map(t => t.date) || [],
        datasets: [{
          label: 'Movimientos Diarios',
          data: analytics.movementTrend?.map(t => t.count) || [],
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      accountDistribution: {
        labels: Object.keys(totals.byAccount).slice(0, 10),
        datasets: [{
          data: Object.values(totals.byAccount).map(acc => Math.abs(acc.net)).slice(0, 10),
          backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'],
          borderWidth: 2
        }]
      },
      sourceDistribution: {
        labels: Object.keys(totals.bySource),
        datasets: [{
          data: Object.values(totals.bySource),
          backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'],
          borderWidth: 2
        }]
      }
    };
  }, [analytics, totals]);

  const getSourceIcon = (sourceType) => {
    const icons = {
      'loan_creation': '💰',
      'payment': '💳',
      'expense': '📊',
      'expense_approved': '✅',
      'expense_payment': '💸',
      'expense_direct_payment': '💳',
      'inventory': '📦',
      'inventory_approved': '✅',
      'inventory_payment': '💵',
      'inventory_direct_payment': '💳',
      'inventory_reception': '📥',
      'manual_entry': '✏️',
      'customer_setup': '👤',
      'payroll': '👥',
      'invoice_generated': '📄',
      'invoice_payment': '💵',
      'delivery': '🚚',
      'repossessed': '🔄',
      'repossession': '🔄',
      'repossession_adjustment': '⚖️',
      'repossession_surplus': '📈',
      'settlement': '✅',
      'write_off': '❌',
      'general_expense_payment': '💸',
      'default': '📋'
    };
    return icons[sourceType] || icons.default;
  };

  const getSourceColor = (sourceType) => {
    const colors = {
      'loan_creation': 'text-primary-500',
      'payment': 'text-primary-500',
      'expense': 'text-red-500',
      'expense_approved': 'text-yellow-500',
      'expense_payment': 'text-green-500',
      'expense_direct_payment': 'text-orange-500',
      'inventory': 'text-purple-400',
      'inventory_approved': 'text-yellow-500',
      'inventory_payment': 'text-green-500',
      'inventory_direct_payment': 'text-orange-500',
      'inventory_reception': 'text-indigo-500',
      'manual_entry': 'text-yellow-400',
      'customer_setup': 'text-cyan-400',
      'payroll': 'text-orange-500',
      'invoice_generated': 'text-blue-500',
      'invoice_payment': 'text-green-500',
      'delivery': 'text-teal-500',
      'repossessed': 'text-amber-500',
      'repossession': 'text-amber-500',
      'repossession_adjustment': 'text-amber-600',
      'repossession_surplus': 'text-lime-500',
      'settlement': 'text-emerald-500',
      'write_off': 'text-red-600',
      'general_expense_payment': 'text-rose-500',
      'default': 'text-neutral-600'
    };
    return colors[sourceType] || colors.default;
  };

  const getSourceLabel = (sourceType) => {
    const labels = {
      'loan_creation': 'Creación de Préstamo',
      'payment': 'Pago Recibido',
      'expense': 'Gasto Operativo',
      'expense_approved': 'Gasto Aprobado',
      'expense_payment': 'Pago de Gasto',
      'expense_direct_payment': 'Pago Directo Gasto',
      'inventory': 'Inventario',
      'inventory_approved': 'Inventario Aprobado',
      'inventory_payment': 'Pago Inventario',
      'inventory_direct_payment': 'Pago Directo Inventario',
      'inventory_reception': 'Recepción Inventario',
      'manual_entry': 'Entrada Manual',
      'customer_setup': 'Config. Cliente',
      'payroll': 'Nómina',
      'invoice_generated': 'Factura Generada',
      'invoice_payment': 'Pago de Factura',
      'delivery': 'Entrega Producto',
      'repossessed': 'Reposesión',
      'repossession': 'Reposesión',
      'repossession_adjustment': 'Ajuste Reposesión',
      'repossession_surplus': 'Excedente Reposesión',
      'settlement': 'Liquidación',
      'write_off': 'Cuenta Incobrable',
      'general_expense_payment': 'Pago Gasto General',
      'default': sourceType
    };
    return labels[sourceType] || labels.default;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 text-neutral-800">
        {/* Header */}
        <div className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">📊 Asientos Contables</h1>
              <p className="text-neutral-600">Auditoría completa de movimientos contables y su impacto en las cuentas</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab("entries")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === "entries" 
                    ? 'bg-primary-500 text-neutral-800' 
                    : 'bg-gray-700 text-neutral-800 hover:bg-gray-600'
                }`}
              >
                📋 Movimientos
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === "analytics" 
                    ? 'bg-primary-500 text-neutral-800' 
                    : 'bg-gray-700 text-neutral-800 hover:bg-gray-600'
                }`}
              >
                📈 Análisis
              </button>
              <button
                onClick={() => setActiveTab("accounts")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === "accounts" 
                    ? 'bg-primary-500 text-neutral-800' 
                    : 'bg-gray-700 text-neutral-800 hover:bg-gray-600'
                }`}
              >
                🏦 Cuentas
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "entries" && (
            <div className="max-w-7xl mx-auto">
              {/* Filters */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
                <h3 className="text-lg font-bold mb-4 text-neutral-800">🔍 Filtros</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      🔍 Buscar
                    </label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Descripción, cuenta, fuente..."
                      className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      🏦 Cuenta
                    </label>
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                    >
                      <option value="all">Todas las Cuentas</option>
                      {accounts.map(account => (
                        <option key={account.code} value={account.code}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      📋 Fuente
                    </label>
                    <select
                      value={selectedSource}
                      onChange={(e) => setSelectedSource(e.target.value)}
                      className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                    >
                      <option value="all">Todas las Fuentes</option>
                      <optgroup label="📄 Facturación">
                        <option value="invoice_generated">📄 Factura Generada</option>
                        <option value="invoice_payment">💵 Pago de Factura</option>
                      </optgroup>
                      <optgroup label="💰 Tesorería">
                        <option value="expense_approved">✅ Gasto Aprobado</option>
                        <option value="expense_payment">💸 Pago de Gasto</option>
                        <option value="inventory_approved">✅ Inventario Aprobado</option>
                        <option value="inventory_payment">💵 Pago Inventario</option>
                      </optgroup>
                      <optgroup label="👥 Nómina">
                        <option value="payroll">👥 Nómina Procesada</option>
                      </optgroup>
                      <optgroup label="📦 Inventario">
                        <option value="inventory_reception">📥 Recepción</option>
                        <option value="delivery">🚚 Entrega Producto</option>
                      </optgroup>
                      <optgroup label="💳 Pagos/Préstamos">
                        <option value="payment">💳 Pago Recibido</option>
                        <option value="loan_creation">💰 Creación Préstamo</option>
                      </optgroup>
                      <optgroup label="📋 Otros">
                        <option value="settlement">✅ Liquidación</option>
                        <option value="write_off">❌ Cuenta Incobrable</option>
                        <option value="repossession">🔄 Reposesión</option>
                        <option value="manual_entry">✏️ Entrada Manual</option>
                        <option value="customer_setup">👤 Config. Cliente</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      📅 Rango de Fechas
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="flex-1 bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent text-sm"
                      />
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="flex-1 bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-200 text-sm">Total Débitos</p>
                      <p className="text-neutral-800 text-xl font-bold">{formatCurrency(totals.totalDebits)}</p>
                    </div>
                    <div className="text-blue-200 text-2xl">📈</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-200 text-sm">Total Créditos</p>
                      <p className="text-neutral-800 text-xl font-bold">{formatCurrency(totals.totalCredits)}</p>
                    </div>
                    <div className="text-red-200 text-2xl">📉</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-200 text-sm">Movimiento Neto</p>
                      <p className="text-neutral-800 text-xl font-bold">{formatCurrency(totals.netMovement)}</p>
                    </div>
                    <div className="text-green-200 text-2xl">⚖️</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-200 text-sm">Movimientos</p>
                      <p className="text-neutral-800 text-xl font-bold">{filteredEntries.length}</p>
                    </div>
                    <div className="text-purple-200 text-2xl">📊</div>
                  </div>
                </div>
              </div>

              {/* Entries Table */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-lg font-bold mb-4 text-neutral-800">📋 Movimientos Contables</h3>
                
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-400"></div>
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center text-neutral-600 py-8">
                    <div className="text-4xl mb-2">📋</div>
                    <p>No hay movimientos contables registrados</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Fecha</th>
                          <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Cuenta</th>
                          <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Descripción</th>
                          <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Débito</th>
                          <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Crédito</th>
                          <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Fuente</th>
                          <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {filteredEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-700 transition-colors">
                            <td className="px-4 py-3 text-neutral-800">
                              {new Date(entry.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-neutral-800 font-medium">
                              {entry.account_name}
                            </td>
                            <td className="px-4 py-3 text-neutral-800">
                              {entry.description}
                            </td>
                            <td className="px-4 py-3 text-right text-primary-500">
                              {parseFloat(entry.debit || 0) > 0 ? formatCurrency(entry.debit) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-neutral-600">
                              {parseFloat(entry.credit || 0) > 0 ? formatCurrency(entry.credit) : '-'}
                            </td>
                            <td className="px-4 py-3 text-neutral-800">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 ${getSourceColor(entry.source_type)}`}>
                                {getSourceIcon(entry.source_type)} {getSourceLabel(entry.source_type)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  setSelectedEntry(entry);
                                  setShowDetails(true);
                                }}
                                className="px-3 py-1 bg-primary-500 text-neutral-800 text-xs font-medium rounded hover:bg-lime-400 transition"
                              >
                                👁️ Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "analytics" && chartData && (
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl border border-neutral-200 p-6">
                  <h3 className="text-lg font-bold mb-4 text-neutral-800">📈 Tendencia de Movimientos</h3>
                  <div className="h-64">
                    <Line 
                      data={chartData.movementTrend}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            labels: {
                              color: '#D1D5DB'
                            }
                          }
                        },
                        scales: {
                          x: {
                            ticks: {
                              color: '#D1D5DB'
                            },
                            grid: {
                              color: '#374151'
                            }
                          },
                          y: {
                            ticks: {
                              color: '#D1D5DB'
                            },
                            grid: {
                              color: '#374151'
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                
                <div className="bg-white rounded-xl border border-neutral-200 p-6">
                  <h3 className="text-lg font-bold mb-4 text-neutral-800">🏦 Distribución por Cuenta</h3>
                  <div className="h-64">
                    <Doughnut 
                      data={chartData.accountDistribution}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              color: '#D1D5DB',
                              font: { size: 10 }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-lg font-bold mb-4 text-neutral-800">📊 Distribución por Fuente</h3>
                <div className="h-64">
                  <Bar 
                    data={chartData.sourceDistribution}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          labels: {
                            color: '#D1D5DB'
                          }
                        }
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: '#D1D5DB'
                          },
                          grid: {
                            color: '#374151'
                          }
                        },
                        y: {
                          ticks: {
                            color: '#D1D5DB'
                          },
                          grid: {
                            color: '#374151'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "accounts" && (
            <div className="max-w-7xl mx-auto">
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-lg font-bold mb-4 text-neutral-800">🏦 Resumen por Cuenta</h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Cuenta</th>
                        <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Total Débitos</th>
                        <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Total Créditos</th>
                        <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Saldo Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {Object.entries(totals.byAccount).map(([accountName, data]) => (
                        <tr key={accountName} className="hover:bg-gray-700 transition-colors">
                          <td className="px-4 py-3 text-neutral-800 font-medium">
                            {accountName}
                          </td>
                          <td className="px-4 py-3 text-right text-primary-500">
                            {formatCurrency(data.debits)}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-600">
                            {formatCurrency(data.credits)}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${
                            data.net > 0 ? 'text-primary-500' : data.net < 0 ? 'text-neutral-600' : 'text-neutral-600'
                          }`}>
                            {formatCurrency(data.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Entry Details Modal */}
        {showDetails && selectedEntry && (
          <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl border border-neutral-200 p-6 max-w-2xl w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-neutral-800">📋 Detalles del Movimiento</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-neutral-600 hover:text-neutral-800"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-600">Fecha</label>
                    <p className="text-neutral-800">{new Date(selectedEntry.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600">Cuenta</label>
                    <p className="text-neutral-800 font-medium">{selectedEntry.account_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600">Débito</label>
                    <p className="text-primary-500">{parseFloat(selectedEntry.debit || 0) > 0 ? formatCurrency(selectedEntry.debit) : '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600">Crédito</label>
                    <p className="text-neutral-600">{parseFloat(selectedEntry.credit || 0) > 0 ? formatCurrency(selectedEntry.credit) : '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600">Fuente</label>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 ${getSourceColor(selectedEntry.source_type)}`}>
                      {getSourceIcon(selectedEntry.source_type)} {getSourceLabel(selectedEntry.source_type)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600">ID de Fuente</label>
                    <p className="text-neutral-800">{selectedEntry.source_id || 'N/A'}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-600">Descripción</label>
                  <p className="text-neutral-800">{selectedEntry.description}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-600">Creado por</label>
                  <p className="text-neutral-800">{selectedEntry.created_by || 'Sistema'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AccountingEntries;
