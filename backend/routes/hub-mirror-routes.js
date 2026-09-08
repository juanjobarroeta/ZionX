const express = require('express');
const contaHub = require('../services/contaHub');

// =====================================================
// HUB MIRROR ROUTES — read-only surfacing of contabilidad-os fiscal data.
// Nómina (payroll) and estados financieros (P&L + trial balance). Config-gated:
// when the hub isn't configured, endpoints return { configured: false } and the
// UI shows a "connect contabilidad-os" note instead of erroring.
// =====================================================

const nominaRouter = express.Router();
const estadosRouter = express.Router();

// ---- Nómina ----

// GET /api/nomina/runs — payroll runs (periodo, totals, status, #receipts).
nominaRouter.get('/nomina/runs', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.json({ configured: false, runs: [] });
    const runs = await contaHub.listPayrollRuns();
    res.json({ configured: true, runs: Array.isArray(runs) ? runs : [] });
  } catch (error) {
    console.error('Error listing payroll runs:', error.message);
    res.status(502).json({ configured: true, error: error.message, runs: [] });
  }
});

// GET /api/nomina/employees — the fiscal employee roster (name, RFC, NSS,
// puesto, SBC/SDI, last receipt). Surfaced even when there are no runs yet.
nominaRouter.get('/nomina/employees', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.json({ configured: false, employees: [] });
    const employees = await contaHub.listEmployees({ withUltimoRecibo: true });
    res.json({ configured: true, employees: Array.isArray(employees) ? employees : [] });
  } catch (error) {
    console.error('Error listing employees:', error.message);
    res.status(502).json({ configured: true, error: error.message, employees: [] });
  }
});

// GET /api/nomina/runs/:id — a run with its per-employee receipts.
nominaRouter.get('/nomina/runs/:id', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.status(503).json({ configured: false });
    const run = await contaHub.getPayrollRun(req.params.id);
    res.json({ configured: true, run });
  } catch (error) {
    console.error('Error fetching payroll run:', error.message);
    const status = error.status === 404 ? 404 : 502;
    res.status(status).json({ configured: true, error: error.message });
  }
});

// ---- Estados financieros ----

const now = () => new Date();
const defaultYear = () => now().getFullYear();
const defaultMonth = () => now().getMonth() + 1;

// GET /api/finance/estado-resultados?year=&month= — income statement (P&L).
estadosRouter.get('/finance/estado-resultados', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.json({ configured: false });
    const year = parseInt(req.query.year, 10) || defaultYear();
    const month = parseInt(req.query.month, 10) || defaultMonth();
    const data = await contaHub.estadoResultados(year, month);
    res.json({ configured: true, year, month, ...data });
  } catch (error) {
    console.error('Error fetching estado de resultados:', error.message);
    res.status(502).json({ configured: true, error: error.message });
  }
});

/**
 * El estado del período pedido, más el primero que existe en el libro.
 *
 * Con esos dos datos la pantalla distingue las tres razones por las que un mes
 * sale vacío: es anterior a la apertura, no tiene CFDIs, o los tiene y nadie
 * los ha contabilizado.
 */
let _periodosCache = { at: 0, rows: null };
async function periodoDe(_pool, hub, year, month) {
  if (Date.now() - _periodosCache.at > 60000 || !_periodosCache.rows) {
    const rows = await hub.periodos();
    _periodosCache = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] };
  }
  const rows = _periodosCache.rows;
  const mio = rows.find((r) => r.year === year && r.month === month) || null;
  // El más antiguo del libro: cualquier corte anterior no tiene de dónde salir.
  const primero = rows.reduce((min, r) => {
    if (!min) return r;
    return r.year < min.year || (r.year === min.year && r.month < min.month) ? r : min;
  }, null);
  return {
    estado: mio?.status || null,
    asientos: mio?.entriesCount ?? 0,
    existe: Boolean(mio),
    primero: primero ? { year: primero.year, month: primero.month } : null,
  };
}

