// ============================================================================
// Server-side section authorization.
//
// Until now access control was CLIENT-ONLY: the sidebar hid pages by role, but
// every business API sat behind authenticateToken with no role check — so any
// logged-in token (e.g. a designer's) could call payroll, income, or publishing
// endpoints directly. This mirrors frontend/src/config/roles.js server-side and
// fails CLOSED: unknown / unlisted roles are denied.
//
// The JWT carries a signed `role` (middleware/auth.js generateToken), so
// req.user.role is trustworthy.
// ============================================================================

// section → roles allowed (admin is always allowed, added implicitly)
const SECTION_ROLES = {
  social_media: ['account_manager', 'community_manager', 'designer', 'copywriter'],
  clients: ['account_manager'],
  leads: ['account_manager'],
  ingresos: ['accountant'],
  hr: ['accountant', 'hr_manager'],
  finanzas: ['accountant'],
  settings: [],
};

/**
 * Require the caller's role to have access to `section`. Admin always passes.
 * Must run after authenticateToken (needs req.user.role).
 */
function requireSection(section) {
  const allowed = SECTION_ROLES[section] || [];
  return (req, res, next) => {
    const role = req.user && req.user.role;
    if (role === 'admin' || allowed.includes(role)) return next();
    return res.status(403).json({ message: 'No tienes permiso para esta sección' });
  };
}

/** Require the caller's role to be one of `roles` (admin always passes). */
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user && req.user.role;
    if (role === 'admin' || roles.includes(role)) return next();
    return res.status(403).json({ message: 'No tienes permiso para esta acción' });
  };
}

module.exports = { requireSection, requireRole, SECTION_ROLES };
