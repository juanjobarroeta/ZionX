// =====================================================
// BANK STATEMENT PARSER
//
// Ported from contabilidad-os (src/lib/bank-parser.ts), adapted to ZionX.
// Pure, dependency-light: parses CSV / OFX text into normalized transactions.
// Binary Excel (.xlsx/.xls) is converted to CSV upstream (via the `xlsx` dep in
// the route) and fed here as CSV text.
//
// Sign convention: monto positive = credit/deposit, negative = debit/withdrawal.
// Nothing is dropped silently — every skipped row is reported in `descartadas`.
// =====================================================

// ---- number parsing (MX + European formats) ----
function parseMXNumber(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  s = s.replace(/\$|MXN|USD|\s/gi, "");
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()]/g, "").replace(/^-/, "");
  // Decide decimal separator: if both , and . present, the last one is decimal.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // European: 1.234,56
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 1,234.56
      s = s.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    // Only comma: treat as decimal if it looks like one (2 trailing digits)
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;
  return neg ? -n : n;
}

// ---- date parsing (DD/MM/YYYY, YYYY-MM-DD, DD-MMM-YYYY) ----
const MONTHS = {
  ene: 0, jan: 0, feb: 1, mar: 2, abr: 3, apr: 3, may: 4, jun: 5, jul: 6,
  ago: 7, aug: 7, sep: 8, oct: 9, nov: 10, dic: 11, dec: 11,
};

function parseDateMX(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return atNoonUTC(+m[1], +m[2] - 1, +m[3]);

  // DD-MMM-YYYY / DD MMM YYYY (Spanish or English month)
  m = s.match(/^(\d{1,2})[-/\s]([a-zA-Z]{3,})[-/\s](\d{2,4})/);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon != null) return atNoonUTC(fullYear(+m[3]), mon, +m[1]);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) return atNoonUTC(fullYear(+m[3]), +m[2] - 1, +m[1]);

  return null;
}

