#!/usr/bin/env node
/**
 * Migrate bulk-uploaded customer data out of the `address` blob into real columns.
 *
 * The client import crammed every field into `customers.address` as a
 * pipe-delimited "Key: Value | Key: Value" string. This parses that blob and
 * fills the proper columns (business_name, commercial_name, rfc, tax_regime,
 * fiscal_postal_code, …) so clients are usable — and invoiceable (CFDI needs
 * the real RFC / Razón Social / CP / régimen).
 *
 * SAFE BY DESIGN:
 *   - DRY RUN by default: prints exactly what each row would become. Writes only
 *     with `--apply`.
 *   - Fills EMPTY columns only — never overwrites data that's already there.
 *   - Never touches `address` (the source blob is preserved).
 *   - Idempotent: re-running does nothing once columns are filled.
 *   - Surfaces every blob key it doesn't recognize, so the mapping can be
 *     extended before applying.
 *
 * Usage:
 *   node backend/scripts/migrate-customer-blobs.js           # dry run (no writes)
 *   node backend/scripts/migrate-customer-blobs.js --apply   # write the changes
 *   node backend/scripts/migrate-customer-blobs.js --limit 5 # sample N rows
 */

const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
      port: process.env.PGPORT || process.env.DB_PORT || 5432,
      user: process.env.PGUSER || process.env.DB_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.PGDATABASE || process.env.DB_NAME || 'zionx',
    });

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normKey = (k) => stripAccents(String(k).toLowerCase().trim()).replace(/\s+/g, ' ');

// blob key (normalized, accent-free) → customers column
const KEY_MAP = {
  'marca': 'commercial_name',
  'nombre comercial': 'commercial_name',
  'razon social': 'business_name',
  'nombre': 'business_name',
  'empresa': 'business_name',
  'rfc': 'rfc',
  'regimen fiscal': 'tax_regime',
  'regimen': 'tax_regime',
  'giro': 'industry',
  'industria': 'industry',
  'codigo postal': 'fiscal_postal_code',
  'c.p.': 'fiscal_postal_code',
  'cp': 'fiscal_postal_code',
  'direccion fiscal': 'fiscal_address',
  'direccion': 'fiscal_address',
  'domicilio': 'fiscal_address',
  'domicilio fiscal': 'fiscal_address',
  'ciudad': 'fiscal_city',
  'municipio': 'fiscal_city',
  'estado': 'fiscal_state',
  'correo': 'contact_email',
  'email': 'contact_email',
  'e-mail': 'contact_email',
  'correo electronico': 'contact_email',
  'telefono': 'contact_phone',
  'tel': 'contact_phone',
  'celular': 'contact_mobile',
  'movil': 'contact_mobile',
  'whatsapp': 'contact_mobile',
  'contacto': 'contact_position',
  'puesto': 'contact_position',
  'sitio web': 'website',
  'pagina web': 'website',
  'web': 'website',
  'website': 'website',
};

// Column length caps (Postgres will reject over-long values otherwise).
const MAXLEN = {
  business_name: 255, commercial_name: 255, rfc: 13, tax_regime: 100, industry: 100,
  fiscal_postal_code: 10, fiscal_city: 100, fiscal_state: 100, website: 255,
  contact_email: 100, contact_phone: 20, contact_mobile: 20, contact_position: 100,
};

const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

function parseBlob(address) {
  const out = [];
  String(address || '').split('|').forEach((part) => {
    const i = part.indexOf(':');
    if (i > -1) {
      const key = part.slice(0, i).trim();
      const val = part.slice(i + 1).trim();
      if (key && val) out.push([key, val]);
    }
  });
  return out;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limIdx = process.argv.indexOf('--limit');
  const limit = limIdx > -1 ? parseInt(process.argv[limIdx + 1], 10) : null;

  const { rows } = await pool.query(
    `SELECT * FROM customers ORDER BY id ${limit ? `LIMIT ${limit}` : ''}`
  );

  const unmapped = new Map();
  const colFill = new Map();
  const plan = [];

  for (const c of rows) {
    const set = {};
    for (const [rawKey, rawVal] of parseBlob(c.address)) {
      const col = KEY_MAP[normKey(rawKey)];
      if (!col) { unmapped.set(rawKey, (unmapped.get(rawKey) || 0) + 1); continue; }
      if (!isEmpty(c[col])) continue;         // never overwrite
      if (set[col]) continue;                  // first value wins
      const val = MAXLEN[col] ? rawVal.slice(0, MAXLEN[col]) : rawVal;
      set[col] = val;
      colFill.set(col, (colFill.get(col) || 0) + 1);
    }
    if (Object.keys(set).length) plan.push({ id: c.id, set });
  }

  // ---- report ----
  console.log(`\n${apply ? '⚙️  APPLY' : '🔎 DRY RUN'} — ${rows.length} customers scanned, ${plan.length} would change\n`);
  for (const { id, set } of plan.slice(0, 60)) {
    const parts = Object.entries(set).map(([k, v]) => `${k}="${v}"`).join('  ');
    console.log(`  #${id}  ${parts}`);
  }
  if (plan.length > 60) console.log(`  … and ${plan.length - 60} more`);

  console.log('\nColumns that would be filled:');
  [...colFill.entries()].sort((a, b) => b[1] - a[1]).forEach(([col, n]) => console.log(`  ${col.padEnd(20)} ${n}`));

  if (unmapped.size) {
    console.log('\n⚠️  Unrecognized blob keys (NOT migrated — extend KEY_MAP if any matter):');
    [...unmapped.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  "${k}"  ×${n}`));
  } else {
    console.log('\n✅ Every blob key was recognized.');
  }

  if (apply) {
    let updated = 0;
    for (const { id, set } of plan) {
      const cols = Object.keys(set);
      const setSql = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
      await pool.query(`UPDATE customers SET ${setSql}, updated_at = NOW() WHERE id = $${cols.length + 1}`,
        [...cols.map((c) => set[c]), id]);
      updated++;
    }
    console.log(`\n✅ Applied — ${updated} customers updated (empty columns only; address left intact).`);
  } else {
    console.log('\nNo changes written. Re-run with --apply once this looks right.');
  }

  await pool.end();
}

main().catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
