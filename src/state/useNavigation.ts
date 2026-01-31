import { useCallback, useMemo, useRef, useState } from "react";
import type { Node } from "../types/Node";
import { baseNodes } from "../data/nodes";
import { buildDistrictNodesForCanton } from "../data/buildDistrictNodesForCanton";

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
  const builtForCantonRef = useRef(new Set<string>());
  const loadingRef = useRef(false);

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

  const ensureDistrictsForCanton = useCallback(async (cantonId: string) => {
    // nur einmal pro Kanton bauen
    if (builtForCantonRef.current.has(cantonId)) return;

    // districts.geojson lazy laden (nur 1x insgesamt)
    if (!districtGeoRef.current && !loadingRef.current) {
      loadingRef.current = true;
      try {
        const r = await fetch("/geo/districts.geojson");
        districtGeoRef.current = await r.json();
      } finally {
        loadingRef.current = false;
      }
    }

    const geo = districtGeoRef.current;
    if (!geo) return;

    const { districtNodes, districtIds } = buildDistrictNodesForCanton(geo, cantonId);

    setNodes((prev) => {
      const canton = prev[cantonId];
      if (!canton) return prev;

      // Falls schon gesetzt (z.B. durch Race), nicht nochmal überschreiben
      if (builtForCantonRef.current.has(cantonId)) return prev;

      return {
        ...prev,
        ...districtNodes,
        [cantonId]: { ...canton, childrenIds: districtIds },
      };
    });

    builtForCantonRef.current.add(cantonId);
  }, []);

  // ✅ goTo ohne "stale closure": prüft nodes im setState Callback
  const goTo = useCallback(
    (id: string) => {
      const key = String(id).trim();
      if (!key) return;

      setNodes((prev) => {
        const n = prev[key];
        if (n) {
          setCurrentId(key);

          if (n.level === "canton") {
            void ensureDistrictsForCanton(key);
          }
          return prev;
        }

        // unknown id -> fallback auf root
        setCurrentId(safeRootId);
        return prev;
      });
    },
    [ensureDistrictsForCanton, safeRootId]
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
