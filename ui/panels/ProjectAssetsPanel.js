/**
 * ui/panels/ProjectAssetsPanel.js
 * Version: v1.1.1-project-assets-fix (2026-02-08)
 *
 * Projekt – Projekt-Assets
 * -----------------------------------------------------------------------------
 * Zweck / Idee:
 * - "Projekt-Assets" = die Assets, die ein Projekt konkret verwendet.
 *   (Referenzen + projekt-spezifische PresetTransforms: Scale / RotY / OffsetY ...)
 *
 * WICHTIG (Bugfix):
 * - Die vorherige Version hatte am Dateiende "Methoden" außerhalb der Klasse
 *   (z.B. `_migrateLegacyIfNeeded()` ohne `function` / ohne Klassen-Kontext).
 *   Das ist in JS ein SyntaxError → das Modul lädt nicht → loader bleibt bei "(lädt...)"
 *
 * Diese Datei ist eine saubere, parse-sichere, vollständig kommentierte Version.
 *
 * Abhängigkeiten:
 * - PanelBase (UI-Panel Framework)
 * - ui-dom helper `h()` für DOM-Erstellung
 *
 * Storage:
 * - Wir lesen/schreiben in `store.get("app").project`
 * - Wir speichern Projekt-Assets in `project.projectAssets` (kanonisch).
 * - Migration: Wenn alte Projekte `project.assets` oder `project.project_assets` haben,
 *   wird beim Öffnen einmalig migriert (ohne Datenverlust).
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

// -----------------------------------------------------------------------------
// Konstante Pfade / Legacy-Fallbacks
// -----------------------------------------------------------------------------
/**
 * Kanonischer Zielpfad im Projektobjekt.
 * (Einheitlicher Standard – keine "alten/neuen" Pfade im UI.)
 */
const CANON_PATH = "projectAssets";

/**
 * Slot-Datenmodell (v1)
 * ---------------------------------------------------------------------------
 * Motivation:
 * Ein Projekt-Asset kann mehrere "Varianten" haben (z.B. unterschiedliche GLB-Modelle,
 * LODs, Alternativ-Designs, Hersteller-Varianten ...).
 *
 * Wir speichern diese Varianten als "Slots" innerhalb eines Project-Assets.
 * Jeder Slot kann:
 *  - einen Modell-Ref (später: Import-Link aus AssetLab)
 *  - eigene Transform-Parameter (Scale/RotY/OffsetY)
 *  - eigene Preset-Metadaten (AssetLab-Preset → Projekt) besitzen
 *
 * Abwärtskompatibilität:
 * Frühere Stände hatten Transform- und Preset-Felder direkt am Asset-Root.
 * Beim Rendern normalisieren wir diese Alt-Felder in einen Default-Slot.
 */

