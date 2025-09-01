import { useState } from "react";

const API_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env.VITE_API_BASE !== "undefined")
    ? import.meta.env.VITE_API_BASE
    : ((typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV)
        ? "http://localhost:4000"
        : "");

/**
 * Invite onboarding "carousel"
 * Page 1: user writes their answer to the starter question
 * Page 2: user provides first name, last name, and city
 *
 * On submit (page 2), we stash {token, answer, firstName, lastName, city}
 * into localStorage under "pendingInvite" and then redirect to Google OAuth.
 * After Google callback (user is logged in), your post-login finalizer
 * should read "pendingInvite" and upsert users.first_name, users.last_name, users.city
 * (and persist the answer).
 */
export default function WelcomeInvite({ token }) {
  const [step, setStep] = useState(0); // 0 = question, 1 = name+city
  const [answer, setAnswer] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [city, setCity] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // allow using /invite/:token without prop
  const resolvedToken = token || (() => {
    if (typeof window === "undefined") return "";
    const m = window.location.pathname.match(/\/invite\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  })();

  const minLen = 10;

  const canContinue =
    step === 0
      ? !!resolvedToken && answer.trim().length >= minLen
      : firstName.trim().length > 0 &&
        lastName.trim().length > 0 &&
        city.trim().length > 0;

  const onPrimary = async () => {
    setErr(null);
    if (step === 0) {
      // Validate and go to page 2
      if (!resolvedToken) {
        setErr("Invalid or missing invite token.");
        return;
      }
      if (answer.trim().length < minLen) {
        setErr(`Please write at least ${minLen} characters.`);
        return;
      }
      setStep(1);
      return;
    }

    // Step 1 => final submit: stash + redirect to Google
    try {
      setBusy(true);
      const payload = {
        token: resolvedToken,
        answer: answer.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        city: city.trim(),
      };
      localStorage.setItem("pendingInvite", JSON.stringify(payload));
      const url =
        (API_BASE || "") +
        "/api/auth/google?invite=" +
        encodeURIComponent(resolvedToken);
      window.location.href = url;
    } catch (e) {
      setBusy(false);
      setErr(e?.message || "Something went wrong.");
    }
  };

  const onBack = () => {
    setErr(null);
    if (busy) return;
    if (step === 1) setStep(0);
  };

  return (
    <div className="container">
      <div className="card">
        {/* Progress / stepper */}
        <div className="muted" style={{ marginBottom: 12 }}>
          Step {step + 1} of 2
        </div>

        {step === 0 ? (
          <>
            <h2>Welcome to heterodox</h2>
            <p className="muted">
              To join this community, first share your answer to the starter prompt
              below.
            </p>
            <div style={{ marginTop: 12 }}>
              <div className="pill">Prompt</div>
              <h3 style={{ marginTop: 8 }}>
                What is the most interesting question you’ve ever been asked?
              </h3>
            </div>
            <div style={{ marginTop: 8 }}>
              <textarea
                rows={5}
                placeholder="Write your answer…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <div className="muted" style={{ marginTop: 6 }}>
                {answer.trim().length}/{minLen} minimum
              </div>
            </div>
          </>
        ) : (
          <>
            <h2>About you</h2>
            <p className="muted">
              Before you join, tell us your name and the city you live in.
            </p>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div>
                <label className="muted" htmlFor="firstName">First name</label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="muted" htmlFor="lastName">Last name</label>
                <input
                  id="lastName"
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div>
                <label className="muted" htmlFor="city">City</label>
                <input
                  id="city"
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {err && (
          <div className="muted" style={{ color: "crimson", marginTop: 8 }}>
            {err}
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          {step === 1 && (
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              className="secondary"
            >
              Back
            </button>
          )}
          <button
            onClick={onPrimary}
            disabled={busy || !canContinue}
            title={!resolvedToken && step === 0 ? "Missing invite token" : undefined}
          >
            {busy
              ? "Redirecting…"
              : step === 0
              ? "Continue"
              : "Join with Google"}
          </button>
        </div>

        <div className="muted" style={{ marginTop: 8 }}>
          {step === 0
            ? "You’ll confirm details on the next step."
            : "You’ll be prompted to sign in with Google. We’ll save your name and city with your new account."}
        </div>
      </div>
    </div>
  );
}
