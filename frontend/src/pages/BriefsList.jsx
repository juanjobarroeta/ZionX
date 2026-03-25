import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const BriefsList = () => {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchBriefs();
  }, []);

  const fetchBriefs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/api/briefs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBriefs(res.data);
    } catch (error) {
      console.error("Error fetching briefs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: '📝 Borrador' },
      sent: { bg: 'bg-blue-100', text: 'text-blue-800', label: '📤 Enviado' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: '✓ Completado' },
      converted: { bg: 'bg-purple-100', text: 'text-purple-800', label: '👤 Convertido' }
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const filteredBriefs = briefs.filter(brief => {
    if (filter === 'all') return true;
    return brief.status === filter;
  });

  const stats = {
    total: briefs.length,
    draft: briefs.filter(b => b.status === 'draft').length,
    sent: briefs.filter(b => b.status === 'sent').length,
    completed: briefs.filter(b => b.status === 'completed').length,
    converted: briefs.filter(b => b.status === 'converted').length
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-black">📝 Creative Briefs</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Cuestionarios para prospectos y clientes
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={fetchBriefs}
                  className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50"
                >
                  🔄 Actualizar
                </button>
                <button
                  onClick={() => navigate('/briefs/new')}
                  className="bg-zionx-primary text-black font-semibold px-6 py-2 rounded-lg hover:bg-lime-400"
                >
                  ➕ Nuevo Brief
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <button
              onClick={() => setFilter('all')}
              className={`bg-white rounded-xl p-4 border-2 transition-all ${
                filter === 'all' ? 'border-zionx-primary' : 'border-transparent'
              }`}
            >
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-600">Todos</div>
            </button>

            <button
              onClick={() => setFilter('draft')}
              className={`bg-white rounded-xl p-4 border-2 transition-all ${
                filter === 'draft' ? 'border-gray-500' : 'border-transparent'
              }`}
            >
              <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
              <div className="text-sm text-gray-600">Borradores</div>
            </button>

            <button
              onClick={() => setFilter('sent')}
              className={`bg-white rounded-xl p-4 border-2 transition-all ${
                filter === 'sent' ? 'border-blue-500' : 'border-transparent'
              }`}
            >
              <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
              <div className="text-sm text-gray-600">Enviados</div>
            </button>

            <button
              onClick={() => setFilter('completed')}
              className={`bg-white rounded-xl p-4 border-2 transition-all ${
                filter === 'completed' ? 'border-green-500' : 'border-transparent'
              }`}
            >
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-gray-600">Completados</div>
            </button>

            <button
              onClick={() => setFilter('converted')}
              className={`bg-white rounded-xl p-4 border-2 transition-all ${
                filter === 'converted' ? 'border-purple-500' : 'border-transparent'
              }`}
            >
              <div className="text-2xl font-bold text-purple-600">{stats.converted}</div>
              <div className="text-sm text-gray-600">Convertidos</div>
            </button>
          </div>
        </div>

        {/* Briefs List */}
        <div className="max-w-7xl mx-auto px-6 pb-8">
          <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prospecto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredBriefs.length > 0 ? (
                    filteredBriefs.map((brief) => (
                      <tr key={brief.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{brief.prospect_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">{brief.company_name || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">{brief.email || brief.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(brief.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">
                            {new Date(brief.created_at).toLocaleDateString('es-MX')}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Link
                              to={`/briefs/${brief.id}`}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                            >
                              👁️ Ver
                            </Link>
                            {brief.status === 'completed' && !brief.customer_id && (
                              <button
                                onClick={async () => {
                                  if (!confirm("¿Convertir a cliente?")) return;
                                  try {
                                    const token = localStorage.getItem("token");
                                    await axios.post(`${API_BASE_URL}/api/briefs/${brief.id}/convert`, {}, {
                                      headers: { Authorization: `Bearer ${token}` }
                                    });
                                    alert("✅ Convertido a cliente");
                                    fetchBriefs();
                                  } catch (error) {
                                    alert("❌ Error");
                                  }
                                }}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                              >
                                ✓ Convertir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <span className="text-4xl mb-2">📝</span>
                          <p>No hay briefs {filter !== 'all' ? `en estado "${filter}"` : ''}</p>
                          <button
                            onClick={() => navigate('/briefs/new')}
                            className="mt-4 text-zionx-primary hover:underline"
                          >
                            ➕ Crear primer brief
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default BriefsList;
