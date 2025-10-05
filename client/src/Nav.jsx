import logo from "./assets/good-q-logo.png";
import menu from "./assets/menu.svg";

export default function Nav({ me, onLogout }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 10, border: "none", boxShadow: "none" }}>
      <style>{`
  .nav-logo {
    height: 40px;
    margin-right: 12px;
  }
  @media (max-width: 480px) {
    .nav-logo {
      height: 28px;
    }

  .nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* Match QuestionsBook: full width, no horizontal padding */
  max-width: 100%;
  margin: 0 auto;
  padding: 0; /* IMPORTANT: remove side padding so the icon can sit at the far right */
}
  }
`}</style>
      <div className="row" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", fontWeight: 700 }}>
          <img
            src={logo}
            alt="App Logo"
            className="nav-logo"
          />
        </div>
        <div style={{ flex: 1 }}></div>
        <button className="secondary" onClick={onLogout} style={{ padding: 0, border: "none", background: "none" }}>
  <img src={menu} alt="Menu" style={{ height: "24px" }} />
</button>
      </div>
    </div>
  );
}