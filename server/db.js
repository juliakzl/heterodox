// server/db.js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = (process.env.DB_PATH && process.env.DB_PATH.trim() !== '')
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'asa.db');

// Ensure the directory exists (useful for /var/lib/heterodox/db.sqlite)
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

// Open database (prod requires file to already exist)
const db = new Database(dbFile, { fileMustExist: isProd });
if (process.env.DEBUG_DB_PATH) console.log('[db] using', dbFile, 'fileMustExist=', isProd);

// Recommended pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

export default db;