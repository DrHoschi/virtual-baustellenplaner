export const ELECTRICAL_VERSION = 1;
export const CABLE_STATUSES = Object.freeze(["planned", "installed", "measured", "passed", "failed"]);
export const MEASUREMENT_RESULTS = Object.freeze(["pass", "fail", "open"]);

export function createElectricalData() {
  return { version: ELECTRICAL_VERSION, trays: [], cables: [] };
}

export function ensureElectricalData(project) {
  project.modules ||= {};
  project.modules.electrical ||= createElectricalData();
  return project.modules.electrical;
}

export function polylineLengthMm(points = []) {
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    const dx = points[index].xMm - points[index - 1].xMm;
    const dy = points[index].yMm - points[index - 1].yMm;
    length += Math.hypot(dx, dy);
  }
  return length;
}

export function plannedCableLengthMm(electrical, cable) {
  const routes = new Map((electrical?.trays || []).map(tray => [tray.id, tray]));
  if (!Array.isArray(cable.trayIds) || cable.trayIds.length === 0) return null;
  let total = 0;
  for (const id of cable.trayIds) {
    const tray = routes.get(id);
    if (!tray || tray.points.length < 2) return null;
    total += polylineLengthMm(tray.points);
  }
  return total;
}

export function measurementLengthM(measurement) {
  if (Number.isFinite(measurement?.measuredLengthM)) return measurement.measuredLengthM;
  if (Number.isFinite(measurement?.lengthMm)) return measurement.lengthMm / 1000;
  return null;
}

export function normalizeMeasurementResult(result) {
  const value = String(result || "").trim().toLowerCase();
  if (["pass", "passed", "bestanden", "ok"].includes(value)) return "pass";
  if (["fail", "failed", "fehler", "nicht bestanden", "defekt"].includes(value)) return "fail";
  if (["open", "offen", "unbewertet", "measured", "gemessen"].includes(value)) return "open";
  return "";
}

export function latestMeasurement(cable) {
  const measurements = Array.isArray(cable?.measurements) ? cable.measurements : [];
  return measurements.at(-1) || null;
}

export function deriveCableStatus(cable) {
  const latest = latestMeasurement(cable);
  const result = normalizeMeasurementResult(latest?.result);
  if (result === "pass") return "passed";
  if (result === "fail") return "failed";
  if (result === "open") return "measured";
  return CABLE_STATUSES.includes(cable?.status) ? cable.status : "planned";
}

export function cableStatusSummary(cables = []) {
  const summary = { open: 0, measured: 0, passed: 0, failed: 0 };
  for (const cable of cables) {
    const status = deriveCableStatus(cable);
    if (status === "passed") summary.passed += 1;
    else if (status === "failed") summary.failed += 1;
    else if (status === "measured") summary.measured += 1;
    else summary.open += 1;
  }
  return summary;
}

