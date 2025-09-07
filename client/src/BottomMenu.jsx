import logo2 from "./assets/logo2.png";

export default function BottomMenu({ tab, setTab }) {
  return (
    <div
      className="card"
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20 }}
    >
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <button
          className={tab === "Answer" ? "" : "secondary"}
          onClick={() => setTab("Answer")}
          style={{ flex: 1 }}
        >
          <img
            src={logo2}
            alt="Feed"
            style={{ height: "24px", display: "block", margin: "0 auto" }}
          />
        </button>
        <button
          aria-label="Main"
          className={tab === "Ask" ? "" : "secondary"}
          onClick={() => setTab("Ask")}
          style={{ flex: 1 }}
        >
          Main test
        </button>
        <button
          aria-label="Connections"
          className={tab === "Connections" ? "" : "secondary"}
          onClick={() => setTab("Connections")}
          style={{ flex: 1 }}
        >
          Connections
        </button>
      </div>
    </div>
  );
}