function _mkSlotId() {
  // kurze, robuste ID (genug für localStorage)
  return `S-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function _ensureSlots(asset) {
  if (!asset || typeof asset !== "object") return asset;

  // 1) Slots existieren?
  if (!Array.isArray(asset.slots) || asset.slots.length === 0) {
    asset.slots = [
      {
        id: "default",
        name: "Default",
        model: asset.model || null,
        transform: {
          // UI-Felder aus dem Panel (früher am Asset-Root)
          scale: typeof asset.scale === "number" ? asset.scale : 1,
          rotYDeg: typeof asset.rotYDeg === "number" ? asset.rotYDeg : 0,
          offsetY: typeof asset.offsetY === "number" ? asset.offsetY : 0,
        },
        preset: asset.presetTransform || null,
      },
    ];
  }

  // 2) Slot-Felder sicherstellen
  asset.slots.forEach((s) => {
    if (!s.id) s.id = _mkSlotId();
    if (!s.name) s.name = s.id === "default" ? "Default" : `Slot ${s.id.slice(0, 4)}`;
    if (!s.transform) s.transform = { scale: 1, rotYDeg: 0, offsetY: 0 };
    if (typeof s.transform.scale !== "number") s.transform.scale = 1;
    if (typeof s.transform.rotYDeg !== "number") s.transform.rotYDeg = 0;
    if (typeof s.transform.offsetY !== "number") s.transform.offsetY = 0;
    if (typeof s.preset === "undefined") s.preset = null;
    if (typeof s.model === "undefined") s.model = null;

    // Status-Felder (Import/Export)
    if (typeof s.hasModel === "undefined") s.hasModel = !!s.model;
    if (typeof s.lastImportName === "undefined") s.lastImportName = null;
    if (typeof s.updatedAt === "undefined") s.updatedAt = null;
    if (typeof s.lastAction === "undefined") s.lastAction = null;
  });

  // 3) selectedSlot merken (UI-Only, aber im Projekt ok)
  if (!asset.selectedSlotId) asset.selectedSlotId = asset.slots[0]?.id || "default";
  if (!asset.slots.find((s) => s.id === asset.selectedSlotId)) {
    asset.selectedSlotId = asset.slots[0]?.id || "default";
  }

  return asset;
}

function _getSelectedSlot(asset) {
  if (!asset?.slots?.length) return null;
  return asset.slots.find((s) => s.id === asset.selectedSlotId) || asset.slots[0];
}

/**
 * Legacy-Pfade, die wir in der Wildnis gesehen haben.
 * -> Wird beim Öffnen migriert.
 */
const LEGACY_PATHS = [
  "assets",          // ganz alt: project.assets
  "project_assets",  // alt: project.project_assets
];

/**
 * Kleine Helper: robustes, null-sicheres Lesen / Schreiben in project-object.
 * Wir wollen NICHT abhängig von einer Store-Implementation sein.
 */
function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return obj[path];
}
function setByPath(obj, path, value) {
  if (!obj || !path) return;
  obj[path] = value;
}

/**
 * Simple ID-Generator für Projekt-Assets (kein Crypto nötig).
 */
function makeId(prefix = "PA") {
  return `${prefix}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

// -----------------------------------------------------------------------------
// Panel
// -----------------------------------------------------------------------------
export class ProjectAssetsPanel extends PanelBase {
  // ---------------------------------------------------------------------------
  // Panel Metas
  // ---------------------------------------------------------------------------
  getTitle() {
    return "Projekt – Projekt-Assets";
  }

  getDescription() {
    const pid = this.store.get("app")?.project?.id || "";
    return pid ? `Assets im Projekt: ${pid}` : "";
  }

  /**
   * Wir benutzen kein Apply/Reset, weil wir hier bewusst "direkt" speichern
   * (jede Änderung sync't sofort ins Projektobjekt).
   */
  getToolbarConfig() {
    return {
      showApply: false,
      showReset: false,
      note: "Projekt-Assets = im Projekt verwendete Assets (Referenz + PresetTransform).",
    };
  }

  // ---------------------------------------------------------------------------
  // Draft (aus Store)
  // ---------------------------------------------------------------------------
  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const project = app.project || {};
    const settingsProjectAssets = app?.settings?.projectAssets || null;

    // 1) Migration (einmalig) – damit alte Projekte nicht leer/kaputt wirken
    this._migrateLegacyIfNeeded(project);

    // 2) Draft erzeugen (kopieren wir bewusst NICHT tief – wir arbeiten panel-lokal)
    const projectAssets = getByPath(project, CANON_PATH) || settingsProjectAssets || [];

    return {
      projectId: project?.id || "unknown",
      projectAssets: Array.isArray(projectAssets) ? projectAssets : [],
    };
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  renderBody(root, draft) {
    const project = this.store.get("app")?.project || {};
    const pid = draft?.projectId || project?.id || "unknown";

    // Lokale Helper: "dirty" + "sync"
    let _dirty = false;

    const dirty = () => {
      _dirty = true;
      // optional: PanelBase hat oft `markDirty()` – aber wir halten das defensiv:
      this.markDirty?.(true);
    };

    /**
     * Speichert den aktuellen Draft in den Store (kanonischer Pfad).
     * -> Danach sind Projekt-Assets in allen Panels konsistent.
     */
    const sync = () => {
      if (!_dirty) return;

      this.store.update("app", (app) => {
        app.project = app.project || {};
        setByPath(app.project, CANON_PATH, Array.isArray(draft.projectAssets) ? draft.projectAssets : []);
        // Legacy/Kompatibilität: einige Panels lesen (noch) aus app.settings.projectAssets
        app.settings = app.settings || {};
        app.settings.projectAssets = Array.isArray(draft.projectAssets) ? draft.projectAssets : [];
      });

      _dirty = false;
      this.markDirty?.(false);
    };

    // ---------------------------
    // Header / Hinweiszeile
    // ---------------------------
    root.appendChild(
      h("div", { style: { opacity: ".75", fontSize: "12px", marginBottom: "8px" } },
        `Assets im Projekt: ${pid}`
      )
    );

    // ---------------------------
    // Toolbar (Panel-intern)
    // ---------------------------
    const topBar = h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", margin: "0 0 12px" } });

    const btnAddDummy = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => {
        draft.projectAssets = draft.projectAssets || [];

        // Neues Projekt-Asset direkt im Slot-Format (v1) anlegen.
        // (Legacy-Felder wie `preset` behalten wir zwar kompatibel,
        // aber neue Einträge sollen sauber im neuen Modell landen.)
        const paId = makeId("PA");
        const slotId = makeId("PS");

        draft.projectAssets.push({
          id: paId,
          name: "Dummy Asset",
          source: { kind: "upload", note: "Standalone" },
          slots: [
            {
              id: slotId,
              name: "Variante 1",
              model: null,
              preset: { scale: 1, rotY: 0, offsetY: 0 },
            hasModel: false,
            lastImportName: null,
            updatedAt: null,
            lastAction: null,
            },
          ],
        });

        // UI: neuen Slot als aktiv wählen
        this._slotSel = this._slotSel || {};
        this._slotSel[paId] = slotId;

        dirty();
        sync();
        this.rerender();
      },
    }, "+ Dummy-Asset");

    const btnOpenStandalone = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => {
        // Kontext explizit leer setzen (Standalone-Viewer)
        this.store.update("app", (app) => {
          app.ui = app.ui || {};
          app.ui.assetlab = app.ui.assetlab || {};
          app.ui.assetlab.context = null;
        });

        this.bus.emit("ui:navigate", { panel: "projectPanel:assetlab3d", payload: { context: null } });
      },
    }, "↗︎ AssetLab öffnen (Standalone)");

    topBar.appendChild(btnAddDummy);
    topBar.appendChild(btnOpenStandalone);

    root.appendChild(topBar);

    // ---------------------------
    // Liste
    // ---------------------------
    const list = h("div", { style: { display: "grid", gap: "12px" } });
    root.appendChild(list);

    // Slot-UI: wir merken uns pro Projekt-Asset die zuletzt gewählte Slot-ID
    // (nur UI-State, nicht persistiert). Damit bleibt die Auswahl stabil,
    // wenn man mehrere Karten auf/zu macht.
    this._slotSel = this._slotSel || {};

    const items = Array.isArray(draft.projectAssets) ? draft.projectAssets : [];

    if (!items.length) {
      list.appendChild(
        h("div", { style: { opacity: ".7", fontSize: "13px" } },
          "Keine Projekt-Assets vorhanden. (Zum Testen: „+ Dummy-Asset“.)"
        )
      );
      return;
    }

    // ---------------------------------------------------------------------
    // Helper: Asset/Slots normalisieren
    // ---------------------------------------------------------------------
    const ensureSlots = (asset) => {
      if (!asset) return;

      // Legacy -> Slots
      if (!Array.isArray(asset.slots) || !asset.slots.length) {
        const legacyPreset = asset.preset || asset.presetTransform || { scale: 1, rotY: 0, offsetY: 0 };
        asset.slots = [
          {
            id: makeId("PS"),
            name: "Variante 1",
            // Modell-Referenz ist bewusst generisch, damit wir später mehrere Quellen unterstützen.
            // Beispiel: { kind:'upload', assetId:'A-...', fileName:'...' }
            model: asset.model || null,
            preset: {
              scale: Number(legacyPreset.scale ?? 1),
              rotY: Number(legacyPreset.rotY ?? 0),
              offsetY: Number(legacyPreset.offsetY ?? 0),
            },
          },
        ];
      }

      // Slot-Presets immer sauber
      asset.slots.forEach((s, idx) => {
        s.id = s.id || makeId("PS");
        s.name = s.name || `Variante ${idx + 1}`;
        s.preset = s.preset || { scale: 1, rotY: 0, offsetY: 0 };
        s.preset.scale = Number(s.preset.scale ?? 1);
        s.preset.rotY = Number(s.preset.rotY ?? 0);
        s.preset.offsetY = Number(s.preset.offsetY ?? 0);
      });
    };

    // Ein Element rendern
    items.forEach((it) => {
      ensureSlots(it);

      // Aktuellen Slot bestimmen (UI-Memory -> Fallback Slot[0])
      const remembered = this._slotSel[it.id];
      const slotId = remembered && it.slots.some((s) => s.id === remembered)
        ? remembered
        : (it.slots[0]?.id || null);
      this._slotSel[it.id] = slotId;
      const slot = it.slots.find((s) => s.id === slotId) || it.slots[0];

      const card = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.08)",
          borderRadius: "10px",
          padding: "10px",
          background: "rgba(255,255,255,.55)",
        },
      });

      const title = h("div", { style: { fontWeight: "600" } }, it?.name || "(ohne Name)");
      const sub = h("div", { style: { opacity: ".75", fontSize: "12px", marginBottom: "8px" } },
        `Asset-ID: ${it?.id || "?"}  ·  Quelle: ${it?.source?.kind || "?"}`
      );

      // Actions
      const actions = h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" } });

      const btnOpen = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          // Kontext in Store ablegen (robust – AssetLabPanel kann das lesen)
          this.store.update("app", (app) => {
            app.ui = app.ui || {};
            app.ui.assetlab = app.ui.assetlab || {};
            app.ui.assetlab.context = { type: "projectAsset", projectAssetId: it.id, slotId: this._slotSel[it.id] };
          });

          // Navigation zum AssetLab
          this.bus.emit("ui:navigate", {
            panel: "projectPanel:assetlab3d",
            payload: { context: { type: "projectAsset", projectAssetId: it.id, slotId: this._slotSel[it.id] } },
          });
        },
      }, "🧰 In AssetLab öffnen");

      const btnDel = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          if (!confirm("Projekt-Asset wirklich löschen?")) return;
          draft.projectAssets = (draft.projectAssets || []).filter((x) => x?.id !== it.id);
          dirty();
          sync();
          this.rerender();
        },
      }, "🗑 Löschen");

      actions.appendChild(btnOpen);
      actions.appendChild(btnDel);

      // -------------------------------------------------------------------
      // Slot-UI + Preset-Felder (numerisch)
      // -------------------------------------------------------------------
      const slotRow = h("div", {
        style: {
          display: "flex",
          gap: "8px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "10px",
        },
      });

      const slotSelect = h("select", {
        className: "bp-input",
        value: slotId || "",
        onchange: (ev) => {
          this._slotSel[it.id] = ev.target.value;
          this.rerender();
        },
      });
      it.slots.forEach((s) => {
        slotSelect.appendChild(h("option", { value: s.id }, s.name || s.id));
      });

      const btnAddSlot = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          const newSlot = {
            id: makeId("PS"),
            name: `Variante ${it.slots.length + 1}`,
            model: null,
            preset: { scale: 1, rotY: 0, offsetY: 0 },
            hasModel: false,
            lastImportName: null,
            updatedAt: null,
            lastAction: null,
          };
          it.slots.push(newSlot);
          this._slotSel[it.id] = newSlot.id;
          dirty();
          sync();
          this.rerender();
        },
      }, "+ Slot");

      const btnDelSlot = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          if (!slot) return;
          if (it.slots.length <= 1) {
            alert("Mindestens 1 Slot muss bestehen bleiben.");
            return;
          }
          if (!confirm(`Slot „${slot.name || slot.id}“ wirklich löschen?`)) return;
          it.slots = it.slots.filter((s) => s.id !== slot.id);
          this._slotSel[it.id] = it.slots[0]?.id || null;
          dirty();
          sync();
          this.rerender();
        },
      }, "Slot löschen");

      // Slot-Name editierbar (damit Variationen sauber benannt sind)
      const slotName = h("input", {
        className: "bp-input",
        type: "text",
        value: slot?.name || "",
        placeholder: "Slot-Name",
        oninput: (ev) => {
          if (!slot) return;
          slot.name = String(ev.target.value || "");
          dirty();
          sync();
          // kein rerender notwendig
        },
        style: { minWidth: "160px" },
      });

      slotRow.appendChild(h("div", { style: { fontSize: "12px", opacity: ".8" } }, "Slot:"));
      slotRow.appendChild(slotSelect);
      slotRow.appendChild(slotName);
      slotRow.appendChild(btnAddSlot);
      slotRow.appendChild(btnDelSlot);

      // Slot-Status (wird durch AssetLab Import/Export via postMessage aktualisiert)
      const slotStatus = (() => {
        if (!slot) return "Model: —";
        if (!slot.hasModel) return "Model: —";
        const when = slot.updatedAt ? new Date(slot.updatedAt).toLocaleString() : "—";
        const name = slot.lastImportName || "—";
        const act = slot.lastAction ? ` (${slot.lastAction})` : "";
        return `Model: ✅ ${name} · ${when}${act}`;
      })();

      const slotStatusEl = h("div", {
        style: { fontSize: "12px", opacity: ".75", marginTop: "6px" },
      }, slotStatus);
      slotRow.appendChild(slotStatusEl);

      // Preset-Grid für den AKTUELLEN Slot
      const grid = h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "8px",
        },
      });

      const mkNum = (label, getVal, setVal) => {
        const wrap = h("div", {});
        const lab = h("div", { style: { fontSize: "12px", opacity: ".8", marginBottom: "4px" } }, label);

        const inp = h("input", {
          type: "number",
          className: "bp-input",
          value: String(getVal()),
          oninput: (ev) => {
            const v = Number(ev.target.value);
            setVal(Number.isFinite(v) ? v : 0);
            dirty();
            sync();
          },
        });

        wrap.appendChild(lab);
        wrap.appendChild(inp);
        return wrap;
      };

      // Slot existiert immer (ensureSlots)
      grid.appendChild(mkNum("Scale (uniform)", () => slot?.preset?.scale ?? 1, (v) => (slot.preset.scale = v)));
      grid.appendChild(mkNum("Rot Y (°)", () => slot?.preset?.rotY ?? 0, (v) => (slot.preset.rotY = v)));
      grid.appendChild(mkNum("Offset Y", () => slot?.preset?.offsetY ?? 0, (v) => (slot.preset.offsetY = v)));

      card.appendChild(title);
      card.appendChild(sub);
      card.appendChild(actions);
      card.appendChild(slotRow);
      card.appendChild(grid);

      list.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // Migration (innerhalb der Klasse – wichtig: KEIN SyntaxError!)
  // ---------------------------------------------------------------------------

  /**
   * Migriert bekannte Legacy-Felder in den kanonischen Pfad `project.projectAssets`.
   * - Nur wenn der kanonische Pfad leer/fehlend ist.
   * - Legacy-Daten bleiben zusätzlich im Objekt stehen (nur als Fallback),
   *   aber UI arbeitet ab dann nur noch mit `projectAssets`.
   */
  _migrateLegacyIfNeeded(project) {
    if (!project) return;

    const canon = getByPath(project, CANON_PATH);
    if (Array.isArray(canon) && canon.length) return; // schon ok

    // 1) erste Legacy-Liste finden
    let legacy = null;
    let legacyKey = null;

    for (const k of LEGACY_PATHS) {
      const v = getByPath(project, k);
      if (Array.isArray(v) && v.length) {
        legacy = v;
        legacyKey = k;
        break;
      }
    }

    if (!legacy) {
      // wenn GAR nichts da ist, trotzdem kanonisch initialisieren
      setByPath(project, CANON_PATH, Array.isArray(canon) ? canon : []);
      return;
    }

    // 2) Migrieren (sanft normalisieren)
    const migrated = legacy.map((it) => ({
      id: it?.id || makeId("PA"),
      name: it?.name || "Projekt-Asset",
      source: it?.source || { kind: "legacy", from: legacyKey || "unknown" },
      preset: it?.preset || it?.presetTransform || { scale: 1, rotY: 0, offsetY: 0 },
    }));

    setByPath(project, CANON_PATH, migrated);
  }
}
