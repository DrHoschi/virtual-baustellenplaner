/**
 * ui/panels/AssetLibraryPanel.js
 * PROJECT-UI-03C – Global Library Catalog
 * R2F-02A – Minimal Global Asset Library
 */
import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

function safeClone(value) {
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value)); }
}

function makeProjectAssetId() {
  return `PA-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export class AssetLibraryPanel extends PanelBase {
  getTitle() { return "Bibliothekskatalog"; }
  getDescription() { return "Globaler, projektunabhängiger Asset-Katalog."; }
  getToolbarConfig() { return { showReset: false, showApply: false, note: "Globaler Katalog" }; }
  buildDraftFromStore() { return {}; }

  _ensureLibraryLoaded() {
    if (this._libraryState?.loaded || this._libraryState?.loading) return;
    this._libraryState = { loaded: false, loading: true, libraries: [], error: "" };
    fetch("./data/global-asset-library.v1.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        const libraries = Array.isArray(j?.libraries) ? j.libraries : [];
        this._libraryState = { loaded: true, loading: false, libraries, error: "" };
        this.rerender();
      })
      .catch((e) => {
        console.warn("[AssetLibraryPanel] Global library load failed:", e);
        this._libraryState = { loaded: true, loading: false, libraries: [], error: String(e?.message || e) };
        this.rerender();
      });
  }

  _projectAssets() {
    const app = this.store.get("app") || {};
    return Array.isArray(app?.project?.projectAssets) ? app.project.projectAssets : [];
  }

  _isImported(libraryId, entryId) {
    return this._projectAssets().some((asset) =>
      asset?.source?.kind === "library" &&
      String(asset?.source?.libraryId || "") === String(libraryId || "") &&
      String(asset?.source?.entryId || "") === String(entryId || "")
    );
  }

  _importEntry(library, entry) {
    const libraryId = String(library?.libraryId || "").trim();
    const entryId = String(entry?.entryId || "").trim();
    if (!libraryId || !entryId || !entry?.projectAsset || this._isImported(libraryId, entryId)) return false;

    const projectAsset = safeClone(entry.projectAsset);
    projectAsset.id = makeProjectAssetId();
    projectAsset.name = String(projectAsset.name || entry.title || entryId);
    projectAsset.source = { kind: "library", libraryId, entryId };
    if (!Array.isArray(projectAsset.slots)) projectAsset.slots = [];

    this.store.update("app", (app) => {
      app = app || {};
      app.project = app.project || {};
      const current = Array.isArray(app.project.projectAssets) ? app.project.projectAssets : [];
      app.project.projectAssets = [...current, projectAsset];
      return app;
    });

    // Existing project-save authority; no second persistence path.
    this.bus?.emit?.("ui:project:save", { reason: "r2f-02a-library-import" });
    this.rerender();
    return true;
  }

  renderBody(root) {
    this._ensureLibraryLoaded();
    const state = this._libraryState || { loaded: false, loading: true, libraries: [], error: "" };

    root.appendChild(
      h("div", { className: "bp-card", "data-r2f-02a-library": "true" },
        h("div", { className: "bp-card__title" }, "Globaler Bibliothekskatalog"),
        h("div", { className: "bp-card__desc" },
          "Globale Assets können als normale ProjectAssets in das aktuelle Projekt übernommen werden."
        )
      )
    );

    if (state.loading) {
      root.appendChild(h("div", { style: { opacity: ".7", marginTop: "10px" } }, "Bibliothek wird geladen …"));
      return;
    }
    if (state.error) {
      root.appendChild(h("div", { style: { opacity: ".7", marginTop: "10px" } }, "Bibliothek konnte nicht geladen werden."));
      return;
    }

    for (const library of state.libraries) {
      const libraryId = String(library?.libraryId || "");
      const section = h("div", { className: "bp-card", "data-library-id": libraryId, style: { marginTop: "12px" } },
        h("div", { className: "bp-card__title" }, library?.title || libraryId)
      );

      for (const entry of (Array.isArray(library?.entries) ? library.entries : [])) {
        const entryId = String(entry?.entryId || "");
        const imported = this._isImported(libraryId, entryId);
        section.appendChild(
          h("div", {
            "data-library-entry-id": entryId,
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginTop: "10px" }
          },
            h("div", { style: { minWidth: "0" } },
              h("div", { style: { fontWeight: "800" } }, entry?.title || entryId),
              h("div", { style: { opacity: ".65", fontSize: "12px" } }, `${libraryId} / ${entryId}`)
            ),
            h("button", {
              className: "bp-btn",
              "data-r2f-02a-import": "true",
              disabled: imported,
              onclick: () => this._importEntry(library, entry)
            }, imported ? "Bereits im Projekt" : "Ins Projekt übernehmen")
          )
        );
      }
      root.appendChild(section);
    }
  }
}
