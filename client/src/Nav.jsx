import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import logo from "./assets/good-q-logo.png";
import menu from "./assets/menu.svg";

export default function Nav({ me, onLogout }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const menuContainerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClick = (event) => {
      if (!menuContainerRef.current) return;
      if (!menuContainerRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const handleLogin = () => {
    setMenuOpen(false);
    // No session: show the same "Join community" flow used elsewhere
    setAuthModalOpen(true);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await onLogout?.();
    } catch (err) {
      console.error("Nav: logout failed", err);
    }
  };

  const goToAbout = () => {
    setMenuOpen(false);
    navigate("/about");
  };

  const goToShuffle = () => {
    setMenuOpen(false);
    navigate("/shuffle");
  };

  const goToBestAnswers = () => {
    setMenuOpen(false);
    navigate("/bestof");
  };

  const goToQuestionsBook = () => {
    setMenuOpen(false);
    navigate("/questions-book");
  };

  const closeAuthModal = () => setAuthModalOpen(false);

  const handleAuthLogin = () => {
    if (typeof window === "undefined") return;
    const { pathname, search } = window.location;
    const next = `${pathname}${search}`;
    closeAuthModal();
    window.location.href = `/api/auth/google?next=${encodeURIComponent(next || "/")}`;
  };

  const handleAuthSignup = () => {
    if (typeof window === "undefined") return;
    closeAuthModal();
    navigate("/welcome");
  };

  return (
    <>
    <div className="nav-shell">
      <style>{`
        .nav-shell {
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(6px);
          padding: clamp(6px, 1.5vw, 12px) 0 clamp(14px, 3vw, 24px) !important;
        }
        .nav-inner {
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          max-width: var(--content-max-width, 900px);
          padding: clamp(12px, 3vw, 20px) var(--space, 24px);
          box-sizing: border-box;
          position: relative;
        }
        .nav-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-weight: 700;
        }
        .nav-home-link {
          text-decoration: none;
          color: inherit;
          cursor: pointer;
        }
        .nav-logo {
          height: 42px;
        }
        .nav-menu-trigger {
          appearance: none;
          border: 1px solid rgba(231, 231, 234, 0.9);
          background: #ffffff;
          border-radius: 999px;
          padding: 8px 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(15, 18, 34, 0.08);
          transition: transform .05s ease, box-shadow .15s ease;
        }
        .nav-menu-trigger:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15, 18, 34, 0.08);
        }
        .nav-menu-trigger:active {
          transform: translateY(0);
          box-shadow: 0 2px 6px rgba(15, 18, 34, 0.08);
        }
        .nav-menu-trigger img {
          height: 20px;
          width: 20px;
        }
        .nav-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 180px;
          background: #ffffff;
          border: 1px solid rgba(231, 231, 234, 0.9);
          border-radius: 14px;
          box-shadow: 0 18px 42px rgba(15, 18, 34, 0.18);
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .nav-menu button {
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          padding: 10px 12px;
          border-radius: 10px;
          font-weight: 600;
          font-family: var(--font-sans);
          color: var(--text, #0f1222);
          cursor: pointer;
        }
        .nav-menu button:hover {
          background: rgba(155, 167, 250, 0.12);
        }
        /* Match QuestionsBook auth modal styling */
        .auth-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 18, 34, 0.42);
          backdrop-filter: blur(2px);
          display: grid;
          place-items: center;
          /* Keep it below the sticky header so the nav isn't dimmed */
          z-index: 10;
          padding: 16px;
        }
        .auth-modal {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 18px 48px rgba(15, 18, 34, 0.35);
          width: min(420px, 92vw);
          padding: 28px;
          display: grid;
          gap: 16px;
          position: relative;
          border: 1px solid rgba(231, 231, 234, 0.9);
        }
        .auth-modal h3 {
          margin: 0;
          font-size: 1.35rem;
          letter-spacing: -0.01em;
        }
        .auth-modal .muted {
          color: var(--muted, #5b6270);
        }
        .auth-modal .actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .auth-modal button {
          border-radius: 999px;
          padding: 10px 18px;
          font-weight: 600;
          cursor: pointer;
          transition: transform .05s ease, box-shadow .2s ease, background .2s ease;
        }
        .auth-modal button.primary {
          background: #111321;
          color: #fff;
          border: none;
        }
        .auth-modal button.primary:hover {
          filter: brightness(1.05);
        }
        .auth-modal button.secondary {
          border: 1px solid var(--border, #e7e7ea);
          background: #f6f7fb;
          color: var(--text, #0f1222);
        }
        .auth-close {
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
        @media (max-width: 640px) {
          .nav-logo {
            height: 32px;
          }
          .nav-inner {
            padding: clamp(10px, 4vw, 14px) 20px;
          }
        }
      `}</style>
      <div className="nav-inner">
        <a
          href="/"
          className="nav-brand nav-home-link"
          onClick={(e) => {
            e.preventDefault();
            setMenuOpen(false);
            navigate("/");
          }}
          aria-label="Go to home"
        >
          <img src={logo} alt="Good Question" className="nav-logo" />
        </a>
        <div ref={menuContainerRef} style={{ marginLeft: "auto", position: "relative" }}>
          <button
            type="button"
            className="nav-menu-trigger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Open menu"
          >
            <img src={menu} alt="" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="nav-menu" role="menu">
              <button type="button" role="menuitem" onClick={goToShuffle}>
                Shuffle
              </button>
              <button type="button" role="menuitem" onClick={goToQuestionsBook}>
                Questions
              </button>
              <button type="button" role="menuitem" onClick={goToBestAnswers}>
                Best answers
              </button>
              {me ? (
                <button type="button" role="menuitem" onClick={handleLogout}>
                  Log out
                </button>
              ) : (
                <button type="button" role="menuitem" onClick={handleLogin}>
                  Log in
                </button>
              )}
              <button type="button" role="menuitem" onClick={goToAbout}>
                About
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    {authModalOpen &&
      typeof document !== "undefined" &&
      createPortal(
        <div
          className="auth-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeAuthModal();
            }
          }}
        >
          <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
            <button className="auth-close" aria-label="Close" onClick={closeAuthModal}>
              ✕
            </button>
            <h3 id="auth-modal-title">Join community</h3>
            <p className="muted" style={{ margin: 0 }}>
              You need to log in or sign up to continue.
            </p>
            <div className="actions">
              <button type="button" className="primary" onClick={handleAuthLogin}>
                Log in with Google
              </button>
              <button type="button" className="secondary" onClick={handleAuthSignup}>
                Sign up
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
