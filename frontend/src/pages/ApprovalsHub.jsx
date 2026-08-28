import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import PageShell from "../components/PageShell";
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
    <>
      <PageShell
        className="zxap"
        eyebrow="Contenido"
        title="Cola de"
        titleAccent="aprobaciones"
        telemetry={[
          { k: "Pendientes", v: stats.pending_review ?? queue.length, tone: "brass" },
          { k: "Míos", v: stats.my_pending ?? 0 },
          { k: "Aprobados · 7d", v: stats.approved_this_week ?? 0 },
          { k: "Cambios · 7d", v: stats.revisions_this_week ?? 0, tone: "crit" },
        ]}
      >

          <div className="zxap-list">
            <div className="zxap-list-head">
              <h2>📋 Por revisar</h2>
              <p>Abre un post para aprobar, solicitar cambios o reasignar el aprobador.</p>
            </div>

            {loading ? (
              <div className="zxap-loading">Cargando cola…</div>
            ) : queue.length === 0 ? (
              <div className="zxap-empty">
                <span className="big">✅</span>
                <div className="lead">No hay contenido pendiente de aprobación</div>
                <div>¡Todo está al día!</div>
              </div>
            ) : (
              queue.map((item) => {
                const pill = pillOf(item.approval_status);
                return (
                  <div key={item.id} className="zxap-row" onClick={() => openReview(item)}>
                    <div className="zxap-row-main">
                      <div className="zxap-row-title">
                        <span>{platIcon(item.platform)}</span>
                        <span className="t">{item.title || item.idea_tema || item.campaign || "Sin título"}</span>
                        {item.current_revision > 1 && <span className="zxap-rev">Rev. #{item.current_revision}</span>}
                      </div>
                      <div className="zxap-row-meta">{item.customer_name || "—"} · {item.content_type || "Post"}</div>
                      <div className="zxap-row-tags">
                        <span>📅 {fmtDate(item.scheduled_date)}</span>
                        {item.designer_name && <span>🎨 {item.designer_name}</span>}
                        {item.cm_name && <span>📱 {item.cm_name}</span>}
                        {item.approver_name && <span>👤 {item.approver_name}</span>}
                      </div>
                      {item.rejection_reason && (
                        <div className="zxap-reject-note">⚠️ Última corrección: {item.rejection_reason.slice(0, 120)}</div>
                      )}
                    </div>
                    <div className="zxap-row-side">
                      <span className={`zxap-pill ${pill.cls}`}>{pill.label}</span>
                      <button className="zxap-btn" onClick={(e) => { e.stopPropagation(); openReview(item); }}>Revisar →</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
      </PageShell>

      <ApprovalModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelected(null); }}
        content={selected}
        onActionComplete={onActionComplete}
      />
    </>
  );
};

export default ApprovalsHub;
