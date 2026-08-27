import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { customerName, customerContact } from "../utils/customerName";
import PinterestEmbed from "../components/PinterestEmbed";
import "./Profile.css";

const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "contenido", label: "Contenido" },
  { id: "recursos", label: "Recursos" },
  { id: "facturacion", label: "Facturación" },
];

const FILE_SECTIONS = [
  { cat: "branding", label: "Branding", accept: ".svg,.png,.jpg,.pdf,.ai,.eps" },
  { cat: "media", label: "Fotos y videos", accept: ".jpg,.png,.mp4,.mov,.avi,.gif" },
  { cat: "designs", label: "Artes finales", accept: ".png,.jpg,.pdf,.ai,.psd" },
  { cat: "escaleta", label: "Documentos", accept: ".pdf,.xlsx,.docx,.pptx" },
];

// Media types as a person says them, not as Meta spells them.
const FORMAT_SHORT = {
  REELS: "Reel", VIDEO: "Video", CAROUSEL_ALBUM: "Carrusel",
  IMAGE: "Imagen", STORY: "Story", POST: "Post",
};

const INV_STATUS = {
  paid: { label: "Pagada", cls: "paid" },
  overdue: { label: "Vencida", cls: "overdue" },
  cancelled: { label: "Cancelada", cls: "cancelled" },
};
const invStatus = (s) => INV_STATUS[(s || "").toLowerCase()] || { label: s || "Pendiente", cls: "pending" };

