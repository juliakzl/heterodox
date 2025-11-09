import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import bg from "./assets/bg-blur.png";
import questionPageStyles from "./questionPageStyles";

export default function BestOf({ me }) {
  const params = useParams();
  const rawParam = params?.question_id;
  const numericParam = Number(rawParam);
  const hasParam = typeof rawParam !== "undefined";
  const validParam = hasParam && Number.isFinite(numericParam) && numericParam > 0;

  const [resolvedQuestionId, setResolvedQuestionId] = useState(
    validParam ? numericParam : null
  );
  const [discoveringId, setDiscoveringId] = useState(!hasParam);
  const [discoverError, setDiscoverError] = useState(validParam ? "" : "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState(null);

  const [bestComments, setBestComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [upvoting, setUpvoting] = useState(false);

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

  useEffect(() => {
    if (typeof rawParam !== "undefined") {
      if (validParam) {
        setResolvedQuestionId(numericParam);
        setDiscoverError("");
      } else {
        setResolvedQuestionId(null);
        setDiscoverError("Invalid question id.");
      }
      setDiscoveringId(false);
      return;
    }

    let cancelled = false;
    setDiscoveringId(true);
    setDiscoverError("");
    (async () => {
      try {
        const res = await fetch("/api/bestof/questions?limit=1");
        if (!res.ok) throw new Error(`Failed to load best answers (${res.status})`);
        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : [];
        const firstId = list[0]?.id;
        if (!cancelled) {
          setResolvedQuestionId(firstId ?? null);
          if (!firstId) {
            setDiscoverError("No best answers have been selected yet.");
          }
        }
      } catch (e) {
        if (!cancelled) setDiscoverError(e.message || "Failed to load best answers");
      } finally {
        if (!cancelled) setDiscoveringId(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawParam, hasParam, validParam, numericParam]);

  useEffect(() => {
    if (!resolvedQuestionId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/questions_book/${resolvedQuestionId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed to load question (${res.status})`);
        const json = await res.json();
        if (!cancelled) setQuestion(json);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load question");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedQuestionId]);

  useEffect(() => {
    if (!resolvedQuestionId) return;
    let cancelled = false;
    (async () => {
      try {
        setCommentsLoading(true);
        const res = await fetch(
          `/api/get/questions_book/${resolvedQuestionId}/comments?bestof=1&limit=200`
        );
        if (!res.ok) throw new Error(`Failed to load best comments (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          const list = Array.isArray(json?.data) ? json.data : [];
          setBestComments(list);
          setCurrentIndex(0);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("BestOf: loading comments failed", e);
          setBestComments([]);
        }
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedQuestionId]);

  const handleUpvote = async () => {
    if (!resolvedQuestionId) return;
    try {
      setUpvoting(true);
      const res = await fetch(`/api/questions_book/${resolvedQuestionId}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.status === 401) {
        setUpvoting(false);
        if (typeof window !== "undefined") {
          const next = `${window.location.pathname}${window.location.search || ""}`;
          window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
        }
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

  if (discoveringId) {
    return <div style={{ padding: 24 }}>Loading best answers…</div>;
  }
  if (discoverError && !resolvedQuestionId) {
    return <div style={{ padding: 24, color: "var(--danger)" }}>{discoverError}</div>;
  }
  if (!resolvedQuestionId) {
    return <div style={{ padding: 24 }}>No best answers have been selected yet.</div>;
  }
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error) return <div style={{ padding: 24, color: "var(--danger)" }}>{error}</div>;
  if (!question) return <div style={{ padding: 24 }}>Not found.</div>;

  const questionId = resolvedQuestionId;

  const trimmedBackground = String(question.background || "").trim();
  const canAddStory =
    !!me && Number(question.user_id) === Number(me?.id) && !trimmedBackground;
  const currentComment = bestComments[currentIndex] || null;
  const totalBest = bestComments.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < totalBest - 1;

  return (
    <div
      className="question-page-shell"
      style={{
        backgroundImage: `url(${bg})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        width: "100%",
      }}
    >
      <style>{questionPageStyles}</style>
      <div className="container">
        <div className="question-page">
          <Link to="/questions-book" className="back-link">
            ← Back
          </Link>

            <div className="question-card bestof-card">
              <div className="best-answer-heading">
                <div>
                  <h2>Best answers</h2>
                  {totalBest > 0 && (
                    <div className="bestof-indicator">
                    </div>
                  )}
                </div>
                {totalBest > 1 && (
                  <div className="bestof-nav">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
                      disabled={!hasPrev}
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setCurrentIndex((idx) => Math.min(totalBest - 1, idx + 1))}
                      disabled={!hasNext}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>

              {commentsLoading ? (
                <div className="best-answer-block">
                  <p className="best-answer-text">Loading best answers…</p>
                </div>
              ) : currentComment ? (
                <div className="best-answer-block">
                  <p className="best-answer-text">{currentComment.comment}</p>
                  <div className="best-answer-meta">
                    — {currentComment.user_name || `User #${currentComment.user_id}`} •{" "}
                    {prettyDate(currentComment.created_at)}
                  </div>
                </div>
              ) : (
                <div className="best-answer-block">
                  <p className="best-answer-text">
                    No best answers have been selected for this question yet.
                  </p>
                </div>
              )}

              <div className="question-mini">
                <div className="question-mini-header">
                  <div className="question-mini-label">Question</div>
                  <button
                    className={`vote-btn question-mini-vote ${question?.has_upvoted ? "active" : ""}`}
                    onClick={handleUpvote}
                    disabled={
                      upvoting || question?.has_upvoted === 1 || question?.has_upvoted === true
                    }
                    aria-label="Upvote question"
                  >
                    <span className="icon" aria-hidden="true">
                      ▲
                    </span>
                    <span className="count">{question?.upvotes ?? 0}</span>
                  </button>
                </div>
                <div className="question-mini-text">{question.question}</div>
                {trimmedBackground ? (
                  <div className="question-mini-story">{question.background}</div>
                ) : (
                  canAddStory && (
                    <Link
                      to={`/question/${questionId}`}
                      className="add-story-btn"
                      style={{ textDecoration: "none", alignSelf: "flex-start" }}
                    >
                      + Add question story
                    </Link>
                  )
                )}
                <div className="question-mini-meta">
                  <span>
                    <strong>Asked by:</strong> {question.posted_by ?? "—"}
                  </span>
                  <span title={question.date}>{prettyDate(question.date)}</span>
                </div>
                <div className="question-mini-actions">
                  <Link
                    to={`/question/${questionId}`}
                    className="btn"
                    style={{ textDecoration: "none" }}
                  >
                    Go to question
                  </Link>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
