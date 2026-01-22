import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const LeadsAnalytics = () => {
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchLeads();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/leads/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/leads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeads(response.data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const leadsBySource = leads.reduce((acc, lead) => {
    acc[lead.source] = (acc[lead.source] || 0) + 1;
    return acc;
  }, {});

  const leadsByStatus = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});

  const conversionRate = stats?.total_leads > 0 
    ? ((stats.converted_leads / stats.total_leads) * 100).toFixed(1) 
    : 0;

  const lostRate = stats?.total_leads > 0 
    ? ((stats.lost_leads / stats.total_leads) * 100).toFixed(1) 
    : 0;

  return (
    <Layout>
      <div className="min-h-screen bg-white p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">📈 Analíticas de Leads</h1>
          <p className="text-gray-600">Métricas y rendimiento de tu pipeline de ventas</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
          </div>
        ) : (
          <>
            {/* Main Stats */}
            <div className="grid grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                <p className="text-blue-100 text-sm mb-1">Total Leads</p>
                <p className="text-4xl font-bold mb-2">{stats?.total_leads || 0}</p>
                <p className="text-blue-100 text-xs">+{stats?.new_leads || 0} nuevos este mes</p>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
                <p className="text-green-100 text-sm mb-1">Tasa de Conversión</p>
                <p className="text-4xl font-bold mb-2">{conversionRate}%</p>
                <p className="text-green-100 text-xs">{stats?.converted_leads || 0} convertidos</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                <p className="text-purple-100 text-sm mb-1">Leads Calificados</p>
                <p className="text-4xl font-bold mb-2">{stats?.qualified_leads || 0}</p>
                <p className="text-purple-100 text-xs">Alta prioridad</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg p-6 text-white">
                <p className="text-yellow-100 text-sm mb-1">Score Promedio</p>
                <p className="text-4xl font-bold mb-2">{stats?.avg_lead_score || 0}</p>
                <p className="text-yellow-100 text-xs">De 100 puntos</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              {/* Leads by Source */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-black mb-4">Leads por Fuente</h3>
                <div className="space-y-3">
                  {Object.entries(leadsBySource).map(([source, count]) => {
                    const percentage = ((count / leads.length) * 100).toFixed(1);
                    return (
                      <div key={source}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 capitalize">{source}</span>
                          <span className="text-sm font-medium text-black">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leads by Status */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-black mb-4">Leads por Estado</h3>
                <div className="space-y-3">
                  {Object.entries(leadsByStatus).map(([status, count]) => {
                    const percentage = ((count / leads.length) * 100).toFixed(1);
                    const colors = {
                      new: 'bg-blue-500',
                      contacted: 'bg-yellow-500',
                      qualified: 'bg-purple-500',
                      proposal_sent: 'bg-indigo-500',
                      negotiation: 'bg-orange-500',
                      converted: 'bg-green-500',
                      lost: 'bg-red-500',
                    };
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 capitalize">{status}</span>
                          <span className="text-sm font-medium text-black">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`${colors[status]} h-2 rounded-full transition-all`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-black mb-4">⚡ Velocidad de Respuesta</h3>
                <p className="text-3xl font-bold text-black mb-2">-</p>
                <p className="text-sm text-gray-600">Promedio de respuesta</p>
                <p className="text-xs text-gray-500 mt-2">
                  📊 Tiempo entre mensaje y primera respuesta
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-black mb-4">💬 Mensajes Enviados</h3>
                <p className="text-3xl font-bold text-black mb-2">-</p>
                <p className="text-sm text-gray-600">Total este mes</p>
                <p className="text-xs text-gray-500 mt-2">
                  📱 Via WhatsApp Business API
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-black mb-4">🎯 Tasa de Pérdida</h3>
                <p className="text-3xl font-bold text-red-600 mb-2">{lostRate}%</p>
                <p className="text-sm text-gray-600">{stats?.lost_leads || 0} leads perdidos</p>
                <p className="text-xs text-gray-500 mt-2">
                  Del total de leads
                </p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-black mb-4">📋 Leads Recientes</h3>
              <div className="space-y-3">
                {leads.slice(0, 10).map(lead => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => window.location.href = `/leads-inbox?lead=${lead.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                        {(lead.whatsapp_name || 'L').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-black">{lead.whatsapp_name || 'Sin nombre'}</p>
                        <p className="text-sm text-gray-500">{lead.service_interest || 'Sin servicio'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(lead.status)} text-white font-medium`}>
                        {getStatusLabel(lead.status)}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(lead.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-800 mb-3">💡 Métricas Avanzadas (Próximamente)</h3>
              <ul className="text-sm text-blue-700 space-y-2">
                <li>📊 Gráficas de tendencia mensual</li>
                <li>⏱️ Tiempo promedio de conversión</li>
                <li>👥 Rendimiento por miembro del equipo</li>
                <li>💰 Valor proyectado de leads calificados</li>
                <li>📈 Predicción de conversiones</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

const getStatusColor = (status) => {
  const colors = {
    new: 'bg-blue-500',
    contacted: 'bg-yellow-500',
    qualified: 'bg-purple-500',
    proposal_sent: 'bg-indigo-500',
    negotiation: 'bg-orange-500',
    converted: 'bg-green-500',
    lost: 'bg-red-500',
  };
  return colors[status] || 'bg-gray-500';
};

const getStatusLabel = (status) => {
  const labels = {
    new: 'Nuevo',
    contacted: 'Contactado',
    qualified: 'Calificado',
    proposal_sent: 'Propuesta',
    negotiation: 'Negociación',
    converted: 'Convertido',
    lost: 'Perdido',
  };
  return labels[status] || status;
};

export default LeadsAnalytics;



