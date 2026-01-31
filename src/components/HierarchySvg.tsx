import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";

type Props = {
  scopeId: string;
  level: "country" | "canton" | "district" | "community";
  onSelectNode: (nodeId: string) => void;
};

type RenderedFeature = {
  id: string;        // SVG key / hover id
  d: string;         // path data
  nodeId: string;    // ID, die beim Klick an onSelectNode geht
};

function cantonIdFromProps(props: any): string | null {
  const v = props?.kantonsnummer;
  return typeof v === "number" ? String(v) : null;
}

function districtNodeIdFromProps(props: any, cantonId: string, fallback: string): string {
  const bz = props?.bezirksnummer ?? fallback; // <- falls bei dir anders: z.B. props?.id
  return `d-${cantonId}-${String(bz)}`;
}

// ⚠️ ggf. anpassen: gemeindenummer/bfsnummer/id
function communityNodeIdFromProps(props: any, cantonId: string, fallback: string): string {
  const raw = props?.gemeindenummer ?? props?.bfsnummer ?? props?.id ?? fallback;
  return `m-${cantonId}-${String(raw)}`;
}

function parseDistrictScopeId(scopeId: string): { cantonId: string; districtNo: string } | null {
  const m = /^d-(\d+)-(\d+)$/.exec(String(scopeId));
  if (!m) return null;
  return { cantonId: m[1], districtNo: m[2] };
}

export default function HierarchySvg({ scopeId, level, onSelectNode }: Props) {
  const [geo, setGeo] = useState<any>(null);
  const [districtGeo, setDistrictGeo] = useState<any>(null);
  const [communityGeo, setCommunityGeo] = useState<any>(null);
  const [hovered, setHovered] = useState<string | null>(null);

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
    if (level !== "district" && level !== "community") return;

    fetch("/geo/communities.geojson") // <- ggf. anpassen: municipalities.geojson
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
      // Normal: Bezirke anzeigen
      if (!districtGeo?.features) return [];
      return districtGeo.features.filter(
        (f: any) => String(f?.properties?.kantonsnummer) === sid
      );
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

    // community-level: aktuell keine Unterebene, daher nichts zeichnen
    return [];
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
        id = districtNodeIdFromProps(f.properties, sid, `x-${idx}`); // "d-1-..."
        nodeId = id;                                                // Bezirks-node-id
      } else if (level === "district") {
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

      return { id, d, nodeId };
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
      }}
    >
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {rendered.map(({ id, d, nodeId }) => {
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
                if (clickable) onSelectNode(nodeId);
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
