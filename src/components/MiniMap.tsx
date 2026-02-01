import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";

type Level = "country" | "canton" | "district" | "community";

type Props = {
  level: Level;
  scopeId: string;
  parentId: string | null;
};

function parseDistrictId(id: string) {
  const m = /^d-(\d+)-(\d+)$/.exec(String(id));
  if (!m) return null;
  return { cantonId: m[1], districtNo: m[2] };
}

function parseCommunityId(id: string) {
  const m = /^m-(\d+)-(.+)$/.exec(String(id));
  if (!m) return null;
  return { cantonId: m[1], communityRaw: m[2] };
}

export default function MiniMap({ level, scopeId, parentId }: Props) {
  const [cantonsGeo, setCantonsGeo] = useState<any>(null);
  const [districtGeo, setDistrictGeo] = useState<any>(null);
  const [communityGeo, setCommunityGeo] = useState<any>(null);

  // einmalig laden (kleine Daten, minimap braucht Stabilität)
  useEffect(() => {
    fetch("/geo/cantons.geojson").then(r => r.json()).then(setCantonsGeo).catch(() => setCantonsGeo(null));
    fetch("/geo/districts.geojson").then(r => r.json()).then(setDistrictGeo).catch(() => setDistrictGeo(null));
    fetch("/geo/communities.geojson").then(r => r.json()).then(setCommunityGeo).catch(() => setCommunityGeo(null));
  }, []);

  // MiniMap ist "eine Ebene vorher"
  const parentLevel: Level | null = useMemo(() => {
    if (level === "canton") return "country";
    if (level === "district") return "canton";
    if (level === "community") return "district"; // oder canton bei kanton-ohne-bezirk -> handled via parentId
    return null;
  }, [level]);

  // Welche Features sollen in der MiniMap gezeichnet werden (Parent-Ebene)?
  const features = useMemo(() => {
    if (!parentLevel) return [];

    // Parent ist "country": Kantone
    if (parentLevel === "country") {
      return cantonsGeo?.features ?? [];
    }

    // Parent ist "canton": Bezirke eines Kantons
    if (parentLevel === "canton") {
      const cantonId =
        level === "district" ? parseDistrictId(scopeId)?.cantonId :
        level === "community" ? (parseCommunityId(scopeId)?.cantonId ?? null) :
        null;

      if (!cantonId) return [];
      return (districtGeo?.features ?? []).filter((f: any) => String(f?.properties?.kantonsnummer) === String(cantonId));
    }

    // Parent ist "district": Gemeinden eines Bezirks ODER (kanton-ohne-bezirk) Gemeinden des Kantons
    if (parentLevel === "district") {
      // falls parentId ein Bezirk ist, filtere nach Bezirk
      if (parentId && /^d-\d+-\d+$/.test(parentId)) {
        const p = parseDistrictId(parentId);
        if (!p) return [];
        return (communityGeo?.features ?? []).filter((f: any) => {
          const pr = f?.properties ?? {};
          return (
            String(pr.kantonsnummer) === String(p.cantonId) &&
            pr.bezirksnummer != null &&
            String(pr.bezirksnummer) === String(p.districtNo)
          );
        });
      }

      // sonst parentId ist Kanton (kanton ohne Bezirke)
      if (parentId && /^\d+$/.test(parentId)) {
        return (communityGeo?.features ?? []).filter((f: any) => {
          const pr = f?.properties ?? {};
          return (
            String(pr.kantonsnummer) === String(parentId) &&
            (pr.bezirksnummer == null || String(pr.bezirksnummer).trim() === "")
          );
        });
      }

      return [];
    }

    return [];
  }, [parentLevel, cantonsGeo, districtGeo, communityGeo, scopeId, level, parentId]);

  // Highlight: aktuelles Element (scopeId) rot
  const isHighlighted = useMemo(() => {
    if (level === "canton") {
      return (props: any) => String(props?.kantonsnummer) === String(scopeId);
    }
    if (level === "district") {
      const p = parseDistrictId(scopeId);
      if (!p) return (_: any) => false;
      return (props: any) =>
        String(props?.kantonsnummer) === String(p.cantonId) &&
        String(props?.bezirksnummer) === String(p.districtNo);
    }
    if (level === "community") {
      const p = parseCommunityId(scopeId);
      if (!p) return (_: any) => false;
      // Achtung: in deinem Geo ist die Gemeinde-ID offenbar bfs_nummer ODER id
      return (props: any) => {
        const raw = props?.id ?? props?.bfs_nummer; // <- wichtig für "high quality"
        return String(props?.kantonsnummer) === String(p.cantonId) && raw != null && String(raw) === String(p.communityRaw);
      };
    }
    return (_: any) => false;
  }, [level, scopeId]);

  // Projektion fit auf MiniMap
  const pathFn = useMemo(() => {
    const projection = geoMercator();
    if (features.length > 0) {
      projection.fitSize([100, 60], { type: "FeatureCollection", features } as any);
    }
    return geoPath(projection as any);
  }, [features]);

  if (level === "country") return null;
  if (!cantonsGeo || !districtGeo || !communityGeo) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,  
        left: 12,
        width: 120,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255, 255, 255, 0.92)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
        zIndex: 6,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        Übersicht
      </div>
      <svg viewBox="0 0 100 60" style={{ display: "block", width: "100%", height: 150 }}>
        {(features ?? []).map((f: any, i: number) => {
          const p = f?.properties ?? {};
          const d = pathFn(f) || "";
          const hot = isHighlighted(p);
          return (
            <path
              key={i}
              d={d}
              fill={hot ? "#c00000" : "rgba(0,0,0,0.10)"}
              stroke="rgba(0,0,0,0.55)"
              strokeWidth={0.8}
            />
          );
        })}
      </svg>
    </div>
  );
}
