import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";

type Props = {
  scopeId: string;
  level: "country" | "canton" | "district";
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

// ⚠️ HIER ggf. property-name anpassen, falls nicht "bezirksnummer"
function districtNodeIdFromProps(props: any, cantonId: string, fallback: string): string {
  const bz = props?.bezirksnummer ?? fallback; // <- falls bei dir anders: z.B. props?.id
  return `d-${cantonId}-${String(bz)}`;
}

export default function HierarchySvg({ scopeId, level, onSelectNode }: Props) {
  const [geo, setGeo] = useState<any>(null);
  const [districtGeo, setDistrictGeo] = useState<any>(null);
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

  // Bezirke nur laden, wenn wir im Kanton-View sind
  useEffect(() => {
    if (level !== "canton") return;

    // optional: wenn du beim Zurück nicht neu laden willst, NICHT resetten
    // setDistrictGeo(null);

    fetch("/geo/districts.geojson")
      .then((r) => r.json())
      .then(setDistrictGeo)
      .catch(() => setDistrictGeo(null));
  }, [level]);

  // Welche Features werden gezeichnet?
  const features = useMemo(() => {
    const sid = String(scopeId);

    if (level === "country") {
      if (!geo?.features) return [];
      return geo.features; // alle Kantone
    }

    if (level === "canton") {
      if (!districtGeo?.features) return [];
      return districtGeo.features.filter(
        (f: any) => String(f?.properties?.kantonsnummer) === sid
      );
    }

    // (district-level kommt später, z.B. Gemeinden)
    return [];
  }, [geo, districtGeo, scopeId, level]);

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
      const id =
        level === "country"
          ? (cantonIdFromProps(f.properties) ?? `c-${idx}`)           // "1".."26"
          : districtNodeIdFromProps(f.properties, sid, `x-${idx}`);   // "d-1-..."

      // Klickziel (Node-ID)
      const nodeId =
        level === "country"
          ? (cantonIdFromProps(f.properties) ?? id)                  // Kantonsnummer
          : id;                                                      // Bezirks-node-id

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
          const clickable = level === "country" || level === "canton";

          return (
            <path
              key={id}
              d={d}
              fill={isHover ? "#eee" : "#fff"}
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
