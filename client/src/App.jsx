import { useEffect, useState } from "react";
import { api } from "./api";
import WeeklyFeed from "./Feed";
import Ask from "./Ask";
import WelcomeInvite from "./WelcomeInvite";
import TodayMain from "./TodayMain";
import Connections from "./Connections";
import Nav from "./Nav";
import './index.css';
import bg from './assets/bg-big.png';
import logo2 from "./assets/logo2.png";
import logo1 from "./assets/logo1.png";
import logo from "./assets/logo.png";
import Events from "./Events";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import QuestionsBook from "./QuestionsBook";

export default function App() {

  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("Main");

  const inviteToken = (() => {
    // 1) query string ?invite=TOKEN
    const qs = new URLSearchParams(window.location.search).get("invite");
    if (qs) return qs;
    // 2) pretty path /invite/TOKEN
    const m = window.location.pathname.match(/^\/invite\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  })();

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

  return (
    <Router>
      <Routes>
        <Route path="/events" element={<Events />} />
        <Route path="/questions-book" element={<QuestionsBook />} />
        <Route
          path="/*"
          element={
            <div style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh' }}>
              {/* NEW: If unauthenticated AND invite token exists → show WelcomeInvite first. */}
              {!me && inviteToken && (
                <>
                  <WelcomeInvite token={inviteToken} />
                </>
              )}

              {!me && !inviteToken && (
                <>
                  <div
                    className="container"
                    style={{ textAlign: "center" }}
                  >
                    <h2>Welcome back!</h2>
                    <p className="muted">Sign in to continue</p>
                    <a href="/api/auth/google" className="btn">
                      Continue with Google
                    </a>
                  </div>
                </>
              )}

              {me && (
                <>
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
                            style={{
                              backgroundColor: '#ffffff',  // button background
                              border: 'none',              // remove default border
                              borderRadius: 8,             // rounded corners
                              padding: '8px 12px',         // optional padding
                            }}
                          >
                            <img src={logo2} alt="Feed" style={{ height: '40px', display: 'block', margin: '0 auto' }} />
                          </button>
                          <button
                            className={tab === "Main" ? "" : "secondary"}
                            onClick={() => setTab("Main")}
                            style={{
                              backgroundColor: '#ffffff',  // button background
                              border: 'none',              // remove default border
                              borderRadius: 8,             // rounded corners
                              padding: '8px 12px',         // optional padding
                            }}
                          >
                            <img src={logo} alt="Main" style={{ height: '40px', display: 'block', margin: '0 auto' }} />
                          </button>
                          <button
                            className={tab === "Connections" ? "" : "secondary"}
                            onClick={() => setTab("Connections")}
                            style={{
                              backgroundColor: '#ffffff',  // button background              
                              border: 'none',              // remove default border
                              borderRadius: 8,             // rounded corners
                              padding: '8px 12px',         // optional padding
                            }}
                          >
                            <img src={logo1} alt="Connections" style={{ height: '40px', display: 'block', margin: '0 auto' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          }
        />
      </Routes>
    </Router>
  );
}
