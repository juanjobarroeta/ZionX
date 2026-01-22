import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const IncomeDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [revenueByMonth, setRevenueByMonth] = useState([]);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [dashboardRes, revenueRes, invoicesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/income/dashboard`, { headers }),
        axios.get(`${API_BASE_URL}/api/income/revenue/summary`, { headers }),
        axios.get(`${API_BASE_URL}/api/income/invoices/pending`, { headers })
      ]);

      setDashboardData(dashboardRes.data);
      setRevenueByMonth(revenueRes.data.slice(0, 6)); // Last 6 months
      setPendingInvoices(invoicesRes.data.slice(0, 5)); // Top 5 pending
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zionx-highlight"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-black">💰 Gestión de Ingresos</h1>
                <p className="text-gray-500 text-sm mt-1">Facturación, suscripciones y análisis de ingresos</p>
              </div>
              <div className="flex space-x-3">
                <Link
                  to="/income/invoice-generator"
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  ➕ Nueva Factura
                </Link>
                <button 
                  onClick={fetchDashboardData}
                  className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  🔄 Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Link
              to="/income/subscriptions"
              className="bg-white border border-zionx-secondary rounded-xl p-6 hover:shadow-lg transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-2">📋</span>
                <span className="font-bold text-zionx-primary">Suscripciones</span>
              </div>
            </Link>

            <Link
              to="/income/invoices"
              className="bg-white border border-zionx-secondary rounded-xl p-6 hover:shadow-lg transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-2">📄</span>
                <span className="font-bold text-zionx-primary">Facturas</span>
              </div>
            </Link>

            <Link
              to="/income/addons"
              className="bg-white border border-zionx-secondary rounded-xl p-6 hover:shadow-lg transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-2">➕</span>
                <span className="font-bold text-zionx-primary">Add-ons</span>
              </div>
            </Link>

            <Link
              to="/income/reports"
              className="bg-white border border-zionx-secondary rounded-xl p-6 hover:shadow-lg transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-2">📊</span>
                <span className="font-bold text-zionx-primary">Reportes</span>
              </div>
            </Link>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* MRR */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">MRR (Ingresos Mensuales)</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(dashboardData?.mrr || 0)}</p>
                  <p className="text-xs text-green-100 mt-2">ARR: {formatCurrency((dashboardData?.mrr || 0) * 12)}</p>
                </div>
                <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">💰</span>
                </div>
              </div>
            </div>

            {/* This Month Revenue */}
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Ingresos Este Mes</p>
                  <p className="text-3xl font-bold text-zionx-primary">{formatCurrency(dashboardData?.revenue_this_month || 0)}</p>
                  <p className={`text-xs mt-2 ${dashboardData?.month_over_month_growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardData?.month_over_month_growth >= 0 ? '↗' : '↘'} {Math.abs(dashboardData?.month_over_month_growth || 0).toFixed(1)}% vs mes anterior
                  </p>
                </div>
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📈</span>
                </div>
              </div>
            </div>

            {/* Outstanding */}
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Por Cobrar</p>
                  <p className="text-3xl font-bold text-orange-600">{formatCurrency(dashboardData?.total_outstanding || 0)}</p>
                  <p className="text-xs text-gray-500 mt-2">{dashboardData?.invoices_this_month || 0} facturas pendientes</p>
                </div>
                <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⏳</span>
                </div>
              </div>
            </div>

            {/* Overdue */}
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Vencido</p>
                  <p className="text-3xl font-bold text-red-600">{formatCurrency(dashboardData?.overdue_amount || 0)}</p>
                  <p className="text-xs text-red-500 mt-2">{dashboardData?.overdue_count || 0} facturas vencidas</p>
                </div>
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subscription Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📦</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Suscripciones Activas</p>
                  <p className="text-2xl font-bold text-zionx-primary">{dashboardData?.active_subscriptions || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">💵</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ARPU (Promedio por Cliente)</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency((dashboardData?.mrr || 0) / (dashboardData?.active_subscriptions || 1))}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ARR (Ingresos Anuales)</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(dashboardData?.annual_run_rate || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Chart & Pending Invoices */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Revenue by Month */}
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <h2 className="text-lg font-semibold text-zionx-primary mb-4">📊 Ingresos por Mes</h2>
              
              {revenueByMonth.length > 0 ? (
                <div className="space-y-3">
                  {revenueByMonth.map((monthData, index) => {
                    const maxRevenue = Math.max(...revenueByMonth.map(m => parseFloat(m.total_paid || 0)));
                    const percentage = (parseFloat(monthData.total_paid || 0) / maxRevenue) * 100;
                    
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{formatMonth(monthData.month)}</span>
                          <span className="font-semibold text-zionx-primary">
                            {formatCurrency(monthData.total_paid || 0)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{monthData.invoice_count} facturas</span>
                          <span>IVA: {formatCurrency(monthData.tax || 0)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No hay datos de ingresos aún</p>
              )}
              
              <Link 
                to="/income/reports"
                className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-800"
              >
                Ver todos los reportes →
              </Link>
            </div>

            {/* Pending Invoices */}
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-zionx-primary">📄 Facturas Pendientes</h2>
                <Link 
                  to="/income/invoices"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Ver todas →
                </Link>
              </div>
              
              {pendingInvoices.length > 0 ? (
                <div className="space-y-3">
                  {pendingInvoices.map((invoice) => {
                    const isOverdue = invoice.current_status === 'overdue';
                    
                    return (
                      <div 
                        key={invoice.id}
                        className={`p-4 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-zionx-primary">{invoice.customer_name}</p>
                            <p className="text-xs text-gray-500">{invoice.invoice_number}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            isOverdue ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'
                          }`}>
                            {isOverdue ? '⚠️ Vencido' : 'Pendiente'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="text-sm">
                            <span className="text-gray-500">Por cobrar:</span>
                            <span className="font-bold text-zionx-primary ml-2">
                              {formatCurrency(invoice.amount_due)}
                            </span>
                          </div>
                          <Link
                            to={`/income/invoices/${invoice.id}`}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Ver detalle →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-2">🎉 ¡Excelente!</p>
                  <p className="text-sm text-gray-400">No hay facturas pendientes</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* IVA Summary */}
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">🇲🇽 IVA Este Mes</h3>
              {revenueByMonth.length > 0 && (
                <>
                  <p className="text-2xl font-bold text-zionx-primary mb-2">
                    {formatCurrency(revenueByMonth[0]?.tax || 0)}
                  </p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(revenueByMonth[0]?.subtotal || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IVA (16%):</span>
                      <span className="font-semibold">{formatCurrency(revenueByMonth[0]?.tax || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span>Total:</span>
                      <span className="font-bold">{formatCurrency(revenueByMonth[0]?.total_billed || 0)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">📈 Crecimiento</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Mes actual</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(dashboardData?.revenue_this_month || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Mes anterior</p>
                  <p className="text-lg font-bold text-gray-600">
                    {formatCurrency(dashboardData?.revenue_last_month || 0)}
                  </p>
                </div>
                <div className={`text-sm font-semibold ${dashboardData?.month_over_month_growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {dashboardData?.month_over_month_growth >= 0 ? '↗' : '↘'} {Math.abs(dashboardData?.month_over_month_growth || 0).toFixed(1)}% cambio
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
              <h3 className="text-sm font-semibold text-purple-100 mb-3">⚡ Acciones Rápidas</h3>
              <div className="space-y-2">
                <Link
                  to="/income/subscriptions/new"
                  className="block bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-3 py-2 text-sm transition-all"
                >
                  ➕ Nueva Suscripción
                </Link>
                <Link
                  to="/income/invoice-generator"
                  className="block bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-3 py-2 text-sm transition-all"
                >
                  📄 Generar Factura
                </Link>
                <Link
                  to="/income/addons"
                  className="block bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-3 py-2 text-sm transition-all"
                >
                  🛒 Comprar Add-ons
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default IncomeDashboard;




