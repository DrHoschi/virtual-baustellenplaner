/**
 * Baustellenplaner
 * Datei: ui/panels/ProjectAssetsPanel.js
 * Version: v2.1.0-open-assetlab-button + cache-clear (2026-02-25)
 *
 * Projekt → Assets
 * ---------------------------------------------------------------------------
 * Ziel:
 * - Playwright UI-Wiring Test erwartet Button: "In AssetLab öffnen"
 * - Öffnet AssetLab mit korrekt gesetztem Kontext (projectAssetId + slotId)
 *
 * Architektur:
 * - KEINE direkte Project-Snapshot Persistenz im Panel (kein localStorage projectfile/project:)
 * - Persist erfolgt nur über Save-Button Flow im Host:
 *     this.bus.emit("ui:project:save")
 *
 * Extra:
 * - "Cache löschen" pro Slot: löscht nur den Model-Buffer LS-Fallback
 *   (baustellenplaner:modelbuf:v1:<assetId>:<slotId>)
 */

import { PanelBase } from "./PanelBase.js";
import { h, clear } from "../components/ui-dom.js";

const CANON_PATH = "projectAssets";

/* ============================================================================
 * Helpers
 * ========================================================================== */

function safeClone(obj) {
  try { return structuredClone(obj); }
  catch { return JSON.parse(JSON.stringify(obj)); }
}

