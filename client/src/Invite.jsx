import { useEffect, useState } from "react";

// Minimal API helper (uses session cookie). In dev points to :4000; in prod uses same-origin.
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

// Exported modal component
export function InviteModal({ onClose = () => {}, onInvited = () => {} }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { inviteUrl?: string, token?: string }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit =
    firstName.trim().length >= 2 && lastName.trim().length >= 2 && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      };
      const j = await api("/api/invite/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      // Accept multiple possible response shapes; ALWAYS share the WelcomeInvite page URL
      const token = j.token || j.inviteToken || "";
      // Default to building an /invite/:token link on the current origin (works in dev/prod)
      let inviteUrl = "";
      if (token) {
        const shareOrigin = (typeof window !== "undefined" ? window.location.origin : "");
        inviteUrl = `${shareOrigin}/invite/${encodeURIComponent(token)}`;
      }
      // If backend already returned a proper /invite link, prefer it
      const serverUrl = j.invite_url || j.url || "";
      if (serverUrl && String(serverUrl).includes("/invite/")) {
        inviteUrl = String(serverUrl);
      }
      setResult({ inviteUrl, token });
      onInvited({ ...j, inviteUrl, token });
    } catch (e) {
      setError(e.message || "Failed to create invite");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    const text = result.inviteUrl || result.token || "";
    try {
      if (navigator.clipboard && text) {
        await navigator.clipboard.writeText(text);
        alert("Copied!");
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      // Fallback: select text in an input field
      const ta = document.getElementById("invite-output");
      if (ta) {
        ta.focus();
        ta.select();
        document.execCommand && document.execCommand("copy");
      }
    }
  };

  // --- styles ---
  const card = { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 8px 30px rgba(0,0,0,0.1)" };
  const row = { display: "flex", gap: 8, alignItems: "center", marginBottom: 10 };
  const label = { width: 120, color: "#374151" };
  const input = { flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" };
  const actions = { display: "flex", gap: 8, marginTop: 12 };

  return (
    <div className="card" style={card} role="form" aria-label="Invite someone">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Invite someone</h3>
        <button
          type="button"
          onClick={onClose}
          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18 }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      {!result && (
        <>
          <div style={row}>
            <label style={label} htmlFor="invite-first">First name</label>
            <input
              id="invite-first"
              style={input}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ada"
              autoComplete="given-name"
            />
          </div>
          <div style={row}>
            <label style={label} htmlFor="invite-last">Last name</label>
            <input
              id="invite-last"
              style={input}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Lovelace"
              autoComplete="family-name"
            />
          </div>

          {error && (
            <div className="muted" style={{ color: "#b91c1c", marginTop: 4 }}>
              {error}
            </div>
          )}

          <div style={actions}>
            <button type="button" onClick={submit} disabled={!canSubmit}>
              {loading ? "Creating…" : "Create invite"}
            </button>
            <button type="button" onClick={onClose} className="secondary">
              Cancel
            </button>
          </div>
        </>
      )}

      {result && (
        <div style={{ marginTop: 10 }}>
          <div className="muted" style={{ marginBottom: 6 }}>
            Share this link (or token) with the person you’re inviting:
          </div>
          <input
            id="invite-output"
            style={{ ...input, fontFamily: "monospace" }}
            readOnly
            value={result.inviteUrl || result.token || ""}
            onFocus={(e) => e.target.select()}
          />
          <div style={actions}>
            <button type="button" onClick={copy}>Copy</button>
            <button type="button" onClick={onClose}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Default export for compatibility if something imports Invite.jsx as default
export default InviteModal;