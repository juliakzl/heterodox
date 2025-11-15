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
import QuestionPage from "./QuestionPage";
import About from "./About";
import Shuffle from "./Shuffle";
import UserQuestions from "./UserQuestions";
import BestOf from "./BestOf";

export default function App() {

  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("Main");

  // After login, finalize any pending onboarding data we stashed before auth.
  const finishPendingSignup = async () => {
    if (typeof window === "undefined") return;
    const storage = window.localStorage;
    if (!storage) return;
    const raw = storage.getItem("pendingSignup");
    if (!raw) {
      storage.removeItem("pendingInvite"); // cleanup legacy key
      return;
    }
    try {
      const payload = JSON.parse(raw);
      if (!payload || !payload.answer || payload.answer.trim().length < 10) return;
      await api("/api/signup/complete", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // You may want to surface this in UI; for now, log it.
      console.error("Failed to finalize signup:", e);
    } finally {
      storage.removeItem("pendingSignup");
      storage.removeItem("pendingInvite");
    }
  };

  const load = async () => {
    const j = await api("/api/me");
    setMe(j.user);
    if (j.user) {
      await finishPendingSignup();
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
        <Route
          path="/questions-book"
          element={
            <div
              style={{
                backgroundImage: `url(${bg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: '100vh',
              }}
            >
              <div className="container questions-shell">
                <Nav me={me} onLogout={logout} tab={tab} setTab={setTab} />
                <QuestionsBook />
              </div>
            </div>
          }
        />
        <Route path="/about" element={<About me={me} onLogout={logout} />} />
        <Route path="/shuffle" element={<Shuffle me={me} onLogout={logout} />} />
        <Route path="/welcome" element={<WelcomeInvite />} />
        <Route path="/question/:id" element={<QuestionPage me={me} />} />
        <Route path="/bestof/:question_id?" element={<BestOf me={me} />} />
        <Route
          path="/users/:identifier"
          element={
            <div style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh' }}>
              <div className="container">
                <Nav me={me} onLogout={logout} />
                <UserQuestions />
              </div>
            </div>
          }
        />
        <Route
          path="/*"
          element={
            <div style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh' }}>
              {!me && (
                <>
                  <div className="container questions-shell">
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
                  <div className={`container ${tab === "Main" ? "questions-shell" : ""}`}>
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
