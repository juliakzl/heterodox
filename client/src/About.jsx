import bg from "./assets/bg-blur.png";
import Nav from "./Nav";

export default function About({ me, onLogout }) {
  return (
    <div
      style={{
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
      }}
    >
      <style>{`
        .about-section {
          margin: 0 auto;
          max-width: 900px;
          padding: clamp(24px, 6vw, 64px) 0;
          display: flex;
          flex-direction: column;
          gap: clamp(18px, 5vw, 32px);
        }
        .about-card {
          background: #ffffff;
          border: 1px solid rgba(231, 231, 234, 0.9);
          border-radius: 18px;
          box-shadow: 0 18px 42px rgba(15, 18, 34, 0.12);
          padding: clamp(20px, 5vw, 48px);
          margin: 0 clamp(16px, 5vw, 36px);
          display: grid;
          gap: 16px;
          color: var(--text, #0f1222);
        }
        .about-card h1 {
          font-family: var(--font-serif);
          font-size: clamp(1.75rem, 4vw, 2.4rem);
          margin: 0;
        }
        .about-card p {
          margin: 0;
          line-height: 1.5;
          color: var(--muted, #5b6270);
          font-size: clamp(1rem, 2.4vw, 1.15rem);
        }
        .about-card strong {
          color: var(--text, #0f1222);
        }
      `}</style>
      <div className="container">
        <Nav me={me} onLogout={onLogout} />
        <section className="about-section">
          <article className="about-card">
            <h1>About Good Questions</h1>
            <p>
              Good Questions is a collection of the most interesting questions curated by our community. They might be absurd and paradoxical or thought-provoking and deep. The questions are sorted by the popularity among the community members, and each year we publish 50 best questions of the year.
            </p>
            <p>
              You can also use Good Questions as a conversation aid for your gatherings with friends if you go to <a href="/shuffle" style={{ color: 'var(--link-color, #4b5fff)', textDecoration: 'none', fontWeight: 600 }}>Shuffle</a>.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
