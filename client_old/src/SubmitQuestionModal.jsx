import React, { useEffect, useRef, useState } from "react";

export function SubmitQuestionModal({
  isOpen,
  onClose,
  userId,
  defaultQuestion = "",
  onSubmitted,
}) {
  const [question, setQuestion] = useState(defaultQuestion);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuestion(defaultQuestion);
      setError(null);
    }
  }, [isOpen, defaultQuestion]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const value = question.trim();
    if (value.length < 5) {
      setError("Please enter at least 5 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          question: value,
        }),
      });

      if (!res.ok) {
        let data = {};
        try {
          data = await res.json();
        } catch {}
        throw new Error(data?.error ?? `Request failed: ${res.status}`);
      }

      const { id } = await res.json();
      onSubmitted?.(id);
      onClose();
    } catch (err) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-question-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* backdrop */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* modal */}
      <form
        onSubmit={handleSubmit}
        className="relative mx-4 w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id="submit-question-title" className="text-lg font-semibold">
            Submit your question
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <label htmlFor="question" className="sr-only">
          Question
        </label>
        <textarea
          id="question"
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question…"
          rows={5}
          className="w-full resize-y rounded border border-gray-300 p-3 outline-none focus:border-gray-400"
          required
          minLength={5}
          maxLength={2000}
        />

        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}