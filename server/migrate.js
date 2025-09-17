#!/usr/bin/env node
// server/migrate.js (ESM) — hybrid runner:
// 1) Runs legacy bootstrap/idempotent fixes (backwards compatible)
// 2) Applies ordered SQL files from server/migrations/ with checksums

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurable paths
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, 'asa.db');
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.resolve(__dirname, 'migrations');

// CLI: `--status` prints status without applying
const MODE = process.argv.includes('--status') ? 'status' : 'apply';

// ---------- Helpers ----------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function readMigrations(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{8,}.*\.(sql|SQL)$/.test(f))
    .sort()
    .map((f) => {
      const full = path.join(dir, f);
      const raw = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
      const sql = raw.trim();
      return { version: f, sql, checksum: sha256(sql) };
    });
}

function ensureMeta(db) {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      checksum   TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// Back-compat: keep your prior bootstrap so existing envs are safe.
// This is idempotent and runs before file migrations.
function ensureBootstrap(db) {
  const bootstrap = `
  CREATE TABLE IF NOT EXISTS invites (
    token TEXT PRIMARY KEY,
    inviter_id INTEGER,
    created_at TEXT NOT NULL,
    accepted_by_user_id INTEGER,
    accepted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS signup_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT,
    prompt_key TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, prompt_key)
  );

  CREATE INDEX IF NOT EXISTS idx_signup_questions_user ON signup_questions(user_id);
  `;
  db.exec(bootstrap);

  // Add questions_book table and indexes
  const questionsBookSql = `
  CREATE TABLE IF NOT EXISTS questions_book (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    posted_by TEXT,
    asked_by TEXT,
    date TEXT NOT NULL DEFAULT (datetime('now')),
    upvotes INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_questions_book_date ON questions_book(date);
  CREATE INDEX IF NOT EXISTS idx_questions_book_upvotes ON questions_book(upvotes);
  `;
  db.exec(questionsBookSql);

  // Defensive column adds on users table
  try {
    const cols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
    const add = (sql) => db.exec(sql);
    if (!cols.includes('email'))          add(`ALTER TABLE users ADD COLUMN email TEXT;`);
    if (!cols.includes('email_verified')) add(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;`);
    if (!cols.includes('avatar_url'))     add(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`);
    if (!cols.includes('created_at'))     add(`ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`);
    if (!cols.includes('google_id'))      add(`ALTER TABLE users ADD COLUMN google_id TEXT;`);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`);
  } catch (e) {
    // If the users table doesn't exist yet, it's fine—maybe a migration file will create it.
  }
}

function getAppliedMap(db) {
  const rows = db.prepare('SELECT version, checksum FROM schema_migrations').all();
  const map = new Map();
  for (const r of rows) map.set(r.version, r.checksum);
  return map;
}

function showStatus(db, migrations) {
  const applied = getAppliedMap(db);
  const rows = migrations.map((m) => ({
    version: m.version,
    applied: applied.has(m.version),
    changed: applied.has(m.version) && applied.get(m.version) !== m.checksum,
  }));
  for (const r of rows) {
    const flag = r.changed ? 'CHANGED' : r.applied ? 'APPLIED' : 'PENDING';
    console.log(`${flag.padEnd(8)} ${r.version}`);
  }
  const pending = rows.filter((r) => !r.applied);
  if (pending.length) console.log(`\nPending: ${pending.length}`);
}

function applyMigrations(db, migrations) {
  const applied = getAppliedMap(db);

  // Guard against edited, already-applied files
  for (const m of migrations) {
    if (applied.has(m.version) && applied.get(m.version) !== m.checksum) {
      throw new Error(
        `Checksum mismatch for ${m.version}. Migration file changed after being applied.`
      );
    }
  }

  const pending = migrations.filter((m) => !applied.has(m.version));
  if (pending.length === 0) {
    console.log('migrate.js: database is up-to-date.');
    return;
  }

  console.log(`migrate.js: applying ${pending.length} migration(s)`);
  for (const m of pending) {
    console.log(`→ ${m.version}`);
    try {
      db.exec('BEGIN IMMEDIATE');
      // NOTE: individual .sql files must NOT contain BEGIN/COMMIT
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations(version, checksum) VALUES(?, ?)').run(
        m.version,
        m.checksum
      );
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      err.message = `Migration failed: ${m.version}\n${err.message}`;
      throw err;
    }
  }
  console.log('migrate.js: done.');
}

// ---------- Main ----------
(function main() {
  // Ensure migrations dir exists so teams can drop files safely
  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });

  const db = new Database(DB_PATH); // creates file if missing
  try {
    ensureMeta(db);
    ensureBootstrap(db);

    const migrations = readMigrations(MIGRATIONS_DIR);
    if (MODE === 'status') {
      console.log(`DB: ${DB_PATH}`);
      console.log(`Migrations dir: ${MIGRATIONS_DIR}`);
      showStatus(db, migrations);
    } else {
      applyMigrations(db, migrations);
    }
  } finally {
    db.close();
  }
})();