// server/db.js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Use DB_PATH from env, or default to a file in the project
const dbFile = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(process.cwd(), 'data.sqlite');

// Ensure the directory exists (useful for /var/lib/heterodox/db.sqlite)
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

// Open database
const db = new Database(dbFile);

// Recommended pragmas for better-sqlite3 in server context
db.pragma('journal_mode = WAL');        // better concurrency
db.pragma('synchronous = NORMAL');      // good tradeoff for durability/speed
db.pragma('foreign_keys = ON');         // if you use FKs

export default db;