/**
 * Baustellenplaner
 * Datei: ui/panels/ProjectAssetsPanel.js
 * Version: v1.4.0-slots-badge-export-persist (2026-02-10)
 *
 * Projekt → Assets
 * =============================================================================
 * Zielstand:
 * - Projekt-Assets enthalten mehrere Slots (Varianten)
 * - Pro Slot genau 1 Modell (A-Entscheidung)
 * - Slot zeigt Status: hasModel / lastImportName / updatedAt
 * - Mini-Badge im Slot-Header (Dateiname)
 * - Export-Buttons pro Slot (GLB/GLTF) -> triggert AssetLab und speichert Ref
 * - Persistenz: Änderungen bleiben nach Reload erhalten
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

// Legacy-Pfade, die wir in der Wildnis gesehen haben
const LEGACY_PATHS = [
  "assets",          // project.assets
  "project_assets",  // project.project_assets
];

// Persist Keys (redundant, aber robust)
const KEY_PROJECTFILE_PREFIX = "baustellenplaner:projectfile:";
const KEY_APPPERSIST_PREFIX = "baustellenplaner:project:";

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return obj[path];
}

function setByPath(obj, path, value) {
  if (!obj || !path) return;
  obj[path] = value;
}

function safeClone(obj) {
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch {
    // ignore
  }
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

function makeId(prefix = "PA") {
  return `${prefix}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function fmtIso(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return String(iso);
    // Kurzformat, iOS-safe
    return d.toLocaleString("de-DE", { hour12: false });
  } catch {
    return String(iso);
  }
}
/**
 * Erkennt, ob ein Slot "ein Modell hat".
 *
 * Wichtig: In unserer Praxis können Daten "inkonsistent" sein:
 * - hasModel (bool) kann fehlen
 * - model kann null sein, aber exportRef / lastImportName existieren
 * - Import/Export kann statt model nur Metadaten schreiben
 *
 * Daher: Wir prüfen konservativ mehrere Felder.
 */
function slotHasModel(slot) {
  if (!slot || typeof slot !== "object") return false;

  // 1) Explizite Flags / Referenzen
  if (slot.hasModel === true) return true;
  if (slot.model) return true;
  if (slot.exportRef) return true;

  // 2) Metadaten aus Import/Export
  if (typeof slot.lastImportName === "string" && slot.lastImportName.trim()) return true;
  if (typeof slot.fileName === "string" && slot.fileName.trim()) return true;

  // 3) Fallback: Wenn updatedAt gesetzt ist UND lastAction sinnvoll klingt.
  // (damit nicht jedes "leere" Update als Modell gilt)
  const la = (typeof slot.lastAction === "string") ? slot.lastAction.toLowerCase() : "";
  if (slot.updatedAt && (la.includes("import") || la.includes("load") || la.includes("setmodel") || la.includes("export"))) return true;

  return false;
}


function badge(text, { title = "" } = {}) {
  return h(
    "span",
    {
      title,
      style: {
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "12px",
        lineHeight: "18px",
        background: "rgba(0,0,0,.08)",
        border: "1px solid rgba(0,0,0,.12)",
      },
    },
    text
  );
}

