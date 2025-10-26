import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Nav from "./Nav";
import bg from "./assets/bg-blur.png";
import thought from "./assets/thought.png"

const PAGE_LIMIT = 200;

const getId = (q) => q?.id ?? q?._id ?? null;

export default function Shuffle({ me, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [shuffling, setShuffling] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/questions_book?page=1&limit=${PAGE_LIMIT}&sort=recent`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed to load questions (${res.status})`);
        const text = await res.text();
        const json = text ? JSON.parse(text) : [];
        const items = Array.isArray(json) ? json : json?.data ?? [];
        const visible = items.filter((item) => {
          const flag = item?.hidden ?? item?.is_hidden ?? item?.isHidden;
          return !flag;
        });
        if (!cancelled) {
          setQuestions(visible);
          setCurrentQuestion(pickRandom(visible));
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load questions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    try {
      const card = document.querySelector('.shuffle-card');
      const body = document.querySelector('.shuffle-body');
      const container = document.querySelector('.shuffle-shell .container');
      if (card && body && container) {
        const cw = card.getBoundingClientRect().width;
        const bw = body.getBoundingClientRect().width;
        const nw = container.getBoundingClientRect().width;
        // eslint-disable-next-line no-console
        console.log('[Shuffle width]', { card: cw, body: bw, container: nw, vw: window.innerWidth });
      }
    } catch {}
  }, [currentQuestion]);

  const questionCount = questions.length;
  const currentId = useMemo(() => getId(currentQuestion), [currentQuestion]);

  const selectNext = () => {
    if (!questionCount) return;
    setShuffling(true);
    const update = () => {
      const next = pickRandom(questions, currentId);
      setCurrentQuestion(next);
      setShuffling(false);
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(update);
    } else {
      setTimeout(update, 0);
    }
  };

  const retryLoad = () => {
    setError("");
    setQuestions([]);
    setCurrentQuestion(null);
    setReloadToken((token) => token + 1);
  };

  return (
    <div
      className="shuffle-shell"
      style={{
        '--content-inner-width': '900px',
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
      }}
    >
      <style>{`
        :root { scrollbar-gutter: stable both-edges; }
        .shuffle-shell {
          display: flex;
          flex-direction: column;
          width: 100%;
        }
        .shuffle-body {
          margin: 0 auto;
          max-width: var(--content-inner-width, 900px);
          width: 100%;
          padding: clamp(18px, 4vw, 42px) 0 clamp(36px, 6vw, 64px);
          display: grid;
          gap: clamp(16px, 4vw, 32px);
        }
        .shuffle-card {
          background: #fff;
          border-radius: 32px;
          border: 1px solid rgba(231, 231, 234, 0.9);
          box-shadow: 0 28px 68px rgba(15, 18, 34, 0.22);
          padding: clamp(28px, 6vw, 56px) clamp(24px, 5vw, 48px);
          display: grid;
          gap: clamp(16px, 3vw, 28px);
          min-height: clamp(360px, 55vh, 520px);
          width: min(100%, var(--content-inner-width, 900px));
          margin: 0 auto;
          position: relative;
          overflow: hidden;
          justify-items: center;
          text-align: center;
          align-content: center;
        }
        .shuffle-card::after {
          content: "";
          position: absolute;
          inset: 18px;
          border: 1px dashed rgba(155, 167, 250, 0.28);
          border-radius: 26px;
          pointer-events: none;
        }
        .shuffle-card.no-story {
          min-height: clamp(320px, 50vh, 440px);
          gap: clamp(12px, 2.5vw, 20px);
          padding: clamp(26px, 5vw, 44px) clamp(22px, 5vw, 40px);
        }
        .shuffle-card .question-text {
          font-family: 'Fraunces', var(--font-serif), serif;
          font-size: clamp(1.4rem, 3.4vw, 2.3rem);
          font-weight: 650;
          line-height: 1.35;
          color: #0f1222;
          margin: 0;
          padding-top: clamp(2px, 1.5vw, 12px);
        }
        .shuffle-card .question-meta {
          font-size: clamp(0.95rem, 2.4vw, 1.05rem);
          color: var(--muted, #5b6270);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          width: auto;
          margin: 0 auto;
        }
        .shuffle-card .question-meta span,
        .shuffle-card .question-meta a {
          display: block;
        }
        .shuffle-card .background-panel {
          background: rgba(155, 167, 250, 0.08);
          border-radius: 18px;
          padding: clamp(16px, 3vw, 24px);
          color: #0f1222;
          font-size: clamp(1rem, 2.6vw, 1.15rem);
          line-height: 1.45;
          width: min(100%, 680px);
        }
        .shuffle-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .shuffle-actions {
          display: inline-flex;
          gap: 12px;
          color: #ffffff !important;
        }
        .shuffle-actions button {
          appearance: none;
          border: 2px solid rgba(231, 231, 234, 0.95);
          border-radius: 999px;
          padding: clamp(14px, 2.6vw, 20px) clamp(26px, 6vw, 36px);
          background: linear-gradient(180deg, #A7B2FF 0%, #8E9BFA 100%);
          color: #fff;
          font-weight: 700;
          font-size: clamp(1.05rem, 2.8vw, 1.2rem);
          letter-spacing: 0.2px;
          cursor: pointer;
          transition: transform .06s ease, box-shadow .22s ease, filter .18s ease, background .22s ease;
          box-shadow: 0 16px 36px rgba(155, 167, 250, 0.35), 0 2px 0 rgba(15, 18, 34, 0.05) inset;
        }
        .shuffle-actions button:hover {
          filter: brightness(0.98);
          transform: translateY(-2px);
          box-shadow: 0 22px 44px rgba(155, 167, 250, 0.38);
        }
        .shuffle-actions button:active {
          transform: translateY(1px) scale(0.99);
          box-shadow: 0 10px 22px rgba(155, 167, 250, 0.32);
        }
        .shuffle-actions button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9), 0 0 0 6px rgba(155, 167, 250, 0.7), 0 16px 36px rgba(155, 167, 250, 0.35);
        }
        .shuffle-card a {
          color: #9BA7FA;
          font-weight: 600;
          text-decoration: none;
        }
        .shuffle-card a:hover {
          text-decoration: underline;
        }
        .shuffle-empty,
        .shuffle-error,
        .shuffle-loading {
          margin: clamp(32px, 8vw, 64px) auto;
          text-align: center;
          color: var(--muted, #5b6270);
        }
        .shuffle-error button {
          margin-top: 16px;
          appearance: none;
          border: 1px solid rgba(231, 231, 234, 0.9);
          border-radius: 10px;
          padding: 10px 16px;
          background: #fff;
          cursor: pointer;
          font-weight: 600;
        }
        .shuffle-error button:hover {
          background: rgba(155, 167, 250, 0.12);
        }
        @media (max-width: 640px) {
          .shuffle-card {
            width: min(100%, 92vw);
            min-height: 420px;
          }
          .shuffle-card::after {
            inset: 14px;
          }
          .shuffle-actions button {
            width: 100%;
          }

          .shuffle-card .background-panel .panel-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-weight: 600;                 /* a touch lighter than 700 */
  font-size: clamp(0.75rem, 1.6vw, 0.9rem);  /* smaller text */
  color: var(--muted, #5b6270);
  letter-spacing: 0.01em;           /* normal-ish tracking */
  /* removed: text-transform: uppercase; */
}

.shuffle-card .background-panel .panel-label img {
  width: 18px;
  height: 18px;
  display: block;
}

.shuffle-card .background-panel .panel-body {
  color: #0f1222;
  font-size: clamp(1rem, 2.6vw, 1.15rem);
  line-height: 1.45;
}
        }
      `}</style>
      <div className="container">
        <Nav me={me} onLogout={onLogout} />
        <div className="shuffle-body">
          {loading && (
            <div className="shuffle-loading">Loading a great question…</div>
          )}
          {!loading && error && (
            <div className="shuffle-error">
              <div>{error}</div>
              <button type="button" onClick={retryLoad}>Try again</button>
            </div>
          )}
          {!loading && !error && !currentQuestion && (
            <div className="shuffle-empty">No questions available to shuffle yet.</div>
          )}
          {!loading && !error && currentQuestion && (
            <>
              {(() => {
                const hasBackground = Boolean(String(currentQuestion.background ?? "").trim());
                return (
                  <article
                    className={`shuffle-card${hasBackground ? "" : " no-story"}`}
                    aria-live="polite"
                  >
                    <p className="question-text">{currentQuestion.question}</p>
                    {hasBackground ? (
  <div className="background-panel">
    <div className="panel-label">
      <img src={thought} alt="" aria-hidden="true" />
      <span>Question's story</span>
    </div>
    <div className="panel-body">
      {currentQuestion.background}
    </div>
  </div>
) : null}
                    <div className="question-meta">
                      <span>by {currentQuestion.posted_by ?? currentQuestion.postedBy ?? "—"}</span>
                      {currentQuestion.date ? (
                        <span>{prettyDate(currentQuestion.date)}</span>
                      ) : null}
                      {getId(currentQuestion) ? (
                        <Link to={`/question/${getId(currentQuestion)}`}>Open full thread →</Link>
                      ) : null}
                    </div>
                  </article>
                );
              })()}
              <div className="shuffle-footer">
                <div className="shuffle-actions">
                  <button
                    type="button"
                    onClick={selectNext}
                    disabled={shuffling || !questionCount}
                  >
                    {shuffling ? "Shuffling…" : "Shuffle"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function pickRandom(list, currentId) {
  if (!Array.isArray(list) || !list.length) return null;
  const pool = list.filter((item) => getId(item) != null);
  if (!pool.length) return null;
  const normalizedCurrentId = currentId ?? null;
  let next = pool[Math.floor(Math.random() * pool.length)];
  let attempts = 0;
  while (
    pool.length > 1 &&
    getId(next) === normalizedCurrentId &&
    attempts < 6
  ) {
    next = pool[Math.floor(Math.random() * pool.length)];
    attempts += 1;
  }
  return next;
}

function prettyDate(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return value;
  }
}
