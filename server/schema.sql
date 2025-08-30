PRAGMA foreign_keys = ON;

-- ===== users =====
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name   TEXT,                           -- optional; not necessarily unique
  email          TEXT,                           -- may be NULL
  email_verified INTEGER NOT NULL DEFAULT 0,     -- 0/1 boolean
  photo_url      TEXT,
  city           TEXT,                           -- added for profile city
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  is_disabled    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(email)                                   -- allows many NULLs in SQLite
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ===== auth_identities =====
CREATE TABLE IF NOT EXISTS auth_identities (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  provider          TEXT NOT NULL,               -- e.g. 'google'
  provider_user_id  TEXT NOT NULL,               -- stable provider ID (e.g. Google 'sub')
  email             TEXT,
  email_verified    INTEGER NOT NULL DEFAULT 0,
  raw_profile_json  TEXT,                        -- optional snapshot
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_email ON auth_identities(email);

-- ===== connections =====
CREATE TABLE IF NOT EXISTS connections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  peer_id     INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, peer_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(peer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ===== questions =====
CREATE TABLE IF NOT EXISTS questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  qdate       TEXT NOT NULL,          -- YYYY-MM-DD in Europe/Berlin
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, qdate),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ===== answers =====
CREATE TABLE IF NOT EXISTS answers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id    INTEGER NOT NULL,
  respondent_id  INTEGER NOT NULL,
  text           TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(question_id, respondent_id),
  FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY(respondent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ===== votes =====
CREATE TABLE IF NOT EXISTS votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  answer_id   INTEGER NOT NULL,
  voter_id    INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(answer_id, voter_id),
  FOREIGN KEY(answer_id) REFERENCES answers(id) ON DELETE CASCADE,
  FOREIGN KEY(voter_id) REFERENCES users(id) ON DELETE CASCADE
);