import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import "dotenv/config";
import session from "express-session";
import passport from "passport";
import multer from "multer";

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import * as Invites from "./invites.js";
import * as Signup from "./signup.js";
import voiceRouter from './voice.js';
import { generateWeeklyAIQuestion } from "./ai.js";

const app = express();
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

app.use(voiceRouter);

import db from "./db.js";

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

// User ID used to attribute AI-generated weekly questions
const AI_QUESTION_USER_ID = parseInt(process.env.AI_QUESTION_USER_ID || "1", 10);

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

// ---------- Weekly auto-publish (scheduler) ----------
function selectOldestUnusedQuestion() {
  return db.prepare(`
    SELECT q.id, q.user_id, q.created_at
    FROM questions q
    WHERE q.asked_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM weekly_rounds w WHERE w.question_id = q.id)
    ORDER BY q.created_at ASC, q.id ASC
    LIMIT 1
  `).get();
}

function publishOldestForWeek(weekStartStr) {
  const wk = String(weekStartStr).slice(0, 10);
  // Do not overwrite an existing weekly entry
  const exists = db.prepare('SELECT 1 FROM weekly_rounds WHERE week_start = ?').get(wk);
  // Already published for this week — treat as success (idempotent)
  if (exists) return true;

  const q = selectOldestUnusedQuestion();
  if (!q) {
    console.warn(`Weekly publish: no unused questions available for week ${wk}`);
    return false;
  }

  // Publish atomically and mark as used to avoid re-picking
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO weekly_rounds (week_start, question_id, published_at)
      VALUES (?, ?, ?)
    `).run(wk, q.id, nowIso());

    db.prepare(`
      UPDATE questions SET asked_at = ? WHERE id = ? AND asked_at IS NULL
    `).run(nowIso(), q.id);
  });
  tx();

  console.log(`Weekly publish: week=${wk} question_id=${q.id}`);
  return true;
}

async function ensureCurrentWeekPublished() {
  const wk = weekStartMonday();
  try {
    // 1) Try to publish the oldest human-submitted question
    if (publishOldestForWeek(wk)) return true;

    // 2) None available — generate one with AI and publish it
    let text = null;
    try {
      text = await generateWeeklyAIQuestion();
    } catch (e) {
      console.error("AI question generation failed:", e);
      text = null;
    }
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      console.warn("AI generation returned no usable question, skipping publish for week", wk);
      return false;
    }

    // Only insert an AI question if there are no other unused ones.
    // Guard against duplicate inserts for the same (AI user, qdate).
    const existingAI = db.prepare(`
      SELECT id FROM questions
      WHERE user_id = ? AND qdate = ? AND asked_at IS NULL
    `).get(AI_QUESTION_USER_ID, today());

    let insertedId = existingAI?.id || null;
    if (!insertedId) {
      const insert = db.prepare(`
        INSERT INTO questions (user_id, qdate, text, created_at)
        VALUES (?, ?, ?, ?)
      `).run(AI_QUESTION_USER_ID, today(), text.trim(), nowIso());
      insertedId = insert.lastInsertRowid;
      console.log(`Inserted AI weekly question id=${insertedId} for week=${wk}`);
    } else {
      console.log(`Reusing existing AI question id=${insertedId} for today`);
    }

    // Publish (will no-op if already published)
    return publishOldestForWeek(wk);
  } catch (e) {
    console.error("ensureCurrentWeekPublished failed:", e);
    return false;
  }
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

// ---------- Passport (Google OAuth 2.0) ----------
passport.serializeUser((user, done) =>
  done(null, { id: user.id, displayName: user.display_name })
);
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: "/api/auth/google/callback", // reverse proxy keeps scheme/host
      passReqToCallback: true,
    },
    (req, accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value || null;
        const displayName =
          profile.displayName || email?.split("@")[0] || "User";
        const avatar = profile.photos?.[0]?.value || null;

        // 1) Existing user? allow login with or without invite.
        let user = db
          .prepare("SELECT * FROM users WHERE google_id = ?")
          .get(googleId);
        if (!user && email) {
          // only treat as existing if the email is already linked to Google
          user = db
            .prepare(
              "SELECT * FROM users WHERE email = ? AND google_id IS NOT NULL"
            )
            .get(email);
        }
        if (user) {
          return done(null, {
            id: user.id,
            display_name: user.display_name || displayName,
          });
        }

        // 2) New user -> require invite token captured earlier
        const token = req.session.inviteToken;
        if (!token) {
          return done(null, false, { message: "invite_required" });
        }
        const invite = Invites.getInvite(token);
        if (
          !invite ||
          (invite.accepted_by_user_id && invite.accepted_by_user_id !== null)
        ) {
          return done(null, false, { message: "invalid_or_used_invite" });
        }

        // 3) Create the new user (invite-only)
        const info = db
          .prepare(
            `INSERT INTO users (display_name, google_id, email, avatar_url, created_at)
         VALUES (?, ?, ?, ?, ?)`
          )
          .run(displayName, googleId, email, avatar, nowIso());

        // Mark invite accepted here (optional; frontend will still post onboarding answer)
        Invites.markAccepted({
          token,
          userId: info.lastInsertRowid,
          acceptedAt: nowIso(),
        });

        // Immediately connect inviter & new user (idempotent; relies on UNIQUE constraint)
        try {
          const inviterId = (invite && (invite.inviter_id ?? invite.inviterId)) || null;
          if (inviterId) {
            connectBothWays(inviterId, Number(info.lastInsertRowid), nowIso());
          } else {
            console.warn("Invite present but no inviter_id; skipping auto-connect for user", info.lastInsertRowid);
          }
        } catch (e) {
          console.error("auto-connect on signup failed:", e);
        }

        // Clear the invite token from session so it can't be reused inadvertently
        req.session.inviteToken = null;

        return done(null, {
          id: info.lastInsertRowid,
          display_name: displayName,
        });
      } catch (e) {
        console.error("GoogleStrategy error:", e);
        return done(e);
      }
    }
  )
);

app.use(passport.initialize());
app.use(passport.session());

// ---------- Auth routes ----------
// Capture invite token (if present) before sending user to Google
app.get("/api/auth/google", (req, res, next) => {
  if (req.query.invite) {
    req.session.inviteToken = String(req.query.invite);
  }
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })(req, res, next);
});

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/auth/fail?reason=invite",
  }),
  (req, res) => {
    req.session.user = {
      id: req.user.id,
      displayName: req.user.displayName || req.user.display_name,
    };
    const expected = (process.env.BASE_URL || "").trim().replace(/\/+$/, "");
    if (expected) {
      // Always send the browser to the public frontend origin after OAuth
      return res.redirect(expected + "/");
    }
    // Dev fallback if BASE_URL isn't set
    if (process.env.NODE_ENV !== "production") {
      return res.redirect("http://localhost:5173/");
    }
    // Last resort: stay on current origin
    return res.redirect("/");
  }
);

app.get("/api/auth/fail", (req, res) => {
  res.status(401).json({ error: req.query.reason || "auth_failed" });
});

app.post("/api/logout", (req, res) => {
  try {
    req.logout?.(() => {});
  } catch {}
  req.session.destroy(() => {
    res.clearCookie("asa_sess");
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
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

    const totalRow = db.prepare("SELECT COUNT(*) as c FROM questions_book").get();
    const total = Number(totalRow?.c || 0);

    const rows = db.prepare(
      `SELECT id, question, posted_by, asked_by, date, upvotes
       FROM questions_book
       ORDER BY datetime(date) DESC, id DESC
       LIMIT ? OFFSET ?`
    ).all(limit, offset);

    res.setHeader("Cache-Control", "no-store");
    return res.json({ data: rows, total });
  } catch (e) {
    console.error("/questions_book failed:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /questions_book/:id/upvote -> { id, upvotes }
app.post("/api/questions_book/:id/upvote", (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid_id" });

    const tx = db.transaction((qid) => {
      const upd = db.prepare("UPDATE questions_book SET upvotes = upvotes + 1 WHERE id = ?").run(qid);
      if (!upd.changes) return null;
      const row = db.prepare("SELECT id, upvotes FROM questions_book WHERE id = ?").get(qid);
      return row;
    });

    const out = tx(id);
    if (!out) return res.status(404).json({ error: "not_found" });
    return res.json(out);
  } catch (e) {
    console.error("/questions_book/:id/upvote failed:", e);
    return res.status(500).json({ error: "server_error" });
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

// Accept invite + store onboarding answer (runs AFTER Google sign-in)
// Body: { token: string, answer: string }
app.post("/api/invite/accept", (req, res) => {
  const me = requireUser(req, res);
  if (!me) return;
  const { token, answer } = req.body || {};

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "missing_token" });
  }
  if (!answer || answer.trim().length < 10) {
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
    answer: answer.trim(),
    createdAt: nowIso(),
  });

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


// Kick off weekly auto-publish on boot and poll periodically (idempotent)
const WEEKLY_PUBLISH_CHECK_EVERY_MS = parseInt(process.env.WEEKLY_PUBLISH_CHECK_EVERY_MS || '300000', 10); // default 5 min
if (process.env.WEEKLY_PUBLISH_DISABLED !== '1') {
  // Ensure current week has a published question right away (fire-and-forget)
  ensureCurrentWeekPublished().catch(() => {});
  // Then keep checking; when a new Monday arrives this will insert for the new week
  setInterval(() => { ensureCurrentWeekPublished().catch(() => {}); }, WEEKLY_PUBLISH_CHECK_EVERY_MS);
}

// Run the idempotent backfill periodically (e.g. every 5 minutes)
const BACKFILL_INTERVAL_MS = parseInt(process.env.CONNECTIONS_BACKFILL_EVERY_MS || '300000', 10);

let backfillRunning = false;
setInterval(() => {
  if (backfillRunning) return;
  backfillRunning = true;
  try {
    backfillConnectionsFromInvites(); // INSERT OR IGNORE -> safe upsert
  } catch (e) {
    console.error("Periodic connections backfill failed:", e);
  } finally {
    backfillRunning = false;
  }
}, BACKFILL_INTERVAL_MS);
// On boot: rebuild any missing connections from accepted invites (no deletes)
backfillConnectionsFromInvites();

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
