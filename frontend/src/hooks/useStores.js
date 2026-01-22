import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

/**
 * Custom hook for fetching and managing stores data
 * Provides consistent store fetching across all components
 */
export const useStores = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchStores = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/admin/stores`, { headers });
      setStores(response.data || []);
    } catch (err) {
      console.error("Error fetching stores:", err);
      setError(err.response?.data?.error || "Error al cargar sucursales");
      // Fallback to empty array on error
      setStores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  // Helper function to format store name with icon
  const formatStoreName = (store) => {
    if (typeof store === 'string') {
      // Handle legacy string store references
      switch(store.toLowerCase()) {
        case 'chipilo': return '🏪 Chipilo';
        case 'atlixco': return '🏪 Atlixco';
        case 'cholula': return '🏪 Cholula';
        case 'warehouse': return '📦 Almacén';
        default: return store;
      }
    }
    
    // Handle store objects
    if (store && store.name) {
      const isWarehouse = store.name.toLowerCase().includes('almacén') || 
                         store.name.toLowerCase().includes('warehouse');
      const icon = isWarehouse ? '📦' : '🏪';
      return `${icon} ${store.name}`;
    }
    
    return store;
  };

  // Helper function to get store by ID
  const getStoreById = (id) => {
    return stores.find(store => store.id === parseInt(id));
  };

  // Helper function to get store name by ID
  const getStoreNameById = (id) => {
    const store = getStoreById(id);
    return store ? store.name : 'Sucursal no encontrada';
  };

  // Helper function to get formatted store name by ID
  const getFormattedStoreNameById = (id) => {
    const store = getStoreById(id);
    return store ? formatStoreName(store) : 'Sucursal no encontrada';
  };

  return {
    stores,
    loading,
    error,
    refetch: fetchStores,
    formatStoreName,
    getStoreById,
    getStoreNameById,
    getFormattedStoreNameById
  };
};

export default useStores;
