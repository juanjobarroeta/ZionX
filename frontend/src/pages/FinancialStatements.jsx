import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./FinancialStatements.css";

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
        <div className="zxfst">
          <div className="zxfst-inner">
            <div className="zxfst-loading">Cargando estados financieros…</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxfst">
        <div className="zxfst-inner">
          {/* Header */}
          <div className="zxfst-head">
            <div>
              <div className="zxfst-eyebrow">Finanzas</div>
              <h1 className="zxfst-h1">Estados <span className="zxfst-serif">financieros</span></h1>
              <p className="zxfst-sub">Profit &amp; Loss, Balance General, Flujo de Efectivo</p>
            </div>
            <div className="zxfst-actions">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="zxfst-select"
              >
                {[2024, 2025, 2026, 2027].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <Link to="/hr/employees" className="zxfst-btn">Empleados</Link>
              <Link to="/hr/payroll" className="zxfst-btn solid">Nómina</Link>
            </div>
          </div>

          {/* KPI Statement Panels */}
          {summary && (
            <div className="zxfst-kpis">
              {/* MTD */}
              <div className="zxfst-panel">
                <div className="zxfst-panel-head">
                  <h3>Mes actual</h3>
                  <span className="tag">{getMonthName(summary.current_month)}</span>
                </div>
                <div className="zxfst-panel-body">
                  <div className="zxfst-rows">
                    <div className="zxfst-row">
                      <span className="label">Ingresos</span>
                      <span className="amt pos">{formatCurrency(summary.mtd.revenue)}</span>
                    </div>
                    <div className="zxfst-row">
                      <span className="label">(-) Costo Laboral</span>
                      <span className="amt neg">{formatCurrency(summary.mtd.labor_cost)}</span>
                    </div>
                    <div className="zxfst-row">
                      <span className="label">(-) Gastos Operativos</span>
                      <span className="amt neg">{formatCurrency(summary.mtd.operating_expenses)}</span>
                    </div>
                    <div className="zxfst-row subtotal">
                      <span className="label">Utilidad Neta</span>
                      <span className={`amt ${summary.mtd.net_income >= 0 ? 'pos' : 'neg'}`}>
                        {formatCurrency(summary.mtd.net_income)}
                      </span>
                    </div>
                    <div className="zxfst-row minor">
                      <span className="label">Margen de Utilidad</span>
                      <span className={`amt ${parseFloat(summary.mtd.profit_margin) >= 0 ? 'pos' : 'neg'}`}>
                        {formatPercent(summary.mtd.profit_margin)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* YTD */}
              <div className="zxfst-panel">
                <div className="zxfst-panel-head">
                  <h3>Año {selectedYear}</h3>
                  <span className="tag">YTD</span>
                </div>
                <div className="zxfst-panel-body">
                  <div className="zxfst-rows">
                    <div className="zxfst-row">
                      <span className="label">Ingresos</span>
                      <span className="amt pos">{formatCurrency(summary.ytd.revenue)}</span>
                    </div>
                    <div className="zxfst-row">
                      <span className="label">(-) Costo Laboral</span>
                      <span className="amt neg">{formatCurrency(summary.ytd.labor_cost)}</span>
                    </div>
                    <div className="zxfst-row">
                      <span className="label">(-) Gastos Operativos</span>
                      <span className="amt neg">{formatCurrency(summary.ytd.operating_expenses)}</span>
                    </div>
                    <div className="zxfst-row subtotal">
                      <span className="label">Utilidad Neta</span>
                      <span className={`amt ${summary.ytd.net_income >= 0 ? 'pos' : 'neg'}`}>
                        {formatCurrency(summary.ytd.net_income)}
                      </span>
                    </div>
                    <div className="zxfst-row minor">
                      <span className="label">Margen de Utilidad</span>
                      <span className={`amt ${parseFloat(summary.ytd.profit_margin) >= 0 ? 'pos' : 'neg'}`}>
                        {formatPercent(summary.ytd.profit_margin)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Profit & Loss Table */}
          <div className="zxfst-panel">
            <div className="zxfst-panel-head">
              <h2>Estado de Resultados (P&amp;L)</h2>
              <span className="tag">Año {selectedYear}</span>
            </div>
            <div className="zxfst-tablewrap">
              <table className="zxfst-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Ingresos</th>
                    <th>Costo Laboral</th>
                    <th>Gastos Op.</th>
                    <th>Utilidad</th>
                    <th>Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {profitLoss?.summary?.length > 0 ? (
                    profitLoss.summary.map((row, idx) => (
                      <tr key={idx}>
                        <td>{getMonthName(row.month)}</td>
                        <td className="pos">{formatCurrency(row.revenue_total)}</td>
                        <td className="neg">{formatCurrency(row.labor_cost)}</td>
                        <td className="neg">{formatCurrency(row.operating_expenses)}</td>
                        <td className={`strong ${parseFloat(row.net_income) >= 0 ? 'pos' : 'neg'}`}>
                          {formatCurrency(row.net_income)}
                        </td>
                        <td className={parseFloat(row.profit_margin_pct) >= 0 ? 'pos' : 'neg'}>
                          {formatPercent(row.profit_margin_pct)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="zxfst-empty">
                        <span className="big">📊</span>
                        No hay datos financieros para {selectedYear}
                      </td>
                    </tr>
                  )}
                </tbody>
                {profitLoss?.summary?.length > 0 && (
                  <tfoot>
                    <tr>
                      <td>TOTAL {selectedYear}</td>
                      <td className="pos">
                        {formatCurrency(profitLoss.summary.reduce((sum, r) => sum + parseFloat(r.revenue_total || 0), 0))}
                      </td>
                      <td className="neg">
                        {formatCurrency(profitLoss.summary.reduce((sum, r) => sum + parseFloat(r.labor_cost || 0), 0))}
                      </td>
                      <td className="neg">
                        {formatCurrency(profitLoss.summary.reduce((sum, r) => sum + parseFloat(r.operating_expenses || 0), 0))}
                      </td>
                      <td className="pos">
                        {formatCurrency(profitLoss.summary.reduce((sum, r) => sum + parseFloat(r.net_income || 0), 0))}
                      </td>
                      <td>-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Breakdown Cards */}
          <div className="zxfst-cols">
            {/* Labor Costs Breakdown */}
            <div className="zxfst-panel">
              <div className="zxfst-panel-head">
                <h2>Desglose Costo Laboral</h2>
              </div>
              <div className="zxfst-panel-body">
                {profitLoss?.labor_costs?.length > 0 ? (
                  <div className="zxfst-brk">
                    {profitLoss.labor_costs.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="zxfst-brk-row">
                        <span className="label">{getMonthName(item.month)}</span>
                        <span className="amt">
                          {formatCurrency(item.total_net)}
                          <span className="note">({item.employee_count} emp)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="zxfst-note">Sin datos de nómina</p>
                )}
              </div>
            </div>

            {/* Operating Expenses Breakdown */}
            <div className="zxfst-panel">
              <div className="zxfst-panel-head">
                <h2>Gastos Operativos</h2>
                <Link to="/admin/expenses" className="zxfst-lnk">
                  Ver todos →
                </Link>
              </div>
              <div className="zxfst-panel-body">
                {profitLoss?.operating_expenses?.length > 0 ? (
                  <div className="zxfst-brk">
                    {profitLoss.operating_expenses.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="zxfst-brk-row">
                        <span className="label">{item.category || 'Sin categoría'}</span>
                        <span className="amt neg">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="zxfst-note">Sin gastos registrados</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {summary && (
            <div className="zxfst-quick">
              <h3>Resumen Rápido</h3>
              <div className="zxfst-tiles">
                <div className="zxfst-tile">
                  <span className="k">Empleados Activos</span>
                  <span className="v">{summary.employee_count}</span>
                </div>
                <div className="zxfst-tile">
                  <span className="k">Ingresos YTD</span>
                  <span className="v pos">{formatCurrency(summary.ytd.revenue)}</span>
                </div>
                <div className="zxfst-tile">
                  <span className="k">Costos Totales YTD</span>
                  <span className="v neg">
                    {formatCurrency(summary.ytd.labor_cost + summary.ytd.operating_expenses)}
                  </span>
                </div>
                <div className="zxfst-tile">
                  <span className="k">Utilidad YTD</span>
                  <span className={`v ${summary.ytd.net_income >= 0 ? 'pos' : 'neg'}`}>
                    {formatCurrency(summary.ytd.net_income)}
                  </span>
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


