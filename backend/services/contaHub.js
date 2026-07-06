/**
 * contabilidad-os hub client — the fiscal bridge.
 *
 * ZionX stays the operations front-end; the hub (contabilidad-os) is the fiscal
 * brain that stamps real CFDIs. This module mirrors a ZionX invoice into the hub
 * as a stamped CFDI and links it back by UUID. It is fully config-gated: with no
 * env configured, isConfigured() is false and callers no-op — ZionX behaves
 * exactly as before.
 *
 * Auth: POST {HUB}/api/auth/token {email,password} -> 7-day bearer JWT (cached).
 * The hub enforces multi-tenancy by companyId + the MARKETING module server-side.
 *
 * Required env to activate:
 *   CONTA_OS_URL         e.g. https://contabilidad-os-production.up.railway.app
 *   CONTA_OS_EMAIL       a hub user that is a member of the company (>= ACCOUNTANT)
 *   CONTA_OS_PASSWORD
 *   CONTA_OS_COMPANY_ID  the hub Company (agency RFC) to bill from
 * Optional fiscal defaults (sensible for a marketing agency):
 *   CONTA_OS_PRODUCT_KEY (SAT claveProdServ, default 82101500 = publicidad)
 *   CONTA_OS_UNIT_KEY    (SAT claveUnidad, default E48 = unidad de servicio)
 *   CONTA_OS_USO_CFDI    (default G03 = gastos en general)
 *   CONTA_OS_IVA_RATE    (default 0.16)
 */

const CFG = () => ({
  url: (process.env.CONTA_OS_URL || "").replace(/\/$/, ""),
  email: process.env.CONTA_OS_EMAIL || "",
  password: process.env.CONTA_OS_PASSWORD || "",
  companyId: process.env.CONTA_OS_COMPANY_ID || "",
  productKey: process.env.CONTA_OS_PRODUCT_KEY || "82101500",
  unitKey: process.env.CONTA_OS_UNIT_KEY || "E48",
  usoCfdi: process.env.CONTA_OS_USO_CFDI || "G03",
  ivaRate: parseFloat(process.env.CONTA_OS_IVA_RATE || "0.16"),
});

const isConfigured = () => {
  const c = CFG();
  return !!(c.url && c.email && c.password && c.companyId);
};

// In-memory token cache (7-day tokens; re-login on expiry or 401).
let _token = null;
let _tokenExp = 0;

async function login() {
  const c = CFG();
  const res = await fetch(`${c.url}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: c.email, password: c.password }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hub login failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  _token = data.token;
  // Refresh a little before the 7-day expiry; treat as 6 days to be safe.
  _tokenExp = Date.now() + 6 * 24 * 60 * 60 * 1000;
  return _token;
}

async function token() {
  if (_token && Date.now() < _tokenExp) return _token;
  return login();
}

// Authenticated hub request. Retries once after a fresh login on 401.
async function hub(path, { method = "GET", body, retry = true } = {}) {
  const c = CFG();
  const res = await fetch(`${c.url}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await token()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry) {
    _token = null;
    return hub(path, { method, body, retry: false });
  }
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.error?.formErrors?.join?.(", ") || json?.error || json?.message || text.slice(0, 200);
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    throw err;
  }
  return json;
}

// Find the hub receptor (Customer) for an RFC, or create it. The hub keys
// customers by (companyId, rfc) and syncs them to Facturapi.
async function ensureReceptor(customer) {
  const c = CFG();
  const rfc = (customer.rfc || "").toUpperCase().trim();
  if (!rfc) throw new Error("El cliente no tiene RFC — requerido para timbrar");

  const list = await hub(`/api/clientes?companyId=${encodeURIComponent(c.companyId)}&q=${encodeURIComponent(rfc)}`);
  const existing = Array.isArray(list) ? list.find((x) => (x.rfc || "").toUpperCase() === rfc) : null;
  if (existing) return existing;

  return hub(`/api/clientes`, {
    method: "POST",
    body: {
      companyId: c.companyId,
      rfc,
      razonSocial: customer.business_name || customer.commercial_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
      regimenFiscal: customer.tax_regime || "",
      codigoPostal: customer.fiscal_postal_code || "",
      email: customer.contact_email || customer.email || undefined,
    },
  });
}

// Map ZionX payment_method text to a SAT formaPago code (c_FormaPago).
const FORMA_PAGO = {
  transferencia: "03", transfer: "03", spei: "03",
  efectivo: "01", cash: "01",
  tarjeta: "04", card: "04",
  cheque: "02",
  deposito: "03",
};
const formaPagoCode = (pm) => FORMA_PAGO[(pm || "").toLowerCase()] || process.env.CONTA_OS_FORMA_PAGO || "03";

// Build the /api/facturas item list from ZionX invoice line items.
function buildItems(lineItems, cfg) {
  return (lineItems || []).map((it) => {
    const price = Number(it.unit_price) || 0;
    return {
      quantity: Number(it.quantity) || 1,
      product: {
        description: it.description || "Servicio",
        product_key: cfg.productKey,
        unit_key: cfg.unitKey,
        price,
        tax_included: false,
        taxes: [{ type: "IVA", rate: cfg.ivaRate, factor: "Tasa", withholding: false }],
      },
    };
  });
}

/**
 * Mirror a ZionX invoice into the hub as a stamped CFDI.
 * @returns { uuid, hubId, status } on success.
 */
