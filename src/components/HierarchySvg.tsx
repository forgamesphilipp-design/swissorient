import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import MiniMap from "./MiniMap";

const DEBUG_PANEL = false; // später einfach auf false oder löschen
const ENABLE_MINIMAP = false;


type Props = {
  scopeId: string;
  parentId: string | null;
  level: "country" | "canton" | "district" | "community";
  onSelectNode: (nodeId: string) => void;
};

type RenderedFeature = {
  id: string;        // SVG key / hover id
  d: string;         // path data
  nodeId: string;    // ID, die beim Klick an onSelectNode geht
  props: any;  // Rohdaten der Feature-Properties (für Debugging)
};

function cantonIdFromProps(props: any): string | null {
  const v = props?.kantonsnummer;
  return typeof v === "number" ? String(v) : null;
}

function districtNodeIdFromProps(props: any, cantonId: string, fallback: string): string {
  const bz = props?.bezirksnummer ?? fallback; // <- falls bei dir anders: z.B. props?.id
  return `d-${cantonId}-${String(bz)}`;
}

function communityNodeIdFromProps(props: any, cantonId: string, fallback: string): string {
  const raw = props?.id ?? fallback;
  return `m-${cantonId}-${String(raw)}`;
}

function parseDistrictScopeId(scopeId: string): { cantonId: string; districtNo: string } | null {
  const m = /^d-(\d+)-(\d+)$/.exec(String(scopeId));
  if (!m) return null;
  return { cantonId: m[1], districtNo: m[2] };
}

function parseCommunityScopeId(
  scopeId: string
): { cantonId: string; communityId: string } | null {
  const m = /^m-(\d+)-(.+)$/.exec(String(scopeId));
  if (!m) return null;
  return { cantonId: m[1], communityId: m[2] };
}

