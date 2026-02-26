/**
 * ui/panels/WorkspaceSettingsPanel.js
 * Version: v1.0.3-settings-workspace-live + applyDocks-now (2026-02-26)
 *
 * Problem (dein Screenshot / iPhone):
 * - „Docks einklappen“ in den Settings hatte keine Auswirkung mehr.
 *
 * Ursache:
 * - Workarea respektiert manuelle Dock-Toggles und nimmt Dock-Defaults nur auf expliziten Trigger.
 * - Außerdem war deine aktuelle Datei offensichtlich „zusammenkopiert“ (Sektionen doppelt)
 *   und _emitWorkspaceChanged war nicht implementiert.
 *
 * Lösung:
 * - Diese Panel-Datei emittiert LIVE:
 *   cb:settings:workspace:changed { workspace, applyDocks?:boolean, source?:string }
 * - Bei Dock-Checkboxen: applyDocks:true (sofort sichtbarer Effekt)
 * - Bei anderen Feldern: applyDocks:false (Grid/Snap/Background/etc. live)
 *
 * Persistenz:
 * - Draft bleibt wie gehabt in app.ui.drafts.workspaceSettings
 * - Das eigentliche app.settings.workspace wird erst bei „Speichern“ gesetzt (applyDraftToStore)
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { FormField } from "../components/FormField.js";
import { clear } from "../components/ui-dom.js";

/* ==========================================================================
 * Helpers
 * ========================================================================= */

function safeClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj || {}));
  } catch {
    return {};
  }
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function normalizeUnits(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "mm" || s === "cm" || s === "m") return s;
  return "mm";
}

function normalizeQuality(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "low" || s === "medium" || s === "high") return s;
  return "medium";
}

/* ==========================================================================
 * Defaults
 * ========================================================================= */

const DEFAULT_WORKSPACE = {
  units: "mm",
  size: { width: 20000, height: 8000 },
  origin: "top_left",
  grid: { enabled: true, size: 50, snap: true },
  background: {
    mode: "none",
    assetId: null,
    opacity: 1.0,
    scale: 1.0,
    offset: { x: 0, y: 0 },
    lock: true,
    color: "#f2f2f2"
  },
  camera: { zoom: 1.0, minZoom: 0.25, maxZoom: 4.0, panSpeed: 1.0 },
  docks: { leftCollapsed: false, rightCollapsed: false, bottomCollapsed: false },
  viewport: { quality: "medium", dprCap: 2 }
};

export class WorkspaceSettingsPanel extends PanelBase {
  constructor(ctx = {}) {
    super({ bus: ctx.bus, store: ctx.store, rootEl: ctx.rootEl, context: ctx });
    this.panelId = ctx.panelId || "settings:workspace";
  }

  getTitle() {
    return "Arbeitsbereich";
  }

  getDescription() {
    return "Einstellungen für den Arbeitsbereich (tools:workarea): Grid/Snap, Hintergrund, Einheiten, Docks und Viewport-Qualität.";
  }

  /* ==========================================================================
   * Draft / Store
   * ========================================================================= */

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const settings = app.settings || {};
    const savedDraft = app?.ui?.drafts?.workspaceSettings;

    const ws = safeClone(settings.workspace || DEFAULT_WORKSPACE);
    const draft = savedDraft ? safeClone(savedDraft) : { workspace: ws };

    // Defensive defaults
    draft.workspace = draft.workspace || safeClone(DEFAULT_WORKSPACE);
    draft.workspace.grid = draft.workspace.grid || safeClone(DEFAULT_WORKSPACE.grid);
    draft.workspace.background = draft.workspace.background || safeClone(DEFAULT_WORKSPACE.background);
    draft.workspace.camera = draft.workspace.camera || safeClone(DEFAULT_WORKSPACE.camera);
    draft.workspace.docks = draft.workspace.docks || safeClone(DEFAULT_WORKSPACE.docks);
    draft.workspace.viewport = draft.workspace.viewport || safeClone(DEFAULT_WORKSPACE.viewport);

