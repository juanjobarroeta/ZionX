import React, { useEffect, useState, useCallback, useMemo } from "react";
import { API_BASE_URL } from "../utils/constants";
import Layout from "../components/Layout";
import axios from "axios";
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

const IncomeStatement = () => {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [periodType, setPeriodType] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [exportLoading, setExportLoading] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [timeRange, setTimeRange] = useState("month");
  
  // Period closing states
  const [closures, setClosures] = useState([]);
  const [periodValidation, setPeriodValidation] = useState(null);
  const [closingPeriod, setClosingPeriod] = useState(false);
  const [closeConfirmation, setCloseConfirmation] = useState(false);
  
  const token = localStorage.getItem("token");

  // Initialize with current month and year
  useEffect(() => {
    const today = new Date();
    setSelectedMonth((today.getMonth() + 1).toString());
    setSelectedYear(today.getFullYear().toString());
    setCustomStartDate(today.toISOString().slice(0, 10));
    setCustomEndDate(today.toISOString().slice(0, 10));
  }, []);

  const loadData = useCallback(async (isComparison = false) => {
    if (!selectedMonth || !selectedYear) return;
    
    try {
      setLoading(true);
      setError(null);
      
      let url = `${API_BASE_URL}/income-statement?month=${selectedMonth}&year=${selectedYear}&details=${showDetails}`;
      
      if (periodType === "custom" && customStartDate && customEndDate) {
        url = `${API_BASE_URL}/income-statement?start=${customStartDate}&end=${customEndDate}&details=${showDetails}`;
      } else if (periodType === "quarter" && selectedQuarter) {
        url = `${API_BASE_URL}/income-statement?quarter=${selectedQuarter}&year=${selectedYear}&details=${showDetails}`;
      } else if (periodType === "year") {
        url = `${API_BASE_URL}/income-statement?year=${selectedYear}&details=${showDetails}`;
      }
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (isComparison) {
        setComparisonData(res.data);
      } else {
        setStatement(res.data);
      }
    } catch (err) {
      console.error("Error fetching income statement:", err);
      setError(err.response?.data?.message || "Error al cargar el estado de resultados");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, showDetails, periodType, customStartDate, customEndDate, selectedQuarter, token]);

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      loadData();
    }
  }, [selectedMonth, selectedYear, showDetails, periodType, customStartDate, customEndDate, selectedQuarter, loadData]);

  // Memoized calculations
  const calculations = useMemo(() => {
    if (!statement) return null;
    
    const totalIncome = (statement.interestPaid || 0) + (statement.productMargin || 0) + (statement.penalties || 0);
    const totalExpenses = (statement.costOfGoods || 0) + (statement.expenses || 0);
    const grossProfit = totalIncome - (statement.costOfGoods || 0);
    const netIncome = grossProfit - (statement.expenses || 0);
    const profitMargin = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;
    
    return {
      totalIncome,
      totalExpenses,
      grossProfit,
      netIncome,
      profitMargin,
      expenseRatio,
      interestPaid: statement.interestPaid || 0,
      penalties: statement.penalties || 0,
      productMargin: statement.productMargin || 0,
      costOfGoods: statement.costOfGoods || 0,
      expenses: statement.expenses || 0
    };
  }, [statement]);

  // Chart data
  const chartData = useMemo(() => {
    if (!calculations) return null;

    return {
      revenue: {
        labels: ['Intereses', 'Penalidades', 'Productos'],
        datasets: [{
          data: [calculations.interestPaid, calculations.penalties, calculations.productMargin],
          backgroundColor: ['#10B981', '#F59E0B', '#3B82F6'],
          borderWidth: 0,
        }]
      },
      expenses: {
        labels: ['Costo de Venta', 'Gastos Operativos'],
        datasets: [{
          data: [calculations.costOfGoods, calculations.expenses],
          backgroundColor: ['#EF4444', '#F97316'],
          borderWidth: 0,
        }]
      },
      trend: {
        labels: statement?.weeklyBreakdown?.map(week => week.range) || [],
        datasets: [{
          label: 'Ingresos',
          data: statement?.weeklyBreakdown?.map(week => week.interestPaid + week.penalties + week.productMargin) || [],
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
        }, {
          label: 'Gastos',
          data: statement?.weeklyBreakdown?.map(week => week.costOfGoods + week.expenses) || [],
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
        }]
      }
    };
  }, [calculations, statement]);

  const handleMonthChange = (e) => setSelectedMonth(e.target.value);
  const handleYearChange = (e) => setSelectedYear(e.target.value);
  const handlePeriodTypeChange = (e) => setPeriodType(e.target.value);

  const handleCurrentMonth = () => {
    const today = new Date();
    setSelectedMonth((today.getMonth() + 1).toString());
    setSelectedYear(today.getFullYear().toString());
    setPeriodType("month");
  };

  const handleCurrentYear = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear().toString());
    setPeriodType("year");
  };

  const handleYTD = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear().toString());
    setCustomStartDate(`${today.getFullYear()}-01-01`);
    setCustomEndDate(today.toISOString().slice(0, 10));
    setPeriodType("custom");
  };

  const handlePreviousPeriod = () => {
    if (periodType === "month") {
      const currentMonth = parseInt(selectedMonth);
      const currentYear = parseInt(selectedYear);
      
      if (currentMonth === 1) {
        setSelectedMonth("12");
        setSelectedYear((currentYear - 1).toString());
      } else {
        setSelectedMonth((currentMonth - 1).toString());
      }
    } else if (periodType === "quarter") {
      const currentQuarter = parseInt(selectedQuarter);
      const currentYear = parseInt(selectedYear);
      
      if (currentQuarter === 1) {
        setSelectedQuarter("4");
        setSelectedYear((currentYear - 1).toString());
      } else {
        setSelectedQuarter((currentQuarter - 1).toString());
      }
    } else if (periodType === "year") {
      setSelectedYear((parseInt(selectedYear) - 1).toString());
    }
  };

  const handleNextPeriod = () => {
    if (periodType === "month") {
      const currentMonth = parseInt(selectedMonth);
      const currentYear = parseInt(selectedYear);
      
      if (currentMonth === 12) {
        setSelectedMonth("1");
        setSelectedYear((currentYear + 1).toString());
      } else {
        setSelectedMonth((currentMonth + 1).toString());
      }
    } else if (periodType === "quarter") {
      const currentQuarter = parseInt(selectedQuarter);
      const currentYear = parseInt(selectedYear);
      
      if (currentQuarter === 4) {
        setSelectedQuarter("1");
        setSelectedYear((currentYear + 1).toString());
      } else {
        setSelectedQuarter((currentQuarter + 1).toString());
      }
    } else if (periodType === "year") {
      setSelectedYear((parseInt(selectedYear) + 1).toString());
    }
  };

  const handleExportPDF = async () => {
    try {
      setExportLoading(true);
      const response = await axios.get(`${API_BASE_URL}/income-statement/export-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `income-statement-${selectedYear}-${selectedMonth}.pdf`);
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
      const response = await axios.get(`${API_BASE_URL}/income-statement/export-excel`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `income-statement-${selectedYear}-${selectedMonth}.xlsx`);
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

  // Period closing functions
  const loadClosures = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/accounting/closures`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClosures(response.data);
    } catch (err) {
      console.error("Error loading closures:", err);
    }
  }, [token]);

  const validatePeriod = useCallback(async (startDate, endDate) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/accounting/period-validation`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { period_start: startDate, period_end: endDate }
      });
      setPeriodValidation(response.data);
      return response.data;
    } catch (err) {
      console.error("Error validating period:", err);
      setPeriodValidation(null);
      return null;
    }
  }, [token]);

  const closePeriod = async (startDate, endDate, notes = "") => {
    try {
      setClosingPeriod(true);
      const response = await axios.post(`${API_BASE_URL}/accounting/close-period`, {
        period_start: startDate,
        period_end: endDate,
        notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(`Period closed successfully!\n\nSummary:\n• Revenue: $${response.data.summary.total_revenue.toLocaleString()}\n• Expenses: $${response.data.summary.total_expenses.toLocaleString()}\n• Net Income: $${response.data.summary.net_income.toLocaleString()}`);
      
      // Reload closures and reset validation
      loadClosures();
      setPeriodValidation(null);
      setCloseConfirmation(false);
      
    } catch (err) {
      console.error("Error closing period:", err);
      alert(`Error closing period: ${err.response?.data?.message || err.message}`);
    } finally {
      setClosingPeriod(false);
    }
  };

  // Load closures when component mounts
  useEffect(() => {
    loadClosures();
  }, [loadClosures]);

  const getPeriodLabel = () => {
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    
    if (periodType === "month") {
      return `${monthNames[parseInt(selectedMonth) - 1]} ${selectedYear}`;
    } else if (periodType === "quarter") {
      return `Q${selectedQuarter} ${selectedYear}`;
    } else if (periodType === "year") {
      return `Año ${selectedYear}`;
    } else if (periodType === "custom") {
      return `${customStartDate} - ${customEndDate}`;
    }
    return "";
  };

  if (loading && !statement) {
    return (
      <Layout>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
              <p className="text-neutral-600 text-lg">Cargando estado de resultados...</p>
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
              <h1 className="text-3xl font-bold text-neutral-800 mb-2">📊 Estado de Resultados</h1>
              <p className="text-neutral-600">Análisis completo de ingresos, gastos y rentabilidad</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-white text-neutral-800 border border-neutral-300 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none"
              >
                <option value="month">Este Mes</option>
                <option value="quarter">Este Trimestre</option>
                <option value="year">Este Año</option>
                <option value="ytd">YTD</option>
              </select>
              <button
                onClick={() => setComparisonMode(!comparisonMode)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  comparisonMode 
                    ? "bg-yellow-600 hover:bg-yellow-700 text-neutral-800" 
                    : "bg-gray-700 hover:bg-gray-600 text-neutral-800"
                }`}
              >
                {comparisonMode ? "🔍 Comparación ON" : "🔍 Comparación"}
              </button>
            </div>
          </div>

          {/* Quick Stats Cards */}
          {calculations && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-xl text-neutral-800">
                <div className="text-2xl font-bold">${calculations.totalIncome.toLocaleString()}</div>
                <div className="text-sm opacity-90">Ingresos Totales</div>
              </div>
              <div className="bg-gradient-to-r from-red-500 to-pink-600 p-6 rounded-xl text-neutral-800">
                <div className="text-2xl font-bold">${calculations.totalExpenses.toLocaleString()}</div>
                <div className="text-sm opacity-90">Gastos Totales</div>
              </div>
              <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-6 rounded-xl text-neutral-800">
                <div className="text-2xl font-bold">${calculations.grossProfit.toLocaleString()}</div>
                <div className="text-sm opacity-90">Utilidad Bruta</div>
              </div>
              <div className={`p-6 rounded-xl text-neutral-800 ${
                calculations.netIncome >= 0 
                  ? "bg-gradient-to-r from-primary-500 to-primary-600" 
                  : "bg-gradient-to-r from-red-500 to-pink-600"
              }`}>
                <div className="text-2xl font-bold">${calculations.netIncome.toLocaleString()}</div>
                <div className="text-sm opacity-90">Utilidad Neta</div>
              </div>
            </div>
          )}

          {/* Period Selection */}
          <div className="bg-white rounded-lg p-6 border border-neutral-200 mb-8">
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <div>
                <label className="block text-neutral-800 text-sm mb-2">Tipo de Período</label>
                <select 
                  value={periodType} 
                  onChange={handlePeriodTypeChange}
                  className="p-3 bg-gray-700 border border-neutral-300 text-neutral-800 rounded-lg focus:border-primary-500 focus:outline-none"
                >
                  <option value="month">Mes</option>
                  <option value="quarter">Trimestre</option>
                  <option value="year">Año</option>
                  <option value="custom">Período Personalizado</option>
                </select>
              </div>

              {periodType === "month" && (
                <div>
                  <label className="block text-neutral-800 text-sm mb-2">Mes</label>
                  <select 
                    value={selectedMonth} 
                    onChange={handleMonthChange}
                    className="p-3 bg-gray-700 border border-neutral-300 text-neutral-800 rounded-lg focus:border-primary-500 focus:outline-none"
                  >
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                  </select>
                </div>
              )}

              {periodType === "quarter" && (
                <div>
                  <label className="block text-neutral-800 text-sm mb-2">Trimestre</label>
                  <select 
                    value={selectedQuarter} 
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="p-3 bg-gray-700 border border-neutral-300 text-neutral-800 rounded-lg focus:border-primary-500 focus:outline-none"
                  >
                    <option value="1">Q1 (Ene-Mar)</option>
                    <option value="2">Q2 (Abr-Jun)</option>
                    <option value="3">Q3 (Jul-Sep)</option>
                    <option value="4">Q4 (Oct-Dic)</option>
                  </select>
                </div>
              )}

              {(periodType === "month" || periodType === "quarter" || periodType === "year") && (
                <div>
                  <label className="block text-neutral-800 text-sm mb-2">Año</label>
                  <select 
                    value={selectedYear} 
                    onChange={handleYearChange}
                    className="p-3 bg-gray-700 border border-neutral-300 text-neutral-800 rounded-lg focus:border-primary-500 focus:outline-none"
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}

              {periodType === "custom" && (
                <>
                  <div>
                    <label className="block text-neutral-800 text-sm mb-2">Fecha Inicio</label>
                    <input 
                      type="date" 
                      value={customStartDate} 
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="p-3 bg-gray-700 border border-neutral-300 text-neutral-800 rounded-lg focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-800 text-sm mb-2">Fecha Fin</label>
                    <input 
                      type="date" 
                      value={customEndDate} 
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="p-3 bg-gray-700 border border-neutral-300 text-neutral-800 rounded-lg focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center">
                <label className="flex items-center text-neutral-800 text-sm">
                  <input
                    type="checkbox"
                    checked={showDetails}
                    onChange={(e) => setShowDetails(e.target.checked)}
                    className="mr-2"
                  />
                  Detalles semanales
                </label>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={handleCurrentMonth}
                className="bg-blue-600 hover:bg-blue-700 text-neutral-800 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                📅 Mes Actual
              </button>
              <button 
                onClick={handleCurrentYear}
                className="bg-orange-600 hover:bg-orange-700 text-neutral-800 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                📅 Año Actual
              </button>
              <button 
                onClick={handleYTD}
                className="bg-purple-600 hover:bg-purple-700 text-neutral-800 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                📊 YTD
              </button>
              <div className="flex gap-1">
                <button 
                  onClick={handlePreviousPeriod}
                  className="bg-gray-600 hover:bg-gray-700 text-neutral-800 px-3 py-2 rounded-lg text-sm transition-colors"
                  title="Período anterior"
                >
                  ←
                </button>
                <button 
                  onClick={handleNextPeriod}
                  className="bg-gray-600 hover:bg-gray-700 text-neutral-800 px-3 py-2 rounded-lg text-sm transition-colors"
                  title="Período siguiente"
                >
                  →
                </button>
              </div>
            </div>

            {/* Period Label */}
            <div className="mt-4">
              <span className="text-primary-500 font-semibold text-lg">📅 Período: {getPeriodLabel()}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-white p-1 rounded-lg">
          {[
            { id: "overview", label: "📊 Resumen", icon: "📊" },
            { id: "analytics", label: "📈 Análisis", icon: "📈" },
            { id: "details", label: "📋 Detalles", icon: "📋" },
            { id: "charts", label: "📊 Gráficos", icon: "📊" },
            { id: "close", label: "🔒 Cerrar Período", icon: "🔒" },
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

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6">
            <h4 className="text-neutral-600 font-semibold mb-2">❌ Error</h4>
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "overview" && statement && calculations && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">💰 Ingresos</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Intereses:</span>
                    <span className="text-primary-500 font-semibold">${calculations.interestPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Penalidades:</span>
                    <span className="text-primary-500 font-semibold">${calculations.penalties.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Productos:</span>
                    <span className="text-primary-500 font-semibold">${calculations.productMargin.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-neutral-300 pt-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span className="text-neutral-800">Total:</span>
                      <span className="text-primary-500">${calculations.totalIncome.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">💸 Gastos</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Costo de Venta:</span>
                    <span className="text-neutral-600 font-semibold">${calculations.costOfGoods.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Gastos Operativos:</span>
                    <span className="text-neutral-600 font-semibold">${calculations.expenses.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-neutral-300 pt-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span className="text-neutral-800">Total:</span>
                      <span className="text-neutral-600">${calculations.totalExpenses.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">📈 Métricas</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Utilidad Bruta:</span>
                    <span className="text-primary-500 font-semibold">${calculations.grossProfit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Margen de Utilidad:</span>
                    <span className={`font-semibold ${calculations.profitMargin >= 0 ? "text-primary-500" : "text-neutral-600"}`}>
                      {calculations.profitMargin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Ratio de Gastos:</span>
                    <span className="text-orange-400 font-semibold">{calculations.expenseRatio.toFixed(1)}%</span>
                  </div>
                  <div className="border-t border-neutral-300 pt-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span className="text-neutral-800">Utilidad Neta:</span>
                      <span className={`${calculations.netIncome >= 0 ? "text-primary-500" : "text-neutral-600"}`}>
                        ${calculations.netIncome.toLocaleString()}
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

        {activeTab === "analytics" && statement && calculations && (
          <div className="space-y-6">
            {/* Performance Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">📊 Análisis de Rentabilidad</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-neutral-600">Margen de Utilidad</span>
                      <span className={`font-semibold ${calculations.profitMargin >= 0 ? "text-primary-500" : "text-neutral-600"}`}>
                        {calculations.profitMargin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${calculations.profitMargin >= 0 ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(Math.abs(calculations.profitMargin), 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-neutral-600">Ratio de Gastos</span>
                      <span className="text-orange-400 font-semibold">{calculations.expenseRatio.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${Math.min(calculations.expenseRatio, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">💰 Composición de Ingresos</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Intereses</span>
                    <span className="text-primary-500">
                      {((calculations.interestPaid / calculations.totalIncome) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Penalidades</span>
                    <span className="text-primary-500">
                      {((calculations.penalties / calculations.totalIncome) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Productos</span>
                    <span className="text-primary-500">
                      {((calculations.productMargin / calculations.totalIncome) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "details" && statement && calculations && (
          <div className="space-y-6">
            {/* Income Statement Table */}
            <div className="bg-white rounded-lg p-6 border border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">📋 Estado de Resultados Detallado</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-neutral-800">
                  <thead>
                    <tr className="border-b border-neutral-300">
                      <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Concepto</th>
                      <th className="text-right py-3 px-4 text-neutral-600 font-semibold">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-neutral-200">
                      <td className="py-3 px-4 font-semibold text-primary-500">INGRESOS</td>
                      <td className="py-3 px-4 text-right"></td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 pl-8">Intereses cobrados</td>
                      <td className="py-3 px-4 text-right text-primary-500">${calculations.interestPaid.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 pl-8">Penalidades</td>
                      <td className="py-3 px-4 text-right text-primary-500">${calculations.penalties.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 pl-8">Margen de productos</td>
                      <td className="py-3 px-4 text-right text-primary-500">${calculations.productMargin.toLocaleString()}</td>
                    </tr>
                    
                    <tr className="border-b border-neutral-200">
                      <td className="py-3 px-4 font-semibold text-neutral-600">COSTOS Y GASTOS</td>
                      <td className="py-3 px-4 text-right"></td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 pl-8">Costo de ventas</td>
                      <td className="py-3 px-4 text-right text-neutral-600">${calculations.costOfGoods.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 pl-8">Gastos operativos</td>
                      <td className="py-3 px-4 text-right text-neutral-600">${calculations.expenses.toLocaleString()}</td>
                    </tr>
                    
                    <tr className="border-t border-neutral-300">
                      <td className="py-3 px-4 font-bold text-neutral-800">Total Ingresos</td>
                      <td className="py-3 px-4 text-right text-primary-500 font-bold">${calculations.totalIncome.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-neutral-800">Costo de Venta</td>
                      <td className="py-3 px-4 text-right text-neutral-600 font-bold">${calculations.costOfGoods.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-neutral-800">Utilidad Bruta</td>
                      <td className="py-3 px-4 text-right text-primary-500 font-bold">${calculations.grossProfit.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-neutral-800">Gastos Generales</td>
                      <td className="py-3 px-4 text-right text-neutral-600 font-bold">${calculations.expenses.toLocaleString()}</td>
                    </tr>
                    <tr className="border-t-2 border-gray-500">
                      <td className="py-3 px-4 font-bold text-lg text-neutral-800">Utilidad Neta</td>
                      <td className={`py-3 px-4 text-right font-bold text-lg ${calculations.netIncome >= 0 ? "text-primary-500" : "text-neutral-600"}`}>
                        ${calculations.netIncome.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Weekly Breakdown */}
            {showDetails && statement.weeklyBreakdown && (
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">📅 Desglose Semanal</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-neutral-800">
                    <thead>
                      <tr className="border-b border-neutral-300">
                        <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Semana</th>
                        <th className="text-right py-3 px-4 text-neutral-600 font-semibold">Intereses</th>
                        <th className="text-right py-3 px-4 text-neutral-600 font-semibold">Penalidades</th>
                        <th className="text-right py-3 px-4 text-neutral-600 font-semibold">Productos</th>
                        <th className="text-right py-3 px-4 text-neutral-600 font-semibold">Costos</th>
                        <th className="text-right py-3 px-4 text-neutral-600 font-semibold">Gastos</th>
                        <th className="text-right py-3 px-4 text-neutral-600 font-semibold">Neto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.weeklyBreakdown.map((week, index) => {
                        const weekNet = (week.interestPaid + week.penalties + week.productMargin) - week.costOfGoods - week.expenses;
                        return (
                          <tr key={index} className="border-b border-neutral-200">
                            <td className="py-3 px-4">{week.range}</td>
                            <td className="py-3 px-4 text-right text-primary-500">${week.interestPaid.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-primary-500">${week.penalties.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-primary-500">${week.productMargin.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-neutral-600">${week.costOfGoods.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-neutral-600">${week.expenses.toLocaleString()}</td>
                            <td className={`py-3 px-4 text-right font-semibold ${weekNet >= 0 ? "text-primary-500" : "text-neutral-600"}`}>
                              ${weekNet.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "charts" && statement && calculations && chartData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Chart */}
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">💰 Composición de Ingresos</h3>
                <div className="h-64">
                  <Doughnut 
                    data={chartData.revenue}
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

              {/* Expenses Chart */}
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">💸 Composición de Gastos</h3>
                <div className="h-64">
                  <Doughnut 
                    data={chartData.expenses}
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

            {/* Trend Chart */}
            {statement.weeklyBreakdown && (
              <div className="bg-white rounded-lg p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">📈 Tendencias Semanales</h3>
                <div className="h-80">
                  <Line 
                    data={chartData.trend}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          labels: {
                            color: '#ffffff'
                          }
                        }
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: '#ffffff'
                          },
                          grid: {
                            color: '#374151'
                          }
                        },
                        y: {
                          ticks: {
                            color: '#ffffff'
                          },
                          grid: {
                            color: '#374151'
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

        {/* Close Period Tab */}
        {activeTab === "close" && (
          <div className="space-y-6">
            {/* Period Selection */}
            <div className="bg-white rounded-lg p-6 border border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">🔒 Cerrar Período Contable</h3>
              <p className="text-neutral-600 mb-6">
                El cierre de período transfiere los resultados del estado de resultados a utilidades retenidas 
                y prepara el sistema para el siguiente período contable.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-neutral-700 font-medium mb-2">Fecha Inicio</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                  />
                </div>
                <div>
                  <label className="block text-neutral-700 font-medium mb-2">Fecha Final</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => validatePeriod(customStartDate, customEndDate)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-neutral-800 py-3 px-4 rounded-lg font-medium transition-colors"
                  >
                    🔍 Validar Período
                  </button>
                </div>
              </div>

              {/* Validation Results */}
              {periodValidation && (
                <div className="mb-6">
                  {periodValidation.is_already_closed ? (
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                      <h4 className="text-neutral-600 font-semibold mb-2">❌ Período Ya Cerrado</h4>
                      <p className="text-neutral-700">
                        Este período ya fue cerrado el {new Date(periodValidation.existing_closure.created_at).toLocaleDateString()}.
                      </p>
                    </div>
                  ) : periodValidation.validation_passed ? (
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                      <h4 className="text-primary-500 font-semibold mb-2">✅ Período Listo para Cerrar</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-neutral-800">{periodValidation.entries_count}</div>
                          <div className="text-neutral-600 text-sm">Asientos Contables</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary-500">0</div>
                          <div className="text-neutral-600 text-sm">Errores Detectados</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary-500">✓</div>
                          <div className="text-neutral-600 text-sm">Listo para Cerrar</div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setCloseConfirmation(true)}
                        className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-neutral-800 py-3 px-4 rounded-lg font-medium transition-colors"
                      >
                        🔒 Proceder al Cierre
                      </button>
                    </div>
                  ) : (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                      <h4 className="text-yellow-400 font-semibold mb-2">⚠️ Advertencias Detectadas</h4>
                      {periodValidation.warnings.map((warning, index) => (
                        <p key={index} className="text-neutral-700 mb-2">• {warning}</p>
                      ))}
                      <p className="text-neutral-600 text-sm">
                        Puedes proceder con el cierre, pero revisa las advertencias primero.
                      </p>
                      
                      <button
                        onClick={() => setCloseConfirmation(true)}
                        className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-neutral-800 py-3 px-4 rounded-lg font-medium transition-colors"
                      >
                        ⚠️ Cerrar con Advertencias
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Confirmation Modal */}
              {closeConfirmation && (
                <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 border border-neutral-200">
                    <h3 className="text-xl font-bold text-neutral-800 mb-4">🔒 Confirmar Cierre de Período</h3>
                    <p className="text-neutral-700 mb-4">
                      ¿Estás seguro de que deseas cerrar el período del {customStartDate} al {customEndDate}?
                    </p>
                    <p className="text-yellow-400 text-sm mb-6">
                      ⚠️ Esta acción no se puede deshacer. Se crearán asientos de cierre y 
                      se transferirán los resultados a utilidades retenidas.
                    </p>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => setCloseConfirmation(false)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-neutral-800 py-2 px-4 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => closePeriod(customStartDate, customEndDate)}
                        disabled={closingPeriod}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-neutral-800 py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {closingPeriod ? "Cerrando..." : "🔒 Cerrar Período"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Previous Closures */}
            <div className="bg-white rounded-lg p-6 border border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">📋 Historial de Cierres</h3>
              
              {closures.length === 0 ? (
                <p className="text-neutral-600 text-center py-8">No hay períodos cerrados anteriormente.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-neutral-700">Período</th>
                        <th className="px-4 py-3 text-right text-neutral-700">Ingresos</th>
                        <th className="px-4 py-3 text-right text-neutral-700">Gastos</th>
                        <th className="px-4 py-3 text-right text-neutral-700">Utilidad Neta</th>
                        <th className="px-4 py-3 text-left text-neutral-700">Fecha Cierre</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-600">
                      {closures.map((closure, index) => (
                        <tr key={index} className="hover:bg-gray-700/50">
                          <td className="px-4 py-3 text-neutral-800">
                            {new Date(closure.period_start).toLocaleDateString()} - {new Date(closure.period_end).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right text-primary-500 font-medium">
                            ${parseFloat(closure.total_revenue || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-600 font-medium">
                            ${parseFloat(closure.total_expenses || 0).toLocaleString()}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${
                            parseFloat(closure.net_income || 0) >= 0 ? 'text-primary-500' : 'text-neutral-600'
                          }`}>
                            ${parseFloat(closure.net_income || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {new Date(closure.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Data State */}
        {!loading && !statement && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <div className="text-neutral-800 text-xl mb-2">No hay datos disponibles</div>
            <div className="text-neutral-600">Selecciona un período diferente para ver los resultados.</div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default IncomeStatement;