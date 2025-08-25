function Reveal() {
  const [mine, setMine] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [err, setErr] = useState(null);

  const loadMine = async () => {
    const j = await api("/api/questions/mine");
    setMine(j.question);
    setErr(null);
  };
  const loadAnswers = async () => {
    if (!mine) return;
    try {
      const j = await api("/api/questions/" + mine.id + "/answers");
      setAnswers(j.answers);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => {
    loadMine();
  }, []);
  useEffect(() => {
    if (mine) loadAnswers();
  }, [mine]);

  const upvote = async (id) => {
    try {
      await api("/api/answers/" + id + "/vote", { method: "POST" });
      loadAnswers();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="card">
      <h3>Reveal (after 20:00)</h3>
      {!mine && (
        <div className="muted">
          Post a question in Ask to see answers here later today.
        </div>
      )}
      {mine && (
        <div>
          <div className="pill">Your question • {mine.qdate}</div>
          <div style={{ marginTop: 6, marginBottom: 6 }}>{mine.text}</div>
          {err && <div className="muted">Not available yet: {err}</div>}
          <div className="list">
            {answers.map((a) => (
              <div key={a.id} className="answer">
                <div className="muted">
                  Anonymous • {dayjs(a.created_at).format("HH:mm")}
                </div>
                <div style={{ marginTop: 6, marginBottom: 6 }}>{a.text}</div>
                <div className="row" style={{ alignItems: "center" }}>
                  <div className="pill">{a.votes} upvotes</div>
                  <div style={{ flex: "none" }}>
                    <button onClick={() => upvote(a.id)}>Upvote</button>
                  </div>
                </div>
              </div>
            ))}
            {answers.length === 0 && !err && (
              <div className="muted">No answers yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
