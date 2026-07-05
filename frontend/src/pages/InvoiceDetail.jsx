import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./InvoiceDetail.css";

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
      draft: { color: 'draft', label: 'Borrador' },
      sent: { color: 'sent', label: 'Enviada' },
      partial: { color: 'partial', label: 'Parcial' },
      paid: { color: 'paid', label: 'Pagada' },
      overdue: { color: 'overdue', label: 'Vencida' },
      cancelled: { color: 'cancelled', label: 'Cancelada' }
    };
    const badge = badges[status] || badges.draft;
    return <span className={`zxidv-pill ${badge.color}`}>{badge.label}</span>;
  };

  if (loading) {
    return (
      <Layout>
        <div className="zxidv">
          <div className="zxidv-state">
            <div className="zxidv-spinner"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!invoice) {
    return (
      <Layout>
        <div className="zxidv">
          <div className="zxidv-state">
            <div className="zxidv-empty">
              <p>Factura no encontrada</p>
              <Link to="/income/invoices">← Volver a facturas</Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxidv">
        <div className="zxidv-inner">
          {/* Header */}
          <div className="zxidv-head">
            <div>
              <div className="zxidv-eyebrow">Detalle de <span className="zxidv-serif">factura</span></div>
              <h1 className="zxidv-h1">{invoice.invoice_number}</h1>
            </div>
            <div className="zxidv-actions">
              <Link to="/income/invoices" className="zxidv-btn">← Volver</Link>
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <button
                  onClick={() => alert('Función de envío en desarrollo')}
                  className="zxidv-btn solid"
                >
                  Enviar
                </button>
              )}
            </div>
          </div>

          {/* Document */}
          <div className="zxidv-paper">
            {/* Invoice Header */}
            <div className="zxidv-doc-head">
              <div>
                <h2 className="folio">{invoice.invoice_number}</h2>
                {getStatusBadge(invoice.status)}
              </div>
              <div className="zxidv-dates">
                <div className="k">Fecha de emisión</div>
                <p className="v">{new Date(invoice.invoice_date).toLocaleDateString('es-MX')}</p>
                {invoice.due_date && (
                  <>
                    <div className="k">Fecha de vencimiento</div>
                    <p className="v">{new Date(invoice.due_date).toLocaleDateString('es-MX')}</p>
                  </>
                )}
              </div>
            </div>

            {/* Customer Info */}
            <div>
              <h3 className="zxidv-label">Cliente</h3>
              <div className="zxidv-cust">
                <p className="name">{invoice.customer_name}</p>
                {invoice.customer_rfc && <p className="meta">RFC: {invoice.customer_rfc}</p>}
                {invoice.customer_email && <p className="meta">{invoice.customer_email}</p>}
                {invoice.customer_phone && <p className="meta">{invoice.customer_phone}</p>}
                {invoice.customer_address && <p className="meta">{invoice.customer_address}</p>}
              </div>
            </div>

            {/* Line Items */}
            <div className="zxidv-section">
              <h3 className="zxidv-label">Conceptos</h3>
              <table className="zxidv-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th className="r">Cantidad</th>
                    <th className="r">Precio Unit.</th>
                    <th className="r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items && invoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.description}</td>
                      <td className="r">{item.quantity}</td>
                      <td className="r">{formatCurrency(item.unit_price)}</td>
                      <td className="r strong">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="zxidv-totals-wrap">
              <div className="zxidv-totals">
                <div className="zxidv-trow">
                  <span className="lbl">Subtotal:</span>
                  <span className="val">{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="zxidv-trow">
                  <span className="lbl">IVA ({invoice.tax_percentage}%):</span>
                  <span className="val">{formatCurrency(invoice.tax_amount)}</span>
                </div>
                <div className="zxidv-trow grand">
                  <span className="lbl">Total:</span>
                  <span className="val">{formatCurrency(invoice.total)}</span>
                </div>
                {invoice.amount_paid > 0 && (
                  <>
                    <div className="zxidv-trow ok">
                      <span className="lbl">Pagado:</span>
                      <span className="val">{formatCurrency(invoice.amount_paid)}</span>
                    </div>
                    <div className="zxidv-trow due">
                      <span className="lbl">Por Cobrar:</span>
                      <span className="val">{formatCurrency(invoice.amount_due)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payments History */}
            {invoice.payments && invoice.payments.length > 0 && (
              <div className="zxidv-section">
                <h3 className="zxidv-label">Historial de pagos</h3>
                <div className="zxidv-pays">
                  {invoice.payments.map((payment, idx) => (
                    <div key={idx} className="zxidv-pay">
                      <div>
                        <p className="amt">{formatCurrency(payment.amount)}</p>
                        <p className="sub">{payment.payment_method} - {new Date(payment.payment_date).toLocaleDateString('es-MX')}</p>
                      </div>
                      {payment.reference_number && (
                        <p className="ref">Ref: {payment.reference_number}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="zxidv-section">
                <h3 className="zxidv-label">Notas</h3>
                <p className="zxidv-notes">{invoice.notes}</p>
              </div>
            )}

            {/* CFDI (contabilidad-os) */}
            {(cfdiConfigured || invoice.cfdi_uuid) && (
              <div className="zxidv-section">
                <h3 className="zxidv-label">CFDI Fiscal</h3>
                {invoice.cfdi_uuid ? (
                  <div className="zxidv-cfdi stamped">
                    <div>
                      <div className="uuid-k">Folio fiscal (UUID)</div>
                      <div className="uuid-v">{invoice.cfdi_uuid}</div>
                    </div>
                    {invoice.cfdi_pdf_url && (
                      <a href={invoice.cfdi_pdf_url} target="_blank" rel="noreferrer"
                        className="zxidv-btn solid push">
                        Ver CFDI (PDF) →
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="zxidv-cfdi">
                    <button
                      onClick={stampCfdi}
                      disabled={stamping || invoice.status === 'cancelled'}
                      className="zxidv-btn solid wide"
                    >
                      {stamping ? 'Timbrando…' : 'Timbrar CFDI'}
                    </button>
                    <span className="hint">Genera la factura fiscal (CFDI) en contabilidad-os.</span>
                    {invoice.cfdi_error && (
                      <div className="zxidv-cfdi-err">⚠ Último intento: {invoice.cfdi_error}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="zxidv-foot">
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <button
                  onClick={handleOpenPaymentModal}
                  className="zxidv-btn solid wide"
                >
                  Registrar Pago
                </button>
              )}
              <button
                onClick={() => alert('Función de descarga PDF en desarrollo')}
                className="zxidv-btn wide"
              >
                Descargar PDF
              </button>
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <button
                  onClick={handleCancelInvoice}
                  disabled={cancelling}
                  className="zxidv-btn danger wide"
                >
                  {cancelling ? 'Cancelando...' : 'Cancelar Factura'}
                </button>
              )}
              {invoice.status === 'cancelled' && (
                <div className="zxidv-cancelled-note">
                  Esta factura está cancelada
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="zxidv-overlay">
            <div className="zxidv-modal">
              <div className="zxidv-modal-head">
                <h3>Registrar Pago</h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="zxidv-close"
                >
                  ×
                </button>
              </div>

              <div className="zxidv-modal-body">
                {/* Invoice Info */}
                <div className="zxidv-inv-box">
                  <p className="k">Factura</p>
                  <p className="v">{invoice.invoice_number}</p>
                  <p className="k" style={{ marginTop: '8px' }}>Cliente</p>
                  <p className="v reg">{invoice.customer_name}</p>
                  <div className="divider">
                    <div className="trow">
                      <span className="lbl">Total factura:</span>
                      <span className="val">{formatCurrency(invoice.total)}</span>
                    </div>
                    {invoice.amount_paid > 0 && (
                      <div className="trow ok">
                        <span>Pagado:</span>
                        <span className="val">{formatCurrency(invoice.amount_paid)}</span>
                      </div>
                    )}
                    <div className="trow due">
                      <span>Por cobrar:</span>
                      <span className="val">{formatCurrency(invoice.amount_due || invoice.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Form */}
                <div className="zxidv-field">
                  <label>
                    Monto del Pago *
                  </label>
                  <div className="zxidv-amount">
                    <span className="sign">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                      className="zxidv-input"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="zxidv-field">
                  <label>
                    Método de Pago *
                  </label>
                  <select
                    value={paymentData.payment_method}
                    onChange={(e) => setPaymentData({...paymentData, payment_method: e.target.value})}
                    className="zxidv-select"
                  >
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div className="zxidv-field">
                  <label>
                    Referencia / No. de Transacción
                  </label>
                  <input
                    type="text"
                    value={paymentData.reference_number}
                    onChange={(e) => setPaymentData({...paymentData, reference_number: e.target.value})}
                    className="zxidv-input"
                    placeholder="Ej: SPEI-123456, No. Cheque, etc."
                  />
                </div>

                <div className="zxidv-field">
                  <label>
                    Notas (Opcional)
                  </label>
                  <textarea
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                    className="zxidv-textarea"
                    rows="2"
                    placeholder="Notas adicionales sobre el pago..."
                  />
                </div>

                {/* Actions */}
                <div className="zxidv-modal-actions">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="zxidv-btn"
                    disabled={submittingPayment}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRegisterPayment}
                    disabled={submittingPayment}
                    className="zxidv-btn solid"
                  >
                    {submittingPayment ? 'Registrando...' : 'Registrar Pago'}
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
 
