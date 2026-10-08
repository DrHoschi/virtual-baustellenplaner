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
