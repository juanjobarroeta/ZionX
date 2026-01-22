import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

const AccountingHub = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [manualEntries, setManualEntries] = useState([]);
  const [selectedDateRange, setSelectedDateRange] = useState({
    start: "2000-01-01",
    end: new Date().toISOString().split("T")[0],
  });
  const [newEntry, setNewEntry] = useState({
    type: "",
    amount: "",
    description: "",
    origin: "",
    branch: "Ninguna",
  });
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [reclassifyData, setReclassifyData] = useState({
    newDate: "",
    breakdowns: [],
    note: "",
  });

  const token = localStorage.getItem("token");

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === "ledger") {
      loadAccountBalances();
    } else if (activeTab === "payments") {
      loadPayments();
    } else if (activeTab === "manual") {
      loadManualEntries();
    }
  }, [activeTab, selectedDateRange]);

  const loadAccountBalances = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/account-balances?from=${selectedDateRange.start}&to=${selectedDateRange.end}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAccounts(res.data);
    } catch (err) {
      console.error("Error loading account balances:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPayments(res.data);
    } catch (err) {
      console.error("Error loading payments:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadManualEntries = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounting/manual-entries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setManualEntries(res.data);
    } catch (err) {
      console.error("Error loading manual entries:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntrySubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_BASE_URL}/accounting/manual-entry`,
        newEntry,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewEntry({
        type: "",
        amount: "",
        description: "",
        origin: "",
        branch: "Ninguna",
      });
      loadManualEntries();
      alert("Entrada manual registrada correctamente");
    } catch (err) {
      console.error("Error creating manual entry:", err);
      alert("Error al registrar entrada manual");
    }
  };

  const handleReclassifyPayment = async () => {
    if (!selectedPayment) return;
    try {
      await axios.post(
        `${API_BASE_URL}/admin/payments/${selectedPayment.id}/reclassify`,
        reclassifyData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedPayment(null);
      setReclassifyData({ newDate: "", breakdowns: [], note: "" });
      loadPayments();
      alert("Pago reclasificado correctamente");
    } catch (err) {
      console.error("Error reclassifying payment:", err);
      alert("Error al reclasificar pago");
    }
  };

  const fetchBreakdown = async (paymentId) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/admin/payments/${paymentId}/breakdown`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReclassifyData(prev => ({ ...prev, breakdowns: res.data }));
    } catch (err) {
      console.error("Error loading breakdown:", err);
    }
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalAssets = accounts
      .filter(acc => acc.type === "asset")
      .reduce((sum, acc) => sum + Math.abs(parseFloat(acc.balance) || 0), 0);
    
    const totalLiabilities = accounts
      .filter(acc => acc.type === "liability")
      .reduce((sum, acc) => sum + Math.abs(parseFloat(acc.balance) || 0), 0);
    
    const totalEquity = accounts
      .filter(acc => acc.type === "equity")
      .reduce((sum, acc) => sum + Math.abs(parseFloat(acc.balance) || 0), 0);

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      balance: totalAssets - totalLiabilities - totalEquity,
      activeAccounts: accounts.filter(acc => Math.abs(parseFloat(acc.balance) || 0) > 0).length,
      totalPayments: payments.length,
      totalManualEntries: manualEntries.length,
    };
  }, [accounts, payments, manualEntries]);

  // Chart data for overview
  const chartData = useMemo(() => {
    const assetAccounts = accounts.filter(acc => acc.type === "asset" && Math.abs(parseFloat(acc.balance) || 0) > 0);
    const liabilityAccounts = accounts.filter(acc => acc.type === "liability" && Math.abs(parseFloat(acc.balance) || 0) > 0);
    const equityAccounts = accounts.filter(acc => acc.type === "equity" && Math.abs(parseFloat(acc.balance) || 0) > 0);

    return {
      composition: {
        labels: ["Activos", "Pasivos", "Capital"],
        datasets: [{
          data: [summaryStats.totalAssets, summaryStats.totalLiabilities, summaryStats.totalEquity],
          backgroundColor: ["#10b981", "#ef4444", "#3b82f6"],
          borderWidth: 2,
          borderColor: "#1f2937",
        }],
      },
      topAssets: {
        labels: assetAccounts.slice(0, 5).map(acc => acc.name),
        datasets: [{
          label: "Saldo",
          data: assetAccounts.slice(0, 5).map(acc => Math.abs(parseFloat(acc.balance) || 0)),
          backgroundColor: "#10b981",
          borderColor: "#059669",
          borderWidth: 1,
        }],
      },
      paymentTrends: {
        labels: payments.slice(-7).map(p => new Date(p.payment_date).toLocaleDateString()),
        datasets: [{
          label: "Monto de Pagos",
          data: payments.slice(-7).map(p => parseFloat(p.amount)),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
        }],
      },
    };
  }, [accounts, payments, summaryStats]);

  const tabs = [
    { id: "overview", label: "📊 Resumen", icon: "📊" },
    { id: "ledger", label: "📋 Libro Mayor", icon: "📋" },
    { id: "manual", label: "✏️ Entradas Manuales", icon: "✏️" },
    { id: "payments", label: "💰 Reclasificar Pagos", icon: "💰" },
    { id: "reports", label: "📈 Reportes", icon: "📈" },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-800 mb-2">
            🏦 Centro de Contabilidad
          </h1>
          <p className="text-neutral-600">
            Gestión integral de contabilidad, movimientos y reportes financieros
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="bg-white border border-primary-500 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-primary-600 font-medium">Desde:</label>
              <input
                type="date"
                value={selectedDateRange.start}
                onChange={(e) => setSelectedDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-white border border-primary-500 rounded px-3 py-2 text-neutral-800"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-primary-600 font-medium">Hasta:</label>
              <input
                type="date"
                value={selectedDateRange.end}
                onChange={(e) => setSelectedDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-white border border-primary-500 rounded px-3 py-2 text-neutral-800"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedDateRange({
                  start: "2000-01-01",
                  end: new Date().toISOString().split("T")[0],
                })}
                className="bg-blue-600 hover:bg-blue-700 text-neutral-800 px-4 py-2 rounded"
              >
                YTD
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                  setSelectedDateRange({
                    start: startOfMonth.toISOString().split("T")[0],
                    end: now.toISOString().split("T")[0],
                  });
                }}
                className="bg-orange-600 hover:bg-orange-700 text-neutral-800 px-4 py-2 rounded"
              >
                Este Mes
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-4">
            <div className="text-neutral-800 text-sm font-medium">Total Activos</div>
            <div className="text-neutral-800 text-2xl font-bold">
              ${summaryStats.totalAssets.toLocaleString()}
            </div>
          </div>
          <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-lg p-4">
            <div className="text-neutral-800 text-sm font-medium">Total Pasivos</div>
            <div className="text-neutral-800 text-2xl font-bold">
              ${summaryStats.totalLiabilities.toLocaleString()}
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4">
            <div className="text-neutral-800 text-sm font-medium">Total Capital</div>
            <div className="text-neutral-800 text-2xl font-bold">
              ${summaryStats.totalEquity.toLocaleString()}
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4">
            <div className="text-neutral-800 text-sm font-medium">Diferencia</div>
            <div className={`text-neutral-800 text-2xl font-bold ${summaryStats.balance === 0 ? 'text-primary-500' : 'text-neutral-600'}`}>
              ${summaryStats.balance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-primary-500 rounded-lg">
          <div className="flex border-b border-primary-500">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-primary-600 border-b-2 border-lime-400 bg-gradient-to-br from-surface-50 to-surface-100"
                    : "text-neutral-600 hover:text-neutral-800 hover:bg-white"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {loading && (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div>
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === "overview" && !loading && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-4">
                    <h3 className="text-primary-600 font-semibold mb-4">Composición del Balance</h3>
                    <div className="h-64">
                      <Doughnut
                        data={chartData.composition}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: "bottom",
                              labels: { color: "white" },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-4">
                    <h3 className="text-primary-600 font-semibold mb-4">Principales Activos</h3>
                    <div className="h-64">
                      <Bar
                        data={chartData.topAssets}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: { color: "white" },
                              grid: { color: "rgba(255,255,255,0.1)" },
                            },
                            x: {
                              ticks: { color: "white" },
                              grid: { color: "rgba(255,255,255,0.1)" },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-4">
                  <h3 className="text-primary-600 font-semibold mb-4">Tendencias de Pagos</h3>
                  <div className="h-64">
                    <Line
                      data={chartData.paymentTrends}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            labels: { color: "white" },
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: { color: "white" },
                            grid: { color: "rgba(255,255,255,0.1)" },
                          },
                          x: {
                            ticks: { color: "white" },
                            grid: { color: "rgba(255,255,255,0.1)" },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ledger Tab */}
            {activeTab === "ledger" && !loading && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-primary-600 font-semibold">Libro Mayor</h3>
                  <div className="text-sm text-neutral-600">
                    {accounts.length} cuentas activas
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-neutral-800 border border-primary-500">
                    <thead>
                      <tr className="bg-gradient-to-br from-surface-50 to-surface-100 text-primary-600">
                        <th className="p-3 text-left">Cuenta</th>
                        <th className="p-3 text-left">Tipo</th>
                        <th className="p-3 text-right">Cargos</th>
                        <th className="p-3 text-right">Abonos</th>
                        <th className="p-3 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account, index) => (
                        <tr key={index} className="border-t border-primary-500 hover:bg-white">
                          <td className="p-3">{account.name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              account.type === 'asset' ? 'bg-green-600' :
                              account.type === 'liability' ? 'bg-red-600' :
                              'bg-blue-600'
                            }`}>
                              {account.type}
                            </span>
                          </td>
                          <td className="p-3 text-right">${parseFloat(account.debit || 0).toLocaleString()}</td>
                          <td className="p-3 text-right">${parseFloat(account.credit || 0).toLocaleString()}</td>
                          <td className={`p-3 text-right font-medium ${
                            parseFloat(account.balance || 0) < 0 ? 'text-neutral-600' : 'text-primary-500'
                          }`}>
                            ${parseFloat(account.balance || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Manual Entries Tab */}
            {activeTab === "manual" && !loading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-primary-600 font-semibold">Nueva Entrada Manual</h3>
                  <form onSubmit={handleManualEntrySubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Tipo de Movimiento
                      </label>
                      <select
                        value={newEntry.type}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full bg-white border border-primary-500 rounded px-3 py-2 text-neutral-800"
                        required
                      >
                        <option value="">Selecciona una opción</option>
                        <option value="cash">Efectivo</option>
                        <option value="bank">Banco</option>
                        <option value="inventory">Inventario</option>
                        <option value="accounts_receivable">Cuentas por Cobrar</option>
                        <option value="accounts_payable">Cuentas por Pagar</option>
                        <option value="capital">Capital</option>
                        <option value="retained_earnings">Utilidades Retenidas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Monto
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newEntry.amount}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full bg-white border border-primary-500 rounded px-3 py-2 text-neutral-800"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Descripción
                      </label>
                      <textarea
                        value={newEntry.description}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full bg-white border border-primary-500 rounded px-3 py-2 text-neutral-800"
                        rows="3"
                        placeholder="Descripción del movimiento..."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Origen del Movimiento
                      </label>
                      <select
                        value={newEntry.origin}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, origin: e.target.value }))}
                        className="w-full bg-white border border-primary-500 rounded px-3 py-2 text-neutral-800"
                        required
                      >
                        <option value="">Selecciona una opción</option>
                        <option value="loan">Préstamo</option>
                        <option value="payment">Pago</option>
                        <option value="inventory">Inventario</option>
                        <option value="expense">Gasto</option>
                        <option value="investment">Inversión</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Sucursal (opcional)
                      </label>
                      <select
                        value={newEntry.branch}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, branch: e.target.value }))}
                        className="w-full bg-white border border-primary-500 rounded px-3 py-2 text-neutral-800"
                      >
                        <option value="Ninguna">Ninguna</option>
                        <option value="Sucursal A">Sucursal A</option>
                        <option value="Sucursal B">Sucursal B</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-lime-600 hover:bg-lime-700 text-neutral-800 font-medium py-2 px-4 rounded transition-colors"
                    >
                      Registrar Entrada
                    </button>
                  </form>
                </div>
                <div className="space-y-4">
                  <h3 className="text-primary-600 font-semibold">Entradas Recientes</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {manualEntries.map((entry, index) => (
                      <div key={index} className="bg-white border border-neutral-200 rounded p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-neutral-800">{entry.description}</div>
                            <div className="text-sm text-neutral-600">{entry.type}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-neutral-800">${parseFloat(entry.amount).toLocaleString()}</div>
                            <div className="text-xs text-neutral-600">
                              {new Date(entry.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === "payments" && !loading && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-primary-600 font-semibold mb-4">Pagos Recientes</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {payments.map((payment) => (
                        <div
                          key={payment.id}
                          className={`bg-white border border-neutral-200 rounded p-3 cursor-pointer transition-colors ${
                            selectedPayment?.id === payment.id ? 'border-lime-400 bg-gray-700' : 'hover:bg-gray-700'
                          }`}
                          onClick={() => {
                            setSelectedPayment(payment);
                            setReclassifyData(prev => ({
                              ...prev,
                              newDate: payment.payment_date?.slice(0, 10) || "",
                            }));
                            fetchBreakdown(payment.id);
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium text-neutral-800">
                                {payment.customer_name || "N/A"}
                              </div>
                              <div className="text-sm text-neutral-600">
                                {new Date(payment.payment_date).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-neutral-800">
                                ${parseFloat(payment.amount).toLocaleString()}
                              </div>
                              <div className="text-xs text-neutral-600">ID: {payment.id}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selectedPayment && (
                    <div>
                      <h3 className="text-primary-600 font-semibold mb-4">Reclasificar Pago</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Nueva Fecha
                          </label>
                          <input
                            type="date"
                            value={reclassifyData.newDate}
                            onChange={(e) => setReclassifyData(prev => ({ ...prev, newDate: e.target.value }))}
                            className="w-full bg-white border border-primary-500 rounded px-3 py-2 text-neutral-800"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Nota
                          </label>
                          <textarea
                            value={reclassifyData.note}
                            onChange={(e) => setReclassifyData(prev => ({ ...prev, note: e.target.value }))}
                            className="w-full bg-white border border-primary-500 rounded px-3 py-2 text-neutral-800"
                            rows="3"
                            placeholder="Motivo de la reclasificación..."
                          />
                        </div>
                        <button
                          onClick={handleReclassifyPayment}
                          className="w-full bg-yellow-600 hover:bg-yellow-700 text-neutral-800 font-medium py-2 px-4 rounded transition-colors"
                        >
                          Reclasificar Pago
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === "reports" && !loading && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-4">
                    <h3 className="text-primary-600 font-semibold mb-4">Reportes Disponibles</h3>
                    <div className="space-y-3">
                      <Link
                        to="/balance-sheet"
                        className="block bg-blue-600 hover:bg-blue-700 text-neutral-800 p-3 rounded transition-colors"
                      >
                        📊 Balance General
                      </Link>
                      <Link
                        to="/income-statement"
                        className="block bg-green-600 hover:bg-green-700 text-neutral-800 p-3 rounded transition-colors"
                      >
                        📈 Estado de Resultados
                      </Link>
                      <Link
                        to="/admin/account-balances"
                        className="block bg-purple-600 hover:bg-purple-700 text-neutral-800 p-3 rounded transition-colors"
                      >
                        📋 Movimientos por Cuenta
                      </Link>
                      <Link
                        to="/admin/tesoreria"
                        className="block bg-orange-600 hover:bg-orange-700 text-neutral-800 p-3 rounded transition-colors"
                      >
                        💰 Tesorería
                      </Link>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-4">
                    <h3 className="text-primary-600 font-semibold mb-4">Exportar Datos</h3>
                    <div className="space-y-3">
                      <button className="w-full bg-red-600 hover:bg-red-700 text-neutral-800 p-3 rounded transition-colors">
                        📄 Exportar PDF
                      </button>
                      <button className="w-full bg-green-600 hover:bg-green-700 text-neutral-800 p-3 rounded transition-colors">
                        📊 Exportar Excel
                      </button>
                      <button className="w-full bg-blue-600 hover:bg-blue-700 text-neutral-800 p-3 rounded transition-colors">
                        📁 Exportar CSV
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AccountingHub; 