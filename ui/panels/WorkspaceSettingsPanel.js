/**
 * ui/panels/WorkspaceSettingsPanel.js
 * Version: v1.0.0-settings-workspace-live (2026-02-17)
 *
 * Panel: Einstellungen → Arbeitsbereich (settings:workspace)
 * ============================================================================
 * Zweck
 * - Sammelstelle für Workarea-/Viewport-Defaults, damit wir "tools:workarea"
 *   datengetrieben steuern können (Cybermotion Style).
 *
 * Steuert später:
 * - Grid Default
 * - Snap Default
 * - Hintergrundfarbe
 * - Maßeinheiten
 * - Dock-Standard (collapsed / offen)
 * - Viewport Quality
 *
 * Datenhaltung (konservativ, kompatibel):
 * - store key: "app"
 * - Pfad: app.settings.workspace
 *
 * Hinweis:
 * - Wir nutzen PanelBase (Draft/Dirty/Save).
 * - Zusätzlich legen wir Drafts ab: app.ui.drafts.workspaceSettings
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { FormField } from "../components/FormField.js";
import { clear } from "../components/ui-dom.js";

function safeClone(obj) {
  try { return JSON.parse(JSON.stringify(obj || {})); } catch { return {}; }
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
    quality: "medium",   // low | medium | high
    dprCap: 2            // 1..3 (wir cappen im Canvas/Three später ohnehin)
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
    this.store.update("app", (app) => {
      app.settings = app.settings || {};
      app.settings.workspace = safeClone(draft.workspace);

      // Draft speichern, damit Tab-Wechsel nicht "leer" wirkt
      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.workspaceSettings = safeClone(draft);

      // optional: Event, damit Workarea live reagieren kann (später)
      // (Workarea kann "cb:settings:workspace:changed" abonnieren)
    });

    if (this.bus?.emit) {
      this.bus.emit("cb:settings:workspace:changed", { workspace: safeClone(draft.workspace) });
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
      description: "Default-Werte für Rasteranzeige und Einrasten (werden im Workarea später live verwendet)."
    });

    secGrid.body.appendChild(
      FormField({
        type: "checkbox",
        label: "Grid aktiv",
        value: !!ws.grid?.enabled,
        onChange: (v) => this._set(["workspace", "grid", "enabled"], !!v)
      })
    );

    secGrid.body.appendChild(
      FormField({
        label: "Grid Größe",
        value: String(ws.grid?.size ?? 50),
        placeholder: "z.B. 50",
        onChange: (v) => this._set(["workspace", "grid", "size"], toNum(v, 50))
      })
    );

    secGrid.body.appendChild(
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

    secView.body.appendChild(
      FormField({
        label: "Hintergrundfarbe",
        value: String(ws.background?.color ?? "#f2f2f2"),
        placeholder: "#f2f2f2",
        onChange: (v) => this._set(["workspace", "background", "color"], String(v || "#f2f2f2"))
      })
    );

    secView.body.appendChild(
      FormField({
        label: "Viewport Quality",
        value: String(ws.viewport?.quality ?? "medium"),
        placeholder: "low | medium | high",
        onChange: (v) => this._set(["workspace", "viewport", "quality"], normalizeQuality(v))
      })
    );

    secView.body.appendChild(
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

    secUnits.body.appendChild(
      FormField({
        label: "Maßeinheiten",
        value: String(ws.units ?? "mm"),
        placeholder: "mm | cm | m",
        onChange: (v) => this._set(["workspace", "units"], normalizeUnits(v))
      })
    );

    secUnits.body.appendChild(
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
      description: "Startzustand der Docks/Bars im Workarea."
    });

    secDock.body.appendChild(
      FormField({
        type: "checkbox",
        label: "Left Dock eingeklappt",
        value: !!ws.docks?.leftCollapsed,
        onChange: (v) => this._set(["workspace", "docks", "leftCollapsed"], !!v)
      })
    );

    secDock.body.appendChild(
      FormField({
        type: "checkbox",
        label: "Right Dock eingeklappt",
        value: !!ws.docks?.rightCollapsed,
        onChange: (v) => this._set(["workspace", "docks", "rightCollapsed"], !!v)
      })
    );

    secDock.body.appendChild(
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
      description: "Diese Settings werden als Nächstes an tools:workarea angebunden (live Apply → Workarea reagiert)."
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

    // Draft auch sofort in app.ui.drafts ablegen (UX: Tabwechsel verliert nichts)
    this.store.update("app", (app) => {
      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.workspaceSettings = safeClone(this.draft);
    });
  }
}

function toNum(v, fallback) {
  const n = Number(String(v).replace(",", "."));
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
