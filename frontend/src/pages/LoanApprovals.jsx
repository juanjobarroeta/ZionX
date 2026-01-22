import React, { useEffect, useState } from 'react';
import axios from 'axios';
import UploadContract from "../components/UploadContract";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import { Link } from "react-router-dom";

const LoanApprovals = () => {
  const [loans, setLoans] = useState([]);
  const token = localStorage.getItem("token");

  const fetchLoans = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/loan-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLoans(res.data);
    } catch (err) {
      console.error("Error fetching loan applications:", err);
    }
  };

  const updateLoanStatus = async (id, action) => {
    try {
      await axios.put(`${API_BASE_URL}/admin/loans/${id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Trigger accounting entries only on approval
      if (action === "approve") {
        const loan = loans.find((l) => l.id === id);
        const downPayment = parseFloat(loan.down_payment || 0);
        const principal = parseFloat(loan.amount);

        const entries = [
          { type: "down_payment", amount: downPayment, description: "Enganche recibido" },
          { type: "loan_principal", amount: principal, description: "Monto financiado" },
        ];

        if (loan.interest_rate) {
          const interest = principal * (parseFloat(loan.interest_rate) / 100);
          entries.push({ type: "interest", amount: interest, description: "Interés proyectado" });
        }

        for (const entry of entries) {
          await axios.post(`${API_BASE_URL}/accounting`, {
            loan_id: id,
            ...entry,
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      fetchLoans(); // Refresh list
    } catch (err) {
      console.error(`Error ${action} loan:`, err);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  return (
    <Layout>
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-neutral-800">Solicitudes de préstamo pendientes</h2>

      {loans.length === 0 ? (
        <p className="text-neutral-800">✅ No hay préstamos pendientes por aprobar. Todos los préstamos han sido procesados.</p>
      ) : (
        <div className="row">
          {loans.map((loan) => (
            <div key={loan.id} className="col-md-6 mb-4">
              <div className="bg-white border-t-4 border-lime-500 text-neutral-800 rounded-md p-4 shadow mb-6">
                <h5>Cliente: {loan.first_name} {loan.last_name}</h5>
                <p><strong>Email:</strong> {loan.email}</p>
                <p><strong>Monto:</strong> ${loan.amount}</p>
                <p><strong>Plazo:</strong> {loan.term} semanas</p>
                <p><strong>Estado:</strong> {loan.status}</p>

                {loan.contract_path && (
                  <a
                    href={`${API_BASE_URL}/uploads/${loan.contract_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm font-medium hover:bg-blue-200 mb-2"
                  >
                    Ver contrato firmado
                  </a>
                )}

                {!loan.contract_path && (
                  <UploadContract loanId={loan.loan_id || loan.id} onSuccess={fetchLoans} />
                )}

                <Link
                  to={`/admin/loan-applications/${loan.id}`}
                  className="inline-block mt-3 bg-lime-600 hover:bg-lime-700 text-neutral-800 font-semibold px-4 py-1 rounded text-sm"
                >
                  Ver solicitud
                </Link>

                {!loan.contract_path && (
                  <small className="text-neutral-600 mt-2 block">*Requiere contrato firmado</small>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </Layout>
  );
};

export default LoanApprovals;
