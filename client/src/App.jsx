import { useEffect, useState } from "react";
import { api } from "./api";
import MatisseTheme from "./MatisseTheme";
import WeeklyFeed from "./Feed";
import Ask from "./Ask";
import WelcomeInvite from "./WelcomeInvite";
import TodayMain from "./TodayMain";
import Connections from "./Connections";
import Nav from "./Nav";

export default function App() {

  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("Main");

  const inviteToken =
    new URLSearchParams(window.location.search).get("invite") || null;

  // After login, finalize any pending invite we stashed before auth.
  const finishPendingInvite = async () => {
    const raw = localStorage.getItem("pendingInvite");
    if (!raw) return;
    try {
      const { token, answer } = JSON.parse(raw);
      if (!token || !answer) return;
      await api("/api/invite/accept", {
        method: "POST",
        body: JSON.stringify({ token, answer }),
      });
    } catch (e) {
      // You may want to surface this in UI; for now, log it.
      console.error("Failed to finalize invite:", e);
    } finally {
      localStorage.removeItem("pendingInvite");
    }
  };

  const load = async () => {
    const j = await api("/api/me");
    setMe(j.user);
    if (j.user) {
      await finishPendingInvite();
    }
  };
  useEffect(() => {
    load();
  }, []);

  const logout = async () => {
    await api("/api/logout", { method: "POST" });
    setMe(null);
  };

  // NEW: If unauthenticated AND invite token exists → show WelcomeInvite first.
  if (!me && inviteToken)
    return (
      <>
        <MatisseTheme />
        <WelcomeInvite token={inviteToken} />
      </>
    );

  if (!me) {
    // No manual sign-in/registration, only Google Sign-In for non-invite users
    return (
      <>
        <MatisseTheme />
        <div
          className="container"
          style={{ textAlign: "center", marginTop: "20vh" }}
        >
          <h2>Welcome back!</h2>
          <p className="muted">Sign in to continue</p>
          <a href="/api/auth/google" className="btn">
            Continue with Google
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <MatisseTheme />
      <div className="container">
        <Nav me={me} onLogout={logout} tab={tab} setTab={setTab} />

        {/* MAIN: Ask button (top-right) + This Week’s Question */}
        {tab === "Main" && (
          <>
            <div
              className="card"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <button onClick={() => setTab("Ask")}>Ask a question</button>
            </div>
            <TodayMain setTab={setTab} />
            <div style={{ marginTop: 16 }} />
          </>
        )}

        {/* FEED tab content (placeholder or use Reveal for now) */}
        {tab === "Feed" && (
          <>
            <WeeklyFeed />
            <div style={{ marginTop: 16 }} />
          </>
        )}

        {/* CONNECTIONS tab */}
        {tab === "Connections" && (
          <>
            <Connections />
            <div style={{ marginTop: 16 }} />
          </>
        )}

        {/* Ask modal only when invoked */}
        {tab === "Ask" && <Ask onClose={() => setTab("Main")} />}

        {/* Spacer so content isn't hidden behind bottom nav */}
        <div style={{ height: 72 }} />

        {/* Bottom menu with three tabs: Feed, Main, Connections */}
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            background: "#fff",
            borderTop: "1px solid #eee",
          }}
        >
          <div
            className="container"
            style={{ paddingTop: 8, paddingBottom: 8 }}
          >
            <div className="row" style={{ justifyContent: "space-around" }}>
              <button
                className={tab === "Feed" ? "" : "secondary"}
                onClick={() => setTab("Feed")}
              >
                Feed
              </button>
              <button
                className={tab === "Main" ? "" : "secondary"}
                onClick={() => setTab("Main")}
              >
                Main
              </button>
              <button
                className={tab === "Connections" ? "" : "secondary"}
                onClick={() => setTab("Connections")}
              >
                Connections
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
