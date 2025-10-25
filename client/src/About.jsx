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
            <h1>About Good Question</h1>
            <p>
              Good Question is a community for exploring the stories, dilemmas, and curiosities
              shaping our lives. We highlight one thoughtful prompt at a time so members can go deep,
              reflect, and connect over meaningful answers.
            </p>
            <p>
              Each week our team curates new conversation starters, gathers member perspectives, and
              surfaces standout responses. If you would like to join, choose <strong>Log in</strong> from the
              menu to create an account or return to your personalized feed.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
