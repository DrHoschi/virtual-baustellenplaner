/**
 * Baustellenplaner – Projekt → Assets Panel
 * Datei: ui/panels/ProjectAssetsPanel.js
 * Version: v2.1.0-clean-no-drift (2026-02-25)
 *
 * Ziel (B): UI aufgeräumt + sauber strukturiert
 * --------------------------------------------
 * - Keine Drift / keine Doppelquellen:
 *   -> projectAssets werden IMMER kanonisch synchron in:
 *      (1) store.app.project.projectAssets
 *      (2) store.project.projectAssets
 *      (3) store.app.settings.projectAssets
 *      (4) store.meta.settings.projectAssets
 *
 * - Keine direkte localStorage Nutzung hier.
 * - Persist passiert ausschließlich über Save-Button:
 *      bus.emit("ui:project:save")
 *
 * - Slot/Varianten-UI wieder drin:
 *   - Slot wählen, Slot umbenennen
 *   - + Slot, Slot löschen
 *   - Modell-Badge / Dateiname
 *   - "In AssetLab öffnen"
 *   - Export GLB/GLTF (als Host-PendingCmd + Öffnen)
 *
 * - Export/Import Projekt wieder drin:
 *   - Export: Download JSON Snapshot (aus Store)
 *   - Import: JSON Datei laden -> Store setzen -> Save Event
 *
 * Debug/Checker bleiben im Gesamtprojekt an anderer Stelle – dieses Panel ist bewusst „clean“.
 */

/* ============================================================================
 * IMPORTS
 * ========================================================================== */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

