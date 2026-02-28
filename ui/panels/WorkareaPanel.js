/**
 * ui/panels/WorkareaPanel.js
 * Version: v1.3.1-workarea-bom-tab-upgrade (2026-02-28)
 *
 * Ziel:
 * - Cybermotion-Style Arbeitsbereich als datengetriebene Shell
 * - Viewport Step 4: Canvas + ResizeObserver + RenderLoop + Pan/Zoom/Grid + Selection + Hit-Test + Objekt-Drag (Dummy Scene)
 *
 * Step 5A:
 * - Assets Tab liest echte ProjectAssets aus dem Store (app.project.projectAssets)
 * - Click auf Asset -> setzt Selection (type:"projectAsset"), 0 Risiko (read-only)
 *
 * Step 5B (neu):
 * - Place-Mode: Tap im Viewport erzeugt eine Instanz (type:"asset.instance")
 * - Instanzen werden in app.settings.workspace.scene.objects persistiert
 *
 * Step 5C (neu, requested):
 * - "Remember Workarea State" (NUR innerhalb Workarea, NICHT App-Startup!)
 * - Wenn du innerhalb der App zurück zur Workarea wechselst, soll Workarea
 *   den letzten Zustand wiederherstellen (Tabs/Mode/PlaceCtx).
 * - Beim kompletten Tab-Schließen (Safari) darf die App ruhig wieder auf
 *   Startseite landen – das ist NICHT Teil von 5C.
 *
 * Persistenz-Ort (bewusst klein & stabil):
 * - app.settings.ui.workarea
 *   { modeId, leftTabId, rightTabId, placeCtx:{projectAssetId,slotId} }

 * Step 5F (neu, requested):
 * - Workarea darf NICHT aus ui.drafts.* lesen.
 *   Drafts sind Editor-Puffer (WorkspaceSettingsPanel) und können beim „cold start“
 *   leer/alt sein. Workarea rendert ausschließlich aus:
 *   -> app.settings.workspace (und app.settings.workspace.scene.objects)
 *
 * Ziel:
 * - Nach Tab schließen + neu öffnen (iPad/Safari) siehst du wieder exakt den
 *   persistierten Workspace/Scene-Stand (Instanzen), ohne „Dummy“.

 * Step 5G (neu, requested):
 * - Hydration-Guard (iPad/Safari / Tab schließen):
 *   Beim „kalten“ Start ist der Store zwar persistent, aber die Rehydrate-Reihenfolge
 *   kann dazu führen, dass Workarea kurz mit Default-State rendert.
 *   -> UX: Spinner-Overlay anzeigen, bis activeProjectId + workspace.scene im Store da sind.
 *   -> Danach Scene injecten (rehydrate) und Overlay ausblenden.
 *
 * WICHTIG: Du wolltest NICHT, dass die App beim Start automatisch wieder in die Workarea springt.
 *          Step 5G ändert nur die Workarea-Initialisierung, wenn du sie öffnest.

 * Step 5H (neu, requested):
 * - Typ-spezifische 2D-Renderer (Placeholder) für Scene-Objekte.
 *   -> conveyor.segment / hall.procedural / asset.glb / asset.instance
 * - Macht Reload/Tab-Schließen visuell eindeutig (kein „alles ist Kreis“).


 * Step 5I (neu, architektur-sicher):
 * - Dock-Settings aus WorkspaceSettingsPanel müssen auch dann in der Workarea ankommen,
 *   wenn das WorkareaPanel beim Speichern NICHT gemountet ist (Event würde sonst "ins Leere" gehen).
 * - Lösung:
 *   1) Workarea persistiert eigene Dock-UI (manuelle Toggles) unter app.settings.ui.workarea.dockState.
 *   2) Zusätzlich merken wir, welche Workspace-Dock-Signatur zuletzt in die UI übernommen wurde
 *      (dockState.lastWorkspaceDockSigApplied).
 *   3) Beim Mount/Init: Auto-Apply, falls Workspace-Dock-Signatur sich seit der letzten Übernahme geändert hat.
 *      -> Damit wirken Änderungen aus WorkspaceSettings zuverlässig beim nächsten Öffnen,
 *         ohne dass wir den "manual docks" Fix (v1.1.4) kaputt machen.

 *
 * WICHTIG:
 * - Debug/Checker bleiben drin.
 * - Absichtlich kein PanelBase (Workarea ist eine eigene Shell).
 *
 * Verhalten (Tablet/iPhone-freundlich):
 * - Select-Mode:
 *    - Tap (unter Threshold) = Selection (Objekt via HitTest, sonst Punkt)
 *    - Drag auf Objekt (über Threshold) = Objekt verschieben (optional Snap)
 *    - Drag im leeren Bereich (über Threshold) = View pannen (1 Finger „wie früher“)
 * - Pan-Mode:
 *    - Drag = View pannen (sofort, ohne Threshold)
 * - Pinch (2 Finger):
 *    - Zoom um Midpoint (stabil), Pan/Drag wird dabei deaktiviert
 *
 * Neu in v1.1.4:
 * - Docks werden NICHT mehr automatisch aus Workspace-Settings auf UI-State "gedrückt".
 *   Du willst Docks manuell ein/ausblenden – Workarea respektiert das.
 * - Best-Effort Activate-Request: Wenn ein Projekt aktiv ist, sendet Workarea beim Mount
 *   ein "bitte Workarea aktivieren" Signal über den Bus. (Wiring muss in Shell angenommen werden.)
 *
 * Neu in v1.1.5:
 * - Workspace Settings können gezielt Docks live anwenden:
 *   Event cb:settings:workspace:changed kann { applyDocks:true } senden
 *   -> Workarea übernimmt Dock-Defaults EINMALIG (ideal: Smartphone „alles einklappen“)
 *   -> ohne den manual-docks Fix wieder kaputt zu machen.
 */

export class WorkareaPanel {
  constructor({ bus, store, rootEl, panelId, moduleKey, version } = {}) {
    this.bus = bus;
    this.store = store;
    this.rootEl = rootEl;
    this.panelId = panelId || moduleKey || "tools:workarea";
    this.version = version || "n/a";

    this._mounted = false;

    // -------------------------------------------------------------------
    // Thumbnail Cache (NEU/BUGFIX)
    // -------------------------------------------------------------------
    // Hintergrund:
    // - Für Slot-Thumbnails (dataUrl) nutzen wir _getOrCreateThumbImage().
    // - In einigen Ständen wurde _thumbCache nie initialisiert.
    //   -> Safari/iOS wirft dann: "TypeError: undefined is not an object (evaluating 'this._thumbCache.get')"
    //   -> der Render-/UI-Flow bricht ab, was indirekt Persistenz/Autosave
    //      und Panel-Rehydration sabotieren kann.
    //
    // Lösung:
    // - Cache immer im ctor initialisieren.
    // - Zusätzlich defensive Guards in _getOrCreateThumbImage().
    // - Soft-Limit, damit dataUrls nicht unendlich RAM fressen.
    this._thumbCache = new Map();
    this._thumbCacheMax = 96;
    this._thumbCacheKeys = [];

    // -------------------------------------------------------------------
    // Step 5J (NEU): Workarea Auto-Save (NUR Workarea)
    // -------------------------------------------------------------------
    // Problem (Safari/iOS):
    // - Tab-Wechsel innerhalb der SPA hält Store im RAM -> Scene bleibt sichtbar
    // - Reload / Safari schließen löscht RAM -> nur Persistenz zählt
    // - Loader/Persistor speichert aktuell NUR auf "ui:project:save" / "ui:save"
    //
    // Lösung:
    // - Immer wenn Workarea die Scene in den Store schreibt, feuern wir
    //   (gedrosselt) ein Save-Event an den globalen Persistor.
    // - Dadurch ist nach Reload/Cold-Start die Scene wieder da.
    //
    // WICHTIG:
    // - Kein globales enableAutosave() (zu viel Traffic).
    // - Debounce, damit Drag nicht jede Bewegung speichert.
    this._waAutosave = {
      enabled: true,
      debounceMs: 650,
      timer: 0,
      lastReason: "",
      // optional: wenn wir intern mal "rehydrate" Aktionen machen,
      // könnte man suppress temporär setzen. Derzeit wird Auto-Save
      // nur über _persistSceneToStore ausgelöst, daher standard: false.
      suppress: false
    };

    // Datenmodelle
    this.layout = null;
    this.tools = null;
    this.props = null;

    // UI refs
    this._els = {
      header: null,
      shell: null,

      // Docks/Regionen
      topbar: null,
      leftDock: null,
      center: null,
      rightDock: null,
      bottom: null,
      consoleDrawer: null,

      // Sub UI
      statusLine: null,
      modeSelect: null,
      leftTabsBar: null,
      rightTabsBar: null,
      leftPanelHost: null,
      rightPanelHost: null
    };

    // --- Viewport (Canvas + Resize + RenderLoop + Pan/Zoom) ---
    this._vp = {
      host: null,
      canvas: null,
      ctx2d: null,
      ro: null,
      raf: 0,
      running: false,
      w: 0,
      h: 0,
      dpr: 1,
      t0: 0,
      fps: 0,
      _fpsAcc: 0,
      _fpsN: 0,

      zoom: 1,
      offsetX: 0,
      offsetY: 0,

      pointer: {
        active: new Map(),

        // Tap-Threshold robust pro Pointer (Multi-Touch sicher)
        down: new Map(), // pointerId -> {x,y}

        // "Letzte" Koordinaten für Pan-Delta
        lastX: 0,
        lastY: 0,

        // Panning State
        isPanning: false,
        panPointerId: null, // welcher Pointer aktuell den Pan “führt”

        // Objekt-Drag State (Select-Mode)
        dragObjId: null, // Objekt, auf dem pointerdown stattfand
        dragActive: false, // wird erst nach Threshold aktiv
        dragOffset: { x: 0, y: 0 }, // world-offset zwischen Pointer und Objektzentrum

        // Flag: wurde das Objekt während Drag wirklich bewegt?
        // (damit wir am Drag-End nur dann persistieren)
        dragDirty: false,

        // Pinch State
        pinchActive: false,
        pinchDist0: 0,
        pinchZoom0: 1,
        pinchMid0: { x: 0, y: 0 }
      }
    };

    // State
    this.state = {
      modeId: "select",
      leftTabId: "tab.library",
      rightTabId: "tab.properties",
      consoleOpen: false,

      // Dock collapse (iPad friendly)
      leftDockCollapsed: false,
      rightDockCollapsed: false,
      bottomCollapsed: false,
      fullscreen: false,

      selectionPoint: null, // { wx, wy }
      selection: this._makeDummySelection("project"),

      // Step 5B: Place-Context (Quelle für Instanzen)
      // - wird gesetzt, wenn im Assets-Tab ein ProjectAsset ausgewählt wird.
      // - slotId ist optional (Default: erster Slot mit Model / erster Slot).
      placeCtx: {
        projectAssetId: null,
        slotId: null
      }
    };

    // ------------------------------------------------------------
    // Step 5C: Workarea UI-State aus Store wiederherstellen.
    // (WICHTIG: Das beeinflusst NICHT den App-Startscreen,
    //  sondern nur den Zustand, wenn Workarea geöffnet wird.)
    // ------------------------------------------------------------
    this._restoreWorkareaUiFromStore("ctor");

    // Bus subscriptions
    this._unsubs = [];

    // Workarea Settings Cache (live aus settings:workspace)
    this._cfg = this._getWorkspaceCfgFromStore();

    // -------------------------------------------------------------------
    // Scene Objects
    // -------------------------------------------------------------------
    // Step 4 (bestehend): HitTest + Drag + Selection auf "Objekten".
    // Step 5B (NEU): Place-Mode -> Instanzierung aus ProjectAssets.
    //
    // Persistenz:
    // - Wir speichern Instanzen im Store unter app.settings.workspace.scene
    //   (nur JSON), damit Reload/Pages/Snapshot stabil sind.
    // - Falls noch nichts gespeichert wurde, nutzen wir ein Dummy-Set.
    // -------------------------------------------------------------------
    this._scene = {
      objects: this._getSceneObjectsFromStoreOrDefaults()
    };

    // -------------------------------------------------------------------
    // Step 5B Stabilität (iPad/Safari / Tab schließen):
    // -------------------------------------------------------------------
    // Beim „kalten“ Start kann der Store (key:"app") beim Panel-Create
    // noch nicht vollständig rehydriert sein. Dann fallen wir auf Defaults
    // zurück, obwohl eine persistierte Scene existiert.
    //
    // Fix:
    // - Nach dem Mount rehydrieren wir die Scene best-effort erneut.
    // - Zusätzlich lauschen wir auf cb:store:changed und übernehmen die
    //   Scene, sobald sie im Store verfügbar ist.
    // -------------------------------------------------------------------
    this._sceneSync = {
      lastSig: this._sigForObjects(this._scene.objects)
    };

    // -------------------------------------------------------------------
    // Step 5G: Hydration Guard (Spinner + späteres Inject)
    // -------------------------------------------------------------------
    this._hydration = {
      ready: this._isHydratedNow(),
      overlayEl: null,
      lastReason: "ctor"
    };

    // v1.1.4: Docks NICHT automatisch vom Store steuern
    this._respectManualDocks = true;

    // v1.1.4: Best-Effort "Workarea auto-activate if project exists"
    this._didRequestActivate = false;
  }

  /* ==========================================================================
   * Lifecycle
   * ========================================================================= */

  async mount() {
    if (!this.rootEl) return;
    this._mounted = true;

    // Root vorbereiten
    this.rootEl.innerHTML = "";
    this.rootEl.classList.add("panel-root");
    this.rootEl.style.display = "flex";
    this.rootEl.style.flexDirection = "column";
    this.rootEl.style.minHeight = "0";
    this.rootEl.style.overflow = "hidden";

    // Header
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "baseline";
    header.style.gap = "10px";
    header.style.padding = "8px 10px";
    header.style.borderBottom = "1px solid rgba(255,255,255,.06)";

    const h = document.createElement("div");
    h.textContent = "Arbeitsbereich";
    h.style.fontWeight = "700";
    h.style.fontSize = "14px";

    const sub = document.createElement("div");
    sub.textContent =
      "Cybermotion Shell (Viewport Step 4: Pan/Zoom/Grid/Select/HitTest/Drag) – datengetrieben";
    sub.style.opacity = ".65";
    sub.style.fontSize = "12px";

    header.appendChild(h);
    header.appendChild(sub);
    this.rootEl.appendChild(header);

    // Step 5C (zusätzlich zu ctor-restore):
    // Falls Store erst später "warm" ist (z.B. Project load),
    // versuchen wir beim Mount noch einmal best-effort.
    this._restoreWorkareaUiFromStore("mount");

    // Shell
    const shell = document.createElement("div");
    shell.style.display = "flex";
    shell.style.flex = "1 1 auto";
    shell.style.minHeight = "0";
    shell.style.overflow = "hidden";
    this.rootEl.appendChild(shell);

    // -------------------------------------------------------------------
    // Step 5G: Best-Effort „Hydration Check“ nach Mount
    // -------------------------------------------------------------------
    // Kein Polling, nur 2 kurze Checks:
    // - sofort (nach DOM)
    // - kurz später (Safari/Pages kann Persist minimal verzögern)
    try {
      setTimeout(() => this._maybeHydrate("mount:0ms"), 0);
      setTimeout(() => this._maybeHydrate("mount:250ms"), 250);
    } catch {}

    // Docks + Center
    const leftDock = document.createElement("div");
    const center = document.createElement("div");
    const rightDock = document.createElement("div");

    leftDock.style.width = "320px";
    leftDock.style.minWidth = "240px";
    leftDock.style.maxWidth = "520px";
    leftDock.style.borderRight = "1px solid rgba(255,255,255,.06)";
    leftDock.style.display = "flex";
    leftDock.style.flexDirection = "column";
    leftDock.style.minHeight = "0";
    leftDock.style.overflow = "hidden";

    center.style.flex = "1 1 auto";
    center.style.minWidth = "0";
    center.style.display = "flex";
    center.style.flexDirection = "column";
    center.style.minHeight = "0";
    center.style.overflow = "hidden";

    rightDock.style.width = "360px";
    rightDock.style.minWidth = "260px";
    rightDock.style.maxWidth = "560px";
    rightDock.style.borderLeft = "1px solid rgba(255,255,255,.06)";
    rightDock.style.display = "flex";
    rightDock.style.flexDirection = "column";
    rightDock.style.minHeight = "0";
    rightDock.style.overflow = "hidden";

    shell.appendChild(leftDock);
    shell.appendChild(center);
    shell.appendChild(rightDock);

    // Topbar
    const topbar = document.createElement("div");
    topbar.style.height = "44px";
    topbar.style.flex = "0 0 auto";
    topbar.style.display = "flex";
    topbar.style.alignItems = "center";
    topbar.style.gap = "10px";
    topbar.style.padding = "6px 10px";
    topbar.style.borderBottom = "1px solid rgba(255,255,255,.06)";
    center.appendChild(topbar);

    // Viewport host
    const viewport = document.createElement("div");
    viewport.style.flex = "1 1 auto";
    viewport.style.minHeight = "0";
    viewport.style.display = "flex";
    viewport.style.position = "relative";
    viewport.style.background = "rgba(255,255,255,.02)";

    // ------------------------------------------------------------
    // Step 5G: Spinner-Overlay (solange Store nicht „ready“ ist)
    // ------------------------------------------------------------
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.background = "rgba(0,0,0,.18)";
    overlay.style.backdropFilter = "blur(2px)";
    overlay.style.zIndex = "50";
    // Overlay soll Interaktionen blockieren, bis wir die Scene sicher haben.
    overlay.style.pointerEvents = "auto";

    const box = document.createElement("div");
    box.style.display = "flex";
    box.style.alignItems = "center";
    box.style.gap = "10px";
    box.style.padding = "10px 12px";
    box.style.borderRadius = "10px";
    box.style.background = "rgba(20,20,20,.55)";
    box.style.border = "1px solid rgba(255,255,255,.12)";

    const spin = document.createElement("div");
    spin.style.width = "16px";
    spin.style.height = "16px";
    spin.style.borderRadius = "50%";
    spin.style.border = "2px solid rgba(255,255,255,.25)";
    spin.style.borderTopColor = "rgba(255,255,255,.85)";
    spin.style.animation = "waSpin 900ms linear infinite";

    const txt = document.createElement("div");
    txt.textContent = "Projekt wird geladen …";
    txt.style.fontSize = "12px";
    txt.style.opacity = ".9";

    const style = document.createElement("style");
    style.textContent = "@keyframes waSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}";

    box.appendChild(spin);
    box.appendChild(txt);
    overlay.appendChild(box);
    viewport.appendChild(style);
    viewport.appendChild(overlay);

    this._hydration.overlayEl = overlay;
    this._setHydrated(this._hydration.ready, "mount:init");
    viewport.style.overflow = "hidden";
    center.appendChild(viewport);

    // Bottom
    const bottom = document.createElement("div");
    bottom.style.height = "28px";
    bottom.style.flex = "0 0 auto";
    bottom.style.display = "flex";
    bottom.style.alignItems = "center";
    bottom.style.gap = "10px";
    bottom.style.padding = "0 10px";
    bottom.style.borderTop = "1px solid rgba(255,255,255,.06)";
    center.appendChild(bottom);

    // Console drawer
    const consoleDrawer = document.createElement("div");
    consoleDrawer.style.flex = "0 0 auto";
    consoleDrawer.style.display = "none";
    consoleDrawer.style.borderTop = "1px solid rgba(255,255,255,.06)";
    consoleDrawer.style.background = "rgba(0,0,0,.25)";
    consoleDrawer.style.padding = "8px 10px";
    consoleDrawer.style.fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    consoleDrawer.style.fontSize = "12px";
    consoleDrawer.textContent = "Console Drawer (Dummy) – später: Debug Log / Events";
    center.appendChild(consoleDrawer);

    // Left/Right Dock: Tabs + Host
    const leftTabsBar = this._makeTabsBar();
    const leftPanelHost = this._makePanelHost();
    leftDock.appendChild(leftTabsBar);
    leftDock.appendChild(leftPanelHost);

    const rightTabsBar = this._makeTabsBar();
    const rightPanelHost = this._makePanelHost();
    rightDock.appendChild(rightTabsBar);
    rightDock.appendChild(rightPanelHost);

    // Save refs
    this._els.header = header;
    this._els.shell = shell;
    this._els.topbar = topbar;
    this._els.leftDock = leftDock;
    this._els.center = center;
    this._els.rightDock = rightDock;
    this._els.bottom = bottom;
    this._els.consoleDrawer = consoleDrawer;

    this._els.leftTabsBar = leftTabsBar;
    this._els.rightTabsBar = rightTabsBar;
    this._els.leftPanelHost = leftPanelHost;
    this._els.rightPanelHost = rightPanelHost;

    // Viewport canvas
    this._mountViewportCanvas(viewport);

    // JSON laden (defensiv)
    try {
      this.layout = await this._loadJson("./data/workarea.layout.json");
      this.tools = await this._loadJson("./data/tools.registry.json");
      this.props = await this._loadJson("./data/properties.schemas.json");
    } catch (e) {
      console.error("[workarea] JSON load FAILED:", e);
      this._setStatus(`⚠️ Workarea JSON konnte nicht geladen werden: ${String(e?.message || e)}`);
    }

    // UI
    this._renderTopbar();
    this._renderLeftTabs();
    this._renderRightTabs();
    this._renderLeftPanel();
    this._renderRightPanel();
    this._renderBottomBar();

    // Settings initial anwenden
    // - applyDocks:"auto" übernimmt Dock-Defaults nur dann, wenn WorkspaceSettings
    //   seit dem letzten Workarea-Open eine Änderung gemacht hat (siehe Step 5I).
    this._applyWorkspaceSettingsFromStore("init", { applyDocks: "auto" });
    this._applyDockVisibility();

    // Bus wiring
    this._wireBus();

    // Best-Effort activate request
    this._requestActivateWorkareaIfProjectPresent();

    // Events
    this.bus?.emit?.("cb:workarea:layout:ready", {
      panelId: this.panelId,
      layoutId: this.layout?.id || null,
      toolsId: this.tools?.id || null,
      propsId: this.props?.id || null
    });

    this._publishModeChanged("init");
    this._publishSelectionChanged("init");

    this._setStatus("🟢 Workarea Shell bereit (Viewport Step 4 + Step 5A Assets)");
  }

