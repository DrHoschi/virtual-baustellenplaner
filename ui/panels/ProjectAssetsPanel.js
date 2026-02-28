/**
 * Baustellenplaner
 * Datei: ui/panels/ProjectAssetsPanel.js
 * Version: v2.2.0-assets-ui-catalog (2026-02-28)
 *
 * Projekt → Assets
 * ---------------------------------------------------------------------------
 * ZIELE ("B) UI aufgeräumt / keine Drift / keine Doppelquellen"):
 * - Dieses Panel schreibt NUR in den Store (store.update/store.set).
 * - Persistenz passiert NUR über den Save-Button:
 *     this.bus.emit("ui:project:save")
 *   (Loader verdrahtet das auf persistor.saveNow()).
 * - KEINE direkte localStorage Nutzung hier.
 * - KEINE eigenen Persist-Funktionen hier.
 *
 * Features in diesem Panel:
 * - Projekt-Export/Import (JSON) (für schnelle Backups / Restore)
 * - ProjectAssets-Liste mit Karten
 * - Slot/Varianten UI pro Asset:
 *   - Slot wählen (Dropdown)
 *   - Slot-Name ändern
 *   - + Slot / Slot löschen
 *   - Export GLB / Export GLTF (öffnet AssetLab 3D + optionaler Command-Payload)
 *   - "In AssetLab öffnen" (setzt Kontext + navigiert)
 *   - "Slot speichern" (stempelt updatedAt/lastAction und speichert)
 *
 * Hinweis:
 * - Die eigentliche GLB/GLTF-Export-Implementierung liegt im AssetLab iframe.
 * - Dieses Panel kann (und soll) keine Binärdaten aus IDB ziehen.
 *   Export-Buttons navigieren daher ins AssetLab und reichen einen optionalen
 *   Command weiter (falls AssetLab3DPanel das auswertet).
 */

/* ============================================================================
 * IMPORTS
 * ========================================================================== */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

// Canonical: ProjectAssets liegen im Projektobjekt.
// (Loader-Migration spiegelt ggf. zusätzlich nach app.settings.projectAssets,
//  aber dieses Panel behandelt "app.project.projectAssets" als Single Source of Truth.)
const CANON_PATH = "projectAssets";

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
  if (slot.model) return true;
  if (typeof slot.lastImportName === "string" && slot.lastImportName.trim()) return true;
  return false;
}

function ensureSlots(asset) {
  if (!asset || typeof asset !== "object") return;
  if (!Array.isArray(asset.slots)) asset.slots = [];

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
}

function firstSlotId(asset) {
  const slots = Array.isArray(asset?.slots) ? asset.slots : [];
  return slots[0]?.id || null;
}

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
  URL.revokeObjectURL(url);
}

