import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          display: "grid",
          gap: 18,
          padding: 16,
        }}
      >
        <Title />

        <ModeButton
          title="SwissOrient – Quiz"
          subtitle="Teste dein Geografie-Wissen"
          onClick={() => navigate("/quiz")}
        />

        <ModeButton
          title="SwissOrient – Explore"
          subtitle="Erkunde die Schweiz frei"
          onClick={() => navigate("/explore")}
        />

        <ModeButton
          title="SwissOrient – Learn"
          subtitle="Lernen & Entdecken (bald mehr)"
          onClick={() => navigate("/learn")}
        />
      </div>
    </div>
  );
}

function Title() {
  return (
    <div style={{ textAlign: "center", marginBottom: 12 }}>
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 0.3 }}>
        SwissOrient
      </div>
      <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
        Geographie der Schweiz
      </div>
    </div>
  );
}

function ModeButton({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "18px 20px",
        borderRadius: 18,
        border: "1px solid var(--border)",
        background: "var(--card)",
        cursor: "pointer",
        boxShadow: "var(--shadow)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
        {subtitle}
      </div>
    </button>
  );
}
