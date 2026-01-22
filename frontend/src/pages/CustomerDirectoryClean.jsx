import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const CustomerDirectoryClean = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const searchTerm = search.toLowerCase();
    return (
      (customer.business_name?.toLowerCase().includes(searchTerm)) ||
      (customer.commercial_name?.toLowerCase().includes(searchTerm)) ||
      (customer.contact_email?.toLowerCase().includes(searchTerm))
    );
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zionx-accent"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-black">Clientes</h1>
              <p className="text-gray-500 text-sm mt-1">Gestión de clientes y cuentas</p>
            </div>
            <Link
              to="/create-customer"
              className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              ➕ Nuevo Cliente
            </Link>
          </div>
        </div>

        {/* Search and Stats */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Clientes</p>
                  <p className="text-3xl font-bold text-black">{customers.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Clientes Activos</p>
                  <p className="text-3xl font-bold text-black">{customers.length}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Proyectos Activos</p>
                  <p className="text-3xl font-bold text-black">8</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Posts Programados</p>
                  <p className="text-3xl font-bold text-black">47</p>
                </div>
                <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📱</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="🔍 Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-zionx-accent transition-colors"
            />
          </div>

          {/* Customers List */}
          <div className="space-y-4">
            {filteredCustomers.map((customer) => (
              <Link
                key={customer.id}
                to={`/customer/${customer.id}`}
                className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg hover:border-zionx-accent transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {customer.business_name?.charAt(0) || customer.commercial_name?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-black">
                        {customer.business_name || customer.commercial_name || 'Cliente Sin Nombre'}
                      </h3>
                      {customer.commercial_name && customer.business_name !== customer.commercial_name && (
                        <p className="text-sm text-gray-600">Comercial: {customer.commercial_name}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-1">
                        <p className="text-sm text-gray-500">{customer.contact_email || customer.email}</p>
                        {customer.industry && (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {customer.industry}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Posts este mes</p>
                      <p className="text-2xl font-bold text-zionx-accent">12</p>
                    </div>
                    <span className="text-gray-400 text-2xl">→</span>
                  </div>
                </div>
              </Link>
            ))}

            {filteredCustomers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No se encontraron clientes</p>
                <Link
                  to="/create-customer"
                  className="inline-block mt-4 text-zionx-accent hover:text-zionx-highlight"
                >
                  ➕ Crear primer cliente
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CustomerDirectoryClean;

