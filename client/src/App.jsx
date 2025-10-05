import { useEffect, useState } from "react";
import { api } from "./api";
import WeeklyFeed from "./Feed";
import Ask from "./Ask";
import WelcomeInvite from "./WelcomeInvite";
import Connections from "./Connections";
import Nav from "./Nav";
import './index.css';
import bg from './assets/bg-blur.png';
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
                  <div className="container">
                    <Nav me={me} onLogout={logout} tab={tab} setTab={setTab} />

                    {/* MAIN content for unauthenticated users mirrors logged-in Main */}
                    <>
                      <QuestionsBook />
                      <div style={{ marginTop: 16 }} />
                    </>
                  </div>
                </>
              )}

              {me && (
                <>
                  <div className="container">
                    <Nav me={me} onLogout={logout} tab={tab} setTab={setTab} />

                    {/* MAIN: This Week’s Question */}
                    {tab === "Main" && (
                      <>
                        <QuestionsBook />
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
