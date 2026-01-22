import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const OverdueLoans = () => {
  const [overdueData, setOverdueData] = useState({
    overdue_installments: [],
    summary: {}
  });
  const [recommendations, setRecommendations] = useState({
    recommendations: [],
    summary: {}
  });
  const [loading, setLoading] = useState(true);
  const [selectedLoans, setSelectedLoans] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overdue");
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchOverdueData();
    fetchRecommendations();
  }, []);

  const fetchOverdueData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/overdue-loans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOverdueData(res.data);
    } catch (err) {
      console.error("Error loading overdue loans:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/overdue-loans/recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecommendations(res.data);
    } catch (err) {
      console.error("Error loading recommendations:", err);
    }
  };

  const handleCollectionAction = async (loanId, actionType, customMessage = null) => {
    try {
      setActionLoading(true);
      const payload = {
        action_type: actionType,
        notes: customMessage || `Action: ${actionType}`,
        contact_method: actionType.includes('whatsapp') ? 'whatsapp' : 'phone'
      };

      await axios.post(`${API_BASE_URL}/overdue-loans/${loanId}/collection-action`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Refresh data
      fetchOverdueData();
      fetchRecommendations();
    } catch (err) {
      console.error("Error executing collection action:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAction = async () => {
    if (selectedLoans.length === 0) return;

    try {
      setActionLoading(true);
      const payload = {
        action_type: 'bulk_whatsapp',
        loan_ids: selectedLoans,
        message_template: bulkMessage || "Recordatorio de pago pendiente"
      };

      await axios.post(`${API_BASE_URL}/overdue-loans/bulk-actions`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSelectedLoans([]);
      setBulkMessage("");
      setShowBulkActions(false);
      fetchOverdueData();
    } catch (err) {
      console.error("Error executing bulk action:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityColor = (daysOverdue) => {
    if (daysOverdue <= 7) return "text-yellow-400";
    if (daysOverdue <= 14) return "text-orange-400";
    if (daysOverdue <= 30) return "text-neutral-600";
    return "text-red-600";
  };

  const getPriorityBadge = (daysOverdue) => {
    if (daysOverdue <= 7) return { text: "BAJA", color: "bg-yellow-600" };
    if (daysOverdue <= 14) return { text: "MEDIA", color: "bg-orange-600" };
    if (daysOverdue <= 30) return { text: "ALTA", color: "bg-red-600" };
    return { text: "CRÍTICA", color: "bg-red-800" };
  };

  const getRecommendedAction = (daysOverdue) => {
    if (daysOverdue <= 3) return "Recordatorio suave";
    if (daysOverdue <= 7) return "Plan de pago";
    if (daysOverdue <= 14) return "Llamada telefónica";
    if (daysOverdue <= 30) return "Visita programada";
    return "Aviso legal";
  };

  if (loading) {
    return (
      <Layout>
        <div className="px-6 py-10 max-w-7xl mx-auto">
          <div className="text-neutral-800 text-center">Cargando pagos vencidos...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-6 py-10 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-neutral-800 text-2xl font-bold">Pagos Vencidos</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("overdue")}
              className={`px-4 py-2 rounded ${activeTab === "overdue" ? "bg-primary-500 text-neutral-800" : "bg-gray-700 text-neutral-800"}`}
            >
              Pagos Vencidos
            </button>
            <button
              onClick={() => setActiveTab("recommendations")}
              className={`px-4 py-2 rounded ${activeTab === "recommendations" ? "bg-primary-500 text-neutral-800" : "bg-gray-700 text-neutral-800"}`}
            >
              Recomendaciones
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-neutral-200">
            <div className="text-neutral-600 text-sm">Total Vencido</div>
            <div className="text-neutral-800 text-2xl font-bold">
              ${overdueData.summary?.total_amount_overdue?.toLocaleString() || 0}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-neutral-200">
            <div className="text-neutral-600 text-sm">Clientes Afectados</div>
            <div className="text-neutral-800 text-2xl font-bold">
              {overdueData.summary?.customers_affected || 0}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-neutral-200">
            <div className="text-neutral-600 text-sm">Pagos Vencidos</div>
            <div className="text-neutral-800 text-2xl font-bold">
              {overdueData.summary?.total_overdue || 0}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-neutral-200">
            <div className="text-neutral-600 text-sm">Promedio Días</div>
            <div className="text-neutral-800 text-2xl font-bold">
              {Math.round(overdueData.summary?.average_days_overdue || 0)}
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="mb-6">
          <button
            onClick={() => setShowBulkActions(!showBulkActions)}
            className="bg-primary-500 text-neutral-800 px-4 py-2 rounded font-semibold"
          >
            {showBulkActions ? "Ocultar" : "Mostrar"} Acciones Masivas
          </button>
          
          {showBulkActions && (
            <div className="mt-4 bg-white p-4 rounded-lg border border-neutral-200">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-neutral-800 text-sm mb-2">Mensaje Personalizado</label>
                  <textarea
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    placeholder="Escribe un mensaje personalizado para WhatsApp..."
                    className="w-full p-2 bg-gray-700 text-neutral-800 rounded border border-neutral-300"
                    rows="3"
                  />
                </div>
                <button
                  onClick={handleBulkAction}
                  disabled={selectedLoans.length === 0 || actionLoading}
                  className="bg-red-600 text-neutral-800 px-6 py-2 rounded font-semibold disabled:opacity-50"
                >
                  {actionLoading ? "Enviando..." : `Enviar WhatsApp (${selectedLoans.length})`}
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTab === "overdue" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-neutral-800 bg-white border border-primary-500">
              <thead>
                <tr className="bg-gradient-to-br from-surface-50 to-surface-100 text-primary-600">
                  <th className="px-4 py-2 text-left">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLoans(overdueData.overdue_installments.map(item => item.loan_id));
                        } else {
                          setSelectedLoans([]);
                        }
                      }}
                      className="mr-2"
                    />
                    Seleccionar
                  </th>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-left">Teléfono</th>
                  <th className="px-4 py-2 text-left">Préstamo</th>
                  <th className="px-4 py-2 text-left">Semana</th>
                  <th className="px-4 py-2 text-left">Fecha Vencida</th>
                  <th className="px-4 py-2 text-left">Días Atraso</th>
                  <th className="px-4 py-2 text-left">Monto</th>
                  <th className="px-4 py-2 text-left">Penalidad</th>
                  <th className="px-4 py-2 text-left">Prioridad</th>
                  <th className="px-4 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {overdueData.overdue_installments.map((item) => {
                  const priority = getPriorityBadge(item.days_overdue);
                  return (
                    <tr key={`${item.loan_id}-${item.week_number}`} className="border-t border-primary-500">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedLoans.includes(item.loan_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLoans([...selectedLoans, item.loan_id]);
                            } else {
                              setSelectedLoans(selectedLoans.filter(id => id !== item.loan_id));
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 text-primary-600 underline">
                        <a href={`/customer/${item.customer_id}`}>
                          {item.first_name} {item.last_name}
                        </a>
                      </td>
                      <td className="px-4 py-2">{item.phone}</td>
                      <td className="px-4 py-2">#{item.loan_id}</td>
                      <td className="px-4 py-2">Semana {item.week_number}</td>
                      <td className="px-4 py-2">
                        {new Date(item.due_date).toLocaleDateString()}
                      </td>
                      <td className={`px-4 py-2 ${getPriorityColor(item.days_overdue)}`}>
                        {item.days_overdue} días
                      </td>
                      <td className="px-4 py-2 text-neutral-600">
                        ${parseFloat(item.amount_due).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-orange-400">
                        ${parseFloat(item.penalty_applied || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${priority.color}`}>
                          {priority.text}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleCollectionAction(item.loan_id, 'whatsapp_reminder')}
                            disabled={actionLoading}
                            className="bg-green-600 text-neutral-800 px-2 py-1 rounded text-xs disabled:opacity-50"
                            title="Enviar WhatsApp"
                          >
                            📱
                          </button>
                          <button
                            onClick={() => handleCollectionAction(item.loan_id, 'phone_call')}
                            disabled={actionLoading}
                            className="bg-blue-600 text-neutral-800 px-2 py-1 rounded text-xs disabled:opacity-50"
                            title="Programar Llamada"
                          >
                            📞
                          </button>
                          <button
                            onClick={() => handleCollectionAction(item.loan_id, 'payment_plan')}
                            disabled={actionLoading}
                            className="bg-purple-600 text-neutral-800 px-2 py-1 rounded text-xs disabled:opacity-50"
                            title="Plan de Pago"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary-500 font-bold text-neutral-800 bg-white">
                  <td colSpan="7" className="px-4 py-2 text-right">Total vencido:</td>
                  <td className="px-4 py-2 text-neutral-600">
                    ${overdueData.summary?.total_amount_overdue?.toLocaleString() || 0}
                  </td>
                  <td className="px-4 py-2 text-orange-400">
                    ${overdueData.summary?.total_penalties?.toLocaleString() || 0}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {activeTab === "recommendations" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-neutral-800 bg-white border border-primary-500">
              <thead>
                <tr className="bg-gradient-to-br from-surface-50 to-surface-100 text-primary-600">
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-left">Teléfono</th>
                  <th className="px-4 py-2 text-left">Préstamo</th>
                  <th className="px-4 py-2 text-left">Semana</th>
                  <th className="px-4 py-2 text-left">Días Atraso</th>
                  <th className="px-4 py-2 text-left">Monto</th>
                  <th className="px-4 py-2 text-left">Prioridad</th>
                  <th className="px-4 py-2 text-left">Acción Recomendada</th>
                  <th className="px-4 py-2 text-left">Ejecutar</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.recommendations.map((rec) => {
                  const priority = getPriorityBadge(rec.days_overdue);
                  return (
                    <tr key={`${rec.loan_id}-${rec.week_number}`} className="border-t border-primary-500">
                      <td className="px-4 py-2 text-primary-600">
                        {rec.first_name} {rec.last_name}
                      </td>
                      <td className="px-4 py-2">{rec.phone}</td>
                      <td className="px-4 py-2">#{rec.loan_id}</td>
                      <td className="px-4 py-2">Semana {rec.week_number}</td>
                      <td className={`px-4 py-2 ${getPriorityColor(rec.days_overdue)}`}>
                        {rec.days_overdue} días
                      </td>
                      <td className="px-4 py-2 text-neutral-600">
                        ${parseFloat(rec.amount_due).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${priority.color}`}>
                          {priority.text}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-primary-500">
                        {getRecommendedAction(rec.days_overdue)}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleCollectionAction(rec.loan_id, rec.recommended_action)}
                          disabled={actionLoading}
                          className="bg-primary-500 text-neutral-800 px-3 py-1 rounded text-xs font-semibold disabled:opacity-50"
                        >
                          {actionLoading ? "..." : "Ejecutar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {overdueData.overdue_installments.length === 0 && (
          <div className="text-center py-10">
            <div className="text-neutral-800 text-xl mb-2">🎉 ¡Excelente!</div>
            <div className="text-neutral-600">No hay pagos vencidos en este momento.</div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default OverdueLoans;