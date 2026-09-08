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

// Sólo se cacheaban los ACIERTOS: con una contraseña equivocada, cada petición
// al hub volvía a intentar el login —y hub() reintenta una vez más al recibir
// 401—, así que el scheduler y cada carga de página sumaban intentos durante
// días hasta que el hub bloqueó la cuenta con un 429. Ahora el fallo también se
// recuerda, con espera creciente, y no se vuelve a intentar hasta que toca.
let _failUntil = 0;
let _failError = null;
let _failCount = 0;

const BACKOFF_MS = 60 * 1000;          // primer fallo: un minuto
const BACKOFF_MAX_MS = 30 * 60 * 1000; // techo: media hora
const BACKOFF_429_MS = 15 * 60 * 1000; // si el hub dice «demasiados», se le hace caso

// La espera vivía sólo en memoria, así que cada redespliegue la borraba y el
// primer request volvía a intentar contra un hub que seguía bloqueando —
// arrancando una ventana nueva. Se guarda en sync_runs, que ya existe para
// llevar el ritmo de los trabajos, bajo el nombre `conta_hub_login`.
const ESTADO_JOB = 'conta_hub_login';
let _pool = null;
/** Lo llama index.js una vez: el módulo no crea su propia conexión. */
function usarPool(pool) {
  _pool = pool;
  cargarEstado().catch(() => {});
}

async function cargarEstado() {
  if (!_pool) return;
  const { rows } = await _pool.query(
    'SELECT last_detail, last_run_at FROM sync_runs WHERE job = $1', [ESTADO_JOB]
  );
  if (!rows.length || !rows[0].last_detail) return;
  try {
    const g = JSON.parse(rows[0].last_detail);
    if (g.failUntil && g.failUntil > Date.now()) {
      _failUntil = g.failUntil;
      _failError = g.error || 'Fallo previo';
      _failCount = g.count || 1;
      const min = Math.ceil((_failUntil - Date.now()) / 60000);
      console.log(`⏳ contabilidad-os: en espera ${min} min por un fallo anterior (no se reintenta hasta entonces)`);
    }
  } catch { /* dato viejo o corrupto: se ignora */ }
}

async function guardarEstado() {
  if (!_pool) return;
  const payload = JSON.stringify({ failUntil: _failUntil, error: _failError, count: _failCount });
  await _pool.query(
    `INSERT INTO sync_runs (job, last_run_at, last_status, last_detail)
     VALUES ($1, NOW(), $2, $3)
     ON CONFLICT (job) DO UPDATE SET last_run_at = NOW(), last_status = $2, last_detail = $3`,
    [ESTADO_JOB, _failUntil > Date.now() ? 'esperando' : 'ok', payload]
  ).catch((e) => console.error('contaHub: no se pudo guardar el estado del login:', e.message));
}

function anotarFallo(status, mensaje) {
  _failCount += 1;
  const espera = status === 429
    ? Math.max(BACKOFF_429_MS, Math.min(BACKOFF_MS * 2 ** _failCount, BACKOFF_MAX_MS))
    : Math.min(BACKOFF_MS * 2 ** (_failCount - 1), BACKOFF_MAX_MS);
  _failUntil = Date.now() + espera;
  _failError = mensaje;
  guardarEstado();
}

