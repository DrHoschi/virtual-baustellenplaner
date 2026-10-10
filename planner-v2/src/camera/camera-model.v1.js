export const CAMERA_VERSION = 1;
export const CAMERA_TYPES = Object.freeze(["thermal", "color", "bispectral"]);

export function createCameraData() {
  return { version: CAMERA_VERSION, cameras: [] };
}

export function ensureCameraData(project) {
  project.modules ||= {};
  project.modules.camera ||= createCameraData();
  return project.modules.camera;
}

export function cameraFovPolygon(camera) {
  const x = Number(camera?.xMm);
  const y = Number(camera?.yMm);
  const range = Number(camera?.rangeMm);
  const fov = Number(camera?.fovDeg);
  const rotation = Number(camera?.rotationDeg);
  if (![x, y, range, fov, rotation].every(Number.isFinite) || range <= 0 || fov <= 0 || fov >= 180) return [];
  const half = fov / 2;
  const toPoint = deg => {
    const rad = deg * Math.PI / 180;
    return { xMm: Math.round(x + Math.cos(rad) * range), yMm: Math.round(y + Math.sin(rad) * range) };
  };
  return [{ xMm: x, yMm: y }, toPoint(rotation - half), toPoint(rotation), toPoint(rotation + half)];
}

export function validateCameraData(data, { layers = [], electrical = null } = {}) {
  const errors = [];
  const record = value => !!value && typeof value === "object" && !Array.isArray(value);
  if (!record(data) || data.version !== CAMERA_VERSION) return ["Kameramodul-Version oder Datenstruktur ist ungültig."];
  if (!Array.isArray(data.cameras)) return ["Kameraliste fehlt."];
  const layerIds = new Set((layers || []).map(layer => layer.id));
  const cableIds = new Set((electrical?.cables || []).map(cable => cable.id));
  const cameraIds = new Set();
  for (const camera of data.cameras) {
    if (!record(camera) || typeof camera.id !== "string" || !camera.id.trim() || cameraIds.has(camera.id)) { errors.push("Kamera-IDs müssen vorhanden und eindeutig sein."); continue; }
    cameraIds.add(camera.id);
    if (typeof camera.name !== "string" || !camera.name.trim()) errors.push(`Kamera ${camera.id}: Bezeichnung fehlt.`);
    if (!CAMERA_TYPES.includes(camera.type)) errors.push(`Kamera ${camera.id}: Typ ist ungültig.`);
    for (const key of ["xMm", "yMm", "zMm", "rotationDeg", "rangeMm", "fovDeg", "mountingHeightMm"]) if (!Number.isFinite(camera[key])) errors.push(`Kamera ${camera.id}: ${key} muss eine endliche Zahl sein.`);
    if (Number.isFinite(camera.rangeMm) && camera.rangeMm <= 0) errors.push(`Kamera ${camera.id}: Reichweite muss größer als 0 mm sein.`);
    if (Number.isFinite(camera.fovDeg) && (camera.fovDeg <= 0 || camera.fovDeg >= 180)) errors.push(`Kamera ${camera.id}: Horizontaler Sichtwinkel muss zwischen 0 und 180 Grad liegen.`);
    if (Number.isFinite(camera.mountingHeightMm) && camera.mountingHeightMm < 0) errors.push(`Kamera ${camera.id}: Montagehöhe darf nicht negativ sein.`);
    if (typeof camera.layerId !== "string" || (layerIds.size && !layerIds.has(camera.layerId))) errors.push(`Kamera ${camera.id}: Planungsebene fehlt oder ist unbekannt.`);
    if (camera.cableId !== null && camera.cableId !== undefined && (typeof camera.cableId !== "string" || !cableIds.has(camera.cableId))) errors.push(`Kamera ${camera.id}: Kabelreferenz ist ungültig.`);
    if (camera.mountingLocation !== undefined && typeof camera.mountingLocation !== "string") errors.push(`Kamera ${camera.id}: Montageort muss Text sein.`);
    if (camera.note !== undefined && typeof camera.note !== "string") errors.push(`Kamera ${camera.id}: Notiz muss Text sein.`);
  }
  return errors;
}
