import { useState } from "react";
import bg from "./assets/bg-blur.png";

/**
 * Sign-up onboarding "carousel"
 * Page 1: user writes their answer to the starter question
 * Page 2: user provides first name, last name, and city
 *
 * On completion we persist the draft locally and redirect to Google OAuth.
 */
export default function WelcomeInvite() {
  const [step, setStep] = useState(0); // 0 = question, 1 = name+city
  const [answer, setAnswer] = useState("");
  const [questionStory, setQuestionStory] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [city, setCity] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const minLen = 10;

  const canContinue =
    step === 0
      ? answer.trim().length >= minLen
      : firstName.trim().length > 0 &&
        lastName.trim().length > 0 &&
        city.trim().length > 0;

  const onPrimary = async () => {
    setErr(null);
    if (step === 0) {
      // Validate and go to page 2
      if (answer.trim().length < minLen) {
        setErr(`Please write at least ${minLen} characters.`);
        return;
      }
      setStep(1);
      return;
    }

    // Step 1 => final submit: stash form data, then bounce to Google sign-in
    try {
      setBusy(true);
      const payload = {
        answer: answer.trim(),
        questionStory: questionStory.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        city: city.trim(),
      };
      if (typeof window !== "undefined") {
        const storage = window.localStorage || null;
        if (storage) {
          storage.setItem("pendingSignup", JSON.stringify(payload));
        }
        const next = window.location.origin;
        window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
        return;
      }
      throw new Error("Browser environment required to continue.");
    } catch (e) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setErr(null);
    if (busy) return;
    if (step === 1) setStep(0);
  };

  return (
    <div className="signup">
      <style>{`
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');
  .signup {
    --gap: 16px;
    --gap-lg: 24px;
    --radius: 12px;
    --border: #e7e7ea;
    --muted: #5b6270;
    --text: #0f1222;
    --accent: #9BA7FA;
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(24px, 8vw, 80px) 16px;
    box-sizing: border-box;
    background: url(${bg}) center/cover no-repeat fixed, #f9f9ff;
    color: var(--text);
  }
  .signup .card {
    width: min(720px, 100%);
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 24px 60px rgba(15, 18, 34, 0.18);
    padding: clamp(24px, 6vw, 48px);
    display: grid;
    gap: var(--gap-lg);
    font-family: 'Fraunces', serif;
  }
  .signup .card * {
    color: inherit;
  }
  .signup h1 {
    font-size: clamp(1.8rem, 4vw, 2.4rem);
    margin: 0;
  }
  .signup h2 {
    font-size: clamp(1.5rem, 3vw, 1.9rem);
    margin: 0;
  }
  .signup p,
  .signup label,
  .signup .muted {
    font-family: 'Manrope', sans-serif;
    letter-spacing: 0.01em;
  }
  .signup .muted {
    color: var(--muted);
    font-size: 0.95rem;
  }
  .signup .stepper {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Manrope', sans-serif;
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--muted);
  }
  .signup .pill {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 4px 12px;
    background: rgba(155, 167, 250, 0.12);
    color: var(--accent);
    font-weight: 600;
    font-family: 'Manrope', sans-serif;
    font-size: 0.8rem;
  }
  .signup .panel {
    display: grid;
    gap: var(--gap);
  }
  .signup textarea,
  .signup input[type="text"] {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    background: #fff;
    color: var(--text);
    font-family: 'Manrope', sans-serif;
    font-size: 1rem;
    box-sizing: border-box;
    transition: border 0.2s ease, box-shadow 0.2s ease;
  }
  .signup textarea:focus,
  .signup input[type="text"]:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(155, 167, 250, 0.25);
  }
  .signup textarea {
    resize: vertical;
    min-height: 140px;
    font-family: 'Fraunces', serif;
    line-height: 1.45;
  }
  .signup .field {
    display: grid;
    gap: 6px;
  }
  .signup .field label span {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--muted);
  }
  .signup .progress {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap);
    font-family: 'Manrope', sans-serif;
  }
  .signup .actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .signup .btn {
    appearance: none;
    border-radius: 999px;
    border: 1px solid transparent;
    padding: 12px 20px;
    font-weight: 600;
    font-family: 'Manrope', sans-serif;
    cursor: pointer;
    transition: transform .05s ease, box-shadow .2s ease, filter .2s ease;
    background: var(--accent);
    color: #fff;
    box-shadow: 0 1px 2px rgba(15,18,34,0.12);
  }
  .signup .btn:hover:not([disabled]) {
    filter: brightness(0.95);
  }
  .signup .btn:active:not([disabled]) {
    transform: translateY(1px);
  }
  .signup .btn[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .signup .btn.secondary {
    background: #fff;
    color: var(--text);
    border-color: var(--border);
  }
  .signup .counter {
    font-size: 0.9rem;
    color: var(--muted);
    text-align: right;
    font-family: 'Manrope', sans-serif;
  }
  .signup .notice {
    border: 1px solid rgba(220, 38, 38, 0.2);
    background: rgba(220, 38, 38, 0.08);
    color: #9b1c1c;
    padding: 10px 14px;
    border-radius: 10px;
    font-family: 'Manrope', sans-serif;
  }
  @media (max-width: 720px) {
    .signup {
      padding: 32px 16px;
    }
    .signup .card {
      padding: 28px 20px;
    }
    .signup .actions {
      justify-content: stretch;
    }
    .signup .actions .btn {
      flex: 1;
      text-align: center;
    }
  }
`}</style>
      <div className="card">
        <div className="progress">
          <div>
            <h1>Join Good Questions</h1>
            <div className="muted">Step {step + 1} of 2</div>
          </div>
          <div className="pill">Members only</div>
        </div>

        {step === 0 ? (
          <div className="panel">
            <h2>Starter question</h2>
            <p className="muted">
              Share your answer so the community can get to know your curiosity.
            </p>
            <div className="field">
              <label htmlFor="answer">
                <span>What is the most interesting question you’ve ever been asked?</span>
              </label>
              <textarea
                id="answer"
                rows={5}
                placeholder="Write your answer…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <div className="counter">
                {answer.trim().length}/{minLen} minimum
              </div>
            </div>
            <div className="field">
              <label htmlFor="questionStory">
                <span>Question story (optional)</span>
              </label>
              <textarea
                id="questionStory"
                rows={4}
                placeholder="Share the story behind this question…"
                value={questionStory}
                onChange={(e) => setQuestionStory(e.target.value)}
                style={{ minHeight: 120 }}
              />
            </div>
          </div>
        ) : (
          <div className="panel">
            <h2>About you</h2>
            <p className="muted">
              Tell us who you are so fellow members can find you.
            </p>
            <div className="field">
              <label htmlFor="firstName">
                <span>First name</span>
              </label>
              <input
                id="firstName"
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="lastName">
                <span>Last name</span>
              </label>
              <input
                id="lastName"
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="city">
                <span>City</span>
              </label>
              <input
                id="city"
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>
        )}

        {err && (
          <div className="notice">{err}</div>
        )}

        <div className="actions">
          {step === 1 && (
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              className="btn secondary"
            >
              Back
            </button>
          )}
          <button
            onClick={onPrimary}
            disabled={busy || !canContinue}
            className="btn"
            type="button"
          >
            {busy
              ? "Working…"
              : step === 0
              ? "Continue"
              : "Finish"}
          </button>
        </div>

        <div className="muted">
          {step === 0
            ? "You’ll share a few more details on the next step."
            : "When you finish, we’ll take you to Google to create your account."}
        </div>
      </div>
    </div>
  );
}
