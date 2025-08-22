export default function Ask({ onClose = () => {} }) {
  const [mine, setMine] = useState(null);
  const [text, setText] = useState("");

  const load = async () => {
    const j = await api("/api/questions/mine");
    setMine(j.question);
  };
  useEffect(() => {
    load();
  }, []);

  const post = async () => {
    if (text.trim().length < 5) return alert("Min 5 chars");
    try {
      await api("/api/questions", {
        method: "POST",
        body: JSON.stringify({ text: text.trim() }),
      });
      setText("");
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  // Modal styles: backdrop covering screen, panel pinned top-right
  const backdropStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 999,
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
        aria-label="Close"
        onClick={onClose}
        style={backdropStyle}
      ></button>
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
              rows="3"
              placeholder="What question are you putting to your circle today?"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div style={{ marginTop: 8 }}>
              <button onClick={post}>Post question</button>
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
