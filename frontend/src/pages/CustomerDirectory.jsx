import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import { Line, Doughnut, Bar } from 'react-chartjs-2';
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
} from 'chart.js';

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

const CustomerDirectory = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [viewMode, setViewMode] = useState("table"); // "table" or "cards"
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [activeTab, setActiveTab] = useState('directory');
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE_URL}/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCustomers(res.data);
        console.log("✅ Customers loaded:", res.data.length);
      } catch (err) {
        console.error("Error fetching customers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [token]);

  // Analytics calculations
  const analytics = useMemo(() => {
    if (!customers.length) return null;

    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => parseFloat(c.total_balance || 0) > 0).length;
    const totalLoaned = customers.reduce((sum, c) => sum + (parseFloat(c.total_loaned || 0)), 0);
    const totalBalance = customers.reduce((sum, c) => sum + (parseFloat(c.total_balance || 0)), 0);
    const avgLoanPerCustomer = totalLoaned / totalCustomers;
    
    // Risk distribution
    const lowRisk = customers.filter(c => (c.loan_count || 0) === 0 || parseFloat(c.total_balance || 0) === 0).length;
    const mediumRisk = customers.filter(c => (c.loan_count || 0) > 0 && parseFloat(c.total_balance || 0) > 0 && parseFloat(c.total_balance || 0) < 10000).length;
    const highRisk = customers.filter(c => parseFloat(c.total_balance || 0) >= 10000).length;

    // Recent activity (mock data for demonstration)
    const recentSignups = customers.filter(c => {
      const created = new Date(c.created_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return created > thirtyDaysAgo;
    }).length;

    return {
      totalCustomers,
      activeCustomers,
      totalLoaned,
      totalBalance,
      avgLoanPerCustomer,
      lowRisk,
      mediumRisk,
      highRisk,
      recentSignups,
      collectionRate: totalLoaned > 0 ? ((totalLoaned - totalBalance) / totalLoaned * 100) : 0
    };
  }, [customers]);

  // Filtered and sorted customers
  const filteredCustomers = useMemo(() => {
    let filtered = customers.filter((c) => {
      const matchesSearch =
        c.id?.toString().includes(search) ||
        c.business_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.commercial_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search);

      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && parseFloat(c.total_balance || 0) > 0) ||
        (statusFilter === "inactive" && parseFloat(c.total_balance || 0) === 0) ||
        (statusFilter === "overdue" && c.loans?.some(loan => loan.status === "atrasado"));

      const matchesStore = storeFilter === "all" || c.store === storeFilter;

      const matchesRisk = riskFilter === "all" ||
        (riskFilter === "low" && ((c.loan_count || 0) === 0 || parseFloat(c.total_balance || 0) === 0)) ||
        (riskFilter === "medium" && ((c.loan_count || 0) > 0 && parseFloat(c.total_balance || 0) > 0 && parseFloat(c.total_balance || 0) < 10000)) ||
        (riskFilter === "high" && parseFloat(c.total_balance || 0) >= 10000);

      return matchesSearch && matchesStatus && matchesStore && matchesRisk;
    });

    // Sort customers
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "name":
          // Use business name for business customers, fallback to personal name
          aValue = (a.business_name || `${a.first_name || ''} ${a.last_name || ''}`).toLowerCase();
          bValue = (b.business_name || `${b.first_name || ''} ${b.last_name || ''}`).toLowerCase();
          break;
        case "balance":
          aValue = parseFloat(a.total_balance || 0);
          bValue = parseFloat(b.total_balance || 0);
          break;
        case "loans":
          aValue = a.loan_count || 0;
          bValue = b.loan_count || 0;
          break;
        case "created":
          aValue = new Date(a.created_at || 0);
          bValue = new Date(b.created_at || 0);
          break;
        default:
          aValue = a.id;
          bValue = b.id;
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [customers, search, statusFilter, storeFilter, riskFilter, sortBy, sortOrder]);

  // Chart configurations
  const riskDistributionChart = useMemo(() => {
    if (!analytics) return null;
    
    return {
      data: {
        labels: ['Bajo Riesgo', 'Riesgo Medio', 'Alto Riesgo'],
        datasets: [{
          data: [analytics.lowRisk, analytics.mediumRisk, analytics.highRisk],
          backgroundColor: ['#22d3ee', '#eab308', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#fff', font: { size: 12 } }
          }
        }
      }
    };
  }, [analytics]);

  const customerGrowthChart = useMemo(() => {
    if (!customers.length) return null;
    
    // Mock monthly growth data
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    const data = [50, 65, 80, 95, 110, customers.length];
    
    return {
      data: {
        labels: months,
        datasets: [{
          label: 'Clientes',
          data: data,
          borderColor: '#84cc16',
          backgroundColor: 'rgba(132, 204, 22, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#9ca3af' },
            grid: { color: 'rgba(75, 85, 99, 0.3)' }
          },
          x: {
            ticks: { color: '#9ca3af' },
            grid: { color: 'rgba(75, 85, 99, 0.3)' }
          }
        },
        plugins: {
          legend: {
            labels: { color: '#fff' }
          }
        }
      }
    };
  }, [customers.length]);

  const getRiskLevel = (customer) => {
    const balance = parseFloat(customer.total_balance || 0);
    const loanCount = customer.loan_count || 0;
    
    if (loanCount === 0 || balance === 0) return { level: 'Bajo', color: 'text-cyan-400' };
    if (balance < 10000) return { level: 'Medio', color: 'text-yellow-400' };
    return { level: 'Alto', color: 'text-neutral-600' };
  };

  const handleSelectCustomer = (customerId) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(c => c.id));
    }
  };

  const tabs = [
    { id: 'directory', label: '👥 Directorio', icon: '👥' },
    { id: 'analytics', label: '📊 Análisis', icon: '📊' },
    { id: 'segments', label: '🎯 Segmentos', icon: '🎯' }
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-400 mx-auto mb-4"></div>
            <p className="text-neutral-600">Cargando directorio de clientes...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Header Section */}
        <div className="bg-white/50 backdrop-blur-sm border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-neutral-800">Customer Relationship Management</h1>
                <p className="text-neutral-600">Gestión integral de clientes y relaciones comerciales</p>
              </div>
              <div className="flex items-center space-x-4">
                <Link 
                  to="/create-customer"
                  className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  ➕ Nuevo Cliente
                </Link>
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    showBulkActions ? 'bg-purple-600 text-neutral-800' : 'bg-gray-700 text-neutral-700 hover:bg-gray-600'
                  }`}
                >
                  🔄 Acciones Masivas
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            {analytics && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-white/50 rounded-lg p-4 border border-neutral-200">
                  <div className="text-2xl font-bold text-primary-600">{analytics.totalCustomers}</div>
                  <div className="text-neutral-600 text-sm">Total Clientes</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4 border border-neutral-200">
                  <div className="text-2xl font-bold text-primary-500">{analytics.activeCustomers}</div>
                  <div className="text-neutral-600 text-sm">Clientes Activos</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4 border border-neutral-200">
                  <div className="text-2xl font-bold text-primary-500">${analytics.totalLoaned.toLocaleString()}</div>
                  <div className="text-neutral-600 text-sm">Total Prestado</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4 border border-neutral-200">
                  <div className="text-2xl font-bold text-yellow-400">${analytics.totalBalance.toLocaleString()}</div>
                  <div className="text-neutral-600 text-sm">Saldo Pendiente</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4 border border-neutral-200">
                  <div className="text-2xl font-bold text-purple-400">{analytics.recentSignups}</div>
                  <div className="text-neutral-600 text-sm">Nuevos (30d)</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4 border border-neutral-200">
                  <div className="text-2xl font-bold text-cyan-400">{analytics.collectionRate.toFixed(1)}%</div>
                  <div className="text-neutral-600 text-sm">Tasa Cobro</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="border-b border-neutral-200 mb-6">
            <nav className="flex space-x-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-primary-600 border-b-2 border-lime-400'
                      : 'text-neutral-600 hover:text-neutral-800 hover:bg-white/50'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="space-y-6 pb-8">
            {/* Directory Tab */}
            {activeTab === 'directory' && (
              <div className="space-y-6">
                {/* Advanced Filters */}
                <div className="bg-white rounded-lg p-6 border border-neutral-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    <div>
                      <input
                        type="text"
                        placeholder="🔍 Buscar clientes..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                      >
                        <option value="all">Todos los Estados</option>
                        <option value="active">Clientes Activos</option>
                        <option value="inactive">Sin Préstamos</option>
                        <option value="overdue">Con Atrasos</option>
                      </select>
                    </div>
                    <div>
                      <select
                        value={storeFilter}
                        onChange={(e) => setStoreFilter(e.target.value)}
                        className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                      >
                        <option value="all">Todas las Tiendas</option>
                        <option value="Atlixco">Atlixco</option>
                        <option value="Chipilo">Chipilo</option>
                        <option value="Cholula">Cholula</option>
                      </select>
                    </div>
                    <div>
                      <select
                        value={riskFilter}
                        onChange={(e) => setRiskFilter(e.target.value)}
                        className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                      >
                        <option value="all">Todos los Riesgos</option>
                        <option value="low">Bajo Riesgo</option>
                        <option value="medium">Riesgo Medio</option>
                        <option value="high">Alto Riesgo</option>
                      </select>
                    </div>
                    <div>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                      >
                        <option value="name">Ordenar por Nombre</option>
                        <option value="balance">Por Saldo</option>
                        <option value="loans">Por # Préstamos</option>
                        <option value="created">Por Fecha</option>
                      </select>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-neutral-800 px-3 py-2 rounded-lg transition-colors"
                        title={`Orden ${sortOrder === "asc" ? "Ascendente" : "Descendente"}`}
                      >
                        {sortOrder === "asc" ? "⬆️" : "⬇️"}
                      </button>
                      <button
                        onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-neutral-800 px-3 py-2 rounded-lg transition-colors"
                        title={`Vista ${viewMode === "table" ? "Tarjetas" : "Tabla"}`}
                      >
                        {viewMode === "table" ? "🔲" : "📋"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bulk Actions */}
                {showBulkActions && (
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="text-purple-400 font-medium">
                          {selectedCustomers.length} clientes seleccionados
                        </span>
                        <button
                          onClick={handleSelectAll}
                          className="text-purple-400 hover:text-purple-300 text-sm"
                        >
                          {selectedCustomers.length === filteredCustomers.length ? "Deseleccionar Todos" : "Seleccionar Todos"}
                        </button>
                      </div>
                      <div className="flex space-x-2">
                        <button className="bg-blue-600 hover:bg-blue-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors">
                          📧 Enviar Email
                        </button>
                        <button className="bg-green-600 hover:bg-green-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors">
                          📊 Exportar
                        </button>
                        <button className="bg-orange-600 hover:bg-orange-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors">
                          🏷️ Etiquetar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Results Summary */}
                <div className="flex items-center justify-between text-neutral-600 text-sm">
                  <span>Mostrando {filteredCustomers.length} de {customers.length} clientes</span>
                  <span>Última actualización: {new Date().toLocaleTimeString()}</span>
                </div>

                {/* Customer List */}
                {viewMode === "table" ? (
                  <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-700">
                          <tr>
                            {showBulkActions && (
                              <th className="px-4 py-4 text-left">
                                <input
                                  type="checkbox"
                                  checked={selectedCustomers.length === filteredCustomers.length}
                                  onChange={handleSelectAll}
                                  className="rounded"
                                />
                              </th>
                            )}
                            <th className="px-6 py-4 text-left text-neutral-700 font-medium">Cliente</th>
                            <th className="px-6 py-4 text-left text-neutral-700 font-medium">Contacto</th>
                            <th className="px-6 py-4 text-center text-neutral-700 font-medium">Préstamos</th>
                            <th className="px-6 py-4 text-right text-neutral-700 font-medium">Saldo</th>
                            <th className="px-6 py-4 text-center text-neutral-700 font-medium">Riesgo</th>
                            <th className="px-6 py-4 text-center text-neutral-700 font-medium">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-600">
                          {filteredCustomers.length === 0 ? (
                            <tr>
                              <td colSpan={showBulkActions ? "7" : "6"} className="px-6 py-8 text-center text-neutral-600">
                                <div className="flex flex-col items-center">
                                  <div className="text-4xl mb-2">👥</div>
                                  <p>No se encontraron clientes</p>
                                  <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredCustomers.map((customer) => {
                              const risk = getRiskLevel(customer);
                              return (
                                <tr key={customer.id} className="hover:bg-gray-700/50">
                                  {showBulkActions && (
                                    <td className="px-4 py-4">
                                      <input
                                        type="checkbox"
                                        checked={selectedCustomers.includes(customer.id)}
                                        onChange={() => handleSelectCustomer(customer.id)}
                                        className="rounded"
                                      />
                                    </td>
                                  )}
                                  <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-10 h-10 bg-gradient-to-br from-lime-400 to-green-500 rounded-full flex items-center justify-center text-sm font-bold text-neutral-800">
                                        {customer.business_name ? customer.business_name.charAt(0) : (customer.first_name?.charAt(0) || 'C')}{customer.commercial_name ? customer.commercial_name.charAt(0) : (customer.last_name?.charAt(0) || '')}
                                      </div>
                                      <div>
                                        <div className="text-neutral-800 font-medium">
                                          {customer.business_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Cliente Sin Nombre'}
                                        </div>
                                        <div className="text-neutral-600 text-sm">
                                          {customer.commercial_name && customer.business_name !== customer.commercial_name && (
                                            <span className="block">Comercial: {customer.commercial_name}</span>
                                          )}
                                          ID: {customer.id}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="text-neutral-800">{customer.email}</div>
                                    <div className="text-neutral-600 text-sm">{customer.phone}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-primary-500">
                                      {customer.loan_count || 0} préstamos
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="text-neutral-800 font-semibold">
                                      ${parseFloat(customer.total_balance || 0).toLocaleString()}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      risk.level === 'Alto' ? 'bg-red-900/30 text-neutral-600' :
                                      risk.level === 'Medio' ? 'bg-yellow-900/30 text-yellow-400' :
                                      'bg-cyan-900/30 text-cyan-400'
                                    }`}>
                                      {risk.level}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center space-x-2">
                                      <Link 
                                        to={`/customer/${customer.id}`}
                                        className="bg-blue-600 hover:bg-blue-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors"
                                      >
                                        👤 Perfil
                                      </Link>
                                      <Link 
                                        to={`/loans/unified?customer_id=${customer.id}`}
                                        className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors"
                                      >
                                        💰 Préstamo
                                      </Link>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCustomers.map((customer) => {
                      const risk = getRiskLevel(customer);
                      return (
                        <div key={customer.id} className="bg-white rounded-lg p-6 border border-neutral-200 hover:border-lime-400 transition-colors">
                          {showBulkActions && (
                            <div className="flex justify-end mb-2">
                              <input
                                type="checkbox"
                                checked={selectedCustomers.includes(customer.id)}
                                onChange={() => handleSelectCustomer(customer.id)}
                                className="rounded"
                              />
                            </div>
                          )}
                          <div className="flex items-center space-x-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-lime-400 to-green-500 rounded-full flex items-center justify-center text-lg font-bold text-neutral-800">
                              {customer.business_name ? customer.business_name.charAt(0) : (customer.first_name?.charAt(0) || 'C')}{customer.commercial_name ? customer.commercial_name.charAt(0) : (customer.last_name?.charAt(0) || '')}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-neutral-800 font-semibold">
                                {customer.business_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Cliente Sin Nombre'}
                              </h3>
                              <p className="text-neutral-600 text-sm">
                                {customer.commercial_name && customer.business_name !== customer.commercial_name && (
                                  <span className="block">Comercial: {customer.commercial_name}</span>
                                )}
                                ID: {customer.id}
                              </p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              risk.level === 'Alto' ? 'bg-red-900/30 text-neutral-600' :
                              risk.level === 'Medio' ? 'bg-yellow-900/30 text-yellow-400' :
                              'bg-cyan-900/30 text-cyan-400'
                            }`}>
                              {risk.level}
                            </span>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-neutral-600">Email:</span>
                              <span className="text-neutral-800">{customer.email}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-neutral-600">Teléfono:</span>
                              <span className="text-neutral-800">{customer.phone}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-neutral-600">Préstamos:</span>
                              <span className="text-primary-500">{customer.loan_count || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-neutral-600">Saldo:</span>
                              <span className="text-neutral-800 font-semibold">
                                ${parseFloat(customer.total_balance || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2">
                            <Link 
                              to={`/customer/${customer.id}`}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-neutral-800 text-center py-2 px-3 rounded text-sm transition-colors"
                            >
                              👤 Perfil
                            </Link>
                            <Link 
                              to={`/loans/unified?customer_id=${customer.id}`}
                              className="flex-1 bg-lime-600 hover:bg-lime-700 text-neutral-800 text-center py-2 px-3 rounded text-sm transition-colors"
                            >
                              💰 Préstamo
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && analytics && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Risk Distribution */}
                  {riskDistributionChart && (
                    <div className="bg-white rounded-lg p-6 border border-neutral-200">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4">📊 Distribución de Riesgo</h3>
                      <div className="h-64">
                        <Doughnut data={riskDistributionChart.data} options={riskDistributionChart.options} />
                      </div>
                    </div>
                  )}

                  {/* Customer Growth */}
                  {customerGrowthChart && (
                    <div className="bg-white rounded-lg p-6 border border-neutral-200">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4">📈 Crecimiento de Clientes</h3>
                      <div className="h-64">
                        <Line data={customerGrowthChart.data} options={customerGrowthChart.options} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Detailed Analytics */}
                <div className="bg-white rounded-lg p-6 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">📋 Métricas Detalladas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary-600">${analytics.avgLoanPerCustomer.toLocaleString()}</div>
                      <div className="text-neutral-600 text-sm">Promedio por Cliente</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary-500">
                        {((analytics.activeCustomers / analytics.totalCustomers) * 100).toFixed(1)}%
                      </div>
                      <div className="text-neutral-600 text-sm">Tasa de Actividad</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-400">
                        {analytics.recentSignups}
                      </div>
                      <div className="text-neutral-600 text-sm">Nuevos este Mes</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Segments Tab */}
            {activeTab === 'segments' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg p-6 border border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-4">🎯 Clientes VIP</h3>
                    <p className="text-neutral-600 text-sm mb-4">Clientes con saldo mayor a $50,000</p>
                    <div className="text-2xl font-bold text-yellow-400 mb-2">
                      {customers.filter(c => parseFloat(c.total_balance || 0) > 50000).length}
                    </div>
                    <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-neutral-800 py-2 px-4 rounded-lg font-medium transition-colors">
                      Ver Segmento
                    </button>
                  </div>

                  <div className="bg-white rounded-lg p-6 border border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-4">⚠️ Clientes en Riesgo</h3>
                    <p className="text-neutral-600 text-sm mb-4">Requieren seguimiento especial</p>
                    <div className="text-2xl font-bold text-neutral-600 mb-2">
                      {analytics.highRisk}
                    </div>
                    <button className="w-full bg-red-600 hover:bg-red-700 text-neutral-800 py-2 px-4 rounded-lg font-medium transition-colors">
                      Ver Segmento
                    </button>
                  </div>

                  <div className="bg-white rounded-lg p-6 border border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-4">🌱 Clientes Nuevos</h3>
                    <p className="text-neutral-600 text-sm mb-4">Registrados últimos 30 días</p>
                    <div className="text-2xl font-bold text-primary-500 mb-2">
                      {analytics.recentSignups}
                    </div>
                    <button className="w-full bg-green-600 hover:bg-green-700 text-neutral-800 py-2 px-4 rounded-lg font-medium transition-colors">
                      Ver Segmento
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-6 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">📊 Análisis de Segmentación</h3>
                  <p className="text-neutral-600 mb-6">
                    Distribución inteligente de clientes basada en comportamiento crediticio y patrones de pago.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-neutral-800 font-medium mb-3">Por Comportamiento de Pago</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-gray-700/50 rounded">
                          <span className="text-neutral-700">Pagadores Puntuales</span>
                          <span className="text-primary-500 font-semibold">65%</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-gray-700/50 rounded">
                          <span className="text-neutral-700">Pagadores Ocasionales</span>
                          <span className="text-yellow-400 font-semibold">25%</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-gray-700/50 rounded">
                          <span className="text-neutral-700">Pagadores Tardíos</span>
                          <span className="text-neutral-600 font-semibold">10%</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-neutral-800 font-medium mb-3">Por Valor del Cliente</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-gray-700/50 rounded">
                          <span className="text-neutral-700">Alto Valor (más $30k)</span>
                          <span className="text-purple-400 font-semibold">15%</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-gray-700/50 rounded">
                          <span className="text-neutral-700">Valor Medio ($10k-30k)</span>
                          <span className="text-primary-500 font-semibold">45%</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-gray-700/50 rounded">
                          <span className="text-neutral-700">Valor Bajo (menos $10k)</span>
                          <span className="text-neutral-600 font-semibold">40%</span>
                        </div>
                      </div>
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

export default CustomerDirectory;