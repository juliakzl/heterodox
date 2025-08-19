// server/db.js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

// Resolve DB file path: PROD requires DB_PATH; DEV defaults to server/asa.db
const isProd = process.env.NODE_ENV === 'production';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = (process.env.DB_PATH && process.env.DB_PATH.trim() !== '')
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'asa.db');

// Ensure the directory exists (useful for /var/lib/heterodox/db.sqlite)
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

// Open database
const db = new Database(dbFile, { fileMustExist: isProd });
if (process.env.DEBUG_DB_PATH) console.log('[db] using', dbFile, 'fileMustExist=', isProd);

// Recommended pragmas for better-sqlite3 in server context
db.pragma('journal_mode = WAL');        // better concurrency
db.pragma('synchronous = NORMAL');      // good tradeoff for durability/speed
db.pragma('foreign_keys = ON');         // if you use FKs

export default db;