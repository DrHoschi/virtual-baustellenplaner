/**
 * Baustellenplaner
 * Datei: ui/panels/ProjectAssetsPanel.js
 * Version: v2.1.0-clean-slotui-assetlab-open-export-import (2026-02-25)
 *
 * Projekt → Assets
 * ---------------------------------------------------------------------------
 * Ziel (B): UI aufgeräumt + sauber strukturiert
 * - KEINE localStorage Nutzung im Panel (Persist zentral über core/persist/app-persist.js)
 * - KEINE "zweite Wahrheit": Panel arbeitet ausschließlich auf store.app.project.projectAssets
 * - Persist passiert NUR über Save-Button (bus.emit("ui:project:save"))
 *
 * Funktionsumfang:
 * - Projekt-Buttons: Export Projekt / Import Projekt / + Dummy-Asset / Speichern
 * - Asset-Karte: In AssetLab öffnen / Löschen
 * - Slot/Varianten-UI: Slot wählen, Slot umbenennen, + Slot, Slot löschen
 * - Slot-Aktionen: Export GLB / Export GLTF / Slot speichern
 *
 * Integration AssetLab:
 * - Öffnen: bus.emit("ui:navigate", { panel:"projectPanel:assetlab3d", context:{...} })
 * - Export: wir setzen optional app.ui.assetlab.pendingCmd und navigieren ins AssetLab.
 *
 * Debug/Checker bleiben unangetastet.
 */

import { PanelBase } from "./PanelBase.js";
import { h, clear } from "../components/ui-dom.js";

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const CANON_PATH = "projectAssets";