async function stampInvoice({ invoice, customer, items }) {
  if (!isConfigured()) throw new Error("Integración con contabilidad-os no configurada");
  const c = CFG();
  const receptor = await ensureReceptor(customer);
  if (!receptor?.facturapiId) {
    throw new Error("El receptor no está sincronizado con Facturapi en el hub");
  }

  const payload = {
    companyId: c.companyId,
    customerId: receptor.id,
    formaPago: formaPagoCode(invoice.payment_method),
    metodoPago: (Number(invoice.amount_paid) >= Number(invoice.total) && Number(invoice.total) > 0) ? "PUE" : "PUE",
    usoCfdi: customer.uso_cfdi || c.usoCfdi,
    items: buildItems(items, c),
    notes: invoice.notes || `Factura ${invoice.invoice_number}`,
  };

  const created = await hub(`/api/facturas`, { method: "POST", body: payload });
  return {
    uuid: created.uuid || null,
    hubId: created.id || null,
    status: created.status || "STAMPED",
    pdfUrl: created.pdfUrl || (created.id ? `${c.url}/api/facturas/${created.id}/representacion` : null),
  };
}

// Surface: list the company's CFDIs from the hub (for read-only mirroring).
// tipo filters by INGRESO | EGRESO | NOMINA | PAGO; skip paginates.
async function listInvoices({ q, take = 50, tipo, skip } = {}) {
  if (!isConfigured()) return [];
  const c = CFG();
  const params = new URLSearchParams({ companyId: c.companyId, take: String(take) });
  if (q) params.set("q", q);
  if (tipo) params.set("tipo", tipo);
  if (skip) params.set("skip", String(skip));
  return hub(`/api/facturas?${params.toString()}`);
}

// =====================================================
// BANCOS — bank reconciliation mirror.
// ContaOS is the source of truth for bank data + conciliación. These call the
// hub's /api/bancos endpoints (bearer-auth) so ZionX reads AND writes the same
// records — a reconciliation done in either app shows in both. Raw hub JSON is
// returned; bancos-routes normalizes it to the ZionX frontend shape.
// =====================================================

// GET /api/bancos?companyId — accounts with per-account stats.
async function listBankAccounts() {
  const c = CFG();
  return hub(`/api/bancos?companyId=${encodeURIComponent(c.companyId)}`);
}

// POST /api/bancos — create an account under the agency's company.
async function createBankAccount(body) {
  const c = CFG();
  return hub(`/api/bancos`, { method: "POST", body: { companyId: c.companyId, ...body } });
}

// GET /api/bancos/:id — paginated transactions + statusCounts.
async function listBankTransactions(accountId, { status, page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) params.set("status", status);
  return hub(`/api/bancos/${accountId}?${params.toString()}`);
}

// GET /api/bancos/:id/match?txId — scored match candidates for a movement.
async function bankCandidates(accountId, txId) {
  return hub(`/api/bancos/${accountId}/match?txId=${encodeURIComponent(txId)}`);
}

// POST /api/bancos/:id/match — run the auto-match engine on the account.
async function autoConciliar(accountId) {
  return hub(`/api/bancos/${accountId}/match`, { method: "POST" });
}

// PATCH /api/bancos/transactions/:txId — match / ignore / unmatch / unignore.
async function applyBankTx(txId, body) {
  return hub(`/api/bancos/transactions/${txId}`, { method: "PATCH", body });
}

// POST /api/bancos/:id/upload — import a statement into the shared source.
async function uploadBankStatement(accountId, { fileContent, filename, encoding }) {
  return hub(`/api/bancos/${accountId}/upload`, { method: "POST", body: { fileContent, filename, encoding } });
}

// =====================================================
// NÓMINA + ESTADOS FINANCIEROS — read-only mirror.
// ContaOS is the fiscal source of truth; ZionX surfaces payroll runs and
// financial statements over the hub (bearer-auth, scoped to companyId).
// =====================================================

// GET /api/nomina/run?companyId — payroll runs (periodo, totals, status).
async function listPayrollRuns() {
  const c = CFG();
  return hub(`/api/nomina/run?companyId=${encodeURIComponent(c.companyId)}`);
}

// GET /api/nomina/run/:id — a run with its per-employee receipts.
async function getPayrollRun(runId) {
  return hub(`/api/nomina/run/${runId}`);
}

// GET /api/empleados?companyId — the company's employees (id, rfc, nombre).
// Used to map ZionX team members to ContaOS employees by RFC before stamping.
async function listEmployees() {
  const c = CFG();
  return hub(`/api/empleados?companyId=${encodeURIComponent(c.companyId)}`);
}

// POST /api/nomina/emit — stamp a fiscal CFDI de nómina for one employee.
// body: { employeeId, periodoInicio, periodoFin, diasPagados, fechaPago, sueldoBruto }
async function emitNomina({ employeeId, periodoInicio, periodoFin, diasPagados, fechaPago, sueldoBruto }) {
  const c = CFG();
  return hub(`/api/nomina/emit`, {
    method: "POST",
    body: { companyId: c.companyId, employeeId, periodoInicio, periodoFin, diasPagados, fechaPago, sueldoBruto },
  });
}

// GET /api/contabilidad/estado-resultados — income statement (P&L) for a month.
async function estadoResultados(year, month) {
  const c = CFG();
  return hub(`/api/contabilidad/estado-resultados?companyId=${encodeURIComponent(c.companyId)}&year=${year}&month=${month}`);
}

// GET /api/contabilidad/balanza — trial balance for a month.
async function balanza(year, month) {
  const c = CFG();
  return hub(`/api/contabilidad/balanza?companyId=${encodeURIComponent(c.companyId)}&year=${year}&month=${month}`);
}

module.exports = {
  isConfigured, stampInvoice, ensureReceptor, listInvoices, CFG,
  listBankAccounts, createBankAccount, listBankTransactions, bankCandidates,
  autoConciliar, applyBankTx, uploadBankStatement,
  listPayrollRuns, getPayrollRun, estadoResultados, balanza,
  listEmployees, emitNomina,
};