async function pickJsonFile() {
  return await new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      try {
        const f = input.files && input.files[0];
        if (!f) return resolve(null);
        const txt = await f.text();
        const obj = JSON.parse(txt);
        resolve(obj);
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
   * Draft = UI-Arbeitskopie.
   * Wir ziehen aus app.project.projectAssets.
   */
  
  // ------------------------------------------------------------
  // Asset Catalog (Generic) – wird aus data/assets.catalog.v1.json geladen
  // ------------------------------------------------------------
  _ensureCatalogLoaded() {
    if (this._catalogState?.loaded) return;
    if (this._catalogState?.loading) return;

    this._catalogState = { loaded: false, loading: true, items: [], byId: new Map() };

    // NOTE: Wir laden defensiv. Falls die Datei fehlt, bleibt UI funktionsfähig.
    fetch("./data/assets.catalog.v1.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const items = Array.isArray(j?.items) ? j.items : [];
        const byId = new Map();
        for (const it of items) {
          if (it?.id) byId.set(String(it.id), it);
        }
        this._catalogState = { loaded: true, loading: false, items, byId };
        this.rerender();
      })
      .catch((e) => {
        console.warn("[ProjectAssetsPanel] Catalog load failed:", e);
        this._catalogState = { loaded: true, loading: false, items: [], byId: new Map() };
        this.rerender();
      });
  }

  _catalogItemTitle(id) {
    const it = this._catalogState?.byId?.get(String(id || "")) || null;
    return it?.title || it?.id || "";
  }

buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const project = app.project || {};
    const list = Array.isArray(project[CANON_PATH]) ? project[CANON_PATH] : [];

    const draft = {
      projectId: project.id || "",
      projectName: project.name || "",
      projectAssets: safeClone(list),
      // UI selection per assetId (damit Dropdown stabil bleibt)
      selectedSlotByAssetId: {},
    };

    draft.projectAssets.forEach((a) => {
      ensureSlots(a);
      draft.selectedSlotByAssetId[a.id] = firstSlotId(a);
    });

    return draft;
  }

  /**
   * Commit: Draft -> Store
   * - Nur Store ändern (keine Persistenz hier)
   * - Optional: store.project synchron halten, damit Debug/Snapshot konsistent ist.
   */
  commitDraftToStore(draft) {
    const nextList = safeClone(draft.projectAssets);

    // 1) app.project.projectAssets (Single Source)
    this.store.update("app", (app) => {
      app = app || {};
      app.project = app.project || {};
      app.project[CANON_PATH] = nextList;
      return app;
    });

    // 2) store.project spiegeln (kein "zweites" Datenmodell, nur Spiegel fürs Tooling)
    //    Loader-Migration sorgt zusätzlich für Konsistenz, falls noch alte Pfade existieren.
    this.store.update("project", (p) => {
      p = p || {};
      p[CANON_PATH] = nextList;
      return p;
    });
  }

  /**
   * Persistenz: NUR über Save-Event (Loader -> persistor.saveNow())
   */
  requestSave(reason = "manual") {
    try {
      this.bus.emit("ui:project:save", { reason });
    } catch {
      // sollte nicht crashen
    }
  }

  /**
   * Navigation helper: Setze Kontext + navigiere.
   */
  openInAssetLab({ projectAssetId, slotId, payload } = {}) {
    const ctx = {
      type: "projectAsset",
      projectAssetId: projectAssetId || null,
      slotId: slotId || null,
    };

    // Kontext im Store ablegen (damit AssetLab3DPanel es beim Mount findet)
    this.store.update("app", (app) => {
      app = app || {};
      app.ui = app.ui || {};
      app.ui.assetlab = app.ui.assetlab || {};
      app.ui.assetlab.context = ctx;

      // Optionaler "pendingCmd" (wird nur benutzt, wenn AssetLab3DPanel das auswertet).
      if (payload !== undefined) {
        app.ui.assetlab.pendingCmd = payload;
      }
      return app;
    });

    // Navigation via bus (Loader horcht auf ui:navigate)
    this.bus.emit("ui:navigate", {
      panel: "projectPanel:assetlab3d",
      context: ctx,
      payload,
    });
  }

  renderBody(root, draft) {
    // Catalog für Slot → AssetDef (paramPack/properties) laden (defensiv).
    this._ensureCatalogLoaded();
    // ---------------------------------------------------------------------
    // Header / Toolbar
    // ---------------------------------------------------------------------

    const headerRow = h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          marginBottom: "10px",
        },
      },
      h("div", { style: { opacity: ".8" } }, `Assets im Projekt: ${draft.projectId || "-"}`),
      h(
        "button",
        {
          className: "bp-btn",
          onclick: () => {
            // Draft -> Store -> Save
            this.commitDraftToStore(draft);
            this.requestSave("project-assets-save");
            this.rerender();
          },
        },
        "💾 Speichern"
      )
    );
    root.appendChild(headerRow);

    const topBar = h("div", {
      style: { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" },
    });

    // Export Projekt
    topBar.appendChild(
      h(
        "button",
        {
          className: "bp-btn",
          onclick: () => {
            const payload = {
              schema: "baustellenplaner.projectAssets.export.v1",
              exportedAt: nowIso(),
              project: { id: draft.projectId || "", name: draft.projectName || "" },
              projectAssets: draft.projectAssets,
            };
            const fn = `projectAssets_${draft.projectId || "unknown"}_${nowIso().replace(/[:.]/g, "-")}.json`;
            downloadJson(fn, payload);
          },
        },
        "⬇️ Export Projekt"
      )
    );

    // Import Projekt
    topBar.appendChild(
      h(
        "button",
        {
          className: "bp-btn",
          onclick: async () => {
            const obj = await pickJsonFile();
            if (!obj || typeof obj !== "object") return;

            // Wir akzeptieren:
            // A) unser Export-Format: { projectAssets: [...] }
            // B) direkt: [ ... ]
            const list = Array.isArray(obj.projectAssets) ? obj.projectAssets : Array.isArray(obj) ? obj : null;
            if (!list) return;

            draft.projectAssets = safeClone(list);
            draft.projectAssets.forEach((a) => ensureSlots(a));
            draft.selectedSlotByAssetId = {};
            draft.projectAssets.forEach((a) => {
              draft.selectedSlotByAssetId[a.id] = firstSlotId(a);
            });

            this.commitDraftToStore(draft);
            this.requestSave("project-assets-import");
            this.rerender();
          },
        },
        "⬆️ Import Projekt"
      )
    );

    // + Dummy-Asset
    topBar.appendChild(
      h(
        "button",
        {
          className: "bp-btn",
          onclick: () => {
            const id = makeId("PA");
            const a = { id, name: "Dummy Asset", source: { kind: "upload" }, slots: [] };
            ensureSlots(a);
            draft.projectAssets.push(a);
            draft.selectedSlotByAssetId[id] = firstSlotId(a);

            this.commitDraftToStore(draft);
            this.requestSave("project-assets-add");
            this.rerender();
          },
        },
        "+ Dummy-Asset"
      )
    );

    root.appendChild(topBar);

    // ---------------------------------------------------------------------
    // Asset Cards
    // ---------------------------------------------------------------------

    const list = Array.isArray(draft.projectAssets) ? draft.projectAssets : [];
    if (list.length === 0) {
      root.appendChild(
        h("div", { style: { opacity: ".7" } }, "Noch keine Project-Assets. Nutze '+ Dummy-Asset' oder 'Import Projekt'.")
      );
      return;
    }

    list.forEach((asset) => {
      ensureSlots(asset);

      // aktiven Slot via draft-selection
      const selectedSlotId = draft.selectedSlotByAssetId[asset.id] || firstSlotId(asset);
      let slot = (asset.slots || []).find((s) => s && s.id === selectedSlotId) || asset.slots[0];
      if (!slot) {
        ensureSlots(asset);
        slot = asset.slots[0];
        draft.selectedSlotByAssetId[asset.id] = slot.id;
      }

      const card = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.10)",
          borderRadius: "10px",
          padding: "12px",
          marginBottom: "12px",
          background: "rgba(255,255,255,.55)",
        },
      });

      // --- Title row ------------------------------------------------------
      const titleRow = h("div", { style: { display: "flex", justifyContent: "space-between", gap: "10px" } });

      const left = h(
        "div",
        {},
        h("div", { style: { fontWeight: 800, fontSize: "26px", lineHeight: "1.1" } }, asset.name || "(ohne Name)"),
        h("div", { style: { opacity: ".65", marginTop: "2px" } }, `Asset-ID: ${asset.id || "-"}`)
      );

      // Modell-Badge (basierend auf *irgendeinem* Slot)
      const anySlotHasModel = (asset.slots || []).some((s) => slotHasModel(s));
      const badge = h(
        "div",
        {
          style: {
            alignSelf: "flex-start",
            padding: "10px 14px",
            borderRadius: "18px",
            border: "1px solid rgba(0,0,0,.10)",
            background: "rgba(255,255,255,.85)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: 700,
          },
        },
        h("span", {
          style: {
            width: "14px",
            height: "14px",
            borderRadius: "999px",
            background: anySlotHasModel ? "#2ecc71" : "#bbb",
            display: "inline-block",
            boxShadow: "0 0 0 3px rgba(0,0,0,.05) inset",
          },
        }),
        anySlotHasModel ? "Modell vorhanden" : "Kein Modell"
      );

      titleRow.appendChild(left);
      titleRow.appendChild(badge);
      card.appendChild(titleRow);

      // --- Action row -----------------------------------------------------
      const actionRow = h("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" } });

      // ✅ Playwright sucht genau nach diesem Button-Label.
      actionRow.appendChild(
        h(
          "button",
          { className: "bp-btn", onclick: () => this.openInAssetLab({ projectAssetId: asset.id, slotId: slot.id }) },
          "🧰 In AssetLab öffnen"
        )
      );

      actionRow.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            onclick: () => {
              if (!confirm(`Asset wirklich löschen?\n\n${asset.name || asset.id}`)) return;
              draft.projectAssets = draft.projectAssets.filter((a) => a && a.id !== asset.id);
              delete draft.selectedSlotByAssetId[asset.id];
              this.commitDraftToStore(draft);
              this.requestSave("project-assets-delete-asset");
              this.rerender();
            },
          },
          "🗑️ Löschen"
        )
      );

      card.appendChild(actionRow);

      // --- Slot UI --------------------------------------------------------
      const slotWrap = h("div", { style: { marginTop: "14px" } });

      // Slot selection row
      const slotRow = h(
        "div",
        { style: { display: "grid", gridTemplateColumns: "70px 1fr", alignItems: "center", gap: "10px" } },
        h("div", { style: { opacity: ".7", fontWeight: 700 } }, "Slot:"),
        (() => {
          const sel = h("select", {
            className: "bp-input",
            style: { width: "100%" },
            onchange: (e) => {
              draft.selectedSlotByAssetId[asset.id] = e.target.value;
              this.rerender();
            },
          });
          (asset.slots || []).forEach((s) => sel.appendChild(h("option", { value: s.id }, s.name || s.id)));
          sel.value = slot.id;
          return sel;
        })()
      );
      slotWrap.appendChild(slotRow);

      // Slot name input
      slotWrap.appendChild(
        h(
          "div",
          { style: { marginTop: "8px" } },
          h("div", { style: { opacity: ".65", fontWeight: 700, marginBottom: "4px" } }, "Variante Name:"),
          h("input", { className: "bp-input", value: slot.name || "", oninput: (e) => (slot.name = e.target.value) })
        )
      );

      // File info
      slotWrap.appendChild(
        h(
          "div",
          { style: { marginTop: "8px" } },
          h("div", { style: { opacity: ".65", fontWeight: 700, marginBottom: "4px" } }, "Datei:"),
          h("div", { style: { opacity: ".85", wordBreak: "break-word" } }, (slot.lastImportName && String(slot.lastImportName)) || "–")
        )
      );


      // Catalog (deterministische Asset-Zuordnung: slot.catalogId)
      // - Wenn leer: Workarea versucht autoMatch (Pattern) und setzt ggf. beim Platzieren.
      slotWrap.appendChild(
        h(
          "div",
          { style: { marginTop: "8px" } },
          h("div", { style: { opacity: ".65", fontWeight: 700, marginBottom: "4px" } }, "Catalog:"),
          (() => {
            const st = this._catalogState || {};
            const sel = h("select", {
              className: "bp-input",
              style: { width: "100%" },
              onchange: (e) => {
                const v = String(e.target.value || "").trim();
                if (!v) delete slot.catalogId;
                else slot.catalogId = v;
              },
            });

            // Leer = Auto
            sel.appendChild(h("option", { value: "" }, "(auto – anhand Dateiname/Pattern)"));

            (st.items || []).forEach((it) => {
              sel.appendChild(h("option", { value: it.id }, `${it.title || it.id}`));
            });

            sel.value = slot.catalogId ? String(slot.catalogId) : "";
            return sel;
          })(),
          slot.catalogId
            ? h("div", { style: { marginTop: "4px", opacity: ".75", fontSize: "12px" } }, `Aktiv: ${this._catalogItemTitle(slot.catalogId)}`)
            : h("div", { style: { marginTop: "4px", opacity: ".55", fontSize: "12px" } }, "Tipp: Für 100% deterministisch -> Catalog auswählen.")
        )
      );


      // Thumbnail (optional, project-bound via slot.thumbnail.dataUrl)
      // - Größe: 96px (kompakt) – Bild soll das Feld möglichst ausfüllen
      // - Quelle: slot.thumbnail.dataUrl (wird vom AssetLab3DPanel gespeichert)
      const _thumbUrl = (slot && slot.thumbnail && typeof slot.thumbnail.dataUrl === "string") ? slot.thumbnail.dataUrl : "";
      slotWrap.appendChild(
        h(
          "div",
          { style: { marginTop: "8px" } },
          h("div", { style: { opacity: ".65", fontWeight: 700, marginBottom: "4px" } }, "Thumbnail:"),
          _thumbUrl
            ? h("img", {
                src: _thumbUrl,
                alt: "thumbnail",
                style: {
                  width: "96px",
                  height: "96px",
                  objectFit: "cover",
                  borderRadius: "12px",
                  border: "1px solid rgba(0,0,0,.10)",
                  background: "rgba(0,0,0,.06)",
                  display: "block",
                },
              })
            : h(
                "div",
                {
                  style: {
                    width: "96px",
                    height: "96px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "12px",
                    border: "1px dashed rgba(0,0,0,.18)",
                    background: "rgba(0,0,0,.02)",
                    opacity: ".6",
                    fontSize: "12px",
                  },
                },
                "–"
              )
        )
      );

      // Slot buttons row
      const slotBtnRow = h("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" } });

      slotBtnRow.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            onclick: () => {
              const idx = (asset.slots || []).length + 1;
              const newSlot = {
                id: makeId("PS"),
                name: `Variante ${idx}`,
                model: null,
                preset: { scale: 1, rotY: 0, offsetY: 0 },
                hasModel: false,
                lastImportName: "",
                updatedAt: "",
                lastAction: "created",
                exportRef: null,
              };
              asset.slots.push(newSlot);
              draft.selectedSlotByAssetId[asset.id] = newSlot.id;

              this.commitDraftToStore(draft);
              this.requestSave("project-assets-add-slot");
              this.rerender();
            },
          },
          "+ Slot"
        )
      );

      slotBtnRow.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            onclick: () => {
              if ((asset.slots || []).length <= 1) return;
              if (!confirm(`Slot wirklich löschen?\n\n${slot.name || slot.id}`)) return;
              asset.slots = (asset.slots || []).filter((s) => s && s.id !== slot.id);
              draft.selectedSlotByAssetId[asset.id] = firstSlotId(asset);

              this.commitDraftToStore(draft);
              this.requestSave("project-assets-delete-slot");
              this.rerender();
            },
          },
          "Slot löschen"
        )
      );

      // Export GLB
      slotBtnRow.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            onclick: () => this.openInAssetLab({ projectAssetId: asset.id, slotId: slot.id, payload: { type: "export", format: "glb" } }),
          },
          "⬇️ Export GLB"
        )
      );

      // Export GLTF
      slotBtnRow.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            onclick: () => this.openInAssetLab({ projectAssetId: asset.id, slotId: slot.id, payload: { type: "export", format: "gltf" } }),
          },
          "⬇️ Export GLTF"
        )
      );

      slotWrap.appendChild(slotBtnRow);

      // Slot speichern
      slotWrap.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            style: { marginTop: "10px" },
            onclick: () => {
              // Wir stempeln bewusst NUR Metadaten.
              // (Das Model liegt im AssetLab/IDB; ProjectAssets hält nur Referenzen/Info.)
              slot.updatedAt = nowIso();
              slot.lastAction = "manual save";

              this.commitDraftToStore(draft);
              this.requestSave("project-assets-slot-save");
              this.rerender();
            },
          },
          "💾 Slot speichern"
        )
      );

      card.appendChild(slotWrap);
      root.appendChild(card);
    });
  }
}
