import db from './db.js';

export function saveOnboardingAnswer({ userId, token, promptKey, answer, createdAt }) {
  // upsert-like behavior: replace the previous answer if user retries
  const stmt = db.prepare(`
    INSERT INTO signup_questions (user_id, token, prompt_key, answer, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, prompt_key) DO UPDATE SET
      answer = excluded.answer,
      token = COALESCE(excluded.token, signup_questions.token),
      created_at = excluded.created_at
  `);
  return stmt.run(userId, token ?? null, promptKey, answer, createdAt);
}

export function getAnswersForUser(userId) {
  return db.prepare(`
    SELECT prompt_key, answer, created_at
    FROM signup_questions
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);
}