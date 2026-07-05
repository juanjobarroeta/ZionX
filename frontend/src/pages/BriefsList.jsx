import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./BriefsList.css";

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
      draft: { label: '📝 Borrador' },
      sent: { label: '📤 Enviado' },
      completed: { label: '✓ Completado' },
      converted: { label: '👤 Convertido' }
    };
    const key = badges[status] ? status : 'draft';
    const badge = badges[key];
    return (
      <span className={`zxbrf-pill ${key}`}>
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
      <div className="zxbrf">
        <div className="zxbrf-inner">
          {/* Header */}
          <div className="zxbrf-head">
            <div>
              <div className="zxbrf-eyebrow">Briefs</div>
              <h1 className="zxbrf-h1">Creative <span className="zxbrf-serif">briefs</span></h1>
              <p className="zxbrf-sub">Cuestionarios para prospectos y clientes</p>
            </div>
            <div className="zxbrf-actions">
              <button
                onClick={fetchBriefs}
                className="zxbrf-btn ghost"
              >
                Actualizar
              </button>
              <button
                onClick={() => navigate('/briefs/new')}
                className="zxbrf-btn solid"
              >
                + Nuevo brief
              </button>
            </div>
          </div>

          {/* Stats / filters */}
          <div className="zxbrf-stats">
            <button
              onClick={() => setFilter('all')}
              className={`zxbrf-stat${filter === 'all' ? ' active' : ''}`}
            >
              <span className="v">{stats.total}</span>
              <span className="k">Todos</span>
            </button>

            <button
              onClick={() => setFilter('draft')}
              className={`zxbrf-stat draft${filter === 'draft' ? ' active' : ''}`}
            >
              <span className="v">{stats.draft}</span>
              <span className="k">Borradores</span>
            </button>

            <button
              onClick={() => setFilter('sent')}
              className={`zxbrf-stat sent${filter === 'sent' ? ' active' : ''}`}
            >
              <span className="v">{stats.sent}</span>
              <span className="k">Enviados</span>
            </button>

            <button
              onClick={() => setFilter('completed')}
              className={`zxbrf-stat completed${filter === 'completed' ? ' active' : ''}`}
            >
              <span className="v">{stats.completed}</span>
              <span className="k">Completados</span>
            </button>

            <button
              onClick={() => setFilter('converted')}
              className={`zxbrf-stat converted${filter === 'converted' ? ' active' : ''}`}
            >
              <span className="v">{stats.converted}</span>
              <span className="k">Convertidos</span>
            </button>
          </div>

          {/* Briefs List */}
          <div className="zxbrf-list">
            <div className="zxbrf-scroll">
              <table className="zxbrf-table">
                <thead>
                  <tr>
                    <th>Prospecto</th>
                    <th>Empresa</th>
                    <th>Contacto</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th className="center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBriefs.length > 0 ? (
                    filteredBriefs.map((brief) => (
                      <tr key={brief.id}>
                        <td>
                          <div className="zxbrf-name">{brief.prospect_name}</div>
                        </td>
                        <td>
                          <div className="zxbrf-cell">{brief.company_name || '-'}</div>
                        </td>
                        <td>
                          <div className="zxbrf-cell">{brief.email || brief.phone || '-'}</div>
                        </td>
                        <td>
                          {getStatusBadge(brief.status)}
                        </td>
                        <td>
                          <div className="zxbrf-cell">
                            {new Date(brief.created_at).toLocaleDateString('es-MX')}
                          </div>
                        </td>
                        <td>
                          <div className="zxbrf-actions-cell">
                            <Link
                              to={`/briefs/${brief.id}`}
                              className="zxbrf-btn ghost sm"
                            >
                              Ver
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
                                className="zxbrf-btn solid sm"
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
                      <td colSpan="6">
                        <div className="zxbrf-empty">
                          <span className="big">📝</span>
                          <p>No hay briefs {filter !== 'all' ? `en estado "${filter}"` : ''}</p>
                          <button
                            onClick={() => navigate('/briefs/new')}
                            className="zxbrf-linkbtn"
                          >
                            + Crear primer brief
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
