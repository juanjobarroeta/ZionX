import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import PixelMark from "../components/PixelMark";
import Telemetry from "../components/Telemetry";
import { API_BASE_URL } from "../utils/constants";
import { customerName } from "../utils/customerName";
import "../styles/zionx.css";
import "./TasksBoard.css";

const PRIORITIES = [
  { v: "high", label: "Alta" },
  { v: "medium", label: "Media" },
  { v: "low", label: "Baja" },
];
const STATUS_LABEL = { todo: "Por hacer", in_progress: "En progreso", completed: "Hecho", blocked: "Bloqueada", pending: "Por hacer" };
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Sin fecha");
const isOverdue = (t) => t.due_date && t.status !== "completed" && new Date(t.due_date) < new Date(new Date().toDateString());

const GROUPS = [
  { v: "proyecto", label: "Proyecto" },
  { v: "cliente", label: "Cliente" },
  { v: "lista", label: "Lista" },
];

const emptyForm = { title: "", description: "", priority: "medium", due_date: "", assignee_kind: "team", assignee_member_id: "", customer_id: "", project_id: "" };

// Collapse state per grouping mode, persisted so the board opens how you left it.
const collapsedKey = (mode) => `zxtk.collapsed.${mode}`;
const readCollapsed = (mode) => {
  try { return new Set(JSON.parse(localStorage.getItem(collapsedKey(mode)) || "[]")); }
  catch { return new Set(); }
};

