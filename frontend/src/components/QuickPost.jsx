import React, { useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./QuickPost.css";

/**
 * Publicación rápida — el bomberazo.
 *
 * El pipeline existe porque casi todo se trabaja con anticipación. Esto es el
 * otro caso: algo tiene que salir ahora, o esta tarde, y recorrer calendario →
 * arte → aprobación → programar son demasiados pasos para eso.
 *
 * Sigue creando la entrada del calendario por detrás: saltársela le costaría al
 * post su lugar en el calendario, su historial con el cliente y sus métricas.
 */

const FORMATS = [
  { value: "post", label: "Post" },
  { value: "reel", label: "Reel" },
  { value: "story", label: "Historia" },
];

const localNow = (plusMinutes = 30) => {
  const d = new Date(Date.now() + plusMinutes * 60000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function QuickPost({ customers = [], onClose, onDone }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [customerId, setCustomerId] = useState("");
  const [format, setFormat] = useState("post");
  const [platform, setPlatform] = useState("instagram");
  const [message, setMessage] = useState("");
  const [when, setWhen] = useState("schedule");
  const [at, setAt] = useState(localNow());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(null);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  const isStory = format === "story";
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const isVideo = file ? /^video\//.test(file.type) : false;

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setMissing(null);
    if (!customerId) return setError("Elige un cliente.");
    if (!file) return setError("Sube el arte o el video.");
    if (!isStory && !message.trim()) return setError("Escribe el copy.");

    const body = new FormData();
    body.append("file", file);
    body.append("customer_id", customerId);
    body.append("platform", platform);
    body.append("content_type", format);
    body.append("message", message);
    body.append("when", when);
    if (when === "schedule") body.append("scheduled_for", new Date(at).toISOString());

    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/quick-post`, body, { headers });
      onDone?.(data, when === "now");
      onClose?.();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.message || "No se pudo crear la publicación.");
      if (Array.isArray(d?.missing)) setMissing(d.missing);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="zxq-scrim" onClick={onClose} aria-label="Cerrar" />
      <aside className="zxq" role="dialog" aria-label="Publicación rápida">
        <form onSubmit={submit}>
          <div className="zxq-head">
            <div>
              <div className="zxq-eyebrow">Sin pasar por el pipeline</div>
              <h2 className="zxq-h2">Publicación <span className="zxq-serif">rápida</span></h2>
            </div>
            <button type="button" className="zxq-x" onClick={onClose} aria-label="Cerrar">×</button>
          </div>

          <div className="zxq-body">
            <label className="zxq-field">
              <span>Cliente</span>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Elige un cliente…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.commercial_name || c.business_name || c.name}</option>
                ))}
              </select>
            </label>

            <div className="zxq-row">
              <label className="zxq-field">
                <span>Red</span>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                </select>
              </label>
              <label className="zxq-field">
                <span>Formato</span>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </label>
            </div>

            <div className="zxq-field">
              <span>Arte</span>
              <button type="button" className={`zxq-drop ${file ? "has" : ""}`} onClick={() => fileRef.current?.click()}>
                {preview
                  ? (isVideo
                      ? <video src={preview} className="zxq-prev" muted />
                      : <img src={preview} alt="" className="zxq-prev" />)
                  : <span className="zxq-drop-hint">Elegir imagen o video<br /><em>JPG, PNG, MP4 o MOV</em></span>}
              </button>
              <input ref={fileRef} type="file" hidden accept="image/*,video/mp4,video/quicktime"
                     onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <div className="zxq-filename">{file.name}</div>}
            </div>

            {!isStory && (
              <label className="zxq-field">
                <span>Copy</span>
                <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
                          placeholder="Lo que va debajo de la publicación…" />
              </label>
            )}
            {isStory && <p className="zxq-note">Una historia no lleva copy: Instagram no lo muestra.</p>}

            <div className="zxq-field">
              <span>Cuándo</span>
              <div className="zxq-when">
                <button type="button" className={when === "schedule" ? "on" : ""} onClick={() => setWhen("schedule")}>
                  Programar
                </button>
                <button type="button" className={when === "now" ? "on" : ""} onClick={() => setWhen("now")}>
                  Publicar ahora
                </button>
              </div>
              {when === "schedule" && (
                <input className="zxq-datetime" type="datetime-local" value={at}
                       min={localNow(0)} onChange={(e) => setAt(e.target.value)} />
              )}
            </div>

            {error && (
              <div className="zxq-error">
                {error}
                {missing && <ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul>}
              </div>
            )}
          </div>

          <div className="zxq-foot">
            <button type="button" className="zxq-btn" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="submit" className="zxq-btn solid" disabled={busy}>
              {busy
                ? (when === "now" ? "Publicando…" : "Programando…")
                : (when === "now" ? "Publicar ahora" : "Programar")}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
