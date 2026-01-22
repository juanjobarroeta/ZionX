import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const FinancialStatements = () => {
  const [summary, setSummary] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [summaryRes, plRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/hr/financial/summary`, { headers }),
        axios.get(`${API_BASE_URL}/api/hr/financial/profit-loss`, { 
          headers, 
          params: { year: selectedYear } 
        })
      ]);

      setSummary(summaryRes.data);
      setProfitLoss(plRes.data);
    } catch (error) {
      console.error("Error fetching financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatPercent = (value) => {
    return `${parseFloat(value || 0).toFixed(1)}%`;
  };

  const getMonthName = (monthStr) => {
    if (!monthStr) return '';
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
                <h1 className="text-2xl font-semibold text-black">📊 Estados Financieros</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Profit & Loss, Balance General, Flujo de Efectivo
                </p>
              </div>
              <div className="flex space-x-3 items-center">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2"
                >
                  {[2024, 2025, 2026, 2027].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <Link to="/hr/employees" className="bg-white border border-zionx-secondary px-4 py-2 rounded-lg hover:bg-gray-50">
                  👥 Empleados
                </Link>
                <Link to="/hr/payroll" className="bg-white border border-zionx-secondary px-4 py-2 rounded-lg hover:bg-gray-50">
                  💰 Nómina
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* KPI Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* MTD Card */}
              <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                  <h3 className="text-white font-semibold">📅 Mes Actual ({getMonthName(summary.current_month)})</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Ingresos</span>
                      <span className="font-bold text-green-600">{formatCurrency(summary.mtd.revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">(-) Costo Laboral</span>
                      <span className="font-medium text-red-500">{formatCurrency(summary.mtd.labor_cost)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">(-) Gastos Operativos</span>
                      <span className="font-medium text-red-500">{formatCurrency(summary.mtd.operating_expenses)}</span>
                    </div>
                    <div className="border-t pt-4 flex justify-between items-center">
                      <span className="font-semibold">Utilidad Neta</span>
                      <span className={`text-xl font-bold ${summary.mtd.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(summary.mtd.net_income)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Margen de Utilidad</span>
                      <span className={`font-medium ${parseFloat(summary.mtd.profit_margin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(summary.mtd.profit_margin)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* YTD Card */}
              <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                  <h3 className="text-white font-semibold">📆 Año {selectedYear} (YTD)</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Ingresos</span>
                      <span className="font-bold text-green-600">{formatCurrency(summary.ytd.revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">(-) Costo Laboral</span>
                      <span className="font-medium text-red-500">{formatCurrency(summary.ytd.labor_cost)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">(-) Gastos Operativos</span>
                      <span className="font-medium text-red-500">{formatCurrency(summary.ytd.operating_expenses)}</span>
                    </div>
                    <div className="border-t pt-4 flex justify-between items-center">
                      <span className="font-semibold">Utilidad Neta</span>
                      <span className={`text-xl font-bold ${summary.ytd.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(summary.ytd.net_income)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Margen de Utilidad</span>
                      <span className={`font-medium ${parseFloat(summary.ytd.profit_margin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(summary.ytd.profit_margin)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Profit & Loss Table */}
          <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden mb-8">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zionx-primary">📈 Estado de Resultados (P&L)</h2>
              <span className="text-sm text-gray-500">Año {selectedYear}</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mes</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Laboral</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gastos Op.</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilidad</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {profitLoss?.summary?.length > 0 ? (
                    profitLoss.summary.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{getMonthName(row.month)}</td>
                        <td className="px-6 py-4 text-right text-green-600">{formatCurrency(row.revenue_total)}</td>
                        <td className="px-6 py-4 text-right text-red-500">{formatCurrency(row.labor_cost)}</td>
                        <td className="px-6 py-4 text-right text-red-500">{formatCurrency(row.operating_expenses)}</td>
                        <td className={`px-6 py-4 text-right font-semibold ${parseFloat(row.net_income) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(row.net_income)}
                        </td>
                        <td className={`px-6 py-4 text-right ${parseFloat(row.profit_margin_pct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(row.profit_margin_pct)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        <span className="text-4xl block mb-2">📊</span>
                        No hay datos financieros para {selectedYear}
                      </td>
                    </tr>
                  )}
                </tbody>
                {profitLoss?.summary?.length > 0 && (
                  <tfoot className="bg-gray-100">
                    <tr className="font-bold">
                      <td className="px-6 py-4">TOTAL {selectedYear}</td>
                      <td className="px-6 py-4 text-right text-green-700">
                        {formatCurrency(profitLoss.summary.reduce((sum, r) => sum + parseFloat(r.revenue_total || 0), 0))}
                      </td>
                      <td className="px-6 py-4 text-right text-red-700">
                        {formatCurrency(profitLoss.summary.reduce((sum, r) => sum + parseFloat(r.labor_cost || 0), 0))}
                      </td>
                      <td className="px-6 py-4 text-right text-red-700">
                        {formatCurrency(profitLoss.summary.reduce((sum, r) => sum + parseFloat(r.operating_expenses || 0), 0))}
                      </td>
                      <td className="px-6 py-4 text-right text-green-700">
                        {formatCurrency(profitLoss.summary.reduce((sum, r) => sum + parseFloat(r.net_income || 0), 0))}
                      </td>
                      <td className="px-6 py-4 text-right">-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Labor Costs Breakdown */}
            <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-semibold text-zionx-primary">💼 Desglose Costo Laboral</h2>
              </div>
              <div className="p-6">
                {profitLoss?.labor_costs?.length > 0 ? (
                  <div className="space-y-3">
                    {profitLoss.labor_costs.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-gray-600">{getMonthName(item.month)}</span>
                        <div className="text-right">
                          <span className="font-medium">{formatCurrency(item.total_net)}</span>
                          <span className="text-xs text-gray-500 ml-2">({item.employee_count} emp)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Sin datos de nómina</p>
                )}
              </div>
            </div>

            {/* Operating Expenses Breakdown */}
            <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="font-semibold text-zionx-primary">🏢 Gastos Operativos</h2>
                <Link to="/hr/expenses" className="text-sm text-blue-600 hover:text-blue-800">
                  Ver todos →
                </Link>
              </div>
              <div className="p-6">
                {profitLoss?.operating_expenses?.length > 0 ? (
                  <div className="space-y-3">
                    {profitLoss.operating_expenses.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-gray-600">{item.category || 'Sin categoría'}</span>
                        <span className="font-medium">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Sin gastos registrados</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {summary && (
            <div className="mt-8 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 text-white">
              <h3 className="text-lg font-semibold mb-4">📌 Resumen Rápido</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-gray-400 text-sm">Empleados Activos</p>
                  <p className="text-2xl font-bold">{summary.employee_count}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Ingresos YTD</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(summary.ytd.revenue)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Costos Totales YTD</p>
                  <p className="text-2xl font-bold text-red-400">
                    {formatCurrency(summary.ytd.labor_cost + summary.ytd.operating_expenses)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Utilidad YTD</p>
                  <p className={`text-2xl font-bold ${summary.ytd.net_income >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(summary.ytd.net_income)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default FinancialStatements;


