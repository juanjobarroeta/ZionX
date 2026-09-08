import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import CfdiVisor from "./CfdiVisor";
import "./CuentaDocumentos.css";

/**
 * Los documentos que forman un renglón.
 *
 * Cada asiento con su CFDI: folio fiscal, contraparte, importe. Los asientos
 * sin comprobante —banco, depreciación, ajustes manuales— también salen, con su
 * descripción y sin liga: esconderlos haría que la suma de los documentos no
 * cuadre contra el renglón que se abrió, que es justo lo que alguien va a
 * verificar.
 */

const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
const dia = (d) => (d ? new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—");

export default function CuentaDocumentos({ cuenta, year, month, ytd = false }) {
  const [st, setSt] = useState({ loading: true, data: null, error: null });
  const [abierto, setAbierto] = useState(null);

  useEffect(() => {
    let vivo = true;
    setSt({ loading: true, data: null, error: null });
    axios.get(`${API_BASE_URL}/api/finance/cuenta-documentos`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      params: { cuenta, year, month, ytd: ytd ? 1 : undefined },
    })
      .then((r) => { if (vivo) setSt({ loading: false, data: r.data, error: r.data?.error || null }); })
      .catch((e) => { if (vivo) setSt({ loading: false, data: null, error: e.response?.data?.error || "No se pudo abrir el desglose." }); });
    return () => { vivo = false; };
  }, [cuenta, year, month, ytd]);

  const d = st.data;
  const docs = d?.documentos || [];
  const faltan = d && d.total > d.mostrados;

  return (
    <div className="zxcd">
      {st.loading ? <div className="zxcd-msg">Abriendo el desglose…</div>
        : st.error ? <div className="zxcd-msg error">{st.error}</div>
        : docs.length === 0 ? <div className="zxcd-msg">Sin movimientos en esta cuenta.</div>
        : (
          <>
            <div className="zxcd-head">
              <span>Fecha</span><span>Documento</span><span>Contraparte</span><span className="r">Importe</span><span />
            </div>

            {docs.map((doc) => {
              const f = doc.invoice;
              return (
                <div className="zxcd-row" key={doc.id}>
                  <span className="f">{dia(doc.fecha)}</span>
                  <span className="doc">
                    {f
                      ? <>
                          <b>{[f.serie, f.folio].filter(Boolean).join("-") || f.tipoSat || "CFDI"}</b>
                          <em>{f.uuid}</em>
                        </>
                      : <>
                          <b className="sinc">Sin comprobante</b>
                          <em>{doc.descripcion || doc.fuente || "Asiento contable"}</em>
                        </>}
                  </span>
                  <span className="c">
                    {f?.contraparteNombre || "—"}
                    {f?.contraparteRfc && <em>{f.contraparteRfc}</em>}
                  </span>
                  <span className={`r ${doc.monto >= 0 ? "pos" : "neg"}`}>{fmt(doc.monto)}</span>
                  <span className="a">
                    {f?.representable
                      ? <button className="zxcd-ver" onClick={() => setAbierto(f)}>Ver</button>
                      : f
                        ? <span className="zxcd-nover" title="Este CFDI no tiene XML guardado">sin XML</span>
                        : null}
                  </span>
                </div>
              );
            })}

            <div className="zxcd-pie">
              <span>
                {d.mostrados} de {d.total} movimiento{d.total === 1 ? "" : "s"}
                {faltan && " · sólo se muestran los primeros"}
              </span>
              <span className="neto">Neto {fmt(d.neto)}</span>
            </div>
          </>
        )}

      {abierto && (
        <CfdiVisor invoiceId={abierto.id} uuid={abierto.uuid} onCerrar={() => setAbierto(null)} />
      )}
    </div>
  );
}
