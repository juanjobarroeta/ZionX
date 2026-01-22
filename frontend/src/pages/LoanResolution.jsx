import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const LoanResolution = () => {
  const { loan_id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loanData, setLoanData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Form states for different resolution types
  const [settlementForm, setSettlementForm] = useState({
    settlement_amount: '',
    payment_method: 'efectivo',
    reason: '',
    notes: ''
  });
  
  const [writeOffForm, setWriteOffForm] = useState({
    reason: '',
    notes: '',
    recovery_attempts: 0
  });
  
  const [repossessionForm, setRepossessionForm] = useState({
    recovery_costs: 0,
    new_condition: '',
    estimated_resale_value: '',
    notes: ''
  });

  const [resolutionHistory, setResolutionHistory] = useState([]);

  // Fetch loan resolution data
  useEffect(() => {
    const fetchLoanData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        
        const [loanResponse, historyResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/loans/${loan_id}/resolution-options`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_BASE_URL}/loans/resolutions?loan_id=${loan_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        setLoanData(loanResponse.data);
        setResolutionHistory(historyResponse.data.resolutions || []);
        
        // Pre-populate forms with recommended values
        if (loanResponse.data.resolutionOptions.settlement.available) {
          const recommendedAmount = loanResponse.data.resolutionOptions.settlement.recommended_amount;
          setSettlementForm(prev => ({
            ...prev,
            settlement_amount: recommendedAmount ? parseFloat(recommendedAmount).toFixed(2) : '0.00'
          }));
        }
        
        if (loanResponse.data.resolutionOptions.repossession.available) {
          const estimatedRecovery = loanResponse.data.resolutionOptions.repossession.estimated_recovery;
          setRepossessionForm(prev => ({
            ...prev,
            estimated_resale_value: estimatedRecovery ? parseFloat(estimatedRecovery).toFixed(2) : '0.00',
            new_condition: loanData?.loan?.condition || 'usado'
          }));
        }
        
      } catch (error) {
        console.error("Error fetching loan resolution data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (loan_id) {
      fetchLoanData();
    }
  }, [loan_id]);

  // Handle settlement submission
  const handleSettlement = async () => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      
      await axios.post(`${API_BASE_URL}/loans/${loan_id}/settle`, settlementForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert("Préstamo liquidado exitosamente");
      navigate("/loans");
    } catch (error) {
      console.error("Error processing settlement:", error);
      alert("Error al procesar la liquidación: " + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle write-off submission
  const handleWriteOff = async () => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      
      await axios.post(`${API_BASE_URL}/loans/${loan_id}/write-off`, writeOffForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert("Préstamo dado de baja exitosamente");
      navigate("/loans");
    } catch (error) {
      console.error("Error processing write-off:", error);
      alert("Error al dar de baja el préstamo: " + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle repossession submission
  const handleRepossession = async () => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      
      await axios.post(`${API_BASE_URL}/loans/${loan_id}/repossess`, repossessionForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert("Repossession procesada exitosamente");
      navigate("/loans");
    } catch (error) {
      console.error("Error processing repossession:", error);
      alert("Error al procesar la repossession: " + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-neutral-800 text-lg">Cargando datos del préstamo...</div>
        </div>
      </Layout>
    );
  }

  if (!loanData) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-red-500 text-lg">No se encontraron datos del préstamo</div>
        </div>
      </Layout>
    );
  }

  const { loan, payments, resolutionOptions, summary } = loanData;

  return (
    <Layout>
      <div className="p-6 bg-gradient-to-br from-surface-50 to-surface-100 min-h-screen">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-800 mb-2">
                Resolución de Préstamo #{loan.id}
              </h1>
              <p className="text-neutral-600">
                Cliente: {loan.customer_name} • Teléfono: {loan.customer_phone}
              </p>
            </div>
            <button
              onClick={() => navigate("/loans")}
              className="px-4 py-2 bg-gray-700 text-neutral-800 rounded-lg hover:bg-gray-600 transition-colors"
            >
              ← Volver a Préstamos
            </button>
          </div>
        </div>

        {/* Loan Summary Card */}
        <div className="bg-white rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-neutral-800 mb-4">Resumen del Préstamo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-500">${loan.amount ? parseFloat(loan.amount).toFixed(2) : '0.00'}</div>
              <div className="text-neutral-600 text-sm">Monto Original</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-500">${summary.total_paid ? parseFloat(summary.total_paid).toFixed(2) : '0.00'}</div>
              <div className="text-neutral-600 text-sm">Total Pagado</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-neutral-600">${summary.remaining_balance ? parseFloat(summary.remaining_balance).toFixed(2) : '0.00'}</div>
              <div className="text-neutral-600 text-sm">Saldo Pendiente</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{summary.payment_progress ? parseFloat(summary.payment_progress).toFixed(1) : '0.0'}%</div>
              <div className="text-neutral-600 text-sm">Progreso</div>
            </div>
          </div>
          
          {loan.brand && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
              <h3 className="text-neutral-800 font-semibold mb-2">Producto Garantía</h3>
              <p className="text-neutral-700">{loan.brand} {loan.model} - IMEI: {loan.imei}</p>
              <p className="text-neutral-600">Condición: {loan.condition} • Valor estimado: ${loan.estimated_value ? parseFloat(loan.estimated_value).toFixed(2) : '0.00'}</p>
            </div>
          )}
        </div>

        {/* Resolution Options Tabs */}
        <div className="bg-white rounded-xl overflow-hidden mb-8">
          {/* Tab Headers */}
          <div className="flex border-b border-neutral-200">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === "overview"
                  ? "bg-blue-600 text-neutral-800"
                  : "bg-white text-neutral-600 hover:text-neutral-800"
              }`}
            >
              📊 Vista General
            </button>
            {resolutionOptions.settlement.available && (
              <button
                onClick={() => setActiveTab("settlement")}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === "settlement"
                    ? "bg-blue-600 text-neutral-800"
                    : "bg-white text-neutral-600 hover:text-neutral-800"
                }`}
              >
                🤝 Liquidación
              </button>
            )}
            {resolutionOptions.repossession.available && (
              <button
                onClick={() => setActiveTab("repossession")}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === "repossession"
                    ? "bg-blue-600 text-neutral-800"
                    : "bg-white text-neutral-600 hover:text-neutral-800"
                }`}
              >
                📱 Repossession
              </button>
            )}
            {resolutionOptions.writeOff.available && (
              <button
                onClick={() => setActiveTab("writeoff")}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === "writeoff"
                    ? "bg-blue-600 text-neutral-800"
                    : "bg-white text-neutral-600 hover:text-neutral-800"
                }`}
              >
                ❌ Dar de Baja
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-neutral-800">Opciones de Resolución Disponibles</h3>
                
                <div className="grid gap-4">
                  {/* Settlement Option */}
                  {resolutionOptions.settlement.available && (
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                      <h4 className="text-primary-500 font-semibold mb-2">🤝 Liquidación Negociada</h4>
                      <p className="text-neutral-700 mb-2">
                        Acepta un pago menor al saldo total para cerrar el préstamo.
                      </p>
                      <div className="text-sm text-neutral-600">
                        <p>• Recomendado: ${resolutionOptions.settlement.recommended_amount ? parseFloat(resolutionOptions.settlement.recommended_amount).toFixed(2) : '0.00'}</p>
                        <p>• Mínimo: ${resolutionOptions.settlement.minimum_amount ? parseFloat(resolutionOptions.settlement.minimum_amount).toFixed(2) : '0.00'}</p>
                        <p>• Máximo: ${resolutionOptions.settlement.maximum_amount ? parseFloat(resolutionOptions.settlement.maximum_amount).toFixed(2) : '0.00'}</p>
                      </div>
                    </div>
                  )}

                  {/* Repossession Option */}
                  {resolutionOptions.repossession.available && (
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                      <h4 className="text-primary-500 font-semibold mb-2">📱 Repossession del Producto</h4>
                      <p className="text-neutral-700 mb-2">
                        Recupera el producto garantía y aplica su valor al saldo pendiente.
                      </p>
                      <div className="text-sm text-neutral-600">
                        <p>• Valor estimado: ${resolutionOptions.repossession.estimated_recovery ? parseFloat(resolutionOptions.repossession.estimated_recovery).toFixed(2) : '0.00'}</p>
                        <p>• Pérdida neta: ${resolutionOptions.repossession.net_loss ? parseFloat(resolutionOptions.repossession.net_loss).toFixed(2) : '0.00'}</p>
                      </div>
                    </div>
                  )}

                  {/* Write-off Option */}
                  {resolutionOptions.writeOff.available && (
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                      <h4 className="text-neutral-600 font-semibold mb-2">❌ Dar de Baja (Write-off)</h4>
                      <p className="text-neutral-700 mb-2">
                        Cancela completamente el saldo pendiente como pérdida irrecuperable.
                      </p>
                      <div className="text-sm text-neutral-600">
                        <p>• Monto a dar de baja: ${resolutionOptions.writeOff.amount ? parseFloat(resolutionOptions.writeOff.amount).toFixed(2) : '0.00'}</p>
                        {resolutionOptions.writeOff.recommended && (
                          <p className="text-yellow-400">• Recomendado para este caso</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment History */}
                <div>
                  <h4 className="text-neutral-800 font-semibold mb-3">Historial de Pagos</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-neutral-700">Fecha</th>
                          <th className="px-3 py-2 text-left text-neutral-700">Monto</th>
                          <th className="px-3 py-2 text-left text-neutral-700">Método</th>
                          <th className="px-3 py-2 text-left text-neutral-700">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-600">
                        {payments.map((payment, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-neutral-700">
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 text-primary-500 font-medium">
                              ${parseFloat(payment.amount).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-neutral-700 capitalize">
                              {payment.method || 'Efectivo'}
                            </td>
                            <td className="px-3 py-2 text-neutral-700">
                              {payment.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settlement" && resolutionOptions.settlement.available && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-neutral-800">Liquidación Negociada</h3>
                
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ Esta acción registrará un pago parcial y dará de baja el resto del saldo.
                    Se crearán automáticamente los asientos contables correspondientes.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Monto de Liquidación *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={resolutionOptions.settlement.minimum_amount}
                      max={resolutionOptions.settlement.maximum_amount}
                      value={settlementForm.settlement_amount}
                      onChange={(e) => setSettlementForm(prev => ({
                        ...prev,
                        settlement_amount: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                      placeholder="0.00"
                    />
                    <div className="text-sm text-neutral-600 mt-1">
                      Rango: ${resolutionOptions.settlement.minimum_amount ? parseFloat(resolutionOptions.settlement.minimum_amount).toFixed(2) : '0.00'} - 
                      ${resolutionOptions.settlement.maximum_amount ? parseFloat(resolutionOptions.settlement.maximum_amount).toFixed(2) : '0.00'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Método de Pago
                    </label>
                    <select
                      value={settlementForm.payment_method}
                      onChange={(e) => setSettlementForm(prev => ({
                        ...prev,
                        payment_method: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="deposito">Depósito</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Razón de la Liquidación *
                    </label>
                    <select
                      value={settlementForm.reason}
                      onChange={(e) => setSettlementForm(prev => ({
                        ...prev,
                        reason: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                    >
                      <option value="">Seleccionar razón...</option>
                      <option value="Dificultades económicas del cliente">Dificultades económicas del cliente</option>
                      <option value="Pérdida de empleo">Pérdida de empleo</option>
                      <option value="Emergencia médica">Emergencia médica</option>
                      <option value="Quita negociada">Quita negociada</option>
                      <option value="Evitar proceso legal">Evitar proceso legal</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Notas Adicionales
                    </label>
                    <textarea
                      value={settlementForm.notes}
                      onChange={(e) => setSettlementForm(prev => ({
                        ...prev,
                        notes: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                      rows={3}
                      placeholder="Detalles adicionales sobre el acuerdo..."
                    />
                  </div>

                  {settlementForm.settlement_amount && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-neutral-800 font-semibold mb-2">Resumen de la Liquidación</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Saldo actual:</span>
                          <span className="text-neutral-800">${summary.remaining_balance ? parseFloat(summary.remaining_balance).toFixed(2) : '0.00'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Pago de liquidación:</span>
                          <span className="text-primary-500">${parseFloat(settlementForm.settlement_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t border-neutral-300 pt-1">
                          <span className="text-neutral-600">Monto a dar de baja:</span>
                          <span className="text-neutral-600">
                            ${(summary.remaining_balance - parseFloat(settlementForm.settlement_amount || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSettlement}
                    disabled={!settlementForm.settlement_amount || !settlementForm.reason || submitting}
                    className="w-full bg-green-600 text-neutral-800 py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "Procesando..." : "Procesar Liquidación"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "repossession" && resolutionOptions.repossession.available && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-neutral-800">Repossession del Producto</h3>
                
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-primary-500 text-sm">
                    📱 Esta acción recuperará el producto garantía y aplicará su valor al saldo pendiente.
                    El producto se agregará nuevamente al inventario con el estado "repossessed".
                  </p>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Valor de Reventa Estimado *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={repossessionForm.estimated_resale_value}
                      onChange={(e) => setRepossessionForm(prev => ({
                        ...prev,
                        estimated_resale_value: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                      placeholder="0.00"
                    />
                    <div className="text-sm text-neutral-600 mt-1">
                      Valor original: ${loan.estimated_value ? parseFloat(loan.estimated_value).toFixed(2) : '0.00'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Nueva Condición del Producto
                    </label>
                    <select
                      value={repossessionForm.new_condition}
                      onChange={(e) => setRepossessionForm(prev => ({
                        ...prev,
                        new_condition: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                    >
                      <option value="">Seleccionar condición...</option>
                      <option value="nuevo">Nuevo</option>
                      <option value="seminuevo">Seminuevo</option>
                      <option value="usado">Usado</option>
                      <option value="dañado">Dañado</option>
                      <option value="descompuesto">Descompuesto</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Costos de Recuperación
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={repossessionForm.recovery_costs}
                      onChange={(e) => setRepossessionForm(prev => ({
                        ...prev,
                        recovery_costs: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                      placeholder="0.00"
                    />
                    <div className="text-sm text-neutral-600 mt-1">
                      Gastos de transporte, reparaciones, etc.
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Notas de Repossession
                    </label>
                    <textarea
                      value={repossessionForm.notes}
                      onChange={(e) => setRepossessionForm(prev => ({
                        ...prev,
                        notes: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                      rows={3}
                      placeholder="Condiciones del producto, circunstancias de la recuperación..."
                    />
                  </div>

                  {repossessionForm.estimated_resale_value && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-neutral-800 font-semibold mb-2">Resumen de Repossession</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Saldo pendiente:</span>
                          <span className="text-neutral-800">${summary.remaining_balance ? parseFloat(summary.remaining_balance).toFixed(2) : '0.00'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Valor de reventa:</span>
                          <span className="text-primary-500">${parseFloat(repossessionForm.estimated_resale_value || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Costos de recuperación:</span>
                          <span className="text-neutral-600">-${parseFloat(repossessionForm.recovery_costs || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t border-neutral-300 pt-1">
                          <span className="text-neutral-600">Recuperación neta:</span>
                          <span className="text-primary-500">
                            ${(parseFloat(repossessionForm.estimated_resale_value || 0) - parseFloat(repossessionForm.recovery_costs || 0)).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Pérdida neta:</span>
                          <span className="text-neutral-600">
                            ${Math.max(0, summary.remaining_balance - (parseFloat(repossessionForm.estimated_resale_value || 0) - parseFloat(repossessionForm.recovery_costs || 0))).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleRepossession}
                    disabled={!repossessionForm.estimated_resale_value || submitting}
                    className="w-full bg-blue-600 text-neutral-800 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "Procesando..." : "Procesar Repossession"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "writeoff" && resolutionOptions.writeOff.available && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-neutral-800">Dar de Baja (Write-off)</h3>
                
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-neutral-600 text-sm">
                    ⚠️ Esta acción cancelará completamente el saldo pendiente como pérdida irrecuperable.
                    Se creará un gasto por cuentas incobrables en la contabilidad.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Razón para Dar de Baja *
                    </label>
                    <select
                      value={writeOffForm.reason}
                      onChange={(e) => setWriteOffForm(prev => ({
                        ...prev,
                        reason: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                    >
                      <option value="">Seleccionar razón...</option>
                      <option value="Cliente insolvente">Cliente insolvente</option>
                      <option value="No localizable">No localizable</option>
                      <option value="Fallecimiento del cliente">Fallecimiento del cliente</option>
                      <option value="Costo de recuperación excesivo">Costo de recuperación excesivo</option>
                      <option value="Producto sin valor">Producto sin valor</option>
                      <option value="Proceso legal infructuoso">Proceso legal infructuoso</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Intentos de Recuperación
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={writeOffForm.recovery_attempts}
                      onChange={(e) => setWriteOffForm(prev => ({
                        ...prev,
                        recovery_attempts: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                      placeholder="0"
                    />
                    <div className="text-sm text-neutral-600 mt-1">
                      Número de intentos de cobranza realizados
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">
                      Notas Adicionales
                    </label>
                    <textarea
                      value={writeOffForm.notes}
                      onChange={(e) => setWriteOffForm(prev => ({
                        ...prev,
                        notes: e.target.value
                      }))}
                      className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800"
                      rows={3}
                      placeholder="Detalles sobre los intentos de recuperación, situación del cliente..."
                    />
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-neutral-800 font-semibold mb-2">Resumen del Write-off</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Monto original:</span>
                        <span className="text-neutral-800">${loan.amount ? parseFloat(loan.amount).toFixed(2) : '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Total pagado:</span>
                        <span className="text-primary-500">${summary.total_paid ? parseFloat(summary.total_paid).toFixed(2) : '0.00'}</span>
                      </div>
                      <div className="flex justify-between border-t border-neutral-300 pt-1">
                        <span className="text-neutral-600">Monto a dar de baja:</span>
                        <span className="text-neutral-600 font-semibold">${summary.remaining_balance ? parseFloat(summary.remaining_balance).toFixed(2) : '0.00'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleWriteOff}
                    disabled={!writeOffForm.reason || submitting}
                    className="w-full bg-red-600 text-neutral-800 py-3 rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "Procesando..." : "Dar de Baja Préstamo"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resolution History */}
        {resolutionHistory.length > 0 && (
          <div className="bg-white rounded-xl p-6">
            <h3 className="text-xl font-bold text-neutral-800 mb-4">Historial de Resoluciones</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left text-neutral-700">Fecha</th>
                    <th className="px-3 py-2 text-left text-neutral-700">Tipo</th>
                    <th className="px-3 py-2 text-left text-neutral-700">Monto</th>
                    <th className="px-3 py-2 text-left text-neutral-700">Baja</th>
                    <th className="px-3 py-2 text-left text-neutral-700">Estado</th>
                    <th className="px-3 py-2 text-left text-neutral-700">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {resolutionHistory.map((resolution, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-neutral-700">
                        {new Date(resolution.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-neutral-700 capitalize">
                        {resolution.resolution_type}
                      </td>
                      <td className="px-3 py-2 text-primary-500">
                        ${parseFloat(resolution.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-neutral-600">
                        ${parseFloat(resolution.write_off_amount || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          resolution.status === 'completed' ? 'bg-green-900 text-green-300' :
                          resolution.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-red-900 text-red-300'
                        }`}>
                          {resolution.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-neutral-700">
                        {resolution.resolved_by || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default LoanResolution;