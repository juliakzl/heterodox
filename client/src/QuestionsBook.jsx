import React, { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 50;

export default function QuestionsBook() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("recent"); // "recent" | "popular"
  const [total, setTotal] = useState(null); // total questions, if provided
  const [upvoting, setUpvoting] = useState({}); // { [id]: boolean }
  const [openBg, setOpenBg] = useState({}); // { [id]: boolean }

  const [creating, setCreating] = useState(false);
  const [qText, setQText] = useState("");
  const [background, setBackground] = useState("");
  const dialogRef = useRef(null);

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

  // Prompt the user and redirect to Google sign-in
  const promptSignIn = () => {
    if (window.confirm("Sign in to upvote this question? You’ll be redirected to Google.")) {
      const next = window.location.href; // return here after login
      window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
    }
  };

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
        // Not signed in: prompt and redirect to Google OAuth
        setUpvoting((u) => ({ ...u, [id]: false }));
        promptSignIn();
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

  const toggleBg = (id) => setOpenBg((m) => ({ ...m, [id]: !m[id] }));

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p + 1));

  const openDialog = () => {
    setQText("");
    setBackground("");
    setSort("recent");
    setCreating(false);
    if (dialogRef.current && dialogRef.current.showModal) {
      dialogRef.current.showModal();
    }
  };

  const closeDialog = () => {
    if (dialogRef.current && dialogRef.current.close) {
      dialogRef.current.close();
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
        body: JSON.stringify({ question: qText.trim(), background: background.trim() || undefined }),
      });
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
  .qb { 
    --gap: 16px; 
    --gap-lg: 24px;
    --radius: 12px;
    --border: #e7e7ea;
    --muted: #5b6270;
    --text: #0f1222;
    margin: 0 auto; 
    padding: clamp(12px, 4vw, 32px) 0; 
    max-width: 100%; 
    color: var(--text);
    width: 100%;
    box-sizing: border-box;
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
    margin: var(--gap-lg) 0 var(--gap-lg);
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
  .qb .row { display: flex; align-items: flex-start; gap: 12px; }
  .qb .question-text { 
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
          <div className="actions">
            <button type="button" className="btn" onClick={closeDialog} disabled={creating}>Cancel</button>
            <button type="submit" className="btn" disabled={creating}>{creating ? "Submitting…" : "Submit"}</button>
          </div>
        </form>
      </dialog>

      {error && (
        <div>⚠️ {error}</div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          <ul>
            {questions.map((q) => { const id = q.id ?? q._id; const bgText = String(q.background ?? q.asked_by ?? q.askedBy ?? ""); return (
              <li key={id} className="question-card">
                <div className="row">
                  <div className="question-text">{q.question}</div>
                  <button
                    className="vote-btn"
                    onClick={() => handleUpvote(q)}
                    disabled={!!upvoting[id] || q.has_upvoted === 1 || q.has_upvoted === true}
                    aria-label="Upvote question"
                  >
                    <span className="icon" aria-hidden="true">▲</span>
                    <span className="count">{q.upvotes ?? 0}</span>
                  </button>
                </div>
                <div className="meta">
                  <span><strong>Posted by:</strong> {q.posted_by ?? q.postedBy ?? "—"}</span>
                  {bgText.trim() ? (
                    <button
                      type="button"
                      className="bg-toggle"
                      onClick={() => toggleBg(id)}
                      aria-expanded={!!openBg[id]}
                      aria-controls={`bg-${id}`}
                    >
                      {openBg[id] ? "Hide background" : "Show background"}
                    </button>
                  ) : null}
                  <span title={q.date}>{formatDate(q.date)}</span>
                </div>
                {bgText.trim() && openBg[id] && (
                  <div id={`bg-${id}`} className="background-panel">
                    {bgText}
                  </div>
                )}
              </li>
            )})}
          </ul>

          <div className="pager">
            <button className="btn" onClick={goPrev} disabled={page === 1}>
              ‹ Prev
            </button>
            <span>
              Page {page}
              {totalPages ? ` of ${totalPages}` : ""}
            </span>
            <button className="btn" onClick={goNext} disabled={totalPages ? page >= totalPages : questions.length < PAGE_SIZE}>
              Next ›
            </button>
          </div>
        </>
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