import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

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

  useEffect(() => {
    fetchData();
  }, []);

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
      active: { color: 'bg-green-100 text-green-800', label: '✓ Activa' },
      paused: { color: 'bg-yellow-100 text-yellow-800', label: '⏸ Pausada' },
      cancelled: { color: 'bg-red-100 text-red-800', label: '✗ Cancelada' },
      expired: { color: 'bg-gray-100 text-gray-800', label: 'Expirada' }
    };
    const badge = badges[status] || badges.active;
    return <span className={`px-2 py-1 rounded-full text-xs ${badge.color}`}>{badge.label}</span>;
  };

  // Get customer name for display
  const getCustomerName = (customer) => {
    if (!customer) return 'Cliente';
    return customer.business_name || customer.commercial_name || 
           `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Cliente';
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
                <h1 className="text-2xl font-semibold text-black">📋 Gestión de Suscripciones</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {subscriptions.filter(s => s.status === 'active').length} suscripciones activas
                </p>
              </div>
              <div className="flex space-x-3">
                <Link
                  to="/income"
                  className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Volver
                </Link>
                <button
                  onClick={() => setShowModal(true)}
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  ➕ Nueva Suscripción
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✓</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Activas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {subscriptions.filter(s => s.status === 'active').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⏸</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pausadas</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {subscriptions.filter(s => s.status === 'paused').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✗</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Canceladas</p>
                  <p className="text-2xl font-bold text-red-600">
                    {subscriptions.filter(s => s.status === 'cancelled').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
                <div>
                  <p className="text-sm text-purple-100">MRR Total</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      subscriptions
                        .filter(s => s.status === 'active')
                        .reduce((sum, s) => sum + parseFloat(s.effective_monthly_price || 0), 0)
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Subscriptions List */}
          <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-zionx-primary">Todas las Suscripciones</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto Mensual</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Próx. Facturación</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subscriptions.length > 0 ? (
                    subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">{sub.customer_name}</div>
                            <div className="text-sm text-gray-500">{sub.customer_email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{sub.notes || sub.package_name || 'Suscripción mensual'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-zionx-primary">
                            {formatCurrency(sub.effective_monthly_price)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Con IVA: {formatCurrency(parseFloat(sub.effective_monthly_price) * 1.16)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(sub.status)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString('es-MX') : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2 flex-wrap gap-1">
                            {sub.status === 'active' && (
                              <>
                                <button
                                  onClick={() => openEditModal(sub)}
                                  className="text-purple-600 hover:text-purple-800 text-sm"
                                  title="Modificar suscripción"
                                >
                                  ✏️ Modificar
                                </button>
                                <Link
                                  to={`/income/invoice-generator?subscription_id=${sub.id}&customer_id=${sub.customer_id}`}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  Facturar
                                </Link>
                                <button
                                  onClick={() => handleCancelSubscription(sub.id)}
                                  className="text-yellow-600 hover:text-yellow-800 text-sm"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteSubscription(sub.id, sub.customer_name)}
                              className="text-red-600 hover:text-red-800 text-sm"
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
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <span className="text-4xl mb-2">📋</span>
                          <p>No hay suscripciones aún</p>
                          <button
                            onClick={() => setShowModal(true)}
                            className="mt-4 text-blue-600 hover:text-blue-800"
                          >
                            Crear primera suscripción →
                          </button>
                        </div>
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-zionx-primary mb-4">➕ Nueva Suscripción</h2>
              
              <form onSubmit={handleCreateSubscription} className="space-y-4">
                {/* Customer Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💰 Monto Mensual (sin IVA) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={monthlyAmount}
                      onChange={(e) => setMonthlyAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                    />
                  </div>
                  {monthlyAmount && parseFloat(monthlyAmount) > 0 && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(parseFloat(monthlyAmount))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">IVA (16%):</span>
                        <span className="font-medium">{formatCurrency(parseFloat(monthlyAmount) * 0.16)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                        <span>Total Mensual:</span>
                        <span className="text-green-600">{formatCurrency(parseFloat(monthlyAmount) * 1.16)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: Manejo de redes sociales"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                    placeholder="Ej: Contrato de 12 meses"
                  />
                </div>

                {/* Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setSelectedCustomer("");
                      setMonthlyAmount("");
                      setDescription("");
                      setNotes("");
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedCustomer || !monthlyAmount}
                    className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-zionx-primary mb-4">✏️ Modificar Suscripción</h2>
              
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Cliente:</p>
                <p className="font-semibold text-zionx-primary">{editingSubscription.customer_name}</p>
              </div>
              
              <form onSubmit={handleUpdateSubscription} className="space-y-4">
                {/* Monthly Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💰 Monto Mensual (sin IVA) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={monthlyAmount}
                      onChange={(e) => setMonthlyAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                    />
                  </div>
                  {monthlyAmount && parseFloat(monthlyAmount) > 0 && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(parseFloat(monthlyAmount))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">IVA (16%):</span>
                        <span className="font-medium">{formatCurrency(parseFloat(monthlyAmount) * 0.16)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                        <span>Total Mensual:</span>
                        <span className="text-green-600">{formatCurrency(parseFloat(monthlyAmount) * 1.16)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                    placeholder="Notas sobre la suscripción..."
                  />
                </div>

                {/* Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingSubscription(null);
                      setMonthlyAmount("");
                      setNotes("");
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!monthlyAmount}
                    className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
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
