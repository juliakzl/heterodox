import { useState } from "react";

const API_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env.VITE_API_BASE !== "undefined")
    ? import.meta.env.VITE_API_BASE
    : ((typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV)
        ? "http://localhost:4000"
        : "");

export default function WelcomeInvite({ token }) {
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // allow using /invite/:token without prop
  const resolvedToken = token || (() => {
    if (typeof window === "undefined") return "";
    const m = window.location.pathname.match(/\/invite\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  })();

  const minLen = 10;

  const shareAndJoin = async () => {
    setErr(null);
    const a = answer.trim();
    if (!resolvedToken) {
      setErr("Invalid or missing invite token.");
      return;
    }
    if (a.length < minLen) {
      setErr(`Please write at least ${minLen} characters.`);
      return;
    }
    try {
      setBusy(true);
      // Stash the answer so we can finish after Google auth redirects back.
      localStorage.setItem(
        "pendingInvite",
        JSON.stringify({ token: resolvedToken, answer: a })
      );
      // Kick off Google Sign-In (server will redirect back to frontend root)
      const url =
        (API_BASE || "") + "/api/auth/google?invite=" + encodeURIComponent(resolvedToken);
      window.location.href = url;
    } catch (e) {
      setBusy(false);
      setErr(e?.message || "Something went wrong.");
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Welcome to heterodox</h2>
        <p className="muted">
          To join this community, first share your answer to the starter prompt
          below.
        </p>
        <div style={{ marginTop: 12 }}>
          <div className="pill">Prompt</div>
          <h3 style={{ marginTop: 8 }}>
            What is the most interesting question you’ve ever been asked?
          </h3>
        </div>
        <div style={{ marginTop: 8 }}>
          <textarea
            rows={5}
            placeholder="Write your answer…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="muted" style={{ marginTop: 6 }}>
            {answer.trim().length}/{minLen} minimum
          </div>
        </div>
        {err && (
          <div className="muted" style={{ color: "crimson", marginTop: 8 }}>
            {err}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={shareAndJoin}
            disabled={
              busy || !resolvedToken || answer.trim().length < minLen
            }
            title={!resolvedToken ? "Missing invite token" : undefined}
          >
            {busy ? "Redirecting…" : "Share & Join with Google"}
          </button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          You’ll be prompted to sign in with Google to create your account and
          save your answer.
        </div>
      </div>
    </div>
  );
}
