import React, { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 50;

export default function QuestionsBook() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(null); // total questions, if provided
  const [upvoting, setUpvoting] = useState({}); // { [id]: boolean }

  const [creating, setCreating] = useState(false);
  const [qText, setQText] = useState("");
  const [askedBy, setAskedBy] = useState("");
  const dialogRef = useRef(null);

  const totalPages = useMemo(() => {
    if (total == null) return null; // unknown
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  async function fetchQuestions(abortSignal, nextPage = page) {
    const url = `/api/questions_book?page=${nextPage}&limit=${PAGE_SIZE}`;
    const res = await fetch(url, { signal: abortSignal });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const text = await res.text();
    const json = text ? JSON.parse(text) : [];
    const items = Array.isArray(json) ? json : json.data ?? [];
    const totalFromBody = !Array.isArray(json) ? json.total : null;
    const totalFromHeader = Number(res.headers.get("X-Total-Count"));
    setTotal(Number.isFinite(totalFromBody) ? totalFromBody : (Number.isFinite(totalFromHeader) ? totalFromHeader : null));
    setQuestions(items);
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
  }, [page]);

  const handleUpvote = async (q) => {
    const id = q.id ?? q._id; // support either id or _id
    if (!id) return;

    setUpvoting((u) => ({ ...u, [id]: true }));
    try {
      const res = await fetch(`/api/questions_book/${id}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.status === 401) {
        alert("Please sign in to upvote.");
        return;
      }
      if (!res.ok) throw new Error(`Upvote failed: ${res.status}`);
      const data = await res.json().catch(() => ({}));
      const newCount = data.upvotes;
      const alreadyVoted = !!data.alreadyVoted;

      setQuestions((qs) =>
        qs.map((item) => {
          const match = (item.id ?? item._id) === id;
          if (!match) return item;
          const next = { ...item };
          if (Number.isFinite(newCount)) next.upvotes = newCount;
          // Either way, after this call the user has voted (already or just now)
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

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p + 1));

  const openDialog = () => {
    setQText("");
    setAskedBy("");
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
        body: JSON.stringify({ question: qText.trim(), asked_by: askedBy.trim() || undefined }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Create failed: ${res.status} ${msg}`);
      }
      // After creating, go to page 1 and reload
      setPage(1);
      await fetchQuestions(undefined, 1);
      closeDialog();
    } catch (err) {
      alert(err.message || "Failed to create question");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <h1>Questions Book</h1>
      <button onClick={openDialog}>Ask a question</button>
      <dialog ref={dialogRef}>
        <form onSubmit={submitQuestion} method="dialog">
          <h3>New question</h3>
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
              Asked by (optional)
              <br />
              <input
                type="text"
                value={askedBy}
                onChange={(e) => setAskedBy(e.target.value)}
                placeholder="e.g., Julia"
              />
            </label>
          </div>
          <div>
            <button type="button" onClick={closeDialog} disabled={creating}>Cancel</button>
            <button type="submit" disabled={creating}>{creating ? "Submitting…" : "Submit"}</button>
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
            {questions.map((q) => (
              <li key={q.id ?? q._id}>
                <div>
                  <div>{q.question}</div>
                  <button
                    onClick={() => handleUpvote(q)}
                    disabled={!!upvoting[q.id ?? q._id] || q.has_upvoted === 1 || q.has_upvoted === true}
                    aria-label="Upvote question"
                  >
                    ▲ {q.upvotes ?? 0}
                  </button>
                </div>
                <div>
                  <span><strong>Posted by:</strong> {q.posted_by ?? q.postedBy ?? "—"}</span>
                  <span> • </span>
                  <span><strong>Asked by:</strong> {q.asked_by ?? q.askedBy ?? "—"}</span>
                  <span> • </span>
                  <span title={q.date}> {formatDate(q.date)} </span>
                </div>
              </li>
            ))}
          </ul>

          <div>
            <button onClick={goPrev} disabled={page === 1}>
              ‹ Prev
            </button>
            <span>
              Page {page}
              {totalPages ? ` of ${totalPages}` : ""}
            </span>
            <button onClick={goNext} disabled={totalPages ? page >= totalPages : questions.length < PAGE_SIZE}>
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
  return d.toLocaleString();
}