async function login() {
  const c = CFG();
  let res;
  try {
    res = await fetch(`${c.url}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: c.email, password: c.password }),
    });
  } catch (err) {
    anotarFallo(0, `No se pudo alcanzar contabilidad-os: ${err.message}`);
    throw new Error(_failError);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    anotarFallo(res.status, `Hub login failed (${res.status}): ${body.slice(0, 200)}`);
    throw new Error(_failError);
  }
  const data = await res.json();
  _token = data.token;
  // Refresh a little before the 7-day expiry; treat as 6 days to be safe.
  _tokenExp = Date.now() + 6 * 24 * 60 * 60 * 1000;
  _failUntil = 0; _failError = null; _failCount = 0;
  guardarEstado();
  return _token;
}

/** Segundos que faltan para el próximo intento, o null si no hay espera. */
function esperaRestante() {
  const ms = _failUntil - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : null;
}

/** Reintentar ya, sin esperar: para cuando alguien acaba de cambiar la clave. */
function olvidarFallo() {
  _failUntil = 0; _failError = null; _failCount = 0;
  guardarEstado();
}

async function token() {
  if (_token && Date.now() < _tokenExp) return _token;
  // Dentro de la ventana de espera no se toca la red: se repite el último
  // motivo. Insistir es lo que provocó el bloqueo.
  if (Date.now() < _failUntil) {
    const seg = Math.ceil((_failUntil - Date.now()) / 1000);
    const err = new Error(`${_failError} (reintento en ${seg}s)`);
    err.retryInSeconds = seg;
    throw err;
  }
  return login();
}

// Authenticated hub request. Retries once after a fresh login on 401.
async function hub(path, { method = "GET", body, retry = true } = {}) {
  const c = CFG();
  const eraCacheado = Boolean(_token);
  const res = await fetch(`${c.url}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await token()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // Un 401 sólo significa «token viejo» si el token venía cacheado. Si acabamos
  // de emitirlo, el 401 es de permisos y reloguear no arregla nada: sólo quema
  // otro intento contra el mismo login que ya está al límite.
  if (res.status === 401 && retry && eraCacheado) {
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
async function listInvoices({ q, take = 50, tipo, skip, from, to, customerId } = {}) {
  if (!isConfigured()) return [];
  const c = CFG();
  // El hub topa en 200 por página y no devuelve un total: quien quiera todos
  // pagina con skip hasta que una página venga incompleta.
  const params = new URLSearchParams({ companyId: c.companyId, take: String(Math.min(take, 200)) });
  if (q) params.set("q", q);
  if (tipo) params.set("tipo", tipo);
  if (skip) params.set("skip", String(skip));
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (customerId) params.set("customerId", customerId);
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

// GET /api/empleados?companyId — the company's employees (id, rfc, nombre,
// salarioDiario, puesto, nss…). Used to map ZionX team members by RFC before
// stamping, and to surface the roster on the Nómina Fiscal page.
async function listEmployees({ withUltimoRecibo = false } = {}) {
  const c = CFG();
  const params = new URLSearchParams({ companyId: c.companyId });
  if (withUltimoRecibo) params.set("withUltimoRecibo", "1");
  return hub(`/api/empleados?${params.toString()}`);
}

// POST /api/nomina/emit — stamp a fiscal CFDI de nómina for one employee.
// sueldoBruto is OPTIONAL and normally omitted: ContaOS derives the fiscal
// amount from the employee's registered salarioDiario (its historic recibo
// standard). Only pass sueldoBruto to deliberately override that.
async function emitNomina({ employeeId, periodoInicio, periodoFin, diasPagados, fechaPago, sueldoBruto }) {
  const c = CFG();
  const body = { companyId: c.companyId, employeeId, periodoInicio, periodoFin, diasPagados, fechaPago };
  if (sueldoBruto != null) body.sueldoBruto = sueldoBruto;
  return hub(`/api/nomina/emit`, { method: "POST", body });
}

// GET /api/contabilidad/estado-resultados — income statement (P&L) for a month.
async function estadoResultados(year, month) {
  const c = CFG();
  return hub(`/api/contabilidad/estado-resultados?companyId=${encodeURIComponent(c.companyId)}&year=${year}&month=${month}`);
}

/**
 * El estado de resultados con la Contabilidad Electrónica como columna
 * vertebral: lo DECLARADO —la balanza ya presentada al SAT— manda, y lo
 * derivado de los CFDIs va al lado como evidencia, con la diferencia.
 *
 * Un período que todavía no se presenta devuelve `presentado: false` y sólo la
 * columna derivada, marcada preliminar: dice dónde va a cerrar el mes antes de
 * que el contador lo cierre.
 *
 * Ojo: este endpoint usa `anio`/`mes`, no `year`/`month` como los otros.
 *
 * @param {boolean} ytd acumulado desde enero del ejercicio.
 */
async function ceEstadoResultados(year, month, { ytd = false } = {}) {
  const c = CFG();
  const p = new URLSearchParams({ companyId: c.companyId, anio: String(year), mes: String(month) });
  if (ytd) p.set('ytd', '1');
  return hub(`/api/contabilidad/ce-estado-resultados?${p.toString()}`);
}

/**
 * Balance general con la CE como columna vertebral, igual que el estado de
 * resultados: lo declarado manda y lo derivado va al lado.
 */
async function ceBalanceGeneral(year, month) {
  const c = CFG();
  const p = new URLSearchParams({ companyId: c.companyId, anio: String(year), mes: String(month) });
  return hub(`/api/contabilidad/ce-balance-general?${p.toString()}`);
}

/** Declaraciones capturadas del ejercicio: mensuales de IVA/ISR y la anual. */
async function declaraciones(year) {
  const c = CFG();
  const p = new URLSearchParams({ companyId: c.companyId, year: String(year) });
  return hub(`/api/declaraciones/historial?${p.toString()}`);
}

/** Acuses que faltan — lo que impide arrastrar saldos a favor y coeficiente. */
async function declaracionesCobertura() {
  const c = CFG();
  return hub(`/api/declaraciones/cobertura?companyId=${encodeURIComponent(c.companyId)}`);
}

/**
 * El estado de cada período contable: DRAFT, POSTED o CLOSED, con cuántos
 * asientos tiene. Es lo que convierte una pantalla vacía en una explicación:
 * un mes sin cifras puede ser un mes sin CFDIs, un mes con CFDIs que nadie ha
 * contabilizado, o un mes anterior a la apertura del libro. Son tres problemas
 * distintos y sólo uno se arregla desde aquí.
 */
async function periodos() {
  const c = CFG();
  return hub(`/api/contabilidad/periods?companyId=${encodeURIComponent(c.companyId)}`);
}

/**
 * De una cuenta del estado de resultados a los documentos que la forman.
 *
 * El último escalón: cada renglón trae su CFDI —folio fiscal, contraparte,
 * importe— y los asientos sin comprobante (banco, depreciación, ajustes) vienen
 * con `invoice: null`. Esos no se esconden a propósito: sin ellos la suma de
 * los documentos no cuadraría contra el renglón, que es justo lo que alguien
 * va a verificar.
 */
async function cuentaDocumentos(cuenta, year, month, { ytd = false, limit = 200 } = {}) {
  const c = CFG();
  const p = new URLSearchParams({
    companyId: c.companyId, cuenta, anio: String(year), mes: String(month), limit: String(limit),
  });
  if (ytd) p.set('ytd', '1');
  return hub(`/api/contabilidad/cuenta-documentos?${p.toString()}`);
}

/** La representación impresa parseada del XML guardado. */
async function cfdiRepresentacion(invoiceId) {
  return hub(`/api/facturas/${encodeURIComponent(invoiceId)}/representacion`);
}

/**
 * El XML tal cual lo entregó el SAT — el comprobante de verdad.
 * hub() devuelve { raw } cuando la respuesta no es JSON, que es este caso.
 */
async function cfdiXml(invoiceId) {
  const r = await hub(`/api/facturas/${encodeURIComponent(invoiceId)}/download?format=xml`);
  return typeof r === 'string' ? r : (r?.raw ?? null);
}

/**
 * ¿La integración de verdad funciona?
 *
 * `isConfigured()` sólo mira que las cuatro variables no estén vacías. Con una
 * contraseña equivocada seguía diciendo que sí mientras cada llamada daba 401
 * —y eso pasó tres días sin que nadie lo notara, con el timbrado caído—. Esto
 * intenta el login real y dice qué encontró.
 *
 * @returns {Promise<{configured, ok, error?}>}
 */
async function health({ force = false } = {}) {
  if (!isConfigured()) {
    const c = CFG();
    const faltan = ['url', 'email', 'password', 'companyId'].filter((k) => !c[k]);
    return { configured: false, ok: false, error: `Falta configurar: ${faltan.join(', ')}` };
  }
  // Mirar cómo está no puede ser lo que lo rompa: sin `force`, esto respeta la
  // ventana de espera igual que cualquier otra llamada.
  if (force) olvidarFallo();
  try {
    await token();
    return { configured: true, ok: true };
  } catch (err) {
    return {
      configured: true, ok: false, error: err.message,
      retryInSeconds: err.retryInSeconds ?? esperaRestante(),
    };
  }
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
  listPayrollRuns, getPayrollRun, estadoResultados, ceEstadoResultados, balanza, health,
  ceBalanceGeneral, declaraciones, declaracionesCobertura, olvidarFallo, esperaRestante, usarPool,
  cuentaDocumentos, cfdiRepresentacion, cfdiXml, periodos,
  listEmployees, emitNomina,
};
