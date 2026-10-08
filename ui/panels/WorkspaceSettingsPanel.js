/**
 * ui/panels/WorkspaceSettingsPanel.js
 * Version: v1.0.1-settings-workspace-live+applyDocks (2026-02-25)
 *
 * Patch-Ziel:
 * - Beim Speichern der Workspace-Settings soll Workarea LIVE reagieren.
 * - Neu: Wir senden zusätzlich `applyDocks:true`, damit tools:workarea
 *   die Dock-Defaults (left/right/bottom collapsed) EINMALIG übernehmen kann.
 *
 * Warum?
 * - Workarea (v1.1.4) respektiert manuelle Dock-Toggles und überschreibt
 *   UI-State NICHT mehr automatisch aus settings.workspace.* (Fix gegen Flackern/Overrides).
 * - Auf Mobile willst du aber bewusst über Settings "alles einklappen" -> sofort sichtbar.
 *
 * Event:
 * - cb:settings:workspace:changed { workspace, applyDocks?:boolean, source?:string }
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
  // bestehende Defaults (aus defaults/projectSettings.workspace.json)
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

    // NEU (Workarea/Viewport): Farbe als einfacher Default
    color: "#f2f2f2"
  },
  camera: { zoom: 1.0, minZoom: 0.25, maxZoom: 4.0, panSpeed: 1.0 },

  // NEU (Workarea UI): Dock Defaults
  docks: {
    leftCollapsed: false,
    rightCollapsed: false,
    bottomCollapsed: false
  },

  // NEU (Viewport): Quality Preset
  viewport: {
    quality: "medium", // low | medium | high
    dprCap: 2 // 1..3
  }
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

    // defensive defaults (falls alte States fehlen)
    draft.workspace = draft.workspace || safeClone(DEFAULT_WORKSPACE);
    draft.workspace.grid = draft.workspace.grid || safeClone(DEFAULT_WORKSPACE.grid);
    draft.workspace.background = draft.workspace.background || safeClone(DEFAULT_WORKSPACE.background);
    draft.workspace.camera = draft.workspace.camera || safeClone(DEFAULT_WORKSPACE.camera);
    draft.workspace.docks = draft.workspace.docks || safeClone(DEFAULT_WORKSPACE.docks);
    draft.workspace.viewport = draft.workspace.viewport || safeClone(DEFAULT_WORKSPACE.viewport);

    return draft;
  }

  applyDraftToStore(draft) {
    // ---------------------------------------------------------------------
    // 1) Persistenz (Store) – konservativ/kompatibel
    // ---------------------------------------------------------------------
    this.store.update("app", (app) => {
      app.settings = app.settings || {};
      app.settings.workspace = safeClone(draft.workspace);

      // Draft speichern, damit Tab-Wechsel nicht "leer" wirkt
      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.workspaceSettings = safeClone(draft);
    });

    // ---------------------------------------------------------------------
    // 2) Live-Event Richtung Workarea
    // ---------------------------------------------------------------------
    // Neu: applyDocks:true
    // -> Workarea darf Dock-Defaults EINMALIG übernehmen (z.B. Mobile: alles einklappen)
    // -> verhindert trotzdem, dass Workarea dauerhaft "auto overridet"
    if (this.bus?.emit) {
      this.bus.emit("cb:settings:workspace:changed", {
        workspace: safeClone(draft.workspace),
        applyDocks: true,
        source: "settings:workspace:save"
      });
    }
  }

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

    // NOTE: Section ist im Projekt als "dual API" implementiert.
    // new Section(...) liefert { el, append(node) } – es gibt KEIN sec.body.
    secGrid.append(
      FormField({
        type: "checkbox",
        label: "Grid aktiv",
        value: !!ws.grid?.enabled,
        onChange: (v) => this._set(["workspace", "grid", "enabled"], !!v)
      })
    );

    secGrid.append(
      FormField({
        label: "Grid Größe",
        value: String(ws.grid?.size ?? 50),
        placeholder: "z.B. 50",
        onChange: (v) => this._set(["workspace", "grid", "size"], toNum(v, 50))
      })
    );

    secGrid.append(
      FormField({
        type: "checkbox",
        label: "Snap aktiv",
        value: !!ws.grid?.snap,
        onChange: (v) => this._set(["workspace", "grid", "snap"], !!v)
      })
    );

    bodyEl.appendChild(secGrid.el);

    // -----------------------------------------------------------------------
    // Hintergrund / Viewport
    // -----------------------------------------------------------------------
    const secView = new Section({
      title: "Viewport",
      description: "Darstellung (Hintergrundfarbe, Quality Preset)."
    });

    secView.append(
      FormField({
        label: "Hintergrundfarbe",
        value: String(ws.background?.color ?? "#f2f2f2"),
        placeholder: "#f2f2f2",
        onChange: (v) => this._set(["workspace", "background", "color"], String(v || "#f2f2f2"))
      })
    );

    secView.append(
      FormField({
        label: "Viewport Quality",
        value: String(ws.viewport?.quality ?? "medium"),
        placeholder: "low | medium | high",
        onChange: (v) => this._set(["workspace", "viewport", "quality"], normalizeQuality(v))
      })
    );

    secView.append(
      FormField({
        label: "DPR Cap (max devicePixelRatio)",
        value: String(ws.viewport?.dprCap ?? 2),
        placeholder: "z.B. 2",
        onChange: (v) => this._set(["workspace", "viewport", "dprCap"], clamp(toNum(v, 2), 1, 3))
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
        onChange: (v) => this._set(["workspace", "units"], normalizeUnits(v))
      })
    );

    secUnits.append(
      FormField({
        label: "Pan Speed",
        value: String(ws.camera?.panSpeed ?? 1.0),
        placeholder: "z.B. 1.0",
        onChange: (v) => this._set(["workspace", "camera", "panSpeed"], clamp(toNum(v, 1.0), 0.1, 10))
      })
    );

    bodyEl.appendChild(secUnits.el);

    // -----------------------------------------------------------------------
    // Dock Defaults
    // -----------------------------------------------------------------------
    const secDock = new Section({
      title: "Dock-Standard",
      description:
        "Startzustand der Docks/Bars im Workarea. Hinweis: Beim Speichern werden diese Defaults jetzt live angewendet (applyDocks)."
    });

    secDock.append(
      FormField({
        type: "checkbox",
        label: "Left Dock eingeklappt",
        value: !!ws.docks?.leftCollapsed,
        onChange: (v) => this._set(["workspace", "docks", "leftCollapsed"], !!v)
      })
    );

    secDock.append(
      FormField({
        type: "checkbox",
        label: "Right Dock eingeklappt",
        value: !!ws.docks?.rightCollapsed,
        onChange: (v) => this._set(["workspace", "docks", "rightCollapsed"], !!v)
      })
    );

    secDock.append(
      FormField({
        type: "checkbox",
        label: "Bottom Bar eingeklappt",
        value: !!ws.docks?.bottomCollapsed,
        onChange: (v) => this._set(["workspace", "docks", "bottomCollapsed"], !!v)
      })
    );

    bodyEl.appendChild(secDock.el);

    // -----------------------------------------------------------------------
    // Hinweis
    // -----------------------------------------------------------------------
    const note = new Section({
      title: "Hinweis",
      description:
        "Diese Settings werden live an tools:workarea gebunden. Docks werden nur bei Save explizit übernommen (applyDocks), damit manuelle Workarea-Toggles stabil bleiben."
    });

    bodyEl.appendChild(note.el);
  }

  _set(pathArr, value) {
    // Draft-Pfad setzen + dirty markieren + draft speichern
    let cur = this.draft;
    for (let i = 0; i < pathArr.length - 1; i++) {
      const k = pathArr[i];
      cur[k] = cur[k] || {};
      cur = cur[k];
    }
    cur[pathArr[pathArr.length - 1]] = value;

    this.markDirty();

    // Draft dauerhaft im Store sichern (damit Tab-Wechsel stabil ist)
    this.store.update("app", (app) => {
      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.workspaceSettings = safeClone(this.draft);
    });
  }
}
