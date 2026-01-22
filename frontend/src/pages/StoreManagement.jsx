import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const StoreManagement = () => {
  const [stores, setStores] = useState([]);
  const [availableManagers, setAvailableManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [storeDetails, setStoreDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterManager, setFilterManager] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    manager_id: ""
  });

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // Load initial data
  useEffect(() => {
    fetchStores();
    fetchAvailableManagers();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/admin/stores`, { headers });
      setStores(response.data);
    } catch (error) {
      console.error("Error fetching stores:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableManagers = async (currentManagerId = null) => {
    try {
      const params = currentManagerId ? `?current_manager_id=${currentManagerId}` : '';
      const response = await axios.get(`${API_BASE_URL}/admin/stores/available-managers${params}`, { headers });
      setAvailableManagers(response.data);
    } catch (error) {
      console.error("Error fetching available managers:", error);
      setAvailableManagers([]);
    }
  };

  const fetchStoreDetails = async (storeId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/stores/${storeId}/details`, { headers });
      setStoreDetails(response.data);
    } catch (error) {
      console.error("Error fetching store details:", error);
      setStoreDetails(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedStore) {
        // Update store
        await axios.put(`${API_BASE_URL}/admin/stores/${selectedStore.id}`, formData, { headers });
      } else {
        // Create store
        await axios.post(`${API_BASE_URL}/admin/stores`, formData, { headers });
      }
      
      fetchStores();
      fetchAvailableManagers();
      setShowCreateModal(false);
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving store:", error);
      alert(error.response?.data?.error || "Error al guardar sucursal");
    }
  };

  const handleDelete = async (storeId) => {
    const store = stores.find(s => s.id === storeId);
    if (!window.confirm(`¿Estás seguro de que quieres desactivar "${store.name}"?`)) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/admin/stores/${storeId}`, { headers });
      fetchStores();
      fetchAvailableManagers();
    } catch (error) {
      console.error("Error deleting store:", error);
      alert(error.response?.data?.error || "Error al desactivar sucursal");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      phone: "",
      manager_id: ""
    });
    setSelectedStore(null);
  };

  const openEditModal = (store) => {
    setSelectedStore(store);
    setFormData({
      name: store.name,
      address: store.address || "",
      phone: store.phone || "",
      manager_id: store.manager_id || ""
    });
    fetchAvailableManagers(store.manager_id);
    setShowEditModal(true);
  };

  const openDetailsModal = (store) => {
    setSelectedStore(store);
    fetchStoreDetails(store.id);
    setShowDetailsModal(true);
  };

  // Filter stores
  const filteredStores = stores.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (store.address && store.address.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesManager = !filterManager || 
                          (store.manager_name && store.manager_name.toLowerCase().includes(filterManager.toLowerCase()));
    
    return matchesSearch && matchesManager;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStoreIcon = (storeName) => {
    if (storeName.toLowerCase().includes('almacén') || storeName.toLowerCase().includes('warehouse')) {
      return '📦';
    }
    return '🏪';
  };

  const getManagerStatus = (store) => {
    if (!store.manager_name) {
      return <span className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded-full">Sin Gerente</span>;
    }
    return <span className="px-2 py-1 text-xs bg-green-900 text-green-300 rounded-full">Con Gerente</span>;
  };

  const getStaffStatusColor = (store) => {
    const staffCount = parseInt(store.staff_count) || 0;
    if (staffCount === 0) return 'text-neutral-600';
    if (staffCount <= 2) return 'text-yellow-400';
    return 'text-primary-500';
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-950 text-neutral-800 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-neutral-800 mb-2">🏪 Gestión de Sucursales</h1>
              <p className="text-neutral-600">Administra sucursales, gerentes y personal</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                fetchAvailableManagers();
                setShowCreateModal(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-neutral-800 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <span className="text-lg">➕</span>
              Crear Sucursal
            </button>
          </div>

          {/* Filters */}
          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <input
                  type="text"
                  placeholder="🔍 Buscar sucursales..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="👤 Filtrar por gerente..."
                  value={filterManager}
                  onChange={(e) => setFilterManager(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="text-sm text-neutral-600 flex items-center">
                Mostrando {filteredStores.length} de {stores.length} sucursales
              </div>
            </div>
          </div>

          {/* Stores Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-neutral-600 mb-2">⏳</div>
              <p className="text-neutral-600">Cargando sucursales...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredStores.map(store => (
                <div key={store.id} className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 border border-gray-800 hover:border-neutral-200 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{getStoreIcon(store.name)}</div>
                      <div>
                        <h3 className="font-semibold text-neutral-800 text-lg">{store.name}</h3>
                        <p className="text-sm text-neutral-600">{store.address || 'Sin dirección'}</p>
                      </div>
                    </div>
                    {getManagerStatus(store)}
                  </div>

                  <div className="space-y-3 mb-4">
                    {store.manager_name && (
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-600">Gerente:</span>
                        <span className="text-neutral-800 font-medium">{store.manager_name}</span>
                      </div>
                    )}
                    
                    {store.phone && (
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-600">Teléfono:</span>
                        <span className="text-neutral-800">{store.phone}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Personal:</span>
                      <span className={`font-medium ${getStaffStatusColor(store)}`}>
                        {store.staff_count || 0} empleados
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Activos (30d):</span>
                      <span className="text-primary-500 font-medium">
                        {store.active_staff_count || 0} activos
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Creada:</span>
                      <span className="text-neutral-800">{formatDate(store.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openDetailsModal(store)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-neutral-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      📊 Detalles
                    </button>
                    <button
                      onClick={() => openEditModal(store)}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-neutral-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDelete(store.id)}
                      className="bg-red-600 hover:bg-red-700 text-neutral-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      disabled={parseInt(store.staff_count) > 0}
                      title={parseInt(store.staff_count) > 0 ? "No se puede eliminar: tiene personal asignado" : "Desactivar sucursal"}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create/Edit Modal */}
          {(showCreateModal || showEditModal) && createPortal(
            <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-neutral-800">
                    {selectedStore ? "✏️ Editar Sucursal" : "➕ Crear Sucursal"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      resetForm();
                    }}
                    className="text-neutral-600 hover:text-neutral-800 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Nombre de la Sucursal *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ej: Sucursal Centro"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Dirección
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Dirección completa de la sucursal"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ej: +52 222 123 4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Gerente
                    </label>
                    <select
                      value={formData.manager_id}
                      onChange={(e) => setFormData({...formData, manager_id: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Sin gerente asignado</option>
                      {availableManagers.map(manager => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} ({manager.role})
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-500 mt-1">
                      Solo se muestran usuarios disponibles para ser gerentes
                    </p>
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t border-neutral-200">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setShowEditModal(false);
                        resetForm();
                      }}
                      className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-neutral-800 rounded-lg font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-neutral-800 rounded-lg font-medium transition-colors"
                    >
                      {selectedStore ? "Actualizar Sucursal" : "Crear Sucursal"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* Details Modal */}
          {showDetailsModal && createPortal(
            <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-neutral-800">
                    📊 Detalles de {selectedStore?.name}
                  </h2>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-neutral-600 hover:text-neutral-800 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                {storeDetails ? (
                  <div className="space-y-6">
                    {/* Store Info */}
                    <div className="bg-white rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-3">ℹ️ Información General</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-neutral-600">Nombre</p>
                          <p className="text-neutral-800 font-medium">{storeDetails.store.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-neutral-600">Teléfono</p>
                          <p className="text-neutral-800">{storeDetails.store.phone || 'No especificado'}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-sm text-neutral-600">Dirección</p>
                          <p className="text-neutral-800">{storeDetails.store.address || 'No especificada'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Manager Info */}
                    <div className="bg-white rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-3">👤 Gerente</h3>
                      {storeDetails.store.manager_name ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-neutral-600">Nombre</p>
                            <p className="text-neutral-800 font-medium">{storeDetails.store.manager_name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-neutral-600">Email</p>
                            <p className="text-neutral-800">{storeDetails.store.manager_email}</p>
                          </div>
                          {storeDetails.store.manager_phone && (
                            <div>
                              <p className="text-sm text-neutral-600">Teléfono</p>
                              <p className="text-neutral-800">{storeDetails.store.manager_phone}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-neutral-600">Sin gerente asignado</p>
                      )}
                    </div>

                    {/* Analytics */}
                    <div className="bg-white rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-3">📈 Estadísticas de Personal</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary-500">{storeDetails.analytics.total_staff}</div>
                          <div className="text-sm text-neutral-600">Total Personal</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary-500">{storeDetails.analytics.active_staff}</div>
                          <div className="text-sm text-neutral-600">Activos (30d)</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-400">{storeDetails.analytics.admin_count}</div>
                          <div className="text-sm text-neutral-600">Administradores</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-400">{storeDetails.analytics.staff_count}</div>
                          <div className="text-sm text-neutral-600">Staff</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-neutral-600 mb-2">⏳</div>
                    <p className="text-neutral-600">Cargando detalles...</p>
                  </div>
                )}
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </Layout>
  );
};

export default StoreManagement;
