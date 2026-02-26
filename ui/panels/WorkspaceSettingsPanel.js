/**
 * ui/panels/WorkspaceSettingsPanel.js
 * Version: v1.0.2-settings-workspace-live+docks-instant (2026-02-26)
 *
 * Ziel:
 * - Workspace-Settings sollen Workarea LIVE beeinflussen.
 * - Kritisch: Docks (left/right/bottom collapsed) sollen SOFORT wirken,
 *   damit Mobile "Docks ausblenden" direkt sichtbar ist.
 *
 * Event:
 * - cb:settings:workspace:changed { workspace, applyDocks?:boolean, source?:string }
 *
 * Verhalten:
 * - Bei Dock-Checkboxen: sofort emit mit applyDocks:true
 * - Bei anderen Feldern: emit mit applyDocks:false (optional live feedback)
 *
 * WICHTIG:
 * - Persistenz bleibt wie gehabt (Store + Draft).
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { FormField } from "../components/FormField.js";
import { clear } from "../components/ui-dom.js";

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
  // ✅ Global (fallback)
  app.settings = app.settings || {};
  app.settings.workspace = safeClone(draft.workspace);

  // ✅ Projektbezogen (preferred)
  app.project = app.project || {};
  app.project.settings = app.project.settings || {};
  app.project.settings.workspace = safeClone(draft.workspace);

  app.ui = app.ui || {};
  app.ui.drafts = app.ui.drafts || {};
  app.ui.drafts.workspaceSettings = safeClone(draft);
});

    // Beim Save: Docks dürfen übernommen werden
    this._emitWorkspaceChanged(draft.workspace, { applyDocks: true, source: "settings:workspace:save" });
  }

  renderBody(bodyEl, draft) {
    clear(bodyEl);

    const ws = draft.workspace || {};

    // Grid / Snap
    const secGrid = new Section({
      title: "Grid & Snap",
      description: "Default-Werte für Rasteranzeige und Einrasten (werden im Workarea live verwendet)."
    });

    secGrid.append(
      FormField({
        type: "checkbox",
        label: "Grid aktiv",
        value: !!ws.grid?.enabled,
        onChange: (v) => this._set(["workspace", "grid", "enabled"], !!v, { live: true })
      })
    );

    secGrid.append(
      FormField({
        label: "Grid Größe",
        value: String(ws.grid?.size ?? 50),
        placeholder: "z.B. 50",
        onChange: (v) => this._set(["workspace", "grid", "size"], toNum(v, 50), { live: true })
      })
    );

    secGrid.append(
      FormField({
        type: "checkbox",
        label: "Snap aktiv",
        value: !!ws.grid?.snap,
        onChange: (v) => this._set(["workspace", "grid", "snap"], !!v, { live: true })
      })
    );

    bodyEl.appendChild(secGrid.el);

    // Viewport
    const secView = new Section({
      title: "Viewport",
      description: "Darstellung (Hintergrundfarbe, Quality Preset)."
    });

    secView.append(
      FormField({
        label: "Hintergrundfarbe",
        value: String(ws.background?.color ?? "#f2f2f2"),
        placeholder: "#f2f2f2",
        onChange: (v) => this._set(["workspace", "background", "color"], String(v || "#f2f2f2"), { live: true })
      })
    );

    secView.append(
      FormField({
        label: "Viewport Quality",
        value: String(ws.viewport?.quality ?? "medium"),
        placeholder: "low | medium | high",
        onChange: (v) => this._set(["workspace", "viewport", "quality"], normalizeQuality(v), { live: true })
      })
    );

    secView.append(
      FormField({
        label: "DPR Cap (max devicePixelRatio)",
        value: String(ws.viewport?.dprCap ?? 2),
        placeholder: "z.B. 2",
        onChange: (v) => this._set(["workspace", "viewport", "dprCap"], clamp(toNum(v, 2), 1, 3), { live: true })
      })
    );

    bodyEl.appendChild(secView.el);

    // Einheiten / Kamera
    const secUnits = new Section({
      title: "Einheiten & Navigation",
      description: "Einheiten und Kamera/Navigation."
    });

    secUnits.append(
      FormField({
        label: "Maßeinheiten",
        value: String(ws.units ?? "mm"),
        placeholder: "mm | cm | m",
        onChange: (v) => this._set(["workspace", "units"], normalizeUnits(v), { live: true })
      })
    );

    secUnits.append(
      FormField({
        label: "Pan Speed",
        value: String(ws.camera?.panSpeed ?? 1.0),
        placeholder: "z.B. 1.0",
        onChange: (v) => this._set(["workspace", "camera", "panSpeed"], clamp(toNum(v, 1.0), 0.1, 10), { live: true })
      })
    );

    bodyEl.appendChild(secUnits.el);

    // Dock Defaults
    const secDock = new Section({
      title: "Dock-Standard (SOFORT)",
      description:
        "Diese Haken werden sofort auf tools:workarea angewendet (applyDocks:true), damit Mobile 'alles einklappen' direkt sichtbar ist."
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
        "Speichern bleibt wichtig für Persistenz/Reload. Live-Änderungen wirken sofort in der Workarea."
    });
    bodyEl.appendChild(note.el);
  }

  /**
   * Draft-Pfad setzen + dirty markieren + draft speichern
   * + optional: Live-Event senden (applyDocks bei Dock-Änderungen)
   */
  _set(pathArr, value, opts = {}) {
    const live = !!opts.live;
    const applyDocks = !!opts.applyDocks;

    let cur = this.draft;
    for (let i = 0; i < pathArr.length - 1; i++) {
      const k = pathArr[i];
      cur[k] = cur[k] || {};
      cur = cur[k];
    }
    cur[pathArr[pathArr.length - 1]] = value;

    this.markDirty();

    // Draft dauerhaft im Store sichern
    this.store.update("app", (app) => {
      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.workspaceSettings = safeClone(this.draft);
    });

    // Live-Event (damit Workarea sofort reagiert)
    if (live) {
      this._emitWorkspaceChanged(this.draft.workspace, {
        applyDocks,
        source: applyDocks ? "settings:workspace:docks:live" : "settings:workspace:live"
      });
    }
  }

  _emitWorkspaceChanged(workspace, { applyDocks = false, source = "settings:workspace" } = {}) {
    if (!this.bus?.emit) return;
    this.bus.emit("cb:settings:workspace:changed", {
      workspace: safeClone(workspace),
      applyDocks: !!applyDocks,
      source: String(source || "settings:workspace")
    });
  }
}
