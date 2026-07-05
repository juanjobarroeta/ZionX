import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./IncomeReports.css";

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
        <div className="zxrep-loading">
          <div className="zxrep-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxrep">
        <div className="zxrep-inner">
          {/* Header */}
          <div className="zxrep-head">
            <div>
              <div className="zxrep-eyebrow">Finanzas</div>
              <h1 className="zxrep-h1">Reportes de <span className="zxrep-serif">ingresos</span></h1>
              <p className="zxrep-sub">Análisis y métricas de ingresos</p>
            </div>
            <div className="zxrep-actions">
              <Link to="/income" className="zxrep-btn">← Volver</Link>
              <button onClick={fetchReports} className="zxrep-btn solid">Actualizar</button>
            </div>
          </div>

          {/* MRR Stats */}
          {mrrData && (
            <div className="zxrep-tiles">
              <div className="zxrep-tile lead">
                <span className="k">MRR (Ingresos Mensuales Recurrentes)</span>
                <span className="v">{formatCurrency(mrrData.mrr)}</span>
                <span className="sub">ARR: {formatCurrency(mrrData.mrr * 12)}</span>
              </div>

              <div className="zxrep-tile">
                <span className="k">Suscripciones Activas</span>
                <span className="v">{mrrData.active_subscriptions}</span>
              </div>

              <div className="zxrep-tile">
                <span className="k">ARPU (Promedio por Cliente)</span>
                <span className="v">{formatCurrency(mrrData.arpu)}</span>
              </div>
            </div>
          )}

          {/* Monthly Revenue Table */}
          <div className="zxrep-panel">
            <div className="zxrep-panel-head">
              <h2>Ingresos por mes</h2>
            </div>
            <div className="zxrep-tablewrap">
              <table className="zxrep-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Facturas</th>
                    <th>Subtotal</th>
                    <th>IVA (16%)</th>
                    <th>Total Facturado</th>
                    <th>Cobrado</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRevenue.map((month) => (
                    <tr key={month.month}>
                      <td className="month">{formatMonth(month.month)}</td>
                      <td className="dim">{month.invoice_count}</td>
                      <td className="strong">{formatCurrency(month.subtotal)}</td>
                      <td className="dim">{formatCurrency(month.tax)}</td>
                      <td className="strong">{formatCurrency(month.total_billed)}</td>
                      <td className="ok">{formatCurrency(month.total_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="zxrep-cols">
            {/* Top Customers */}
            <div className="zxrep-panel">
              <div className="zxrep-panel-head">
                <h2>Top 10 Clientes</h2>
              </div>
              <div className="zxrep-panel-body">
                <div className="zxrep-list">
                  {topCustomers.map((customer, index) => (
                    <div key={customer.id} className="zxrep-item">
                      <div className="lead-col">
                        <span className="zxrep-rank">#{index + 1}</span>
                        <div>
                          <p className="name">{customer.customer_name}</p>
                          <p className="meta">{customer.invoice_count} facturas</p>
                        </div>
                      </div>
                      <div className="amt">
                        <p className="main ok">{formatCurrency(customer.total_paid)}</p>
                        {parseFloat(customer.outstanding) > 0 && (
                          <p className="aux warn">Pendiente: {formatCurrency(customer.outstanding)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Add-on Performance */}
            <div className="zxrep-panel">
              <div className="zxrep-panel-head">
                <h2>Add-ons Más Vendidos</h2>
              </div>
              <div className="zxrep-panel-body">
                <div className="zxrep-list">
                  {addonPerformance.slice(0, 10).map((addon, index) => (
                    <div key={addon.id} className="zxrep-item">
                      <div className="lead-col">
                        <span className="zxrep-rank">#{index + 1}</span>
                        <div>
                          <p className="name">{addon.addon_name}</p>
                          <p className="meta">{addon.category} • {addon.times_purchased} ventas</p>
                        </div>
                      </div>
                      <div className="amt">
                        <p className="main">{formatCurrency(addon.total_revenue)}</p>
                        <p className="aux">Cant: {addon.total_quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default IncomeReports;




