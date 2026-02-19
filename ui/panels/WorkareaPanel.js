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
    // Safety: "pan" muss existieren (Tablet Navigation).
    if (!modes.some(m => String(m.id) === "pan")) {
      modes.splice(1, 0, { id: "pan", title: "Pan" });
    }


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

  // ------------------------------------------------------------
  // Viewport Interaction (Pointer / Touch) – Step 3/4 Grundlage
  //   - 1 Finger: Pan (drag)
  //   - 2 Finger: Pinch-Zoom + Pan (Midpoint-Shift)
  //   - Maus: Drag-Pan, Wheel-Zoom (Wheel-Handler unten)
  //
  // Wichtig:
  // Wir arbeiten hier in *CSS-Pixeln* relativ zum Canvas-Rect.
  // Der Render-Loop nutzt ctx.setTransform(dpr,0,0,dpr,0,0),
  // d.h. alle Zeichen-Koordinaten und Offsets sind ebenfalls in CSS-Pixeln.
  // ------------------------------------------------------------

  _getCanvasLocalXY(ev) {
    const vp = this._vp;
    if (!vp || !vp.canvas) return { x: 0, y: 0, ok: false };

    const rect = vp.canvas.getBoundingClientRect();
    // clientX/Y sind Viewport-Koordinaten (CSS px). Wir mappen auf Canvas-Local (CSS px).
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // ok nur wenn innerhalb des Rects (kleiner Toleranzbereich)
    const ok = x >= -2 && y >= -2 && x <= rect.width + 2 && y <= rect.height + 2;
    return { x, y, ok, rect };
  }

  _ensureViewportInteractionState() {
    if (!this._vp) this._vp = {};
    const vp = this._vp;

    if (!vp.touches) vp.touches = new Map(); // pointerId -> {x,y}
    if (!vp.pointer) {
      vp.pointer = {
        down: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
        moved: false,
        downX: 0,
        downY: 0,
      };
    }
    if (!vp.pinch) {
      vp.pinch = {
        active: false,
        startDist: 0,
        startZoom: 1,
        lastMidX: 0,
        lastMidY: 0,
      };
    }
  }

  _onViewportPointerDown(ev) {
    const vp = this._vp;
    if (!vp || !vp.canvas) return;

    this._ensureViewportInteractionState();

    // Pointer Capture -> wir bekommen Move/Up auch wenn Finger aus dem Canvas driftet
    try { vp.canvas.setPointerCapture(ev.pointerId); } catch (_) {}

    const p = this._getCanvasLocalXY(ev);
    if (!p.ok) return;

    // Touch/Pointer im Map speichern
    vp.touches.set(ev.pointerId, { x: p.x, y: p.y });

    // 1-Finger: Pan-Start
    if (vp.touches.size === 1) {
      vp.pointer.down = true;
      vp.pointer.pointerId = ev.pointerId;
      vp.pointer.lastX = p.x;
      vp.pointer.lastY = p.y;
      vp.pointer.downX = p.x;
      vp.pointer.downY = p.y;
      vp.pointer.moved = false;
      return;
    }

    // 2-Finger: Pinch-Start
    if (vp.touches.size === 2) {
      const arr = Array.from(vp.touches.values());
      const a = arr[0], b = arr[1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(0.0001, Math.hypot(dx, dy));
      const midX = (a.x + b.x) * 0.5;
      const midY = (a.y + b.y) * 0.5;

      vp.pinch.active = true;
      vp.pinch.startDist = dist;
      vp.pinch.startZoom = vp.zoom || 1;
      vp.pinch.lastMidX = midX;
      vp.pinch.lastMidY = midY;

      // während Pinch aktiv ist, ist "1-finger-pan" deaktiviert
      vp.pointer.down = false;
      vp.pointer.pointerId = null;
    }
  }

  _onViewportPointerMove(ev) {
    const vp = this._vp;
    if (!vp || !vp.canvas) return;

    this._ensureViewportInteractionState();

    const p = this._getCanvasLocalXY(ev);
    if (!p.ok) return;

    if (vp.touches.has(ev.pointerId)) {
      vp.touches.set(ev.pointerId, { x: p.x, y: p.y });
    }

    // 2-Finger Pinch-Zoom + Midpoint-Pan
    if (vp.pinch.active && vp.touches.size >= 2) {
      const arr = Array.from(vp.touches.values());
      const a = arr[0], b = arr[1];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(0.0001, Math.hypot(dx, dy));
      const midX = (a.x + b.x) * 0.5;
      const midY = (a.y + b.y) * 0.5;

      const ratio = dist / Math.max(0.0001, vp.pinch.startDist);
      const targetZoom = this._clampZoom(vp.pinch.startZoom * ratio);

      // Zoom um den Midpoint (World-Fokus bleibt stabil)
      this._setZoomAt(midX, midY, targetZoom);

      // Zusätzlich: Midpoint-Verschiebung = Pan (2-Finger Move)
      const dmX = midX - vp.pinch.lastMidX;
      const dmY = midY - vp.pinch.lastMidY;
      vp.offsetX = (vp.offsetX || 0) + dmX;
      vp.offsetY = (vp.offsetY || 0) + dmY;
      vp.pinch.lastMidX = midX;
      vp.pinch.lastMidY = midY;

      // Render direkt (UI fühlt sich "live" an)
      this._renderViewport2D();
      return;
    }

    // 1-Finger Drag-Pan
    if (vp.pointer.down && vp.pointer.pointerId === ev.pointerId) {
      const dx = p.x - vp.pointer.lastX;
      const dy = p.y - vp.pointer.lastY;

      // Move-Threshold für "Tap vs Drag"
      if (!vp.pointer.moved) {
        const mdx = p.x - vp.pointer.downX;
        const mdy = p.y - vp.pointer.downY;
        if (Math.hypot(mdx, mdy) > 4) vp.pointer.moved = true;
      }

      vp.offsetX = (vp.offsetX || 0) + dx;
      vp.offsetY = (vp.offsetY || 0) + dy;

      vp.pointer.lastX = p.x;
      vp.pointer.lastY = p.y;

      this._renderViewport2D();
    }
  }

  _onViewportPointerUp(ev) {
    const vp = this._vp;
    if (!vp || !vp.canvas) return;

    this._ensureViewportInteractionState();

    // remove touch
    if (vp.touches && vp.touches.has(ev.pointerId)) {
      vp.touches.delete(ev.pointerId);
    }

    // release capture
    try { vp.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}

    // wenn Pinch aktiv war und wir unter 2 Touches fallen -> Pinch Ende
    if (vp.pinch.active && vp.touches.size < 2) {
      vp.pinch.active = false;
      vp.pinch.startDist = 0;
    }

    // wenn der "primary" pointer hoch geht -> Pan Ende
    if (vp.pointer.pointerId === ev.pointerId) {
      vp.pointer.down = false;
      vp.pointer.pointerId = null;

      // Step 4 Selection (minimal): Tap ohne Drag -> nur Debug-Fokus setzen
      // (Später: Hit-Test + Selection + Properties-Bindings)
      // if (!vp.pointer.moved) { ... }
    }
  }

  _onViewportPointerCancel(ev) {
    // Cancel wie Up behandeln (z.B. OS-Gesten, App-Switch, etc.)
    this._onViewportPointerUp(ev);
  }
  /** =======================================================================
   * Viewport Step 3 Helpers (World/Screen, Snap, Wheel/Touch-Zoom)
   * -----------------------------------------------------------------------
   * Wichtig:
   * - Wir rechnen im 2D-Canvas *immer* in WORLD-Koordinaten, und mappen dann
   *   über (zoom, offsetX/Y) in SCREEN.
   * - offsetX/Y sind SCREEN-Pixel-Offsets (Canvas-Koordinaten).
   * - zoom ist ein Skalierungsfaktor (1.0 = 100%).
   * ======================================================================= */

  _screenToWorld(sx, sy) {
    // SCREEN(px) -> WORLD(px)
    const v = this._view || { zoom: 1, offsetX: 0, offsetY: 0 };
    const z = (v.zoom && v.zoom > 0) ? v.zoom : 1;
    return {
      x: (sx - (v.offsetX || 0)) / z,
      y: (sy - (v.offsetY || 0)) / z,
    };
  }

  _worldToScreen(wx, wy) {
    // WORLD(px) -> SCREEN(px)
    const v = this._view || { zoom: 1, offsetX: 0, offsetY: 0 };
    const z = (v.zoom && v.zoom > 0) ? v.zoom : 1;
    return {
      x: (wx * z) + (v.offsetX || 0),
      y: (wy * z) + (v.offsetY || 0),
    };
  }

  _applyZoomAtScreenPoint(anchorSX, anchorSY, newZoom) {
    // Zoom so ändern, dass der WORLD-Punkt unter (anchorSX/anchorSY) stabil bleibt.
    const v = this._view;
    if (!v) return;

    const oldZoom = (v.zoom && v.zoom > 0) ? v.zoom : 1;

    // Clamp (Safety) – Werte müssen zu Slider/Patch passen.
    const zMin = (this._cfg && typeof this._cfg.zoomMin === "number") ? this._cfg.zoomMin : 0.25;
    const zMax = (this._cfg && typeof this._cfg.zoomMax === "number") ? this._cfg.zoomMax : 4.5;

    const z = Math.max(zMin, Math.min(zMax, newZoom || 1));

    // WORLD-Koordinate unter dem Anker
    const w = {
      x: (anchorSX - (v.offsetX || 0)) / oldZoom,
      y: (anchorSY - (v.offsetY || 0)) / oldZoom,
    };

    v.zoom = z;
    v.offsetX = anchorSX - (w.x * z);
    v.offsetY = anchorSY - (w.y * z);
  }

  _snapWorld(wx, wy) {
    // Snap in WORLD (Grid)
    const cfg = this._cfg || {};
    const snapOn = !!cfg.snapOn; // (später im UI schaltbar)
    if (!snapOn) return { x: wx, y: wy };

    const g = (typeof cfg.gridSize === "number" && cfg.gridSize > 0) ? cfg.gridSize : 50;
    const sx = Math.round(wx / g) * g;
    const sy = Math.round(wy / g) * g;
    return { x: sx, y: sy };
  }

  _onViewportWheel(ev) {
    // Desktop/Trackpad Zoom (Ctrl/Meta optional)
    if (!this._vp || !this._vp.canvas) return;
    if (!this._view) return;

    // In Safari/iOS kann "wheel" auch kommen (Trackpad / Magic Keyboard)
    try { ev.preventDefault(); } catch (_) {}

    const rect = this._vp.canvas.getBoundingClientRect();
    const sx = (typeof ev.clientX === "number") ? (ev.clientX - rect.left) : (ev.offsetX || 0);
    const sy = (typeof ev.clientY === "number") ? (ev.clientY - rect.top) : (ev.offsetY || 0);

    // Konvention: Wheel down -> zoom OUT (negatives Vorzeichen)
    const dy = (typeof ev.deltaY === "number") ? ev.deltaY : 0;

    // Sanfte Zoom-Kurve (exponentiell)
    const factor = Math.exp((-dy) * 0.0015);
    const newZoom = (this._view.zoom || 1) * factor;

    this._applyZoomAtScreenPoint(sx, sy, newZoom);
    this._requestRender();
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


  /**
   * Kleine "Pill"-UI-Komponente im Cybermotion-Stil.
   *
   * Nutzung:
   *  - _pill("Text", "rgba(...)")              -> statisch
   *  - _pill("Button", () => {...}, "Title")  -> klickbar (button-like)
   */
  _pill(text, bgOrOnClick, title) {
    const isFn = (typeof bgOrOnClick === "function");
    const el = document.createElement(isFn ? "button" : "div");

    // Inhalt
    el.textContent = text;

    // Grund-Styling (für div UND button)
    el.style.height = "28px";
    el.style.display = "inline-flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.padding = "0 10px";
    el.style.borderRadius = "10px";
    el.style.border = "1px solid rgba(255,255,255,.10)";
    el.style.background = isFn ? "rgba(255,255,255,.06)" : (bgOrOnClick || "rgba(255,255,255,.06)");
    el.style.fontSize = "12px";
    el.style.opacity = ".9";

    if (title) el.title = String(title);

    // Button-Feinschliff (Touch + Tastatur)
    if (isFn) {
      el.type = "button";
      el.style.cursor = "pointer";
      el.style.userSelect = "none";
      el.style.webkitTapHighlightColor = "transparent";
      el.addEventListener("click", (ev) => {
        try { ev.preventDefault(); } catch {}
        try { bgOrOnClick(ev); } catch (e) {
          // Debug/Checker: Fehler sichtbar machen
          console.error("[WorkareaPanel] _pill click handler failed:", e);
        }
      });
    }

    return el;
  }


  _spacer() {
    const s = document.createElement("div");
    s.style.flex = "1 1 auto";
    return s;
  }
}
