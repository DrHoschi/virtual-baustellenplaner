/**
 * ui/panels/WorkareaPanel.js
 * Version: v1.3.0-workarea-viewport-step3 + pan+zoom+worldgrid+snap (2026-02-17)
 *
 * Ziel:
 * - Cybermotion-Style Arbeitsbereich als datengetriebene Shell
 * - Viewport Step 1: Canvas + ResizeObserver + RenderLoop (noch ohne Scene)
 * - NEU: Docks/Bars einklappbar (iPad friendly)
 *
 * Einstieg:
 * - tools:workarea (linkes Menü)
 *
 * Event-Hooks (minimal, cb/req Bus Contract):
 * - cb:workarea:layout:ready
 * - cb:workarea:mode:changed
 * - req:workarea:mode:set
 * - cb:scene:selection:changed (Dummy)
 *
 * WICHTIG:
 * - Debug/Checker bleiben drin.
 * - Absichtlich kein PanelBase (Workarea ist eine eigene Shell).
 */

export class WorkareaPanel {
  constructor({ bus, store, rootEl, panelId, moduleKey, version } = {}) {
    this.bus = bus;
    this.store = store;
    this.rootEl = rootEl;
    this.panelId = panelId || moduleKey || "tools:workarea";
    this.version = version || "n/a";

    this._mounted = false;

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

    // --- Viewport Step 1 (Canvas + Resize + RenderLoop) ---
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
      _fpsN: 0
    };

    // -----------------------------------------------------------------------
    // Viewport Pointer State (Step 2)
    // -----------------------------------------------------------------------
    // Wir speichern die letzten Pointer-Koordinaten (Screen-Space) für HUD/Debug.
    this._vp.pointer = {
      inside: false,
      down: false,
      x: 0,
      y: 0,
      lastDownX: 0,
      lastDownY: 0,
      pointerId: null,

      // Multi-touch support (Tablet): track active pointers for pinch-zoom.
      // Map<pointerId, {x,y}>
      active: new Map(),
      pinch: {
        active: false,
        idA: null,
        idB: null,
        startDist: 0,
        startZoom: 1,
        midX: 0,
        midY: 0
      }
    };

    // -----------------------------------------------------------------------
    // View Transform (Step 3)
    // -----------------------------------------------------------------------
    // World <-> Screen Transform: screen = world * zoom + offset
    // (world units sind für Step 3 erstmal "Pixel-Units", später echte Einheiten/Skalierung)
    this._view = {
      zoom: 1.0,
      minZoom: 0.25,
      maxZoom: 6.0,
      offsetX: 0, // in Screen-Pixeln
      offsetY: 0,
      // Panning state
      panning: false,
      panStartX: 0,
      panStartY: 0,
      panStartOffX: 0,
      panStartOffY: 0
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

      selection: this._makeDummySelection("project")
    };

    // Bus subscriptions
    this._unsubs = [];

    // -----------------------------------------------------------------------
    // Workarea Settings Cache (live aus settings:workspace)
    // -----------------------------------------------------------------------
    // Quelle: WorkspaceSettingsPanel schreibt nach store key "app" → app.settings.workspace
    // Live-Update via Bus:
    //   cb:settings:workspace:changed { workspace }
    this._cfg = this._getWorkspaceCfgFromStore();

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

    // Header (ruhig, klein)
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
    sub.textContent = "Cybermotion Shell (Viewport Step 1: Canvas) – datengetrieben";
    sub.style.opacity = ".65";
    sub.style.fontSize = "12px";

    header.appendChild(h);
    header.appendChild(sub);
    this.rootEl.appendChild(header);

    // Haupt-Shell
    const shell = document.createElement("div");
    shell.style.display = "flex";
    shell.style.flex = "1 1 auto";
    shell.style.minHeight = "0";
    shell.style.overflow = "hidden";
    this.rootEl.appendChild(shell);

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

    // Topbar (innerhalb Center)
    const topbar = document.createElement("div");
    topbar.style.height = "44px";
    topbar.style.flex = "0 0 auto";
    topbar.style.display = "flex";
    topbar.style.alignItems = "center";
    topbar.style.gap = "10px";
    topbar.style.padding = "6px 10px";
    topbar.style.borderBottom = "1px solid rgba(255,255,255,.06)";
    center.appendChild(topbar);

    // Viewport Host
    const viewport = document.createElement("div");
    viewport.style.flex = "1 1 auto";
    viewport.style.minHeight = "0";
    viewport.style.display = "flex";
    viewport.style.position = "relative";
    viewport.style.background = "rgba(255,255,255,.02)";
    viewport.style.overflow = "hidden";
    center.appendChild(viewport);

