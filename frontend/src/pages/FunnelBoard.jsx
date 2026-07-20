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

  const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  useEffect(() => {
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
    if (!cid) { setLeads([]); return; }
    setLoading(true);
    try {
      const r = await axios.get(`${API_BASE_URL}/leads`, { headers, params: { customer_id: cid } });
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
    if (!customerId) return;
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
              <select className="zxfn-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {customers.length === 0 && <option value="">Sin clientes</option>}
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{nameOf(c)}</option>
                ))}
              </select>
              <button className="zxfn-btn" onClick={() => setAdding((a) => !a)} disabled={!customerId}>
                {adding ? "Cerrar" : "+ Agregar lead"}
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
                        >
                          <div className="zxfn-card-name">{l.display_name || l.name || "Lead"}</div>
                          <div className="zxfn-card-meta">
                            {(l.display_phone || l.phone) && <span>{l.display_phone || l.phone}</span>}
                            {l.source && <span className="zxfn-src">{l.source}</span>}
                          </div>
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
      </div>
    </Layout>
  );
};

export default FunnelBoard;
