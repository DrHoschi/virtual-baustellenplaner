const UNITS_TO_MM = Object.freeze({ mm: 1, cm: 10, m: 1000 });

export function distancePixels(a, b) {
  if (![a?.x, a?.y, b?.x, b?.y].every(Number.isFinite)) throw new Error("Referenzpunkte müssen gültige Bildkoordinaten sein.");
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function toMillimeters(value, unit = "m") {
  if (!Number.isFinite(value) || value <= 0 || !UNITS_TO_MM[unit]) throw new Error("Reale Strecke und Einheit sind ungültig.");
  return value * UNITS_TO_MM[unit];
}

export function calibratePlan({ pointA, pointB, realDistance, unit = "m", widthPx, heightPx }) {
  if (!Number.isInteger(widthPx) || widthPx <= 0 || !Number.isInteger(heightPx) || heightPx <= 0) throw new Error("Grundrissbild hat keine gültige Größe.");
  for (const point of [pointA, pointB]) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y) || point.x < 0 || point.y < 0 || point.x > widthPx || point.y > heightPx) throw new Error("Kalibrierpunkt liegt außerhalb des Grundrissbildes.");
  }
  const pixelDistance = distancePixels(pointA, pointB);
  if (pixelDistance < 1) throw new Error("Die beiden Kalibrierpunkte müssen getrennt sein.");
  const realDistanceMm = toMillimeters(realDistance, unit);
  return {
    pixelPoints: [{ x: pointA.x, y: pointA.y }, { x: pointB.x, y: pointB.y }],
    pixelDistance,
    realDistanceMm,
    scaleMmPerPixel: realDistanceMm / pixelDistance,
    calibratedAt: new Date().toISOString(),
  };
}

export function measurePlanDistanceMm(a, b, calibration) {
  if (!(Number.isFinite(calibration?.scaleMmPerPixel) && calibration.scaleMmPerPixel > 0)) throw new Error("Grundriss ist nicht kalibriert.");
  return distancePixels(a, b) * calibration.scaleMmPerPixel;
}

export function pixelToProjectMm(point, calibration) {
  if (!(Number.isFinite(calibration?.scaleMmPerPixel) && calibration.scaleMmPerPixel > 0)) throw new Error("Grundriss ist nicht kalibriert.");
  const [origin] = calibration.pixelPoints;
  return { x: (point.x - origin.x) * calibration.scaleMmPerPixel, y: -(point.y - origin.y) * calibration.scaleMmPerPixel, z: 0 };
}
