import { useEffect, useMemo } from "react";
import type { Node } from "../types/Node";
import { useNavigation } from "../state/useNavigation";
import HierarchySvg from "../components/HierarchySvg";

type Props = {
  title: string;
  subtitle?: string;
};

export default function MapPage({ title, subtitle }: Props) {
  const { current, breadcrumb, goTo, goBack, canGoBack } =
    useNavigation("ch");

  // ESC = zurück (nur Explore/Learn)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && canGoBack) {
        goBack();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canGoBack, goBack]);

  const breadcrumbText = breadcrumb
    .map((n: Node) => n.name)
    .join(" › ");

  const viewLabel = useMemo(() => {
    if (current.level === "country") return "Schweiz";
    return current.name;
  }, [current]);

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
            padding: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#fff",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {subtitle}
              </div>
            )}
          </div>

          <div style={{ fontSize: 13 }}>
            Ansicht: <b>{viewLabel}</b>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "18px 16px 28px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "var(--muted)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {breadcrumbText}
          </div>

          {canGoBack && (
            <button onClick={goBack}>← Zurück</button>
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
          <HierarchySvg
            scopeId={current.id}
            parentId={current.parentId}
            level={current.level}
            onSelectNode={goTo}
          />
        </section>
      </main>
    </div>
  );
}
