

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
      className="container"
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: 16,
        backgroundImage: `url(${bg})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: 'var(--surface)',
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <Link to="/" className="muted">← Back</Link>
      </div>

      <div className="question-card" style={{ padding: 16 }}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="question-text" style={{ fontSize: "1.2rem", fontWeight: 600 }}>{question.question}</div>
        </div>

        {/* Meta second line (same style): posted by + date */}
        <div className="meta" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%' }}>
            <span><strong>Posted by:</strong> {question.posted_by ?? "—"}</span>
            <span title={question.date}>{new Date(question.date).toLocaleString()}</span>
          </div>
        </div>

        {/* Story */}
        {String(question.background || "").trim() && (
          <div className="background-panel" style={{ marginTop: 12 }}>
            {question.background}
          </div>
        )}

        {/* Comments */}
        <div className="background-panel" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>Comments {commentsTotal ? `(${commentsTotal})` : ''}</div>
            <button type="button" className="btn" onClick={openCommentModal}>Add comment</button>
          </div>
          {commentsLoading ? (
            <div>Loading comments…</div>
          ) : (comments.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
              {comments.map((c) => (
                <li key={c.id} style={{borderTop: '1px dashed var(--border)', paddingTop: 8}}>
                  <div style={{fontSize: '0.95rem'}}>{c.comment}</div>
                  <div className="muted" style={{fontSize: '0.85rem', marginTop: 4}}>
                    — {c.user_name || `User #${c.user_id}`} • {new Date(c.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted">No comments yet.</div>
          ))}
        </div>
      </div>

      {/* Add Comment dialog */}
      <dialog ref={commentDialogRef}>
        <form onSubmit={submitComment} method="dialog">
          <h3>Add comment</h3>
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
            <button type="submit" className="btn" disabled={commentCreating}>{commentCreating ? "Submitting…" : "Submit"}</button>
          </div>
        </form>
      </dialog>

      {/* Auth dialog (same copy as in QuestionsBook) */}
      <dialog ref={authDialogRef} aria-labelledby="auth-modal-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h3 id="auth-modal-title">Join community</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              You first need to log in / sign up to submit comments or upvote questions.
            </p>
          </div>
          <button type="button" aria-label="Close" className="icon-btn" onClick={closeAuthModal}>✕</button>
        </div>
        <div className="actions" style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={handleAuthSignup}>Sign up / Log in</button>
        </div>
      </dialog>
    </div>
  );
}