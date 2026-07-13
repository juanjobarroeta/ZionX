import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { customerName } from "../utils/customerName";
import "./Subscriptions.css";

const SubscriptionsManager = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchData();
  }, []);

  // Open the create modal when arrived via "Nueva Suscripción" (?new=1),
  // then strip the param so a refresh doesn't re-open it.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowModal(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [subsRes, customersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/income/subscriptions`, { headers }),
        axios.get(`${API_BASE_URL}/customers`, { headers })
      ]);

      setSubscriptions(subsRes.data);
      setCustomers(customersRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubscription = async (e) => {
    e.preventDefault();
    
    if (!monthlyAmount || parseFloat(monthlyAmount) <= 0) {
      alert("Por favor ingresa un monto mensual válido");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(
        `${API_BASE_URL}/api/income/subscriptions`,
        {
          customer_id: parseInt(selectedCustomer),
          monthly_amount: parseFloat(monthlyAmount),
          description: description || "Suscripción mensual",
          start_date: new Date().toISOString().split('T')[0],
          notes
        },
        { headers }
      );

      alert("¡Suscripción creada exitosamente!");
      setShowModal(false);
      setSelectedCustomer("");
      setMonthlyAmount("");
      setDescription("");
      setNotes("");
      fetchData();
    } catch (error) {
      console.error("Error creating subscription:", error);
      alert("Error al crear suscripción: " + (error.response?.data?.error || error.message));
    }
  };

  const handleCancelSubscription = async (subscriptionId) => {
    if (!confirm("¿Estás seguro de cancelar esta suscripción? Se marcará como inactiva.")) return;

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(
        `${API_BASE_URL}/api/income/subscriptions/${subscriptionId}/cancel`,
        { reason: "Cancelado por usuario" },
        { headers }
      );

      alert("Suscripción cancelada exitosamente");
      fetchData();
    } catch (error) {
      console.error("Error canceling subscription:", error);
      alert("Error al cancelar suscripción");
    }
  };

  const handleDeleteSubscription = async (subscriptionId, customerName) => {
    if (!confirm(`¿Estás seguro de ELIMINAR permanentemente la suscripción de ${customerName}?\n\nEsta acción no se puede deshacer.`)) return;

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      await axios.delete(
        `${API_BASE_URL}/api/income/subscriptions/${subscriptionId}`,
        { headers }
      );

      alert("Suscripción eliminada exitosamente");
      fetchData();
    } catch (error) {
      console.error("Error deleting subscription:", error);
      alert("Error al eliminar suscripción: " + (error.response?.data?.error || error.message));
    }
  };

  const openEditModal = (subscription) => {
    setEditingSubscription(subscription);
    setMonthlyAmount(subscription.effective_monthly_price || "");
    setNotes(subscription.notes || "");
    setShowEditModal(true);
  };

  const handleUpdateSubscription = async (e) => {
    e.preventDefault();
    
    if (!monthlyAmount || parseFloat(monthlyAmount) <= 0) {
      alert("Por favor ingresa un monto mensual válido");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      await axios.put(
        `${API_BASE_URL}/api/income/subscriptions/${editingSubscription.id}`,
        {
          custom_monthly_price: parseFloat(monthlyAmount),
          notes
        },
        { headers }
      );

      alert("¡Suscripción actualizada exitosamente!");
      setShowEditModal(false);
      setEditingSubscription(null);
      setMonthlyAmount("");
      setNotes("");
      fetchData();
    } catch (error) {
      console.error("Error updating subscription:", error);
      alert("Error al actualizar suscripción: " + (error.response?.data?.error || error.message));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { color: 'active', label: '✓ Activa' },
      paused: { color: 'paused', label: '⏸ Pausada' },
      cancelled: { color: 'cancelled', label: '✗ Cancelada' },
      expired: { color: 'expired', label: 'Expirada' }
    };
    const badge = badges[status] || badges.active;
    return <span className={`zxsub-pill ${badge.color}`}>{badge.label}</span>;
  };

  // Get customer name for display — use the shared helper so the dropdown shows
  // the nombre comercial (like every other list), not razón social.
  const getCustomerName = (customer) => customerName(customer);

  if (loading) {
    return (
      <Layout>
        <div className="zxsub">
          <div className="zxsub-loading">Cargando suscripciones…</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxsub">
        <div className="zxsub-inner">
          {/* Header */}
          <div className="zxsub-head">
            <div>
              <div className="zxsub-eyebrow">Finanzas</div>
              <h1 className="zxsub-h1">Gestión de <span className="zxsub-serif">Suscripciones</span></h1>
              <p className="zxsub-sub">
                {subscriptions.filter(s => s.status === 'active').length} suscripciones activas
              </p>
            </div>
            <div className="zxsub-actions">
              <Link to="/income" className="zxsub-btn">← Volver</Link>
              <button
                onClick={() => setShowModal(true)}
                className="zxsub-btn solid"
              >
                ➕ Nueva Suscripción
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="zxsub-tiles">
            <div className="zxsub-tile">
              <span className="k">Activas</span>
              <span className="v ok">
                {subscriptions.filter(s => s.status === 'active').length}
              </span>
            </div>

            <div className="zxsub-tile">
              <span className="k">Pausadas</span>
              <span className="v warn">
                {subscriptions.filter(s => s.status === 'paused').length}
              </span>
            </div>

            <div className="zxsub-tile">
              <span className="k">Canceladas</span>
              <span className="v bad">
                {subscriptions.filter(s => s.status === 'cancelled').length}
              </span>
            </div>

            <div className="zxsub-tile lead">
              <span className="k">MRR Total</span>
              <span className="v">
                {formatCurrency(
                  subscriptions
                    .filter(s => s.status === 'active')
                    .reduce((sum, s) => sum + parseFloat(s.effective_monthly_price || 0), 0)
                )}
              </span>
            </div>
          </div>

          {/* Subscriptions List */}
          <div className="zxsub-card">
            <div className="zxsub-card-head">
              <h2>Todas las Suscripciones</h2>
            </div>

            <div className="zxsub-tablewrap">
              <table className="zxsub-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Descripción</th>
                    <th>Monto Mensual</th>
                    <th>Estado</th>
                    <th>Próx. Facturación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.length > 0 ? (
                    subscriptions.map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <div>
                            <div className="zxsub-cust-name">{sub.customer_name}</div>
                            <div className="zxsub-cust-mail">{sub.customer_email}</div>
                          </div>
                        </td>
                        <td>
                          <div className="zxsub-desc">{sub.notes || sub.package_name || 'Suscripción mensual'}</div>
                        </td>
                        <td>
                          <div className="zxsub-amt">
                            {formatCurrency(sub.effective_monthly_price)}
                          </div>
                          <div className="zxsub-amt-iva">
                            Con IVA: {formatCurrency(parseFloat(sub.effective_monthly_price) * 1.16)}
                          </div>
                        </td>
                        <td>
                          {getStatusBadge(sub.status)}
                        </td>
                        <td className="zxsub-date">
                          {sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString('es-MX') : '-'}
                        </td>
                        <td>
                          <div className="zxsub-rowacts">
                            {sub.status === 'active' && (
                              <>
                                <button
                                  onClick={() => openEditModal(sub)}
                                  className="zxsub-act"
                                  title="Modificar suscripción"
                                >
                                  ✏️ Modificar
                                </button>
                                <Link
                                  to={`/income/invoice-generator?subscription_id=${sub.id}&customer_id=${sub.customer_id}`}
                                  className="zxsub-act"
                                >
                                  Facturar
                                </Link>
                                <button
                                  onClick={() => handleCancelSubscription(sub.id)}
                                  className="zxsub-act warn"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteSubscription(sub.id, sub.customer_name)}
                              className="zxsub-act bad"
                              title="Eliminar permanentemente"
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="zxsub-empty">
                        <span className="ico">📋</span>
                        <p>No hay suscripciones aún</p>
                        <button
                          onClick={() => setShowModal(true)}
                          className="cta"
                        >
                          Crear primera suscripción →
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Create Subscription Modal - SIMPLIFIED */}
        {showModal && (
          <div className="zxsub-scrim">
            <div className="zxsub-modal">
              <h2>➕ Nueva Suscripción</h2>

              <form onSubmit={handleCreateSubscription} className="zxsub-form">
                {/* Customer Select */}
                <div className="zxsub-fgroup">
                  <label className="zxsub-label">Cliente *</label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    required
                    className="zxsub-select"
                  >
                    <option value="">Seleccionar cliente...</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {getCustomerName(customer)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Monthly Amount - DIRECT INPUT */}
                <div className="zxsub-fgroup">
                  <label className="zxsub-label">
                    💰 Monto Mensual (sin IVA) *
                  </label>
                  <div className="zxsub-inputwrap">
                    <span className="prefix">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={monthlyAmount}
                      onChange={(e) => setMonthlyAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className="zxsub-input"
                    />
                  </div>
                  {monthlyAmount && parseFloat(monthlyAmount) > 0 && (
                    <div className="zxsub-breakdown">
                      <div className="zxsub-brow">
                        <span className="lbl">Subtotal:</span>
                        <span className="val">{formatCurrency(parseFloat(monthlyAmount))}</span>
                      </div>
                      <div className="zxsub-brow">
                        <span className="lbl">IVA (16%):</span>
                        <span className="val">{formatCurrency(parseFloat(monthlyAmount) * 0.16)}</span>
                      </div>
                      <div className="zxsub-brow total">
                        <span>Total Mensual:</span>
                        <span className="val">{formatCurrency(parseFloat(monthlyAmount) * 1.16)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="zxsub-fgroup">
                  <label className="zxsub-label">Descripción (opcional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: Manejo de redes sociales"
                    className="zxsub-input"
                  />
                </div>

                {/* Notes */}
                <div className="zxsub-fgroup">
                  <label className="zxsub-label">Notas (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="zxsub-textarea"
                    placeholder="Ej: Contrato de 12 meses"
                  />
                </div>

                {/* Buttons */}
                <div className="zxsub-modal-btns">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setSelectedCustomer("");
                      setMonthlyAmount("");
                      setDescription("");
                      setNotes("");
                    }}
                    className="zxsub-mbtn"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedCustomer || !monthlyAmount}
                    className="zxsub-mbtn solid"
                  >
                    Crear Suscripción
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Subscription Modal */}
        {showEditModal && editingSubscription && (
          <div className="zxsub-scrim">
            <div className="zxsub-modal">
              <h2>✏️ Modificar Suscripción</h2>

              <div className="zxsub-modal-cust">
                <p className="k">Cliente:</p>
                <p className="v">{editingSubscription.customer_name}</p>
              </div>

              <form onSubmit={handleUpdateSubscription} className="zxsub-form">
                {/* Monthly Amount */}
                <div className="zxsub-fgroup">
                  <label className="zxsub-label">
                    💰 Monto Mensual (sin IVA) *
                  </label>
                  <div className="zxsub-inputwrap">
                    <span className="prefix">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={monthlyAmount}
                      onChange={(e) => setMonthlyAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className="zxsub-input"
                    />
                  </div>
                  {monthlyAmount && parseFloat(monthlyAmount) > 0 && (
                    <div className="zxsub-breakdown">
                      <div className="zxsub-brow">
                        <span className="lbl">Subtotal:</span>
                        <span className="val">{formatCurrency(parseFloat(monthlyAmount))}</span>
                      </div>
                      <div className="zxsub-brow">
                        <span className="lbl">IVA (16%):</span>
                        <span className="val">{formatCurrency(parseFloat(monthlyAmount) * 0.16)}</span>
                      </div>
                      <div className="zxsub-brow total">
                        <span>Total Mensual:</span>
                        <span className="val">{formatCurrency(parseFloat(monthlyAmount) * 1.16)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="zxsub-fgroup">
                  <label className="zxsub-label">Notas</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="zxsub-textarea"
                    placeholder="Notas sobre la suscripción..."
                  />
                </div>

                {/* Buttons */}
                <div className="zxsub-modal-btns">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingSubscription(null);
                      setMonthlyAmount("");
                      setNotes("");
                    }}
                    className="zxsub-mbtn"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!monthlyAmount}
                    className="zxsub-mbtn solid"
                  >
                    Guardar Cambios
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

export default SubscriptionsManager;
