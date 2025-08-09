import db from './db.js';

export function createInvite({ token, inviterId, createdAt }) {
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