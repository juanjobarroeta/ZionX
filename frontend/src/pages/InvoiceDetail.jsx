import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'transferencia',
    reference_number: '',
    notes: ''
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [cfdiConfigured, setCfdiConfigured] = useState(false);
  const [stamping, setStamping] = useState(false);

  useEffect(() => {
    fetchInvoice();
    const token = localStorage.getItem("token");
    axios.get(`${API_BASE_URL}/api/income/cfdi/health`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setCfdiConfigured(!!r.data?.configured))
      .catch(() => setCfdiConfigured(false));
  }, [id]);

  const stampCfdi = async () => {
    setStamping(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE_URL}/api/income/invoices/${id}/stamp`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.cfdi_uuid) alert(`✅ CFDI timbrado: ${res.data.cfdi_uuid}`);
      fetchInvoice();
    } catch (error) {
      alert("No se pudo timbrar: " + (error.response?.data?.error || error.message));
      fetchInvoice();
    } finally {
      setStamping(false);
    }
  };

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE_URL}/api/income/invoices/${id}`, { headers });
      setInvoice(res.data);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      alert("Error al cargar la factura");
      navigate('/income/invoices');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  const handleOpenPaymentModal = () => {
    setPaymentData({
      amount: invoice.amount_due || invoice.total,
      payment_method: 'transferencia',
      reference_number: '',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handleRegisterPayment = async () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      alert('❌ Ingresa un monto válido');
      return;
    }

    if (parseFloat(paymentData.amount) > parseFloat(invoice.amount_due || invoice.total)) {
      if (!confirm('⚠️ El monto es mayor al saldo pendiente. ¿Continuar?')) {
        return;
      }
    }

    try {
      setSubmittingPayment(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.post(
        `${API_BASE_URL}/api/income/invoices/${id}/payment`,
        {
          amount: parseFloat(paymentData.amount),
          payment_method: paymentData.payment_method,
          payment_date: new Date().toISOString().split('T')[0],
          reference_number: paymentData.reference_number || null,
          notes: paymentData.notes || null
        },
        { headers }
      );
      
      alert(`✅ Pago de ${formatCurrency(paymentData.amount)} registrado exitosamente`);
      setShowPaymentModal(false);
      fetchInvoice(); // Refresh invoice data
    } catch (error) {
      console.error("Error registering payment:", error);
      alert("❌ Error al registrar pago: " + (error.response?.data?.error || error.message));
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCancelInvoice = async () => {
    const reason = prompt("¿Por qué deseas cancelar esta factura?");
    if (!reason) return;
    
    if (!confirm(`¿Estás seguro de cancelar la factura ${invoice.invoice_number}? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    try {
      setCancelling(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.post(
        `${API_BASE_URL}/api/income/invoices/${id}/cancel`,
        { reason },
        { headers }
      );
      
      alert(`✅ Factura ${invoice.invoice_number} cancelada exitosamente`);
      navigate('/income/invoices');
    } catch (error) {
      console.error("Error cancelling invoice:", error);
      alert("❌ Error al cancelar factura: " + (error.response?.data?.error || error.message));
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'bg-gray-100 text-gray-800', label: '📝 Borrador' },
      sent: { color: 'bg-blue-100 text-blue-800', label: '📤 Enviada' },
      partial: { color: 'bg-yellow-100 text-yellow-800', label: '⏳ Parcial' },
      paid: { color: 'bg-green-100 text-green-800', label: '✓ Pagada' },
      overdue: { color: 'bg-red-100 text-red-800', label: '⚠️ Vencida' },
      cancelled: { color: 'bg-gray-100 text-gray-500', label: '✗ Cancelada' }
    };
    const badge = badges[status] || badges.draft;
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>;
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

  if (!invoice) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Factura no encontrada</p>
            <Link to="/income/invoices" className="text-blue-600 hover:text-blue-800">
              ← Volver a facturas
            </Link>
          </div>
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
                <h1 className="text-2xl font-semibold text-black">📄 {invoice.invoice_number}</h1>
                <p className="text-gray-500 text-sm mt-1">Detalle de factura</p>
              </div>
              <div className="flex gap-3">
                <Link
                  to="/income/invoices"
                  className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Volver
                </Link>
                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                  <button
                    onClick={() => alert('Función de envío en desarrollo')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    📤 Enviar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="bg-white rounded-xl border border-zionx-secondary p-8">
            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b">
              <div>
                <h2 className="text-3xl font-bold text-zionx-primary mb-2">{invoice.invoice_number}</h2>
                {getStatusBadge(invoice.status)}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Fecha de emisión</p>
                <p className="font-medium">{new Date(invoice.invoice_date).toLocaleDateString('es-MX')}</p>
                {invoice.due_date && (
                  <>
                    <p className="text-sm text-gray-500 mt-2">Fecha de vencimiento</p>
                    <p className="font-medium">{new Date(invoice.due_date).toLocaleDateString('es-MX')}</p>
                  </>
                )}
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-500 mb-2">CLIENTE</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-bold text-zionx-primary">{invoice.customer_name}</p>
                {invoice.customer_rfc && <p className="text-sm text-gray-600">RFC: {invoice.customer_rfc}</p>}
                {invoice.customer_email && <p className="text-sm text-gray-600">📧 {invoice.customer_email}</p>}
                {invoice.customer_phone && <p className="text-sm text-gray-600">📱 {invoice.customer_phone}</p>}
                {invoice.customer_address && <p className="text-sm text-gray-600 mt-2">📍 {invoice.customer_address}</p>}
              </div>
            </div>

            {/* Line Items */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-500 mb-4">CONCEPTOS</h3>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.items && invoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-80">
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">IVA ({invoice.tax_percentage}%):</span>
                  <span className="font-medium">{formatCurrency(invoice.tax_amount)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-gray-300 text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-zionx-primary">{formatCurrency(invoice.total)}</span>
                </div>
                {invoice.amount_paid > 0 && (
                  <>
                    <div className="flex justify-between py-2 text-sm text-green-600">
                      <span>Pagado:</span>
                      <span className="font-medium">{formatCurrency(invoice.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between py-2 text-sm text-orange-600">
                      <span>Por Cobrar:</span>
                      <span className="font-bold">{formatCurrency(invoice.amount_due)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payments History */}
            {invoice.payments && invoice.payments.length > 0 && (
              <div className="mt-8 pt-8 border-t">
                <h3 className="text-sm font-medium text-gray-500 mb-4">HISTORIAL DE PAGOS</h3>
                <div className="space-y-2">
                  {invoice.payments.map((payment, idx) => (
                    <div key={idx} className="bg-green-50 rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-green-800">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-green-600">{payment.payment_method} - {new Date(payment.payment_date).toLocaleDateString('es-MX')}</p>
                      </div>
                      {payment.reference_number && (
                        <p className="text-xs text-gray-500">Ref: {payment.reference_number}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="mt-8 pt-8 border-t">
                <h3 className="text-sm font-medium text-gray-500 mb-2">NOTAS</h3>
                <p className="text-sm text-gray-700">{invoice.notes}</p>
              </div>
            )}

            {/* CFDI (contabilidad-os) */}
            {(cfdiConfigured || invoice.cfdi_uuid) && (
              <div className="mt-8 pt-8 border-t">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">CFDI Fiscal</h3>
                {invoice.cfdi_uuid ? (
                  <div className="flex items-center gap-4 flex-wrap bg-green-50 border border-green-200 rounded-lg p-4">
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Folio fiscal (UUID)</div>
                      <div className="font-mono text-sm text-gray-800">{invoice.cfdi_uuid}</div>
                    </div>
                    {invoice.cfdi_pdf_url && (
                      <a href={invoice.cfdi_pdf_url} target="_blank" rel="noreferrer"
                        className="ml-auto bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800">
                        Ver CFDI (PDF) →
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-4 flex-wrap">
                    <button
                      onClick={stampCfdi}
                      disabled={stamping || invoice.status === 'cancelled'}
                      className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {stamping ? 'Timbrando…' : '🧾 Timbrar CFDI'}
                    </button>
                    <span className="text-sm text-gray-500">Genera la factura fiscal (CFDI) en contabilidad-os.</span>
                    {invoice.cfdi_error && (
                      <div className="w-full text-sm text-red-600 mt-1">⚠ Último intento: {invoice.cfdi_error}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 pt-8 border-t flex gap-3 flex-wrap">
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <button
                  onClick={handleOpenPaymentModal}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                  💰 Registrar Pago
                </button>
              )}
              <button
                onClick={() => alert('Función de descarga PDF en desarrollo')}
                className="bg-zionx-secondary text-zionx-primary px-6 py-3 rounded-lg hover:bg-zionx-accent hover:text-white transition-colors"
              >
                📥 Descargar PDF
              </button>
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <button
                  onClick={handleCancelInvoice}
                  disabled={cancelling}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelling ? 'Cancelando...' : '✗ Cancelar Factura'}
                </button>
              )}
              {invoice.status === 'cancelled' && (
                <div className="bg-gray-100 text-gray-600 px-6 py-3 rounded-lg">
                  ✗ Esta factura está cancelada
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-zionx-primary">💰 Registrar Pago</h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Invoice Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Factura</p>
                  <p className="font-bold text-zionx-primary">{invoice.invoice_number}</p>
                  <p className="text-sm text-gray-600 mt-2">Cliente</p>
                  <p className="font-medium">{invoice.customer_name}</p>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total factura:</span>
                      <span className="font-medium">{formatCurrency(invoice.total)}</span>
                    </div>
                    {invoice.amount_paid > 0 && (
                      <div className="flex justify-between text-sm text-green-600 mt-1">
                        <span>Pagado:</span>
                        <span className="font-medium">{formatCurrency(invoice.amount_paid)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-orange-600 mt-1">
                      <span>Por cobrar:</span>
                      <span>{formatCurrency(invoice.amount_due || invoice.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Form */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monto del Pago *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Método de Pago *
                  </label>
                  <select
                    value={paymentData.payment_method}
                    onChange={(e) => setPaymentData({...paymentData, payment_method: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="transferencia">🏦 Transferencia Bancaria</option>
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                    <option value="cheque">📝 Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Referencia / No. de Transacción
                  </label>
                  <input
                    type="text"
                    value={paymentData.reference_number}
                    onChange={(e) => setPaymentData({...paymentData, reference_number: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ej: SPEI-123456, No. Cheque, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas (Opcional)
                  </label>
                  <textarea
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows="2"
                    placeholder="Notas adicionales sobre el pago..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={submittingPayment}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRegisterPayment}
                    disabled={submittingPayment}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingPayment ? 'Registrando...' : '✓ Registrar Pago'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default InvoiceDetail;
 
