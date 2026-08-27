import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import { API_BASE_URL } from "../utils/constants";
import { customerName as resolveCustomerName } from "../utils/customerName";
import "./Connections.css";

const PLATFORM_LABEL = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn" };
const platLabel = (p) => PLATFORM_LABEL[(p || "").toLowerCase()] || p || "—";
const nf = new Intl.NumberFormat("es-MX");

const daysUntil = (iso) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86400000) : null);
const hoursSince = (iso) => (iso ? Math.round((Date.now() - new Date(iso).getTime()) / 3600000) : null);
const fmtAgo = (iso) => {
  const h = hoursSince(iso);
  if (h === null) return "nunca";
  if (h < 1) return "hace minutos";
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
};

/**
 * One connection's verdict. Order matters: the worst true thing wins, because
 * a row can only carry one instruction and the reader should get the blocking
 * one first.
 */
const healthOf = (c, { isAds = false } = {}) => {
  const expiresIn = daysUntil(c.token_expires_at);
  const staleHours = hoursSince(isAds ? (c.last_spend_day ? `${String(c.last_spend_day).slice(0, 10)}T12:00:00` : null) : c.last_synced_at);

  if (!c.customer_id) {
    return { dir: "idle", text: "Sin cliente asignado", tone: "warn", fix: "assign" };
  }
  if (expiresIn !== null && expiresIn < 0) {
    return { dir: "bad", text: "Conexión expirada — reconectar", tone: "bad", fix: "reconnect" };
  }
  if (!c.last_synced_at && !c.last_spend_day) {
    return { dir: "warn", text: "Sin sincronizar todavía", tone: "warn" };
  }
  if (staleHours !== null && staleHours > 36) {
    return { dir: "bad", text: `Sin datos ${fmtAgo(isAds ? null : c.last_synced_at)} — revisar permisos`, tone: "bad", fix: "reconnect" };
  }
  if (expiresIn !== null && expiresIn <= 7) {
    return { dir: "warn", text: `La conexión expira en ${expiresIn} d`, tone: "warn", fix: "reconnect" };
  }
  return { dir: "ok", text: `Sincronizado ${fmtAgo(c.last_synced_at)}`, tone: null };
};

