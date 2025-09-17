import React, { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 50;

export default function QuestionsBook() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(null); // total questions, if provided
  const [upvoting, setUpvoting] = useState({}); // { [id]: boolean }

  const totalPages = useMemo(() => {
    if (total == null) return null; // unknown
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  useEffect(() => {
    let abort = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const url = `/api/questions_book?page=${page}&limit=${PAGE_SIZE}`;
        const res = await fetch(url, { signal: abort.signal });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const text = await res.text();
        const json = text ? JSON.parse(text) : [];
        const items = Array.isArray(json) ? json : json.data ?? [];

        // Try to read total from body or header if available
        const totalFromBody = !Array.isArray(json) ? json.total : null;
        const totalFromHeader = Number(res.headers.get("X-Total-Count"));
        setTotal(Number.isFinite(totalFromBody) ? totalFromBody : (Number.isFinite(totalFromHeader) ? totalFromHeader : null));

        setQuestions(items);
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

    // optimistic update
    setUpvoting((u) => ({ ...u, [id]: true }));
    const prev = questions;
    const updated = questions.map((item) =>
      (item.id ?? item._id) === id
        ? { ...item, upvotes: (item.upvotes ?? 0) + 1 }
        : item
    );
    setQuestions(updated);

    try {
      const res = await fetch(`/api/questions_book/${id}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Upvote failed: ${res.status}`);
      const data = await res.json().catch(() => ({}));
      const newCount = data.upvotes;
      if (Number.isFinite(newCount)) {
        setQuestions((qs) => qs.map((item) => (item.id ?? item._id) === id ? { ...item, upvotes: newCount } : item));
      }
    } catch (e) {
      // revert on error
      setQuestions(prev);
      alert(e.message || "Failed to upvote");
    } finally {
      setUpvoting((u) => ({ ...u, [id]: false }));
    }
  };

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p + 1));

  return (
    <div>
      <h1>Questions Book</h1>

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
                    disabled={!!upvoting[q.id ?? q._id]}
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