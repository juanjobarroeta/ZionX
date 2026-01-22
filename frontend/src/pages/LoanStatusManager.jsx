import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import Layout from "../components/Layout";
import { useParams, useNavigate } from "react-router-dom";

const LoanStatusManager = () => {
  const { loan_id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const statusOptions = [
    { value: "created", label: "📝 Creado", description: "Préstamo creado por empleado" },
    { value: "pending_approval", label: "⏳ Pendiente de Aprobación", description: "Esperando aprobación de administrador" },
    { value: "approved", label: "✅ Aprobado", description: "Préstamo aprobado por administrador" },
    { value: "contract_generated", label: "📄 Contrato Generado", description: "Contrato PDF generado y listo" },
    { value: "ready_for_delivery", label: "📦 Listo para Entrega", description: "Producto preparado para entrega" },
    { value: "delivered", label: "🎯 Entregado", description: "Producto entregado al cliente" }
  ];

  const statusColors = {
    created: "bg-blue-500",
    pending_approval: "bg-yellow-500",
    approved: "bg-green-500",
    contract_generated: "bg-purple-500",
    ready_for_delivery: "bg-orange-500",
    delivered: "bg-green-600"
  };

  useEffect(() => {
    loadLoanData();
  }, [loan_id]);

  const loadLoanData = async () => {
    try {
      setLoading(true);
      const [loanRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/loans/${loan_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/loans/${loan_id}/status-history`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setLoan(loanRes.data.loan);
      setStatusHistory(historyRes.data || []);
    } catch (error) {
      console.error("Error loading loan data:", error);
      alert("Error cargando datos del préstamo");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async () => {
    if (!newStatus) {
      alert("Por favor seleccione un nuevo estado");
      return;
    }

    setUpdating(true);
    try {
      await axios.put(`${API_BASE_URL}/loans/${loan_id}/status`, {
        status: newStatus,
        notes: notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert("✅ Estado actualizado exitosamente");
      setNewStatus("");
      setNotes("");
      loadLoanData();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("❌ Error actualizando el estado");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusInfo = (status) => {
    return statusOptions.find(option => option.value === status) || { label: status, description: "Estado desconocido" };
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-white text-neutral-800 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-400 mx-auto mb-4"></div>
            <p>Cargando datos del préstamo...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!loan) {
    return (
      <Layout>
        <div className="min-h-screen bg-white text-neutral-800 flex items-center justify-center">
          <div className="text-center">
            <p className="text-neutral-600">Préstamo no encontrado</p>
            <button
              onClick={() => navigate("/loans")}
              className="mt-4 bg-lime-600 hover:bg-lime-700 text-neutral-800 px-4 py-2 rounded-lg"
            >
              Volver a Préstamos
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white text-neutral-800 p-6">
        {/* Header */}
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <button
                onClick={() => navigate("/loans")}
                className="mb-4 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                ← Volver a Préstamos
              </button>
              <h1 className="text-3xl font-bold text-neutral-800">Gestión de Estado del Préstamo</h1>
              <p className="text-neutral-600">Préstamo #{loan_id}</p>
            </div>
            <div className="text-right">
              <div className={`inline-block px-4 py-2 rounded-full text-neutral-800 font-medium ${statusColors[loan.status] || 'bg-gray-500'}`}>
                {getStatusInfo(loan.status).label}
              </div>
            </div>
          </div>

          {/* Loan Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 border border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">📋 Información del Préstamo</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-neutral-600">Cliente:</span>
                  <span className="ml-2 text-neutral-800">{loan.customer_name || "N/A"}</span>
                </div>
                <div>
                  <span className="text-neutral-600">Monto:</span>
                  <span className="ml-2 text-neutral-800">${parseFloat(loan.amount || 0).toLocaleString('es-MX')}</span>
                </div>
                <div>
                  <span className="text-neutral-600">Plazo:</span>
                  <span className="ml-2 text-neutral-800">{loan.term} semanas</span>
                </div>
                <div>
                  <span className="text-neutral-600">Producto:</span>
                  <span className="ml-2 text-neutral-800">{loan.product_name || "N/A"}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">🔄 Actualizar Estado</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-neutral-700 font-medium mb-2">Nuevo Estado</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800 focus:border-lime-400 focus:outline-none"
                  >
                    <option value="">Seleccionar estado...</option>
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-700 font-medium mb-2">Notas (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Agregar notas sobre el cambio de estado..."
                    className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800 focus:border-lime-400 focus:outline-none"
                    rows="3"
                  />
                </div>
                <button
                  onClick={updateStatus}
                  disabled={updating || !newStatus}
                  className="w-full bg-lime-600 hover:bg-lime-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-neutral-800 py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  {updating ? "Actualizando..." : "Actualizar Estado"}
                </button>
              </div>
            </div>
          </div>

          {/* Status History */}
          <div className="bg-white rounded-lg p-6 border border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">📜 Historial de Estados</h3>
            {statusHistory.length === 0 ? (
              <p className="text-neutral-600 text-center py-8">No hay historial de cambios de estado</p>
            ) : (
              <div className="space-y-4">
                {statusHistory.map((log, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${statusColors[log.status] || 'bg-gray-500'}`}></div>
                      <div>
                        <div className="font-medium text-neutral-800">
                          {getStatusInfo(log.status).label}
                        </div>
                        <div className="text-sm text-neutral-600">
                          {new Date(log.created_at).toLocaleString('es-MX')}
                        </div>
                        {log.notes && (
                          <div className="text-sm text-neutral-700 mt-1">
                            Notas: {log.notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-neutral-600">
                      {log.changed_by_email || "Usuario"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LoanStatusManager; 