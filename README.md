# Asa — Daily Questions App (MVP)

This is a minimal full‑stack prototype you can run locally.

## What it does
- Each user sets a display name and can add first‑degree connections.
- Every morning, each user can post **one** question for that day.
- Until **20:00 Europe/Berlin** that same day, any of their first‑degree connections can submit answers.
- After **20:00**, the question owner can see **anonymized** answers from their first‑degree connections and upvote them.

> Note: This is a local demo with simple cookie sessions and no production‑grade security.

## Quick start

### 1) Backend
```bash
cd server
npm install
npm run dev
```
This starts the API on **http://localhost:4000** and initializes `asa.db` (SQLite) with tables.

### 2) Frontend
In another terminal:
```bash
cd client
npm install
npm run dev
```
Open the printed localhost URL from Vite (usually http://localhost:5173).

## Test flow
1. Register as user A and user B (two browser windows / profiles).
2. Add each other as **connections** (directed). 
3. Each user posts today’s question.
4. Before 20:00 Europe/Berlin, answer each other’s questions from the **Answer** tab.
5. After 20:00, from the **Reveal** tab, the question owner can see anonymized answers and upvote.

## Folder structure
- `server/`: Express API + SQLite (better‑sqlite3)
- `client/`: React (Vite)

## Disclaimer
This is an MVP intended for learning and prototyping. Add auth, rate‑limits, input validation, and privacy controls before any real deployment.
