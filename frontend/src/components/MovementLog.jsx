import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const MovementLog = ({ loanId }) => {
  const [movements, setMovements] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/loans/${loanId}/financial-movements`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMovements(res.data);
      } catch (err) {
        console.error("Error fetching movement log:", err);
      }
    };

    fetchMovements();
  }, [loanId]);

  if (!movements.length) return <p className="text-sm text-gray-500 italic">No hay movimientos registrados para este préstamo.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-neutral-800 border border-primary-500">
        <thead>
          <tr className="bg-gradient-to-br from-surface-50 to-surface-100 text-primary-600">
            <th className="px-3 py-2 text-left">Fecha</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Cliente / Cuenta</th>
            <th className="px-3 py-2 text-left">Descripción</th>
            <th className="px-3 py-2 text-left">Semana</th>
            <th className="px-3 py-2 text-right">Capital</th>
            <th className="px-3 py-2 text-right">Interés</th>
            <th className="px-3 py-2 text-right">Penalidad</th>
            <th className="px-3 py-2 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m, idx) => (
            <tr key={idx} className="border-t border-primary-500">
              <td className="px-3 py-1">{m.date ? new Date(m.date).toLocaleDateString() : "-"}</td>
              <td className="px-3 py-1">
                {{
                  "payment-capital": "Pago Capital",
                  "payment-interest": "Pago Interés",
                  "payment-penalty": "Pago Penalidad",
                  "penalty": "Penalidad",
                  "payment": "Pago"
                }[m.type] || m.type}
              </td>
              <td className="px-3 py-1">{m.customer || "-"}</td>
              <td className="px-3 py-1">{m.description}</td>
              <td className="px-3 py-1">{m.week ? `Semana ${m.week}` : "-"}</td>
              <td className="px-3 py-1 text-right">
                {m.type === "payment-capital" && m.amount ? `$${parseFloat(m.amount).toFixed(2)}` : "-"}
              </td>
              <td className="px-3 py-1 text-right">
                {m.type === "payment-interest" && m.amount ? `$${parseFloat(m.amount).toFixed(2)}` : "-"}
              </td>
              <td className="px-3 py-1 text-right">
                {(m.type === "penalty" || m.type === "payment-penalty") && m.amount ? `$${parseFloat(m.amount).toFixed(2)}` : "-"}
              </td>
              <td className="px-3 py-1 text-right">
                {m.balance !== undefined && m.balance !== null ? `$${parseFloat(m.balance).toFixed(2)}` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MovementLog;