/**
 * ui/panels/AssetLibraryPanel.js
 * Version: v1.1.0-project-assets-open-assetlab (2026-02-07)
 *
 * Projekt → Projekt-Assets (Asset Library Panel)
 * =============================================================================
 * Zweck:
 * - Zeigt die im aktuellen Projekt verwendeten Assets (Projekt-Inventar)
 * - Jedes Asset kann einen PresetTransform (Scale/Rotation/Offset) besitzen
 * - Von hier aus kann ein Asset im AssetLab 3D geöffnet werden (Kontext: Projekt-Asset)
 *
 * Architektur:
 * - Bibliotheken (global) = "Quelle der Wahrheit"
 * - Projekt-Assets = Referenzen + Projekt-Overrides
 * - AssetLab 3D = Werkzeug (Viewer/Import/Export), wird in Kontext geöffnet
 *
 * Dieses Patch:
 * - Rename im Menü passiert in JSON (menu.registry.json + plugins/mod.assets.local.json)
 * - Hier: pro Asset ein Button "In AssetLab öffnen"
 *   → setzt app.ui.assetlabContext = { mode:"project", projectAssetId }
 *   → navigiert zu panel:projectPanel:assetlab3d
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";
import { Section } from "../components/Section.js";
import { FormField } from "../components/FormField.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureProjectAssets(project) {
  project = project || {};
  if (!project.assets || typeof project.assets !== "object") project.assets = { items: [], folders: [], settings: {} };
  if (!Array.isArray(project.assets.items)) project.assets.items = [];
  return project;
}

function ensurePreset(asset) {
  asset.presetTransform = asset.presetTransform || { pos:[0,0,0], rot:[0,0,0], scale:[1,1,1] };
  const pt = asset.presetTransform;
  if (!Array.isArray(pt.pos)) pt.pos = [0,0,0];
  if (!Array.isArray(pt.rot)) pt.rot = [0,0,0];
  if (!Array.isArray(pt.scale)) pt.scale = [1,1,1];
  return pt;
}

function uid(prefix = "PA") {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}-${Date.now().toString(16)}`;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export class AssetLibraryPanel extends PanelBase {
  getTitle() { return "Projekt – Projekt-Assets"; }

  getDescription() {
    const pid = this.store.get("app")?.project?.id || "";
    return pid ? `Assets im Projekt: ${pid}` : "";
  }

  getToolbarConfig() {
    // Wir nutzen PanelBase-Apply/Reset nicht – Assets sind Live-Daten.
    return {
      showReset: false,
      showApply: false,
      note: "Projekt-Assets = im Projekt verwendete Assets (Referenz + PresetTransform)."
    };
  }

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    app.project = ensureProjectAssets(app.project || {});
    return {
      // Wir arbeiten direkt aus dem Store (keine separate Draft-Kopie).
      count: app.project.assets.items.length
    };
  }

  renderBody(root, draft) {
    const app = this.store.get("app") || {};
    const project = ensureProjectAssets(app.project || {});
    const items = project.assets.items || [];

    // --- Kopf-Aktionen ---
    const actions = h("div", { style: { display:"flex", gap:"8px", flexWrap:"wrap", margin:"0 0 10px" } });

    const btnAddDummy = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => this._addDummyAsset()
    }, "+ Dummy-Asset");

    const btnOpenAssetLabStandalone = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => this._openAssetLabStandalone()
    }, "↗︎ AssetLab öffnen (Standalone)");

    actions.appendChild(btnAddDummy);
    actions.appendChild(btnOpenAssetLabStandalone);

    // --- Liste ---
    const list = h("div", { style: { display:"grid", gap:"10px" } });

    if (!items.length) {
      list.appendChild(
        h("div", { style: { opacity: ".75", padding:"10px", border:"1px dashed rgba(255,255,255,.15)", borderRadius:"10px" } },
          "Noch keine Projekt-Assets. Importiere etwas im AssetLab oder lege testweise ein Dummy-Asset an."
        )
      );
    } else {
      for (const asset of items) {
        list.appendChild(this._renderAssetCard(asset));
      }
    }

    // --- Layout rendern ---
    root.appendChild(actions);
    root.appendChild(
      Section({
        title: "Projekt-Assets",
        description: "Assets, die dieses Projekt nutzt (inkl. projekt-spezifischer PresetTransforms).",
        children: [list]
      })
    );
  }

  // -------------------------------------------------------------------------
  // UI: Asset Card
  // -------------------------------------------------------------------------

  _renderAssetCard(asset) {
    const pt = ensurePreset(asset);

    const head = h("div", { style: { display:"flex", gap:"10px", alignItems:"baseline", flexWrap:"wrap" } },
      h("b", {}, asset.name || "(ohne Name)"),
      h("span", { style:{ opacity:".65", fontSize:"12px" } }, asset.id || "")
    );

    // Buttons
    const btnRow = h("div", { style:{ display:"flex", gap:"8px", flexWrap:"wrap", marginTop:"8px" } });

    const btnOpen = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => this._openInAssetLab(asset.id)
    }, "🧰 In AssetLab öffnen");

    const btnDelete = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => this._deleteAsset(asset.id)
    }, "🗑 Löschen");

    btnRow.appendChild(btnOpen);
    btnRow.appendChild(btnDelete);

    // PresetTransform Felder (kurz)
    const fields = h("div", { style: { display:"flex", gap:"10px", flexWrap:"wrap", marginTop:"10px" } });

    fields.appendChild(FormField({
      label: "Scale (uniform)",
      type: "number",
      step: 0.01,
      value: pt.scale?.[0] ?? 1,
      onInput: (v) => this._patchPreset(asset.id, { scale: [Number(v)||1, Number(v)||1, Number(v)||1] })
    }));

    fields.appendChild(FormField({
      label: "Offset Y",
      type: "number",
      step: 0.01,
      value: pt.pos?.[1] ?? 0,
      onInput: (v) => this._patchPreset(asset.id, { pos: [0, Number(v)||0, 0] })
    }));

    // Hinweis zur Quelle (optional)
    const src = asset.source?.libraryAssetId ? `Quelle: Bibliothek ${asset.source.libraryAssetId}` : "Quelle: Upload/Standalone";
    const hint = h("div", { style:{ opacity:".7", fontSize:"12px", marginTop:"6px" } }, src);

    return Section({
      title: asset.name || "Projekt-Asset",
      description: "PresetTransform ist projekt-spezifisch. Öffnen in AssetLab zeigt Kontext + numerische Preset-Felder.",
      children: [head, hint, btnRow, fields]
    });
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  _addDummyAsset() {
    this.store.update("app", (app) => {
      app.project = ensureProjectAssets(app.project || {});
      app.project.assets.items.push({
        id: uid("PA"),
        name: "Dummy Asset",
        source: { kind: "dummy" },
        presetTransform: { pos:[0,0,0], rot:[0,0,0], scale:[1,1,1] },
        meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      });
      return app;
    });
    this.rerender();
  }

  _deleteAsset(assetId) {
    this.store.update("app", (app) => {
      app.project = ensureProjectAssets(app.project || {});
      app.project.assets.items = (app.project.assets.items || []).filter(a => a && a.id !== assetId);
      return app;
    });
    this.rerender();
  }

  _patchPreset(assetId, patch) {
    this.store.update("app", (app) => {
      app.project = ensureProjectAssets(app.project || {});
      const a = (app.project.assets.items || []).find(x => x && x.id === assetId);
      if (!a) return app;

      const pt = ensurePreset(a);
      if (patch.pos) pt.pos = patch.pos;
      if (patch.rot) pt.rot = patch.rot;
      if (patch.scale) pt.scale = patch.scale;

      a.meta = a.meta || {};
      a.meta.updatedAt = new Date().toISOString();

      return app;
    });
  }

  _openInAssetLab(projectAssetId) {
    // 1) Kontext im Store setzen
    this.store.update("app", (app) => {
      app.ui = app.ui || {};
      app.ui.assetlabContext = { mode: "project", projectAssetId };
      return app;
    });

    // 2) Navigieren (Panel-Key)
    this.bus.emit("ui:menu:select", { moduleKey: "panel:projectPanel:assetlab3d" });
  }

  _openAssetLabStandalone() {
    // Kontext entfernen
    this.store.update("app", (app) => {
      app.ui = app.ui || {};
      app.ui.assetlabContext = null;
      return app;
    });

    this.bus.emit("ui:menu:select", { moduleKey: "panel:projectPanel:assetlab3d" });
  }
}
