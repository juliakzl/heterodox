import logo from "./assets/logo-new.png";
import menu from "./assets/menu.svg";

export default function Nav({ me, onLogout }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 10, border: "none", boxShadow: "none" }}>
      <div className="row" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", fontWeight: 700 }}>
          <img
            src={logo}
            alt="App Logo"
            style={{ height: "24px", marginRight: "8px" }}
          />
          <span style={{ color: "#9BA7FA" }}>Good Questions</span>
        </div>
        <div style={{ flex: 1 }}></div>
        <button className="secondary" onClick={onLogout} style={{ padding: 0, border: "none", background: "none" }}>
  <img src={menu} alt="Menu" style={{ height: "24px" }} />
</button>
      </div>
    </div>
  );
}