export default function Connections() {
  const [list, setList] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const load = async () => {
    const j = await api("/api/connections");
    setList(j.connections);
  };
  useEffect(() => {
    load();
  }, []);

  const search = async (q) => {
    setQuery(q);
    if (!q.trim()) return setResults([]);
    const j = await api("/api/users/search?q=" + encodeURIComponent(q.trim()));
    setResults(j.users);
  };
  const add = async (name) => {
    try {
      await api("/api/connections/add", {
        method: "POST",
        body: JSON.stringify({ peerDisplayName: name }),
      });
      setQuery("");
      setResults([]);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="card">
      <h3>Connections</h3>
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
            <div key={u.id} className="row">
              <div>{u.display_name}</div>
              <div style={{ flex: "none" }}>
                <button onClick={() => add(u.display_name)}>Add</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12 }} className="list">
        {list.map((c) => (
          <div key={c.id} className="pill">
            {c.display_name}
          </div>
        ))}
        {list.length === 0 && (
          <div className="muted">
            No connections yet. Add some to exchange answers.
          </div>
        )}
      </div>
    </div>
  );
}
