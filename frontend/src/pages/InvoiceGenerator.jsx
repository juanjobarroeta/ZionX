import React, { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const InvoiceGenerator = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [customers, setCustomers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [unbilledAddons, setUnbilledAddons] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState(searchParams.get("customer_id") || "");
  const [selectedSubscription, setSelectedSubscription] = useState(searchParams.get("subscription_id") || "");
  const [billingPeriodStart, setBillingPeriodStart] = useState("");
  const [billingPeriodEnd, setBillingPeriodEnd] = useState("");
  const [includeAddons, setIncludeAddons] = useState(false);
  const [customItems, setCustomItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [isFiscal, setIsFiscal] = useState(true); // Toggle for fiscal (with IVA) vs non-fiscal
  
  // Preview state
  const [invoicePreview, setInvoicePreview] = useState(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerData(selectedCustomer);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    // Set default billing period to current month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setBillingPeriodStart(start.toISOString().split('T')[0]);
    setBillingPeriodEnd(end.toISOString().split('T')[0]);
  }, []);

  // Auto-populate subscription amount when subscription is selected
  useEffect(() => {
    if (selectedSubscription && subscriptions.length > 0) {
      const subscription = subscriptions.find(s => s.id.toString() === selectedSubscription);
      if (subscription) {
        // Pre-populate with subscription details
        const subscriptionPrice = parseFloat(subscription.effective_monthly_price || subscription.custom_monthly_price || 0);
        if (subscriptionPrice > 0) {
          const subscriptionItem = {
            description: `${subscription.package_name || 'Servicio de Marketing'}`,
            quantity: 1,
            unit_price: subscriptionPrice.toFixed(2)
          };
          
          // Only add if not already in custom items
          const alreadyAdded = customItems.some(item => 
            item.description.includes(subscription.package_name) || 
            item.unit_price === subscriptionPrice.toFixed(2)
          );
          
          if (!alreadyAdded) {
            setCustomItems(prev => [subscriptionItem, ...prev]);
          }
        }
      }
    }
  }, [selectedSubscription, subscriptions]);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE_URL}/customers`, { headers });
      setCustomers(res.data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchCustomerData = async (customerId) => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [subsRes, addonsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/income/subscriptions?customer_id=${customerId}`, { headers }),
        axios.get(`${API_BASE_URL}/api/income/addon-purchases/unbilled?customer_id=${customerId}`, { headers })
      ]);

      setSubscriptions(subsRes.data.filter(s => s.status === 'active'));
      setUnbilledAddons(addonsRes.data);
      
      // Auto-select subscription if coming from URL or if only one exists
      const subscriptionFromUrl = searchParams.get("subscription_id");
      if (subscriptionFromUrl) {
        setSelectedSubscription(subscriptionFromUrl);
      } else if (subsRes.data.length === 1) {
        setSelectedSubscription(subsRes.data[0].id.toString());
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
    }
  };

  const addCustomItem = () => {
    setCustomItems([...customItems, { description: "", quantity: 1, unit_price: "" }]);
  };

  const removeCustomItem = (index) => {
    setCustomItems(customItems.filter((_, i) => i !== index));
  };

  const updateCustomItem = (index, field, value) => {
    const updated = [...customItems];
    updated[index][field] = value;
    setCustomItems(updated);
  };

  const calculatePreview = () => {
    let subtotal = 0;

    // Calculate from custom items
    customItems.forEach(item => {
      if (item.unit_price) {
        subtotal += parseFloat(item.quantity || 1) * parseFloat(item.unit_price);
      }
    });

    // IVA only if fiscal invoice
    const iva = isFiscal ? Math.round(subtotal * 0.16 * 100) / 100 : 0;
    const total = subtotal + iva;

    return { subtotal, iva, total };
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    
    if (!selectedCustomer) {
      alert("Selecciona un cliente");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const payload = {
        customer_id: parseInt(selectedCustomer),
        subscription_id: selectedSubscription ? parseInt(selectedSubscription) : null,
        billing_period_start: billingPeriodStart,
        billing_period_end: billingPeriodEnd,
        include_unbilled_addons: includeAddons,
        custom_items: customItems.filter(item => item.description && item.unit_price),
        notes,
        is_fiscal: isFiscal,
        tax_percentage: isFiscal ? 16 : 0
      };

      const res = await axios.post(
        `${API_BASE_URL}/api/income/invoices/generate`,
        payload,
        { headers }
      );

      setInvoicePreview(res.data);
      
      // Log the invoice details for debugging
      console.log('Invoice generated:', res.data);
      console.log('Line items:', res.data.line_items);
      
      const ivaMessage = isFiscal ? `\nIVA (16%): $${res.data.iva?.toFixed(2) || '0.00'} MXN` : '\n(Sin IVA - Factura No Fiscal)';
      alert(`¡Factura ${res.data.invoice_number} generada exitosamente!\n\nSubtotal: $${res.data.subtotal?.toFixed(2) || '0.00'} MXN${ivaMessage}\nTotal: $${res.data.total.toFixed(2)} MXN`);
      
      // Redirect to invoice detail page
      if (res.data.invoice_id) {
        navigate(`/income/invoices/${res.data.invoice_id}`);
      } else {
        navigate('/income/invoices');
      }
    } catch (error) {
      console.error("Error generating invoice:", error);
      alert("Error al generar factura: " + (error.response?.data?.error || error.message));
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

  const preview = calculatePreview();

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-black">📄 Generar Factura</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {isFiscal ? 'IVA (16%) se calcula automáticamente' : 'Factura No Fiscal (Sin IVA)'}
                </p>
              </div>
              <Link
                to="/income"
                className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Volver
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleGenerate} className="bg-white rounded-xl border border-zionx-secondary p-6 space-y-6">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente *
                  </label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                  >
                    <option value="">Seleccionar cliente...</option>
                    {customers.map(customer => {
                      const displayName = customer.business_name 
                        ? `${customer.business_name}${customer.commercial_name ? ' (' + customer.commercial_name + ')' : ''}`
                        : `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
                      const displayEmail = customer.contact_email || customer.email || '';
                      return (
                        <option key={customer.id} value={customer.id}>
                          {displayName} {displayEmail ? `- ${displayEmail}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Fiscal vs Non-Fiscal Toggle */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFiscal}
                        onChange={(e) => setIsFiscal(e.target.checked)}
                        className="w-5 h-5 text-blue-600 mr-3 cursor-pointer"
                      />
                      <div>
                        <span className="font-semibold text-gray-800 block">
                          {isFiscal ? '📋 Factura Fiscal (con IVA)' : '📄 Factura No Fiscal (sin IVA)'}
                        </span>
                        <p className="text-xs text-gray-600 mt-1">
                          {isFiscal 
                            ? 'Incluye IVA 16% - Requiere RFC del cliente' 
                            : 'Sin IVA - Para clientes que no requieren factura fiscal'}
                        </p>
                      </div>
                    </label>
                    <div>
                      {isFiscal ? (
                        <span className="inline-block bg-blue-600 text-white px-3 py-1 rounded-full font-medium text-sm">
                          +16% IVA
                        </span>
                      ) : (
                        <span className="inline-block bg-gray-400 text-white px-3 py-1 rounded-full font-medium text-sm">
                          Sin IVA
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subscription Selection */}
                {selectedCustomer && subscriptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Suscripción (opcional)
                    </label>
                    <select
                      value={selectedSubscription}
                      onChange={(e) => setSelectedSubscription(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                    >
                      <option value="">Sin suscripción (solo items personalizados)</option>
                      {subscriptions.map(sub => (
                        <option key={sub.id} value={sub.id}>
                          {sub.package_name} - {formatCurrency(sub.effective_monthly_price)}/mes
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Billing Period */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Período: Inicio
                    </label>
                    <input
                      type="date"
                      value={billingPeriodStart}
                      onChange={(e) => setBillingPeriodStart(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Período: Fin
                    </label>
                    <input
                      type="date"
                      value={billingPeriodEnd}
                      onChange={(e) => setBillingPeriodEnd(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Include Unbilled Add-ons */}
                {selectedCustomer && unbilledAddons.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="includeAddons"
                        checked={includeAddons}
                        onChange={(e) => setIncludeAddons(e.target.checked)}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <label htmlFor="includeAddons" className="font-medium text-blue-900 cursor-pointer">
                          Incluir {unbilledAddons.length} add-on{unbilledAddons.length !== 1 ? 's' : ''} no facturado{unbilledAddons.length !== 1 ? 's' : ''}
                        </label>
                        <div className="mt-2 space-y-1">
                          {unbilledAddons.slice(0, 3).map(addon => (
                            <div key={addon.id} className="text-sm text-blue-700">
                              • {addon.addon_name} (x{addon.quantity}) - {formatCurrency(addon.total_price)}
                            </div>
                          ))}
                          {unbilledAddons.length > 3 && (
                            <div className="text-sm text-blue-600">
                              + {unbilledAddons.length - 3} más...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom Items */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Conceptos Personalizados
                    </label>
                    <button
                      type="button"
                      onClick={addCustomItem}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      ➕ Agregar concepto
                    </button>
                  </div>

                  <div className="space-y-3">
                    {customItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <input
                          type="text"
                          placeholder="Descripción"
                          value={item.description}
                          onChange={(e) => updateCustomItem(index, 'description', e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Cant."
                          value={item.quantity}
                          onChange={(e) => updateCustomItem(index, 'quantity', e.target.value)}
                          className="w-20 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Precio"
                          value={item.unit_price}
                          onChange={(e) => updateCustomItem(index, 'unit_price', e.target.value)}
                          className="w-32 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomItem(index)}
                          className="text-red-600 hover:text-red-800 px-2"
                        >
                          ✗
                        </button>
                      </div>
                    ))}
                  </div>

                  {customItems.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No hay conceptos personalizados. Haz clic en "Agregar concepto" para añadir.
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Notas para la factura..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !selectedCustomer}
                  className="w-full bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Generando..." : "🧾 Generar Factura"}
                </button>
              </form>
            </div>

            {/* Preview Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-zionx-secondary p-6 sticky top-6">
                <h3 className="text-lg font-semibold text-zionx-primary mb-4">
                  Vista Previa
                </h3>

                {selectedCustomer && (
                  <div className="space-y-4">
                    {/* Customer Info */}
                    <div className="pb-4 border-b">
                      <p className="text-sm text-gray-500">Cliente</p>
                      <p className="font-medium">
                        {customers.find(c => c.id === parseInt(selectedCustomer))?.first_name}{' '}
                        {customers.find(c => c.id === parseInt(selectedCustomer))?.last_name}
                      </p>
                    </div>

                    {/* Period */}
                    {billingPeriodStart && billingPeriodEnd && (
                      <div className="pb-4 border-b">
                        <p className="text-sm text-gray-500">Período</p>
                        <p className="text-sm">
                          {new Date(billingPeriodStart).toLocaleDateString('es-MX')} - {new Date(billingPeriodEnd).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    )}

                    {/* Items Preview */}
                    <div className="space-y-2">
                      {selectedSubscription && (
                        <div className="text-sm">
                          <span className="text-gray-600">• Suscripción mensual</span>
                        </div>
                      )}
                      
                      {includeAddons && unbilledAddons.length > 0 && (
                        <div className="text-sm">
                          <span className="text-gray-600">• {unbilledAddons.length} add-on(s)</span>
                        </div>
                      )}

                      {customItems.filter(i => i.description).map((item, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="text-gray-600">• {item.description}</span>
                        </div>
                      ))}
                    </div>

                    {/* Totals - Only from custom items for preview */}
                    {customItems.some(i => i.unit_price) && (
                      <div className="pt-4 border-t space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Subtotal (custom):</span>
                          <span className="font-semibold">{formatCurrency(preview.subtotal)}</span>
                        </div>
                        {isFiscal && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">IVA (16%):</span>
                            <span className="font-semibold">{formatCurrency(preview.iva)}</span>
                          </div>
                        )}
                        {!isFiscal && (
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>IVA:</span>
                            <span>No Aplica (Factura No Fiscal)</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                          <span>Total estimado:</span>
                          <span className="text-zionx-primary">{formatCurrency(preview.total)}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          *El total final incluirá suscripción y add-ons si aplica
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {!selectedCustomer && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-4xl mb-2">📄</p>
                    <p className="text-sm">Selecciona un cliente para ver la vista previa</p>
                  </div>
                )}

                {/* IVA Info */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900 mb-1">🇲🇽 IVA Mexicano</p>
                  <p className="text-xs text-blue-700">
                    Se calcula automáticamente el 16% de IVA sobre el subtotal.
                    Los montos se redondean a 2 decimales.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InvoiceGenerator;




// Force rebuild
