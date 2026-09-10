import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./CanvaArte.css";

/**
 * Traer el arte desde Canva.
 *
 * Hoy alguien baja un PNG de Canva y lo vuelve a subir aquí; en ese paso es
 * donde se cuela la versión que no era. Pegando la liga del diseño, ZIONX
 * exporta la versión actual y la guarda.
 *
 * Se recuerda el diseño, no sólo el archivo: por eso hay «Actualizar», que
 * vuelve a exportar lo que esté en Canva ahora mismo.
 */
export default function CanvaArte({ postId, designId, syncedAt, onArte }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const [st, setSt] = useState(null);
  const [liga, setLiga] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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

  const traer = async (ruta, cuerpo) => {
    setBusy(true); setError(null);
    try {
      const { data } = await axios.post(`${API_BASE_URL}${ruta}`, cuerpo, { headers });
      onArte?.(data);
      setLiga("");
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo traer el arte.");
      if (e.response?.data?.necesitaConectar) cargar();
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
        </>
      ) : (
        <form className="zxcv2-form" onSubmit={(e) => {
          e.preventDefault();
          if (!liga.trim()) return;
          traer(`/content-calendar/${postId}/canva`, { url: liga.trim() });
        }}>
          <input value={liga} onChange={(e) => setLiga(e.target.value)}
                 placeholder="Pega la liga del diseño de Canva" />
          <button className="zxcv2-btn" type="submit" disabled={busy || !liga.trim()}>
            {busy ? "Trayendo…" : "Traer arte"}
          </button>
        </form>
      )}
      {error && <div className="zxcv2-error">{error}</div>}
    </div>
  );
}
