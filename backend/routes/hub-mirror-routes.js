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