// GET /api/finance/ce-estado-resultados?year=&month=&ytd= — el estado de
// resultados con la CE como columna vertebral: declarado vs derivado.
estadosRouter.get('/finance/ce-estado-resultados', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.json({ configured: false });
    const year = parseInt(req.query.year, 10) || defaultYear();
    const month = parseInt(req.query.month, 10) || defaultMonth();
    // El período viaja con la respuesta: si el mes sale vacío, la pantalla
    // tiene que poder decir por qué en vez de enseñar una tabla en blanco.
    const [data, periodo] = await Promise.all([
      contaHub.ceEstadoResultados(year, month, { ytd: req.query.ytd === '1' }),
      periodoDe(req.pool, contaHub, year, month).catch(() => null),
    ]);
    res.json({ configured: true, year, month, periodo, ...data });
  } catch (error) {
    console.error('Error fetching CE estado de resultados:', error.message);
    res.status(502).json({ configured: true, error: error.message });
  }
});

// GET /api/finance/balance?year=&month= — balance general (CE vs derivado).
estadosRouter.get('/finance/balance', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.json({ configured: false });
    const year = parseInt(req.query.year, 10) || defaultYear();
    const month = parseInt(req.query.month, 10) || defaultMonth();
    const data = await contaHub.ceBalanceGeneral(year, month);
    res.json({ configured: true, year, month, ...data });
  } catch (error) {
    console.error('Error fetching balance general:', error.message);
    res.status(502).json({ configured: true, error: error.message });
  }
});

// GET /api/finance/declaraciones?year= — lo presentado, y lo que falta.
estadosRouter.get('/finance/declaraciones', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.json({ configured: false, declaraciones: [] });
    const year = parseInt(req.query.year, 10) || defaultYear();
    // La cobertura es informativa: si falla, el historial sigue valiendo.
    const [historial, cobertura] = await Promise.all([
      contaHub.declaraciones(year),
      contaHub.declaracionesCobertura().catch(() => null),
    ]);
    res.json({ configured: true, year, ...historial, cobertura });
  } catch (error) {
    console.error('Error fetching declaraciones:', error.message);
    res.status(502).json({ configured: true, error: error.message, declaraciones: [] });
  }
});

// GET /api/finance/cuenta-documentos?cuenta=&year=&month=&ytd= — el desglose.
estadosRouter.get('/finance/cuenta-documentos', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.json({ configured: false, documentos: [] });
    const cuenta = String(req.query.cuenta || '').trim();
    if (!cuenta) return res.status(400).json({ error: 'cuenta requerida' });
    const year = parseInt(req.query.year, 10) || defaultYear();
    const month = parseInt(req.query.month, 10) || defaultMonth();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);
    const data = await contaHub.cuentaDocumentos(cuenta, year, month, { ytd: req.query.ytd === '1', limit });
    res.json({ configured: true, ...data });
  } catch (error) {
    console.error('Error fetching cuenta documentos:', error.message);
    res.status(502).json({ configured: true, error: error.message, documentos: [] });
  }
});

// GET /api/finance/cfdi/:id/representacion — lo legible, armado del XML.
estadosRouter.get('/finance/cfdi/:id/representacion', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.status(409).json({ error: 'Integración fiscal no configurada' });
    res.json(await contaHub.cfdiRepresentacion(req.params.id));
  } catch (error) {
    console.error('Error fetching CFDI representación:', error.message);
    res.status(502).json({ error: error.message });
  }
});

// GET /api/finance/cfdi/:id/xml — el comprobante de verdad, para descargar.
estadosRouter.get('/finance/cfdi/:id/xml', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.status(409).json({ error: 'Integración fiscal no configurada' });
    const xml = await contaHub.cfdiXml(req.params.id);
    if (!xml) return res.status(404).json({ error: 'Este CFDI no tiene XML guardado' });
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.xml"`);
    res.send(xml);
  } catch (error) {
    console.error('Error fetching CFDI XML:', error.message);
    res.status(502).json({ error: error.message });
  }
});

// GET /api/finance/hub-health — ¿la integración de verdad responde?
estadosRouter.get('/finance/hub-health', async (req, res) => {
  const result = await contaHub.health();
  res.status(result.ok ? 200 : 503).json(result);
});

// GET /api/finance/balanza?year=&month= — trial balance.
estadosRouter.get('/finance/balanza', async (req, res) => {
  try {
    if (!contaHub.isConfigured()) return res.json({ configured: false, rows: [] });
    const year = parseInt(req.query.year, 10) || defaultYear();
    const month = parseInt(req.query.month, 10) || defaultMonth();
    const data = await contaHub.balanza(year, month);
    res.json({ configured: true, year, month, ...data });
  } catch (error) {
    console.error('Error fetching balanza:', error.message);
    res.status(502).json({ configured: true, error: error.message, rows: [] });
  }
});

module.exports = { nominaRouter, estadosRouter };
