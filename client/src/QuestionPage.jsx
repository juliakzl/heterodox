import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import bg from './assets/bg-blur.png';

export default function QuestionPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState(null);

  const [comments, setComments] = useState([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Add-comment modal
  const commentDialogRef = useRef(null);
  const [commentText, setCommentText] = useState("");
  const [commentCreating, setCommentCreating] = useState(false);

  // Upvote state
  const [upvoting, setUpvoting] = useState(false);

  // Auth modal (same look & feel as QuestionsBook)
  const authDialogRef = useRef(null);
  const openAuthModal = () => {
    if (authDialogRef.current?.showModal) authDialogRef.current.showModal();
  };
  const closeAuthModal = () => authDialogRef.current?.close?.();
  const handleAuthSignup = () => {
    closeAuthModal();
    window.location.href = `${window.location.origin}/welcome`;
  };

  // Pretty date like: October 11, 2025
  const prettyDate = (value) => {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return value; }
  };

  // Upvote handler (same behavior as list view)
  const handleUpvote = async () => {
    if (!id) return;
    try {
      setUpvoting(true);
      const res = await fetch(`/api/questions_book/${id}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.status === 401) {
        setUpvoting(false);
        openAuthModal();
        return;
      }
      if (!res.ok) throw new Error(`Upvote failed: ${res.status}`);
      const data = await res.json().catch(() => ({}));
      const newCount = Number(data?.upvotes);
      setQuestion((q) => {
        const next = { ...(q || {}) };
        if (Number.isFinite(newCount)) next.upvotes = newCount;
        else next.upvotes = Number(q?.upvotes || 0) + 1;
        next.has_upvoted = true;
        return next;
      });
    } catch (e) {
      alert(e.message || "Failed to upvote");
    } finally {
      setUpvoting(false);
    }
  };

  // Fetch single question
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/questions_book/${id}`, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load question (${res.status})`);
        const q = await res.json();
        if (!cancelled) setQuestion(q);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load question");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Fetch comments (all)
  const fetchComments = async () => {
    try {
      setCommentsLoading(true);
      const res = await fetch(`/api/get/questions_book/${id}/comments?limit=200`);
      if (!res.ok) throw new Error(`Failed to load comments (${res.status})`);
      const json = await res.json();
      setComments(Array.isArray(json?.data) ? json.data : []);
      setCommentsTotal(Number(json?.total ?? 0));
    } catch (e) {
      console.warn("QuestionPage: comments load failed", e);
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openCommentModal = () => {
    setCommentText("");
    commentDialogRef.current?.showModal?.();
  };
  const closeCommentModal = () => {
    commentDialogRef.current?.close?.();
    setCommentText("");
  };

  const submitComment = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return alert("Please write a comment.");
    try {
      setCommentCreating(true);
      const res = await fetch(`/api/questions_book/${id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comment: text }),
      });
      if (res.status === 401) {
        setCommentCreating(false);
        closeCommentModal();
        openAuthModal();
        return;
      }
      if (!res.ok) throw new Error(`Comment failed: ${res.status}`);
      await res.json().catch(() => null);
      closeCommentModal();
      await fetchComments();
    } catch (err) {
      alert(err.message || "Failed to add comment");
    } finally {
      setCommentCreating(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error) return <div style={{ padding: 24, color: "var(--danger)" }}>{error}</div>;
  if (!question) return <div style={{ padding: 24 }}>Not found.</div>;

  return (
    <div
      className="question-page-shell"
      style={{
        backgroundImage: `url(${bg})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&display=swap');
        .question-page-shell {
          display: flex;
          flex-direction: column;
        }
        .question-page {
          --gap: 16px;
          --gap-lg: 24px;
          --radius: 12px;
          --border: #e7e7ea;
          --muted: #5b6270;
          --text: #0f1222;
          display: flex;
          flex-direction: column;
          gap: var(--gap-lg);
          padding: clamp(12px, 4vw, 32px) 0;
          color: var(--text);
        }
        .question-page .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: var(--muted);
          font-weight: 600;
        }
        .question-page .back-link:hover {
          color: var(--text);
        }
        .question-page .question-card {
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: clamp(18px, 3vw, 28px);
          box-shadow: 0 1px 2px rgba(0,0,0,.04);
          display: flex;
          flex-direction: column;
          gap: var(--gap);
          color: #9BA7FA;
        }
        .question-page .row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
        }
        .question-page .question-text {
          font-family: 'Fraunces', var(--font-serif), serif;
          font-weight: 650;
          font-size: clamp(1.15rem, 2.2vw, 1.35rem);
          line-height: 1.4;
          color: var(--text);
          margin: 0;
        }
        .question-page .meta {
          font-size: 0.95rem;
          color: var(--muted);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .question-page .meta-line {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          width: 100%;
        }
        .question-page .meta strong {
          color: var(--text);
        }
        .question-page .background-panel {
          border: 1px dashed var(--border);
          border-radius: 10px;
          padding: 12px 14px;
          background: #fff;
          color: var(--text);
          line-height: 1.4;
        }
        .question-page .background-panel + .background-panel {
          margin-top: var(--gap);
        }
        .question-page .comments-block {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .question-page .comments-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .question-page .comments-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 10px;
        }
        .question-page .comments-list li {
          padding-top: 8px;
          border-top: 1px dashed var(--border);
        }
        .question-page-shell .btn {
          appearance: none;
          border: 1px solid var(--border, #e7e7ea);
          padding: 10px 14px;
          border-radius: 999px;
          background: white;
          cursor: pointer;
          font-weight: 600;
          transition: transform .05s ease, box-shadow .2s ease, background .2s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,.04);
          color: var(--text, #0f1222);
        }
        .question-page-shell .btn.primary {
          background: #9BA7FA;
          border-color: #9BA7FA;
          color: #fff;
        }
        .question-page-shell .btn:hover {
          background: #f4f5f7;
        }
        .question-page-shell .btn.primary:hover {
          filter: brightness(0.95);
        }
        .question-page-shell .btn:active {
          transform: translateY(1px);
        }
        .question-page .vote-btn {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 4px 10px;
          background: #fff;
          cursor: pointer;
          box-shadow: 0 1px 1px rgba(0,0,0,.03);
          color: #9195E9;
          font-size: 0.9rem;
          line-height: 1;
          flex: 0 0 auto;
          transition: transform .05s ease, box-shadow .15s ease;
        }
        .question-page .vote-btn .icon {
          color: currentColor;
          font-size: 1rem;
          line-height: 1;
        }
        .question-page .vote-btn .count {
          font-weight: 600;
          color: currentColor;
        }
        .question-page .vote-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,.06);
        }
        .question-page .vote-btn:active {
          transform: translateY(0);
          box-shadow: 0 1px 1px rgba(0,0,0,.03);
        }
        .question-page .vote-btn[disabled] {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }
        .question-page .vote-btn.active {
          background: rgba(145,149,233,.08);
          border-color: #9195E9;
          color: #9195E9;
        }
        .question-page-shell dialog {
          border: 1px solid var(--border, #e7e7ea);
          border-radius: 16px;
          padding: clamp(18px, 4vw, 26px);
          max-width: min(520px, 90vw);
        }
        .question-page-shell dialog::backdrop {
          background: rgba(15, 18, 34, 0.35);
        }
        .question-page-shell dialog form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .question-page-shell dialog .actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .question-page-shell dialog textarea {
          width: 100%;
          min-height: 140px;
        }
        .question-page-shell dialog h3 {
          margin: 0;
          font-family: 'Fraunces', var(--font-serif), serif;
        }
        @media (max-width: 640px) {
          .question-page .row {
            flex-direction: column;
            align-items: stretch;
          }
          .question-page .vote-btn {
            align-self: flex-start;
            margin-left: 0;
          }
          .question-page .comments-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
      <div className="container">
        <div className="question-page">
          <Link to="/" className="back-link">← Back</Link>

          <div className="question-card">
            <div className="row">
              <div className="question-text">
                {question.question}
              </div>
              <button
                className={`vote-btn ${question?.has_upvoted ? 'active' : ''}`}
                onClick={handleUpvote}
                disabled={upvoting || question?.has_upvoted === 1 || question?.has_upvoted === true}
                aria-label="Upvote question"
              >
                <span className="icon" aria-hidden="true">▲</span>
                <span className="count">{question?.upvotes ?? 0}</span>
              </button>
            </div>

            {String(question.background || "").trim() && (
              <div className="background-panel">
                {question.background}
              </div>
            )}

            <div className="meta">
              <div className="meta-line">
                <span><strong>Posted by:</strong> {question.posted_by ?? "—"}</span>
                <span title={question.date}>{prettyDate(question.date)}</span>
              </div>
            </div>

            <div className="background-panel comments-block">
              <div className="comments-header">
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>Comments {commentsTotal ? `(${commentsTotal})` : ''}</div>
                <button
                  type="button"
                  className="btn primary"
                  onClick={openCommentModal}
                >
                  Add comment
                </button>
              </div>
              {commentsLoading ? (
                <div>Loading comments…</div>
              ) : (comments.length ? (
                <ul className="comments-list">
                  {comments.map((c) => (
                    <li key={c.id}>
                      <div style={{fontSize: '0.95rem', color: 'var(--text)'}}>{c.comment}</div>
                      <div className="muted" style={{fontSize: '0.85rem', marginTop: 4}}>
                        — {c.user_name || `User #${c.user_id}`} • {prettyDate(c.created_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="muted">No comments yet.</div>
              ))}
            </div>
          </div>
        </div>

        <dialog ref={commentDialogRef} className="question-page-dialog">
          <form onSubmit={submitComment} method="dialog">
            <div>
              <h3>Add comment</h3>
            </div>
            <div>
              <label>
                Comment
                <br />
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={4}
                  required
                  placeholder="Write your comment…"
                />
              </label>
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={closeCommentModal} disabled={commentCreating}>Cancel</button>
              <button type="submit" className="btn primary" disabled={commentCreating}>{commentCreating ? "Submitting…" : "Submit"}</button>
            </div>
          </form>
        </dialog>

        <dialog ref={authDialogRef} className="question-page-dialog" aria-labelledby="auth-modal-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <h3 id="auth-modal-title">Join community</h3>
              <p className="muted" style={{ marginTop: 8 }}>
                You first need to log in / sign up to submit comments or upvote questions.
              </p>
            </div>
            <button type="button" aria-label="Close" className="btn" onClick={closeAuthModal}>✕</button>
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn primary" onClick={handleAuthSignup}>Sign up / Log in</button>
          </div>
        </dialog>
      </div>
    </div>
  );
}
