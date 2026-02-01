import type { QuizModeDefinition } from "../types";

const cantonNames: Record<string, string> = {
  "1": "Zürich",
  "2": "Bern",
  "3": "Luzern",
  "4": "Uri",
  "5": "Schwyz",
  "6": "Obwalden",
  "7": "Nidwalden",
  "8": "Glarus",
  "9": "Zug",
  "10": "Fribourg",
  "11": "Solothurn",
  "12": "Basel-Stadt",
  "13": "Basel-Landschaft",
  "14": "Schaffhausen",
  "15": "Appenzell Ausserrhoden",
  "16": "Appenzell Innerrhoden",
  "17": "St. Gallen",
  "18": "Graubünden",
  "19": "Aargau",
  "20": "Thurgau",
  "21": "Tessin",
  "22": "Waadt",
  "23": "Wallis",
  "24": "Neuchâtel",
  "25": "Genève",
  "26": "Jura",
};

function cantonLabel(cantonId: string) {
  return cantonNames[cantonId] ? `Kanton ${cantonNames[cantonId]}` : `Kanton ${cantonId}`;
}

function makeCantonDistrictsMode(cantonId: string): QuizModeDefinition {
  const label = cantonLabel(cantonId);

  return {
    id: `ch-districts-${cantonId}`,
    title: `Bezirke – ${label}`,
    description: `Finde die Bezirke von ${label}`,

    startScopeId: cantonId,

    async loadPool() {
      const r = await fetch("/geo/districts.geojson");
      const geo = await r.json();

      const pool = [];
      for (const f of geo?.features ?? []) {
        const p = f?.properties ?? {};

        const kn = String(p?.kantonsnummer);
        const districtNo = p?.bezirksnummer;
        const name = String(p?.name ?? p?.bezirksname ?? "").trim();

        if (kn !== String(cantonId)) continue;
        if (districtNo == null || !name) continue;

        pool.push({
          name,
          path: [`d-${cantonId}-${districtNo}`],
        });
      }
      return pool;
    },
  };
}

/**
 * ✅ Liefert nur Kantons-Bezirks-Modes, die wirklich Bezirke haben.
 * Das passiert EINMAL beim Laden der Mode-Auswahl (kein Chaos, kein Race).
 */
export async function loadDistrictModesForCantons(): Promise<QuizModeDefinition[]> {
  const r = await fetch("/geo/districts.geojson");
  const geo = await r.json();

  const cantonHasDistrict = new Set<string>();

  for (const f of geo?.features ?? []) {
    const p = f?.properties ?? {};
    const kn = p?.kantonsnummer;
    const bn = p?.bezirksnummer;
    if (kn == null) continue;
    if (bn == null || String(bn).trim() === "") continue;
    cantonHasDistrict.add(String(kn));
  }

  const modes: QuizModeDefinition[] = [];
  for (let i = 1; i <= 26; i++) {
    const cantonId = String(i);
    if (!cantonHasDistrict.has(cantonId)) continue; // ✅ filtert Kantone ohne Bezirke raus
    modes.push(makeCantonDistrictsMode(cantonId));
  }

  return modes;
}
