// Resolve a display name for a customer record.
//
// The `customers` table started life in the loan app (first_name/last_name) and
// was later extended for marketing (business_name/commercial_name/contact_*).
// Records created the old way (or imported incompletely) have no business_name,
// so a naive `business_name || 'Cliente N'` shows a wall of "Cliente 2, 3, …".
// This falls through every name field that might be populated before giving up.
export const customerName = (c) => {
  if (!c) return "Cliente";
  const clean = (s) => (s || "").toString().trim();
  const businessContact = [clean(c.contact_first_name), clean(c.contact_last_name)].filter(Boolean).join(" ").trim();
  const personName = [clean(c.first_name), clean(c.last_name)].filter(Boolean).join(" ").trim();
  return (
    clean(c.business_name) ||
    clean(c.commercial_name) ||
    businessContact ||
    personName ||
    clean(c.contact_email) ||
    clean(c.email) ||
    `Cliente ${c.id}`
  );
};
