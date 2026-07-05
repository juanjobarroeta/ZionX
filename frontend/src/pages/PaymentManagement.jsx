import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./PaymentManagement.css";

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

  // Combine unpaid invoices with subscriptions that don't have invoices
  const paymentItems = [];
  
  // Add all unpaid/partial invoices
  invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .forEach(invoice => {
      const today = new Date();
      const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
      const daysUntilDue = dueDate ? Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)) : 999;
      
      let status, label, color;
      if (invoice.status === 'partial') {
        status = 'partial';
        label = `⏳ Pago Parcial (${formatCurrency(invoice.amount_paid)} de ${formatCurrency(invoice.total)})`;
        color = 'yellow';
      } else if (daysUntilDue < 0) {
        status = 'overdue';
        label = `⚠️ Vencida hace ${Math.abs(daysUntilDue)} días`;
        color = 'red';
      } else if (daysUntilDue <= 7) {
        status = 'upcoming';
        label = `⏰ Vence en ${daysUntilDue} días`;
        color = 'yellow';
      } else {
        status = 'pending';
        label = `📅 Vence en ${daysUntilDue} días`;
        color = 'blue';
      }
      
      paymentItems.push({
        type: 'invoice',
        id: `inv-${invoice.id}`,
        invoice_id: invoice.id,
        subscription_id: invoice.subscription_id,
        customer_name: invoice.customer_name,
        customer_email: invoice.customer_email,
        amount: invoice.total,
        amount_due: invoice.amount_due || invoice.total,
        due_date: invoice.due_date,
        invoice_number: invoice.invoice_number,
        paymentStatus: { status, label, color, days: daysUntilDue }
      });
    });
  
  // Add subscriptions that DON'T have unpaid invoices
  subscriptions
    .filter(sub => sub.status === 'active')
    .filter(sub => {
      // Exclude if there's an unpaid invoice for this subscription
      const hasUnpaidInvoice = invoices.some(inv => 
        inv.subscription_id === sub.id && 
        inv.status !== 'paid' && 
        inv.status !== 'cancelled'
      );
      return !hasUnpaidInvoice;
    })
    .forEach(sub => {
      const status = getPaymentStatus(sub);
      paymentItems.push({
        type: 'subscription',
        id: `sub-${sub.id}`,
        subscription_id: sub.id,
        customer_id: sub.customer_id,
        customer_name: sub.customer_name,
        customer_email: sub.customer_email,
        amount: parseFloat(sub.effective_monthly_price) * 1.16, // Include IVA for display
        amount_due: parseFloat(sub.effective_monthly_price) * 1.16,
        due_date: sub.next_billing_date,
        paymentStatus: status
      });
    });
  
  // Filter payment items
  const filteredPaymentItems = paymentItems
    .filter(item => {
      if (filter === 'all') return true;
      if (filter === 'overdue') return item.paymentStatus.status === 'overdue';
      if (filter === 'upcoming') return item.paymentStatus.status === 'upcoming';
      if (filter === 'paid') return item.paymentStatus.status === 'paid';
      return true;
    })
    .sort((a, b) => (a.paymentStatus.days || 999) - (b.paymentStatus.days || 999));

  // Stats based on payment items (invoices + subscriptions without invoices)
  const stats = {
    total: paymentItems.length,
    overdue: paymentItems.filter(item => item.paymentStatus.status === 'overdue').length,
    upcoming: paymentItems.filter(item => item.paymentStatus.status === 'upcoming').length,
    paid: invoices.filter(inv => inv.status === 'paid').length,
    overdueAmount: paymentItems
      .filter(item => item.paymentStatus.status === 'overdue')
      .reduce((sum, item) => sum + parseFloat(item.amount_due || 0), 0),
    upcomingAmount: paymentItems
      .filter(item => item.paymentStatus.status === 'upcoming')
      .reduce((sum, item) => sum + parseFloat(item.amount_due || 0), 0)
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
        `${API_BASE_URL}/api/income/invoices/${invoiceId}/payment`,
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
        <div className="zxpay">
          <div className="zxpay-loading">
            <div className="zxpay-spinner"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxpay">
        <div className="zxpay-inner">
          {/* Header */}
          <div className="zxpay-head">
            <div>
              <div className="zxpay-eyebrow">Finanzas</div>
              <h1 className="zxpay-h1">Gestión de <span className="zxpay-serif">pagos</span></h1>
              <p className="zxpay-sub">Control de cobros, recordatorios y pagos vencidos</p>
            </div>
            <div className="zxpay-actions">
              <Link to="/income" className="zxpay-btn">← Volver</Link>
            </div>
          </div>

          {/* Alert Banner for Overdue */}
          {stats.overdue > 0 && (
            <div className="zxpay-alert">
              <div className="zxpay-alert-l">
                <span className="zxpay-alert-ico">⚠️</span>
                <div>
                  <p className="t">
                    {stats.overdue} pago{stats.overdue > 1 ? 's' : ''} vencido{stats.overdue > 1 ? 's' : ''}
                  </p>
                  <p className="s">
                    Total vencido: {formatCurrency(stats.overdueAmount)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFilter('overdue')}
                className="zxpay-btn solid"
              >
                Ver vencidos
              </button>
            </div>
          )}

          {/* Stats Cards */}
          <div className="zxpay-tiles">
            <button
              onClick={() => setFilter('all')}
              className={`zxpay-tile ${filter === 'all' ? 'active' : ''}`}
            >
              <span className="k">📋 Total Activos</span>
              <span className="v">{stats.total}</span>
            </button>

            <button
              onClick={() => setFilter('overdue')}
              className={`zxpay-tile ${filter === 'overdue' ? 'active' : ''}`}
            >
              <span className="k">⚠️ Vencidos</span>
              <span className="v bad">{stats.overdue}</span>
              <span className="sub">{formatCurrency(stats.overdueAmount)}</span>
            </button>

            <button
              onClick={() => setFilter('upcoming')}
              className={`zxpay-tile ${filter === 'upcoming' ? 'active' : ''}`}
            >
              <span className="k">⏰ Próximos 7 días</span>
              <span className="v warn">{stats.upcoming}</span>
              <span className="sub">{formatCurrency(stats.upcomingAmount)}</span>
            </button>

            <button
              onClick={() => setFilter('paid')}
              className={`zxpay-tile ${filter === 'paid' ? 'active' : ''}`}
            >
              <span className="k">✅ Pagados</span>
              <span className="v ok">{stats.paid}</span>
            </button>
          </div>

          {/* Subscriptions List */}
          <div className="zxpay-panel">
            <div className="zxpay-panel-head">
              <h2>
                {filter === 'all' && 'Todos los Pagos Pendientes'}
                {filter === 'overdue' && '⚠️ Pagos Vencidos'}
                {filter === 'upcoming' && '⏰ Próximos a Vencer (7 días)'}
                {filter === 'paid' && '✅ Pagos al Corriente'}
              </h2>
              <span className="zxpay-count">{filteredPaymentItems.length} registros</span>
            </div>

            <div className="zxpay-tablewrap">
              <table className="zxpay-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Monto</th>
                    <th>Fecha Vencimiento</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPaymentItems.length > 0 ? (
                    filteredPaymentItems.map((item) => (
                      <tr key={item.id} className={item.paymentStatus.status === 'overdue' ? 'over' : ''}>
                        <td>
                          <div className="zxpay-cust">
                            <div className="name">{item.customer_name}</div>
                            <div className="meta">
                              {item.type === 'invoice' ? `📄 Factura ${item.invoice_number}` : '📱 Suscripción'}
                            </div>
                            <div className="meta">{item.customer_email || '-'}</div>
                          </div>
                        </td>
                        <td>
                          <div className="zxpay-amt">
                            {formatCurrency(item.amount_due || item.amount)}
                          </div>
                          {item.type === 'subscription' && (
                            <div className="zxpay-amt-note">
                              (Sin facturar)
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="zxpay-date">
                            {item.due_date
                              ? new Date(item.due_date).toLocaleDateString('es-MX', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : '-'
                            }
                          </div>
                        </td>
                        <td>
                          <span className={`zxpay-pill ${item.paymentStatus.color}`}>
                            {item.paymentStatus.label}
                          </span>
                        </td>
                        <td>
                          <div className="zxpay-rowacts">
                            {item.type === 'invoice' ? (
                              <>
                                <Link
                                  to={`/income/invoices/${item.invoice_id}`}
                                  className="zxpay-act"
                                >
                                  👁️ Ver Factura
                                </Link>
                                {item.paymentStatus.status !== 'paid' && (
                                  <Link
                                    to={`/income/invoices/${item.invoice_id}`}
                                    className="zxpay-act solid"
                                  >
                                    💰 Pagar
                                  </Link>
                                )}
                              </>
                            ) : (
                              <>
                                <Link
                                  to={`/income/invoice-generator?subscription_id=${item.subscription_id}&customer_id=${item.customer_id}`}
                                  className="zxpay-act solid"
                                >
                                  📄 Facturar
                                </Link>
                                <button
                                  onClick={() => openReminderModal(item)}
                                  className="zxpay-act"
                                >
                                  📱 Recordatorio
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">
                        <div className="zxpay-empty">
                          <span className="ico">📋</span>
                          <p>No hay pagos pendientes en esta categoría</p>
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
          <div className="zxpay-modal-overlay">
            <div className="zxpay-modal">
              <h2>💰 Registrar Pago</h2>

              <div className="zxpay-modal-info">
                <p className="lbl">Cliente:</p>
                <p className="val">{selectedSubscription.customer_name}</p>
                <p className="mut">
                  Vencimiento: {new Date(selectedSubscription.next_billing_date).toLocaleDateString('es-MX')}
                </p>
              </div>

              <form onSubmit={handleRecordPayment} className="zxpay-form">
                <div className="zxpay-field">
                  <label className="zxpay-label">
                    Monto Recibido (con IVA)
                  </label>
                  <div className="zxpay-input-wrap">
                    <span className="zxpay-input-prefix">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={(parseFloat(paymentAmount) * 1.16).toFixed(2)}
                      onChange={(e) => setPaymentAmount((parseFloat(e.target.value) / 1.16).toFixed(2))}
                      required
                      className="zxpay-input has-prefix"
                    />
                  </div>
                </div>

                <div className="zxpay-field">
                  <label className="zxpay-label">Método de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="zxpay-select"
                  >
                    <option value="transfer">🏦 Transferencia Bancaria</option>
                    <option value="cash">💵 Efectivo</option>
                    <option value="card">💳 Tarjeta</option>
                    <option value="check">📝 Cheque</option>
                    <option value="other">📋 Otro</option>
                  </select>
                </div>

                <div className="zxpay-field">
                  <label className="zxpay-label">Referencia (opcional)</label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Número de transferencia, folio, etc."
                    className="zxpay-input"
                  />
                </div>

                <div className="zxpay-field">
                  <label className="zxpay-label">Notas (opcional)</label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                    className="zxpay-textarea"
                    placeholder="Observaciones..."
                  />
                </div>

                <div className="zxpay-modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="zxpay-btn"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="zxpay-btn solid"
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
          <div className="zxpay-modal-overlay">
            <div className="zxpay-modal wide">
              <h2>📱 Enviar Recordatorio</h2>

              <div className="zxpay-modal-info">
                <p className="val">{selectedSubscription.customer_name}</p>
                <p className="mut">
                  Monto: {formatCurrency(parseFloat(selectedSubscription.effective_monthly_price) * 1.16)}
                </p>
                <p className="mut">
                  Vence: {new Date(selectedSubscription.next_billing_date).toLocaleDateString('es-MX')}
                </p>
              </div>

              <div className="zxpay-form">
                <div className="zxpay-field">
                  <label className="zxpay-label">
                    Mensaje de WhatsApp:
                  </label>
                  <div className="zxpay-msgbox">
                    {generateWhatsAppReminder(
                      selectedSubscription,
                      getPaymentStatus(selectedSubscription).status === 'overdue'
                    )}
                  </div>
                </div>

                <div className="zxpay-modal-actions">
                  <button
                    onClick={() => copyToClipboard(generateWhatsAppReminder(
                      selectedSubscription,
                      getPaymentStatus(selectedSubscription).status === 'overdue'
                    ))}
                    className="zxpay-btn"
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
                    className="zxpay-btn solid"
                  >
                    📱 Abrir WhatsApp
                  </button>
                </div>

                <button
                  onClick={() => setShowReminderModal(false)}
                  className="zxpay-btn zxpay-modal-full"
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