  unmount() {
    this._unmountViewportCanvas();

    // Step 5J: Timer cleanup (Auto-Save Debounce)
    try {
      if (this._waAutosave?.timer) clearTimeout(this._waAutosave.timer);
      if (this._waAutosave) this._waAutosave.timer = 0;
    } catch {}

    this._mounted = false;
    try {
      for (const u of this._unsubs) {
        try {
          u?.();
        } catch {}
      }
    } catch {}
    this._unsubs = [];
    if (this.rootEl) this.rootEl.innerHTML = "";
  }

  /* ==========================================================================
   * v1.1.4: App-Wiring Helfer (Best Effort)
   * ========================================================================= */

  _requestActivateWorkareaIfProjectPresent() {
    if (this._didRequestActivate) return;
    this._didRequestActivate = true;

    const app = this.store?.get?.("app") || {};
    const activeProjectId = app?.activeProjectId || app?.activeProject?.id || null;
    if (!activeProjectId) return;

    try {
      this.bus?.emit?.("req:ui:module:activate", { moduleId: "tools:workarea", reason: "project-present" });
    } catch {}
    try {
      this.bus?.emit?.("req:ui:activeModule:set", { moduleId: "tools:workarea", reason: "project-present" });
    } catch {}
    try {
      this.bus?.emit?.("req:panel:activate", { panelId: "tools:workarea", reason: "project-present" });
    } catch {}

    this._setStatus(`ℹ️ Projekt aktiv (${activeProjectId}) – Workarea Activate-Request gesendet`);
  }

  /* ==========================================================================
   * Rendering
   * ========================================================================= */

  _renderTopbar() {
    const topbar = this._els.topbar;
    if (!topbar) return;
    topbar.innerHTML = "";

    topbar.appendChild(this._pill("Project: aktiv", "rgba(255,255,255,.06)"));
    topbar.appendChild(this._spacer());

    // Mode
    const modeWrap = document.createElement("div");
    modeWrap.style.display = "flex";
    modeWrap.style.alignItems = "center";
    modeWrap.style.gap = "8px";

    const modeLabel = document.createElement("div");
    modeLabel.textContent = "Mode";
    modeLabel.style.fontSize = "12px";
    modeLabel.style.opacity = ".75";

    const sel = document.createElement("select");
    sel.style.height = "28px";
    sel.style.borderRadius = "8px";
    sel.style.padding = "0 8px";
    sel.style.border = "1px solid rgba(255,255,255,.12)";
    sel.style.background = "rgba(0,0,0,.25)";
    sel.style.color = "inherit";

    const modes = Array.isArray(this.tools?.modes)
      ? this.tools.modes
      : [
          { id: "select", title: "Select" },
          { id: "pan", title: "Pan" },
          { id: "place", title: "Place" },
          { id: "edit", title: "Edit" }
        ];

    if (!modes.find((m) => String(m?.id) === "pan")) {
      const idx = Math.max(0, modes.findIndex((m) => String(m?.id) === "select"));
      modes.splice(idx + 1, 0, { id: "pan", title: "Pan" });
    }

    for (const m of modes) {
      const o = document.createElement("option");
      o.value = m.id;
      o.textContent = m.title || m.id;
      if (m.id === this.state.modeId) o.selected = true;
      sel.appendChild(o);
    }

    sel.addEventListener("change", () => {
      const modeId = String(sel.value || "select");
      this._setMode(modeId, "ui");
    });

    this._els.modeSelect = sel;

    modeWrap.appendChild(modeLabel);
    modeWrap.appendChild(sel);
    topbar.appendChild(modeWrap);

    // Zoom
    const zoomWrap = document.createElement("div");
    zoomWrap.style.display = "flex";
    zoomWrap.style.alignItems = "center";
    zoomWrap.style.gap = "8px";

    const zoomLabel = document.createElement("div");
    zoomLabel.textContent = "Zoom";
    zoomLabel.style.fontSize = "12px";
    zoomLabel.style.opacity = ".75";

    const zoomMinus = this._btn("−", () => this._setViewportZoom((this._vp.zoom || 1) / 1.15, "ui-minus"));
    zoomMinus.style.height = "28px";

    const zoomPlus = this._btn("+", () => this._setViewportZoom((this._vp.zoom || 1) * 1.15, "ui-plus"));
    zoomPlus.style.height = "28px";

    const zoomSlider = document.createElement("input");
    zoomSlider.type = "range";
    zoomSlider.min = String(this._cfg?.cameraMinZoom ?? 0.25);
    zoomSlider.max = String(this._cfg?.cameraMaxZoom ?? 4);
    zoomSlider.step = "0.01";
    zoomSlider.value = String(this._vp.zoom || 1);
    zoomSlider.setAttribute("data-wk-zoom-slider", "1");
    zoomSlider.style.width = "140px";

    const zoomVal = document.createElement("div");
    zoomVal.textContent = (this._vp.zoom || 1).toFixed(2);
    zoomVal.style.fontSize = "12px";
    zoomVal.style.opacity = ".75";
    zoomVal.style.minWidth = "44px";
    zoomVal.style.textAlign = "right";

    zoomSlider.addEventListener("input", () => {
      const z = Number(zoomSlider.value || 1);
      this._setViewportZoom(z, "ui-slider");
      zoomVal.textContent = (this._vp.zoom || 1).toFixed(2);
    });

    zoomWrap.appendChild(zoomLabel);
    zoomWrap.appendChild(zoomMinus);
    zoomWrap.appendChild(zoomSlider);
    zoomWrap.appendChild(zoomPlus);
    zoomWrap.appendChild(zoomVal);
    topbar.appendChild(zoomWrap);

    topbar.appendChild(
      this._pill(
        `Grid: ${this._cfg?.gridEnabled ? "on" : "off"} (${this._cfg?.gridSize || 50})`,
        "rgba(255,255,255,.06)"
      )
    );
    topbar.appendChild(this._pill(`Snap: ${this._cfg?.snapEnabled ? "on" : "off"}`, "rgba(255,255,255,.06)"));

    // Dock Controls
    const docks = document.createElement("div");
    docks.style.display = "flex";
    docks.style.gap = "6px";

    docks.appendChild(this._btn(this.state.leftDockCollapsed ? "Left ▶" : "Left ◀", () => this._toggleLeftDock()));
    docks.appendChild(this._btn(this.state.rightDockCollapsed ? "Right ◀" : "Right ▶", () => this._toggleRightDock()));
    docks.appendChild(this._btn(this.state.bottomCollapsed ? "Bottom ▲" : "Bottom ▼", () => this._toggleBottom()));
    docks.appendChild(this._btn(this.state.fullscreen ? "Exit FS" : "FS", () => this._toggleFullscreen()));

    topbar.appendChild(docks);

    // Quick Actions
    const qa = document.createElement("div");
    qa.style.display = "flex";
    qa.style.gap = "6px";

    qa.appendChild(this._btn("Focus", () => this._setStatus("Focus (Dummy)")));
    qa.appendChild(this._btn("Dummy Select", () => this._cycleDummySelection()));
    topbar.appendChild(qa);
  }

  _renderLeftTabs() {
    const tabs = this._layoutTabs("leftDock") || [
      { id: "tab.library", title: "Library" },
      { id: "tab.scene", title: "Scene" },
      { id: "tab.assets", title: "Assets" }
    ];
    this._renderTabsBar(this._els.leftTabsBar, tabs, this.state.leftTabId, (tabId) => {
      this.state.leftTabId = tabId;
      this._persistWorkareaUiToStore("leftTab");
      this._renderLeftPanel();
    });
  }

  _renderRightTabs() {
    // ----------------------------------------------------------
    // Right Tabs (Properties / BOM / Outliner)
    // ----------------------------------------------------------
    // WICHTIG: Viele Nutzer haben bereits ein altes Dock-Layout im Store
    // (z.B. nur Properties/Outliner). Dann liefert _layoutTabs("rightDock")
    // eine Liste OHNE "tab.bom" – und der BOM-Tab wäre unsichtbar.
    // => Wir upgraden hier das Layout "soft": fehlende Tabs werden ergänzt,
    //    ohne bestehende Reihenfolge kaputt zu machen.
    const tabsRaw = this._layoutTabs("rightDock") || [
      { id: "tab.properties", title: "Properties" },
      { id: "tab.params", title: "Params" },
      { id: "tab.bom", title: "BOM" },
      { id: "tab.outliner", title: "Outliner" }
    ];

    // Clone + Upgrade (nicht mutieren, falls _layoutTabs() Store-Objekte teilt)
    const tabs = Array.isArray(tabsRaw) ? tabsRaw.map(t => ({ ...t })) : [];

    const hasTab = (id) => tabs.some(t => t && t.id === id);
    if (!hasTab("tab.properties")) tabs.unshift({ id: "tab.properties", title: "Properties" });
    if (!hasTab("tab.params")) tabs.splice(1, 0, { id: "tab.params", title: "Params" });
    if (!hasTab("tab.bom")) tabs.splice(2, 0, { id: "tab.bom", title: "BOM" });
    if (!hasTab("tab.outliner")) tabs.push({ id: "tab.outliner", title: "Outliner" });

    // Fallback, falls rightTabId auf einen nicht mehr existierenden Tab zeigt.
    if (!hasTab(this.state.rightTabId)) {
      this.state.rightTabId = "tab.properties";
      this._persistWorkareaUiToStore("rightTab:fallback");
    }

    this._renderTabsBar(this._els.rightTabsBar, tabs, this.state.rightTabId, (tabId) => {
      this.state.rightTabId = tabId;
      this._persistWorkareaUiToStore("rightTab");
      this._renderRightPanel();
    });
  }

  _renderLeftPanel() {
    const host = this._els.leftPanelHost;
    if (!host) return;
    host.innerHTML = "";

    const tabId = this.state.leftTabId;

    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.opacity = ".9";
    box.style.fontSize = "13px";

    if (tabId === "tab.library") {
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Library (Dummy)</div>` +
        `<div style="opacity:.75;font-size:12px;margin-bottom:8px;">Später: Suche, Kategorien, Drag & Drop</div>`;

      box.appendChild(this._btn("→ In Place-Mode wechseln", () => this._setMode("place", "library")));
      box.appendChild(document.createElement("div")).style.height = "8px";
      box.appendChild(
        this._btn("Dummy Auswahl: Förderer", () => {
          this.state.selection = this._makeDummySelection("conveyor.segment");
          this._publishSelectionChanged("library");
          this._renderRightPanel();
        })
      );

      const hint = document.createElement("div");
      hint.style.marginTop = "10px";
      hint.style.opacity = ".75";
      hint.style.fontSize = "12px";
      hint.textContent = "Select-Mode: Tap=Select, Drag auf Objekt=Move, Drag leer=Pan. Pan-Mode: Drag=Pan.";
      box.appendChild(hint);
    } else if (tabId === "tab.scene") {
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Scene (Dummy)</div>` +
        `<div style="opacity:.75;font-size:12px;">Später: Layer / Sichtbarkeit / Lock / Outliner</div>`;
    } else if (tabId === "tab.assets") {
      // -------------------------------------------------------------------
      // Step 5A (0 Risiko):
      // - Assets Tab liest echte ProjectAssets aus dem Store (Single Source of Truth)
      // - Click auf Asset -> setzt Selection (rechts im Properties Tab sichtbar)
      //
      // Quelle:
      // - app.project.projectAssets (wie ProjectAssetsPanel es auch nutzt)
      // -------------------------------------------------------------------
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Assets</div>` +
        `<div style="opacity:.75;font-size:12px;margin-bottom:10px;">Echte ProjectAssets aus dem Store (Step 5A). Klick = Selection.</div>`;

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.style.flexWrap = "wrap";
      actions.style.marginBottom = "10px";

      actions.appendChild(
        this._btn("↻ Refresh", () => {
          this._renderLeftPanel();
          this._setStatus("Assets aktualisiert");
        })
      );

      actions.appendChild(
        this._btn("→ In Place-Mode wechseln", () => {
          this._setMode("place", "assets");
        })
      );

      box.appendChild(actions);

      const listWrap = document.createElement("div");
      listWrap.style.display = "flex";
      listWrap.style.flexDirection = "column";
      listWrap.style.gap = "8px";

      const assets = this._getProjectAssetsFromStore();

      if (!assets.length) {
        const empty = document.createElement("div");
        empty.style.opacity = ".75";
        empty.style.fontSize = "12px";
        empty.textContent = "Keine ProjectAssets im aktuellen Projekt gefunden.";
        listWrap.appendChild(empty);
      } else {
        for (const pa of assets) {
          const row = document.createElement("button");
          row.type = "button";
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.justifyContent = "space-between";
          row.style.gap = "10px";
          row.style.padding = "8px 10px";
          row.style.borderRadius = "12px";
          row.style.border = "1px solid rgba(255,255,255,.12)";
          row.style.background = "rgba(0,0,0,.20)";
          row.style.color = "inherit";
          row.style.cursor = "pointer";
          row.style.textAlign = "left";

          const isSelected = this.state.selection?.id === pa.id && this.state.selection?.type === "projectAsset";
          if (isSelected) row.style.background = "rgba(255,255,255,.12)";

          // --------------------------------------------------------------
          // Thumbnail (NEU):
          // - Cybermotion-Style: kleine Vorschau direkt in der Liste
          // - Quelle: Slot.thumbnail.dataUrl (wie AssetLab3DPanel speichert)
          // - Fallback: Platzhalter-Box
          // --------------------------------------------------------------
          const thumbWrap = document.createElement("div");
          thumbWrap.style.width = "42px";
          thumbWrap.style.height = "42px";
          thumbWrap.style.borderRadius = "10px";
          thumbWrap.style.overflow = "hidden";
          thumbWrap.style.border = "1px solid rgba(255,255,255,.10)";
          thumbWrap.style.background = "rgba(0,0,0,.25)";
          thumbWrap.style.flex = "0 0 auto";

          // Wir nehmen bevorzugt den Default-Slot (mit Model) und holen dessen Thumbnail.
          const defSlot = this._getDefaultSlotForProjectAsset(pa);
          const du = defSlot?.id ? this._getSlotThumbnailDataUrl(pa?.id, defSlot.id) : null;
          if (du) {
            const img = document.createElement("img");
            img.alt = "thumb";
            img.src = du;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            img.decoding = "async";
            img.loading = "lazy";
            thumbWrap.appendChild(img);
          } else {
            const ph = document.createElement("div");
            ph.style.width = "100%";
            ph.style.height = "100%";
            ph.style.display = "flex";
            ph.style.alignItems = "center";
            ph.style.justifyContent = "center";
            ph.style.fontSize = "12px";
            ph.style.opacity = ".7";
            ph.textContent = "—";
            thumbWrap.appendChild(ph);
          }

          const left = document.createElement("div");
          left.style.display = "flex";
          left.style.flexDirection = "column";
          left.style.gap = "2px";
          left.style.minWidth = "0";
          left.style.flex = "1 1 auto";

          const name = document.createElement("div");
          name.style.fontWeight = "700";
          name.style.fontSize = "13px";
          name.style.whiteSpace = "nowrap";
          name.style.overflow = "hidden";
          name.style.textOverflow = "ellipsis";
          name.textContent = pa.name || pa.id || "Asset";

          const meta = document.createElement("div");
          meta.style.opacity = ".75";
          meta.style.fontSize = "12px";
          meta.style.whiteSpace = "nowrap";
          meta.style.overflow = "hidden";
          meta.style.textOverflow = "ellipsis";

          const slotCount = Array.isArray(pa.slots) ? pa.slots.length : 0;
          const hasAnyModel = this._projectAssetHasAnyModel(pa);
          const srcKind = String(pa?.source?.kind || "-");
          meta.textContent = `Slots: ${slotCount} • ${hasAnyModel ? "hat Model" : "leer"} • src:${srcKind}`;

          left.appendChild(name);
          left.appendChild(meta);

          const right = document.createElement("div");
          right.style.display = "flex";
          right.style.gap = "6px";
          right.style.alignItems = "center";
          right.style.flex = "0 0 auto";

          const badge = this._pill(hasAnyModel ? "✔" : "—", hasAnyModel ? "rgba(0,255,128,.10)" : "rgba(255,255,255,.06)");
          badge.style.borderColor = hasAnyModel ? "rgba(0,255,128,.25)" : "rgba(255,255,255,.10)";

          const open = this._btn("Select", () => {
            this._selectProjectAsset(pa, "assets-tab");
            this._renderRightPanel();
            this._renderLeftPanel();
          });
          open.style.height = "28px";

          right.appendChild(badge);
          right.appendChild(open);

          row.appendChild(thumbWrap);
          row.appendChild(left);
          row.appendChild(right);

          row.addEventListener("click", () => {
            this._selectProjectAsset(pa, "assets-tab");
            this._renderRightPanel();
            this._renderLeftPanel();
          });

          listWrap.appendChild(row);
        }
      }

      box.appendChild(listWrap);

      const hint = document.createElement("div");
      hint.style.marginTop = "10px";
      hint.style.opacity = ".75";
      hint.style.fontSize = "12px";
      hint.textContent =
        "Hinweis: Step 5A liest nur aus dem Store und setzt Selection. Nächster Schritt (5B): Place-Mode → Instanz in Szene.";
      box.appendChild(hint);
    } else {
      box.textContent = `Unbekannter Tab: ${tabId}`;
    }

    host.appendChild(box);
  }

  _renderRightPanel() {
    const host = this._els.rightPanelHost;
    if (!host) return;
    host.innerHTML = "";

    const tabId = this.state.rightTabId;

    if (tabId === "tab.properties") {
      host.appendChild(this._renderPropertiesPanel());
    } else if (tabId === "tab.params") {
      host.appendChild(this._renderParamsPanel());
    } else if (tabId === "tab.bom") {
      host.appendChild(this._renderBOMPanel());
    } else if (tabId === "tab.outliner") {
      const box = document.createElement("div");
      box.style.padding = "10px";
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Outliner (Dummy)</div>` +
        `<div style="opacity:.75;font-size:12px;">Später: Objektbaum / Gruppen</div>`;
      host.appendChild(box);
    } else {
      const box = document.createElement("div");
      box.style.padding = "10px";
      box.textContent = `Unbekannter Tab: ${tabId}`;
      host.appendChild(box);
    }
  }

  _renderBottomBar() {
    const bottom = this._els.bottom;
    if (!bottom) return;
    bottom.innerHTML = "";

    const status = document.createElement("div");
    status.style.fontSize = "12px";
    status.style.opacity = ".85";
    status.textContent = "";
    this._els.statusLine = status;

    bottom.appendChild(status);
    bottom.appendChild(this._spacer());

    bottom.appendChild(this._btn("Console", () => this._toggleConsole()));
    bottom.appendChild(this._pill(`Mode: ${this.state.modeId}`, "rgba(255,255,255,.06)"));
  }


  /* ==========================================================================
   * BOM / Stückliste (Industrie-Fokus) – MVP
   * ==========================================================================
   * - Ermittelt eine Stückliste aus project.workspace.scene.objects
   * - Preise sind projektgebunden und werden unter project.assets.settings.bom gespeichert
   *   => stabil über Reload/Export/Safari-Neustart
   * - keys:
   *    asset.instance: "<projectAssetId>:<slotId>"
   *    sonst:         "type:<type>"
   */

