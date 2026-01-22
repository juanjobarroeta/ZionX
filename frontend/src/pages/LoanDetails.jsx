import Layout from "../components/Layout";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const API_BASE_URL = import.meta.env.VITE_API_URL;

const LoanDetails = () => {
  const { loan_id } = useParams();
  const [loanData, setLoanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [chartData, setChartData] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const token = localStorage.getItem("token");

  // Get user role from localStorage or token
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      setUserRole(user?.role || 'user');
    } catch (error) {
      setUserRole('user');
    }
  }, []);

  useEffect(() => {
    const fetchLoanDetails = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/loans/${loan_id}/details`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLoanData(res.data);
        generateChartData(res.data);
      } catch (err) {
        console.error("Error fetching loan details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLoanDetails();
  }, [loan_id, token]);

  const generateChartData = (data) => {
    if (!data || !data.installments) return;

    const { installments, payments } = data;
    
    // Payment Progress Chart
    const paymentProgress = {
      labels: installments.map(inst => `Semana ${inst.week_number}`),
      datasets: [
        {
          label: 'Monto Programado',
          data: installments.map(inst => parseFloat(inst.amount_due || 0)),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Monto Pagado',
          data: installments.map(inst => {
            const paidAmount = payments?.filter(p => p.installment_week === inst.week_number)
              .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            return paidAmount;
          }),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
        }
      ]
    };

    // Payment Status Distribution
    const statusDistribution = {
      labels: ['Pagado', 'Pendiente', 'Vencido'],
      datasets: [{
        data: [
          installments.filter(inst => inst.status === 'paid').length,
          installments.filter(inst => inst.status === 'pending').length,
          installments.filter(inst => inst.status === 'overdue').length,
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0,
      }]
    };

    setChartData({ paymentProgress, statusDistribution });
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-lime-400 mx-auto mb-4"></div>
            <p className="text-primary-600 text-lg">Cargando detalles del préstamo...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!loanData) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-neutral-800 mb-2">No se encontraron datos</h2>
            <p className="text-neutral-600">El préstamo solicitado no existe o no está disponible.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const { loan, installments, payments, penalties, totals } = loanData;
  
  // Check if the first unpaid installment is overdue
  const isOverdue = (() => {
    if (!installments || installments.length === 0) return false;
    
    // Find the first unpaid installment
    const firstUnpaidInstallment = installments.find(inst => inst.status === 'pending');
    
    if (!firstUnpaidInstallment) return false; // All installments are paid
    
    const dueDate = new Date(firstUnpaidInstallment.due_date);
    const now = new Date();
    return now > dueDate || (now.toDateString() === dueDate.toDateString() && now.getHours() >= 14);
  })();
  const totalPaid = totals?.totalPaid || payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
  const progressPercentage = ((totalPaid / parseFloat(loan.amount)) * 100).toFixed(1);

  const tabs = [
    { id: "overview", label: "📊 Resumen", icon: "📊" },
    { id: "payments", label: "💰 Pagos", icon: "💰" },
    { id: "schedule", label: "📅 Calendario", icon: "📅" },
    { id: "penalties", label: "⚠️ Penalizaciones", icon: "⚠️" },
    { id: "accounting", label: "📘 Contabilidad", icon: "📘" },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-white text-neutral-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-black border-b border-gray-800 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-neutral-800 mb-2">
                  Detalles del Préstamo #{loan.id}
                </h1>
                <p className="text-neutral-600">
                  Cliente: {loan.first_name} {loan.last_name}
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  to={`/register-payment?loan=${loan.id}`}
                  className="bg-primary-500 hover:bg-primary-600 text-neutral-800 px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  💰 Registrar Pago
                </Link>
                {userRole === 'admin' && (parseFloat(totals?.pendingCapital || 0) + parseFloat(totals?.pendingInterest || 0)) > 0 && (
                  <Link
                    to={`/loans/${loan.id}/resolution`}
                    className="bg-orange-600 hover:bg-orange-700 text-neutral-800 px-6 py-2 rounded-lg font-semibold transition-colors"
                  >
                    ⚖️ Resolver Préstamo
                  </Link>
                )}
                <Link
                  to="/loans"
                  className="bg-gray-700 hover:bg-gray-600 text-neutral-800 px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  ← Volver
                </Link>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-600 text-sm">Monto Total</p>
                    <p className="text-2xl font-bold text-neutral-800">${parseFloat(loan.amount).toLocaleString()}</p>
                  </div>
                  <div className="text-3xl">💰</div>
                </div>
              </div>
              
              <div className="bg-white border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-600 text-sm">Capital Pendiente</p>
                    <p className="text-2xl font-bold text-neutral-800">${parseFloat(totals?.pendingCapital || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-3xl">📊</div>
                </div>
              </div>
              
              <div className="bg-white border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-600 text-sm">Interés Pendiente</p>
                    <p className="text-2xl font-bold text-neutral-800">${parseFloat(totals?.pendingInterest || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-3xl">📈</div>
                </div>
              </div>
              
              <div className="bg-white border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-600 text-sm">Estado</p>
                    <p className={`text-lg font-bold ${isOverdue ? 'text-neutral-600' : 'text-primary-500'}`}>
                      {isOverdue ? 'Vencido' : 'Al Día'}
                    </p>
                  </div>
                  <div className="text-3xl">{isOverdue ? '⚠️' : '✅'}</div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-neutral-600">Progreso del Pago</span>
                <span className="text-sm font-semibold text-primary-600">{progressPercentage}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-lime-400 to-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex space-x-1 bg-white rounded-lg p-1 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-primary-500 text-neutral-800 shadow-lg"
                    : "text-neutral-600 hover:text-neutral-800 hover:bg-gray-700"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Charts */}
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">Progreso de Pagos</h3>
                  {chartData && (
                    <div className="h-64">
                      <Line
                        data={chartData.paymentProgress}
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
                  )}
                </div>

                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">Distribución de Estados</h3>
                  {chartData && (
                    <div className="h-64">
                      <Doughnut
                        data={chartData.statusDistribution}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              labels: { color: "white" },
                            },
                          },
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Loan Details */}
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">📋 Información del Préstamo</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Cliente:</span>
                      <span className="text-neutral-800 font-medium">{loan.first_name} {loan.last_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Capturado por:</span>
                      <span className="text-neutral-800 font-medium">
                        {loan.employee_first_name || loan.employee_last_name
                          ? `${loan.employee_first_name || ""} ${loan.employee_last_name || ""}`.trim()
                          : "No registrado"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Fecha de creación:</span>
                      <span className="text-neutral-800 font-medium">
                        {new Date(loan.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Fecha de vencimiento:</span>
                      <span className="text-neutral-800 font-medium">
                        {new Date(loan.due_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Último pago:</span>
                      <span className="text-neutral-800 font-medium">
                        {loan.last_payment_date ? new Date(loan.last_payment_date).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">💰 Resumen Financiero</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Monto total prestado:</span>
                      <span className="text-neutral-800 font-medium">${parseFloat(loan.amount).toLocaleString()}</span>
                    </div>
                                         <div className="flex justify-between">
                       <span className="text-neutral-600">Capital pendiente:</span>
                       <span className="text-neutral-800 font-medium">${parseFloat(totals?.pendingCapital || 0).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-neutral-600">Interés pendiente:</span>
                       <span className="text-neutral-800 font-medium">${parseFloat(totals?.pendingInterest || 0).toLocaleString()}</span>
                     </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Penalizaciones:</span>
                      <span className="text-neutral-800 font-medium">${parseFloat(totals?.totalPenalties || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Total pagado:</span>
                      <span className="text-primary-500 font-medium">${totalPaid.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === "payments" && (
              <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800">🧾 Historial de Pagos</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-br from-surface-50 to-surface-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Método
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Componente
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Monto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Semana
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {payments && payments.length > 0 ? (
                        payments.map((p, i) => (
                          <tr key={i} className="hover:bg-gray-700 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              {new Date(p.payment_date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800 capitalize">
                              {p.method || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800 capitalize">
                              {p.component || 'N/A'}
                            </td>
                                                         <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800 font-medium">
                               ${parseFloat(p.amount || 0).toLocaleString()}
                             </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              {p.installment_week || 'N/A'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-6 py-8 text-center text-neutral-600">
                            <div className="text-4xl mb-2">💰</div>
                            <p>No hay pagos registrados</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Schedule Tab */}
            {activeTab === "schedule" && (
              <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800">📅 Calendario de Pagos</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-br from-surface-50 to-surface-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Semana
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Fecha de Vencimiento
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Monto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Principal
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Interés
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {installments && installments.length > 0 ? (
                        installments.map((inst, i) => (
                          <tr key={i} className="hover:bg-gray-700 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800 font-medium">
                              {inst.week_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              {new Date(inst.due_date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800 font-medium">
                              ${parseFloat(inst.amount_due || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              ${parseFloat(inst.capital_portion || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              ${parseFloat(inst.interest_portion || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                inst.status === 'paid' ? 'bg-green-600 text-neutral-800' : 
                                inst.status === 'overdue' ? 'bg-red-600 text-neutral-800' : 'bg-yellow-600 text-neutral-800'
                              }`}>
                                {inst.status === 'paid' ? 'Pagado' : 
                                 inst.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-6 py-8 text-center text-neutral-600">
                            <div className="text-4xl mb-2">📅</div>
                            <p>No hay cuotas programadas</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Penalties Tab */}
            {activeTab === "penalties" && (
              <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800">⚠️ Penalizaciones</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-br from-surface-50 to-surface-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Semana
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Fecha de Vencimiento
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Monto Penalización
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {penalties && penalties.length > 0 ? (
                        penalties.map((penalty, i) => (
                          <tr key={i} className="hover:bg-gray-700 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800 font-medium">
                              {penalty.week_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              {new Date(penalty.due_date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 font-medium">
                              ${parseFloat(penalty.penalty_applied || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="px-6 py-8 text-center text-neutral-600">
                            <div className="text-4xl mb-2">✅</div>
                            <p>No hay penalizaciones aplicadas</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Accounting Tab */}
            {activeTab === "accounting" && (
              <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800">📘 Asientos Contables</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-br from-surface-50 to-surface-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Descripción
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Cuenta
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Débito
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                          Crédito
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {loanData.journal_entries && loanData.journal_entries.length > 0 ? (
                        loanData.journal_entries.map((entry, i) => (
                          <tr key={i} className="hover:bg-gray-700 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              {new Date(entry.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              {entry.description}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              {entry.account_code}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              {entry.debit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-800">
                              {entry.credit}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-6 py-8 text-center text-neutral-600">
                            <div className="text-4xl mb-2">📘</div>
                            <p>No hay asientos contables registrados</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LoanDetails;