    // BottomBar
    const bottom = document.createElement("div");
    bottom.style.height = "28px";
    bottom.style.flex = "0 0 auto";
    bottom.style.display = "flex";
    bottom.style.alignItems = "center";
    bottom.style.gap = "10px";
    bottom.style.padding = "0 10px";
    bottom.style.borderTop = "1px solid rgba(255,255,255,.06)";
    center.appendChild(bottom);

    // Console Drawer
    const consoleDrawer = document.createElement("div");
    consoleDrawer.style.flex = "0 0 auto";
    consoleDrawer.style.display = "none";
    consoleDrawer.style.borderTop = "1px solid rgba(255,255,255,.06)";
    consoleDrawer.style.background = "rgba(0,0,0,.25)";
    consoleDrawer.style.padding = "8px 10px";
    consoleDrawer.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    consoleDrawer.style.fontSize = "12px";
    consoleDrawer.textContent = "Console Drawer (Dummy) – später: Debug Log / Events";
    center.appendChild(consoleDrawer);

    // Left/Right Dock: Tabs + Panel Host
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

    // Viewport Step 1: Canvas mounten
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

    // UI rendern
    this._renderTopbar();
    this._renderLeftTabs();
    this._renderRightTabs();
    this._renderLeftPanel();
    this._renderRightPanel();
    this._renderBottomBar();

    // ---------------------------------------------------------------------
    // Settings → Workarea live anwenden (INIT)
    // ---------------------------------------------------------------------
    // Vor _applyDockVisibility(), damit Dock-Defaults greifen.
    this._applyWorkspaceSettingsFromStore("init");

    // Sichtbarkeit anwenden
    this._applyDockVisibility();

    // Bus wiring
    this._wireBus();

    // Events
    this.bus?.emit?.("cb:workarea:layout:ready", {
      panelId: this.panelId,
      layoutId: this.layout?.id || null,
      toolsId: this.tools?.id || null,
      propsId: this.props?.id || null
    });

    this._publishModeChanged("init");
    this._publishSelectionChanged("init");

