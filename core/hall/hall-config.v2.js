import { isStructuralProfileId } from "../library/structural-profiles.v1.js";

export const HALL_SCHEMA_V2 = "baustellenplaner.hall.v2";
export const HALL_VERSION_V2 = 2;
const EPS = 1e-9;
const ROOF_TYPES = new Set(["flat", "gable", "mono"]);
const WALL_IDS = ["wall:x0", "wall:xMax", "wall:z0", "wall:zMax"];

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : Number.NaN; }
function axisId(sequence) { return `axis:x${String(sequence).padStart(2, "0")}`; }
function axisTokenFromId(id) { const match = /^axis:(x\d+)$/.exec(String(id || "")); return match?.[1] || null; }
function axisSequence(id) { const token = axisTokenFromId(id); return token ? Number(token.slice(1)) : Number.NaN; }
function samePosition(a, b) { return Math.abs(finite(a) - finite(b)) <= EPS; }

export function deriveLongitudinalAxes(lengthIn, spacingIn) {
  const length = finite(lengthIn); const spacing = finite(spacingIn);
  if (!(length > 0) || !(spacing > 0) || spacing > length) return [];
  const full = Math.floor((length + EPS) / spacing);
  const positions = [0];
  for (let i = 1; i <= full; i += 1) positions.push(Math.min(length, i * spacing));
  if (Math.abs(positions[positions.length - 1] - length) > EPS) positions.push(length);
  return positions.map((position, index) => ({ id: axisId(index), index, position }));
}

export function reconcileLongitudinalAxes(existingAxesIn, lengthIn, spacingIn, identitySequenceIn) {
  const target = deriveLongitudinalAxes(lengthIn, spacingIn);
  const existingAxes = Array.isArray(existingAxesIn) ? existingAxesIn : [];
  const maxExistingSequence = existingAxes.reduce((max, axis) => {
    const sequence = axisSequence(axis?.id);
    return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
  }, -1);
  let nextSequence = Number.isInteger(identitySequenceIn) && identitySequenceIn >= 0
    ? Math.max(identitySequenceIn, maxExistingSequence + 1)
    : maxExistingSequence + 1;
  const usedIds = new Set();
  const axes = target.map((targetAxis, index) => {
    const existing = existingAxes.find((axis) => !usedIds.has(axis?.id) && samePosition(axis?.position, targetAxis.position));
    if (existing?.id) {
      usedIds.add(existing.id);
      return { id: existing.id, index, position: targetAxis.position };
    }
    let id = axisId(nextSequence++);
    while (usedIds.has(id) || existingAxes.some((axis) => axis?.id === id)) id = axisId(nextSequence++);
    usedIds.add(id);
    return { id, index, position: targetAxis.position };
  });
  return { axes, identitySequence: nextSequence };
}

export function buildStructuralElements({ axes, width, columnProfileId, primaryMemberProfileId }) {
  const columns = []; const primaryMembers = [];
  for (const axis of axes) {
    const token = axisTokenFromId(axis.id);
    if (!token) throw new Error(`Ungültige stabile Achsen-ID ${axis?.id || "(leer)"}.`);
    columns.push({ id: `column:${token}:z0`, axisId: axis.id, side: "z0", z: 0, profileRef: columnProfileId, enabled: true });
    columns.push({ id: `column:${token}:zMax`, axisId: axis.id, side: "zMax", z: width, profileRef: columnProfileId, enabled: true });
    primaryMembers.push({ id: `beam:frame:${token}`, axisId: axis.id, profileRef: primaryMemberProfileId, enabled: true });
  }
  return { columns, primaryMembers };
}

export function normalizeStoredHallV2(hallIn) {
  const hall = clone(hallIn || {}); const errors = []; const warnings = [];
  if (hall.schema !== HALL_SCHEMA_V2) errors.push(`Hall schema muss ${HALL_SCHEMA_V2} sein.`);
  if (hall.version !== HALL_VERSION_V2) errors.push(`Hall version muss ${HALL_VERSION_V2} sein.`);
  const { length, width, eaveHeight } = hall.dimensions || {};
  const spacing = hall.grid?.longitudinal?.spacing;
  if (!(finite(length) >= 1)) errors.push("Hallenlänge muss mindestens 1,00 m betragen.");
  if (!(finite(width) >= 1)) errors.push("Hallenbreite muss mindestens 1,00 m betragen.");
  if (!(finite(eaveHeight) >= 2)) errors.push("Traufhöhe muss mindestens 2,00 m betragen.");
  if (!ROOF_TYPES.has(hall.roof?.type)) errors.push("Unbekannte Dachform.");
  if (hall.grid?.longitudinal?.mode !== "spacing") errors.push("BP-002 V1 unterstützt nur Rastermodus spacing.");
  if (!(finite(spacing) >= 0.5) || finite(spacing) > finite(length)) errors.push("Ungültiges Rastermaß.");
  for (const wallId of WALL_IDS) if (!hall.envelope?.walls?.[wallId]) errors.push(`Außenwand ${wallId} fehlt.`);
  const axes = Array.isArray(hall.grid?.longitudinal?.axes) ? hall.grid.longitudinal.axes : [];
  const expectedAxes = deriveLongitudinalAxes(length, spacing);
  const ids = new Set();
  if (axes.length !== expectedAxes.length) errors.push("Persistierte Hallenachsen stimmen nicht mit dem autoritativen Raster überein.");
  axes.forEach((axis, index) => {
    if (!axisTokenFromId(axis?.id) || ids.has(axis?.id)) errors.push("Persistierte Hallenachse ohne eindeutige stabile Identität.");
    ids.add(axis?.id);
    if (axis?.index !== index || !samePosition(axis?.position, expectedAxes[index]?.position)) errors.push("Persistierte Hallenachsen stimmen nicht mit dem autoritativen Raster überein.");
  });
  for (const element of [...(hall.structure?.columns || []), ...(hall.structure?.primaryMembers || [])]) {
    if (!element?.id || !element?.axisId) errors.push("Strukturelement ohne stabile Identität/Achse.");
    if (element?.axisId && !ids.has(element.axisId)) errors.push(`Strukturelement referenziert unbekannte Achse ${element.axisId}.`);
    if (!isStructuralProfileId(element?.profileRef)) errors.push(`Unbekannte Profilreferenz ${element?.profileRef || "(leer)"}.`);
  }
  const rise = hall.roof?.type === "flat" ? 0 : finite(hall.roof?.peakHeight) - finite(eaveHeight);
  if (hall.roof?.type !== "flat" && !(rise > 0)) errors.push("First-/Hochpunkthöhe muss über der Traufhöhe liegen.");
  const pitchDeg = hall.roof?.type === "gable" ? Math.atan(rise / (finite(width) / 2)) * 180 / Math.PI : hall.roof?.type === "mono" ? Math.atan(rise / finite(width)) * 180 / Math.PI : 0;
  return { hall, errors, warnings, derived: { axisPositions: expectedAxes.map((axis) => axis.position), axes, pitchDeg, ridgeElevation: hall.roof?.type === "flat" ? finite(eaveHeight) : finite(hall.roof?.peakHeight) } };
}
