import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const ReclassifyPayment = () => {
  const [payments, setPayments] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [breakdowns, setBreakdowns] = useState([]);
  const [note, setNote] = useState("");
  const [installments, setInstallments] = useState([]);

  const token = localStorage.getItem("token");

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/admin/payments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPayments(res.data);
      } catch (err) {
        console.error("Error loading payments:", err);
      }
    };
    loadPayments();
  }, []);

  const fetchBreakdown = async (paymentId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/payments/${paymentId}/breakdown`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBreakdowns(res.data);

      const loanRes = await axios.get(`${API_BASE_URL}/admin/payments/${paymentId}/loan-id`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const loanId = loanRes.data.loan_id;
      const loanDetail = await axios.get(`${API_BASE_URL}/loans/${loanId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInstallments(loanDetail.data.installments || []);
    } catch (err) {
      console.error("Error loading breakdown:", err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPayment) {
      console.warn("⚠️ No payment selected. Cannot submit.");
      return;
    }
    console.log("🔄 Reclassify payload", {
      new_date: newDate,
      breakdowns,
      note,
      payment_id: selectedPayment?.id
    });
    try {
      await axios.post(`${API_BASE_URL}/admin/payments/${selectedPayment.id}/reclassify`, {
        new_date: newDate,
        breakdowns,
        note
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Pago reclasificado correctamente");
      setSelectedPayment(null);
      setNewDate("");
      setBreakdowns([]);
      setNote("");
    } catch (err) {
      console.error("Error reclassifying payment:", err);
      alert("Error reclassifying payment");
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold text-neutral-800 mb-6">🧾 Reclasificar Pago</h2>

        <div className="bg-white border border-primary-500 rounded-lg p-4 mb-6">
          <h4 className="text-primary-600 font-semibold mb-2">📋 Pagos recientes</h4>
          <table className="min-w-full text-sm text-neutral-800 border border-primary-500">
            <thead>
              <tr className="bg-gradient-to-br from-surface-50 to-surface-100 text-primary-600">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-left">Monto</th>
                <th className="p-2 text-left">Acción</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-t border-primary-500">
                  <td className="p-2">{p.id}</td>
                  <td className="p-2">{p.customer_name || "N/A"}</td>
                  <td className="p-2">{new Date(p.payment_date).toLocaleDateString()}</td>
                  <td className="p-2">${parseFloat(p.amount).toLocaleString()}</td>
                  <td className="p-2">
                    <button
                      onClick={() => {
                        setSelectedPayment(p);
                        setNewDate(p.payment_date?.slice(0, 10) || "");
                        fetchBreakdown(p.id);
                      }}
                      className="text-primary-600 hover:underline"
                    >
                      Reclasificar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedPayment && (
          <div className="bg-white border border-yellow-400 rounded-lg p-4">
            <h4 className="text-yellow-300 font-bold mb-3">✍️ Editar pago #{selectedPayment.id}</h4>

            <label className="block text-sm mb-1 text-neutral-800">Nueva fecha</label>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="mb-4 p-2 rounded bg-white border border-gray-500 text-neutral-800 w-full"
            />

            <label className="block text-sm mb-1 text-neutral-800">Notas / Justificación</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              className="mb-4 p-2 rounded bg-white border border-gray-500 text-neutral-800 w-full"
              rows={2}
            />

            <h5 className="text-neutral-800 font-semibold mt-6 mb-2">💡 Desglose Actual / Editable</h5>
            <table className="min-w-full text-sm text-neutral-800 border border-primary-500 mb-4">
              <thead>
                <tr className="bg-gradient-to-br from-surface-50 to-surface-100 text-primary-600">
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Semana</th>
                  <th className="p-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {breakdowns.map((b, i) => (
                  <tr key={i} className="border-t border-primary-500">
                    <td className="p-2">
                      <select
                        value={b.type}
                        onChange={e => {
                          const updated = [...breakdowns];
                          updated[i].type = e.target.value;
                          setBreakdowns(updated);
                        }}
                        className="bg-white border border-gray-500 text-neutral-800 rounded px-2 py-1"
                      >
                        <option value="capital">Capital</option>
                        <option value="interest">Interés</option>
                        <option value="penalty">Penalidad</option>
                        <option value="advance">Adelanto</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        value={b.installment_id}
                        onChange={e => {
                          const updated = [...breakdowns];
                          updated[i].installment_id = parseInt(e.target.value);
                          setBreakdowns(updated);
                        }}
                        className="bg-white border border-gray-500 text-neutral-800 rounded px-2 py-1 w-full"
                      >
                        <option value="">Seleccionar semana</option>
                        {installments.map(inst => (
                          <option key={inst.id} value={inst.id}>
                            Semana {inst.week_number} – {new Date(inst.due_date).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        value={b.amount}
                        step="0.01"
                        onChange={e => {
                          const updated = [...breakdowns];
                          updated[i].amount = parseFloat(e.target.value);
                          setBreakdowns(updated);
                        }}
                        className="bg-white border border-gray-500 text-neutral-800 rounded px-2 py-1 text-right w-full"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={() => {
                console.log("✅ Button was clicked");
                handleSubmit();
              }}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded font-bold text-neutral-800"
            >
              Confirmar Reclasificación
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ReclassifyPayment;