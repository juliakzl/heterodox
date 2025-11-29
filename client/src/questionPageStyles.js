const questionPageStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&display=swap');
        .question-page-shell {
          display: flex;
          flex-direction: column;
        }
        .question-page {
          --gap: 16px;
          --gap-lg: 24px;
          --radius: 12px;
          --border: #e7e7ea;
          --muted: #5b6270;
          --text: #0f1222;
          display: flex;
          flex-direction: column;
          gap: var(--gap-lg);
          padding: clamp(12px, 4vw, 32px) 0;
          color: var(--text);
        }
        .question-page .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: var(--muted);
          font-weight: 600;
        }
        .question-page .back-link:hover {
          color: var(--text);
        }
        .question-page .question-card {
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: clamp(18px, 3vw, 28px);
          box-shadow: 0 1px 2px rgba(0,0,0,.04);
          display: flex;
          flex-direction: column;
          gap: var(--gap);
          color: #9BA7FA;
          width: min(100%, var(--content-inner-width, 900px));
          margin: 0 auto;
          position: relative;
          padding-right: calc(clamp(18px, 3vw, 28px) + 60px);
        }
        .question-page .row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
          flex-wrap: nowrap;
        }
        .question-page .question-text {
          font-family: 'Fraunces', var(--font-serif), serif;
          font-weight: 650;
          font-size: clamp(1.15rem, 2.2vw, 1.35rem);
          line-height: 1.4;
          color: var(--text);
          margin: 0;
          flex: 1 1 auto;
          min-width: 0;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .question-page .meta {
          font-size: 0.95rem;
          color: var(--muted);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .question-page .meta-line {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          width: 100%;
        }
        .question-page .meta strong {
          color: var(--text);
        }
        .question-page .background-panel {
          border: 1px dashed var(--border);
          border-radius: 10px;
          padding: 12px 14px;
          background: #fff;
          color: var(--text);
          line-height: 1.4;
          width: 100%;
          box-sizing: border-box;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .question-page .background-panel + .background-panel {
          margin-top: var(--gap);
        }
        .question-page .add-story-btn {
          align-self: flex-start;
          border: 1px dashed var(--border);
          border-radius: 999px;
          padding: 10px 16px;
          background: rgba(155,167,250,0.12);
          color: #9BA7FA;
          font-weight: 600;
          cursor: pointer;
          transition: transform .05s ease, box-shadow .15s ease, background .2s ease;
        }
        .question-page .add-story-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(155,167,250,0.2);
        }
        .question-page .add-story-btn:active {
          transform: translateY(0);
        }
        .question-page .comments-block {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }
        .question-page .comments-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .question-page .comments-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 10px;
        }
        .question-page .comments-list li {
          padding-top: 8px;
          border-top: 1px dashed var(--border);
        }
        .question-page-shell .btn {
          appearance: none;
          border: 1px solid var(--border, #e7e7ea);
          padding: 10px 14px;
          border-radius: 999px;
          background: white;
          cursor: pointer;
          font-weight: 600;
          transition: transform .05s ease, box-shadow .2s ease, background .2s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,.04);
          color: var(--text, #0f1222);
        }
        .question-page-shell .btn.primary {
          background: #9BA7FA;
          border-color: #9BA7FA;
          color: #fff;
        }
        .question-page-shell .btn:hover {
          background: #f4f5f7;
        }
        .question-page-shell .btn.primary:hover {
          filter: brightness(0.95);
        }
        .question-page-shell .btn:active {
          transform: translateY(1px);
        }
        .question-page .vote-btn {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 4px 10px;
          background: #fff;
          cursor: pointer;
          box-shadow: 0 1px 1px rgba(0,0,0,.03);
          color: #9195E9;
          font-size: 0.9rem;
          line-height: 1;
          flex: 0 0 auto;
          transition: transform .05s ease, box-shadow .15s ease;
          position: absolute;
          top: clamp(18px, 3vw, 28px);
          right: clamp(18px, 3vw, 28px);
        }
        .question-page .vote-btn .icon {
          color: currentColor;
          font-size: 1rem;
          line-height: 1;
        }
        .question-page .vote-btn .count {
          font-weight: 600;
          color: currentColor;
        }
        .question-page .vote-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,.06);
        }
        .question-page .vote-btn:active {
          transform: translateY(0);
          box-shadow: 0 1px 1px rgba(0,0,0,.03);
        }
        .question-page .vote-btn[disabled] {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }
        .question-page .vote-btn.active {
          background: rgba(145,149,233,.08);
          border-color: #9195E9;
          color: #9195E9;
        }
        .question-page-shell dialog {
          border: 1px solid var(--border, #e7e7ea);
          border-radius: 16px;
          padding: clamp(18px, 4vw, 26px);
          width: min(720px, 95vw);
          max-width: none;
        }
        .question-page-shell dialog::backdrop {
          background: rgba(15, 18, 34, 0.35);
        }
        .question-page-shell dialog form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .question-page-shell dialog .actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .question-page-shell dialog textarea {
          width: 100%;
          min-height: 180px;
          border: 1px solid var(--border, #e7e7ea);
          border-radius: 10px;
          padding: 10px 12px;
          font: inherit;
          color: var(--text, #0f1222);
          box-sizing: border-box;
        }

        .question-page-shell dialog textarea:focus,
        .question-page-shell dialog input:focus {
          outline: none;
          border-color: #9BA7FA; /* brand color */
          box-shadow: 0 0 0 3px rgba(155,167,250,0.25);
        }
        .question-page-shell dialog h3 {
          margin: 0;
          font-family: 'Fraunces', var(--font-serif), serif;
        }
        @media (max-width: 640px) {
          .question-page .comments-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }
        .question-page-shell .container {
          max-width: var(--content-max-width, 900px);
          margin: 0 auto;
          padding: var(--space);
          box-sizing: border-box;
        }
        @media (max-width: 560px) {
          .question-page-shell .container {
            padding: 14px;
          }
          .question-page .question-card {
            padding: 16px;
            padding-right: calc(16px + 60px);
          }
          .question-page .row {
            gap: 10px;
            flex-wrap: nowrap;
          }
        }
        .question-page .page-title {
          font-family: 'Fraunces', var(--font-serif), serif;
          font-size: clamp(1.5rem, 4vw, 2.2rem);
          margin: 0 0 8px;
          color: var(--text);
        }
        .question-page .bestof-nav {
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }
        .question-page .bestof-nav button {
          min-width: 72px;
        }
        .question-page .bestof-indicator {
          font-size: 0.85rem;
          color: var(--muted);
        }
        .question-page .bestof-card {
          gap: 18px;
        }
        .question-page .best-answer-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .question-page .best-answer-heading h2 {
          margin: 0;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #5b6270;
        }
        .question-page .best-answer-block {
          position: relative;
          border-radius: 16px;
          padding: clamp(22px, 4vw, 32px);
          padding-left: clamp(36px, 6vw, 52px);
          background: linear-gradient(135deg, rgba(155,167,250,0.18), rgba(255,255,255,0.9));
          border: 1px solid rgba(155,167,250,0.35);
          box-shadow: 0 12px 38px rgba(15,18,34,0.08);
          color: var(--text);
        }
        .question-page .best-answer-block::before {
          content: "“";
          position: absolute;
          top: 6px;
          left: 16px;
          font-size: 3rem;
          color: rgba(145,149,233,0.5);
          font-family: 'Fraunces', var(--font-serif), serif;
        }
        .question-page .best-answer-text {
          font-size: clamp(1rem, 2.5vw, 1.2rem);
          line-height: 1.6;
          margin: 0;
          font-family: 'Fraunces', var(--font-serif), serif;
        }
        .question-page .best-answer-meta {
          margin-top: 14px;
          font-size: 0.9rem;
          color: var(--muted);
          font-weight: 600;
        }
        .question-page .question-mini {
          border: 1px dashed var(--border);
          border-radius: 14px;
          padding: 16px;
          background: rgba(255,255,255,0.9);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .question-page .question-mini-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .question-page .question-mini-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #9195E9;
          font-weight: 700;
        }
        .question-page .question-mini-text {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text);
        }
        .question-page .question-mini-meta {
          font-size: 0.9rem;
          color: var(--muted);
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
        .question-page .question-mini-meta .spacer {
          flex: 1 1 auto;
        }
        .question-page .question-mini-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 8px;
          justify-content: flex-start;
        }
        .question-page .question-mini-story {
          font-size: 0.95rem;
          color: var(--text);
          line-height: 1.4;
        }
        .question-page .question-mini .question-mini-vote {
          margin-left: auto;
        }
        .question-page .question-mini-actions .btn {
          align-self: flex-start;
        }
      `;

export default questionPageStyles;
