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

  useEffect(() => {
    fetchInvoice();
  }, [id]);

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

            {/* Actions */}
            <div className="mt-8 pt-8 border-t flex gap-3">
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <button
                  onClick={() => alert('Función de registro de pago en desarrollo')}
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
              {invoice.status === 'draft' && (
                <button
                  onClick={() => alert('Función de cancelación en desarrollo')}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors"
                >
                  ✗ Cancelar Factura
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InvoiceDetail;
