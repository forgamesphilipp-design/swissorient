import type { Node } from "../types/Node";

export function buildDistrictNodesForCanton(
  districtGeo: any,
  cantonId: string
): { districtNodes: Record<string, Node>; districtIds: string[] } {
  const districtNodes: Record<string, Node> = {};
  const districtIds: string[] = [];

  for (const f of districtGeo?.features ?? []) {
    const kn = f?.properties?.kantonsnummer;
    if (String(kn) !== String(cantonId)) continue;

    const raw = f?.properties?.bezirksnummer;
    if (raw == null) continue; // <- wichtig

    const id = `d-${cantonId}-${String(raw)}`;

    districtNodes[id] = {
      id,
      name: String(
        f?.properties?.name ??
        f?.properties?.bezirksname ??
        "Bezirk"
      ),
      level: "district",
      parentId: cantonId,
      childrenIds: []
    };

    districtIds.push(id);
  }

  return { districtNodes, districtIds };
}
