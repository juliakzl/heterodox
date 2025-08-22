export default function WelcomeInvite({ token }) {
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const minLen = 10;

  const shareAndJoin = async () => {
    setErr(null);
    const a = answer.trim();
    if (a.length < minLen) {
      setErr(`Please write at least ${minLen} characters.`);
      return;
    }
    try {
      setBusy(true);
      // Stash the answer so we can finish after Google auth redirects back.
      localStorage.setItem(
        "pendingInvite",
        JSON.stringify({ token, answer: a })
      );
      // Kick off Google Sign-In (server will redirect back to frontend root)
      window.location.href =
        "/api/auth/google?invite=" + encodeURIComponent(token);
    } catch (e) {
      setBusy(false);
      setErr(e.message || "Something went wrong.");
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
            rows="5"
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
            disabled={busy || answer.trim().length < minLen}
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
