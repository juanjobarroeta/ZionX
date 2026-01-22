import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const LoanStatement = () => {
  const { id } = useParams();
  const token = localStorage.getItem("token");
  const [loan, setLoan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [allLoans, setAllLoans] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState(id);
  const [customerId, setCustomerId] = useState(null);

  // Early checks for token and loan ID
  if (!token) return <div className="text-neutral-800 p-6">Token missing. Please log in again.</div>;
  if (!selectedLoanId) return <div className="text-neutral-800 p-6">No loan ID specified.</div>;

  useEffect(() => {
    const fetchLoanData = async () => {
      try {
        // Fetch the current loan statement
        const loanRes = await axios.get(`${API_BASE_URL}/loans/${selectedLoanId}/statement`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLoan({
          ...loanRes.data.loan,
          installments: loanRes.data.installments,
          customer_name: loanRes.data.customer_name
        });
        setPayments(loanRes.data.payments);
        setCustomerId(loanRes.data.loan.customer_id);

        // Fetch all loans by this customer (if available)
        if (loanRes.data.loan.customer_id || customerId) {
          const customerLoansRes = await axios.get(`${API_BASE_URL}/customers/${loanRes.data.loan.customer_id}/loans`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setAllLoans(customerLoansRes.data);
        }
      } catch (err) {
        console.error("Error fetching loan details:", err);
        setLoan({ error: "No se pudo cargar la información del préstamo. Verifica que el préstamo existe o que tienes acceso." });
      }
    };

    fetchLoanData();
  }, [selectedLoanId, token]);

  useEffect(() => {
    if (!customerId) return;
    axios.get(`${API_BASE_URL}/customers/${customerId}/loans`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then(res => setAllLoans(res.data))
    .catch(err => console.error("Error fetching all loans:", err));
  }, [customerId, token]);

  if (!loan) return <div className="text-neutral-800 p-6">Cargando estado de cuenta...</div>;
  if (loan?.error) return <div className="text-red-500 p-6">{loan.error}</div>;

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const balance = loan.amount - totalPaid;

  return (
    <Layout>
    <div className="max-w-6xl mx-auto bg-white text-neutral-800 rounded-xl shadow-lg p-8 mt-8 space-y-8 border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <input
          type="text"
          placeholder="Buscar..."
          className="rounded border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 w-full sm:max-w-xs"
        />
        {allLoans.length > 1 && (
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-800 mb-1">Cambiar Préstamo</label>
            <select
              className="form-select mt-1 block w-full rounded border border-gray-300 bg-white shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 sm:text-sm"
              value={selectedLoanId}
              onChange={(e) => setSelectedLoanId(e.target.value)}
            >
              {allLoans.map((l) => (
                <option key={l.id} value={l.id}>
                  #{l.id} - ${l.amount} - {new Date(l.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="border-b border-gray-400 pb-4 mb-4">
        <h2 className="text-2xl font-bold mb-1 text-green-600">Estado de Cuenta - Préstamo #{loan.id}</h2>
        <p className="text-sm text-gray-800">Fecha de corte: {new Date().toLocaleDateString()}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-gray-800 font-medium">
        <div><strong>Cliente:</strong> {loan.customer_name || 'No disponible'}</div>
        <div><strong>Estado del préstamo:</strong> {loan.status}</div>
        <div><strong>Monto del Préstamo:</strong> ${loan.amount}</div>
        <div><strong>Plazo:</strong> {loan.term} semanas</div>
        <div><strong>Fecha de Vencimiento:</strong> {new Date(loan.due_date).toLocaleDateString()}</div>
        <div><strong>Total Pagado:</strong> ${totalPaid}</div>
        <div><strong>Saldo Restante:</strong> ${balance}</div>
      </div>

      <div className="mb-6 space-y-4">
        <h3 className="text-lg font-semibold uppercase text-green-600">Tabla de Amortización</h3>
        {loan.installments && loan.installments.length > 0 ? (
          <div className="overflow-x-auto rounded shadow-sm">
            <table className="table-auto w-full text-sm border border-gray-200 bg-white">
              <thead className="bg-gray-200 text-gray-700 font-semibold uppercase">
                <tr>
                  <th className="px-2 py-2 text-left">Semana</th>
                  <th className="px-2 py-2 text-left">Fecha</th>
                  <th className="px-2 py-2 text-right">Capital</th>
                  <th className="px-2 py-2 text-right">Interés</th>
                  <th className="px-2 py-2 text-right">Penalidad</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loan.installments.map((inst, i) => (
                  <tr key={i} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                    <td className="px-2 py-1">{inst.week_number}</td>
                    <td className="px-2 py-1">{new Date(inst.due_date).toLocaleDateString()}</td>
                    <td className="px-2 py-1 text-right">${inst.capital_portion}</td>
                    <td className="px-2 py-1 text-right">${inst.interest_portion}</td>
                    <td className="px-2 py-1 text-right">${inst.penalty_applied}</td>
                    <td className="px-2 py-1 text-right">${parseFloat(inst.capital_portion) + parseFloat(inst.interest_portion) + parseFloat(inst.penalty_applied)}</td>
                    <td className="px-2 py-1">{inst.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No hay amortizaciones disponibles.</p>
        )}
      </div>
      
      {loan.status !== "completed" && loan.status !== "repossess" && (
        <div className="bg-red-50 border border-red-200 rounded p-4 my-4">
          <p className="text-red-700 mb-3">Advertencia: Al reposeder el producto, se registrará el valor estimado y notas adicionales.</p>
          <button
            className="btn btn-danger bg-red-600 hover:bg-red-700 text-neutral-800 font-semibold px-4 py-2 rounded"
            onClick={async () => {
              const estimated_value = prompt("Valor estimado del producto:");
              if (!estimated_value) return;

              const notes = prompt("Notas adicionales (opcional):");

              try {
                await axios.post(`${API_BASE_URL}/inventory-items/${loan.inventory_item_id}/repossess`, {
                  estimated_value,
                  notes,
                }, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                });
                alert("Producto reposedido correctamente.");
              } catch (err) {
                console.error("Error al reposeder producto:", err);
                alert("Error al reposeder producto.");
              }
            }}
          >
            Reposeer producto
          </button>
        </div>
      )}
      
      <div className="mb-6 space-y-4">
        <h3 className="text-lg font-semibold uppercase text-green-600">Pagos Realizados</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-600">No se han registrado pagos.</p>
        ) : (
          <div className="overflow-x-auto rounded shadow-sm">
            <table className="table-auto w-full text-sm border border-gray-200 bg-white">
              <thead className="bg-gray-200 text-gray-700 font-semibold uppercase">
                <tr>
                  <th className="px-2 py-2 text-left">Fecha</th>
                  <th className="px-2 py-2 text-right">Monto</th>
                  <th className="px-2 py-2 text-left">Método</th>
                  <th className="px-2 py-2 text-left">Sucursal</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="even:bg-gray-50">
                    <td className="px-2 py-1">{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td className="px-2 py-1 text-right">${p.amount}</td>
                    <td className="px-2 py-1">{p.method}</td>
                    <td className="px-2 py-1">{p.store_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </Layout>
  );
};

export default LoanStatement;
