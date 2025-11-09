import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const PAGE_SIZE = 50;
const PENDING_SUBMISSION_KEY = "qb:pendingSubmission";
const PENDING_COMMENT_KEY = "qb:pendingComment";

export default function QuestionsBook() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("recent"); // "recent" | "popular"
  const [total, setTotal] = useState(null); // total questions, if provided
  const [upvoting, setUpvoting] = useState({}); // { [id]: boolean }
  const [openBg, setOpenBg] = useState({}); // { [id]: boolean }
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authReturnUrl, setAuthReturnUrl] = useState("");

  const [creating, setCreating] = useState(false);
  const [qText, setQText] = useState("");
  const [background, setBackground] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const dialogRef = useRef(null);
  const commentDialogRef = useRef(null);
  const [commentText, setCommentText] = useState("");
  const [commentCreating, setCommentCreating] = useState(false);
  const [commentTargetId, setCommentTargetId] = useState(null);

  // Comments state per question
  const [commentsMap, setCommentsMap] = useState({}); // { [qid]: { data: Array, total: number } }
  const [commentsLoading, setCommentsLoading] = useState({}); // { [qid]: boolean }
  const [openComments, setOpenComments] = useState({}); // { [qid]: boolean }

  const navigate = useNavigate();
  const handleCardKeyDown = (id) => (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(`/question/${id}`);
    }
  };

  const totalPages = useMemo(() => {
    if (total == null) return null; // unknown
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  async function fetchQuestions(abortSignal, nextPage = page, currentSort = sort) {
    const url = `/api/questions_book?page=${nextPage}&limit=${PAGE_SIZE}&sort=${encodeURIComponent(currentSort)}`;
    const res = await fetch(url, { signal: abortSignal });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const text = await res.text();
    const json = text ? JSON.parse(text) : [];
    const items = Array.isArray(json) ? json : json.data ?? [];
    const totalFromBody = !Array.isArray(json) ? json.total : null;
    const totalFromHeader = Number(res.headers.get("X-Total-Count"));
    setTotal(Number.isFinite(totalFromBody) ? totalFromBody : (Number.isFinite(totalFromHeader) ? totalFromHeader : null));

    // Fallback client-side sort in case server ignores the sort param
    const safeDate = (q) => {
      const d = new Date(q.date);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    };
    const up = (q) => Number.isFinite(Number(q.upvotes)) ? Number(q.upvotes) : 0;

    let sorted = items.slice();
    if (currentSort === "popular") {
      sorted.sort((a, b) => {
        const du = up(b) - up(a);
        return du !== 0 ? du : (safeDate(b) - safeDate(a));
      });
    } else {
      // recent
      sorted.sort((a, b) => {
        const dd = safeDate(b) - safeDate(a);
        return dd !== 0 ? dd : (up(b) - up(a));
      });
    }

    setQuestions(sorted);
  }

  useEffect(() => {
    let abort = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        await fetchQuestions(abort.signal);
      } catch (e) {
        if (e.name !== "AbortError") {
          setError(e.message || "Unknown error");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => abort.abort();
  }, [page, sort]);

  useEffect(() => {
    if (!authModalOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAuthModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authModalOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(PENDING_SUBMISSION_KEY);
      if (!raw) return;
      window.sessionStorage.removeItem(PENDING_SUBMISSION_KEY);
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.intent === "questions_submit" &&
        !(dialogRef.current && dialogRef.current.open)
      ) {
        openDialog({
          question: parsed.question ?? "",
          background: parsed.background ?? "",
        });
      }
    } catch (err) {
      console.warn("QuestionsBook: failed to restore pending submission", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(PENDING_COMMENT_KEY);
      if (!raw) return;
      window.sessionStorage.removeItem(PENDING_COMMENT_KEY);
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.id) {
        // Open comment modal for the stored question id
        openCommentModal({ id: parsed.id, _id: parsed.id });
      }
    } catch (err) {
      console.warn("QuestionsBook: failed to restore pending comment", err);
    }
  }, []);

  const openAuthModal = () => {
    if (dialogRef.current?.open && typeof dialogRef.current.close === "function") {
      dialogRef.current.close();
    }
    const { origin, pathname, search } = window.location;
    setAuthReturnUrl(`${origin}${pathname}${search}`);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthReturnUrl("");
  };

  const persistPendingSubmission = () => {
    if (typeof window === "undefined") return;
    try {
      if (!qText.trim()) {
        window.sessionStorage.removeItem(PENDING_SUBMISSION_KEY);
        return;
      }
      window.sessionStorage.setItem(
        PENDING_SUBMISSION_KEY,
        JSON.stringify({
          intent: "questions_submit",
          question: qText.trim(),
          background,
        })
      );
    } catch (err) {
      console.warn("QuestionsBook: unable to persist pending submission", err);
    }
  };

  const handleAuthLogin = () => {
    persistPendingSubmission();
    const next = authReturnUrl || window.location.href;
    closeAuthModal();
    window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
  };

  const handleAuthSignup = () => {
    persistPendingSubmission();
    closeAuthModal();
    window.location.href = `${window.location.origin}/welcome`;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(dialogRef.current && dialogRef.current.open)) return;
    if (!qText.trim()) {
      window.sessionStorage.removeItem(PENDING_SUBMISSION_KEY);
      return;
    }
    try {
      window.sessionStorage.setItem(
        PENDING_SUBMISSION_KEY,
        JSON.stringify({
          intent: "questions_submit",
          question: qText.trim(),
          background,
        })
      );
    } catch (err) {
      console.warn("QuestionsBook: unable to persist draft", err);
    }
  }, [qText, background]);

  const handleUpvote = async (q) => {
    const id = q.id ?? q._id; // support either id or _id
    if (!id) return;

    setUpvoting((u) => ({ ...u, [id]: true }));
    try {
      const res = await fetch(`/api/questions_book/${id}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.status === 401) {
        setUpvoting((u) => ({ ...u, [id]: false }));
        openAuthModal();
        return;
      }
      if (!res.ok) throw new Error(`Upvote failed: ${res.status}`);
      const data = await res.json().catch(() => ({}));
      const newCount = data.upvotes;

      setQuestions((qs) =>
        qs.map((item) => {
          const match = (item.id ?? item._id) === id;
          if (!match) return item;
          const next = { ...item };
          if (Number.isFinite(newCount)) next.upvotes = newCount;
          next.has_upvoted = true;
          return next;
        })
      );
    } catch (e) {
      alert(e.message || "Failed to upvote");
    } finally {
      setUpvoting((u) => ({ ...u, [id]: false }));
    }
  };

  // ----- Comment modal helpers -----
  const openCommentModal = (q) => {
    const id = q?.id ?? q?._id;
    if (!id) return;
    setCommentTargetId(id);
    setCommentText("");
    if (commentDialogRef.current && commentDialogRef.current.showModal) {
      commentDialogRef.current.showModal();
    }
  };

  const closeCommentModal = () => {
    if (commentDialogRef.current && commentDialogRef.current.close) {
      commentDialogRef.current.close();
    }
    setCommentText("");
    setCommentTargetId(null);
  };

  const fetchCommentsFor = async (qid) => {
    if (!qid) return;
    setCommentsLoading((m) => ({ ...m, [qid]: true }));
    try {
      const res = await fetch(`/api/get/questions_book/${qid}/comments?limit=50`);
      if (!res.ok) throw new Error(`Load comments failed: ${res.status}`);
      const json = await res.json();
      const data = Array.isArray(json?.data) ? json.data : [];
      const total = Number(json?.total ?? data.length) || 0;
      setCommentsMap((m) => ({ ...m, [qid]: { data, total } }));
    } catch (e) {
      console.warn(`Failed to load comments for ${qid}:`, e);
      setCommentsMap((m) => ({ ...m, [qid]: { data: [], total: 0, error: e.message || String(e) } }));
    } finally {
      setCommentsLoading((m) => ({ ...m, [qid]: false }));
    }
  };

  const toggleComments = async (qid) => {
    setOpenComments((m) => ({ ...m, [qid]: !m[qid] }));
    const opened = !openComments[qid];
    if (opened && !commentsMap[qid]) {
      await fetchCommentsFor(qid);
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    const id = commentTargetId;
    const text = commentText.trim();
    if (!id || !text) {
      alert("Please write a comment.");
      return;
    }
    try {
      setCommentCreating(true);
      const res = await fetch(`/api/questions_book/${id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comment: text })
      });
      if (res.status === 401) {
        setCommentCreating(false);
        // Remember intent to reopen after auth
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(PENDING_COMMENT_KEY, JSON.stringify({ id }));
          } catch {}
        }
        // Ensure only one modal is visible
        closeCommentModal();
        openAuthModal();
        return;
      }
      if (!res.ok) throw new Error(`Comment failed: ${res.status}`);
      const created = await res.json().catch(() => null);
      closeCommentModal();

      setCommentsMap((prev) => {
        const prevEntry = prev?.[id];
        const prevData = Array.isArray(prevEntry?.data) ? prevEntry.data : [];
        const appended = created && created.id ? [...prevData, created] : prevData;
        const prevTotal = Number(prevEntry?.total ?? prevData.length) || prevData.length;
        const nextTotal = prevTotal + 1;
        const nextEntry = {
          ...prevEntry,
          data: appended.length ? appended.slice(-50) : appended,
          total: nextTotal,
          error: undefined,
        };
        return { ...prev, [id]: nextEntry };
      });

      setQuestions((qs) =>
        qs.map((q) => {
          const qId = q.id ?? q._id;
          if (String(qId) !== String(id)) return q;
          const prevTotal = Number(q.comments_total ?? q.commentsTotal ?? 0);
          const updatedTotal = Number.isFinite(prevTotal) ? prevTotal + 1 : 1;
          return { ...q, comments_total: updatedTotal };
        })
      );

      alert("Comment added!");
    } catch (err) {
      alert(err.message || "Failed to add comment");
    } finally {
      setCommentCreating(false);
    }
  };

  const handleAddComment = async (q) => {
    const id = q?.id ?? q?._id;
    if (!id) return;
    try {
      // Try a no-op submit to let the server tell us if we are authed
      const res = await fetch(`/api/questions_book/${id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comment: "" }) // will 400 if authed, 401 if not
      });
      if (res.status === 401) {
        // Persist intent and show login modal
        if (typeof window !== "undefined") {
          try { window.sessionStorage.setItem(PENDING_COMMENT_KEY, JSON.stringify({ id })); } catch {}
        }
        openAuthModal();
        return;
      }
      // Authenticated (likely 400 comment_required) -> open the modal now
      openCommentModal(q);
    } catch (e) {
      // Network or other issue: fallback to opening the modal
      openCommentModal(q);
    }
  };

  const toggleBg = (id) => setOpenBg((m) => ({ ...m, [id]: !m[id] }));

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p + 1));

  const openDialog = (prefill) => {
    const data = prefill ?? {};
    setQText(typeof data.question === "string" ? data.question : "");
    setBackground(typeof data.background === "string" ? data.background : "");
    setSort("recent");
    setCreating(false);
    setAnonymous(false);
    if (dialogRef.current && dialogRef.current.showModal) {
      dialogRef.current.showModal();
    }
  };

  const closeDialog = () => {
    if (dialogRef.current && dialogRef.current.close) {
      dialogRef.current.close();
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PENDING_SUBMISSION_KEY);
    }
  };

  const submitQuestion = async (e) => {
    e.preventDefault();
    if (!qText.trim()) {
      alert("Please enter a question.");
      return;
    }
    try {
      setCreating(true);
      const res = await fetch(`/api/questions_book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          question: qText.trim(),
          background: background.trim() || undefined,
          anonymous: anonymous ? 1 : 0,
        }),
      });
      if (res.status === 401) {
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(
              PENDING_SUBMISSION_KEY,
              JSON.stringify({
                intent: "questions_submit",
                question: qText.trim(),
                background,
              })
            );
          } catch (storageError) {
            console.warn("QuestionsBook: unable to persist pending submission", storageError);
          }
        }
        openAuthModal();
        return;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Create failed: ${res.status} ${msg}`);
      }
      // After creating, go to page 1 and reload
      setPage(1);
      setSort("recent");
      await fetchQuestions(undefined, 1, "recent");
      closeDialog();
    } catch (err) {
      alert(err.message || "Failed to create question");
    } finally {
      setCreating(false);
    }
  };

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
    margin: 0 auto;
    padding: clamp(6px, 2vw, 16px) var(--space, 24px) clamp(12px, 4vw, 32px);
    max-width: 100%;
    color: var(--text);
    width: 100%;
    box-sizing: border-box;
    height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
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
    flex-wrap: nowrap; /* keep items on one line */
    margin: var(--gap) 0 var(--gap-lg);
  }
  .qb .tabs { display: inline-flex; gap: 6px; border: 1px solid var(--border); padding: 4px; border-radius: 999px; background: #fff; margin: 0; }
  .qb .tab { appearance: none; border: none; background: transparent; padding: 8px 12px; border-radius: 999px; font-weight: 600; cursor: pointer; color: #9BA7FA; }
  .qb .tab.active, .qb .tab[aria-selected="true"], .qb .tab:active { background: #9BA7FA; color: #fff; }
  .qb .btn {
    appearance: none;
    border: 1px solid var(--border);
    padding: 10px 14px;
    border-radius: 999px;
    background: white;
    cursor: pointer;
    font-weight: 600;
    transition: transform .05s ease, box-shadow .2s ease, background .2s ease;
    box-shadow: 0 1px 2px rgba(0,0,0,.04);
    color: var(--text);
  }
  .qb .topbar .btn {
    background: #9BA7FA;
    color: #fff;
    border-color: #9BA7FA;
  }
  .qb .topbar .btn:hover { filter: brightness(0.95); }
  .qb .topbar .btn:active { transform: translateY(1px); }
  .qb .btn:hover { background: #f4f5f7; }
  .qb .btn:active { transform: translateY(1px); }

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
  .qb .question-card.clickable { cursor: pointer; }
  .qb .scroll-area {
    min-height: 0; /* needed so grid child can actually shrink and scroll */
    overflow: auto;
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
  .qb .author-link {
    color: inherit;
    text-decoration: none;
    font-weight: inherit;
  }
  .qb .author-link:hover { text-decoration: underline; }
  .qb .bg-toggle {
    appearance: none;
    background: transparent;
    border: none;
    padding: 0;
    font: inherit;
    color: #9BA7FA;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .qb .bg-toggle::before {
    content: "▲";
    display: inline-block;
    transform: rotate(90deg); /* right by default */
    transition: transform .2s ease;
    font-size: 0.9rem;
    line-height: 1;
  }
  .qb .bg-toggle[aria-expanded="true"]::before { transform: rotate(180deg); }
  .qb .background-panel {
    margin-top: 10px;
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    background: #fff;
    color: inherit;
    font-size: 0.98rem;
    line-height: 1.4;
  }
  .qb .dot { opacity: .6; }

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
    width: auto;
    white-space: nowrap;
    min-width: 0;
  }
  .qb .vote-btn .icon { color: currentColor; font-size: 1rem; line-height: 1; }
  .qb .vote-btn .count { font-weight: 600; color: currentColor; }
  .qb .vote-btn[disabled] { opacity: .6; cursor: not-allowed; }

  .qb .pager { 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    gap: 12px; 
    margin-top: var(--gap-lg); 
  }
  .qb .pager .btn {
    background: #9BA7FA;
    color: #fff;
    border-color: #9BA7FA;
  }
  .qb .pager .btn[disabled] {
    opacity: 1;
    cursor: not-allowed;
    filter: grayscale(0.2);
  }
  .qb .pager span { min-width: 110px; text-align: center; }

  /* Dialog styling */
  .qb dialog {
    border: none;
    border-radius: var(--radius);
    padding: 0;
    width: clamp(420px, 80vw, 760px); /* bigger on all devices */
    max-width: 90vw;
    color: #9BA7FA; /* inherit from question card color */
  }
  .qb dialog * { color: inherit; }
  .qb dialog form { padding: 24px; }
  .qb dialog form > div { margin-bottom: 16px; }
  .qb dialog form > div:last-child { margin-bottom: 0; }
  .qb dialog label { display: block; width: 100%; font-weight: 600; margin-bottom: 6px; }
  .qb .switch { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
  .qb .switch input[type="checkbox"] {
    appearance: none;
    width: 42px;
    height: 24px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #f2f3f7;
    position: relative;
    outline: none;
    transition: background .2s ease, border-color .2s ease;
  }
  .qb .switch input[type="checkbox"]::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0,0,0,.15);
    transition: transform .2s ease;
  }
  .qb .switch input[type="checkbox"]:checked { background: #9BA7FA; border-color: #9BA7FA; }
  .qb .switch input[type="checkbox"]:checked::after { transform: translateX(18px); }
  .qb dialog textarea, .qb dialog input[type="text"] {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    background: #fff;
    color: inherit;
    margin-top: 6px;
    box-sizing: border-box;
  }
  .qb dialog textarea:focus,
  .qb dialog textarea:focus-visible,
  .qb dialog input[type="text"]:focus,
  .qb dialog input[type="text"]:focus-visible {
    outline: none;
    border-color: #9BA7FA;
    box-shadow: 0 0 0 2px rgba(155, 167, 250, 0.25);
  }
  .qb dialog textarea::placeholder,
  .qb dialog input[type="text"]::placeholder {
    font-weight: 400; /* thinner */
    font-size: 0.9em; /* smaller */
  }
  .qb dialog .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .qb dialog .actions .btn[type="submit"] {
    background: #9BA7FA;
    color: #fff;
    border-color: #9BA7FA;
  }
  .qb dialog .actions .btn[type="submit"]:hover { filter: brightness(0.95); }
  .qb dialog .actions .btn[type="submit"]:active { transform: translateY(1px); }

  .qb .auth-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 18, 34, 0.42);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .qb .auth-modal {
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 18px 48px rgba(15, 18, 34, 0.35);
    width: min(420px, 92vw);
    padding: 28px;
    display: grid;
    gap: 16px;
    position: relative;
  }
  .qb .auth-modal h3 {
    margin: 0;
    font-size: 1.35rem;
    letter-spacing: -0.01em;
  }
  .qb .auth-modal .muted {
    color: var(--muted);
  }
  .qb .auth-modal .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .qb .auth-modal button {
    border-radius: 999px;
    padding: 10px 18px;
    font-weight: 600;
    cursor: pointer;
    transition: transform .05s ease, box-shadow .2s ease, background .2s ease;
  }
  .qb .auth-modal button.primary {
    background: #111321;
    color: #fff;
    border: none;
  }
  .qb .auth-modal button.primary:hover {
    filter: brightness(1.05);
  }
  .qb .auth-modal button.secondary {
    border: 1px solid var(--border);
    background: #f6f7fb;
    color: var(--text);
  }
  .qb .auth-close {
    position: absolute;
    top: 12px;
    right: 12px;
    border: none;
    background: transparent;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
  }

  @media (min-width: 900px) {
    .qb { max-width: 100%; }
  }
`}</style>
      <div className="topbar">
        <div className="tabs" role="tablist" aria-label="Question views">
          <button
            type="button"
            role="tab"
            aria-selected={sort === "recent"}
            className={`tab ${sort === "recent" ? "active" : ""}`}
            onClick={() => { setSort("recent"); setPage(1); }}
          >
            By date
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={sort === "popular"}
            className={`tab ${sort === "popular" ? "active" : ""}`}
            onClick={() => { setSort("popular"); setPage(1); }}
          >
            By popularity
          </button>
        </div>
        <button type="button" className="btn" onClick={openDialog}>Ask a question</button>
      </div>
      <dialog ref={dialogRef}>
        <form onSubmit={submitQuestion} method="dialog">
          <h3>Add question</h3>
          <div>
            <label>
              Question
              <br />
              <textarea
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                rows={4}
                required
              />
            </label>
          </div>
          <div>
            <label>
              Question story (optional)
              <br />
              <input
                type="text"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="e.g., this is what my granda asked me"
              />
            </label>
          </div>
          <div>
            <label className="switch">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />
              <span>Ask anonymously</span>
            </label>
            <div className="muted" style={{ marginTop: 6, fontSize: '0.9em' }}>
              Your name won't be shown on this question.
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={closeDialog} disabled={creating}>Cancel</button>
            <button type="submit" className="btn" disabled={creating}>{creating ? "Submitting…" : "Submit"}</button>
          </div>
        </form>
      </dialog>

      <dialog ref={commentDialogRef}>
        <form onSubmit={submitComment} method="dialog">
          <h3>Add answer</h3>
          <div>
            <label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={4}
                required
                placeholder="💭"
              />
            </label>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={closeCommentModal} disabled={commentCreating}>Cancel</button>
            <button type="submit" className="btn" disabled={commentCreating}>{commentCreating ? "Submitting…" : "Submit"}</button>
          </div>
        </form>
      </dialog>

      <div className="scroll-area">
        {error && (
          <div>⚠️ {error}</div>
        )}

        {loading ? (
          <div>Loading…</div>
        ) : (
          <>
            <ul>
              {questions.map((q) => {
                const id = q.id ?? q._id;
                const bgText = String(q.background ?? q.asked_by ?? q.askedBy ?? "");
                const commentsCount = Number(q.comments_total ?? commentsMap[id]?.total ?? 0);
                return (
                  <li
                    key={id}
                    className="question-card clickable"
                    role="link"
                    tabIndex={0}
                    aria-label={`Open question: ${q.question}`}
                    onClick={() => navigate(`/question/${id}`)}
                    onKeyDown={handleCardKeyDown(id)}
                  >
                    <div className="row">
                      <div className="question-text">
                        <Link to={`/question/${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          {q.question}
                        </Link>
                      </div>
                      <button
                        className="vote-btn"
                        onClick={(e) => { e.stopPropagation(); handleUpvote(q); }}
                        disabled={!!upvoting[id] || q.has_upvoted === 1 || q.has_upvoted === true}
                        aria-label="Upvote question"
                      >
                        <span className="icon" aria-hidden="true">▲</span>
                        <span className="count">{q.upvotes ?? 0}</span>
                      </button>
                    </div>
                    <div className="meta">
                      {/* First line: toggles */}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%' }}>
                        {bgText.trim() ? (
                          <button
                            type="button"
                            className="bg-toggle"
                            onClick={(e) => { e.stopPropagation(); toggleBg(id); }}
                            aria-expanded={!!openBg[id]}
                            aria-controls={`bg-${id}`}
                          >
                            {openBg[id] ? "Question's story" : "Question's story"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="bg-toggle"
                          onClick={(e) => { e.stopPropagation(); toggleComments(id); }}
                          aria-expanded={!!openComments[id]}
                          aria-controls={`comments-${id}`}
                        >
                          {openComments[id] ? "Answers" : `Answers (${commentsCount})`}
                        </button>
                      </div>

                      {/* Second line: posted by + date */}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%' }}>
                        <span>
                          <strong>Posted by:</strong>{" "}
                          {(() => {
                            // If question is marked anonymous (boolean true or 1), show Anonymous without a link
                            if (q && (q.anonymous === true || Number(q.anonymous) === 1)) {
                              return 'Anonymous';
                            }
                            const displayName = String(q.posted_by ?? q.postedBy ?? '—').trim() || '—';
                            if (!displayName || displayName === '—') return displayName;
                            const hasUserId = q.user_id !== null && q.user_id !== undefined;
                            const authorIdentifier = hasUserId ? `id:${q.user_id}` : `name:${displayName}`;
                            return (
                              <Link
                                to={`/users/${encodeURIComponent(authorIdentifier)}`}
                                className="author-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {displayName}
                              </Link>
                            );
                          })()}
                        </span>
                        <span title={q.date}>{formatDate(q.date)}</span>
                      </div>
                    </div>

                    {bgText.trim() && openBg[id] && (
                      <div id={`bg-${id}`} className="background-panel">
                        {bgText}
                      </div>
                    )}

                    {openComments[id] && (
                      <div id={`comments-${id}`} className="background-panel">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <button
                            type="button"
                            className="btn"
                            onClick={(e) => { e.stopPropagation(); handleAddComment({ id }); }}
                            aria-label="Add answer"
                          >
                            Add answer
                          </button>
                        </div>
                        {commentsLoading[id] ? (
                          <div>Loading answers…</div>
                        ) : (commentsMap[id]?.data?.length ? (
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
                            {commentsMap[id].data.map((c) => (
                              <li key={c.id} style={{borderTop: '1px dashed var(--border)', paddingTop: 8}}>
                                <div style={{fontSize: '0.95rem'}}>{c.comment}</div>
                                <div className="muted" style={{fontSize: '0.85rem', marginTop: 4}}>
                                  — {c.user_name || `User #${c.user_id}`} • {formatDate(c.created_at)}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="muted"></div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="pager">
              <button className="btn" onClick={goPrev} disabled={page === 1}>
                ‹
              </button>
              <span>
                Page {page}
                {totalPages ? ` of ${totalPages}` : ""}
              </span>
              <button className="btn" onClick={goNext} disabled={totalPages ? page >= totalPages : questions.length < PAGE_SIZE}>
                ›
              </button>
            </div>
          </>
        )}
      </div>

      {authModalOpen && (
        <div
          className="auth-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeAuthModal();
            }
          }}
        >
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <button
              type="button"
              className="auth-close"
              aria-label="Close"
              onClick={closeAuthModal}
            >
              ✕
            </button>
            <div>
              <h3 id="auth-modal-title">Join community</h3>
              <p className="muted" style={{ marginTop: 8 }}>
                You first need to log in or sign up to submit comments or upvote questions.
              </p>
            </div>
            <div className="actions">
              <button
                type="button"
                className="primary"
                onClick={handleAuthLogin}
              >
                Log in with Google
              </button>
              <button
                type="button"
                className="secondary"
                onClick={handleAuthSignup}
              >
                Sign up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(input) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
