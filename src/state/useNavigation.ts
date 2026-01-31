import { useCallback, useMemo, useRef, useState } from "react";
import type { Node } from "../types/Node";
import { baseNodes } from "../data/nodes";
import { buildDistrictNodesForCanton } from "../data/buildDistrictNodesForCanton";
import { buildCommunityNodesForDistrict } from "../data/buildCommunityNodesForDistrict";

type Navigation = {
  nodes: Record<string, Node>;
  current: Node;
  children: Node[];
  breadcrumb: Node[];
  goTo: (id: string) => void;
  goBack: () => void;
  canGoBack: boolean;
};

export function useNavigation(rootId: string = "ch"): Navigation {
  const [nodes, setNodes] = useState<Record<string, Node>>(baseNodes);

  const safeRootId = nodes[rootId] ? rootId : "ch";
  const [currentId, setCurrentId] = useState<string>(safeRootId);

  // districts.geojson einmal laden und behalten
  const districtGeoRef = useRef<any>(null);
  const builtDistrictsForCantonRef = useRef(new Set<string>());
  const loadingDistrictsRef = useRef(false);

  // communities geojson einmal laden und behalten
  const communityGeoRef = useRef<any>(null);
  const builtCommunitiesForParentRef = useRef(new Set<string>());
  const loadingCommunitiesRef = useRef(false);

  const current: Node = useMemo(() => {
    return nodes[currentId] ?? nodes[safeRootId];
  }, [nodes, currentId, safeRootId]);

  const children: Node[] = useMemo(() => {
    return (current.childrenIds ?? [])
      .map((id) => nodes[id])
      .filter((n): n is Node => Boolean(n));
  }, [nodes, current]);

  const breadcrumb: Node[] = useMemo(() => {
    const path: Node[] = [];
    let n: Node | undefined = current;
    const seen = new Set<string>();

    while (n && !seen.has(n.id)) {
      seen.add(n.id);
      path.unshift(n);
      n = n.parentId ? nodes[n.parentId] : undefined;
    }

    return path;
  }, [nodes, current]);

  const ensureCommunitiesForParent = useCallback(async (parentId: string) => {

    if (!communityGeoRef.current && !loadingCommunitiesRef.current) {
      loadingCommunitiesRef.current = true;
      try {
        const r = await fetch("/geo/communities.geojson"); // <- ggf. anpassen
        communityGeoRef.current = await r.json();
      } finally {
        loadingCommunitiesRef.current = false;
      }
    }

    const geo = communityGeoRef.current;
    if (!geo) return;

    const { communityNodes, communityIds } = buildCommunityNodesForDistrict(geo, parentId);

    setNodes((prev) => {
      const parent = prev[parentId];
      if (!parent) return prev;

      const cleaned = { ...prev };

      // 🔥 ALLE Community-Nodes dieses Parents entfernen
      for (const key of Object.keys(cleaned)) {
        const n = cleaned[key];
        if (n?.level === "community" && n.parentId === parentId) {
          delete cleaned[key];
        }
      }


      return {
        ...cleaned,
        ...communityNodes,
        [parentId]: { ...parent, childrenIds: communityIds },
      };
    });

    builtCommunitiesForParentRef.current.add(parentId);
  }, []);

  const ensureDistrictsForCanton = useCallback(
    async (cantonId: string) => {
      if (builtDistrictsForCantonRef.current.has(cantonId)) return;

      if (!districtGeoRef.current && !loadingDistrictsRef.current) {
        loadingDistrictsRef.current = true;
        try {
          const r = await fetch("/geo/districts.geojson");
          districtGeoRef.current = await r.json();
        } finally {
          loadingDistrictsRef.current = false;
        }
      }

      const geo = districtGeoRef.current;
      if (!geo) return;

      const { districtNodes, districtIds } = buildDistrictNodesForCanton(geo, cantonId);

      setNodes((prev) => {
        const canton = prev[cantonId];
        if (!canton) return prev;

        if (builtDistrictsForCantonRef.current.has(cantonId)) return prev;

        return {
          ...prev,
          ...districtNodes,
          [cantonId]: { ...canton, childrenIds: districtIds },
        };
      });

      builtDistrictsForCantonRef.current.add(cantonId);

      // ✅ Kanton ohne Bezirke -> Communities direkt an Kanton hängen
      if (districtIds.length === 0) {
        void ensureCommunitiesForParent(cantonId);
      }
    },
    [ensureCommunitiesForParent]
  );

  const goTo = useCallback(
    (id: string) => {
      const key = String(id).trim();
      if (!key) return;

      if (key.startsWith("m-")) {
        setCurrentId(key);
      }

      // helper: parse district id like d-1-110
      const mDistrict = /^d-(\d+)-(\d+)$/.exec(key);
      const mCommunity = /^m-(\d+)-(\d+)$/.exec(key);

      setNodes((prev) => {
        const n = prev[key];
        if (n) {
          setCurrentId(key);

          if (n.level === "canton") {
            void ensureDistrictsForCanton(key);
          } else if (n.level === "district") {
            void ensureCommunitiesForParent(key);
          } else if (n.level === "community") {
            // ✅ nichts nachladen, aber korrekt öffnen
          }

          return prev;
        }
        // ✅ FALL 1: District wurde geklickt, aber Nodes noch nicht gebaut (Timing)
        if (mDistrict) {
          const cantonId = mDistrict[1];
          const districtNo = mDistrict[2];

          // ✅ Name aus bereits geladenem districts.geojson holen (falls vorhanden)
          let label = "Bezirk";
          const geo = districtGeoRef.current;
          if (geo?.features?.length) {
            const hit = geo.features.find((f: any) => {
              const p = f?.properties ?? {};
              return (
                String(p.kantonsnummer) === String(cantonId) &&
                String(p.bezirksnummer) === String(districtNo)
              );
            });
            if (hit?.properties) {
              label = String(hit.properties.name ?? hit.properties.bezirksname ?? "Bezirk");
            }
          }

          const placeholder: Node = {
            id: key,
            name: label,            // ✅ sofort richtig
            level: "district",
            parentId: cantonId,
            childrenIds: [],
          };

          setCurrentId(key);
          void ensureDistrictsForCanton(cantonId);
          void ensureCommunitiesForParent(key);

          return { ...prev, [key]: placeholder };
        }

        // ✅ FALL 2: Community wurde geklickt, aber Nodes noch nicht gebaut (Timing)
        if (mCommunity) {
          const cantonId = mCommunity[1];

          // 🔥 WICHTIG: Parent kann entweder Bezirk ODER Kanton sein
          const parent =
            currentId && /^d-\d+-\d+$/.test(currentId)
              ? currentId
              : String(cantonId);

          const placeholder: Node = {
            id: key,
            name: "Gemeinde",
            level: "community",
            parentId: parent,
            childrenIds: [],
          };

          setCurrentId(key);

          // ✅ Communities IMMER für den Parent sicherstellen
          void ensureCommunitiesForParent(parent);

          return { ...prev, [key]: placeholder };
        }

        // unknown id -> fallback auf root
        setCurrentId(safeRootId);
        return prev;
      });
    },
    [ensureDistrictsForCanton, ensureCommunitiesForParent, safeRootId]
  );

  const goBack = useCallback(() => {
    const parentId = current.parentId;

    if (parentId && nodes[parentId]) {
      setCurrentId(parentId);
      return;
    }

    if (current.id !== safeRootId) {
      setCurrentId(safeRootId);
    }
  }, [current, safeRootId, nodes]);

  const canGoBack = current.parentId !== null && current.id !== safeRootId;

  return { nodes, current, children, breadcrumb, goTo, goBack, canGoBack };
}
