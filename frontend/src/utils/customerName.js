// Resolve a display name for a customer record.
//
// The `customers` table started life in the loan app (first_name/last_name,
// address, curp…). Marketing clients were later bulk-uploaded, and the import
// crammed every field into `address` as a pipe-delimited blob, e.g.:
//   "Marca: Psiquiatra Abigail | Razón Social: KENIA … MARTINEZ ADAME | Giro: …"
// so business_name/commercial_name are empty and a naive `business_name ||
// 'Cliente N'` showed a wall of "Cliente 2, 3, …".
//
// Until the data is migrated into real columns (see backend follow-up), we parse
// the blob on read and prefer the brand (Marca) — what an agency calls a client.

// Parse "Key: Value | Key: Value" into a lowercased-key map. Tolerant of missing
// pieces and extra whitespace.
export const parseClientBlob = (address) => {
  const out = {};
  (address || "").toString().split("|").forEach((part) => {
    const i = part.indexOf(":");
    if (i > -1) {
      const key = part.slice(0, i).trim().toLowerCase();
      const val = part.slice(i + 1).trim();
      if (key && val) out[key] = val;
    }
  });
  return out;
};

const blobField = (address, ...keys) => {
  const map = parseClientBlob(address);
  for (const k of keys) if (map[k]) return map[k];
  return "";
};

export const marcaFromAddress = (address) => blobField(address, "marca");

export const customerName = (c) => {
  if (!c) return "Cliente";
  const clean = (s) => (s || "").toString().trim();
  const businessContact = [clean(c.contact_first_name), clean(c.contact_last_name)].filter(Boolean).join(" ").trim();
  const personName = [clean(c.first_name), clean(c.last_name)].filter(Boolean).join(" ").trim();
  return (
    clean(c.business_name) ||
    clean(c.commercial_name) ||
    blobField(c.address, "marca", "nombre comercial") ||
    blobField(c.address, "razón social", "razon social") ||
    businessContact ||
    personName ||
    clean(c.contact_email) ||
    clean(c.email) ||
    `Cliente ${c.id}`
  );
};

// The person / legal entity behind a client, for a secondary line — when it
// differs from the primary (brand) name.
export const customerContact = (c) => {
  if (!c) return "";
  const clean = (s) => (s || "").toString().trim();
  const person = [clean(c.contact_first_name) || clean(c.first_name), clean(c.contact_last_name) || clean(c.last_name)]
    .filter(Boolean).join(" ").trim();
  return person || blobField(c.address, "razón social", "razon social");
};
