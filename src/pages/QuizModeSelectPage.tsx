import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getQuizModes } from "../quiz/modes";
import type { QuizModeDefinition } from "../quiz/types";

export default function QuizModeSelectPage() {
  const navigate = useNavigate();
  const [modes, setModes] = useState<QuizModeDefinition[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;

    getQuizModes()
      .then((list) => {
        if (cancelled) return;
        setModes(list);
      })
      .catch(() => {
        if (cancelled) return;
        setModes([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!modes) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return modes;

    return modes.filter((m) => {
      const hay = `${m.title} ${m.description} ${m.id}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [modes, q]);

  const swissModes = useMemo(() => {
    if (!filtered) return null;
    return filtered.filter((m) => !m.id.startsWith("ch-districts-"));
  }, [filtered]);

  const cantonDistrictModes = useMemo(() => {
    if (!filtered) return null;
    return filtered
      .filter((m) => m.id.startsWith("ch-districts-"))
      .sort((a, b) => a.title.localeCompare(b.title, "de"));
  }, [filtered]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 16,
      }}
    >
      {/* ✅ “Hub”-Container */}
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          height: "min(82vh, 820px)",
          borderRadius: 22,
          border: "1px solid var(--border)",
          background: "var(--card)",
          boxShadow: "var(--shadow)",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr",
        }}
      >
        {/* ✅ Sticky Head */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            background: "var(--card)",
            borderBottom: "1px solid var(--border)",
            padding: 14,
          }}
        >
          <Title onBack={() => navigate("/")} />
          <div style={{ marginTop: 10 }}>
            <Search value={q} onChange={setQ} />
          </div>
        </div>

        {/* ✅ Scrollable Body */}
        <div
          style={{
            overflowY: "auto",
            padding: 14,
            display: "grid",
            gap: 14,
          }}
        >
          {!filtered && (
            <div
              style={{
                padding: 16,
                borderRadius: 18,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                boxShadow: "var(--shadow)",
                color: "var(--muted)",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              Lade Quiz-Modi…
            </div>
          )}

          {filtered && filtered.length === 0 && (
            <div
              style={{
                padding: 16,
                borderRadius: 18,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                boxShadow: "var(--shadow)",
                color: "var(--muted)",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              Keine Modi gefunden.
            </div>
          )}

          {swissModes && swissModes.length > 0 && (
            <Section title="Schweiz">
              {swissModes.map((m) => (
                <ModeButton
                  key={m.id}
                  title={m.title}
                  subtitle={m.description}
                  onClick={() => navigate(`/quiz/${m.id}`)}
                />
              ))}
            </Section>
          )}

          {cantonDistrictModes && cantonDistrictModes.length > 0 && (
            <Section title="Bezirke nach Kanton">
              {cantonDistrictModes.map((m) => (
                <ModeButton
                  key={m.id}
                  title={m.title}
                  subtitle={m.description}
                  onClick={() => navigate(`/quiz/${m.id}`)}
                />
              ))}
            </Section>
          )}

          {/* kleiner Spacer unten */}
          <div style={{ height: 6 }} />
        </div>
      </div>
    </div>
  );
}

function Title({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          boxShadow: "var(--shadow)",
          cursor: "pointer",
          fontWeight: 800,
          fontSize: 13,
          color: "inherit",
          width: "fit-content",
          transition: "transform 120ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        ← Zurück
      </button>

      <div style={{ textAlign: "center", marginTop: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2 }}>
          Quiz
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          Wähle einen Modus aus
        </div>
      </div>
    </div>
  );
}

function Search({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 18,
        border: "1px solid var(--border)",
        background: "var(--bg)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
        Suchen
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="z.B. Gemeinden, Zürich, Bezirke…"
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid var(--border)",
          padding: "10px 12px",
          outline: "none",
          background: "var(--card)",
          color: "inherit",
          fontSize: 14,
        }}
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 18,
        border: "1px solid var(--border)",
        background: "var(--card)",
        boxShadow: "var(--shadow)",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "var(--muted)",
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>

      <div style={{ display: "grid", gap: 12 }}>{children}</div>
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
        padding: "16px 18px",
        borderRadius: 18,
        border: "1px solid var(--border)",
        background: "var(--bg)",
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
      <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
        {subtitle}
      </div>
    </button>
  );
}
