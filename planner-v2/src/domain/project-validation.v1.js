import { PROJECT_SCHEMA, PROJECT_VERSION } from "./project-document.v1.js";

const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const finiteOrNull = (value) => value === null || (typeof value === "number" && Number.isFinite(value));

export function validateProjectDocument(project) {
  const errors = [];
  if (!isRecord(project)) return { valid: false, errors: ["Projekt muss ein Objekt sein."] };
  if (project.schema !== PROJECT_SCHEMA) errors.push("Unbekanntes Projektformat.");
  if (project.formatVersion !== PROJECT_VERSION) errors.push("Nicht unterstützte Projektversion.");
  if (typeof project.id !== "string" || !project.id.trim()) errors.push("Projekt-ID fehlt.");
  if (typeof project.name !== "string" || !project.name.trim()) errors.push("Projektname fehlt.");
  if (project.units !== "mm") errors.push("Projekteinheit muss Millimeter sein.");
  if (project.coordinateSystem !== "x-right-y-up-z-up") errors.push("Unbekanntes Koordinatensystem.");
  if (!isRecord(project.siteArea)) errors.push("Baustellenbereich fehlt.");
  else {
    if (!["unconfigured", "whole-hall", "hall-section", "free-area"].includes(project.siteArea.kind)) errors.push("Ungültiger Typ des Baustellenbereichs.");
    for (const key of ["widthMm", "heightMm"]) {
      const value = project.siteArea[key];
      if (!finiteOrNull(value) || (typeof value === "number" && value <= 0)) errors.push(`${key} muss leer oder größer als 0 sein.`);
    }
    for (const key of ["originXmm", "originYmm"]) {
      if (!Number.isFinite(project.siteArea[key])) errors.push(`${key} muss eine endliche Zahl sein.`);
    }
  }
  if (!Array.isArray(project.objects)) errors.push("Objektliste fehlt oder ist ungültig.");
  if (project.layers !== undefined) {
    if (!Array.isArray(project.layers) || project.layers.length === 0) errors.push("Mindestens eine Planungsebene ist erforderlich.");
    else {
      const layerIds = new Set();
      for (const layer of project.layers) {
        if (!isRecord(layer) || typeof layer.id !== "string" || !layer.id.trim() || typeof layer.name !== "string" || !layer.name.trim() || !Number.isFinite(layer.elevationMm)) { errors.push("Planungsebene benötigt ID, Name und gültige Höhe."); continue; }
        if (layerIds.has(layer.id)) errors.push("Ebenen-IDs müssen eindeutig sein.");
        layerIds.add(layer.id);
        if (layer.visible !== undefined && typeof layer.visible !== "boolean") errors.push("Ebenensichtbarkeit muss ein Wahrheitswert sein.");
      }
    }
  }
  if (Array.isArray(project.objects)) {
    const objectIds = new Set();
    for (const object of project.objects) {
      if (!isRecord(object) || typeof object.id !== "string" || !object.id.trim()) { errors.push("Planobjekt benötigt eine eindeutige ID."); continue; }
      if (objectIds.has(object.id)) errors.push("Objekt-IDs müssen eindeutig sein.");
      objectIds.add(object.id);
      for (const key of ["xMm", "yMm", "zMm", "widthMm", "depthMm", "rotationDeg"]) if (!Number.isFinite(object[key])) errors.push(`Planobjekt ${key} muss eine endliche Zahl sein.`);
      if (Number.isFinite(object.widthMm) && object.widthMm <= 0) errors.push("Objektbreite muss größer als 0 sein.");
      if (Number.isFinite(object.depthMm) && object.depthMm <= 0) errors.push("Objekttiefe muss größer als 0 sein.");
      if (typeof object.layerId !== "string" || !object.layerId.trim()) errors.push("Planobjekt benötigt eine Planungsebene.");
      if (typeof object.type !== "string" || !object.type.trim()) errors.push("Planobjekttyp fehlt.");
    }
    if (Array.isArray(project.layers)) for (const object of project.objects) if (object?.layerId && !project.layers.some(layer => layer.id === object.layerId)) errors.push(`Planobjekt ${object.id} verweist auf eine unbekannte Ebene.`);
  }
  if (!isRecord(project.modules)) errors.push("Modulbereich fehlt oder ist ungültig.");
  if (project.planBackground !== null) {
    const plan = project.planBackground;
    if (!isRecord(plan)) errors.push("Grundrissreferenz ist ungültig.");
    else {
      if (typeof plan.assetId !== "string" || !plan.assetId) errors.push("Grundriss-Asset fehlt.");
      if (!Number.isInteger(plan.widthPx) || plan.widthPx <= 0 || !Number.isInteger(plan.heightPx) || plan.heightPx <= 0) errors.push("Grundrissabmessungen sind ungültig.");
      if (!["image/png", "image/jpeg"].includes(plan.mimeType)) errors.push("Grundrissformat muss PNG oder JPEG sein.");
      if (plan.calibration !== null) {
        const c = plan.calibration;
        if (!isRecord(c) || !Array.isArray(c.pixelPoints) || c.pixelPoints.length !== 2) errors.push("Kalibrierung benötigt zwei Referenzpunkte.");
        else {
          const pointsOk = c.pixelPoints.every(p => isRecord(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= plan.widthPx && p.y <= plan.heightPx);
          if (!pointsOk) errors.push("Kalibrierpunkte liegen außerhalb des Grundrissbildes.");
          if (!(Number.isFinite(c.realDistanceMm) && c.realDistanceMm > 0 && Number.isFinite(c.scaleMmPerPixel) && c.scaleMmPerPixel > 0)) errors.push("Kalibrierstrecke oder Maßstab ist ungültig.");
        }
      }
    }
  }
  for (const key of ["createdAt", "updatedAt"]) if (typeof project[key] !== "string" || !Number.isFinite(Date.parse(project[key]))) errors.push(`${key} ist ungültig.`);
  return { valid: errors.length === 0, errors };
}

export function assertValidProject(project) {
  const result = validateProjectDocument(project);
  if (!result.valid) throw new Error(result.errors.join(" "));
  return project;
}
