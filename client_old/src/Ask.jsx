/* eslint-env browser */
/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";

// Local API helper (keeps sessions via cookies). Replace with your shared helper if present.
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.indexOf("application/json") !== -1 ? res.json() : res.text();
}

export default function Ask({ onClose = () => {} }) {
  const [mine, setMine] = useState(null);
  const [text, setText] = useState("");

  const load = async () => {
    try {
      const j = await api("/api/questions/mine");
      setMine(j && j.question ? j.question : null);
    } catch (err) {
      console.error("Failed to load today's question:", err);
      setMine(null);
    }
  };

  useEffect(() => {
    // Intentionally ignore the returned Promise
    void load();
  }, []);

  const post = async () => {
    const value = text.trim();
    if (value.length < 5) {
      alert("Min 5 chars");
      return;
    }
    try {
      await api("/api/questions", {
        method: "POST",
        body: JSON.stringify({ text: value }),
      });
      setText("");
      load();
    } catch (e) {
      alert(e.message || "Failed to post");
    }
  };

  // Modal styles: backdrop covering screen, panel pinned top-right
  const backdropStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 999,
    // make the backdrop click-through only when intended
    border: "none",
    padding: 0,
    margin: 0,
  };

  const panelStyle = {
    position: "fixed",
    top: 16,
    right: 16,
    width: "min(520px, 95vw)",
    maxHeight: "85vh",
    overflow: "auto",
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    padding: 16,
    zIndex: 1000,
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={backdropStyle}
      />
      <div
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-title"
      >
        <div style={{ position: "relative" }}>
          <h3 id="ask-title" style={{ marginRight: 28 }}>
            Ask (today)
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
              position: "absolute",
              top: -8,
              right: -8,
            }}
          >
            ✕
          </button>
        </div>
        {mine ? (
          <div>
            <div className="pill">Posted {mine.qdate}</div>
            <p style={{ marginTop: 8 }}>{mine.text}</p>
          </div>
        ) : (
          <div>
            <textarea
              rows={3}
              placeholder="What question are you putting to your circle today?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ width: "100%" }}
            />
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => { void post(); }}>
                Post question
              </button>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              You can post one question per day.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
