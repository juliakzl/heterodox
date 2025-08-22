export default function TodayMain({ setTab }) {
  const [loading, setLoading] = useState(true);
  const [weekly, setWeekly] = useState(null); // payload from /api/weekly
  const [draft, setDraft] = useState("");
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
  const shareWeekly = async () => {
    const q = weekly?.question;
    if (!q) return;
    const shareData = {
      title: "This Week’s Question",
      text: q.text,
      url:
        window.location.origin +
        "?week=" +
        encodeURIComponent(weekly?.week_start || ""),
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(
          `${shareData.title}\n\n${shareData.text}\n${shareData.url}`
        );
        alert("Link copied to clipboard.");
      }
    } catch (_) {
      // user likely canceled; ignore
    }
  };

  const submit = async () => {
    const text = draft.trim();
    const q = weekly?.question;
    if (!q) return;
    if (text.length < 3) {
      alert("Please write at least 3 characters.");
      return;
    }
    try {
      await api("/api/answers", {
        method: "POST",
        body: JSON.stringify({ questionId: q.id, text }),
      });
      setDraft("");
      await fetchWeekly();
    } catch (e) {
      alert(e.message || "Failed to submit your answer.");
    }
  };

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
  const phase = weekly?.phase;
  const iAnswered = !!weekly?.iAnswered;

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