function persistProjectSnapshot(project) {
  // Persistenz darf NIE crashen.
  try {
    const id = project?.id;
    if (!id) return;

    // (1) Wizard/Projektliste: projectfile
    try {
      localStorage.setItem(`${KEY_PROJECTFILE_PREFIX}${id}`, JSON.stringify(project, null, 2));
    } catch {
      // ignore
    }

    // (2) AppPersistor-Format (falls aktiv)
    try {
      const payload = {
        project: project,
        settings: {},
        ui: { drafts: {} },
        _meta: { savedAt: nowIso(), projectId: id },
      };
      localStorage.setItem(`${KEY_APPPERSIST_PREFIX}${id}`, JSON.stringify(payload));
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

/**
 * Erzeugt einen Download im Browser (iOS/Safari kompatibel).
 * @param {string} fileName
 * @param {any} obj
 */
function downloadJson(fileName, obj) {
  try {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    // iOS: braucht echtes DOM-Element
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    console.error("[ProjectAssetsPanel] downloadJson failed:", e);
    alert("Export fehlgeschlagen: " + (e?.message || String(e)));
  }
}

/**
 * Liest eine JSON-Datei aus einem <input type="file">.
 * @param {File} file
 * @returns {Promise<any>}
 */
async function readJsonFile(file) {
  if (!file) return null;
  try {
    // Moderne Browser
    if (typeof file.text === "function") {
      const txt = await file.text();
      return JSON.parse(txt);
    }
  } catch {
    // fallback unten
  }
  // Fallback: FileReader
  return await new Promise((resolve, reject) => {
    try {
      const fr = new FileReader();
      fr.onload = () => {
        try {
          resolve(JSON.parse(String(fr.result || "")));
        } catch (e) {
          reject(e);
        }
      };
      fr.onerror = () => reject(fr.error || new Error("FileReader error"));
      fr.readAsText(file);
    } catch (e) {
      reject(e);
    }
  });
}

function ensureSlots(asset) {
  if (!asset || typeof asset !== "object") return;

  // Wenn keine Slots existieren: aus Legacy-Feldern einen Slot bauen
  if (!Array.isArray(asset.slots) || asset.slots.length === 0) {
    const legacyPreset = asset.presetTransform || asset.preset || { scale: 1, rotY: 0, offsetY: 0 };
    asset.slots = [
      {
        id: makeId("PS"),
        name: "Variante 1",
        model: asset.model || null,
        preset: {
          scale: Number(legacyPreset.scale ?? 1),
          rotY: Number(legacyPreset.rotY ?? 0),
          offsetY: Number(legacyPreset.offsetY ?? 0),
        },
        hasModel: !!asset.model,
        lastImportName: asset.model?.fileName || "",
        updatedAt: "",
        lastAction: "migrated",
        exportRef: null,
      },
    ];
  }

  // Slots normalisieren
  asset.slots.forEach((s, idx) => {
    s.id = s.id || makeId("PS");
    s.name = s.name || `Variante ${idx + 1}`;
    s.model = s.model || null;
    s.preset = s.preset || { scale: 1, rotY: 0, offsetY: 0 };
    s.preset.scale = Number(s.preset.scale ?? 1);
    s.preset.rotY = Number(s.preset.rotY ?? 0);
    s.preset.offsetY = Number(s.preset.offsetY ?? 0);

    // Status
    if (typeof s.hasModel !== "boolean") s.hasModel = !!s.model;
    s.lastImportName = String(s.lastImportName || "");
    s.updatedAt = String(s.updatedAt || "");
    s.lastAction = String(s.lastAction || "");
    if (s.exportRef == null) s.exportRef = null;
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
   * Migriert bekannte Legacy-Pfade in den kanonischen Pfad `project.projectAssets`.
   * - Nur, wenn der kanonische Pfad leer/fehlend ist.
   */
  _migrateLegacyIfNeeded(project) {
    if (!project) return;

    const canon = getByPath(project, CANON_PATH);
    if (Array.isArray(canon) && canon.length) return;

    // 1) Legacy finden
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
      setByPath(project, CANON_PATH, Array.isArray(canon) ? canon : []);
      return;
    }

    // 2) Migrieren (sanft)
    const migrated = legacy.map((it) => ({
      id: it?.id || makeId("PA"),
      name: it?.name || "Projekt-Asset",
      source: it?.source || { kind: "legacy", from: legacyKey || "unknown" },
      slots: [],
      presetTransform: it?.presetTransform || it?.preset || { scale: 1, rotY: 0, offsetY: 0 },
      model: it?.model || null,
    }));

    migrated.forEach((a) => ensureSlots(a));
    setByPath(project, CANON_PATH, migrated);
  }

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const project = app.project || {};

    this._migrateLegacyIfNeeded(project);

    const list = Array.isArray(project[CANON_PATH]) ? project[CANON_PATH] : [];

    // Wir arbeiten auf einer Clone-Kopie, damit das Panel "Draft"-artig bleibt
    const draft = {
      projectId: project.id || "",
      projectAssets: safeClone(list),
    };

    // Slots normalisieren
    (draft.projectAssets || []).forEach((a) => ensureSlots(a));

    return draft;
  }

  renderBody(root, draft) {
    // Panel-level UI Memory: pro Asset zuletzt gewählter Slot
    this._slotSel = this._slotSel || {};

    const app = this.store.get("app") || {};
    const project = app.project || {};
    const pid = draft?.projectId || project?.id || "unknown";

    let _dirty = false;
    const dirty = () => {
      _dirty = true;
      this.markDirty?.(true);
    };

    const sync = () => {
      if (!_dirty) return;

      this.store.update("app", (appDraft) => {
        appDraft.project = appDraft.project || {};
        setByPath(appDraft.project, CANON_PATH, Array.isArray(draft.projectAssets) ? draft.projectAssets : []);

        // Kompatibilität: einige Alt-Stände lesen aus app.settings.projectAssets
        appDraft.settings = appDraft.settings || {};
        appDraft.settings.projectAssets = Array.isArray(draft.projectAssets) ? draft.projectAssets : [];
      });

      // Persistenz: damit nach Reload alles wieder da ist
      try {
        const p = this.store.get("app")?.project;
        if (p) persistProjectSnapshot(p);
      } catch {
        // ignore
      }

      _dirty = false;
      this.markDirty?.(false);
    };

    // -----------------------------------------------------------------------
    // Header
    // -----------------------------------------------------------------------

    root.appendChild(
      h(
        "div",
        { style: { opacity: ".75", fontSize: "12px", marginBottom: "8px" } },
        `Assets im Projekt: ${pid}`
      )
    );

    // -----------------------------------------------------------------------
    // Toolbar
    // -----------------------------------------------------------------------

    const topBar = h("div", {
      style: {
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        alignItems: "center",
        margin: "0 0 12px",
      },
    });

    // ---------------------------------------------------------------------
    // Export / Import (Projekt) – bewusst im Assets-Panel, weil hier gearbeitet wird
    // ---------------------------------------------------------------------

    const btnExportProject = h(
      "button",
      {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          // Vor Export unbedingt in den Store schreiben
          try { sync(); } catch { /* ignore */ }

          // Wir exportieren bewusst den kompletten Store-Snapshot,
          // weil das der stabilste Weg ist (project/meta/ui/config/app/plugins/...)
          const snap = this.store.snapshot ? this.store.snapshot() : { app: this.store.get("app") };
          const id = (snap?.app?.project?.id) || pid || "project";
          const d = new Date();
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const fileName = `${id}_export_${y}-${m}-${day}.json`;
          downloadJson(fileName, snap);
        },
      },
      "⬇︎ Export Projekt"
    );

    // Hidden FileInput für Import
    const importInput = h("input", {
      type: "file",
      accept: "application/json,.json",
      style: { display: "none" },
    });

    const btnImportProject = h(
      "button",
      {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          // iOS: input muss existieren + click via User-Gesture
          importInput.value = "";
          importInput.click();
        },
      },
      "⬆︎ Import Projekt"
    );

    importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;

      try {
        const data = await readJsonFile(file);
        if (!data || typeof data !== "object") throw new Error("Ungültige JSON-Datei");

        // Unterstützte Formate:
        // A) Store-Snapshot (keys: project/meta/ui/config/app/plugins/...)
        // B) Reines Project-Objekt (schema=baustellenplaner.project.v1)

        const looksLikeStoreSnapshot = !!(data.app || data.project || data.ui || data.meta);

        let nextProject = null;
        let nextMeta = null;
        let nextUi = null;
        let nextConfig = null;
        let nextPlugins = null;

        if (looksLikeStoreSnapshot) {
          // project kann entweder direkt das ProjectObj sein oder {project:...}
          // Wir übernehmen 1:1, falls vorhanden.
          nextProject = data.project ?? null;
          nextMeta = data.meta ?? null;
          nextUi = data.ui ?? null;
          nextConfig = data.config ?? null;
          nextPlugins = data.plugins ?? null;

          // app ist die wichtigste Quelle für Panels
          if (data.app) {
            this.store.set("app", data.app);
          }
        } else {
          nextProject = data;
        }

        // Store Keys setzen (wenn vorhanden)
        if (nextProject) this.store.set("project", nextProject);
        if (nextMeta) this.store.set("meta", nextMeta);
        if (nextUi) this.store.set("ui", nextUi);
        if (nextConfig) this.store.set("config", nextConfig);
        if (nextPlugins) this.store.set("plugins", nextPlugins);

        // App-State rekonstruieren, wenn nicht enthalten
        if (!looksLikeStoreSnapshot || !data.app) {
          const pObj = (nextProject && (nextProject.project || nextProject)) || {};
          const _metaSettings = (nextMeta && nextMeta.settings) ? nextMeta.settings : {};
          const _uiState = nextUi || this.store.get("ui") || {};

          this.store.set("app", {
            project: pObj,
            settings: _metaSettings,
            ui: _uiState,
            activeProject: { kind: "local", id: pObj.id || null },
            activeProjectId: pObj.id || null,
          });
        }

        // Persistenz: in die bekannten localStorage-Keys schreiben
        try {
          const p = this.store.get("app")?.project;
          if (p && p.id) {
            // Projectfile
            try {
              localStorage.setItem(`${KEY_PROJECTFILE_PREFIX}${p.id}`, JSON.stringify(p, null, 2));
            } catch { /* ignore */ }

            // AppPersist (redundant)
            persistProjectSnapshot(p);
          }
        } catch {
          // ignore
        }

        // Neu rendern
        this.markDirty?.(false);
        this.rerender();
      } catch (e) {
        console.error("[ProjectAssetsPanel] Import failed:", e);
        alert("Import fehlgeschlagen: " + (e?.message || String(e)));
      }
    });

    const btnAddDummy = h(
      "button",
      {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          draft.projectAssets = draft.projectAssets || [];

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
                lastImportName: "",
                updatedAt: "",
                lastAction: "",
                exportRef: null,
              },
            ],
          });

          this._slotSel[paId] = slotId;
          dirty();
          sync();
          this.rerender();
        },
      },
      "+ Dummy-Asset"
    );

    topBar.appendChild(btnAddDummy);

    // Export/Import Buttons + hidden input
    topBar.appendChild(btnExportProject);
    topBar.appendChild(btnImportProject);
    topBar.appendChild(importInput);

    root.appendChild(topBar);

    // -----------------------------------------------------------------------
    // Liste
    // -----------------------------------------------------------------------

    const list = h("div", { style: { display: "grid", gap: "12px" } });
    root.appendChild(list);

    const items = Array.isArray(draft.projectAssets) ? draft.projectAssets : [];

    if (!items.length) {
      list.appendChild(
        h(
          "div",
          { style: { opacity: ".7", fontSize: "13px" } },
          "Keine Projekt-Assets vorhanden. (Zum Testen: „+ Dummy-Asset“.)"
        )
      );
      return;
    }

    // Render jedes Asset
    items.forEach((it) => {
      ensureSlots(it);

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

      const titleRow = h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } });
      titleRow.appendChild(h("div", { style: { fontWeight: "600" } }, it?.name || "(ohne Name)"));
      titleRow.appendChild(
        // (1) Oben rechts: nur "Modell" + Punkt
        badge(
          slotHasModel(slot) ? "🟢 Modell" : "○ Modell",
          { title: slotHasModel(slot) ? "Slot hat ein Modell" : "Slot ist leer" }
        )
      );

      const sub = h(
        "div",
        { style: { opacity: ".75", fontSize: "12px", marginBottom: "8px" } },
        `Asset-ID: ${it?.id || "?"}  ·  Quelle: ${it?.source?.kind || "?"}`
      );

      // Actions
      const actions = h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" } });

      const openInAssetLab = (extra = {}) => {
        // Extra kann z.B. { cmd:"export", format:"glb" } enthalten.
        // Das landet NICHT als Kontext, sondern als "pendingCmd" für AssetLab.
        const { cmd, format, ...ctxExtra } = extra || {};

        // Kontext in Store ablegen (AssetLab kann das lesen)
        this.store.update("app", (appDraft) => {
          appDraft.ui = appDraft.ui || {};
          appDraft.ui.assetlab = appDraft.ui.assetlab || {};
          appDraft.ui.assetlab.context = {
            type: "projectAsset",
            projectAssetId: it.id,
            slotId: this._slotSel[it.id],
            ...ctxExtra,
          };

          // PendingCmd wird im AssetLab nach "ready" einmalig ausgeführt.
          appDraft.ui.assetlab.pendingCmd = cmd
            ? { cmd: String(cmd), format: format ? String(format) : undefined }
            : null;
        });

        this.bus.emit("ui:navigate", {
          panel: "projectPanel:assetlab3d",
          payload: {
            context: {
              type: "projectAsset",
              projectAssetId: it.id,
              slotId: this._slotSel[it.id],
              ...ctxExtra,
            },
          },
        });
      };

      actions.appendChild(
        h(
          "button",
          { className: "bp-btn", type: "button", onclick: () => openInAssetLab() },
          "🧰 In AssetLab öffnen"
        )
      );

      actions.appendChild(
        h(
          "button",
          {
            className: "bp-btn",
            type: "button",
            onclick: () => {
              if (!confirm("Projekt-Asset wirklich löschen?")) return;
              draft.projectAssets = (draft.projectAssets || []).filter((x) => x?.id !== it.id);
              dirty();
              sync();
              this.rerender();
            },
          },
          "🗑 Löschen"
        )
      );

      // -------------------------------------------------------------------
      // Slot UI
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
      it.slots.forEach((s) => slotSelect.appendChild(h("option", { value: s.id }, s.name || s.id)));

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
        },
        style: { minWidth: "160px" },
      });

      const fileBadgeText = (() => {
        // (2) Neben Slot: nur Dateiname (wenn vorhanden)
        if (!slot) return "";

        // Prefer: lastImportName (vom Import)
        if (typeof slot.lastImportName === "string" && slot.lastImportName.trim()) return slot.lastImportName.trim();

        // Prefer: exportRef (vom Export)
        if (slot.exportRef && typeof slot.exportRef === "object") {
          const n = slot.exportRef.fileName || slot.exportRef.name || "";
          if (typeof n === "string" && n.trim()) return n.trim();
        }

        // Kein Fallback-Text (du wolltest hier nur den Namen)
        return "";
      })();;

      const _slotHas = slotHasModel(slot);
      const fileBadge = badge(fileBadgeText, {
        title: slot?.updatedAt ? `Letztes Update: ${fmtIso(slot.updatedAt)}` : "",
        style: _slotHas
          ? { background: "rgba(33, 150, 83, 0.12)", border: "1px solid rgba(33, 150, 83, 0.35)", color: "#155d34" }
          : { background: "rgba(150, 150, 150, 0.12)", border: "1px solid rgba(150, 150, 150, 0.35)", color: "#444" },
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
            lastImportName: "",
            updatedAt: "",
            lastAction: "",
            exportRef: null,
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

      const btnExportGLB = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => openInAssetLab({ cmd: "export", format: "glb" }),
      }, "⬇︎ Export GLB");

      const btnExportGLTF = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => openInAssetLab({ cmd: "export", format: "gltf" }),
      }, "⬇︎ Export GLTF");

      slotRow.appendChild(h("div", { style: { fontSize: "12px", opacity: ".8" } }, "Slot:"));
      slotRow.appendChild(slotSelect);
      slotRow.appendChild(slotName);
      slotRow.appendChild(fileBadge);
      slotRow.appendChild(btnAddSlot);
      slotRow.appendChild(btnDelSlot);
      slotRow.appendChild(btnExportGLB);
      slotRow.appendChild(btnExportGLTF);

      // -------------------------------------------------------------------
      // Preset-Grid für den AKTUELLEN Slot
      // -------------------------------------------------------------------

      const grid = h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "8px",
        },
      });

      const mkNum = (label, getVal, setVal) => {
        const wrap = h("div", {});
        wrap.appendChild(h("div", { style: { fontSize: "12px", opacity: ".8", marginBottom: "4px" } }, label));
        wrap.appendChild(
          h("input", {
            type: "number",
            className: "bp-input",
            value: String(getVal()),
            oninput: (ev) => {
              const v = Number(ev.target.value);
              setVal(Number.isFinite(v) ? v : 0);
              dirty();
              sync();
            },
          })
        );
        return wrap;
      };

      grid.appendChild(mkNum("Scale (uniform)", () => slot?.preset?.scale ?? 1, (v) => (slot.preset.scale = v)));
      grid.appendChild(mkNum("Rot Y (°)", () => slot?.preset?.rotY ?? 0, (v) => (slot.preset.rotY = v)));
      grid.appendChild(mkNum("Offset Y", () => slot?.preset?.offsetY ?? 0, (v) => (slot.preset.offsetY = v)));

      // Status-Linie
      const statusLine = h(
        "div",
        { style: { opacity: ".7", fontSize: "12px", marginTop: "8px" } },
        slot?.updatedAt
          ? `Letztes Update: ${fmtIso(slot.updatedAt)}${slot.lastAction ? ` · ${slot.lastAction}` : ""}`
          : "Noch kein Import/Export."
      );

      card.appendChild(titleRow);
      card.appendChild(sub);
      card.appendChild(actions);
      card.appendChild(slotRow);
      card.appendChild(grid);
      card.appendChild(statusLine);

      list.appendChild(card);
    });
  }
}
