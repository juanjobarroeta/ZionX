import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import Layout from "../components/Layout";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [viewMode, setViewMode] = useState("table"); // table, grid, analytics
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [newProduct, setNewProduct] = useState({
    category: "",
    brand: "",
    model: "",
    color: "",
    imei: "",
    serial: "",
    cost: "",
    price: "",
    status: "in_stock",
    store: "atlixco",
    ram: "",
    storage: ""
  });

  const token = localStorage.getItem("token");

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/inventory-items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(res.data || []);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filtered products based on search and filters
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = 
        product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.color?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
      const matchesStatus = selectedStatus === "all" || product.status === selectedStatus;
      const matchesStore = selectedStore === "all" || product.store === selectedStore;
      
      return matchesSearch && matchesCategory && matchesStatus && matchesStore;
    });
  }, [products, searchTerm, selectedCategory, selectedStatus, selectedStore]);

  // Analytics data
  const analyticsData = useMemo(() => {
    const categories = {};
    const brands = {};
    const statuses = {};
    const stores = {};
    let totalValue = 0;
    let totalCost = 0;

    products.forEach(product => {
      // Categories
      categories[product.category] = (categories[product.category] || 0) + 1;
      
      // Brands
      brands[product.brand] = (brands[product.brand] || 0) + 1;
      
      // Statuses
      statuses[product.status] = (statuses[product.status] || 0) + 1;
      
      // Stores
      stores[product.store] = (stores[product.store] || 0) + 1;
      
      // Values
      totalValue += parseFloat(product.price || 0);
      totalCost += parseFloat(product.cost || 0);
    });

    return {
      categories,
      brands,
      statuses,
      stores,
      totalValue,
      totalCost,
      totalItems: products.length,
      profit: totalValue - totalCost
    };
  }, [products]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.values(newProduct).some((val) => val === "")) {
      alert("Todos los campos son requeridos.");
      return;
    }
    
    try {
      await axios.post(`${API_BASE_URL}/inventory-items`, newProduct, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewProduct({
        category: "",
        brand: "",
        model: "",
        color: "",
        imei: "",
        serial: "",
        cost: "",
        price: "",
        status: "in_stock",
        store: "atlixco",
        ram: "",
        storage: ""
      });
      setShowAddModal(false);
      fetchProducts();
    } catch (err) {
      console.error("Error adding product:", err);
      alert("Error al agregar producto.");
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget || selectedProducts.length === 0) {
      alert("Seleccione productos y destino para transferir.");
      return;
    }
    
    try {
      await axios.post(`${API_BASE_URL}/inventory-items/transfer`, {
        product_ids: selectedProducts,
        target_store: transferTarget
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSelectedProducts([]);
      setTransferTarget("");
      setShowTransferModal(false);
      fetchProducts();
      alert("Productos transferidos exitosamente.");
    } catch (err) {
      console.error("Error transferring products:", err);
      alert("Error al transferir productos.");
    }
  };

  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  // Chart data
  const chartData = useMemo(() => ({
    categoryDistribution: {
      labels: Object.keys(analyticsData.categories),
      datasets: [{
        data: Object.values(analyticsData.categories),
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(168, 85, 247, 0.8)",
          "rgba(239, 68, 68, 0.8)",
          "rgba(245, 158, 11, 0.8)"
        ],
        borderWidth: 2,
        borderColor: "#1f2937"
      }]
    },
    statusDistribution: {
      labels: Object.keys(analyticsData.statuses),
      datasets: [{
        data: Object.values(analyticsData.statuses),
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",
          "rgba(245, 158, 11, 0.8)",
          "rgba(239, 68, 68, 0.8)"
        ],
        borderWidth: 2,
        borderColor: "#1f2937"
      }]
    },
    storeDistribution: {
      labels: Object.keys(analyticsData.stores),
      datasets: [{
        label: "Productos por Sucursal",
        data: Object.values(analyticsData.stores),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 2
      }]
    }
  }), [analyticsData]);

  const uniqueCategories = [...new Set(products.map(p => p.category))];
  const uniqueStores = [...new Set(products.map(p => p.store))];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 text-neutral-800">
        {/* Header */}
        <div className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">📦 Inventario General</h1>
              <p className="text-neutral-600">Gestión avanzada de inventario y análisis</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-neutral-800 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ➕ Agregar Producto
              </button>
              <button
                onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}
                className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700 px-4 py-2 rounded-lg transition-colors"
              >
                {viewMode === "table" ? "📊 Vista Cuadrícula" : "📋 Vista Tabla"}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-4 border-b border-neutral-200">
          <div className="flex space-x-1">
            {[
              { id: "overview", label: "📊 Resumen", icon: "📊" },
              { id: "inventory", label: "📦 Inventario", icon: "📦" },
              { id: "analytics", label: "📈 Análisis", icon: "📈" },
              { id: "transfers", label: "🔄 Transferencias", icon: "🔄" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-primary-500 to-primary-600 text-neutral-800"
                    : "bg-neutral-200 hover:bg-neutral-300 text-neutral-700"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 bg-white border-b border-neutral-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="🔍 Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 placeholder-neutral-500 focus:border-primary-500 focus:outline-none"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-primary-500 focus:outline-none"
            >
              <option value="all">📂 Todas las categorías</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-primary-500 focus:outline-none"
            >
              <option value="all">📊 Todos los estados</option>
              <option value="in_stock">✅ En stock</option>
              <option value="assigned">📋 Asignado</option>
              <option value="sold">💰 Vendido</option>
            </select>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:border-primary-500 focus:outline-none"
            >
              <option value="all">🏪 Todas las sucursales</option>
              {uniqueStores.map(store => (
                <option key={store} value={store}>{store}</option>
              ))}
            </select>
            <button
              onClick={() => setShowTransferModal(true)}
              disabled={selectedProducts.length === 0}
              className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium transition-colors text-neutral-800"
            >
              🔄 Transferir ({selectedProducts.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  {
                    label: "Total Productos",
                    value: analyticsData.totalItems,
                    icon: "📦",
                    color: "text-primary-600"
                  },
                  {
                    label: "Valor Total",
                    value: `$${analyticsData.totalValue.toLocaleString()}`,
                    icon: "💰",
                    color: "text-primary-500"
                  },
                  {
                    label: "Costo Total",
                    value: `$${analyticsData.totalCost.toLocaleString()}`,
                    icon: "💸",
                    color: "text-neutral-600"
                  },
                  {
                    label: "Margen de Ganancia",
                    value: `$${analyticsData.profit.toLocaleString()}`,
                    icon: "📈",
                    color: "text-primary-600"
                  }
                ].map((stat, idx) => (
                  <div key={idx} className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-neutral-600 text-sm">{stat.label}</p>
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                      <div className="text-3xl">{stat.icon}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">📊 Distribución por Categoría</h3>
                  <Doughnut
                    data={chartData.categoryDistribution}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: { color: "white" }
                        }
                      }
                    }}
                  />
                </div>
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">📈 Distribución por Estado</h3>
                  <Doughnut
                    data={chartData.statusDistribution}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: { color: "white" }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "inventory" && (
            <div className="space-y-6">
              {viewMode === "table" ? (
                <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                              onChange={handleSelectAll}
                              className="rounded border-neutral-300"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-primary-600">Categoría</th>
                          <th className="px-4 py-3 text-left text-primary-600">Marca</th>
                          <th className="px-4 py-3 text-left text-primary-600">Modelo</th>
                          <th className="px-4 py-3 text-left text-primary-600">Color</th>
                          <th className="px-4 py-3 text-left text-primary-600">IMEI</th>
                          <th className="px-4 py-3 text-left text-primary-600">RAM</th>
                          <th className="px-4 py-3 text-left text-primary-600">Almacenamiento</th>
                          <th className="px-4 py-3 text-left text-primary-600">Estado</th>
                          <th className="px-4 py-3 text-left text-primary-600">Sucursal</th>
                          <th className="px-4 py-3 text-left text-primary-600">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((product, idx) => (
                          <tr key={product.id || idx} className="border-t border-neutral-200 hover:bg-gray-700 transition-colors">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedProducts.includes(product.id)}
                                onChange={() => handleSelectProduct(product.id)}
                                className="rounded border-neutral-300"
                              />
                            </td>
                            <td className="px-4 py-3">{product.category}</td>
                            <td className="px-4 py-3 font-medium">{product.brand}</td>
                            <td className="px-4 py-3">{product.model}</td>
                            <td className="px-4 py-3">{product.color}</td>
                            <td className="px-4 py-3 font-mono text-sm">{product.imei || "-"}</td>
                            <td className="px-4 py-3">{product.ram || "-"}</td>
                            <td className="px-4 py-3">{product.storage || "-"}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                product.status === 'in_stock' ? 'bg-green-600 text-neutral-800' :
                                product.status === 'assigned' ? 'bg-yellow-500 text-neutral-800' :
                                'bg-red-500 text-neutral-800'
                              }`}>
                                {product.status === 'in_stock' ? '✅ En Stock' :
                                 product.status === 'assigned' ? '📋 Asignado' :
                                 '💰 Vendido'}
                              </span>
                            </td>
                            <td className="px-4 py-3">{product.store}</td>
                            <td className="px-4 py-3">
                              <button className="text-primary-500 hover:text-blue-300 text-sm">
                                Ver detalles
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((product, idx) => (
                    <div key={product.id || idx} className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-lime-500 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => handleSelectProduct(product.id)}
                          className="rounded border-neutral-300"
                        />
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          product.status === 'in_stock' ? 'bg-green-600 text-neutral-800' :
                          product.status === 'assigned' ? 'bg-yellow-500 text-neutral-800' :
                          'bg-red-500 text-neutral-800'
                        }`}>
                          {product.status === 'in_stock' ? '✅' :
                           product.status === 'assigned' ? '📋' : '💰'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{product.brand} {product.model}</h3>
                      <div className="space-y-1 text-sm text-neutral-700">
                        <p><span className="text-neutral-600">Categoría:</span> {product.category}</p>
                        <p><span className="text-neutral-600">Color:</span> {product.color}</p>
                        <p><span className="text-neutral-600">RAM:</span> {product.ram || "-"}</p>
                        <p><span className="text-neutral-600">Almacenamiento:</span> {product.storage || "-"}</p>
                        <p><span className="text-neutral-600">Sucursal:</span> {product.store}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">🏪 Productos por Sucursal</h3>
                  <Bar
                    data={chartData.storeDistribution}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          labels: { color: "white" }
                        }
                      },
                      scales: {
                        y: {
                          ticks: { color: "white" },
                          grid: { color: "rgba(255,255,255,0.1)" }
                        },
                        x: {
                          ticks: { color: "white" },
                          grid: { color: "rgba(255,255,255,0.1)" }
                        }
                      }
                    }}
                  />
                </div>
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">📊 Estadísticas Detalladas</h3>
                  <div className="space-y-4">
                    {Object.entries(analyticsData.brands).map(([brand, count]) => (
                      <div key={brand} className="flex justify-between items-center">
                        <span className="text-neutral-700">{brand}</span>
                        <span className="text-primary-600 font-semibold">{count} productos</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "transfers" && (
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">🔄 Historial de Transferencias</h3>
              <p className="text-neutral-600">Funcionalidad de transferencias entre sucursales próximamente...</p>
            </div>
          )}
        </div>

        {/* Add Product Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white border border-neutral-200 rounded-lg p-6 w-full max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">➕ Agregar Nuevo Producto</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    name="category"
                    placeholder="Categoría"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="brand"
                    placeholder="Marca"
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="model"
                    placeholder="Modelo"
                    value={newProduct.model}
                    onChange={(e) => setNewProduct({...newProduct, model: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="color"
                    placeholder="Color"
                    value={newProduct.color}
                    onChange={(e) => setNewProduct({...newProduct, color: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="imei"
                    placeholder="IMEI"
                    value={newProduct.imei}
                    onChange={(e) => setNewProduct({...newProduct, imei: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="serial"
                    placeholder="Número de Serie"
                    value={newProduct.serial}
                    onChange={(e) => setNewProduct({...newProduct, serial: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="cost"
                    placeholder="Costo"
                    type="number"
                    value={newProduct.cost}
                    onChange={(e) => setNewProduct({...newProduct, cost: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="price"
                    placeholder="Precio de Venta"
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="ram"
                    placeholder="RAM"
                    value={newProduct.ram}
                    onChange={(e) => setNewProduct({...newProduct, ram: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="storage"
                    placeholder="Almacenamiento"
                    value={newProduct.storage}
                    onChange={(e) => setNewProduct({...newProduct, storage: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="bg-primary-500 hover:bg-primary-600 text-neutral-800 px-4 py-2 rounded-lg font-medium"
                  >
                    ✅ Agregar Producto
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-medium"
                  >
                    ❌ Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transfer Modal */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white border border-neutral-200 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">🔄 Transferir Productos</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Sucursal Destino:</label>
                  <select
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  >
                    <option value="">Selecciona sucursal</option>
                    {uniqueStores.map(store => (
                      <option key={store} value={store}>{store}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleTransfer}
                    disabled={!transferTarget}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium"
                  >
                    ✅ Transferir
                  </button>
                  <button
                    onClick={() => setShowTransferModal(false)}
                    className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-medium"
                  >
                    ❌ Cancelar
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

export default Inventory;