import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./Addons.css";

const AddonsManager = () => {
  const [addons, setAddons] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedAddon, setSelectedAddon] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [addonsRes, customersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/income/addons`, { headers }),
        axios.get(`${API_BASE_URL}/customers`, { headers })
      ]);

      setAddons(addonsRes.data);
      setCustomers(customersRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseAddon = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(
        `${API_BASE_URL}/api/income/addon-purchases`,
        {
          customer_id: parseInt(selectedCustomer),
          addon_id: selectedAddon.id,
          quantity: parseInt(quantity),
          description: description || selectedAddon.name
        },
        { headers }
      );

      alert(`✅ Add-on "${selectedAddon.name}" agregado para el cliente`);
      setShowPurchaseModal(false);
      setSelectedAddon(null);
      setSelectedCustomer("");
      setQuantity(1);
      setDescription("");
    } catch (error) {
      console.error("Error purchasing addon:", error);
      alert("Error al comprar add-on: " + (error.response?.data?.error || error.message));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  const categories = [...new Set(addons.map(a => a.category))].filter(Boolean);
  const filteredAddons = selectedCategory === "all" 
    ? addons 
    : addons.filter(a => a.category === selectedCategory);

  const getCategoryColor = (category) => {
    const colors = {
      content: 'content',
      design: 'design',
      video: 'video',
      ads: 'ads',
      consulting: 'consulting',
      platform: 'platform',
      photography: 'photography',
      communication: 'communication',
      other: 'other'
    };
    return colors[category] || colors.other;
  };

  if (loading) {
    return (
      <Layout>
        <div className="zxadd-loading">Cargando add-ons…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxadd">
        <div className="zxadd-inner">
          {/* Header */}
          <div className="zxadd-head">
            <div>
              <div className="zxadd-eyebrow">Ingresos</div>
              <h1 className="zxadd-h1">Catálogo de <span className="zxadd-serif">add-ons</span></h1>
              <p className="zxadd-sub">{addons.length} servicios adicionales disponibles</p>
            </div>
            <Link to="/income" className="zxadd-btn">← Volver</Link>
          </div>

          {/* Category Filter */}
          <div className="zxadd-filter">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`zxadd-fbtn${selectedCategory === "all" ? " active" : ""}`}
            >
              Todos ({addons.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`zxadd-fbtn${selectedCategory === cat ? " active" : ""}`}
              >
                {cat} ({addons.filter(a => a.category === cat).length})
              </button>
            ))}
          </div>

          {/* Add-ons Grid */}
          <div className="zxadd-grid">
            {filteredAddons.map((addon) => {
              const priceWithIVA = parseFloat(addon.price) * 1.16;

              return (
                <div key={addon.id} className="zxadd-card">
                  <div className="zxadd-card-top">
                    <h3 className="zxadd-card-name">{addon.name}</h3>
                    <span className={`zxadd-tag ${getCategoryColor(addon.category)}`}>
                      {addon.category}
                    </span>
                  </div>

                  <p className="zxadd-card-desc">{addon.description || 'Servicio adicional'}</p>

                  <div className="zxadd-rows">
                    <div className="zxadd-row">
                      <span className="lbl">Precio base:</span>
                      <span className="val">{formatCurrency(addon.price)}</span>
                    </div>
                    <div className="zxadd-row">
                      <span className="lbl sm">Con IVA (16%):</span>
                      <span className="val iva">{formatCurrency(priceWithIVA)}</span>
                    </div>
                    <div className="zxadd-row">
                      <span className="lbl sm">Tipo:</span>
                      <span className="val type">{addon.pricing_type}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedAddon(addon);
                      setDescription(addon.name);
                      setShowPurchaseModal(true);
                    }}
                    className="zxadd-buy"
                  >
                    🛒 Comprar para Cliente
                  </button>
                </div>
              );
            })}
          </div>

          {filteredAddons.length === 0 && (
            <div className="zxadd-empty">
              <span className="ic">➕</span>
              <p>No hay add-ons en esta categoría</p>
            </div>
          )}
        </div>

        {/* Purchase Modal */}
        {showPurchaseModal && selectedAddon && (
          <div className="zxadd-overlay">
            <div className="zxadd-modal">
              <h2>Comprar add-on</h2>
              <div className="zxadd-modal-lead">
                <p className="nm">{selectedAddon.name}</p>
                <p className="pr">{formatCurrency(selectedAddon.price)} + IVA</p>
              </div>

              <form onSubmit={handlePurchaseAddon} className="zxadd-form">
                <div className="zxadd-field">
                  <label className="zxadd-label">Cliente *</label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    required
                    className="zxadd-select"
                  >
                    <option value="">Seleccionar cliente...</option>
                    {customers.map(customer => {
                      const displayName = customer.business_name
                        ? customer.business_name
                        : `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
                      return (
                        <option key={customer.id} value={customer.id}>
                          {displayName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="zxadd-field">
                  <label className="zxadd-label">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="zxadd-input"
                  />
                </div>

                <div className="zxadd-field">
                  <label className="zxadd-label">Descripción</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="zxadd-textarea"
                    placeholder="Ej: 5 posts para campaña especial"
                  />
                </div>

                <div className="zxadd-summary">
                  <div className="line">
                    <span className="k">Subtotal:</span>
                    <span className="v">{formatCurrency(selectedAddon.price * quantity)}</span>
                  </div>
                  <div className="line">
                    <span className="k">IVA (16%):</span>
                    <span className="v">{formatCurrency(selectedAddon.price * quantity * 0.16)}</span>
                  </div>
                  <div className="line total">
                    <span className="k">Total:</span>
                    <span className="v">{formatCurrency(selectedAddon.price * quantity * 1.16)}</span>
                  </div>
                </div>

                <div className="zxadd-modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPurchaseModal(false);
                      setSelectedAddon(null);
                    }}
                    className="zxadd-cancel-btn"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="zxadd-submit-btn">
                    Comprar
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

export default AddonsManager;




