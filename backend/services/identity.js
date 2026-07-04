// ============================================================================
// Identity resolution, standardized on team_members.
//
// The person table in this app is `team_members` — it holds the team (HR fields,
// payroll, the assignment dropdown all use it) and, crucially, it already has a
// `user_id` FK to the login `users` table. Content is assigned by team_members.id
// (content-calendar-schema.sql: "assigned_designer -- Team member ID").
//
// (`employees` is a phantom: never created in the repo, only referenced by some
// read JOINs — a latent bug. Everything identity-related resolves through
// team_members here, via the user_id FK, with an email fallback for legacy rows
// created before user_id was populated.)
// ============================================================================

/**
 * Login users.id → their team_members.id. Prefers the user_id FK; falls back to
 * an email match for rows created before the FK was set. null if no match.
 */
async function teamMemberIdForUser(pool, userId) {
  if (userId == null) return null;
  const { rows } = await pool.query(
    `SELECT id
       FROM team_members
      WHERE is_active = true
        AND (user_id = $1
             OR (user_id IS NULL AND LOWER(email) = (SELECT LOWER(email) FROM users WHERE id = $1)))
      ORDER BY (user_id = $1) DESC
      LIMIT 1`,
    [userId]
  );
  return rows.length ? rows[0].id : null;
}

/**
 * Map team_members ids → users.id (for addressing notifications). Prefers the
 * user_id FK; email fallback for legacy rows. Returns Map(teamMemberId → userId).
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
 * Resolve a mix of member-id fields (assignees — team_members.id) and user-id
 * fields (already users.id, e.g. content_calendar.submitted_by which stores
 * req.user.id) into the deduped set of users.id to notify. Assignees with no
 * resolvable login are dropped so we never write a notification nobody can read.
 */
async function resolveNotifyUserIds(pool, { memberIds = [], userIds = [] } = {}) {
  const memberToUser = await userIdsForTeamMembers(pool, memberIds);
  const out = new Set();
  for (const mid of memberIds) {
    const uid = memberToUser.get(mid);
    if (uid != null) out.add(uid);
  }
  for (const uid of userIds) if (uid != null) out.add(uid);
  return [...out];
}

module.exports = { teamMemberIdForUser, userIdsForTeamMembers, resolveNotifyUserIds };
