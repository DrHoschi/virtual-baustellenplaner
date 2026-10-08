/*
 * =====================================================================
 * DATEI: /modules/workarea/workarea-assembly-catalog.v1.js
 * VERSION: v1.2.0-assembly-catalog-rollenbock-qf-sh-eh
 * STAND: 2026-05-19
 * PATCH: PATCH_workarea_assembly_place_mode_fix_v1_EH
 *
 * ZWECK:
 * - Zentraler Katalog für intelligente Baugruppen im Baustellenplaner.
 * - Enthält erste Master-Baugruppen für KP 62 Pufferspeicher Audi:
 *   Rollenbahn, Rollenbock, Verschiebewagen, Heber, Querkette, Scherenhubtisch und Exzenterhubtisch.
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
  version: "1.2.0-rollenbock-qf-sh-eh",
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
        name: "HE-NEU",
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
          id: "he-max",
          title: "Maximalausbau",
          badge: "MAX",
          description: "Hubantrieb, Reserveantrieb, Rollenbahnaufsatz und Positionssensorik.",
          patchConfig: { mainDrive: true, reserveDrive: true, movipro: true },
          bom: [
            { code: "MECH-HE-FRAME", title: "Heber Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "DRV-HE-MAIN", title: "Hubantrieb Hauptantrieb", qty: 1, unit: "Stk", group: "Antrieb" },
            { code: "DRV-HE-RES", title: "Hubantrieb Reserve", qty: 1, unit: "Stk", group: "Antrieb" },
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
      id: "roller-block-master",
      title: "Rollenbock Master",
      shortTitle: "Rollenbock",
      group: "Fördertechnik",
      icon: "▤",
      description:
        "Kleiner Rollenbahn-Baustein / Rollenbock, der später namentlich einer großen Rollenbahn zugeordnet werden kann.",
      defaultSize: { w: 1600, h: 1400 },
      defaultConfig: {
        name: "RB-NEU",
        area: "+A",
        conveyorGroup: "FG-0000",
        parentRollerConveyor: "",
        lengthMm: 1600,
        widthMm: 1400,
        transportHeightMm: 550,
        sensorPackage: "none",
        driveSide: "none",
        scale: 1
      },
      variants: [
        {
          id: "rbock-mechanical",
          title: "Rollenbock nur Mechanik",
          badge: "RB",
          description: "Kurzer mechanischer Rollenbock ohne eigene Elektroausstattung.",
          patchConfig: { sensorPackage: "none", driveSide: "none" },
          bom: [
            { code: "MECH-RBOCK-FRAME", title: "Rollenbock Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "MECH-ROLLER-SHORT", title: "Kurzer Tragrollensatz", qty: 1, unit: "Satz", group: "Mechanik" }
          ]
        },
        {
          id: "rbock-sensor-ready",
          title: "Rollenbock mit Sensorvorbereitung",
          badge: "SEN",
          description: "Rollenbock mit vorbereiteten Sensorports, aber ohne eigenen Antrieb.",
          patchConfig: { sensorPackage: "one-direction", driveSide: "none" },
          bom: [
            { code: "MECH-RBOCK-FRAME", title: "Rollenbock Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "MECH-ROLLER-SHORT", title: "Kurzer Tragrollensatz", qty: 1, unit: "Satz", group: "Mechanik" },
            { code: "SEN-STOP", title: "Sensor Stop", qty: 1, unit: "Stk", group: "Sensorik" },
            { code: "SEN-SLOWFAST", title: "Sensor Schnell/Langsam", qty: 1, unit: "Stk", group: "Sensorik" }
          ]
        }
      ],
      ports: [
        { id: "sen-stop-a", title: "Sensor Stop A", kind: "sensor", side: "front", x: -0.35, y: 0.46 },
        { id: "sen-slowfast-a", title: "Sensor Schnell/Langsam A", kind: "sensor", side: "front", x: -0.25, y: 0.46 }
      ]
    },

    {
      id: "cross-chain-master",
      title: "Querkette Master",
      shortTitle: "Querkette",
      group: "Fördertechnik",
      icon: "═",
      description: "Querkette / Querförderer als Baugruppe mit Antrieb, Sensorik und vorbereiteten Ports.",
      defaultSize: { w: 3000, h: 1800 },
      defaultConfig: {
        name: "QF-NEU",
        area: "+A",
        conveyorGroup: "FG-0000",
        lengthMm: 3000,
        widthMm: 1800,
        driveSide: "left",
        direction: "cross",
        movifit: true,
        sensorPackage: "one-direction",
        scale: 1
      },
      variants: [
        {
          id: "qf-max",
          title: "Maximalausbau",
          badge: "MAX",
          description: "Querkette mit Antrieb, MOVIFIT und Sensorik.",
          patchConfig: { movifit: true, sensorPackage: "one-direction" },
          bom: [
            { code: "MECH-QF-FRAME", title: "Querkette Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "MECH-QF-CHAIN", title: "Kettensatz Querförderer", qty: 1, unit: "Satz", group: "Mechanik" },
            { code: "DRV-QF-MOTOR", title: "Querkette Antrieb", qty: 1, unit: "Stk", group: "Antrieb" },
            { code: "EL-MOVIFIT", title: "MOVIFIT / dezentrale Ansteuerung", qty: 1, unit: "Stk", group: "Elektro" },
            { code: "SEN-STOP", title: "Sensor Stop", qty: 1, unit: "Stk", group: "Sensorik" }
          ]
        },
        {
          id: "qf-mechanical-only",
          title: "Nur Mechanik",
          badge: "MECH",
          description: "Querkette als mechanischer Platzhalter ohne Elektroausstattung.",
          patchConfig: { movifit: false, sensorPackage: "none" },
          bom: [
            { code: "MECH-QF-FRAME", title: "Querkette Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "MECH-QF-CHAIN", title: "Kettensatz Querförderer", qty: 1, unit: "Satz", group: "Mechanik" }
          ]
        }
      ],
      ports: [
        { id: "pwr-400v", title: "400 V Einspeisung", kind: "power", side: "left", x: -0.45, y: -0.40 },
        { id: "bus", title: "Bus / Netzwerk", kind: "network", side: "left", x: -0.45, y: -0.25 },
        { id: "motor", title: "Querkette Antrieb", kind: "motor", side: "drive", x: 0.35, y: -0.42 },
        { id: "sen-stop-a", title: "Sensor Stop", kind: "sensor", side: "front", x: -0.25, y: 0.46 }
      ]
    },

    {
      id: "scissor-lift-table-master",
      title: "Scherenhubtisch Master",
      shortTitle: "Scherenhubtisch",
      group: "Fördertechnik",
      icon: "⇳",
      description: "Scherenhubtisch als Baugruppe mit Hubantrieb, Hydraulik/Antriebseinheit, Sensorik und Ports.",
      defaultSize: { w: 3200, h: 2200 },
      defaultConfig: {
        name: "SH-NEU",
        area: "+A",
        conveyorGroup: "FG-0000",
        lengthMm: 3200,
        widthMm: 2200,
        liftHeightMm: 900,
        driveType: "hydraulic",
        movipro: true,
        sensorPackage: "lift-positions",
        scale: 1
      },
      variants: [
        {
          id: "sh-max",
          title: "Maximalausbau",
          badge: "MAX",
          description: "Scherenhubtisch mit Hubantrieb, Steuerung und Endlagensensorik.",
          patchConfig: { movipro: true, sensorPackage: "lift-positions" },
          bom: [
            { code: "MECH-SH-FRAME", title: "Scherenhubtisch Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "DRV-SH-LIFT", title: "Scherenhubtisch Hubantrieb", qty: 1, unit: "Stk", group: "Antrieb" },
            { code: "EL-MOVIPRO", title: "MOVIPRO / Hubtischsteuerung", qty: 1, unit: "Stk", group: "Elektro" },
            { code: "SEN-LIFT-POS", title: "Hub-Positionssensorik", qty: 2, unit: "Stk", group: "Sensorik" }
          ]
        },
        {
          id: "sh-mechanical-only",
          title: "Nur Mechanik",
          badge: "MECH",
          description: "Scherenhubtisch als mechanischer Platzhalter ohne Elektroausstattung.",
          patchConfig: { movipro: false, sensorPackage: "none" },
          bom: [
            { code: "MECH-SH-FRAME", title: "Scherenhubtisch Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" }
          ]
        }
      ],
      ports: [
        { id: "pwr-400v", title: "400 V Einspeisung", kind: "power", side: "left", x: -0.45, y: -0.40 },
        { id: "bus", title: "Bus / Netzwerk", kind: "network", side: "left", x: -0.45, y: -0.25 },
        { id: "lift-drive", title: "Hubantrieb", kind: "motor", side: "top", x: 0.35, y: -0.45 },
        { id: "lift-top", title: "Endlage oben", kind: "sensor", side: "right", x: 0.48, y: -0.20 },
        { id: "lift-bottom", title: "Endlage unten", kind: "sensor", side: "right", x: 0.48, y: 0.20 }
      ]
    },

    {
      id: "eccentric-lift-table-master",
      title: "Exzenterhubtisch Master",
      shortTitle: "Exzenterhubtisch",
      group: "Fördertechnik",
      icon: "⟲",
      description: "Exzenterhubtisch als Baugruppe mit Exzenterantrieb, Steuerung und Endlagen-/Positionssensorik.",
      defaultSize: { w: 3200, h: 2200 },
      defaultConfig: {
        name: "EH-NEU",
        area: "+A",
        conveyorGroup: "FG-0000",
        lengthMm: 3200,
        widthMm: 2200,
        liftHeightMm: 450,
        driveType: "eccentric",
        movipro: true,
        sensorPackage: "lift-positions",
        scale: 1
      },
      variants: [
        {
          id: "eh-max",
          title: "Maximalausbau",
          badge: "MAX",
          description: "Exzenterhubtisch mit Antrieb, Steuerung und Endlagen-/Positionssensorik.",
          patchConfig: { movipro: true, sensorPackage: "lift-positions" },
          bom: [
            { code: "MECH-EH-FRAME", title: "Exzenterhubtisch Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" },
            { code: "DRV-EH-LIFT", title: "Exzenterhubtisch Hubantrieb", qty: 1, unit: "Stk", group: "Antrieb" },
            { code: "EL-MOVIPRO", title: "MOVIPRO / Hubtischsteuerung", qty: 1, unit: "Stk", group: "Elektro" },
            { code: "SEN-LIFT-POS", title: "Hub-Positionssensorik", qty: 2, unit: "Stk", group: "Sensorik" }
          ]
        },
        {
          id: "eh-mechanical-only",
          title: "Nur Mechanik",
          badge: "MECH",
          description: "Exzenterhubtisch als mechanischer Platzhalter ohne Elektroausstattung.",
          patchConfig: { movipro: false, sensorPackage: "none" },
          bom: [
            { code: "MECH-EH-FRAME", title: "Exzenterhubtisch Grundrahmen", qty: 1, unit: "Stk", group: "Mechanik" }
          ]
        }
      ],
      ports: [
        { id: "pwr-400v", title: "400 V Einspeisung", kind: "power", side: "left", x: -0.45, y: -0.40 },
        { id: "bus", title: "Bus / Netzwerk", kind: "network", side: "left", x: -0.45, y: -0.25 },
        { id: "lift-drive", title: "Exzenterantrieb", kind: "motor", side: "top", x: 0.35, y: -0.45 },
        { id: "lift-top", title: "Endlage oben", kind: "sensor", side: "right", x: 0.48, y: -0.20 },
        { id: "lift-bottom", title: "Endlage unten", kind: "sensor", side: "right", x: 0.48, y: 0.20 }
      ]
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
