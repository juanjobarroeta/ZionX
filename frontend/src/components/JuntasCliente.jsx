import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./JuntasCliente.css";

/**
 * Las juntas con el cliente, y lo que se acordó en ellas.
 *
 * El manual dice que ningún acuerdo de una llamada cuenta hasta quedar
 * registrado en la app. Zoom entrega los próximos pasos al terminar; aquí se
 * eligen los que de verdad son trabajo y se convierten en tareas.
 *
 * Llegan como propuesta, no como tarea asignada: la transcripción en español no
 * es lo bastante fiable para asignarle trabajo a una persona sin que alguien lo
 * lea, y ni Zoom ni nosotros sabemos de quién es ni para cuándo.
 */

const fmt = (d) => (d ? new Date(d).toLocaleString("es-MX", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
}) : "—");

const enUnaHora = () => {
  const d = new Date(Date.now() + 3600000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function JuntasCliente({ customerId }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const [st, setSt] = useState({ loading: true, configured: false, juntas: [] });
  const [abriendo, setAbriendo] = useState(false);
  const [cuando, setCuando] = useState(enUnaHora());
  const [minutos, setMinutos] = useState(60);
  const [tema, setTema] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [elegidos, setElegidos] = useState({});

  const cargar = useCallback(() => {
    axios.get(`${API_BASE_URL}/api/zoom/customer/${customerId}`, { headers })
      .then((r) => setSt({ loading: false, configured: !!r.data?.configured, juntas: r.data?.juntas || [] }))
      .catch(() => setSt({ loading: false, configured: false, juntas: [] }));
  }, [customerId, headers]);

  useEffect(() => { cargar(); }, [cargar]);

  const agendar = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await axios.post(`${API_BASE_URL}/api/zoom/customer/${customerId}`,
        { topic: tema || undefined, cuando: new Date(cuando).toISOString(), minutos }, { headers });
      setAbriendo(false); setTema("");
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo agendar.");
    } finally { setBusy(false); }
  };

  const confirmar = async (junta) => {
    const pasos = (junta.next_steps || []).filter((_, i) => elegidos[`${junta.id}-${i}`]);
    if (!pasos.length) return;
    setBusy(true);
    try {
      await axios.post(`${API_BASE_URL}/api/zoom/${junta.id}/acuerdos`, { pasos }, { headers });
      setElegidos({});
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudieron crear las tareas.");
    } finally { setBusy(false); }
  };

  if (st.loading) return null;
  if (!st.configured && st.juntas.length === 0) return null;

  const pendientes = st.juntas.filter((j) => (j.next_steps || []).length && !j.next_steps_procesados_at);

  return (
    <section className="zxjt">
      <div className="zxjt-head">
        <h2>Juntas</h2>
        {st.configured && (
          <button className="zxjt-btn" onClick={() => setAbriendo((o) => !o)}>
            {abriendo ? "Cancelar" : "Agendar junta"}
          </button>
        )}
      </div>

      {abriendo && (
        <form className="zxjt-form" onSubmit={agendar}>
          <label>
            <span>Cuándo</span>
            <input type="datetime-local" value={cuando} min={enUnaHora()}
                   onChange={(e) => setCuando(e.target.value)} />
          </label>
          <label>
            <span>Duración</span>
            <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
              {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>
          <label className="ancho">
            <span>Tema <em>(opcional)</em></span>
            <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Revisión mensual" />
          </label>
          <button type="submit" className="zxjt-btn solid" disabled={busy}>
            {busy ? "Agendando…" : "Agendar y crear la liga"}
          </button>
        </form>
      )}

      {error && <div className="zxjt-error">{error}</div>}

      {pendientes.map((j) => (
        <div className="zxjt-acuerdos" key={`ac-${j.id}`}>
          <div className="lead">
            La junta del {fmt(j.start_time)} dejó {j.next_steps.length} acuerdo{j.next_steps.length === 1 ? "" : "s"}.
            Elige cuáles son trabajo.
          </div>
          {j.next_steps.map((p, i) => (
            <label className="zxjt-paso" key={`${j.id}-${i}`}>
              <input type="checkbox" checked={!!elegidos[`${j.id}-${i}`]}
                     onChange={(e) => setElegidos((s) => ({ ...s, [`${j.id}-${i}`]: e.target.checked }))} />
              <span>{p.texto}</span>
            </label>
          ))}
          <button className="zxjt-btn solid" onClick={() => confirmar(j)} disabled={busy}>
            Crear las tareas elegidas
          </button>
        </div>
      ))}

      {st.juntas.length === 0 ? (
        <div className="zxjt-vacio">Todavía no hay juntas con este cliente.</div>
      ) : (
        <div className="zxjt-lista">
          {st.juntas.map((j) => (
            <div className={`zxjt-fila ${j.status}`} key={j.id}>
              <span className="f">{fmt(j.start_time)}</span>
              <span className="t">
                {j.topic || "Junta"}
                {j.summary && <em>{String(j.summary).slice(0, 120)}</em>}
              </span>
              <span className="e">{j.status}</span>
              <span className="a">
                {j.status === "programada" && j.join_url && (
                  <a href={j.join_url} target="_blank" rel="noreferrer">Entrar</a>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
