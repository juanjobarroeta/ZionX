import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const InvoicesManager = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchInvoices();
  }, [filter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      let url = `${API_BASE_URL}/api/income/invoices`;
      if (filter !== "all") {
        url += `?status=${filter}`;
      }

      const res = await axios.get(url, { headers });
      setInvoices(res.data);
    } catch (error) {
      console.error("Error fetching invoices:", error);
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

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-black">📄 Gestión de Facturas</h1>
                <p className="text-gray-500 text-sm mt-1">{invoices.length} facturas registradas</p>
              </div>
              <div className="flex space-x-3">
                <Link
                  to="/income"
                  className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Volver
                </Link>
                <Link
                  to="/income/invoice-generator"
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  ➕ Nueva Factura
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {[
              { key: 'all', label: 'Todas', icon: '📄' },
              { key: 'sent', label: 'Enviadas', icon: '📤' },
              { key: 'partial', label: 'Parciales', icon: '⏳' },
              { key: 'paid', label: 'Pagadas', icon: '✓' },
              { key: 'overdue', label: 'Vencidas', icon: '⚠️' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === tab.key
                    ? 'bg-black text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Por Cobrar</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-zionx-primary">{invoice.invoice_number}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{invoice.customer_name}</div>
                          <div className="text-xs text-gray-500">{invoice.customer_email}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(invoice.invoice_date).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('es-MX') : '-'}
                        </td>
                        <td className="px-6 py-4 font-semibold text-zionx-primary">
                          {formatCurrency(invoice.total)}
                        </td>
                        <td className="px-6 py-4 text-sm text-green-600">
                          {formatCurrency(invoice.amount_paid)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-orange-600">
                          {formatCurrency(invoice.amount_due)}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(invoice.current_status || invoice.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Link
                              to={`/income/invoices/${invoice.id}`}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Ver
                            </Link>
                            {(invoice.status === 'sent' || invoice.status === 'partial') && (
                              <Link
                                to={`/income/invoices/${invoice.id}/payment`}
                                className="text-green-600 hover:text-green-800 text-sm"
                              >
                                Pagar
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <span className="text-4xl mb-2">📄</span>
                          <p>No hay facturas {filter !== 'all' ? `con estado "${filter}"` : ''}</p>
                          <Link
                            to="/income/invoice-generator"
                            className="mt-4 text-blue-600 hover:text-blue-800"
                          >
                            Crear primera factura →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InvoicesManager;




