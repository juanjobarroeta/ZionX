import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const PaymentManagement = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [filter, setFilter] = useState("all"); // all, overdue, upcoming, paid

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [subsRes, invoicesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/income/subscriptions`, { headers }),
        axios.get(`${API_BASE_URL}/api/income/invoices`, { headers }).catch(() => ({ data: [] }))
      ]);

      setSubscriptions(subsRes.data || []);
      setInvoices(invoicesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate payment status for each subscription
  const getPaymentStatus = (sub) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextBilling = sub.next_billing_date ? new Date(sub.next_billing_date) : null;
    
    if (!nextBilling) return { status: 'unknown', label: 'Sin fecha', color: 'gray' };
    
    nextBilling.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.ceil((nextBilling - today) / (1000 * 60 * 60 * 24));
    
    // Check if there's a paid invoice for this period
    const hasPaidInvoice = invoices.some(inv => 
      inv.subscription_id === sub.id && 
      inv.status === 'paid' &&
      new Date(inv.billing_period_end) >= nextBilling
    );
    
    if (hasPaidInvoice) {
      return { status: 'paid', label: '✓ Pagado', color: 'green', days: daysUntilDue };
    } else if (daysUntilDue < 0) {
      return { status: 'overdue', label: `⚠️ Vencido (${Math.abs(daysUntilDue)} días)`, color: 'red', days: daysUntilDue };
    } else if (daysUntilDue <= 7) {
      return { status: 'upcoming', label: `⏰ Vence en ${daysUntilDue} días`, color: 'yellow', days: daysUntilDue };
    } else {
      return { status: 'pending', label: `📅 ${daysUntilDue} días`, color: 'blue', days: daysUntilDue };
    }
  };

  // Filter subscriptions
  const filteredSubscriptions = subscriptions
    .filter(sub => sub.status === 'active')
    .map(sub => ({ ...sub, paymentStatus: getPaymentStatus(sub) }))
    .filter(sub => {
      if (filter === 'all') return true;
      if (filter === 'overdue') return sub.paymentStatus.status === 'overdue';
      if (filter === 'upcoming') return sub.paymentStatus.status === 'upcoming';
      if (filter === 'paid') return sub.paymentStatus.status === 'paid';
      return true;
    })
    .sort((a, b) => (a.paymentStatus.days || 999) - (b.paymentStatus.days || 999));

  // Stats
  const stats = {
    total: subscriptions.filter(s => s.status === 'active').length,
    overdue: subscriptions.filter(s => s.status === 'active' && getPaymentStatus(s).status === 'overdue').length,
    upcoming: subscriptions.filter(s => s.status === 'active' && getPaymentStatus(s).status === 'upcoming').length,
    paid: subscriptions.filter(s => s.status === 'active' && getPaymentStatus(s).status === 'paid').length,
    overdueAmount: subscriptions
      .filter(s => s.status === 'active' && getPaymentStatus(s).status === 'overdue')
      .reduce((sum, s) => sum + parseFloat(s.effective_monthly_price || 0), 0),
    upcomingAmount: subscriptions
      .filter(s => s.status === 'active' && getPaymentStatus(s).status === 'upcoming')
      .reduce((sum, s) => sum + parseFloat(s.effective_monthly_price || 0), 0)
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  const openPaymentModal = (sub) => {
    setSelectedSubscription(sub);
    setPaymentAmount(sub.effective_monthly_price || "");
    setPaymentMethod("transfer");
    setPaymentReference("");
    setPaymentNotes("");
    setShowPaymentModal(true);
  };

  const openReminderModal = (sub) => {
    setSelectedSubscription(sub);
    setShowReminderModal(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // First, create an invoice if none exists
      const invoiceData = {
        customer_id: selectedSubscription.customer_id,
        subscription_id: selectedSubscription.id,
        due_date: selectedSubscription.next_billing_date,
        items: [{
          description: `Suscripción mensual - ${selectedSubscription.customer_name}`,
          quantity: 1,
          unit_price: parseFloat(paymentAmount),
          item_type: 'subscription'
        }]
      };

      // Generate invoice
      const invoiceRes = await axios.post(
        `${API_BASE_URL}/api/income/invoices/generate`,
        invoiceData,
        { headers }
      );

      const invoiceId = invoiceRes.data.id;

      // Record payment
      await axios.post(
        `${API_BASE_URL}/api/income/invoices/${invoiceId}/payments`,
        {
          amount: parseFloat(paymentAmount) * 1.16, // Include IVA
          payment_method: paymentMethod,
          reference_number: paymentReference,
          notes: paymentNotes
        },
        { headers }
      );

      // Update subscription next_billing_date
      const nextDate = new Date(selectedSubscription.next_billing_date);
      nextDate.setMonth(nextDate.getMonth() + 1);
      
      await axios.put(
        `${API_BASE_URL}/api/income/subscriptions/${selectedSubscription.id}`,
        { next_billing_date: nextDate.toISOString().split('T')[0] },
        { headers }
      ).catch(() => {}); // Ignore if endpoint doesn't support this

      alert("¡Pago registrado exitosamente!");
      setShowPaymentModal(false);
      setSelectedSubscription(null);
      fetchData();
    } catch (error) {
      console.error("Error recording payment:", error);
      alert("Error al registrar pago: " + (error.response?.data?.error || error.message));
    }
  };

  const generateWhatsAppReminder = (sub, isOverdue = false) => {
    const amount = formatCurrency(parseFloat(sub.effective_monthly_price) * 1.16);
    const dueDate = new Date(sub.next_billing_date).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    if (isOverdue) {
      return `¡Hola! 👋\n\nTe recordamos que tu pago de *${amount}* correspondiente a tu suscripción de servicios de marketing venció el *${dueDate}*.\n\nPor favor realiza tu pago a la brevedad para evitar interrupciones en el servicio.\n\n📱 ¿Tienes alguna duda? Responde a este mensaje.\n\nGracias por tu preferencia! 🙏`;
    } else {
      return `¡Hola! 👋\n\nTe recordamos que tu próximo pago de *${amount}* por servicios de marketing vence el *${dueDate}*.\n\nDatos bancarios:\n🏦 Banco: BBVA\n📝 CLABE: XXXX XXXX XXXX XXXX XX\n👤 Beneficiario: ZIONX Marketing\n\nUna vez realizado, envíanos tu comprobante por este medio.\n\n¡Gracias! 🙏`;
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("¡Mensaje copiado al portapapeles!");
  };

  const openWhatsApp = (phone, message) => {
    const cleanPhone = phone?.replace(/\D/g, '') || '';
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/52${cleanPhone}?text=${encodedMessage}`, '_blank');
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
                <h1 className="text-2xl font-semibold text-black">💳 Gestión de Pagos</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Control de cobros, recordatorios y pagos vencidos
                </p>
              </div>
              <div className="flex space-x-3">
                <Link
                  to="/income"
                  className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Volver
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Alert Banner for Overdue */}
          {stats.overdue > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚠️</span>
                <div>
                  <p className="font-semibold text-red-800">
                    {stats.overdue} pago{stats.overdue > 1 ? 's' : ''} vencido{stats.overdue > 1 ? 's' : ''}
                  </p>
                  <p className="text-red-600 text-sm">
                    Total vencido: {formatCurrency(stats.overdueAmount * 1.16)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFilter('overdue')}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Ver vencidos
              </button>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div 
              onClick={() => setFilter('all')}
              className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${filter === 'all' ? 'border-black' : 'border-zionx-secondary hover:border-gray-300'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📋</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Activos</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                </div>
              </div>
            </div>

            <div 
              onClick={() => setFilter('overdue')}
              className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${filter === 'overdue' ? 'border-red-500' : 'border-zionx-secondary hover:border-red-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vencidos</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                  <p className="text-xs text-red-500">{formatCurrency(stats.overdueAmount * 1.16)}</p>
                </div>
              </div>
            </div>

            <div 
              onClick={() => setFilter('upcoming')}
              className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${filter === 'upcoming' ? 'border-yellow-500' : 'border-zionx-secondary hover:border-yellow-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⏰</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Próximos 7 días</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.upcoming}</p>
                  <p className="text-xs text-yellow-600">{formatCurrency(stats.upcomingAmount * 1.16)}</p>
                </div>
              </div>
            </div>

            <div 
              onClick={() => setFilter('paid')}
              className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${filter === 'paid' ? 'border-green-500' : 'border-zionx-secondary hover:border-green-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pagados</p>
                  <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Subscriptions List */}
          <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zionx-primary">
                {filter === 'all' && 'Todas las Suscripciones Activas'}
                {filter === 'overdue' && '⚠️ Pagos Vencidos'}
                {filter === 'upcoming' && '⏰ Próximos a Vencer (7 días)'}
                {filter === 'paid' && '✅ Pagos al Corriente'}
              </h2>
              <span className="text-sm text-gray-500">{filteredSubscriptions.length} registros</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Vencimiento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSubscriptions.length > 0 ? (
                    filteredSubscriptions.map((sub) => (
                      <tr key={sub.id} className={`hover:bg-gray-50 ${sub.paymentStatus.status === 'overdue' ? 'bg-red-50' : ''}`}>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">{sub.customer_name}</div>
                            <div className="text-sm text-gray-500">{sub.customer_email || sub.customer_phone || '-'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-zionx-primary">
                            {formatCurrency(parseFloat(sub.effective_monthly_price) * 1.16)}
                          </div>
                          <div className="text-xs text-gray-500">
                            ({formatCurrency(sub.effective_monthly_price)} + IVA)
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {sub.next_billing_date 
                              ? new Date(sub.next_billing_date).toLocaleDateString('es-MX', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : '-'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium
                            ${sub.paymentStatus.color === 'red' ? 'bg-red-100 text-red-800' : ''}
                            ${sub.paymentStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : ''}
                            ${sub.paymentStatus.color === 'green' ? 'bg-green-100 text-green-800' : ''}
                            ${sub.paymentStatus.color === 'blue' ? 'bg-blue-100 text-blue-800' : ''}
                            ${sub.paymentStatus.color === 'gray' ? 'bg-gray-100 text-gray-800' : ''}
                          `}>
                            {sub.paymentStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2 flex-wrap gap-1">
                            {sub.paymentStatus.status !== 'paid' && (
                              <>
                                <button
                                  onClick={() => openPaymentModal(sub)}
                                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                >
                                  💰 Registrar Pago
                                </button>
                                <button
                                  onClick={() => openReminderModal(sub)}
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                                >
                                  📱 Recordatorio
                                </button>
                              </>
                            )}
                            {sub.paymentStatus.status === 'paid' && (
                              <span className="text-green-600 text-sm">✓ Al corriente</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <span className="text-4xl mb-2">📋</span>
                          <p>No hay suscripciones en esta categoría</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Record Payment Modal */}
        {showPaymentModal && selectedSubscription && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-zionx-primary mb-4">💰 Registrar Pago</h2>
              
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Cliente:</p>
                <p className="font-semibold text-zionx-primary">{selectedSubscription.customer_name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Vencimiento: {new Date(selectedSubscription.next_billing_date).toLocaleDateString('es-MX')}
                </p>
              </div>
              
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto Recibido (con IVA)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={(parseFloat(paymentAmount) * 1.16).toFixed(2)}
                      onChange={(e) => setPaymentAmount((parseFloat(e.target.value) / 1.16).toFixed(2))}
                      required
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="transfer">🏦 Transferencia Bancaria</option>
                    <option value="cash">💵 Efectivo</option>
                    <option value="card">💳 Tarjeta</option>
                    <option value="check">📝 Cheque</option>
                    <option value="other">📋 Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia (opcional)</label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Número de transferencia, folio, etc."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Observaciones..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    ✓ Confirmar Pago
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reminder Modal */}
        {showReminderModal && selectedSubscription && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
              <h2 className="text-xl font-bold text-zionx-primary mb-4">📱 Enviar Recordatorio</h2>
              
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="font-semibold">{selectedSubscription.customer_name}</p>
                <p className="text-sm text-gray-500">
                  Monto: {formatCurrency(parseFloat(selectedSubscription.effective_monthly_price) * 1.16)}
                </p>
                <p className="text-sm text-gray-500">
                  Vence: {new Date(selectedSubscription.next_billing_date).toLocaleDateString('es-MX')}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensaje de WhatsApp:
                  </label>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm whitespace-pre-wrap">
                    {generateWhatsAppReminder(
                      selectedSubscription, 
                      getPaymentStatus(selectedSubscription).status === 'overdue'
                    )}
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => copyToClipboard(generateWhatsAppReminder(
                      selectedSubscription,
                      getPaymentStatus(selectedSubscription).status === 'overdue'
                    ))}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                  >
                    📋 Copiar Mensaje
                  </button>
                  <button
                    onClick={() => {
                      // Get customer phone from the full customer data if available
                      const phone = selectedSubscription.customer_phone || '';
                      openWhatsApp(phone, generateWhatsAppReminder(
                        selectedSubscription,
                        getPaymentStatus(selectedSubscription).status === 'overdue'
                      ));
                    }}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    📱 Abrir WhatsApp
                  </button>
                </div>

                <button
                  onClick={() => setShowReminderModal(false)}
                  className="w-full bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200"
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

export default PaymentManagement;


