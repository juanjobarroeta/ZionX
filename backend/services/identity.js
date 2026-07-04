// ============================================================================
// Identity bridge: employees.id → users.id
//
// ZionX has three unlinked "person" tables: `users` (login accounts),
// `employees` (content assignees: designer / CM / approver), and `team_members`
// (tasks). Content is assigned by employees.id, but notifications are addressed
// by users.id — so notifications inserted with an employee id never reached the
// person (the "silent bell"). The tables share no FK; the only real link is the
// email address (login already bridges them by email). This resolves an
// employee to their login user via that email match.
// ============================================================================

/**
 * Map a list of employee ids to their matching login users.id (by email,
 * case-insensitive). Returns a Map(employeeId → userId); employees with no
 * matching active login are simply absent from the map.
 */
async function userIdsForEmployees(pool, employeeIds) {
  const ids = [...new Set((employeeIds || []).filter((v) => v != null))];
  if (!ids.length) return new Map();
  const { rows } = await pool.query(
    `SELECT e.id AS employee_id, u.id AS user_id
       FROM employees e
       JOIN users u ON LOWER(u.email) = LOWER(e.email)
      WHERE e.id = ANY($1::int[]) AND u.is_active = true`,
    [ids]
  );
  const map = new Map();
  for (const r of rows) map.set(r.employee_id, r.user_id);
  return map;
}

/**
 * Map team_members ids to users.id. team_members already carries a user_id FK,
 * so prefer that; fall back to an email match for rows created before it was set.
 */
async function userIdsForTeamMembers(pool, teamMemberIds) {
  const ids = [...new Set((teamMemberIds || []).filter((v) => v != null))];
  if (!ids.length) return new Map();
  const { rows } = await pool.query(
    `SELECT tm.id AS team_member_id,
            COALESCE(tm.user_id, u.id) AS user_id
       FROM team_members tm
       LEFT JOIN users u ON u.is_active = true AND LOWER(u.email) = LOWER(tm.email)
      WHERE tm.id = ANY($1::int[])`,
    [ids]
  );
  const map = new Map();
  for (const r of rows) if (r.user_id != null) map.set(r.team_member_id, r.user_id);
  return map;
}

/**
 * Given employee-id fields (assignees) and user-id fields (already users.id,
 * e.g. content_calendar.submitted_by which stores req.user.id), return the
 * deduped set of users.id to notify. Employee ids that resolve to no login are
 * dropped so we never insert a notification nobody can read.
 */
async function resolveNotifyUserIds(pool, { employeeIds = [], userIds = [] } = {}) {
  const empToUser = await userIdsForEmployees(pool, employeeIds);
  const out = new Set();
  for (const eid of employeeIds) {
    const uid = empToUser.get(eid);
    if (uid != null) out.add(uid);
  }
  for (const uid of userIds) if (uid != null) out.add(uid);
  return [...out];
}

module.exports = { userIdsForEmployees, userIdsForTeamMembers, resolveNotifyUserIds };
