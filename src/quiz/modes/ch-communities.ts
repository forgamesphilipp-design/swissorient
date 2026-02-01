import type { QuizModeDefinition } from "../types";

export const chCommunitiesMode: QuizModeDefinition = {
  id: "ch-communities",
  title: "Gemeinden – Schweiz",
  description: "Finde Gemeinden über Kanton und Bezirk",

  async loadPool() {
    const r = await fetch("/geo/communities.geojson");
    const geo = await r.json();

    const pool = [];

    for (const f of geo?.features ?? []) {
      const p = f?.properties ?? {};
      const cantonId = p?.kantonsnummer;
      const districtNo = p?.bezirksnummer;
      const rawId = p?.id;
      const name = String(p?.name ?? p?.gemeindename ?? "").trim();

      if (!cantonId || rawId == null || !name) continue;

      const cantonNode = String(cantonId);
      const communityNode = `m-${cantonNode}-${String(rawId)}`;

      if (districtNo != null && String(districtNo).trim() !== "") {
        pool.push({
          name,
          path: [cantonNode, `d-${cantonNode}-${districtNo}`, communityNode],
        });
      } else {
        pool.push({
          name,
          path: [cantonNode, communityNode],
        });
      }
    }

    return pool;
  },
};
