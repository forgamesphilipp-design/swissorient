import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import HierarchySvg from "../components/HierarchySvg";
import { useNavigation } from "../state/useNavigation";
import { getQuizMode } from "../quiz/modes";
import { useQuizEngine } from "../quiz/engine/useQuizEngine";
import type { QuizModeDefinition } from "../quiz/types"; // ggf. Pfad anpassen

export default function QuizRunnerPage() {
  const { modeId } = useParams();
  const navigate = useNavigate();

  // ✅ Hooks IMMER ausführen (nie hinter if-return verstecken)
  const { current, breadcrumb, goTo, goBack, canGoBack } = useNavigation("ch", {
    disableBack: true,
  });

  const [mode, setMode] = useState<QuizModeDefinition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!modeId) {
      navigate("/quiz", { replace: true });
      return;
    }

    setLoading(true);
    getQuizMode(modeId)
      .then((m) => {
        if (cancelled) return;
        setMode(m ?? null);
        setLoading(false);

        if (!m) navigate("/quiz", { replace: true });
      })
      .catch(() => {
        if (cancelled) return;
        setMode(null);
        setLoading(false);
        navigate("/quiz", { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [modeId, navigate]);

  // ✅ Engine wird immer aufgerufen; wenn mode=null, startet sie nicht
  const quiz = useQuizEngine({
    mode,
    goTo,
    currentId: current.id,
  });

  const breadcrumbText = useMemo(() => {
    return breadcrumb.map((n) => n.name).join(" › ");
  }, [breadcrumb]);

  const stepText = quiz.target ? `${quiz.step + 1}/${quiz.target.path.length}` : "";

  // ✅ UI: während loading oder mode fehlt, zeigen wir ein neutrales Loading (aber hooks sind schon gelaufen)
  if (loading || !mode) {
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
        <div
          style={{
            width: "min(420px, 92%)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            boxShadow: "var(--shadow)",
            padding: 18,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>Lade Quiz…</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
            Einen Moment bitte.
          </div>

          <button
            onClick={() => navigate("/quiz")}
            style={{
              marginTop: 14,
              borderRadius: 999,
              padding: "10px 14px",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Zurück zur Auswahl
          </button>
        </div>
      </div>
    );
  }

  // ✅ Ab hier: mode ist sicher da
  return (
    <div style={{ minHeight: "100%" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(10px)",
          background: "rgba(172, 0, 0, 0.85)",
          padding: 14,
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 260, display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Quiz – {mode?.title ?? ""}</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              filter: quiz.started ? "none" : "blur(5px)",
              opacity: quiz.started ? 1 : 0.65,
              transition: "filter 220ms ease, opacity 220ms ease",
            }}
          >
            <span
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.25)",
                fontWeight: 800,
              }}
            >
              Suche
            </span>

            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                padding: "6px 10px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.92)",
                color: "#111",
                border: "1px solid rgba(0,0,0,0.1)",
                maxWidth: 520,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={quiz.target ? quiz.target.name : ""}
            >
              {quiz.target ? quiz.target.name : "..."}
            </span>

            {quiz.target && (
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.18)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
                title="Schritt"
              >
                {stepText}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ fontSize: 13, whiteSpace: "nowrap" }}>
            Ziel: <b>{quiz.progressDone}/{quiz.progressTotal}</b>
          </div>

          <div style={{ fontSize: 13, whiteSpace: "nowrap" }}>
            ⏱ <b>{quiz.elapsedText}</b>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: 16 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--muted)",
            marginBottom: 8,
            height: 16,
            lineHeight: "16px",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {breadcrumbText}
        </div>

        {canGoBack && (
          <button onClick={goBack} style={{ marginBottom: 10 }}>
            ← Zurück
          </button>
        )}

        <div style={{ position: "relative" }}>
          <HierarchySvg
            scopeId={current.id}
            parentId={current.parentId}
            level={current.level}
            onSelectNode={quiz.onSelectNode}
            flashId={quiz.flashId}
            flashColor={quiz.flashColor}
          />

          {!quiz.started && !quiz.finished && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <div
                style={{
                  width: "min(420px, 92%)",
                  background: "rgba(255,255,255,0.82)",
                  border: "1px solid var(--border)",
                  borderRadius: 18,
                  boxShadow: "var(--shadow)",
                  padding: 18,
                  textAlign: "center",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 900 }}>Bereit?</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                  Karte ist geladen. Zeit startet erst beim Start.
                </div>

                <button
                  onClick={quiz.startQuiz}
                  style={{
                    marginTop: 14,
                    borderRadius: 999,
                    padding: "10px 14px",
                    border: "1px solid var(--border)",
                    background: "rgba(172, 0, 0, 0.92)",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Quiz starten
                </button>
              </div>
            </div>
          )}

          {quiz.finished && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <div
                style={{
                  width: "min(520px, 92%)",
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid var(--border)",
                  borderRadius: 18,
                  boxShadow: "var(--shadow)",
                  padding: 18,
                  textAlign: "center",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 900 }}>Ziel erreicht 🎉</div>

                <div style={{ marginTop: 10, fontSize: 14 }}>
                  Zeit gebraucht: <b>{quiz.elapsedText}</b>
                </div>

                <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                  {quiz.progressDone}/{quiz.progressTotal} abgeschlossen
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    gap: 10,
                    justifyContent: "center",
                  }}
                >
                  <button onClick={() => navigate("/quiz")}>Zurück zur Auswahl</button>
                  <button onClick={() => navigate("/explore")}>Explore</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
