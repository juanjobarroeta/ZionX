/**
 * Post production pipeline — owned, stateful stages layered on top of a
 * content_calendar entry (a "post").
 *
 * Where publishSync.computeReadiness() gives a stateless "is it ready?" checklist,
 * this module gives each post an ordered list of *owned* stages that move through
 * their own status lifecycle (pendiente → en_progreso → listo, or → cambios). The
 * owner of each stage is inherited from the client's roster (see customers roster
 * fields) at seed time, so work auto-routes to the right person.
 *
 * publishSync is untouched and keeps working; this is additive.
 */

// Stage status lifecycle.
const STAGE_STATUSES = ["pendiente", "en_progreso", "listo", "cambios"];

// Roster field names on `customers` that own stages.
const ROSTER_FIELDS = ["assigned_designer", "assigned_community", "assigned_senior"];

/**
 * The canonical pipeline: ordered stages, each with its position, whether it is
 * optional, and which roster field on the client owns it (null = the client
 * themselves, e.g. client_approval).
 */
const CANONICAL_STAGES = [
  { stage_key: "design",            position: 1, optional: false, roster_field: "assigned_designer" },
  { stage_key: "copy",             position: 2, optional: false, roster_field: "assigned_community" },
  { stage_key: "music",            position: 3, optional: true,  roster_field: "assigned_designer" },
  { stage_key: "internal_approval", position: 4, optional: false, roster_field: "assigned_senior" },
  { stage_key: "client_approval",   position: 5, optional: false, roster_field: null },
  { stage_key: "paid_promo",        position: 6, optional: true,  roster_field: "assigned_senior" },
  { stage_key: "schedule",          position: 7, optional: false, roster_field: "assigned_community" },
];

const STAGE_KEYS = CANONICAL_STAGES.map((s) => s.stage_key);
const isValidStageKey = (k) => STAGE_KEYS.includes(k);
const stageDef = (k) => CANONICAL_STAGES.find((s) => s.stage_key === k) || null;

/**
 * The next non-optional stage after `stageKey` (by position). Used to route the
 * "listo para tu etapa" notification. Returns the stage def or null.
 */
function nextRequiredStage(stageKey) {
  const cur = stageDef(stageKey);
  if (!cur) return null;
  return (
    CANONICAL_STAGES
      .filter((s) => s.position > cur.position && !s.optional)
      .sort((a, b) => a.position - b.position)[0] || null
  );
}

/**
 * Seed the 7 canonical stages for a post, inheriting each owner from the client's
 * roster. Idempotent (ON CONFLICT DO NOTHING on the (content_calendar_id,
 * stage_key) unique key) and best-effort — never throws; returns true on success,
 * false if it swallowed an error (e.g. table not migrated yet).
 */
async function seedStagesForPost(pool, postId) {
  try {
    const { rows } = await pool.query(
      `SELECT cc.id AS post_id,
              c.assigned_designer, c.assigned_community, c.assigned_senior
         FROM content_calendar cc
         LEFT JOIN customers c ON c.id = cc.customer_id
        WHERE cc.id = $1`,
      [postId]
    );
    if (!rows.length) return false;
    const roster = rows[0];

    for (const s of CANONICAL_STAGES) {
      const ownerId = s.roster_field ? (roster[s.roster_field] ?? null) : null;
      await pool.query(
        `INSERT INTO post_pipeline_stages
           (content_calendar_id, stage_key, owner_id, status, optional, position)
         VALUES ($1, $2, $3, 'pendiente', $4, $5)
         ON CONFLICT (content_calendar_id, stage_key) DO NOTHING`,
        [postId, s.stage_key, ownerId, s.optional, s.position]
      );
    }
    return true;
  } catch (err) {
    console.error(`⚠️ seedStagesForPost(${postId}) skipped:`, err.message);
    return false;
  }
}

/**
 * Set one stage's status directly (used by the approval flows to keep the
 * pipeline in sync with the real approval state). Seed-safe: if the post's
 * stages don't exist yet, seed them first. Best-effort — never throws.
 * Returns the updated row or null.
 */
async function setStageStatus(pool, postId, stageKey, status) {
  try {
    if (!isValidStageKey(stageKey) || !STAGE_STATUSES.includes(status)) return null;
    let upd = await pool.query(
      `UPDATE post_pipeline_stages SET status = $3, updated_at = NOW()
        WHERE content_calendar_id = $1 AND stage_key = $2 RETURNING *`,
      [postId, stageKey, status]
    );
    if (!upd.rows.length) {
      await seedStagesForPost(pool, postId);
      upd = await pool.query(
        `UPDATE post_pipeline_stages SET status = $3, updated_at = NOW()
          WHERE content_calendar_id = $1 AND stage_key = $2 RETURNING *`,
        [postId, stageKey, status]
      );
    }
    return upd.rows[0] || null;
  } catch (err) {
    console.error(`⚠️ setStageStatus(${postId}, ${stageKey}) skipped:`, err.message);
    return null;
  }
}

/**
 * After a stage is completed, nudge the next *required* stage from 'pendiente'
 * to 'en_progreso' so work visibly flows to the next owner. Only touches a
 * still-pending stage (never overrides en_progreso/listo/cambios). Best-effort.
 * Returns the advanced stage row or null.
 */
async function advanceAfter(pool, postId, stageKey) {
  try {
    const next = nextRequiredStage(stageKey);
    if (!next) return null;
    const { rows } = await pool.query(
      `UPDATE post_pipeline_stages SET status = 'en_progreso', updated_at = NOW()
        WHERE content_calendar_id = $1 AND stage_key = $2 AND status = 'pendiente'
        RETURNING *`,
      [postId, next.stage_key]
    );
    return rows[0] || null;
  } catch (err) {
    console.error(`⚠️ advanceAfter(${postId}, ${stageKey}) skipped:`, err.message);
    return null;
  }
}

module.exports = {
  CANONICAL_STAGES,
  STAGE_KEYS,
  STAGE_STATUSES,
  ROSTER_FIELDS,
  isValidStageKey,
  stageDef,
  nextRequiredStage,
  seedStagesForPost,
  setStageStatus,
  advanceAfter,
};
