export default function MatisseTheme(){
  return (
    <style>{`
      :root{
        --bg:#FFFDF6;           /* warm paper */
        --text:#24303E;         /* deep ink */
        --muted:#6B7280;        /* slate */
        --card:#FFFFFF;         /* clean white */
        --border:#E6E2D9;       /* linen edge */
        --accent:#1E5AA8;       /* matisse blue */
        --accent2:#FF6B6B;      /* coral */
        --accent3:#2E8B57;      /* leaf green */
        --accent4:#FFD166;      /* sunshine */
      }
      html, body, #root { height: 100%; }
      body{
        margin:0;
        color:var(--text);
        background:
          radial-gradient(1200px 600px at -10% -10%, rgba(255,209,102,0.18), transparent 60%),
          radial-gradient(1000px 500px at 110% 10%, rgba(30,90,168,0.12), transparent 60%),
          radial-gradient(900px 600px at 50% 120%, rgba(46,139,87,0.10), transparent 60%),
          var(--bg);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      }
      .container{ max-width: 760px; margin: 24px auto; padding: 0 16px; }
      .card{
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.06);
      }
      .row{ display:flex; gap:8px; }
      .list{ display:flex; flex-direction:column; gap:12px; }
      .answer{ background: #FFFEFB; border:1px solid var(--border); border-radius:12px; padding:12px; }
      .pill{ display:inline-block; padding:4px 10px; border-radius:999px; background: rgba(30,90,168,0.08); color:#183a6b; border:1px solid rgba(30,90,168,0.18); font-size:12px; }
      .muted{ color: var(--muted); }

      button, .btn{ cursor:pointer; border:none; border-radius:10px; padding:10px 14px; background:var(--accent); color:white; font-weight:600; }
      button.secondary, .btn.secondary{ background:transparent; color:var(--text); border:1px solid var(--border); }
      button[disabled]{ opacity:0.6; cursor:not-allowed; }
      button:hover:not([disabled]){ filter:brightness(1.03); }
      button.secondary:hover{ background:rgba(30,90,168,0.06); }

      input, textarea{ width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px; background:#FFFEFB; color:var(--text); }
      textarea{ resize:vertical; }
      input:focus, textarea:focus, button:focus{ outline: 3px solid rgba(30,90,168,0.25); outline-offset:2px; }

      /* Fixed bottom menu gets a soft blur and tint */
      .card[style*='position:fixed']{
        backdrop-filter: saturate(1.1) blur(8px);
        background: rgba(255,255,255,0.85);
        border-color: rgba(0,0,0,0.05);
        box-shadow: 0 -6px 20px rgba(0,0,0,0.08);
      }
    `}</style>
  );
}