  _renderBOMPanel() {
    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.textContent = "BOM / Stückliste";
    box.appendChild(title);

    const hint = document.createElement("div");
    hint.style.fontSize = "12px";
    hint.style.opacity = ".75";
    hint.textContent =
      "v3: bessere Labels, SKU + UOM + Hersteller/Lieferant + Kommentar, CSV/JSON Export. Preise sind projektgebunden.";
    box.appendChild(hint);

    const rows = this._computeBOMRows();
    const currency = this._getBOMCurrency();

    // Actions
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";
    actions.style.flexWrap = "wrap";

    actions.appendChild(
      this._btn("↻ Refresh", () => {
        this._renderRightPanel();
        this._setStatus("BOM aktualisiert");
      })
    );

    actions.appendChild(
      this._btn("Export CSV", async () => {
        try {
          const csv = this._makeBOMCSV(rows, currency);
          await this._copyToClipboard(csv);
          this._setStatus("✅ BOM CSV in Clipboard");
        } catch {
          this._setStatus("⚠️ CSV Export fehlgeschlagen (Clipboard?)");
        }
      })
    );

    actions.appendChild(
      this._btn("Export BOM JSON", async () => {
        try {
          const payload = this._makeBOMExportPayload(rows, currency);
          const txt = JSON.stringify(payload, null, 2);
          await this._copyToClipboard(txt);
          this._setStatus("✅ BOM JSON in Clipboard");
        } catch {
          this._setStatus("⚠️ Export fehlgeschlagen (Clipboard?)");
        }
      })
    );

    box.appendChild(actions);

    // Table
    const table = document.createElement("div");
    table.style.display = "grid";
    table.style.gridTemplateColumns = "1fr 46px 90px 90px 80px";
    table.style.gap = "6px";
    table.style.alignItems = "center";

    const hdr = (txt) => {
      const d = document.createElement("div");
      d.style.fontSize = "12px";
      d.style.opacity = ".8";
      d.style.fontWeight = "700";
      d.textContent = txt;
      return d;
    };

    table.appendChild(hdr("Position"));
    table.appendChild(hdr("Anzahl"));
    table.appendChild(hdr("Artikel-Nr."));
    table.appendChild(hdr(`Preis (${currency})`));
    table.appendChild(hdr("Σ"));

    let grand = 0;

    for (const row of rows) {
      const unitPrice = this._getBOMUnitPrice(row.key);
      const sku = this._getBOMSKU(row.key);
      const uom = this._getBOMUOM(row.key);
      const manufacturer = this._getBOMManufacturer(row.key);
      const supplier = this._getBOMSupplier(row.key);
      const comment = this._getBOMComment(row.key);
      const sum = (unitPrice || 0) * (row.qty || 0);
      grand += sum;

      const label = document.createElement("div");
      label.style.fontSize = "13px";
      label.style.overflow = "hidden";
      label.style.textOverflow = "ellipsis";
      label.style.whiteSpace = "nowrap";
      label.title = row.label || row.key;
      label.textContent = row.label || row.key;

      const qty = document.createElement("div");
      qty.style.textAlign = "center";
      qty.style.fontSize = "13px";
      qty.textContent = String(row.qty || 0);

      const skuIn = document.createElement("input");
      skuIn.type = "text";
      skuIn.value = String(sku || "");
      skuIn.placeholder = "—";
      skuIn.style.width = "100%";
      skuIn.style.padding = "6px 8px";
      skuIn.style.borderRadius = "10px";
      skuIn.style.border = "1px solid rgba(255,255,255,.14)";
      skuIn.style.background = "rgba(0,0,0,.20)";
      skuIn.style.color = "inherit";
      skuIn.style.fontSize = "13px";

      skuIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "sku", String(skuIn.value || "").trim(), "bom:sku");
        this._renderRightPanel();
      });

      const priceIn = document.createElement("input");
      priceIn.type = "number";
      priceIn.step = "0.01";
      priceIn.value = unitPrice ? String(unitPrice) : "";
      priceIn.placeholder = "—";
      priceIn.style.width = "100%";
      priceIn.style.padding = "6px 8px";
      priceIn.style.borderRadius = "10px";
      priceIn.style.border = "1px solid rgba(255,255,255,.14)";
      priceIn.style.background = "rgba(0,0,0,.20)";
      priceIn.style.color = "inherit";
      priceIn.style.fontSize = "13px";

      priceIn.addEventListener("change", () => {
        const v = Number(priceIn.value || 0);
        const p = Number.isFinite(v) && v > 0 ? v : 0;
        this._setBOMLineField(row.key, "unitPrice", p, "bom:price");
        this._renderRightPanel();
      });

      const sumDiv = document.createElement("div");
      sumDiv.style.textAlign = "right";
      sumDiv.style.fontSize = "13px";
      sumDiv.textContent = sum ? sum.toFixed(2) : "";

      table.appendChild(label);
      table.appendChild(qty);
      table.appendChild(skuIn);
      table.appendChild(priceIn);
      table.appendChild(sumDiv);

      // Detail row (UOM + Hersteller/Lieferant + Kommentar) – span over full width
      const detailRow = document.createElement("div");
      detailRow.style.gridColumn = "1 / -1";
      detailRow.style.display = "flex";
      detailRow.style.gap = "6px";
      detailRow.style.flexWrap = "wrap";
      detailRow.style.marginBottom = "6px";

      const mkInput = (placeholder, value) => {
        const i = document.createElement("input");
        i.type = "text";
        i.value = String(value || "");
        i.placeholder = placeholder;
        i.style.padding = "6px 8px";
        i.style.borderRadius = "10px";
        i.style.border = "1px solid rgba(255,255,255,.14)";
        i.style.background = "rgba(0,0,0,.20)";
        i.style.color = "inherit";
        i.style.fontSize = "12px";
        return i;
      };

      const uomSel = document.createElement("select");
      uomSel.style.padding = "6px 8px";
      uomSel.style.borderRadius = "10px";
      uomSel.style.border = "1px solid rgba(255,255,255,.14)";
      uomSel.style.background = "rgba(0,0,0,.20)";
      uomSel.style.color = "inherit";
      uomSel.style.fontSize = "12px";

      const uomOptions = ["", "Stk", "m", "kg"];
      for (const opt of uomOptions) {
        const oel = document.createElement("option");
        oel.value = opt;
        oel.textContent = opt ? `UOM: ${opt}` : "UOM: —";
        uomSel.appendChild(oel);
      }
      uomSel.value = String(uom || "");

      uomSel.addEventListener("change", () => {
        this._setBOMLineField(row.key, "uom", String(uomSel.value || "").trim(), "bom:uom");
        this._renderRightPanel();
      });

      const manIn = mkInput("Hersteller", manufacturer);
      manIn.style.minWidth = "120px";
      manIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "manufacturer", String(manIn.value || "").trim(), "bom:manufacturer");
        this._renderRightPanel();
      });

      const supIn = mkInput("Lieferant", supplier);
      supIn.style.minWidth = "120px";
      supIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "supplier", String(supIn.value || "").trim(), "bom:supplier");
        this._renderRightPanel();
      });

      const comIn = mkInput("Kommentar", comment);
      comIn.style.flex = "1";
      comIn.style.minWidth = "180px";
      comIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "comment", String(comIn.value || "").trim(), "bom:comment");
        this._renderRightPanel();
      });

      detailRow.appendChild(uomSel);
      detailRow.appendChild(manIn);
      detailRow.appendChild(supIn);
      detailRow.appendChild(comIn);
      table.appendChild(detailRow);

    }

    box.appendChild(table);

    // Footer: total + currency
    const footer = document.createElement("div");
    footer.style.marginTop = "6px";
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";
    footer.style.alignItems = "center";

    const total = document.createElement("div");
    total.style.fontWeight = "700";
    total.textContent = `Gesamt: ${grand ? grand.toFixed(2) : "—"} ${currency}`;
    footer.appendChild(total);

    const currencyWrap = document.createElement("div");
    currencyWrap.style.display = "flex";
    currencyWrap.style.gap = "6px";
    currencyWrap.style.alignItems = "center";

    const curLbl = document.createElement("div");
    curLbl.style.fontSize = "12px";
    curLbl.style.opacity = ".75";
    curLbl.textContent = "Währung:";
    currencyWrap.appendChild(curLbl);

    const curIn = document.createElement("input");
    curIn.type = "text";
    curIn.value = String(currency || "EUR");
    curIn.style.width = "70px";
    curIn.style.padding = "6px 8px";
    curIn.style.borderRadius = "10px";
    curIn.style.border = "1px solid rgba(255,255,255,.14)";
    curIn.style.background = "rgba(0,0,0,.20)";
    curIn.style.color = "inherit";
    curIn.style.fontSize = "13px";

    curIn.addEventListener("change", () => {
      const v = String(curIn.value || "EUR").trim().toUpperCase();
      this._setBOMCurrency(v || "EUR", "bom:currency");
      this._renderRightPanel();
    });

    currencyWrap.appendChild(curIn);
    footer.appendChild(currencyWrap);

    box.appendChild(footer);

    const note = document.createElement("div");
    note.style.fontSize = "12px";
    note.style.opacity = ".70";
    note.style.marginTop = "4px";
    note.textContent =
      "Hinweis: Nächster Schritt: UOM, Hersteller/Lieferant, Baugruppenstruktur, Param-Formeln & echter Export.";
    box.appendChild(note);

    return box;
  }


  _computeBOMRows() {
    const scene = this._getSceneObjectsFromStore() || [];
    const assets = this._getProjectAssetsFromStore() || [];
    const paById = new Map(assets.map((a) => [String(a.id), a]));

    const byKey = new Map();

    /**
     * BOM-Key-Regeln (MVP v2):
     * - asset.instance => "<projectAssetId>:<slotId>"
     * - sonst          => "type:<type>"
     */
    const add = (row) => {
      const key = String(row.key || "").trim();
      if (!key) return;
      const cur = byKey.get(key) || { ...row, qty: 0 };
      cur.qty += 1;
      // Meta: wir behalten die erste Meta-Info (für Export)
      cur.kind = cur.kind || row.kind;
      cur.type = cur.type || row.type;
      cur.projectAssetId = cur.projectAssetId || row.projectAssetId || null;
      cur.slotId = cur.slotId || row.slotId || null;
      cur.importName = cur.importName || row.importName || null;
      cur.label = cur.label || row.label || key;
      byKey.set(key, cur);
    };

    const clean = (s) => String(s || "").trim();

    const makeAssetLabel = (o, pa, slotName) => {
      const paName = clean(pa?.name) || "Asset";
      const sName = clean(slotName);
      const importName = clean(o?.importName) || clean(o?.lastImportName) || "";
      const parts = [];
      parts.push(paName);
      if (sName) parts.push(sName);
      if (importName) parts.push(importName);
      return parts.join(" | ");
    };

    for (const o of scene) {
      if (!o) continue;

      if (o.type === "asset.instance" && o.projectAssetId) {
        const paId = String(o.projectAssetId);
        const pa = paById.get(paId);
        const slotId = o.slotId ? String(o.slotId) : "";
        const key = `${paId}:${slotId}`;

        let slotName = "";
        if (pa && Array.isArray(pa.slots) && slotId) {
          const s = pa.slots.find((x) => String(x?.id) === slotId);
          slotName = s?.name ? String(s.name) : "";
        }

        add({
          key,
          kind: "asset.instance",
          type: "asset.instance",
          label: makeAssetLabel(o, pa, slotName),
          projectAssetId: paId,
          slotId: slotId || null,
          importName: clean(o?.importName) || null,
        });
      } else {
        const t = clean(o.type) || "unknown";
        const key = `type:${t}`;
        const name = clean(o?.name);
        const importName = clean(o?.importName) || "";
        const labelParts = [t];
        if (name) labelParts.push(name);
        if (importName) labelParts.push(importName);
        add({
          key,
          kind: t,
          type: t,
          label: labelParts.join(" | "),
          projectAssetId: null,
          slotId: null,
          importName: importName || null,
        });
      }
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const ka = String(a.kind || "");
      const kb = String(b.kind || "");
      if (ka !== kb) return ka.localeCompare(kb);
      return String(a.label || "").localeCompare(String(b.label || ""));
    });
  }


  _getBOMCurrency() {
    try {
      const app = this.store?.get?.("app") || {};
      const cur = app?.project?.assets?.settings?.bom?.currency;
      return String(cur || "EUR").trim() || "EUR";
    } catch {
      return "EUR";
    }
  }

  _setBOMCurrency(currency = "EUR", reason = "bom") {
    if (!this.store?.update) return;
    const cur = String(currency || "EUR").trim().toUpperCase() || "EUR";

    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      next.project.assets = next.project.assets && typeof next.project.assets === "object" ? next.project.assets : {};
      next.project.assets.settings = next.project.assets.settings && typeof next.project.assets.settings === "object" ? next.project.assets.settings : {};
      next.project.assets.settings.bom = next.project.assets.settings.bom && typeof next.project.assets.settings.bom === "object" ? next.project.assets.settings.bom : {};
      next.project.assets.settings.bom.currency = cur;
      return next;
    });

    try {
      this.store.update("project", (p) => {
        const proj = p && typeof p === "object" ? p : {};
        proj.assets = proj.assets && typeof proj.assets === "object" ? proj.assets : {};
        proj.assets.settings = proj.assets.settings && typeof proj.assets.settings === "object" ? proj.assets.settings : {};
        proj.assets.settings.bom = proj.assets.settings.bom && typeof proj.assets.settings.bom === "object" ? proj.assets.settings.bom : {};
        proj.assets.settings.bom.currency = cur;
        return proj;
      });
    } catch {}

    this._requestProjectSaveDebounced(`bom:currency:${reason}`);
  }

  _getBOMLineMap() {
    /**
     * BOM v2:
     * - bom.lines: { [key]: { unitPrice, sku, uom, note } }
     * Backward-Compat:
     * - bom.prices: { [key]: number }
     */
    try {
      const app = this.store?.get?.("app") || {};
      const bom = app?.project?.assets?.settings?.bom || {};
      const lines = bom?.lines && typeof bom.lines === "object" ? bom.lines : null;
      if (lines) return lines;

      const prices = bom?.prices && typeof bom.prices === "object" ? bom.prices : {};
      const map = {};
      for (const [k, v] of Object.entries(prices)) {
        const n = Number(v);
        map[String(k)] = { unitPrice: Number.isFinite(n) ? n : 0 };
      }
      return map;
    } catch {
      return {};
    }
  }

  _getBOMUnitPrice(key) {
    const k = String(key || "").trim();
    if (!k) return 0;
    const map = this._getBOMLineMap();
    const line = map?.[k];
    const n = Number(line?.unitPrice || 0);
    return Number.isFinite(n) ? n : 0;
  }

  _getBOMSKU(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.sku || "").trim();
  }

  _getBOMUOM(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.uom || "").trim();
  }



  _getBOMManufacturer(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.manufacturer || "").trim();
  }

  _getBOMSupplier(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.supplier || "").trim();
  }

  _getBOMComment(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.comment || map?.[k]?.note || "").trim();
  }



  _setBOMLineField(key, field, value, reason = "bom") {
    if (!this.store?.update) return;
    const k = String(key || "").trim();
    if (!k) return;

    const f = String(field || "").trim();

    // Normalisierung
    let v = value;
    if (f === "unitPrice") {
      const n = Number(v);
      v = Number.isFinite(n) && n > 0 ? n : 0;
    } else {
      v = String(v ?? "").trim();
      if (!v) v = "";
    }

    const apply = (obj) => {
      const next = obj && typeof obj === "object" ? obj : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      next.project.assets = next.project.assets && typeof next.project.assets === "object" ? next.project.assets : {};
      next.project.assets.settings = next.project.assets.settings && typeof next.project.assets.settings === "object" ? next.project.assets.settings : {};
      next.project.assets.settings.bom = next.project.assets.settings.bom && typeof next.project.assets.settings.bom === "object" ? next.project.assets.settings.bom : {};
      const bom = next.project.assets.settings.bom;

      bom.lines = bom.lines && typeof bom.lines === "object" ? bom.lines : {};
      bom.lines[k] = bom.lines[k] && typeof bom.lines[k] === "object" ? bom.lines[k] : {};

      if (f === "unitPrice") {
        if (v > 0) bom.lines[k].unitPrice = v;
        else delete bom.lines[k].unitPrice;

        // Backward-Compat: bom.prices spiegeln
        bom.prices = bom.prices && typeof bom.prices === "object" ? bom.prices : {};
        if (v > 0) bom.prices[k] = v;
        else delete bom.prices[k];
      } else {
        if (v) bom.lines[k][f] = v;
        else delete bom.lines[k][f];
      }

      // Cleanup: wenn line leer -> entfernen
      const line = bom.lines[k];
      if (line && typeof line === "object" && Object.keys(line).length === 0) {
        delete bom.lines[k];
      }

      return next;
    };

    // app + project parallel halten
    this.store.update("app", (app) => apply(app));
    try {
      this.store.update("project", (p0) => {
        const proj = p0 && typeof p0 === "object" ? p0 : {};
        proj.assets = proj.assets && typeof proj.assets === "object" ? proj.assets : {};
        proj.assets.settings = proj.assets.settings && typeof proj.assets.settings === "object" ? proj.assets.settings : {};
        proj.assets.settings.bom = proj.assets.settings.bom && typeof proj.assets.settings.bom === "object" ? proj.assets.settings.bom : {};
        const bom = proj.assets.settings.bom;

        bom.lines = bom.lines && typeof bom.lines === "object" ? bom.lines : {};
        bom.lines[k] = bom.lines[k] && typeof bom.lines[k] === "object" ? bom.lines[k] : {};
        if (f === "unitPrice") {
          if (v > 0) bom.lines[k].unitPrice = v;
          else delete bom.lines[k].unitPrice;

          bom.prices = bom.prices && typeof bom.prices === "object" ? bom.prices : {};
          if (v > 0) bom.prices[k] = v;
          else delete bom.prices[k];
        } else {
          if (v) bom.lines[k][f] = v;
          else delete bom.lines[k][f];
        }
        const line = bom.lines[k];
        if (line && typeof line === "object" && Object.keys(line).length === 0) {
          delete bom.lines[k];
        }

        return proj;
      });
    } catch {}

    this._requestProjectSaveDebounced(`bom:${f}:${reason}`);
  }

  _setBOMPrice(key, price, reason = "bom") {
    // Backward-Compat: bestehender Code nutzt _setBOMPrice(...)
    const v = Number(price);
    const p = Number.isFinite(v) && v > 0 ? v : 0;
    this._setBOMLineField(key, "unitPrice", p, reason);
  }


  _makeBOMExportPayload(rows, currency) {
    const cur = String(currency || "EUR").trim().toUpperCase() || "EUR";

    const items = [];
    for (const r of rows || []) {
      const key = String(r.key || "");
      const qty = Number(r.qty || 0) || 0;
      const unitPrice = this._getBOMUnitPrice(key);
      const sku = this._getBOMSKU(key);
      const uom = this._getBOMUOM(key);
      const manufacturer = this._getBOMManufacturer(key);
      const supplier = this._getBOMSupplier(key);
      const comment = this._getBOMComment(key);

      items.push({
        key,
        label: r.label || key,
        qty,
        sku: sku || "",
        uom: uom || "",
        manufacturer: manufacturer || "",
        supplier: supplier || "",
        comment: comment || "",
        unitPrice: unitPrice || 0,
        currency: cur,
        total: (unitPrice || 0) * qty,
        kind: r.kind || "",
        type: r.type || "",
        projectAssetId: r.projectAssetId || null,
        slotId: r.slotId || null,
        importName: r.importName || null,
      });
    }

    const total = items.reduce((a, b) => a + (Number(b.total) || 0), 0);

    return {
      schema: "baustellenplaner.bom.v3",
      createdAt: new Date().toISOString(),
      currency: cur,
      total,
      items,
    };
  }

  _makeBOMCSV(rows, currency) {
    const cur = String(currency || "EUR").trim().toUpperCase() || "EUR";

    // Excel/Numbers: Semikolon ist in DE oft besser – wir nutzen "," (CSV standard).
    // Wenn du später ";" willst, einfach hier umstellen.
    const esc = (v) => {
      const s = String(v ?? "");
      if (/[",\n\r]/.test(s)) return '"' + s.replaceAll('"', '""') + '"';
      return s;
    };

    const header = [
      "key",
      "label",
      "qty",
      "sku",
      "uom",
      "manufacturer",
      "supplier",
      "comment",
      "unitPrice",
      "currency",
      "total",
      "kind",
      "type",
      "projectAssetId",
      "slotId",
      "importName",
    ];

    const lines = [header.map(esc).join(";")];

    for (const r of rows || []) {
      const key = String(r.key || "");
      const qty = Number(r.qty || 0) || 0;
      const unitPrice = this._getBOMUnitPrice(key);
      const sku = this._getBOMSKU(key);
      const uom = this._getBOMUOM(key);
      const manufacturer = this._getBOMManufacturer(key);
      const supplier = this._getBOMSupplier(key);
      const comment = this._getBOMComment(key);
      const total = (unitPrice || 0) * qty;

      const row = [
        key,
        r.label || key,
        qty,
        sku || "",
        this._getBOMUOM(key) || "",
        this._getBOMManufacturer(key) || "",
        this._getBOMSupplier(key) || "",
        this._getBOMComment(key) || "",
        unitPrice || "",
        cur,
        total || "",
        r.kind || "",
        r.type || "",
        r.projectAssetId || "",
        r.slotId || "",
        r.importName || "",
      ];

      lines.push(row.map(esc).join(";"));
    }

    return lines.join("\n");
  }


  async _copyToClipboard(text) {
    const t = String(text || "");

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(t);
        return true;
      }
    } catch {}

    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }

  _renderPropertiesPanel() {
    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";

    const sel = this.state.selection || this._makeDummySelection("project");
    const schema = this._getPropsSchemaForType(sel.type);

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.textContent = schema?.title ? `Properties – ${schema.title}` : `Properties – ${sel.type}`;
    box.appendChild(title);

    const hint = document.createElement("div");
    hint.style.fontSize = "12px";
    hint.style.opacity = ".75";
    hint.textContent =
      "Dummy-Renderer: zeigt Gruppen/Felder aus properties.schemas.json. Viewport: Tap selektiert, Drag leer=Pan, Drag auf Objekt=Move.";
    box.appendChild(hint);

    // -------------------------------------------------------------------
    // Step 5B: Wenn ein ProjectAsset selektiert ist, zeigen wir eine kleine
    // "Place"-Sektion (Slot-Auswahl + Hinweis).
    // -------------------------------------------------------------------
    if (sel?.type === "projectAsset") {
      const pa = sel?.data?.projectAsset;
      const slots = Array.isArray(pa?.slots) ? pa.slots : [];

      const placeBox = document.createElement("div");
      placeBox.style.border = "1px solid rgba(255,255,255,.10)";
      placeBox.style.borderRadius = "10px";
      placeBox.style.padding = "8px";
      placeBox.style.background = "rgba(255,255,255,.04)";

      const t = document.createElement("div");
      t.style.fontWeight = "700";
      t.style.marginBottom = "6px";
      t.textContent = "Place (Step 5B)";
      placeBox.appendChild(t);

      const info = document.createElement("div");
      info.style.fontSize = "12px";
      info.style.opacity = ".8";
      info.style.marginBottom = "8px";
      info.textContent = "Im Place-Mode: Tap im Viewport platziert eine Instanz (snap optional).";
      placeBox.appendChild(info);

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.flexWrap = "wrap";

      const lab = document.createElement("div");
      lab.textContent = "Slot";
      lab.style.fontSize = "12px";
      lab.style.opacity = ".75";

      const slotSel = document.createElement("select");
      slotSel.style.height = "28px";
      slotSel.style.borderRadius = "8px";
      slotSel.style.padding = "0 8px";
      slotSel.style.border = "1px solid rgba(255,255,255,.12)";
      slotSel.style.background = "rgba(0,0,0,.25)";
      slotSel.style.color = "inherit";

      // Fallback: wenn keine Slots existieren, bleibt Select leer.
      const curSlotId = this.state?.placeCtx?.slotId || sel?.data?.place?.slotId || null;
      for (const s of slots) {
        const o = document.createElement("option");
        o.value = s.id;
        const has = this._slotHasModel(s);
        o.textContent = `${s.name || s.id}${has ? " (hat Model)" : " (leer)"}`;
        if (String(s.id) === String(curSlotId)) o.selected = true;
        slotSel.appendChild(o);
      }

      slotSel.addEventListener("change", () => {
        const id = String(slotSel.value || "") || null;
        this.state.placeCtx.projectAssetId = pa?.id || null;
        this.state.placeCtx.slotId = id;
        try {
          if (this.state.selection?.data?.place) this.state.selection.data.place.slotId = id;
        } catch {}
        this._persistWorkareaUiToStore("slot");
        this._setStatus(`Slot gewählt: ${id || "-"}`);
      });

      row.appendChild(lab);
      row.appendChild(slotSel);
      row.appendChild(this._btn("→ Place-Mode", () => this._setMode("place", "props")));
      placeBox.appendChild(row);

      box.appendChild(placeBox);
    }

    // -------------------------------------------------------------------
    // Step 6A (NEU): Transform-UI für selektierte Scene-Objekte
    // Ziel:
    //  - Rotation in Grad anzeigen + direkt editierbar (Tippen → Zahl eingeben)
    //  - Quick Buttons (-90 / +90 / 0)
    //  - Axis Space Toggle (Welt / Objekt) als Grundlage für spätere Gizmos
    //  - Löschen (Delete) als erste echte Edit-Aktion
    //
    // WICHTIG:
    //  - r bleibt Hit-Radius/Größe
    //  - rotDeg ist Rotation (persistiert in Scene)
    // -------------------------------------------------------------------
    const isPointSel = sel?.type === "selection.point";
    const isAssetSel = sel?.type === "projectAsset";
    const sceneObj = !isPointSel && !isAssetSel ? this._findSceneObjectById(sel?.id) : null;

    if (sceneObj) {
      const tbox = document.createElement("div");
      tbox.style.border = "1px solid rgba(255,255,255,.10)";
      tbox.style.borderRadius = "10px";
      tbox.style.padding = "8px";
      tbox.style.background = "rgba(255,255,255,.04)";

      const tt = document.createElement("div");
      tt.style.fontWeight = "700";
      tt.style.marginBottom = "6px";
      tt.textContent = "Transform (Step 6A)";
      tbox.appendChild(tt);

      // Axis Space (UI-State)
      const axisRow = document.createElement("div");
      axisRow.style.display = "flex";
      axisRow.style.alignItems = "center";
      axisRow.style.gap = "8px";
      axisRow.style.flexWrap = "wrap";

      const axisLab = document.createElement("div");
      axisLab.style.fontSize = "12px";
      axisLab.style.opacity = ".75";
      axisLab.textContent = "Achsen";

      const getAxisSpace = () => {
        try {
          const app = this.store?.get?.("app") || {};
          const v = app?.settings?.ui?.workarea?.transformUi?.axisSpace;
          return v === "object" ? "object" : "world";
        } catch {
          return "world";
        }
      };

      const setAxisSpace = (space) => {
        const s = space === "object" ? "object" : "world";
        try {
          this.store?.update?.("app", (app) => {
            const next = app && typeof app === "object" ? app : {};
            next.settings = next.settings && typeof next.settings === "object" ? next.settings : {};
            next.settings.ui = next.settings.ui && typeof next.settings.ui === "object" ? next.settings.ui : {};
            next.settings.ui.workarea = next.settings.ui.workarea && typeof next.settings.ui.workarea === "object" ? next.settings.ui.workarea : {};
            next.settings.ui.workarea.transformUi =
              next.settings.ui.workarea.transformUi && typeof next.settings.ui.workarea.transformUi === "object"
                ? next.settings.ui.workarea.transformUi
                : {};
            next.settings.ui.workarea.transformUi.axisSpace = s;
            next.settings.ui.workarea.updatedAt = new Date().toISOString();
            return next;
          });
        } catch {}
        this._setStatus(`Achsen: ${s === "object" ? "Objekt" : "Welt"}`);
      };

      const axisWorld = this._btn("Welt", () => {
        setAxisSpace("world");
        this._renderRightPanel();
      });
      const axisObj = this._btn("Objekt", () => {
        setAxisSpace("object");
        this._renderRightPanel();
      });

      const curAxis = getAxisSpace();
      axisWorld.style.background = curAxis === "world" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.20)";
      axisObj.style.background = curAxis === "object" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.20)";

      axisRow.appendChild(axisLab);
      axisRow.appendChild(axisWorld);
      axisRow.appendChild(axisObj);
      tbox.appendChild(axisRow);

      // Position Input (Cybermotion Level 1)
      // - X/Y direkt editierbar (Tippen → Zahl)
      // - "Snap" Button: rundet auf Grid (wenn Grid+Snap aktiv)
      // - "Reset" Button: setzt X/Y auf 0
      const posRow = document.createElement("div");
      posRow.style.display = "flex";
      posRow.style.alignItems = "center";
      posRow.style.gap = "8px";
      posRow.style.flexWrap = "wrap";
      posRow.style.marginTop = "8px";

      const posLab = document.createElement("div");
      posLab.style.fontSize = "12px";
      posLab.style.opacity = ".75";
      posLab.textContent = "Position";

      const mkNumIn = (w = 90) => {
        const el = document.createElement("input");
        el.type = "number";
        el.inputMode = "decimal";
        el.style.height = "28px";
        el.style.width = `${w}px`;
        el.style.borderRadius = "8px";
        el.style.padding = "0 8px";
        el.style.border = "1px solid rgba(255,255,255,.12)";
        el.style.background = "rgba(0,0,0,.25)";
        el.style.color = "inherit";
        return el;
      };

      const xIn = mkNumIn(90);
      const yIn = mkNumIn(90);
      xIn.value = String(Number.isFinite(Number(sceneObj.x)) ? Number(sceneObj.x) : 0);
      yIn.value = String(Number.isFinite(Number(sceneObj.y)) ? Number(sceneObj.y) : 0);

      const applyPos = (nx, ny, reason = "pos") => {
        const vx = Number(nx);
        const vy = Number(ny);
        if (!Number.isFinite(vx) || !Number.isFinite(vy)) return;
        sceneObj.x = vx;
        sceneObj.y = vy;
        try {
          if (this.state.selection?.data?.transform2d) {
            this.state.selection.data.transform2d.x = vx;
            this.state.selection.data.transform2d.y = vy;
          }
        } catch {}
        this._persistSceneToStore(reason);
        this._requestProjectSaveDebounced(reason);
        this._setStatus(`Position: X=${vx}, Y=${vy}`);
      };

      xIn.addEventListener("change", () => applyPos(xIn.value, yIn.value, "pos:input"));
      yIn.addEventListener("change", () => applyPos(xIn.value, yIn.value, "pos:input"));

      const snapToGrid = (reason = "pos:snap") => {
        const s = this._getWorkspaceSettingsSafe();
        const gs = Number(s?.grid?.size) || 10;
        const snapOn = !!(s?.grid?.enabled && s?.grid?.snap);
        // Snap nur wenn aktiv, sonst trotzdem "round" anbieten? -> wir respektieren Settings.
        if (!snapOn) {
          this._setStatus("Snap ist in WorkspaceSettings aus");
          return;
        }
        const vx = Number.isFinite(Number(sceneObj.x)) ? Number(sceneObj.x) : 0;
        const vy = Number.isFinite(Number(sceneObj.y)) ? Number(sceneObj.y) : 0;
        const rx = Math.round(vx / gs) * gs;
        const ry = Math.round(vy / gs) * gs;
        xIn.value = String(rx);
        yIn.value = String(ry);
        applyPos(rx, ry, reason);
      };

      const resetPos = () => {
        xIn.value = "0";
        yIn.value = "0";
        applyPos(0, 0, "pos:reset");
      };

      posRow.appendChild(posLab);
      posRow.appendChild(this._pill("X", "rgba(255,255,255,.06)"));
      posRow.appendChild(xIn);
      posRow.appendChild(this._pill("Y", "rgba(255,255,255,.06)"));
      posRow.appendChild(yIn);
      posRow.appendChild(this._btn("Snap", () => snapToGrid()));
      posRow.appendChild(this._btn("Reset", () => resetPos()));
      tbox.appendChild(posRow);


      // Rotation Input
      const rotRow = document.createElement("div");
      rotRow.style.display = "flex";
      rotRow.style.alignItems = "center";
      rotRow.style.gap = "8px";
      rotRow.style.flexWrap = "wrap";
      rotRow.style.marginTop = "8px";

      const rotLab = document.createElement("div");
      rotLab.style.fontSize = "12px";
      rotLab.style.opacity = ".75";
      rotLab.textContent = "Rotation (°)";

      const rotIn = document.createElement("input");
      rotIn.type = "number";
      rotIn.inputMode = "decimal";
      rotIn.style.height = "28px";
      rotIn.style.width = "90px";
      rotIn.style.borderRadius = "8px";
      rotIn.style.padding = "0 8px";
      rotIn.style.border = "1px solid rgba(255,255,255,.12)";
      rotIn.style.background = "rgba(0,0,0,.25)";
      rotIn.style.color = "inherit";
      rotIn.value = String(Number.isFinite(Number(sceneObj.rotDeg)) ? Number(sceneObj.rotDeg) : 0);
      // Rotations-Step (UI-State) – Basis für präzise Eingabe + späteres Gizmo
      const getRotStep = () => {
        try {
          const app = this.store?.get?.("app") || {};
          const v = Number(app?.settings?.ui?.workarea?.transformUi?.rotStepDeg);
          return Number.isFinite(v) && v > 0 ? v : 15;
        } catch {
          return 15;
        }
      };

      const setRotStep = (deg) => {
        const v = Number(deg);
        if (!Number.isFinite(v) || v <= 0) return;
        try {
          this.store?.update?.("app", (app) => {
            const next = app && typeof app === "object" ? app : {};
            next.settings = next.settings && typeof next.settings === "object" ? next.settings : {};
            next.settings.ui = next.settings.ui && typeof next.settings.ui === "object" ? next.settings.ui : {};
            next.settings.ui.workarea = next.settings.ui.workarea && typeof next.settings.ui.workarea === "object" ? next.settings.ui.workarea : {};
            next.settings.ui.workarea.transformUi =
              next.settings.ui.workarea.transformUi && typeof next.settings.ui.workarea.transformUi === "object"
                ? next.settings.ui.workarea.transformUi
                : {};
            next.settings.ui.workarea.transformUi.rotStepDeg = v;
            next.settings.ui.workarea.updatedAt = new Date().toISOString();
            return next;
          });
        } catch {}
      };

      const stepSel = document.createElement("select");
      stepSel.style.height = "28px";
      stepSel.style.borderRadius = "8px";
      stepSel.style.padding = "0 8px";
      stepSel.style.border = "1px solid rgba(255,255,255,.12)";
      stepSel.style.background = "rgba(0,0,0,.25)";
      stepSel.style.color = "inherit";

      const stepOptions = [1, 5, 10, 15, 30, 45, 90];
      const curStep = getRotStep();
      for (const o of stepOptions) {
        const opt = document.createElement("option");
        opt.value = String(o);
        opt.textContent = `${o}°`;
        if (o === curStep) opt.selected = true;
        stepSel.appendChild(opt);
      }
      stepSel.addEventListener("change", () => {
        setRotStep(stepSel.value);
        this._setStatus(`Rot-Step: ${Number(stepSel.value)}°`);
      });

      const bNegStep = this._btn("-step", () => applyRot((Number(sceneObj.rotDeg) || 0) - getRotStep(), "rot:-step"));
      const bPosStep = this._btn("+step", () => applyRot((Number(sceneObj.rotDeg) || 0) + getRotStep(), "rot:+step"));


      const applyRot = (deg, reason = "rot") => {
        const v = Number(deg);
        if (!Number.isFinite(v)) return;

        // Cybermotion-Level 1: Rotation immer in [0..359] normalisieren,
        // damit Eingaben wie -90 oder 450 sauber und konsistent persisted werden.
        const vNorm = ((v % 360) + 360) % 360;

        sceneObj.rotDeg = vNorm;
        try {
          if (this.state.selection?.data?.transform2d) this.state.selection.data.transform2d.rotDeg = vNorm;
        } catch {}
        this._persistSceneToStore(reason);
        this._requestProjectSaveDebounced(reason);
        this._setStatus(`Rotation: ${vNorm}°`);
      };;

      rotIn.addEventListener("change", () => applyRot(rotIn.value, "rot:input"));

      const bNeg = this._btn("-90", () => applyRot((Number(sceneObj.rotDeg) || 0) - 90, "rot:-90"));
      const bPos = this._btn("+90", () => applyRot((Number(sceneObj.rotDeg) || 0) + 90, "rot:+90"));
      const bZero = this._btn("0", () => applyRot(0, "rot:0"));

      rotRow.appendChild(rotLab);
      rotRow.appendChild(rotIn);
      rotRow.appendChild(stepSel);
      rotRow.appendChild(bNegStep);
      rotRow.appendChild(bPosStep);
      rotRow.appendChild(bNeg);
      rotRow.appendChild(bPos);
      rotRow.appendChild(bZero);
      tbox.appendChild(rotRow);

      // Duplicate + Delete
      const delRow = document.createElement("div");
      delRow.style.marginTop = "10px";

      // Duplizieren (Cybermotion-typisch): 1:1 Kopie + kleiner Offset,
      // damit man die Kopie direkt sieht.
      const dup = this._btn("⧉ Duplizieren", () => {
        try {
          this._duplicateSceneObjectById(sceneObj.id, "duplicate");
        } catch (e) {
          console.error("[workarea] duplicate failed", e);
        }
      });
      dup.style.marginRight = "8px";
      delRow.appendChild(dup);

      const del = this._btn("🗑 Löschen", () => {
        try {
          this._deleteSceneObjectById(sceneObj.id, "delete");
        } catch (e) {
          console.error("[workarea] delete failed", e);
        }
      });
      del.style.background = "rgba(255,80,80,.12)";
      del.style.borderColor = "rgba(255,80,80,.25)";
      delRow.appendChild(del);
      tbox.appendChild(delRow);

      const note = document.createElement("div");
      note.style.marginTop = "8px";
      note.style.fontSize = "12px";
      note.style.opacity = ".75";
      note.textContent = "Hinweis: In 2D sind Welt-/Objekt-Achse aktuell optisch gleich. Wir speichern das schon mit, damit später ein 3D-Gizmo (Cybermotion) sauber nachziehen kann.";
      tbox.appendChild(note);

      box.appendChild(tbox);
    }

    const groups = this._resolveSchemaGroups(schema);
    for (const g of groups) {
      const gEl = document.createElement("div");
      gEl.style.border = "1px solid rgba(255,255,255,.08)";
      gEl.style.borderRadius = "10px";
      gEl.style.padding = "8px";

      const gTitle = document.createElement("div");
      gTitle.style.fontWeight = "700";
      gTitle.style.marginBottom = "6px";
      gTitle.textContent = g.title || g.id || "Group";
      gEl.appendChild(gTitle);

      const fields = Array.isArray(g.fields) ? g.fields : [];
for (const f of fields) {
  const row = document.createElement("div");
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1fr 1.2fr";
  row.style.gap = "10px";
  row.style.alignItems = "center";
  row.style.fontSize = "12px";
  row.style.padding = "6px 0";
  row.style.borderTop = "1px dashed rgba(255,255,255,.06)";

  const l = document.createElement("div");
  l.style.opacity = ".75";
  l.textContent = f.label || f.id || "";
  row.appendChild(l);

  const ctrlHost = document.createElement("div");
  ctrlHost.style.display = "flex";
  ctrlHost.style.justifyContent = "flex-end";
  ctrlHost.style.gap = "6px";
  ctrlHost.style.flexWrap = "wrap";

  // Schema-driven Control (editierbar, wenn möglich)
  const ctrl = this._renderPropFieldControl({ sel, sceneObj, field: f });
  if (ctrl) ctrlHost.appendChild(ctrl);

  row.appendChild(ctrlHost);
  gEl.appendChild(row);
}

box.appendChild(gEl);
    }

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";
    actions.style.flexWrap = "wrap";

    actions.appendChild(this._btn("Select: Project", () => this._setSelectionType("project")));
    actions.appendChild(this._btn("Select: Hall", () => this._setSelectionType("hall.procedural")));
    actions.appendChild(this._btn("Select: Asset", () => this._setSelectionType("asset.glb")));
    actions.appendChild(this._btn("Select: Conveyor", () => this._setSelectionType("conveyor.segment")));
    box.appendChild(actions);

