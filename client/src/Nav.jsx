import logo from "./assets/logo.png";
import menu from "./assets/menu.svg";

export default function Nav({ me, onLogout }) {
  return (
    <div className="card" style={{ position: "sticky", top: 0, zIndex: 10 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", fontWeight: 700 }}>
          <img
            src={logo}
            alt="App Logo"
            style={{ height: "24px", marginRight: "8px" }}
          />
          Good Questions
        </div>
        <div style={{ flex: 1 }}></div>
        <div className="pill">{me?.displayName}</div>
        <button className="secondary" onClick={onLogout} style={{ padding: 0, border: "none", background: "none" }}>
  <img src={menu} alt="Menu" style={{ height: "24px" }} />
</button>
      </div>
    </div>
  );
}