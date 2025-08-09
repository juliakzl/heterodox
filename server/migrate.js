// server/migrate.js (ESM)
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Use the script's folder to locate asa.db reliably
const DB_FILE = path.join(__dirname, 'asa.db');

if (!fs.existsSync(DB_FILE)) {
  console.error(`DB not found at ${DB_FILE}. Start the app once to create it, or check your CWD.`);
  process.exit(1);
}

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

const cols = db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name);
const add = (sql) => db.exec(sql);

if (!cols.includes('email'))          add(`ALTER TABLE users ADD COLUMN email TEXT;`);
if (!cols.includes('email_verified')) add(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;`);
if (!cols.includes('avatar_url'))     add(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`);
if (!cols.includes('created_at'))     add(`ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`);
if (!cols.includes('google_id'))      add(`ALTER TABLE users ADD COLUMN google_id TEXT;`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`);

console.log('Migration complete.');