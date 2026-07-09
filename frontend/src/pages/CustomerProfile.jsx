import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
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
  const [teamMembers, setTeamMembers] = useState([]);
  const [roster, setRoster] = useState({});
  const [rosterMembers, setRosterMembers] = useState([]);
  const [invoices, setInvoices] = useState({ loading: true, list: [], denied: false });
  const [upcoming, setUpcoming] = useState(null);
  const [uploading, setUploading] = useState({});
  const [pinBoard, setPinBoard] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
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
    axios.get(`${API_BASE_URL}/team-members`, { headers })
      .then((r) => setTeamMembers(r.data?.team_members || []))
      .catch(() => setTeamMembers([]));
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

  if (loading) return <Layout><div className="zxp"><div className="zxp-loading">Cargando perfil…</div></div></Layout>;
  if (error || !customer) {
    return (
      <Layout>
        <div className="zxp"><div className="zxp-inner zxp-body">
          <div className="zxp-note warn"><strong>{error || "Cliente no encontrado"}</strong>
            <p><Link to="/crm">← Volver al directorio</Link></p></div>
        </div></div>
      </Layout>
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

  return (
    <Layout>
      <div className="zxp">
        <div className="zxp-head">
          <div className="zxp-head-in">
            <div className="zxp-head-top">
              <div className="zxp-id">
                <span className="zxp-avatar">{name.charAt(0).toUpperCase()}</span>
                <div>
                  <h1>{name}</h1>
                  {contact && contact !== name && <div className="comm">Contacto: {contact}</div>}
                  {(customer.contact_phone || customer.phone) && <div className="phone">{customer.contact_phone || customer.phone}</div>}
                </div>
              </div>
              <div className="zxp-actions">
                <Link to="/crm" className="zxp-btn">← Volver</Link>
                <Link to="/messages" className="zxp-btn">Mensajes</Link>
                <button className="zxp-btn solid" onClick={() => { setActiveTab("recursos"); }}>Subir archivos</button>
              </div>
            </div>
            <div className="zxp-tabs">
              {TABS.map((t) => (
                <button key={t.id} className={`zxp-tab${activeTab === t.id ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="zxp-inner zxp-body">
          {/* ---- RESUMEN ---- */}
          {activeTab === "resumen" && (
            <>
              <div className="zxp-glance">
                <Link to={`/content-calendar?customer=${id}`}>
                  <span className="v">{upcoming ?? "—"}</span><span className="k">Publicaciones próximas</span>
                </Link>
                <a onClick={(e) => { e.preventDefault(); setActiveTab("facturacion"); }} href="#facturacion">
                  <span className="v">{invoices.denied ? "—" : pendingCount}</span><span className="k">Facturas pendientes</span>
                </a>
                <Link to="/approvals">
                  <span className="v">→</span><span className="k">Aprobaciones</span>
                </Link>
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
        </div>
      </div>
    </Layout>
  );
};

export default CustomerProfile;
