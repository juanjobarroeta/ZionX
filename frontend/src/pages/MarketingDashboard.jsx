import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const MarketingDashboard = () => {
  const [customers, setCustomers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [customersRes, teamRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/customers`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/team-members`, { headers }).catch(() => ({ data: { team_members: [] } }))
      ]);

      setCustomers(customersRes.data || []);
      setTeamMembers(teamRes.data.team_members || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
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
                <h1 className="text-2xl font-semibold text-black">ZIONX Marketing Dashboard</h1>
                <p className="text-gray-500 text-sm mt-1">Gestión integral de campañas y clientes</p>
              </div>
              <div className="flex space-x-3">
                <select className="bg-white border border-zionx-secondary rounded-lg px-4 py-2 text-zionx-primary focus:border-zionx-highlight focus:outline-none">
                  <option>Esta Semana</option>
                  <option>Este Mes</option>
                  <option>Este Trimestre</option>
                  <option>Este Año</option>
                </select>
                <button className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors">
                  🔄 Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Link
              to="/projects"
              className="bg-black text-white rounded-xl p-6 hover:bg-gray-800 transition-all"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-2">🎯</span>
                <span className="font-bold">Proyectos</span>
              </div>
            </Link>

            <Link
              to="/create-customer"
              className="bg-white border border-zionx-secondary rounded-xl p-6 hover:shadow-lg transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-2">👤</span>
                <span className="font-bold text-zionx-primary">Nuevo Cliente</span>
              </div>
            </Link>

            <Link
              to="/crm"
              className="bg-white border border-zionx-secondary rounded-xl p-6 hover:shadow-lg transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-2">📋</span>
                <span className="font-bold text-zionx-primary">Directorio</span>
              </div>
            </Link>

            <Link
              to="/team-management"
              className="bg-white border border-zionx-secondary rounded-xl p-6 hover:shadow-lg transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-2">👥</span>
                <span className="font-bold text-zionx-primary">Equipo</span>
              </div>
            </Link>

            <Link
              to="/team-dashboard"
              className="bg-white border border-zionx-secondary rounded-xl p-6 hover:shadow-lg transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-2">📊</span>
                <span className="font-bold text-zionx-primary">Analíticas</span>
              </div>
            </Link>

            <Link
              to="/income"
              className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 hover:shadow-lg transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-2">💰</span>
                <span className="font-bold text-white">Ingresos</span>
              </div>
            </Link>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zionx-accent text-sm">Total Clientes</p>
                  <p className="text-3xl font-bold text-zionx-primary">{customers.length || 5}</p>
                  <p className="text-xs text-green-600 mt-1">+12% este mes</p>
                </div>
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">👥</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zionx-accent text-sm">Proyectos Activos</p>
                  <p className="text-3xl font-bold text-zionx-primary">8</p>
                  <p className="text-xs text-green-600 mt-1">+3 este mes</p>
                </div>
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">🎯</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zionx-accent text-sm">Posts Programados</p>
                  <p className="text-3xl font-bold text-zionx-primary">47</p>
                  <p className="text-xs text-blue-600 mt-1">15 esta semana</p>
                </div>
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">📱</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zionx-accent text-sm">Tareas Pendientes</p>
                  <p className="text-3xl font-bold text-zionx-primary">{teamMembers.reduce((sum, m) => sum + (parseInt(m.active_assignments) || 0), 0) || 12}</p>
                  <p className="text-xs text-yellow-600 mt-1">4 vencen hoy</p>
                </div>
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">📋</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Clients */}
            <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-zionx-primary">👥 Clientes Recientes</h2>
                <Link to="/crm" className="text-sm text-zionx-highlight hover:text-zionx-accent">Ver todos →</Link>
              </div>
              <div className="space-y-4">
                {customers.slice(0, 5).map((customer, index) => (
                  <Link
                    key={customer.id || index}
                    to={`/customer/${customer.id}`}
                    className="flex items-center justify-between p-4 bg-zionx-tertiary rounded-lg hover:bg-zionx-secondary transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold">
                        {customer.business_name?.charAt(0) || customer.commercial_name?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <p className="font-medium text-zionx-primary">{customer.business_name || customer.commercial_name || 'Cliente'}</p>
                        <p className="text-sm text-zionx-accent">{customer.industry || 'Sin especificar'}</p>
                      </div>
                    </div>
                    <span className="text-zionx-highlight">→</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Team Overview */}
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-zionx-primary">👨‍💻 Equipo</h2>
                <Link to="/team-management" className="text-sm text-zionx-highlight hover:text-zionx-accent">Ver equipo →</Link>
              </div>
              <div className="space-y-4">
                {teamMembers.slice(0, 4).map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {member.name?.charAt(0) || 'T'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zionx-primary">{member.name}</p>
                        <p className="text-xs text-zionx-accent">{member.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-zionx-primary">{member.active_assignments || 0}</p>
                      <p className="text-xs text-zionx-accent">tareas</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="mt-6 bg-white rounded-xl p-6 border border-zionx-secondary">
            <h2 className="text-xl font-bold text-zionx-primary mb-6">📈 Actividad Reciente</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-4 bg-zionx-tertiary rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium text-zionx-primary">Post publicado en Instagram</p>
                  <p className="text-sm text-zionx-accent">GRUPO STELLA • Hace 2 horas</p>
                </div>
                <span className="text-green-600 text-sm">✅</span>
              </div>

              <div className="flex items-center space-x-4 p-4 bg-zionx-tertiary rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium text-zionx-primary">Nueva tarea asignada a Miranda</p>
                  <p className="text-sm text-zionx-accent">Diseño para campaña verano • Hace 3 horas</p>
                </div>
                <span className="text-blue-600 text-sm">📋</span>
              </div>

              <div className="flex items-center space-x-4 p-4 bg-zionx-tertiary rounded-lg">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium text-zionx-primary">Nuevo cliente registrado</p>
                  <p className="text-sm text-zionx-accent">Cliente Premium Inc. • Hace 5 horas</p>
                </div>
                <span className="text-purple-600 text-sm">👤</span>
              </div>

              <div className="flex items-center space-x-4 p-4 bg-zionx-tertiary rounded-lg">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium text-zionx-primary">Post programado para publicación</p>
                  <p className="text-sm text-zionx-accent">GRUPO STELLA • Mañana 10:00 AM</p>
                </div>
                <span className="text-yellow-600 text-sm">⏰</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MarketingDashboard;

