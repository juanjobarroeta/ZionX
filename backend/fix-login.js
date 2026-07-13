/**
 * fix-login.js — diagnose and (optionally) repair a single user's login.
 *
 * Non-interactive, safe (touches one user, never deletes). Run as a Railway
 * one-off command where DATABASE_URL is already in the environment.
 *
 * Diagnose only:
 *   node fix-login.js you@example.com
 *
 * Reset password + activate the account:
 *   node fix-login.js you@example.com 'NewPassword123'
 *
 * Args may also come from env: EMAIL, NEW_PASSWORD.
 */
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  const email = process.argv[2] || process.env.EMAIL;
  const newPassword = process.argv[3] || process.env.NEW_PASSWORD;

  if (!email) {
    console.error('Usage: node fix-login.js <email> [newPassword]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in the environment.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
  });

  try {
    // Case-insensitive lookup — the same match the login route now uses.
    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE LOWER(email) = LOWER($1) ORDER BY id',
      [email]
    );

    if (rows.length === 0) {
      console.log(`\nNo user found with email "${email}" (case-insensitive).`);
      const all = await pool.query('SELECT id, email, is_active FROM users ORDER BY id LIMIT 25');
      console.log(`\nExisting users (${all.rows.length} shown):`);
      all.rows.forEach((u) => console.log(`  #${u.id}  ${u.email}  is_active=${u.is_active}`));
      console.log('\nCheck for a typo/different email above, then re-run with the exact address.');
      await pool.end();
      return;
    }

    console.log(`\nFound ${rows.length} matching row(s):`);
    rows.forEach((u) =>
      console.log(`  #${u.id}  ${u.email}  role=${u.role}  is_active=${u.is_active}  created=${u.created_at}`)
    );

    const target = rows[0];
    if (!newPassword) {
      console.log('\nDiagnosis:');
      if (target.is_active === false) {
        console.log('  • is_active = false → login is blocked. Re-run with a password to reactivate + reset.');
      } else if (target.is_active === null) {
        console.log('  • is_active = NULL → the updated login treats this as active. If login still fails,');
        console.log('    the password is the issue — re-run with a new password to reset it.');
      } else {
        console.log('  • Account is active. If login fails, the password is wrong — re-run with a new password.');
      }
      console.log('\nNo changes made (diagnose-only; pass a password to repair).');
      await pool.end();
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const upd = await pool.query(
      'UPDATE users SET password = $1, is_active = true WHERE id = $2 RETURNING id, email, role, is_active',
      [hashed, target.id]
    );
    console.log('\n✅ Updated:');
    console.log(`  #${upd.rows[0].id}  ${upd.rows[0].email}  role=${upd.rows[0].role}  is_active=${upd.rows[0].is_active}`);
    console.log('\nPassword reset and account activated. You can now log in with the new password.');
    await pool.end();
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

main();
