import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import bg from './assets/bg-blur.png';
import questionPageStyles from "./questionPageStyles";

export default function QuestionPage({ me }) {
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
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const storyDialogRef = useRef(null);
  const [storyText, setStoryText] = useState("");
  const [storySaving, setStorySaving] = useState(false);

  // Upvote state
  const [upvoting, setUpvoting] = useState(false);

  // Auth modal (same look & feel as QuestionsBook)
  const authDialogRef = useRef(null);
  const openAuthModal = () => {
    if (authDialogRef.current?.showModal) authDialogRef.current.showModal();
  };
  const closeAuthModal = () => authDialogRef.current?.close?.();
  const handleAuthLogin = () => {
    const next = typeof window !== "undefined" ? window.location.href : "/";
    closeAuthModal();
    window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
  };

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
  const commentAuthorName = (comment) => {
    if (!comment) return "—";
    if (Number(comment.anonymous) === 1) return "Anonymous";
    return comment.user_name || `User #${comment.user_id}`;
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
    setCommentAnonymous(false);
    commentDialogRef.current?.showModal?.();
  };
  const closeCommentModal = () => {
    commentDialogRef.current?.close?.();
    setCommentText("");
    setCommentAnonymous(false);
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
        body: JSON.stringify({ comment: text, anonymous: commentAnonymous ? 1 : 0 }),
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

  const openStoryModal = () => {
    setStoryText("");
    storyDialogRef.current?.showModal?.();
  };
  const closeStoryModal = () => {
    storyDialogRef.current?.close?.();
    setStoryText("");
  };

  const submitStory = async (e) => {
    e.preventDefault();
    const text = storyText.trim();
    if (!text) {
      alert("Please write the question story.");
      return;
    }
    try {
      setStorySaving(true);
      const res = await fetch(`/api/questions_book/${id}/background`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ background: text }),
      });
      if (res.status === 401) {
        setStorySaving(false);
        closeStoryModal();
        openAuthModal();
        return;
      }
      if (res.status === 409) {
        closeStoryModal();
        alert("This question already has a story.");
        return;
      }
      if (!res.ok) throw new Error(`Failed to add story (${res.status})`);
      setQuestion((q) => (q ? { ...q, background: text } : q));
      closeStoryModal();
    } catch (err) {
      alert(err.message || "Failed to add question story");
    } finally {
      setStorySaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error) return <div style={{ padding: 24, color: "var(--danger)" }}>{error}</div>;
  if (!question) return <div style={{ padding: 24 }}>Not found.</div>;

  const trimmedBackground = String(question.background || "").trim();
  const canAddStory =
    !!me &&
    Number(question.user_id) === Number(me?.id) &&
    !trimmedBackground;

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
      <style>{questionPageStyles}</style>
      <div className="container">
        <div className="question-page">
          <Link to="/" className="back-link">← Back</Link>

          <div className="question-card">
            <div className="row">
              <div className="question-text">
                {question.question}
              </div>
            </div>

            {trimmedBackground ? (
              <div className="background-panel">
                {question.background}
              </div>
            ) : (
              canAddStory && (
                <button
                  type="button"
                  className="add-story-btn"
                  onClick={openStoryModal}
                >
                  + Add question story
                </button>
              )
            )}

            <div className="meta">
              <div className="meta-line">
                <span className="posted-by">
                  <strong>Posted by:</strong>{" "}
                  {(() => {
                    if (Number(question?.anonymous) === 1 || question?.user_id == null) {
                      return "Anonymous";
                    }
                    return question.posted_by ?? "—";
                  })()}
                </span>
                <span className="spacer" />
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
              <div className="meta-date" title={question.date}>{prettyDate(question.date)}</div>
            </div>

            <div className="background-panel comments-block">
              <div className="comments-header">
                <button
                  type="button"
                  className="btn primary"
                  onClick={openCommentModal}
                >
                  Add answer
                </button>
              </div>
              {commentsLoading ? (
                <div>Loading answers…</div>
              ) : (comments.length ? (
                <ul className="comments-list">
                  {comments.map((c) => (
                    <li key={c.id}>
                      <div style={{fontSize: '0.95rem', color: 'var(--text)'}}>{c.comment}</div>
                      <div className="muted" style={{fontSize: '0.85rem', marginTop: 4}}>
                        — {commentAuthorName(c)} • {prettyDate(c.created_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="muted"></div>
              ))}
            </div>
          </div>
        </div>

        <dialog ref={commentDialogRef} className="question-page-dialog">
          <form onSubmit={submitComment} method="dialog">
            <div>
              <h3>Share answer</h3>
            </div>
            <div>
              <label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={4}
                  required
                  placeholder="Write your answer…"
                />
              </label>
            </div>
            <label className="switch" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={commentAnonymous}
                onChange={(e) => setCommentAnonymous(e.target.checked)}
              />
              <span>Answer anonymously</span>
            </label>
            <div className="muted" style={{ marginTop: 6, fontSize: '0.9em' }}>
              Your name won't be shown on this answer.
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={closeCommentModal} disabled={commentCreating}>Cancel</button>
              <button type="submit" className="btn primary" disabled={commentCreating}>{commentCreating ? "Submitting…" : "Submit"}</button>
            </div>
          </form>
        </dialog>

        <dialog ref={storyDialogRef} className="question-page-dialog">
          <form onSubmit={submitStory} method="dialog">
            <div>
              <h3>Add question story</h3>
              <p className="muted" style={{ marginTop: 8 }}>
                Share the context or background for this question so others can follow along.
              </p>
            </div>
            <div>
              <label>
                Story
                <br />
                <textarea
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  rows={4}
                  required
                  placeholder="Write the story behind this question…"
                />
              </label>
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={closeStoryModal} disabled={storySaving}>Cancel</button>
              <button type="submit" className="btn primary" disabled={storySaving}>
                {storySaving ? "Saving…" : "Add story"}
              </button>
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
            <button type="button" className="btn" onClick={handleAuthLogin}>Log in with Google</button>
            <button type="button" className="btn primary" onClick={handleAuthSignup}>Sign up</button>
          </div>
        </dialog>
      </div>
    </div>
  );
}
