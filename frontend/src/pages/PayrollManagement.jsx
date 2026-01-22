import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const PayrollManagement = () => {
  const [periods, setPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showEditEntryModal, setShowEditEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [savingEntry, setSavingEntry] = useState(false);
  
  // New period form
  const [newPeriod, setNewPeriod] = useState({
    period_type: '1ra_quincena', // 1ra_quincena, 2da_quincena
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    payment_date: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [periodsRes, employeesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/hr/payroll/periods`, { headers }),
        axios.get(`${API_BASE_URL}/api/hr/employees`, { headers, params: { is_active: true } })
      ]);

      setPeriods(periodsRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createPeriod = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Calculate dates based on period type
      const [year, month] = newPeriod.month.split('-');
      let start_date, end_date, period_name;
      
      if (newPeriod.period_type === '1ra_quincena') {
        start_date = `${year}-${month}-01`;
        end_date = `${year}-${month}-15`;
        period_name = `1ra Quincena ${getMonthName(month)} ${year}`;
      } else {
        start_date = `${year}-${month}-16`;
        // Last day of month
        const lastDay = new Date(year, month, 0).getDate();
        end_date = `${year}-${month}-${lastDay}`;
        period_name = `2da Quincena ${getMonthName(month)} ${year}`;
      }

      await axios.post(`${API_BASE_URL}/api/hr/payroll/periods`, {
        period_name,
        start_date,
        end_date,
        payment_date: newPeriod.payment_date || null,
        notes: newPeriod.notes
      }, { headers });

      alert("Período de nómina creado exitosamente");
      setShowCreateModal(false);
      setNewPeriod({ period_type: '1ra_quincena', month: new Date().toISOString().slice(0, 7), payment_date: '', notes: '' });
      fetchData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  const generateEntries = async (periodId) => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const res = await axios.post(`${API_BASE_URL}/api/hr/payroll/periods/${periodId}/generate`, {}, { headers });
      alert(`Se generaron ${res.data.count} registros de nómina`);
      fetchData(); // Refresh the list
      fetchPeriodDetails(periodId);
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  const deletePeriod = async (periodId, periodName) => {
    if (!confirm(`¿Eliminar el período "${periodName}"? Esta acción no se puede deshacer.`)) return;
    
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      await axios.delete(`${API_BASE_URL}/api/hr/payroll/periods/${periodId}`, { headers });
      alert("Período eliminado exitosamente");
      fetchData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  const fetchPeriodDetails = async (periodId) => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const res = await axios.get(`${API_BASE_URL}/api/hr/payroll/periods/${periodId}`, { headers });
      setSelectedPeriod(res.data);
    } catch (error) {
      console.error("Error fetching period details:", error);
    }
  };

  const processPayroll = async () => {
    if (!confirm("¿Confirmar que se realizó el pago de nómina? Esto creará los asientos contables.")) return;
    
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const res = await axios.post(
        `${API_BASE_URL}/api/hr/payroll/periods/${selectedPeriod.id}/process`,
        { payment_date: new Date().toISOString().split('T')[0] },
        { headers }
      );

      alert(`Nómina procesada: ${formatCurrency(res.data.total_net)} pagados a ${res.data.entries_processed} empleados`);
      setShowProcessModal(false);
      setSelectedPeriod(null);
      fetchData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  const openEditEntry = (entry) => {
    setEditingEntry({
      ...entry,
      base_salary: parseFloat(entry.base_salary) || 0,
      overtime_hours: parseFloat(entry.overtime_hours) || 0,
      overtime_pay: parseFloat(entry.overtime_pay) || 0,
      bonuses: parseFloat(entry.bonuses) || 0,
      commissions: parseFloat(entry.commissions) || 0,
      other_earnings: parseFloat(entry.other_earnings) || 0,
      isr_tax: parseFloat(entry.isr_tax) || 0,
      imss_employee: parseFloat(entry.imss_employee) || 0,
      infonavit: parseFloat(entry.infonavit) || 0,
      loans_deduction: parseFloat(entry.loans_deduction) || 0,
      other_deductions: parseFloat(entry.other_deductions) || 0,
      notes: entry.notes || ''
    });
    setShowEditEntryModal(true);
  };

  const updateEditingEntry = (field, value) => {
    const numValue = parseFloat(value) || 0;
    setEditingEntry(prev => {
      const updated = { ...prev, [field]: numValue };
      
      // Recalculate gross pay
      updated.gross_pay = 
        (parseFloat(updated.base_salary) || 0) +
        (parseFloat(updated.overtime_pay) || 0) +
        (parseFloat(updated.bonuses) || 0) +
        (parseFloat(updated.commissions) || 0) +
        (parseFloat(updated.other_earnings) || 0);
      
      // Recalculate total deductions
      updated.total_deductions = 
        (parseFloat(updated.isr_tax) || 0) +
        (parseFloat(updated.imss_employee) || 0) +
        (parseFloat(updated.infonavit) || 0) +
        (parseFloat(updated.loans_deduction) || 0) +
        (parseFloat(updated.other_deductions) || 0);
      
      // Recalculate net pay
      updated.net_pay = updated.gross_pay - updated.total_deductions;
      
      return updated;
    });
  };

  const saveEntry = async () => {
    if (!editingEntry) return;
    
    try {
      setSavingEntry(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(`${API_BASE_URL}/api/hr/payroll/entries`, {
        payroll_period_id: selectedPeriod.id,
        team_member_id: editingEntry.team_member_id,
        base_salary: editingEntry.base_salary,
        overtime_hours: editingEntry.overtime_hours,
        overtime_pay: editingEntry.overtime_pay,
        bonuses: editingEntry.bonuses,
        commissions: editingEntry.commissions,
        other_earnings: editingEntry.other_earnings,
        isr_tax: editingEntry.isr_tax,
        imss_employee: editingEntry.imss_employee,
        infonavit: editingEntry.infonavit,
        loans_deduction: editingEntry.loans_deduction,
        other_deductions: editingEntry.other_deductions,
        notes: editingEntry.notes
      }, { headers });

      alert("Registro actualizado exitosamente");
      setShowEditEntryModal(false);
      setEditingEntry(null);
      
      // Refresh period details
      fetchPeriodDetails(selectedPeriod.id);
      fetchData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    } finally {
      setSavingEntry(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
  };

  const getMonthName = (month) => {
    const months = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[parseInt(month)];
  };

  const getStatusBadge = (status) => {
    const badges = {
      open: { color: 'bg-blue-100 text-blue-800', label: '📝 Abierto' },
      processing: { color: 'bg-yellow-100 text-yellow-800', label: '⏳ Procesando' },
      paid: { color: 'bg-green-100 text-green-800', label: '✅ Pagado' },
      closed: { color: 'bg-gray-100 text-gray-800', label: '📁 Cerrado' }
    };
    const badge = badges[status] || badges.open;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>;
  };

  // Calculate totals for active employees (quincenal = monthly / 2)
  const totalQuincenalWages = employees
    .filter(e => e.is_active && e.monthly_wage)
    .reduce((sum, e) => sum + (parseFloat(e.monthly_wage) / 2), 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zionx-highlight"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-black">💵 Nómina Quincenal</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {employees.length} empleados activos • Quincena estimada: {formatCurrency(totalQuincenalWages)}
                </p>
              </div>
              <div className="flex space-x-3">
                <Link to="/hr/employees" className="bg-white border border-zionx-secondary px-4 py-2 rounded-lg hover:bg-gray-50">
                  👥 Empleados
                </Link>
                <Link to="/hr/financials" className="bg-white border border-zionx-secondary px-4 py-2 rounded-lg hover:bg-gray-50">
                  📊 Finanzas
                </Link>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800"
                >
                  ➕ Nueva Quincena
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📝</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Períodos Abiertos</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {periods.filter(p => p.status === 'open').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pagados este Año</p>
                  <p className="text-2xl font-bold text-green-600">
                    {periods.filter(p => p.status === 'paid').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Empleados Activos</p>
                  <p className="text-2xl font-bold text-purple-600">{employees.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">💵</span>
                </div>
                <div>
                  <p className="text-sm text-green-100">Quincena Estimada</p>
                  <p className="text-xl font-bold">{formatCurrency(totalQuincenalWages)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Periods List */}
          <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zionx-primary">📅 Períodos de Nómina</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fechas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleados</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Bruto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Neto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {periods.length > 0 ? (
                    periods.map((period) => (
                      <tr key={period.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{period.period_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(period.start_date).toLocaleDateString('es-MX')} - {new Date(period.end_date).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-6 py-4 text-center">{period.entry_count || 0}</td>
                        <td className="px-6 py-4">{formatCurrency(period.calculated_gross || period.total_gross)}</td>
                        <td className="px-6 py-4 font-semibold text-green-600">{formatCurrency(period.calculated_net || period.total_net)}</td>
                        <td className="px-6 py-4">{getStatusBadge(period.status)}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {period.status === 'open' && (
                              <>
                                {(!period.entry_count || parseInt(period.entry_count) === 0) ? (
                                  <button
                                    onClick={() => generateEntries(period.id)}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                  >
                                    ⚙️ Generar
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { fetchPeriodDetails(period.id); setShowProcessModal(true); }}
                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                  >
                                    💰 Procesar Pago
                                  </button>
                                )}
                                <button
                                  onClick={() => fetchPeriodDetails(period.id)}
                                  className="text-gray-600 hover:text-gray-800 text-sm"
                                >
                                  👁️ Ver
                                </button>
                              </>
                            )}
                            {period.status === 'paid' && (
                              <button
                                onClick={() => fetchPeriodDetails(period.id)}
                                className="text-gray-600 hover:text-gray-800 text-sm"
                              >
                                👁️ Ver Detalle
                              </button>
                            )}
                            {period.status !== 'paid' && (
                              <button
                                onClick={() => deletePeriod(period.id, period.period_name)}
                                className="text-red-500 hover:text-red-700 text-sm"
                              >
                                🗑️ Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                        <span className="text-4xl block mb-2">📅</span>
                        <p>No hay períodos de nómina creados</p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="mt-4 text-blue-600 hover:text-blue-800"
                        >
                          Crear primera quincena →
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Period Detail View */}
          {selectedPeriod && !showProcessModal && (
            <div className="mt-8 bg-white rounded-xl border border-zionx-secondary overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zionx-primary">
                  📋 Detalle: {selectedPeriod.period_name}
                </h2>
                <button 
                  onClick={() => setSelectedPeriod(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕ Cerrar
                </button>
              </div>

              <div className="p-6">
                {selectedPeriod.entries?.length > 0 ? (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Empleado</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Puesto</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Sueldo Base</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Bonos</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">ISR</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">IMSS</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Otras Ded.</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Neto</th>
                        {selectedPeriod.status !== 'paid' && (
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedPeriod.entries.map((entry) => {
                        const bonusTotal = (parseFloat(entry.bonuses) || 0) + (parseFloat(entry.commissions) || 0) + (parseFloat(entry.other_earnings) || 0);
                        const otherDed = (parseFloat(entry.loans_deduction) || 0) + (parseFloat(entry.other_deductions) || 0) + (parseFloat(entry.infonavit) || 0);
                        return (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">
                              {entry.employee_name}
                              {entry.notes && <span className="ml-2 text-xs text-gray-400" title={entry.notes}>📝</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{entry.role}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(entry.base_salary)}</td>
                            <td className="px-4 py-3 text-right text-green-600">
                              {bonusTotal > 0 ? `+${formatCurrency(bonusTotal)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(entry.isr_tax)}</td>
                            <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(entry.imss_employee)}</td>
                            <td className="px-4 py-3 text-right text-red-600">
                              {otherDed > 0 ? `-${formatCurrency(otherDed)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(entry.net_pay)}</td>
                            {selectedPeriod.status !== 'paid' && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => openEditEntry(entry)}
                                  className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded hover:bg-blue-50"
                                >
                                  ✏️ Editar
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                      <tr>
                        <td colSpan="2" className="px-4 py-3">TOTALES</td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(selectedPeriod.entries.reduce((s, e) => s + parseFloat(e.base_salary), 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600">
                          +{formatCurrency(selectedPeriod.entries.reduce((s, e) => s + (parseFloat(e.bonuses) || 0) + (parseFloat(e.commissions) || 0) + (parseFloat(e.other_earnings) || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          -{formatCurrency(selectedPeriod.entries.reduce((s, e) => s + parseFloat(e.isr_tax), 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          -{formatCurrency(selectedPeriod.entries.reduce((s, e) => s + parseFloat(e.imss_employee), 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          -{formatCurrency(selectedPeriod.entries.reduce((s, e) => s + (parseFloat(e.loans_deduction) || 0) + (parseFloat(e.other_deductions) || 0) + (parseFloat(e.infonavit) || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-green-700">
                          {formatCurrency(selectedPeriod.entries.reduce((s, e) => s + parseFloat(e.net_pay), 0))}
                        </td>
                        {selectedPeriod.status !== 'paid' && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    No hay registros. Haz clic en "⚙️ Generar" para crear los registros de nómina.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Create Period Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-zionx-primary mb-4">➕ Nueva Quincena</h2>
              
              <form onSubmit={createPeriod} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                  <input
                    type="month"
                    value={newPeriod.month}
                    onChange={(e) => setNewPeriod({...newPeriod, month: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quincena</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewPeriod({...newPeriod, period_type: '1ra_quincena'})}
                      className={`p-4 rounded-lg border-2 text-center transition-all ${
                        newPeriod.period_type === '1ra_quincena' 
                          ? 'border-black bg-black text-white' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold">1ra Quincena</p>
                      <p className="text-sm opacity-70">Días 1-15</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPeriod({...newPeriod, period_type: '2da_quincena'})}
                      className={`p-4 rounded-lg border-2 text-center transition-all ${
                        newPeriod.period_type === '2da_quincena' 
                          ? 'border-black bg-black text-white' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold">2da Quincena</p>
                      <p className="text-sm opacity-70">Días 16-31</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago (opcional)</label>
                  <input
                    type="date"
                    value={newPeriod.payment_date}
                    onChange={(e) => setNewPeriod({...newPeriod, payment_date: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                  <textarea
                    value={newPeriod.notes}
                    onChange={(e) => setNewPeriod({...newPeriod, notes: e.target.value})}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
                  >
                    Crear Quincena
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Process Payment Modal */}
        {showProcessModal && selectedPeriod && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-zionx-primary mb-4">💰 Confirmar Pago de Nómina</h2>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600">Período:</p>
                <p className="font-semibold text-lg">{selectedPeriod.period_name}</p>
                
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Empleados:</span>
                    <span className="font-medium">{selectedPeriod.entries?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Bruto:</span>
                    <span className="font-medium">{formatCurrency(selectedPeriod.total_gross)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deducciones:</span>
                    <span className="font-medium text-red-600">-{formatCurrency(selectedPeriod.total_deductions)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total a Pagar:</span>
                    <span className="text-green-600">{formatCurrency(selectedPeriod.total_net)}</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                ⚠️ Al confirmar, se crearán los asientos contables correspondientes.
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={() => { setShowProcessModal(false); setSelectedPeriod(null); }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={processPayroll}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  ✓ Confirmar Pago
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Entry Modal */}
        {showEditEntryModal && editingEntry && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 my-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-zionx-primary">
                  ✏️ Editar Nómina - {editingEntry.employee_name}
                </h2>
                <button 
                  onClick={() => { setShowEditEntryModal(false); setEditingEntry(null); }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Earnings Section */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-4 flex items-center gap-2">
                    <span className="text-lg">💰</span> Percepciones
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sueldo Base</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.base_salary}
                        onChange={(e) => updateEditingEntry('base_salary', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hrs Extra</label>
                        <input
                          type="number"
                          step="0.5"
                          value={editingEntry.overtime_hours}
                          onChange={(e) => updateEditingEntry('overtime_hours', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pago Hrs Extra</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry.overtime_pay}
                          onChange={(e) => updateEditingEntry('overtime_pay', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">🎁 Bonos</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.bonuses}
                        onChange={(e) => updateEditingEntry('bonuses', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-green-100 focus:bg-white"
                        placeholder="Agregar bono..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">📊 Comisiones</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.commissions}
                        onChange={(e) => updateEditingEntry('commissions', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Otras Percepciones</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.other_earnings}
                        onChange={(e) => updateEditingEntry('other_earnings', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-green-200">
                    <div className="flex justify-between text-lg font-bold text-green-700">
                      <span>Total Bruto:</span>
                      <span>{formatCurrency(editingEntry.gross_pay)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions Section */}
                <div className="bg-red-50 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-4 flex items-center gap-2">
                    <span className="text-lg">📉</span> Deducciones
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ISR</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.isr_tax}
                        onChange={(e) => updateEditingEntry('isr_tax', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">IMSS (Empleado)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.imss_employee}
                        onChange={(e) => updateEditingEntry('imss_employee', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">INFONAVIT</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.infonavit}
                        onChange={(e) => updateEditingEntry('infonavit', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">💳 Préstamos / Adelantos</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.loans_deduction}
                        onChange={(e) => updateEditingEntry('loans_deduction', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">⚠️ Penalidades / Otras Deducciones</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.other_deductions}
                        onChange={(e) => updateEditingEntry('other_deductions', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-red-100 focus:bg-white"
                        placeholder="Agregar penalidad..."
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-red-200">
                    <div className="flex justify-between text-lg font-bold text-red-700">
                      <span>Total Deducciones:</span>
                      <span>-{formatCurrency(editingEntry.total_deductions)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">📝 Notas</label>
                <textarea
                  value={editingEntry.notes}
                  onChange={(e) => setEditingEntry({...editingEntry, notes: e.target.value})}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Razón del bono, penalidad, etc..."
                />
              </div>

              {/* Net Pay Summary */}
              <div className="mt-6 bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
                <div className="flex justify-between items-center">
                  <span className="text-lg">Pago Neto:</span>
                  <span className="text-3xl font-bold">{formatCurrency(editingEntry.net_pay)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => { setShowEditEntryModal(false); setEditingEntry(null); }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300"
                  disabled={savingEntry}
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEntry}
                  disabled={savingEntry}
                  className="flex-1 bg-black text-white px-4 py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingEntry ? '⏳ Guardando...' : '✓ Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PayrollManagement;

