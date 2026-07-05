import React, { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./InvoiceGenerator.css";

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
      <div className="zxgen">
        <div className="zxgen-inner">
          {/* Header */}
          <div className="zxgen-head">
            <div>
              <div className="zxgen-eyebrow">Ingresos · Facturación</div>
              <h1 className="zxgen-h1">Generar <span className="zxgen-serif">factura</span></h1>
              <p className="zxgen-sub">
                {isFiscal ? 'IVA (16%) se calcula automáticamente' : 'Factura No Fiscal (Sin IVA)'}
              </p>
            </div>
            <Link to="/income" className="zxgen-back">
              ← Volver
            </Link>
          </div>

          {/* Content */}
          <div className="zxgen-cols">
            {/* Form */}
            <div>
              <form onSubmit={handleGenerate} className="zxgen-panel zxgen-form">
                {/* Customer Selection */}
                <div className="zxgen-field">
                  <label className="zxgen-label">
                    Cliente *
                  </label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    required
                    className="zxgen-select"
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
                <div className="zxgen-toggle">
                  <label className="zxgen-toggle-label">
                    <input
                      type="checkbox"
                      checked={isFiscal}
                      onChange={(e) => setIsFiscal(e.target.checked)}
                      className="zxgen-check"
                    />
                    <div>
                      <span className="zxgen-toggle-title">
                        {isFiscal ? 'Factura Fiscal (con IVA)' : 'Factura No Fiscal (sin IVA)'}
                      </span>
                      <p className="zxgen-toggle-desc">
                        {isFiscal
                          ? 'Incluye IVA 16% - Requiere RFC del cliente'
                          : 'Sin IVA - Para clientes que no requieren factura fiscal'}
                      </p>
                    </div>
                  </label>
                  <div>
                    {isFiscal ? (
                      <span className="zxgen-chip on">
                        +16% IVA
                      </span>
                    ) : (
                      <span className="zxgen-chip off">
                        Sin IVA
                      </span>
                    )}
                  </div>
                </div>

                {/* Subscription Selection */}
                {selectedCustomer && subscriptions.length > 0 && (
                  <div className="zxgen-field">
                    <label className="zxgen-label">
                      Suscripción (opcional)
                    </label>
                    <select
                      value={selectedSubscription}
                      onChange={(e) => setSelectedSubscription(e.target.value)}
                      className="zxgen-select"
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
                <div className="zxgen-grid2">
                  <div className="zxgen-field">
                    <label className="zxgen-label">
                      Período: Inicio
                    </label>
                    <input
                      type="date"
                      value={billingPeriodStart}
                      onChange={(e) => setBillingPeriodStart(e.target.value)}
                      className="zxgen-input"
                    />
                  </div>
                  <div className="zxgen-field">
                    <label className="zxgen-label">
                      Período: Fin
                    </label>
                    <input
                      type="date"
                      value={billingPeriodEnd}
                      onChange={(e) => setBillingPeriodEnd(e.target.value)}
                      className="zxgen-input"
                    />
                  </div>
                </div>

                {/* Include Unbilled Add-ons */}
                {selectedCustomer && unbilledAddons.length > 0 && (
                  <div className="zxgen-addons">
                    <div className="zxgen-addons-row">
                      <input
                        type="checkbox"
                        id="includeAddons"
                        checked={includeAddons}
                        onChange={(e) => setIncludeAddons(e.target.checked)}
                        className="zxgen-check"
                      />
                      <div className="zxgen-addons-body">
                        <label htmlFor="includeAddons" className="zxgen-addons-label">
                          Incluir {unbilledAddons.length} add-on{unbilledAddons.length !== 1 ? 's' : ''} no facturado{unbilledAddons.length !== 1 ? 's' : ''}
                        </label>
                        <div className="zxgen-addons-list">
                          {unbilledAddons.slice(0, 3).map(addon => (
                            <div key={addon.id} className="zxgen-addons-item">
                              • {addon.addon_name} (x{addon.quantity}) - {formatCurrency(addon.total_price)}
                            </div>
                          ))}
                          {unbilledAddons.length > 3 && (
                            <div className="zxgen-addons-item">
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
                  <div className="zxgen-items-head">
                    <label className="zxgen-label">
                      Conceptos Personalizados
                    </label>
                    <button
                      type="button"
                      onClick={addCustomItem}
                      className="zxgen-add"
                    >
                      + Agregar concepto
                    </button>
                  </div>

                  {customItems.length > 0 && (
                    <div className="zxgen-tablewrap">
                      <table className="zxgen-table">
                        <thead>
                          <tr>
                            <th>Descripción</th>
                            <th className="zxgen-td-qty">Cant.</th>
                            <th className="zxgen-td-price">Precio</th>
                            <th className="zxgen-td-x"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {customItems.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  type="text"
                                  placeholder="Descripción"
                                  value={item.description}
                                  onChange={(e) => updateCustomItem(index, 'description', e.target.value)}
                                  className="zxgen-input"
                                />
                              </td>
                              <td className="zxgen-td-qty">
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Cant."
                                  value={item.quantity}
                                  onChange={(e) => updateCustomItem(index, 'quantity', e.target.value)}
                                  className="zxgen-input"
                                />
                              </td>
                              <td className="zxgen-td-price">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Precio"
                                  value={item.unit_price}
                                  onChange={(e) => updateCustomItem(index, 'unit_price', e.target.value)}
                                  className="zxgen-input"
                                />
                              </td>
                              <td className="zxgen-td-x">
                                <button
                                  type="button"
                                  onClick={() => removeCustomItem(index)}
                                  className="zxgen-remove"
                                >
                                  ✗
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {customItems.length === 0 && (
                    <p className="zxgen-items-empty">
                      No hay conceptos personalizados. Haz clic en "Agregar concepto" para añadir.
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="zxgen-field">
                  <label className="zxgen-label">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Notas para la factura..."
                    className="zxgen-textarea"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !selectedCustomer}
                  className="zxgen-submit"
                >
                  {loading ? "Generando..." : "Generar Factura"}
                </button>
              </form>
            </div>

            {/* Preview Sidebar */}
            <div>
              <div className="zxgen-panel zxgen-preview">
                <h3>
                  Vista Previa
                </h3>

                {selectedCustomer && (
                  <div>
                    {/* Customer Info */}
                    <div className="zxgen-pv-block">
                      <p className="zxgen-pv-k">Cliente</p>
                      <p className="zxgen-pv-v">
                        {customers.find(c => c.id === parseInt(selectedCustomer))?.first_name}{' '}
                        {customers.find(c => c.id === parseInt(selectedCustomer))?.last_name}
                      </p>
                    </div>

                    {/* Period */}
                    {billingPeriodStart && billingPeriodEnd && (
                      <div className="zxgen-pv-block">
                        <p className="zxgen-pv-k">Período</p>
                        <p className="zxgen-pv-v">
                          {new Date(billingPeriodStart).toLocaleDateString('es-MX')} - {new Date(billingPeriodEnd).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    )}

                    {/* Items Preview */}
                    <div className="zxgen-pv-block">
                      {selectedSubscription && (
                        <div className="zxgen-pv-line">
                          • Suscripción mensual
                        </div>
                      )}

                      {includeAddons && unbilledAddons.length > 0 && (
                        <div className="zxgen-pv-line">
                          • {unbilledAddons.length} add-on(s)
                        </div>
                      )}

                      {customItems.filter(i => i.description).map((item, idx) => (
                        <div key={idx} className="zxgen-pv-line">
                          • {item.description}
                        </div>
                      ))}
                    </div>

                    {/* Totals - Only from custom items for preview */}
                    {customItems.some(i => i.unit_price) && (
                      <div className="zxgen-totals">
                        <div className="zxgen-total-row">
                          <span className="lbl">Subtotal (custom):</span>
                          <span className="amt">{formatCurrency(preview.subtotal)}</span>
                        </div>
                        {isFiscal && (
                          <div className="zxgen-total-row">
                            <span className="lbl">IVA (16%):</span>
                            <span className="amt">{formatCurrency(preview.iva)}</span>
                          </div>
                        )}
                        {!isFiscal && (
                          <div className="zxgen-total-row na">
                            <span className="lbl">IVA:</span>
                            <span>No Aplica (Factura No Fiscal)</span>
                          </div>
                        )}
                        <div className="zxgen-total-row grand">
                          <span>Total estimado:</span>
                          <span className="amt">{formatCurrency(preview.total)}</span>
                        </div>
                        <p className="zxgen-fine">
                          *El total final incluirá suscripción y add-ons si aplica
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {!selectedCustomer && (
                  <div className="zxgen-pv-empty">
                    <p className="ic">📄</p>
                    <p>Selecciona un cliente para ver la vista previa</p>
                  </div>
                )}

                {/* IVA Info */}
                <div className="zxgen-note">
                  <p className="zxgen-note-t">🇲🇽 IVA Mexicano</p>
                  <p className="zxgen-note-p">
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
