import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import { customerName } from "../utils/customerName";
import "./TasksBoard.css";

const PRIORITIES = [
  { v: "high", label: "Alta" },
  { v: "medium", label: "Media" },
  { v: "low", label: "Baja" },
];
const STATUS_LABEL = { todo: "Por hacer", in_progress: "En progreso", completed: "Hecho" };
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Sin fecha");
const isOverdue = (t) => t.due_date && t.status !== "completed" && new Date(t.due_date) < new Date(new Date().toDateString());

const emptyForm = { title: "", description: "", priority: "medium", due_date: "", assignee_kind: "team", assignee_member_id: "", customer_id: "" };

const TasksBoard = () => {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("open");
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  const load = async () => {
    const r = await axios.get(`${API_BASE_URL}/api/tasks`, { headers }).catch(() => ({ data: { tasks: [] } }));
    setTasks(Array.isArray(r.data?.tasks) ? r.data.tasks : []);
  };

  useEffect(() => {
    (async () => {
      const [m, c] = await Promise.all([
        axios.get(`${API_BASE_URL}/team-members`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers`, { headers }).catch(() => ({ data: [] })),
      ]);
      setMembers(Array.isArray(m.data) ? m.data : m.data?.members || []);
      setCustomers(Array.isArray(c.data) ? c.data : []);
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.title.trim()) { setErr("Escribe un título."); return; }
    if (form.assignee_kind === "team" && !form.assignee_member_id) { setErr("Elige a quién se la asignas."); return; }
    if (form.assignee_kind === "client" && !form.customer_id) { setErr("Elige el cliente."); return; }
    setSaving(true);
    try {
      await axios.post(`${API_BASE_URL}/api/tasks`, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        due_date: form.due_date || null,
        assignee_kind: form.assignee_kind,
        assignee_member_id: form.assignee_kind === "team" ? form.assignee_member_id : null,
        customer_id: form.customer_id || null,
      }, { headers });
      setForm(emptyForm);
      await load();
    } catch (e2) {
      setErr(e2.response?.data?.error || "No se pudo crear la tarea.");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (t, status) => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status } : x)));
    await axios.patch(`${API_BASE_URL}/api/tasks/${t.id}`, { status }, { headers }).catch(load);
  };

  const remove = async (t) => {
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    await axios.delete(`${API_BASE_URL}/api/tasks/${t.id}`, { headers }).catch(load);
  };

  const shown = tasks.filter((t) => (filter === "open" ? t.status !== "completed" : filter === "done" ? t.status === "completed" : true));
  const openCount = tasks.filter((t) => t.status !== "completed").length;

  return (
    <Layout>
      <div className="zxtk">
        <div className="zxtk-inner">
          <div className="zxtk-head">
            <div className="eyebrow">Equipo</div>
            <h1>Tareas <span className="zxtk-serif">del equipo</span></h1>
            <div className="sub">Asigna pendientes a tu equipo o a un cliente — sin necesidad de un post o proyecto.</div>
          </div>

          <form className="zxtk-form" onSubmit={submit}>
            <div className="zxtk-form-row">
              <input className="zxtk-in grow" placeholder="¿Qué hay que hacer?" value={form.title} onChange={set("title")} />
              <select className="zxtk-in" value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((p) => <option key={p.v} value={p.v}>Prioridad: {p.label}</option>)}
              </select>
              <input className="zxtk-in" type="date" value={form.due_date} onChange={set("due_date")} />
            </div>
            <div className="zxtk-form-row">
              <div className="zxtk-toggle">
                <button type="button" className={form.assignee_kind === "team" ? "on" : ""} onClick={() => setForm((f) => ({ ...f, assignee_kind: "team" }))}>A un miembro</button>
                <button type="button" className={form.assignee_kind === "client" ? "on" : ""} onClick={() => setForm((f) => ({ ...f, assignee_kind: "client" }))}>A un cliente</button>
              </div>
              {form.assignee_kind === "team" ? (
                <select className="zxtk-in grow" value={form.assignee_member_id} onChange={set("assignee_member_id")}>
                  <option value="">Asignar a…</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              ) : (
                <select className="zxtk-in grow" value={form.customer_id} onChange={set("customer_id")}>
                  <option value="">Cliente…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
                </select>
              )}
              {form.assignee_kind === "team" && (
                <select className="zxtk-in" value={form.customer_id} onChange={set("customer_id")}>
                  <option value="">Cliente (opcional)</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
                </select>
              )}
              <button className="zxtk-btn solid" disabled={saving}>{saving ? "Creando…" : "Crear tarea"}</button>
            </div>
            <input className="zxtk-in grow" placeholder="Nota o detalle (opcional)" value={form.description} onChange={set("description")} />
            {err && <div className="zxtk-err">{err}</div>}
          </form>

          <div className="zxtk-filters">
            {[["open", `Abiertas (${openCount})`], ["done", "Hechas"], ["all", "Todas"]].map(([k, l]) => (
              <button key={k} className={`zxtk-chip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="zxtk-empty">No hay tareas en esta vista.</div>
          ) : (
            <div className="zxtk-list">
              {shown.map((t) => (
                <div className={`zxtk-row${t.status === "completed" ? " done" : ""}`} key={t.id}>
                  <button className={`zxtk-check${t.status === "completed" ? " on" : ""}`} title="Marcar hecho"
                    onClick={() => setStatus(t, t.status === "completed" ? "todo" : "completed")}>✓</button>
                  <div className="zxtk-main">
                    <div className="zxtk-title">{t.title}</div>
                    {t.description && <div className="zxtk-desc">{t.description}</div>}
                    <div className="zxtk-meta">
                      <span className={`zxtk-pri ${t.priority}`}>{PRIORITIES.find((p) => p.v === t.priority)?.label || t.priority}</span>
                      <span>{t.assignee_kind === "client" ? "Cliente" : (t.assignee_name || "Sin asignar")}</span>
                      {t.customer_name && <span>· {t.customer_name}</span>}
                      <span className={isOverdue(t) ? "over" : ""}>· {fmtDate(t.due_date)}</span>
                    </div>
                  </div>
                  <div className="zxtk-actions">
                    {t.status !== "completed" && (
                      <select className="zxtk-status" value={t.status} onChange={(e) => setStatus(t, e.target.value)}>
                        <option value="todo">Por hacer</option>
                        <option value="in_progress">En progreso</option>
                        <option value="completed">Hecho</option>
                      </select>
                    )}
                    <button className="zxtk-del" title="Eliminar" onClick={() => remove(t)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default TasksBoard;
