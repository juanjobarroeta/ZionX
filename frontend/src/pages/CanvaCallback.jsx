import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

/**
 * La vuelta desde Canva. El código llega en la URL y se canjea aquí; el
 * `code_verifier` nunca sale del servidor, que es el punto de PKCE.
 */
export default function CanvaCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [estado, setEstado] = useState("Conectando con Canva…");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    if (error) { setEstado(`Canva canceló la conexión: ${error}`); return; }
    if (!code) { setEstado("Canva no devolvió un código."); return; }

    axios.post(`${API_BASE_URL}/api/canva/callback`, { code, state },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(() => {
        setEstado("Listo. Ya puedes traer arte desde Canva.");
        setTimeout(() => navigate("/conexiones"), 1200);
      })
      .catch((e) => setEstado(e.response?.data?.error || "No se pudo completar la conexión."));
  }, [params, navigate]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#E8E8E5", color: "#04111A", fontFamily: "'Bricolage', Helvetica, Arial, sans-serif",
      padding: 24, textAlign: "center", fontSize: 15,
    }}>
      {estado}
    </div>
  );
}
