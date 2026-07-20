import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import { customerName } from "../utils/customerName";
import { FUNNEL_STAGES, stageLabel, LEAD_SOURCES } from "../config/salesFunnel";
import "./FunnelBoard.css";

const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const emptyLead = { name: "", phone: "", email: "", estimated_value: "", source: "campaign" };

const FunnelBoard = () => {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyLead);
  const [saving, setSaving] = useState(false);
  const [activeLead, setActiveLead] = useState(null);
  const [ef, setEf] = useState({});
  const [savingLead, setSavingLead] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [triaging, setTriaging] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
  const isClient = localStorage.getItem("userRole") === "client";

  useEffect(() => {
    if (isClient) return; // clients don't pick a customer — the server scopes them
    axios.get(`${API_BASE_URL}/customers`, { headers })
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setCustomers(list);
        if (list.length && !customerId) setCustomerId(String(list[0].id));
      })
      .catch(() => setCustomers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLeads = useCallback(async (cid) => {
    if (!isClient && !cid) { setLeads([]); return; }
    setLoading(true);
    try {
      // Client role is scoped server-side, so no customer_id is sent.
      const params = isClient ? {} : { customer_id: cid };
      const r = await axios.get(`${API_BASE_URL}/leads`, { headers, params });
      setLeads(Array.isArray(r.data) ? r.data : []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchLeads(customerId); }, [customerId, fetchLeads]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(FUNNEL_STAGES.map((s) => [s.key, []]));
    leads.forEach((l) => { (map[l.status] || (map[l.status] = [])).push(l); });
    return map;
  }, [leads]);

  const stats = useMemo(() => {
    const total = leads.length;
    const won = leads.filter((l) => l.status === "converted").length;
    const lost = leads.filter((l) => l.status === "lost").length;
    const pipeline = leads
      .filter((l) => l.status !== "converted" && l.status !== "lost")
      .reduce((a, l) => a + (Number(l.estimated_value) || 0), 0);
    const decided = won + lost;
    const conv = decided ? Math.round((won / decided) * 100) : 0;
    return { total, won, pipeline, conv };
  }, [leads]);

  const moveLead = async (leadId, status) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
    try {
      await axios.put(`${API_BASE_URL}/leads/${leadId}`, { status }, { headers });
    } catch {
      fetchLeads(customerId); // revert on failure
    }
  };

  const onDrop = (stageKey) => {
    setOverStage(null);
    if (dragId != null) moveLead(dragId, stageKey);
    setDragId(null);
  };

  const addLead = async (e) => {
    e.preventDefault();
    if (!isClient && !customerId) return;
    if (!form.name && !form.phone) return;
    setSaving(true);
    try {
      const r = await axios.post(`${API_BASE_URL}/leads/quick`, {
        customer_id: Number(customerId),
        name: form.name, phone: form.phone, email: form.email,
        estimated_value: form.estimated_value, source: form.source, status: "new",
      }, { headers });
      if (r.data?.lead) setLeads((prev) => [{ ...r.data.lead, display_name: r.data.lead.name }, ...prev]);
      setForm(emptyLead);
      setAdding(false);
    } catch (err) {
      alert(err.response?.data?.error || "No se pudo crear el lead");
    } finally {
      setSaving(false);
    }
  };

  const nameOf = (c) => customerName(c);

  const openLead = (lead) => {
    setActiveLead(lead);
    setEf({
      name: lead.name || lead.display_name || "",
      company: lead.company || "",
      phone: lead.phone || lead.display_phone || "",
      email: lead.email || "",
      address: lead.address || "",
      city: lead.city || "",
      source: lead.source || "manual",
      service_interest: lead.service_interest || "",
      estimated_value: lead.estimated_value ?? "",
      expected_close_date: lead.expected_close_date ? String(lead.expected_close_date).slice(0, 10) : "",
      next_follow_up: lead.next_follow_up ? String(lead.next_follow_up).slice(0, 10) : "",
      priority: lead.priority || "media",
      status: lead.status || "new",
      lost_reason: lead.lost_reason || "",
      notes: lead.notes || "",
      tags: Array.isArray(lead.tags) ? lead.tags.join(", ") : "",
    });
  };

  const saveLead = async () => {
    if (!activeLead) return;
    setSavingLead(true);
    try {
      const payload = {
        ...ef,
        estimated_value: ef.estimated_value === "" ? null : ef.estimated_value,
        tags: ef.tags ? ef.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };
      const r = await axios.put(`${API_BASE_URL}/leads/${activeLead.id}`, payload, { headers });
      const updated = r.data?.lead || { ...activeLead, ...payload };
      setLeads((prev) => prev.map((l) => (l.id === activeLead.id ? { ...l, ...updated, display_name: updated.name, display_phone: updated.phone } : l)));
      setActiveLead(null);
    } catch (err) {
      alert(err.response?.data?.error || "No se pudo guardar el lead");
    } finally {
      setSavingLead(false);
    }
  };

  const efSet = (k, v) => setEf((f) => ({ ...f, [k]: v }));
  const F = FUNNEL_STAGES;

  // Map a CSV/TSV header cell to a lead field (tolerant of Spanish variants).
  const HEADER_MAP = [
    { f: "name", keys: ["nombre", "name", "cliente", "prospecto", "contacto"] },
    { f: "phone", keys: ["telefono", "teléfono", "phone", "celular", "whatsapp", "tel", "movil", "móvil"] },
    { f: "email", keys: ["email", "correo", "mail", "e-mail"] },
    { f: "city", keys: ["ciudad", "city", "zona", "colonia", "municipio"] },
    { f: "address", keys: ["direccion", "dirección", "address", "domicilio", "calle"] },
    { f: "service_interest", keys: ["interes", "interés", "producto", "plan", "servicio", "paquete"] },
    { f: "estimated_value", keys: ["valor", "value", "monto", "importe", "precio"] },
    { f: "source", keys: ["fuente", "source", "origen", "campaña", "campana", "campaign"] },
  ];
  const mapHeader = (h) => {
    const k = (h || "").trim().toLowerCase();
    return HEADER_MAP.find((m) => m.keys.includes(k))?.f || null;
  };

  const parseLeads = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 1) return [];
    const delim = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(delim).map((h) => mapHeader(h));
    const hasHeader = headers.some(Boolean);
    const start = hasHeader ? 1 : 0;
    // No header row → assume: name, phone, email, city
    const fallback = ["name", "phone", "email", "city"];
    const cols = hasHeader ? headers : fallback;
    const out = [];
    for (let i = start; i < lines.length; i++) {
      const cells = lines[i].split(delim);
      const lead = {};
      cols.forEach((f, idx) => { if (f && cells[idx] != null) lead[f] = cells[idx].trim(); });
      if (lead.name || lead.phone) out.push(lead);
    }
    return out;
  };

  const previewCount = useMemo(() => parseLeads(csvText).length, [csvText]);

  const runImport = async () => {
    if (!isClient && !customerId) return;
    const parsed = parseLeads(csvText);
    if (!parsed.length) { setImportResult({ error: "No se detectaron leads. Revisa el formato." }); return; }
    setImportBusy(true); setImportResult(null);
    try {
      const r = await axios.post(`${API_BASE_URL}/leads/bulk`, { customer_id: Number(customerId), leads: parsed }, { headers });
      setImportResult(r.data);
      await fetchLeads(customerId);
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || "No se pudo importar." });
    } finally {
      setImportBusy(false);
    }
  };

  const runTriage = async () => {
    if (!isClient && !customerId) return;
    setTriaging(true); setSuggestions(null);
    try {
      const body = isClient ? {} : { customer_id: Number(customerId) };
      const r = await axios.post(`${API_BASE_URL}/leads/triage`, body, { headers });
      if (r.data?.error) { alert(r.data.error); }
      else {
        setSuggestions(r.data.suggestions || []);
        await fetchLeads(customerId);
      }
    } catch (err) {
      alert(err.response?.data?.error || "No se pudo analizar con IA");
    } finally {
      setTriaging(false);
    }
  };

  const onCsvFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setCsvText(String(e.target.result || ""));
    reader.readAsText(file);
  };

  return (
    <Layout>
      <div className="zxfn">
        <div className="zxfn-inner">
          <div className="zxfn-head">
            <div>
              <div className="eyebrow">Clientes · CRM</div>
              <h1>Funnel de <span className="zxfn-serif">prospectos</span></h1>
              <div className="sub">Pipeline de leads por cliente — arrastra una tarjeta para cambiar de etapa.</div>
            </div>
            <div className="zxfn-tools">
              {!isClient && (
                <select className="zxfn-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  {customers.length === 0 && <option value="">Sin clientes</option>}
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{nameOf(c)}</option>
                  ))}
                </select>
              )}
              <button className="zxfn-btn" onClick={() => setAdding((a) => !a)} disabled={!isClient && !customerId}>
                {adding ? "Cerrar" : "+ Agregar lead"}
              </button>
              <button className="zxfn-btn" onClick={() => { setImporting(true); setImportResult(null); }} disabled={!isClient && !customerId}>
                Importar
              </button>
              <button className="zxfn-btn solid" onClick={runTriage} disabled={triaging || (!isClient && !customerId)} title="La IA revisa el embudo y sugiere la siguiente acción por prospecto">
                {triaging ? "Analizando…" : "Triage IA"}
              </button>
            </div>
          </div>

          {adding && (
            <form className="zxfn-addbar" onSubmit={addLead}>
              <input className="zxfn-input" placeholder="Nombre" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <input className="zxfn-input" placeholder="Teléfono" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <input className="zxfn-input" placeholder="Valor estimado" type="number" value={form.estimated_value}
                onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value }))} />
              <select className="zxfn-input" value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                {LEAD_SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button className="zxfn-btn solid" type="submit" disabled={saving}>{saving ? "…" : "Guardar"}</button>
            </form>
          )}

          <div className="zxfn-tiles">
            <div className="zxfn-tile"><span className="k">Leads</span><span className="v">{stats.total}</span></div>
            <div className="zxfn-tile"><span className="k">Valor en pipeline</span><span className="v">{fmtMoney(stats.pipeline)}</span></div>
            <div className="zxfn-tile ok"><span className="k">Ganados</span><span className="v">{stats.won}</span></div>
            <div className="zxfn-tile sched"><span className="k">Conversión</span><span className="v">{stats.conv}%</span></div>
          </div>

          {suggestions && suggestions.length > 0 && (
            <div className="zxfn-suggest">
              <div className="zxfn-suggest-head">Acciones sugeridas <span>· IA</span></div>
              <div className="zxfn-suggest-list">
                {suggestions.slice(0, 8).map((s) => {
                  const lead = leads.find((l) => l.id === s.id);
                  return (
                    <button key={s.id} className="zxfn-suggest-item" onClick={() => lead && openLead(lead)}>
                      <span className={`zxfn-temp t-${s.temperature}`} />
                      <span className="nm">{lead?.display_name || lead?.name || `Lead ${s.id}`}</span>
                      <span className="act">{s.next_action}</span>
                      <span className="sc">{s.score}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div className="zxfn-loading">Cargando funnel…</div>
          ) : (
            <div className="zxfn-board">
              {FUNNEL_STAGES.map((stage) => {
                const items = byStage[stage.key] || [];
                const colValue = items.reduce((a, l) => a + (Number(l.estimated_value) || 0), 0);
                return (
                  <div
                    key={stage.key}
                    className={`zxfn-col ${overStage === stage.key ? "over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setOverStage(stage.key); }}
                    onDragLeave={() => setOverStage((s) => (s === stage.key ? null : s))}
                    onDrop={() => onDrop(stage.key)}
                  >
                    <div className={`zxfn-colhead t-${stage.tone}`}>
                      <span className="dot" />
                      <span className="lbl">{stage.label}</span>
                      <span className="cnt">{items.length}</span>
                    </div>
                    {colValue > 0 && <div className="zxfn-colval">{fmtMoney(colValue)}</div>}
                    <div className="zxfn-collist">
                      {items.map((l) => (
                        <div
                          key={l.id}
                          className={`zxfn-card ${dragId === l.id ? "dragging" : ""}`}
                          draggable
                          onDragStart={() => setDragId(l.id)}
                          onDragEnd={() => { setDragId(null); setOverStage(null); }}
                          onClick={() => openLead(l)}
                          title="Ver / editar lead"
                        >
                          <div className="zxfn-card-name">
                            {l.ai_temperature && <span className={`zxfn-temp t-${l.ai_temperature}`} title={`Score ${l.lead_score || 0}`} />}
                            {l.display_name || l.name || "Lead"}
                          </div>
                          <div className="zxfn-card-meta">
                            {(l.display_phone || l.phone) && <span>{l.display_phone || l.phone}</span>}
                            {l.source && <span className="zxfn-src">{l.source}</span>}
                          </div>
                          {l.ai_next_action && <div className="zxfn-card-ai">→ {l.ai_next_action}</div>}
                          {Number(l.estimated_value) > 0 && (
                            <div className="zxfn-card-val">{fmtMoney(l.estimated_value)}</div>
                          )}
                        </div>
                      ))}
                      {items.length === 0 && <div className="zxfn-colempty">—</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {importing && (
          <div className="zxfn-overlay center" onClick={() => !importBusy && setImporting(false)}>
            <div className="zxfn-modal" onClick={(e) => e.stopPropagation()}>
              <div className="zxfn-drawer-head">
                <div>
                  <div className="eyebrow">Importar leads</div>
                  <h2>Carga masiva</h2>
                </div>
                <button className="zxfn-x" onClick={() => !importBusy && setImporting(false)} aria-label="Cerrar">×</button>
              </div>
              <div className="zxfn-drawer-body">
                <p className="zxfn-hint">
                  Pega desde Excel/Sheets o sube un CSV. Primera fila = encabezados
                  (nombre, teléfono, email, ciudad, interés, valor, fuente). Se omiten
                  duplicados por teléfono.
                </p>
                <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => onCsvFile(e.target.files?.[0])} />
                <textarea
                  className="zxfn-csv"
                  rows={9}
                  placeholder={"nombre,telefono,ciudad,valor\nJuan Pérez,2281234567,Xalapa,499\nAna López,2287654321,Coatepec,699"}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
                <div className="zxfn-importfoot">
                  <span className="zxfn-preview">{previewCount} lead{previewCount === 1 ? "" : "s"} detectado{previewCount === 1 ? "" : "s"}</span>
                  {importResult && (
                    importResult.error
                      ? <span className="zxfn-badbadge">{importResult.error}</span>
                      : <span className="zxfn-okbadge">{importResult.created} importados · {importResult.skipped} omitidos</span>
                  )}
                </div>
              </div>
              <div className="zxfn-drawer-foot">
                <button className="zxfn-btn" onClick={() => setImporting(false)} disabled={importBusy}>Cerrar</button>
                <button className="zxfn-btn solid" onClick={runImport} disabled={importBusy || previewCount === 0}>
                  {importBusy ? "Importando…" : `Importar ${previewCount || ""}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeLead && (
          <div className="zxfn-overlay" onClick={() => !savingLead && setActiveLead(null)}>
            <div className="zxfn-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="zxfn-drawer-head">
                <div>
                  <div className="eyebrow">Lead</div>
                  <h2>{ef.name || "Lead"}</h2>
                </div>
                <button className="zxfn-x" onClick={() => !savingLead && setActiveLead(null)} aria-label="Cerrar">×</button>
              </div>

              <div className="zxfn-drawer-body">
                <div className="zxfn-stagerow">
                  {F.map((s) => (
                    <button
                      key={s.key}
                      className={`zxfn-stagechip t-${s.tone} ${ef.status === s.key ? "active" : ""}`}
                      onClick={() => efSet("status", s.key)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {(activeLead.ai_summary || activeLead.ai_next_action) && (
                  <div className="zxfn-aibox">
                    <div className="tag">Análisis IA {activeLead.ai_temperature ? `· ${activeLead.ai_temperature}` : ""}</div>
                    {activeLead.ai_summary && <div className="s">{activeLead.ai_summary}</div>}
                    {activeLead.ai_next_action && <div className="a">Siguiente acción: {activeLead.ai_next_action}</div>}
                  </div>
                )}

                {ef.status === "lost" && (
                  <label className="zxfn-field full">
                    <span>Motivo de pérdida</span>
                    <input value={ef.lost_reason} onChange={(e) => efSet("lost_reason", e.target.value)} />
                  </label>
                )}

                <div className="zxfn-fieldgrid">
                  <label className="zxfn-field"><span>Nombre</span><input value={ef.name} onChange={(e) => efSet("name", e.target.value)} /></label>
                  <label className="zxfn-field"><span>Empresa</span><input value={ef.company} onChange={(e) => efSet("company", e.target.value)} /></label>
                  <label className="zxfn-field"><span>Teléfono</span><input value={ef.phone} onChange={(e) => efSet("phone", e.target.value)} /></label>
                  <label className="zxfn-field"><span>Email</span><input value={ef.email} onChange={(e) => efSet("email", e.target.value)} /></label>
                  <label className="zxfn-field"><span>Dirección</span><input value={ef.address} onChange={(e) => efSet("address", e.target.value)} /></label>
                  <label className="zxfn-field"><span>Ciudad / Zona</span><input value={ef.city} onChange={(e) => efSet("city", e.target.value)} /></label>
                  <label className="zxfn-field"><span>Interés / producto</span><input value={ef.service_interest} onChange={(e) => efSet("service_interest", e.target.value)} /></label>
                  <label className="zxfn-field"><span>Fuente</span>
                    <select value={ef.source} onChange={(e) => efSet("source", e.target.value)}>
                      {LEAD_SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </label>
                  <label className="zxfn-field"><span>Valor estimado</span><input type="number" value={ef.estimated_value} onChange={(e) => efSet("estimated_value", e.target.value)} /></label>
                  <label className="zxfn-field"><span>Prioridad</span>
                    <select value={ef.priority} onChange={(e) => efSet("priority", e.target.value)}>
                      <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                    </select>
                  </label>
                  <label className="zxfn-field"><span>Cierre estimado</span><input type="date" value={ef.expected_close_date} onChange={(e) => efSet("expected_close_date", e.target.value)} /></label>
                  <label className="zxfn-field"><span>Próximo seguimiento</span><input type="date" value={ef.next_follow_up} onChange={(e) => efSet("next_follow_up", e.target.value)} /></label>
                </div>

                <label className="zxfn-field full"><span>Etiquetas (separadas por coma)</span><input value={ef.tags} onChange={(e) => efSet("tags", e.target.value)} placeholder="ej. fibra, promo, recontacto" /></label>
                <label className="zxfn-field full"><span>Notas</span><textarea rows={3} value={ef.notes} onChange={(e) => efSet("notes", e.target.value)} /></label>
              </div>

              <div className="zxfn-drawer-foot">
                <button className="zxfn-btn" onClick={() => setActiveLead(null)} disabled={savingLead}>Cancelar</button>
                <button className="zxfn-btn solid" onClick={saveLead} disabled={savingLead}>{savingLead ? "Guardando…" : "Guardar"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FunnelBoard;
