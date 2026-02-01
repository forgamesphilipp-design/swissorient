import type { QuizModeDefinition } from "../types";

export const zhDistrictsMode: QuizModeDefinition = {
  id: "zh-districts",
  title: "Bezirke – Kanton Zürich",
  description: "Finde die Bezirke des Kantons Zürich",

  startScopeId: "1",

  async loadPool() {
    const r = await fetch("/geo/districts.geojson");
    const geo = await r.json();

    const pool = [];

    for (const f of geo?.features ?? []) {
      const p = f?.properties ?? {};

      const cantonId = String(p?.kantonsnummer);
      const districtNo = p?.bezirksnummer;
      const name = String(p?.name ?? p?.bezirksname ?? "").trim();

      // 🔒 only canton Zürich
      if (cantonId !== "1") continue;
      if (districtNo == null || !name) continue;

      pool.push({
        name,
        path: [`d-1-${districtNo}`], // ✅ nur 1 Schritt
      });      
    }

    return pool;
  },
};
