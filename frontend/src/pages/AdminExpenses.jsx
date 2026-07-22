import { API_BASE_URL } from "../utils/constants";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { customerName } from "../utils/customerName";
import "./AdminExpenses.css";

const AdminExpenses = () => {
  const token = localStorage.getItem("token");
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("register");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    payment_method: 'transferencia',
    reference: '',
    payment_date: new Date().toISOString().split('T')[0]
  });
  
  const [form, setForm] = useState({
    category: "",
    account_code: "",
    amount: "",
    description: "",
    expense_date: new Date().toISOString().split('T')[0],
    vendor: "",
    payment_method: "",
    recurring: false,
    notes: "",
    customer_id: ""
  });
  const [customers, setCustomers] = useState([]);

  // Marketing Agency Expense Categories (mapped to chart of accounts)
  const expenseCategories = [
    {
      id: "payroll",
      name: "Nómina",
      code: "NÓ",
      budget: 110000,
      account_code: "6000",
      description: "Sueldos y salarios del equipo"
    },
    {
      id: "meta_ads",
      name: "Meta Ads",
      code: "MA",
      budget: 20000,
      account_code: "6001",
      description: "Facebook e Instagram Ads"
    },
    {
      id: "google_ads",
      name: "Google Ads",
      code: "GA",
      budget: 15000,
      account_code: "6002",
      description: "Google Search y Display"
    },
    {
      id: "tiktok_ads",
      name: "TikTok Ads",
      code: "TT",
      budget: 10000,
      account_code: "6003",
      description: "TikTok Advertising"
    },
    {
      id: "tools",
      name: "Herramientas",
      code: "HE",
      budget: 8000,
      account_code: "6004",
      description: "Canva, Adobe, Hootsuite, etc."
    },
    {
      id: "assets",
      name: "Assets/Stock",
      code: "AS",
      budget: 3000,
      account_code: "6005",
      description: "Fotos, videos, música stock"
    },
    {
      id: "freelancers",
      name: "Freelancers",
      code: "FR",
      budget: 15000,
      account_code: "6006",
      description: "Contratistas y colaboradores"
    },
    {
      id: "marketing_own",
      name: "Marketing Propio",
      code: "MP",
      budget: 5000,
      account_code: "6100",
      description: "Marketing de la agencia"
    },
    {
      id: "rent",
      name: "Renta Oficina",
      code: "RO",
      budget: 15000,
      account_code: "6200",
      description: "Renta de espacio"
    },
    {
      id: "internet",
      name: "Internet",
      code: "IN",
      budget: 1500,
      account_code: "6230",
      description: "Internet y telefonía"
    },
    {
      id: "software_subscriptions",
      name: "Software/SaaS",
      code: "SW",
      budget: 5000,
      account_code: "6240",
      description: "Suscripciones de software"
    },
    {
      id: "other",
      name: "Otros Gastos",
      code: "OT",
      budget: 8000,
      account_code: "6999",
      description: "Gastos varios"
    }
  ];

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenses(res.data || []);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category) => {
    setForm(prev => ({
      ...prev,
      category: category.id,
      account_code: category.account_code
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const expenseData = {
        category: form.category,
        description: form.description || expenseCategories.find(c => c.id === form.category)?.name || 'Gasto',
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        vendor: form.vendor || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        customer_id: form.customer_id || null
      };

      await axios.post(`${API_BASE_URL}/api/expenses/create`, expenseData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      alert("Gasto registrado exitosamente");
      
      setForm({
        category: "",
        account_code: "",
        amount: "",
        description: "",
        expense_date: new Date().toISOString().split('T')[0],
        vendor: "",
        payment_method: "",
        recurring: false,
        notes: "",
        customer_id: ""
      });

      fetchExpenses();
    } catch (err) {
      console.error("Error saving expense:", err);
      alert("Error al registrar el gasto: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePayExpense = (expense) => {
    setSelectedExpense(expense);
    setPaymentData({
      payment_method: 'transferencia',
      reference: '',
      payment_date: new Date().toISOString().split('T')[0]
    });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    try {
      setLoading(true);
      
      await axios.post(
        `${API_BASE_URL}/api/expenses/${selectedExpense.id}/pay`,
        paymentData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`Pago de ${formatCurrency(selectedExpense.amount)} registrado correctamente`);
      setShowPaymentModal(false);
      setSelectedExpense(null);
      fetchExpenses();
    } catch (err) {
      console.error("Error recording payment:", err);
      alert("Error al registrar pago: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const analytics = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
    const byCategory = {};
    
    expenseCategories.forEach(cat => {
      const categoryExpenses = expenses.filter(e => e.category === cat.id);
      const spent = categoryExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
      byCategory[cat.id] = {
        spent,
        budget: cat.budget,
        percentage: (spent / cat.budget) * 100,
        count: categoryExpenses.length
      };
    });
    
    const totalBudget = expenseCategories.reduce((sum, cat) => sum + cat.budget, 0);
    
    return { total, byCategory, totalBudget };
  }, [expenses]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  useEffect(() => {
    fetchExpenses();
    axios.get(`${API_BASE_URL}/customers`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setCustomers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCustomers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paidExpenses = expenses.filter(e => e.status === 'paid');
  const pendingExpenses = expenses.filter(e => e.status !== 'paid');

  return (
    <Layout>
      <div className="zxexp">
        <div className="zxexp-inner">
          {/* Header */}
          <div className="zxexp-head">
            <div>
              <div className="zxexp-eyebrow">Finanzas</div>
              <h1 className="zxexp-h1">Gestión de <span className="zxexp-serif">gastos</span></h1>
              <p className="zxexp-sub">Control de gastos operativos y contabilidad automática</p>
            </div>
            <div className="zxexp-actions">
              <button onClick={fetchExpenses} className="zxexp-btn">Actualizar</button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="zxexp-tiles">
            <div className="zxexp-tile lead">
              <span className="k">Total Gastos</span>
              <span className="v">{formatCurrency(analytics.total)}</span>
            </div>
            <div className="zxexp-tile">
              <span className="k">Registros</span>
              <span className="v">{expenses.length}</span>
            </div>
            <div className="zxexp-tile">
              <span className="k">Presupuesto</span>
              <span className="v">{formatCurrency(analytics.totalBudget)}</span>
            </div>
            <div className="zxexp-tile">
              <span className="k">Restante</span>
              <span className={`v ${analytics.totalBudget - analytics.total < 0 ? "bad" : "ok"}`}>{formatCurrency(analytics.totalBudget - analytics.total)}</span>
            </div>
          </div>

          <div className="zxexp-cols">
            {/* Registration Form */}
            <div>
              <div className="zxexp-panel">
                <h2>Registrar nuevo gasto</h2>

                <form onSubmit={handleSubmit} className="zxexp-form">
                  {/* Category Selection - Visual Cards */}
                  <div className="zxexp-field">
                    <label className="zxexp-label">Categoría del Gasto *</label>
                    <div className="zxexp-cats">
                      {expenseCategories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleCategorySelect(cat)}
                          className={`zxexp-cat${form.category === cat.id ? " active" : ""}`}
                        >
                          <span className="zxexp-mono">{cat.code}</span>
                          <div className="nm">{cat.name}</div>
                          <div className="bd">{formatCurrency(cat.budget)}</div>
                        </button>
                      ))}
                    </div>
                    {form.category && (
                      <p className="zxexp-hint">
                        {expenseCategories.find(c => c.id === form.category)?.description}
                      </p>
                    )}
                  </div>

                  {/* Amount and Date */}
                  <div className="zxexp-grid2">
                    <div className="zxexp-field">
                      <label className="zxexp-label">Monto *</label>
                      <div className="zxexp-money">
                        <span className="sign">$</span>
                        <input
                          type="number"
                          step="0.01"
                          name="amount"
                          value={form.amount}
                          onChange={(e) => setForm({...form, amount: e.target.value})}
                          className="zxexp-input"
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    <div className="zxexp-field">
                      <label className="zxexp-label">Fecha *</label>
                      <input
                        type="date"
                        name="expense_date"
                        value={form.expense_date}
                        onChange={(e) => setForm({...form, expense_date: e.target.value})}
                        className="zxexp-input"
                        required
                      />
                    </div>
                  </div>

                  {/* Vendor */}
                  <div className="zxexp-field">
                    <label className="zxexp-label">Proveedor / Vendor</label>
                    <input
                      type="text"
                      name="vendor"
                      value={form.vendor}
                      onChange={(e) => setForm({...form, vendor: e.target.value})}
                      className="zxexp-input"
                      placeholder="Nombre del proveedor"
                    />
                  </div>

                  {/* Client attribution (for ad spend / ROI per client) */}
                  <div className="zxexp-field">
                    <label className="zxexp-label">Cliente (opcional)</label>
                    <select
                      name="customer_id"
                      value={form.customer_id}
                      onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                      className="zxexp-input"
                    >
                      <option value="">Sin asignar</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{customerName(c)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="zxexp-field">
                    <label className="zxexp-label">Descripción *</label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={(e) => setForm({...form, description: e.target.value})}
                      rows="3"
                      className="zxexp-textarea"
                      placeholder="Describe el gasto..."
                      required
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="zxexp-field">
                    <label className="zxexp-label">Método de Pago</label>
                    <select
                      name="payment_method"
                      value={form.payment_method}
                      onChange={(e) => setForm({...form, payment_method: e.target.value})}
                      className="zxexp-select"
                    >
                      <option value="">Por pagar</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="cheque">Cheque</option>
                    </select>
                    <p className="zxexp-hint">
                      {form.payment_method ? 'Se registrará como pagado' : 'Se registrará como por pagar'}
                    </p>
                  </div>

                  {/* Notes */}
                  <div className="zxexp-field">
                    <label className="zxexp-label">Notas</label>
                    <input
                      type="text"
                      name="notes"
                      value={form.notes}
                      onChange={(e) => setForm({...form, notes: e.target.value})}
                      className="zxexp-input"
                      placeholder="Notas adicionales..."
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="zxexp-btn solid block"
                  >
                    {loading ? "Guardando…" : "Registrar Gasto"}
                  </button>
                </form>
              </div>
            </div>

            {/* Categories Sidebar */}
            <div>
              <div className="zxexp-panel zxexp-sticky">
                <h3>Presupuesto por categoría</h3>
                <div className="zxexp-budget">
                  {expenseCategories.map(category => {
                    const data = analytics.byCategory[category.id] || { spent: 0, percentage: 0, count: 0 };
                    const remaining = category.budget - data.spent;

                    return (
                      <div key={category.id} className="zxexp-brow">
                        <div className="zxexp-btop">
                          <div className="nm">
                            <span className="zxexp-mono sm">{category.code}</span>
                            <span>{category.name}</span>
                          </div>
                          <span className="cnt">{data.count} gastos</span>
                        </div>
                        <div className="zxexp-bnums">
                          {formatCurrency(data.spent)} / {formatCurrency(category.budget)}
                        </div>
                        <div className="zxexp-track">
                          <div
                            className={`zxexp-fill ${
                              data.percentage > 90 ? 'bad' :
                              data.percentage > 75 ? 'warn' :
                              ''
                            }`}
                            style={{ width: `${Math.min(data.percentage, 100)}%` }}
                          />
                        </div>
                        <div className="zxexp-bfoot">
                          <span>{data.percentage.toFixed(1)}%</span>
                          <span className={remaining < 0 ? 'over' : 'left'}>
                            {remaining < 0 ? 'Excedido' : `Quedan ${formatCurrency(remaining)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Expenses List */}
          <div className="zxexp-listhead">
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>Gastos registrados</h2>
            <div className="zxexp-filter">
              <button
                onClick={() => setActiveTab('all')}
                className={`zxexp-fbtn${activeTab === 'all' ? ' active' : ''}`}
              >
                Todos ({expenses.length})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`zxexp-fbtn${activeTab === 'pending' ? ' active' : ''}`}
              >
                Por Pagar ({pendingExpenses.length})
              </button>
              <button
                onClick={() => setActiveTab('paid')}
                className={`zxexp-fbtn${activeTab === 'paid' ? ' active' : ''}`}
              >
                Pagados ({paidExpenses.length})
              </button>
            </div>
          </div>

          <div className="zxexp-tablewrap">
            <table className="zxexp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th className="r">Monto</th>
                  <th className="c">Estado</th>
                  <th className="c">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {expenses
                  .filter(e => {
                    if (activeTab === 'pending') return e.status !== 'paid';
                    if (activeTab === 'paid') return e.status === 'paid';
                    return true;
                  })
                  .map((expense) => {
                  const category = expenseCategories.find(c => c.id === expense.category);
                  return (
                    <tr key={expense.id}>
                      <td>
                        {new Date(expense.expense_date || expense.created_at).toLocaleDateString('es-MX')}
                      </td>
                      <td>
                        <div className="zxexp-cellcat">
                          <span className="zxexp-mono sm">{category?.code || 'OT'}</span>
                          <span className="nm">{category?.name || expense.category}</span>
                        </div>
                      </td>
                      <td>
                        <div className="zxexp-desc">{expense.description}</div>
                        {expense.vendor && (
                          <div className="zxexp-meta">Proveedor: {expense.vendor}</div>
                        )}
                      </td>
                      <td className="r">
                        <div className="zxexp-amt">{formatCurrency(expense.amount)}</div>
                        {expense.payment_method && (
                          <div className="zxexp-meta">{expense.payment_method}</div>
                        )}
                      </td>
                      <td className="c">
                        <span className={`zxexp-pill ${
                          expense.status === 'paid' ? 'paid' :
                          expense.status === 'approved' ? 'approved' :
                          'pending'
                        }`}>
                          {expense.status === 'paid' ? 'Pagado' :
                           expense.status === 'approved' ? 'Aprobado' :
                           'Pendiente'}
                        </span>
                      </td>
                      <td className="c">
                        {expense.status !== 'paid' && (
                          <button
                            onClick={() => handlePayExpense(expense)}
                            className="zxexp-paybtn"
                          >
                            Pagar
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedExpense(expense);
                            setShowModal(true);
                          }}
                          className="zxexp-linkbtn"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <div className="zxexp-empty">
                        <p className="lead">No hay gastos registrados</p>
                        <p className="small">Registra tu primer gasto arriba</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedExpense && (
          <div className="zxexp-overlay">
            <div className="zxexp-modal">
              <div className="zxexp-mhead">
                <h3>Registrar pago de gasto</h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="zxexp-close"
                >
                  ×
                </button>
              </div>

              <div className="zxexp-recap">
                <p className="lbl">Gasto</p>
                <p className="val">{selectedExpense.description}</p>
                <p className="lbl">Categoría</p>
                <p className="val">{expenseCategories.find(c => c.id === selectedExpense.category)?.name}</p>
                <div className="zxexp-recap-total">
                  <span className="lbl">Monto</span>
                  <span className="big">{formatCurrency(selectedExpense.amount)}</span>
                </div>
              </div>

              <div className="zxexp-mbody">
                <div className="zxexp-field">
                  <label className="zxexp-label">Método de Pago *</label>
                  <select
                    value={paymentData.payment_method}
                    onChange={(e) => setPaymentData({...paymentData, payment_method: e.target.value})}
                    className="zxexp-select"
                  >
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div className="zxexp-field">
                  <label className="zxexp-label">Referencia / No. Transacción</label>
                  <input
                    type="text"
                    value={paymentData.reference}
                    onChange={(e) => setPaymentData({...paymentData, reference: e.target.value})}
                    className="zxexp-input"
                    placeholder="Ej: SPEI-123456, No. Cheque, etc."
                  />
                </div>

                <div className="zxexp-field">
                  <label className="zxexp-label">Fecha de Pago</label>
                  <input
                    type="date"
                    value={paymentData.payment_date}
                    onChange={(e) => setPaymentData({...paymentData, payment_date: e.target.value})}
                    className="zxexp-input"
                  />
                </div>

                <div className="zxexp-ledger">
                  <p className="t">
                    <strong>Asientos Contables:</strong> Al pagar, se crearán automáticamente:
                  </p>
                  <div className="lines">
                    <div>• Debe: {selectedExpense.category ? expenseCategories.find(c => c.id === selectedExpense.category)?.account_code : '6999'} (Gasto) - {formatCurrency(selectedExpense.amount)}</div>
                    <div>• Haber: {paymentData.payment_method === 'efectivo' ? '1101 (Caja)' : '1102 (Banco)'} - {formatCurrency(selectedExpense.amount)}</div>
                  </div>
                </div>

                <div className="zxexp-mactions">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="zxexp-btn grow"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRecordPayment}
                    disabled={loading}
                    className="zxexp-btn ok grow"
                  >
                    {loading ? 'Registrando…' : 'Registrar Pago'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Modal */}
        {showModal && selectedExpense && (
          <div className="zxexp-overlay">
            <div className="zxexp-modal wide">
              <div className="zxexp-mhead">
                <h3>Detalle del gasto</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="zxexp-close"
                >
                  ×
                </button>
              </div>

              <div className="zxexp-mbody">
                <div className="zxexp-dgrid">
                  <div className="zxexp-dfield">
                    <label className="lbl">Fecha</label>
                    <p className="val">{new Date(selectedExpense.expense_date || selectedExpense.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <div className="zxexp-dfield">
                    <label className="lbl">Categoría</label>
                    <p className="val">{expenseCategories.find(c => c.id === selectedExpense.category)?.name || selectedExpense.category}</p>
                  </div>
                  <div className="zxexp-dfield">
                    <label className="lbl">Monto</label>
                    <p className="val big">{formatCurrency(selectedExpense.amount)}</p>
                  </div>
                  <div className="zxexp-dfield">
                    <label className="lbl">Estado</label>
                    <p className="val">
                      {selectedExpense.status === 'paid' ? 'Pagado' : 'Pendiente'}
                    </p>
                  </div>
                </div>

                {selectedExpense.vendor && (
                  <div className="zxexp-dfield">
                    <label className="lbl">Proveedor</label>
                    <p className="val">{selectedExpense.vendor}</p>
                  </div>
                )}

                <div className="zxexp-dfield">
                  <label className="lbl">Descripción</label>
                  <p className="val" style={{ fontWeight: 400 }}>{selectedExpense.description || "Sin descripción"}</p>
                </div>

                {selectedExpense.notes && (
                  <div className="zxexp-dfield">
                    <label className="lbl">Notas</label>
                    <p className="val" style={{ fontWeight: 400 }}>{selectedExpense.notes}</p>
                  </div>
                )}

                {selectedExpense.payment_method && (
                  <div className="zxexp-payinfo">
                    <label className="t">Información de Pago</label>
                    <div className="zxexp-dgrid" style={{ marginTop: 8 }}>
                      <div className="row">
                        <span>Método:</span>
                        <span style={{ fontWeight: 600 }}>{selectedExpense.payment_method}</span>
                      </div>
                      {selectedExpense.payment_reference && (
                        <div className="row">
                          <span>Ref:</span>
                          <span style={{ fontWeight: 600 }}>{selectedExpense.payment_reference}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="zxexp-mactions">
                {selectedExpense.status !== 'paid' && (
                  <button
                    onClick={() => {
                      setShowModal(false);
                      handlePayExpense(selectedExpense);
                    }}
                    className="zxexp-btn ok grow"
                  >
                    Pagar Ahora
                  </button>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  className="zxexp-btn grow"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminExpenses;
