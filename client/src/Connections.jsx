import { useEffect, useState } from "react";

import { InviteModal } from "./Invite.jsx";
const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV
    ? "http://localhost:4000"
    : "";
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

export default function Connections() {
  const [activeTab, setActiveTab] = useState("first"); // 'first' | 'second'

  // First-degree connections
  const [firstList, setFirstList] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  // Second-degree connections
  const [secondList, setSecondList] = useState([]);
  const [secondLoaded, setSecondLoaded] = useState(false);
  const [secondError, setSecondError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadFirst = async () => {
    const j = await api("/api/connections");
    setFirstList(j.connections || []);
  };

  const loadSecond = async () => {
    setSecondError("");
    try {
      // Adjust this endpoint if your API differs:
      const j = await api("/api/connections/second");
      setSecondList(j.connections || j.second_degree || []);
      setSecondLoaded(true);
    } catch (e) {
      setSecondError(e.message || "Failed to load second-degree connections");
      setSecondLoaded(true);
    }
  };

  // Initial load for first-degree
  useEffect(() => {
    void loadFirst();
  }, []);

  // Lazy-load second-degree when tab is switched the first time
  useEffect(() => {
    if (activeTab === "second" && !secondLoaded) {
      void loadSecond();
    }
  }, [activeTab, secondLoaded]);

  const search = async (q) => {
    setQuery(q);
    if (!q.trim()) return setResults([]);
    const j = await api("/api/users/search?q=" + encodeURIComponent(q.trim()));
    setResults(j.users || []);
  };

  const add = async (name) => {
    try {
      await api("/api/connections/add", {
        method: "POST",
        body: JSON.stringify({ peerDisplayName: name }),
      });
      setQuery("");
      setResults([]);
      loadFirst();
    } catch (e) {
      alert(e.message);
    }
  };

  // ---- styles ----
  const tabsWrap = {
    display: "flex",
    gap: 8,
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 12,
  };
  const tabStyle = (on) => ({
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "8px 12px",
    borderBottom: on ? "2px solid #111827" : "2px solid transparent",
    color: on ? "#111827" : "#6b7280",
    fontWeight: on ? 600 : 500,
  });

  return (
    <div className="card">
      <h3>Connections</h3>

      <div style={tabsWrap} role="tablist" aria-label="Connections tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "first"}
          style={tabStyle(activeTab === "first")}
          onClick={() => setActiveTab("first")}
        >
          Primary
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "second"}
          style={tabStyle(activeTab === "second")}
          onClick={() => setActiveTab("second")}
        >
          Mutuals
        </button>
      </div>

      {activeTab === "first" && (
        <>
          <div className="row" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
            <button type="button" onClick={() => setInviteOpen(true)}>Invite a friend</button>
          </div>
          <div className="row">
            <input
              placeholder="Search names…"
              value={query}
              onChange={(e) => search(e.target.value)}
            />
          </div>
          {results.length > 0 && (
            <div className="list">
              {results.map((u) => (
                <div key={u.id ?? u.display_name} className="row">
                  <div>{u.display_name ?? u.name ?? u.email ?? "Unknown"}</div>
                  <div style={{ flex: "none" }}>
                    <button
                      type="button"
                      onClick={() => add(u.display_name ?? u.name)}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }} className="list">
            {firstList.map((c) => (
              <div key={c.id ?? c.display_name} className="pill">
                {c.display_name ?? c.name ?? c.email ?? "Unknown"}
              </div>
            ))}
            {firstList.length === 0 && (
              <div className="muted">
                No connections yet. Add some to exchange answers.
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "second" && (
        <>
          {!secondLoaded && (
            <div className="muted">Loading second‑degree connections…</div>
          )}
          {secondError && (
            <div className="muted" style={{ color: "#b91c1c" }}>
              {secondError}
            </div>
          )}
          {secondLoaded && !secondError && (
            <div className="list" style={{ marginTop: 8 }}>
              {secondList.map((c) => (
                <div key={c.id ?? c.display_name} className="row">
                  <div>{c.display_name ?? c.name ?? c.email ?? "Unknown"}</div>
                  {/* You could add a "Request" button here if your API supports it */}
                </div>
              ))}
              {secondList.length === 0 && (
                <div className="muted">No second‑degree connections yet.</div>
              )}
            </div>
          )}
        </>
      )}
      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}