function fullYear(y) {
  return y < 100 ? 2000 + y : y;
}
// Store at UTC noon so the calendar day is stable across timezones.
function atNoonUTC(y, mon, d) {
  const dt = new Date(Date.UTC(y, mon, d, 12, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// ---- CSV helpers ----
function detectSeparator(lines) {
  const seps = [";", ",", "\t", "|"];
  const counts = seps.map((sep) => ({
    sep,
    n: lines.slice(0, 30).reduce((a, l) => a + (l.split(sep).length - 1), 0),
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].sep : ",";
}

// Quoted-field-aware split.
function splitCSV(line, sep) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === sep && !inQ) {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const DATE_KW = ["fecha", "date", "fch"];
const DESC_KW = ["descrip", "concepto", "movimiento", "detalle", "memo", "referencia"];
const AMT_KW = ["monto", "importe", "amount", "cantidad"];
const DEBIT_KW = ["cargo", "debito", "débito", "egreso", "retiro", "debe"];
const CREDIT_KW = ["abono", "credito", "crédito", "ingreso", "deposito", "depósito", "haber"];
const BAL_KW = ["saldo", "balance", "disponible"];
const REF_KW = ["referencia", "reference", "folio"];

function findCol(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || "").toLowerCase();
    if (keywords.some((k) => h.includes(k))) return i;
  }
  return -1;
}

function parseCSV(content) {
  const rawLines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!rawLines.length) return { transactions: [], descartadas: [], warnings: ["Archivo vacío"] };

  const sep = detectSeparator(rawLines);

  // Find the header row within the first 25 lines (banks prepend summary rows).
  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(25, rawLines.length); i++) {
    const cols = splitCSV(rawLines[i], sep).map((c) => c.toLowerCase());
    const hasDate = cols.some((c) => DATE_KW.some((k) => c.includes(k)));
    const hasAmtOrDesc =
      cols.some((c) => AMT_KW.some((k) => c.includes(k))) ||
      cols.some((c) => DEBIT_KW.some((k) => c.includes(k))) ||
      cols.some((c) => CREDIT_KW.some((k) => c.includes(k))) ||
      cols.some((c) => DESC_KW.some((k) => c.includes(k)));
    if (hasDate && hasAmtOrDesc) { headerIdx = i; headers = splitCSV(rawLines[i], sep); break; }
  }
  if (headerIdx === -1) {
    return { transactions: [], descartadas: [], warnings: ["No se encontró una fila de encabezado reconocible (Fecha + Monto/Descripción)"] };
  }

  const cDate = findCol(headers, DATE_KW);
  const cDesc = findCol(headers, DESC_KW);
  const cAmt = findCol(headers, AMT_KW);
  const cDebit = findCol(headers, DEBIT_KW);
  const cCredit = findCol(headers, CREDIT_KW);
  const cBal = findCol(headers, BAL_KW);
  const cRef = findCol(headers, REF_KW);

  const transactions = [];
  const descartadas = [];
  const warnings = [];

  for (let i = headerIdx + 1; i < rawLines.length; i++) {
    const fila = i + 1;
    const cols = splitCSV(rawLines[i], sep);
    if (cols.every((c) => c === "")) continue;

    const fecha = parseDateMX(cols[cDate]);
    if (!fecha) { descartadas.push({ fila, motivo: `Fecha no reconocida: "${cols[cDate] ?? ""}"` }); continue; }

    let monto = NaN;
    if (cAmt > -1 && cols[cAmt] != null && cols[cAmt] !== "") {
      monto = parseMXNumber(cols[cAmt]);
    } else if (cDebit > -1 || cCredit > -1) {
      const debit = cDebit > -1 ? parseMXNumber(cols[cDebit]) : NaN;
      const credit = cCredit > -1 ? parseMXNumber(cols[cCredit]) : NaN;
      if (!Number.isNaN(credit) && Math.abs(credit) > 0) monto = Math.abs(credit);
      else if (!Number.isNaN(debit) && Math.abs(debit) > 0) monto = -Math.abs(debit);
    }
    if (Number.isNaN(monto)) { descartadas.push({ fila, motivo: "Monto no reconocido o vacío" }); continue; }

    const descripcion = (cDesc > -1 ? cols[cDesc] : "") || "Sin descripción";
    let referencia = cRef > -1 ? cols[cRef] : "";
    // Banamex embeds "Referencia Numérica: XXXX" in the description.
    const embedded = descripcion.match(/referencia\s*(?:num[eé]rica)?\s*:?\s*(\w+)/i);
    if (!referencia && embedded) referencia = embedded[1];
    const saldo = cBal > -1 ? parseMXNumber(cols[cBal]) : NaN;

    transactions.push({
      fecha,
      descripcion: descripcion.trim(),
      referencia: (referencia || "").trim() || null,
      monto: round2(monto),
      saldo: Number.isNaN(saldo) ? null : round2(saldo),
    });
  }

  if (!transactions.length && !descartadas.length) warnings.push("No se encontraron movimientos");
  return { transactions, descartadas, warnings };
}

// ---- OFX / QFX ----
function parseOFX(content) {
  const transactions = [];
  const descartadas = [];
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const tag = (block, name) => {
    const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
    return m ? m[1].trim() : "";
  };
  blocks.forEach((block, idx) => {
    const amt = parseMXNumber(tag(block, "TRNAMT"));
    const dRaw = tag(block, "DTPOSTED").slice(0, 8); // YYYYMMDD
    const fecha = dRaw.length === 8
      ? atNoonUTC(+dRaw.slice(0, 4), +dRaw.slice(4, 6) - 1, +dRaw.slice(6, 8))
      : null;
    if (!fecha || Number.isNaN(amt)) { descartadas.push({ fila: idx + 1, motivo: "Movimiento OFX incompleto" }); return; }
    const descripcion = (tag(block, "MEMO") || tag(block, "NAME") || "Sin descripción").trim();
    transactions.push({
      fecha,
      descripcion,
      referencia: tag(block, "FITID") || null,
      monto: round2(amt),
      saldo: null,
    });
  });
  return { transactions, descartadas, warnings: blocks.length ? [] : ["No se encontraron bloques STMTTRN en el archivo OFX"] };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// ---- entry point ----
// content: statement text (CSV, OFX, or Excel already converted to CSV).
// filename: used only to route OFX vs CSV.
function parseStatement(content, filename = "") {
  const name = (filename || "").toLowerCase();
  const looksOFX = name.endsWith(".ofx") || name.endsWith(".qfx") || /<OFX>|<STMTTRN>/i.test(content);
  const result = looksOFX ? parseOFX(content) : parseCSV(content);
  return {
    transactions: result.transactions || [],
    descartadas: result.descartadas || [],
    warnings: result.warnings || [],
  };
}

module.exports = { parseStatement, parseMXNumber, parseDateMX };