const TasksBoard = () => {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("open");
  const [group, setGroup] = useState(() => localStorage.getItem("zxtk.group") || "proyecto");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [collapsed, setCollapsed] = useState(() => readCollapsed(localStorage.getItem("zxtk.group") || "proyecto"));
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  const load = async () => {
    const r = await axios.get(`${API_BASE_URL}/api/tasks`, { headers }).catch(() => ({ data: { tasks: [] } }));
    setTasks(Array.isArray(r.data?.tasks) ? r.data.tasks : []);
  };

  useEffect(() => {
    (async () => {
      const [m, c, p] = await Promise.all([
        axios.get(`${API_BASE_URL}/team-members`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/projects`, { headers, params: { limit: 200 } }).catch(() => ({ data: { projects: [] } })),
      ]);
      setMembers(m.data?.team_members || m.data?.members || (Array.isArray(m.data) ? m.data : []));
      setCustomers(Array.isArray(c.data) ? c.data : []);
      setProjects(Array.isArray(p.data?.projects) ? p.data.projects : []);
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMode = (mode) => {
    setGroup(mode);
    localStorage.setItem("zxtk.group", mode);
    setCollapsed(readCollapsed(mode));
  };

  const toggleFolder = (key) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem(collapsedKey(group), JSON.stringify([...next]));
      return next;
    });
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Choosing a project pre-fills its client — the common case — while leaving
  // the client select editable for the exceptions.
  const setProject = (e) => {
    const projectId = e.target.value;
    setForm((f) => {
      const proj = projects.find((x) => String(x.id) === String(projectId));
      const inherited = proj?.customer_id ? String(proj.customer_id) : f.customer_id;
      return { ...f, project_id: projectId, customer_id: projectId ? inherited : f.customer_id };
    });
  };

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
        project_id: form.project_id || null,
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
    // Completing a project task can unblock its dependents server-side.
    if (status === "completed" && t.project_id) load();
  };

  const remove = async (t) => {
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    await axios.delete(`${API_BASE_URL}/api/tasks/${t.id}`, { headers }).catch(load);
  };

  // ---- filters, telemetry, folders ----
  const byCustomer = customerFilter === "all"
    ? tasks
    : tasks.filter((t) => String(t.effective_customer_id) === String(customerFilter));
  const shown = byCustomer.filter((t) =>
    filter === "open" ? t.status !== "completed" : filter === "done" ? t.status === "completed" : true);

  const open = byCustomer.filter((t) => t.status !== "completed");
  const doneWeek = byCustomer.filter((t) =>
    t.status === "completed" && t.completed_at && Date.now() - new Date(t.completed_at).getTime() < 7 * 86400000).length;

  const folders = useMemo(() => {
    if (group === "lista") return null;
    const map = new Map();
    for (const t of shown) {
      const key = group === "proyecto" ? `p${t.project_id ?? "none"}` : `c${t.effective_customer_id ?? "none"}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          none: group === "proyecto" ? t.project_id == null : t.effective_customer_id == null,
          name: group === "proyecto"
            ? (t.project_name || "Sin proyecto")
            : (t.customer_name || "Sin cliente"),
          // The unassigned bucket spans clients — no subtitle for it.
          who: group === "proyecto" && t.project_id != null ? t.customer_name : null,
          items: [],
        });
      }
      map.get(key).items.push(t);
    }
    // Busiest folders first; the unassigned bucket always last.
    return [...map.values()].sort((a, b) => {
      if (a.none !== b.none) return a.none ? 1 : -1;
      const ao = a.items.filter((t) => t.status !== "completed").length;
      const bo = b.items.filter((t) => t.status !== "completed").length;
      return bo - ao || a.name.localeCompare(b.name);
    });
  }, [shown, group]);

  const Row = ({ t }) => (
    <div className={`zxtk-row${t.status === "completed" ? " done" : ""}`}>
      <button className={`zxtk-check${t.status === "completed" ? " on" : ""}`} title="Marcar hecho"
        onClick={() => setStatus(t, t.status === "completed" ? "todo" : "completed")}>✓</button>
      <div className="zxtk-main">
        <div className="zxtk-title">{t.title}</div>
        {t.description && <div className="zxtk-desc">{t.description}</div>}
        <div className="zxtk-meta">
          <span className={`zxtk-pri ${t.priority}`}>{PRIORITIES.find((p) => p.v === t.priority)?.label || t.priority}</span>
          {t.status === "blocked" && <span className="zx-pill v-muted">Bloqueada</span>}
          <span>{t.assignee_kind === "client" ? "Cliente" : (t.assignee_name || "Sin asignar")}</span>
          {group !== "cliente" && t.customer_name && <span>· {t.customer_name}</span>}
          {group !== "proyecto" && t.project_name && <span className="proj">· ▸ {t.project_name}</span>}
          <span className={`due${isOverdue(t) ? " over" : ""}`}>· {fmtDate(t.due_date)}</span>
        </div>
      </div>
      <div className="zxtk-actions">
        {t.status !== "completed" && (
          <select className="zx-select sm" value={t.status} onChange={(e) => setStatus(t, e.target.value)}>
            <option value="todo">Por hacer</option>
            <option value="in_progress">En progreso</option>
            {t.status === "blocked" && <option value="blocked">Bloqueada</option>}
            <option value="completed">Hecho</option>
          </select>
        )}
        <button className="zxtk-del" title="Eliminar" onClick={() => remove(t)}>×</button>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="zx-app zxtk">
        <header className="zx-cmd">
          <div className="zx-cmd-inner">
            <div className="zx-cmd-top">
              <div>
                <div className="zx-eyebrow"><PixelMark size={11} /> Equipo</div>
                <h1 className="zx-title">Tareas <span className="zx-serif">del equipo</span></h1>
              </div>
              <div className="zx-cmd-actions">
                <select className="zx-select inline on-ink" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} aria-label="Cliente">
                  <option value="all">Todos los clientes</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
                </select>
                <div className="zx-seg on-ink" role="group" aria-label="Agrupar por">
                  {GROUPS.map((g) => (
                    <button key={g.v} className={group === g.v ? "on" : ""} onClick={() => setMode(g.v)}>{g.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <Telemetry
              items={[
                { k: "Abiertas", v: open.length },
                { k: "Vencidas", v: open.filter(isOverdue).length, tone: "crit" },
                { k: "En progreso", v: open.filter((t) => t.status === "in_progress").length, tone: "brass" },
                { k: "Hechas · 7d", v: doneWeek },
              ]}
            />
          </div>
        </header>

        <div className="zx-canvas">
          {/* ---------- composer ---------- */}
          <form className="zxtk-form" onSubmit={submit}>
            <div className="zxtk-form-row">
              <input className="zx-input grow" placeholder="¿Qué hay que hacer?" value={form.title} onChange={set("title")} />
              <select className="zx-select" value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((p) => <option key={p.v} value={p.v}>Prioridad: {p.label}</option>)}
              </select>
              <input className="zx-input" type="date" value={form.due_date} onChange={set("due_date")} />
            </div>
            <div className="zxtk-form-row">
              <div className="zxtk-toggle">
                <button type="button" className={form.assignee_kind === "team" ? "on" : ""} onClick={() => setForm((f) => ({ ...f, assignee_kind: "team" }))}>A un miembro</button>
                <button type="button" className={form.assignee_kind === "client" ? "on" : ""} onClick={() => setForm((f) => ({ ...f, assignee_kind: "client" }))}>A un cliente</button>
              </div>
              {form.assignee_kind === "team" ? (
                <select className="zx-select grow" value={form.assignee_member_id} onChange={set("assignee_member_id")}>
                  <option value="">Asignar a…</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              ) : (
                <select className="zx-select grow" value={form.customer_id} onChange={set("customer_id")}>
                  <option value="">Cliente…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
                </select>
              )}
              <select className="zx-select" value={form.project_id} onChange={setProject}>
                <option value="">Sin proyecto</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {form.assignee_kind === "team" && (
                <select className="zx-select" value={form.customer_id} onChange={set("customer_id")}>
                  <option value="">Cliente (opcional)</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
                </select>
              )}
              <button className="zx-btn" disabled={saving}>{saving ? "Creando…" : "Crear tarea"}</button>
            </div>
            <input className="zx-input" placeholder="Nota o detalle (opcional)" value={form.description} onChange={set("description")} />
            {err && <div className="zx-err">{err}</div>}
          </form>

          {/* ---------- status filter ---------- */}
          <div className="zx-toolbar">
            {[["open", `Abiertas (${open.length})`], ["done", "Hechas"], ["all", "Todas"]].map(([k, l]) => (
              <button key={k} className={`zx-chip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>

          {/* ---------- folders / list ---------- */}
          {shown.length === 0 ? (
            <div className="zx-empty">
              <strong>Nada en esta vista.</strong>
              Crea una tarea arriba, o cambia el filtro de cliente o estado.
            </div>
          ) : group === "lista" ? (
            <div className="zxtk-folder">
              <div className="zxtk-folder-body">{shown.map((t) => <Row key={t.id} t={t} />)}</div>
            </div>
          ) : (
            <div className="zxtk-folders">
              {folders.map((f) => {
                const openN = f.items.filter((t) => t.status !== "completed").length;
                const isClosed = collapsed.has(f.key);
                return (
                  <section className="zxtk-folder" key={f.key}>
                    <button type="button" className="zxtk-folder-head" onClick={() => toggleFolder(f.key)} aria-expanded={!isClosed}>
                      <span className="chev">{isClosed ? "▸" : "▾"}</span>
                      <span className="name">{f.name}</span>
                      {f.who && <span className="who">{f.who}</span>}
                      <span className="counts"><span className="open">{String(openN).padStart(2, "0")} abiertas</span> · {String(f.items.length).padStart(2, "0")}</span>
                    </button>
                    {!isClosed && <div className="zxtk-folder-body">{f.items.map((t) => <Row key={t.id} t={t} />)}</div>}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default TasksBoard;
