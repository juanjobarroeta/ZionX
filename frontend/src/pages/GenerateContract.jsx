import { API_BASE_URL } from "../utils/constants";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../components/Layout";

const GenerateContract = () => {
  const [loans, setLoans] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [loanDetails, setLoanDetails] = useState(null);
  const [form, setForm] = useState({});
  const token = localStorage.getItem("token");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/loans/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => setLoans(res.data)).catch(err => console.error("Error fetching loans", err));
  }, [token]);

  useEffect(() => {
    if (!selectedLoanId) return;
    axios.get(`${API_BASE_URL}/loans/${selectedLoanId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      setLoanDetails(res.data.loan);
      setForm({
        customer_name: res.data.loan.customer_name || "",
        store_name: res.data.loan.store || "",
        model: res.data.loan.model || "",
        imei: res.data.loan.imei || "",
        address: res.data.loan.address || "",
        email: res.data.loan.email || "",
        curp: res.data.loan.curp || "",
        phone: res.data.loan.phone || "",
        guarantor_name: "",
        contract_date: new Date().toLocaleDateString("es-MX")
      });
    });
  }, [selectedLoanId, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const generateContract = async () => {
    if (!selectedLoanId) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/contracts/${selectedLoanId}/generate`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Contrato_Prestamo_${selectedLoanId}.docx`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error("Error generating contract", err);
    }
  };

  return (
    <Layout>
    <div className="p-6 bg-white text-neutral-800 max-w-4xl mx-auto rounded-xl shadow-lg border border-primary-500 mt-6">
      <h2 className="text-2xl font-bold text-primary-500 mb-4">Generar Contrato de Préstamo</h2>

      <div className="mb-3">
        <label className="block mb-2 font-medium text-primary-500">Selecciona un préstamo:</label>
        <select className="w-full p-2 bg-white border border-primary-500 text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500" value={selectedLoanId} onChange={e => setSelectedLoanId(e.target.value)}>
          <option value="">-- Selecciona --</option>
          {loans.map(loan => (
            <option key={loan.id} value={loan.id}>
              #{loan.id} – {loan.customer_name || ""} – ${loan.amount}
            </option>
          ))}
        </select>
      </div>

      {loanDetails && (
        <>
          <h5 className="text-lg font-semibold text-primary-500 mb-2">Completar información del contrato</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {Object.entries(form).map(([key, val]) => (
              <div key={key}>
                <label className="block mb-1 font-medium text-primary-500">{key}</label>
                <input
                  type="text"
                  name={key}
                  value={val}
                  onChange={handleChange}
                  className="w-full p-2 bg-white border border-primary-500 text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            ))}
          </div>
          <button className="mt-4 bg-primary-500 text-neutral-800 font-bold px-6 py-2 rounded hover:bg-white hover:text-primary-500 transition" onClick={generateContract}>Generar Contrato</button>
        </>
      )}
    </div>
    </Layout>
  );
};

export default GenerateContract;