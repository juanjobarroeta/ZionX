import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { useSearchParams } from "react-router-dom";
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

const BalanceSheet = () => {
  const [searchParams] = useSearchParams();
  const month = searchParams.get("month") || new Date().getMonth() + 1;
  const year = searchParams.get("year") || new Date().getFullYear();
  const [entries, setEntries] = useState({ categories: [], weeks: [] });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [provisionalNetIncome, setProvisionalNetIncome] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("ytd");
  const [exportLoading, setExportLoading] = useState(false);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2
    }).format(value);
  };

  const convertToCategoryFormat = (weeks) => {
    if (!weeks.length) return [];

    const categories = [];
    const sections = ["ACTIVO", "PASIVO", "CAPITAL"];

    for (const section of sections) {
      const sectionData = {
        name: section,
        accounts: []
      };

      const labelSet = new Set();
      weeks.forEach(week => {
        week[section]?.accounts?.forEach(account => {
          labelSet.add(account.label);
        });
      });

      for (const label of labelSet) {
        const account = {
          label,
          weeklyAmounts: {},
          total: 0
        };

        weeks.forEach((week, i) => {
          const key = `week${i}`;
          const found = week[section]?.accounts?.find(acc => acc.label === label);
          const value = found ? found.value : 0;
          account.weeklyAmounts[key] = value;
          account.total += value;
        });

        sectionData.accounts.push(account);
      }

      categories.push(sectionData);
    }

    return categories;
  };

  useEffect(() => {
    const today = new Date();
    const defaultStart = "2000-01-01";
    const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/accounting/balance-sheet?start=${startDate}&end=${endDate}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      console.log("📊 Balance sheet response:", res.data);

      // Handle the new balance sheet data structure
      const balanceSheetData = res.data;
      
      // Transform the data to match the expected format
      const categories = [];
      
      // Process each section (ACTIVO, PASIVO, CAPITAL)
      Object.keys(balanceSheetData.balanceSheet).forEach(sectionName => {
        const section = balanceSheetData.balanceSheet[sectionName];
        const accounts = section.accounts.map(account => ({
          label: account.label,
          weeklyAmounts: { week0: account.value },
          total: account.value
        }));
        
        // Sort accounts for ACTIVO section
        if (sectionName === "ACTIVO") {
          const priority = ["Fondo Fijo de Caja", "Cuenta Bancaria"];
          accounts.sort((a, b) => {
            const aIdx = priority.indexOf(a.label);
            const bIdx = priority.indexOf(b.label);
            if (aIdx === -1 && bIdx === -1) return 0;
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
          });
        }
        
        categories.push({
          name: sectionName,
          accounts
        });
      });

      setEntries({
        weeks: [{ label: "Actual", key: "week0" }],
        categories
      });

      // Calculate provisional net income from the balance sheet control
      const control = balanceSheetData.totals?.control || 0;
      setProvisionalNetIncome(control);
      
    } catch (err) {
      console.error("Error fetching balance sheet:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadData();
    }
  }, [startDate, endDate]);

  // Memoized calculations
  const calculations = useMemo(() => {
    if (!entries.categories) return null;

    const sectionTotals = {
      ACTIVO: 0,
      PASIVO: 0,
      CAPITAL: 0
    };

    entries.categories.forEach(category => {
      if (sectionTotals.hasOwnProperty(category.name)) {
        sectionTotals[category.name] = category.accounts.reduce((sum, acc) => sum + Math.abs(acc.total), 0);
      }
    });

    sectionTotals.CAPITAL += provisionalNetIncome;
    const control = sectionTotals.ACTIVO - Math.abs(sectionTotals.PASIVO + sectionTotals.CAPITAL);

    return {
      sectionTotals,
      control,
      totalAssets: sectionTotals.ACTIVO,
      totalLiabilities: Math.abs(sectionTotals.PASIVO),
      totalCapital: Math.abs(sectionTotals.CAPITAL),
      isBalanced: control === 0
    };
  }, [entries.categories, provisionalNetIncome]);

  // Chart data
  const chartData = useMemo(() => {
    if (!calculations) return null;

    return {
      composition: {
        labels: ['Activos', 'Pasivos', 'Capital'],
        datasets: [{
          data: [calculations.totalAssets, calculations.totalLiabilities, calculations.totalCapital],
          backgroundColor: ['#10B981', '#EF4444', '#3B82F6'],
          borderWidth: 0,
        }]
      },
      assets: {
        labels: entries.categories?.find(cat => cat.name === "ACTIVO")?.accounts.map(acc => acc.label) || [],
        datasets: [{
          data: entries.categories?.find(cat => cat.name === "ACTIVO")?.accounts.map(acc => acc.total) || [],
          backgroundColor: ['#10B981', '#059669', '#047857', '#065f46', '#064e3b'],
          borderWidth: 0,
        }]
      },
      liabilities: {
        labels: entries.categories?.find(cat => cat.name === "PASIVO")?.accounts.map(acc => acc.label) || [],
        datasets: [{
          data: entries.categories?.find(cat => cat.name === "PASIVO")?.accounts.map(acc => acc.total) || [],
          backgroundColor: ['#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D'],
          borderWidth: 0,
        }]
      }
    };
  }, [calculations, entries.categories]);

  const handleQuickDateRange = (range) => {
    const today = new Date();
    let newStartDate, newEndDate;

    switch (range) {
      case "ytd":
        newStartDate = `${today.getFullYear()}-01-01`;
        newEndDate = today.toISOString().slice(0, 10);
        break;
      case "month":
        newStartDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        newEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
        break;
      case "quarter":
        const quarter = Math.floor(today.getMonth() / 3) + 1;
        const quarterStartMonth = (quarter - 1) * 3;
        newStartDate = `${today.getFullYear()}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`;
        newEndDate = new Date(today.getFullYear(), quarterStartMonth + 3, 0).toISOString().slice(0, 10);
        break;
      case "year":
        newStartDate = `${today.getFullYear()}-01-01`;
        newEndDate = `${today.getFullYear()}-12-31`;
        break;
      default:
        return;
    }

    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setTimeRange(range);
  };

  const handleExportPDF = async () => {
    try {
      setExportLoading(true);
      const response = await axios.get(`${API_BASE_URL}/accounting/balance-sheet/export-pdf?start=${startDate}&end=${endDate}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `balance-sheet-${startDate}-${endDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error exporting PDF:", err);
      alert("Error al exportar PDF");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const response = await axios.get(`${API_BASE_URL}/accounting/balance-sheet/export-excel?start=${startDate}&end=${endDate}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `balance-sheet-${startDate}-${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error exporting Excel:", err);
      alert("Error al exportar Excel");
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
              <p className="text-neutral-600 text-lg">Cargando balance general...</p>
            </div>
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
              <h1 className="text-3xl font-bold text-neutral-800 mb-2">📊 Balance General</h1>
              <p className="text-neutral-600">Estado financiero completo de activos, pasivos y capital</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={timeRange}
                onChange={(e) => handleQuickDateRange(e.target.value)}
                className="bg-white text-neutral-800 border border-neutral-300 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none"
              >
                <option value="ytd">YTD</option>
                <option value="month">Este Mes</option>
                <option value="quarter">Este Trimestre</option>
                <option value="year">Este Año</option>
              </select>
            </div>
          </div>

          {/* Quick Stats Cards */}
          {calculations && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-xl text-neutral-800">
                <div className="text-2xl font-bold">${calculations.totalAssets.toLocaleString()}</div>
                <div className="text-sm opacity-90">Total Activos</div>
              </div>
              <div className="bg-gradient-to-r from-red-500 to-pink-600 p-6 rounded-xl text-neutral-800">
                <div className="text-2xl font-bold">${calculations.totalLiabilities.toLocaleString()}</div>
                <div className="text-sm opacity-90">Total Pasivos</div>
              </div>
              <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-6 rounded-xl text-neutral-800">
                <div className="text-2xl font-bold">${calculations.totalCapital.toLocaleString()}</div>
                <div className="text-sm opacity-90">Total Capital</div>
              </div>
              <div className={`p-6 rounded-xl text-neutral-800 ${
                calculations.isBalanced 
                  ? "bg-gradient-to-r from-primary-500 to-primary-600" 
                  : "bg-gradient-to-r from-red-500 to-pink-600"
              }`}>
                <div className="text-2xl font-bold">${calculations.control.toLocaleString()}</div>
                <div className="text-sm opacity-90">Diferencia</div>
              </div>
            </div>
          )}

          {/* Date Range Selection */}
          <div className="bg-white rounded-lg p-6 border border-neutral-200 mb-8">
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <div>
                <label className="block text-neutral-800 text-sm mb-2">Fecha Inicio</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="p-3 bg-gray-700 border border-neutral-300 text-neutral-800 rounded-lg focus:border-primary-500 focus:outline-none" 
                />
              </div>
              <div>
                <label className="block text-neutral-800 text-sm mb-2">Fecha Fin</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="p-3 bg-gray-700 border border-neutral-300 text-neutral-800 rounded-lg focus:border-primary-500 focus:outline-none" 
                />
              </div>
              <button 
                onClick={loadData} 
                className="bg-primary-500 hover:bg-emerald-500 text-neutral-800 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🔄 Actualizar
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => handleQuickDateRange("ytd")}
                className="bg-blue-600 hover:bg-blue-700 text-neutral-800 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                📊 YTD
              </button>
              <button 
                onClick={() => handleQuickDateRange("month")}
                className="bg-orange-600 hover:bg-orange-700 text-neutral-800 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                📅 Este Mes
              </button>
              <button 
                onClick={() => handleQuickDateRange("quarter")}
                className="bg-purple-600 hover:bg-purple-700 text-neutral-800 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                📊 Este Trimestre
              </button>
              <button 
                onClick={() => handleQuickDateRange("year")}
                className="bg-green-600 hover:bg-green-700 text-neutral-800 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                📅 Este Año
              </button>
            </div>

            {/* Period Label */}
            <div className="mt-4">
              <span className="text-primary-500 font-semibold text-lg">📅 Período: {startDate} - {endDate}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-white p-1 rounded-lg">
          {[
            { id: "overview", label: "📊 Resumen", icon: "📊" },
            { id: "details", label: "📋 Detalles", icon: "📋" },
            { id: "charts", label: "📊 Gráficos", icon: "📊" },
            { id: "analysis", label: "📈 Análisis", icon: "📈" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
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
        {activeTab === "overview" && calculations && (
          <div className="space-y-6">
            {/* Balance Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">💰 Composición del Balance</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-neutral-600">Activos</span>
                      <span className="text-primary-500 font-semibold">
                        {((calculations.totalAssets / (calculations.totalAssets + calculations.totalLiabilities + calculations.totalCapital)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(calculations.totalAssets / (calculations.totalAssets + calculations.totalLiabilities + calculations.totalCapital)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-neutral-600">Pasivos</span>
                      <span className="text-neutral-600 font-semibold">
                        {((calculations.totalLiabilities / (calculations.totalAssets + calculations.totalLiabilities + calculations.totalCapital)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${(calculations.totalLiabilities / (calculations.totalAssets + calculations.totalLiabilities + calculations.totalCapital)) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-neutral-600">Capital</span>
                      <span className="text-primary-500 font-semibold">
                        {((calculations.totalCapital / (calculations.totalAssets + calculations.totalLiabilities + calculations.totalCapital)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(calculations.totalCapital / (calculations.totalAssets + calculations.totalLiabilities + calculations.totalCapital)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">⚖️ Ecuación Contable</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Activos</span>
                    <span className="text-primary-500 font-semibold">${calculations.totalAssets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">= Pasivos</span>
                    <span className="text-neutral-600 font-semibold">${calculations.totalLiabilities.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">+ Capital</span>
                    <span className="text-primary-500 font-semibold">${calculations.totalCapital.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-neutral-300 pt-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span className="text-neutral-800">Diferencia</span>
                      <span className={`${calculations.isBalanced ? "text-primary-500" : "text-neutral-600"}`}>
                        ${calculations.control.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Export Actions */}
            <div className="bg-white rounded-lg p-6 border border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">📤 Exportar</h3>
              <div className="flex gap-4">
                <button
                  onClick={handleExportPDF}
                  disabled={exportLoading}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-neutral-800 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  {exportLoading ? "⏳ Generando..." : "📄 Exportar PDF"}
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={exportLoading}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-neutral-800 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  {exportLoading ? "⏳ Generando..." : "📊 Exportar Excel"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "details" && entries.categories && (
          <div className="space-y-6">
            {/* Balance Sheet Table */}
            <div className="bg-white rounded-lg p-6 border border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">📋 Balance General Detallado</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-neutral-800">
                  <thead>
                    <tr className="border-b border-neutral-300">
                      <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Cuenta</th>
                      {entries.weeks?.map((week, i) => (
                        <th key={i} className="text-center py-3 px-4 text-neutral-600 font-semibold">{week.label}</th>
                      ))}
                      <th className="text-center py-3 px-4 text-neutral-600 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.categories
                      ?.filter(category =>
                        category.name === "ACTIVO" ||
                        category.name === "PASIVO" ||
                        category.name === "CAPITAL"
                      )
                      .map((category, cidx) => (
                        <React.Fragment key={cidx}>
                          <tr>
                            <td colSpan={Math.max(entries.weeks.length + 2, 2)} className="pt-4 pb-2 text-lg text-primary-500 font-bold">
                              {category.name}
                            </td>
                          </tr>
                          {category.accounts.map((row, aidx) => (
                            <tr key={aidx} className="border-b border-neutral-200">
                              <td className="py-3 px-4">{row.label}</td>
                              {entries.weeks.map((week, widx) => {
                                const val = row.weeklyAmounts?.[week.key] ?? 0;
                                return (
                                  <td key={widx} className="py-3 px-4 text-center">
                                    {formatCurrency(val)}
                                  </td>
                                );
                              })}
                              <td className="py-3 px-4 text-center font-bold">
                                {formatCurrency(row.total)}
                              </td>
                            </tr>
                          ))}
                          {category.name === "CAPITAL" && (
                            <tr className="border-b border-neutral-200">
                              <td className="py-3 px-4 italic text-yellow-400">Resultado Provisional (no cerrado)</td>
                              <td colSpan={entries.weeks.length} className="py-3 px-4 text-center italic text-yellow-400">
                                {formatCurrency(provisionalNetIncome)}
                              </td>
                              <td className="py-3 px-4 text-center font-bold italic text-yellow-400">
                                {formatCurrency(provisionalNetIncome)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    {calculations && (
                      <>
                        <tr className="bg-gray-700 border-t-2 border-gray-500">
                          <td className="py-3 px-4 font-bold text-primary-500">Total Activos</td>
                          <td colSpan={entries.weeks.length + 1} className="py-3 px-4 text-center text-primary-500 font-bold">
                            {formatCurrency(calculations.totalAssets)}
                          </td>
                        </tr>
                        <tr className="bg-gray-700">
                          <td className="py-3 px-4 font-bold text-neutral-600">Total Pasivos + Capital</td>
                          <td colSpan={entries.weeks.length + 1} className="py-3 px-4 text-center text-neutral-600 font-bold">
                            {formatCurrency(Math.abs(calculations.totalLiabilities + calculations.totalCapital))}
                          </td>
                        </tr>
                        <tr className={`bg-gray-700 ${calculations.isBalanced ? "text-primary-500" : "text-neutral-600"}`}>
                          <td className="py-3 px-4 font-bold">Control (Diferencia)</td>
                          <td colSpan={entries.weeks.length + 1} className="py-3 px-4 text-center font-bold">
                            {formatCurrency(calculations.control)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "charts" && chartData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Balance Composition */}
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">💰 Composición del Balance</h3>
                <div className="h-64">
                  <Doughnut 
                    data={chartData.composition}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            color: '#ffffff'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Assets Breakdown */}
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">💎 Composición de Activos</h3>
                <div className="h-64">
                  <Doughnut 
                    data={chartData.assets}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            color: '#ffffff'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Liabilities Chart */}
            {chartData.liabilities.labels.length > 0 && (
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">💸 Composición de Pasivos</h3>
                <div className="h-64">
                  <Doughnut 
                    data={chartData.liabilities}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            color: '#ffffff'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "analysis" && calculations && (
          <div className="space-y-6">
            {/* Financial Ratios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">📊 Ratios Financieros</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-neutral-600">Ratio de Liquidez</span>
                      <span className="text-primary-500 font-semibold">
                        {(calculations.totalAssets / Math.max(calculations.totalLiabilities, 1)).toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min((calculations.totalAssets / Math.max(calculations.totalLiabilities, 1)) * 10, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-neutral-600">Ratio de Endeudamiento</span>
                      <span className="text-orange-400 font-semibold">
                        {((calculations.totalLiabilities / Math.max(calculations.totalAssets, 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${Math.min((calculations.totalLiabilities / Math.max(calculations.totalAssets, 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-neutral-600">Ratio de Capital</span>
                      <span className="text-primary-500 font-semibold">
                        {((calculations.totalCapital / Math.max(calculations.totalAssets, 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${Math.min((calculations.totalCapital / Math.max(calculations.totalAssets, 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">📈 Análisis de Solvencia</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Activos vs Pasivos</span>
                    <span className={`font-semibold ${calculations.totalAssets > calculations.totalLiabilities ? "text-primary-500" : "text-neutral-600"}`}>
                      {calculations.totalAssets > calculations.totalLiabilities ? "✅ Positivo" : "❌ Negativo"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Balance Equilibrado</span>
                    <span className={`font-semibold ${calculations.isBalanced ? "text-primary-500" : "text-neutral-600"}`}>
                      {calculations.isBalanced ? "✅ Equilibrado" : "❌ Desequilibrado"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Capital Adecuado</span>
                    <span className={`font-semibold ${calculations.totalCapital > 0 ? "text-primary-500" : "text-neutral-600"}`}>
                      {calculations.totalCapital > 0 ? "✅ Adecuado" : "❌ Insuficiente"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!loading && (!entries.categories || entries.categories.length === 0) && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <div className="text-neutral-800 text-xl mb-2">No hay datos disponibles</div>
            <div className="text-neutral-600">Selecciona un período diferente para ver el balance general.</div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BalanceSheet;
