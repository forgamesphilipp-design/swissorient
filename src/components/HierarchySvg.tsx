import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import MiniMap from "./MiniMap";

const DEBUG_PANEL = false;
const ENABLE_MINIMAP = false;

type LockedFill = Record<string, "white" | "yellow" | "orange" | "red">;

type Props = {
  scopeId: string;
  parentId: string | null;
  level: "country" | "canton" | "district" | "community";
  onSelectNode: (nodeId: string) => void;

  flashId?: string | null;
  flashColor?: "red" | "green" | "blue" | null;

  // ✅ wenn gesetzt, nur dieses Feld ist klickbar/hoverbar (Hint)
  lockToId?: string | null;

  // ✅ NEW: dauerhaft geloggte Felder + Farbe
  lockedFills?: LockedFill;

  // ✅ Geolocation Marker
  gpsLonLat?: [number, number] | null;
  gpsAccuracyM?: number | null;
};

type RenderedFeature = {
  id: string;
  d: string;
  nodeId: string;
  props: any;
};

function cantonIdFromProps(props: any): string | null {
  const v = props?.kantonsnummer;
  return typeof v === "number" ? String(v) : null;
}

function districtNodeIdFromProps(props: any, cantonId: string, fallback: string): string {
  const bz = props?.bezirksnummer ?? fallback;
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

function parseCommunityScopeId(scopeId: string): { cantonId: string; communityId: string } | null {
  const m = /^m-(\d+)-(.+)$/.exec(String(scopeId));
  if (!m) return null;
  return { cantonId: m[1], communityId: m[2] };
}

function fillFromLocked(key: LockedFill[keyof LockedFill]) {
  if (key === "white") return "#ffffff";
  if (key === "yellow") return "#facc15";
  if (key === "orange") return "#fb923c";
  return "#ef4444"; // red
}

export default function HierarchySvg({
  scopeId,
  parentId,
  level,
  onSelectNode,
  flashId,
  flashColor,
  lockToId,
  lockedFills,
  gpsLonLat,
  gpsAccuracyM,
}: Props) {
  const [geo, setGeo] = useState<any>(null);
  const [districtGeo, setDistrictGeo] = useState<any>(null);
  const [communityGeo, setCommunityGeo] = useState<any>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [debugSelected, setDebugSelected] = useState<any>(null);

  const lockActive = Boolean(lockToId);
  const projectionRef = useRef<any>(null);

  const enterTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const dCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    fetch("/geo/cantons.geojson")
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo(null));
  }, []);

  useEffect(() => {
    if (level !== "canton") return;

    fetch("/geo/districts.geojson")
      .then((r) => r.json())
      .then(setDistrictGeo)
      .catch(() => setDistrictGeo(null));
  }, [level]);

  useEffect(() => {
    if (level !== "district" && level !== "community" && level !== "canton") return;

    fetch("/geo/communities.geojson")
      .then((r) => r.json())
      .then(setCommunityGeo)
      .catch(() => setCommunityGeo(null));
  }, [level]);

  const features = useMemo(() => {
    const sid = String(scopeId);

    if (level === "country") {
      if (!geo?.features) return [];
      return geo.features;
    }

    if (level === "canton") {
      if (districtGeo?.features) {
        const districts = districtGeo.features.filter(
          (f: any) => String(f?.properties?.kantonsnummer) === sid
        );
        if (districts.length > 0) return districts;
      }

      if (!communityGeo?.features) return [];
      return communityGeo.features.filter((f: any) => {
        const p = f?.properties ?? {};
        return (
          String(p.kantonsnummer) === sid &&
          (p.bezirksnummer == null || String(p.bezirksnummer).trim() === "")
        );
      });
    }

    if (level === "district") {
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

    return [];
  }, [geo, districtGeo, communityGeo, scopeId, level]);

  const pathFn = useMemo(() => {
    const projection = geoMercator();
    if (features.length > 0) {
      projection.fitSize([1000, 700], { type: "FeatureCollection", features } as any);
    }
    projectionRef.current = projection;
    return geoPath(projection as any);
  }, [features]);

  const rendered = useMemo<RenderedFeature[]>(() => {
    return features.map((f: any, idx: number) => {
      const sid = String(scopeId);

      let id: string;
      let nodeId: string;

      if (level === "country") {
        id = cantonIdFromProps(f.properties) ?? `c-${idx}`;
        nodeId = cantonIdFromProps(f.properties) ?? id;
      } else if (level === "canton") {
        if (f?.properties?.bezirksnummer != null) {
          id = districtNodeIdFromProps(f.properties, sid, `x-${idx}`);
          nodeId = id;
        } else {
          id = communityNodeIdFromProps(f.properties, sid, `m-${idx}`);
          nodeId = id;
        }
      } else if (level === "district") {
        const parsed = parseDistrictScopeId(sid);
        const cantonId = parsed?.cantonId ?? "0";
        id = communityNodeIdFromProps(f.properties, cantonId, `m-${idx}`);
        nodeId = id;
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
    if (lockActive && lockToId && id !== lockToId) return;
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    if (enterTimer.current) window.clearTimeout(enterTimer.current);

    enterTimer.current = window.setTimeout(() => {
      setHovered((prev) => (prev === id ? prev : id));
    }, 80);
  };

  const onLeave = (id: string) => {
    if (lockActive && lockToId && id !== lockToId) return;
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

  useEffect(() => {
    if (!lockActive) return;
    setHovered(null);
  }, [lockActive]);

  if (level === "country" && !geo) return <div style={{ height: "70vh" }} />;
  if (level === "canton" && !districtGeo) return <div style={{ height: "70vh" }} />;
  if (level === "district" && !communityGeo) return <div style={{ height: "70vh" }} />;

  let gpsPoint: { x: number; y: number } | null = null;
  if (gpsLonLat && projectionRef.current) {
    const p = projectionRef.current(gpsLonLat);
    if (p) gpsPoint = { x: p[0], y: p[1] };
  }

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
            <div><b>lockToId</b>: {String(lockToId ?? "")}</div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "10px 0" }} />
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
          const lockedKey = lockedFills?.[id] ?? null;
          const isLocked = Boolean(lockedKey);

          const isAllowedByHint = !lockActive || !lockToId || id === lockToId;
          const isAllowed = isAllowedByHint && !isLocked;

          const isHover = isAllowed && hovered === id;

          const baseClickable = level === "country" || level === "canton" || level === "district";
          const clickable = baseClickable && isAllowed;

          const lockedFill = lockedKey ? fillFromLocked(lockedKey) : null;

          return (
            <path
              key={id}
              d={d}
              fill={
                // ✅ 1) locked hat Priorität (dauerhaft)
                lockedFill
                  ? lockedFill
                  : // ✅ 2) Flash (rot/blau) weiterhin
                  flashId === id
                    ? flashColor === "red"
                      ? "#c00000"
                      : flashColor === "green"
                        ? "#16a34a"
                        : "#2563eb"
                    : // ✅ 3) Hint: nicht erlaubte werden grau
                    !isAllowedByHint
                      ? "#e6e6e6"
                      : // ✅ 4) Hover/Normal
                      isHover
                        ? "#eee"
                        : "#b2cdff"
              }
              stroke={!isAllowedByHint ? "rgba(0,0,0,0.25)" : "#000"}
              strokeWidth={1}
              onMouseEnter={() => clickable && onEnter(id)}
              onMouseLeave={() => clickable && onLeave(id)}
              onClick={() => {
                if (!clickable) return;

                setDebugSelected({ level, scopeId, id, nodeId, props });

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
                transition: "fill 120ms ease, stroke-width 120ms ease, stroke 120ms ease",
              }}
            />
          );
        })}

        {gpsPoint && (
          <>
            {typeof gpsAccuracyM === "number" && gpsAccuracyM > 0 && (
              <circle
                cx={gpsPoint.x}
                cy={gpsPoint.y}
                r={Math.min(140, Math.max(12, gpsAccuracyM / 8))}
                fill="rgba(37, 99, 235, 0.12)"
                stroke="rgba(37, 99, 235, 0.35)"
                strokeWidth={1}
              />
            )}

            <circle
              cx={gpsPoint.x}
              cy={gpsPoint.y}
              r={7}
              fill="#2563eb"
              stroke="#fff"
              strokeWidth={2}
            />
          </>
        )}
      </svg>
    </div>
  );
}
