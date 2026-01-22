import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import Layout from "../components/Layout";
import * as XLSX from 'xlsx';

const InventoryRequest = () => {
  const [activeTab, setActiveTab] = useState("request");
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [form, setForm] = useState({
    category: "",
    amount: "",
    notes: "",
    quoteFile: null,
    inventoryFile: null,
    store: "atlixco",
    priority: "medium",
    supplier: "",
    expected_delivery: "",
    approval_required: true,
  });
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState("");

  // New state for bulk import
  const [importedData, setImportedData] = useState([]);
  const [importPreview, setImportPreview] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [bulkRequestData, setBulkRequestData] = useState({
    category: "",
    supplier: "",
    expected_delivery: "",
    notes: "",
    priority: "medium"
  });

  const token = localStorage.getItem("token");

  // Inventory categories with icons and descriptions
  const inventoryCategories = [
    { id: "phones", name: "📱 Teléfonos", description: "Smartphones y dispositivos móviles", icon: "📱" },
    { id: "licenses", name: "🔑 Licencias", description: "Software y licencias digitales", icon: "🔑" },
    { id: "accessories", name: "🎧 Accesorios", description: "Cables, cargadores, fundas", icon: "🎧" },
    { id: "computers", name: "💻 Computadoras", description: "Laptops, desktops, tablets", icon: "💻" },
    { id: "network", name: "🌐 Redes", description: "Routers, switches, cables de red", icon: "🌐" },
    { id: "office", name: "🖨️ Oficina", description: "Impresoras, escáneres, consumibles", icon: "🖨️" },
    { id: "security", name: "🔒 Seguridad", description: "Cámaras, alarmas, sistemas", icon: "🔒" },
    { id: "otros", name: "📦 Otros", description: "Otros productos y servicios", icon: "📦" },
  ];

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/inventory-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(res.data);
      
      // Separate pending approvals
      const pending = res.data.filter(req => req.status === 'pending' || !req.status);
      setPendingApprovals(pending);
    } catch (err) {
      console.error("Error fetching inventory requests:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setForm(prev => ({ ...prev, quoteFile: e.dataTransfer.files[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("category", form.category);
      formData.append("amount", form.amount);
      formData.append("notes", form.notes);
      formData.append("store_id", form.store);
      formData.append("priority", form.priority);
      formData.append("supplier", form.supplier);
      formData.append("expected_delivery", form.expected_delivery);
      formData.append("approval_required", form.approval_required);
      
      if (form.quoteFile) {
        formData.append("quote", form.quoteFile);
      }

      const res = await axios.post(`${API_BASE_URL}/inventory-requests`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const createdRequest = res.data.request;

      if (form.inventoryFile) {
        const inventoryData = new FormData();
        inventoryData.append("file", form.inventoryFile);
        inventoryData.append("inventory_request_id", createdRequest.id);
        inventoryData.append("store", form.store);

        await axios.post(`${API_BASE_URL}/inventory-items/upload`, inventoryData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
      }

      setMessage("✅ Solicitud enviada con éxito");
      setForm({ 
        category: "", 
        amount: "", 
        notes: "", 
        quoteFile: null, 
        inventoryFile: null, 
        store: "atlixco",
        priority: "medium",
        supplier: "",
        expected_delivery: "",
        approval_required: true,
      });
      fetchRequests();
    } catch (err) {
      console.error("Error submitting inventory request:", err);
      setMessage("❌ Error al enviar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await axios.put(`${API_BASE_URL}/inventory-requests/${requestId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("✅ Solicitud aprobada correctamente");
      fetchRequests();
    } catch (err) {
      console.error("Error approving request:", err);
      alert("❌ Error al aprobar la solicitud");
    }
  };

  const handleRejectRequest = async (requestId) => {
    const reason = prompt("Motivo del rechazo:");
    if (!reason) return;
    
    try {
      await axios.put(`${API_BASE_URL}/inventory-requests/${requestId}/reject`, {
        reason: reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("❌ Solicitud rechazada correctamente");
      fetchRequests();
    } catch (err) {
      console.error("Error rejecting request:", err);
      alert("❌ Error al rechazar la solicitud");
    }
  };

  const handleReceiveInventory = async (requestId) => {
    try {
      await axios.put(`${API_BASE_URL}/inventory-requests/${requestId}/receive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("📦 Inventario recibido correctamente");
      fetchRequests();
    } catch (err) {
      console.error("Error receiving inventory:", err);
      alert("❌ Error al recibir el inventario");
    }
  };

  // New functions for bulk import
  const handleFileUpload = async (file) => {
    try {
      setLoading(true);
      setImportErrors([]);
      
      let parsedData = [];
      
      if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        // Handle Excel files
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          throw new Error('Excel file must have at least a header row and one data row');
        }
        
        const headers = jsonData[0].map(h => h.toString().toLowerCase().trim());
        const dataRows = jsonData.slice(1);
        
        parsedData = dataRows.map((row, index) => {
          const item = {};
          
          headers.forEach((header, i) => {
            item[header] = row[i] ? row[i].toString().trim() : '';
          });
          
          // Add validation
          const errors = [];
          if (!item.category || !item.brand || !item.model) {
            errors.push(`Row ${index + 2}: Missing required fields`);
          }
          if (!item.quantity || isNaN(item.quantity) || parseInt(item.quantity) <= 0) {
            errors.push(`Row ${index + 2}: Invalid quantity`);
          }
          if (!item.purchase_price || isNaN(item.purchase_price)) {
            errors.push(`Row ${index + 2}: Invalid purchase price`);
          }
          
          return {
            ...item,
            id: index,
            errors,
            quantity: parseInt(item.quantity) || 0,
            purchase_price: parseFloat(item.purchase_price) || 0,
            sale_price: parseFloat(item.sale_price) || 0
          };
        });
        
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        // Handle CSV files
        const text = await file.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        parsedData = lines.slice(1).filter(line => line.trim()).map((line, index) => {
          const values = line.split(',').map(v => v.trim());
          const item = {};
          
          headers.forEach((header, i) => {
            item[header] = values[i] || '';
          });
          
          // Add validation
          const errors = [];
          if (!item.category || !item.brand || !item.model) {
            errors.push(`Row ${index + 2}: Missing required fields`);
          }
          if (!item.quantity || isNaN(item.quantity) || parseInt(item.quantity) <= 0) {
            errors.push(`Row ${index + 2}: Invalid quantity`);
          }
          if (!item.purchase_price || isNaN(item.purchase_price)) {
            errors.push(`Row ${index + 2}: Invalid purchase price`);
          }
          
          return {
            ...item,
            id: index,
            errors,
            quantity: parseInt(item.quantity) || 0,
            purchase_price: parseFloat(item.purchase_price) || 0,
            sale_price: parseFloat(item.sale_price) || 0
          };
        });
      } else {
        throw new Error('Unsupported file format. Please upload .xlsx, .xls, or .csv files.');
      }
      
      if (parsedData.length === 0) {
        throw new Error('No data found in file. Please check the file format.');
      }
      
      setImportedData(parsedData);
      setImportPreview(true);
      
      // Auto-calculate totals
      const totalAmount = parsedData.reduce((sum, item) => sum + (item.purchase_price * item.quantity), 0);
      setBulkRequestData(prev => ({
        ...prev,
        amount: totalAmount,
        category: parsedData[0]?.category || ""
      }));
      
    } catch (error) {
      console.error('Error parsing file:', error);
      setImportErrors([error.message || 'Error parsing file. Please check the format.']);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkEdit = (index, field, value) => {
    setImportedData(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleBulkDelete = (index) => {
    setImportedData(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkSubmit = async () => {
    try {
      setLoading(true);
      
      // Validate all items
      const validItems = importedData.filter(item => item.errors.length === 0);
      if (validItems.length === 0) {
        setImportErrors(['No valid items to submit']);
        return;
      }
      
      // Calculate total amount
      const totalAmount = validItems.reduce((sum, item) => sum + (item.purchase_price * item.quantity), 0);
      
      // Create bulk request
      const response = await fetch(`${API_BASE_URL}/inventory-requests/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...bulkRequestData,
          amount: totalAmount,
          items: validItems
        })
      });
      
      if (response.ok) {
        setImportPreview(false);
        setImportedData([]);
        setBulkRequestData({
          category: "",
          supplier: "",
          expected_delivery: "",
          notes: "",
          priority: "medium"
        });
        fetchRequests();
        alert('Bulk inventory request created successfully!');
      } else {
        const error = await response.json();
        setImportErrors([error.message || 'Error creating bulk request']);
      }
    } catch (error) {
      console.error('Error submitting bulk request:', error);
      setImportErrors(['Error submitting request']);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const analytics = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const received = requests.filter(r => r.status === 'received').length;
    const totalAmount = requests.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    
    return { total, pending, approved, received, totalAmount };
  }, [requests]);

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-neutral-800 mb-2">📦 Solicitud de Inventario</h1>
              <p className="text-neutral-600">Gestión completa de solicitudes de inventario</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={fetchRequests}
                className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-neutral-800 font-bold px-6 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                🔄 Actualizar
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-4 rounded-xl text-neutral-800">
              <div className="text-2xl font-bold">{analytics.total}</div>
              <div className="text-sm opacity-90">Total Solicitudes</div>
            </div>
            <div className="bg-gradient-to-r from-yellow-500 to-orange-600 p-4 rounded-xl text-neutral-800">
              <div className="text-2xl font-bold">{analytics.pending}</div>
              <div className="text-sm opacity-90">Pendientes</div>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 rounded-xl text-neutral-800">
              <div className="text-2xl font-bold">{analytics.approved}</div>
              <div className="text-sm opacity-90">Aprobadas</div>
            </div>
            <div className="bg-gradient-to-r from-purple-500 to-violet-600 p-4 rounded-xl text-neutral-800">
              <div className="text-2xl font-bold">{analytics.received}</div>
              <div className="text-sm opacity-90">Recibidas</div>
            </div>
            <div className="bg-gradient-to-r from-pink-500 to-rose-600 p-4 rounded-xl text-neutral-800">
              <div className="text-2xl font-bold">${analytics.totalAmount.toLocaleString()}</div>
              <div className="text-sm opacity-90">Monto Total</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-white p-1 rounded-lg">
          {[
            { id: "request", label: "📝 Solicitud Individual", icon: "📝", description: "Crear una solicitud manual" },
            { id: "import", label: "📤 Importación Masiva", icon: "📤", description: "Subir Excel/CSV con múltiples artículos" },
            { id: "approvals", label: "✅ Aprobaciones", icon: "✅", description: "Revisar solicitudes pendientes" },
            { id: "tracking", label: "📊 Seguimiento", icon: "📊", description: "Ver estado de solicitudes" },
            { id: "reception", label: "📦 Recepción", icon: "📦", description: "Recibir inventario aprobado" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 relative group ${
                activeTab === tab.id
                  ? "bg-primary-500 text-neutral-800 shadow-lg"
                  : "text-neutral-600 hover:text-neutral-800 hover:bg-gray-700"
              }`}
              title={tab.description}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-surface-50 to-surface-100 text-neutral-800 text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  {tab.description}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "request" && (
          <div className="space-y-6">
            {/* Help Section */}
            <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
              <h3 className="text-primary-500 font-semibold mb-2">💡 ¿Cuándo usar Solicitud Individual?</h3>
              <ul className="text-blue-300 text-sm space-y-1">
                <li>• Para solicitar 1-3 artículos específicos</li>
                <li>• Cuando necesitas adjuntar cotizaciones o documentos</li>
                <li>• Para solicitudes urgentes o de alta prioridad</li>
                <li>• Cuando necesitas agregar notas detalladas</li>
              </ul>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Request Form */}
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
                <h2 className="text-xl font-bold text-primary-500 mb-6">📝 Nueva Solicitud de Inventario</h2>
                
                {message && (
                  <div className={`mb-6 p-4 rounded-lg font-medium ${
                    message.startsWith("✅")
                      ? "bg-green-500/20 text-green-300 border border-green-500/30"
                      : "bg-red-500/20 text-red-300 border border-red-500/30"
                  }`}>
                    {message}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Categoría</label>
                      <select
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        name="category"
                        value={form.category}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Selecciona una categoría</option>
                        {inventoryCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Sucursal Destino</label>
                      <select
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        name="store"
                        value={form.store}
                        onChange={handleChange}
                        required
                      >
                        <option value="atlixco">🏢 Atlixco</option>
                        <option value="cholula">🏢 Cholula</option>
                        <option value="chipilo">🏢 Chipilo</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Monto Total (MXN)</label>
                      <input
                        type="number"
                        name="amount"
                        value={form.amount}
                        onChange={handleChange}
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Prioridad</label>
                      <select
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        name="priority"
                        value={form.priority}
                        onChange={handleChange}
                      >
                        <option value="low">🟢 Baja</option>
                        <option value="medium">🟡 Media</option>
                        <option value="high">🔴 Alta</option>
                        <option value="urgent">🚨 Urgente</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Proveedor</label>
                      <input
                        type="text"
                        name="supplier"
                        value={form.supplier}
                        onChange={handleChange}
                        className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                        placeholder="Nombre del proveedor"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Fecha de Entrega Esperada</label>
                    <input
                      type="date"
                      name="expected_delivery"
                      value={form.expected_delivery}
                      onChange={handleChange}
                      className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Notas (opcional)</label>
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      className="w-full p-3 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:border-primary-500 focus:outline-none"
                      rows={3}
                      placeholder="Detalles adicionales sobre la solicitud..."
                    />
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="approval_required"
                        checked={form.approval_required}
                        onChange={handleChange}
                        className="mr-2"
                        disabled
                      />
                      ✅ Requiere Aprobación (Obligatorio)
                    </label>
                  </div>

                  {/* File Uploads */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Cotización del Proveedor</label>
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          dragActive ? 'border-primary-500 bg-green-900/20' : 'border-neutral-300'
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => setForm({ ...form, quoteFile: e.target.files[0] })}
                          className="hidden"
                          id="quote-upload"
                        />
                        <label htmlFor="quote-upload" className="cursor-pointer">
                          {form.quoteFile ? (
                            <div>
                              <div className="text-primary-500 text-lg mb-2">✅ Archivo seleccionado</div>
                              <div className="text-sm text-neutral-600">{form.quoteFile.name}</div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-4xl mb-4">📄</div>
                              <div className="text-lg mb-2">Arrastra archivos aquí o haz clic</div>
                              <div className="text-sm text-neutral-600">PDF, PNG, JPG hasta 10MB</div>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Archivo de Inventario</label>
                      <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept=".xlsx,.csv"
                          onChange={(e) => setForm({ ...form, inventoryFile: e.target.files[0] })}
                          className="hidden"
                          id="inventory-upload"
                        />
                        <label htmlFor="inventory-upload" className="cursor-pointer">
                          {form.inventoryFile ? (
                            <div>
                              <div className="text-primary-500 text-lg mb-2">✅ Archivo seleccionado</div>
                              <div className="text-sm text-neutral-600">{form.inventoryFile.name}</div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-4xl mb-4">📊</div>
                              <div className="text-lg mb-2">Arrastra archivos aquí o haz clic</div>
                              <div className="text-sm text-neutral-600">Excel, CSV hasta 10MB</div>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-neutral-800 font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
                  >
                    {loading ? "⏳ Enviando..." : "📦 Enviar Solicitud"}
                  </button>
                </form>
              </div>
            </div>

            {/* Categories Overview */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
                <h3 className="text-lg font-bold text-primary-500 mb-4">📊 Categorías</h3>
                <div className="space-y-3">
                  {inventoryCategories.map(category => (
                    <div key={category.id} className="bg-white rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{category.icon}</div>
                        <div>
                          <div className="font-semibold text-neutral-800">{category.name}</div>
                          <div className="text-sm text-neutral-600">{category.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {activeTab === "import" && (
          <div className="space-y-6">
            {/* Help Section */}
            <div className="bg-purple-900/20 border border-purple-600 rounded-lg p-4">
              <h3 className="text-purple-400 font-semibold mb-2">💡 ¿Cuándo usar Importación Masiva?</h3>
              <ul className="text-purple-300 text-sm space-y-1">
                <li>• Para solicitar 4+ artículos de una vez</li>
                <li>• Cuando tienes datos en Excel/CSV de proveedores</li>
                <li>• Para inventarios completos o grandes pedidos</li>
                <li>• Cuando necesitas procesar múltiples productos rápidamente</li>
              </ul>
            </div>
            
            {/* Import Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-neutral-800">
              <h2 className="text-2xl font-bold mb-2">📤 Importar Inventario</h2>
              <p className="text-blue-100">Sube un archivo Excel/CSV para crear solicitudes masivas de inventario</p>
            </div>

            {/* File Upload Area */}
            {!importPreview && (
              <div className="bg-white rounded-lg p-8 border-2 border-dashed border-neutral-300">
                <div className="text-center">
                  <div className="text-4xl mb-4">📁</div>
                  <h3 className="text-xl font-semibold mb-2">Arrastra tu archivo aquí</h3>
                  <p className="text-neutral-600 mb-4">o haz clic para seleccionar</p>
                  
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="bg-primary-500 text-neutral-800 px-6 py-3 rounded-lg font-semibold cursor-pointer hover:bg-emerald-500 transition-colors"
                  >
                    Seleccionar Archivo
                  </label>
                  
                  <div className="mt-4 text-sm text-gray-500">
                    <p>Formatos soportados: .xlsx, .csv</p>
                    <p>Columnas requeridas: category, brand, model, color, ram, storage, quantity, purchase_price, sale_price</p>
                  </div>
                </div>
              </div>
            )}

            {/* Import Preview */}
            {importPreview && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-600 rounded-lg p-4 text-neutral-800">
                    <div className="text-2xl font-bold">{importedData.length}</div>
                    <div className="text-sm">Artículos</div>
                  </div>
                  <div className="bg-green-600 rounded-lg p-4 text-neutral-800">
                    <div className="text-2xl font-bold">
                      ${importedData.reduce((sum, item) => sum + (item.purchase_price * item.quantity), 0).toLocaleString()}
                    </div>
                    <div className="text-sm">Total</div>
                  </div>
                  <div className="bg-orange-600 rounded-lg p-4 text-neutral-800">
                    <div className="text-2xl font-bold">
                      {importedData.filter(item => item.errors.length > 0).length}
                    </div>
                    <div className="text-sm">Errores</div>
                  </div>
                  <div className="bg-purple-600 rounded-lg p-4 text-neutral-800">
                    <div className="text-2xl font-bold">
                      {importedData.reduce((sum, item) => sum + item.quantity, 0)}
                    </div>
                    <div className="text-sm">Unidades</div>
                  </div>
                </div>

                {/* Request Details */}
                <div className="bg-white rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Detalles de la Solicitud</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Categoría</label>
                      <input
                        type="text"
                        value={bulkRequestData.category}
                        onChange={(e) => setBulkRequestData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full bg-gray-700 text-neutral-800 px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Proveedor</label>
                      <input
                        type="text"
                        value={bulkRequestData.supplier}
                        onChange={(e) => setBulkRequestData(prev => ({ ...prev, supplier: e.target.value }))}
                        className="w-full bg-gray-700 text-neutral-800 px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Fecha de Entrega Esperada</label>
                      <input
                        type="date"
                        value={bulkRequestData.expected_delivery}
                        onChange={(e) => setBulkRequestData(prev => ({ ...prev, expected_delivery: e.target.value }))}
                        className="w-full bg-gray-700 text-neutral-800 px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Prioridad</label>
                      <select
                        value={bulkRequestData.priority}
                        onChange={(e) => setBulkRequestData(prev => ({ ...prev, priority: e.target.value }))}
                        className="w-full bg-gray-700 text-neutral-800 px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 focus:outline-none"
                      >
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-2">Notas</label>
                    <textarea
                      value={bulkRequestData.notes}
                      onChange={(e) => setBulkRequestData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full bg-gray-700 text-neutral-800 px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-neutral-200">
                    <h3 className="text-lg font-semibold">Artículos Importados</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">Categoría</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Marca</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Modelo</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Color</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">RAM</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Almacenamiento</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Cantidad</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Precio Compra</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Precio Venta</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importedData.map((item, index) => (
                          <tr key={item.id} className={`border-b border-neutral-200 ${item.errors.length > 0 ? 'bg-red-900/20' : ''}`}>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.category}
                                onChange={(e) => handleBulkEdit(index, 'category', e.target.value)}
                                className="w-full bg-gray-700 text-neutral-800 px-2 py-1 rounded border border-neutral-300 focus:border-primary-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.brand}
                                onChange={(e) => handleBulkEdit(index, 'brand', e.target.value)}
                                className="w-full bg-gray-700 text-neutral-800 px-2 py-1 rounded border border-neutral-300 focus:border-primary-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.model}
                                onChange={(e) => handleBulkEdit(index, 'model', e.target.value)}
                                className="w-full bg-gray-700 text-neutral-800 px-2 py-1 rounded border border-neutral-300 focus:border-primary-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.color}
                                onChange={(e) => handleBulkEdit(index, 'color', e.target.value)}
                                className="w-full bg-gray-700 text-neutral-800 px-2 py-1 rounded border border-neutral-300 focus:border-primary-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.ram}
                                onChange={(e) => handleBulkEdit(index, 'ram', e.target.value)}
                                className="w-full bg-gray-700 text-neutral-800 px-2 py-1 rounded border border-neutral-300 focus:border-primary-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.storage}
                                onChange={(e) => handleBulkEdit(index, 'storage', e.target.value)}
                                className="w-full bg-gray-700 text-neutral-800 px-2 py-1 rounded border border-neutral-300 focus:border-primary-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleBulkEdit(index, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-full bg-gray-700 text-neutral-800 px-2 py-1 rounded border border-neutral-300 focus:border-primary-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={item.purchase_price}
                                onChange={(e) => handleBulkEdit(index, 'purchase_price', parseFloat(e.target.value) || 0)}
                                className="w-full bg-gray-700 text-neutral-800 px-2 py-1 rounded border border-neutral-300 focus:border-primary-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={item.sale_price}
                                onChange={(e) => handleBulkEdit(index, 'sale_price', parseFloat(e.target.value) || 0)}
                                className="w-full bg-gray-700 text-neutral-800 px-2 py-1 rounded border border-neutral-300 focus:border-primary-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleBulkDelete(index)}
                                className="text-neutral-600 hover:text-red-300"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setImportPreview(false);
                      setImportedData([]);
                    }}
                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-neutral-800 rounded-lg font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={loading || importedData.filter(item => item.errors.length === 0).length === 0}
                    className="px-6 py-3 bg-primary-500 hover:bg-emerald-500 text-neutral-800 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creando...' : 'Crear Solicitud Masiva'}
                  </button>
                </div>

                {/* Error Display */}
                {importErrors.length > 0 && (
                  <div className="bg-red-900/20 border border-red-600 rounded-lg p-4">
                    <h4 className="text-neutral-600 font-semibold mb-2">Errores encontrados:</h4>
                    <ul className="text-red-300 text-sm space-y-1">
                      {importErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "approvals" && (
          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
            <h2 className="text-xl font-bold text-primary-500 mb-6">✅ Aprobaciones Pendientes</h2>
            
            {pendingApprovals.length === 0 ? (
              <div className="text-center text-neutral-600 py-8">
                <div className="text-4xl mb-4">🎉</div>
                <div className="text-lg mb-2">¡Excelente!</div>
                <div className="text-sm">No hay aprobaciones pendientes</div>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((request) => (
                  <div key={request.id} className="bg-white rounded-lg p-4 border border-neutral-300">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            request.priority === 'urgent' ? 'bg-red-900 text-red-200' :
                            request.priority === 'high' ? 'bg-orange-900 text-orange-200' :
                            request.priority === 'medium' ? 'bg-yellow-900 text-yellow-200' :
                            'bg-green-900 text-green-200'
                          }`}>
                            {request.priority === 'urgent' ? '🚨 Urgente' :
                             request.priority === 'high' ? '🔴 Alta' :
                             request.priority === 'medium' ? '🟡 Media' : '🟢 Baja'}
                          </span>
                          <span className="text-sm text-neutral-600">
                            {request.created_at ? new Date(request.created_at).toLocaleDateString() : "Sin fecha"}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <div className="text-sm text-neutral-600">Categoría</div>
                            <div className="font-semibold">{inventoryCategories.find(c => c.id === request.category)?.name || request.category}</div>
                          </div>
                          <div>
                            <div className="text-sm text-neutral-600">Sucursal</div>
                            <div className="font-semibold">{request.store || "N/A"}</div>
                          </div>
                          <div>
                            <div className="text-sm text-neutral-600">Monto</div>
                            <div className="font-semibold text-primary-500">
                              ${request.amount ? parseFloat(request.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                            </div>
                          </div>
                        </div>
                        
                        {request.notes && (
                          <div className="mt-2">
                            <div className="text-sm text-neutral-600">Notas</div>
                            <div className="text-sm">{request.notes}</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleApproveRequest(request.id)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-neutral-800 rounded-lg font-semibold transition-colors"
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-neutral-800 rounded-lg font-semibold transition-colors"
                        >
                          ❌ Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "tracking" && (
          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
            <h2 className="text-xl font-bold text-primary-500 mb-6">📊 Seguimiento de Solicitudes</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-3 px-4 text-neutral-600 font-semibold">ID</th>
                    <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Categoría</th>
                    <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Sucursal</th>
                    <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Monto</th>
                    <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Prioridad</th>
                    <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Estado</th>
                    <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Fecha</th>
                    <th className="text-left py-3 px-4 text-neutral-600 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-b border-gray-800 hover:bg-white">
                      <td className="py-3 px-4 text-neutral-800">#{request.id}</td>
                      <td className="py-3 px-4 text-neutral-800">
                        {inventoryCategories.find(c => c.id === request.category)?.name || request.category}
                      </td>
                      <td className="py-3 px-4 text-neutral-700">{request.store || "N/A"}</td>
                      <td className="py-3 px-4 text-neutral-800 font-semibold">
                        ${request.amount ? parseFloat(request.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          request.priority === 'urgent' ? 'bg-red-900 text-red-200' :
                          request.priority === 'high' ? 'bg-orange-900 text-orange-200' :
                          request.priority === 'medium' ? 'bg-yellow-900 text-yellow-200' :
                          'bg-green-900 text-green-200'
                        }`}>
                          {request.priority === 'urgent' ? '🚨 Urgente' :
                           request.priority === 'high' ? '🔴 Alta' :
                           request.priority === 'medium' ? '🟡 Media' : '🟢 Baja'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          request.status === 'pending' || !request.status ? 'bg-yellow-900 text-yellow-200' :
                          request.status === 'approved' ? 'bg-green-900 text-green-200' :
                          request.status === 'rejected' ? 'bg-red-900 text-red-200' :
                          request.status === 'received' ? 'bg-blue-900 text-blue-200' :
                          'bg-gradient-to-br from-surface-50 to-surface-100 text-gray-200'
                        }`}>
                          {request.status === 'pending' || !request.status ? '⏳ Pendiente' :
                           request.status === 'approved' ? '✅ Aprobado' :
                           request.status === 'rejected' ? '❌ Rechazado' :
                           request.status === 'received' ? '📦 Recibido' :
                           '❓ Desconocido'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-700">
                        {request.created_at ? new Date(request.created_at).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {request.status === 'approved' && (
                            <button
                              onClick={() => handleReceiveInventory(request.id)}
                              className="text-primary-500 hover:text-blue-300 text-sm"
                            >
                              📦 Recibir
                            </button>
                          )}
                          <button className="text-primary-500 hover:text-emerald-400 text-sm">
                            👁️ Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "reception" && (
          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-neutral-200">
            <h2 className="text-xl font-bold text-primary-500 mb-6">📦 Recepción de Inventario</h2>
            
            <div className="text-center text-neutral-600 py-8">
              <div className="text-4xl mb-4">📦</div>
              <div className="text-lg mb-2">Recepción de Inventario</div>
              <div className="text-sm">Aquí podrás marcar el inventario como recibido</div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default InventoryRequest;
