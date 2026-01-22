import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
const API_BASE_URL = "http://localhost:5001";

const CollectionsDashboard = () => {
  const [loans, setLoans] = useState([]);
  const [notes, setNotes] = useState({});
  const [noteHistory, setNoteHistory] = useState({});
  const [avalsMap, setAvalsMap] = useState({});
  const [refsMap, setRefsMap] = useState({});
  const [token] = useState(localStorage.getItem("token"));
  const fetchNotes = async (loan_id) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/collections/${loan_id}/notes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNoteHistory((prev) => ({ ...prev, [loan_id]: res.data }));
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/dashboard/collections`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLoans(res.data);
        const loadAuxData = async () => {
          const avalMap = {};
          const refMap = {};
          for (const loan of res.data) {
            try {
              const avals = await axios.get(`${API_BASE_URL}/customers/${loan.customer_id}/avals`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              avalMap[loan.loan_id] = avals.data;
            } catch (e) {}
            try {
              const refs = await axios.get(`${API_BASE_URL}/customers/${loan.customer_id}/references`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              refMap[loan.loan_id] = refs.data;
            } catch (e) {}
          }
          setAvalsMap(avalMap);
          setRefsMap(refMap);
        };
        loadAuxData();
      } catch (err) {
        console.error("Error fetching collections:", err);
      }
    };
    fetchData();
  }, [token]);

  const handleAddNote = async (loan_id) => {
    if (!notes[loan_id]) return;
    try {
      await axios.post(`${API_BASE_URL}/collections/${loan_id}/notes`, {
        note: notes[loan_id]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Nota guardada");
      setNotes({ ...notes, [loan_id]: "" });
    } catch (err) {
      console.error("Error saving note:", err);
    }
  };

  return (
    <Layout>
      <div className="text-neutral-800 px-6 py-4">
        <h1 className="text-xl font-bold mb-4">Dashboard de Cobranza</h1>
        <table className="w-full table-auto text-sm">
          <thead className="bg-primary-500 text-neutral-800">
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Sucursal</th>
              <th>Vencido</th>
              <th>Desde</th>
              <th>WhatsApp</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {loans.map(loan => (
              <tr key={loan.loan_id} className="border-t border-neutral-200">
                <td>{loan.first_name} {loan.last_name}</td>
                <td>{loan.phone}</td>
                <td>{loan.store}</td>
                <td>${parseFloat(loan.total_due || 0).toFixed(2)}</td>
                <td>
                  {(() => {
                    const daysOverdue = Math.floor((Date.now() - new Date(loan.earliest_due_date).getTime()) / (1000 * 60 * 60 * 24));
                    const color = daysOverdue >= 7 ? "text-red-500" : "text-yellow-400";
                    return <span className={color}>{daysOverdue} días</span>;
                  })()}
                </td>
                <td className="align-top">
                  <div className="flex flex-col space-y-1">
                    <a
                      href={`https://wa.me/52${loan.phone}?text=${encodeURIComponent("Hola, te recordamos que tienes un pago pendiente con CrediYa. ¿Podemos ayudarte a resolverlo?")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 underline font-semibold"
                    >
                      Cliente
                    </a>

                    {(avalsMap[loan.loan_id] || []).length > 0 && (
                      <div className="mt-1 text-xs text-cyan-400">
                        <p className="font-bold text-neutral-800">Aval(es):</p>
                        {(avalsMap[loan.loan_id] || []).map((aval, i) => (
                          <div key={i} className="mb-1 pl-2 border-l border-cyan-600">
                            <p className="text-cyan-300 font-medium">{aval.name}</p>
                            <a
                              href={`https://wa.me/52${aval.phone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              {aval.phone}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}

                    {(refsMap[loan.loan_id] || []).length > 0 && (
                      <div className="mt-1 text-xs text-yellow-400">
                        <p className="font-bold text-neutral-800">Referencia(s):</p>
                        {(refsMap[loan.loan_id] || []).map((ref, i) => (
                          <div key={i} className="mb-1 pl-2 border-l border-yellow-500">
                            <p className="text-yellow-300 font-medium">{ref.name}</p>
                            <a
                              href={`https://wa.me/52${ref.phone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              {ref.phone}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex flex-col space-y-1">
                    <input
                      type="text"
                      placeholder="Agregar nota"
                      className="bg-gradient-to-br from-surface-50 to-surface-100 text-neutral-800 border border-neutral-300 rounded px-2 py-1 text-xs"
                      value={notes[loan.loan_id] || ""}
                      onChange={(e) =>
                        setNotes({ ...notes, [loan.loan_id]: e.target.value })
                      }
                    />
                    <button
                      onClick={() => handleAddNote(loan.loan_id)}
                      className="bg-blue-600 text-xs text-neutral-800 px-2 py-1 rounded hover:bg-blue-700"
                    >
                      Guardar
                    </button>
                    <div className="text-neutral-600 text-xs mt-1">
                      <button
                        className="underline"
                        onClick={() => fetchNotes(loan.loan_id)}
                      >
                        Historial de notas...
                      </button>
                      <ul className="mt-1 space-y-1">
                        {(noteHistory[loan.loan_id] || []).map((n, i) => (
                          <li key={i} className="text-gray-500">
                            • {n.note} — {new Date(n.created_at).toLocaleDateString()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
};

export default CollectionsDashboard;