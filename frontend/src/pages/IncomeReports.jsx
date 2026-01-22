import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const IncomeReports = () => {
  const [loading, setLoading] = useState(true);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [addonPerformance, setAddonPerformance] = useState([]);
  const [mrrData, setMrrData] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [revenueRes, customersRes, addonsRes, mrrRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/income/revenue/summary`, { headers }),
        axios.get(`${API_BASE_URL}/api/income/revenue/by-customer?limit=10`, { headers }),
        axios.get(`${API_BASE_URL}/api/income/revenue/addon-performance`, { headers }),
        axios.get(`${API_BASE_URL}/api/income/revenue/mrr`, { headers })
      ]);

      setMonthlyRevenue(revenueRes.data);
      setTopCustomers(customersRes.data);
      setAddonPerformance(addonsRes.data);
      setMrrData(mrrRes.data);
    } catch (error) {
      console.error("Error fetching reports:", error);
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
    return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
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
                <h1 className="text-2xl font-semibold text-black">📊 Reportes de Ingresos</h1>
                <p className="text-gray-500 text-sm mt-1">Análisis y métricas de ingresos</p>
              </div>
              <div className="flex space-x-3">
                <Link
                  to="/income"
                  className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Volver
                </Link>
                <button
                  onClick={fetchReports}
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  🔄 Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          {/* MRR Stats */}
          {mrrData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                <p className="text-green-100 text-sm mb-1">MRR (Ingresos Mensuales Recurrentes)</p>
                <p className="text-3xl font-bold">{formatCurrency(mrrData.mrr)}</p>
                <p className="text-green-100 text-xs mt-2">ARR: {formatCurrency(mrrData.mrr * 12)}</p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                <p className="text-gray-500 text-sm mb-1">Suscripciones Activas</p>
                <p className="text-3xl font-bold text-zionx-primary">{mrrData.active_subscriptions}</p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                <p className="text-gray-500 text-sm mb-1">ARPU (Promedio por Cliente)</p>
                <p className="text-3xl font-bold text-blue-600">{formatCurrency(mrrData.arpu)}</p>
              </div>
            </div>
          )}

          {/* Monthly Revenue Table */}
          <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-zionx-primary">📈 Ingresos por Mes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facturas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IVA (16%)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Facturado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cobrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {monthlyRevenue.map((month) => (
                    <tr key={month.month} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium capitalize">{formatMonth(month.month)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{month.invoice_count}</td>
                      <td className="px-6 py-4 font-semibold">{formatCurrency(month.subtotal)}</td>
                      <td className="px-6 py-4 text-sm text-blue-600">{formatCurrency(month.tax)}</td>
                      <td className="px-6 py-4 font-semibold text-zionx-primary">{formatCurrency(month.total_billed)}</td>
                      <td className="px-6 py-4 font-semibold text-green-600">{formatCurrency(month.total_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Customers */}
            <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-zionx-primary">👥 Top 10 Clientes</h2>
              </div>
              <div className="p-6 space-y-3">
                {topCustomers.map((customer, index) => (
                  <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-zionx-primary">{customer.customer_name}</p>
                        <p className="text-xs text-gray-500">{customer.invoice_count} facturas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(customer.total_paid)}</p>
                      {parseFloat(customer.outstanding) > 0 && (
                        <p className="text-xs text-orange-600">Pendiente: {formatCurrency(customer.outstanding)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add-on Performance */}
            <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-zionx-primary">⭐ Add-ons Más Vendidos</h2>
              </div>
              <div className="p-6 space-y-3">
                {addonPerformance.slice(0, 10).map((addon, index) => (
                  <div key={addon.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-zionx-primary">{addon.addon_name}</p>
                        <p className="text-xs text-gray-500 capitalize">{addon.category} • {addon.times_purchased} ventas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{formatCurrency(addon.total_revenue)}</p>
                      <p className="text-xs text-gray-500">Cant: {addon.total_quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default IncomeReports;