const CustomerProfile = () => {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [files, setFiles] = useState({ branding: [], media: [], designs: [], escaleta: [] });
  const [roster, setRoster] = useState({});
  const [rosterMembers, setRosterMembers] = useState([]);
  const [invoices, setInvoices] = useState({ loading: true, list: [], denied: false });
  const [upcoming, setUpcoming] = useState(null);
  // The cockpit layer: what the client's month actually looks like right now.
  const [pulse, setPulse] = useState({ views: 0, prevViews: 0, posts: [], tasks: [], connections: [] });
  const [uploading, setUploading] = useState({});
  const [report, setReport] = useState({ url: null, working: false });
  const [pinBoard, setPinBoard] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileInputs = useRef({});

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  const fetchFiles = useCallback(async () => {
    const cats = ["branding", "media", "designs", "escaleta"];
    const res = await Promise.all(
      cats.map((c) => axios.get(`${API_BASE_URL}/customers/${id}/files/${c}`, { headers }).catch(() => ({ data: [] })))
    );
    const out = {};
    cats.forEach((c, i) => {
      out[c] = (res[i].data || []).map((f) => ({
        id: f.id,
        name: f.original_name || f.name,
        size: f.file_size ? `${(f.file_size / 1024 / 1024).toFixed(1)} MB` : "",
        uploaded_at: f.created_at ? new Date(f.created_at).toLocaleDateString("es-MX") : "",
      }));
    });
    setFiles(out);
  }, [id, headers]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${API_BASE_URL}/customers/${id}`, { headers });
        if (alive) setCustomer(r.data);
      } catch {
        if (alive) setError("No se pudo cargar la información del cliente");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    fetchFiles();
    // Real invoices for this client (income section is role-guarded — a 403 just
    // means the viewer can't see billing).
    axios.get(`${API_BASE_URL}/api/income/invoices`, { headers, params: { customer_id: id } })
      .then((r) => setInvoices({ loading: false, list: Array.isArray(r.data) ? r.data : [], denied: false }))
      .catch((e) => setInvoices({ loading: false, list: [], denied: e.response?.status === 403 }));
    // Upcoming posts for the at-a-glance (best-effort).
    const today = new Date(); const to = new Date(); to.setDate(to.getDate() + 60);
    const fmt = (d) => d.toISOString().slice(0, 10);
    axios.get(`${API_BASE_URL}/content-calendar-range`, { headers, params: { from: fmt(today), to: fmt(to), customer_id: id } })
      .then((r) => setUpcoming(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => setUpcoming(null));
    return () => { alive = false; };
  }, [id, headers, fetchFiles]);

  // One pass for everything the Resumen answers: how content is doing, what the
  // team owes, and whether the connections behind those numbers are alive.
  useEffect(() => {
    const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const params = { customer_id: id, from: day(59), to: day(0) };
    Promise.all([
      axios.get(`${API_BASE_URL}/api/social/analytics/series`, { headers, params }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/api/social/analytics/posts`, { headers, params: { customer_id: id, from: day(29), to: day(0), limit: 6, sort: "views" } }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/api/tasks`, { headers, params: { customer_id: id } }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/api/social/connections`, { headers }).catch(() => ({ data: {} })),
    ]).then(([se, po, ta, co]) => {
      const rows = Array.isArray(se.data?.series) ? se.data.series : [];
      const cut = day(29);
      const sum = (list, key) => list.reduce((t, r) => t + (Number(r[key]) || 0), 0);
      const conns = [
        ...(co.data?.social || []).map((c) => ({ ...c, kind: "social" })),
        ...(co.data?.ads || []).map((c) => ({ ...c, kind: "ads" })),
      ].filter((c) => String(c.customer_id) === String(id));
      setPulse({
        views: sum(rows.filter((r) => String(r.day).slice(0, 10) >= cut), "views"),
        prevViews: sum(rows.filter((r) => String(r.day).slice(0, 10) < cut), "views"),
        posts: Array.isArray(po.data?.posts) ? po.data.posts : [],
        tasks: Array.isArray(ta.data?.tasks) ? ta.data.tasks : [],
        connections: conns,
      });
    });
  }, [id, headers]);

  // Production roster (assigned designer / community / senior). Options list ALL
  // active members — role tags are free-form, so hard-filtering would empty the
  // dropdowns. Saved via PUT /customers/:id/roster.
  useEffect(() => {
    axios.get(`${API_BASE_URL}/pipeline/assignable`, { headers })
      .then((r) => setRosterMembers(Array.isArray(r.data?.team_members) ? r.data.team_members : []))
      .catch(() => setRosterMembers([]));
    axios.get(`${API_BASE_URL}/customers/${id}/roster`, { headers })
      .then((r) => setRoster(r.data || {}))
      .catch(() => setRoster({}));
  }, [id, headers]);

  // The month's report as a link the client can open without an account.
  // Idempotent per month, so pressing it twice doesn't invalidate the link
  // already sitting in their inbox.
  const makeReport = async () => {
    setReport((r) => ({ ...r, working: true }));
    try {
      const r = await axios.post(`${API_BASE_URL}/api/reports/generate`, { customer_id: Number(id) }, { headers });
      const url = r.data?.url;
      if (url) {
        try { await navigator.clipboard.writeText(url); } catch { /* clipboard may be blocked */ }
        setReport({ url, working: false });
      } else {
        setReport({ url: null, working: false });
      }
    } catch {
      setReport({ url: null, working: false });
    }
  };

  const saveRoster = async (key, memberId) => {
    const value = memberId === "" ? null : Number(memberId);
    const prev = roster;
    setRoster((r) => ({ ...r, [key]: value }));
    try {
      const res = await axios.put(`${API_BASE_URL}/customers/${id}/roster`, { [key]: value }, { headers });
      if (res.data?.roster) setRoster(res.data.roster);
    } catch {
      setRoster(prev);
      alert("Error actualizando el equipo asignado");
    }
  };

  // Keep the Pinterest input in sync with the loaded customer.
  useEffect(() => {
    setPinBoard(customer?.pinterest_board_url || "");
  }, [customer?.pinterest_board_url]);

  const savePinterest = async () => {
    try {
      const res = await axios.put(`${API_BASE_URL}/customers/${id}/pinterest`, { pinterest_board_url: pinBoard }, { headers });
      const saved = res.data?.pinterest_board_url ?? pinBoard;
      setCustomer((c) => (c ? { ...c, pinterest_board_url: saved } : c));
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 2000);
    } catch {
      alert("No se pudo guardar el tablero de Pinterest");
    }
  };

  const uploadTo = async (category, fileList) => {
    if (!fileList || !fileList.length) return;
    setUploading((u) => ({ ...u, [category]: true }));
    try {
      const fd = new FormData();
      Array.from(fileList).forEach((f) => fd.append("files", f));
      fd.append("category", category);
      fd.append("customer_id", id);
      await axios.post(`${API_BASE_URL}/customers/${id}/files/upload`, fd, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      await fetchFiles();
    } catch {
      alert("Error subiendo archivos");
    } finally {
      setUploading((u) => ({ ...u, [category]: false }));
    }
  };

  const EDIT_FIELDS = [
    { section: "Datos fiscales", fields: [
      { k: "commercial_name", label: "Nombre comercial" },
      { k: "business_name", label: "Razón social" },
      { k: "rfc", label: "RFC" },
      { k: "tax_regime", label: "Régimen fiscal" },
      { k: "fiscal_postal_code", label: "Código postal" },
      { k: "industry", label: "Giro" },
      { k: "website", label: "Sitio web" },
    ] },
    { section: "Contacto", fields: [
      { k: "contact_first_name", label: "Nombre" },
      { k: "contact_last_name", label: "Apellido" },
      { k: "contact_position", label: "Puesto" },
      { k: "contact_email", label: "Email", type: "email" },
      { k: "contact_phone", label: "Teléfono" },
      { k: "contact_mobile", label: "Móvil" },
    ] },
  ];

  const copyCaptureLink = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/customers/${id}/capture-link`, {}, { headers });
      const url = `${window.location.origin}/capturar/${res.data.token}`;
      try { await navigator.clipboard.writeText(url); alert(`Enlace copiado:\n${url}`); }
      catch { window.prompt("Copia el enlace de captación:", url); }
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo generar el enlace");
    }
  };

  const toggleWhatsappInbound = async () => {
    const enabled = !(customer.receives_whatsapp_leads);
    try {
      await axios.put(`${API_BASE_URL}/customers/${id}/whatsapp-inbound`, { enabled }, { headers });
      setCustomer((c) => ({ ...c, receives_whatsapp_leads: enabled }));
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo actualizar");
    }
  };

  const [waSaving, setWaSaving] = useState(false);
  const [waSaved, setWaSaved] = useState(false);
  const saveWhatsappConfig = async (patch) => {
    setWaSaving(true); setWaSaved(false);
    // Optimistic local update so the inputs stay responsive.
    setCustomer((c) => ({ ...c, ...patch }));
    try {
      await axios.put(`${API_BASE_URL}/customers/${id}/whatsapp-config`, patch, { headers });
      setWaSaved(true);
      setTimeout(() => setWaSaved(false), 1800);
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo guardar la configuración de WhatsApp");
    } finally {
      setWaSaving(false);
    }
  };

  const invitePortal = async () => {
    const email = window.prompt("Email para el acceso del cliente al portal:", customer.contact_email || customer.email || "");
    if (!email) return;
    const password = window.prompt("Contraseña temporal (compártela con el cliente):");
    if (!password) return;
    try {
      await axios.post(`${API_BASE_URL}/admin/customers/${id}/client-user`,
        { email, password, name: customerName(customer) }, { headers });
      alert(`Acceso creado. El cliente entra con ${email} y verá solo su funnel.`);
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo crear el acceso de cliente");
    }
  };

  const openEdit = () => {
    const seed = {};
    EDIT_FIELDS.forEach((g) => g.fields.forEach(({ k }) => { seed[k] = customer[k] || ""; }));
    setEditForm(seed);
    setSaveError("");
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await axios.patch(`${API_BASE_URL}/customers/${id}`, editForm, { headers });
      if (res.data?.customer) setCustomer(res.data.customer);
      setEditing(false);
    } catch (err) {
      console.error("Error saving customer:", err);
      setSaveError(err.response?.data?.message || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // Loading and error are pages too — same shell, so the chrome never blinks.
  if (loading) {
    return (
      <PageShell className="zxp" eyebrow="Clientes" title="Cargando perfil…">
        <div className="zxp-loading">Cargando perfil…</div>
      </PageShell>
    );
  }
  if (error || !customer) {
    return (
      <PageShell className="zxp" eyebrow="Clientes" title="Cliente no encontrado">
        <div className="zxp-note warn">
          <strong>{error || "Cliente no encontrado"}</strong>
          <p><Link to="/crm">← Volver al directorio</Link></p>
        </div>
      </PageShell>
    );
  }

  const name = customerName(customer);
  const contact = customerContact(customer);
  const val = (v) => (v && String(v).trim() ? <span className="v">{v}</span> : <span className="v empty">No especificado</span>);

  const totals = invoices.list.reduce(
    (a, i) => ({ billed: a.billed + (Number(i.total) || 0), paid: a.paid + (Number(i.amount_paid) || 0), due: a.due + (Number(i.amount_due) || 0) }),
    { billed: 0, paid: 0, due: 0 }
  );
  const pendingCount = invoices.list.filter((i) => (i.current_status || i.status) !== "paid" && (i.current_status || i.status) !== "cancelled").length;

  // Cockpit readings. A delta needs a baseline; without one it stays absent
  // rather than inventing a comparison.
  const openTasks = pulse.tasks.filter((t) => t.status !== "completed");
  const overdueTasks = openTasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date(new Date().toDateString())
  );
  const brokenConns = pulse.connections.filter(
    (c) => !c.last_synced_at || (Date.now() - new Date(c.last_synced_at).getTime()) / 3600000 > 36
  );
  const viewsDelta = pulse.prevViews
    ? (() => {
        const pct = ((pulse.views - pulse.prevViews) / pulse.prevViews) * 100;
        if (Math.abs(pct) < 0.5) return { text: "· 0%", dir: "flat" };
        return { text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct).toFixed(0)}%`, dir: pct > 0 ? "up" : "down" };
      })()
    : null;
  const bestPost = pulse.posts[0];
  const nf = new Intl.NumberFormat("es-MX");

  return (
    <>
      <PageShell
        className="zxp"
        eyebrow={<><Link to="/crm" className="zxp-crumb">Clientes</Link>{contact && contact !== name ? ` · ${contact}` : ""}</>}
        title={name}
        actions={
          <>
            <button className="zx-btn on-ink ghost" onClick={openEdit}>Editar</button>
            <Link to={`/portal?customer_id=${id}`} className="zx-btn on-ink ghost" title="Ver el portal de este cliente como lo vería él">Ver portal</Link>
            <button className="zx-btn on-ink ghost" onClick={invitePortal} title="Crear acceso para que el cliente vea su propio funnel">Invitar al portal</button>
            <button className="zx-btn on-ink ghost" onClick={makeReport} disabled={report.working}
                    title="Genera el enlace del reporte mensual para este cliente y lo copia">
              {report.working ? "Generando…" : report.url ? "Enlace copiado ✓" : "Reporte del mes"}
            </button>
            <button className="zx-btn on-ink" onClick={() => setActiveTab("recursos")}>Subir archivos</button>
          </>
        }
        telemetry={[
          { k: "Vistas · 30d", v: pulse.views, delta: viewsDelta },
          { k: "Próximas", v: upcoming ?? 0 },
          { k: "Tareas", v: openTasks.length },
          { k: "Vencidas", v: overdueTasks.length, tone: "crit" },
          { k: "Cobros", v: invoices.denied ? 0 : pendingCount, tone: "brass" },
        ]}
        below={
          <div className="zxp-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`zxp-tab${activeTab === t.id ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>
        }
      >
          {/* ---- RESUMEN ---- */}
          {activeTab === "resumen" && (
            <>
              {/* Anything broken about this client's plumbing comes first —
                  every number below it is downstream of these connections. */}
              {report.url && (
                <div className="zxp-report">
                  <span className="k">Reporte del mes · enlace copiado</span>
                  <a href={report.url} target="_blank" rel="noreferrer">{report.url}</a>
                </div>
              )}

              {brokenConns.length > 0 && (
                <Link to="/conexiones" className="zxp-alert">
                  <strong>{brokenConns.length} conexión{brokenConns.length > 1 ? "es" : ""} sin datos.</strong>
                  Las métricas de este cliente están incompletas hasta reconectarla{brokenConns.length > 1 ? "s" : ""} →
                </Link>
              )}

              <div className="zxp-cockpit">
                {/* Contenido: what shipped and what's coming, one click from the
                    calendar and the metrics filtered to this client. */}
                <section className="zxp-block">
                  <div className="zxp-block-head">
                    <h3>Contenido</h3>
                    <Link to={`/social-analytics?customer=${id}`}>Ver rendimiento →</Link>
                  </div>
                  {bestPost ? (
                    <>
                      <div className="zxp-best">
                        <span className="k">Mejor publicación · 30d</span>
                        <span className="t">{bestPost.message || "Sin texto"}</span>
                        <span className="n">
                          {nf.format(bestPost.views || 0)} vistas · {nf.format(bestPost.total_interactions || 0)} interacciones
                          {" · "}{Number(bestPost.engagement_rate || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="zxp-mini">
                        {pulse.posts.slice(0, 5).map((p) => (
                          <span key={p.platform_post_id} title={p.message || ""}>
                            {FORMAT_SHORT[p.media_type] || "Post"} · {nf.format(p.views || 0)}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="zxp-none">Sin métricas todavía para los últimos 30 días.</p>
                  )}
                  <Link to={`/content-calendar?customer=${id}`} className="zxp-block-cta">
                    {upcoming
                      ? `${upcoming} publicación${upcoming === 1 ? "" : "es"} programada${upcoming === 1 ? "" : "s"}`
                      : "Programar contenido"} →
                  </Link>
                </section>

                {/* Trabajo: what the team owes on this client, right now. */}
                <section className="zxp-block">
                  <div className="zxp-block-head">
                    <h3>Trabajo</h3>
                    <Link to={`/tareas?customer=${id}`}>Ver tareas →</Link>
                  </div>
                  {openTasks.length === 0 ? (
                    <p className="zxp-none">Sin tareas abiertas para este cliente.</p>
                  ) : (
                    <ul className="zxp-tasks">
                      {openTasks.slice(0, 5).map((t) => {
                        const over = t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());
                        return (
                          <li key={t.id}>
                            <span className="t">{t.title}</span>
                            <span className={`d${over ? " over" : ""}`}>
                              {t.due_date ? fmtDate(t.due_date) : "sin fecha"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {overdueTasks.length > 0 && (
                    <span className="zxp-block-cta over">{overdueTasks.length} vencida{overdueTasks.length > 1 ? "s" : ""}</span>
                  )}
                </section>

                {/* Conexiones: the plumbing, stated plainly. */}
                <section className="zxp-block">
                  <div className="zxp-block-head">
                    <h3>Conexiones</h3>
                    <Link to="/conexiones">Administrar →</Link>
                  </div>
                  {pulse.connections.length === 0 ? (
                    <p className="zxp-none">Sin cuentas de Meta asignadas a este cliente.</p>
                  ) : (
                    <ul className="zxp-conns">
                      {pulse.connections.map((c) => {
                        const stale = !c.last_synced_at || (Date.now() - new Date(c.last_synced_at).getTime()) / 3600000 > 36;
                        return (
                          <li key={`${c.kind}-${c.id}`}>
                            <i className={`zxp-dot${stale ? " bad" : ""}`} />
                            <span className="t">
                              {c.kind === "ads"
                                ? (c.account_name || c.platform_account_id)
                                : (c.account_username ? `@${c.account_username}` : c.account_name)}
                            </span>
                            <span className="w">{c.kind === "ads" ? "Publicidad" : c.platform}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>

              <div className="zxp-grid">
                <div className="zxp-card">
                  <h3>Datos fiscales</h3>
                  <div className="zxp-field"><span className="k">Razón social</span>{val(customer.business_name)}</div>
                  <div className="zxp-field"><span className="k">Nombre comercial</span>{val(customer.commercial_name)}</div>
                  <div className="zxp-field"><span className="k">RFC</span>{customer.rfc ? <span className="v mono">{customer.rfc}</span> : val(null)}</div>
                  <div className="zxp-field"><span className="k">Régimen fiscal</span>{val(customer.tax_regime)}</div>
                  <div className="zxp-field"><span className="k">Código postal</span>{val(customer.fiscal_postal_code)}</div>
                  <div className="zxp-field"><span className="k">Giro</span>{val(customer.industry)}</div>
                  <div className="zxp-field"><span className="k">Sitio web</span>{val(customer.website)}</div>
                </div>

                <div className="zxp-card">
                  <h3>Contacto</h3>
                  <div className="zxp-field"><span className="k">Nombre</span>{val(contact)}</div>
                  <div className="zxp-field"><span className="k">Puesto</span>{val(customer.contact_position)}</div>
                  <div className="zxp-field"><span className="k">Email</span>{val(customer.contact_email || customer.email)}</div>
                  <div className="zxp-field"><span className="k">Teléfono</span>{val(customer.contact_phone || customer.phone)}</div>
                  <div className="zxp-field"><span className="k">Móvil</span>{val(customer.contact_mobile)}</div>
                </div>

                <div className="zxp-card">
                  <h3>Equipo asignado</h3>
                  <div className="zxp-field">
                    <span className="k">Diseñador</span>
                    <select className="zxp-select" value={roster.assigned_designer || ""} onChange={(e) => saveRoster("assigned_designer", e.target.value)}>
                      <option value="">Sin asignar</option>
                      {rosterMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    {roster.assigned_designer_name && <span className="zxp-hint">Actual: {roster.assigned_designer_name}</span>}
                  </div>
                  <div className="zxp-field">
                    <span className="k">Community</span>
                    <select className="zxp-select" value={roster.assigned_community || ""} onChange={(e) => saveRoster("assigned_community", e.target.value)}>
                      <option value="">Sin asignar</option>
                      {rosterMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    {roster.assigned_community_name && <span className="zxp-hint">Actual: {roster.assigned_community_name}</span>}
                  </div>
                  <div className="zxp-field">
                    <span className="k">Senior</span>
                    <select className="zxp-select" value={roster.assigned_senior || ""} onChange={(e) => saveRoster("assigned_senior", e.target.value)}>
                      <option value="">Sin asignar</option>
                      {rosterMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    {roster.assigned_senior_name && <span className="zxp-hint">Actual: {roster.assigned_senior_name}</span>}
                  </div>
                  <p className="zxp-hint">Roster de producción usado por el pipeline de cada publicación.</p>
                </div>

                <div className="zxp-card">
                  <h3>Mood board (Pinterest)</h3>
                  <div className="zxp-field">
                    <span className="k">Tablero</span>
                    <input
                      className="zxp-select"
                      type="url"
                      placeholder="https://pinterest.com/usuario/tablero"
                      value={pinBoard}
                      onChange={(e) => setPinBoard(e.target.value)}
                      onBlur={savePinterest}
                    />
                    <span className="zxp-hint">
                      {pinSaved ? "Guardado." : "Dirección visual del cliente para la escaleta del mes."}
                    </span>
                  </div>
                  {customer?.pinterest_board_url && (
                    <div className="zxp-pinwrap">
                      <PinterestEmbed url={customer.pinterest_board_url} kind="embedBoard" />
                    </div>
                  )}
                </div>

                <div className="zxp-card">
                  <h3>Captación de leads</h3>
                  <div className="zxp-field">
                    <span className="k">Leads de WhatsApp</span>
                    <button
                      className={`zxp-btn${customer.receives_whatsapp_leads ? " solid" : ""}`}
                      onClick={toggleWhatsappInbound}
                    >
                      {customer.receives_whatsapp_leads ? "Activado — llegan a este funnel" : "Enviar leads de WhatsApp aquí"}
                    </button>
                    <span className="zxp-hint">
                      Los mensajes entrantes de WhatsApp (incluidos los de anuncios click-to-WhatsApp)
                      se convierten en leads automáticamente en el funnel de este cliente.
                    </span>
                  </div>

                  <div className="zxp-field">
                    <span className="k">Asistente de WhatsApp (IA) {waSaved && <em style={{ color: "#235B44", fontStyle: "normal" }}>· guardado</em>}</span>
                    <button
                      className={`zxp-btn${customer.whatsapp_ai_enabled !== false ? " solid" : ""}`}
                      disabled={waSaving}
                      onClick={() => saveWhatsappConfig({ whatsapp_ai_enabled: !(customer.whatsapp_ai_enabled !== false) })}
                    >
                      {customer.whatsapp_ai_enabled !== false ? "Activado — responde y califica solo" : "Activar respuestas con IA"}
                    </button>
                    <span className="zxp-hint">
                      Al llegar un mensaje, la IA saluda, confirma el servicio de interés y pide la
                      colonia/dirección para verificar cobertura — y guarda esos datos en el lead.
                    </span>
                    <textarea
                      className="zxp-input"
                      rows={2}
                      placeholder="Contexto del negocio (ej. Distribuidor autorizado de TotalPlay: internet y TV por fibra en Xalapa)"
                      defaultValue={customer.whatsapp_business_context || ""}
                      onBlur={(e) => {
                        if ((e.target.value || "") !== (customer.whatsapp_business_context || ""))
                          saveWhatsappConfig({ whatsapp_business_context: e.target.value });
                      }}
                    />
                    <textarea
                      className="zxp-input"
                      rows={2}
                      placeholder="Saludo si la IA está apagada (opcional)"
                      defaultValue={customer.whatsapp_greeting || ""}
                      onBlur={(e) => {
                        if ((e.target.value || "") !== (customer.whatsapp_greeting || ""))
                          saveWhatsappConfig({ whatsapp_greeting: e.target.value });
                      }}
                    />
                  </div>
                  <div className="zxp-field">
                    <span className="k">Enlace de captación</span>
                    <button className="zxp-btn" onClick={copyCaptureLink}>Copiar enlace público</button>
                    <span className="zxp-hint">
                      Compártelo en anuncios o link-in-bio. Cada formulario enviado entra
                      como lead en el funnel de este cliente — sin verificación de Meta.
                    </span>
                  </div>
                  <div className="zxp-field">
                    <Link to={`/funnel`} className="zxp-btn">Abrir funnel</Link>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ---- CONTENIDO ---- */}
          {activeTab === "contenido" && (
            <div className="zxp-handoff">
              <h2>El contenido vive en el <span className="zxp-serif">calendario</span></h2>
              <p>La planeación, el diseño, la aprobación y la publicación de este cliente ocurren en el calendario unificado y en Aprobaciones — un solo lugar, un solo flujo. {upcoming != null && <>Tiene <b>{upcoming}</b> publicación{upcoming === 1 ? "" : "es"} en los próximos 60 días.</>}</p>
              <div className="row">
                <Link className="go" to={`/content-calendar?customer=${id}`}>Abrir calendario de este cliente →</Link>
                <Link className="go ghost" to="/approvals">Ver aprobaciones</Link>
              </div>
            </div>
          )}

          {/* ---- RECURSOS ---- */}
          {activeTab === "recursos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {FILE_SECTIONS.map((s) => (
                <div key={s.cat}>
                  <div className="zxp-files-head">
                    <h3>{s.label}</h3>
                    <div>
                      <input ref={(el) => (fileInputs.current[s.cat] = el)} type="file" multiple accept={s.accept} style={{ display: "none" }}
                        onChange={(e) => { uploadTo(s.cat, e.target.files); e.target.value = ""; }} />
                      <button className="zxp-btn" disabled={uploading[s.cat]} onClick={() => fileInputs.current[s.cat]?.click()}>
                        {uploading[s.cat] ? "Subiendo…" : "+ Subir"}
                      </button>
                    </div>
                  </div>
                  {files[s.cat]?.length ? (
                    <div className="zxp-filelist">
                      {files[s.cat].map((f) => (
                        <div className="zxp-filerow" key={f.id}>
                          <span>{f.name}</span>
                          <span className="meta">{[f.size, f.uploaded_at].filter(Boolean).join(" · ")}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="zxp-files-empty">Sin archivos en {s.label.toLowerCase()}.</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ---- FACTURACIÓN ---- */}
          {activeTab === "facturacion" && (
            invoices.loading ? (
              <div className="zxp-loading">Cargando facturación…</div>
            ) : invoices.denied ? (
              <div className="zxp-note warn"><strong>Sin acceso a facturación.</strong>
                <p>Tu rol no tiene permiso para ver los ingresos. Pídelo a un administrador o contador.</p></div>
            ) : (
              <>
                <div className="zxp-sum">
                  <div><span className="k">Facturado</span><span className="v">{fmtMoney(totals.billed)}</span></div>
                  <div><span className="k">Pagado</span><span className="v">{fmtMoney(totals.paid)}</span></div>
                  <div><span className="k">Pendiente</span><span className="v due">{fmtMoney(totals.due)}</span></div>
                </div>
                {invoices.list.length === 0 ? (
                  <div className="zxp-note"><strong>Sin facturas todavía.</strong>
                    <p>Cuando generes una factura para este cliente, aparecerá aquí.</p></div>
                ) : (
                  <div className="zxp-tablewrap">
                    <table className="zxp-table">
                      <thead><tr><th>Folio</th><th>Fecha</th><th className="r">Total</th><th className="r">Saldo</th><th>Estado</th></tr></thead>
                      <tbody>
                        {invoices.list.map((i) => {
                          const st = invStatus(i.current_status || i.status);
                          return (
                            <tr key={i.id}>
                              <td><Link to={`/income/invoices/${i.id}`}>{i.invoice_number || `#${i.id}`}</Link></td>
                              <td>{fmtDate(i.invoice_date)}</td>
                              <td className="r">{fmtMoney(i.total)}</td>
                              <td className="r">{fmtMoney(i.amount_due)}</td>
                              <td><span className={`zxp-pill ${st.cls}`}>{st.label}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )
          )}
      </PageShell>

        {editing && (
          <div className="zxp-modal-overlay" onClick={() => !saving && setEditing(false)}>
            <div className="zxp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="zxp-modal-head">
                <h2>Editar <span className="zxp-serif">cliente</span></h2>
                <button className="zxp-modal-x" onClick={() => !saving && setEditing(false)} aria-label="Cerrar">×</button>
              </div>
              <div className="zxp-modal-body">
                {EDIT_FIELDS.map((g) => (
                  <div className="zxp-modal-section" key={g.section}>
                    <h3>{g.section}</h3>
                    <div className="zxp-modal-grid">
                      {g.fields.map(({ k, label, type }) => (
                        <label className="zxp-modal-field" key={k}>
                          <span>{label}</span>
                          <input
                            type={type || "text"}
                            value={editForm[k] ?? ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {saveError && <div className="zxp-note warn"><strong>{saveError}</strong></div>}
              </div>
              <div className="zxp-modal-foot">
                <button className="zxp-btn" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
                <button className="zxp-btn solid" onClick={saveEdit} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
};

export default CustomerProfile;
