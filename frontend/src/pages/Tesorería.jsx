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

const Tesoreria = () => {
  const [inventoryOrders, setInventoryOrders] = useState([]);
  const [expenseOrders, setExpenseOrders] = useState([]);
  const [proofFiles, setProofFiles] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({});
  const [paidInventoryOrders, setPaidInventoryOrders] = useState([]);
  const [paidExpenseOrders, setPaidExpenseOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [bankStatements, setBankStatements] = useState([]);
  const [reconciliationData, setReconciliationData] = useState([]);
  const [cashFlowData, setCashFlowData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const [ordersRes, historyRes, cashFlowRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/treasury/payment-orders`, {
          headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        }),
        axios.get(`${API_BASE_URL}/treasury/payment-orders/history`, {
          headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        }),
        axios.get(`${API_BASE_URL}/treasury/cash-flow?period=${selectedPeriod}`, {
          headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        })
      ]);

      setInventoryOrders(ordersRes.data.inventory || []);
      setExpenseOrders(ordersRes.data.expenses || []);
      setPaidInventoryOrders(historyRes.data.inventory || []);
      setPaidExpenseOrders(historyRes.data.expenses || []);
      setCashFlowData(cashFlowRes.data);

      // Mock bank statements and reconciliation data
      setBankStatements([
        { id: 1, date: '2025-08-01', description: 'Depósito Cliente', amount: 5000, type: 'credit', reconciled: true },
        { id: 2, date: '2025-08-02', description: 'Pago Proveedor', amount: 2000, type: 'debit', reconciled: true },
        { id: 3, date: '2025-08-03', description: 'Transferencia Bancaria', amount: 1500, type: 'credit', reconciled: false },
        { id: 4, date: '2025-08-04', description: 'Comisión Bancaria', amount: 50, type: 'debit', reconciled: false }
      ]);

      setReconciliationData([
        { id: 1, bankAmount: 5000, systemAmount: 5000, difference: 0, status: 'reconciled', date: '2025-08-01' },
        { id: 2, bankAmount: 2000, systemAmount: 2000, difference: 0, status: 'reconciled', date: '2025-08-02' },
        { id: 3, bankAmount: 1500, systemAmount: 0, difference: 1500, status: 'pending', date: '2025-08-03' },
        { id: 4, bankAmount: 50, systemAmount: 0, difference: 50, status: 'pending', date: '2025-08-04' }
      ]);

    } catch (err) {
      console.error("Error fetching treasury data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmation = async (type, id) => {
    const file = proofFiles[id];
    if (!file) return alert("Por favor sube un comprobante antes de confirmar.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("id", id);
    formData.append("type", type);
    formData.append("method", paymentMethods[id] || "efectivo");

    console.log("🔍 Submitting payment:", {
      id,
      type,
      method: paymentMethods[id],
      file: proofFiles[id]
    });

    try {
      await axios.post(`${API_BASE_URL}/treasury/mark-paid`, formData, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
          "Content-Type": "multipart/form-data",
        },
      });
      alert("Pago registrado correctamente.");
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchOrders();
    } catch (err) {
      console.error("Error uploading proof:", err);
      alert("Error al registrar el pago.");
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedPeriod]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const today = new Date();
    const expensesDueTodayOrOverdue = expenseOrders.filter(
      e => e.status === "approved" && new Date(e.due_date) <= today
    );
    const expensesNotYetDue = expenseOrders.filter(
      e => e.status === "approved" && new Date(e.due_date) > today
    );

    const totalPendingPayments = inventoryOrders.length + expensesDueTodayOrOverdue.length;
    const totalPendingAmount = [...inventoryOrders, ...expensesDueTodayOrOverdue].reduce(
      (sum, item) => sum + parseFloat(item.amount || 0), 0
    );
    const totalPaidAmount = [...paidInventoryOrders, ...paidExpenseOrders].reduce(
      (sum, item) => sum + parseFloat(item.amount || 0), 0
    );

    const unreconciledAmount = reconciliationData
      .filter(item => item.status === 'pending')
      .reduce((sum, item) => sum + Math.abs(item.difference), 0);

    return {
      totalPendingPayments,
      totalPendingAmount,
      totalPaidAmount,
      unreconciledAmount,
      expensesDueTodayOrOverdue,
      expensesNotYetDue
    };
  }, [inventoryOrders, expenseOrders, paidInventoryOrders, paidExpenseOrders, reconciliationData]);

  // Chart data
  const chartData = useMemo(() => {
    if (!cashFlowData) return null;

    return {
      cashFlow: {
        labels: cashFlowData.dates || [],
        datasets: [{
          label: 'Flujo de Caja',
          data: cashFlowData.amounts || [],
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      paymentTypes: {
        labels: ['Inventario', 'Gastos', 'Reconciliados', 'Pendientes'],
        datasets: [{
          data: [
            inventoryOrders.length,
            expenseOrders.length,
            reconciliationData.filter(r => r.status === 'reconciled').length,
            reconciliationData.filter(r => r.status === 'pending').length
          ],
          backgroundColor: ['#10B981', '#EF4444', '#3B82F6', '#F59E0B'],
          borderWidth: 2
        }]
      }
    };
  }, [cashFlowData, inventoryOrders, expenseOrders, reconciliationData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status) => {
    const colors = {
      'reconciled': 'text-primary-500',
      'pending': 'text-yellow-400',
      'discrepancy': 'text-neutral-600',
      'default': 'text-neutral-600'
    };
    return colors[status] || colors.default;
  };

  const getStatusIcon = (status) => {
    const icons = {
      'reconciled': '✅',
      'pending': '⏳',
      'discrepancy': '❌',
      'default': '📋'
    };
    return icons[status] || icons.default;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 text-neutral-800">
        {/* Header */}
        <div className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">🏦 Tesorería - Control Center</h1>
              <p className="text-neutral-600">Centro de control financiero y reconciliación bancaria</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === "dashboard" 
                    ? 'bg-primary-500 text-neutral-800' 
                    : 'bg-gray-700 text-neutral-800 hover:bg-gray-600'
                }`}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => setActiveTab("payments")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === "payments" 
                    ? 'bg-primary-500 text-neutral-800' 
                    : 'bg-gray-700 text-neutral-800 hover:bg-gray-600'
                }`}
              >
                💰 Pagos
              </button>
              <button
                onClick={() => setActiveTab("reconciliation")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === "reconciliation" 
                    ? 'bg-primary-500 text-neutral-800' 
                    : 'bg-gray-700 text-neutral-800 hover:bg-gray-600'
                }`}
              >
                🏛️ Reconciliación
              </button>
              <button
                onClick={() => setActiveTab("cashflow")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === "cashflow" 
                    ? 'bg-primary-500 text-neutral-800' 
                    : 'bg-gray-700 text-neutral-800 hover:bg-gray-600'
                }`}
              >
                📈 Flujo de Caja
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "dashboard" && (
            <div className="max-w-7xl mx-auto">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-200 text-sm">Pagos Pendientes</p>
                      <p className="text-neutral-800 text-xl font-bold">{analytics.totalPendingPayments}</p>
                    </div>
                    <div className="text-red-200 text-2xl">💰</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-200 text-sm">Monto Pendiente</p>
                      <p className="text-neutral-800 text-xl font-bold">{formatCurrency(analytics.totalPendingAmount)}</p>
                    </div>
                    <div className="text-yellow-200 text-2xl">⚠️</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-200 text-sm">Total Pagado</p>
                      <p className="text-neutral-800 text-xl font-bold">{formatCurrency(analytics.totalPaidAmount)}</p>
                    </div>
                    <div className="text-green-200 text-2xl">✅</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-200 text-sm">Sin Reconciliar</p>
                      <p className="text-neutral-800 text-xl font-bold">{formatCurrency(analytics.unreconciledAmount)}</p>
                    </div>
                    <div className="text-blue-200 text-2xl">🏛️</div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              {chartData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white rounded-xl border border-neutral-200 p-6">
                    <h3 className="text-lg font-bold mb-4 text-neutral-800">📊 Tipos de Pago</h3>
                    <div className="h-64">
                      <Doughnut 
                        data={chartData.paymentTypes}
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
                  
                  <div className="bg-white rounded-xl border border-neutral-200 p-6">
                    <h3 className="text-lg font-bold mb-4 text-neutral-800">📈 Flujo de Caja</h3>
                    <div className="h-64">
                      <Line 
                        data={chartData.cashFlow}
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
                            y: {
                              ticks: {
                                color: '#D1D5DB'
                              },
                              grid: {
                                color: '#374151'
                              }
                            },
                            x: {
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

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-lg font-bold mb-4 text-neutral-800">⚡ Acciones Rápidas</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button className="bg-green-600 hover:bg-green-700 text-neutral-800 font-bold py-3 px-4 rounded-lg transition">
                    📤 Subir Estado de Cuenta
                  </button>
                  <button className="bg-blue-600 hover:bg-blue-700 text-neutral-800 font-bold py-3 px-4 rounded-lg transition">
                    🔄 Reconciliación Automática
                  </button>
                  <button className="bg-purple-600 hover:bg-purple-700 text-neutral-800 font-bold py-3 px-4 rounded-lg transition">
                    📊 Generar Reporte
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="max-w-7xl mx-auto">
              {/* Inventory Payments */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
                <h3 className="text-lg font-bold mb-4 text-neutral-800">📦 Pagos de Inventario</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-neutral-800 font-semibold">ID</th>
                        <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Categoría</th>
                        <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Monto</th>
                        <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Notas</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Cotización</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Comprobante</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Método</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {inventoryOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-700 transition-colors">
                          <td className="px-4 py-3 text-neutral-800">{order.id}</td>
                          <td className="px-4 py-3 text-neutral-800">{order.category}</td>
                          <td className="px-4 py-3 text-right text-primary-500">{formatCurrency(order.amount)}</td>
                          <td className="px-4 py-3 text-neutral-800">{order.notes}</td>
                          <td className="px-4 py-3 text-center">
                            {order.quote_path ? (
                              <a
                                href={`${API_BASE_URL}/uploads/${order.quote_path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-500 hover:text-blue-300"
                              >
                                📄 Ver PDF
                              </a>
                            ) : (
                              <span className="text-neutral-600">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="file"
                              className="text-xs"
                              onChange={(e) => setProofFiles({ ...proofFiles, [order.id]: e.target.files[0] })}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <select
                              className="bg-gray-700 border border-neutral-300 rounded px-2 py-1 text-neutral-800 text-sm"
                              onChange={(e) => setPaymentMethods({ ...paymentMethods, [order.id]: e.target.value })}
                            >
                              <option value="efectivo">Efectivo</option>
                              <option value="transferencia">Transferencia</option>
                              <option value="cheque">Cheque</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              className="bg-green-600 hover:bg-green-700 text-neutral-800 font-bold px-3 py-1 rounded text-sm transition"
                              onClick={() => handlePaymentConfirmation("inventory", order.id)}
                            >
                              ✅ Pagar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expense Payments */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-lg font-bold mb-4 text-neutral-800">💸 Pagos de Gastos - Vencidos o Hoy</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-neutral-800 font-semibold">ID</th>
                        <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Tipo</th>
                        <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Monto</th>
                        <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Descripción</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Comprobante</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Método</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {analytics.expensesDueTodayOrOverdue.map((expense) => (
                        <tr key={expense.id} className="hover:bg-gray-700 transition-colors">
                          <td className="px-4 py-3 text-neutral-800">{expense.id}</td>
                          <td className="px-4 py-3 text-neutral-800">{expense.type || "-"}</td>
                          <td className="px-4 py-3 text-right text-neutral-600">{formatCurrency(expense.amount || 0)}</td>
                          <td className="px-4 py-3 text-neutral-800">{expense.description || "-"}</td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="file"
                              className="text-xs"
                              onChange={(e) => setProofFiles({ ...proofFiles, [expense.id]: e.target.files[0] })}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <select
                              className="bg-gray-700 border border-neutral-300 rounded px-2 py-1 text-neutral-800 text-sm"
                              onChange={(e) => setPaymentMethods({ ...paymentMethods, [expense.id]: e.target.value })}
                            >
                              <option value="efectivo">Efectivo</option>
                              <option value="transferencia">Transferencia</option>
                              <option value="cheque">Cheque</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              className="bg-yellow-600 hover:bg-yellow-700 text-neutral-800 font-bold px-3 py-1 rounded text-sm transition"
                              onClick={() => handlePaymentConfirmation("expense", expense.id)}
                            >
                              ✅ Pagar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reconciliation" && (
            <div className="max-w-7xl mx-auto">
              {/* Bank Statements */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-neutral-800">🏛️ Estados de Cuenta Bancarios</h3>
                  <button className="bg-blue-600 hover:bg-blue-700 text-neutral-800 font-bold px-4 py-2 rounded-lg transition">
                    📤 Subir Estado
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Fecha</th>
                        <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Descripción</th>
                        <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Monto</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Tipo</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Estado</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {bankStatements.map((statement) => (
                        <tr key={statement.id} className="hover:bg-gray-700 transition-colors">
                          <td className="px-4 py-3 text-neutral-800">{statement.date}</td>
                          <td className="px-4 py-3 text-neutral-800">{statement.description}</td>
                          <td className={`px-4 py-3 text-right font-bold ${
                            statement.type === 'credit' ? 'text-primary-500' : 'text-neutral-600'
                          }`}>
                            {statement.type === 'credit' ? '+' : '-'}{formatCurrency(statement.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              statement.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {statement.type === 'credit' ? '💰 Crédito' : '💸 Débito'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              statement.reconciled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {statement.reconciled ? '✅ Reconciliado' : '⏳ Pendiente'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              className="bg-blue-600 hover:bg-blue-700 text-neutral-800 font-bold px-3 py-1 rounded text-sm transition"
                              onClick={() => {
                                setSelectedReconciliation(statement);
                                setShowReconciliationModal(true);
                              }}
                            >
                              🔍 Reconciliar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reconciliation Summary */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-lg font-bold mb-4 text-neutral-800">📊 Resumen de Reconciliación</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Fecha</th>
                        <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Banco</th>
                        <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Sistema</th>
                        <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Diferencia</th>
                        <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {reconciliationData.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-700 transition-colors">
                          <td className="px-4 py-3 text-neutral-800">{item.date}</td>
                          <td className="px-4 py-3 text-right text-neutral-800">{formatCurrency(item.bankAmount)}</td>
                          <td className="px-4 py-3 text-right text-neutral-800">{formatCurrency(item.systemAmount)}</td>
                          <td className={`px-4 py-3 text-right font-bold ${
                            item.difference === 0 ? 'text-primary-500' : 'text-neutral-600'
                          }`}>
                            {formatCurrency(item.difference)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                              {getStatusIcon(item.status)} {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "cashflow" && (
            <div className="max-w-7xl mx-auto">
              {/* Period Selector */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-neutral-800">📈 Flujo de Caja</h3>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-500"
                  >
                    <option value="week">Esta Semana</option>
                    <option value="month">Este Mes</option>
                    <option value="quarter">Este Trimestre</option>
                    <option value="year">Este Año</option>
                  </select>
                </div>
              </div>

              {/* Cash Flow Chart */}
              {chartData && (
                <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
                  <h3 className="text-lg font-bold mb-4 text-neutral-800">📊 Análisis de Flujo de Caja</h3>
                  <div className="h-96">
                    <Line 
                      data={chartData.cashFlow}
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
                          y: {
                            ticks: {
                              color: '#D1D5DB'
                            },
                            grid: {
                              color: '#374151'
                            }
                          },
                          x: {
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
              )}

              {/* Payment History */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-neutral-200 p-6">
                  <h3 className="text-lg font-bold mb-4 text-neutral-800">📦 Historial de Pagos de Inventario</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-neutral-800 font-semibold">ID</th>
                          <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Categoría</th>
                          <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Monto</th>
                          <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Fecha</th>
                          <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Método</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {paidInventoryOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-700 transition-colors">
                            <td className="px-4 py-3 text-neutral-800">{order.id}</td>
                            <td className="px-4 py-3 text-neutral-800">{order.category}</td>
                            <td className="px-4 py-3 text-right text-primary-500">{formatCurrency(order.amount)}</td>
                            <td className="px-4 py-3 text-center text-neutral-800">{new Date(order.updated_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-center text-neutral-800">{order.method || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 p-6">
                  <h3 className="text-lg font-bold mb-4 text-neutral-800">💸 Historial de Pagos de Gastos</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-neutral-800 font-semibold">ID</th>
                          <th className="px-4 py-3 text-left text-neutral-800 font-semibold">Tipo</th>
                          <th className="px-4 py-3 text-right text-neutral-800 font-semibold">Monto</th>
                          <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Fecha</th>
                          <th className="px-4 py-3 text-center text-neutral-800 font-semibold">Método</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {paidExpenseOrders.map((expense) => (
                          <tr key={expense.id} className="hover:bg-gray-700 transition-colors">
                            <td className="px-4 py-3 text-neutral-800">{expense.id}</td>
                            <td className="px-4 py-3 text-neutral-800">{expense.type || "-"}</td>
                            <td className="px-4 py-3 text-right text-neutral-600">{formatCurrency(expense.amount || 0)}</td>
                            <td className="px-4 py-3 text-center text-neutral-800">{new Date(expense.updated_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-center text-neutral-800">{expense.method || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reconciliation Modal */}
        {showReconciliationModal && selectedReconciliation && (
          <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl border border-neutral-200 p-6 max-w-2xl w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-neutral-800">🔍 Reconciliación Bancaria</h3>
                <button
                  onClick={() => setShowReconciliationModal(false)}
                  className="text-neutral-600 hover:text-neutral-800"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-600">Fecha Bancaria</label>
                    <p className="text-neutral-800">{selectedReconciliation.date}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600">Descripción</label>
                    <p className="text-neutral-800">{selectedReconciliation.description}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600">Monto Bancario</label>
                    <p className={`text-neutral-800 font-bold ${
                      selectedReconciliation.type === 'credit' ? 'text-primary-500' : 'text-neutral-600'
                    }`}>
                      {selectedReconciliation.type === 'credit' ? '+' : '-'}{formatCurrency(selectedReconciliation.amount)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600">Tipo</label>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      selectedReconciliation.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedReconciliation.type === 'credit' ? '💰 Crédito' : '💸 Débito'}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-2">Asociar con Transacción del Sistema</label>
                  <select className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-500">
                    <option value="">Seleccionar transacción...</option>
                    <option value="payment1">Pago de Inventario #1</option>
                    <option value="payment2">Pago de Gasto #3</option>
                    <option value="payment3">Pago de Gasto #5</option>
                  </select>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowReconciliationModal(false)}
                    className="px-4 py-2 bg-gray-600 text-neutral-800 rounded-lg hover:bg-gray-700 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      alert('Reconciliación completada');
                      setShowReconciliationModal(false);
                    }}
                    className="px-4 py-2 bg-green-600 text-neutral-800 rounded-lg hover:bg-green-700 transition"
                  >
                    ✅ Reconciliar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Tesoreria;