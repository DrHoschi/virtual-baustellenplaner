// ============================================================================
// DATEI: /core/workarea-assembly-scene-binding.v1.js
// VERSION: v1.0.0
// PATCH: PATCH_workarea_assembly_scene_binding_v1
// STAND: 2026-05-19
//
// ZWECK:
// - Bindet eingefügte Baugruppen sauber an die Workarea-Scene.
// - Ergänzt Assembly-Instanzen um assemblyId, variantId, params, bom und ports.
// - Stellt kleine Helper bereit, damit Param-/BOM-Panels später sauber lesen können.
// - Arbeitet defensiv: Wenn bestehende Instanzen noch alte Struktur haben,
//   werden sie beim nächsten Zugriff sanft migriert.
//
// WICHTIG:
// - Diese Datei ist bewusst als Runtime-Patch gebaut.
// - Sie verändert keine bestehende Architektur hart.
// - Sie hängt sich an window.__BAUSTELLENPLANER_ASSEMBLY_BINDING__.
// ============================================================================

(function installWorkareaAssemblySceneBindingV1() {
  "use strict";

  const VERSION = "v1.0.0-assembly-scene-binding";

  // Mehrfachinstallation verhindern.
  if (window.__BAUSTELLENPLANER_ASSEMBLY_BINDING__?.version === VERSION) {
    return;
  }

  // --------------------------------------------------------------------------
  // Kleine sichere Logger-Hilfe für den vorhandenen Crash Recorder
  // --------------------------------------------------------------------------

  function log(event, payload = {}) {
    try {
      if (typeof window.__bpCrashLog === "function") {
        window.__bpCrashLog(event, payload);
        return;
      }

      if (typeof window.__crashLog === "function") {
        window.__crashLog(event, payload);
        return;
      }

      window.dispatchEvent(
        new CustomEvent("bp:crashlog", {
          detail: {
            event,
            payload,
            ts: Date.now(),
          },
        }),
      );
    } catch {
      // Logging darf nie die App stören.
    }
  }

  // --------------------------------------------------------------------------
  // Master-Katalog für Baugruppen
  // --------------------------------------------------------------------------
  // Dieser Katalog ist bewusst klein, aber strukturiert.
  // Später kann er in registry/project-assets überführt werden.
  // --------------------------------------------------------------------------

  const ASSEMBLY_CATALOG = {
    "assembly.rollerbahn.master": {
      id: "assembly.rollerbahn.master",
      label: "Rollenbahn Master",
      category: "Fördertechnik",
      kind: "roller_conveyor",
      description:
        "Maximal vorbereitete Rollenbahn als intelligente Baugruppe mit Varianten, Stückliste und Anschlussports.",

      defaultSize: {
        w: 5500,
        h: 1200,
      },

      params: {
        name: "RB",
        lengthMm: 5500,
        widthMm: 1200,
        conveyorHeightMm: 550,
        rollerCount: 5,
        driveSide: "left",
        direction: "both",
        hasMovifit: true,
        hasMotor: true,
        hasSensors: true,
      },

      ports: [
        {
          id: "PWR_400V",
          label: "400V Zuleitung",
          type: "power",
          voltage: "400V",
          side: "left",
          x: -2600,
          y: -500,
        },
        {
          id: "MOTOR",
          label: "Motoranschluss",
          type: "motor",
          side: "left",
          x: 2200,
          y: -500,
        },
        {
          id: "MOVIFIT",
          label: "MOVIFIT",
          type: "control",
          side: "left",
          x: 1800,
          y: -700,
        },
        {
          id: "SENSOR_IN",
          label: "Sensor Einlauf",
          type: "sensor",
          side: "right",
          x: -2300,
          y: 600,
        },
        {
          id: "SENSOR_OUT",
          label: "Sensor Auslauf",
          type: "sensor",
          side: "right",
          x: 2300,
          y: 600,
        },
      ],

      bom: [
        {
          id: "rb-frame",
          label: "Grundrahmen Rollenbahn",
          qty: 1,
          unit: "Stk",
          group: "Mechanik",
        },
        {
          id: "rb-roller",
          label: "Tragrolle",
          qty: 5,
          unit: "Stk",
          group: "Mechanik",
        },
        {
          id: "rb-motor",
          label: "SEW Antrieb / Motor",
          qty: 1,
          unit: "Stk",
          group: "Antrieb",
        },
        {
          id: "rb-movifit",
          label: "MOVIFIT",
          qty: 1,
          unit: "Stk",
          group: "Elektrik",
        },
        {
          id: "rb-sensor",
          label: "Sensor",
          qty: 2,
          unit: "Stk",
          group: "Sensorik",
        },
      ],

      variants: {
        max: {
          id: "max",
          label: "Maximalausbau",
          badge: "MAX",
          description:
            "Antrieb, MOVIFIT und Sensorik für beide Richtungen.",
          params: {
            direction: "both",
            driveSide: "left",
            hasMovifit: true,
            hasMotor: true,
            hasSensors: true,
            sensorMode: "both",
          },
        },

        drive_left_one_direction: {
          id: "drive_left_one_direction",
          label: "Antrieb links, eine Richtung",
          badge: "L→",
          description:
            "Typische Rollenbahn mit Antrieb links und Sensorik für eine Förderrichtung.",
          params: {
            direction: "forward",
            driveSide: "left",
            hasMovifit: true,
            hasMotor: true,
            hasSensors: true,
            sensorMode: "one_direction",
          },
        },

        passive: {
          id: "passive",
          label: "Passiv / ohne Antrieb",
          badge: "PASSIV",
          description:
            "Rollenbahn ohne eigenen Antrieb, vorbereitet für spätere Erweiterung.",
          params: {
            direction: "none",
            driveSide: "none",
            hasMovifit: false,
            hasMotor: false,
            hasSensors: false,
            sensorMode: "none",
          },
        },
      },
    },

    "assembly.transferwagen.master": {
      id: "assembly.transferwagen.master",
      label: "Verschiebewagen Master",
      category: "Fördertechnik",
      kind: "transfer_cart",
      description:
        "Verschiebewagen mit Fahrantrieb, Rollenbahnaufsatz, Ports für MOVIPRO/MOVIFIT und Sensorik.",

      defaultSize: {
        w: 5500,
        h: 1800,
      },

      params: {
        name: "VW",
        lengthMm: 5500,
        widthMm: 1800,
        hasTravelDrive: true,
        hasRollerDrive: true,
        controlType: "MOVIPRO",
      },

      ports: [
        {
          id: "PWR_400V",
          label: "400V Zuleitung",
          type: "power",
          side: "left",
          x: -2500,
          y: -800,
        },
        {
          id: "MOVIPRO",
          label: "MOVIPRO",
          type: "control",
          side: "left",
          x: -1800,
          y: -900,
        },
        {
          id: "TRAVEL_MOTOR",
          label: "Fahrantrieb",
          type: "motor",
          side: "bottom",
          x: 0,
          y: 900,
        },
        {
          id: "ROLLER_MOTOR",
          label: "Rollenbahnantrieb",
          type: "motor",
          side: "right",
          x: 2200,
          y: -700,
        },
      ],

      bom: [
        {
          id: "vw-frame",
          label: "Grundrahmen Verschiebewagen",
          qty: 1,
          unit: "Stk",
          group: "Mechanik",
        },
        {
          id: "vw-rail-wheel",
          label: "Fahrwerk / Räder",
          qty: 4,
          unit: "Stk",
          group: "Mechanik",
        },
        {
          id: "vw-travel-drive",
          label: "Fahrantrieb",
          qty: 1,
          unit: "Stk",
          group: "Antrieb",
        },
        {
          id: "vw-roller-drive",
          label: "Rollenbahnantrieb",
          qty: 1,
          unit: "Stk",
          group: "Antrieb",
        },
        {
          id: "vw-movipro",
          label: "MOVIPRO",
          qty: 1,
          unit: "Stk",
          group: "Elektrik",
        },
      ],

      variants: {
        max: {
          id: "max",
          label: "Maximalausbau",
          badge: "MAX",
          params: {
            hasTravelDrive: true,
            hasRollerDrive: true,
            controlType: "MOVIPRO",
          },
        },
      },
    },

    "assembly.lifter.master": {
      id: "assembly.lifter.master",
      label: "Heber Master",
      category: "Fördertechnik",
      kind: "lifter",
      description:
        "Heber mit Rollenbahnaufsatz, Hubantrieb, optionalem Reserveantrieb und Ports.",

      defaultSize: {
        w: 5500,
        h: 1800,
      },

      params: {
        name: "HB",
        lengthMm: 5500,
        widthMm: 1800,
        liftStrokeMm: 1000,
        hasLiftDrive: true,
        hasRollerDrive: true,
        hasReserveDrive: false,
        controlType: "MOVIPRO",
      },

      ports: [
        {
          id: "PWR_400V",
          label: "400V Zuleitung",
          type: "power",
          side: "left",
          x: -2500,
          y: -800,
        },
        {
          id: "MOVIPRO",
          label: "MOVIPRO",
          type: "control",
          side: "left",
          x: -1900,
          y: -900,
        },
        {
          id: "LIFT_MOTOR",
          label: "Hubantrieb",
          type: "motor",
          side: "bottom",
          x: 0,
          y: 900,
        },
        {
          id: "ROLLER_MOTOR",
          label: "Rollenbahnantrieb",
          type: "motor",
          side: "right",
          x: 2200,
          y: -700,
        },
      ],

      bom: [
        {
          id: "hb-frame",
          label: "Grundrahmen Heber",
          qty: 1,
          unit: "Stk",
          group: "Mechanik",
        },
        {
          id: "hb-lift-drive",
          label: "Hubantrieb",
          qty: 1,
          unit: "Stk",
          group: "Antrieb",
        },
        {
          id: "hb-roller-drive",
          label: "Rollenbahnantrieb",
          qty: 1,
          unit: "Stk",
          group: "Antrieb",
        },
        {
          id: "hb-movipro",
          label: "MOVIPRO",
          qty: 1,
          unit: "Stk",
          group: "Elektrik",
        },
      ],

      variants: {
        max: {
          id: "max",
          label: "Maximalausbau",
          badge: "MAX",
          params: {
            hasLiftDrive: true,
            hasRollerDrive: true,
            hasReserveDrive: true,
            controlType: "MOVIPRO",
          },
        },
      },
    },

    "assembly.rollerbogen.master": {
      id: "assembly.rollerbogen.master",
      label: "Rollenbogen Master",
      category: "Fördertechnik",
      kind: "roller_curve",
      description:
        "Kleinerer Fördertechnik-Baustein für Kurvenbereiche und Pufferlayout.",

      defaultSize: {
        w: 2500,
        h: 2500,
      },

      params: {
        name: "RBogen",
        angleDeg: 90,
        radiusMm: 2500,
        hasMotor: false,
      },

      ports: [
        {
          id: "IN",
          label: "Einlauf",
          type: "mechanical_flow",
          side: "left",
          x: -1200,
          y: 0,
        },
        {
          id: "OUT",
          label: "Auslauf",
          type: "mechanical_flow",
          side: "top",
          x: 0,
          y: -1200,
        },
      ],

      bom: [
        {
          id: "bogen-frame",
          label: "Grundrahmen Rollenbogen",
          qty: 1,
          unit: "Stk",
          group: "Mechanik",
        },
        {
          id: "bogen-roller",
          label: "Kurvenrolle",
          qty: 8,
          unit: "Stk",
          group: "Mechanik",
        },
      ],

      variants: {
        max: {
          id: "max",
          label: "Standard 90°",
          badge: "90°",
          params: {
            angleDeg: 90,
            hasMotor: false,
          },
        },
      },
    },
  };

  // --------------------------------------------------------------------------
  // Hilfsfunktionen
  // --------------------------------------------------------------------------

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function uid(prefix = "inst") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  function getAssembly(assemblyId) {
    return ASSEMBLY_CATALOG[assemblyId] || null;
  }

  function getVariant(assembly, variantId) {
    if (!assembly) return null;
    return assembly.variants?.[variantId] || assembly.variants?.max || null;
  }

  function mergeParams(baseParams, variantParams, instanceParams) {
    return {
      ...(baseParams || {}),
      ...(variantParams || {}),
      ...(instanceParams || {}),
    };
  }

  function makeDisplayName(assembly, params, counter) {
    const base = params?.name || assembly?.label || "Baugruppe";
    return `${base} ${counter || ""}`.trim();
  }

  function normalizeAssemblySceneObject(input, options = {}) {
    const assemblyId =
      input?.assemblyId ||
      input?.assembly?.id ||
      options.assemblyId ||
      "assembly.rollerbahn.master";

    const assembly = getAssembly(assemblyId);
    if (!assembly) {
      return input;
    }

    const variantId =
      input?.variantId ||
      input?.variant?.id ||
      options.variantId ||
      "max";

    const variant = getVariant(assembly, variantId);

    const params = mergeParams(
      assembly.params,
      variant?.params,
      input?.params,
    );

    const bom = Array.isArray(input?.bom)
      ? clone(input.bom)
      : clone(assembly.bom || []);

    const ports = Array.isArray(input?.ports)
      ? clone(input.ports)
      : clone(assembly.ports || []);

    const size = {
      w:
        Number(input?.w) ||
        Number(input?.width) ||
        Number(input?.size?.w) ||
        Number(assembly.defaultSize?.w) ||
        1000,
      h:
        Number(input?.h) ||
        Number(input?.height) ||
        Number(input?.size?.h) ||
        Number(assembly.defaultSize?.h) ||
        1000,
    };

    const id = input?.id || uid("asm");

    return {
      ...input,

      id,
      type: "assembly.instance",

      // Kompatibel mit älterer Logik, die asset.instance erwartet:
      legacyType: input?.type || "asset.instance",

      label:
        input?.label ||
        input?.displayName ||
        makeDisplayName(assembly, params, options.counter),

      displayName:
        input?.displayName ||
        input?.label ||
        makeDisplayName(assembly, params, options.counter),

      assemblyId,
      variantId,

      assembly: {
        id: assembly.id,
        label: assembly.label,
        category: assembly.category,
        kind: assembly.kind,
      },

      variant: variant
        ? {
            id: variant.id,
            label: variant.label,
            badge: variant.badge || "",
          }
        : {
            id: variantId,
            label: variantId,
            badge: "",
          },

      params,
      bom,
      ports,

      x: Number(input?.x) || 0,
      y: Number(input?.y) || 0,
      rotation: Number(input?.rotation) || 0,

      w: size.w,
      h: size.h,
      width: size.w,
      height: size.h,
      size,

      meta: {
        ...(input?.meta || {}),
        createdBy: input?.meta?.createdBy || "assembly-scene-binding",
        bindingVersion: VERSION,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  function createAssemblyInstance(assemblyId, variantId, placement = {}) {
    const assembly = getAssembly(assemblyId);
    const variant = getVariant(assembly, variantId);

    if (!assembly || !variant) {
      throw new Error(
        `Unknown assembly/variant: ${assemblyId || "?"} / ${
          variantId || "?"
        }`,
      );
    }

    return normalizeAssemblySceneObject(
      {
        id: uid("asm"),
        x: Number(placement.x) || 0,
        y: Number(placement.y) || 0,
        rotation: Number(placement.rotation) || 0,
        assemblyId,
        variantId,
      },
      {
        assemblyId,
        variantId,
      },
    );
  }

  function isAssemblyObject(obj) {
    return Boolean(
      obj &&
        (obj.type === "assembly.instance" ||
          obj.assemblyId ||
          obj.assembly?.id),
    );
  }

  function getBomForObject(obj) {
    const normalized = normalizeAssemblySceneObject(obj);
    return Array.isArray(normalized?.bom) ? normalized.bom : [];
  }

  function getPortsForObject(obj) {
    const normalized = normalizeAssemblySceneObject(obj);
    return Array.isArray(normalized?.ports) ? normalized.ports : [];
  }

  function getParamsForObject(obj) {
    const normalized = normalizeAssemblySceneObject(obj);
    return normalized?.params || {};
  }

  // --------------------------------------------------------------------------
  // Scene-Migration
  // --------------------------------------------------------------------------

  function migrateSceneObjects(objects) {
    if (!Array.isArray(objects)) {
      return {
        changed: false,
        objects,
      };
    }

    let changed = false;

    const migrated = objects.map((obj) => {
      if (!isAssemblyObject(obj)) {
        return obj;
      }

      const normalized = normalizeAssemblySceneObject(obj);

      if (normalized !== obj) {
        changed = true;
      }

      if (obj.type !== normalized.type) {
        changed = true;
      }

      return normalized;
    });

    return {
      changed,
      objects: migrated,
    };
  }

  // --------------------------------------------------------------------------
  // Store-Helfer
  // --------------------------------------------------------------------------
  // Diese Funktionen sind bewusst tolerant, weil der Store im Projekt je nach
  // Patch-Stand unterschiedlich erreichbar sein kann.
  // --------------------------------------------------------------------------

  function getAppStoreSnapshot() {
    try {
      const store = window.app?.store || window.store || window.__store;
      if (store && typeof store.snapshot === "function") {
        return store.snapshot();
      }
      if (store && typeof store.getState === "function") {
        return store.getState();
      }
    } catch {
      // ignorieren
    }

    return null;
  }

  function findSceneArray(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return null;

    const candidates = [
      snapshot?.project?.scene?.objects,
      snapshot?.project?.workarea?.scene?.objects,
      snapshot?.settings?.workarea?.scene?.objects,
      snapshot?.ui?.workarea?.scene?.objects,
      snapshot?.workarea?.scene?.objects,
      snapshot?.scene?.objects,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }

    return null;
  }

  function emitSceneChange(reason = "assembly-binding") {
    try {
      window.dispatchEvent(
        new CustomEvent("workarea:scene:changed", {
          detail: {
            reason,
            source: "assembly-scene-binding",
            version: VERSION,
          },
        }),
      );
    } catch {
      // ignorieren
    }

    try {
      window.dispatchEvent(
        new CustomEvent("ui:project:save", {
          detail: {
            reason,
            source: "assembly-scene-binding",
            version: VERSION,
          },
        }),
      );
    } catch {
      // ignorieren
    }
  }

  // --------------------------------------------------------------------------
  // Globale API
  // --------------------------------------------------------------------------

  const api = {
    version: VERSION,
    catalog: ASSEMBLY_CATALOG,

    getAssembly,
    getVariant,
    createAssemblyInstance,
    normalizeAssemblySceneObject,
    migrateSceneObjects,

    isAssemblyObject,
    getBomForObject,
    getPortsForObject,
    getParamsForObject,

    getAppStoreSnapshot,
    findSceneArray,
    emitSceneChange,
  };

  window.__BAUSTELLENPLANER_ASSEMBLY_BINDING__ = api;

  log("workarea:assembly-scene-binding:ready", {
    version: VERSION,
    assemblies: Object.keys(ASSEMBLY_CATALOG).length,
  });
})();
