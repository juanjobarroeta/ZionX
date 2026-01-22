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

const LoansDashboard = () => {
  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [viewMode, setViewMode] = useState("cards"); // cards, table, analytics
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showLoanDetails, setShowLoanDetails] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Get user role from localStorage
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      setUserRole(user?.role || 'user');
    } catch (error) {
      setUserRole('user');
    }
  }, []);
  
  const token = localStorage.getItem("token");

  // Fetch all loans
  const fetchLoans = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/loans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLoans(res.data);
      setFilteredLoans(res.data);
    } catch (err) {
      console.error("Error fetching loans:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/loans/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalyticsData(res.data);
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  };

  useEffect(() => {
    fetchLoans();
    fetchAnalytics();
  }, []);

  // Filter loans based on search and filters
  useEffect(() => {
    let filtered = loans;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(loan => 
        loan.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.customer_phone?.includes(searchTerm) ||
        loan.id?.toString().includes(searchTerm) ||
        loan.inventory_model?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter(loan => loan.status === selectedStatus);
    }

    // Store filter
    if (selectedStore !== "all") {
      filtered = filtered.filter(loan => loan.store_id?.toString() === selectedStore);
    }

    // Date range filter
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(loan => {
        const loanDate = new Date(loan.created_at);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        return loanDate >= startDate && loanDate <= endDate;
      });
    }

    setFilteredLoans(filtered);
  }, [loans, searchTerm, selectedStatus, selectedStore, dateRange]);

  // Calculate loan statistics
  const loanStats = useMemo(() => {
    const total = loans.length;
    
    // Get delivered/approved loans (potential active loans)
    const deliveredOrApprovedLoans = loans.filter(loan => 
      loan.status === 'delivered' || loan.status === 'approved'
    );
    
    console.log('🔍 Debug: All loans:', loans);
    console.log('🔍 Debug: Delivered/Approved loans:', deliveredOrApprovedLoans);
    
    // Calculate total amounts
    const totalAmount = loans.reduce((sum, loan) => sum + parseFloat(loan.amount || 0), 0);
    
    // Simplified logic: Check each loan individually
    const overdueLoans = [];
    const activeLoans = [];
    
    deliveredOrApprovedLoans.forEach(loan => {
      const remainingBalance = parseFloat(loan.remaining_balance || 0);
      const totalPaid = parseFloat(loan.amount || 0) - remainingBalance;
      
      console.log(`🔍 Debug: Loan #${loan.id} - ${loan.customer_name}:`);
      console.log(`  Amount: ${loan.amount}, Remaining: ${remainingBalance}, Paid: ${totalPaid}`);
      console.log(`  Created: ${loan.created_at}`);
      
      // Simple rule: If no payments made and has remaining balance, it's overdue
      if (remainingBalance > 0 && totalPaid <= 0) {
        console.log(`  → OVERDUE (no payments made)`);
        overdueLoans.push(loan);
      } else if (remainingBalance > 0 && totalPaid > 0) {
        // Check if behind schedule
        const loanDate = new Date(loan.created_at);
        const now = new Date();
        const weeksElapsed = Math.floor((now - loanDate) / (7 * 24 * 60 * 60 * 1000));
        const expectedPayments = weeksElapsed * (parseFloat(loan.amount || 0) / 52);
        
        console.log(`  → Weeks elapsed: ${weeksElapsed}, Expected: ${(expectedPayments || 0).toFixed(2)}, Actual: ${(totalPaid || 0).toFixed(2)}`);
        
        // Alternative logic: If loan has significant remaining balance and low progress, consider it overdue
        const progressPercentage = (totalPaid / parseFloat(loan.amount || 1)) * 100;
        const isLowProgress = progressPercentage < 20; // Less than 20% progress
        const isSignificantBalance = remainingBalance > parseFloat(loan.amount || 0) * 0.5; // More than 50% remaining
        
        if (expectedPayments > totalPaid || (isLowProgress && isSignificantBalance)) {
          console.log(`  → OVERDUE (behind schedule or low progress)`);
          overdueLoans.push(loan);
        } else {
          console.log(`  → ACTIVE (on schedule)`);
          activeLoans.push(loan);
        }
      } else {
        console.log(`  → ACTIVE (paid off or no remaining balance)`);
        activeLoans.push(loan);
      }
    });
    
    const active = activeLoans.length;
    const overdue = overdueLoans.length;
    const completed = loans.filter(l => l.status === 'completed').length;
    
    // Calculate overdue amount for Tasa de Morosidad
    const totalOverdueAmount = overdueLoans
      .reduce((sum, loan) => sum + parseFloat(loan.remaining_balance || 0), 0);

    console.log('🔍 Debug: Final counts - Active:', active, 'Overdue:', overdue);
    console.log('🔍 Debug: Total overdue amount:', totalOverdueAmount, 'Total amount:', totalAmount);

    return {
      total,
      active,
      overdue,
      completed,
      totalAmount,
      overdueAmount: totalOverdueAmount,
      // Tasa de Morosidad = (Total overdue money / Total money lent) * 100
      collectionRate: totalAmount > 0 ? ((totalOverdueAmount / totalAmount) * 100).toFixed(1) : '0.0'
    };
  }, [loans]);

  // Chart data for analytics
  const chartData = useMemo(() => {
    if (!analyticsData) return null;

    return {
      statusDistribution: {
        labels: ['Activos', 'Vencidos', 'Completados'],
        datasets: [{
          data: [loanStats.active, loanStats.overdue, loanStats.completed],
          backgroundColor: ['#10b981', '#ef4444', '#6b7280'],
          borderWidth: 0
        }]
      },
      monthlyTrends: {
        labels: analyticsData.monthlyTrends?.map(t => t.month) || [],
        datasets: [{
          label: 'Préstamos Nuevos',
          data: analyticsData.monthlyTrends?.map(t => t.count) || [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4
        }]
      },
      paymentTrends: {
        labels: analyticsData.paymentTrends?.map(t => t.week) || [],
        datasets: [{
          label: 'Pagos Recibidos',
          data: analyticsData.paymentTrends?.map(t => t.amount) || [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4
        }]
      }
    };
  }, [analyticsData, loanStats]);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-600';
      case 'overdue': return 'bg-red-600';
      case 'completed': return 'bg-gray-600';
      case 'pending': return 'bg-yellow-600';
      default: return 'bg-gray-600';
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Activo';
      case 'overdue': return 'Vencido';
      case 'completed': return 'Completado';
      case 'pending': return 'Pendiente';
      default: return status;
    }
  };

  // Calculate days overdue
  const getDaysOverdue = (loan) => {
    if (loan.status !== 'overdue') return 0;
    const dueDate = new Date(loan.next_payment_date);
    const today = new Date();
    const diffTime = Math.abs(today - dueDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculate payment progress
  const getPaymentProgress = (loan) => {
    const total = parseFloat(loan.amount || 0);
    const paid = parseFloat(loan.total_paid || 0);
    return total > 0 ? (paid / total * 100).toFixed(1) : '0.0';
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-neutral-800 mb-2">
                📊 Dashboard de Préstamos
              </h1>
              <p className="text-neutral-600">
                Gestión integral de préstamos con análisis avanzado y herramientas de cobranza
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/create-loan"
                className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-6 py-3 rounded-lg transition-colors"
              >
                ➕ Nuevo Préstamo
              </Link>
              <button
                onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                className="bg-gray-700 hover:bg-gray-600 text-neutral-800 px-4 py-3 rounded-lg transition-colors"
              >
                {viewMode === 'cards' ? '📋 Tabla' : '🃏 Tarjetas'}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">Total Préstamos</p>
                <p className="text-neutral-800 text-2xl font-bold">{loanStats.total}</p>
              </div>
              <div className="text-blue-200 text-3xl">📊</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-sm">Activos</p>
                <p className="text-neutral-800 text-2xl font-bold">{loanStats.active}</p>
              </div>
              <div className="text-green-200 text-3xl">✅</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-200 text-sm">Vencidos</p>
                <p className="text-neutral-800 text-2xl font-bold">{loanStats.overdue}</p>
              </div>
              <div className="text-red-200 text-3xl">⚠️</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm">Tasa de Morosidad</p>
                <p className="text-neutral-800 text-2xl font-bold">{loanStats.collectionRate}%</p>
              </div>
              <div className="text-purple-200 text-3xl">📈</div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white border border-primary-500 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-primary-600 text-sm font-medium mb-2">
                🔍 Buscar
              </label>
              <input
                type="text"
                placeholder="Cliente, teléfono, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 placeholder-gray-400 focus:border-lime-400 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-primary-600 text-sm font-medium mb-2">
                📊 Estado
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
              >
                <option value="all">Todos los Estados</option>
                <option value="active">Activos</option>
                <option value="overdue">Vencidos</option>
                <option value="completed">Completados</option>
                <option value="pending">Pendientes</option>
              </select>
            </div>

            {/* Store Filter */}
            <div>
              <label className="block text-primary-600 text-sm font-medium mb-2">
                🏪 Tienda
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
              >
                <option value="all">Todas las Tiendas</option>
                <option value="1">Atlixco</option>
                <option value="2">Chipilo</option>
                <option value="3">Cholula</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="min-w-0">
              <label className="block text-primary-600 text-sm font-medium mb-2">
                📅 Rango de Fechas
              </label>
              <div className="flex gap-2 min-w-0">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="flex-1 min-w-0 bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none text-sm"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="flex-1 min-w-0 bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-400"></div>
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLoans.map(loan => (
              <div
                key={loan.id}
                className="bg-white border border-primary-500 rounded-lg p-6 hover:border-lime-400 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedLoan(loan);
                  setShowLoanDetails(true);
                }}
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-800">
                      {loan.customer_name}
                    </h3>
                    <p className="text-neutral-600 text-sm">
                      Préstamo #{loan.id}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(loan.status)}`}>
                    {getStatusLabel(loan.status)}
                  </span>
                </div>

                {/* Loan Details */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Monto:</span>
                    <span className="text-neutral-800 font-semibold">
                      ${parseFloat(loan.amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Pagado:</span>
                    <span className="text-neutral-800">
                      ${parseFloat(loan.total_paid || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Saldo:</span>
                    <span className="text-neutral-800">
                      ${parseFloat(loan.remaining_balance || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Producto:</span>
                    <span className="text-neutral-800 text-sm">
                      {loan.inventory_model || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-neutral-600">Progreso</span>
                    <span className="text-neutral-800">{getPaymentProgress(loan)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-lime-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getPaymentProgress(loan)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    to={`/register-payment?loan=${loan.id}`}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-neutral-800 text-center py-2 px-3 rounded text-sm transition-colors"
                  >
                    💰 Pagar
                  </Link>
                  <Link
                    to={`/loans/${loan.id}/details`}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-neutral-800 text-center py-2 px-3 rounded text-sm transition-colors"
                  >
                    📋 Detalles
                  </Link>
                  <Link
                    to={`/loans/unified/${loan.id}`}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-neutral-800 text-center py-2 px-3 rounded text-sm transition-colors"
                    title="Sistema Unificado S.O.A."
                  >
                    🚀
                  </Link>
                  {userRole === 'admin' && parseFloat(loan.remaining_balance || 0) > 0 && (
                    <Link
                      to={`/loans/${loan.id}/resolution`}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-neutral-800 text-center py-2 px-3 rounded text-sm transition-colors"
                      title="Resolver préstamo"
                    >
                      ⚖️
                    </Link>
                  )}
                </div>

                {/* Overdue Warning */}
                {loan.status === 'overdue' && (
                  <div className="mt-3 p-2 bg-red-900 border border-red-600 rounded text-red-200 text-xs">
                    ⚠️ {getDaysOverdue(loan)} días vencido
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white border border-primary-500 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-br from-surface-50 to-surface-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                      Préstamo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                      Monto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                      Saldo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                      Progreso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredLoans.map(loan => (
                    <tr key={loan.id} className="hover:bg-gradient-to-br from-surface-50 to-surface-100 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-neutral-800">
                            {loan.customer_name}
                          </div>
                          <div className="text-sm text-neutral-600">
                            {loan.customer_phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-neutral-800">#{loan.id}</div>
                        <div className="text-sm text-neutral-600">
                          {loan.inventory_model || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-neutral-800">
                          ${parseFloat(loan.amount || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-neutral-800">
                          ${parseFloat(loan.remaining_balance || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(loan.status)}`}>
                          {getStatusLabel(loan.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-700 rounded-full h-2 mr-2">
                            <div
                              className="bg-lime-400 h-2 rounded-full"
                              style={{ width: `${getPaymentProgress(loan)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-neutral-800">
                            {getPaymentProgress(loan)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Link
                            to={`/register-payment?loan=${loan.id}`}
                            className="bg-blue-600 hover:bg-blue-700 text-neutral-800 px-3 py-1 rounded text-xs transition-colors"
                          >
                            Pagar
                          </Link>
                          <Link
                            to={`/loans/${loan.id}/details`}
                            className="bg-gray-600 hover:bg-gray-700 text-neutral-800 px-3 py-1 rounded text-xs transition-colors"
                          >
                            Ver
                          </Link>
                          <Link
                            to={`/loans/unified/${loan.id}`}
                            className="bg-purple-600 hover:bg-purple-700 text-neutral-800 px-3 py-1 rounded text-xs transition-colors"
                            title="S.O.A."
                          >
                            🚀
                          </Link>
                          {userRole === 'admin' && parseFloat(loan.remaining_balance || 0) > 0 && (
                            <Link
                              to={`/loans/${loan.id}/resolution`}
                              className="bg-orange-600 hover:bg-orange-700 text-neutral-800 px-3 py-1 rounded text-xs transition-colors"
                              title="Resolver"
                            >
                              ⚖️
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics View */}
        {viewMode === 'analytics' && chartData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="bg-white border border-primary-500 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-primary-600 mb-4">Distribución por Estado</h3>
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
            </div>
            
            <div className="bg-white border border-primary-500 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-primary-600 mb-4">Tendencias Mensuales</h3>
              <div className="h-64">
                <Line
                  data={chartData.monthlyTrends}
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

        {/* No Results */}
        {filteredLoans.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-neutral-800 mb-2">
              No se encontraron préstamos
            </h3>
            <p className="text-neutral-600">
              Intenta ajustar los filtros de búsqueda
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default LoansDashboard; 