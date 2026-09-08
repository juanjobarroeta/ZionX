import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { construirPdfCfdi } from "../utils/cfdiPdf";
import "./CfdiVisor.css";

/**
 * El comprobante, sobre la pantalla.
 *
 * El SAT sólo distribuye el XML — el PDF lo genera quien emite y no viaja en la
 * descarga masiva. Así que aquí se arma uno con lo que el XML sí trae, y se
 * enseña tal cual va a quedar. Junto a él baja el XML, que es el comprobante de
 * verdad; el PDF es sólo la manera de leerlo.
 */
export default function CfdiVisor({ invoiceId, uuid, onCerrar }) {
  const [rep, setRep] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCerrar?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  useEffect(() => {
    let vivo = true;
    setRep(null); setPdfUrl(null); setError(null);
    axios.get(`${API_BASE_URL}/api/finance/cfdi/${invoiceId}/representacion`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((r) => { if (vivo) setRep(r.data); })
      .catch((e) => { if (vivo) setError(e.response?.data?.error || "No se pudo leer el comprobante."); });
    return () => { vivo = false; };
  }, [invoiceId]);

  useEffect(() => {
    let vivo = true;
    let creada = null;
    if (rep?.representacion) {
      construirPdfCfdi(rep, { uuid })
        .then((blob) => {
          if (!vivo) return;
          creada = URL.createObjectURL(blob);
          setPdfUrl(creada);
        })
        .catch(() => { if (vivo) setError("No se pudo armar la representación impresa."); });
    }
    return () => { vivo = false; if (creada) URL.revokeObjectURL(creada); };
  }, [rep, uuid]);

  // El XML va por el proxy porque el hub lo entrega con el Bearer de ZionX; un
  // <a href> sin cabeceras recibiría un 401.
  const bajarXml = async () => {
    setBajando(true);
    try {
      const r = await axios.get(`${API_BASE_URL}/api/finance/cfdi/${invoiceId}/xml`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([r.data], { type: "application/xml" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${uuid || invoiceId}.xml`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.response?.status === 404 ? "Este CFDI no tiene XML guardado." : "No se pudo bajar el XML.");
    } finally {
      setBajando(false);
    }
  };

  return (
    <>
      <button className="zxcv-scrim" onClick={onCerrar} aria-label="Cerrar" />
      <div className="zxcv" role="dialog" aria-label="Comprobante fiscal">
        <div className="zxcv-head">
          <div>
            <div className="zxcv-eyebrow">Comprobante fiscal</div>
            <div className="zxcv-uuid">{uuid || invoiceId}</div>
          </div>
          <div className="zxcv-acts">
            <button className="zxcv-btn" onClick={bajarXml} disabled={bajando}>
              {bajando ? "Bajando…" : "Descargar XML"}
            </button>
            {pdfUrl && (
              <a className="zxcv-btn" href={pdfUrl} download={`${uuid || invoiceId}.pdf`}>Descargar PDF</a>
            )}
            <button className="zxcv-x" onClick={onCerrar} aria-label="Cerrar">×</button>
          </div>
        </div>

        <div className="zxcv-body">
          {error ? <div className="zxcv-error">{error}</div>
            : pdfUrl ? <iframe title="Representación impresa del CFDI" src={pdfUrl} />
            : <div className="zxcv-loading">Armando la representación…</div>}
        </div>
      </div>
    </>
  );
}
