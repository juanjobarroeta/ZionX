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

const AdminInventoryViewer = () => {
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
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [newProduct, setNewProduct] = useState({
    category: "",
    brand: "",
    model: "",
    color: "",
    imei: "",
    serial: "",
    purchase_price: "",
    sale_price: "",
    status: "in_stock",
    store: "atlixco",
    ram: "",
    storage: ""
  });
  const [imeiValidation, setImeiValidation] = useState({ isValid: false, message: "", isDuplicate: false });
  
  // IMEI Assignment Modal State
  const [showImeiModal, setShowImeiModal] = useState(false);
  const [selectedProductForImei, setSelectedProductForImei] = useState(null);
  const [imeiAssignmentValue, setImeiAssignmentValue] = useState("");
  const [imeiAssignmentValidation, setImeiAssignmentValidation] = useState({ isValid: false, message: "", isDuplicate: false });

  const token = localStorage.getItem("token");

  // IMEI Validation Functions
  const validateIMEI = (imei) => {
    // Remove any spaces or hyphens
    const cleanIMEI = imei.replace(/[\s-]/g, '');
    
    // Check if it's exactly 15 digits
    if (!/^\d{15}$/.test(cleanIMEI)) {
      return { isValid: false, message: "IMEI debe tener exactamente 15 dígitos" };
    }

    // Luhn algorithm validation for IMEI
    const luhnCheck = (imei) => {
      let sum = 0;
      let shouldDouble = false;
      
      for (let i = imei.length - 1; i >= 0; i--) {
        let digit = parseInt(imei[i]);
        
        if (shouldDouble) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        
        sum += digit;
        shouldDouble = !shouldDouble;
      }
      
      return sum % 10 === 0;
    };

    if (!luhnCheck(cleanIMEI)) {
      return { isValid: false, message: "IMEI no es válido (falló verificación Luhn)" };
    }

    return { isValid: true, message: "✅ IMEI válido" };
  };

  const checkIMEIDuplicate = async (imei) => {
    if (!imei || imei.length < 15) return false;
    
    try {
      const cleanIMEI = imei.replace(/[\s-]/g, '');
      const response = await axios.get(`${API_BASE_URL}/inventory-items/check-imei/${cleanIMEI}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.exists;
    } catch (error) {
      console.error("Error checking IMEI duplicate:", error);
      return false;
    }
  };

  const handleIMEIChange = async (value) => {
    // Format IMEI as user types (add spaces every 3 digits)
    const formatted = value.replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ').trim();
    
    setNewProduct({ ...newProduct, imei: formatted });
    
    if (value.replace(/\s/g, '').length === 15) {
      const validation = validateIMEI(value);
      
      if (validation.isValid) {
        const isDuplicate = await checkIMEIDuplicate(value);
        if (isDuplicate) {
          setImeiValidation({ 
            isValid: false, 
            message: "❌ Este IMEI ya existe en el inventario", 
            isDuplicate: true 
          });
        } else {
          setImeiValidation({ 
            isValid: true, 
            message: validation.message, 
            isDuplicate: false 
          });
        }
      } else {
        setImeiValidation({ 
          isValid: false, 
          message: validation.message, 
          isDuplicate: false 
        });
      }
    } else {
      setImeiValidation({ isValid: false, message: "", isDuplicate: false });
    }
  };

  // IMEI Assignment Functions
  const handleImeiAssignmentChange = async (value) => {
    // Remove all non-digits first
    const digitsOnly = value.replace(/\D/g, '');
    
    // Limit to 15 digits
    const limitedDigits = digitsOnly.slice(0, 15);
    
    // Format with spaces every 3 digits
    const formatted = limitedDigits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
    
    setImeiAssignmentValue(formatted);
    
    if (limitedDigits.length === 15) {
      const validation = validateIMEI(limitedDigits);
      
      if (validation.isValid) {
        const isDuplicate = await checkIMEIDuplicate(limitedDigits);
        if (isDuplicate) {
          setImeiAssignmentValidation({ 
            isValid: false, 
            message: "❌ Este IMEI ya existe en el inventario", 
            isDuplicate: true 
          });
        } else {
          setImeiAssignmentValidation({ 
            isValid: true, 
            message: validation.message, 
            isDuplicate: false 
          });
        }
      } else {
        setImeiAssignmentValidation({ 
          isValid: false, 
          message: validation.message, 
          isDuplicate: false 
        });
      }
    } else {
      setImeiAssignmentValidation({ isValid: false, message: "", isDuplicate: false });
    }
  };

  const openImeiModal = (product) => {
    setSelectedProductForImei(product);
    setImeiAssignmentValue(product.imei || "");
    setImeiAssignmentValidation({ isValid: false, message: "", isDuplicate: false });
    setShowImeiModal(true);
  };

  const handleImeiAssignment = async () => {
    if (!imeiAssignmentValidation.isValid || imeiAssignmentValidation.isDuplicate) {
      alert("Por favor ingresa un IMEI válido y único");
      return;
    }

    try {
      const cleanIMEI = imeiAssignmentValue.replace(/\s/g, '');
      await axios.put(`${API_BASE_URL}/inventory-items/${selectedProductForImei.id}/imei`, 
        { imei: cleanIMEI }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update the product in the list
      setProducts(prev => prev.map(p => 
        p.id === selectedProductForImei.id 
          ? { ...p, imei: cleanIMEI }
          : p
      ));
      
      setShowImeiModal(false);
      setSelectedProductForImei(null);
      setImeiAssignmentValue("");
      alert("✅ IMEI asignado correctamente");
    } catch (error) {
      console.error("Error assigning IMEI:", error);
      alert("❌ Error al asignar IMEI");
    }
  };

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
      totalValue += parseFloat(product.sale_price || 0);
      totalCost += parseFloat(product.purchase_price || 0);
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
    
    // Basic validation
    if (Object.values(newProduct).some((val) => val === "")) {
      alert("Todos los campos son requeridos.");
      return;
    }
    
    // IMEI validation for phones
    if (newProduct.category.toLowerCase() === 'teléfono' || newProduct.category.toLowerCase() === 'telefono') {
      if (!newProduct.imei) {
        alert("❌ IMEI es requerido para teléfonos.");
        return;
      }
      
      if (!imeiValidation.isValid) {
        alert("❌ El IMEI ingresado no es válido. Verifique el formato y que no esté duplicado.");
        return;
      }
    }
    
    try {
      // Clean IMEI before sending (remove spaces)
      const productToSubmit = {
        ...newProduct,
        imei: newProduct.imei.replace(/\s/g, '')
      };
      
      await axios.post(`${API_BASE_URL}/inventory-items`, productToSubmit, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset form
      setNewProduct({
        category: "",
        brand: "",
        model: "",
        color: "",
        imei: "",
        serial: "",
        purchase_price: "",
        sale_price: "",
        status: "in_stock",
        store: "atlixco",
        ram: "",
        storage: ""
      });
      setImeiValidation({ isValid: false, message: "", isDuplicate: false });
      setShowAddModal(false);
      fetchProducts();
      alert("✅ Producto agregado exitosamente.");
    } catch (err) {
      console.error("Error adding product:", err);
      const errorMsg = err.response?.data?.message || "Error al agregar producto.";
      alert(`❌ ${errorMsg}`);
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
                className="bg-primary-500 hover:bg-primary-600 text-neutral-800 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ➕ Agregar Producto
              </button>
              <button
                onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
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
                    ? "bg-primary-500 text-neutral-800"
                    : "bg-gray-700 hover:bg-gray-600 text-neutral-700"
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
              className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 placeholder-gray-400"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
            >
              <option value="all">📂 Todas las categorías</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
            >
              <option value="all">📊 Todos los estados</option>
              <option value="in_stock">✅ En stock</option>
              <option value="assigned">📋 Asignado</option>
              <option value="sold">💰 Vendido</option>
            </select>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
            >
              <option value="all">🏪 Todas las sucursales</option>
              {uniqueStores.map(store => (
                <option key={store} value={store}>{store}</option>
              ))}
            </select>
            <button
              onClick={() => setShowTransferModal(true)}
              disabled={selectedProducts.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium transition-colors"
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
                    color: "text-primary-500"
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
                  <div key={idx} className="bg-white border border-neutral-200 rounded-lg p-6">
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
                          <th className="px-4 py-3 text-left text-primary-600">ID</th>
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
                            <td className="px-4 py-3">
                              <span className="font-mono text-primary-600 font-bold">#{product.id}</span>
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
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setSelectedProductDetails(product)}
                                  className="text-primary-500 hover:text-blue-300 hover:bg-blue-900/20 px-2 py-1 rounded text-sm transition-colors"
                                >
                                  👁️ Ver detalles
                                </button>
                                {(product.category?.toLowerCase() === 'teléfono' || product.category?.toLowerCase() === 'telefono') && (
                                  <button 
                                    onClick={() => openImeiModal(product)}
                                    className={`px-2 py-1 rounded text-sm transition-colors ${
                                      product.imei 
                                        ? 'text-primary-500 hover:text-green-300 hover:bg-green-900/20' 
                                        : 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20'
                                    }`}
                                    title={product.imei ? "Editar IMEI" : "Asignar IMEI"}
                                  >
                                    {product.imei ? "📱 Editar IMEI" : "📱 Asignar IMEI"}
                                  </button>
                                )}
                              </div>
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
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={() => handleSelectProduct(product.id)}
                            className="rounded border-neutral-300"
                          />
                          <span className="font-mono text-primary-600 font-bold text-sm">#{product.id}</span>
                        </div>
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
                      <div className="space-y-1 text-sm text-neutral-700 mb-4">
                        <p><span className="text-neutral-600">Categoría:</span> {product.category}</p>
                        <p><span className="text-neutral-600">Color:</span> {product.color}</p>
                        <p><span className="text-neutral-600">RAM:</span> {product.ram || "-"}</p>
                        <p><span className="text-neutral-600">Almacenamiento:</span> {product.storage || "-"}</p>
                        <p><span className="text-neutral-600">Sucursal:</span> {product.store}</p>
                        <p><span className="text-neutral-600">IMEI:</span> {product.imei || "-"}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedProductDetails(product)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-neutral-800 px-3 py-2 rounded text-sm transition-colors"
                        >
                          👁️ Ver Detalles
                        </button>
                        {(product.category?.toLowerCase() === 'teléfono' || product.category?.toLowerCase() === 'telefono') && (
                          <button
                            onClick={() => openImeiModal(product)}
                            className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                              product.imei 
                                ? 'bg-green-600 hover:bg-green-700 text-neutral-800' 
                                : 'bg-yellow-600 hover:bg-yellow-700 text-neutral-800'
                            }`}
                            title={product.imei ? "Editar IMEI" : "Asignar IMEI"}
                          >
                            {product.imei ? "📱 Editar" : "📱 IMEI"}
                          </button>
                        )}
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
                  <div className="space-y-2">
                    <input
                      name="imei"
                      placeholder="IMEI (15 dígitos) - ej: 123 456 789 012 345"
                      value={newProduct.imei}
                      onChange={(e) => handleIMEIChange(e.target.value)}
                      maxLength={19} // Allow for 15 digits + 4 spaces (format: 123 456 789 012 345)
                      className={`bg-gray-700 border rounded-lg px-3 py-2 text-neutral-800 w-full font-mono ${
                        imeiValidation.message ? 
                          (imeiValidation.isValid ? 'border-green-500' : 'border-red-500') : 
                          'border-neutral-300'
                      }`}
                    />
                    {imeiValidation.message && (
                      <p className={`text-sm ${imeiValidation.isValid ? 'text-primary-500' : 'text-neutral-600'}`}>
                        {imeiValidation.message}
                      </p>
                    )}
                  </div>
                  <input
                    name="serial"
                    placeholder="Número de Serie"
                    value={newProduct.serial}
                    onChange={(e) => setNewProduct({...newProduct, serial: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="purchase_price"
                    placeholder="Costo"
                    type="number"
                    value={newProduct.purchase_price}
                    onChange={(e) => setNewProduct({...newProduct, purchase_price: e.target.value})}
                    className="bg-gray-700 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                  <input
                    name="sale_price"
                    placeholder="Precio de Venta"
                    type="number"
                    value={newProduct.sale_price}
                    onChange={(e) => setNewProduct({...newProduct, sale_price: e.target.value})}
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
                    disabled={
                      (newProduct.category.toLowerCase() === 'teléfono' || newProduct.category.toLowerCase() === 'telefono') && 
                      (!imeiValidation.isValid || imeiValidation.isDuplicate)
                    }
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      (newProduct.category.toLowerCase() === 'teléfono' || newProduct.category.toLowerCase() === 'telefono') && 
                      (!imeiValidation.isValid || imeiValidation.isDuplicate)
                        ? 'bg-gray-500 cursor-not-allowed text-neutral-700'
                        : 'bg-primary-500 hover:bg-primary-600 text-neutral-800'
                    }`}
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

        {/* Product Details Modal */}
        {selectedProductDetails && (
          <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white border border-neutral-200 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-neutral-800">
                  📱 Detalles del Producto #{selectedProductDetails.id}
                </h2>
                <button
                  onClick={() => setSelectedProductDetails(null)}
                  className="text-neutral-600 hover:text-neutral-800 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary-600 border-b border-neutral-300 pb-2">
                    📋 Información Básica
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-neutral-600 text-sm">ID del Producto:</label>
                      <div className="text-neutral-800 font-mono text-lg">#{selectedProductDetails.id}</div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">Categoría:</label>
                      <div className="text-neutral-800">{selectedProductDetails.category}</div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">Marca:</label>
                      <div className="text-neutral-800 font-semibold">{selectedProductDetails.brand}</div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">Modelo:</label>
                      <div className="text-neutral-800">{selectedProductDetails.model}</div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">Color:</label>
                      <div className="text-neutral-800">{selectedProductDetails.color}</div>
                    </div>
                  </div>
                </div>

                {/* Technical Specifications */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary-600 border-b border-neutral-300 pb-2">
                    ⚙️ Especificaciones
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-neutral-600 text-sm">IMEI:</label>
                      <div className="text-neutral-800 font-mono">{selectedProductDetails.imei || "No disponible"}</div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">RAM:</label>
                      <div className="text-neutral-800">{selectedProductDetails.ram || "No especificado"}</div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">Almacenamiento:</label>
                      <div className="text-neutral-800">{selectedProductDetails.storage || "No especificado"}</div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">Estado:</label>
                      <div>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          selectedProductDetails.status === 'in_stock' ? 'bg-green-600 text-neutral-800' :
                          selectedProductDetails.status === 'assigned' ? 'bg-yellow-500 text-neutral-800' :
                          'bg-red-500 text-neutral-800'
                        }`}>
                          {selectedProductDetails.status === 'in_stock' ? '✅ En Stock' :
                           selectedProductDetails.status === 'assigned' ? '📋 Asignado' :
                           '💰 Vendido'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">Sucursal:</label>
                      <div className="text-neutral-800">{selectedProductDetails.store}</div>
                    </div>
                  </div>
                </div>

                {/* Financial Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary-600 border-b border-neutral-300 pb-2">
                    💰 Información Financiera
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-neutral-600 text-sm">Precio de Compra:</label>
                      <div className="text-primary-500 font-semibold text-lg">
                        ${parseFloat(selectedProductDetails.purchase_price || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">Precio de Venta:</label>
                      <div className="text-primary-600 font-bold text-xl">
                        ${parseFloat(selectedProductDetails.sale_price || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">Margen de Ganancia:</label>
                      <div className="text-primary-500 font-semibold">
                        ${(parseFloat(selectedProductDetails.sale_price || 0) - parseFloat(selectedProductDetails.purchase_price || 0)).toLocaleString()}
                        {selectedProductDetails.purchase_price > 0 && (
                          <span className="text-sm ml-2">
                            ({(((selectedProductDetails.sale_price - selectedProductDetails.purchase_price) / selectedProductDetails.purchase_price) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dates and History */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary-600 border-b border-neutral-300 pb-2">
                    📅 Fechas y Historial
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-neutral-600 text-sm">Fecha de Registro:</label>
                      <div className="text-neutral-800">
                        {selectedProductDetails.created_at ? 
                          new Date(selectedProductDetails.created_at).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 
                          "No disponible"
                        }
                      </div>
                    </div>
                    <div>
                      <label className="text-neutral-600 text-sm">Última Actualización:</label>
                      <div className="text-neutral-800">
                        {selectedProductDetails.updated_at ? 
                          new Date(selectedProductDetails.updated_at).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 
                          "No disponible"
                        }
                      </div>
                    </div>
                    {selectedProductDetails.quantity && (
                      <div>
                        <label className="text-neutral-600 text-sm">Cantidad en Stock:</label>
                        <div className="text-neutral-800 font-semibold">{selectedProductDetails.quantity} unidades</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t border-neutral-300">
                <button
                  onClick={() => setSelectedProductDetails(null)}
                  className="bg-gray-600 hover:bg-gray-500 text-neutral-800 px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IMEI Assignment Modal */}
        {showImeiModal && selectedProductForImei && (
          <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 border border-neutral-200">
              <h3 className="text-xl font-bold text-neutral-800 mb-4">
                📱 {selectedProductForImei.imei ? "Editar IMEI" : "Asignar IMEI"}
              </h3>
              
              <div className="mb-4">
                <p className="text-neutral-700 mb-2">
                  Producto: <span className="text-primary-600 font-semibold">
                    {selectedProductForImei.brand} {selectedProductForImei.model}
                  </span>
                </p>
                <p className="text-neutral-600 text-sm">
                  ID: #{selectedProductForImei.id} • {selectedProductForImei.color}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-neutral-700 font-medium mb-2">
                  IMEI (15 dígitos)
                </label>
                <input
                  type="text"
                  value={imeiAssignmentValue}
                  onChange={(e) => handleImeiAssignmentChange(e.target.value)}
                  maxLength={19} // Allow for 15 digits + 4 spaces (format: 123 456 789 012 345)
                  placeholder="123 456 789 012 345"
                  className={`w-full p-3 bg-gray-700 border rounded-lg text-neutral-800 font-mono ${
                    imeiAssignmentValidation.message ? 
                      (imeiAssignmentValidation.isValid ? 'border-green-500' : 'border-red-500') : 
                      'border-neutral-300'
                  }`}
                />
                {imeiAssignmentValidation.message && (
                  <p className={`text-sm mt-1 ${
                    imeiAssignmentValidation.isValid ? 'text-primary-500' : 'text-neutral-600'
                  }`}>
                    {imeiAssignmentValidation.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowImeiModal(false);
                    setSelectedProductForImei(null);
                    setImeiAssignmentValue("");
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-neutral-800 py-2 px-4 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImeiAssignment}
                  disabled={!imeiAssignmentValidation.isValid || imeiAssignmentValidation.isDuplicate}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    !imeiAssignmentValidation.isValid || imeiAssignmentValidation.isDuplicate
                      ? 'bg-gray-500 cursor-not-allowed text-neutral-700'
                      : 'bg-primary-500 hover:bg-primary-600 text-neutral-800'
                  }`}
                >
                  {selectedProductForImei.imei ? "Actualizar IMEI" : "Asignar IMEI"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminInventoryViewer;