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

function shortId(id, keep = 12) {
  const txt = String(id || "").trim();
  if (!txt) return "–";
  if (txt.length <= keep + 3) return txt;
  return `${txt.slice(0, keep)}…`;
}

function fileLabel(name) {
  const txt = String(name || "").trim();
  return txt || "Noch keine Datei";
}

function modelStatusLabel(hasModel) {
  return hasModel ? "Modell" : "Leer";
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

  /**
   * Thumbnail-Quelle für Projekt-Assets.
   *
   * WICHTIG: Im Projekt-Assets Panel wollen wir die "schöne" Perspektive/Isometrie.
   * Die Top-View ist NUR für das 2D-Layout (Workarea Viewport) gedacht.
   */
  _pickSlotThumbUrl(slot, { preferredView = "perspective" } = {}) {
    const t = slot?.thumbnail;
    if (!t) return "";

    // 1) preferredView (z.B. "perspective")
    const pv = t?.views?.[preferredView]?.dataUrl;
    if (typeof pv === "string" && pv.startsWith("data:image")) return pv;

    // 2) defaultView
    const defKey = t?.defaultView;
    const def = defKey ? t?.views?.[defKey]?.dataUrl : null;
    if (typeof def === "string" && def.startsWith("data:image")) return def;

    // 3) perspective fallback
    const persp = t?.views?.perspective?.dataUrl;
    if (typeof persp === "string" && persp.startsWith("data:image")) return persp;

    // 4) legacy
    const legacy = t?.dataUrl;
    if (typeof legacy === "string" && legacy.startsWith("data:image")) return legacy;

    return "";
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

      // Aktiven Slot via Draft-Selection bestimmen.
      const selectedSlotId = draft.selectedSlotByAssetId[asset.id] || firstSlotId(asset);
      let slot = (asset.slots || []).find((s) => s && s.id === selectedSlotId) || asset.slots[0];
      if (!slot) {
        ensureSlots(asset);
        slot = asset.slots[0];
        draft.selectedSlotByAssetId[asset.id] = slot.id;
      }

      const anySlotHasModel = (asset.slots || []).some((s) => slotHasModel(s));
      const activeSlotHasModel = slotHasModel(slot);
      const _thumbUrl = this._pickSlotThumbUrl(slot, { preferredView: "perspective" });

      const card = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.10)",
          borderRadius: "16px",
          padding: "14px",
          marginBottom: "14px",
          background: "rgba(255,255,255,.62)",
          boxShadow: "0 8px 22px rgba(15,23,42,.04)",
          overflow: "hidden",
        },
      });

      // -------------------------------------------------------------------
      // Asset-Kopf: Name + Status kompakt, ohne mobile Überhänge.
      // -------------------------------------------------------------------
      const titleRow = h("div", {
        style: {
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        },
      });

      titleRow.appendChild(
        h(
          "div",
          { style: { minWidth: "0", flex: "1 1 230px" } },
          h("div", { style: { fontWeight: 850, fontSize: "clamp(24px, 6vw, 34px)", lineHeight: "1.05" } }, asset.name || "(ohne Name)"),
          h(
            "div",
            { style: { opacity: ".62", marginTop: "6px", fontSize: "14px", wordBreak: "break-word" } },
            `Asset-ID: ${shortId(asset.id, 18)}`
          )
        )
      );

      titleRow.appendChild(
        h(
          "div",
          {
            title: anySlotHasModel ? "Mindestens ein Slot enthält ein Modell" : "Noch kein Modell gespeichert",
            style: {
              flex: "0 0 auto",
              padding: "9px 12px",
              borderRadius: "999px",
              border: "1px solid rgba(0,0,0,.10)",
              background: "rgba(255,255,255,.88)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 800,
              lineHeight: "1",
              whiteSpace: "nowrap",
            },
          },
          h("span", {
            style: {
              width: "12px",
              height: "12px",
              borderRadius: "999px",
              background: anySlotHasModel ? "#2ecc71" : "#bbb",
              display: "inline-block",
              boxShadow: "0 0 0 3px rgba(0,0,0,.05) inset",
            },
          }),
          modelStatusLabel(anySlotHasModel)
        )
      );

      card.appendChild(titleRow);

      // -------------------------------------------------------------------
      // Hauptbereich: links Slot-Daten, rechts Thumbnail/Status.
      // auto-fit sorgt dafür, dass es auf iPhone sauber untereinander fällt.
      // -------------------------------------------------------------------
      const mainGrid = h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          alignItems: "start",
          marginTop: "14px",
        },
      });

      const slotInfoBox = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.08)",
          borderRadius: "14px",
          padding: "12px",
          background: "rgba(255,255,255,.52)",
          minWidth: "0",
        },
      });

      slotInfoBox.appendChild(
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "74px minmax(0,1fr)",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
            },
          },
          h("div", { style: { opacity: ".68", fontWeight: 800 } }, "Slot"),
          (() => {
            const sel = h("select", {
              className: "bp-input",
              style: { width: "100%" },
              onchange: (e) => {
                draft.selectedSlotByAssetId[asset.id] = e.target.value;
                this.rerender();
              },
            });
            (asset.slots || []).forEach((slt) => sel.appendChild(h("option", { value: slt.id }, slt.name || slt.id)));
            sel.value = slot.id;
            return sel;
          })()
        )
      );

      slotInfoBox.appendChild(
        h(
          "div",
          { style: { marginTop: "10px" } },
          h("div", { style: { opacity: ".68", fontWeight: 800, marginBottom: "5px" } }, "Variantenname"),
          h("input", {
            className: "bp-input",
            value: slot.name || "",
            style: { width: "100%" },
            oninput: (e) => (slot.name = e.target.value),
          })
        )
      );

      slotInfoBox.appendChild(
        h(
          "div",
          { style: { marginTop: "10px" } },
          h("div", { style: { opacity: ".68", fontWeight: 800, marginBottom: "5px" } }, "Datei"),
          h(
            "div",
            {
              style: {
                opacity: activeSlotHasModel ? ".88" : ".55",
                wordBreak: "break-word",
                fontSize: "14px",
                lineHeight: "1.25",
              },
            },
            fileLabel(slot.lastImportName)
          )
        )
      );

      // Catalog (deterministische Asset-Zuordnung: slot.catalogId).
      slotInfoBox.appendChild(
        h(
          "div",
          { style: { marginTop: "10px" } },
          h("div", { style: { opacity: ".68", fontWeight: 800, marginBottom: "5px" } }, "Catalog"),
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

            sel.appendChild(h("option", { value: "" }, "Auto"));
            (st.items || []).forEach((it) => {
              sel.appendChild(h("option", { value: it.id }, `${it.title || it.id}`));
            });
            sel.value = slot.catalogId ? String(slot.catalogId) : "";
            return sel;
          })(),
          slot.catalogId
            ? h("div", { style: { marginTop: "5px", opacity: ".75", fontSize: "12px" } }, `Aktiv: ${this._catalogItemTitle(slot.catalogId)}`)
            : h("div", { style: { marginTop: "5px", opacity: ".50", fontSize: "12px" } }, "Auto anhand Dateiname/Pattern")
        )
      );

      mainGrid.appendChild(slotInfoBox);

      const previewBox = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.08)",
          borderRadius: "14px",
          padding: "12px",
          background: "rgba(255,255,255,.52)",
          minWidth: "0",
        },
      });

      previewBox.appendChild(h("div", { style: { opacity: ".68", fontWeight: 800, marginBottom: "8px" } }, "Vorschau"));
      previewBox.appendChild(
        _thumbUrl
          ? h(
              "div",
              {
                style: {
                  width: "132px",
                  height: "132px",
                  borderRadius: "16px",
                  border: "1px solid rgba(0,0,0,.10)",
                  background: "rgba(0,0,0,.045)",
                  overflow: "hidden",
                },
              },
              h("img", {
                src: _thumbUrl,
                alt: "thumbnail",
                style: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                },
              })
            )
          : h(
              "div",
              {
                style: {
                  width: "132px",
                  height: "132px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "16px",
                  border: "1px dashed rgba(0,0,0,.18)",
                  background: "rgba(0,0,0,.02)",
                  opacity: ".6",
                  fontSize: "13px",
                },
              },
              "kein Bild"
            )
      );

      previewBox.appendChild(
        h(
          "div",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "10px",
              padding: "7px 10px",
              borderRadius: "999px",
              background: activeSlotHasModel ? "rgba(46,204,113,.12)" : "rgba(0,0,0,.06)",
              color: activeSlotHasModel ? "#116b37" : "rgba(0,0,0,.62)",
              fontWeight: 800,
              fontSize: "13px",
            },
          },
          h("span", {
            style: {
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              background: activeSlotHasModel ? "#2ecc71" : "#aaa",
              display: "inline-block",
            },
          }),
          activeSlotHasModel ? "Slot hat Modell" : "Slot leer"
        )
      );

      mainGrid.appendChild(previewBox);
      card.appendChild(mainGrid);

      // -------------------------------------------------------------------
      // Aktionen: getrennt nach Asset, Slot und Export.
      // WICHTIG: Button-Text "In AssetLab öffnen" bleibt für Playwright erhalten.
      // -------------------------------------------------------------------
      const actionGroups = h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "10px",
          marginTop: "14px",
        },
      });

      const makeGroup = (label) =>
        h(
          "div",
          {
            style: {
              border: "1px solid rgba(0,0,0,.08)",
              borderRadius: "14px",
              padding: "10px",
              background: "rgba(255,255,255,.46)",
              minWidth: "0",
            },
          },
          h("div", { style: { opacity: ".55", fontWeight: 850, fontSize: "12px", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } }, label)
        );

      const assetActions = makeGroup("Asset");
      assetActions.appendChild(
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
          h(
            "button",
            { className: "bp-btn", onclick: () => this.openInAssetLab({ projectAssetId: asset.id, slotId: slot.id }) },
            "🧰 In AssetLab öffnen"
          ),
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
        )
      );

      const slotActions = makeGroup("Slot");
      slotActions.appendChild(
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
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
          ),
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
          ),
          h(
            "button",
            {
              className: "bp-btn",
              onclick: () => {
                slot.updatedAt = nowIso();
                slot.lastAction = "manual save";
                this.commitDraftToStore(draft);
                this.requestSave("project-assets-slot-save");
                this.rerender();
              },
            },
            "💾 Slot speichern"
          )
        )
      );

      const exportActions = makeGroup("Export");
      exportActions.appendChild(
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
          h(
            "button",
            {
              className: "bp-btn",
              onclick: () => this.openInAssetLab({ projectAssetId: asset.id, slotId: slot.id, payload: { type: "export", format: "glb" } }),
            },
            "⬇️ GLB"
          ),
          h(
            "button",
            {
              className: "bp-btn",
              onclick: () => this.openInAssetLab({ projectAssetId: asset.id, slotId: slot.id, payload: { type: "export", format: "gltf" } }),
            },
            "⬇️ GLTF"
          )
        )
      );

      actionGroups.appendChild(assetActions);
      actionGroups.appendChild(slotActions);
      actionGroups.appendChild(exportActions);
      card.appendChild(actionGroups);

      root.appendChild(card);
    });
  }
}