const Connections = () => {
  const [social, setSocial] = useState([]);
  const [ads, setAds] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  const load = useCallback(async () => {
    const [c, cust] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/social/connections`, { headers }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/customers`, { headers }).catch(() => ({ data: [] })),
    ]);
    setSocial(Array.isArray(c.data?.social) ? c.data.social : []);
    setAds(Array.isArray(c.data?.ads) ? c.data.ads : []);
    setJobs(Array.isArray(c.data?.jobs) ? c.data.jobs : []);
    setCustomers(Array.isArray(cust.data) ? cust.data : []);
    setLoading(false);
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const assign = async (kind, id, customerId) => {
    setSavingId(`${kind}-${id}`);
    const url = kind === "ads"
      ? `${API_BASE_URL}/api/ads/accounts/${id}/customer`
      : `${API_BASE_URL}/api/social/accounts/${id}/customer`;
    try {
      await axios.patch(url, { customer_id: customerId || null }, { headers });
      await load();
    } catch {
      /* the row keeps showing "sin cliente" until it actually saves */
    } finally {
      setSavingId(null);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await Promise.all([
        axios.post(`${API_BASE_URL}/api/social/sync-analytics`, {}, { headers }),
        axios.post(`${API_BASE_URL}/api/ads/sync`, {}, { headers }),
      ]);
      await load();
    } catch {
      /* the health column tells the truth either way */
    } finally {
      setSyncing(false);
    }
  };

  // ---- group every connection under its client ----
  const groups = useMemo(() => {
    const map = new Map();
    const put = (c, kind) => {
      const key = c.customer_id ?? "none";
      if (!map.has(key)) {
        map.set(key, { key, customerId: c.customer_id, name: c.customer_name || "Sin cliente asignado", items: [] });
      }
      map.get(key).items.push({ ...c, kind, health: healthOf(c, { isAds: kind === "ads" }) });
    };
    social.forEach((c) => put(c, "social"));
    ads.forEach((c) => put(c, "ads"));
    // Anything needing a human comes first; the unassigned bucket after that.
    return [...map.values()].sort((a, b) => {
      const bad = (g) => g.items.some((i) => i.health.dir === "bad");
      if (bad(a) !== bad(b)) return bad(a) ? -1 : 1;
      if ((a.key === "none") !== (b.key === "none")) return a.key === "none" ? 1 : -1;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [social, ads]);

  const all = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const counts = {
    total: all.length,
    ok: all.filter((i) => i.health.dir === "ok").length,
    warn: all.filter((i) => i.health.dir === "warn" || i.health.dir === "idle").length,
    bad: all.filter((i) => i.health.dir === "bad").length,
  };

  const jobLabel = { meta_accounts: "Cuentas", meta_posts: "Publicaciones", meta_ads: "Anuncios" };

  return (
      <PageShell
        className="zxcn"
        eyebrow="Infraestructura"
        title="Conexiones"
        titleAccent="de Meta"
        actions={
          <>
            <Link className="zx-btn on-ink ghost" to="/social/accounts">Conectar cuenta</Link>
            <button className="zx-btn on-ink" onClick={syncNow} disabled={syncing}>
              {syncing ? "Sincronizando…" : "Sincronizar ahora"}
            </button>
          </>
        }
        telemetry={[
          { k: "Conexiones", v: counts.total },
          { k: "Al día", v: counts.ok },
          { k: "Atención", v: counts.warn, tone: "brass" },
          { k: "Caídas", v: counts.bad, tone: "crit" },
        ]}
      >
          {loading ? (
            <div className="zx-empty">Cargando conexiones…</div>
          ) : all.length === 0 ? (
            <div className="zx-empty">
              <strong>Todavía no hay cuentas conectadas.</strong>
              Conecta Instagram, Facebook o una cuenta publicitaria para que empiecen a llegar datos.
            </div>
          ) : (
            <div className="zxcn-groups">
              {groups.map((g) => {
                const attention = g.items.some((i) => i.health.dir === "bad");
                return (
                  <section className={`zxcn-group${attention ? " attention" : ""}`} key={g.key}>
                    <div className="zxcn-group-head">
                      <span className="name">{g.name}</span>
                      <span className="count">{String(g.items.length).padStart(2, "0")} conexion{g.items.length === 1 ? "" : "es"}</span>
                    </div>
                    {g.items.map((c) => (
                      <div className="zxcn-row" key={`${c.kind}-${c.id}`}>
                        <i className={`zxcn-dot ${c.health.dir}`} />
                        <div className="zxcn-id">
                          <span className="who">
                            {c.kind === "ads"
                              ? (c.account_name || c.platform_account_id)
                              : (c.account_username ? `@${c.account_username}` : c.account_name || c.platform_account_id)}
                          </span>
                          <span className="what">
                            {c.kind === "ads" ? `Publicidad · ${c.currency || "—"}` : platLabel(c.platform)}
                          </span>
                        </div>
                        <div className="zxcn-metrics">
                          {c.kind === "ads"
                            ? (c.last_spend_day ? `inversión al ${String(c.last_spend_day).slice(5, 10)}` : "sin inversión")
                            : `${nf.format(c.followers_count || 0)} seguidores${c.queued_posts ? ` · ${c.queued_posts} en cola` : ""}${c.failed_posts ? ` · ${c.failed_posts} fallidas` : ""}`}
                        </div>
                        <div className="zxcn-state">
                          <span className={c.health.tone || undefined}>{c.health.text}</span>
                        </div>
                        <div className="zxcn-actions">
                          <select
                            className="zx-select sm"
                            value={c.customer_id || ""}
                            disabled={savingId === `${c.kind}-${c.id}`}
                            onChange={(e) => assign(c.kind, c.id, e.target.value)}
                            aria-label="Cliente"
                          >
                            <option value="">Sin cliente…</option>
                            {customers.map((x) => (
                              <option key={x.id} value={x.id}>{resolveCustomerName(x)}</option>
                            ))}
                          </select>
                          {c.health.fix === "reconnect" && (
                            <Link className="zx-btn ghost" to="/social/accounts">Reconectar</Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          )}

          {jobs.length > 0 && (
            <div className="zxa-status" style={{ display: "flex", gap: 18, flexWrap: "wrap", fontFamily: "var(--zx-mono)", fontSize: 11, color: "var(--zx-muted)" }}>
              {jobs.map((j) => (
                <span key={j.job}>
                  {jobLabel[j.job] || j.job}: {j.last_success_at ? fmtAgo(j.last_success_at) : "sin correr"}
                  {j.last_detail ? ` · ${j.last_detail}` : ""}
                </span>
              ))}
            </div>
          )}
      </PageShell>
  );
};

export default Connections;