// Kanonischer Pfad im Projektobjekt
const CANON_PATH = "projectAssets";

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function safeClone(obj) {
  // structuredClone ist in modernen Browsern ok – fallback bleibt robust.
  try { return structuredClone(obj); }
  catch { return JSON.parse(JSON.stringify(obj)); }
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "PA") {
  // Good-enough IDs für Client-Demo (nicht kryptografisch).
  return `${prefix}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function __arr(v) { return Array.isArray(v) ? v : []; }
function __obj(v) { return (v && typeof v === "object") ? v : null; }
function __str(v) { return (typeof v === "string") ? v : ""; }

function slotLooksLikeHasModel(slot) {
  if (!slot) return false;
  if (slot.hasModel === true) return true;
  if (slot.exportRef) return true;
  if (__str(slot.lastImportName).trim()) return true;
  if (slot.model) return true;
  return false;
}

function ensureSlots(asset) {
  if (!asset) return;
  if (!Array.isArray(asset.slots) || asset.slots.length === 0) {
    asset.slots = [{
      id: makeId("PS"),
      name: "Variante 1",
      model: null,
      preset: { scale: 1, rotY: 0, offsetY: 0 },
      hasModel: false,
      lastImportName: "",
      updatedAt: "",
      lastAction: "",
      exportRef: null,
    }];
  }
}

function ensureAssetShape(asset) {
  if (!asset) return;
  if (!asset.id) asset.id = makeId("PA");
  if (!asset.name) asset.name = "Dummy Asset";
  if (!asset.source) asset.source = { kind: "upload", note: "Standalone" };
  ensureSlots(asset);

  // Optionaler Bereich, der im Projekt schon verwendet wurde – wir lassen ihn drin,
  // damit nichts „verschwindet“, falls andere Panels darauf bauen.
  if (!asset.presetTransform) {
    asset.presetTransform = { sx: 1, sy: 1, sz: 1, ryDeg: 0, ox: 0, oy: 0, oz: 0 };
  }
}

/**
 * Download helper (Export Projekt)
 */
function downloadTextFile({ filename, text, mime = "application/json" }) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

/**
 * File picker helper (Import Projekt)
 */
function pickJsonFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";

    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return resolve(null);
      try {
        const txt = await f.text();
        const obj = JSON.parse(txt);
        resolve(obj);
      } catch {
        resolve(null);
      } finally {
        input.remove();
      }
    };

    document.body.appendChild(input);
    input.click();
  });
}

/* ============================================================================
 * PANEL
 * ========================================================================== */

export class ProjectAssetsPanel extends PanelBase {

  getTitle() {
    return "Projekt – Assets";
  }

  constructor(ctx) {
    super(ctx);

    // UI-State rein im Panel (nicht persistent):
    // pro Asset merken wir den aktuell ausgewählten Slot.
    this._slotSel = new Map(); // assetId -> slotId
  }

  /* --------------------------------------------------------------------------
   * DRAFT
   * ------------------------------------------------------------------------ */

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const project = app.project || {};
    const list = __arr(project[CANON_PATH]);

    const draft = {
      projectId: __str(project.id),
      projectName: __str(project.name),
      projectAssets: safeClone(list),
      _ts: Date.now()
    };

    draft.projectAssets.forEach((a) => ensureAssetShape(a));
    return draft;
  }

  /* --------------------------------------------------------------------------
   * CANON SYNC (No Drift / No Doppelquellen)
   * ------------------------------------------------------------------------ */

  /**
   * WICHTIG: Kanonischer „projectAssets“ Write – an *alle* bekannten Spiegel.
   * Dadurch entstehen keine „leeren nach Reload“-Effekte durch unterschiedliche Quellen.
   */
  _applyCanonicalProjectAssets(list) {
    const canon = __arr(list).map((a) => {
      const aa = __obj(a) ? a : {};
      ensureAssetShape(aa);
      return aa;
    });

    // (1) app.project.projectAssets + (2) app.settings.projectAssets + pendingCmd/context optional
    this.store.update("app", (app) => {
      app = app || {};
      app.project = app.project || {};
      app.settings = app.settings || {};

      app.project[CANON_PATH] = canon;
      app.settings[CANON_PATH] = canon;

      return app;
    });

    // (3) project.projectAssets
    this.store.update("project", (proj) => {
      proj = proj || {};
      proj[CANON_PATH] = canon;
      return proj;
    });

    // (4) meta.settings.projectAssets
    this.store.update("meta", (meta) => {
      meta = meta || {};
      meta.settings = meta.settings || {};
      meta.settings[CANON_PATH] = canon;
      return meta;
    });
  }

  _emitSave() {
    // Persistor hängt im Loader am Event – hier keine localStorage Logik.
    this.bus.emit("ui:project:save");
  }

  /* --------------------------------------------------------------------------
   * NAV + ASSETLAB CONTEXT
   * ------------------------------------------------------------------------ */

  _setAssetLabContext({ projectAssetId, slotId, pendingCmd = null }) {
    this.store.update("app", (app) => {
      app = app || {};
      app.ui = app.ui || {};
      app.ui.assetlab = app.ui.assetlab || {};

      app.ui.assetlab.context = {
        type: "projectAsset",
        projectAssetId: projectAssetId || null,
        slotId: slotId || null
      };

      // Optionaler „Command“-Kanal: Panel kann dem AssetLab sagen „mach Export“.
      // Falls AssetLab das (noch) nicht auswertet, ist es trotzdem harmless.
      app.ui.assetlab.pendingCmd = pendingCmd || null;

      return app;
    });
  }

  _openInAssetLab({ projectAssetId, slotId, pendingCmd = null }) {
    this._setAssetLabContext({ projectAssetId, slotId, pendingCmd });

    this.bus.emit("ui:navigate", {
      panel: "projectPanel:assetlab3d",
      context: {
        type: "projectAsset",
        projectAssetId,
        slotId
      }
    });
  }

  /* --------------------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------------------ */

  renderBody(root, draft) {

    // ------------------------------------------------------------
    // Top actions (Export/Import/Save)
    // ------------------------------------------------------------

    const topRow = h("div", {
      style: {
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: "12px"
      }
    });

    topRow.appendChild(
      h("div", { style: { opacity: ".7", marginRight: "10px" } },
        `Assets im Projekt: ${draft.projectId || "-"}`
      )
    );

    topRow.appendChild(
      h("button", {
        className: "bp-btn",
        onclick: () => {
          // Globale Save-Aktion (Store ist bereits aktualisiert),
          // aber Persist passiert erst hier.
          this._emitSave();
          this.rerender();
        }
      }, "💾 Speichern")
    );

    topRow.appendChild(
      h("button", {
        className: "bp-btn",
        onclick: () => {
          // Export: kompletter Snapshot aus Store (nicht nur projectAssets)
          const payload = {
            project: this.store.get("project") || {},
            meta: this.store.get("meta") || {},
            ui: this.store.get("ui") || {},
            config: this.store.get("config") || {},
            app: this.store.get("app") || {},
            plugins: this.store.get("plugins") || {},
            _export: { at: nowIso(), kind: "project-snapshot" }
          };

          downloadTextFile({
            filename: `project_export_${draft.projectId || "unknown"}_${nowIso().replace(/[:.]/g, "-")}.json`,
            text: JSON.stringify(payload, null, 2)
          });
        }
      }, "⬇️ Export Projekt")
    );

    topRow.appendChild(
      h("button", {
        className: "bp-btn",
        onclick: async () => {
          const obj = await pickJsonFile();
          if (!obj || typeof obj !== "object") {
            alert("Import fehlgeschlagen: Datei ist kein gültiges JSON.");
            return;
          }

          // Wir akzeptieren:
          // - Snapshot-Format (project/meta/ui/config/app/plugins)
          // - oder Project-only (direkt das Projektobjekt)
          const projectObj =
            (obj.project && typeof obj.project === "object") ? obj.project :
              (obj.schema && typeof obj.schema === "string" && obj.id) ? obj :
                null;

          if (!projectObj) {
            alert("Import fehlgeschlagen: Kein Projektobjekt gefunden (project oder project-only).");
            return;
          }

          const metaObj = (obj.meta && typeof obj.meta === "object") ? obj.meta : (this.store.get("meta") || {});
          const uiObj = (obj.ui && typeof obj.ui === "object") ? obj.ui : (this.store.get("ui") || {});
          const cfgObj = (obj.config && typeof obj.config === "object") ? obj.config : (this.store.get("config") || {});
          const pluginsObj = (obj.plugins && typeof obj.plugins === "object") ? obj.plugins : (this.store.get("plugins") || {});
          const appObj = (obj.app && typeof obj.app === "object") ? obj.app : null;

          // Store setzen
          this.store.set("project", projectObj);
          this.store.set("meta", metaObj);
          this.store.set("ui", uiObj);
          this.store.set("config", cfgObj);
          this.store.set("plugins", pluginsObj);

          // app muss konsistent sein: wenn ein appObj kommt -> nehmen,
          // sonst neu aus project/meta/ui bauen.
          if (appObj) {
            this.store.set("app", appObj);
          } else {
            this.store.set("app", {
              project: projectObj,
              settings: (metaObj && metaObj.settings) ? metaObj.settings : {},
              ui: uiObj,
              activeProject: (this.store.get("app") || {}).activeProject || { kind: "file", url: "" },
              activeProjectId: projectObj?.id ? String(projectObj.id) : ((this.store.get("app") || {}).activeProjectId || null)
            });
          }

          // Canonical sync projectAssets (falls Import nur in einer Quelle lag)
          const pa = __arr(projectObj?.[CANON_PATH]);
          this._applyCanonicalProjectAssets(pa);

          // Persist
          this._emitSave();
          this.rerender();
        }
      }, "⬆️ Import Projekt")
    );

    topRow.appendChild(
      h("button", {
        className: "bp-btn",
        onclick: () => {
          // Dummy Asset anlegen
          const list = draft.projectAssets;

          list.push({
            id: makeId("PA"),
            name: "Dummy Asset",
            source: { kind: "upload", note: "Standalone" },
            slots: []
          });

          list.forEach((a) => ensureAssetShape(a));
          this._applyCanonicalProjectAssets(list);

          // WICHTIG: Speichern erfolgt nur über Button/Manuell –
          // aber in der Praxis ist es hier UX-freundlich direkt zu speichern.
          this._emitSave();
          this.rerender();
        }
      }, "+ Dummy-Asset")
    );

    root.appendChild(topRow);

    // ------------------------------------------------------------
    // Asset Cards
    // ------------------------------------------------------------

    const list = __arr(draft.projectAssets);

    if (list.length === 0) {
      root.appendChild(
        h("div", { style: { opacity: ".7", padding: "10px" } },
          "Noch keine Projekt-Assets. Lege ein „Dummy-Asset“ an oder importiere ein Projekt."
        )
      );
      return;
    }

    list.forEach((asset) => {
      ensureAssetShape(asset);

      // Slot-Selection: wenn noch nicht gesetzt, auf ersten Slot
      const slots = __arr(asset.slots);
      const remembered = this._slotSel.get(asset.id) || null;
      const selectedSlotId = (remembered && slots.some(s => s && s.id === remembered))
        ? remembered
        : (slots[0]?.id || null);

      if (selectedSlotId) this._slotSel.set(asset.id, selectedSlotId);

      const selectedSlot = slots.find((s) => s && s.id === selectedSlotId) || slots[0];

      const card = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.10)",
          borderRadius: "10px",
          padding: "12px",
          marginBottom: "12px",
          background: "rgba(255,255,255,.6)"
        }
      });

      // Title + meta
      card.appendChild(
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" } },
          h("div", { style: { fontWeight: "700" } }, asset.name || "Asset"),
          h("div", { style: { fontSize: "12px", opacity: ".7" } }, `Asset-ID: ${asset.id}`)
        )
      );

      // Model badge
      card.appendChild(
        h("div", { style: { marginTop: "6px", fontSize: "12px", opacity: ".75" } },
          slotLooksLikeHasModel(selectedSlot) ? "🟢 Modell vorhanden" : "○ Kein Modell"
        )
      );

      // Actions row: open + delete
      const row1 = h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" } });

      row1.appendChild(
        h("button", {
          className: "bp-btn",
          onclick: () => {
            const sid = selectedSlot?.id || slots[0]?.id || null;
            this._openInAssetLab({ projectAssetId: asset.id, slotId: sid });
          }
        }, "🧰 In AssetLab öffnen")
      );

      row1.appendChild(
        h("button", {
          className: "bp-btn",
          onclick: () => {
            if (!confirm(`Asset wirklich löschen?\n\n${asset.name}\n${asset.id}`)) return;

            const next = __arr(draft.projectAssets).filter((a) => a && a.id !== asset.id);
            this._applyCanonicalProjectAssets(next);
            this._emitSave();
            this.rerender();
          }
        }, "🗑️ Löschen")
      );

      card.appendChild(row1);

      // Slot UI
      const slotWrap = h("div", { style: { marginTop: "12px" } });

      // Slot selector row
      const slotRow = h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" } });

      // Label
      slotRow.appendChild(h("div", { style: { width: "52px", opacity: ".75" } }, "Slot:"));

      // Select
      const sel = h("select", {
        className: "bp-input",
        style: { minWidth: "140px" },
        onchange: (ev) => {
          const val = String(ev.target.value || "");
          this._slotSel.set(asset.id, val);
          this.rerender();
        }
      });

      slots.forEach((s) => {
        sel.appendChild(
          h("option", { value: s.id, selected: s.id === selectedSlotId }, s.name || s.id)
        );
      });

      slotRow.appendChild(sel);

      // Slot name input
      const nameInput = h("input", {
        className: "bp-input",
        style: { flex: "1", minWidth: "160px" },
        value: selectedSlot?.name || "",
        placeholder: "Slot Name (z.B. Variante 1)",
        oninput: (ev) => {
          const v = String(ev.target.value || "");
          selectedSlot.name = v;

          // sofort kanonisch schreiben
          this._applyCanonicalProjectAssets(draft.projectAssets);
        }
      });

      slotRow.appendChild(nameInput);

      slotWrap.appendChild(slotRow);

      // File name / last action
      slotWrap.appendChild(
        h("div", { style: { marginTop: "8px", fontSize: "12px", opacity: ".75" } },
          selectedSlot?.lastImportName
            ? `Datei: ${selectedSlot.lastImportName}`
            : "Datei: –"
        )
      );

      // Slot actions row
      const slotActions = h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" } });

      slotActions.appendChild(
        h("button", {
          className: "bp-btn",
          onclick: () => {
            const nextIndex = slots.length + 1;
            const newSlot = {
              id: makeId("PS"),
              name: `Variante ${nextIndex}`,
              model: null,
              preset: { scale: 1, rotY: 0, offsetY: 0 },
              hasModel: false,
              lastImportName: "",
              updatedAt: "",
              lastAction: "",
              exportRef: null,
            };

            asset.slots.push(newSlot);
            this._slotSel.set(asset.id, newSlot.id);

            this._applyCanonicalProjectAssets(draft.projectAssets);
            this._emitSave();
            this.rerender();
          }
        }, "+ Slot")
      );

      slotActions.appendChild(
        h("button", {
          className: "bp-btn",
          onclick: () => {
            if (slots.length <= 1) {
              alert("Mindestens ein Slot muss vorhanden bleiben.");
              return;
            }

            const sid = selectedSlot?.id;
            const idx = asset.slots.findIndex((s) => s && s.id === sid);
            if (idx < 0) return;

            if (!confirm(`Slot wirklich löschen?\n\n${selectedSlot?.name || sid}`)) return;

            asset.slots.splice(idx, 1);

            // neue Auswahl: gleicher Index, sonst letzter, sonst erster
            const newSel =
              asset.slots[idx]?.id ||
              asset.slots[asset.slots.length - 1]?.id ||
              asset.slots[0]?.id ||
              null;

            if (newSel) this._slotSel.set(asset.id, newSel);

            this._applyCanonicalProjectAssets(draft.projectAssets);
            this._emitSave();
            this.rerender();
          }
        }, "Slot löschen")
      );

      // Export Buttons (Host -> set pendingCmd + open AssetLab)
      slotActions.appendChild(
        h("button", {
          className: "bp-btn",
          onclick: () => {
            const sid = selectedSlot?.id || null;
            const pendingCmd = { type: "export", format: "glb", at: nowIso() };
            this._openInAssetLab({ projectAssetId: asset.id, slotId: sid, pendingCmd });
          }
        }, "⬇️ Export GLB")
      );

      slotActions.appendChild(
        h("button", {
          className: "bp-btn",
          onclick: () => {
            const sid = selectedSlot?.id || null;
            const pendingCmd = { type: "export", format: "gltf", at: nowIso() };
            this._openInAssetLab({ projectAssetId: asset.id, slotId: sid, pendingCmd });
          }
        }, "⬇️ Export GLTF")
      );

      slotWrap.appendChild(slotActions);

      // Quick save per slot (optional – praktisch, weil du oft am Slot arbeitest)
      const quickSaveRow = h("div", { style: { marginTop: "10px" } });
      quickSaveRow.appendChild(
        h("button", {
          className: "bp-btn",
          onclick: () => {
            // Minimaler Audit
            selectedSlot.updatedAt = nowIso();
            selectedSlot.lastAction = selectedSlot.lastAction || "manual save";

            this._applyCanonicalProjectAssets(draft.projectAssets);
            this._emitSave();
            this.rerender();
          }
        }, "💾 Slot speichern")
      );
      slotWrap.appendChild(quickSaveRow);

      card.appendChild(slotWrap);

      root.appendChild(card);
    });
  }
}

export default ProjectAssetsPanel;
