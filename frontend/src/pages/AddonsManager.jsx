import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

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
      content: 'bg-blue-100 text-blue-800',
      design: 'bg-purple-100 text-purple-800',
      video: 'bg-red-100 text-red-800',
      ads: 'bg-orange-100 text-orange-800',
      consulting: 'bg-green-100 text-green-800',
      platform: 'bg-indigo-100 text-indigo-800',
      photography: 'bg-pink-100 text-pink-800',
      communication: 'bg-cyan-100 text-cyan-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.other;
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
                <h1 className="text-2xl font-semibold text-black">➕ Catálogo de Add-ons</h1>
                <p className="text-gray-500 text-sm mt-1">{addons.length} servicios adicionales disponibles</p>
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
          {/* Category Filter */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                selectedCategory === "all"
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Todos ({addons.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap capitalize ${
                  selectedCategory === cat
                    ? 'bg-black text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {cat} ({addons.filter(a => a.category === cat).length})
              </button>
            ))}
          </div>

          {/* Add-ons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAddons.map((addon) => {
              const priceWithIVA = parseFloat(addon.price) * 1.16;
              
              return (
                <div
                  key={addon.id}
                  className="bg-white rounded-xl border border-zionx-secondary p-6 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-zionx-primary flex-1">{addon.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(addon.category)}`}>
                      {addon.category}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{addon.description || 'Servicio adicional'}</p>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-gray-500">Precio base:</span>
                      <span className="text-lg font-bold text-zionx-primary">{formatCurrency(addon.price)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-gray-500">Con IVA (16%):</span>
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(priceWithIVA)}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-xs text-gray-500">
                      <span>Tipo:</span>
                      <span className="capitalize">{addon.pricing_type}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedAddon(addon);
                      setDescription(addon.name);
                      setShowPurchaseModal(true);
                    }}
                    className="w-full bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  >
                    🛒 Comprar para Cliente
                  </button>
                </div>
              );
            })}
          </div>

          {filteredAddons.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-2 block">➕</span>
              <p>No hay add-ons en esta categoría</p>
            </div>
          )}
        </div>

        {/* Purchase Modal */}
        {showPurchaseModal && selectedAddon && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-zionx-primary mb-4">Comprar Add-on</h2>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold">{selectedAddon.name}</p>
                <p className="text-sm text-gray-600">{formatCurrency(selectedAddon.price)} + IVA</p>
              </div>

              <form onSubmit={handlePurchaseAddon} className="space-y-4">
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
                        {customer.first_name} {customer.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-zionx-highlight focus:border-transparent"
                    placeholder="Ej: 5 posts para campaña especial"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold">{formatCurrency(selectedAddon.price * quantity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">IVA (16%):</span>
                      <span className="font-semibold">{formatCurrency(selectedAddon.price * quantity * 0.16)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="font-bold">Total:</span>
                      <span className="font-bold text-green-600">{formatCurrency(selectedAddon.price * quantity * 1.16)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPurchaseModal(false);
                      setSelectedAddon(null);
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                  >
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




