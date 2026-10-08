/** BP-002 – controlled global structural profile catalog contract. */
export const STRUCTURAL_PROFILE_CATALOG_SCHEMA = "baustellenplaner.structural-profiles.v1";

export const STRUCTURAL_PROFILES_V1 = Object.freeze([
  Object.freeze({ id: "profile:hea:200", family: "HEA", designation: "HEA 200", shape: "i", dimensionsMm: Object.freeze({ h: 190, b: 200, tw: 6.5, tf: 10 }) }),
  Object.freeze({ id: "profile:hea:240", family: "HEA", designation: "HEA 240", shape: "i", dimensionsMm: Object.freeze({ h: 230, b: 240, tw: 7.5, tf: 12 }) }),
  Object.freeze({ id: "profile:ipe:300", family: "IPE", designation: "IPE 300", shape: "i", dimensionsMm: Object.freeze({ h: 300, b: 150, tw: 7.1, tf: 10.7 }) }),
  Object.freeze({ id: "profile:rhs:200x200x8", family: "RHS", designation: "RHS 200×200×8", shape: "rhs", dimensionsMm: Object.freeze({ h: 200, b: 200, t: 8 }) }),
]);

const BY_ID = new Map(STRUCTURAL_PROFILES_V1.map((profile) => [profile.id, profile]));
export const DEFAULT_COLUMN_PROFILE_ID = "profile:hea:240";
export const DEFAULT_PRIMARY_MEMBER_PROFILE_ID = "profile:ipe:300";

export function getStructuralProfile(profileId) {
  return BY_ID.get(String(profileId || "")) || null;
}

export function isStructuralProfileId(profileId) {
  return BY_ID.has(String(profileId || ""));
}

export function getProfileRenderSectionMeters(profileId) {
  const profile = getStructuralProfile(profileId);
  if (!profile) return null;
  return {
    x: Number(profile.dimensionsMm?.b || profile.dimensionsMm?.h || 180) / 1000,
    y: Number(profile.dimensionsMm?.h || profile.dimensionsMm?.b || 180) / 1000,
  };
}