return box;
  }

  // Backward-Compat: ältere Stände rufen noch _renderPropertiesDummy() auf.
  _renderPropertiesDummy() {
    return this._renderPropertiesPanel();
  }


  /* ==========================================================================
   * Dock collapse helpers
   * ========================================================================= */

  _applyDockVisibility() {
    const L = this._els.leftDock;
    const R = this._els.rightDock;
    const B = this._els.bottom;

    if (this.state.fullscreen) {
      if (L) L.style.display = "none";
      if (R) R.style.display = "none";
      if (B) B.style.display = "none";
      return;
    }

    if (L) L.style.display = this.state.leftDockCollapsed ? "none" : "flex";
    if (R) R.style.display = this.state.rightDockCollapsed ? "none" : "flex";
    if (B) B.style.display = this.state.bottomCollapsed ? "none" : "flex";
  }

  _toggleLeftDock() {
    this.state.leftDockCollapsed = !this.state.leftDockCollapsed;
    this._persistWorkareaUiToStore("dock:left");
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.leftDockCollapsed ? "LeftDock eingeklappt" : "LeftDock sichtbar");
  }

  _toggleRightDock() {
    this.state.rightDockCollapsed = !this.state.rightDockCollapsed;
    this._persistWorkareaUiToStore("dock:right");
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.rightDockCollapsed ? "RightDock eingeklappt" : "RightDock sichtbar");
  }

  _toggleBottom() {
    this.state.bottomCollapsed = !this.state.bottomCollapsed;
    this._persistWorkareaUiToStore("dock:bottom");
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.bottomCollapsed ? "BottomBar eingeklappt" : "BottomBar sichtbar");
  }

  _toggleFullscreen() {
    this.state.fullscreen = !this.state.fullscreen;
    this._persistWorkareaUiToStore("dock:fullscreen");
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.fullscreen ? "Fullscreen (Docks aus)" : "Fullscreen beendet");
  }

  /* ==========================================================================
   * Bus wiring
   * ========================================================================= */

  _wireBus() {
    if (!this.bus || typeof this.bus.on !== "function") return;

    const off1 = this.bus.on("req:workarea:mode:set", (msg = {}) => {
      const modeId = String(msg?.modeId || "select");
      const reason = msg?.reason || "bus";
      this._setMode(modeId, reason);
    });

    const off2 = this.bus.on("cb:scene:selection:changed", (msg = {}) => {
      void msg;
    });

    // Live Settings (Workspace → Workarea)
    // v1.1.5: msg.applyDocks === true -> Dock-Defaults EINMALIG übernehmen
    const off3 = this.bus.on("cb:settings:workspace:changed", (msg = {}) => {
      const workspace = msg?.workspace;
      if (!workspace) return;

      const applyDocks = !!msg?.applyDocks;
      const source = String(msg?.source || "bus");

      this._applyWorkspaceSettings(workspace, `bus:${source}`, { applyDocks });
    });

    // Store-Updates: wenn ProjectAssets im Store geändert werden,
    // können wir (nur wenn Assets-Tab sichtbar) die Liste live aktualisieren.
    // 0-Risiko: kein Auto-Navigation, nur Re-Render.
    const off4 = this.bus.on("cb:store:changed", (msg = {}) => {
      try {
        if (msg?.key !== "app") return;
        if (!this._mounted) return;

        // 1) Hydration Guard (Step 5G) + Scene inject
        this._maybeHydrate("store:changed");

        // 2) Assets-Liste nur rendern, wenn Assets-Tab sichtbar ist.
        if (this.state.leftTabId === "tab.assets") this._renderLeftPanel();
      } catch {}
    });

    this._unsubs.push(off1, off2, off3, off4);
  }

  /* ==========================================================================
   * Step 5G: Hydration Guard (Spinner + späteres Scene-Inject)
   * ==========================================================================
   * Problem:
   * - iPad/Safari kann beim „kalten“ Start den Persist-Store minimal verzögert
   *   rehydrieren.
   * - Workarea mountet dann kurz mit Default-State (Dummy), obwohl die Scene im
   *   Store existiert.
   *
   * Lösung:
   * - Overlay anzeigen, solange:
   *    - activeProjectId fehlt ODER
   *    - workspace.scene fehlt
   * - Sobald vorhanden:
   *    - Scene aus Store injecten
   *    - Overlay ausblenden
   */

  _isHydratedNow() {
    try {
      const app = this.store?.get?.("app") || {};
      const pid = String(app?.activeProjectId || "").trim();
      if (!pid) return false;

      const ws = app?.settings?.workspace;
      if (!ws) return false;

      // ✅ BP 2.0:
      // Scene/Instanzen gehören zum Projekt (Daten) und werden NICHT mehr
      // als Teil der Workspace-Settings betrachtet.
      // Daher blockieren wir Hydration NICHT, wenn ws.scene fehlt.
      // Die Scene-Shape stellen wir in _maybeHydrate() unter app.project sicher.
      return true;
    } catch {
      return false;
    }
  }

  /* =====================================================================
   * Step 5K / Safari-Fix:
   * - Scene gehört projektgebunden nach: app.project.workspace.scene.objects
   * - NICHT nach app.settings.workspace.scene (Settings werden oft überschrieben)
   * ===================================================================== */

  _ensureProjectWorkspaceSceneShape(reason = "ensureProjectScene") {
    if (!this.store?.update) return false;
    try {
      const app = this.store?.get?.("app") || {};
      const pid = String(app?.activeProjectId || "").trim();
      if (!pid) return false;

      this.store.update("app", (cur) => {
        const next = cur && typeof cur === "object" ? cur : {};
        next.project = next.project && typeof next.project === "object" ? next.project : {};
        next.project.workspace = next.project.workspace && typeof next.project.workspace === "object" ? next.project.workspace : {};
        next.project.workspace.scene = next.project.workspace.scene && typeof next.project.workspace.scene === "object" ? next.project.workspace.scene : {};
        next.project.workspace.scene.objects = Array.isArray(next.project.workspace.scene.objects)
          ? next.project.workspace.scene.objects
          : [];
        return next;
      });
      return true;
    } catch {
      return false;
    }
  }

  _migrateLegacySceneIfNeeded(reason = "legacy-migrate") {
    // Einmalig: alte Stände hatten Scene in app.settings.workspace.scene.
    // Wir kopieren sie nach app.project.workspace.scene, damit sie stabil bleibt.
    if (this._sceneSync && this._sceneSync.didMigrateLegacy) return false;
    if (!this.store?.update) return false;

    try {
      const app = this.store?.get?.("app") || {};
      const legacy = app?.settings?.workspace?.scene?.objects;
      const legacyList = Array.isArray(legacy) ? legacy : null;
      if (!legacyList || legacyList.length === 0) {
        this._sceneSync = this._sceneSync || {};
        this._sceneSync.didMigrateLegacy = true;
        return false;
      }

      const projList = app?.project?.workspace?.scene?.objects;
      const projHas = Array.isArray(projList) && projList.length > 0;
      if (projHas) {
        this._sceneSync = this._sceneSync || {};
        this._sceneSync.didMigrateLegacy = true;
        return false;
      }

      // Copy legacy -> project
      this.store.update("app", (cur) => {
        const next = cur && typeof cur === "object" ? cur : {};
        next.project = next.project && typeof next.project === "object" ? next.project : {};
        next.project.workspace = next.project.workspace && typeof next.project.workspace === "object" ? next.project.workspace : {};
        next.project.workspace.scene = next.project.workspace.scene && typeof next.project.workspace.scene === "object" ? next.project.workspace.scene : {};
        next.project.workspace.scene.objects = legacyList;
        return next;
      });

      // Mirror: store.project (falls Persistor project-first ist)
      try {
        this.store.update("project", (p) => {
          const proj = p && typeof p === "object" ? p : {};
          proj.workspace = proj.workspace && typeof proj.workspace === "object" ? proj.workspace : {};
          proj.workspace.scene = proj.workspace.scene && typeof proj.workspace.scene === "object" ? proj.workspace.scene : {};
          proj.workspace.scene.objects = legacyList;
          return proj;
        });
      } catch {}

      try { this._setStatus(`🧩 Scene migriert (settings→project) (${legacyList.length}) – ${reason}`); } catch {}

      this._sceneSync = this._sceneSync || {};
      this._sceneSync.didMigrateLegacy = true;
      return true;
    } catch {
      this._sceneSync = this._sceneSync || {};
      this._sceneSync.didMigrateLegacy = true;
      return false;
    }
  }

  _setHydrated(isReady, reason = "hydration") {
    this._hydration.ready = !!isReady;
    this._hydration.lastReason = String(reason || "hydration");

    // Overlay togglen
    try {
      if (this._hydration.overlayEl) {
        this._hydration.overlayEl.style.display = this._hydration.ready
          ? "none"
          : "flex";
      }
    } catch {}

    // Statusline minimal
    try {
      if (this._els.statusLine) {
        if (!this._hydration.ready) {
          this._setStatus("⏳ Projekt wird geladen …", "warn");
        } else {
          // nicht zu aggressiv überschreiben – nur wenn wir gerade „laden“ waren
          // (User kann eigene Statusmeldungen haben)
          // -> wir lassen es still.
        }
      }
    } catch {}
  }

  _maybeHydrate(reason = "maybeHydrate") {
    if (!this._mounted) return false;

    // Step 5K: Projekt-Scene-Shape sicherstellen + Legacy-Scene migrieren
    try { this._ensureProjectWorkspaceSceneShape(reason); } catch {}
    try { this._migrateLegacySceneIfNeeded(reason); } catch {}

    const ready = this._isHydratedNow();
    if (!ready) {
      this._setHydrated(false, reason);
      return false;
    }

    // Wir sind ready -> Scene injecten (auch wenn leer)
    try {
      this._rehydrateSceneFromStore(reason, { allowEmpty: true });
    } catch {}

    this._setHydrated(true, reason);
    return true;
  }

  /* ==========================================================================
   * Step 5B Stabilität: Scene Rehydrate
   * ==========================================================================
   * Wenn Persist/Loader den Store erst NACH Panel-Erzeugung befüllt,
   * müssen wir die Scene nachziehen.
   */

  _sigForObjects(list) {
    try {
      const a = Array.isArray(list) ? list : [];
      const head = a
        .slice(0, 6)
        .map((o) => String(o?.id || "").slice(0, 32))
        .join("|");
      return `${a.length}::${head}`;
    } catch {
      return "0::";
    }
  }

  _rehydrateSceneFromStore(reason = "rehydrate", opts = {}) {
    const allowEmpty = !!opts?.allowEmpty;
    const fromStore = this._getSceneObjectsFromStore();

    if (!Array.isArray(fromStore)) return false;
    if (!allowEmpty && fromStore.length === 0) return false;

    const nextSig = this._sigForObjects(fromStore);
    if (nextSig === this._sceneSync?.lastSig) return false;

    this._scene.objects = fromStore;
    this._sceneSync.lastSig = nextSig;

    try {
      if (this._mounted) {
        this._renderRightPanel();
        this._setStatus(`🔄 Scene rehydrated (${fromStore.length}) – ${reason}`);
      }
    } catch {}

    return true;
  }

  /* ==========================================================================
   * Workspace Settings → Workarea (live)
   * ========================================================================= */

  /**
   * Step 5F: Single Source of Truth für Workspace-Konfiguration.
   * Workarea liest ausschließlich app.settings.workspace.
   * ui.drafts.* wird bewusst ignoriert (Drafts sind nur Editor-Puffer).
   */
  _getWorkspaceFromStoreStrict() {
    const app = this.store?.get?.("app") || {};
    const ws = app?.settings?.workspace || {};
    return ws && typeof ws === "object" ? ws : {};
  }

  _getWorkspaceCfgFromStore() {
    // Step 5F: Drafts werden bewusst ignoriert (Single Source of Truth).
    const ws = this._getWorkspaceFromStoreStrict();

    const gridEnabled = ws?.grid?.enabled ?? true;
    const gridSize = Number(ws?.grid?.size ?? 50) || 50;
    const snapEnabled = ws?.grid?.snap ?? true;

    const bgColor = String(ws?.background?.color || "#f2f2f2");

    const quality = String(ws?.viewport?.quality || "medium");
    const dprCap = Number(ws?.viewport?.dprCap ?? 2) || 2;

    const cam = ws?.camera || {};
    const cameraMinZoom = Number(cam.minZoom ?? 0.25) || 0.25;
    const cameraMaxZoom = Number(cam.maxZoom ?? 4) || 4;

    const docks = ws?.docks || {};
    const leftCollapsed = !!docks.leftCollapsed;
    const rightCollapsed = !!docks.rightCollapsed;
    const bottomCollapsed = !!docks.bottomCollapsed;

    return {
      gridEnabled,
      gridSize,
      snapEnabled,
      bgColor,
      quality,
      dprCap,
      docks: { leftCollapsed, rightCollapsed, bottomCollapsed },
      cameraMinZoom,
      cameraMaxZoom
    };
  }


  _applyWorkspaceSettingsFromStore(reason = "store", opts = {}) {
    // Single Source of Truth: app.settings.workspace (Step 5F)
    const app = this.store?.get?.("app") || {};
    const ws = app?.settings?.workspace || null;

    // Falls workspace noch nicht existiert (früher Mount als Rehydrate),
    // laden wir nur cfg-Defaults und wenden KEINE Docks an.
    if (!ws) {
      this._cfg = this._getWorkspaceCfgFromStore();
      this._applyCfgToUI(reason, { ...opts, applyDocks: false });
      return;
    }

    // applyDocks-Strategie:
    // - true  : explizit Docks aus Workspace übernehmen (z.B. Live-Apply aus Settings)
    // - false : Docks nicht anfassen (manual-docks Fix)
    // - "auto": beim Öffnen der Workarea nur dann übernehmen, wenn Workspace-Dock-Defaults
    //          sich seit der letzten Übernahme geändert haben (Event könnte im Settings-Panel verloren gehen).
    let applyDocks = opts?.applyDocks;

    if (applyDocks === "auto" || applyDocks === undefined) {
      const sigNow = this._dockSigFromWorkspace(ws);
      const ds = this._getWorkareaDockState();
      const sigPrev = ds?.lastWorkspaceDockSigApplied || null;

      // Wenn wir noch nie übernommen haben ODER Workspace-Signatur sich geändert hat:
      // -> Docks EINMALIG übernehmen
      applyDocks = sigNow !== sigPrev;
    } else {
      applyDocks = !!applyDocks;
    }

    this._applyWorkspaceSettings(ws, reason, { ...opts, applyDocks });
  }

  _applyWorkspaceSettings(workspace, reason = "apply", opts = {}) {
    // workspace wird nur für Dock-Signatur-Vergleich genutzt; cfg kommt strikt aus dem Store.
    this._cfg = this._getWorkspaceCfgFromStore();

    // Wenn wir Docks aus Workspace übernehmen, merken wir uns die Signatur,
    // damit Auto-Apply beim nächsten Öffnen stabil entscheiden kann.
    const applyDocks = !!opts?.applyDocks;
    if (applyDocks) {
      try {
        const sigNow = this._dockSigFromWorkspace(workspace);
        this._updateWorkareaDockSigApplied(sigNow, `apply:${reason}`);
      } catch {}
    }

    this._applyCfgToUI(reason, opts);
  }

  _applyCfgToUI(reason = "cfg", opts = {}) {
    void reason;

    const applyDocks = !!opts?.applyDocks;

    if (!this.state.fullscreen) {
      if (applyDocks) {
        this.state.leftDockCollapsed = !!this._cfg?.docks?.leftCollapsed;
        this.state.rightDockCollapsed = !!this._cfg?.docks?.rightCollapsed;
        this.state.bottomCollapsed = !!this._cfg?.docks?.bottomCollapsed;
      } else if (!this._respectManualDocks) {
        this.state.leftDockCollapsed = !!this._cfg?.docks?.leftCollapsed;
        this.state.rightDockCollapsed = !!this._cfg?.docks?.rightCollapsed;
        this.state.bottomCollapsed = !!this._cfg?.docks?.bottomCollapsed;
      }
    }

    if (this._mounted) this._applyDockVisibility();
    this._resizeViewportCanvas();

    if (applyDocks) {
      // Wenn Workspace-Docks übernommen wurden, persistieren wir den UI-Zustand,
      // damit beim nächsten Öffnen konsistent gerendert wird.
      this._persistWorkareaUiToStore("dock:apply-from-workspace");
      this._setStatus("✅ Docks aus Workspace-Settings übernommen");
      this._renderTopbar();
    }
  }

  /* ==========================================================================
   * Step 5B: Scene Persistenz + Instanzierung (Place-Mode)
   * ==========================================================================
   * Ziel:
   * - Place-Mode: Tap im Viewport erzeugt eine Instanz (Scene Object)
   * - Quelle: Selection (ProjectAsset) + optional Slot
   * - Persistenz: app.project.workspace.scene.objects (+ mirror nach store.project.workspace)
   */

  _getSceneObjectsFromStoreOrDefaults() {
    const objs = this._getSceneObjectsFromStore();
    if (Array.isArray(objs) && objs.length) return objs;
    return this._getSceneObjectsDefaults();
  }

  _getSceneObjectsDefaults() {
    // Kleines Dummy-Set, solange noch keine echte Szene im Store existiert.
    return [
      // WICHTIG: r = Hit-Radius (für HitTest/Größe im 2D-Dummy-Renderer)
      //          rotDeg = Rotation in Grad (für spätere Gizmos / 3D Achsen-Modus)
      { id: "obj-1", type: "conveyor.segment", name: "Rollenbahn A", x: -300, y: -120, r: 24, rotDeg: 0 },
      { id: "obj-2", type: "asset.glb", name: "Motor", x: 180, y: 90, r: 20, rotDeg: 0 },
      { id: "obj-3", type: "hall.procedural", name: "Halle Ecke", x: 420, y: -260, r: 28, rotDeg: 0 }
    ];
  }

  _getSceneObjectsFromStore() {
    const app = this.store?.get?.("app") || {};
    // ✅ BP 2.0: Scene ist projektgebunden
    const listProj = app?.project?.workspace?.scene?.objects;
    const listLegacy = app?.settings?.workspace?.scene?.objects;
    const list = Array.isArray(listProj)
      ? listProj
      : (Array.isArray(listLegacy) ? listLegacy : []);

    // Sanitize: nur die Felder, die wir wirklich brauchen.
    const out = [];
    for (const o of list) {
      if (!o || typeof o !== "object") continue;
      const id = String(o.id || "").trim();
      const type = String(o.type || "").trim();
      if (!id || !type) continue;
      out.push({
        id,
        type,
        name: String(o.name || id),
        x: Number(o.x || 0) || 0,
        y: Number(o.y || 0) || 0,
        r: Math.max(6, Number(o.r || 20) || 20),

        // Rotation (Grad) – bewusst getrennt von r (Hit-Radius!)
        // Default: 0
        rotDeg: Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0,

        // Asset-Referenzen (optional)
        projectAssetId: o.projectAssetId ? String(o.projectAssetId) : null,
        slotId: o.slotId ? String(o.slotId) : null,
        importName: o.importName ? String(o.importName) : null,
        preset: o.preset && typeof o.preset === "object" ? o.preset : null,
        presetTransform: o.presetTransform && typeof o.presetTransform === "object" ? o.presetTransform : null
      });
    }
    return out;
  }

  _requestProjectSaveDebounced(reason = "workarea") {
    // Debounced "ui:project:save" Trigger (globaler Persistor hört darauf)
    if (!this._waAutosave?.enabled) return;
    if (this._waAutosave?.suppress) return;

    // Keine Bus-Verbindung? Dann können wir nichts speichern, aber App läuft weiter.
    if (!this.bus?.emit) return;

    try {
      this._waAutosave.lastReason = String(reason || "workarea");
      if (this._waAutosave.timer) clearTimeout(this._waAutosave.timer);

      this._waAutosave.timer = setTimeout(() => {
        this._waAutosave.timer = 0;
        try {
          this.bus.emit("ui:project:save", { source: "workarea", reason: this._waAutosave.lastReason, ts: Date.now() });
        } catch {}
      }, Math.max(150, Number(this._waAutosave.debounceMs || 650) || 650));
    } catch {}
  }


  _persistSceneToStore(reason = "scene") {
    if (!this.store?.update) return;

    const snapshot = (this._scene?.objects || []).map((o) => ({
      id: o.id,
      type: o.type,
      name: o.name,
      x: o.x,
      y: o.y,
      r: o.r,
      rotDeg: Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0,
      projectAssetId: o.projectAssetId || null,
      slotId: o.slotId || null,
      importName: o.importName || null,
      preset: o.preset || null,
      presetTransform: o.presetTransform || null
    }));

    // 1) app.project.workspace.scene.objects (Single Source of Truth)
    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      next.project.workspace = next.project.workspace && typeof next.project.workspace === "object" ? next.project.workspace : {};
      next.project.workspace.scene = next.project.workspace.scene && typeof next.project.workspace.scene === "object" ? next.project.workspace.scene : {};
      next.project.workspace.scene.objects = snapshot;
      return next;
    });

    // 2) store.project.workspace.scene.objects (falls Persistor project-first ist)
    try {
      this.store.update("project", (p) => {
        const proj = p && typeof p === "object" ? p : {};
        proj.workspace = proj.workspace && typeof proj.workspace === "object" ? proj.workspace : {};
        proj.workspace.scene = proj.workspace.scene && typeof proj.workspace.scene === "object" ? proj.workspace.scene : {};
        proj.workspace.scene.objects = snapshot;
        return proj;
      });
    } catch {}

    try {
      this.bus?.emit?.("cb:scene:changed", { source: "workarea", reason, count: snapshot.length });
    } catch {}

    // Step 5J: Auto-Save NUR für Workarea-Scene (debounced)
    // -> sorgt dafür, dass nach Reload/Cold-Start die Instanzen wieder da sind.
    this._requestProjectSaveDebounced(`scene:${reason}`);
  }

  _makeId(prefix = "obj") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _getDefaultSlotForProjectAsset(pa) {
    const slots = Array.isArray(pa?.slots) ? pa.slots : [];
    if (!slots.length) return null;
    const withModel = slots.find((s) => this._slotHasModel(s));
    return withModel || slots[0] || null;
  }

  _placeInstanceAtWorld(world, reason = "place") {
    const sel = this.state.selection;
    if (!sel || sel.type !== "projectAsset") {
      this._setStatus("⚠️ Place: Bitte zuerst ein Asset im Assets-Tab auswählen");
      return null;
    }

    const pa = sel?.data?.projectAsset;
    if (!pa) {
      this._setStatus("⚠️ Place: Asset-Data fehlt (Selection)");
      return null;
    }

    const desiredSlotId = this.state?.placeCtx?.slotId || null;
    const slots = Array.isArray(pa?.slots) ? pa.slots : [];
    let slot = desiredSlotId ? slots.find((s) => String(s?.id) === String(desiredSlotId)) : null;
    if (!slot) slot = this._getDefaultSlotForProjectAsset(pa);

    if (!slot) {
      this._setStatus("⚠️ Place: Dieses Asset hat keine Slots");
      return null;
    }
    if (!this._slotHasModel(slot)) {
      this._setStatus("⚠️ Place: Slot hat kein Model (leer)");
      return null;
    }

    const id = this._makeId("inst");
    const name = `${pa?.name || pa?.id || "Asset"} • ${slot?.name || slot?.id || "Slot"}`;

    const obj = {
      id,
      type: "asset.instance",
      name,
      x: Number(world.wx || 0) || 0,
      y: Number(world.wy || 0) || 0,
      r: 20,
      rotDeg: 0,

      projectAssetId: pa?.id || null,
      slotId: slot?.id || null,
      importName: slot?.lastImportName || null,
      preset: slot?.preset || null,
      presetTransform: pa?.presetTransform || null
    };

    this._scene.objects.push(obj);
    this._persistSceneToStore(reason);

    this._setSelectionToObject(obj, "place");
    this._setStatus(`🧱 Instanz platziert: ${name}`);
    return obj;
  }

  /* ==========================================================================
   * State helpers
   * ========================================================================= */

  _setMode(modeId, reason = "set") {
    const prev = this.state.modeId;
    if (modeId === prev) return;

    this.state.modeId = modeId;

    const mode = this._getMode(modeId);
    if (mode?.requirements?.leftTab) this.state.leftTabId = String(mode.requirements.leftTab);
    if (mode?.requirements?.rightTab) this.state.rightTabId = String(mode.requirements.rightTab);

    if (this._els.modeSelect) this._els.modeSelect.value = modeId;

    this._renderLeftTabs();
    this._renderRightTabs();
    this._renderLeftPanel();
    this._renderRightPanel();
    this._renderBottomBar();
    this._renderTopbar();

    this._publishModeChanged(reason);
    this._setStatus(`Mode: ${modeId}`);

    // Step 5C: Mode/Tab-State persistieren, damit beim Zurückwechseln
    // in die Workarea der letzte Zustand wieder da ist.
    this._persistWorkareaUiToStore(`mode:${reason}`);
  }

  /* ==========================================================================
   * Step 5C: Remember Workarea State (Tabs/Mode/PlaceCtx)
   * ==========================================================================
   * Ziel:
   * - NICHT: App beim Start auf letztes Panel springen.
   * - JA: Wenn Workarea geöffnet wird, soll sie ihren letzten Zustand laden.
   */

  _getWorkareaUiFromStore() {
    const app = this.store?.get?.("app") || {};
    const wa = app?.settings?.ui?.workarea;
    return wa && typeof wa === "object" ? wa : null;
  }


  _getWorkareaDockState() {
    const wa = this._getWorkareaUiFromStore();
    const ds = wa?.dockState;
    return ds && typeof ds === "object" ? ds : null;
  }

  _dockSigFromWorkspace(workspaceObj) {
    // Signature ausschließlich aus Workspace-Dock-Defaults.
    // -> Stabiler Vergleich, ob WorkspaceSettings "etwas geändert hat".
    try {
      const docks = workspaceObj?.docks || {};
      const l = docks.leftCollapsed ? 1 : 0;
      const r = docks.rightCollapsed ? 1 : 0;
      const b = docks.bottomCollapsed ? 1 : 0;
      return `${l}|${r}|${b}`;
    } catch {
      return "0|0|0";
    }
  }

  _updateWorkareaDockSigApplied(sig, reason = "dockSig") {
    // Update nur des Merkers (ohne Dock-UI zu verändern).
    if (!this.store?.update) return;
    const nextSig = sig == null ? null : String(sig);

    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.settings = next.settings && typeof next.settings === "object" ? next.settings : {};
      next.settings.ui = next.settings.ui && typeof next.settings.ui === "object" ? next.settings.ui : {};
      next.settings.ui.workarea = next.settings.ui.workarea && typeof next.settings.ui.workarea === "object" ? next.settings.ui.workarea : {};

      const wa = next.settings.ui.workarea;
      wa.dockState = wa.dockState && typeof wa.dockState === "object" ? wa.dockState : {};
      wa.dockState.lastWorkspaceDockSigApplied = nextSig;
      wa.dockState.lastSigUpdatedAt = new Date().toISOString();
      wa.dockState.lastSigReason = String(reason || "dockSig");

      return next;
    });
  }
  _persistWorkareaUiToStore(reason = "ui") {
    if (!this.store?.update) return;

    const payload = {
      modeId: String(this.state.modeId || "select"),
      leftTabId: String(this.state.leftTabId || "tab.library"),
      rightTabId: String(this.state.rightTabId || "tab.properties"),

      // Dock-UI-State (manuelle Toggles innerhalb Workarea)
      dockState: {
        leftDockCollapsed: !!this.state.leftDockCollapsed,
        rightDockCollapsed: !!this.state.rightDockCollapsed,
        bottomCollapsed: !!this.state.bottomCollapsed,
        fullscreen: !!this.state.fullscreen,

        // Merker: welche Workspace-Dock-Signatur zuletzt übernommen wurde.
        // (Wird NICHT bei manuellen Toggles verändert.)
        lastWorkspaceDockSigApplied: this._getWorkareaDockState()?.lastWorkspaceDockSigApplied || null
      },

      placeCtx: {
        projectAssetId: this.state?.placeCtx?.projectAssetId || null,
        slotId: this.state?.placeCtx?.slotId || null
      },

      updatedAt: new Date().toISOString(),
      lastReason: String(reason || "ui")
    };

    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.settings = next.settings && typeof next.settings === "object" ? next.settings : {};
      next.settings.ui = next.settings.ui && typeof next.settings.ui === "object" ? next.settings.ui : {};
      next.settings.ui.workarea = payload;
      return next;
    });
  }

  _restoreWorkareaUiFromStore(reason = "restore") {
    const wa = this._getWorkareaUiFromStore();
    if (!wa) return;

    // Guard: nur bekannte Werte übernehmen.
    const modeId = String(wa.modeId || "").trim();
    if (modeId === "select" || modeId === "pan" || modeId === "place") this.state.modeId = modeId;

    const leftTabId = String(wa.leftTabId || "").trim();
    if (leftTabId) this.state.leftTabId = leftTabId;

    const rightTabId = String(wa.rightTabId || "").trim();
    if (rightTabId) this.state.rightTabId = rightTabId;


    // Dock-UI-State (manuell in Workarea)
    const ds = wa.dockState && typeof wa.dockState === "object" ? wa.dockState : null;
    if (ds) {
      this.state.leftDockCollapsed = !!ds.leftDockCollapsed;
      this.state.rightDockCollapsed = !!ds.rightDockCollapsed;
      this.state.bottomCollapsed = !!ds.bottomCollapsed;
      this.state.fullscreen = !!ds.fullscreen;
    }

    // PlaceCtx (Asset + Slot)
    const pc = wa.placeCtx && typeof wa.placeCtx === "object" ? wa.placeCtx : null;
    if (pc) {
      this.state.placeCtx.projectAssetId = pc.projectAssetId ? String(pc.projectAssetId) : null;
      this.state.placeCtx.slotId = pc.slotId ? String(pc.slotId) : null;

      // Optional: wenn wir ein Asset im Store finden, setzen wir die Selection
      // (damit rechts sofort die Place-Sektion erscheint).
      const pid = this.state.placeCtx.projectAssetId;
      if (pid) {
        const assets = this._getProjectAssetsFromStore();
        const pa = assets.find((x) => String(x?.id) === String(pid));
        if (pa) {
          const defSlot = this._getDefaultSlotForProjectAsset(pa);
          const slotId = this.state.placeCtx.slotId || defSlot?.id || null;
          this.state.selectionPoint = null;
          this.state.selection = {
            id: pa.id || "PA-unknown",
            type: "projectAsset",
            data: {
              id: pa.id,
              type: "projectAsset",
              meta: { name: pa.name || pa.id || "Asset" },
              place: { projectAssetId: pa.id || null, slotId },
              projectAsset: pa
            }
          };
          this.state.placeCtx.slotId = slotId;
        }
      }
    }

    // Wenn UI bereits gerendert ist, aktualisieren wir die sichtbaren Teile.
    if (this._mounted) {
      try {
        if (this._els.modeSelect) this._els.modeSelect.value = this.state.modeId;
        this._renderLeftTabs();
        this._renderRightTabs();
        this._renderLeftPanel();
        this._renderRightPanel();
        this._renderBottomBar();
        this._renderTopbar();
      } catch {}
    }

    // Debug (leise): beim Mount geben wir einen kleinen Hinweis, damit du
    // sofort siehst, dass das Restore wirklich greift.
    if (reason === "mount") {
      this._setStatus("Workarea: UI-State wiederhergestellt (Step 5C)");
    }
  }

  _publishModeChanged(reason) {
    this.bus?.emit?.("cb:workarea:mode:changed", {
      modeId: this.state.modeId,
      prevModeId: null,
      reason
    });
  }

  _setSelectionType(type) {
    this.state.selection = this._makeDummySelection(type);
    this._publishSelectionChanged("ui");
    this._renderRightPanel();
  }

  _cycleDummySelection() {
    const order = ["project", "hall.procedural", "asset.glb", "conveyor.segment"];
    const cur = this.state.selection?.type || "project";
    const i = Math.max(0, order.indexOf(cur));
    const next = order[(i + 1) % order.length];
    this._setSelectionType(next);
  }

  /* ==========================================================================
   * Step 5A: ProjectAssets aus Store + Selection
   * ==========================================================================
   * Ziel:
   * - Assets Tab listet echte ProjectAssets (app.project.projectAssets)
   * - Click setzt Selection (type:"projectAsset") -> Properties rechts sichtbar
   *
   * WICHTIG:
   * - Kein Import/Write (0 Risiko). Nur Lesen + Selection-State.
   */

  
  /**
   * Slot-Thumbnail lookup (project-gebunden):
   * - sucht im aktuellen Projekt die Slot-Daten (projectAssetId + slotId)
   * - liefert dataUrl oder null
   */
  _getSlotThumbnailDataUrl(projectAssetId, slotId) {
    try {
      if (!projectAssetId || !slotId) return null;
      const assets = this._getProjectAssetsFromStore();
      const a = assets.find((x) => x && String(x.id) === String(projectAssetId));
      if (!a || !Array.isArray(a.slots)) return null;
      const s = a.slots.find((y) => y && String(y.id) === String(slotId));
      const du = s?.thumbnail?.dataUrl;
      return typeof du === "string" && du.startsWith("data:image") ? du : null;
    } catch {
      return null;
    }
  }

  _getOrCreateThumbImage(dataUrl) {
    if (!dataUrl) return null;
    // Defensive: Falls ein Stand ohne ctor-init oder ein "this"-Kontextfehler
    // reinkommt, darf das UI nicht crashen.
    if (!this._thumbCache || typeof this._thumbCache.get !== "function") {
      this._thumbCache = new Map();
      this._thumbCacheKeys = [];
      this._thumbCacheMax = this._thumbCacheMax || 96;
    }

    const key = String(dataUrl);
    const cached = this._thumbCache.get(key);
    if (cached) return cached;
    const img = new Image();
    img.decoding = "async";
    img.loading = "lazy";
    img.src = key;
    this._thumbCache.set(key, img);

    // Soft-LRU (einfach): wir merken die Keys in Einfügereihenfolge und
    // löschen die ältesten, sobald das Limit überschritten ist.
    if (Array.isArray(this._thumbCacheKeys)) {
      this._thumbCacheKeys.push(key);
      const limit = Math.max(16, Number(this._thumbCacheMax) || 96);
      while (this._thumbCacheKeys.length > limit) {
        const drop = this._thumbCacheKeys.shift();
        if (drop && drop !== key) this._thumbCache.delete(drop);
      }
    }

    // optional: wenn Image geladen wurde -> einmal "nachdrehen".
    // Hintergrund:
    // - Der Viewport rendert zwar per RAF dauerhaft, aber auf iOS/Safari kann
    //   ein Image-Decode "spät" kommen (oder tabbed), und wir wollen sicher
    //   sein, dass spätestens nach dem Decode ein Frame gerendert wurde.
    // - Wir rufen NUR ein leichtes 2D-Render an (kein State-Write).
    img.onload = () => {
      try {
        if (this._vp?.canvas && this._vp?.ctx2d) this._renderViewport2D(0);
      } catch {}
    };

    // optional: wenn Image Fehler -> aus Cache entfernen
    img.onerror = () => {
      this._thumbCache.delete(key);
      if (Array.isArray(this._thumbCacheKeys)) {
        const idx = this._thumbCacheKeys.indexOf(key);
        if (idx >= 0) this._thumbCacheKeys.splice(idx, 1);
      }
    };
    return img;
  }

