import { useEffect, useState } from "react";
import dayjs from "dayjs";
import VoiceRecorder from "./VoiceRecorder.jsx";

// Minimal API helper: uses credentials for session cookie; works in dev & prod
const API_BASE = import.meta.env.DEV ? "http://localhost:4000" : "";
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export default function TodayMain({ setTab }) {
  const [loading, setLoading] = useState(true);
  const [weekly, setWeekly] = useState(null); // payload from /api/weekly
  const [error, setError] = useState(null);

  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = answer.trim();
    if (!text) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api("/api/answers", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setAnswer("");
      // Refresh thread so the new answer appears
      await fetchWeekly();
    } catch (err) {
      setSubmitError(err.message || "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  }

  const fetchWeekly = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/api/weekly");
      setWeekly(data);
    } catch (e) {
      setError(e.message || "Failed to load this week’s question.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeekly();
  }, []);

  if (loading) {
    return (
      <div className="card">
        <h3>This Week</h3>
        <div className="muted">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>This Week</h3>
        <div className="muted" style={{ color: "crimson" }}>
          {error}
        </div>
      </div>
    );
  }

  const q = weekly?.question || null;

  if (!q) {
    return (
      <div className="card">
        <h3>This Week</h3>
        <div className="muted">No weekly question has been published yet.</div>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setTab("Ask")}>
            Add a question to the community
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ margin: 0 }}>This Week’s Question</h3>
      <div className="pill" style={{ marginTop: 8 }}>
        Week starting {weekly.week_start}
      </div>
      <p style={{ marginTop: 8, marginBottom: 12 }}>{q.text}</p>

      {/* Answer composer */}
      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <label htmlFor="answerBox" className="muted">Your answer</label>
        <textarea
          id="answerBox"
          rows={4}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Share your perspective…"
          style={{ display: "block", width: "100%", marginTop: 6 }}
        />
        {submitError && (
          <div className="muted" style={{ color: "crimson", marginTop: 6 }}>
            {submitError}
          </div>
        )}
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={submitting || !answer.trim()}>
            {submitting ? "Submitting…" : "Submit answer"}
          </button>
          <button type="button" onClick={() => setAnswer("")} disabled={submitting || !answer}>
            Clear
          </button>
          <VoiceRecorder
            onText={(t) =>
              setAnswer((prev) => (prev ? `${prev}${prev.endsWith(" ") ? "" : " "}${t}` : t))
            }
            disabled={submitting}
            uploadUrl={`${API_BASE}/api/answers/voice`}
          />
        </div>
      </form>

      {/* Answers thread */}
      <div>
        {Array.isArray(weekly.answers) && weekly.answers.length > 0 ? (
          <div className="list">
            {weekly.answers.map((a) => (
              <div key={a.id} className="answer">
                <div className="muted">
                  {a.respondent_name || "Unknown"} •{" "}
                  {dayjs(a.created_at).format("HH:mm")}
                </div>
                <div style={{ marginTop: 6, marginBottom: 6 }}>{a.text}</div>
                <div className="pill">{a.votes} upvotes</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No answers available yet.</div>
        )}
      </div>
    </div>
  );
}
