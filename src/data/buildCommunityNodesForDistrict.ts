import type { Node } from "../types/Node";

/**
 * Baut Community/Gemeinde-Nodes.
 *
 * Unterstützt 2 Parent-Typen:
 *  - parentId = "d-{kanton}-{bezirk}"  => filtert nach kantonsnummer + bezirksnummer
 *  - parentId = "{kanton}"             => (Kanton ohne Bezirke) filtert nach kantonsnummer und nimmt Gemeinden ohne bezirksnummer
 */
export function buildCommunityNodesForDistrict(
  communityGeo: any,
  parentId: string
): { communityNodes: Record<string, Node>; communityIds: string[] } {
  const communityNodes: Record<string, Node> = {};
  const communityIds: string[] = [];

  // Parent kann ein District-Node sein: d-<cantonId>-<districtNo>
  // oder ein Canton-Node: <cantonId>
  let cantonId: string | null = null;
  let districtNo: string | null = null;

  const m = /^d-(\d+)-(\d+)$/.exec(parentId);
  if (m) {
    cantonId = m[1];
    districtNo = m[2];
  } else if (/^\d+$/.test(parentId)) {
    cantonId = parentId;
    districtNo = null; // canton-only: keine Bezirke
  } else {
    // unknown parent id format
    return { communityNodes, communityIds };
  }

  for (const f of communityGeo?.features ?? []) {
    const p = f?.properties ?? {};

    // Muss immer passen:
    const kn = p?.kantonsnummer;
    if (String(kn) !== String(cantonId)) continue;

    // Fall A: Parent ist Bezirk -> Gemeinde muss diese bezirksnummer haben
    if (districtNo !== null) {
      const bn = p?.bezirksnummer;
      if (bn == null) continue;
      if (String(bn) !== String(districtNo)) continue;
    }

    // Fall B: Parent ist Kanton ohne Bezirke -> nur Gemeinden ohne bezirksnummer nehmen
    if (districtNo === null) {
      const bn = p?.bezirksnummer;
      if (bn != null && String(bn).trim() !== "") continue;
    }

    const raw = p?.id; 
    if (raw == null) continue;
    const id = `m-${cantonId}-${String(raw)}`;

    communityNodes[id] = {
      id,
      name: String(p?.name ?? p?.gemeindename ?? "Gemeinde"),
      level: "community", // 
      parentId: parentId,
      childrenIds: [],
    };

    communityIds.push(id);
  }

  return { communityNodes, communityIds };
}