    return draft;
  }

  /**
   * Persistenz + Live-Event beim expliziten "Speichern".
   * (Das bleibt wichtig für Reload/Projekt-Backup)
   */
  applyDraftToStore(draft) {
    this.store.update("app", (app) => {
      app.settings = app.settings || {};
      app.settings.workspace = safeClone(draft.workspace);

      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.workspaceSettings = safeClone(draft);
    });

    // Beim Save: Docks dürfen übernommen werden
    this._emitWorkspaceChanged(draft.workspace, { applyDocks: true, source: "settings:workspace:save" });
  }

  /* ==========================================================================
   * Render
   * ========================================================================= */

  renderBody(bodyEl, draft) {
    clear(bodyEl);

    const ws = draft.workspace || {};

    // -----------------------------------------------------------------------
    // Grid / Snap
    // -----------------------------------------------------------------------
    const secGrid = new Section({
      title: "Grid & Snap",
      description: "Default-Werte für Rasteranzeige und Einrasten (werden im Workarea live verwendet)."
    });

    secGrid.append(
      FormField({
        type: "checkbox",
        label: "Grid aktiv",
        value: !!ws.grid?.enabled,
        onChange: (v) => this._set(["workspace", "grid", "enabled"], !!v, { live: true, applyDocks: false })
      })
    );

    secGrid.append(
      FormField({
        label: "Grid Größe",
        value: String(ws.grid?.size ?? 50),
        placeholder: "z.B. 50",
        onChange: (v) => this._set(["workspace", "grid", "size"], toNum(v, 50), { live: true, applyDocks: false })
      })
    );

    secGrid.append(
      FormField({
        type: "checkbox",
        label: "Snap aktiv",
        value: !!ws.grid?.snap,
        onChange: (v) => this._set(["workspace", "grid", "snap"], !!v, { live: true, applyDocks: false })
      })
    );

    bodyEl.appendChild(secGrid.el);

    // -----------------------------------------------------------------------
    // Viewport
    // -----------------------------------------------------------------------
    const secView = new Section({
      title: "Viewport",
      description: "Darstellung (Hintergrundfarbe, Quality Preset, DPR Cap)."
    });

    secView.append(
      FormField({
        label: "Hintergrundfarbe",
        value: String(ws.background?.color ?? "#f2f2f2"),
        placeholder: "#f2f2f2",
        onChange: (v) => this._set(["workspace", "background", "color"], String(v || "#f2f2f2"), { live: true, applyDocks: false })
      })
    );

    secView.append(
      FormField({
        label: "Viewport Quality",
        value: String(ws.viewport?.quality ?? "medium"),
        placeholder: "low | medium | high",
        onChange: (v) => this._set(["workspace", "viewport", "quality"], normalizeQuality(v), { live: true, applyDocks: false })
      })
    );

    secView.append(
      FormField({
        label: "DPR Cap (max devicePixelRatio)",
        value: String(ws.viewport?.dprCap ?? 2),
        placeholder: "z.B. 2",
        onChange: (v) =>
          this._set(["workspace", "viewport", "dprCap"], clamp(toNum(v, 2), 1, 3), { live: true, applyDocks: false })
      })
    );

    bodyEl.appendChild(secView.el);

    // -----------------------------------------------------------------------
    // Einheiten / Kamera
    // -----------------------------------------------------------------------
    const secUnits = new Section({
      title: "Einheiten & Navigation",
      description: "Einheiten und Kamera/Navigation."
    });

    secUnits.append(
      FormField({
        label: "Maßeinheiten",
        value: String(ws.units ?? "mm"),
        placeholder: "mm | cm | m",
        onChange: (v) => this._set(["workspace", "units"], normalizeUnits(v), { live: true, applyDocks: false })
      })
    );

    secUnits.append(
      FormField({
        label: "Pan Speed",
        value: String(ws.camera?.panSpeed ?? 1.0),
        placeholder: "z.B. 1.0",
        onChange: (v) => this._set(["workspace", "camera", "panSpeed"], clamp(toNum(v, 1.0), 0.1, 10), { live: true, applyDocks: false })
      })
    );

    secUnits.append(
      FormField({
        label: "Min Zoom",
        value: String(ws.camera?.minZoom ?? 0.25),
        placeholder: "z.B. 0.25",
        onChange: (v) => this._set(["workspace", "camera", "minZoom"], clamp(toNum(v, 0.25), 0.05, 10), { live: true, applyDocks: false })
      })
    );

    secUnits.append(
      FormField({
        label: "Max Zoom",
        value: String(ws.camera?.maxZoom ?? 4.0),
        placeholder: "z.B. 4",
        onChange: (v) => this._set(["workspace", "camera", "maxZoom"], clamp(toNum(v, 4.0), 0.1, 50), { live: true, applyDocks: false })
      })
    );

    bodyEl.appendChild(secUnits.el);

    // -----------------------------------------------------------------------
    // Dock Defaults (WICHTIG: applyDocks:true!)
    // -----------------------------------------------------------------------
    const secDock = new Section({
      title: "Dock-Standard",
      description:
        "Startzustand der Docks/Bars im Workarea. Diese Checkboxen wirken LIVE (applyDocks:true), damit Mobile „Docks ausblenden“ sofort sichtbar ist."
    });

    secDock.append(
      FormField({
        type: "checkbox",
        label: "Left Dock eingeklappt",
        value: !!ws.docks?.leftCollapsed,
        onChange: (v) => this._set(["workspace", "docks", "leftCollapsed"], !!v, { live: true, applyDocks: true })
      })
    );

    secDock.append(
      FormField({
        type: "checkbox",
        label: "Right Dock eingeklappt",
        value: !!ws.docks?.rightCollapsed,
        onChange: (v) => this._set(["workspace", "docks", "rightCollapsed"], !!v, { live: true, applyDocks: true })
      })
    );

    secDock.append(
      FormField({
        type: "checkbox",
        label: "Bottom Bar eingeklappt",
        value: !!ws.docks?.bottomCollapsed,
        onChange: (v) => this._set(["workspace", "docks", "bottomCollapsed"], !!v, { live: true, applyDocks: true })
      })
    );

    bodyEl.appendChild(secDock.el);

    // Hinweis
    const note = new Section({
      title: "Hinweis",
      description:
        "LIVE: Änderungen werden direkt an tools:workarea gesendet. Persistenz: endgültig erst per „Speichern“. Docks werden bei Dock-Checkboxen sofort übernommen (applyDocks:true)."
    });

    bodyEl.appendChild(note.el);
  }

  /* ==========================================================================
   * Internals
   * ========================================================================= */

  _emitWorkspaceChanged(workspace, { applyDocks = false, source = "settings:workspace:live" } = {}) {
    try {
      this.bus?.emit?.("cb:settings:workspace:changed", {
        workspace: safeClone(workspace || {}),
        applyDocks: !!applyDocks,
        source: String(source || "settings:workspace:live")
      });
    } catch (e) {
      console.warn("[WorkspaceSettingsPanel] emit failed:", e);
    }
  }

  /**
   * Draft-Pfad setzen + dirty markieren + draft speichern
   * Optional LIVE an Workarea senden (ohne Persistenz in app.settings.workspace).
   */
  _set(pathArr, value, opts = {}) {
    // Draft updaten
    let cur = this.draft;
    for (let i = 0; i < pathArr.length - 1; i++) {
      const k = pathArr[i];
      cur[k] = cur[k] || {};
      cur = cur[k];
    }
    cur[pathArr[pathArr.length - 1]] = value;

    // Dirty markieren (UI zeigt „ungespeicherte Änderungen“)
    this.markDirty();

    // Draft dauerhaft im Store sichern (Tab-Wechsel stabil)
    this.store.update("app", (app) => {
      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.workspaceSettings = safeClone(this.draft);
    });

    // LIVE anwenden?
    if (opts?.live) {
      const ws = this.draft?.workspace || {};
      this._emitWorkspaceChanged(ws, {
        applyDocks: !!opts?.applyDocks,
        source: "settings:workspace:live"
      });
    }
  }
}
