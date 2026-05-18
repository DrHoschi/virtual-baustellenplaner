/*
 * =====================================================================
 * DATEI: /core/workarea-assembly-catalog.v1.js
 * VERSION: v1.0.0-assembly-catalog
 * STAND: 2026-05-18
 * PATCH: PATCH_workarea_assembly_insert_and_variant_panel_v1
 *
 * ZWECK:
 * - Zentraler Katalog für intelligente Baugruppen im Baustellenplaner.
 * - Enthält erste Master-Baugruppen für KP 62 Pufferspeicher Audi:
 *   Rollenbahn, Verschiebewagen, Heber und Rollenbogen.
 * - Jede Baugruppe besitzt Varianten, Stücklistenpositionen und Ports.
 *
 * WICHTIG:
 * - Diese Datei ist absichtlich ohne externe Abhängigkeiten gebaut.
 * - Sie darf von UI, Workarea, Export/Import und später vom Kabel-/BOM-Modul
 *   gleichermaßen verwendet werden.
 * =====================================================================
 */

// ---------------------------------------------------------------------
// Kleine Hilfsfunktionen
// ---------------------------------------------------------------------

/**
 * Erzeugt eine robuste Kopie für reine Datenobjekte.
 * Keine Klassen, keine Funktionen, nur JSON-taugliche Daten.
 */
