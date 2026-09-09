import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./PublicAcuerdo.css";

/**
 * El acuerdo de servicio, del lado del cliente.
 *
 * Quien firma no tiene cuenta en ZIONX: el token de la liga es la credencial.
 * Y es de las pocas pantallas que ve un cliente, así que lleva la marca —una
 * página genérica pidiendo una firma se parece demasiado a las que enseñan a
 * desconfiar.
 *
 * La firma no es un checkbox: se escribe el nombre. Un nombre tecleado es un
 * acto deliberado y deja constancia de quién aceptó; una casilla marcada no
 * dice quién la marcó.
 */
export default function PublicAcuerdo() {
  const { token } = useParams();
  const [st, setSt] = useState({ loading: true, data: null, error: null });
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [firmando, setFirmando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useMemo(() => () => {
    axios.get(`${API_BASE_URL}/api/acuerdos/publico/${token}`)
      .then((r) => setSt({ loading: false, data: r.data, error: null }))
      .catch((e) => setSt({
        loading: false, data: null,
        error: e.response?.data?.error || "No pudimos abrir este acuerdo.",
      }));
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const firmar = async (e) => {
    e.preventDefault();
    setError(null);
    if (nombre.trim().length < 3) return setError("Escribe tu nombre completo.");
    setFirmando(true);
    try {
      await axios.post(`${API_BASE_URL}/api/acuerdos/publico/${token}/firmar`, { nombre, email });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar la firma.");
    } finally {
      setFirmando(false);
    }
  };

  if (st.loading) return <div className="zxac"><div className="zxac-msg">Abriendo el acuerdo…</div></div>;
  if (st.error) {
    return (
      <div className="zxac">
        <div className="zxac-hoja">
          <div className="zxac-marca">ZIONX</div>
          <div className="zxac-msg error">{st.error}</div>
          <p className="zxac-pie">Si crees que es un error, escríbele a quien lleva tu cuenta.</p>
        </div>
      </div>
    );
  }

  const d = st.data;
  const parrafos = String(d.body || "").split("\n");

  return (
    <div className="zxac">
      <div className="zxac-hoja">
        <div className="zxac-cab">
          <div className="zxac-marca">ZIONX</div>
          <div className="zxac-eyebrow">Acuerdo de servicio</div>
        </div>

        <div className="zxac-cuerpo">
          {parrafos.map((p, i) => (
            p.trim() === "" ? <div className="zxac-sep" key={i} /> : <p key={i}>{p}</p>
          ))}
        </div>

        {d.firmado ? (
          <div className="zxac-firmado">
            <div className="lead">Firmado</div>
            <p>
              Aceptado por <b>{d.firmadoPor}</b>
              {d.firmadoEl && <> el {new Date(d.firmadoEl).toLocaleDateString("es-MX", {
                day: "2-digit", month: "long", year: "numeric",
              })}</>}.
            </p>
            <p className="zxac-pie">Guarda esta página como comprobante. Las condiciones quedan registradas tal como las aceptaste.</p>
          </div>
        ) : (
          <form className="zxac-firma" onSubmit={firmar}>
            <div className="zxac-firma-lead">Para aceptar, escribe tu nombre completo.</div>
            <label>
              <span>Nombre y apellido</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                     placeholder="Como aparece en el contrato" autoComplete="name" />
            </label>
            <label>
              <span>Correo <em>(opcional)</em></span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="para enviarte una copia" autoComplete="email" />
            </label>
            {error && <div className="zxac-error">{error}</div>}
            <button type="submit" disabled={firmando}>
              {firmando ? "Registrando…" : "Acepto estos términos"}
            </button>
            <p className="zxac-pie">
              Queda registro de tu nombre, la fecha y el equipo desde el que firmas.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