    this._setStatus("🟢 Workarea Shell bereit (Viewport Step 3)");
  }

  unmount() {
    this._unmountViewportCanvas();

    this._mounted = false;
    try {
      for (const u of this._unsubs) {
        try { u?.(); } catch {}
      }
    } catch {}
    this._unsubs = [];
    if (this.rootEl) this.rootEl.innerHTML = "";
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

    const modes = Array.isArray(this.tools?.modes) ? this.tools.modes : [
      { id: "select", title: "Select" },
      { id: "pan", title: "Pan" },
      { id: "place", title: "Place" },
      { id: "edit", title: "Edit" },
      { id: "measure", title: "Measure" },
      { id: "sim", title: "Sim" }
    ];

    // Safety: falls tools.registry.json (noch) keinen Pan/Measure/Sim liefert, injizieren wir die Basics.
    const _need = (id, title) => !modes.some((m) => String(m?.id) === id) && modes.push({ id, title });
    _need("pan", "Pan");
    _need("measure", "Measure");
    _need("sim", "Sim");

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

    // Zoom UI (Tablet-friendly)
    const zoomWrap = document.createElement("div");
    zoomWrap.style.display = "flex";
    zoomWrap.style.alignItems = "center";
    zoomWrap.style.gap = "6px";

    const zoomLabel = document.createElement("span");
    zoomLabel.textContent = "Zoom:";
    zoomLabel.style.opacity = "0.85";
    zoomLabel.style.fontSize = "12px";

    const btnMinus = this._pill("−", () => {
      const z0 = Number(this._view?.zoom ?? 1) || 1;
      const z1 = z0 / 1.15;
      this._setZoomAt((this._vp?.w || 1) / 2, (this._vp?.h || 1) / 2, z1, "ui-minus");
    }, "Zoom out");
    btnMinus.style.minWidth = "34px";
    btnMinus.style.textAlign = "center";

    const btnPlus = this._pill("+", () => {
      const z0 = Number(this._view?.zoom ?? 1) || 1;
      const z1 = z0 * 1.15;
      this._setZoomAt((this._vp?.w || 1) / 2, (this._vp?.h || 1) / 2, z1, "ui-plus");
    }, "Zoom in");
    btnPlus.style.minWidth = "34px";
    btnPlus.style.textAlign = "center";

    const rng = document.createElement("input");
    rng.type = "range";
    rng.min = String(Number(this._view?.minZoom ?? 0.25) || 0.25);
    rng.max = String(Number(this._view?.maxZoom ?? 6.0) || 6.0);
    rng.step = "0.01";
    rng.value = String(Number(this._view?.zoom ?? 1) || 1);
    rng.style.width = "140px";

    const zoomVal = document.createElement("span");
    zoomVal.textContent = (Number(this._view?.zoom ?? 1) || 1).toFixed(2);
    zoomVal.style.fontSize = "12px";
    zoomVal.style.minWidth = "44px";
    zoomVal.style.textAlign = "right";
    zoomVal.style.opacity = "0.85";

    rng.addEventListener("input", () => {
      const z1 = Number(rng.value || 1) || 1;
      // Zoom around viewport center (einfach & robust für Touch)
      this._setZoomAt((this._vp?.w || 1) / 2, (this._vp?.h || 1) / 2, z1, "ui-slider");
    });

    this._els.zoomRange = rng;
    this._els.zoomValue = zoomVal;

    zoomWrap.appendChild(zoomLabel);
    zoomWrap.appendChild(btnMinus);
    zoomWrap.appendChild(rng);
    zoomWrap.appendChild(btnPlus);
    zoomWrap.appendChild(zoomVal);

    topbar.appendChild(zoomWrap);

    topbar.appendChild(this._pill("Grid: (später)", "rgba(255,255,255,.06)"));
    topbar.appendChild(this._pill("Snap: (später)", "rgba(255,255,255,.06)"));

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
      this._renderLeftPanel();
    });
  }

  _renderRightTabs() {
    const tabs = this._layoutTabs("rightDock") || [
      { id: "tab.properties", title: "Properties" },
      { id: "tab.outliner", title: "Outliner" }
    ];
    this._renderTabsBar(this._els.rightTabsBar, tabs, this.state.rightTabId, (tabId) => {
      this.state.rightTabId = tabId;
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
      box.appendChild(this._btn("Dummy Auswahl: Förderer", () => {
        this.state.selection = this._makeDummySelection("conveyor.segment");
        this._publishSelectionChanged("library");
        this._renderRightPanel();
      }));
    } else if (tabId === "tab.scene") {
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Scene (Dummy)</div>` +
        `<div style="opacity:.75;font-size:12px;">Später: Layer / Sichtbarkeit / Lock / Outliner</div>`;
    } else if (tabId === "tab.assets") {
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Assets (Dummy)</div>` +
        `<div style="opacity:.75;font-size:12px;">Später: Project Assets / Slots / Importstände</div>`;
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
      host.appendChild(this._renderPropertiesDummy());
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

  _renderPropertiesDummy() {
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
    hint.textContent = "Dummy-Renderer: zeigt Gruppen/Felder aus properties.schemas.json (noch ohne echte Bindings).";
    box.appendChild(hint);

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
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.gap = "10px";
        row.style.fontSize = "12px";
        row.style.padding = "3px 0";
        row.style.borderTop = "1px dashed rgba(255,255,255,.06)";

        const l = document.createElement("div");
        l.style.opacity = ".75";
        l.textContent = f.label || f.id || "";

        const v = document.createElement("div");
        v.style.opacity = ".9";
        v.style.textAlign = "right";

        const val = this._getByPath(sel.data, f.path);
        v.textContent = (val === undefined) ? "-" : String(val);

        row.appendChild(l);
        row.appendChild(v);
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
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.leftDockCollapsed ? "LeftDock eingeklappt" : "LeftDock sichtbar");
  }

  _toggleRightDock() {
    this.state.rightDockCollapsed = !this.state.rightDockCollapsed;
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.rightDockCollapsed ? "RightDock eingeklappt" : "RightDock sichtbar");
  }

  _toggleBottom() {
    this.state.bottomCollapsed = !this.state.bottomCollapsed;
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.bottomCollapsed ? "BottomBar eingeklappt" : "BottomBar sichtbar");
  }

  _toggleFullscreen() {
    this.state.fullscreen = !this.state.fullscreen;
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
    const off3 = this.bus.on("cb:settings:workspace:changed", (msg = {}) => {
      const workspace = msg?.workspace;
      if (!workspace) return;
      this._applyWorkspaceSettings(workspace, "bus");
    });

    this._unsubs.push(off1, off2, off3);
  }


  /* ==========================================================================
   * Workspace Settings → Workarea (live)
   * ========================================================================= */

  _getWorkspaceCfgFromStore() {
    // Defensive: wenn store/app noch nicht init ist → Defaults.
    const app = this.store?.get?.("app") || {};
    const ws = app?.settings?.workspace || {};

    const gridEnabled = ws?.grid?.enabled ?? true;
    const gridSize = Number(ws?.grid?.size ?? 50) || 50;
    const snapEnabled = ws?.grid?.snap ?? true;

    const bgColor = String(ws?.background?.color || "#f2f2f2");

    const quality = String(ws?.viewport?.quality || "medium");
    const dprCap = Number(ws?.viewport?.dprCap ?? 2) || 2;

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
      docks: { leftCollapsed, rightCollapsed, bottomCollapsed }
    };
  }

  _applyWorkspaceSettingsFromStore(reason = "store") {
    const app = this.store?.get?.("app") || {};
    const ws = app?.settings?.workspace;

    // Falls noch nichts gespeichert ist → Defaults anwenden
    if (!ws) {
      this._cfg = this._getWorkspaceCfgFromStore();
      this._applyCfgToUI(reason);
      return;
    }
    this._applyWorkspaceSettings(ws, reason);
  }

  _applyWorkspaceSettings(workspace, reason = "apply") {
    void workspace;
    // Cache neu aus dem Store ziehen (single source of truth)
    this._cfg = this._getWorkspaceCfgFromStore();
    this._applyCfgToUI(reason);
  }

  _applyCfgToUI(reason = "cfg") {
    void reason;

    // Dock Defaults (nur wenn nicht Fullscreen – Fullscreen ist eine temporäre UI-Option)
    if (!this.state.fullscreen) {
      this.state.leftDockCollapsed = !!this._cfg?.docks?.leftCollapsed;
      this.state.rightDockCollapsed = !!this._cfg?.docks?.rightCollapsed;
      this.state.bottomCollapsed = !!this._cfg?.docks?.bottomCollapsed;
    }

    // Sichtbarkeit neu anwenden (falls schon gemountet)
    if (this._mounted) this._applyDockVisibility();

    // Resize + Render (DPR Cap kann sich geändert haben)
    this._resizeViewportCanvas();
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
   * Viewport Step 1
   * ========================================================================= */

  /* ==========================================================================
   * Viewport Pointer (Step 2)
   * ========================================================================= */

  _getCanvasLocalXY(ev) {
    // Liefert Pointer-Koordinaten relativ zum Canvas (CSS Pixel, nicht DPR-Scaled).
    const c = this._vp?.canvas;
    if (!c) return { x: 0, y: 0 };

    const r = c.getBoundingClientRect();
    const x = (ev.clientX ?? 0) - r.left;
    const y = (ev.clientY ?? 0) - r.top;
    return { x, y };
  _onViewportPointerDown(ev) {
    const c = this._vp?.canvas;
    if (!c) return;

    try { ev.preventDefault(); } catch {}
    try { c.setPointerCapture?.(ev.pointerId); } catch {}

    const { x, y } = this._getCanvasLocalXY(ev);

    // Track active pointers (Tablet)
    const pid = ev.pointerId ?? null;
    if (pid != null && this._vp?.pointer?.active) {
      this._vp.pointer.active.set(pid, { x, y });
    }

    this._vp.pointer.down = true;
    this._vp.pointer.pointerId = pid;
    this._vp.pointer.lastDownX = x;
    this._vp.pointer.lastDownY = y;
    this._vp.pointer.x = x;
    this._vp.pointer.y = y;

    // If two pointers are down → start pinch gesture
    if (this._vp.pointer.active && this._vp.pointer.active.size >= 2) {
      const ids = Array.from(this._vp.pointer.active.keys());
      const a = this._vp.pointer.active.get(ids[0]);
      const b = this._vp.pointer.active.get(ids[1]);
      if (a && b && this._view) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1e-6, Math.hypot(dx, dy));
        const midX = (a.x + b.x) * 0.5;
        const midY = (a.y + b.y) * 0.5;

        this._vp.pointer.pinch.active = true;
        this._vp.pointer.pinch.idA = ids[0];
        this._vp.pointer.pinch.idB = ids[1];
        this._vp.pointer.pinch.startDist = dist;
        this._vp.pointer.pinch.startZoom = Number(this._view.zoom ?? 1) || 1;
        this._vp.pointer.pinch.midX = midX;
        this._vp.pointer.pinch.midY = midY;

        // Pan darf dabei NICHT aktiv sein
        this._view.panning = false;
        return;
      }
    }

    // Step 3: Pan Mode (Tablet-friendly)
    const mode = String(this.state?.modeId || "select");
    if (mode === "pan") {
      this._view.panning = true;
      this._view.panStartX = x;
      this._view.panStartY = y;
      this._view.panStartOffX = this._view.offsetX;
      this._view.panStartOffY = this._view.offsetY;
      return;
    }

    // Selection-Payload (World + optional Snap)
    const w = this._screenToWorld(x, y);
    const s2 = this._snapWorld(w.x, w.y);

    this.bus?.emit?.("cb:scene:selection:changed", {
      kind: "viewportPoint",
      x,
      y,
      worldX: w.x,
      worldY: w.y,
      snappedX: s2.x,
      snappedY: s2.y,
      snapped: s2.snapped,
      source: "tools:workarea"
    });
  _onViewportPointerMove(ev) {
    if (!this._vp?.canvas) return;
    try { ev.preventDefault(); } catch {}

    const { x, y } = this._getCanvasLocalXY(ev);
    this._vp.pointer.x = x;
    this._vp.pointer.y = y;

    const pid = ev.pointerId ?? null;
    if (pid != null && this._vp?.pointer?.active) {
      this._vp.pointer.active.set(pid, { x, y });
    }

    // Pinch zoom (2-finger)
    if (this._vp?.pointer?.pinch?.active && this._vp.pointer.active?.size >= 2) {
      const pz = this._vp.pointer.pinch;
      const a = this._vp.pointer.active.get(pz.idA);
      const b = this._vp.pointer.active.get(pz.idB);

      if (a && b && this._view) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1e-6, Math.hypot(dx, dy));
        const scale = dist / Math.max(1e-6, Number(pz.startDist || 1));
        const z1 = (Number(pz.startZoom || 1) || 1) * scale;

        const midX = (a.x + b.x) * 0.5;
        const midY = (a.y + b.y) * 0.5;

        this._setZoomAt(midX, midY, z1, "pinch");
        return;
      }
    }

    // Pan (Step 3) – nur wenn Pan-Modus aktiv und nur 1 Pointer
    if (this._view?.panning && this._vp.pointer.down && (this._vp.pointer.active?.size || 0) <= 1) {
      const dx = x - this._view.panStartX;
      const dy = y - this._view.panStartY;
      this._view.offsetX = this._view.panStartOffX + dx;
      this._view.offsetY = this._view.panStartOffY + dy;

      this.bus?.emit?.("cb:viewport:view:changed", {
        zoom: Number(this._view.zoom ?? 1) || 1,
        offsetX: this._view.offsetX,
        offsetY: this._view.offsetY,
        source: "pan"
      });

      return;
    }
  _onViewportPointerUp(ev) {
    const c = this._vp?.canvas;
    if (!c) return;
    try { ev.preventDefault(); } catch {}

    const pid = ev.pointerId ?? null;

    try {
      if (pid != null) c.releasePointerCapture?.(pid);
    } catch {}

    // Remove active pointer
    if (pid != null && this._vp?.pointer?.active) {
      this._vp.pointer.active.delete(pid);
    }

    // End pinch if less than 2 pointers
    if (this._vp?.pointer?.pinch?.active && (this._vp.pointer.active?.size || 0) < 2) {
      this._vp.pointer.pinch.active = false;
      this._vp.pointer.pinch.idA = null;
      this._vp.pointer.pinch.idB = null;
      this._vp.pointer.pinch.startDist = 0;
    }

    // If no pointers left → pointer up
    if ((this._vp.pointer.active?.size || 0) === 0) {
      this._vp.pointer.down = false;
      this._vp.pointer.pointerId = null;
      if (this._view) this._view.panning = false;
    }
  }



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

    // ---------------------------------------------------------------------
    // Pointer Events (Mouse/Touch/Pencil) – Step 2
    // ---------------------------------------------------------------------
    // NOTE: touchAction = 'none' ist am Canvas gesetzt, damit PointerEvents auch auf iPad sauber laufen.
    this._vp._onPtrDown = (ev) => this._onViewportPointerDown(ev);
    this._vp._onPtrMove = (ev) => this._onViewportPointerMove(ev);
    this._vp._onPtrUp = (ev) => this._onViewportPointerUp(ev);
    this._vp._onPtrEnter = () => { this._vp.pointer.inside = true; };
    this._vp._onPtrLeave = () => { this._vp.pointer.inside = false; };

    c.addEventListener("pointerdown", this._vp._onPtrDown);
    c.addEventListener("pointermove", this._vp._onPtrMove);
    c.addEventListener("pointerup", this._vp._onPtrUp);
    c.addEventListener("pointercancel", this._vp._onPtrUp);
    c.addEventListener("pointerenter", this._vp._onPtrEnter);
    c.addEventListener("pointerleave", this._vp._onPtrLeave);

    // Zoom via MouseWheel / Trackpad (Step 3)
    this._vp._onWheel = (ev) => this._onViewportWheel(ev);
    c.addEventListener("wheel", this._vp._onWheel, { passive: false });


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

    try { this._vp.ro?.disconnect?.(); } catch {}
    this._vp.ro = null;


    // Pointer Listener Cleanup (Step 2)
    try {
      const c = this._vp.canvas;
      if (c) {
        if (this._vp._onPtrDown) c.removeEventListener("pointerdown", this._vp._onPtrDown);
        if (this._vp._onPtrMove) c.removeEventListener("pointermove", this._vp._onPtrMove);
        if (this._vp._onPtrUp) {
          c.removeEventListener("pointerup", this._vp._onPtrUp);
          c.removeEventListener("pointercancel", this._vp._onPtrUp);
        }
        if (this._vp._onPtrEnter) c.removeEventListener("pointerenter", this._vp._onPtrEnter);
        if (this._vp._onPtrLeave) c.removeEventListener("pointerleave", this._vp._onPtrLeave);
        if (this._vp._onWheel) c.removeEventListener("wheel", this._vp._onWheel);

      }
    } catch {}

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

    const dprCap = Number(this._cfg?.dprCap ?? 2) || 2;
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
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

    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    // Step 3: World-Transform (Pan/Zoom)
    ctx.translate(this._view.offsetX, this._view.offsetY);
    ctx.scale(this._view.zoom, this._view.zoom);

    // Grid Größe aus Settings (für Step 1 interpretieren wir es als Pixel-Step)
    const baseStep = Number(this._cfg?.gridSize ?? 50) || 50;
    const gridStep = Math.max(10 * dpr, Math.floor(baseStep * dpr));
    // Grid Rendering (enabled via settings:workspace)
    const gridOn = !!this._cfg?.gridEnabled;

    // Quality beeinflusst Grid-Alpha minimal (nur UI)
    const q = String(this._cfg?.quality || "medium");
    const gridAlpha = (q === "high") ? 0.08 : (q === "low" ? 0.04 : 0.06);

    ctx.strokeStyle = `rgba(0,0,0,${gridAlpha})`;
    ctx.lineWidth = (Math.max(1, Math.floor(1 * dpr)) / (this._view.zoom || 1));

    if (gridOn) {
      // Visible World-Bounds (in world units)
      const z = (this._view.zoom || 1);
      const viewW = w / z;
      const viewH = h / z;

      const left = (-this._view.offsetX) / z;
      const top = (-this._view.offsetY) / z;
      const right = left + viewW;
      const bottom = top + viewH;

      // Start-Lines aligned to baseStep (world units)
      const startX = Math.floor(left / baseStep) * baseStep;
      const endX = Math.ceil(right / baseStep) * baseStep;
      const startY = Math.floor(top / baseStep) * baseStep;
      const endY = Math.ceil(bottom / baseStep) * baseStep;

      ctx.beginPath();
      for (let xw = startX; xw <= endX; xw += baseStep) {
        ctx.moveTo(xw, startY);
        ctx.lineTo(xw, endY);
      }
      for (let yw = startY; yw <= endY; yw += baseStep) {
        ctx.moveTo(startX, yw);
        ctx.lineTo(endX, yw);
      }
      ctx.stroke();
    }

    // Crosshair (immer sichtbar)
ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = (Math.max(1, Math.floor(2 * dpr)) / (this._view.zoom || 1));
    ctx.beginPath();
    ctx.moveTo(-20 * dpr, 0);
    ctx.lineTo(20 * dpr, 0);
    ctx.moveTo(0, -20 * dpr);
    ctx.lineTo(0, 20 * dpr);
    ctx.stroke();

    ctx.restore();

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = `${Math.floor(12 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    const lines = [
      `Viewport Step 3 (Pan/Zoom/Grid)`,
      `Grid: ${this._cfg?.gridEnabled ? 'on' : 'off'} (${this._cfg?.gridSize || 50})  Snap: ${this._cfg?.snapEnabled ? 'on' : 'off'}`,
      `BG: ${String(this._cfg?.bgColor || '#f2f2f2')}  Q: ${String(this._cfg?.quality || 'medium')}  DPRcap:${Number(this._cfg?.dprCap || 2)}`,
      `Pointer: ${Math.round(this._vp?.pointer?.x ?? 0)} / ${Math.round(this._vp?.pointer?.y ?? 0)}  (down:${this._vp?.pointer?.down ? '1':'0'})`,
      `Zoom: ${Number(this._view?.zoom ?? 1).toFixed(2)}  Offset: ${Math.round(this._view?.offsetX ?? 0)} / ${Math.round(this._view?.offsetY ?? 0)}`,
      `World: ${Math.round(this._screenToWorld(this._vp?.pointer?.x ?? 0, this._vp?.pointer?.y ?? 0).x)} / ${Math.round(this._screenToWorld(this._vp?.pointer?.x ?? 0, this._vp?.pointer?.y ?? 0).y)}  Snap: ${this._cfg?.snapEnabled ? 'on':'off'}`,
      `Mode: ${this.state.modeId}`,
      `Size: ${this._vp.w}×${this._vp.h}  DPR:${(this._vp.dpr || 1).toFixed(2)}`,
      `dt: ${dt.toFixed(1)}ms  fps: ${this._vp.fps ? this._vp.fps.toFixed(1) : "…"}`
    ];
    const pad = Math.floor(10 * dpr);
    let y = pad + Math.floor(14 * dpr);
    for (const s of lines) {
      ctx.fillText(s, pad, y);
      y += Math.floor(16 * dpr);
    }
  }


/* ==========================================================================
 * Viewport Step 3 helpers (World/Screen, Snap, Wheel-Zoom)
 * ========================================================================= */

_screenToWorld(sx, sy) {
  // Screen (CSS px) -> World (arbitrary units)
  const z = Number(this._view?.zoom ?? 1) || 1;
  const ox = Number(this._view?.offsetX ?? 0) || 0;
  const oy = Number(this._view?.offsetY ?? 0) || 0;

  return {
    x: (Number(sx || 0) - ox) / z,
    y: (Number(sy || 0) - oy) / z
  };
  }

  _renderViewport2D(dt) {
    const c = this._vp.canvas;
    const ctx = this._vp.ctx;
    if (!c || !ctx) return;

    // NOTE:
    // Canvas läuft in Device-Pixeln (c.width/c.height), unsere Eingaben/Offsets sind aber in CSS-Pixeln.
    // Darum setzen wir hier IMMER einen Basis-Transform auf (dpr), und zeichnen anschließend in CSS-Pixeln.
    const dpr = Number(this._vp.dpr || 1) || 1;
    const w = Number(this._vp.w || 1) || 1; // CSS px
    const h = Number(this._vp.h || 1) || 1; // CSS px

    // Background (CSS px, dpr handled via setTransform)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const bg = String(this._cfg?.backgroundColor || "#f2f2f2");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // View params
    const z = Number(this._view?.zoom ?? 1) || 1;
    const ox = Number(this._view?.offsetX ?? 0) || 0;
    const oy = Number(this._view?.offsetY ?? 0) || 0;

    // Visible world bounds (in World units)
    const w0 = this._screenToWorld(0, 0);
    const w1 = this._screenToWorld(w, h);
    const minX = Math.min(w0.x, w1.x);
    const maxX = Math.max(w0.x, w1.x);
    const minY = Math.min(w0.y, w1.y);
    const maxY = Math.max(w0.y, w1.y);

    // WORLD drawing: translate/scale after base dpr
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(z, z);

    // -------- Grid (World space) --------
    const gridOn = !!this._cfg?.gridOn;
    const snapOn = !!this._cfg?.snapOn;
    const gridSize = Math.max(1, Number(this._cfg?.gridSize ?? 50) || 50);

    if (gridOn) {
      // Keep 1px-ish line width in screen space
      ctx.lineWidth = Math.max(0.5, 1 / z);
      ctx.strokeStyle = "rgba(0,0,0,0.08)";

      const startX = Math.floor(minX / gridSize) * gridSize;
      const endX = Math.ceil(maxX / gridSize) * gridSize;
      const startY = Math.floor(minY / gridSize) * gridSize;
      const endY = Math.ceil(maxY / gridSize) * gridSize;

      ctx.beginPath();
      for (let x = startX; x <= endX; x += gridSize) {
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
      }
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
      }
      ctx.stroke();
    }

    // -------- Crosshair (World origin) --------
    // (Wichtig als Orientierung beim Pan/Zoom)
    ctx.lineWidth = Math.max(1, 2 / z);
    ctx.strokeStyle = "rgba(0,0,0,0.20)";
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.stroke();

    // -------- Pointer marker (snapped) --------
    const px = Number(this._vp?.pointer?.x ?? 0);
    const py = Number(this._vp?.pointer?.y ?? 0);
    const wp = this._screenToWorld(px, py);
    const sp = this._snapWorld(wp.x, wp.y);
    const mx = sp.snapped ? sp.x : wp.x;
    const my = sp.snapped ? sp.y : wp.y;

    ctx.fillStyle = sp.snapped && snapOn ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.arc(mx, my, Math.max(2, 4 / z), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // -------- HUD / Debug overlay (screen space) --------
    // (immer in CSS px, weil setTransform(dpr,...) aktiv ist)
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textBaseline = "top";

    const lines = [
      `Viewport Step 3 (Pan/Zoom/Grid)`,
      `Grid: ${gridOn ? "on" : "off"} (${gridSize})  Snap: ${snapOn ? "on" : "off"}`,
      `BG: ${bg}  Q: ${String(this._cfg?.quality || "medium")}  DPRcap:${Number(this._cfg?.dprCap ?? 2)}`,
      `Pointer: ${Math.round(px)} / ${Math.round(py)}  (down:${this._vp?.pointer?.down ? 1 : 0})`,
      `Zoom: ${z.toFixed(2)}  Off: ${Math.round(ox)} / ${Math.round(oy)}`,
      `World: ${wp.x.toFixed(2)} / ${wp.y.toFixed(2)}  ${sp.snapped ? `(snap→ ${sp.x.toFixed(2)} / ${sp.y.toFixed(2)})` : ""}`,
      `Mode: ${String(this.state?.modeId || "select")}`,
      `dt: ${Number(dt || 0).toFixed(2)}ms  fps: ${Number(this._vp.fps || 0).toFixed(1)}`
    ];

    const pad = 8;
    const boxW = 360;
    const boxH = pad + lines.length * 16 + pad;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(10, 10, boxW, boxH);
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.strokeRect(10, 10, boxW, boxH);

    ctx.fillStyle = "rgba(0,0,0,0.60)";
    let y = 10 + pad;
    for (const line of lines) {
      ctx.fillText(line, 10 + pad, y);
      y += 16;
    }
    ctx.restore();
  }



/* ==========================================================================
 * Viewport Step 3 helpers (World/Screen, Snap, Wheel-Zoom)
 * ========================================================================= */

_screenToWorld(sx, sy) {
  // Screen (CSS px) -> World (arbitrary units)
  const z = Number(this._view?.zoom ?? 1) || 1;
  const ox = Number(this._view?.offsetX ?? 0) || 0;
  const oy = Number(this._view?.offsetY ?? 0) || 0;

  return {
    x: (Number(sx || 0) - ox) / z,
    y: (Number(sy || 0) - oy) / z
  };
}

_worldToScreen(wx, wy) {
  // World -> Screen (CSS px)
  const z = Number(this._view?.zoom ?? 1) || 1;
  const ox = Number(this._view?.offsetX ?? 0) || 0;
  const oy = Number(this._view?.offsetY ?? 0) || 0;

  return {
    x: (Number(wx || 0) * z) + ox,
    y: (Number(wy || 0) * z) + oy
  };
}

_setZoomAt(sx, sy, targetZoom, source = "ui") {
  // Central zoom helper: keeps the world-point under (sx/sy) stable while zooming.
  if (!this._view || !this._vp?.canvas) return;

  const sxN = Number(sx || 0);
  const syN = Number(sy || 0);

  const zMin = Number(this._view.minZoom ?? 0.25) || 0.25;
  const zMax = Number(this._view.maxZoom ?? 6.0) || 6.0;

  const z0 = Number(this._view.zoom ?? 1) || 1;
  let z1 = Number(targetZoom || z0) || z0;
  z1 = Math.max(zMin, Math.min(zMax, z1));

  if (Math.abs(z1 - z0) < 1e-6) {
    // trotzdem UI syncen, falls Slider/Label out-of-sync ist
    if (this._els?.zoomRange) this._els.zoomRange.value = String(z0);
    if (this._els?.zoomValue) this._els.zoomValue.textContent = z0.toFixed(2);
    return;
  }

  const w0 = this._screenToWorld(sxN, syN);

  this._view.zoom = z1;
  this._view.offsetX = sxN - (w0.x * z1);
  this._view.offsetY = syN - (w0.y * z1);

  // UI sync (Tablet)
  if (this._els?.zoomRange) this._els.zoomRange.value = String(z1);
  if (this._els?.zoomValue) this._els.zoomValue.textContent = z1.toFixed(2);

  // (kein resize notwendig; RenderLoop läuft)
  this.bus?.emit?.("cb:viewport:view:changed", {
    zoom: z1,
    offsetX: this._view.offsetX,
    offsetY: this._view.offsetY,
    source
  });
}


_snapWorld(wx, wy) {
  // Snap in World-Units (GridSize aus settings:workspace)
  const snapOn = !!this._cfg?.snapEnabled;
  const step = Number(this._cfg?.gridSize ?? 50) || 50;

  if (!snapOn || step <= 0) {
    return { x: wx, y: wy, snapped: false };
  }

  const sx = Math.round(wx / step) * step;
  const sy = Math.round(wy / step) * step;

  const snapped = (sx !== wx) || (sy !== wy);
  return { x: sx, y: sy, snapped };
_onViewportWheel(ev) {
  // Zoom around pointer (MouseWheel/Trackpad) – für Desktop/Trackpad.
  if (!ev) return;
  try { ev.preventDefault(); } catch {}

  if (!this._vp?.canvas || !this._view) return;

  const { x: sx, y: sy } = this._getCanvasLocalXY(ev);

  // Trackpads liefern oft kleine Deltas → exponentiell sanft.
  const dy = Number(ev.deltaY || 0);
  const factor = Math.exp(-dy * 0.0015);

  const z0 = Number(this._view.zoom ?? 1) || 1;
  const z1 = z0 * factor;

  this._setZoomAt(sx, sy, z1, "wheel");
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
      b.style.background = (t.id === activeId) ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.20)";
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
      try { onClick?.(); } catch (e) { console.error("[workarea] button handler failed:", e); }
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
