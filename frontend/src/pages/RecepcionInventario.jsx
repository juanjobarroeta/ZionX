import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const RecepcionInventario = () => {
  const token = localStorage.getItem("token");
  const [requests, setRequests] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [imei, setImei] = useState("");
  const [serial, setSerial] = useState("");

  useEffect(() => {
    fetchRequests();
    fetchDeliveries();
  }, []);

  const fetchRequests = async () => {
    try {
      // Use existing endpoint with status filter for paid items ready for reception
      const res = await axios.get(`${API_BASE_URL}/inventory-requests?status=paid`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("📦 Requests from backend:", res.data);
      setRequests(res.data || []);
    } catch (err) {
      console.error("Error fetching requests:", err);
    }
  };

  const fetchDeliveries = async () => {
    try {
      // Use existing loans endpoint to get approved product loans ready for delivery
      const res = await axios.get(`${API_BASE_URL}/loans?status=approved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("📦 Deliveries from backend:", res.data);
      // Filter for product loans only
      const productLoans = (res.data || []).filter(loan => loan.loan_type === 'producto');
      setDeliveries(productLoans);
    } catch (err) {
      console.error("Error fetching deliveries:", err);
    }
  };

  const markAsReceived = async (id, amount) => {
    const confirm = window.confirm("¿Estás seguro que deseas marcar este inventario como recibido y aceptar responsabilidad?");
    if (!confirm) return;

    try {
        await axios.post(`${API_BASE_URL}/inventory-requests/${id}/receive`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          alert("Inventario marcado como recibido");
          setRequests(prev => prev.filter(req => req.id !== id));
          fetchDeliveries(); // added line
    } catch (err) {
      console.error("Error marking as received:", err);
      alert("Error al marcar como recibido.");
    }
  };

  const deliverPhone = async (loanId) => {
    const confirm = window.confirm("¿Confirmar entrega del teléfono al cliente? Esto moverá el valor al balance.");
    if (!confirm) return;

    try {
      await axios.post(`${API_BASE_URL}/loans/${loanId}/deliver`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Teléfono entregado correctamente.");
      setDeliveries(prev => prev.filter(d => d.loan_id !== loanId));
    } catch (err) {
      console.error("Error delivering phone:", err);
      alert("Error al entregar el teléfono.");
    }
  };

  return (
    <Layout>
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-neutral-800">Recepción de Inventario</h2>
      {requests.length === 0 ? (
        <p className="text-neutral-600 text-sm">No hay solicitudes pendientes de recepción.</p>
      ) : (
        <div className="bg-white border-t-4 border-lime-500 rounded-md overflow-x-auto mb-10">
          <table className="min-w-full text-sm text-neutral-800">
            <thead className="bg-primary-500 text-neutral-800">
              <tr>
                <th>ID</th>
                <th>Categoría</th>
                <th colSpan="6" className="text-center">Resumen</th>
                <th>Monto</th>
                <th>Notas</th>
                <th>Cotización</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={`request-${req.id}`} className="border-t border-neutral-200 hover:bg-white">
                  <td>{req.id}</td>
                  <td>{req.category}</td>
                  <td colSpan="6" className="text-center text-neutral-600">Ver detalle al recibir</td>
                  <td>${req.amount || 0}</td>
                  <td>{req.notes || "—"}</td>
                  <td>
                    {req.quote_path ? (
                      <a href={`${API_BASE_URL}/uploads/${req.quote_path}`} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                        Ver cotización
                      </a>
                    ) : (
                      "No disponible"
                    )}
                  </td>
                  <td>
                    <button
                      className="bg-primary-500 hover:bg-primary-600 text-neutral-800 font-semibold px-4 py-1 rounded text-sm"
                      onClick={() => markAsReceived(req.id)}
                    >
                      Marcar como Recibido
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="text-xl font-semibold mt-10 mb-6 text-neutral-800">Entregas Pendientes a Clientes</h2>
      {deliveries.length === 0 ? (
        <p className="text-neutral-600 text-sm">No hay teléfonos pendientes de entrega.</p>
      ) : (
        <div className="bg-white border-t-4 border-lime-500 rounded-md overflow-x-auto mb-10">
          <table className="min-w-full text-sm text-neutral-800 text-center">
            <thead className="bg-primary-500 text-neutral-800">
              <tr>
                <th className="text-center">Loan ID</th>
                <th className="text-center">Cliente</th>
                <th className="text-center">CURP</th>
                <th className="text-center">Producto</th>
                <th className="text-center">Monto</th>
                <th className="text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((item) => (
                <tr key={`delivery-${item.loan_id || Math.random()}`} className="border-t border-neutral-200 hover:bg-white">
                  <td className="text-center">{item.loan_id}</td>
                  <td className="text-center">{item.first_name} {item.last_name}</td>
                  <td className="text-center">{item.curp || "—"}</td>
                  <td className="text-center">{item.brand} {item.model}</td>
                  <td className="text-center">${item.sale_price || "—"}</td>
                  <td className="text-center">
                    <button className="bg-blue-500 hover:bg-blue-600 text-neutral-800 font-semibold px-4 py-1 rounded text-sm" onClick={() => deliverPhone(item.loan_id)}>
                      Entregar Teléfono
                    </button>
                  </td>
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

export default RecepcionInventario;