export default function HierarchySvg({ scopeId, parentId, level, onSelectNode }: Props) {
  const [geo, setGeo] = useState<any>(null);
  const [districtGeo, setDistrictGeo] = useState<any>(null);
  const [communityGeo, setCommunityGeo] = useState<any>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [debugSelected, setDebugSelected] = useState<any>(null);


  // UX: kleine Delays gegen Flackern
  const enterTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

  // Path cache (funktioniert mit Resizing, weil scopeId im Key steckt)
  const dCache = useRef<Map<string, string>>(new Map());

  // Kantone laden (einmal)
  useEffect(() => {
    fetch("/geo/cantons.geojson")
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo(null));
  }, []);

  // Bezirke laden, wenn wir canton-view anzeigen könnten
  useEffect(() => {
    if (level !== "canton") return;

    fetch("/geo/districts.geojson")
      .then((r) => r.json())
      .then(setDistrictGeo)
      .catch(() => setDistrictGeo(null));
  }, [level]);

  // Communities (Gemeinden) laden, wenn wir sie anzeigen könnten
  useEffect(() => {
    if (level !== "district" && level !== "community" && level !== "canton") return;

    fetch("/geo/communities.geojson")
      .then((r) => r.json())
      .then(setCommunityGeo)
      .catch(() => setCommunityGeo(null));
  }, [level]);

  // Welche Features werden gezeichnet?
  const features = useMemo(() => {
    const sid = String(scopeId);

    if (level === "country") {
      if (!geo?.features) return [];
      return geo.features; // alle Kantone
    }

    if (level === "canton") {
      // 1️⃣ zuerst versuchen: Bezirke
      if (districtGeo?.features) {
        const districts = districtGeo.features.filter(
          (f: any) => String(f?.properties?.kantonsnummer) === sid
        );

        // ✅ Kanton HAT Bezirke → normal anzeigen
        if (districts.length > 0) {
          return districts;
        }
      }

      // 2️⃣ Fallback: Kanton OHNE Bezirke → Gemeinden anzeigen
      if (!communityGeo?.features) return [];

      return communityGeo.features.filter((f: any) => {
        const p = f?.properties ?? {};
        return String(p.kantonsnummer) === sid &&
              (p.bezirksnummer == null || String(p.bezirksnummer).trim() === "");
      });
    }


    if (level === "district") {
      // scopeId ist d-<kanton>-<bezirk> -> Gemeinden dieses Bezirks anzeigen
      if (!communityGeo?.features) return [];
      const parsed = parseDistrictScopeId(sid);
      if (!parsed) return [];

      return communityGeo.features.filter((f: any) => {
        const kn = f?.properties?.kantonsnummer;
        const bn = f?.properties?.bezirksnummer;
        return (
          String(kn) === String(parsed.cantonId) &&
          bn != null &&
          String(bn) === String(parsed.districtNo)
        );
      });
    }

    if (level === "community") {
      if (!communityGeo?.features) return [];

      const parsed = parseCommunityScopeId(sid);
      if (!parsed) return [];

      return communityGeo.features.filter((f: any) => {
        const p = f?.properties ?? {};
        const kn = p?.kantonsnummer;
        const raw = p?.id;

        return (
          String(kn) === String(parsed.cantonId) &&
          raw != null &&
          String(raw) === String(parsed.communityId)
        );
      });
    }

  }, [geo, districtGeo, communityGeo, scopeId, level]);

  // Projektion (Resizing bleibt: fit auf aktuelle features)
  const pathFn = useMemo(() => {
    const projection = geoMercator();
    if (features.length > 0) {
      projection.fitSize(
        [1000, 700],
        { type: "FeatureCollection", features } as any
      );
    }
    return geoPath(projection as any);
  }, [features]);

  // Rendered + Cache
  const rendered = useMemo<RenderedFeature[]>(() => {
    return features.map((f: any, idx: number) => {
      const sid = String(scopeId);

      // ID fürs SVG/hover
      let id: string;
      let nodeId: string;

      if (level === "country") {
        id = cantonIdFromProps(f.properties) ?? `c-${idx}`;         // "1".."26"
        nodeId = cantonIdFromProps(f.properties) ?? id;             // Kantonsnummer
      } else if (level === "canton") {
        // 🔥 Kanton MIT Bezirken → District
        if (f?.properties?.bezirksnummer != null) {
          id = districtNodeIdFromProps(f.properties, sid, `x-${idx}`);
          nodeId = id;
        } 
        // 🔥 Kanton OHNE Bezirke → Gemeinde
        else {
          id = communityNodeIdFromProps(f.properties, sid, `m-${idx}`);
          nodeId = id;
        }
      }
      else if (level === "district") {
        const parsed = parseDistrictScopeId(sid);
        const cantonId = parsed?.cantonId ?? "0";
        id = communityNodeIdFromProps(f.properties, cantonId, `m-${idx}`); // "m-1-..."
        nodeId = id;                                                     // Gemeinde-node-id
      } else {
        id = `u-${idx}`;
        nodeId = id;
      }

      const cacheKey = `${sid}:${id}`;
      let d = dCache.current.get(cacheKey);
      if (!d) {
        d = pathFn(f) || "";
        dCache.current.set(cacheKey, d);
      }

      return { id, d, nodeId, props: f?.properties ?? {} };
    });
  }, [features, pathFn, scopeId, level]);

  const onEnter = (id: string) => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    if (enterTimer.current) window.clearTimeout(enterTimer.current);

    enterTimer.current = window.setTimeout(() => {
      setHovered((prev) => (prev === id ? prev : id));
    }, 80);
  };

  const onLeave = (id: string) => {
    if (enterTimer.current) window.clearTimeout(enterTimer.current);
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);

    leaveTimer.current = window.setTimeout(() => {
      setHovered((prev) => (prev === id ? null : prev));
    }, 60);
  };

  useEffect(() => {
    return () => {
      if (enterTimer.current) window.clearTimeout(enterTimer.current);
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    };
  }, []);

  // Lade-Placeholder je nach View
  if (level === "country" && !geo) return <div style={{ height: "70vh" }} />;
  if (level === "canton" && !districtGeo) return <div style={{ height: "70vh" }} />;
  if (level === "district" && !communityGeo) return <div style={{ height: "70vh" }} />;

  return (
    <div
      style={{
        width: "100%",
        height: "70vh",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #ddd",
        position: "relative",
      }}
    >
      {DEBUG_PANEL && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 360,
            maxHeight: "60vh",
            overflow: "auto",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
            fontSize: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            zIndex: 5,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontWeight: 800 }}>Debug</div>
            <button
              onClick={() => setDebugSelected(null)}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: "4px 8px",
                cursor: "pointer",
                background: "#fff",
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ marginTop: 8 }}>
            <div><b>level</b>: {level}</div>
            <div><b>scopeId</b>: {String(scopeId)}</div>
            <div><b>features</b>: {rendered.length}</div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "10px 0" }} />

          <div style={{ fontWeight: 700, marginBottom: 6 }}>Liste (id → nodeId)</div>
          <div style={{ display: "grid", gap: 6 }}>
            {rendered.slice(0, 50).map((r) => (
              <div key={r.id} style={{ padding: 6, border: "1px solid #eee", borderRadius: 10 }}>
                <div><b>{r.id}</b> → {r.nodeId}</div>
                <div style={{ color: "#666" }}>
                  kn: {String(r.props?.kantonsnummer ?? "")}{" "}
                  bz: {String(r.props?.bezirksnummer ?? "")}{" "}
                  id: {String(r.props?.id ?? "")}
                </div>
              </div>
            ))}
            {rendered.length > 50 && (
              <div style={{ color: "#666" }}>…nur erste 50 angezeigt</div>
            )}
          </div>

          {debugSelected && (
            <>
              <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "10px 0" }} />
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Letzter Klick</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
      {JSON.stringify(debugSelected, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
      {ENABLE_MINIMAP && level !== "country" && (
        <MiniMap level={level} scopeId={scopeId} parentId={parentId} />
      )}

      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {rendered.map(({ id, d, nodeId, props }) => {
          const isHover = hovered === id;
          const clickable = level === "country" || level === "canton" || level === "district";

          return (
            <path
              key={id}
              d={d}
              fill={isHover ? "#eee" : "#b2cdff"}
              stroke="#000"
              strokeWidth={1}
              onMouseEnter={() => onEnter(id)}
              onMouseLeave={() => onLeave(id)}
              onClick={() => {
                if (!clickable) return;

                setDebugSelected({ level, scopeId, id, nodeId, props });

                // 🔥 Kanton OHNE Bezirke: Gemeinde-Klick → Community-Level erzwingen
                if (
                  level === "canton" &&
                  props?.bezirksnummer == null &&
                  nodeId.startsWith("m-")
                ) {
                  onSelectNode(nodeId);
                  return;
                }

                onSelectNode(nodeId);
              }}

              style={{
                cursor: clickable ? "pointer" : "default",
                transition: "fill 120ms ease, stroke-width 120ms ease",
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