export function cloneDeep(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * Erzeugt eine einfache, browserkompatible ID.
 * crypto.randomUUID ist auf älteren iOS/Safari-Ständen nicht immer sicher.
 */
export function makeAssemblyId(prefix = "asm") {
  const rnd = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}-${time}-${rnd}`;
}

/**
 * Normalisiert Zahlenwerte, damit keine NaN-Werte in den Store gelangen.
 */
function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------
// Baugruppen-Katalog
// ---------------------------------------------------------------------

/**
 * Zentrale Baugruppen-Definitionen.
 *
 * Begriffe:
 * - template: Grundtyp, z. B. Rollenbahn.
 * - variant: konkrete Konfiguration, z. B. Antrieb links + Sensoren rechts.
 * - bom: Stücklistenpositionen.
 * - ports: spätere Anschluss-/Verbindungspunkte für Motor, Sensorik, 400 V,
 *   Bus/Netzwerk usw.
 */
export const ASSEMBLY_CATALOG = {
  schema: "baustellenplaner.assembly.catalog.v1",
  version: "1.0.0",
  domain: "KP 62 Pufferspeicher Audi",

  templates: [
    {
      id: "roller-conveyor-master",
      title: "Rollenbahn Master",
      shortTitle: "Rollenbahn",
      group: "Fördertechnik",
      icon: "▤",
      description:
        "Maximal vorbereitete Rollenbahn als intelligente Baugruppe mit Varianten, Stückliste und Anschlussports.",
      defaultSize: { w: 5500, h: 1400 },
      defaultConfig: {
        name: "RB-NEU",
        area: "+A",
        conveyorGroup: "FG-0000",
        lengthMm: 5500,
        widthMm: 1400,
        transportHeightMm: 550,
        driveSide: "left",
        direction: "forward",
        sensorPackage: "both-directions",
        movifit: true,
        maintenanceSwitch: false,
        scale: 1
      },
      variants: [
        {
          id: "rb-max",
          title: "Maximalausbau",
          badge: "MAX",
          description: "Antrieb, MOVIFIT, Sensorik für beide Richtungen, vorbereitete Anschlussports.",
          patchConfig: {
            driveSide: "left",
            direction: "both",
            sensorPackage: "both-directions",
            movifit: true,
            maintenanceSwitch: true
          },
          bom: [
            { code: "MECH-RB-FRAME", title: "Rollenbahn Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "MECH-ROLLER", title: "Tragrollen Satz", qty: 5, unit: "Stk", group: "Mechanik" },
            { code: "DRV-SEW-MOTOR", title: "SEW Getriebemotor", qty: 1, unit: "Stk", group: "Antrieb" },
            { code: "DRV-BELT", title: "Riemenantrieb / Zahnriemen", qty: 1, unit: "Satz", group: "Antrieb" },
            { code: "EL-MOVIFIT", title: "MOVIFIT / dezentrale Ansteuerung", qty: 1, unit: "Stk", group: "Elektro" },
            { code: "SEN-STOP", title: "Sensor Stop", qty: 2, unit: "Stk", group: "Sensorik" },
            { code: "SEN-SLOWFAST", title: "Sensor Schnell/Langsam", qty: 2, unit: "Stk", group: "Sensorik" },
            { code: "EL-MS", title: "Wartungsschalter 400 V", qty: 1, unit: "Stk", group: "Elektro" }
          ]
        },
        {
          id: "rb-drive-left-one-way",
          title: "Antrieb links, eine Richtung",
          badge: "L→",
          description: "Typische Rollenbahn mit Antrieb links und Sensorik für eine Förderrichtung.",
          patchConfig: {
            driveSide: "left",
            direction: "forward",
            sensorPackage: "one-direction",
            movifit: true,
            maintenanceSwitch: false
          },
          bom: [
            { code: "MECH-RB-FRAME", title: "Rollenbahn Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "MECH-ROLLER", title: "Tragrollen Satz", qty: 5, unit: "Stk", group: "Mechanik" },
            { code: "DRV-SEW-MOTOR", title: "SEW Getriebemotor", qty: 1, unit: "Stk", group: "Antrieb" },
            { code: "EL-MOVIFIT", title: "MOVIFIT / dezentrale Ansteuerung", qty: 1, unit: "Stk", group: "Elektro" },
            { code: "SEN-STOP", title: "Sensor Stop", qty: 1, unit: "Stk", group: "Sensorik" },
            { code: "SEN-SLOWFAST", title: "Sensor Schnell/Langsam", qty: 1, unit: "Stk", group: "Sensorik" }
          ]
        },
        {
          id: "rb-drive-right-one-way",
          title: "Antrieb rechts, eine Richtung",
          badge: "R→",
          description: "Wie Standard, aber Motor-/Riemenseite gespiegelt.",
          patchConfig: {
            driveSide: "right",
            direction: "forward",
            sensorPackage: "one-direction",
            movifit: true,
            maintenanceSwitch: false
          },
          bom: [
            { code: "MECH-RB-FRAME", title: "Rollenbahn Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "MECH-ROLLER", title: "Tragrollen Satz", qty: 5, unit: "Stk", group: "Mechanik" },
            { code: "DRV-SEW-MOTOR", title: "SEW Getriebemotor", qty: 1, unit: "Stk", group: "Antrieb" },
            { code: "EL-MOVIFIT", title: "MOVIFIT / dezentrale Ansteuerung", qty: 1, unit: "Stk", group: "Elektro" },
            { code: "SEN-STOP", title: "Sensor Stop", qty: 1, unit: "Stk", group: "Sensorik" },
            { code: "SEN-SLOWFAST", title: "Sensor Schnell/Langsam", qty: 1, unit: "Stk", group: "Sensorik" }
          ]
        },
        {
          id: "rb-mechanical-only",
          title: "Nur Mechanik",
          badge: "MECH",
          description: "Rollenbahn ohne elektrische Ausstattung, gut als Grundstock oder Platzhalter.",
          patchConfig: {
            driveSide: "none",
            direction: "none",
            sensorPackage: "none",
            movifit: false,
            maintenanceSwitch: false
          },
          bom: [
            { code: "MECH-RB-FRAME", title: "Rollenbahn Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "MECH-ROLLER", title: "Tragrollen Satz", qty: 5, unit: "Stk", group: "Mechanik" }
          ]
        }
      ],
      ports: [
        { id: "pwr-400v", title: "400 V Einspeisung", kind: "power", side: "left", x: -0.45, y: -0.42 },
        { id: "bus", title: "Bus / Netzwerk", kind: "network", side: "left", x: -0.45, y: -0.28 },
        { id: "motor", title: "Motor", kind: "motor", side: "drive", x: 0.38, y: -0.42 },
        { id: "sen-stop-a", title: "Sensor Stop A", kind: "sensor", side: "front", x: -0.35, y: 0.46 },
        { id: "sen-slowfast-a", title: "Sensor Schnell/Langsam A", kind: "sensor", side: "front", x: -0.25, y: 0.46 },
        { id: "sen-stop-b", title: "Sensor Stop B", kind: "sensor", side: "rear", x: 0.35, y: -0.46 },
        { id: "sen-slowfast-b", title: "Sensor Schnell/Langsam B", kind: "sensor", side: "rear", x: 0.25, y: -0.46 }
      ]
    },

    {
      id: "transfer-cart-master",
      title: "Verschiebewagen Master",
      shortTitle: "Verschiebewagen",
      group: "Fördertechnik",
      icon: "⇄",
      description: "Verschiebewagen mit Fahrantrieb, Rollenbahnaufsatz, Ports für MOVIPRO/MOVIFIT und Sensorik.",
      defaultSize: { w: 5500, h: 2500 },
      defaultConfig: {
        name: "VW-NEU",
        area: "+A",
        conveyorGroup: "FG-0000",
        lengthMm: 5500,
        widthMm: 2500,
        driveSide: "left",
        railDirection: "x",
        movipro: true,
        sensorPackage: "positioning",
        scale: 1
      },
      variants: [
        {
          id: "vw-max",
          title: "Maximalausbau",
          badge: "MAX",
          description: "Fahrantrieb, Rollenbahnaufsatz, Positionserfassung und vorbereitete Elektroports.",
          patchConfig: { movipro: true, sensorPackage: "positioning" },
          bom: [
            { code: "MECH-VW-FRAME", title: "Verschiebewagen Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "MECH-VW-RAIL", title: "Schienen / Fahrweg", qty: 1, unit: "Satz", group: "Mechanik" },
            { code: "DRV-VW-DRIVE", title: "Fahrantrieb", qty: 1, unit: "Stk", group: "Antrieb" },
            { code: "EL-MOVIPRO", title: "MOVIPRO / Fahrwagensteuerung", qty: 1, unit: "Stk", group: "Elektro" },
            { code: "SEN-POS", title: "Positionssensorik", qty: 2, unit: "Stk", group: "Sensorik" }
          ]
        }
      ],
      ports: [
        { id: "pwr-400v", title: "400 V Einspeisung", kind: "power", side: "left", x: -0.45, y: -0.40 },
        { id: "bus", title: "Bus / Netzwerk", kind: "network", side: "left", x: -0.45, y: -0.25 },
        { id: "drive-travel", title: "Fahrantrieb", kind: "motor", side: "left", x: -0.35, y: 0.42 },
        { id: "pos-a", title: "Position A", kind: "sensor", side: "front", x: -0.25, y: 0.48 },
        { id: "pos-b", title: "Position B", kind: "sensor", side: "rear", x: 0.25, y: -0.48 }
      ]
    },

    {
      id: "lifter-master",
      title: "Heber Master",
      shortTitle: "Heber",
      group: "Fördertechnik",
      icon: "↕",
      description: "Heber mit Rollenbahnaufsatz, Hubantrieb, optionalem Reserveantrieb und Ports.",
      defaultSize: { w: 5500, h: 3000 },
      defaultConfig: {
        name: "HB-NEU",
        area: "+A",
        conveyorGroup: "FG-0000",
        lengthMm: 5500,
        widthMm: 3000,
        liftHeightMm: 1200,
        mainDrive: true,
        reserveDrive: true,
        movipro: true,
        scale: 1
      },
      variants: [
        {
          id: "hb-max",
          title: "Maximalausbau",
          badge: "MAX",
          description: "Hubantrieb, Reserveantrieb, Rollenbahnaufsatz und Positionssensorik.",
          patchConfig: { mainDrive: true, reserveDrive: true, movipro: true },
          bom: [
            { code: "MECH-HB-FRAME", title: "Heber Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "DRV-HB-MAIN", title: "Hubantrieb Hauptantrieb", qty: 1, unit: "Stk", group: "Antrieb" },
            { code: "DRV-HB-RES", title: "Hubantrieb Reserve", qty: 1, unit: "Stk", group: "Antrieb" },
            { code: "EL-MOVIPRO", title: "MOVIPRO / Hebersteuerung", qty: 1, unit: "Stk", group: "Elektro" },
            { code: "SEN-LIFT-POS", title: "Hub-Positionssensorik", qty: 2, unit: "Stk", group: "Sensorik" }
          ]
        }
      ],
      ports: [
        { id: "pwr-400v", title: "400 V Einspeisung", kind: "power", side: "left", x: -0.45, y: -0.40 },
        { id: "bus", title: "Bus / Netzwerk", kind: "network", side: "left", x: -0.45, y: -0.25 },
        { id: "lift-main", title: "Hubantrieb Haupt", kind: "motor", side: "top", x: 0.35, y: -0.45 },
        { id: "lift-reserve", title: "Hubantrieb Reserve", kind: "motor", side: "top", x: 0.15, y: -0.45 },
        { id: "lift-top", title: "Endlage oben", kind: "sensor", side: "right", x: 0.48, y: -0.20 },
        { id: "lift-bottom", title: "Endlage unten", kind: "sensor", side: "right", x: 0.48, y: 0.20 }
      ]
    },

    {
      id: "roller-curve-master",
      title: "Rollenbogen Master",
      shortTitle: "Rollenbogen",
      group: "Fördertechnik",
      icon: "◜",
      description: "Kleinerer Fördertechnik-Baustein für Kurvenbereiche und Pufferlayout.",
      defaultSize: { w: 2500, h: 2500 },
      defaultConfig: {
        name: "RBogen-NEU",
        area: "+A",
        conveyorGroup: "FG-0000",
        angleDeg: 90,
        sensorPackage: "none",
        scale: 1
      },
      variants: [
        {
          id: "bogen-90-mech",
          title: "90° nur Mechanik",
          badge: "90°",
          description: "Mechanischer Rollenbogen ohne Elektroausstattung.",
          patchConfig: { angleDeg: 90, sensorPackage: "none" },
          bom: [
            { code: "MECH-BOGEN-90", title: "Rollenbogen 90°", qty: 1, unit: "Stk", group: "Mechanik" }
          ]
        }
      ],
      ports: []
    }
  ]
};

// ---------------------------------------------------------------------
// Katalog-Zugriff
// ---------------------------------------------------------------------

export function listAssemblyTemplates() {
  return cloneDeep(ASSEMBLY_CATALOG.templates);
}

export function getAssemblyTemplate(templateId) {
  return cloneDeep(ASSEMBLY_CATALOG.templates.find((t) => t.id === templateId) || null);
}

export function getAssemblyVariant(templateId, variantId) {
  const template = ASSEMBLY_CATALOG.templates.find((t) => t.id === templateId);
  if (!template) return null;
  return cloneDeep(template.variants.find((v) => v.id === variantId) || template.variants[0] || null);
}

/**
 * Berechnet die Stückliste für Template + Variante.
 */
export function buildBomLines(templateId, variantId) {
  const variant = getAssemblyVariant(templateId, variantId);
  return cloneDeep(variant?.bom || []);
}

/**
 * Baut eine echte Baugruppen-Instanz für die Workarea.
 * Diese Instanz ist bewusst JSON-tauglich und kann sauber exportiert werden.
 */
export function buildAssemblyInstance({
  templateId,
  variantId,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
  config = {}
} = {}) {
  const template = getAssemblyTemplate(templateId);
  if (!template) {
    throw new Error(`[assembly] Unbekanntes Template: ${templateId}`);
  }

  const variant = getAssemblyVariant(templateId, variantId);
  if (!variant) {
    throw new Error(`[assembly] Unbekannte Variante: ${templateId}/${variantId}`);
  }

  const mergedConfig = {
    ...cloneDeep(template.defaultConfig || {}),
    ...cloneDeep(variant.patchConfig || {}),
    ...cloneDeep(config || {})
  };

  const safeScale = Math.max(0.05, num(mergedConfig.scale ?? scale, 1));
  const baseW = num(template.defaultSize?.w, 1000);
  const baseH = num(template.defaultSize?.h, 1000);

  return {
    schema: "baustellenplaner.workarea.object.assembly.v1",
    type: "assembly.instance",
    id: makeAssemblyId("asm"),
    templateId: template.id,
    templateTitle: template.title,
    variantId: variant.id,
    variantTitle: variant.title,
    name: mergedConfig.name || template.shortTitle || template.title,
    area: mergedConfig.area || "+A",
    conveyorGroup: mergedConfig.conveyorGroup || "FG-0000",

    x: num(x, 0),
    y: num(y, 0),
    rotation: num(rotation, 0),
    scale: safeScale,
    w: num(mergedConfig.lengthMm, baseW) * safeScale,
    h: num(mergedConfig.widthMm, baseH) * safeScale,

    config: mergedConfig,
    bom: buildBomLines(template.id, variant.id),
    ports: cloneDeep(template.ports || []),

    visual: {
      shape: template.id,
      icon: template.icon,
      label: `${mergedConfig.name || template.shortTitle} ${variant.badge || ""}`.trim()
    },

    meta: {
      createdBy: "PATCH_workarea_assembly_insert_and_variant_panel_v1",
      createdAt: new Date().toISOString(),
      catalogVersion: ASSEMBLY_CATALOG.version
    }
  };
}