_getProjectAssetsFromStore() {
    const app = this.store?.get?.("app") || {};
    const project = app.project || {};
    const list = Array.isArray(project.projectAssets) ? project.projectAssets : [];
    return list;
  }

  _slotHasModel(slot) {
    // Konsistent mit ProjectAssetsPanel:
    // "Hat Modelle"-Erkennung über hasModel|exportRef|model|lastImportName
    if (!slot) return false;
    if (slot.hasModel === true) return true;
    if (slot.exportRef) return true;
    if (slot.model) return true;
    if (typeof slot.lastImportName === "string" && slot.lastImportName.trim()) return true;
    return false;
  }

  _projectAssetHasAnyModel(pa) {
    const slots = Array.isArray(pa?.slots) ? pa.slots : [];
    return slots.some((s) => this._slotHasModel(s));
  }

  _selectProjectAsset(pa, reason = "select") {
    if (!pa) return;

    // Step 5B: Default Place-Context setzen (Asset + Slot)
    // - Slot: bevorzugt erster Slot mit Model
    // - Damit kann Place-Mode sofort instanziieren.
    const defSlot = this._getDefaultSlotForProjectAsset(pa);
    this.state.placeCtx.projectAssetId = pa.id || null;
    this.state.placeCtx.slotId = defSlot?.id || null;

    // Step 5C: Merken, welches Asset/Slot zuletzt für Place gewählt wurde.
    this._persistWorkareaUiToStore("selectProjectAsset");

    // SelectionPoint im Viewport nicht anfassen (wir selektieren hier ein "Asset", kein World-Punkt)
    this.state.selectionPoint = null;

    this.state.selection = {
      id: pa.id || "PA-unknown",
      type: "projectAsset",
      data: {
        id: pa.id,
        type: "projectAsset",
        meta: {
          name: pa.name || pa.id || "Asset"
        },
        place: {
          projectAssetId: pa.id || null,
          slotId: defSlot?.id || null
        },
        projectAsset: pa
      }
    };

    this._publishSelectionChanged(reason);
    this._setStatus(`Asset selektiert: ${pa.name || pa.id}`);
  }

  _publishSelectionChanged(reason) {
    const s = this.state.selection || this._makeDummySelection("project");
    this.bus?.emit?.("cb:scene:selection:changed", {
      activeId: s.id,
      ids: [s.id],
      type: s.type,
      reason
    });
  }

  _toggleConsole() {
    this.state.consoleOpen = !this.state.consoleOpen;
    if (this._els.consoleDrawer) {
      this._els.consoleDrawer.style.display = this.state.consoleOpen ? "block" : "none";
    }
    this._setStatus(this.state.consoleOpen ? "Console geöffnet" : "Console geschlossen");
  }

  _setStatus(text) {
    if (this._els.statusLine) this._els.statusLine.textContent = text || "";
  }

  /* ==========================================================================
   * Viewport: mount/unmount/loop
   * ========================================================================= */

  _mountViewportCanvas(hostEl) {
    if (!hostEl) return;

    this._vp.host = hostEl;

    const c = document.createElement("canvas");
    c.style.width = "100%";
    c.style.height = "100%";
    c.style.display = "block";
    c.style.touchAction = "none";
    hostEl.appendChild(c);

    const ctx = c.getContext("2d", { alpha: true, desynchronized: true });
    this._vp.canvas = c;
    this._vp.ctx2d = ctx;

    // Pointer/Wheel Events
    c.addEventListener("pointerdown", (ev) => this._onViewportPointerDown(ev), { passive: false });
    c.addEventListener("pointermove", (ev) => this._onViewportPointerMove(ev), { passive: false });
    c.addEventListener("pointerup", (ev) => this._onViewportPointerUp(ev), { passive: false });
    c.addEventListener("pointercancel", (ev) => this._onViewportPointerUp(ev), { passive: false });
    c.addEventListener("wheel", (ev) => this._onViewportWheel(ev), { passive: false });

    const ro = new ResizeObserver(() => this._resizeViewportCanvas());
    ro.observe(hostEl);
    this._vp.ro = ro;

    this._resizeViewportCanvas();

    this._vp.running = true;
    this._vp.t0 = performance.now();
    this._vp.raf = requestAnimationFrame((t) => this._viewportLoop(t));
  }

  _unmountViewportCanvas() {
    if (this._vp.raf) cancelAnimationFrame(this._vp.raf);
    this._vp.raf = 0;
    this._vp.running = false;

    try {
      this._vp.ro?.disconnect?.();
    } catch {}
    this._vp.ro = null;

    try {
      if (this._vp.canvas && this._vp.canvas.parentNode) {
        this._vp.canvas.parentNode.removeChild(this._vp.canvas);
      }
    } catch {}

    this._vp.canvas = null;
    this._vp.ctx2d = null;
    this._vp.host = null;
    this._vp.w = 0;
    this._vp.h = 0;
  }

  _resizeViewportCanvas() {
    const host = this._vp.host;
    const c = this._vp.canvas;
    if (!host || !c) return;

    const r = host.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));

    const cap = Number(this._cfg?.dprCap ?? 2) || 2;
    const dpr = Math.min(cap, window.devicePixelRatio || 1);
    const bw = Math.floor(w * dpr);
    const bh = Math.floor(h * dpr);

    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
      this._vp.w = w;
      this._vp.h = h;
      this._vp.dpr = dpr;
    }
  }

  _viewportLoop(t) {
    if (!this._vp.running) return;

    const dt = Math.max(0, t - (this._vp.t0 || t));
    this._vp.t0 = t;

    if (dt > 0) {
      const fpsNow = 1000 / dt;
      this._vp._fpsAcc += fpsNow;
      this._vp._fpsN += 1;
      if (this._vp._fpsN >= 10) {
        this._vp.fps = this._vp._fpsAcc / this._vp._fpsN;
        this._vp._fpsAcc = 0;
        this._vp._fpsN = 0;
      }
    }

    this._renderViewport2D(dt);
    this._vp.raf = requestAnimationFrame((tt) => this._viewportLoop(tt));
  }

  _renderViewport2D(dt) {
    const c = this._vp.canvas;
    const ctx = this._vp.ctx2d;
    if (!c || !ctx) return;

    const dpr = this._vp.dpr || 1;
    const w = c.width;
    const h = c.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const bg = String(this._cfg?.bgColor || "#f2f2f2");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const zoom = Number(this._vp.zoom || 1);
    const ox = Number(this._vp.offsetX || 0);
    const oy = Number(this._vp.offsetY || 0);

    ctx.save();
    ctx.translate(w / 2 + ox, h / 2 + oy);
    ctx.scale(zoom, zoom);

    const gridOn = !!this._cfg?.gridEnabled;
    const baseStep = Number(this._cfg?.gridSize ?? 50) || 50;
    const step = Math.max(1, baseStep);

    const q = String(this._cfg?.quality || "medium");
    const minorA = q === "high" ? 0.1 : q === "low" ? 0.05 : 0.08;
    const majorA = q === "high" ? 0.16 : q === "low" ? 0.09 : 0.12;

    if (gridOn) {
      const invZ = 1 / Math.max(zoom, 1e-6);

      const left = (-w / 2 - ox) * invZ;
      const right = (w / 2 - ox) * invZ;
      const top = (-h / 2 - oy) * invZ;
      const bottom = (h / 2 - oy) * invZ;

      const startX = Math.floor(left / step) * step;
      const endX = Math.ceil(right / step) * step;
      const startY = Math.floor(top / step) * step;
      const endY = Math.ceil(bottom / step) * step;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(0,0,0,${minorA})`;
      ctx.lineWidth = Math.max(1, Math.floor(1 * dpr)) / zoom;

      for (let x = startX; x <= endX; x += step) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += step) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();

      const major = step * 5;
      const sX2 = Math.floor(left / major) * major;
      const eX2 = Math.ceil(right / major) * major;
      const sY2 = Math.floor(top / major) * major;
      const eY2 = Math.ceil(bottom / major) * major;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(0,0,0,${majorA})`;
      ctx.lineWidth = Math.max(1, Math.floor(2 * dpr)) / zoom;

      for (let x = sX2; x <= eX2; x += major) {
        ctx.moveTo(x, sY2);
        ctx.lineTo(x, eY2);
      }
      for (let y = sY2; y <= eY2; y += major) {
        ctx.moveTo(sX2, y);
        ctx.lineTo(eX2, y);
      }
      ctx.stroke();
    }

    // Crosshair
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = Math.max(1, Math.floor(2 * dpr)) / zoom;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.stroke();

    // -------------------------------------------------------------------
    // Step 5H (requested): Typ-spezifisches 2D Rendering
    // -------------------------------------------------------------------
    // Bisher war die Workarea bewusst „Dummy“ (alles als Kreis), damit
    // HitTest/Drag/Selection stabil ist.
    //
    // Du willst jetzt aber visuell unterscheiden können:
    //  - conveyor.segment
    //  - hall.procedural
    //  - asset.glb
    //  - asset.instance
    //
    // Das hier ist weiterhin 2D-Placeholder-Rendering (keine echte 3D
    // Geometrie), aber typ-spezifisch (Form + Label), sodass du nach
    // Reload/Tab-Schließen sofort erkennst, *was* da liegt.
    //
    // WICHTIG:
    // - Wir ändern NICHT die Daten (Scene bleibt JSON) und NICHT den
    //   HitTest-Mechanismus (r bleibt der Default Radius).
    // - Wenn später echte 3D-Preview kommt, bleibt das hier als
    //   Fallback/Debug-Overlay sinnvoll.
    // -------------------------------------------------------------------
    for (const o of this._scene?.objects || []) {
      this._drawSceneObject2D(ctx, o, { dpr, zoom });
    }

    // Selection marker
    if (this.state.selectionPoint) {
      const { wx, wy } = this.state.selectionPoint;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,128,255,0.9)";
      ctx.lineWidth = (2 * dpr) / zoom;
      ctx.arc(wx, wy, 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Overlay
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = `${Math.floor(12 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const lines = [
      `Viewport Step 4 (Pan/Zoom/Grid + HitTest + Drag)`,
      `Mode: ${this.state.modeId} | Select: Tap=Select, Drag Obj=Move, Drag leer=Pan | Pan: Drag=Pan`,
      `Grid: ${this._cfg?.gridEnabled ? "on" : "off"} (${this._cfg?.gridSize || 50})  Snap: ${
        this._cfg?.snapEnabled ? "on" : "off"
      }`,
      `Zoom: ${zoom.toFixed(2)}  Offset: ${Math.round(ox)}/${Math.round(oy)}`,
      `Size: ${this._vp.w}×${this._vp.h}  DPR:${(this._vp.dpr || 1).toFixed(2)}`,
      `dt: ${dt.toFixed(1)}ms  fps: ${this._vp.fps ? this._vp.fps.toFixed(1) : "…"}`
    ];

    const pad = Math.floor(10 * dpr);
    let y = pad + Math.floor(14 * dpr);
    for (const line of lines) {
      ctx.fillText(line, pad, y);
      y += Math.floor(16 * dpr);
    }
  }

  /* ==========================================================================
   * Step 5H: Scene 2D Renderer (typ-spezifisch)
   * ========================================================================= */

  /**
   * Zeichnet ein Scene-Objekt in der 2D Workarea.
   *
   * WICHTIG: Das ist ein Platzhalter-Renderer.
   * - Wir zeichnen bewusst simple Formen, aber pro Typ unterschiedlich.
   * - HitTest/Drag bleibt weiterhin über `o.r` (Radius) kompatibel.
   */
  _drawSceneObject2D(ctx, o, { dpr = 1, zoom = 1 } = {}) {
    if (!o) return;

    const t = String(o.type || "unknown");
    const x = Number(o.x || 0);
    const y = Number(o.y || 0);
    const r = Math.max(6, Number(o.r || 20));

    // Rotation (Grad → Rad). r bleibt Hit-Radius!
    const rotDeg = Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0;
    const rotRad = (rotDeg * Math.PI) / 180;

    // Linienbreite in World-Space konstant halten.
    const lw = (2 * dpr) / Math.max(zoom, 1e-6);

    // Mini-Label (nur wenn wir genügend Platz haben)
    const label = String(o.name || t);

    // Helper: Label
    const drawLabel = (text, dx = 0, dy = 0) => {
      // Kleine Schrift – Weltmaßstabsstabil
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.font = `${Math.max(10, Math.floor(12 * dpr))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillText(text, x + dx, y + dy);
      ctx.restore();
    };

    // Helper: Mittelpunkt
    const drawCenterDot = () => {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    };

    // Typ-spezifisch
    if (t === "conveyor.segment") {
      // Rechteck + „Rollen“ Linien
      const w = r * 3.2;
      const h = r * 1.4;
      ctx.save();
      ctx.translate(x, y);
      if (Math.abs(rotRad) > 1e-6) ctx.rotate(rotRad);

      ctx.lineWidth = lw;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      ctx.stroke();

      // Rollen
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      const n = 6;
      for (let i = 1; i < n; i++) {
        const xx = -w / 2 + (w * i) / n;
        ctx.moveTo(xx, -h / 2);
        ctx.lineTo(xx, +h / 2);
      }
      ctx.stroke();

      ctx.restore();

      drawCenterDot();
      drawLabel(`Conveyor: ${label}`, -w / 2, -h / 2 - 6);
      return;
    }

    if (t === "hall.procedural") {
      // L-Form (Ecke)
      const w = r * 3.2;
      const h = r * 3.2;
      const th = Math.max(lw * 2.2, r * 0.45);

      ctx.save();
      ctx.translate(x, y);
      if (Math.abs(rotRad) > 1e-6) ctx.rotate(rotRad);

      ctx.lineWidth = lw;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.fillStyle = "rgba(0,0,0,0.03)";
      ctx.beginPath();
      // Horizontaler Schenkel
      ctx.rect(-w / 2, -h / 2, w, th);
      // Vertikaler Schenkel
      ctx.rect(-w / 2, -h / 2, th, h);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      drawCenterDot();
      drawLabel(`Hall: ${label}`, -w / 2, -h / 2 - 6);
      return;
    }

    if (t === "asset.glb") {
      // „Box“-Icon (3D Asset)
      const s = r * 2.4;
      ctx.save();
      ctx.translate(x, y);
      if (Math.abs(rotRad) > 1e-6) ctx.rotate(rotRad);

      ctx.lineWidth = lw;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      ctx.beginPath();
      ctx.rect(-s / 2, -s / 2, s, s);
      ctx.fill();
      ctx.stroke();

      // Diagonale „Kante“
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.moveTo(-s / 2, 0);
      ctx.lineTo(0, -s / 2);
      ctx.lineTo(+s / 2, 0);
      ctx.lineTo(0, +s / 2);
      ctx.closePath();
      ctx.stroke();

      ctx.restore();

      drawCenterDot();
      drawLabel(`GLB: ${label}`, -s / 2, -s / 2 - 6);
      return;
    }

    if (t === "asset.instance") {
      // Instanz: Wenn Slot-Thumbnail vorhanden -> Bild rendern (echte Asset-Sichtbarkeit),
      // sonst Fallback-Kreis.

      const dataUrl = this._getSlotThumbnailDataUrl(o.projectAssetId, o.slotId);
      const img = dataUrl ? this._getOrCreateThumbImage(dataUrl) : null;

      // Bildgröße (world-space): orientiert sich am Hit-Radius r
      const s = r * 3.0;

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.translate(x, y);
        if (Math.abs(rotRad) > 1e-6) ctx.rotate(rotRad);

        // leichte „Card“ Hintergrundfläche für Kontrast
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.strokeStyle = "rgba(0,128,255,0.35)";
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.rect(-s / 2 - lw, -s / 2 - lw, s + 2 * lw, s + 2 * lw);
        ctx.fill();
        ctx.stroke();

        // Thumbnail
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
        ctx.restore();

        drawCenterDot();
        drawLabel(`Inst: ${label}`, -s / 2, -s / 2 - 6);
        return;
      }

      // Fallback: Kreis (stärker) + Slot-Tag
      ctx.lineWidth = lw;
      ctx.strokeStyle = "rgba(0,128,255,0.65)";
      ctx.fillStyle = "rgba(0,128,255,0.10)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const slot = o.slotId ? String(o.slotId).slice(0, 6) : "";
      drawCenterDot();
      drawLabel(`Inst: ${label}${slot ? ` (${slot}…)` : ""}`, -r, -r - 6);
      return;
    }

    // Fallback (unbekannter Typ): klassischer Kreis
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = lw;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    drawCenterDot();
    drawLabel(`${t}: ${label}`, -r, -r - 6);
  }

  /* ==========================================================================
   * Viewport Helpers (Pan/Zoom/Pointer)
   * ========================================================================= */

  _setViewportZoom(z, reason = "set") {
    const minZ = Number(this._cfg?.cameraMinZoom ?? 0.25) || 0.25;
    const maxZ = Number(this._cfg?.cameraMaxZoom ?? 4) || 4;
    const nz = Math.max(minZ, Math.min(maxZ, Number(z || 1)));
    this._vp.zoom = nz;

    try {
      const slider = this._els.topbar?.querySelector?.("[data-wk-zoom-slider='1']");
      if (slider) slider.value = String(nz);
    } catch {}

    this._setStatus(`Zoom: ${nz.toFixed(2)} (${reason})`);
  }

  _viewportClientToCanvasPx(ev) {
    const host = this._vp.host;
    const dpr = this._vp.dpr || 1;
    if (!host) return { x: 0, y: 0 };
    const r = host.getBoundingClientRect();
    return {
      x: (Number(ev.clientX || 0) - r.left) * dpr,
      y: (Number(ev.clientY || 0) - r.top) * dpr
    };
  }

  _screenCanvasToWorld(canvasPt) {
    const zoom = Number(this._vp.zoom || 1);
    const ox = Number(this._vp.offsetX || 0);
    const oy = Number(this._vp.offsetY || 0);

    const cx = (this._vp.canvas?.width || 0) / 2;
    const cy = (this._vp.canvas?.height || 0) / 2;

    return {
      wx: (canvasPt.x - cx - ox) / zoom,
      wy: (canvasPt.y - cy - oy) / zoom
    };
  }

  _applyZoomAtCanvasPoint(canvasPt, newZoom) {
    const minZ = Number(this._cfg?.cameraMinZoom ?? 0.25) || 0.25;
    const maxZ = Number(this._cfg?.cameraMaxZoom ?? 4) || 4;

    const oldZoom = Number(this._vp.zoom || 1);
    const nz = Math.max(minZ, Math.min(maxZ, Number(newZoom || 1)));
    if (!isFinite(nz) || nz <= 0) return;
    if (Math.abs(nz - oldZoom) < 1e-6) return;

    const ox = Number(this._vp.offsetX || 0);
    const oy = Number(this._vp.offsetY || 0);
    const cx = (this._vp.canvas?.width || 0) / 2;
    const cy = (this._vp.canvas?.height || 0) / 2;

    const wx = (canvasPt.x - cx - ox) / oldZoom;
    const wy = (canvasPt.y - cy - oy) / oldZoom;

    this._vp.zoom = nz;
    this._vp.offsetX = canvasPt.x - cx - wx * nz;
    this._vp.offsetY = canvasPt.y - cy - wy * nz;

    try {
      const slider = this._els.topbar?.querySelector?.("[data-wk-zoom-slider='1']");
      if (slider) slider.value = String(nz);
    } catch {}
  }

  _valuesToArray(it) {
    const out = [];
    for (const v of it) out.push(v);
    return out;
  }

  _findSceneObjectById(id) {
    const objs = this._scene?.objects || [];
    return objs.find((o) => o && o.id === id) || null;
  }

  _deleteSceneObjectById(id, reason = "delete") {
    if (!id) return;
    const objs = Array.isArray(this._scene?.objects) ? this._scene.objects : [];
    const before = objs.length;
    this._scene.objects = objs.filter((o) => o && o.id !== id);
    const after = this._scene.objects.length;

    // Selection resetten, damit Properties Panel nicht auf ein „totes“ Objekt zeigt
    if (before !== after) {
      try {
        this.state.selection = null;
        this.state.selectionPoint = null;
      } catch {}

      this._persistSceneToStore(reason);
      this._requestProjectSaveDebounced(reason);
      this._setStatus(`Gelöscht: ${id}`);
      this._renderRightPanel();
    }
  }

  _duplicateSceneObjectById(id, reason = "duplicate") {
    if (!id) return null;
    const src = this._findSceneObjectById(id);
    if (!src) return null;

    // Deep clone (Scene-Objekte sind JSON-safe)
    let copy = null;
    try {
      copy = JSON.parse(JSON.stringify(src));
    } catch {
      // Fallback: flache Kopie
      copy = { ...src };
    }

    // Neue ID (Typ-basiert: Instanzen behalten "inst"-Prefix)
    const prefix = String(src?.id || "").startsWith("inst-") || src?.type === "asset.instance" ? "inst" : "obj";
    copy.id = this._makeId(prefix);

    // Name: freundlich, aber eindeutig
    const baseName = String(src?.name || "Objekt");
    copy.name = `${baseName} (Kopie)`;

    // Sichtbarer Offset (Grid-Step). Wenn Snap aktiv ist, auf Grid runden.
    const step = this._getSnapStepWorld();
    copy.x = (Number(copy.x) || 0) + step;
    copy.y = (Number(copy.y) || 0) + step;
    if (this._cfg?.snapEnabled) {
      copy.x = Math.round(copy.x / step) * step;
      copy.y = Math.round(copy.y / step) * step;
    }

    // Safety: rotDeg bleibt erhalten (falls vorhanden) und wird normalisiert
    if (copy.rotDeg !== undefined) {
      const v = Number(copy.rotDeg);
      if (Number.isFinite(v)) copy.rotDeg = ((v % 360) + 360) % 360;
    }

    // Einfügen
    this._scene.objects = Array.isArray(this._scene?.objects) ? this._scene.objects : [];
    this._scene.objects.push(copy);

    // Selektiere neue Kopie
    try {
      this._setSelectionToObject(copy, "duplicate");
    } catch {}

    this._persistSceneToStore(reason);
    this._requestProjectSaveDebounced(reason);
    this._setStatus(`Dupliziert: ${src.id} → ${copy.id}`);
    this._renderRightPanel();
    return copy;
  }

  _hitTestWorldPoint(wx, wy) {
    const objs = this._scene?.objects || [];
    let best = null;
    let bestD2 = Infinity;

    for (const o of objs) {
      const dx = wx - o.x;
      const dy = wy - o.y;
      const d2 = dx * dx + dy * dy;
      const r = Math.max(1, Number(o.r || 20));
      if (d2 <= r * r && d2 < bestD2) {
        best = o;
        bestD2 = d2;
      }
    }
    return best;
  }

  _getTapThresholdPx() {
    return 6 * (this._vp.dpr || 1);
  }

  _getSnapStepWorld() {
    const base = Number(this._cfg?.gridSize ?? 50) || 50;
    return Math.max(1, base);
  }

  _applySnapToWorldPoint(world) {
    if (!this._cfg?.snapEnabled) return world;
    const step = this._getSnapStepWorld();
    world.wx = Math.round(world.wx / step) * step;
    world.wy = Math.round(world.wy / step) * step;
    return world;
  }

  _setSelectionToObject(o, reason = "viewport") {
    if (!o) return;
    this.state.selectionPoint = { wx: o.x, wy: o.y };
    this.state.selection = {
      id: o.id,
      type: o.type,
      data: {
        id: o.id,
        type: o.type,
        meta: { name: o.name },
        world: { x: o.x, y: o.y },

        // Step 6A: 2D Transform-Daten (Cybermotion-Style Basis)
        // rotDeg wird in der Scene persistiert und ist später 1:1 auf 3D/Gizmo übertragbar.
        transform2d: {
          rotDeg: Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0
        }
      }
    };
    this._publishSelectionChanged(reason);
    this._renderRightPanel();
  }

  _setSelectionToPoint(world, reason = "viewport") {
    this.state.selectionPoint = world;
    this.state.selection = {
      id: "sel-point",
      type: "selection.point",
      data: {
        type: "selection.point",
        world: { x: world.wx, y: world.wy },
        zoom: this._vp.zoom
      }
    };
    this._publishSelectionChanged(reason);
    this._renderRightPanel();
  }

  _onViewportPointerDown(ev) {
    const c = this._vp.canvas;
    if (!c) return;

    try {
      ev.preventDefault?.();
    } catch {}
    try {
      c.setPointerCapture?.(ev.pointerId);
    } catch {}

    const pt = this._viewportClientToCanvasPx(ev);
    const P = this._vp.pointer;

    P.active.set(ev.pointerId, { x: pt.x, y: pt.y });
    P.down.set(ev.pointerId, { x: pt.x, y: pt.y });

    P.lastX = pt.x;
    P.lastY = pt.y;

    if (P.active.size === 2) {
      const pts = this._valuesToArray(P.active.values());
      const a = pts[0],
        b = pts[1];
      const dx = b.x - a.x,
        dy = b.y - a.y;

      P.pinchActive = true;
      P.pinchDist0 = Math.max(1, Math.hypot(dx, dy));
      P.pinchZoom0 = Number(this._vp.zoom || 1);
      P.pinchMid0 = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };

      P.isPanning = false;
      P.panPointerId = null;
      P.dragDirty = false;
      P.dragActive = false;
      P.dragObjId = null;
      return;
    }

    const modeId = String(this.state.modeId || "select");

    if (modeId === "select") {
      const world0 = this._screenCanvasToWorld(pt);
      const hit0 = this._hitTestWorldPoint(world0.wx, world0.wy);
      if (hit0) {
        P.dragObjId = hit0.id;
        P.dragOffset = { x: world0.wx - hit0.x, y: world0.wy - hit0.y };
        P.dragDirty = false;
      } else {
        P.dragObjId = null;
      }
    } else {
      P.dragObjId = null;
    }

    if (modeId === "pan") {
      P.isPanning = true;
      P.panPointerId = ev.pointerId;
    } else {
      P.isPanning = false;
      P.panPointerId = null;
    }
  }

  _onViewportPointerMove(ev) {
    const c = this._vp.canvas;
    if (!c) return;

    const P = this._vp.pointer;
    if (!P.active.has(ev.pointerId)) return;

    try {
      ev.preventDefault?.();
    } catch {}

    const pt = this._viewportClientToCanvasPx(ev);
    P.active.set(ev.pointerId, { x: pt.x, y: pt.y });

    if (P.pinchActive && P.active.size >= 2) {
      const pts = this._valuesToArray(P.active.values());
      const a = pts[0],
        b = pts[1];
      const dx = b.x - a.x,
        dy = b.y - a.y;

      const dist = Math.max(1, Math.hypot(dx, dy));
      const mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
      const scale = dist / Math.max(1, P.pinchDist0);

      this._applyZoomAtCanvasPoint(mid, P.pinchZoom0 * scale);
      return;
    }

    if (P.active.size !== 1) return;

    const modeId = String(this.state.modeId || "select");
    const down = P.down.get(ev.pointerId);
    const thr = this._getTapThresholdPx();

    let movedFar = false;
    if (down) {
      const dx0 = pt.x - down.x;
      const dy0 = pt.y - down.y;
      movedFar = dx0 * dx0 + dy0 * dy0 > thr * thr;
    }

    if (modeId === "select" && P.dragObjId && !P.dragActive && movedFar) {
      const o = this._findSceneObjectById(P.dragObjId);
      if (o) {
        P.dragActive = true;
        P.isPanning = false;
        P.panPointerId = null;

        this._setSelectionToObject(o, "drag-start");

        P.lastX = pt.x;
        P.lastY = pt.y;
      } else {
        P.dragObjId = null;
      }
    }

    if (P.dragActive && P.dragObjId) {
      const o = this._findSceneObjectById(P.dragObjId);
      if (!o) {
        P.dragActive = false;
        P.dragObjId = null;
        return;
      }

      const world = this._screenCanvasToWorld(pt);

      let nx = world.wx - (P.dragOffset?.x || 0);
      let ny = world.wy - (P.dragOffset?.y || 0);

      if (this._cfg?.snapEnabled) {
        const step = this._getSnapStepWorld();
        nx = Math.round(nx / step) * step;
        ny = Math.round(ny / step) * step;
      }

      o.x = nx;
      o.y = ny;
      P.dragDirty = true;

      this.state.selectionPoint = { wx: o.x, wy: o.y };
      if (this.state.selection?.id === o.id) {
        try {
          this.state.selection.data.world.x = o.x;
          this.state.selection.data.world.y = o.y;
        } catch {}
      }
      return;
    }

    if (modeId === "pan") {
      if (!P.isPanning) {
        P.isPanning = true;
        P.panPointerId = ev.pointerId;
        P.lastX = pt.x;
        P.lastY = pt.y;
      }
    } else {
      if (!P.isPanning && movedFar && !P.dragObjId) {
        P.isPanning = true;
        P.panPointerId = ev.pointerId;
        P.lastX = pt.x;
        P.lastY = pt.y;
      }
    }

    if (P.isPanning && P.panPointerId === ev.pointerId) {
      this._vp.offsetX = Number(this._vp.offsetX || 0) + (pt.x - P.lastX);
      this._vp.offsetY = Number(this._vp.offsetY || 0) + (pt.y - P.lastY);
      P.lastX = pt.x;
      P.lastY = pt.y;
    }
  }

  _onViewportPointerUp(ev) {
    const P = this._vp.pointer;

    // -------------------------------------------------------------------
    // Tap-Gesten (unter Threshold)
    // - Select-Mode: Objekt selektieren oder Selection-Point setzen
    // - Place-Mode: Objekt selektieren oder Instanz platzieren
    // -------------------------------------------------------------------
    const modeIdNow = String(this.state.modeId);

    if ((modeIdNow === "select" || modeIdNow === "place") && !P.pinchActive && !P.dragActive) {
      const last = P.active.get(ev.pointerId);
      const down = P.down.get(ev.pointerId);

      if (last && down) {
        const dx = last.x - down.x;
        const dy = last.y - down.y;
        const thr = this._getTapThresholdPx();

        if (dx * dx + dy * dy <= thr * thr) {
          const world = this._screenCanvasToWorld(last);
          this._applySnapToWorldPoint(world);

          const hit = this._hitTestWorldPoint(world.wx, world.wy);

          if (hit) {
            // Immer selektierbar (auch im Place-Mode)
            this._setSelectionToObject(hit, "tap");
          } else if (modeIdNow === "place") {
            // Place-Mode: Instanz platzieren
            this._placeInstanceAtWorld(world, "place-tap");
          } else {
            // Select-Mode: nur Point Selection
            this._setSelectionToPoint(world, "tap");
          }
        }
      }
    }

    if (P.dragActive && P.dragObjId) {
      const o = this._findSceneObjectById(P.dragObjId);
      if (o) {
        this._setSelectionToObject(o, "drag-end");

        // Step 5J: Persist + Auto-Save erst am Drag-End (nicht bei jedem Move)
        // -> damit Objekt-Positionen nach Reload/Cold-Start korrekt bleiben.
        if (P.dragDirty) {
          this._persistSceneToStore("drag-end");
        }
      }
      P.dragDirty = false;
      P.dragActive = false;
      P.dragObjId = null;
    }

    P.active.delete(ev.pointerId);
    P.down.delete(ev.pointerId);

    if (P.panPointerId === ev.pointerId) {
      P.isPanning = false;
      P.panPointerId = null;
    }

    if (P.active.size < 2) {
      P.pinchActive = false;
      P.pinchDist0 = 0;
    }

    if (P.active.size === 0) {
      P.isPanning = false;
      P.panPointerId = null;
      P.dragActive = false;
      P.dragObjId = null;
    }
  }

  _onViewportWheel(ev) {
    const c = this._vp.canvas;
    if (!c) return;

    try {
      ev.preventDefault?.();
    } catch {}

    const pt = this._viewportClientToCanvasPx(ev);
    const dy = Number(ev.deltaY || 0);
    const factor = Math.exp(-dy * 0.0015);

    this._applyZoomAtCanvasPoint(pt, Number(this._vp.zoom || 1) * factor);
  }

  /* ==========================================================================
   * JSON + schema helpers
   * ========================================================================= */

  async _loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`loadJson: ${res.status} ${res.statusText} (${url})`);
    return await res.json();
  }

  _layoutTabs(regionKey) {
    try {
      const reg = this.layout?.root?.regions?.[regionKey];
      if (!reg) return null;
      if (!Array.isArray(reg.tabs)) return null;
      return reg.tabs.map((t) => ({ id: t.id, title: t.title || t.id, icon: t.icon || null }));
    } catch {
      return null;
    }
  }

  _getMode(modeId) {
    const modes = Array.isArray(this.tools?.modes) ? this.tools.modes : [];
    return modes.find((m) => m && m.id === modeId) || null;
  }

  _getPropsSchemaForType(type) {
    const types = this.props?.types || {};
    return types?.[type] || (type === "project" ? types?.project : null) || this.props?.fallback || null;
  }

  _resolveSchemaGroups(schema) {
    if (!schema) return [];
    const out = [];

    const commonIds = Array.isArray(schema.includeCommon) ? schema.includeCommon : [];
    if (commonIds.length) {
      const commons = Array.isArray(this.props?.commonGroups) ? this.props.commonGroups : [];
      for (const id of commonIds) {
        const g = commons.find((x) => x && x.id === id);
        if (g) out.push(g);
      }
    }

    if (Array.isArray(schema.groups)) out.push(...schema.groups);
    return out;
  }

  _getByPath(obj, path) {
    if (path === "$") return obj;
    if (!path || typeof path !== "string") return undefined;
    const parts = path.split(".").filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  _makeDummySelection(type) {
    if (type === "project") {
      return {
        id: "proj-1",
        type: "project",
        data: {
          id: "P-2026-0001",
          type: "project",
          meta: { name: "Demo Project" },
          project: { id: "P-2026-0001", name: "Demo Project", timezone: "Europe/Berlin" },
          transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
        }
      };
    }
    if (type === "hall.procedural") {
      return {
        id: "hall-1",
        type,
        data: {
          id: "hall-1",
          type,
          meta: { name: "Halle" },
          params: { length: 40, width: 20, eaveHeight: 6, bay: 5 },
          view: { grid: { enabled: true }, snap: { enabled: false } },
          transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
        }
      };
    }
    if (type === "asset.glb") {
      return {
        id: "asset-1",
        type,
        data: {
          id: "asset-1",
          type,
          meta: { name: "GLB Asset" },
          source: { uri: "assets/models/demo.glb", slotId: "SLOT-001" },
          render: { castShadow: true, receiveShadow: true },
          transform: { position: { x: 100, y: 0, z: 50 }, rotation: { x: 0, y: 90, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
        }
      };
    }
    if (type === "conveyor.segment") {
      return {
        id: "conv-1",
        type,
        data: {
          id: "conv-1",
          type,
          meta: { name: "Rollenbahn Segment" },
          params: { speed: 0.8, direction: "forward" },
          sensors: { a: { offset: { x: 10, y: 0, z: 0 } }, b: { offset: { x: 200, y: 0, z: 0 } } },
          transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
        }
      };
    }
    return {
      id: "obj-1",
      type,
      data: {
        id: "obj-1",
        type,
        meta: { name: "Unknown" },
        transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
      }
    };
  }

/* ==========================================================================
 * Properties – Schema-driven Controls (NEU)
 * ==========================================================================
 * Ziel (Step 2):
 * - properties.schemas.json ist die Quelle der Wahrheit.
 * - Der Properties-Tab rendert die passenden Gruppen/Felder nach Type.
 * - Für Scene-Objekte werden Änderungen in app.settings.workspace.scene.objects persistiert.
 *
 * Hinweis:
 * - Selection-Objekte (project/projectAsset/selection.point) bleiben read-only,
 *   weil sie (noch) keine persistente Edit-API besitzen.
 */

_isSceneSelection(sel) {
  if (!sel?.id) return false;
  return !!this._findSceneObjectById(sel.id);
}

_getSceneTarget(sel) {
  const o = this._findSceneObjectById(sel?.id);
  return o || null;
}

_getPropValue({ sel, sceneObj, path }) {
  // Scene-Objekt: wir unterstützen "virtuelle" Pfade (transform/meta) + echte Nested-Props.
  if (sceneObj) {
    return this._getSceneValueByPath(sceneObj, path);
  }
  // Fallback: Selection-Daten (read-only)
  return this._getByPath(sel?.data, path);
}

_setPropValue({ sel, sceneObj, path, value, reason = "props" }) {
  if (!sceneObj) return false; // aktuell nur Scene editierbar
  return this._setSceneValueByPath(sceneObj, path, value, reason);
}

_getSceneValueByPath(obj, path) {
  const p = String(path || "");
  if (!p || p === "$") return obj;

  // Meta / Identity
  if (p === "meta.name") return obj.name;
  if (p === "id") return obj.id;
  if (p === "type") return obj.type;

  // Transform Adapter (2D → pseudo-3D)
  if (p === "transform.position") return { x: obj.x || 0, y: obj.y || 0, z: 0 };
  if (p === "transform.position.x") return obj.x || 0;
  if (p === "transform.position.y") return obj.y || 0;
  if (p === "transform.position.z") return 0;

  // rotDeg ist unsere persistierte 2D-Rotation; wir hängen sie an rotation.z
  if (p === "transform.rotation.z") return Number.isFinite(Number(obj.rotDeg)) ? Number(obj.rotDeg) : 0;
  if (p === "transform.rotation.x") return 0;
  if (p === "transform.rotation.y") return 0;
  if (p === "transform.rotation") return { x: 0, y: 0, z: Number.isFinite(Number(obj.rotDeg)) ? Number(obj.rotDeg) : 0 };

  if (p.startsWith("transform.scale")) {
    // v1: Scene-Objekte haben keine Skalierung; default=1
    if (p === "transform.scale") return { x: 1, y: 1, z: 1 };
    return 1;
  }

  // Default: echte Properties am Objekt (params.*, sensors.*, etc.)
  return this._getByPath(obj, p);
}

_setSceneValueByPath(obj, path, value, reason = "props") {
  const p = String(path || "");
  if (!p || p === "$") return false;

  // Identity/meta
  if (p === "meta.name") {
    obj.name = String(value || "");
    // auch Selection-View updaten (damit UI sofort stimmt)
    try {
      if (this.state.selection?.data?.meta) this.state.selection.data.meta.name = obj.name;
    } catch {}
    this._persistSceneToStore(`props:name:${reason}`);
    return true;
  }

  // Transform Adapter
  if (p === "transform.position.x") {
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    obj.x = v;
    this._persistSceneToStore(`props:posx:${reason}`);
    return true;
  }
  if (p === "transform.position.y") {
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    obj.y = v;
    this._persistSceneToStore(`props:posy:${reason}`);
    return true;
  }
  if (p === "transform.rotation.z") {
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    obj.rotDeg = ((v % 360) + 360) % 360;
    try {
      if (this.state.selection?.data?.transform2d) this.state.selection.data.transform2d.rotDeg = obj.rotDeg;
    } catch {}
    this._persistSceneToStore(`props:rotz:${reason}`);
    return true;
  }

  // Default: Nested property write (params.*, sensors.*, etc.)
  this._setByPath(obj, p, value);
  this._persistSceneToStore(`props:${p}:${reason}`);
  return true;
}

_renderPropFieldControl({ sel, sceneObj, field }) {
  const f = field || {};
  const type = String(f.type || "text");
  const path = String(f.path || "");

  const isScene = !!sceneObj;
  const isEditable = isScene && type !== "readonly" && type !== "json";

  const mkInputBase = () => {
    const el = document.createElement("input");
    el.style.height = "28px";
    el.style.borderRadius = "8px";
    el.style.padding = "0 8px";
    el.style.border = "1px solid rgba(255,255,255,.12)";
    el.style.background = "rgba(0,0,0,.25)";
    el.style.color = "inherit";
    el.style.minWidth = "120px";
    return el;
  };

  const cur = this._getPropValue({ sel, sceneObj, path });

  // READONLY
  if (!isEditable && type !== "toggle" && type !== "select") {
    const d = document.createElement("div");
    d.style.opacity = ".9";
    d.style.textAlign = "right";
    d.style.whiteSpace = "nowrap";
    if (type === "json") {
      try {
        d.textContent = JSON.stringify(cur ?? null);
      } catch {
        d.textContent = String(cur ?? "");
      }
    } else {
      d.textContent = cur === undefined ? "-" : String(cur);
    }
    return d;
  }

  // TOGGLE
  if (type === "toggle") {
    const btn = this._btn(Boolean(cur) ? "On" : "Off", () => {
      const next = !Boolean(this._getPropValue({ sel, sceneObj, path }));
      this._setPropValue({ sel, sceneObj, path, value: next, reason: "toggle" });
      this._requestProjectSaveDebounced("props:toggle");
      this._renderRightPanel();
    });
    btn.style.minWidth = "72px";
    btn.style.background = Boolean(cur) ? "rgba(0,255,128,.10)" : "rgba(0,0,0,.20)";
    btn.style.borderColor = Boolean(cur) ? "rgba(0,255,128,.25)" : "rgba(255,255,255,.10)";
    return btn;
  }

  // SELECT
  if (type === "select") {
    const selEl = document.createElement("select");
    selEl.style.height = "28px";
    selEl.style.borderRadius = "8px";
    selEl.style.padding = "0 8px";
    selEl.style.border = "1px solid rgba(255,255,255,.12)";
    selEl.style.background = "rgba(0,0,0,.25)";
    selEl.style.color = "inherit";
    selEl.style.minWidth = "140px";

    const opts = Array.isArray(f.options) ? f.options : [];
    for (const o of opts) {
      const opt = document.createElement("option");
      opt.value = String(o);
      opt.textContent = String(o);
      if (String(cur) === String(o)) opt.selected = true;
      selEl.appendChild(opt);
    }
    selEl.addEventListener("change", () => {
      this._setPropValue({ sel, sceneObj, path, value: String(selEl.value), reason: "select" });
      this._requestProjectSaveDebounced("props:select");
    });
    return selEl;
  }

  // VEC3 (Scene: position/rotation/scale)
  if (type === "vec3") {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "6px";
    wrap.style.justifyContent = "flex-end";

    const mk = (axis) => {
      const el = mkInputBase();
      el.type = "number";
      el.inputMode = "decimal";
      el.style.minWidth = "78px";
      el.placeholder = axis.toUpperCase();
      return el;
    };

    const vx = this._getPropValue({ sel, sceneObj, path: path + ".x" });
    const vy = this._getPropValue({ sel, sceneObj, path: path + ".y" });
    const vz = this._getPropValue({ sel, sceneObj, path: path + ".z" });

    const xIn = mk("x");
    const yIn = mk("y");
    const zIn = mk("z");

    xIn.value = String(Number.isFinite(Number(vx)) ? Number(vx) : 0);
    yIn.value = String(Number.isFinite(Number(vy)) ? Number(vy) : 0);
    zIn.value = String(Number.isFinite(Number(vz)) ? Number(vz) : 0);

    const apply = () => {
      this._setPropValue({ sel, sceneObj, path: path + ".x", value: xIn.value, reason: "vec3" });
      this._setPropValue({ sel, sceneObj, path: path + ".y", value: yIn.value, reason: "vec3" });
      this._setPropValue({ sel, sceneObj, path: path + ".z", value: zIn.value, reason: "vec3" });
      this._requestProjectSaveDebounced("props:vec3");
    };

    xIn.addEventListener("change", apply);
    yIn.addEventListener("change", apply);
    zIn.addEventListener("change", apply);

    wrap.appendChild(xIn);
    wrap.appendChild(yIn);
    wrap.appendChild(zIn);
    return wrap;
  }

  // NUMBER / TEXT (default)
  const inEl = mkInputBase();
  inEl.type = type === "number" ? "number" : "text";
  inEl.inputMode = type === "number" ? "decimal" : "text";
  if (type === "number") {
    if (Number.isFinite(Number(f.min))) inEl.min = String(f.min);
    if (Number.isFinite(Number(f.max))) inEl.max = String(f.max);
    if (Number.isFinite(Number(f.step))) inEl.step = String(f.step);
  }

  inEl.value = cur === undefined || cur === null ? "" : String(cur);

  inEl.addEventListener("change", () => {
    const v = type === "number" ? Number(inEl.value) : String(inEl.value);
    this._setPropValue({ sel, sceneObj, path, value: v, reason: "input" });
    this._requestProjectSaveDebounced("props:input");
  });

  return inEl;
}

/* ==========================================================================
 * Params Tab (NEU) – ParamPack v1 in Workarea sichtbar machen
 * ==========================================================================
 * Ziel (Step 3):
 * - ParamPack laden (fetch, cached in param-engine.js)
 * - Parameter am selektierten Scene-Objekt speichern (obj.params + obj.paramPackUrl)
 * - Kennzahlen/BOM (computeMetrics) anzeigen
 *
 * WICHTIG:
 * - v1 ist READ/WRITE auf Param-Werte, aber ohne 3D-Apply (Workarea ist 2D).
 * - 3D-Apply bleibt in Hall3D / AssetLab3D (später: Workarea-3D).
 */

async _loadParamEngine() {
  // Lazy dynamic import, damit Workarea nicht hart an Hall3D gekoppelt ist.
  if (this._paramEngine) return this._paramEngine;
  try {
    const mod = await import("../../modules/hall3d/core/param-engine.js");
    this._paramEngine = mod;
    return mod;
  } catch (e) {
    console.error("[workarea] ParamEngine import failed", e);
    return null;
  }
}

_renderParamsPanel() {
  const box = document.createElement("div");
  box.style.padding = "10px";
  box.style.display = "flex";
  box.style.flexDirection = "column";
  box.style.gap = "10px";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.textContent = "Params (ParamPack v1)";
  box.appendChild(title);

  const sel = this.state.selection || this._makeDummySelection("project");
  const sceneObj = this._getSceneTarget(sel);

  const hint = document.createElement("div");
  hint.style.fontSize = "12px";
  hint.style.opacity = ".75";
  hint.textContent =
    "Hier siehst du ParamPack v1 direkt in der Workarea (2D). Parameter werden am Scene-Objekt gespeichert und sind damit projektgebunden und reload-sicher.";
  box.appendChild(hint);

  if (!sceneObj) {
    const warn = document.createElement("div");
    warn.style.opacity = ".85";
    warn.textContent = "⚠️ Bitte ein Scene-Objekt im Viewport selektieren (z.B. eine platzierte Instanz).";
    box.appendChild(warn);
    return box;
  }

  // Pack-Auswahl (v1: nur 1 Beispiel-Pack – später dynamisch aus Registry)
  const packRow = document.createElement("div");
  packRow.style.display = "flex";
  packRow.style.gap = "8px";
  packRow.style.alignItems = "center";
  packRow.style.flexWrap = "wrap";

  const packLbl = document.createElement("div");
  packLbl.style.fontSize = "12px";
  packLbl.style.opacity = ".75";
  packLbl.textContent = "ParamPack";
  packRow.appendChild(packLbl);

  const packSel = document.createElement("select");
  packSel.style.height = "28px";
  packSel.style.borderRadius = "8px";
  packSel.style.padding = "0 8px";
  packSel.style.border = "1px solid rgba(255,255,255,.12)";
  packSel.style.background = "rgba(0,0,0,.25)";
  packSel.style.color = "inherit";
  packSel.style.minWidth = "240px";

  const packOptions = [
    {
      id: "skid_production_v1",
      label: "skid_production_v1 (Demo)",
      url: "modules/hall3d/data/param-packs/skid_production_v1.parampack.json"
    }
  ];

  const curUrl = String(sceneObj.paramPackUrl || packOptions[0].url);
  for (const p of packOptions) {
    const o = document.createElement("option");
    o.value = p.url;
    o.textContent = p.label;
    if (String(p.url) === curUrl) o.selected = true;
    packSel.appendChild(o);
  }

  packSel.addEventListener("change", () => {
    sceneObj.paramPackUrl = String(packSel.value || "");
    this._persistSceneToStore("params:pack");
    this._requestProjectSaveDebounced("params:pack");
    this._renderRightPanel();
  });

  packRow.appendChild(packSel);
  box.appendChild(packRow);

  const params = (sceneObj.params && typeof sceneObj.params === "object") ? sceneObj.params : (sceneObj.params = {});
  const status = document.createElement("div");
  status.style.fontSize = "12px";
  status.style.opacity = ".75";
  status.textContent = `Objekt: ${sceneObj.type} • ${sceneObj.id}`;
  box.appendChild(status);

  // Async Pack laden + UI rendern (ohne async/await im Render-Flow zu blocken)
  const mount = document.createElement("div");
  mount.textContent = "Lade ParamPack …";
  mount.style.opacity = ".8";
  box.appendChild(mount);

  (async () => {
    const engine = await this._loadParamEngine();
    if (!engine) {
      mount.textContent = "⚠️ ParamEngine konnte nicht geladen werden.";
      return;
    }

    try {
      const pack = await engine.loadParamPack(curUrl);
      if (!pack) {
        mount.textContent = "⚠️ ParamPack leer/ungültig.";
        return;
      }

      // Merge defaults + overrides (sceneObj.params sind die Overrides)
      const merged = engine.mergeParams(pack.defaults, params);

      mount.innerHTML = "";

      // UI Groups
      const groups = Array.isArray(pack?.ui?.groups) ? pack.ui.groups : [];
      for (const g of groups) {
        const gEl = document.createElement("div");
        gEl.style.border = "1px solid rgba(255,255,255,.08)";
        gEl.style.borderRadius = "10px";
        gEl.style.padding = "8px";

        const gt = document.createElement("div");
        gt.style.fontWeight = "700";
        gt.style.marginBottom = "6px";
        gt.textContent = g.label || g.id || "Group";
        gEl.appendChild(gt);

        const fields = Array.isArray(g.fields) ? g.fields : [];
        for (const f of fields) {
          const row = document.createElement("div");
          row.style.display = "grid";
          row.style.gridTemplateColumns = "1fr 1.2fr";
          row.style.gap = "10px";
          row.style.alignItems = "center";
          row.style.fontSize = "12px";
          row.style.padding = "6px 0";
          row.style.borderTop = "1px dashed rgba(255,255,255,.06)";

          const lab = document.createElement("div");
          lab.style.opacity = ".75";
          lab.textContent = f.label || f.id || "";
          row.appendChild(lab);

          const ctrlHost = document.createElement("div");
          ctrlHost.style.display = "flex";
          ctrlHost.style.justifyContent = "flex-end";

          const id = String(f.id || "");
          const fType = String(f.type || "number");
          const cur = merged[id];

          const mk = () => {
            const el = document.createElement("input");
            el.style.height = "28px";
            el.style.borderRadius = "8px";
            el.style.padding = "0 8px";
            el.style.border = "1px solid rgba(255,255,255,.12)";
            el.style.background = "rgba(0,0,0,.25)";
            el.style.color = "inherit";
            el.style.minWidth = "160px";
            return el;
          };

          let ctrl = null;

          if (fType === "range") {
            const wrap = document.createElement("div");
            wrap.style.display = "flex";
            wrap.style.gap = "8px";
            wrap.style.alignItems = "center";

            const range = mk();
            range.type = "range";
            range.style.minWidth = "140px";
            range.min = String(Number.isFinite(Number(f.min)) ? f.min : 0);
            range.max = String(Number.isFinite(Number(f.max)) ? f.max : 100);
            range.step = String(Number.isFinite(Number(f.step)) ? f.step : 1);
            range.value = String(Number.isFinite(Number(cur)) ? cur : 0);

            const num = mk();
            num.type = "number";
            num.inputMode = "decimal";
            num.style.minWidth = "90px";
            num.min = range.min;
            num.max = range.max;
            num.step = range.step;
            num.value = range.value;

            const apply = (v) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return;
              sceneObj.params[id] = n;
              this._persistSceneToStore("params:change");
              this._requestProjectSaveDebounced("params:change");
              this._renderRightPanel();
            };

            range.addEventListener("input", () => {
              num.value = range.value;
            });
            range.addEventListener("change", () => apply(range.value));
            num.addEventListener("change", () => {
              range.value = num.value;
              apply(num.value);
            });

            wrap.appendChild(range);
            wrap.appendChild(num);
            ctrl = wrap;
          } else {
            const inp = mk();
            inp.type = "number";
            inp.inputMode = "decimal";
            if (Number.isFinite(Number(f.min))) inp.min = String(f.min);
            if (Number.isFinite(Number(f.max))) inp.max = String(f.max);
            if (Number.isFinite(Number(f.step))) inp.step = String(f.step);
            inp.value = String(Number.isFinite(Number(cur)) ? cur : 0);

            inp.addEventListener("change", () => {
              const n = Number(inp.value);
              if (!Number.isFinite(n)) return;
              sceneObj.params[id] = n;
              this._persistSceneToStore("params:change");
              this._requestProjectSaveDebounced("params:change");
              this._renderRightPanel();
            });

            ctrl = inp;
          }

          if (ctrl) ctrlHost.appendChild(ctrl);
          row.appendChild(ctrlHost);
          gEl.appendChild(row);
        }

        mount.appendChild(gEl);
      }

      // Metrics
      const metrics = engine.computeMetrics(pack, engine.mergeParams(pack.defaults, sceneObj.params || {}));

      const mBox = document.createElement("div");
      mBox.style.border = "1px solid rgba(255,255,255,.08)";
      mBox.style.borderRadius = "10px";
      mBox.style.padding = "8px";
      mBox.style.marginTop = "8px";

      const mt = document.createElement("div");
      mt.style.fontWeight = "700";
      mt.style.marginBottom = "6px";
      mt.textContent = "Kennzahlen (computeMetrics)";
      mBox.appendChild(mt);

      const rows = Array.isArray(metrics?.bom) ? metrics.bom : [];
      if (!rows.length) {
        const none = document.createElement("div");
        none.style.opacity = ".75";
        none.style.fontSize = "12px";
        none.textContent = "Keine BOM Items im ParamPack.";
        mBox.appendChild(none);
      } else {
        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "1fr 70px 70px 70px";
        grid.style.gap = "6px";
        grid.style.alignItems = "center";

        const hdr = (t) => {
          const d = document.createElement("div");
          d.style.fontSize = "12px";
          d.style.opacity = ".75";
          d.style.fontWeight = "700";
          d.textContent = t;
          return d;
        };

        grid.appendChild(hdr("Item"));
        grid.appendChild(hdr("Qty"));
        grid.appendChild(hdr("Unit"));
        grid.appendChild(hdr("Cost"));

        for (const r of rows) {
          const a = document.createElement("div");
          a.textContent = String(r.label || r.id);
          const b = document.createElement("div");
          b.style.textAlign = "right";
          b.textContent = Number.isFinite(Number(r.qty)) ? Number(r.qty).toFixed(2) : String(r.qty || 0);
          const c = document.createElement("div");
          c.style.textAlign = "right";
          c.textContent = String(r.unit || "");
          const d = document.createElement("div");
          d.style.textAlign = "right";
          d.textContent = Number.isFinite(Number(r.cost)) ? Number(r.cost).toFixed(2) : String(r.cost || 0);

          grid.appendChild(a);
          grid.appendChild(b);
          grid.appendChild(c);
          grid.appendChild(d);
        }

        mBox.appendChild(grid);

        const tot = document.createElement("div");
        tot.style.marginTop = "6px";
        tot.style.fontWeight = "700";
        tot.textContent = `Total Cost: ${Number(metrics?.totals?.cost || 0).toFixed(2)}`;
        mBox.appendChild(tot);
      }

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.style.flexWrap = "wrap";
      actions.style.marginTop = "8px";

      actions.appendChild(
        this._btn("Copy Metrics JSON", async () => {
          try {
            await this._copyToClipboard(JSON.stringify(metrics, null, 2));
            this._setStatus("✅ Metrics JSON in Clipboard");
          } catch {
            this._setStatus("⚠️ Copy fehlgeschlagen");
          }
        })
      );

      mBox.appendChild(actions);
      mount.appendChild(mBox);

    } catch (e) {
      console.error("[workarea] params render failed", e);
      mount.textContent = "⚠️ Fehler beim Laden/Rendere von ParamPack.";
    }
  })();

  return box;
}

  /* ==========================================================================
   * Tiny UI helpers
   * ========================================================================= */

  _makeTabsBar() {
    const bar = document.createElement("div");
    bar.style.flex = "0 0 auto";
    bar.style.display = "flex";
    bar.style.gap = "6px";
    bar.style.padding = "8px 10px";
    bar.style.borderBottom = "1px solid rgba(255,255,255,.06)";
    bar.style.overflowX = "auto";
    bar.style.minHeight = "44px";
    return bar;
  }

  _makePanelHost() {
    const host = document.createElement("div");
    host.style.flex = "1 1 auto";
    host.style.minHeight = "0";
    host.style.overflow = "auto";
    return host;
  }

  _renderTabsBar(barEl, tabs, activeId, onSelect) {
    if (!barEl) return;
    barEl.innerHTML = "";

    for (const t of tabs) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t.title || t.id;
      b.style.height = "28px";
      b.style.borderRadius = "10px";
      b.style.padding = "0 10px";
      b.style.border = "1px solid rgba(255,255,255,.12)";
      b.style.background = t.id === activeId ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.20)";
      b.style.color = "inherit";
      b.style.cursor = "pointer";
      b.style.whiteSpace = "nowrap";

      b.addEventListener("click", () => onSelect(String(t.id)));
      barEl.appendChild(b);
    }
  }

  _btn(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.height = "28px";
    b.style.borderRadius = "10px";
    b.style.padding = "0 10px";
    b.style.border = "1px solid rgba(255,255,255,.12)";
    b.style.background = "rgba(0,0,0,.20)";
    b.style.color = "inherit";
    b.style.cursor = "pointer";
    b.addEventListener("click", () => {
      try {
        onClick?.();
      } catch (e) {
        console.error("[workarea] button handler failed:", e);
      }
    });
    return b;
  }

  _pill(text, bg) {
    const p = document.createElement("div");
    p.textContent = text;
    p.style.height = "28px";
    p.style.display = "inline-flex";
    p.style.alignItems = "center";
    p.style.padding = "0 10px";
    p.style.borderRadius = "10px";
    p.style.border = "1px solid rgba(255,255,255,.10)";
    p.style.background = bg || "rgba(255,255,255,.06)";
    p.style.fontSize = "12px";
    p.style.opacity = ".9";
    return p;
  }

  _spacer() {
    const s = document.createElement("div");
    s.style.flex = "1 1 auto";
    return s;
  }
}
