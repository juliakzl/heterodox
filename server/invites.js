import db from './db.js';

function ensureInviteNameColumns() {
  try {
    const cols = db.prepare(`PRAGMA table_info(invites)`).all().map(r => r.name);
    if (!cols.includes('invitee_first_name')) {
      db.prepare(`ALTER TABLE invites ADD COLUMN invitee_first_name TEXT`).run();
    }
    if (!cols.includes('invitee_last_name')) {
      db.prepare(`ALTER TABLE invites ADD COLUMN invitee_last_name TEXT`).run();
    }
  } catch (e) {
    // Do not crash the app if PRAGMA/ALTER fails; just log
    console.warn('[invites] migration check failed:', e?.message || e);
  }
}

ensureInviteNameColumns();

export function createInvite({ token, inviterId, firstName, lastName, createdAt }) {
  // Build an INSERT that matches the current schema (fallback if migration didn't run)
  const cols = db.prepare(`PRAGMA table_info(invites)`).all().map(r => r.name);
  const hasNames = cols.includes('invitee_first_name') && cols.includes('invitee_last_name');

  if (hasNames) {
    return db.prepare(`
      INSERT INTO invites (token, inviter_id, invitee_first_name, invitee_last_name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(token, inviterId ?? null, firstName ?? null, lastName ?? null, createdAt);
  }

  // Fallback to legacy schema (no first/last name columns)
  return db.prepare(`
    INSERT INTO invites (token, inviter_id, created_at) VALUES (?, ?, ?)
  `).run(token, inviterId ?? null, createdAt);
}

export function getInvite(token) {
  return db.prepare(`SELECT * FROM invites WHERE token = ?`).get(token);
}

export function markAccepted({ token, userId, acceptedAt }) {
  return db.prepare(`
    UPDATE invites
       SET accepted_by_user_id = ?, accepted_at = ?
     WHERE token = ? AND (accepted_by_user_id IS NULL)
  `).run(userId, acceptedAt, token);
}

// Export the migration so it can be invoked explicitly on startup if desired
export const migrateInvitesAddNames = ensureInviteNameColumns;