/**
 * core/hall/hall-config.v1.js
 * PROJECT-SETUP-01E.1 – Hall Project Seed & Wizard Happy Path
 *
 * Pure hall-domain boundary:
 * - no DOM
 * - no store writes
 * - no localStorage
 * - no Three.js
 */

const HALL_SCHEMA = "baustellenplaner.hall.v1";
const HALL_VERSION = 1;
const EPS = 1e-9;
const WALL_IDS = ["wall:x0", "wall:xMax", "wall:z0", "wall:zMax"];
const ROOF_TYPES = new Set(["flat", "gable", "mono"]);

export const HALL_INDUSTRY_GABLE_V1 = Object.freeze({
  id: "hall_industry_gable_v1",
  version: 1,
  label: "Industriehalle – Satteldach",
  defaults: Object.freeze({
    dimensions: Object.freeze({
      length: 60,
      width: 30,
      eaveHeight: 8,
    }),
    roof: Object.freeze({
      type: "gable",
      peakHeight: 10,
    }),
    grid: Object.freeze({
      longitudinal: Object.freeze({
        mode: "spacing",
        spacing: 5,
      }),
    }),
  }),
});

function isObj(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function numberOrNaN(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (!isObj(value)) return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = clonePlain(item);
  return out;
}

function normalizeWall(wallIn) {
  const src = isObj(wallIn) ? wallIn : {};
  const construction = src.construction === "open" ? "open" : "present";
  const visible = construction === "open" ? false : src.visible !== false;
  return { construction, visible };
}

function defaultWalls() {
  return Object.fromEntries(WALL_IDS.map((id) => [id, { construction: "present", visible: true }]));
}

function createSeed(preset, input) {
  const defaults = isObj(preset?.defaults) ? preset.defaults : {};
  const src = isObj(input) ? input : {};

  const walls = defaultWalls();
  const incomingWalls = src?.envelope?.walls;
  if (isObj(incomingWalls)) {
    for (const id of WALL_IDS) {
      if (isObj(incomingWalls[id])) walls[id] = normalizeWall(incomingWalls[id]);
    }
  }

  return {
    schema: HALL_SCHEMA,
    version: HALL_VERSION,
    id: typeof src.id === "string" && src.id ? src.id : "hall-main",
    presetRef: {
      id: preset?.id || HALL_INDUSTRY_GABLE_V1.id,
      version: Number.isInteger(preset?.version) ? preset.version : HALL_INDUSTRY_GABLE_V1.version,
    },
    coordinateSystem: {
      axisLength: "x",
      axisUp: "y",
      axisWidth: "z",
      origin: "floor-x0-z0",
    },
    transform: {
      position: {
        x: numberOrNaN(src?.transform?.position?.x ?? 0),
        y: numberOrNaN(src?.transform?.position?.y ?? 0),
        z: numberOrNaN(src?.transform?.position?.z ?? 0),
      },
      rotationY: numberOrNaN(src?.transform?.rotationY ?? 0),
    },
    dimensions: {
      length: numberOrNaN(src?.dimensions?.length ?? defaults?.dimensions?.length),
      width: numberOrNaN(src?.dimensions?.width ?? defaults?.dimensions?.width),
      eaveHeight: numberOrNaN(src?.dimensions?.eaveHeight ?? defaults?.dimensions?.eaveHeight),
    },
    roof: {
      type: String(src?.roof?.type ?? defaults?.roof?.type ?? ""),
      peakHeight: src?.roof?.type === "flat"
        ? null
        : numberOrNaN(src?.roof?.peakHeight ?? defaults?.roof?.peakHeight),
    },
    grid: {
      longitudinal: {
        mode: "spacing",
        spacing: numberOrNaN(src?.grid?.longitudinal?.spacing ?? defaults?.grid?.longitudinal?.spacing),
      },
    },
    envelope: { walls },
    structure: {
      columnsEnabled: src?.structure?.columnsEnabled !== false,
      primaryBeamsEnabled: src?.structure?.primaryBeamsEnabled !== false,
    },
    levels: Array.isArray(src.levels) && src.levels.length
      ? clonePlain(src.levels)
      : [{ id: "level:0", elevation: 0, floorId: "floor:0" }],
    openings: Array.isArray(src.openings) ? clonePlain(src.openings) : [],
    partitions: Array.isArray(src.partitions) ? clonePlain(src.partitions) : [],
    elementOverrides: isObj(src.elementOverrides) ? clonePlain(src.elementOverrides) : {},
  };
}

function normalizeStoredSeed(hallIn) {
  const src = isObj(hallIn) ? hallIn : {};
  const walls = {};
  for (const id of WALL_IDS) walls[id] = normalizeWall(src?.envelope?.walls?.[id]);

  return {
    schema: src.schema,
    version: src.version,
    id: src.id,
    presetRef: isObj(src.presetRef) ? clonePlain(src.presetRef) : null,
    coordinateSystem: isObj(src.coordinateSystem) ? clonePlain(src.coordinateSystem) : null,
    transform: {
      position: {
        x: numberOrNaN(src?.transform?.position?.x),
        y: numberOrNaN(src?.transform?.position?.y),
        z: numberOrNaN(src?.transform?.position?.z),
      },
      rotationY: numberOrNaN(src?.transform?.rotationY),
    },
    dimensions: {
      length: numberOrNaN(src?.dimensions?.length),
      width: numberOrNaN(src?.dimensions?.width),
      eaveHeight: numberOrNaN(src?.dimensions?.eaveHeight),
    },
    roof: {
      type: String(src?.roof?.type ?? ""),
      peakHeight: src?.roof?.type === "flat" ? null : numberOrNaN(src?.roof?.peakHeight),
    },
    grid: {
      longitudinal: {
        mode: src?.grid?.longitudinal?.mode,
        spacing: numberOrNaN(src?.grid?.longitudinal?.spacing),
      },
    },
    envelope: { walls },
    structure: {
      columnsEnabled: src?.structure?.columnsEnabled === true,
      primaryBeamsEnabled: src?.structure?.primaryBeamsEnabled === true,
    },
    levels: Array.isArray(src.levels) ? clonePlain(src.levels) : [],
    openings: Array.isArray(src.openings) ? clonePlain(src.openings) : [],
    partitions: Array.isArray(src.partitions) ? clonePlain(src.partitions) : [],
    elementOverrides: isObj(src.elementOverrides) ? clonePlain(src.elementOverrides) : {},
  };
}

function validateAndDerive(hall) {
  const errors = [];
  const warnings = [];
  const { length, width, eaveHeight } = hall.dimensions;
  const roofType = hall.roof.type;
  const peakHeight = hall.roof.peakHeight;
  const spacing = hall.grid.longitudinal.spacing;

  if (hall.schema !== HALL_SCHEMA) errors.push(`Hall schema muss ${HALL_SCHEMA} sein.`);
  if (hall.version !== HALL_VERSION) errors.push(`Hall version muss ${HALL_VERSION} sein.`);
  if (typeof hall.id !== "string" || !hall.id) errors.push("Hall id fehlt.");

  if (!Number.isFinite(length) || length < 1) errors.push("Hallenlänge muss mindestens 1,00 m betragen.");
  if (!Number.isFinite(width) || width < 1) errors.push("Hallenbreite muss mindestens 1,00 m betragen.");
  if (!Number.isFinite(eaveHeight) || eaveHeight < 2) errors.push("Traufhöhe muss mindestens 2,00 m betragen.");

  if (!ROOF_TYPES.has(roofType)) errors.push("Unbekannte Dachform.");
  if ((roofType === "gable" || roofType === "mono") && (!Number.isFinite(peakHeight) || peakHeight <= eaveHeight)) {
    errors.push("First-/Hochpunkthöhe muss über der Traufhöhe liegen.");
  }

  if (hall.grid.longitudinal.mode !== "spacing") errors.push("V1 unterstützt nur Rastermodus spacing.");
  if (!Number.isFinite(spacing) || spacing < 0.5) errors.push("Rastermaß muss mindestens 0,50 m betragen.");
  if (Number.isFinite(length) && Number.isFinite(spacing) && spacing > length) {
    errors.push("Rastermaß darf nicht größer als die Hallenlänge sein.");
  }

  const transformValues = [
    hall.transform.position.x,
    hall.transform.position.y,
    hall.transform.position.z,
    hall.transform.rotationY,
  ];
  if (!transformValues.every(Number.isFinite)) errors.push("Hallentransformation enthält ungültige Zahlenwerte.");

  if (!hall.levels.some((level) => level?.id === "level:0" && Number(level?.elevation) === 0 && level?.floorId === "floor:0")) {
    errors.push("Basisebene level:0 / floor:0 fehlt.");
  }

  let fullBays = 0;
  let remainder = 0;
  let bayCount = 0;
  let axisPositions = [];

  if (Number.isFinite(length) && Number.isFinite(spacing) && length > 0 && spacing > 0 && spacing <= length) {
    fullBays = Math.floor((length + EPS) / spacing);
    remainder = length - fullBays * spacing;
    if (Math.abs(remainder) < EPS) remainder = 0;
    if (remainder < 0 && Math.abs(remainder) < EPS) remainder = 0;

    bayCount = fullBays + (remainder > EPS ? 1 : 0);
    axisPositions = [0];
    for (let i = 1; i <= fullBays; i += 1) axisPositions.push(Math.min(length, i * spacing));
    if (remainder > EPS && Math.abs(axisPositions[axisPositions.length - 1] - length) > EPS) axisPositions.push(length);

    if (remainder > EPS) {
      warnings.push(`Raster geht nicht exakt auf: ${fullBays} × ${spacing.toFixed(2)} m + Restfeld ${remainder.toFixed(2)} m.`);
      if (remainder < spacing * 0.25) {
        warnings.push(`Das letzte Rasterfeld ist mit ${remainder.toFixed(2)} m deutlich kleiner als das Regelraster.`);
      }
    }
  }

  let pitchDeg = 0;
  if (Number.isFinite(width) && Number.isFinite(eaveHeight) && Number.isFinite(peakHeight)) {
    if (roofType === "gable") pitchDeg = Math.atan((peakHeight - eaveHeight) / (width / 2)) * 180 / Math.PI;
    if (roofType === "mono") pitchDeg = Math.atan((peakHeight - eaveHeight) / width) * 180 / Math.PI;
  }

  return {
    errors,
    warnings,
    derived: {
      fullBays,
      remainderBay: remainder,
      bayCount,
      axisPositions,
      pitchDeg,
      ridgeElevation: roofType === "flat" ? eaveHeight : peakHeight,
    },
  };
}

export function normalizeHallConfig(preset = HALL_INDUSTRY_GABLE_V1, wizardInput = {}) {
  const hall = createSeed(preset, wizardInput);
  const result = validateAndDerive(hall);
  return { hall, ...result };
}

/**
 * Reopen boundary. No repository preset is applied here.
 * Invalid stored data is reported instead of silently being replaced by demo defaults.
 */
export function normalizeStoredHall(hallIn) {
  if (!isObj(hallIn)) {
    return {
      hall: hallIn,
      derived: {},
      warnings: [],
      errors: ["Gespeicherte Hallenkonfiguration ist kein Objekt."],
    };
  }

  const hall = normalizeStoredSeed(hallIn);
  const result = validateAndDerive(hall);
  return { hall, ...result };
}
