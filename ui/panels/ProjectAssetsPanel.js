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
  // Defensive Store Init (kompatibel zu Store.update(...))
  // ---------------------------------------------------------------------------
  /**
   * In manchen Ständen existiert der Key "app" beim Boot noch nicht.
   * Der Store.update(...) clone't dann `undefined` → Callback bekommt `undefined`
   * → Panel crasht (Cannot read properties of undefined ...).
   *
   * Deshalb stellen wir sicher, dass `store.get("app")` immer ein Objekt ist.
   */
  _ensureAppState() {
    if (!this.store?.has?.("app")) {
      // Minimaler App-State, den die Panels erwarten
      this.store?.init?.("app", { project: {}, ui: {}, settings: {} });
      return;
    }
    const cur = this.store?.get?.("app");
    if (cur == null) {
      // falls der Key existiert, aber `null/undefined` ist (selten, aber möglich)
      this.store?.set?.("app", { project: {}, ui: {}, settings: {} });
      return;
    }
    // sicherstellen, dass die Unterobjekte existieren
    if (!cur.project) cur.project = {};
    if (!cur.ui) cur.ui = {};
    if (!cur.settings) cur.settings = {};
    // zurückschreiben, damit Store konsistent ist (falls Referenz vorher fehlte)
    this.store?.set?.("app", cur);
  }

  // ---------------------------------------------------------------------------
  // Draft (aus Store)
  // ---------------------------------------------------------------------------
  buildDraftFromStore() {
    this._ensureAppState();
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
    this._ensureAppState();
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
      this._ensureAppState();
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

        draft.projectAssets.push({
          id: makeId("PA"),
          name: "Dummy Asset",
          source: { kind: "upload", note: "Standalone" },
          preset: {
            scale: 1,
            rotY: 0,
            offsetY: 0,
          },
        });

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
      this._ensureAppState();
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

    const items = Array.isArray(draft.projectAssets) ? draft.projectAssets : [];

    if (!items.length) {
      list.appendChild(
        h("div", { style: { opacity: ".7", fontSize: "13px" } },
          "Keine Projekt-Assets vorhanden. (Zum Testen: „+ Dummy-Asset“.)"
        )
      );
      return;
    }

    // Ein Element rendern
    items.forEach((it) => {
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
      this._ensureAppState();
      this.store.update("app", (app) => {
            app.ui = app.ui || {};
            app.ui.assetlab = app.ui.assetlab || {};
            app.ui.assetlab.context = { type: "projectAsset", projectAssetId: it.id };
          });

          // Navigation zum AssetLab
          this.bus.emit("ui:navigate", {
            panel: "projectPanel:assetlab3d",
            payload: { context: { type: "projectAsset", projectAssetId: it.id } },
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

      // Preset-Felder (numerisch)
      const grid = h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "8px",
        },
      });

      // sicherstellen
      it.preset = it.preset || { scale: 1, rotY: 0, offsetY: 0 };

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

      grid.appendChild(mkNum("Scale (uniform)", () => it.preset.scale ?? 1, (v) => (it.preset.scale = v)));
      grid.appendChild(mkNum("Rot Y (°)", () => it.preset.rotY ?? 0, (v) => (it.preset.rotY = v)));
      grid.appendChild(mkNum("Offset Y", () => it.preset.offsetY ?? 0, (v) => (it.preset.offsetY = v)));

      card.appendChild(title);
      card.appendChild(sub);
      card.appendChild(actions);
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
