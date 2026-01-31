import { useMemo } from "react";
import { useNavigation } from "./state/useNavigation";
import HierarchySvg from "./components/HierarchySvg";

export default function App() {
  const { current, breadcrumb, goTo, goBack, canGoBack } = useNavigation("ch");

  function openNode(id: string) {
    goTo(id);
  }

  const breadcrumbText = breadcrumb.map((n) => n.name).join(" › ");

  const viewLabel = useMemo(() => {
    if (current.level === "country") return "Schweiz";
    return current.name;
  }, [current.level, current.name]);

  const hintText = useMemo(() => {
    if (current.level === "country") return "Tipp: Kanton via Karte öffnen.";
    if (current.level === "canton") return "Tipp: Bezirk via Karte öffnen.";
    if (current.level === "district") return "Tipp: Gemeinde via Karte öffnen.";
    return "Tipp: Element via Karte öffnen.";
  }, [current.level]);

  return (
    <div style={{ minHeight: "100%" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(10px)",
          background: "rgba(172, 0, 0, 0.85)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "16px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: "var(--accent)",
                boxShadow: "0 0 0 6px var(--accentSoft)",
              }}
            />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.2 }}>
                Orient
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Interaktive Grenzansicht – Hover & Klick
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--muted)",
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.7)",
                whiteSpace: "nowrap",
              }}
            >
              Ansicht:{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {viewLabel}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "18px 16px 28px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "var(--muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {breadcrumbText}
          </div>

          {canGoBack && (
            <button
              onClick={goBack}
              style={{
                border: "1px solid var(--border)",
                background: "var(--card)",
                borderRadius: 999,
                padding: "8px 12px",
                cursor: "pointer",
                boxShadow: "0 6px 18px rgba(15,23,42,.06)",
              }}
            >
              ← Zurück
            </button>
          )}
        </div>

        <section
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>
                  {current.level === "country" ? "Schweiz" : current.name}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  Hover: hervorheben · Klick: öffnen
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: 14 }}>
            <HierarchySvg
              scopeId={current.id}
              level={current.level}
              onSelectNode={openNode}
            />
          </div>
        </section>

        <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
          {hintText}
        </div>
      </main>
    </div>
  );
}
