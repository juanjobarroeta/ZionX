import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./CanvaArte.css";

/**
 * Traer el arte desde Canva.
 *
 * Hoy alguien baja un PNG de Canva y lo vuelve a subir aquí; en ese paso es
 * donde se cuela la versión que no era. Eligiendo el diseño, ZIONX exporta la
 * versión actual y la guarda.
 *
 * Se recuerda el diseño, no sólo el archivo: por eso hay «Actualizar», que
 * vuelve a exportar lo que esté en Canva ahora mismo.
 *
 * Se puede elegir viendo las miniaturas o pegando la liga. Lo primero es lo
 * normal; lo segundo sirve cuando alguien te pasó un diseño por mensaje.
 */
export default function CanvaArte({ postId, designId, syncedAt, onArte }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const [st, setSt] = useState(null);
  const [liga, setLiga] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // El explorador de diseños.
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [lista, setLista] = useState({ items: [], cursor: null });
  const [cargando, setCargando] = useState(false);
  const [trayendo, setTrayendo] = useState(null); // id del diseño en curso

  const cargar = useCallback(() => {
    axios.get(`${API_BASE_URL}/api/canva/estado`, { headers })
      .then((r) => setSt(r.data))
      .catch(() => setSt({ configurado: false, conectado: false }));
  }, [headers]);

  useEffect(() => { cargar(); }, [cargar]);

  const conectar = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/canva/conectar`, {}, { headers });
      // Canva pide el consentimiento en su dominio; se vuelve por el callback.
      window.location.href = data.url;
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo iniciar la conexión.");
      setBusy(false);
    }
  };

  /** Pide una página de diseños. Sin cursor reemplaza; con cursor agrega. */
  const pedirDisenos = useCallback(async (termino, cursor) => {
    setCargando(true); setError(null);
    try {
      const p = new URLSearchParams();
      if (termino) p.set("q", termino);
      if (cursor) p.set("cursor", cursor);
      const { data } = await axios.get(`${API_BASE_URL}/api/canva/disenos?${p}`, { headers });
      setLista((prev) => ({
        items: cursor ? [...prev.items, ...(data.items || [])] : (data.items || []),
        cursor: data.cursor || null,
      }));
    } catch (e) {
      setError(e.response?.data?.error || "No se pudieron leer tus diseños.");
      if (e.response?.data?.necesitaConectar) cargar();
    } finally {
      setCargando(false);
    }
  }, [headers, cargar]);

  // Al abrir se carga lo último modificado; al buscar se espera a que dejes de
  // escribir, porque cada tecla sería una llamada a Canva.
  useEffect(() => {
    if (!abierto) return undefined;
    const t = setTimeout(() => pedirDisenos(q.trim(), null), q.trim() ? 350 : 0);
    return () => clearTimeout(t);
  }, [abierto, q, pedirDisenos]);

  const traer = async (ruta, cuerpo, marca) => {
    setBusy(true); setTrayendo(marca || null); setError(null);
    try {
      const { data } = await axios.post(`${API_BASE_URL}${ruta}`, cuerpo, { headers });
      onArte?.(data);
      setLiga("");
      setAbierto(false);
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo traer el arte.");
      if (e.response?.data?.necesitaConectar) cargar();
    } finally { setBusy(false); setTrayendo(null); }
  };

  /** Soltar el arte y el diseño. El archivo se queda en el volumen. */
  const quitar = async () => {
    if (!window.confirm("¿Quitar el arte de esta publicación?")) return;
    setBusy(true); setError(null);
    try {
      const { data } = await axios.delete(`${API_BASE_URL}/content/${postId}/arte`, { headers });
      onArte?.(data);
      setAbierto(false);
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo quitar el arte.");
    } finally { setBusy(false); }
  };

  if (!st?.configurado) return null;

  if (!st.conectado) {
    return (
      <div className="zxcv2">
        <span className="q">Conecta tu Canva para traer el arte sin bajarlo y volverlo a subir.</span>
        <button className="zxcv2-btn" onClick={conectar} disabled={busy}>
          {busy ? "Abriendo…" : "Conectar Canva"}
        </button>
      </div>
    );
  }

  return (
    <div className="zxcv2">
      {designId ? (
        <>
          <span className="q">
            Viene de Canva
            {syncedAt && <em>actualizado {new Date(syncedAt).toLocaleString("es-MX", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</em>}
          </span>
          <button className="zxcv2-btn" disabled={busy}
                  onClick={() => traer(`/content-calendar/${postId}/canva/actualizar`, {})}>
            {busy ? "Trayendo…" : "Actualizar desde Canva"}
          </button>
          <button className="zxcv2-link" type="button" disabled={busy}
                  onClick={() => setAbierto((v) => !v)}>
            {abierto ? "Cerrar" : "Cambiar de diseño"}
          </button>
          <button className="zxcv2-link quitar" type="button" disabled={busy} onClick={quitar}>
            Quitar arte
          </button>
        </>
      ) : (
        <>
          <span className="q">Trae el arte desde tu Canva.</span>
          <button className="zxcv2-btn" type="button" disabled={busy}
                  onClick={() => setAbierto((v) => !v)}>
            {abierto ? "Cerrar" : "Ver mis diseños"}
          </button>
        </>
      )}

      {abierto && (
        <div className="zxcv2-explorador">
          <input
            className="zxcv2-buscar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre…"
          />

          {cargando && lista.items.length === 0 && <div className="zxcv2-nota">Leyendo tus diseños…</div>}

          {!cargando && lista.items.length === 0 && (
            <div className="zxcv2-nota">
              {q.trim() ? `Ningún diseño se llama «${q.trim()}».` : "No hay diseños en esta cuenta."}
            </div>
          )}

          {lista.items.length > 0 && (
            <div className="zxcv2-rejilla">
              {lista.items.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`zxcv2-tarjeta${trayendo === d.id ? " activa" : ""}`}
                  disabled={busy}
                  title={d.titulo}
                  onClick={() => traer(`/content-calendar/${postId}/canva`, { url: d.id }, d.id)}
                >
                  <span className="zxcv2-mini">
                    {d.thumbnail
                      ? <img src={d.thumbnail} alt="" loading="lazy" />
                      : <span className="zxcv2-sinmini">sin vista</span>}
                    {trayendo === d.id && <span className="zxcv2-trayendo">Trayendo…</span>}
                  </span>
                  <span className="zxcv2-titulo">{d.titulo}</span>
                </button>
              ))}
            </div>
          )}

          {lista.cursor && (
            <button className="zxcv2-link" type="button" disabled={cargando || busy}
                    onClick={() => pedirDisenos(q.trim(), lista.cursor)}>
              {cargando ? "Cargando…" : "Ver más"}
            </button>
          )}

          {/* Para el diseño que te pasaron por mensaje y no está en tu cuenta. */}
          <form className="zxcv2-form" onSubmit={(e) => {
            e.preventDefault();
            if (!liga.trim()) return;
            traer(`/content-calendar/${postId}/canva`, { url: liga.trim() });
          }}>
            <input value={liga} onChange={(e) => setLiga(e.target.value)}
                   placeholder="…o pega la liga de un diseño" />
            <button className="zxcv2-btn" type="submit" disabled={busy || !liga.trim()}>
              {busy && !trayendo ? "Trayendo…" : "Traer"}
            </button>
          </form>
        </div>
      )}

      {error && <div className="zxcv2-error">{error}</div>}
    </div>
  );
}
