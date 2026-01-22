import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import { Line, Bar, Doughnut } from "react-chartjs-2";
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
} from "chart.js";

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

const Dashboard = () => {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState({});
  const [paymentAmount, setPaymentAmount] = useState({});
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("week");
  const [metrics, setMetrics] = useState({
    customers: 0,
    loansIssued: 0,
    capitalLoaned: 0,
    interestToCollect: 0,
    overdueAmount: 0,
    customersOverdue: 0,
  });
  const [overdueTrends, setOverdueTrends] = useState([]);
  const [cashflowPeriod, setCashflowPeriod] = useState("week");
  const [recentActivity, setRecentActivity] = useState([]);
  const [quickActions, setQuickActions] = useState([]);
  const token = localStorage.getItem("token");

  const fetchLoans = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/dashboard/loans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLoans(res.data);
    } catch (err) {
      console.error("Error fetching loans:", err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(res.data);
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
  };

  const fetchPayments = async (loanId) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/dashboard/payments/${loanId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPayments((prev) => ({ ...prev, [loanId]: res.data }));
    } catch (err) {
      console.error("Error fetching payments:", err);
    }
  };

  const handlePaymentChange = (loanId, value) => {
    setPaymentAmount((prev) => ({ ...prev, [loanId]: value }));
  };

  const submitPayment = async (loanId) => {
    try {
      await axios.post(
        `${API_BASE_URL}/make-payment`,
        { loan_id: loanId, amount: paymentAmount[loanId] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPayments(loanId);
      alert("Pago registrado con éxito");
    } catch (error) {
      console.error("Error processing payment:", error);
      alert("Error al procesar el pago");
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, trendsRes, activityRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/dashboard-metrics`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/dashboard/overdue-trends`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/dashboard/recent-activity`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const mapped = {
        customers: metricsRes.data.customers,
        loansIssued: metricsRes.data.loansIssued,
        capitalLoaned: metricsRes.data.capitalLoaned,
        interestToCollect: metricsRes.data.interestToCollect,
        overdueAmount: metricsRes.data.overdueAmount,
        customersOverdue: metricsRes.data.customersOverdue,
        overdueCustomersTable: metricsRes.data.overdueCustomersTable || [],
        totalCollectedToday: metricsRes.data.totalCollectedToday,
        totalDisbursedToday: metricsRes.data.totalDisbursedToday,
        netCashFlowToday: metricsRes.data.netCashFlowToday,
        storeComparison: metricsRes.data.storeComparison || [],
      };
      setMetrics(mapped);
      setOverdueTrends(Array.isArray(trendsRes.data) ? trendsRes.data : []);
      setRecentActivity(activityRes.data || []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      // Ensure arrays are set to empty arrays even on error
      setOverdueTrends([]);
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCashflow = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/dashboard/cashflow?period=${cashflowPeriod}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMetrics(prev => ({
        ...prev,
        totalCollected: res.data.total_collected,
        totalDisbursed: res.data.total_disbursed,
        netCashFlow: res.data.net_cashflow,
        cashflowPeriod: res.data.period
      }));
    } catch (err) {
      console.error("Error fetching cashflow:", err);
    }
  };

  // Memoized chart data
  const chartData = useMemo(() => ({
    overdueTrends: {
      labels: (overdueTrends || []).map(row => new Date(row.week_start).toLocaleDateString()),
      datasets: [
        {
          label: "Monto Vencido",
          data: (overdueTrends || []).map(row => parseFloat(row.total_due)),
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    storePerformance: {
      labels: metrics.storeComparison?.map(store => store.store) || [],
      datasets: [
        {
          label: "Préstamos Activos",
          data: metrics.storeComparison?.map(store => store.active_loans) || [],
          backgroundColor: "rgba(59, 130, 246, 0.8)",
        },
        {
          label: "Préstamos Vencidos",
          data: metrics.storeComparison?.map(store => store.overdue_loans) || [],
          backgroundColor: "rgba(239, 68, 68, 0.8)",
        },
      ],
    },
    loanDistribution: {
      labels: ["Capital Prestado", "Intereses por Cobrar", "Monto Vencido"],
      datasets: [
        {
          data: [
            metrics.capitalLoaned || 0,
            metrics.interestToCollect || 0,
            metrics.overdueAmount || 0,
          ],
          backgroundColor: [
            "rgba(34, 197, 94, 0.8)",
            "rgba(59, 130, 246, 0.8)",
            "rgba(239, 68, 68, 0.8)",
          ],
          borderWidth: 2,
          borderColor: "#1f2937",
        },
      ],
    },
  }), [overdueTrends, metrics]);

  useEffect(() => {
    fetchLoans();
    fetchCustomers();
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchCashflow();
  }, [cashflowPeriod]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const quickActionItems = [
    { label: "Proyectos", icon: "🎯", href: "/projects", color: "from-zionx-accent to-zionx-primary", textColor: "text-white" },
    { label: "Nuevo Proyecto", icon: "➕", href: "/projects/new", color: "from-zionx-tertiary to-zionx-secondary", textColor: "text-zionx-primary" },
    { label: "Nuevo Cliente", icon: "👤", href: "/create-customer", color: "from-zionx-primary to-zionx-accent", textColor: "text-white" },
    { label: "Gestión de Equipo", icon: "👥", href: "/team-management", color: "from-zionx-secondary to-zionx-tertiary", textColor: "text-zionx-primary" },
    { label: "Analíticas", icon: "📈", href: "/project-analytics", color: "from-zionx-accent to-zionx-primary", textColor: "text-white" },
    { label: "Reportes", icon: "📊", href: "/reports", color: "from-zionx-tertiary to-zionx-secondary", textColor: "text-zionx-primary" },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-neutral-600">Cargando dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
            <h1 className="text-3xl font-bold text-zionx-primary mb-2 font-display">📈 ZIONX Marketing Dashboard</h1>
            <p className="text-zionx-accent">Campaign performance and lead analytics</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-white text-neutral-800 border border-neutral-300 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none"
              >
                <option value="day">Hoy</option>
                <option value="week">Esta Semana</option>
                <option value="month">Este Mes</option>
                <option value="quarter">Este Trimestre</option>
                <option value="year">Este Año</option>
              </select>
              <button
                onClick={fetchDashboardData}
                className="bg-gradient-to-r from-zionx-accent to-zionx-primary hover:from-zionx-primary hover:to-zionx-accent text-white font-bold px-6 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                🔄 Actualizar
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {quickActionItems.map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className={`bg-gradient-to-r ${action.color} p-4 rounded-xl ${action.textColor} text-center transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl border border-zionx-accent/20`}
              >
                <div className="text-2xl mb-2">{action.icon}</div>
                <div className="text-sm font-semibold">{action.label}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-zionx-tertiary p-1 rounded-lg border border-zionx-secondary">
          {[
            { id: "overview", label: "📈 Resumen", icon: "📊" },
            { id: "analytics", label: "📊 Análisis", icon: "📈" },
            { id: "performance", label: "🏆 Rendimiento", icon: "🎯" },
            { id: "activity", label: "⚡ Actividad", icon: "🔄" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-zionx-accent text-white shadow-lg"
                  : "text-zionx-accent hover:text-zionx-primary hover:bg-zionx-secondary"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  label: "Clientes Registrados",
                  value: metrics.customers?.toLocaleString() || "0",
                  icon: "👥",
                  color: "from-zionx-accent to-zionx-primary",
                  textColor: "text-white",
                  change: "+12%",
                  changeType: "positive",
                },
                {
                  label: "Préstamos Activos",
                  value: metrics.loansIssued?.toLocaleString() || "0",
                  icon: "💳",
                  color: "from-zionx-tertiary to-zionx-secondary",
                  textColor: "text-zionx-primary",
                  change: "+8%",
                  changeType: "positive",
                },
                {
                  label: "Capital Prestado",
                  value: `$${(metrics.capitalLoaned || 0).toLocaleString()}`,
                  icon: "💰",
                  color: "from-zionx-primary to-zionx-accent",
                  textColor: "text-white",
                  change: "+15%",
                  changeType: "positive",
                },
                {
                  label: "Monto Vencido",
                  value: `$${(metrics.overdueAmount || 0).toLocaleString()}`,
                  icon: "⚠️",
                  color: "from-zionx-secondary to-zionx-tertiary",
                  textColor: "text-zionx-primary",
                  change: "-5%",
                  changeType: "negative",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className={`bg-gradient-to-r ${metric.color} p-6 rounded-xl ${metric.textColor} shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border border-zionx-accent/20`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl">{metric.icon}</div>
                    <div className={`text-sm px-2 py-1 rounded-full ${
                      metric.changeType === "positive" 
                        ? "bg-zionx-highlight/20 text-zionx-highlight" 
                        : "bg-zionx-accent/20 text-zionx-accent"
                    }`}>
                      {metric.change}
                    </div>
                  </div>
                  <div className="text-2xl font-bold mb-1">{metric.value}</div>
                  <div className="text-sm opacity-90">{metric.label}</div>
                </div>
              ))}
            </div>

            {/* Cash Flow Summary */}
            <div className="bg-gradient-to-br from-zionx-tertiary to-zionx-secondary rounded-xl p-6 border border-zionx-accent">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-zionx-primary">💸 Flujo de Caja</h3>
                <select
                  value={cashflowPeriod}
                  onChange={(e) => setCashflowPeriod(e.target.value)}
                  className="bg-zionx-tertiary text-zionx-primary border border-zionx-secondary rounded-lg px-3 py-1 focus:border-zionx-highlight focus:outline-none"
                >
                  <option value="day">Hoy</option>
                  <option value="week">Esta Semana</option>
                  <option value="month">Este Mes</option>
                  <option value="ytd">Año en Curso</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    label: "Total Cobrado",
                    value: `$${(metrics.totalCollected || 0).toLocaleString()}`,
                    icon: "📈",
                    color: "text-primary-500",
                  },
                  {
                    label: "Total Prestado",
                    value: `$${(metrics.totalDisbursed || 0).toLocaleString()}`,
                    icon: "📉",
                    color: "text-primary-500",
                  },
                  {
                    label: "Flujo Neto",
                    value: `$${Math.abs(metrics.netCashFlow || 0).toLocaleString()}`,
                    icon: metrics.netCashFlow >= 0 ? "✅" : "❌",
                    color: metrics.netCashFlow >= 0 ? "text-primary-500" : "text-neutral-600",
                  },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <div className={`text-2xl font-bold mb-1 ${item.color}`}>
                      {item.value}
                    </div>
                    <div className="text-sm text-neutral-600">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Overdue Trends Chart */}
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
                <h3 className="text-lg font-bold text-neutral-800 mb-4">📈 Tendencia de Pagos Vencidos</h3>
                {overdueTrends.length > 0 ? (
                  <Line
                    data={chartData.overdueTrends}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          labels: { color: "white" },
                        },
                      },
                      scales: {
                        y: {
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
                ) : (
                  <div className="text-center text-neutral-600 py-8">
                    <div className="text-4xl mb-4">📊</div>
                    <p>No hay datos de tendencias disponibles</p>
                  </div>
                )}
              </div>

              {/* Loan Distribution Chart */}
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
                <h3 className="text-lg font-bold text-neutral-800 mb-4">🥧 Distribución de Préstamos</h3>
                <Doughnut
                  data={chartData.loanDistribution}
                  options={{
                    responsive: true,
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
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-8">
            {/* Store Performance */}
            {metrics.storeComparison && metrics.storeComparison.length > 0 && (
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
                <h3 className="text-lg font-bold text-neutral-800 mb-6">🏪 Rendimiento por Sucursal</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <Bar
                      data={chartData.storePerformance}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            labels: { color: "white" },
                          },
                        },
                        scales: {
                          y: {
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
                  <div className="space-y-4">
                    {metrics.storeComparison.map((store) => (
                      <div key={store.store} className="bg-white rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-neutral-800">{store.store}</h4>
                          <span className="text-sm text-neutral-600">
                            {parseFloat(store.collection_rate).toFixed(1)}% cobranza
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-neutral-600">Préstamos Activos</div>
                            <div className="text-neutral-800 font-semibold">{store.active_loans}</div>
                          </div>
                          <div>
                            <div className="text-neutral-600">Capital Prestado</div>
                            <div className="text-neutral-800 font-semibold">
                              ${parseFloat(store.capital_lent).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Overdue Customers Table */}
            {metrics.overdueCustomersTable && metrics.overdueCustomersTable.length > 0 && (
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
                <h3 className="text-lg font-bold text-neutral-800 mb-6">⚠️ Clientes con Pagos Vencidos</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Cliente</th>
                        <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Teléfono</th>
                        <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Pagos Vencidos</th>
                        <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Monto Vencido</th>
                        <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.overdueCustomersTable.slice(0, 10).map((customer) => (
                        <tr key={customer.customer_id} className="border-b border-gray-800 hover:bg-white">
                          <td className="py-3 px-4 text-neutral-800">
                            {customer.first_name} {customer.last_name}
                          </td>
                          <td className="py-3 px-4 text-neutral-700">{customer.phone}</td>
                          <td className="py-3 px-4">
                            <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded-full text-xs">
                              {customer.overdue_installments}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-neutral-600 font-semibold">
                            ${parseFloat(customer.total_overdue).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              to={`/register-payment?customer=${customer.customer_id}`}
                              className="text-primary-500 hover:text-emerald-400 text-sm"
                            >
                              💰 Registrar Pago
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {metrics.overdueCustomersTable.length > 10 && (
                  <div className="mt-4 text-center">
                    <Link
                      to="/overdue-loans"
                      className="text-primary-500 hover:text-emerald-400 text-sm"
                    >
                      Ver todos los clientes vencidos →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === "performance" && (
          <div className="space-y-8">
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  label: "Tasa de Cobranza",
                  value: "94.2%",
                  icon: "📊",
                  color: "from-green-500 to-emerald-600",
                  trend: "+2.1%",
                },
                {
                  label: "Tiempo Promedio de Cobro",
                  value: "3.2 días",
                  icon: "⏱️",
                  color: "from-blue-500 to-cyan-600",
                  trend: "-0.5 días",
                },
                {
                  label: "Satisfacción del Cliente",
                  value: "4.8/5",
                  icon: "⭐",
                  color: "from-yellow-500 to-orange-600",
                  trend: "+0.2",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className={`bg-gradient-to-r ${metric.color} p-6 rounded-xl text-neutral-800 shadow-lg`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl">{metric.icon}</div>
                    <div className="text-sm bg-white/20 px-2 py-1 rounded-full">
                      {metric.trend}
                    </div>
                  </div>
                  <div className="text-2xl font-bold mb-1">{metric.value}</div>
                  <div className="text-sm opacity-90">{metric.label}</div>
                </div>
              ))}
            </div>

            {/* Performance Insights */}
            <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-800 mb-6">💡 Insights de Rendimiento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="text-2xl mr-4">✅</div>
                    <div>
                      <div className="font-semibold text-neutral-800">Cobranza Mejorada</div>
                      <div className="text-sm text-neutral-600">15% mejor que el mes anterior</div>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-2xl mr-4">📈</div>
                    <div>
                      <div className="font-semibold text-neutral-800">Nuevos Clientes</div>
                      <div className="text-sm text-neutral-600">+23 clientes este mes</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <div className="text-2xl mr-4">⚠️</div>
                    <div>
                      <div className="font-semibold text-neutral-800">Atención Requerida</div>
                      <div className="text-sm text-neutral-600">8 clientes con 2+ pagos vencidos</div>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="text-2xl mr-4">🎯</div>
                    <div>
                      <div className="font-semibold text-neutral-800">Meta Alcanzada</div>
                      <div className="text-sm text-neutral-600">95% de la meta mensual</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="space-y-8">
            {/* Recent Activity */}
            <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-800 mb-6">🔄 Actividad Reciente</h3>
              <div className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center p-4 bg-white rounded-lg">
                      <div className="text-2xl mr-4">{activity.icon || "📝"}</div>
                      <div className="flex-1">
                        <div className="text-neutral-800 font-semibold">{activity.title}</div>
                        <div className="text-sm text-neutral-600">{activity.description}</div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-neutral-600 py-8">
                    <div className="text-4xl mb-4">📝</div>
                    <p>No hay actividad reciente</p>
                  </div>
                )}
              </div>
            </div>

            {/* System Status */}
            <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-800 mb-6">🔧 Estado del Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: "Base de Datos", status: "online", icon: "💾" },
                  { label: "API Backend", status: "online", icon: "⚙️" },
                  { label: "WhatsApp API", status: "online", icon: "📱" },
                  { label: "Sistema de Pagos", status: "online", icon: "💳" },
                ].map((service) => (
                  <div key={service.label} className="flex items-center p-4 bg-white rounded-lg">
                    <div className="text-2xl mr-4">{service.icon}</div>
                    <div className="flex-1">
                      <div className="text-neutral-800 font-semibold">{service.label}</div>
                      <div className="text-sm text-neutral-600">{service.status}</div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === "online" ? "bg-green-500" : "bg-red-500"
                    }`}></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;