import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import ApprovalModal from "../components/ApprovalModal";
import { API_BASE_URL } from "../utils/constants";
import "./Approvals.css";

// First-class content approval queue. Previously this lived buried inside a tab
// of the team dashboard; it is now its own page with its own nav entry. Reuses
// the existing ApprovalModal + /api/approvals/* endpoints.

const PLATFORM_ICON = {
  instagram: "📸", facebook: "👍", tiktok: "🎵", linkedin: "💼", twitter: "𝕏", youtube: "▶️",
};
const platIcon = (p) => PLATFORM_ICON[(p || "").toLowerCase()] || "📱";

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const STATUS_PILL = {
  pending_review: { label: "Pendiente", cls: "pending" },
  in_review: { label: "En revisión", cls: "review" },
};
const pillOf = (s) => STATUS_PILL[(s || "").toLowerCase()] || { label: s || "—", cls: "muted" };

const ApprovalsHub = () => {
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, sRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/approvals/queue`, { headers }),
        axios.get(`${API_BASE_URL}/api/approvals/stats`, { headers }).catch(() => ({ data: {} })),
      ]);
      setQueue(qRes.data?.items || []);
      setStats(sRes.data || {});
    } catch {
      setQueue([]);
      setStats({});
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const openReview = (item) => { setSelected(item); setShowModal(true); };
  const onActionComplete = () => { setShowModal(false); setSelected(null); fetchQueue(); };

  return (
    <Layout>
      <div className="zxa">
        <div className="zxa-inner">
          <div className="zxa-head">
            <div>
              <div className="zxa-eyebrow">Contenido</div>
              <h1 className="zxa-h1">Cola de <span className="zxa-serif">aprobaciones</span></h1>
              <p className="zxa-sub">Contenido pendiente de revisión interna y sign-off del cliente.</p>
            </div>
          </div>

          <div className="zxa-stats">
            <div className="zxa-stat warn"><span className="v">{stats.pending_review ?? queue.length}</span><span className="k">Pendientes</span></div>
            <div className="zxa-stat info"><span className="v">{stats.my_pending ?? 0}</span><span className="k">Míos</span></div>
            <div className="zxa-stat ok"><span className="v">{stats.approved_this_week ?? 0}</span><span className="k">Aprobados (semana)</span></div>
            <div className="zxa-stat bad"><span className="v">{stats.revisions_this_week ?? 0}</span><span className="k">Cambios (semana)</span></div>
          </div>

          <div className="zxa-list">
            <div className="zxa-list-head">
              <h2>📋 Por revisar</h2>
              <p>Abre un post para aprobar, solicitar cambios o reasignar el aprobador.</p>
            </div>

            {loading ? (
              <div className="zxa-loading">Cargando cola…</div>
            ) : queue.length === 0 ? (
              <div className="zxa-empty">
                <span className="big">✅</span>
                <div className="lead">No hay contenido pendiente de aprobación</div>
                <div>¡Todo está al día!</div>
              </div>
            ) : (
              queue.map((item) => {
                const pill = pillOf(item.approval_status);
                return (
                  <div key={item.id} className="zxa-row" onClick={() => openReview(item)}>
                    <div className="zxa-row-main">
                      <div className="zxa-row-title">
                        <span>{platIcon(item.platform)}</span>
                        <span className="t">{item.campaign || item.idea_tema || "Sin título"}</span>
                        {item.current_revision > 1 && <span className="zxa-rev">Rev. #{item.current_revision}</span>}
                      </div>
                      <div className="zxa-row-meta">{item.customer_name || "—"} · {item.content_type || "Post"}</div>
                      <div className="zxa-row-tags">
                        <span>📅 {fmtDate(item.scheduled_date)}</span>
                        {item.designer_name && <span>🎨 {item.designer_name}</span>}
                        {item.cm_name && <span>📱 {item.cm_name}</span>}
                        {item.approver_name && <span>👤 {item.approver_name}</span>}
                      </div>
                      {item.rejection_reason && (
                        <div className="zxa-reject-note">⚠️ Última corrección: {item.rejection_reason.slice(0, 120)}</div>
                      )}
                    </div>
                    <div className="zxa-row-side">
                      <span className={`zxa-pill ${pill.cls}`}>{pill.label}</span>
                      <button className="zxa-btn" onClick={(e) => { e.stopPropagation(); openReview(item); }}>Revisar →</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ApprovalModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelected(null); }}
        content={selected}
        onActionComplete={onActionComplete}
      />
    </Layout>
  );
};

export default ApprovalsHub;
