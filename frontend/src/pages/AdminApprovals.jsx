import { API_BASE_URL } from "../utils/constants";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";

const storeNames = {
  1: "Atlixco",
  2: "Cholula",
  3: "Chipilo"
};

const AdminApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [paidExpenses, setPaidExpenses] = useState([]);
  const [allPaidExpenses, setAllPaidExpenses] = useState([]); // keep all for filtering
  const [pendingLoans, setPendingLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : {};
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchExpenses = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/expenses?status=pending_approval`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setExpenses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    }
  };

  useEffect(() => {
    const fetchPaidExpenses = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/treasury/payment-orders/history`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        setPaidExpenses(res.data);
        setAllPaidExpenses(res.data);
      } catch (err) {
        console.error("Error fetching paid expenses:", err);
      }
    };
    fetchPaidExpenses();
  }, []);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/admin/inventory-requests`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const incoming = res.data.requests || res.data;
        setRequests(Array.isArray(incoming) ? incoming : []);
        console.log("📦 Inventory Requests:", Array.isArray(incoming) ? incoming : []);
      } catch (err) {
        console.error("Error fetching inventory requests:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchPendingLoans = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/pending-loan-approvals`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setPendingLoans(Array.isArray(res.data) ? res.data : []);
      console.log("💰 Pending Loan Approvals:", Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching pending loan approvals:", err);
    }
  };

  useEffect(() => {
    fetchPendingLoans();
  }, []);

  const handleAction = async (id, action, type = "inventory") => {
    if (type === "loan") {
      try {
        if (action === "approve") {
          await axios.put(`${API_BASE_URL}/loans/${id}/approve`, {}, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          alert("✅ Préstamo aprobado exitosamente");
        } else if (action === "deliver") {
          await axios.put(`${API_BASE_URL}/loans/${id}/deliver`, {}, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          alert("✅ Producto entregado y contabilidad actualizada");
        }
        
        // Refresh pending loans immediately
        await fetchPendingLoans();
      } catch (err) {
        console.error(`Error processing loan ${action}:`, err);
        alert(`❌ Error: ${err.response?.data?.message || err.message}`);
      }
      return;
    }

    if (type === "expense") {
      const endpoint = action === "approve" ? "approve" : "cancel";
      try {
        await axios.put(`${API_BASE_URL}/expenses/${id}/${endpoint}`, {}, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        await fetchExpenses();
      } catch (err) {
        console.error(`Error processing ${action}:`, err);
      }
      return;
    }

    const endpoints = {
      approve: "approve",
      pay: "pay",
      receive: "receive",
    };

    try {
      await axios.put(`${API_BASE_URL}/admin/inventory-requests/${id}/${endpoints[action]}`, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      // Refresh data
      const res = await axios.get(`${API_BASE_URL}/inventory-requests`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      {
        const incoming = res.data.requests || res.data;
        setRequests(Array.isArray(incoming) ? incoming : []);
      }
    } catch (err) {
      console.error(`Error processing ${action}:`, err);
    }
  };

  console.log("🧪 Rendering AdminApprovals with requests:", requests);
  console.log("🧑‍💼 Current user:", user);

  if (loading) return <p>Cargando solicitudes...</p>;

  return (
    <Layout>
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-neutral-800">Aprobaciones de Inventario</h2>
      {requests.length === 0 ? (
        <p className="text-neutral-600 text-sm">No hay solicitudes pendientes.</p>
      ) : (
        <div className="row">
          {requests.map((req) => (
            <div key={req.id} className="col-md-6 mb-4">
              <div className="bg-white border-t-4 border-lime-500 text-neutral-800 rounded-md p-4 shadow mb-6">
                <h5 className="text-lg font-semibold">{req.category}</h5>
                <p><strong>Monto:</strong> ${parseFloat(req.amount).toLocaleString()}</p>
                <p><strong>Notas:</strong> {req.notes || "N/A"}</p>
                <p><strong>Sucursal:</strong> {storeNames[req.store_id] || "N/A"}</p>
                <p><strong>Fecha de Solicitud:</strong> {req.created_at ? new Date(req.created_at).toLocaleDateString() : "N/A"}</p>
                <p><strong>Estado:</strong> {req.status}</p>
                {req.quote_path && (
                  <p>
                    <strong>Cotización: </strong>
                    <a
                      href={`${API_BASE_URL}/uploads/${req.quote_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 hover:underline"
                    >
                      Ver cotización
                    </a>
                  </p>
                )}
                {["pending_admin_approval", "awaiting_admin", "created"].includes(req.status) && (
                  <button
                    className="bg-primary-500 hover:bg-primary-600 text-neutral-800 font-semibold px-4 py-1 rounded text-sm me-2"
                    onClick={() => handleAction(req.id, "approve")}
                  >
                    Aprobar
                  </button>
                )}
                {req.status === "approved_by_admin" && (
                  <button className="bg-yellow-400 hover:bg-yellow-500 text-neutral-800 font-semibold px-4 py-1 rounded text-sm me-2" onClick={() => handleAction(req.id, "pay")}>
                    Marcar como Pagado
                  </button>
                )}
                {req.status === "paid_by_treasury" && (
                  <button className="bg-blue-500 hover:bg-blue-600 text-neutral-800 font-semibold px-4 py-1 rounded text-sm" onClick={() => handleAction(req.id, "receive")}>
                    Marcar como Recibido
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
      )}

      <h2 className="text-xl font-semibold mb-6 text-neutral-800 mt-5">Aprobaciones de Préstamos</h2>
      {pendingLoans.length === 0 ? (
        <p className="text-neutral-600 text-sm">No hay préstamos por aprobar.</p>
      ) : (
        <div className="row">
          {Array.isArray(pendingLoans) ? pendingLoans.map((loan) => (
            <div key={loan.loan_id} className="col-md-6 mb-4">
              <div className="bg-white border-t-4 border-lime-500 text-neutral-800 rounded-md p-4 shadow mb-6">
                <h5>Préstamo #{loan.loan_id}</h5>
                <p><strong>Cliente:</strong> {loan.first_name} {loan.last_name}</p>
                <p><strong>Teléfono:</strong> {loan.phone}</p>
                <p><strong>Email:</strong> {loan.email}</p>
                <p><strong>Monto:</strong> ${Number(loan.amount).toFixed(2)}</p>
                <p><strong>Plazo:</strong> {loan.term} semanas</p>
                <p><strong>Pago Semanal:</strong> ${Number(loan.weekly_payment).toFixed(2)}</p>
                <p><strong>Total a Pagar:</strong> ${Number(loan.total_repay).toFixed(2)}</p>
                <p><strong>Interés Total:</strong> ${Number(loan.total_interest).toFixed(2)}</p>
                <p><strong>Tipo:</strong> {loan.loan_type}</p>
                {loan.product_model && (
                  <p><strong>Producto:</strong> {loan.product_model} (IMEI: {loan.product_imei})</p>
                )}
                <p><strong>Creado por:</strong> {loan.created_by_name}</p>
                <p><strong>Fecha de Solicitud:</strong> {new Date(loan.created_at).toLocaleDateString()}</p>
                <div className="d-flex justify-content-start mt-2">
                  <button 
                    className="bg-primary-500 hover:bg-primary-600 text-neutral-800 font-semibold px-4 py-1 rounded text-sm me-2" 
                    onClick={() => handleAction(loan.loan_id, "approve", "loan")}
                  >
                    Aprobar Préstamo
                  </button>
                  {loan.loan_type === 'producto' && (
                    <button 
                      className="bg-blue-500 hover:bg-blue-600 text-neutral-800 font-semibold px-4 py-1 rounded text-sm" 
                      onClick={() => handleAction(loan.loan_id, "deliver", "loan")}
                    >
                      Entregar Producto
                    </button>
                  )}
                </div>
              </div>
            </div>
          )) : null}
        </div>
      )}

      <h2 className="text-xl font-semibold mb-6 text-neutral-800 mt-5">Aprobaciones de Gastos</h2>
      {expenses.length === 0 ? (
        <p className="text-neutral-600 text-sm">No hay gastos por aprobar.</p>
      ) : (
        <div className="row">
          {Array.isArray(expenses) ? expenses.map((e) => (
            <div key={e.id} className="col-md-6 mb-4">
              <div className="bg-white border-t-4 border-lime-500 text-neutral-800 rounded-md p-4 shadow mb-6">
                <h5>{e.type}</h5>
                <p><strong>Monto:</strong> ${e.amount}</p>
                <p><strong>Notas:</strong> {e.description || "N/A"}</p>
                <p><strong>Sucursal:</strong> {storeNames[e.store_id] || "N/A"}</p>
                <p><strong>Fecha de Solicitud:</strong> {new Date(e.created_at).toLocaleDateString()}</p>
                <p><strong>Días de Crédito:</strong> {e.days_of_credit || "0"}</p>
                <p><strong>Fecha de Vencimiento:</strong> {e.due_date ? new Date(e.due_date).toLocaleDateString() : "N/A"}</p>
                {e.quote_path && (
                  <p>
                    <strong>Cotización:</strong>{" "}
                    <a
                      href={`${API_BASE_URL}/uploads/${e.quote_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 hover:underline"
                    >
                      Ver cotización
                    </a>
                  </p>
                )}
                <div className="d-flex justify-content-start mt-2">
                  <button className="bg-primary-500 hover:bg-primary-600 text-neutral-800 font-semibold px-4 py-1 rounded text-sm me-2" onClick={() => handleAction(e.id, "approve", "expense")}>
                    Aprobar
                  </button>
                  <button className="bg-red-600 hover:bg-red-700 text-neutral-800 font-semibold px-4 py-1 rounded text-sm" onClick={() => handleAction(e.id, "cancel", "expense")}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )) : null}
        </div>
      )}
    <h2 className="text-xl font-semibold mb-6 text-neutral-800 mt-5">Historial de Gastos Pagados</h2>
    {/* Filter and export bar */}
    <div className="flex gap-4 mb-4 text-neutral-800">
      <div>
        <label className="block text-sm">Desde</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-white border border-neutral-300 rounded p-1 text-neutral-800"
        />
      </div>
      <div>
        <label className="block text-sm">Hasta</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-white border border-neutral-300 rounded p-1 text-neutral-800"
        />
      </div>
      <button
        onClick={() => {
          // Filter from allPaidExpenses, not from already filtered
          const filtered = allPaidExpenses.filter((e) => {
            const d = new Date(e.updated_at);
            return (
              (!startDate || new Date(startDate) <= d) &&
              (!endDate || new Date(endDate) >= d)
            );
          });
          setPaidExpenses(filtered);
        }}
        className="bg-primary-500 hover:bg-primary-600 text-neutral-800 font-semibold px-4 py-1 rounded text-sm self-end"
      >
        Filtrar
      </button>
      <button
        onClick={() => {
          const headers = [
            "ID",
            "Tipo",
            "Monto",
            "Descripción",
            "Fecha de Pago",
          ];
          const rows = paidExpenses.map((e) => [
            e.id,
            e.type,
            e.amount,
            e.description,
            e.updated_at ? new Date(e.updated_at).toLocaleDateString() : "N/A",
          ]);
          const csv = [headers, ...rows]
            .map((r) =>
              r
                .map((cell) =>
                  typeof cell === "string" && cell.includes(",")
                    ? `"${cell}"`
                    : cell
                )
                .join(",")
            )
            .join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "gastos_pagados.csv";
          a.click();
        }}
        className="bg-blue-500 hover:bg-blue-600 text-neutral-800 font-semibold px-4 py-1 rounded text-sm self-end"
      >
        Exportar a Excel
      </button>
    </div>
    {paidExpenses.length === 0 ? (
      <p className="text-neutral-600 text-sm">No hay gastos pagados.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-neutral-800 border border-primary-500 mb-8">
          <thead>
            <tr className="bg-gradient-to-br from-surface-50 to-surface-100 text-primary-600">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Monto</th>
              <th className="p-2 text-left">Descripción</th>
              <th className="p-2 text-left">Fecha de Pago</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(paidExpenses) ? paidExpenses.map((e) => (
              <tr key={e.id} className="border-t border-primary-500">
                <td className="p-2">{e.id}</td>
                <td className="p-2">{e.type || "N/A"}</td>
                <td className="p-2">${parseFloat(e.amount).toLocaleString()}</td>
                <td className="p-2">{e.description || "Sin descripción"}</td>
                <td className="p-2">{e.updated_at ? new Date(e.updated_at).toLocaleDateString() : "N/A"}</td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    )}
    </div>
    </Layout>
  );
  
};

export default AdminApprovals;
