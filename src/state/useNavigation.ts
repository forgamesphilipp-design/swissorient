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
    if (builtCommunitiesForParentRef.current.has(parentId)) return;

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

      return {
        ...prev,
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

      setNodes((prev) => {
        const n = prev[key];
        if (n) {
          setCurrentId(key);

          if (n.level === "canton") {
            void ensureDistrictsForCanton(key);
          } else if (n.level === "district") {
            void ensureCommunitiesForParent(key);
          }

          return prev;
        }

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
