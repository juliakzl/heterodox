export default function Nav({ me, onLogout }) {
  return (
    <div className="card" style={{ position: "sticky", top: 0, zIndex: 10 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>heterodox</div>
        <div style={{ flex: 1 }}></div>
        <div className="pill">{me?.displayName}</div>
        <button className="secondary" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
