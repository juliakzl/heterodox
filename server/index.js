import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import "dotenv/config";
import session from "express-session";
import crypto from "crypto";

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import * as Invites from "./invites.js";
import * as Signup from "./signup.js";
const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
const GOOGLE_SCOPES =
  (process.env.GOOGLE_AUTH_SCOPES || "openid email profile").trim();
const CLIENT_BASE_URL = (process.env.CLIENT_BASE_URL || "").trim();
const ADMIN_API_SECRET = (process.env.ADMIN_API_SECRET || "").trim();

app.set("trust proxy", 1); // important behind nginx/https

// Resolve public dir: if PUBLIC_DIR is absolute, use it; else resolve relative to server/
const rawPublic = process.env.PUBLIC_DIR || "../client/dist";
const publicPath = path.isAbsolute(rawPublic)
  ? rawPublic
  : path.resolve(__dirname, rawPublic);
if (!fs.existsSync(publicPath)) {
  console.warn("Warning: PUBLIC_DIR does not exist:", publicPath);
}
console.log("Resolved publicPath:", publicPath);

app.use(express.static(publicPath));

app.use(
  cors({
    origin: true, // reflect request origin
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    name: "asa_sess",
    secret: process.env.SESSION_SECRET || "dev-secret-not-for-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax", // needed for OAuth redirect
      secure: process.env.NODE_ENV === "production", // true only over HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

import db from "./db.js";

function ensureUserProfileColumns() {
  try {
    const cols = db
      .prepare("PRAGMA table_info(users)")
      .all()
      .map((row) => row.name);
    const statements = [];
    if (!cols.includes("first_name")) {
      statements.push("ALTER TABLE users ADD COLUMN first_name TEXT");
    }
    if (!cols.includes("last_name")) {
      statements.push("ALTER TABLE users ADD COLUMN last_name TEXT");
    }
    if (!cols.includes("photo_url")) {
      statements.push("ALTER TABLE users ADD COLUMN photo_url TEXT");
    }
    if (!cols.includes("email_verified")) {
      statements.push("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
    }
    if (!cols.includes("city")) {
      statements.push("ALTER TABLE users ADD COLUMN city TEXT");
    }
    if (!cols.includes("created_at")) {
      statements.push("ALTER TABLE users ADD COLUMN created_at TEXT");
    }
    if (!cols.includes("updated_at")) {
      statements.push("ALTER TABLE users ADD COLUMN updated_at TEXT");
    }
    if (!statements.length) return;
    const tx = db.transaction(() => {
      for (const sql of statements) {
        db.prepare(sql).run();
      }
      db.prepare(
        `UPDATE users
         SET created_at = COALESCE(created_at, datetime('now')),
             updated_at = COALESCE(updated_at, datetime('now')),
             email_verified = COALESCE(email_verified, 0)`
      ).run();
    });
    tx();
  } catch (err) {
    console.error("Failed to ensure user profile columns:", err);
  }
}

ensureUserProfileColumns();
function ensureQuestionsBookColumns() {
  try {
    const cols = db
      .prepare("PRAGMA table_info(questions_book)")
      .all()
      .map((row) => row.name);

    const statements = [];
    if (!cols.includes("user_id")) {
      statements.push("ALTER TABLE questions_book ADD COLUMN user_id INTEGER");
    }
    if (!cols.includes("background")) {
      statements.push("ALTER TABLE questions_book ADD COLUMN background TEXT");
    }
    if (!cols.includes("posted_by")) {
      statements.push("ALTER TABLE questions_book ADD COLUMN posted_by TEXT");
    }
    if (!cols.includes("date")) {
      statements.push("ALTER TABLE questions_book ADD COLUMN date TEXT NOT NULL DEFAULT (datetime('now'))");
    }
    if (!cols.includes("upvotes")) {
      statements.push("ALTER TABLE questions_book ADD COLUMN upvotes INTEGER NOT NULL DEFAULT 0");
    }
    if (statements.length) {
      const tx = db.transaction(() => {
        for (const sql of statements) {
          db.prepare(sql).run();
        }
      });
      tx();
    }
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_questions_book_user ON questions_book(user_id)"
    ).run();
  } catch (err) {
    console.error("Failed to ensure questions_book columns:", err);
  }
}

ensureQuestionsBookColumns();

function requireAdmin(req, res) {
  if (!ADMIN_API_SECRET) {
    res.status(503).json({ error: "admin_api_disabled" });
    return false;
  }
  const provided =
    req.headers["x-admin-secret"] ||
    req.headers["x-admin-key"] ||
    req.query.admin_secret ||
    req.query.admin_key;
  if (!provided || String(provided) !== ADMIN_API_SECRET) {
    res.status(403).json({ error: "admin_forbidden" });
    return false;
  }
  return true;
}

// ---------- Weekly Rounds (global weekly question) ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS weekly_rounds (
    week_start   TEXT    PRIMARY KEY,  -- Monday YYYY-MM-DD
    question_id  INTEGER NOT NULL,
    published_at TEXT    NOT NULL
  );
`);
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_answers_weekly ON answers(question_id, respondent_id);
`);

// ---------- Utilities ----------
function today() {
  return dayjs().format("YYYY-MM-DD");
}
function nowIso() {
  return dayjs().toISOString();
}
function isAfterReveal(qdate) {
  const revealAt = dayjs(qdate + " 20:00");
  return dayjs().isAfter(revealAt);
}
function requireUser(req, res) {
  if (!req.session.user) {
    res.status(401).json({ error: "Not signed in" });
    return null;
  }
  return req.session.user;
}

// Weekly helpers (Europe/Berlin assumed via server tz)
const WEEK_REVEAL_HOUR = 18; // 18:00 on Thursday
function weekStartMonday(d = dayjs()) {
  // day(): 0=Sunday ... 6=Saturday; we want Monday as start
  const dow = d.day();
  const diff = dow === 0 ? -6 : 1 - dow; // how many days to go back to Monday
  return d.add(diff, "day").format("YYYY-MM-DD");
}
function weeklyPhaseTimes(weekStartStr) {
  const mon = dayjs(weekStartStr + " 00:00");
  const thuReveal = mon
    .add(4, "day")
    .hour(WEEK_REVEAL_HOUR)
    .minute(0)
    .second(0)
    .millisecond(0); // Thursday 18:00
  const sunEnd = mon
    .add(6, "day")
    .hour(23)
    .minute(59)
    .second(59)
    .millisecond(0);
  return { mon, thuReveal, sunEnd };
}
function currentWeeklyPhase(weekStartStr, now = dayjs()) {
  const { thuReveal } = weeklyPhaseTimes(weekStartStr);
  if (now.isBefore(thuReveal)) return "answering";
  return "reveal";
}


// Resolve public base URL: prefer env; in prod fall back to forwarded proto/host; dev => localhost:5173
function baseUrlFromReq(req) {
  const env = (process.env.BASE_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");

  const proto = String(
    req.headers["x-forwarded-proto"] || req.protocol || "http"
  ).split(",")[0];
  const host = String(
    req.headers["x-forwarded-host"] || req.headers["host"] || ""
  ).trim();

  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5173";
  }

  console.error(
    "Cannot determine public base URL in production. Set BASE_URL or fix proxy headers."
  );
  return "/";
}

function sanitizeNextUrl(req, rawNext) {
  if (!rawNext || typeof rawNext !== "string") return "/";
  const trimmed = rawNext.trim();
  if (!trimmed) return "/";
  if (trimmed.startsWith("/")) {
    // Prevent protocol-relative URLs like //evil.com
    return trimmed.startsWith("//") ? "/" : trimmed;
  }
  try {
    const candidate = new URL(trimmed, baseUrlFromReq(req));
    const base = baseUrlFromReq(req);
    if (candidate.origin === base) {
      return (
        candidate.pathname +
        (candidate.search || "") +
        (candidate.hash || "")
      );
    }
  } catch (e) {
    // ignore parse errors
  }
  return "/";
}

function getGoogleRedirectUri(req) {
  const env = (process.env.GOOGLE_REDIRECT_URI || "").trim();
  if (env) return env;
  return `${baseUrlFromReq(req)}/api/auth/google/callback`;
}

function getWeeklyQuestionRow(weekStartStr) {
  return db
    .prepare(
      `
    SELECT q.id, q.user_id, u.display_name AS owner_name, q.text, q.qdate
    FROM weekly_rounds w
    JOIN questions q ON q.id = w.question_id
    JOIN users u ON u.id = q.user_id
    WHERE w.week_start = ?
  `
    )
    .get(weekStartStr);
}

// ---------- Connection helpers & backfill ----------
function upsertConnectionOneWay(userId, peerId, ts) {
  try {
    db.prepare(
      "INSERT OR IGNORE INTO connections (user_id, peer_id, created_at) VALUES (?, ?, ?)"
    ).run(userId, peerId, ts || nowIso());
    return true;
  } catch (e) {
    console.error("upsertConnectionOneWay error:", e);
    return false;
  }
}

function connectBothWays(aId, bId, ts) {
  const a = Number(aId), b = Number(bId);
  if (!a || !b || a === b) return false;
  const r1 = upsertConnectionOneWay(a, b, ts);
  const r2 = upsertConnectionOneWay(b, a, ts);
  return r1 || r2;
}

// Build missing connections from accepted invites (idempotent; no deletes)
function backfillConnectionsFromInvites() {
  const rows = db.prepare(`
    SELECT
      i.inviter_id        AS inviterId,
      i.accepted_by_user_id AS newUserId
    FROM invites i
    WHERE i.inviter_id IS NOT NULL
      AND i.accepted_by_user_id IS NOT NULL
  `).all();

  const ts = nowIso();
  let created = 0;

  const tx = db.transaction(() => {
    for (const r of rows) {
      if (!r.inviterId || !r.newUserId || r.inviterId === r.newUserId) continue;

      const a = db.prepare(
        "INSERT OR IGNORE INTO connections (user_id, peer_id, created_at) VALUES (?, ?, ?)"
      ).run(r.inviterId, r.newUserId, ts);
      const b = db.prepare(
        "INSERT OR IGNORE INTO connections (user_id, peer_id, created_at) VALUES (?, ?, ?)"
      ).run(r.newUserId, r.inviterId, ts);

      created += (a.changes || 0) + (b.changes || 0);
    }
  });
  tx();

  console.log(`Connections backfill: invites processed=${rows.length}, edges created=${created}`);
}

app.post("/api/logout", (req, res) => {
  req.session?.destroy(() => {
    res.clearCookie("asa_sess");
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get("/api/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res
      .status(500)
      .type("text/plain")
      .send("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  const rawNext =
    typeof req.query.next === "string"
      ? req.query.next
      : Array.isArray(req.query.next)
      ? req.query.next[0]
      : "";
  const next = sanitizeNextUrl(req, rawNext);
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;
  req.session.oauthNext = next;
  let returnOrigin = CLIENT_BASE_URL || baseUrlFromReq(req);
  if (rawNext) {
    try {
      const nextUrl = new URL(rawNext, baseUrlFromReq(req));
      if (!CLIENT_BASE_URL) {
        returnOrigin = `${nextUrl.protocol}//${nextUrl.host}`;
      } else {
        const expected = new URL(CLIENT_BASE_URL);
        if (expected.host === nextUrl.host) {
          returnOrigin = `${expected.protocol}//${expected.host}`;
        }
      }
    } catch (e) {
      // ignore parse error, fallback to referer/base
    }
  }
  const referer = req.headers.referer || req.headers.referrer;
  if (!CLIENT_BASE_URL && referer && typeof referer === "string") {
    try {
      const parsed = new URL(referer);
      const fallback = new URL(returnOrigin);
      if (parsed.hostname === fallback.hostname) {
        returnOrigin = `${parsed.protocol}//${parsed.host}`;
      } else if (
        ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
      ) {
        returnOrigin = `${parsed.protocol}//${parsed.host}`;
      }
    } catch (e) {
      // ignore parse error, keep default
    }
  }
  req.session.oauthReturnOrigin = returnOrigin;
  const redirectUri = getGoogleRedirectUri(req);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    include_granted_scopes: "true",
    state,
    prompt: "consent",
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(url);
});

app.get("/api/auth/google/callback", async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res
      .status(500)
      .type("text/plain")
      .send("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  const { code, state, error: oauthError } = req.query;
  const cleanup = () => {
    delete req.session.oauthState;
    delete req.session.oauthNext;
    delete req.session.oauthReturnOrigin;
  };
  if (oauthError) {
    console.warn("Google OAuth returned error:", oauthError);
    cleanup();
    return res.redirect("/?authError=google_oauth_error");
  }
  if (!code || typeof code !== "string") {
    cleanup();
    return res.status(400).json({ error: "missing_code" });
  }
  if (!state || state !== req.session.oauthState) {
    cleanup();
    return res.status(400).json({ error: "invalid_state" });
  }

  const redirectUri = getGoogleRedirectUri(req);
  try {
    const tokenParams = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text().catch(() => "");
      console.error("Google token exchange failed:", tokenRes.status, txt);
      cleanup();
      return res.redirect("/?authError=google_token_exchange_failed");
    }
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      console.error("Google token exchange response missing access_token:", tokens);
      cleanup();
      return res.redirect("/?authError=google_token_missing");
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      const txt = await profileRes.text().catch(() => "");
      console.error("Google userinfo failed:", profileRes.status, txt);
      cleanup();
      return res.redirect("/?authError=google_userinfo_failed");
    }

    const profile = await profileRes.json();
    const sub = profile?.sub;
    if (!sub) {
      console.error("Google profile missing sub:", profile);
      cleanup();
      return res.redirect("/?authError=google_profile_missing_sub");
    }

    const emailRaw = (profile.email || "").trim();
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    const emailVerified = profile.email_verified ? 1 : 0;
    const firstName = (profile.given_name || "").trim() || null;
    const lastName = (profile.family_name || "").trim() || null;
    const displayName =
      (profile.name || "").trim() ||
      (firstName && lastName ? `${firstName} ${lastName}` : null) ||
      email ||
      `Member ${sub.slice(-6)}`;

    const now = nowIso();
    const identity = db
      .prepare(
        "SELECT * FROM auth_identities WHERE provider = ? AND provider_user_id = ? LIMIT 1"
      )
      .get("google", sub);

    let user = null;
    if (identity) {
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(identity.user_id);
    }

    if (!user && email) {
      user = db
        .prepare("SELECT * FROM users WHERE email = ? LIMIT 1")
        .get(email);
    }

    if (!user) {
      const insert = db.prepare(
        `INSERT INTO users (display_name, first_name, last_name, email, email_verified, photo_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const info = insert.run(
        displayName,
        firstName,
        lastName,
        email,
        email ? emailVerified : 0,
        profile.picture || null,
        now,
        now
      );
      user = db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(info.lastInsertRowid);
    } else {
      const updateStmt = db.prepare(
        `UPDATE users
         SET display_name = COALESCE(?, display_name),
             first_name   = COALESCE(?, first_name),
             last_name    = COALESCE(?, last_name),
             email        = COALESCE(?, email),
             email_verified = CASE WHEN ? IS NOT NULL THEN ? ELSE email_verified END,
             photo_url    = COALESCE(?, photo_url),
             updated_at   = ?
         WHERE id = ?`
      );
      updateStmt.run(
        displayName,
        firstName,
        lastName,
        email,
        email ? emailVerified : null,
        email ? emailVerified : null,
        profile.picture || null,
        now,
        user.id
      );
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    }

    db.prepare(
      `INSERT INTO auth_identities (user_id, provider, provider_user_id, email, email_verified, raw_profile_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, provider_user_id) DO UPDATE SET
         user_id = excluded.user_id,
         email = excluded.email,
         email_verified = excluded.email_verified,
         raw_profile_json = excluded.raw_profile_json,
         updated_at = excluded.updated_at`
    ).run(
      user.id,
      "google",
      sub,
      email,
      email ? emailVerified : 0,
      JSON.stringify(profile),
      now,
      now
    );

    const next = req.session.oauthNext || "/";
    let origin = req.session.oauthReturnOrigin || baseUrlFromReq(req);
    cleanup();

    req.session.user = {
      id: user.id,
      displayName: user.display_name || displayName,
      email: user.email || email,
    };
    let target = next;
    if (origin && typeof origin === "string" && /^https?:\/\//i.test(origin)) {
      target = `${origin.replace(/\/+$/, "")}${next}`;
    }
    res.redirect(target);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    cleanup();
    res.redirect("/?authError=google_oauth_exception");
  }
});

// ---------- Existing local auth (kept as-is) ----------
app.post("/api/register", (req, res) => {
  const { displayName } = req.body;
  if (!displayName || displayName.length < 2) {
    return res
      .status(400)
      .json({ error: "displayName required (min 2 chars)" });
  }
  try {
    const stmt = db.prepare(
      "INSERT INTO users (display_name, created_at) VALUES (?, ?)"
    );
    const info = stmt.run(displayName, nowIso());
    req.session.user = { id: info.lastInsertRowid, displayName };
    res.json({ id: info.lastInsertRowid, displayName });
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return res.status(409).json({ error: "displayName taken" });
    }
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.post("/api/login", (req, res) => {
  const { displayName } = req.body;
  const row = db
    .prepare("SELECT id, display_name FROM users WHERE display_name = ?")
    .get(displayName);
  if (!row) return res.status(404).json({ error: "not_found" });
  req.session.user = { id: row.id, displayName: row.display_name };
  res.json({ id: row.id, displayName: row.display_name });
});

// ---------- Connections ----------
app.post("/api/connections/add", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const { peerId, peerDisplayName } = req.body || {};

  let peer = null;
  if (peerId) {
    peer = db.prepare("SELECT id FROM users WHERE id = ?").get(Number(peerId));
  } else if (peerDisplayName) {
    peer = db.prepare("SELECT id FROM users WHERE display_name = ?").get(peerDisplayName);
  }

  if (!peer) return res.status(404).json({ error: "peer_not_found" });
  if (peer.id === me.id) return res.status(400).json({ error: "cannot_connect_to_self" });

  const ts = nowIso();
  try {
    const a = db.prepare(
      "INSERT OR IGNORE INTO connections (user_id, peer_id, created_at) VALUES (?, ?, ?)"
    ).run(me.id, peer.id, ts);
    const b = db.prepare(
      "INSERT OR IGNORE INTO connections (user_id, peer_id, created_at) VALUES (?, ?, ?)"
    ).run(peer.id, me.id, ts);

    const created = (a.changes || 0) + (b.changes || 0);
    return res.json({ ok: true, created });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server_error" });
  }
});

app.get("/api/connections", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const rows = db
    .prepare(
      `
    SELECT users.id, users.display_name
    FROM connections
    JOIN users ON users.id = connections.peer_id
    WHERE connections.user_id = ?
    ORDER BY users.display_name ASC
  `
    )
    .all(me.id);
  res.json({ connections: rows });
});

// ---------- Questions Book (public API used by frontend) ----------
// GET /questions_book?page=1&limit=50 -> { data: [...], total }
app.get("/api/questions_book", (req, res) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const limitRaw = parseInt(String(req.query.limit || "50"), 10) || 50;
    const limit = Math.max(1, Math.min(50, limitRaw)); // cap at 50 as requested
    const offset = (page - 1) * limit;

    const totalRow = db.prepare("SELECT COUNT(*) as c FROM questions_book WHERE COALESCE(hidden, 0) = 0").get();
    const total = Number(totalRow?.c || 0);

    const rows = db.prepare(
      `SELECT qb.id,
              qb.question,
              COALESCE(u.display_name, qb.posted_by) AS posted_by,
              qb.background,
              qb.date,
              qb.user_id,
              qb.anonymous,
              (SELECT COUNT(*) FROM question_upvotes qu WHERE qu.question_id = qb.id) AS upvotes
       FROM questions_book qb
       LEFT JOIN users u ON u.id = qb.user_id
       WHERE COALESCE(qb.hidden, 0) = 0
       ORDER BY datetime(qb.date) DESC, qb.id DESC
       LIMIT ? OFFSET ?`
    ).all(limit, offset);

    res.setHeader("Cache-Control", "no-store");
    return res.json({ data: rows, total });
  } catch (e) {
    console.error("/questions_book failed:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// Create a new question in questions_book
// Body: { question: string, background?: string }
app.post("/api/questions_book", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return; // 401 handled in requireUser

  const qText = (req.body?.question || "").trim();
  const backgroundRaw = typeof req.body?.background === "string" ? req.body.background.trim() : "";
  const background = backgroundRaw ? backgroundRaw : null;
  if (!qText || qText.length < 3) {
    return res.status(400).json({ error: "question_min_3" });
  }

  // Support anonymous flag
  const anonymousFlag = Number(req.body?.anonymous) ? 1 : 0;

  try {
    const userRow = db
      .prepare("SELECT id, display_name, first_name, last_name FROM users WHERE id = ?")
      .get(me.id);
    const displayName =
      userRow?.display_name ||
      [userRow?.first_name, userRow?.last_name].filter(Boolean).join(" ").trim() ||
      me.displayName ||
      me.display_name ||
      `user:${me.id}`;

    const info = db
      .prepare(
        `INSERT INTO questions_book (question, posted_by, background, date, upvotes, user_id, anonymous)
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      )
      .run(qText, displayName, background, nowIso(), me.id, anonymousFlag);

    const row = db
      .prepare(
        `SELECT qb.id,
                qb.question,
                COALESCE(u.display_name, qb.posted_by) AS posted_by,
                qb.background,
                qb.date,
                qb.user_id,
                qb.anonymous,
                (SELECT COUNT(*) FROM question_upvotes qu WHERE qu.question_id = qb.id) AS upvotes
         FROM questions_book qb
         LEFT JOIN users u ON u.id = qb.user_id
         WHERE qb.id = ?`
      )
      .get(info.lastInsertRowid);

    return res.status(201).json(row);
  } catch (e) {
    console.error("POST /api/questions_book failed:", e);
    return res.status(500).json({ error: "server_error" });
  }
});


// POST /questions_book/:id/upvote -> { id, upvotes }
app.post("/api/questions_book/:id/upvote", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return; // 401 handled in requireUser

  try {
    const qid = parseInt(String(req.params.id), 10);
    if (!qid || Number.isNaN(qid)) return res.status(400).json({ error: "invalid_id" });

    const tx = db.transaction((questionId, userId) => {
      // Insert a unique vote; composite PK (question_id, user_id) prevents duplicates
      const ins = db
        .prepare(`INSERT OR IGNORE INTO question_upvotes (question_id, user_id) VALUES (?, ?)`)
        .run(questionId, userId);

      const inserted = ins.changes === 1;

      // Fresh count from votes table
      const countRow = db
        .prepare(`SELECT COUNT(*) AS c FROM question_upvotes WHERE question_id = ?`)
        .get(questionId);

      return { upvotes: Number(countRow.c || 0), alreadyVoted: !inserted };
    });

    const out = tx(qid, me.id);
    return res.json(out);
  } catch (e) {
    console.error("/api/questions_book/:id/upvote failed:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

app.post("/api/questions_book/:id/comment", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;

  try {
    const qid = parseInt(String(req.params.id), 10);
    if (!qid || Number.isNaN(qid)) return res.status(400).json({ error: "invalid_id" });

    const text = (req.body?.comment || "").trim();
    if (!text || text.length < 1) return res.status(400).json({ error: "comment_required" });

    // Ensure question exists
    const qExists = db.prepare("SELECT 1 FROM questions_book WHERE id = ?").get(qid);
    if (!qExists) return res.status(404).json({ error: "question_not_found" });

    const now = nowIso();
    const info = db
      .prepare(
        "INSERT INTO comments (question_id, user_id, comment, created_at) VALUES (?, ?, ?, ?)"
      )
      .run(qid, me.id, text, now);

    const row = db
      .prepare(
        `SELECT c.id, c.question_id, c.user_id, c.comment, c.created_at,
                u.display_name AS user_name
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.id = ?`
      )
      .get(info.lastInsertRowid);

    return res.status(201).json(row);
  } catch (e) {
    console.error("POST /api/questions_book/:id/comment failed:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

app.post("/api/questions_book/:id/background", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;

  try {
    const qid = parseInt(String(req.params.id), 10);
    if (!qid || Number.isNaN(qid)) return res.status(400).json({ error: "invalid_id" });

    const background = (req.body?.background || "").trim();
    if (!background) return res.status(400).json({ error: "background_required" });

    const row = db
      .prepare("SELECT id, user_id, background FROM questions_book WHERE id = ?")
      .get(qid);
    if (!row) return res.status(404).json({ error: "not_found" });
    if (!row.user_id || Number(row.user_id) !== Number(me.id)) {
      return res.status(403).json({ error: "not_owner" });
    }
    if (row.background && row.background.trim()) {
      return res.status(409).json({ error: "already_has_story" });
    }

    db.prepare("UPDATE questions_book SET background = ? WHERE id = ?").run(background, qid);
    return res.json({ ok: true, background });
  } catch (e) {
    console.error("POST /api/questions_book/:id/background failed:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

app.get("/api/users/:identifier/questions_book", (req, res) => {
  try {
    const rawParam = String(req.params.identifier || "");
    const rawIdentifier = (() => {
      try {
        return decodeURIComponent(rawParam);
      } catch {
        return rawParam;
      }
    })().trim();
    if (!rawIdentifier) {
      return res.status(400).json({ error: "invalid_identifier" });
    }

    const viewerId = req.session?.user?.id ?? null;

    const baseSelect = `
      SELECT qb.id,
             qb.question,
             COALESCE(u.display_name, qb.posted_by) AS posted_by,
             qb.background,
             qb.date,
             qb.user_id,
             (SELECT COUNT(*) FROM question_upvotes qu WHERE qu.question_id = qb.id) AS upvotes,
             (SELECT COUNT(*) FROM comments c WHERE c.question_id = qb.id) AS comments_total,
             CASE
               WHEN $viewerId IS NOT NULL AND EXISTS (
                 SELECT 1 FROM question_upvotes qu
                 WHERE qu.question_id = qb.id AND qu.user_id = $viewerId
               )
               THEN 1 ELSE 0
             END AS has_upvoted
      FROM questions_book qb
      LEFT JOIN users u ON u.id = qb.user_id
      WHERE COALESCE(qb.hidden, 0) = 0
    `;

    const orderClause = " ORDER BY datetime(qb.date) DESC, qb.id DESC";

    let rows = [];
    let user = null;

    const maybeNumeric =
      rawIdentifier.startsWith("id:")
        ? rawIdentifier.slice(3)
        : rawIdentifier;

    const numericId = Number.parseInt(maybeNumeric, 10);
    const isNumericIdentifier =
      !Number.isNaN(numericId) &&
      (rawIdentifier.startsWith("id:") || /^[0-9]+$/.test(rawIdentifier));

    if (isNumericIdentifier) {
      rows = db
        .prepare(
          `${baseSelect}
             AND qb.user_id = $userId
           ${orderClause}`
        )
        .all({ userId: numericId, viewerId });

      const userRow = db
        .prepare("SELECT id, display_name, first_name, last_name FROM users WHERE id = ?")
        .get(numericId);

      const fallbackName =
        rows?.[0]?.posted_by ||
        [userRow?.first_name, userRow?.last_name].filter(Boolean).join(" ").trim() ||
        userRow?.display_name ||
        (rows.length ? `User #${numericId}` : null);

      if (!userRow && rows.length === 0) {
        return res.status(404).json({ error: "user_or_questions_not_found" });
      }

      user = {
        id: numericId,
        name:
          userRow?.display_name ||
          [userRow?.first_name, userRow?.last_name].filter(Boolean).join(" ").trim() ||
          fallbackName ||
          `User #${numericId}`,
      };
    } else {
      const nameIdentifier = rawIdentifier.startsWith("name:")
        ? rawIdentifier.slice(5)
        : rawIdentifier;
      const nameTrimmed = nameIdentifier.trim();
      if (!nameTrimmed) {
        return res.status(400).json({ error: "invalid_identifier" });
      }

      rows = db
        .prepare(
          `${baseSelect}
             AND LOWER(COALESCE(u.display_name, qb.posted_by)) = LOWER($name)
           ${orderClause}`
        )
        .all({ name: nameTrimmed, viewerId });

      if (rows.length === 0) {
        return res.status(404).json({ error: "user_or_questions_not_found" });
      }

      const firstRow = rows[0] || {};
      user = {
        id: firstRow.user_id ?? null,
        name: firstRow.posted_by || nameTrimmed,
      };
    }

    res.setHeader("Cache-Control", "no-store");
    return res.json({ data: rows, total: rows.length, user });
  } catch (e) {
    console.error("GET /api/users/:identifier/questions_book failed:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

app.get("/api/get/questions_book/:id/comments", (req, res) => {
  try {
    const qid = parseInt(String(req.params.id), 10);
    if (!qid || Number.isNaN(qid)) return res.status(400).json({ error: "invalid_id" });

    // Optional: ensure question exists
    const qExists = db.prepare("SELECT 1 FROM questions_book WHERE id = ?").get(qid);
    if (!qExists) return res.status(404).json({ error: "question_not_found" });

    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const limitRaw = parseInt(String(req.query.limit || "50"), 10) || 50;
    const limit = Math.max(1, Math.min(100, limitRaw));
    const offset = (page - 1) * limit;

    const totalRow = db.prepare("SELECT COUNT(*) AS c FROM comments WHERE question_id = ?").get(qid);
    const total = Number(totalRow?.c || 0);

    const rows = db
      .prepare(
        `SELECT c.id,
                c.question_id,
                c.user_id,
                c.comment,
                c.created_at,
                u.display_name AS user_name
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.question_id = ?
         ORDER BY datetime(c.created_at) ASC, c.id ASC
         LIMIT ? OFFSET ?`
      )
      .all(qid, limit, offset);

    res.setHeader("Cache-Control", "no-store");
    return res.json({ data: rows, total });
  } catch (e) {
    console.error("GET /api/get/questions_book/:id/comments failed:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

app.get("/api/questions_book/:id", (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid_id" });

    const row = db.prepare(
      `SELECT qb.id,
              qb.question,
              COALESCE(u.display_name, qb.posted_by) AS posted_by,
              qb.background,
              qb.date,
              qb.user_id,
              (SELECT COUNT(*) FROM question_upvotes qu WHERE qu.question_id = qb.id) AS upvotes,
              (SELECT COUNT(*) FROM comments c WHERE c.question_id = qb.id) AS comments_total
       FROM questions_book qb
       LEFT JOIN users u ON u.id = qb.user_id
       WHERE qb.id = ? AND COALESCE(qb.hidden, 0) = 0`
    ).get(id);

    if (!row) return res.status(404).json({ error: "not_found" });

    res.setHeader("Cache-Control", "no-store");
    return res.json(row);
  } catch (e) {
    console.error("GET /api/questions_book/:id failed:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// ---------- Admin endpoints ----------
app.patch("/api/admin/questions_book/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const id = parseInt(String(req.params.id), 10);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "invalid_id" });
  }

  const payload = req.body || {};
  const sets = [];
  const vals = [];

  if (typeof payload.question === "string") {
    const trimmed = payload.question.trim();
    if (!trimmed) return res.status(400).json({ error: "question_required" });
    sets.push("question = ?");
    vals.push(trimmed);
  }

  if (payload.background !== undefined) {
    if (payload.background === null) {
      sets.push("background = NULL");
    } else if (typeof payload.background === "string") {
      sets.push("background = ?");
      vals.push(payload.background.trim());
    } else {
      return res.status(400).json({ error: "background_invalid" });
    }
  }

  if (payload.posted_by !== undefined) {
    if (payload.posted_by === null) {
      sets.push("posted_by = NULL");
    } else if (typeof payload.posted_by === "string") {
      sets.push("posted_by = ?");
      vals.push(payload.posted_by.trim());
    } else {
      return res.status(400).json({ error: "posted_by_invalid" });
    }
  }

  if (payload.date !== undefined) {
    if (payload.date === null) {
      sets.push("date = NULL");
    } else if (typeof payload.date === "string") {
      sets.push("date = ?");
      vals.push(payload.date.trim());
    } else {
      return res.status(400).json({ error: "date_invalid" });
    }
  }

  if (payload.upvotes !== undefined) {
    const numeric = Number(payload.upvotes);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return res.status(400).json({ error: "upvotes_invalid" });
    }
    sets.push("upvotes = ?");
    vals.push(Math.floor(numeric));
  }

  if (payload.user_id !== undefined) {
    if (payload.user_id === null) {
      sets.push("user_id = NULL");
    } else {
      const userId = Number(payload.user_id);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: "user_id_invalid" });
      }
      const userExists = db
        .prepare("SELECT 1 FROM users WHERE id = ?")
        .get(userId);
      if (!userExists) {
        return res.status(404).json({ error: "user_not_found" });
      }
      sets.push("user_id = ?");
      vals.push(userId);
    }
  }

  if (!sets.length) {
    return res.status(400).json({ error: "no_changes" });
  }

  try {
    const stmt = db.prepare(
      `UPDATE questions_book SET ${sets.join(", ")} WHERE id = ?`
    );
    stmt.run(...vals, id);

    const row = db
      .prepare(
        `SELECT qb.id,
                qb.question,
                COALESCE(u.display_name, qb.posted_by) AS posted_by,
                qb.background,
                qb.date,
                qb.user_id,
                (SELECT COUNT(*) FROM question_upvotes qu WHERE qu.question_id = qb.id) AS upvotes
         FROM questions_book qb
         LEFT JOIN users u ON u.id = qb.user_id
         WHERE qb.id = ?`
      )
      .get(id);

    if (!row) return res.status(404).json({ error: "not_found" });
    res.json(row);
  } catch (e) {
    console.error("Admin update questions_book failed:", e);
    res.status(500).json({ error: "server_error" });
  }
});

app.delete("/api/admin/questions_book/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const id = parseInt(String(req.params.id), 10);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "invalid_id" });
  }

  try {
    const stmt = db.prepare("DELETE FROM questions_book WHERE id = ?");
    const result = stmt.run(id);
    if (!result.changes) {
      return res.status(404).json({ error: "not_found" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Admin delete questions_book failed:", e);
    res.status(500).json({ error: "server_error" });
  }
});

// Second-degree connections (friends-of-friends), excluding self and existing direct connections
// GET /api/connections/second?limit=50
app.get("/api/connections/second", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);

  try {
    const rows = db
      .prepare(
        `
        SELECT DISTINCT u.id, u.display_name
        FROM connections c1
        JOIN connections c2 ON c1.peer_id = c2.user_id
        JOIN users u ON u.id = c2.peer_id
        LEFT JOIN connections d
               ON d.user_id = c1.user_id
              AND d.peer_id = u.id
        WHERE c1.user_id = ?
          AND u.id != ?
          AND d.user_id IS NULL
        ORDER BY u.display_name ASC
        LIMIT ?
      `
      )
      .all(me.id, me.id, limit);

    res.json({ users: rows, count: rows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// Admin: on-demand backfill (idempotent)
app.post("/api/admin/connections/backfill", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  try {
    backfillConnectionsFromInvites();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- Questions ----------
app.post("/api/questions", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const { text } = req.body;
  if (!text || text.length < 5)
    return res.status(400).json({ error: "text_min_5" });
  const qdate = today();
  try {
    const info = db
      .prepare(
        "INSERT INTO questions (user_id, qdate, text, created_at) VALUES (?, ?, ?, ?)"
      )
      .run(me.id, qdate, text, nowIso());
    res.json({ id: info.lastInsertRowid, qdate, text });
  } catch (e) {
    if (String(e).includes("UNIQUE"))
      return res.status(409).json({ error: "already_posted_today" });
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.get("/api/questions/mine", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const row = db
    .prepare("SELECT * FROM questions WHERE user_id = ? AND qdate = ?")
    .get(me.id, today());
  res.json({ question: row || null });
});

// ---------- Weekly (single canonical endpoint) ----------
app.get("/api/weekly", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  try {
    const wkStart = weekStartMonday();
    const phase = currentWeeklyPhase(wkStart);
    const { thuReveal, sunEnd } = weeklyPhaseTimes(wkStart);

    const q = getWeeklyQuestionRow(wkStart);
    if (!q) {
      return res.json({
        week_start: wkStart,
        phase,
        question: null,
        can_submit: false,
        can_read_answers: false,
        submission_open_until: thuReveal.toISOString(),
        reveal_at: thuReveal.toISOString(),
        read_until: sunEnd.toISOString(),
      });
    }

    const answered = db
      .prepare(
        "SELECT 1 FROM answers WHERE question_id = ? AND respondent_id = ?"
      )
      .get(q.id, me.id);
    const payload = {
      week_start: wkStart,
      phase,
      question: {
        id: q.id,
        text: q.text,
        owner_id: q.user_id,
        owner_name: q.owner_name,
        author_name: q.owner_name
      },
      iAnswered: !!answered,
      can_submit: phase === "answering",
      can_read_answers: phase === "reveal",
      submission_open_until: thuReveal.toISOString(),
      reveal_at: thuReveal.toISOString(),
      read_until: sunEnd.toISOString(),
    };

    // Optionally include a small first page of answers only in reveal
    if (phase === "reveal") {
      payload.answers = db
        .prepare(
          `
  SELECT a.id, a.text, a.created_at, u.display_name AS respondent_name,
         (SELECT COUNT(*) FROM votes v WHERE v.answer_id = a.id) AS votes
  FROM answers a
  JOIN users u ON u.id = a.respondent_id
  WHERE a.question_id = ?
  ORDER BY votes DESC, a.created_at ASC
  LIMIT 20
`
        )
        .all(q.id);
    }

    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// Weekly history: list prior (and current) weekly questions by week
// Response shape: { weeks: [{ week_start, question: { id, text, owner_name }, answers_count }] }
app.get("/api/weekly/history", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  try {
    const rows = db
      .prepare(
        `
      SELECT
        w.week_start,
        q.id AS question_id,
        q.text AS question_text,
        u.display_name AS owner_name,
        (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id) AS answers_count
      FROM weekly_rounds w
      JOIN questions q ON q.id = w.question_id
      JOIN users u ON u.id = q.user_id
      ORDER BY w.week_start DESC
      LIMIT 100
    `
      )
      .all();

    const weeks = rows.map((r) => ({
      week_start: r.week_start,
      question: {
        id: r.question_id,
        text: r.question_text,
        owner_name: r.owner_name,
      },
      answers_count: Number(r.answers_count || 0),
    }));

    res.json({ weeks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// Weekly answers for a specific week
// GET /api/weekly/:week_start/answers
// Response: { week_start, question: { id, text, owner_name }, answers: [{ id, text, created_at, votes }] }
app.get("/api/weekly/:week_start/answers", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const weekStart = String(req.params.week_start);
  try {
    const qrow = db
      .prepare(
        `
      SELECT w.week_start, q.id AS question_id, q.text AS question_text, u.display_name AS owner_name
      FROM weekly_rounds w
      JOIN questions q ON q.id = w.question_id
      JOIN users u ON u.id = q.user_id
      WHERE w.week_start = ?
    `
      )
      .get(weekStart);
    if (!qrow) return res.status(404).json({ error: "weekly_not_found" });

    const answers = db
      .prepare(
        `
  SELECT a.id, a.text, a.created_at, u.display_name AS respondent_name,
         (SELECT COUNT(*) FROM votes v WHERE v.answer_id = a.id) AS votes
  FROM answers a
  JOIN users u ON u.id = a.respondent_id
  WHERE a.question_id = ?
  ORDER BY votes DESC, a.created_at ASC
  LIMIT 200
`
      )
      .all(qrow.question_id);

    return res.json({
      week_start: qrow.week_start,
      question: {
        id: qrow.question_id,
        text: qrow.question_text,
        owner_name: qrow.owner_name,
      },
      answers,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// Feed of connections' questions for today
app.get("/api/questions/feed", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  try {
    const row = db
      .prepare(
        `
      SELECT q.id, q.user_id, u.display_name as owner_name, q.text, q.qdate
      FROM questions q
      JOIN users u ON u.id = q.user_id
      WHERE q.asked_at IS NULL
      ORDER BY RANDOM()
      LIMIT 1
    `
      )
      .get();
    const answered = db
      .prepare("SELECT question_id FROM answers WHERE respondent_id = ?")
      .all(me.id);
    const answeredSet = new Set(answered.map((r) => r.question_id));
    const feed = row ? [{ ...row, iAnswered: answeredSet.has(row.id) }] : [];
    res.json({ feed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// Mark a question as asked (when it has appeared in the app)
app.post("/api/questions/:id/asked", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const qid = Number(req.params.id);
  if (!qid || Number.isNaN(qid))
    return res.status(400).json({ error: "invalid_id" });
  try {
    const result = db
      .prepare(
        "UPDATE questions SET asked_at = ? WHERE id = ? AND asked_at IS NULL"
      )
      .run(nowIso(), qid);
    // idempotent: ok=true if we updated; ok=false if it was already set
    res.json({ ok: true, updated: result.changes > 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// (REMOVED: /api/questions/random route)
app.post("/api/answers", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const { questionId, text } = req.body;
  if (!text || text.length < 3)
    return res.status(400).json({ error: "text_min_3" });
  const q = db.prepare("SELECT * FROM questions WHERE id = ?").get(questionId);
  if (!q) return res.status(404).json({ error: "question_not_found" });

  // Check if this is the current weekly question
  const wkStart = weekStartMonday();
  const weeklyRow = db
    .prepare("SELECT question_id FROM weekly_rounds WHERE week_start = ?")
    .get(wkStart);
  const isWeekly = weeklyRow && weeklyRow.question_id === q.id;

  if (isWeekly) {
    // Weekly rules: only allow during answering phase; no connection check; ignore 20:00/day cutoff
    const phase = currentWeeklyPhase(wkStart);
    if (phase !== "answering")
      return res.status(403).json({ error: "weekly_closed" });
    try {
      const info = db
        .prepare(
          "INSERT INTO answers (question_id, respondent_id, text, created_at) VALUES (?, ?, ?, ?)"
        )
        .run(questionId, me.id, text, nowIso());
      return res.json({ id: info.lastInsertRowid, weekly: true });
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        return res.status(409).json({ error: "already_answered" });
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  }

  // Legacy rules (non-weekly questions): keep original constraints
  if (isAfterReveal(q.qdate))
    return res.status(400).json({ error: "past_deadline_20" });
  const conn = db
    .prepare("SELECT 1 FROM connections WHERE user_id = ? AND peer_id = ?")
    .get(q.user_id, me.id);
  if (!conn) return res.status(403).json({ error: "not_first_degree" });
  try {
    const info = db
      .prepare(
        "INSERT INTO answers (question_id, respondent_id, text, created_at) VALUES (?, ?, ?, ?)"
      )
      .run(questionId, me.id, text, nowIso());
    res.json({ id: info.lastInsertRowid, weekly: false });
  } catch (e) {
    if (String(e).includes("UNIQUE"))
      return res.status(409).json({ error: "already_answered" });
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// Owner can see anonymized answers after 20:00
app.get("/api/questions/:id/answers", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const q = db
    .prepare("SELECT * FROM questions WHERE id = ?")
    .get(req.params.id);
  if (!q) return res.status(404).json({ error: "question_not_found" });
  if (q.user_id !== me.id) return res.status(403).json({ error: "not_owner" });
  if (!isAfterReveal(q.qdate))
    return res.status(403).json({ error: "before_reveal_20" });

  const answers = db
    .prepare(
      `
  SELECT a.id, a.text, a.created_at, u.display_name AS respondent_name,
    (SELECT COUNT(*) FROM votes v WHERE v.answer_id = a.id) as votes
  FROM answers a
  JOIN users u ON u.id = a.respondent_id
  WHERE a.question_id = ?
  ORDER BY votes DESC, a.created_at ASC
`
    )
    .all(q.id);
  res.json({ answers });
});

// Upvote after reveal; only owner
app.post("/api/answers/:id/vote", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const ans = db
    .prepare("SELECT * FROM answers WHERE id = ?")
    .get(req.params.id);
  if (!ans) return res.status(404).json({ error: "answer_not_found" });
  const q = db
    .prepare("SELECT * FROM questions WHERE id = ?")
    .get(ans.question_id);
  if (q.user_id !== me.id)
    return res.status(403).json({ error: "only_owner_can_vote" });
  if (!isAfterReveal(q.qdate))
    return res.status(403).json({ error: "before_reveal_20" });
  try {
    db.prepare(
      "INSERT INTO votes (answer_id, voter_id, created_at) VALUES (?, ?, ?)"
    ).run(ans.id, me.id, nowIso());
    res.json({ ok: true });
  } catch (e) {
    if (String(e).includes("UNIQUE"))
      return res.status(409).json({ error: "already_voted" });
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.post("/api/signup/complete", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;

  const answer = (req.body?.answer || "").trim();
  const questionStory = (req.body?.questionStory || "").trim();
  const firstName = (req.body?.firstName || "").trim();
  const lastName = (req.body?.lastName || "").trim();
  const city = (req.body?.city || "").trim();

  if (!answer || answer.length < 10) {
    return res.status(400).json({ error: "answer_min_10" });
  }

  if (firstName || lastName || city) {
    const sets = [];
    const vals = [];
    if (firstName) {
      sets.push("first_name = ?");
      vals.push(firstName);
    }
    if (lastName) {
      sets.push("last_name = ?");
      vals.push(lastName);
    }
    if (city) {
      sets.push("city = ?");
      vals.push(city);
    }
    if (sets.length) {
      try {
        db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(
          ...vals,
          me.id
        );
      } catch (e) {
        console.error("Failed to update user profile fields on signup:", e);
      }
    }
  }

  Signup.saveOnboardingAnswer({
    userId: me.id,
    token: null,
    promptKey: "most_interesting_question",
    answer,
    createdAt: nowIso(),
  });

  try {
    const now = nowIso();
    const userRow = db
      .prepare("SELECT id, display_name, first_name, last_name FROM users WHERE id = ?")
      .get(me.id);
    const displayName =
      userRow?.display_name ||
      [userRow?.first_name, userRow?.last_name].filter(Boolean).join(" ").trim() ||
      me.displayName ||
      `user:${me.id}`;

    const existing = db
      .prepare("SELECT id FROM questions_book WHERE user_id = ? AND question = ? LIMIT 1")
      .get(me.id, answer);

    const background = questionStory.length ? questionStory : null;

    if (!existing) {
      db.prepare(
        `INSERT INTO questions_book (question, posted_by, background, date, upvotes, user_id, anonymous)
         VALUES (?, ?, ?, ?, 0, ?, 0)`
      ).run(answer, displayName, background, now, me.id);
    } else {
      const sets = [
        "posted_by = COALESCE(?, posted_by)",
        "user_id = COALESCE(?, user_id)",
      ];
      const vals = [displayName, me.id];
      if (questionStory.length) {
        sets.push("background = ?");
        vals.push(questionStory);
      }
      db.prepare(
        `UPDATE questions_book
         SET ${sets.join(", ")}
         WHERE id = ?`
      ).run(...vals, existing.id);
    }
  } catch (e) {
    console.error("Failed to persist signup question into questions_book:", e);
  }

  return res.json({ ok: true });
});

// Accept invite + store onboarding answer (runs AFTER Google sign-in)
// Body: { token: string, answer: string }
app.post("/api/invite/accept", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const { token, answer } = req.body || {};
  const questionStory = (req.body?.questionStory || "").trim();

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "missing_token" });
  }
  const trimmedAnswer = (answer || "").trim();
  if (!trimmedAnswer || trimmedAnswer.length < 10) {
    return res.status(400).json({ error: "answer_min_10" });
  }

  const invite = Invites.getInvite(token);
  if (!invite) {
    return res.status(404).json({ error: "invite_not_found" });
  }

  // idempotent-ish: if already accepted by this user, we still save (update) the answer
  if (invite.accepted_by_user_id && invite.accepted_by_user_id !== me.id) {
    return res.status(409).json({ error: "invite_already_used" });
  }

  // Optionally persist profile fields captured during onboarding
  const firstName = (req.body?.firstName || "").trim();
  const lastName  = (req.body?.lastName  || "").trim();
  const city      = (req.body?.city      || "").trim();

  if (firstName || lastName || city) {
    const sets = [];
    const vals = [];
    if (firstName) { sets.push("first_name = ?"); vals.push(firstName); }
    if (lastName)  { sets.push("last_name = ?");  vals.push(lastName);  }
    if (city)      { sets.push("city = ?");       vals.push(city);      }
    try {
      db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals, me.id);
    } catch (e) {
      // If a column is missing (e.g., city), this will log but won't block the flow.
      console.error("Failed to update user profile fields on invite accept:", e);
    }
  }

  // persist onboarding answer
  Signup.saveOnboardingAnswer({
    userId: me.id,
    token,
    promptKey: "most_interesting_question",
    answer: trimmedAnswer,
    createdAt: nowIso(),
  });

  try {
    const now = nowIso();
    const userRow = db
      .prepare("SELECT id, display_name, first_name, last_name FROM users WHERE id = ?")
      .get(me.id);
    const displayName =
      userRow?.display_name ||
      [userRow?.first_name, userRow?.last_name].filter(Boolean).join(" ").trim() ||
      me.displayName ||
      `user:${me.id}`;

    const existing = db
      .prepare("SELECT id FROM questions_book WHERE user_id = ? AND question = ? LIMIT 1")
      .get(me.id, trimmedAnswer);

    const background = questionStory.length ? questionStory : null;

    if (!existing) {
      db.prepare(
        `INSERT INTO questions_book (question, posted_by, background, date, upvotes, user_id, anonymous)
         VALUES (?, ?, ?, ?, 0, ?, 0)`
      ).run(trimmedAnswer, displayName, background, now, me.id);
    } else {
      const sets = [
        "posted_by = COALESCE(?, posted_by)",
        "user_id = COALESCE(?, user_id)",
      ];
      const vals = [displayName, me.id];
      if (questionStory.length) {
        sets.push("background = ?");
        vals.push(questionStory);
      }
      db.prepare(
        `UPDATE questions_book
         SET ${sets.join(", ")}
         WHERE id = ?`
      ).run(...vals, existing.id);
    }
  } catch (e) {
    console.error("Failed to persist invite question into questions_book:", e);
  }

  // mark invite accepted
  Invites.markAccepted({ token, userId: me.id, acceptedAt: nowIso() });

  // Second safety: immediately connect inviter & accepted user (idempotent)
  try {
    const inviterId = (invite && (invite.inviter_id ?? invite.inviterId)) || null;
    if (inviterId) {
      connectBothWays(inviterId, Number(me.id), nowIso());
    } else {
      console.warn("Invite accept: missing inviter_id for token", token);
    }
  } catch (e) {
    console.error("auto-connect on invite accept failed:", e);
  }

  return res.json({ ok: true });
});

app.post("/api/invite/create", (req, res) => {
  // Require a signed-in user; trust the server-side session for inviter identity
  const me = requireUser(req, res);
  if (!me) return;

  const token = (
    req.body?.token || Math.random().toString(36).slice(2)
  ).toLowerCase();

  // Optional metadata to store with the invite (if your schema supports it)
  const firstName = req.body?.firstName?.trim() || null;
  const lastName  = req.body?.lastName?.trim()  || null;

  // Persist with inviterId taken from the session user
  Invites.createInvite({
    token,
    inviterId: me.id,
    firstName,
    lastName,
    createdAt: nowIso(),
  });

  // Include inviterId in the response for easy debugging/confirmation
  res.json({ token, inviterId: me.id });
});

// Utility: search users
app.get("/api/users/search", (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  if (!q) return res.json({ users: [] });
  const rows = db
    .prepare(
      "SELECT id, display_name FROM users WHERE lower(display_name) LIKE ? ORDER BY display_name LIMIT 20"
    )
    .all(`%${q}%`);
  res.json({ users: rows });
});

const PORT = process.env.PORT || 4000;

// Ensure uniqueness so upserts don't duplicate
try {
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_unique ON connections (user_id, peer_id)").run();
} catch (e) {
  console.warn("Could not ensure connections unique index:", e && e.message ? e.message : e);
}


// app.get('/', (req, res) => {
//   const expected = (process.env.BASE_URL || '').trim().replace(/\/+$/, '');
//   const base = baseUrlFromReq(req);
//   // Only redirect if we're not already on the expected public origin
//   if (expected && base !== expected) {
//     return res.redirect(expected + '/');
//   }
//   // Otherwise, don't redirect to self—return a simple 200
//   res.status(200).type('text/plain').send('OK');
// });

app.get("/", (req, res) => {
  const expected = (process.env.BASE_URL || "").trim().replace(/\/+$/, "");
  const base = baseUrlFromReq(req);
  if (expected && base !== expected) {
    return res.redirect(expected + "/");
  }
  // Serve the SPA index so the UI mounts
  return res.sendFile(path.join(publicPath, "index.html"));
});

// SPA fallback: any non-API route should return the client app
app.get(/^\/(?!api\/).*/, (req, res) => {
  return res.sendFile(path.join(publicPath, "index.html"));
});

app.listen(PORT, () => {
  console.log("Asa API listening on http://localhost:" + PORT);
});
