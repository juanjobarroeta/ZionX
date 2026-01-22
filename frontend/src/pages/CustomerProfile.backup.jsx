import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { Line, Doughnut } from 'react-chartjs-2';
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
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const CustomerProfile = () => {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('cliente');
  
  // Marketing-specific state
  const [brandingFiles, setBrandingFiles] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [escaletaFiles, setEscaletaFiles] = useState([]);
  const [designFiles, setDesignFiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [notes, setNotes] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('');
  
  // File upload state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  // Fetch customer data and marketing assets
  useEffect(() => {
    fetchCustomerData();
    fetchMarketingAssets();
  }, [id]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_BASE_URL}/customers/${id}`, { headers });
      setCustomer(response.data);
    } catch (err) {
      console.error("Error fetching customer:", err);
      setError("No se pudo cargar la información del cliente");
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketingAssets = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch marketing files by category
      const [brandingRes, mediaRes, escaletaRes, designRes, reportsRes, notesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/customers/${id}/files/branding`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers/${id}/files/media`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers/${id}/files/escaleta`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers/${id}/files/designs`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers/${id}/reports`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers/${id}/notes`, { headers }).catch(() => ({ data: [] }))
      ]);

      setBrandingFiles(brandingRes.data || []);
      setMediaFiles(mediaRes.data || []);
      setEscaletaFiles(escaletaRes.data || []);
      setDesignFiles(designRes.data || []);
      setReports(reportsRes.data || []);
      setNotes(notesRes.data || []);
    } catch (err) {
      console.error("Error fetching marketing assets:", err);
    }
  };

  // File upload handlers
  const handleFileUpload = async (files, category) => {
    try {
      setUploadingFiles(prev => ({ ...prev, [category]: true }));
      
      const formData = new FormData();
      Array.from(files).forEach((file, index) => {
        formData.append(`files`, file);
      });
      formData.append('category', category);
      formData.append('customer_id', id);

      const token = localStorage.getItem("token");
      const response = await axios.post(`${API_BASE_URL}/customers/${id}/files/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({ ...prev, [category]: percentCompleted }));
        }
      });

      if (response.data.success) {
        // Refresh the specific category files
        await fetchMarketingAssets();
        setShowUploadModal(false);
        setSelectedFiles([]);
      }
    } catch (err) {
      console.error(`Error uploading ${category} files:`, err);
      alert(`Error subiendo archivos de ${category}`);
    } finally {
      setUploadingFiles(prev => ({ ...prev, [category]: false }));
      setUploadProgress(prev => ({ ...prev, [category]: 0 }));
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
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Analytics calculations
  const analytics = useMemo(() => {
    if (!loans.length) return null;

    const totalLoaned = loans.reduce((sum, loan) => sum + (parseFloat(loan.amount) || 0), 0);
    const totalPaid = loans.reduce((sum, loan) => sum + (parseFloat(loan.amount_paid) || 0), 0);
    const currentBalance = totalLoaned - totalPaid;
    
    const activeLoans = loans.filter(l => ['active', 'approved', 'delivered'].includes(l.status));
    const overdueLoans = loans.filter(l => l.status === 'overdue' || l.status === 'atrasado');
    const completedLoans = loans.filter(l => ['completed', 'liquidado', 'paid'].includes(l.status));
    
    const avgLoanAmount = totalLoaned / loans.length;
    const paymentHistory = payments.map(p => ({
      date: new Date(p.payment_date).toLocaleDateString(),
      amount: parseFloat(p.amount) || 0
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const riskLevel = overdueLoans.length > 0 ? 'Alto' : 
                     activeLoans.length > completedLoans.length ? 'Medio' : 'Bajo';
    
    return {
      totalLoaned,
      totalPaid,
      currentBalance,
      activeCount: activeLoans.length,
      overdueCount: overdueLoans.length,
      completedCount: completedLoans.length,
      avgLoanAmount,
      paymentHistory,
      riskLevel,
      onTimePayments: payments.length - overdueLoans.length,
      totalPayments: payments.length
    };
  }, [loans, payments]);

  // Filter loans based on search and status
  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      const matchesSearch = loan.id.toString().includes(searchTerm) || 
                           loan.status.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || loan.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [loans, searchTerm, filterStatus]);

  // Chart configurations
  const loanStatusChart = useMemo(() => {
    if (!analytics) return null;
    
    return {
      data: {
        labels: ['Activos', 'Vencidos', 'Completados'],
        datasets: [{
          data: [analytics.activeCount, analytics.overdueCount, analytics.completedCount],
          backgroundColor: ['#84cc16', '#ef4444', '#22d3ee'],
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

  const paymentTrendChart = useMemo(() => {
    if (!analytics?.paymentHistory.length) return null;
    
    return {
      data: {
        labels: analytics.paymentHistory.slice(-12).map(p => p.date),
        datasets: [{
          label: 'Pagos',
          data: analytics.paymentHistory.slice(-12).map(p => p.amount),
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
  }, [analytics]);

  if (loading || !customer) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-400 mx-auto mb-4"></div>
            <p className="text-neutral-600">Cargando perfil del cliente...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 m-6">
          <h3 className="text-neutral-600 font-semibold mb-2">❌ Error</h3>
          <p className="text-neutral-700">{error}</p>
        </div>
      </Layout>
    );
  }

  // Marketing-focused tabs
  const tabs = [
    { id: 'cliente', label: '🏢 Cliente', icon: '🏢', description: 'Información general de la empresa' },
    { id: 'branding', label: '🎨 Branding', icon: '🎨', description: 'Identidad de marca y recursos' },
    { id: 'media', label: '📸 Foto y Video', icon: '📸', description: 'Archivos multimedia' },
    { id: 'escaleta', label: '📅 Escaleta', icon: '📅', description: 'Calendario de contenido' },
    { id: 'designs', label: '🎯 Artes Listos', icon: '🎯', description: 'Diseños finalizados' },
    { id: 'reportes', label: '📊 Reportes', icon: '📊', description: 'Análisis mensuales' }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Header Section */}
        <div className="bg-white/50 backdrop-blur-sm border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-lime-400 to-green-500 rounded-full flex items-center justify-center text-2xl font-bold text-neutral-800">
                  {customer.first_name?.charAt(0)}{customer.last_name?.charAt(0)}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-neutral-800">
                    {customer.first_name} {customer.last_name}
                  </h1>
                  <p className="text-neutral-600">{customer.email}</p>
                  <p className="text-neutral-600">{customer.phone}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {analytics && (
                  <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                    analytics.riskLevel === 'Alto' ? 'bg-red-900/30 text-neutral-600 border border-red-500/30' :
                    analytics.riskLevel === 'Medio' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' :
                    'bg-green-900/30 text-primary-500 border border-green-500/30'
                  }`}>
                    🎯 Riesgo {analytics.riskLevel}
                  </div>
                )}
                <Link 
                  to={`/loans/unified?customer_id=${id}`}
                  className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  🚀 Nuevo Préstamo
                </Link>
              </div>
            </div>

            {/* Quick Stats */}
            {analytics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/50 rounded-lg p-4 border border-neutral-200">
                  <div className="text-2xl font-bold text-primary-600">${analytics.totalLoaned.toLocaleString()}</div>
                  <div className="text-neutral-600 text-sm">Total Prestado</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4 border border-neutral-200">
                  <div className="text-2xl font-bold text-primary-500">${analytics.totalPaid.toLocaleString()}</div>
                  <div className="text-neutral-600 text-sm">Total Pagado</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4 border border-neutral-200">
                  <div className={`text-2xl font-bold ${
                    analytics.currentBalance > 0 ? 'text-yellow-400' : 'text-primary-500'
                  }`}>
                    ${analytics.currentBalance.toLocaleString()}
                  </div>
                  <div className="text-neutral-600 text-sm">Balance Actual</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4 border border-neutral-200">
                  <div className="text-2xl font-bold text-purple-400">{loans.length}</div>
                  <div className="text-neutral-600 text-sm">Préstamos Total</div>
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
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Customer Information */}
                  <div className="bg-white rounded-lg p-6 border border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-4">👤 Información Personal</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-neutral-600">CURP:</span>
                        <span className="text-neutral-800 font-mono">{customer.curp || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Fecha de Nacimiento:</span>
                        <span className="text-neutral-800">{customer.birthdate ? new Date(customer.birthdate).toLocaleDateString() : "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Empleo:</span>
                        <span className="text-neutral-800">{customer.employment || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Ingreso Mensual:</span>
                        <span className="text-primary-600 font-semibold">${(customer.income || 0).toLocaleString()}</span>
                      </div>
                      <div className="pt-2 border-t border-neutral-300">
                        <span className="text-neutral-600">Dirección:</span>
                        <p className="text-neutral-800 mt-1">{customer.address || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Loan Status Chart */}
                  {analytics && loanStatusChart && (
                    <div className="bg-white rounded-lg p-6 border border-neutral-200">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4">📊 Estado de Préstamos</h3>
                      <div className="h-64">
                        <Doughnut data={loanStatusChart.data} options={loanStatusChart.options} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg p-6 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">🕒 Actividad Reciente</h3>
                  <div className="space-y-3">
                    {loans.slice(0, 5).map((loan) => (
                      <div key={loan.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-lime-400 rounded-full"></div>
                          <span className="text-neutral-800">Préstamo #{loan.id}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-neutral-600">${parseFloat(loan.amount || 0).toLocaleString()}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            loan.status === 'completed' || loan.status === 'liquidado' ? 'bg-green-900/30 text-primary-500' :
                            loan.status === 'overdue' || loan.status === 'atrasado' ? 'bg-red-900/30 text-neutral-600' :
                            'bg-yellow-900/30 text-yellow-400'
                          }`}>
                            {loan.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Loans Tab */}
            {activeTab === 'loans' && (
              <div className="space-y-6">
                {/* Search and Filter */}
                <div className="bg-white rounded-lg p-6 border border-neutral-200">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="🔍 Buscar por ID o estado..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="bg-gray-700 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                    >
                      <option value="all">Todos los Estados</option>
                      <option value="active">Activos</option>
                      <option value="overdue">Vencidos</option>
                      <option value="completed">Completados</option>
                      <option value="pending">Pendientes</option>
                    </select>
                  </div>
                </div>

                {/* Loans Table */}
                <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-6 py-4 text-left text-neutral-700 font-medium">ID</th>
                          <th className="px-6 py-4 text-right text-neutral-700 font-medium">Monto</th>
                          <th className="px-6 py-4 text-right text-neutral-700 font-medium">Pagado</th>
                          <th className="px-6 py-4 text-right text-neutral-700 font-medium">Balance</th>
                          <th className="px-6 py-4 text-center text-neutral-700 font-medium">Estado</th>
                          <th className="px-6 py-4 text-center text-neutral-700 font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-600">
                        {filteredLoans.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-6 py-8 text-center text-neutral-600">
                              No se encontraron préstamos
                            </td>
                          </tr>
                        ) : (
                          filteredLoans.map((loan) => {
                            const balance = (parseFloat(loan.amount) || 0) - (parseFloat(loan.amount_paid) || 0);
                            return (
                              <tr key={loan.id} className="hover:bg-gray-700/50">
                                <td className="px-6 py-4">
                                  <span className="text-neutral-800 font-medium">#{loan.id}</span>
                                </td>
                                <td className="px-6 py-4 text-right text-neutral-800">
                                  ${parseFloat(loan.amount || 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right text-primary-600">
                                  ${parseFloat(loan.amount_paid || 0).toLocaleString()}
                                </td>
                                <td className={`px-6 py-4 text-right font-medium ${
                                  balance > 0 ? 'text-yellow-400' : 'text-primary-500'
                                }`}>
                                  ${balance.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    loan.status === 'completed' || loan.status === 'liquidado' ? 'bg-green-900/30 text-primary-500 border border-green-500/30' :
                                    loan.status === 'overdue' || loan.status === 'atrasado' ? 'bg-red-900/30 text-neutral-600 border border-red-500/30' :
                                    'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30'
                                  }`}>
                                    {loan.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex justify-center space-x-2">
                                    <Link 
                                      to={`/loans/${loan.id}/details`}
                                      className="bg-blue-600 hover:bg-blue-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors"
                                    >
                                      📊 Detalles
                                    </Link>
                                    <Link 
                                      to={`/loans/${loan.id}/statement`}
                                      className="bg-purple-600 hover:bg-purple-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors"
                                    >
                                      📄 Estado
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
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Identity Documents */}
                  <div className="bg-white rounded-lg p-6 border border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-4">🆔 Documentos de Identidad</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                            📄
                          </div>
                          <div>
                            <p className="text-neutral-800 font-medium">INE / IFE</p>
                            <p className="text-neutral-600 text-sm">Identificación oficial</p>
                          </div>
                        </div>
                        {customer.ine_path ? (
                          <a 
                            href={`${API_BASE_URL}/uploads/${customer.ine_path}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors"
                          >
                            👁️ Ver
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">No disponible</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                            🏠
                          </div>
                          <div>
                            <p className="text-neutral-800 font-medium">Comprobante de Domicilio</p>
                            <p className="text-neutral-600 text-sm">Recibo de servicios</p>
                          </div>
                        </div>
                        {customer.proof_address_path ? (
                          <a 
                            href={`${API_BASE_URL}/uploads/${customer.proof_address_path}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors"
                          >
                            👁️ Ver
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">No disponible</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                            💰
                          </div>
                          <div>
                            <p className="text-neutral-800 font-medium">Comprobante de Ingresos</p>
                            <p className="text-neutral-600 text-sm">Recibo de nómina</p>
                          </div>
                        </div>
                        {customer.proof_income_path ? (
                          <a 
                            href={`${API_BASE_URL}/uploads/${customer.proof_income_path}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors"
                          >
                            👁️ Ver
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">No disponible</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Credit Documents */}
                  <div className="bg-white rounded-lg p-6 border border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-4">💳 Documentos de Crédito</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                            📊
                          </div>
                          <div>
                            <p className="text-neutral-800 font-medium">Buró de Crédito</p>
                            <p className="text-neutral-600 text-sm">Reporte crediticio</p>
                          </div>
                        </div>
                        {customer.bureau_path ? (
                          <a 
                            href={`${API_BASE_URL}/uploads/${customer.bureau_path}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors"
                          >
                            👁️ Ver
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">No disponible</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-yellow-600 rounded-lg flex items-center justify-center">
                            🤳
                          </div>
                          <div>
                            <p className="text-neutral-800 font-medium">Selfie</p>
                            <p className="text-neutral-600 text-sm">Foto del cliente</p>
                          </div>
                        </div>
                        {customer.selfie_path ? (
                          <a 
                            href={`${API_BASE_URL}/uploads/${customer.selfie_path}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors"
                          >
                            👁️ Ver
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">No disponible</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                            🎥
                          </div>
                          <div>
                            <p className="text-neutral-800 font-medium">Video</p>
                            <p className="text-neutral-600 text-sm">Video del cliente</p>
                          </div>
                        </div>
                        {customer.video_path ? (
                          <a 
                            href={`${API_BASE_URL}/uploads/${customer.video_path}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-3 py-1 rounded text-sm transition-colors"
                          >
                            👁️ Ver
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">No disponible</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contacts Tab */}
            {activeTab === 'contacts' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* References */}
                  <div className="bg-white rounded-lg p-6 border border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-4">👥 Referencias</h3>
                    
                    {/* Add Reference Form */}
                    <div className="space-y-3 mb-6">
                      <input
                        className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                        placeholder="Nombre completo"
                        value={newReference.name}
                        onChange={(e) => setNewReference({ ...newReference, name: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                          placeholder="Teléfono"
                          value={newReference.phone}
                          onChange={(e) => setNewReference({ ...newReference, phone: e.target.value })}
                        />
                        <input
                          className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                          placeholder="Relación"
                          value={newReference.relationship}
                          onChange={(e) => setNewReference({ ...newReference, relationship: e.target.value })}
                        />
                      </div>
                      <input
                        className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                        placeholder="CURP (opcional)"
                        value={newReference.curp}
                        onChange={(e) => setNewReference({ ...newReference, curp: e.target.value })}
                      />
                      <button
                        className="w-full bg-lime-600 hover:bg-lime-700 text-neutral-800 font-medium py-2 px-4 rounded-lg transition-colors"
                        onClick={async () => {
                          try {
                            await axios.post(
                              `${API_BASE_URL}/customers/${id}/references`,
                              newReference,
                              { headers: { Authorization: "Bearer " + localStorage.getItem("token") } }
                            );
                            setNewReference({ name: "", phone: "", curp: "", relationship: "" });
                            const refRes = await axios.get(`${API_BASE_URL}/customers/${id}/references`, {
                              headers: { Authorization: "Bearer " + localStorage.getItem("token") },
                            });
                            setReferences(refRes.data);
                          } catch (err) {
                            console.error("Error adding reference:", err);
                          }
                        }}
                      >
                        ➕ Agregar Referencia
                      </button>
                    </div>

                    {/* References List */}
                    <div className="space-y-3">
                      {references.length === 0 ? (
                        <p className="text-neutral-600 text-center py-4">No hay referencias registradas</p>
                      ) : (
                        references.map((ref) => (
                          <div key={ref.id} className="bg-gray-700/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-neutral-800 font-medium">{ref.name}</h4>
                              <span className="text-primary-600 text-sm">{ref.relationship}</span>
                            </div>
                            <p className="text-neutral-600 text-sm">📞 {ref.phone || "N/A"}</p>
                            {ref.curp && <p className="text-neutral-600 text-sm">🆔 {ref.curp}</p>}
                            <p className="text-gray-500 text-xs mt-2">
                              {new Date(ref.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Guarantors (Avales) */}
                  <div className="bg-white rounded-lg p-6 border border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-4">🛡️ Avales</h3>
                    
                    {/* Add Guarantor Form */}
                    <div className="space-y-3 mb-6">
                      <input
                        className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                        placeholder="Nombre completo"
                        value={newAval.name}
                        onChange={(e) => setNewAval({ ...newAval, name: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                          placeholder="Teléfono"
                          value={newAval.phone}
                          onChange={(e) => setNewAval({ ...newAval, phone: e.target.value })}
                        />
                        <input
                          className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                          placeholder="CURP"
                          value={newAval.curp}
                          onChange={(e) => setNewAval({ ...newAval, curp: e.target.value })}
                        />
                      </div>
                      <input
                        className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-lime-400 focus:outline-none"
                        placeholder="Dirección"
                        value={newAval.address}
                        onChange={(e) => setNewAval({ ...newAval, address: e.target.value })}
                      />
                      <button
                        className="w-full bg-lime-600 hover:bg-lime-700 text-neutral-800 font-medium py-2 px-4 rounded-lg transition-colors"
                        onClick={async () => {
                          try {
                            await axios.post(
                              `${API_BASE_URL}/customers/${id}/avals`,
                              newAval,
                              { headers: { Authorization: "Bearer " + localStorage.getItem("token") } }
                            );
                            setNewAval({ name: "", phone: "", curp: "", address: "" });
                            const res2 = await axios.get(`${API_BASE_URL}/customers/${id}/avals`, {
                              headers: { Authorization: "Bearer " + localStorage.getItem("token") },
                            });
                            setAvals(res2.data);
                          } catch (err) {
                            console.error("Error saving aval:", err);
                          }
                        }}
                      >
                        🛡️ Agregar Aval
                      </button>
                    </div>

                    {/* Guarantors List */}
                    <div className="space-y-3">
                      {avals.length === 0 ? (
                        <p className="text-neutral-600 text-center py-4">No hay avales registrados</p>
                      ) : (
                        avals.map((aval) => (
                          <div key={aval.id} className="bg-gray-700/50 rounded-lg p-4">
                            <h4 className="text-neutral-800 font-medium mb-2">{aval.name}</h4>
                            <p className="text-neutral-600 text-sm">📞 {aval.phone || "N/A"}</p>
                            <p className="text-neutral-600 text-sm">🆔 {aval.curp || "N/A"}</p>
                            <p className="text-neutral-600 text-sm">🏠 {aval.address || "N/A"}</p>
                            <div className="flex justify-between items-center mt-2">
                              <p className="text-gray-500 text-xs">
                                {new Date(aval.created_at).toLocaleDateString()}
                              </p>
                              <span className="text-primary-600 text-xs">Préstamo #{aval.loan_id}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg p-6 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">📝 Agregar Nueva Nota</h3>
                  <div className="space-y-4">
                    <textarea
                      className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-3 text-neutral-800 focus:border-lime-400 focus:outline-none resize-none"
                      rows={4}
                      placeholder="Registrar comentarios sobre el cliente, historial de comportamiento, observaciones, etc..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600 text-sm">
                        {note.length}/500 caracteres
                      </span>
                      <button
                        className="bg-lime-600 hover:bg-lime-700 text-neutral-800 font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
                        disabled={!note.trim()}
                        onClick={async () => {
                          try {
                            await axios.post(
                              `${API_BASE_URL}/customers/${id}/notes`,
                              { note },
                              { headers: { Authorization: "Bearer " + localStorage.getItem("token") } }
                            );
                            setNote("");
                            setNoteMessage("✅ Nota guardada");
                            const notesRes = await axios.get(`${API_BASE_URL}/customers/${id}/notes`, {
                              headers: { Authorization: "Bearer " + localStorage.getItem("token") },
                            });
                            setNotes(notesRes.data);
                            setTimeout(() => setNoteMessage(""), 3000);
                          } catch (err) {
                            console.error("Error saving note:", err);
                            setNoteMessage("❌ Error al guardar nota");
                          }
                        }}
                      >
                        💾 Guardar Nota
                      </button>
                    </div>
                    {noteMessage && (
                      <p className={`text-sm ${
                        noteMessage.includes('✅') ? 'text-primary-500' : 'text-neutral-600'
                      }`}>
                        {noteMessage}
                      </p>
                    )}
                  </div>
                </div>

                {/* Notes History */}
                <div className="bg-white rounded-lg p-6 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">📋 Historial de Notas</h3>
                  <div className="space-y-4">
                    {notes.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-4">📝</div>
                        <p className="text-neutral-600">No hay notas registradas aún</p>
                        <p className="text-gray-500 text-sm">Las notas aparecerán aquí cuando se agreguen</p>
                      </div>
                    ) : (
                      notes.map((n) => (
                        <div key={n.id} className="bg-gray-700/50 rounded-lg p-4 border-l-4 border-lime-500">
                          <p className="text-neutral-800 mb-2">{n.note}</p>
                          <p className="text-neutral-600 text-sm">
                            📅 {new Date(n.created_at).toLocaleDateString()} a las {new Date(n.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && analytics && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Payment Trend Chart */}
                  {paymentTrendChart && (
                    <div className="bg-white rounded-lg p-6 border border-neutral-200">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4">📈 Tendencia de Pagos</h3>
                      <div className="h-64">
                        <Line data={paymentTrendChart.data} options={paymentTrendChart.options} />
                      </div>
                    </div>
                  )}

                  {/* Credit Score */}
                  <div className="bg-white rounded-lg p-6 border border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-4">🎯 Calificación Crediticia</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">Nivel de Riesgo:</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          analytics.riskLevel === 'Alto' ? 'bg-red-900/30 text-neutral-600 border border-red-500/30' :
                          analytics.riskLevel === 'Medio' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' :
                          'bg-green-900/30 text-primary-500 border border-green-500/30'
                        }`}>
                          {analytics.riskLevel}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Préstamos Activos:</span>
                          <span className="text-yellow-400 font-semibold">{analytics.activeCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Préstamos Vencidos:</span>
                          <span className="text-neutral-600 font-semibold">{analytics.overdueCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Préstamos Completados:</span>
                          <span className="text-primary-500 font-semibold">{analytics.completedCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Pagos Puntuales:</span>
                          <span className="text-primary-600 font-semibold">
                            {analytics.totalPayments > 0 ? 
                              `${((analytics.onTimePayments / analytics.totalPayments) * 100).toFixed(1)}%` :
                              '0%'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-white rounded-lg p-6 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">💰 Resumen Financiero</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary-600">
                        ${analytics.totalLoaned.toLocaleString()}
                      </div>
                      <div className="text-neutral-600 text-sm">Total Prestado</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary-500">
                        ${analytics.totalPaid.toLocaleString()}
                      </div>
                      <div className="text-neutral-600 text-sm">Total Pagado</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${
                        analytics.currentBalance > 0 ? 'text-yellow-400' : 'text-primary-500'
                      }`}>
                        ${analytics.currentBalance.toLocaleString()}
                      </div>
                      <div className="text-neutral-600 text-sm">Balance Pendiente</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-400">
                        ${analytics.avgLoanAmount.toLocaleString()}
                      </div>
                      <div className="text-neutral-600 text-sm">Promedio por Préstamo</div>
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

export default CustomerProfile;