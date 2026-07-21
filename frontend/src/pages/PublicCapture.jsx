import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./PublicCapture.css";

const PublicCapture = () => {
  const { token } = useParams();
  const [biz, setBiz] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", service_interest: "", message: "", website: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/public/leads/${token}/info`)
      .then((r) => setBiz(r.data?.name || ""))
      .catch(() => setInvalid(true));
  }, [token]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name && !form.phone) { setError("Ingresa tu nombre o teléfono."); return; }
    setSending(true);
    try {
      await axios.post(`${API_BASE_URL}/public/leads/${token}`, form);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo enviar. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  if (invalid) {
    return (
      <div className="zxpc">
        <div className="zxpc-card">
          <div className="zxpc-brand">ZIONX</div>
          <h1>Enlace no válido</h1>
          <p className="zxpc-sub">Este enlace de contacto no está disponible.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="zxpc">
      <div className="zxpc-card">
        <div className="zxpc-brand">{biz || "Contacto"}</div>
        {done ? (
          <>
            <h1>¡Gracias! <span className="zxpc-serif">Te contactamos pronto.</span></h1>
            <p className="zxpc-sub">Recibimos tus datos. Un asesor se comunicará contigo en breve.</p>
          </>
        ) : (
          <>
            <h1>Déjanos tus <span className="zxpc-serif">datos.</span></h1>
            <p className="zxpc-sub">Completa el formulario y te contactamos.</p>
            <form className="zxpc-form" onSubmit={submit}>
              {/* Honeypot — hidden from people, filled by bots */}
              <input className="zxpc-hp" tabIndex={-1} autoComplete="off" value={form.website}
                onChange={(e) => set("website", e.target.value)} aria-hidden="true" />
              <label className="zxpc-label">Nombre
                <input className="zxpc-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Tu nombre" />
              </label>
              <label className="zxpc-label">Teléfono / WhatsApp
                <input className="zxpc-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="10 dígitos" inputMode="tel" />
              </label>
              <label className="zxpc-label">Correo (opcional)
                <input className="zxpc-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="tu@correo.com" />
              </label>
              <label className="zxpc-label">Ciudad / Zona (opcional)
                <input className="zxpc-input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Ej. Xalapa" />
              </label>
              <label className="zxpc-label">¿Qué te interesa? (opcional)
                <input className="zxpc-input" value={form.service_interest} onChange={(e) => set("service_interest", e.target.value)} placeholder="Ej. Internet 200 Mbps" />
              </label>
              <label className="zxpc-label">Mensaje (opcional)
                <textarea className="zxpc-input" rows={3} value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="Cuéntanos qué necesitas" />
              </label>
              {error && <div className="zxpc-error">{error}</div>}
              <button className="zxpc-btn" type="submit" disabled={sending}>{sending ? "Enviando…" : "Enviar"}</button>
            </form>
          </>
        )}
        <div className="zxpc-foot">Con tecnología de <b>ZIONX</b></div>
      </div>
    </div>
  );
};

export default PublicCapture;
