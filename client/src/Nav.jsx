import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "./assets/good-q-logo.png";
import menu from "./assets/menu.svg";

export default function Nav({ me, onLogout }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
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
    if (typeof window === "undefined") return;
    const { pathname, search } = window.location;
    const next = `${pathname}${search}`;
    window.location.href = `/api/auth/google?next=${encodeURIComponent(next || "/")}`;
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

  return (
    <div className="nav-shell">
      <style>{`
        .nav-shell {
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(6px);
        }
        .nav-inner {
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          max-width: 900px;
          padding: clamp(12px, 3vw, 20px) 0;
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
        @media (max-width: 640px) {
          .nav-logo {
            height: 32px;
          }
          .nav-inner {
            padding: clamp(10px, 4vw, 14px) 0;
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
  );
}
