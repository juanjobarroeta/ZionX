// =====================================================
// BELVO (open banking) — STUB
//
// ZionX ships manual statement upload first. This module keeps the same surface
// as the contabilidad-os Belvo client so an automatic bank feed can be dropped
// in later without touching the routes: set BELVO_SECRET_ID / BELVO_SECRET_PASSWORD
// (and BELVO_ENV) and implement the fetch calls below.
// =====================================================

function isBelvoConfigured() {
  return Boolean(process.env.BELVO_SECRET_ID && process.env.BELVO_SECRET_PASSWORD);
}

const NOT_CONFIGURED = new Error('Belvo no está configurado');
NOT_CONFIGURED.code = 'BELVO_NOT_CONFIGURED';

// Placeholder implementations — throw until credentials + integration land.
async function createWidgetToken() {
  throw NOT_CONFIGURED;
}
async function listAccounts() {
  throw NOT_CONFIGURED;
}
async function listTransactions() {
  throw NOT_CONFIGURED;
}

module.exports = { isBelvoConfigured, createWidgetToken, listAccounts, listTransactions };
