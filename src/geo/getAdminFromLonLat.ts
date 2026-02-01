import { geoContains } from "d3-geo";

type AdminResult = {
  country: "Schweiz";
  canton?: { id: string; name: string };
  district?: { id: string; name: string };
  community?: { id: string; name: string };
};

function cantonIdFromProps(props: any): string | null {
  const v = props?.kantonsnummer;
  return typeof v === "number" ? String(v) : typeof v === "string" ? v : null;
}

export function getAdminFromLonLat(args: {
  lonLat: [number, number];
  cantonsGeo: any | null;
  districtsGeo: any | null;
  communitiesGeo: any | null;
}): AdminResult {
  const { lonLat, cantonsGeo, districtsGeo, communitiesGeo } = args;

  const out: AdminResult = { country: "Schweiz" };

  const cantonFeature =
    cantonsGeo?.features?.find((f: any) => geoContains(f, lonLat)) ?? null;

  if (!cantonFeature) return out;

  const cantonId = cantonIdFromProps(cantonFeature?.properties);
  const cantonName = String(
    cantonFeature?.properties?.name ??
      cantonFeature?.properties?.kantonsname ??
      `Kanton ${cantonId ?? ""}`
  ).trim();

  if (cantonId) out.canton = { id: cantonId, name: cantonName };

  // Bezirk (optional)
  let districtFeature: any | null = null;
  if (districtsGeo?.features?.length && cantonId) {
    const candidates = districtsGeo.features.filter(
      (f: any) => String(f?.properties?.kantonsnummer) === String(cantonId)
    );
    districtFeature = candidates.find((f: any) => geoContains(f, lonLat)) ?? null;

    if (districtFeature) {
      const dn = String(districtFeature?.properties?.bezirksnummer ?? "").trim();
      const dName = String(
        districtFeature?.properties?.name ??
          districtFeature?.properties?.bezirksname ??
          "Bezirk"
      ).trim();

      if (dn) out.district = { id: `d-${cantonId}-${dn}`, name: dName };
    }
  }

  // Gemeinde (optional)
  if (communitiesGeo?.features?.length && cantonId) {
    // kleine Optimierung: erst nach Kanton filtern
    const commCandidates = communitiesGeo.features.filter(
      (f: any) => String(f?.properties?.kantonsnummer) === String(cantonId)
    );

    // Wenn wir Bezirk haben, kann man zusätzlich nach bezirksnummer filtern (falls vorhanden)
    const commCandidates2 =
      districtFeature && districtFeature?.properties?.bezirksnummer != null
        ? commCandidates.filter((f: any) => {
            const bn = f?.properties?.bezirksnummer;
            return bn != null && String(bn) === String(districtFeature?.properties?.bezirksnummer);
          })
        : commCandidates;

    const communityFeature =
      commCandidates2.find((f: any) => geoContains(f, lonLat)) ??
      commCandidates.find((f: any) => geoContains(f, lonLat)) ??
      null;

    if (communityFeature) {
      const rawId = communityFeature?.properties?.id;
      const name = String(
        communityFeature?.properties?.name ??
          communityFeature?.properties?.gemeindename ??
          "Gemeinde"
      ).trim();

      if (rawId != null) {
        out.community = { id: `m-${cantonId}-${String(rawId)}`, name };
      }
    }
  }

  return out;
}
