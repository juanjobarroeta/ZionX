import { API_BASE_URL } from "../utils/constants";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import "./BudgetManagement.css";

const BudgetManagement = () => {
  const token = localStorage.getItem("token");
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [form, setForm] = useState({
    category: "",
    amount: "",
    period: "monthly",
    start_date: "",
    end_date: "",
    description: "",
    store_id: "",
    is_active: true
  });

  // Budget categories with monogram codes
  const budgetCategories = [
    { id: "payroll", name: "Nómina", code: "NÓ" },
    { id: "rent", name: "Renta", code: "RE" },
    { id: "utilities", name: "Servicios", code: "SE" },
    { id: "marketing", name: "Marketing", code: "MK" },
    { id: "software", name: "Software", code: "SW" },
    { id: "maintenance", name: "Mantenimiento", code: "MN" },
    { id: "security", name: "Seguridad", code: "SG" },
    { id: "office", name: "Oficina", code: "OF" },
    { id: "other", name: "Otros", code: "OT" }
  ];

  const periods = [
    { id: "weekly", name: "Semanal" },
    { id: "monthly", name: "Mensual" },
    { id: "quarterly", name: "Trimestral" },
    { id: "yearly", name: "Anual" }
  ];

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/budgets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBudgets(res.data);
    } catch (err) {
      console.error("Error fetching budgets:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenses(res.data);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const budgetData = {
        ...form,
        amount: parseFloat(form.amount)
      };

      if (selectedBudget) {
        await axios.put(`${API_BASE_URL}/budgets/${selectedBudget.id}`, budgetData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE_URL}/budgets`, budgetData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setForm({
        category: "", amount: "", period: "monthly", start_date: "",
        end_date: "", description: "", store_id: "", is_active: true
      });
      setSelectedBudget(null);
      setShowBudgetModal(false);
      fetchBudgets();

      alert(selectedBudget ? "Presupuesto actualizado" : "Presupuesto creado");
    } catch (err) {
      console.error("Error saving budget:", err);
      alert("Error al guardar el presupuesto");
    } finally {
      setLoading(false);
    }
  };

  const handleEditBudget = (budget) => {
    setSelectedBudget(budget);
    setForm({
      category: budget.category,
      amount: budget.amount.toString(),
      period: budget.period,
      start_date: budget.start_date,
      end_date: budget.end_date,
      description: budget.description,
      store_id: budget.store_id,
      is_active: budget.is_active
    });
    setShowBudgetModal(true);
  };

  const handleDeleteBudget = async (budgetId) => {
    if (confirm("¿Estás seguro de que quieres eliminar este presupuesto?")) {
      try {
        await axios.delete(`${API_BASE_URL}/budgets/${budgetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchBudgets();
        alert("Presupuesto eliminado");
      } catch (err) {
        console.error("Error deleting budget:", err);
        alert("Error al eliminar el presupuesto");
      }
    }
  };

  const budgetAnalytics = useMemo(() => {
    const analytics = {};

    budgets.forEach(budget => {
      const categoryExpenses = expenses.filter(exp =>
        exp.category === budget.category &&
        new Date(exp.created_at) >= new Date(budget.start_date) &&
        new Date(exp.created_at) <= new Date(budget.end_date)
      );

      const spent = categoryExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
      const remaining = budget.amount - spent;
      const percentage = (spent / budget.amount) * 100;

      analytics[budget.category] = {
        budget: budget.amount,
        spent,
        remaining,
        percentage,
        status: percentage > 90 ? 'danger' : percentage > 75 ? 'warning' : 'safe'
      };
    });

    return analytics;
  }, [budgets, expenses]);

  useEffect(() => {
    fetchBudgets();
    fetchExpenses();
  }, []);

  const openNewBudget = () => {
    setSelectedBudget(null);
    setForm({
      category: "", amount: "", period: "monthly", start_date: "",
      end_date: "", description: "", store_id: "", is_active: true
    });
    setShowBudgetModal(true);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0
    }).format(amount || 0);

  const statusLabel = (status) =>
    status === 'danger' ? 'Excedido' : status === 'warning' ? 'Cerca del límite' : 'En límite';

  const totalBudget = Object.values(budgetAnalytics).reduce((sum, a) => sum + a.budget, 0);
  const totalSpent = Object.values(budgetAnalytics).reduce((sum, a) => sum + a.spent, 0);
  const totalRemaining = Object.values(budgetAnalytics).reduce((sum, a) => sum + a.remaining, 0);

  return (
    <Layout>
      <div className="zxbud">
        <div className="zxbud-inner">
          {/* Header */}
          <div className="zxbud-head">
            <div>
              <div className="zxbud-eyebrow">Finanzas</div>
              <h1 className="zxbud-h1">Gestión de <span className="zxbud-serif">presupuestos</span></h1>
              <p className="zxbud-sub">Planeación y control de gasto por categoría</p>
            </div>
            <div className="zxbud-actions">
              <button onClick={openNewBudget} className="zxbud-btn solid">Nuevo presupuesto</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="zxbud-tabs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`zxbud-tab${activeTab === "overview" ? " active" : ""}`}
            >
              Resumen
            </button>
            <button
              onClick={() => setActiveTab("budgets")}
              className={`zxbud-tab${activeTab === "budgets" ? " active" : ""}`}
            >
              Presupuestos
            </button>
            <button
              onClick={() => setActiveTab("forecasting")}
              className={`zxbud-tab${activeTab === "forecasting" ? " active" : ""}`}
            >
              Pronósticos
            </button>
          </div>

          {/* Overview */}
          {activeTab === "overview" && (
            <div className="zxbud-section">
              <div className="zxbud-tiles">
                <div className="zxbud-tile lead">
                  <span className="k">Presupuesto Total</span>
                  <span className="v">{formatCurrency(totalBudget)}</span>
                </div>
                <div className="zxbud-tile">
                  <span className="k">Gastado</span>
                  <span className="v">{formatCurrency(totalSpent)}</span>
                </div>
                <div className="zxbud-tile">
                  <span className="k">Restante</span>
                  <span className={`v ${totalRemaining < 0 ? "bad" : "ok"}`}>{formatCurrency(totalRemaining)}</span>
                </div>
                <div className="zxbud-tile">
                  <span className="k">Activos</span>
                  <span className="v">{budgets.filter(b => b.is_active).length}</span>
                </div>
              </div>

              {Object.keys(budgetAnalytics).length === 0 ? (
                <div className="zxbud-card">
                  <div className="zxbud-empty">
                    <p className="lead">No hay presupuestos configurados</p>
                    <p className="small">Crea tu primer presupuesto para ver el resumen</p>
                  </div>
                </div>
              ) : (
                <div className="zxbud-grid">
                  {Object.entries(budgetAnalytics).map(([category, analytics]) => {
                    const categoryInfo = budgetCategories.find(c => c.id === category);
                    const periodId = budgets.find(b => b.category === category)?.period;
                    const periodName = periods.find(p => p.id === periodId)?.name;
                    return (
                      <div key={category} className="zxbud-ocard">
                        <div className="zxbud-ochead">
                          <div className="who">
                            <span className="zxbud-mono">{categoryInfo?.code || 'OT'}</span>
                            <div>
                              <div className="nm">{categoryInfo?.name || category}</div>
                              <div className="pr">{periodName}</div>
                            </div>
                          </div>
                          <span className={`zxbud-pill ${analytics.status}`}>{statusLabel(analytics.status)}</span>
                        </div>

                        <div className="zxbud-orows">
                          <div className="row">
                            <span>Presupuesto</span>
                            <span className="num">{formatCurrency(analytics.budget)}</span>
                          </div>
                          <div className="row">
                            <span>Gastado</span>
                            <span className="num">{formatCurrency(analytics.spent)}</span>
                          </div>
                          <div className="row">
                            <span>Restante</span>
                            <span className={`num ${analytics.remaining < 0 ? "over" : "left"}`}>{formatCurrency(analytics.remaining)}</span>
                          </div>
                        </div>

                        <div className="zxbud-progress">
                          <div className="zxbud-plabel">
                            <span>Progreso</span>
                            <span>{analytics.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="zxbud-track">
                            <div
                              className={`zxbud-fill ${
                                analytics.percentage > 90 ? 'bad' :
                                analytics.percentage > 75 ? 'warn' : ''
                              }`}
                              style={{ width: `${Math.min(analytics.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Budgets table */}
          {activeTab === "budgets" && (
            <div className="zxbud-card">
              <div className="zxbud-cardhead">
                <span>Presupuestos configurados</span>
                <span className="count">{budgets.length} registros</span>
              </div>
              <div className="zxbud-tablewrap">
                <table className="zxbud-table">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Período</th>
                      <th className="r">Presupuesto</th>
                      <th className="r">Gastado</th>
                      <th className="r">Restante</th>
                      <th className="c">Estado</th>
                      <th className="c">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.map((budget) => {
                      const analytics = budgetAnalytics[budget.category];
                      const categoryInfo = budgetCategories.find(c => c.id === budget.category);
                      const periodInfo = periods.find(p => p.id === budget.period);

                      return (
                        <tr key={budget.id}>
                          <td>
                            <div className="zxbud-cellcat">
                              <span className="zxbud-mono sm">{categoryInfo?.code || 'OT'}</span>
                              <div>
                                <div className="nm">{categoryInfo?.name || budget.category}</div>
                                {budget.description && <div className="sub">{budget.description}</div>}
                              </div>
                            </div>
                          </td>
                          <td>{periodInfo?.name}</td>
                          <td className="r mono">{formatCurrency(budget.amount)}</td>
                          <td className="r mono">{formatCurrency(analytics?.spent || 0)}</td>
                          <td className="r mono">
                            <span className={analytics && analytics.remaining < 0 ? 'over' : 'left'}>
                              {formatCurrency(analytics ? analytics.remaining : budget.amount)}
                            </span>
                          </td>
                          <td className="c">
                            <span className={`zxbud-pill ${analytics?.status || 'safe'}`}>
                              {statusLabel(analytics?.status || 'safe')}
                            </span>
                          </td>
                          <td className="c">
                            <div className="zxbud-rowact">
                              <button onClick={() => handleEditBudget(budget)} className="zxbud-linkbtn">Editar</button>
                              <button onClick={() => handleDeleteBudget(budget.id)} className="zxbud-linkbtn danger">Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {budgets.length === 0 && (
                      <tr>
                        <td colSpan="7">
                          <div className="zxbud-empty">
                            <p className="lead">No hay presupuestos configurados</p>
                            <p className="small">Crea tu primer presupuesto con el botón de arriba</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Forecasting */}
          {activeTab === "forecasting" && (
            <div className="zxbud-card">
              <div className="zxbud-cardhead">
                <span>Pronósticos de gastos</span>
              </div>
              <div className="zxbud-empty">
                <p className="lead">Análisis predictivo de gastos próximos</p>
                <p className="small">Basado en tendencias históricas y patrones de gasto</p>
              </div>
            </div>
          )}
        </div>

        {/* Budget Modal */}
        {showBudgetModal && (
          <div className="zxbud-overlay">
            <div className="zxbud-modal">
              <div className="zxbud-mhead">
                <h3>{selectedBudget ? "Editar presupuesto" : "Nuevo presupuesto"}</h3>
                <button onClick={() => setShowBudgetModal(false)} className="zxbud-close">×</button>
              </div>

              <form onSubmit={handleSubmit} className="zxbud-form">
                <div className="zxbud-grid2">
                  <div className="zxbud-field">
                    <label className="zxbud-label">Categoría</label>
                    <select
                      className="zxbud-select"
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Selecciona Categoría</option>
                      {budgetCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="zxbud-field">
                    <label className="zxbud-label">Período</label>
                    <select
                      className="zxbud-select"
                      name="period"
                      value={form.period}
                      onChange={handleChange}
                      required
                    >
                      {periods.map(period => (
                        <option key={period.id} value={period.id}>{period.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="zxbud-grid2">
                  <div className="zxbud-field">
                    <label className="zxbud-label">Monto del Presupuesto</label>
                    <input
                      type="number"
                      step="0.01"
                      className="zxbud-input"
                      placeholder="0.00"
                      name="amount"
                      value={form.amount}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="zxbud-field">
                    <label className="zxbud-label">Sucursal</label>
                    <select
                      className="zxbud-select"
                      name="store_id"
                      value={form.store_id}
                      onChange={handleChange}
                    >
                      <option value="">Todas las Sucursales</option>
                      <option value="1">Atlixco</option>
                      <option value="2">Cholula</option>
                      <option value="3">Chipilo</option>
                    </select>
                  </div>
                </div>

                <div className="zxbud-grid2">
                  <div className="zxbud-field">
                    <label className="zxbud-label">Fecha de Inicio</label>
                    <input
                      type="date"
                      className="zxbud-input"
                      name="start_date"
                      value={form.start_date}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="zxbud-field">
                    <label className="zxbud-label">Fecha de Fin</label>
                    <input
                      type="date"
                      className="zxbud-input"
                      name="end_date"
                      value={form.end_date}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="zxbud-field">
                  <label className="zxbud-label">Descripción</label>
                  <textarea
                    className="zxbud-textarea"
                    placeholder="Describe el presupuesto..."
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows="3"
                  />
                </div>

                <label className="zxbud-check">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                  />
                  <span>Presupuesto Activo</span>
                </label>

                <div className="zxbud-mactions">
                  <button
                    type="button"
                    onClick={() => setShowBudgetModal(false)}
                    className="zxbud-btn grow"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="zxbud-btn solid grow"
                  >
                    {loading ? "Guardando…" : (selectedBudget ? "Actualizar" : "Crear Presupuesto")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BudgetManagement;