export function validateElectricalData(data, layers = []) {
  const errors = [];
  const record = value => !!value && typeof value === "object" && !Array.isArray(value);
  if (!record(data) || data.version !== ELECTRICAL_VERSION) return ["Elektromodul-Version oder Datenstruktur ist ungültig."];
  if (!Array.isArray(data.trays) || !Array.isArray(data.cables)) return ["Trassen- oder Kabelliste fehlt."];
  const trayIds = new Set();
  for (const tray of data.trays) {
    if (!record(tray) || typeof tray.id !== "string" || !tray.id.trim() || trayIds.has(tray.id)) { errors.push("Trassen-IDs müssen vorhanden und eindeutig sein."); continue; }
    trayIds.add(tray.id);
    if (typeof tray.name !== "string" || !tray.name.trim()) errors.push(`Trasse ${tray.id}: Bezeichnung fehlt.`);
    if (!Number.isFinite(tray.widthMm) || tray.widthMm <= 0) errors.push(`Trasse ${tray.id}: Breite muss größer als 0 mm sein.`);
    if (typeof tray.layerId !== "string" || (layers.length && !layers.some(layer => layer.id === tray.layerId))) errors.push(`Trasse ${tray.id}: Planungsebene fehlt oder ist unbekannt.`);
    if (!Array.isArray(tray.points) || tray.points.length < 2 || tray.points.some(point => !record(point) || !Number.isFinite(point.xMm) || !Number.isFinite(point.yMm))) errors.push(`Trasse ${tray.id}: mindestens zwei gültige Verlaufspunkte erforderlich.`);
  }
  const cableIds = new Set();
  for (const cable of data.cables) {
    if (!record(cable) || typeof cable.id !== "string" || !cable.id.trim() || cableIds.has(cable.id)) { errors.push("Kabel-IDs müssen vorhanden und eindeutig sein."); continue; }
    cableIds.add(cable.id);
    if (typeof cable.name !== "string" || !cable.name.trim()) errors.push(`Kabel ${cable.id}: Bezeichnung fehlt.`);
    if (!record(cable.source) || typeof cable.source.name !== "string" || !cable.source.name.trim() || typeof cable.source.port !== "string" || !cable.source.port.trim()) errors.push(`Kabel ${cable.id}: Quelle und Port sind erforderlich.`);
    if (!record(cable.target) || typeof cable.target.name !== "string" || !cable.target.name.trim() || typeof cable.target.port !== "string" || !cable.target.port.trim()) errors.push(`Kabel ${cable.id}: Ziel und Port sind erforderlich.`);
    if (!CABLE_STATUSES.includes(cable.status)) errors.push(`Kabel ${cable.id}: Status ist ungültig.`);
    if (!Array.isArray(cable.trayIds) || cable.trayIds.some(id => !trayIds.has(id))) errors.push(`Kabel ${cable.id}: Trassenreferenz fehlt oder ist ungültig.`);
    if (!Array.isArray(cable.measurements)) errors.push(`Kabel ${cable.id}: Messwertliste ist ungültig.`);
    else {
      const measurementIds = new Set();
      for (const measurement of cable.measurements) {
      if (!record(measurement)) { errors.push(`Kabel ${cable.id}: Messdatensatz ist unvollständig oder ungültig.`); continue; }
      const hasMeasuredAt = measurement.measuredAt !== undefined && measurement.measuredAt !== null && measurement.measuredAt !== "";
      const lengthM = measurementLengthM(measurement);
      if (typeof measurement.id !== "string" || !measurement.id.trim()) errors.push(`Kabel ${cable.id}: Messdatensatz benötigt eine ID.`);
      else if (measurementIds.has(measurement.id)) errors.push(`Kabel ${cable.id}: Messungs-IDs müssen eindeutig sein.`);
      else measurementIds.add(measurement.id);
      if (measurement.device !== undefined && typeof measurement.device !== "string") errors.push(`Kabel ${cable.id}: Messgerät muss Text sein.`);
      if (lengthM !== null && (!Number.isFinite(lengthM) || lengthM < 0)) errors.push(`Kabel ${cable.id}: gemessene Länge ist ungültig.`);
      if (!MEASUREMENT_RESULTS.includes(normalizeMeasurementResult(measurement.result))) errors.push(`Kabel ${cable.id}: Messergebnis ist ungültig.`);
      if (hasMeasuredAt && !Number.isFinite(Date.parse(measurement.measuredAt))) errors.push(`Kabel ${cable.id}: Messdatum ist ungültig.`);
      if (measurement.note !== undefined && typeof measurement.note !== "string") errors.push(`Kabel ${cable.id}: Messnotiz muss Text sein.`);
      }
    }
    if (cable.status === "measured" && Array.isArray(cable.measurements) && cable.measurements.length === 0) errors.push(`Kabel ${cable.id}: Status „gemessen“ benötigt mindestens einen Messdatensatz.`);
  }
  return errors;
}
