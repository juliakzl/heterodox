import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function UserQuestions() {
  const { identifier = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [upvoting, setUpvoting] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const url = encodeURI(`/api/users/${identifier}/questions_book`);
        const res = await fetch(url, {
          credentials: "include",
        });
        if (res.status === 404) {
          if (!cancelled) {
            setError("No questions found for this user.");
            setQuestions([]);
            setUserInfo(null);
          }
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to load user's questions (${res.status})`);
        }
        const json = await res.json();
        if (cancelled) return;
        setQuestions(Array.isArray(json?.data) ? json.data : []);
        setUserInfo(json?.user || null);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load questions.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [identifier]);

  const decodedIdentifier = useMemo(() => {
    try {
      return decodeURIComponent(identifier);
    } catch {
      return identifier;
    }
  }, [identifier]);

  const headingName =
    userInfo?.name ||
    questions?.[0]?.posted_by ||
    (decodedIdentifier.startsWith("name:")
      ? decodedIdentifier.slice(5)
      : decodedIdentifier.startsWith("id:")
      ? `User #${decodedIdentifier.slice(3)}`
      : "User");

  const prettyDate = (value) => {
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
  };

  const handleUpvote = async (questionId) => {
    if (!questionId) return;
    setUpvoting((u) => ({ ...u, [questionId]: true }));
    try {
      const res = await fetch(`/api/questions_book/${questionId}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.status === 401) {
        alert("Please sign in to upvote questions.");
        return;
      }
      if (!res.ok) throw new Error(`Upvote failed (${res.status})`);
      const data = await res.json().catch(() => ({}));
      const newCount = Number(data?.upvotes);
      setQuestions((qs) =>
        qs.map((item) => {
          if (item.id !== questionId) return item;
          const next = { ...item };
          if (Number.isFinite(newCount)) next.upvotes = newCount;
          else next.upvotes = Number(item.upvotes || 0) + 1;
          next.has_upvoted = true;
          return next;
        })
      );
    } catch (e) {
      alert(e.message || "Failed to upvote");
    } finally {
      setUpvoting((u) => ({ ...u, [questionId]: false }));
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div className="qb">
      <style>{`
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&display=swap');
  .qb { 
    --gap: 16px; 
    --gap-lg: 24px;
    --radius: 12px;
    --border: #e7e7ea;
    --muted: #5b6270;
    --text: #0f1222;
    --page-gutter: clamp(16px, 5vw, 56px);
    margin: 0 auto; 
    padding: clamp(12px, 4vw, 32px) var(--page-gutter); 
    max-width: 100%; 
    color: var(--text);
    width: 100%;
    box-sizing: border-box;
  }
  .qb .full-bleed { 
    margin-left: calc(var(--page-gutter) * -1);
    margin-right: calc(var(--page-gutter) * -1);
  }
  .qb h1 {
    margin: 0 0 var(--gap);
    font-size: clamp(1.5rem, 2.5vw, 2rem);
    letter-spacing: -0.01em;
  }
  .qb .topbar { 
    display: flex; 
    gap: var(--gap);
    align-items: center; 
    justify-content: space-between; 
    flex-wrap: wrap;
    margin: var(--gap-lg) 0 var(--gap);
  }
  .qb .back-link {
    color: var(--muted);
    text-decoration: none;
    font-weight: 600;
  }
  .qb .back-link:hover { color: var(--text); }
  .qb ul { 
    list-style: none; 
    margin: 0; 
    padding: 0; 
    display: grid; 
    gap: var(--gap);
  }
  .qb .question-card { 
    color: #9BA7FA;
    background: #ffffff; 
    border: 1px solid var(--border); 
    border-radius: var(--radius); 
    padding: clamp(12px, 2.5vw, 20px); 
    box-shadow: 0 1px 2px rgba(0,0,0,.04);
  }
  .qb .row { display: flex; align-items: flex-start; gap: 12px; }
  .qb .question-text { 
    font-family: 'Fraunces', serif;
    font-weight: 650; 
    font-size: clamp(1rem, 2.2vw, 1.2rem); 
    line-height: 1.35; 
    margin: 0 0 8px; 
    color: var(--text);
  }
  .qb .meta { 
    color: inherit; 
    font-size: 0.92rem; 
    display: flex; 
    flex-wrap: wrap; 
    gap: 6px 12px; 
    align-items: center; 
  }
  .qb .background-panel {
    margin-top: 10px;
    margin-bottom: 10px;
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    background: #fff;
    color: inherit;
    font-size: 0.98rem;
    line-height: 1.4;
  }
  .qb .vote-btn { 
    margin-left: auto; 
    display: inline-flex; 
    align-items: center; 
    gap: 6px; 
    border: 1px solid var(--border); 
    border-radius: 999px; 
    padding: 4px 8px; 
    background: #fff; 
    cursor: pointer; 
    box-shadow: 0 1px 1px rgba(0,0,0,.03);
    color: inherit;
    font-size: 0.9rem;
    line-height: 1;
    flex: 0 0 auto;
    white-space: nowrap;
    min-width: 0;
    transition: transform .05s ease, box-shadow .15s ease;
  }
  .qb .vote-btn .icon { color: currentColor; font-size: 1rem; line-height: 1; }
  .qb .vote-btn .count { font-weight: 600; color: currentColor; }
  .qb .vote-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,.06); }
  .qb .vote-btn:active { transform: translateY(0); box-shadow: 0 1px 1px rgba(0,0,0,.03); }
  .qb .vote-btn[disabled] { opacity: .6; cursor: not-allowed; transform: none; }
  .qb .vote-btn.active {
    background: rgba(145,149,233,.08);
    border-color: #9195E9;
    color: #9195E9;
  }
  .qb .empty {
    padding: 24px;
    border: 1px dashed var(--border);
    border-radius: 12px;
    text-align: center;
    color: var(--muted);
  }
      `}</style>
      <div className="topbar">
        <Link to="/" className="back-link">← Back</Link>
        <div className="muted">{questions.length} question{questions.length === 1 ? "" : "s"}</div>
      </div>
      <h1>asked by {headingName}</h1>

      {error && (
        <div className="empty">{error}</div>
      )}

      {!error && (
        <>
          {questions.length === 0 ? (
            <div className="empty">No questions yet.</div>
          ) : (
            <ul>
              {questions.map((q) => {
                const id = q.id;
                const hasUpvoted = q.has_upvoted === 1 || q.has_upvoted === true;
                const commentCount = Number(q.comments_total ?? 0);
                return (
                  <li key={id} className="question-card">
                    <div className="row">
                      <div className="question-text">
                        <Link to={`/question/${id}`} style={{ textDecoration: "none", color: "inherit" }}>
                          {q.question}
                        </Link>
                      </div>
                      <button
                        className={`vote-btn ${hasUpvoted ? "active" : ""}`}
                        onClick={() => handleUpvote(id)}
                        disabled={!!upvoting[id] || hasUpvoted}
                        aria-label="Upvote question"
                      >
                        <span className="icon" aria-hidden="true">▲</span>
                        <span className="count">{q.upvotes ?? 0}</span>
                      </button>
                    </div>
                    {String(q.background || "").trim() && (
                      <div className="background-panel">{q.background}</div>
                    )}
                    <div className="meta">
                      {q.date ? <span title={q.date}>{prettyDate(q.date)}</span> : null}
                      <span>{commentCount} comment{commentCount === 1 ? "" : "s"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
