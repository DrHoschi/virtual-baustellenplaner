/**
 * ui/panels/WorkareaPanel.js
 * Version: v1.1.2-workarea-viewport-step4 + robust-tap + hit-test + object-drag + pan-restore (2026-02-24)
 *
 * Ziel:
 * - Cybermotion-Style Arbeitsbereich als datengetriebene Shell
 * - Viewport Step 4: Canvas + ResizeObserver + RenderLoop + Pan/Zoom/Grid + Selection + Hit-Test + Objekt-Drag (Dummy Scene)
 *
 * WICHTIG:
 * - Debug/Checker bleiben drin.
 * - Keine ZIPs, nur saubere Full-File Drops.
 *
 * Fixes / Verbesserungen:
 * - Tap-Threshold robust pro pointerId (Multi-Touch sicher)
 * - Snap: step defensiv und grid-aligned zum gezeichneten Grid
 * - Hit-Test: Tap selektiert Objekte, sonst SelectionPoint
 * - Select-Mode:
 *     - Tap = Selection
 *     - Drag auf Objekt (über Threshold) = Objekt verschieben (mit Snap)
 *     - Drag im leeren Bereich (über Threshold) = View pan (1 Finger wieder "wie früher")
 * - Pan-Mode:
 *     - Drag = View pan (sofort, ohne Threshold)
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

    // --- Viewport Step 1/3/4 (Canvas + Resize + RenderLoop + Pan/Zoom/Select) ---
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
        down: new Map(), // NEW: pointerId -> {x,y} Tap-Start (Multi-Touch robust)
        lastX: 0,
        lastY: 0,
        isPanning: false,
        panPointerId: null, // NEW: welcher Pointer aktuell den Pan führt

        dragActive: false, // NEW: Objekt-Drag aktiv
        dragObjId: null, // NEW: id des gezogenen Objekts
        dragOffset: { x: 0, y: 0 }, // NEW: world-offset zwischen Pointer und Objektzentrum

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

      selectionPoint: null, // { wx, wy } in world
      selection: this._makeDummySelection("project")
    };

    // Bus subscriptions
    this._unsubs = [];

    // --------------------------------------------------------
    // Workarea Settings Cache (live aus settings:workspace)
    // --------------------------------------------------------
    this._cfg = this._getWorkspaceCfgFromStore();

    // -----------------------------------------------------------------------
    // Dummy Scene Objects (Step 4: "real" Selection via Hit-Test + Drag)
    // -----------------------------------------------------------------------
    // World-Koordinaten (wie world.wx/wy)
    // r = Hit-Radius in World-Units (passt gut zum Grid)
    this._scene = {
      objects: [
        { id: "obj-1", type: "conveyor.segment", name: "Rollenbahn A", x: -300, y: -120, r: 24 },
        { id: "obj-2", type: "asset.glb", name: "Motor", x: 180, y: 90, r: 20 },
        { id: "obj-3", type: "hall.procedural", name: "Halle Ecke", x: 420, y: -260, r: 28 }
      ]
    };
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
    sub.textContent = "Cybermotion Shell (Viewport Step 4: Pan/Zoom/Grid/Select/HitTest/Drag) – datengetrieben";
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
    consoleDrawer.style.fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
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

    // Settings → Workarea live anwenden (INIT)
    this._applyWorkspaceCfgToUI?.({ reason: "init" }); // falls in deinem Build vorhanden
    this._applyDockVisibility();

    // Events
    this._wireBus();
    this._wireUI?.(); // falls in deinem Build vorhanden

    // Start render loop
    this._startViewportLoop();

    // notify
    try {
      this.bus?.emit?.("cb:workarea:layout:ready", { panelId: this.panelId });
    } catch {}

    this._setStatus("Workarea ready.");
  }

  async unmount() {
    this._mounted = false;

    try {
      this._stopViewportLoop();
    } catch {}

    try {
      this._vp.ro?.disconnect?.();
    } catch {}

    for (const fn of this._unsubs) {
      try {
        fn?.();
      } catch {}
    }
    this._unsubs = [];

    if (this.rootEl) {
      this.rootEl.innerHTML = "";
    }
  }

  /* ==========================================================================
   * Bus + UI wiring
   * ========================================================================= */

  _wireBus() {
    // req:workarea:mode:set
    this._unsubs.push(
      this.bus?.on?.("req:workarea:mode:set", (ev) => {
        const modeId = String(ev?.modeId || "");
        if (!modeId) return;
        this._setMode(modeId, { reason: "req" });
      })
    );

    // cb:settings:workspace:changed → live cfg refresh
    this._unsubs.push(
      this.bus?.on?.("cb:settings:workspace:changed", (ev) => {
        const ws = ev?.workspace || null;

        // Defensive: wenn payload fehlt, trotzdem aus store neu holen
        if (!ws) {
          this._cfg = this._getWorkspaceCfgFromStore();
        } else {
          this._cfg = ws;
        }

        // Live anwenden
        this._applyWorkspaceCfgToUI?.({ reason: "live" });

        // Redraw
        this._renderTopbar();
      })
    );
  }

  _wireUI() {
    // nichts zusätzlich – UI callbacks werden in renderTopbar etc gesetzt
  }

  /* ==========================================================================
   * Workspace Settings (live)
   * ========================================================================= */

  _getWorkspaceCfgFromStore() {
    try {
      const app = this.store?.get?.("app");
      const ws = app?.settings?.workspace || null;
      return ws || {};
    } catch {
      return {};
    }
  }

  _applyWorkspaceCfgToUI({ reason = "apply" } = {}) {
    // Docks/Fullscreen (wenn vorhanden)
    try {
      if (typeof this._cfg?.uiLeftDockCollapsed === "boolean") this.state.leftDockCollapsed = this._cfg.uiLeftDockCollapsed;
      if (typeof this._cfg?.uiRightDockCollapsed === "boolean") this.state.rightDockCollapsed = this._cfg.uiRightDockCollapsed;
      if (typeof this._cfg?.uiBottomCollapsed === "boolean") this.state.bottomCollapsed = this._cfg.uiBottomCollapsed;
      if (typeof this._cfg?.uiFullscreen === "boolean") this.state.fullscreen = this._cfg.uiFullscreen;
      this._applyDockVisibility();
    } catch {}

    this._setStatus(`Settings applied (${reason}).`);
  }

  /* ==========================================================================
   * Render: Topbar / Tabs / Panels
   * ========================================================================= */

  _renderTopbar() {
    const el = this._els.topbar;
    if (!el) return;
    el.innerHTML = "";

    // Left dock toggle
    const btnLeft = this._btn(this.state.leftDockCollapsed ? "◀︎ Dock" : "◀︎ Hide", () => {
      this.state.leftDockCollapsed = !this.state.leftDockCollapsed;
      this._applyDockVisibility();
    });

    // Right dock toggle
    const btnRight = this._btn(this.state.rightDockCollapsed ? "Dock ▶︎" : "Hide ▶︎", () => {
      this.state.rightDockCollapsed = !this.state.rightDockCollapsed;
      this._applyDockVisibility();
    });

    // Fullscreen toggle
    const btnFS = this._btn(this.state.fullscreen ? "🗗 Exit" : "🗖 Full", () => {
      this.state.fullscreen = !this.state.fullscreen;
      this._applyDockVisibility();
    });

    // Mode select
    const modeSelect = document.createElement("select");
    modeSelect.style.height = "28px";
    modeSelect.style.borderRadius = "10px";
    modeSelect.style.border = "1px solid rgba(255,255,255,.12)";
    modeSelect.style.background = "rgba(0,0,0,.20)";
    modeSelect.style.color = "inherit";
    modeSelect.style.padding = "0 8px";

    const modes = Array.isArray(this.tools?.modes) ? this.tools.modes : [];
    if (!modes.length) {
      for (const id of ["select", "pan", "place"]) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = id;
        modeSelect.appendChild(opt);
      }
    } else {
      // Ensure pan exists (falls registry es mal ausblendet)
      const hasPan = modes.some((m) => String(m?.id) === "pan");
      const list = hasPan ? modes : modes.concat([{ id: "pan", title: "Pan" }]);
      for (const m of list) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.title || m.id;
        modeSelect.appendChild(opt);
      }
    }

    modeSelect.value = this.state.modeId || "select";
    modeSelect.addEventListener("change", () => this._setMode(modeSelect.value, { reason: "ui" }));
    this._els.modeSelect = modeSelect;

    // Zoom slider
    const zoomSlider = document.createElement("input");
    zoomSlider.type = "range";
    zoomSlider.min = String(Number(this._cfg?.cameraMinZoom ?? 0.25) || 0.25);
    zoomSlider.max = String(Number(this._cfg?.cameraMaxZoom ?? 4) || 4);
    zoomSlider.step = "0.01";
    zoomSlider.value = String(Number(this._vp.zoom || 1));
    zoomSlider.style.width = "220px";
    zoomSlider.style.accentColor = "var(--accent, #4aa3ff)";
    zoomSlider.setAttribute("data-wk-zoom-slider", "1");

    zoomSlider.addEventListener("input", () => {
      const z = Number(zoomSlider.value || 1);
      this._setViewportZoom(z, "slider");
    });

    const zoomPill = this._pill(`Zoom`, "rgba(255,255,255,.06)");

    // Reset view
    const btnReset = this._btn("Reset", () => {
      this._vp.zoom = 1;
      this._vp.offsetX = 0;
      this._vp.offsetY = 0;
      this._setViewportZoom(1, "reset");
    });

    el.appendChild(btnLeft);
    el.appendChild(btnRight);
    el.appendChild(btnFS);
    el.appendChild(this._spacer());
    el.appendChild(zoomPill);
    el.appendChild(zoomSlider);
    el.appendChild(btnReset);
    el.appendChild(this._spacer());
    el.appendChild(modeSelect);
  }

  _renderLeftTabs() {
    const tabs = this._layoutTabs("leftDock") || [
      { id: "tab.library", title: "Library" },
      { id: "tab.layers", title: "Layer" }
    ];
    this._renderTabsBar(this._els.leftTabsBar, tabs, this.state.leftTabId, (id) => {
      this.state.leftTabId = id;
      this._renderLeftPanel();
    });
  }

  _renderRightTabs() {
    const tabs = this._layoutTabs("rightDock") || [
      { id: "tab.properties", title: "Properties" },
      { id: "tab.inspector", title: "Inspector" }
    ];
    this._renderTabsBar(this._els.rightTabsBar, tabs, this.state.rightTabId, (id) => {
      this.state.rightTabId = id;
      this._renderRightPanel();
    });
  }

  _renderLeftPanel() {
    const host = this._els.leftPanelHost;
    if (!host) return;
    host.innerHTML = "";

    const t = String(this.state.leftTabId || "");

    if (t === "tab.library") {
      host.appendChild(this._makePanelTitle("Library"));
      host.appendChild(this._makePanelText("Hier später: Asset-/Objektbibliothek (drag/drop)."));
      host.appendChild(this._makePanelText("Dummy: Im Select-Mode tapst du auf die Dummy-Kreise im Viewport."));
      host.appendChild(this._makePanelText("NEU: Ziehen auf Objekt = Objekt verschieben. Ziehen im Leerraum = View verschieben."));
    } else if (t === "tab.layers") {
      host.appendChild(this._makePanelTitle("Layer"));
      host.appendChild(this._makePanelText("Hier später: Layer/Visibility/Lock."));
    } else {
      host.appendChild(this._makePanelTitle(t));
      host.appendChild(this._makePanelText("Noch nicht implementiert."));
    }
  }

  _renderRightPanel() {
    const host = this._els.rightPanelHost;
    if (!host) return;
    host.innerHTML = "";

    const t = String(this.state.rightTabId || "");

    if (t === "tab.properties") {
      host.appendChild(this._makePanelTitle("Properties"));

      const sel = this.state.selection;
      const type = String(sel?.type || "project");
      const schema = this._getPropsSchemaForType(type);

      if (!schema) {
        host.appendChild(this._makePanelText(`Kein Schema gefunden für type="${type}".`));
        host.appendChild(this._makePanelText("Fallback: raw selection JSON"));
        host.appendChild(this._makePre(JSON.stringify(sel, null, 2)));
        return;
      }

      const groups = this._resolveSchemaGroups(schema);
      if (!groups.length) {
        host.appendChild(this._makePanelText(`Schema hat keine Gruppen (type="${type}")`));
        host.appendChild(this._makePre(JSON.stringify(sel, null, 2)));
        return;
      }

      for (const g of groups) {
        host.appendChild(this._makeGroupTitle(g.title || g.id));

        const fields = Array.isArray(g.fields) ? g.fields : [];
        if (!fields.length) {
          host.appendChild(this._makePanelText("—"));
          continue;
        }

        for (const f of fields) {
          const v = this._getByPath(sel?.data || {}, f.path || "");
          host.appendChild(this._makePropRow(f.label || f.id || f.path, v, f.type));
        }
      }
    } else if (t === "tab.inspector") {
      host.appendChild(this._makePanelTitle("Inspector"));
      host.appendChild(this._makePanelText("Hier später: Debug, Event-Log, Graph etc."));
      host.appendChild(this._makePanelText("Dummy: aktuelle Selection als JSON"));
      host.appendChild(this._makePre(JSON.stringify(this.state.selection, null, 2)));
    } else {
      host.appendChild(this._makePanelTitle(t));
      host.appendChild(this._makePanelText("Noch nicht implementiert."));
    }
  }

  _renderBottomBar() {
    const el = this._els.bottom;
    if (!el) return;
    el.innerHTML = "";

    const statusLine = document.createElement("div");
    statusLine.style.flex = "1 1 auto";
    statusLine.style.opacity = ".85";
    statusLine.style.fontSize = "12px";
    statusLine.textContent = "…";
    this._els.statusLine = statusLine;

    el.appendChild(statusLine);

    this._setStatus("Ready.");
  }

  _applyDockVisibility() {
    const left = this._els.leftDock;
    const right = this._els.rightDock;
    const bottom = this._els.bottom;

    if (left) left.style.display = this.state.leftDockCollapsed ? "none" : "flex";
    if (right) right.style.display = this.state.rightDockCollapsed ? "none" : "flex";
    if (bottom) bottom.style.display = this.state.bottomCollapsed ? "none" : "flex";

    if (this.state.fullscreen) {
      if (left) left.style.display = "none";
      if (right) right.style.display = "none";
    }
  }

  _setMode(modeId, { reason = "set" } = {}) {
    const id = String(modeId || "");
    if (!id) return;
    this.state.modeId = id;

    try {
      if (this._els.modeSelect) this._els.modeSelect.value = id;
    } catch {}

    try {
      this.bus?.emit?.("cb:workarea:mode:changed", { modeId: id, reason });
    } catch {}

    this._setStatus(`Mode: ${id} (${reason})`);
  }

  _setStatus(text) {
    try {
      if (this._els.statusLine) this._els.statusLine.textContent = String(text || "");
    } catch {}
  }

  /* ==========================================================================
   * Viewport: mount + loop
   * ========================================================================= */

  _mountViewportCanvas(host) {
    this._vp.host = host;

    const c = document.createElement("canvas");
    c.style.position = "absolute";
    c.style.inset = "0";
    c.style.width = "100%";
    c.style.height = "100%";
    c.style.touchAction = "none";
    host.appendChild(c);

    const ctx = c.getContext("2d", { alpha: false, desynchronized: true });
    this._vp.canvas = c;
    this._vp.ctx2d = ctx;

    const ro = new ResizeObserver(() => this._resizeViewportCanvas());
    ro.observe(host);
    this._vp.ro = ro;

    this._resizeViewportCanvas();

    c.addEventListener("pointerdown", (ev) => this._onViewportPointerDown(ev), { passive: false });
    c.addEventListener("pointermove", (ev) => this._onViewportPointerMove(ev), { passive: false });
    c.addEventListener("pointerup", (ev) => this._onViewportPointerUp(ev), { passive: false });
    c.addEventListener("pointercancel", (ev) => this._onViewportPointerUp(ev), { passive: false });
    c.addEventListener("wheel", (ev) => this._onViewportWheel(ev), { passive: false });
  }

  _resizeViewportCanvas() {
    const host = this._vp.host;
    const c = this._vp.canvas;
    if (!host || !c) return;

    const r = host.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));

    const dprCap = Number(this._cfg?.dprCap || 2) || 2;
    const dpr = Math.max(1, Math.min(dprCap, window.devicePixelRatio || 1));

    c.width = Math.max(1, Math.floor(w * dpr));
    c.height = Math.max(1, Math.floor(h * dpr));

    this._vp.w = w;
    this._vp.h = h;
    this._vp.dpr = dpr;
  }

  _startViewportLoop() {
    if (this._vp.running) return;
    this._vp.running = true;
    this._vp.t0 = performance.now();

    const tick = (t) => {
      if (!this._vp.running) return;
      const dt = t - this._vp.t0;
      this._vp.t0 = t;

      this._vp._fpsAcc += dt;
      this._vp._fpsN += 1;
      if (this._vp._fpsAcc >= 500) {
        this._vp.fps = (this._vp._fpsN * 1000) / this._vp._fpsAcc;
        this._vp._fpsAcc = 0;
        this._vp._fpsN = 0;
      }

      this._renderViewport2D(dt);

      this._vp.raf = requestAnimationFrame(tick);
    };

    this._vp.raf = requestAnimationFrame(tick);
  }

  _stopViewportLoop() {
    this._vp.running = false;
    if (this._vp.raf) cancelAnimationFrame(this._vp.raf);
    this._vp.raf = 0;
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
    const step = Math.max(1, baseStep * dpr);

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
    ctx.moveTo(-20 * dpr, 0);
    ctx.lineTo(20 * dpr, 0);
    ctx.moveTo(0, -20 * dpr);
    ctx.lineTo(0, 20 * dpr);
    ctx.stroke();

    // --- Dummy Objects (visual) ---
    // NOTE: Wir sind hier bereits im World-Space (translate+scale aktiv).
    //       o.x/o.y/o.r sind World-Units, deshalb kein *dpr.
    for (const o of (this._scene?.objects || [])) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = (2 * dpr) / zoom;
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.stroke();

      // center dot
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(o.x, o.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Selection Marker (world space)
    if (this.state.selectionPoint) {
      const { wx, wy } = this.state.selectionPoint;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,128,255,0.9)";
      ctx.lineWidth = (2 * dpr) / zoom;
      ctx.arc(wx, wy, 10 * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Overlay
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = `${Math.floor(12 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const lines = [
      `Viewport Step 4 (Pan/Zoom/Grid + HitTest + Drag)`,
      `Select: Tap=Select, Drag on Obj=Move Obj, Drag empty=Pan | Pan-Mode: Drag=Pan`,
      `Grid: ${this._cfg?.gridEnabled ? "on" : "off"} (${this._cfg?.gridSize || 50})  Snap: ${this._cfg?.snapEnabled ? "on" : "off"}`,
      `Zoom: ${Number(this._vp.zoom || 1).toFixed(2)}  Offset: ${Math.round(this._vp.offsetX || 0)}/${Math.round(this._vp.offsetY || 0)}`,
      `Size: ${this._vp.w}×${this._vp.h}  DPR:${(this._vp.dpr || 1).toFixed(2)}  fps:${this._vp.fps ? this._vp.fps.toFixed(1) : "…"}`
    ];

    const pad = Math.floor(10 * dpr);
    let y = pad + Math.floor(14 * dpr);
    for (const line of lines) {
      ctx.fillText(line, pad, y);
      y += Math.floor(16 * dpr);
    }
  }

  /* ==========================================================================
   * Viewport Helpers
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

  // -----------------------------------------------------------------------
  // Step 4 Helpers: Snap + Hit-Test + Object lookup
  // -----------------------------------------------------------------------

  _getSnapStepWorld() {
    // NOTE: Grid wird hier mit (gridSize * dpr) gezeichnet -> Snap muss deckungsgleich sein.
    const dpr = Number(this._vp.dpr || 1);
    const base = Number(this._cfg?.gridSize ?? 50) || 50;
    return Math.max(1, base * dpr);
  }

  _findSceneObjectById(id) {
    const objs = this._scene?.objects || [];
    return objs.find((o) => o && o.id === id) || null;
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

  _applySnapToWorldPoint(world) {
    if (!this._cfg?.snapEnabled) return world;
    const step = this._getSnapStepWorld();
    world.wx = Math.round(world.wx / step) * step;
    world.wy = Math.round(world.wy / step) * step;
    return world;
  }

  _setSelectionToObject(o, source = "viewport") {
    if (!o) return;
    this.state.selectionPoint = { wx: o.x, wy: o.y };
    this.state.selection = {
      id: o.id,
      type: o.type,
      data: {
        id: o.id,
        type: o.type,
        meta: { name: o.name },
        world: { x: o.x, y: o.y }
      }
    };
    this._publishSelectionChanged(source);
    this._renderRightPanel();
  }

  _setSelectionToPoint(world, source = "viewport") {
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
    this._publishSelectionChanged(source);
    this._renderRightPanel();
  }

  _onViewportPointerDown(ev) {
    const c = this._vp.canvas;
    if (!c) return;

    try { ev.preventDefault?.(); } catch {}
    try { c.setPointerCapture?.(ev.pointerId); } catch {}

    const pt = this._viewportClientToCanvasPx(ev);
    const P = this._vp.pointer;

    P.active.set(ev.pointerId, { x: pt.x, y: pt.y });
    P.down.set(ev.pointerId, { x: pt.x, y: pt.y });
    P.lastX = pt.x;
    P.lastY = pt.y;

    // Pinch start (2 fingers)
    if (P.active.size === 2) {
      const pts = this._valuesToArray(P.active.values());
      const a = pts[0], b = pts[1];
      const dx = b.x - a.x, dy = b.y - a.y;

      P.pinchActive = true;
      P.pinchDist0 = Math.max(1, Math.hypot(dx, dy));
      P.pinchZoom0 = Number(this._vp.zoom || 1);
      P.pinchMid0 = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };

      P.isPanning = false;
      P.panPointerId = null;
      P.dragActive = false;
      P.dragObjId = null;
      return;
    }

    // Select-Mode: Drag-Kandidat merken (Objekt unter Finger?)
    if (String(this.state.modeId) === "select") {
      const world = this._screenCanvasToWorld(pt);
      const hit = this._hitTestWorldPoint(world.wx, world.wy);
      if (hit) {
        P.dragObjId = hit.id;
        P.dragOffset = { x: world.wx - hit.x, y: world.wy - hit.y };
      } else {
        P.dragObjId = null;
      }
    } else {
      P.dragObjId = null;
    }

    // Pan-Mode: sofort pannen
    if (String(this.state.modeId) === "pan") {
      P.isPanning = true;
      P.panPointerId = ev.pointerId;
    } else {
      P.isPanning = false; // wird in Move nach Threshold aktiviert
      P.panPointerId = null;
    }
  }

  _onViewportPointerMove(ev) {
    const c = this._vp.canvas;
    if (!c) return;

    const P = this._vp.pointer;
    if (!P.active.has(ev.pointerId)) return;

    try { ev.preventDefault?.(); } catch {}

    const pt = this._viewportClientToCanvasPx(ev);
    P.active.set(ev.pointerId, { x: pt.x, y: pt.y });

    // Pinch zoom
    if (P.pinchActive && P.active.size >= 2) {
      const pts = this._valuesToArray(P.active.values());
      const a = pts[0], b = pts[1];
      const dx = b.x - a.x, dy = b.y - a.y;

      const dist = Math.max(1, Math.hypot(dx, dy));
      const mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
      const scale = dist / Math.max(1, P.pinchDist0);

      this._applyZoomAtCanvasPoint(mid, P.pinchZoom0 * scale);
      return;
    }

    // nur 1-Finger Logik hier
    if (P.active.size !== 1) return;

    const down = P.down.get(ev.pointerId);
    const thr = 6 * (this._vp.dpr || 1);

    let movedFar = false;
    if (down) {
      const dx0 = pt.x - down.x;
      const dy0 = pt.y - down.y;
      movedFar = dx0 * dx0 + dy0 * dy0 > thr * thr;
    }

    const modeId = String(this.state.modeId || "select");

    // 1) Objekt-Drag aktivieren (Select-Mode, nur wenn Start auf Objekt + Move>thr)
    if (modeId === "select" && P.dragObjId && !P.dragActive && movedFar) {
      const o = this._findSceneObjectById(P.dragObjId);
      if (o) {
        P.dragActive = true;
        P.isPanning = false;
        P.panPointerId = null;

        // Drag-Start: direkt selektieren
        this._setSelectionToObject(o, "drag-start");

        P.lastX = pt.x;
        P.lastY = pt.y;
      } else {
        P.dragObjId = null;
      }
    }

    // Drag aktiv: Objekt verschieben
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

      this.state.selectionPoint = { wx: o.x, wy: o.y };
      if (this.state.selection?.id === o.id) {
        try {
          this.state.selection.data.world.x = o.x;
          this.state.selection.data.world.y = o.y;
        } catch {}
      }
      return;
    }

    // 2) Pan aktivieren:
    // - Pan-Mode: sofort
    // - andere Modes: erst nach Threshold
    //   (Select-Mode: nur wenn wir NICHT auf einem Objekt gestartet sind)
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

    // Tap-Selection: nur Select-Mode, kein Pinch, kein Drag, kein Pan
    if (String(this.state.modeId) === "select" && !P.pinchActive && !P.dragActive && !P.isPanning) {
      const last = P.active.get(ev.pointerId);
      const down = P.down.get(ev.pointerId);

      if (last && down) {
        const dx = last.x - down.x;
        const dy = last.y - down.y;
        const thr = 6 * (this._vp.dpr || 1);

        if (dx * dx + dy * dy <= thr * thr) {
          const world = this._screenCanvasToWorld(last);
          this._applySnapToWorldPoint(world);

          const hit = this._hitTestWorldPoint(world.wx, world.wy);
          if (hit) this._setSelectionToObject(hit, "tap");
          else this._setSelectionToPoint(world, "tap");
        }
      }
    }

    // Drag-End
    if (P.dragActive && P.dragObjId) {
      const o = this._findSceneObjectById(P.dragObjId);
      if (o) this._setSelectionToObject(o, "drag-end");
      P.dragActive = false;
      P.dragObjId = null;
    }

    // bookkeeping
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

    try { ev.preventDefault?.(); } catch {}

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
    return {
      id: "obj-1",
      type,
      data: { id: "obj-1", type, meta: { name: "Unknown" } }
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

  _makePanelTitle(text) {
    const t = document.createElement("div");
    t.textContent = String(text || "");
    t.style.fontWeight = "700";
    t.style.padding = "10px";
    t.style.borderBottom = "1px solid rgba(255,255,255,.06)";
    return t;
  }

  _makeGroupTitle(text) {
    const t = document.createElement("div");
    t.textContent = String(text || "");
    t.style.fontWeight = "700";
    t.style.padding = "10px 10px 6px 10px";
    t.style.opacity = ".9";
    return t;
  }

  _makePanelText(text) {
    const p = document.createElement("div");
    p.textContent = String(text || "");
    p.style.padding = "10px";
    p.style.opacity = ".8";
    p.style.fontSize = "12px";
    return p;
  }

  _makePropRow(label, value, type) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.padding = "8px 10px";
    row.style.borderTop = "1px solid rgba(255,255,255,.04)";
    row.style.fontSize = "12px";

    const l = document.createElement("div");
    l.textContent = String(label || "");
    l.style.width = "40%";
    l.style.opacity = ".85";

    const v = document.createElement("div");
    v.style.flex = "1 1 auto";
    v.style.opacity = ".95";

    if (value == null) {
      v.textContent = "—";
      v.style.opacity = ".5";
    } else if (type === "json") {
      v.textContent = JSON.stringify(value);
    } else if (typeof value === "object") {
      v.textContent = JSON.stringify(value);
    } else {
      v.textContent = String(value);
    }

    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  _makePre(text) {
    const pre = document.createElement("pre");
    pre.textContent = String(text || "");
    pre.style.margin = "10px";
    pre.style.padding = "10px";
    pre.style.borderRadius = "10px";
    pre.style.background = "rgba(0,0,0,.25)";
    pre.style.border = "1px solid rgba(255,255,255,.08)";
    pre.style.whiteSpace = "pre-wrap";
    pre.style.wordBreak = "break-word";
    pre.style.fontSize = "11px";
    pre.style.opacity = ".95";
    return pre;
  }

  _publishSelectionChanged(source = "unknown") {
    try {
      this.bus?.emit?.("cb:scene:selection:changed", {
        source,
        selection: this.state.selection,
        selectionPoint: this.state.selectionPoint
      });
    } catch {}
  }
}
