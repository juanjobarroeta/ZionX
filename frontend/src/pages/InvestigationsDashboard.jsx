import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const InvestigationsDashboard = () => {
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvestigation, setSelectedInvestigation] = useState(null);
  const [loanRequests, setLoanRequests] = useState([]);
  const [garantias, setGarantias] = useState([]);
  const [entregas, setEntregas] = useState([]);

  const [searchCredito, setSearchCredito] = useState("");
  const [searchEntrega, setSearchEntrega] = useState("");
  const [searchInvestigacion, setSearchInvestigacion] = useState("");

  useEffect(() => {
    const fetchInvestigations = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/investigations`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const data = await response.json();
        console.log("Investigations loaded:", data);
        setInvestigations(Array.isArray(data) ? data : Object.values(data));
      } catch (error) {
        // Optionally handle error here
        setInvestigations([]);
      } finally {
        setLoading(false);
      }
    };
    fetchInvestigations();

    const fetchLoanRequests = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/loan-requests`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        setLoanRequests(data);
      } catch (error) {
        setLoanRequests([]);
      }
    };

    const fetchGarantias = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/garantias`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        setGarantias(data);
      } catch (error) {
        setGarantias([]);
      }
    };

    const fetchEntregas = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/entregas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        setEntregas(data);
      } catch (error) {
        setEntregas([]);
      }
    };

    fetchLoanRequests();
    fetchGarantias();
    fetchEntregas();
  }, []);

  // Shows the selected investigation's full data in a detail panel
  const handleViewDetails = (inv) => {
    setSelectedInvestigation(inv);
  };

  const filteredLoanRequests = loanRequests.filter(r =>
    `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchCredito.toLowerCase()) ||
    r.phone?.toLowerCase().includes(searchCredito.toLowerCase()) ||
    r.status?.toLowerCase().includes(searchCredito.toLowerCase())
  );

  const filteredEntregas = entregas.filter(e =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchEntrega.toLowerCase()) ||
    e.imei?.toLowerCase().includes(searchEntrega.toLowerCase()) ||
    e.model?.toLowerCase().includes(searchEntrega.toLowerCase())
  );

  const filteredInvestigations = investigations.filter(i =>
    `${i.nombre_asesor || ""}`.toLowerCase().includes(searchInvestigacion.toLowerCase()) ||
    `${i.sucursal || ""}`.toLowerCase().includes(searchInvestigacion.toLowerCase()) ||
    `${i.calificacion || ""}`.toLowerCase().includes(searchInvestigacion.toLowerCase())
  );

  return (
    <Layout>
      <div>
        <h1 className="text-neutral-800 text-2xl font-bold mb-6">Formatos</h1>

        {/* Formato de Solicitud de Crédito */}
        <div className="mt-10">
          <h2 className="text-primary-500 text-xl mb-2">Formato de Solicitud de Crédito</h2>
          <input
            type="text"
            placeholder="Buscar..."
            value={searchCredito}
            onChange={(e) => setSearchCredito(e.target.value)}
            className="mb-4 px-3 py-2 w-full rounded bg-slate-800 text-neutral-800"
          />
          {filteredLoanRequests.length > 0 ? (
            <table className="min-w-full border border-green-500 text-neutral-800 text-sm">
              <thead className="bg-green-600 text-neutral-800">
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoanRequests.map((req, idx) => (
                  <tr key={req.id || idx}>
                    <td className="px-3 py-2 text-neutral-800">
                      {req.first_name} {req.last_name}
                    </td>
                    <td className="px-3 py-2 text-neutral-800">{req.phone}</td>
                    <td className="px-3 py-2 text-neutral-800">{req.monto}</td>
                    <td className="px-3 py-2 text-neutral-800">{req.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-neutral-800">No se encontraron solicitudes de crédito.</p>
          )}
        </div>

        {/* Formato de Solicitud de Garantía */}
        <div className="mt-10">
          <h2 className="text-primary-500 text-xl mb-2">Formato de Solicitud de Garantía</h2>
          <p className="text-neutral-800">En construcción...</p>
        </div>

        {/* Formato de Entrega de Producto */}
        <div className="mt-10">
          <h2 className="text-primary-500 text-xl mb-2">Formato de Entrega de Producto</h2>
          <input
            type="text"
            placeholder="Buscar..."
            value={searchEntrega}
            onChange={(e) => setSearchEntrega(e.target.value)}
            className="mb-4 px-3 py-2 w-full rounded bg-slate-800 text-neutral-800"
          />
          {filteredEntregas.length > 0 ? (
            <table className="min-w-full border border-green-500 text-neutral-800 text-sm">
              <thead className="bg-green-600 text-neutral-800">
                <tr>
                  <th>Cliente</th>
                  <th>Modelo</th>
                  <th>IMEI</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntregas.map((e, idx) => (
                  <tr key={e.loan_id || idx}>
                    <td className="px-3 py-2 text-neutral-800">{e.first_name} {e.last_name}</td>
                    <td className="px-3 py-2 text-neutral-800">{e.model}</td>
                    <td className="px-3 py-2 text-neutral-800">{e.imei}</td>
                    <td className="px-3 py-2 text-neutral-800">{new Date(e.delivery_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-neutral-800">No se encontraron entregas.</p>
          )}
        </div>

        {/* Formato de Investigación */}
        <div className="mt-10">
          <h2 className="text-primary-500 text-xl mb-2">Formato de Investigación</h2>
          <input
            type="text"
            placeholder="Buscar..."
            value={searchInvestigacion}
            onChange={(e) => setSearchInvestigacion(e.target.value)}
            className="mb-4 px-3 py-2 w-full rounded bg-slate-800 text-neutral-800"
          />
          {loading ? (
            <p className="text-neutral-800">Cargando...</p>
          ) : filteredInvestigations.length === 0 ? (
            <p className="text-neutral-800">No se encontraron investigaciones.</p>
          ) : (
            <table className="min-w-full border border-green-500 text-neutral-800 text-sm">
              <thead className="bg-green-600 text-neutral-800">
                <tr>
                  <th>Fecha</th>
                  <th>Asesor</th>
                  <th>Sucursal</th>
                  <th>Calificación</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestigations.map((inv, idx) => (
                  <tr key={inv.id || idx}>
                    <td className="px-3 py-2 text-neutral-800">{inv.fecha || "N/A"}</td>
                    <td className="px-3 py-2 text-neutral-800">{inv.nombre_asesor || "N/A"}</td>
                    <td className="px-3 py-2 text-neutral-800">{inv.sucursal || "N/A"}</td>
                    <td className="px-3 py-2 text-neutral-800">{inv.calificacion || "N/A"}</td>
                    <td className="px-3 py-2 text-neutral-800">
                      <button onClick={() => handleViewDetails(inv)}>
                        Ver detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedInvestigation && (
          <div className="mt-6 p-4 bg-white border border-green-500 rounded text-neutral-800">
            <h2 className="text-lg font-bold mb-4">Detalles de la Investigación</h2>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex">
                <span className="w-36 font-semibold">Fecha:</span>
                <span>{selectedInvestigation.fecha || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="w-36 font-semibold">Asesor:</span>
                <span>{selectedInvestigation.nombre_asesor || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="w-36 font-semibold">Sucursal:</span>
                <span>{selectedInvestigation.sucursal || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="w-36 font-semibold">Calificación:</span>
                <span>{selectedInvestigation.calificacion || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="w-36 font-semibold">Teléfono:</span>
                <span>{selectedInvestigation.telefono || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="w-36 font-semibold">Ocupación:</span>
                <span>{selectedInvestigation.ocupacion || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="w-36 font-semibold">Observaciones:</span>
                <span>{selectedInvestigation.observaciones || "N/A"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default InvestigationsDashboard;