/** Für File-Downloads (Export Projekt) */
const EXPORT_FILENAME_PREFIX = "snapshot_ALL_";

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function safeClone(obj) {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "ID") {
  // ausreichend für lokale IDs (keine Kollisions-Garantie nötig)
  return `${prefix}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function asArr(v) {
  return Array.isArray(v) ? v : [];
}

function asObj(v) {
  return v && typeof v === "object" ? v : {};
}

function asStr(v) {
  return typeof v === "string" ? v : "";
}

function slotHasModel(slot) {
  if (!slot) return false;
  if (slot.hasModel === true) return true;
  if (slot.exportRef) return true;
  if (asStr(slot.lastImportName).trim()) return true;
  if (slot.model) return true;
  return false;
}

function ensurePresetTransform(asset) {
  asset.presetTransform = asObj(asset.presetTransform);
  asset.presetTransform.sx = Number(asset.presetTransform.sx ?? 1) || 1;
  asset.presetTransform.sy = Number(asset.presetTransform.sy ?? 1) || 1;
  asset.presetTransform.sz = Number(asset.presetTransform.sz ?? 1) || 1;
  asset.presetTransform.ryDeg = Number(asset.presetTransform.ryDeg ?? 0) || 0;
  asset.presetTransform.ox = Number(asset.presetTransform.ox ?? 0) || 0;
  asset.presetTransform.oy = Number(asset.presetTransform.oy ?? 0) || 0;
  asset.presetTransform.oz = Number(asset.presetTransform.oz ?? 0) || 0;
}

function ensureSlots(asset) {
  asset.slots = asArr(asset.slots);

  // Minimaler Slot, damit UI immer stabil ist
  if (asset.slots.length === 0) {
    asset.slots.push({
      id: makeId("PS"),
      name: "Variante 1",
      model: null,
      preset: { scale: 1, rotY: 0, offsetY: 0 },
      hasModel: false,
      lastImportName: "",
      updatedAt: "",
      lastAction: "",
      exportRef: null,
    });
  }

  for (const s of asset.slots) {
    s.id = asStr(s.id) || makeId("PS");
    s.name = asStr(s.name) || "Variante";
    s.preset = asObj(s.preset);
    s.preset.scale = Number(s.preset.scale ?? 1) || 1;
    s.preset.rotY = Number(s.preset.rotY ?? 0) || 0;
    s.preset.offsetY = Number(s.preset.offsetY ?? 0) || 0;
    s.hasModel = !!s.hasModel;
    s.lastImportName = asStr(s.lastImportName);
    s.updatedAt = asStr(s.updatedAt);
    s.lastAction = asStr(s.lastAction);
    // exportRef / model können null bleiben
  }
}

function ensureAsset(asset) {
  asset.id = asStr(asset.id) || makeId("PA");
  asset.name = asStr(asset.name) || "Dummy Asset";
  asset.source = asObj(asset.source);
  ensurePresetTransform(asset);
  ensureSlots(asset);
}

/** Kleines Download-Helper (ohne externe Libs) */
function downloadJson(filename, obj) {
  const txt = JSON.stringify(obj, null, 2);
  const blob = new Blob([txt], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** FilePicker → JSON */
function pickJsonFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      try {
        const f = input.files && input.files[0];
        if (!f) return resolve(null);
        const txt = await f.text();
        resolve(txt);
      } catch {
        resolve(null);
      }
    };
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

  /**
   * Draft ist UI-intern (render-state). Es ist NICHT die Persistenzquelle.
   * Quelle ist store.app.project.projectAssets.
   */
  buildDraftFromStore() {
    const app = asObj(this.store.get("app"));
    const project = asObj(app.project);

    const list = safeClone(asArr(project[CANON_PATH]));
    list.forEach(ensureAsset);

    // UI-Auswahl: pro Asset merken wir den aktuell ausgewählten SlotIndex
    const selectedSlotByAssetId = {};

    // Wenn AssetLab Kontext existiert (letzter Slot), dann nehmen wir das als Vorauswahl
    const ctx = app?.ui?.assetlab?.context;
    if (ctx && ctx.projectAssetId && ctx.slotId) {
      selectedSlotByAssetId[String(ctx.projectAssetId)] = String(ctx.slotId);
    }

    return {
      projectId: asStr(project.id),
      projectAssets: list,
      selectedSlotByAssetId,
    };
  }

  renderBody(root, draft) {
    clear(root);

    /* ------------------------------------------------------------------------
     * Zentrale "Sync" Funktion:
     * - schreibt ausschließlich in store.app.project.projectAssets
     * - Persist passiert NUR, wenn wir explizit save() rufen.
     * --------------------------------------------------------------------- */

    const syncToStore = () => {
      const canonical = safeClone(draft.projectAssets);
      canonical.forEach(ensureAsset);

      this.store.update("app", (appDraft) => {
        appDraft = asObj(appDraft);
        appDraft.project = asObj(appDraft.project);
        appDraft.ui = asObj(appDraft.ui);
        appDraft.ui.assetlab = asObj(appDraft.ui.assetlab);

        // EINZIGE Quelle im UI: app.project.projectAssets
        appDraft.project[CANON_PATH] = canonical;

        return appDraft;
      });
    };

    const save = () => {
      // Save-Button-only: Persistor hängt im Loader am Event.
      this.bus.emit("ui:project:save");
    };

    const syncAndSave = () => {
      syncToStore();
      save();
    };

    const navigateToAssetLab = ({ projectAssetId, slotId, pendingCmd = null } = {}) => {
      const ctx = {
        type: "projectAsset",
        projectAssetId: projectAssetId || null,
        slotId: slotId || null,
      };

      // Optional: Pending Command fürs AssetLab setzen (Export etc.)
      if (pendingCmd) {
        this.store.update("app", (appDraft) => {
          appDraft = asObj(appDraft);
          appDraft.ui = asObj(appDraft.ui);
          appDraft.ui.assetlab = asObj(appDraft.ui.assetlab);
          appDraft.ui.assetlab.pendingCmd = pendingCmd;
          return appDraft;
        });
      }

      this.bus.emit("ui:navigate", {
        panel: "projectPanel:assetlab3d",
        context: ctx,
      });
    };

    /* ------------------------------------------------------------------------
     * TOP: Titel + Buttons
     * --------------------------------------------------------------------- */

    root.appendChild(
      h(
        "div",
        { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" } },
        h(
          "div",
          {},
          h("div", { style: { fontSize: "28px", fontWeight: 700, marginBottom: "2px" } }, "Projekt – Assets"),
          h("div", { style: { opacity: 0.7 } }, `Assets im Projekt: ${draft.projectId || "-"}`)
        ),
        h(
          "div",
          { style: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" } },
          h(
            "button",
            {
              className: "bp-btn",
              onclick: () => {
                // "Projekt speichern" – keine Datenänderung, nur persistieren
                save();
              },
            },
            "💾 Speichern"
          )
        )
      )
    );

    root.appendChild(h("div", { style: { height: "10px" } }));

    const topBar = h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" } });

    topBar.appendChild(
      h(
        "button",
        {
          className: "bp-btn",
          onclick: () => {
            // Exportiert den Persistor-kompatiblen Snapshot (Format wie localStorage key)
            const app = asObj(this.store.get("app"));
            const payload = {
              project: asObj(app.project),
              settings: asObj(app.settings),
              ui: asObj(app.ui),
              _meta: {
                savedAt: nowIso(),
                projectId: asStr(app.activeProjectId) || asStr(app.project?.id) || "unknown",
              },
            };
            const stamp = nowIso().replace(/[:.]/g, "-");
            downloadJson(`${EXPORT_FILENAME_PREFIX}${stamp}.json`, payload);
          },
        },
        "⬇️ Export Projekt"
      )
    );

    topBar.appendChild(
      h(
        "button",
        {
          className: "bp-btn",
          onclick: async () => {
            const txt = await pickJsonFile();
            if (!txt) return;

            let parsed = null;
            try {
              parsed = JSON.parse(txt);
            } catch {
              parsed = null;
            }
            if (!parsed || typeof parsed !== "object") return;

            // Akzeptiert:
            // A) Persistor-Snapshot {project, settings, ui, _meta}
            // B) Projekt-Objekt (project-only)
            const snapProject = parsed.project && typeof parsed.project === "object" ? parsed.project : parsed;
            const snapSettings = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : null;
            const snapUi = parsed.ui && typeof parsed.ui === "object" ? parsed.ui : null;

            // Wichtig: wir füllen nur app.* (Root wird bei Save synchronisiert)
            this.store.update("app", (appDraft) => {
              appDraft = asObj(appDraft);
              appDraft.project = asObj(snapProject);
              if (snapSettings) appDraft.settings = asObj(snapSettings);
              if (snapUi) appDraft.ui = asObj(snapUi);

              // Safety: ensure asset list exists
              appDraft.project[CANON_PATH] = asArr(appDraft.project[CANON_PATH]);
              return appDraft;
            });

            // Draft neu aufbauen
            const newDraft = this.buildDraftFromStore();
            draft.projectId = newDraft.projectId;
            draft.projectAssets = newDraft.projectAssets;
            draft.selectedSlotByAssetId = newDraft.selectedSlotByAssetId;

            // Persist sofort, damit Reload stabil ist
            save();
            this.rerender();
          },
        },
        "⬆️ Import Projekt"
      )
    );

    topBar.appendChild(
      h(
        "button",
        {
          className: "bp-btn",
          onclick: () => {
            draft.projectAssets.push({
              id: makeId("PA"),
              name: "Dummy Asset",
              source: { kind: "upload", note: "Standalone" },
              slots: [],
            });
            draft.projectAssets.forEach(ensureAsset);
            syncAndSave();
            this.rerender();
          },
        },
        "+ Dummy-Asset"
      )
    );

    root.appendChild(topBar);

    /* ------------------------------------------------------------------------
     * Asset Cards
     * --------------------------------------------------------------------- */

    const list = asArr(draft.projectAssets);
    if (list.length === 0) {
      root.appendChild(
        h(
          "div",
          { style: { opacity: 0.7, padding: "10px 0" } },
          "Noch keine Projekt-Assets. Lege ein Dummy-Asset an oder importiere ein Projekt."
        )
      );
      return;
    }

    list.forEach((asset, assetIndex) => {
      ensureAsset(asset);

      // Aktuell ausgewählter Slot: per Asset merken wir slotId (stabil, auch wenn array re-ordered)
      const rememberedSlotId = draft.selectedSlotByAssetId[asset.id] || null;
      let slotIndex = 0;

      if (rememberedSlotId) {
        const idx = asset.slots.findIndex((s) => s && s.id === rememberedSlotId);
        if (idx >= 0) slotIndex = idx;
      }

      const slot = asset.slots[slotIndex] || asset.slots[0];

      const card = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.1)",
          borderRadius: "12px",
          padding: "12px",
          marginBottom: "14px",
          background: "rgba(255,255,255,.6)",
        },
      });

      // Header (Name + ID + Badge)
      card.appendChild(
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" } },
          h(
            "div",
            {},
            h("div", { style: { fontSize: "22px", fontWeight: 800, lineHeight: 1.1 } }, asset.name || "Asset"),
            h("div", { style: { opacity: 0.6, marginTop: "2px" } }, `Asset-ID: ${asset.id}`)
          ),
          h(
            "div",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 10px",
                borderRadius: "999px",
                border: "1px solid rgba(0,0,0,.08)",
                background: "rgba(255,255,255,.7)",
              },
            },
            h("span", {
              style: {
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                display: "inline-block",
                background: slotHasModel(slot) ? "#31c24a" : "rgba(0,0,0,.15)",
              },
            }),
            h("span", { style: { fontWeight: 600 } }, slotHasModel(slot) ? "Modell vorhanden" : "Kein Modell")
          )
        )
      );

      card.appendChild(h("div", { style: { height: "10px" } }));

      // Action row (Open / Delete)
      card.appendChild(
        h(
          "div",
          { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h(
            "button",
            {
              className: "bp-btn",
              onclick: () => {
                // Kontext setzen (damit AssetLab weiß, welcher Slot aktiv ist)
                draft.selectedSlotByAssetId[asset.id] = slot.id;

                // UI-Context in app setzen (damit Reload + AssetLab Panel den Kontext kennen)
                this.store.update("app", (appDraft) => {
                  appDraft = asObj(appDraft);
                  appDraft.ui = asObj(appDraft.ui);
                  appDraft.ui.assetlab = asObj(appDraft.ui.assetlab);
                  appDraft.ui.assetlab.context = {
                    type: "projectAsset",
                    projectAssetId: asset.id,
                    slotId: slot.id,
                  };
                  return appDraft;
                });

                navigateToAssetLab({ projectAssetId: asset.id, slotId: slot.id });
              },
            },
            "🧰 In AssetLab öffnen"
          ),

          h(
            "button",
            {
              className: "bp-btn",
              onclick: () => {
                // Asset löschen
                draft.projectAssets.splice(assetIndex, 1);
                syncAndSave();
                this.rerender();
              },
            },
            "🗑️ Löschen"
          )
        )
      );

      card.appendChild(h("div", { style: { height: "12px" } }));

      // Slot UI
      const slotRow = h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "72px 1fr 42px",
          gap: "10px",
          alignItems: "center",
        },
      });

      slotRow.appendChild(h("div", { style: { opacity: 0.7 } }, "Slot:"));

      // Slot Select
      const select = h("select", {
        className: "bp-select",
        style: { width: "100%" },
        onchange: (ev) => {
          const newSlotId = ev.target.value;
          draft.selectedSlotByAssetId[asset.id] = newSlotId;

          // Kontext sofort in app spiegeln, damit AssetLab Panel "richtig" startet.
          this.store.update("app", (appDraft) => {
            appDraft = asObj(appDraft);
            appDraft.ui = asObj(appDraft.ui);
            appDraft.ui.assetlab = asObj(appDraft.ui.assetlab);
            appDraft.ui.assetlab.context = {
              type: "projectAsset",
              projectAssetId: asset.id,
              slotId: newSlotId,
            };
            return appDraft;
          });

          this.rerender();
        },
      });

      asset.slots.forEach((s) => {
        select.appendChild(h("option", { value: s.id, selected: s.id === slot.id }, s.name));
      });

      slotRow.appendChild(select);

      // Kleine "Chevron" / Platzhalter (UI-only)
      slotRow.appendChild(h("div", { style: { opacity: 0.4, textAlign: "center" } }, "⌄"));

      card.appendChild(slotRow);

      card.appendChild(h("div", { style: { height: "10px" } }));

      // Slot Name input
      const nameInput = h("input", {
        className: "bp-input",
        value: slot.name,
        placeholder: "Variante Name",
        oninput: (ev) => {
          slot.name = String(ev.target.value || "");
          syncToStore();
        },
      });

      card.appendChild(
        h(
          "div",
          { style: { display: "grid", gap: "6px" } },
          h("div", { style: { opacity: 0.7 } }, "Variante Name:"),
          nameInput
        )
      );

      card.appendChild(h("div", { style: { height: "8px" } }));

      // File info (read-only)
      card.appendChild(
        h(
          "div",
          { style: { display: "grid", gap: "6px" } },
          h("div", { style: { opacity: 0.7 } }, "Datei:"),
          h("div", { style: { wordBreak: "break-word", opacity: 0.85 } }, asStr(slot.lastImportName) || "–")
        )
      );

      card.appendChild(h("div", { style: { height: "12px" } }));

      // Slot actions (+ Slot, delete slot, export)
      const actions = h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } });

      actions.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            onclick: () => {
              asset.slots.push({
                id: makeId("PS"),
                name: `Variante ${asset.slots.length + 1}`,
                model: null,
                preset: { scale: 1, rotY: 0, offsetY: 0 },
                hasModel: false,
                lastImportName: "",
                updatedAt: "",
                lastAction: "",
                exportRef: null,
              });
              ensureSlots(asset);
              // neuen Slot selektieren
              const newSlot = asset.slots[asset.slots.length - 1];
              draft.selectedSlotByAssetId[asset.id] = newSlot.id;
              syncToStore();
              this.rerender();
            },
          },
          "+ Slot"
        )
      );

      actions.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            onclick: () => {
              if (asset.slots.length <= 1) return;
              const idx = asset.slots.findIndex((s) => s && s.id === slot.id);
              if (idx < 0) return;
              asset.slots.splice(idx, 1);
              ensureSlots(asset);

              // Auswahl reparieren
              const fallback = asset.slots[0];
              draft.selectedSlotByAssetId[asset.id] = fallback.id;

              syncToStore();
              this.rerender();
            },
          },
          "Slot löschen"
        )
      );

      actions.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            onclick: () => {
              // Export GLB im AssetLab ausführen lassen
              draft.selectedSlotByAssetId[asset.id] = slot.id;

              navigateToAssetLab({
                projectAssetId: asset.id,
                slotId: slot.id,
                pendingCmd: { type: "export", format: "glb", projectAssetId: asset.id, slotId: slot.id },
              });
            },
          },
          "⬇️ Export GLB"
        )
      );

      actions.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            onclick: () => {
              // Export GLTF im AssetLab ausführen lassen
              draft.selectedSlotByAssetId[asset.id] = slot.id;

              navigateToAssetLab({
                projectAssetId: asset.id,
                slotId: slot.id,
                pendingCmd: { type: "export", format: "gltf", projectAssetId: asset.id, slotId: slot.id },
              });
            },
          },
          "⬇️ Export GLTF"
        )
      );

      card.appendChild(actions);

      card.appendChild(h("div", { style: { height: "10px" } }));

      // Slot speichern (persist)
      card.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            onclick: () => {
              slot.updatedAt = nowIso();
              slot.lastAction = "manual save";
              syncAndSave();
              this.rerender();
            },
          },
          "💾 Slot speichern"
        )
      );

      root.appendChild(card);
    });
  }
}