function makeId(prefix = "PA") {
  return `${prefix}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function slotHasModel(slot) {
  if (!slot) return false;
  if (slot.hasModel === true) return true;
  if (slot.exportRef) return true;
  if (slot.lastImportName) return true;
  if (slot.model) return true;
  return false;
}

function ensureSlots(asset) {
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

function lsModelKey(projectAssetId, slotId) {
  // Muss identisch zum AssetLab3DPanel sein (LS-Fallback nur für Model Buffer).
  return `baustellenplaner:modelbuf:v1:${projectAssetId}:${slotId}`;
}

function safeLsRemove(key) {
  try { localStorage.removeItem(key); return true; } catch { return false; }
}

/* ============================================================================
 * Panel
 * ========================================================================== */

export class ProjectAssetsPanel extends PanelBase {

  getTitle() {
    return "Projekt – Assets";
  }

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const project = app.project || {};
    const list = Array.isArray(project[CANON_PATH]) ? project[CANON_PATH] : [];

    const draft = {
      projectId: project.id || "",
      projectAssets: safeClone(list),
    };

    draft.projectAssets.forEach((a) => ensureSlots(a));
    return draft;
  }

  renderBody(root, draft) {
    clear(root);

    // ----------------------------------------------------------------
    // Persist nur per Event (Save-Button only)
    // ----------------------------------------------------------------
    const requestSave = (reason = "project-assets") => {
      try { this.bus.emit("ui:project:save", { reason }); } catch {}
      // optionaler Alias – falls irgendwo noch "ui:save" existiert
      try { this.bus.emit("ui:save", { reason }); } catch {}
    };

    // Draft -> Store spiegeln (ohne direktes localStorage)
    const syncToStore = (reason = "sync") => {
      this.store.update("app", (appDraft) => {
        appDraft.project = appDraft.project || {};
        appDraft.project[CANON_PATH] = draft.projectAssets;
      });
      requestSave(reason);
    };

    // Öffnen im AssetLab (über loader.js ui:navigate Handler)
    const openInAssetLab = (assetId, slotId) => {
      const context = {
        type: "projectAsset",
        projectAssetId: assetId,
        slotId: slotId
      };

      // loader.js lauscht auf ui:navigate:
      // - setzt app.ui.assetlab.context = ctx
      // - switchView(panelId)
      this.bus.emit("ui:navigate", {
        panel: "projectPanel:assetlab3d",
        payload: { context }
      });
    };

    // ----------------------------------------------------------------
    // Header
    // ----------------------------------------------------------------
    root.appendChild(
      h("div", { style: { marginBottom: "10px", opacity: ".75" } },
        `Assets im Projekt: ${draft.projectId || "(ohne ID)"}`
      )
    );

    const topBar = h("div", { style: { display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" } });

    topBar.appendChild(
      h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          draft.projectAssets.push({
            id: makeId("PA"),
            name: "Dummy Asset",
            source: { kind: "upload" },
            slots: [],
          });
          draft.projectAssets.forEach((a) => ensureSlots(a));
          syncToStore("addDummyAsset");
          this.rerender();
        }
      }, "+ Dummy-Asset")
    );

    root.appendChild(topBar);

    // ----------------------------------------------------------------
    // Asset Cards
    // ----------------------------------------------------------------
    if (!Array.isArray(draft.projectAssets) || draft.projectAssets.length === 0) {
      root.appendChild(
        h("div", { style: { opacity: ".7", fontSize: "13px" } },
          "Noch keine Projekt-Assets vorhanden."
        )
      );
      return;
    }

    draft.projectAssets.forEach((asset) => {
      ensureSlots(asset);

      const card = h("div", {
        style: {
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: "10px",
          padding: "10px",
          marginBottom: "10px",
          background: "rgba(255,255,255,.02)"
        }
      });

      // Titel
      card.appendChild(
        h("div", { style: { fontWeight: "650", marginBottom: "6px" } },
          asset.name || "(ohne Name)"
        )
      );

      // Slot-Liste (aktuell minimal: wir zeigen alle Slots untereinander)
      const slotsWrap = h("div", { style: { display: "grid", gap: "8px" } });

      asset.slots.forEach((slot) => {
        const row = h("div", {
          style: {
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
            padding: "8px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,.08)"
          }
        });

        const meta = h("div", { style: { minWidth: "220px" } },
          h("div", { style: { fontWeight: "600" } }, slot.name || "Variante"),
          h("div", { style: { fontSize: "12px", opacity: ".70" } },
            slotHasModel(slot)
              ? `🟢 Modell: ${slot.lastImportName || "(unbenannt)"}`
              : "○ Kein Modell"
          ),
          h("div", { style: { fontSize: "12px", opacity: ".55" } },
            slot.updatedAt ? `Updated: ${slot.updatedAt}` : ""
          )
        );
        row.appendChild(meta);

        // ✅ Button: In AssetLab öffnen (TEST erwartet genau diesen Text)
        row.appendChild(
          h("button", {
            className: "bp-btn",
            type: "button",
            onclick: () => openInAssetLab(asset.id, slot.id)
          }, "In AssetLab öffnen")
        );

        // 💾 Speichern (optional, aber du nutzt das ja)
        row.appendChild(
          h("button", {
            className: "bp-btn",
            type: "button",
            onclick: () => {
              slot.updatedAt = nowIso();
              slot.lastAction = "manual save";
              syncToStore("manualSave");
              this.rerender();
            }
          }, "💾 Speichern")
        );

        // 🧹 Cache löschen (nur LS-Fallback für MODEL BUFFER)
        row.appendChild(
          h("button", {
            className: "bp-btn",
            type: "button",
            title: "Löscht nur den iOS/localStorage Fallback-Cache für dieses Slot-Modell (nicht das Projekt-Asset).",
            onclick: () => {
              const key = lsModelKey(asset.id, slot.id);
              const ok = safeLsRemove(key);
              // Cache löschen verändert NICHT das Projekt – kein Save nötig.
              // (Optional könntest du trotzdem speichern, aber es wäre semantisch falsch.)
              if (ok) {
                // UI Feedback: wir markieren "lastAction" lokal, ohne Persist-Zwang
                slot.lastAction = "cache cleared (ls)";
                slot.updatedAt = nowIso();
                // Das sind Meta-Daten im Projekt – wenn du willst, dass die Info drin steht, speichern wir.
                // Ich mache es hier bewusst ON, weil du es im UI sehen willst.
                syncToStore("cacheClearLS");
                this.rerender();
              } else {
                // Falls localStorage zickt
                slot.lastAction = "cache clear failed";
                this.rerender();
              }
            }
          }, "🧹 Cache löschen")
        );

        slotsWrap.appendChild(row);
      });

      card.appendChild(slotsWrap);
      root.appendChild(card);
    });
  }
}

export default ProjectAssetsPanel;
