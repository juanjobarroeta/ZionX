

import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const AccountingAdmin = () => {
  const [closures, setClosures] = useState([]);
  const [selectedClosure, setSelectedClosure] = useState(null);
  const [entries, setEntries] = useState([]);

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchClosures = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/accounting/closures`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClosures(res.data);
      } catch (err) {
        console.error("Error loading closures:", err);
      }
    };
    fetchClosures();
  }, []);

  const fetchEntries = async (closureId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounting/closures/${closureId}/entries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedClosure(res.data.closure);
      setEntries(res.data.entries);
    } catch (err) {
      console.error("Error loading closure entries:", err);
    }
  };

  return (
    <Layout>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <h2 className="text-xl text-neutral-800 font-bold mb-6">Cierres Contables</h2>
        <div className="bg-white border border-primary-500 rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm text-neutral-800">
            <thead>
              <tr className="bg-gradient-to-br from-surface-50 to-surface-100 text-primary-600">
                <th className="px-4 py-2 text-left">Periodo</th>
                <th className="px-4 py-2 text-left">Cerrado por</th>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Acción</th>
              </tr>
            </thead>
            <tbody>
              {closures.map((c) => (
                <tr key={c.id} className="border-t border-primary-500">
                  <td className="px-4 py-2">{c.start} → {c.end}</td>
                  <td className="px-4 py-2">{c.closed_by_name || `ID ${c.closed_by}`}</td>
                  <td className="px-4 py-2">{new Date(c.closed_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => fetchEntries(c.id)}
                      className="text-primary-600 hover:underline"
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedClosure && (
          <div className="mt-10">
            <h3 className="text-neutral-800 text-lg font-bold mb-4">
              Detalle del cierre: {selectedClosure.start} → {selectedClosure.end}
            </h3>
            <table className="min-w-full text-sm text-neutral-800 border border-primary-500">
              <thead>
                <tr className="bg-gradient-to-br from-surface-50 to-surface-100 text-primary-600">
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Cuenta</th>
                  <th className="px-4 py-2 text-left">Descripción</th>
                  <th className="px-4 py-2 text-right">Debe</th>
                  <th className="px-4 py-2 text-right">Haber</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-primary-500">
                    <td className="px-4 py-2">{e.date}</td>
                    <td className="px-4 py-2">{e.account_code} – {e.account_name}</td>
                    <td className="px-4 py-2">{e.description}</td>
                    <td className="px-4 py-2 text-right text-primary-600">${e.debit?.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-neutral-600">${e.credit?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AccountingAdmin;