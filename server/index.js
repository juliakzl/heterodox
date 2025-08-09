import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import 'dotenv/config';
import session from 'express-session';
import passport from 'passport';

import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const app = express();

app.set('trust proxy', 1); // important behind nginx/https

app.use(cors({
  origin: true,            // reflect request origin
  credentials: true
}));

app.use(express.json());

app.use(session({
  name: 'asa_sess',
  secret: process.env.SESSION_SECRET || 'dev-secret-not-for-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',                           // needed for OAuth redirect
    secure: process.env.NODE_ENV === 'production', // true only over HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 7            // 7 days
  }
}));


import db from './db.js';

// ---------- Utilities ----------
function today() {
  return dayjs().format('YYYY-MM-DD');
}
function nowIso() {
  return dayjs().toISOString();
}
function isAfterReveal(qdate) {
  const revealAt = dayjs(qdate + ' 20:00');
  return dayjs().isAfter(revealAt);
}
function requireUser(req, res) {
  if (!req.session.user) {
    res.status(401).json({ error: 'Not signed in' });
    return null;
  }
  return req.session.user;
}

// ---------- Passport (Google OAuth 2.0) ----------
passport.serializeUser((user, done) => done(null, { id: user.id, displayName: user.display_name }));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: '/api/auth/google/callback' // nginx keeps scheme/host
  },
  (accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value || null;
      const displayName = profile.displayName || email?.split('@')[0] || 'User';
      const avatar = profile.photos?.[0]?.value || null;

      // Try by google_id first
      let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);

      // Fallback by email (link existing local account)
      if (!user && email) {
        user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (user && !user.google_id) {
          db.prepare('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?')
            .run(googleId, avatar, user.id);
        }
      }

      // Create if not found
      if (!user) {
        const info = db.prepare(
          `INSERT INTO users (display_name, google_id, email, avatar_url, created_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(displayName, googleId, email, avatar, nowIso());

        user = { id: info.lastInsertRowid, display_name: displayName };
      }

      return done(null, { id: user.id, display_name: user.display_name || displayName });
    } catch (e) {
      console.error('GoogleStrategy error:', e);
      return done(e);
    }
  }
));

app.use(passport.initialize());
app.use(passport.session());

// ---------- Auth routes ----------
app.get('/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })
);

app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?err=google' }),
  (req, res) => {
    // Mirror into your existing cookie session shape
    req.session.user = { id: req.user.id, displayName: req.user.displayName || req.user.display_name };
    res.redirect('/'); // or your frontend route
  }
);

app.post('/api/logout', (req, res) => {
  try { req.logout?.(() => {}); } catch {}
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

// ---------- Existing local auth (kept as-is) ----------
app.post('/api/register', (req, res) => {
  const { displayName } = req.body;
  if (!displayName || displayName.length < 2) {
    return res.status(400).json({ error: 'displayName required (min 2 chars)' });
  }
  try {
    const stmt = db.prepare('INSERT INTO users (display_name, created_at) VALUES (?, ?)');
    const info = stmt.run(displayName, nowIso());
    req.session.user = { id: info.lastInsertRowid, displayName };
    res.json({ id: info.lastInsertRowid, displayName });
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ error: 'displayName taken' });
    }
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/login', (req, res) => {
  const { displayName } = req.body;
  const row = db.prepare('SELECT id, display_name FROM users WHERE display_name = ?').get(displayName);
  if (!row) return res.status(404).json({ error: 'not_found' });
  req.session.user = { id: row.id, displayName: row.display_name };
  res.json({ id: row.id, displayName: row.display_name });
});

// ---------- Connections ----------
app.post('/api/connections/add', (req, res) => {
  const me = requireUser(req, res); if (!me) return;
  const { peerDisplayName } = req.body;
  const peer = db.prepare('SELECT id FROM users WHERE display_name = ?').get(peerDisplayName);
  if (!peer) return res.status(404).json({ error: 'peer_not_found' });
  if (peer.id === me.id) return res.status(400).json({ error: 'cannot_connect_to_self' });
  try {
    db.prepare('INSERT INTO connections (user_id, peer_id, created_at) VALUES (?, ?, ?)')
      .run(me.id, peer.id, nowIso());
    res.json({ ok: true });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'already_connected' });
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/connections', (req, res) => {
  const me = requireUser(req, res); if (!me) return;
  const rows = db.prepare(`
    SELECT users.id, users.display_name
    FROM connections
    JOIN users ON users.id = connections.peer_id
    WHERE connections.user_id = ?
    ORDER BY users.display_name ASC
  `).all(me.id);
  res.json({ connections: rows });
});

// ---------- Questions ----------
app.post('/api/questions', (req, res) => {
  const me = requireUser(req, res); if (!me) return;
  const { text } = req.body;
  if (!text || text.length < 5) return res.status(400).json({ error: 'text_min_5' });
  const qdate = today();
  try {
    const info = db.prepare('INSERT INTO questions (user_id, qdate, text, created_at) VALUES (?, ?, ?, ?)')
      .run(me.id, qdate, text, nowIso());
    res.json({ id: info.lastInsertRowid, qdate, text });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'already_posted_today' });
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/questions/mine', (req, res) => {
  const me = requireUser(req, res); if (!me) return;
  const row = db.prepare('SELECT * FROM questions WHERE user_id = ? AND qdate = ?').get(me.id, today());
  res.json({ question: row || null });
});

// Feed of connections' questions for today
app.get('/api/questions/feed', (req, res) => {
  const me = requireUser(req, res); if (!me) return;
  const rows = db.prepare(`
    SELECT q.id, q.user_id, u.display_name as owner_name, q.text, q.qdate
    FROM questions q
    JOIN connections c ON c.peer_id = q.user_id
    JOIN users u ON u.id = q.user_id
    WHERE c.user_id = ? AND q.qdate = ?
    ORDER BY u.display_name ASC
  `).all(me.id, today());
  const answered = db.prepare('SELECT question_id FROM answers WHERE respondent_id = ?').all(me.id);
  const answeredSet = new Set(answered.map(r => r.question_id));
  res.json({ feed: rows.map(r => ({ ...r, iAnswered: answeredSet.has(r.id) })) });
});

// ---------- Answers ----------
app.post('/api/answers', (req, res) => {
  const me = requireUser(req, res); if (!me) return;
  const { questionId, text } = req.body;
  if (!text || text.length < 3) return res.status(400).json({ error: 'text_min_3' });
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!q) return res.status(404).json({ error: 'question_not_found' });
  if (q.qdate !== today()) return res.status(400).json({ error: 'not_today' });
  if (isAfterReveal(q.qdate)) return res.status(400).json({ error: 'past_deadline_20' });
  const conn = db.prepare('SELECT 1 FROM connections WHERE user_id = ? AND peer_id = ?').get(q.user_id, me.id);
  if (!conn) return res.status(403).json({ error: 'not_first_degree' });
  try {
    const info = db.prepare('INSERT INTO answers (question_id, respondent_id, text, created_at) VALUES (?, ?, ?, ?)')
      .run(questionId, me.id, text, nowIso());
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'already_answered' });
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Owner can see anonymized answers after 20:00
app.get('/api/questions/:id/answers', (req, res) => {
  const me = requireUser(req, res); if (!me) return;
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'question_not_found' });
  if (q.user_id !== me.id) return res.status(403).json({ error: 'not_owner' });
  if (!isAfterReveal(q.qdate)) return res.status(403).json({ error: 'before_reveal_20' });

  const answers = db.prepare(`
    SELECT a.id, a.text, a.created_at,
      (SELECT COUNT(*) FROM votes v WHERE v.answer_id = a.id) as votes
    FROM answers a
    WHERE a.question_id = ?
    ORDER BY votes DESC, a.created_at ASC
  `).all(q.id);
  res.json({ answers });
});

// Upvote after reveal; only owner
app.post('/api/answers/:id/vote', (req, res) => {
  const me = requireUser(req, res); if (!me) return;
  const ans = db.prepare('SELECT * FROM answers WHERE id = ?').get(req.params.id);
  if (!ans) return res.status(404).json({ error: 'answer_not_found' });
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(ans.question_id);
  if (q.user_id !== me.id) return res.status(403).json({ error: 'only_owner_can_vote' });
  if (!isAfterReveal(q.qdate)) return res.status(403).json({ error: 'before_reveal_20' });
  try {
    db.prepare('INSERT INTO votes (answer_id, voter_id, created_at) VALUES (?, ?, ?)')
      .run(ans.id, me.id, nowIso());
    res.json({ ok: true });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'already_voted' });
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Utility: search users
app.get('/api/users/search', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ users: [] });
  const rows = db.prepare('SELECT id, display_name FROM users WHERE lower(display_name) LIKE ? ORDER BY display_name LIMIT 20')
    .all(`%${q}%`);
  res.json({ users: rows });
});

const PORT = process.env.PORT || 4000;

app.get('/', (_req, res) => {
  res.redirect('http://localhost:5174/');
});

app.listen(PORT, () => {
  console.log('Asa API listening on http://localhost:' + PORT);
});