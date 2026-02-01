import { useEffect, useMemo, useState } from "react";
import type { Node } from "../types/Node";
import { useNavigation } from "../state/useNavigation";
import HierarchySvg from "../components/HierarchySvg";
import { useGeoLocation } from "../state/useGeoLocation";
import { getAdminFromLonLat } from "../geo/getAdminFromLonLat";

type Props = {
  title: string;
  subtitle?: string;

  // ✅ NEW: nur Explore setzt das auf true
  enableLocation?: boolean;
};

export default function MapPage({ title, subtitle, enableLocation = false }: Props) {
  const { current, breadcrumb, goTo, goBack, canGoBack } = useNavigation("ch");

  const gps = useGeoLocation();

  const [cantonsGeo, setCantonsGeo] = useState<any>(null);
  const [districtsGeo, setDistrictsGeo] = useState<any>(null);
  const [communitiesGeo, setCommunitiesGeo] = useState<any>(null);

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

  const breadcrumbText = breadcrumb.map((n: Node) => n.name).join(" › ");

  const viewLabel = useMemo(() => {
    if (current.level === "country") return "Schweiz";
    return current.name;
  }, [current]);

  // ✅ GeoJSON nur laden, wenn Explore GPS wirklich nutzen will (kein Chaos/Overhead für Learn)
  useEffect(() => {
    if (!enableLocation) return;
    if (!gps.enabled) return;

    let cancelled = false;

    const load = async () => {
      try {
        const [c, d, m] = await Promise.all([
          fetch("/geo/cantons.geojson").then((r) => r.json()),
          fetch("/geo/districts.geojson").then((r) => r.json()),
          fetch("/geo/communities.geojson").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setCantonsGeo(c);
        setDistrictsGeo(d);
        setCommunitiesGeo(m);
      } catch {
        if (cancelled) return;
        setCantonsGeo(null);
        setDistrictsGeo(null);
        setCommunitiesGeo(null);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [enableLocation, gps.enabled]);

  // ✅ Wenn Permission denied / error → Toggle wieder aus
  useEffect(() => {
    if (!enableLocation) return;
  
    // ✅ nur Permission denied (code 1) auto-aus
    if (gps.state.status === "error" && gps.state.errorCode === 1) {
      gps.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableLocation, gps.state.status, (gps.state as any).errorCode]);  

  const admin = useMemo(() => {
    if (!enableLocation) return null;
    if (gps.state.status !== "on") return null;
    if (!cantonsGeo) return { country: "Schweiz" as const };

    return getAdminFromLonLat({
      lonLat: gps.state.lonLat,
      cantonsGeo,
      districtsGeo,
      communitiesGeo,
    });
  }, [enableLocation, gps.state, cantonsGeo, districtsGeo, communitiesGeo]);

  const gpsErrorText = useMemo(() => {
    if (!enableLocation) return null;
    if (gps.state.status !== "error") return null;
    return gps.state.error || "Standort nicht verfügbar.";
  }, [enableLocation, gps.state]);

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
            {subtitle && <div style={{ fontSize: 12, opacity: 0.85 }}>{subtitle}</div>}
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

          {canGoBack && <button onClick={goBack}>← Zurück</button>}
        </div>

        {/* ✅ GPS Panel nur im Explore */}
        {enableLocation && (
          <div
            style={{
              display: "grid",
              gap: 10,
              marginBottom: 12,
              padding: 12,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--card)",
              boxShadow: "var(--shadow)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900 }}>Standort</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  GPS-Position auf der Karte anzeigen
                </div>
              </div>

              <button
                role="switch"
                aria-checked={gps.enabled}
                onClick={() => {
                  if (gps.enabled) gps.stop();
                  else gps.start();
                }}
                style={{
                  position: "relative",
                  width: 46,
                  height: 26,
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: gps.enabled ? "rgba(172, 0, 0, 0.85)" : "var(--bg)",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)",
                  transition: "background 0.2s ease",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: gps.enabled ? 22 : 2,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                    transition: "left 0.2s cubic-bezier(.4,0,.2,1)",
                  }}
                />
              </button>
            </div>

            {gpsErrorText && (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Standort nicht verfügbar: <b>{gpsErrorText}</b>
              </div>
            )}

            {gps.state.status === "loading" && (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Standort wird geladen…
              </div>
            )}

            {admin && (
              <div style={{ fontSize: 13, lineHeight: 1.35 }}>
                <div>
                  Land: <b>{admin.country}</b>
                </div>
                <div>
                  Kanton: <b>{admin.canton ? admin.canton.name : "—"}</b>
                </div>
                <div>
                  Bezirk: <b>{admin.district ? admin.district.name : "—"}</b>
                </div>
                <div>
                  Gemeinde: <b>{admin.community ? admin.community.name : "—"}</b>
                </div>

                {gps.state.status === "on" && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                    Genauigkeit:{" "}
                    <b>
                      {typeof gps.state.accuracyM === "number"
                        ? `${Math.round(gps.state.accuracyM)} m`
                        : "—"}
                    </b>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
            gpsLonLat={enableLocation && gps.state.status === "on" ? gps.state.lonLat : null}
            gpsAccuracyM={enableLocation && gps.state.status === "on" ? gps.state.accuracyM : null}
          />
        </section>
      </main>
    </div>
  );
}
