
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  peer_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, peer_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(peer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  qdate TEXT NOT NULL, -- YYYY-MM-DD in Europe/Berlin
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, qdate),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  respondent_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(question_id, respondent_id),
  FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY(respondent_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  answer_id INTEGER NOT NULL,
  voter_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(answer_id, voter_id),
  FOREIGN KEY(answer_id) REFERENCES answers(id) ON DELETE CASCADE,
  FOREIGN KEY(voter_id) REFERENCES users(id) ON DELETE CASCADE
);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name  TEXT,                -- optional; you can still keep UNIQUE if you want
  email         TEXT,                -- nullable; may be absent or unverified
  email_verified INTEGER NOT NULL DEFAULT 0, -- 0/1
  photo_url     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  is_disabled   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(email)                    -- optional; drop if you want multiple users per email
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS auth_identities (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  provider          TEXT NOT NULL,         -- e.g. 'google'
  provider_user_id  TEXT NOT NULL,         -- Google 'sub' claim (stable ID)
  email             TEXT,                  -- from token; can change
  email_verified    INTEGER NOT NULL DEFAULT 0,
  raw_profile_json  TEXT,                  -- optional: minimally keep last profile snapshot
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_email ON auth_identities(email);