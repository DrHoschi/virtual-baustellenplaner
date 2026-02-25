/**
 * Baustellenplaner
 * Datei: ui/panels/ProjectAssetsPanel.js
 * Version: v2.0.0-clean-save (2026-02-25)
 *
 * Projekt → Assets
 * ---------------------------------------------------------------------------
 * CLEAN ARCHITECTURE:
 * - Keine direkte localStorage Nutzung
 * - Keine persistProjectSnapshot Funktion
 * - Persist ausschließlich über:
 *      this.bus.emit("ui:project:save")
 * - Panel arbeitet nur mit store.update()
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

const CANON_PATH = "projectAssets";

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

    draft.projectAssets.forEach(a => ensureSlots(a));
    return draft;
  }

  renderBody(root, draft) {

    const save = () => {
      this.bus.emit("ui:project:save");
    };

    const sync = () => {
      this.store.update("app", (appDraft) => {
        appDraft.project = appDraft.project || {};
        appDraft.project[CANON_PATH] = draft.projectAssets;
      });
      save();
    };

    // ----------------------------------------------------------------
    // Header
    // ----------------------------------------------------------------

    root.appendChild(
      h("div", { style: { marginBottom: "10px", opacity: ".7" } },
        `Assets im Projekt: ${draft.projectId}`
      )
    );

    const topBar = h("div", { style: { marginBottom: "12px" } });

    topBar.appendChild(
      h("button", {
        className: "bp-btn",
        onclick: () => {
          draft.projectAssets.push({
            id: makeId("PA"),
            name: "Dummy Asset",
            source: { kind: "upload" },
            slots: [],
          });
          sync();
          this.rerender();
        }
      }, "+ Dummy-Asset")
    );

    root.appendChild(topBar);

    // ----------------------------------------------------------------
    // Asset Cards
    // ----------------------------------------------------------------

    draft.projectAssets.forEach((asset) => {

      ensureSlots(asset);
      const slot = asset.slots[0];

      const card = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.1)",
          borderRadius: "8px",
          padding: "10px",
          marginBottom: "10px"
        }
      });

      card.appendChild(
        h("div", { style: { fontWeight: "600" } }, asset.name)
      );

      card.appendChild(
        h("div", { style: { fontSize: "12px", opacity: ".6" } },
          slotHasModel(slot) ? "🟢 Modell vorhanden" : "○ Kein Modell"
        )
      );

      // ---------------- Save Button ----------------

      card.appendChild(
        h("button", {
          className: "bp-btn",
          style: { marginTop: "8px" },
          onclick: () => {
            slot.updatedAt = nowIso();
            slot.lastAction = "manual save";
            sync();
            this.rerender();
          }
        }, "💾 Speichern")
      );

      root.appendChild(card);
    });
  }
}
