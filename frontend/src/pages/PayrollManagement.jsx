import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./Payroll.css";

// Totals derived from the actual entries — the source of truth the detail
// table and the backend both use. The period-level total_* columns can go
// stale (e.g. a non-fiscal period whose deductions were later zeroed), so we
// never trust them for the confirmation total.
const num = (v) => parseFloat(v) || 0;
const periodTotals = (period) => {
  const entries = period?.entries || [];
  if (!entries.length) {
    return {
      gross: num(period?.total_gross),
      deductions: num(period?.total_deductions),
      net: num(period?.total_net),
    };
  }
  const gross = entries.reduce(
    (s, e) => s + num(e.base_salary) + num(e.overtime_pay) + num(e.bonuses) + num(e.commissions) + num(e.other_earnings),
    0
  );
  const deductions = entries.reduce(
    (s, e) => s + num(e.isr_tax) + num(e.imss_employee) + num(e.infonavit) + num(e.loans_deduction) + num(e.other_deductions),
    0
  );
  const net = entries.reduce((s, e) => s + num(e.net_pay), 0);
  return { gross, deductions, net };
};

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
  const [fiscalOn, setFiscalOn] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [stampReport, setStampReport] = useState(null);

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

      // Is the fiscal integration (contabilidad-os) available? Gates the
      // "Timbrar nómina fiscal" action.
      axios.get(`${API_BASE_URL}/api/income/cfdi/health`, { headers })
        .then((r) => setFiscalOn(!!r.data?.configured))
        .catch(() => setFiscalOn(false));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Stamp the fiscal CFDI de nómina for the open period in contabilidad-os.
  const stampPeriod = async () => {
    if (!selectedPeriod) return;
    if (!window.confirm("Se timbrará el CFDI de nómina de este periodo en contabilidad-os, usando el sueldo base como monto fiscal de cada colaborador. ¿Continuar?")) return;
    setStamping(true);
    setStampReport(null);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(`${API_BASE_URL}/api/hr/payroll/periods/${selectedPeriod.id}/stamp`, {}, { headers });
      setStampReport(res.data);
      await fetchPeriodDetails(selectedPeriod.id);
    } catch (error) {
      setStampReport({ error: error.response?.data?.error || "No se pudo timbrar la nómina" });
    } finally {
      setStamping(false);
    }
  };

  const createPeriod = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Validate month format
      if (!newPeriod.month || !newPeriod.month.includes('-')) {
        alert("Por favor selecciona un mes válido");
        return;
      }

      // Calculate dates based on period type
      const [year, month] = newPeriod.month.split('-');
      
      // Validate year and month
      if (!year || !month || year === 'undefined' || month === 'undefined') {
        alert("Formato de fecha inválido. Por favor selecciona el mes nuevamente.");
        return;
      }
      
      // Ensure month is zero-padded
      const monthPadded = month.padStart(2, '0');
      let start_date, end_date, period_name;
      
      if (newPeriod.period_type === '1ra_quincena') {
        start_date = `${year}-${monthPadded}-01`;
        end_date = `${year}-${monthPadded}-15`;
        period_name = `1ra Quincena ${getMonthName(monthPadded)} ${year}`;
      } else {
        start_date = `${year}-${monthPadded}-16`;
        // Last day of month - using proper date calculation
        const lastDay = new Date(parseInt(year), parseInt(monthPadded), 0).getDate();
        const lastDayPadded = String(lastDay).padStart(2, '0');
        end_date = `${year}-${monthPadded}-${lastDayPadded}`;
        period_name = `2da Quincena ${getMonthName(monthPadded)} ${year}`;
      }

      console.log('Creating period with dates:', { start_date, end_date, period_name });

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
      console.error('Error creating payroll period:', error);
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
    const monthNum = parseInt(month, 10);
    return months[monthNum] || month;
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { cls: 'open', label: 'Abierto' },
      open: { cls: 'open', label: 'Abierto' },
      processing: { cls: 'processing', label: 'Procesando' },
      paid: { cls: 'paid', label: 'Pagado' },
      closed: { cls: 'closed', label: 'Cerrado' }
    };
    const badge = badges[status] || badges.draft;
    return <span className={`zxnom-pill ${badge.cls}`}>{badge.label}</span>;
  };

  // Calculate totals for active employees (quincenal = monthly / 2)
  const totalQuincenalWages = employees
    .filter(e => e.is_active && e.monthly_wage)
    .reduce((sum, e) => sum + (parseFloat(e.monthly_wage) / 2), 0);

  if (loading) {
    return (
      <Layout>
        <div className="zxnom">
          <div className="zxnom-loading">Cargando nómina…</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxnom">
        <div className="zxnom-inner">
          {/* Header */}
          <div className="zxnom-head">
            <div>
              <div className="zxnom-eyebrow">Recursos Humanos</div>
              <h1 className="zxnom-h1">Nómina <span className="zxnom-serif">Quincenal</span></h1>
              <p className="zxnom-sub">
                {employees.length} empleados activos • Quincena estimada: {formatCurrency(totalQuincenalWages)}
              </p>
            </div>
            <div className="zxnom-actions">
              <Link to="/hr/employees" className="zxnom-btn">Empleados</Link>
              <Link to="/hr/financials" className="zxnom-btn">Finanzas</Link>
              <button onClick={() => setShowCreateModal(true)} className="zxnom-btn solid">
                Nueva Quincena
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="zxnom-tiles">
            <div className="zxnom-tile">
              <div className="k">Períodos Abiertos</div>
              <div className="v">{periods.filter(p => p.status === 'open' || p.status === 'draft').length}</div>
            </div>
            <div className="zxnom-tile">
              <div className="k">Pagados este Año</div>
              <div className="v">{periods.filter(p => p.status === 'paid').length}</div>
            </div>
            <div className="zxnom-tile">
              <div className="k">Empleados Activos</div>
              <div className="v">{employees.length}</div>
            </div>
            <div className="zxnom-tile lead">
              <div className="k">Quincena Estimada</div>
              <div className="v">{formatCurrency(totalQuincenalWages)}</div>
            </div>
          </div>

          {/* Periods List */}
          <div className="zxnom-panel">
            <div className="zxnom-panel-head">
              <h2>Períodos de Nómina</h2>
            </div>

            <div className="zxnom-tablewrap">
              <table className="zxnom-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Fechas</th>
                    <th className="c">Empleados</th>
                    <th className="r">Total Bruto</th>
                    <th className="r">Total Neto</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.length > 0 ? (
                    periods.map((period) => (
                      <tr key={period.id}>
                        <td className="name">{period.period_name}</td>
                        <td style={{ color: 'var(--muted)' }}>
                          {new Date(period.start_date).toLocaleDateString('es-MX')} - {new Date(period.end_date).toLocaleDateString('es-MX')}
                        </td>
                        <td className="c">{period.entry_count || 0}</td>
                        <td className="r money">{formatCurrency(period.calculated_gross || period.total_gross)}</td>
                        <td className="r net">{formatCurrency(period.calculated_net || period.total_net)}</td>
                        <td>{getStatusBadge(period.status)}</td>
                        <td>
                          <div className="zxnom-rowactions">
                            {(period.status === 'open' || period.status === 'draft') && (
                              <>
                                {(!period.entry_count || parseInt(period.entry_count) === 0) ? (
                                  <button
                                    onClick={() => generateEntries(period.id)}
                                    className="zxnom-link"
                                  >
                                    Generar Registros
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => fetchPeriodDetails(period.id)}
                                      className="zxnom-link"
                                    >
                                      Editar Incidencias
                                    </button>
                                    <button
                                      onClick={() => { fetchPeriodDetails(period.id); setShowProcessModal(true); }}
                                      className="zxnom-btn ok"
                                    >
                                      Procesar Pago
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => fetchPeriodDetails(period.id)}
                                  className="zxnom-link muted"
                                >
                                  Ver
                                </button>
                              </>
                            )}
                            {period.status === 'paid' && (
                              <button
                                onClick={() => fetchPeriodDetails(period.id)}
                                className="zxnom-link muted"
                              >
                                Ver Detalle
                              </button>
                            )}
                            {period.status !== 'paid' && (
                              <button
                                onClick={() => deletePeriod(period.id, period.period_name)}
                                className="zxnom-link danger"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="zxnom-empty">
                        <span className="big">—</span>
                        <p>No hay períodos de nómina creados</p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="zxnom-link"
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
            <div className="zxnom-panel">
              <div className="zxnom-panel-head">
                <h2>Detalle: {selectedPeriod.period_name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {fiscalOn && selectedPeriod.entries?.length > 0 && (
                    <button onClick={stampPeriod} className="zxnom-link" disabled={stamping}>
                      {stamping ? "Timbrando…" : "Timbrar nómina fiscal"}
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedPeriod(null); setStampReport(null); }}
                    className="zxnom-link muted"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              {stampReport && (
                <div className={`zxnom-stamp-report${stampReport.error ? " error" : ""}`}>
                  {stampReport.error
                    ? stampReport.error
                    : `Timbradas ${stampReport.stamped}${stampReport.failed ? ` · ${stampReport.failed} con error` : ""}${stampReport.skipped ? ` · ${stampReport.skipped} ya timbradas` : ""}.`}
                  {stampReport.results?.some((r) => r.status === "error") && (
                    <ul className="zxnom-stamp-errors">
                      {stampReport.results.filter((r) => r.status === "error").map((r) => (
                        <li key={r.id}>{r.employee_name}: {r.error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="zxnom-panel-body">
                {selectedPeriod.entries?.length > 0 ? (
                  <div className="zxnom-tablewrap">
                  <table className="zxnom-table">
                    <thead>
                      <tr>
                        <th>Empleado</th>
                        <th>Puesto</th>
                        <th className="r">Sueldo Base</th>
                        <th className="r">Bonos</th>
                        <th className="r">ISR</th>
                        <th className="r">IMSS</th>
                        <th className="r">Otras Ded.</th>
                        <th className="r">Neto</th>
                        {fiscalOn && <th>CFDI</th>}
                        {selectedPeriod.status !== 'paid' && (
                          <th className="c">Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPeriod.entries.map((entry) => {
                        const bonusTotal = (parseFloat(entry.bonuses) || 0) + (parseFloat(entry.commissions) || 0) + (parseFloat(entry.other_earnings) || 0);
                        const otherDed = (parseFloat(entry.loans_deduction) || 0) + (parseFloat(entry.other_deductions) || 0) + (parseFloat(entry.infonavit) || 0);
                        return (
                          <tr key={entry.id}>
                            <td className="name">
                              {entry.employee_name}
                              {entry.notes && <span className="zxnom-note-flag" title={entry.notes}>✎</span>}
                            </td>
                            <td style={{ color: 'var(--muted)' }}>{entry.role}</td>
                            <td className="r money">{formatCurrency(entry.base_salary)}</td>
                            <td className="r money pos">
                              {bonusTotal > 0 ? `+${formatCurrency(bonusTotal)}` : '-'}
                            </td>
                            <td className="r money neg">-{formatCurrency(entry.isr_tax)}</td>
                            <td className="r money neg">-{formatCurrency(entry.imss_employee)}</td>
                            <td className="r money neg">
                              {otherDed > 0 ? `-${formatCurrency(otherDed)}` : '-'}
                            </td>
                            <td className="r net">{formatCurrency(entry.net_pay)}</td>
                            {fiscalOn && (
                              <td>
                                {entry.cfdi_uuid ? (
                                  <span className="zxnom-cfdi ok" title={entry.cfdi_uuid}>Timbrada {String(entry.cfdi_uuid).slice(-6)}</span>
                                ) : entry.cfdi_error ? (
                                  <span className="zxnom-cfdi err" title={entry.cfdi_error}>Error</span>
                                ) : (
                                  <span className="zxnom-cfdi muted">Sin timbrar</span>
                                )}
                              </td>
                            )}
                            {selectedPeriod.status !== 'paid' && (
                              <td className="c">
                                <button
                                  onClick={() => openEditEntry(entry)}
                                  className="zxnom-link"
                                >
                                  Editar
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2">TOTALES</td>
                        <td className="r">
                          {formatCurrency(selectedPeriod.entries.reduce((s, e) => s + parseFloat(e.base_salary), 0))}
                        </td>
                        <td className="r pos">
                          +{formatCurrency(selectedPeriod.entries.reduce((s, e) => s + (parseFloat(e.bonuses) || 0) + (parseFloat(e.commissions) || 0) + (parseFloat(e.other_earnings) || 0), 0))}
                        </td>
                        <td className="r neg">
                          -{formatCurrency(selectedPeriod.entries.reduce((s, e) => s + parseFloat(e.isr_tax), 0))}
                        </td>
                        <td className="r neg">
                          -{formatCurrency(selectedPeriod.entries.reduce((s, e) => s + parseFloat(e.imss_employee), 0))}
                        </td>
                        <td className="r neg">
                          -{formatCurrency(selectedPeriod.entries.reduce((s, e) => s + (parseFloat(e.loans_deduction) || 0) + (parseFloat(e.other_deductions) || 0) + (parseFloat(e.infonavit) || 0), 0))}
                        </td>
                        <td className="r net">
                          {formatCurrency(selectedPeriod.entries.reduce((s, e) => s + parseFloat(e.net_pay), 0))}
                        </td>
                        {selectedPeriod.status !== 'paid' && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                ) : (
                  <p className="zxnom-empty">
                    No hay registros. Haz clic en "Generar Registros" para crear los registros de nómina.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Create Period Modal */}
        {showCreateModal && (
          <div className="zxnom-scrim">
            <div className="zxnom-modal">
              <div className="zxnom-modal-head">
                <h2>Nueva Quincena</h2>
                <button type="button" onClick={() => setShowCreateModal(false)} className="zxnom-x">×</button>
              </div>

              <form onSubmit={createPeriod} className="zxnom-form">
                <div className="zxnom-field">
                  <label className="zxnom-label">Mes</label>
                  <input
                    type="month"
                    value={newPeriod.month}
                    onChange={(e) => setNewPeriod({...newPeriod, month: e.target.value})}
                    className="zxnom-input"
                    required
                  />
                </div>

                <div className="zxnom-field">
                  <label className="zxnom-label">Quincena</label>
                  <div className="zxnom-seg">
                    <button
                      type="button"
                      onClick={() => setNewPeriod({...newPeriod, period_type: '1ra_quincena'})}
                      className={`zxnom-segbtn ${newPeriod.period_type === '1ra_quincena' ? 'active' : ''}`}
                    >
                      <div className="t">1ra Quincena</div>
                      <div className="d">Días 1-15</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPeriod({...newPeriod, period_type: '2da_quincena'})}
                      className={`zxnom-segbtn ${newPeriod.period_type === '2da_quincena' ? 'active' : ''}`}
                    >
                      <div className="t">2da Quincena</div>
                      <div className="d">Días 16-31</div>
                    </button>
                  </div>
                </div>

                <div className="zxnom-field">
                  <label className="zxnom-label">Fecha de Pago (opcional)</label>
                  <input
                    type="date"
                    value={newPeriod.payment_date}
                    onChange={(e) => setNewPeriod({...newPeriod, payment_date: e.target.value})}
                    className="zxnom-input"
                  />
                </div>

                <div className="zxnom-field">
                  <label className="zxnom-label">Notas (opcional)</label>
                  <textarea
                    value={newPeriod.notes}
                    onChange={(e) => setNewPeriod({...newPeriod, notes: e.target.value})}
                    rows={2}
                    className="zxnom-input"
                  />
                </div>

                <div className="zxnom-modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="zxnom-btn"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="zxnom-btn solid"
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
          <div className="zxnom-scrim">
            <div className="zxnom-modal">
              <div className="zxnom-modal-head">
                <h2>Confirmar Pago de Nómina</h2>
                <button
                  onClick={() => { setShowProcessModal(false); setSelectedPeriod(null); }}
                  className="zxnom-x"
                >×</button>
              </div>

              <div className="zxnom-break">
                <div className="period-k">Período</div>
                <div className="period-v">{selectedPeriod.period_name}</div>

                {(() => {
                  const totals = periodTotals(selectedPeriod);
                  return (
                    <div className="zxnom-break-rows">
                      <div className="zxnom-brow">
                        <span className="lbl">Empleados</span>
                        <span className="val">{selectedPeriod.entries?.length || 0}</span>
                      </div>
                      <div className="zxnom-brow">
                        <span className="lbl">Total Bruto (Percepciones)</span>
                        <span className="val">{formatCurrency(totals.gross)}</span>
                      </div>
                      <div className="zxnom-brow">
                        <span className="lbl">Deducciones</span>
                        <span className="val neg">
                          {totals.deductions > 0 ? `-${formatCurrency(totals.deductions)}` : formatCurrency(0)}
                        </span>
                      </div>
                      <div className="zxnom-brow total">
                        <span className="lbl">Total a Pagar (Neto)</span>
                        <span className="val">{formatCurrency(totals.net)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <p className="zxnom-warnline">
                Al confirmar, se crearán los asientos contables correspondientes.
              </p>

              <div className="zxnom-modal-actions">
                <button
                  onClick={() => { setShowProcessModal(false); setSelectedPeriod(null); }}
                  className="zxnom-btn"
                >
                  Cancelar
                </button>
                <button
                  onClick={processPayroll}
                  className="zxnom-btn ok"
                >
                  Confirmar Pago
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Entry Modal */}
        {showEditEntryModal && editingEntry && (
          <div className="zxnom-scrim">
            <div className="zxnom-modal wide">
              <div className="zxnom-modal-head">
                <h2>Editar Nómina — {editingEntry.employee_name}</h2>
                <button
                  onClick={() => { setShowEditEntryModal(false); setEditingEntry(null); }}
                  className="zxnom-x"
                >
                  ×
                </button>
              </div>

              <div className="zxnom-cols2">
                {/* Earnings Section */}
                <div className="zxnom-group earn">
                  <h3>Percepciones</h3>

                  <div className="fields">
                    <div className="zxnom-field">
                      <label className="zxnom-label">Sueldo Base</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.base_salary}
                        onChange={(e) => updateEditingEntry('base_salary', e.target.value)}
                        className="zxnom-input money"
                      />
                    </div>

                    <div className="zxnom-grid2">
                      <div className="zxnom-field">
                        <label className="zxnom-label">Hrs Extra</label>
                        <input
                          type="number"
                          step="0.5"
                          value={editingEntry.overtime_hours}
                          onChange={(e) => updateEditingEntry('overtime_hours', e.target.value)}
                          className="zxnom-input money"
                        />
                      </div>
                      <div className="zxnom-field">
                        <label className="zxnom-label">Pago Hrs Extra</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry.overtime_pay}
                          onChange={(e) => updateEditingEntry('overtime_pay', e.target.value)}
                          className="zxnom-input money"
                        />
                      </div>
                    </div>

                    <div className="zxnom-field">
                      <label className="zxnom-label">Bonos</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.bonuses}
                        onChange={(e) => updateEditingEntry('bonuses', e.target.value)}
                        className="zxnom-input money"
                        placeholder="Agregar bono..."
                      />
                    </div>

                    <div className="zxnom-field">
                      <label className="zxnom-label">Comisiones</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.commissions}
                        onChange={(e) => updateEditingEntry('commissions', e.target.value)}
                        className="zxnom-input money"
                      />
                    </div>

                    <div className="zxnom-field">
                      <label className="zxnom-label">Otras Percepciones</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.other_earnings}
                        onChange={(e) => updateEditingEntry('other_earnings', e.target.value)}
                        className="zxnom-input money"
                      />
                    </div>
                  </div>

                  <div className="zxnom-group-total">
                    <span>Total Bruto</span>
                    <span>{formatCurrency(editingEntry.gross_pay)}</span>
                  </div>
                </div>

                {/* Deductions Section */}
                <div className="zxnom-group ded">
                  <h3>Deducciones</h3>

                  <div className="fields">
                    <div className="zxnom-field">
                      <label className="zxnom-label">ISR</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.isr_tax}
                        onChange={(e) => updateEditingEntry('isr_tax', e.target.value)}
                        className="zxnom-input money"
                      />
                    </div>

                    <div className="zxnom-field">
                      <label className="zxnom-label">IMSS (Empleado)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.imss_employee}
                        onChange={(e) => updateEditingEntry('imss_employee', e.target.value)}
                        className="zxnom-input money"
                      />
                    </div>

                    <div className="zxnom-field">
                      <label className="zxnom-label">INFONAVIT</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.infonavit}
                        onChange={(e) => updateEditingEntry('infonavit', e.target.value)}
                        className="zxnom-input money"
                      />
                    </div>

                    <div className="zxnom-field">
                      <label className="zxnom-label">Préstamos / Adelantos</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.loans_deduction}
                        onChange={(e) => updateEditingEntry('loans_deduction', e.target.value)}
                        className="zxnom-input money"
                      />
                    </div>

                    <div className="zxnom-field">
                      <label className="zxnom-label">Penalidades / Otras Deducciones</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingEntry.other_deductions}
                        onChange={(e) => updateEditingEntry('other_deductions', e.target.value)}
                        className="zxnom-input money"
                        placeholder="Agregar penalidad..."
                      />
                    </div>
                  </div>

                  <div className="zxnom-group-total">
                    <span>Total Deducciones</span>
                    <span>-{formatCurrency(editingEntry.total_deductions)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="zxnom-field" style={{ marginTop: '16px' }}>
                <label className="zxnom-label">Notas</label>
                <textarea
                  value={editingEntry.notes}
                  onChange={(e) => setEditingEntry({...editingEntry, notes: e.target.value})}
                  rows={2}
                  className="zxnom-input"
                  placeholder="Razón del bono, penalidad, etc..."
                />
              </div>

              {/* Net Pay Summary */}
              <div className="zxnom-netbar">
                <span className="lbl">Pago Neto</span>
                <span className="amt">{formatCurrency(editingEntry.net_pay)}</span>
              </div>

              {/* Actions */}
              <div className="zxnom-modal-actions" style={{ marginTop: '18px' }}>
                <button
                  onClick={() => { setShowEditEntryModal(false); setEditingEntry(null); }}
                  className="zxnom-btn"
                  disabled={savingEntry}
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEntry}
                  disabled={savingEntry}
                  className="zxnom-btn solid"
                >
                  {savingEntry ? 'Guardando…' : 'Guardar Cambios'}
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

