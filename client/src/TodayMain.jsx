import { useEffect, useState } from "react";
import dayjs from "dayjs";

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
