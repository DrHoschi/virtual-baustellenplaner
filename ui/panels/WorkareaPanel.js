/**
 * ui/panels/WorkareaPanel.js
 * Version: v1.1.7-workarea-step5A-assets-from-store + workspace-live-apply (2026-02-26)
 *
 * Ziel:
 * - Cybermotion-Style Arbeitsbereich als datengetriebene Shell
 * - Viewport Step 4: Canvas + ResizeObserver + RenderLoop + Pan/Zoom/Grid + Selection + Hit-Test + Objekt-Drag (Dummy Scene)
 *
 * Step 5A (read-only, 0 Risiko):
 * - Assets Tab liest echte ProjectAssets aus dem Store (app.project.projectAssets)
 * - Click auf Asset -> setzt Selection (type:"projectAsset"), Properties rechts sichtbar
 *
 * Fix / Wichtig (dein aktuelles Problem):
 * - WorkspaceSettings sollen LIVE wirken, OHNE dass wir sofort in app.settings.workspace persistieren müssen.
 * - Daher:
 *   - Workarea akzeptiert cb:settings:workspace:changed { workspace } und baut cfg DIREKT aus msg.workspace
 *   - applyDocks:true übernimmt Dock-Defaults EINMALIG (ideal: Smartphone "Docks ausblenden")
 *   - applyDocks:false beeinflusst nur Grid/Snap/Background/DPR/ZoomLimits etc.
 *
 * Hinweis:
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
        panPointerId: null,

        // Objekt-Drag State (Select-Mode)
        dragObjId: null,
        dragActive: false,
        dragOffset: { x: 0, y: 0 },

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

      selectionPoint: null,
      selection: this._makeDummySelection("project")
    };

    // Bus subscriptions
    this._unsubs = [];

    // Workarea Settings Cache (initial aus Store, live ggf. überschrieben per Event)
    this._cfg = this._getWorkspaceCfgFromStore();

    // Dummy Scene Objects (Step 4)
    this._scene = {
      objects: [
        { id: "obj-1", type: "conveyor.segment", name: "Rollenbahn A", x: -300, y: -120, r: 24 },
        { id: "obj-2", type: "asset.glb", name: "Motor", x: 180, y: 90, r: 20 },
        { id: "obj-3", type: "hall.procedural", name: "Halle Ecke", x: 420, y: -260, r: 28 }
      ]
    };

    // v1.1.4: Docks NICHT automatisch vom Store steuern (manuelles Toggle bleibt stabil)
    this._respectManualDocks = true;

    // Best-Effort Activate Request
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

    // Shell
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

    // Optional: Wenn ProjectAssets existieren, starte direkt im Assets Tab
    try {
      const n = this._getProjectAssetsFromStore().length;
      if (n > 0) this.state.leftTabId = "tab.assets";
    } catch {}

    // UI
    this._renderTopbar();
    this._renderLeftTabs();
    this._renderRightTabs();
    this._renderLeftPanel();
    this._renderRightPanel();
    this._renderBottomBar();

    // Settings initial anwenden (nur „cfg“, Docks NICHT automatisch drücken)
    this._applyWorkspaceSettingsFromStore("init");
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
   * Best-Effort Activate Request
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

    // Debug: Assets Count sichtbar (hilft bei „Step 5A ist nicht drin“)
    let assetsCount = 0;
    try {
      assetsCount = this._getProjectAssetsFromStore().length;
    } catch {}
    topbar.appendChild(this._pill(`Assets: ${assetsCount}`, "rgba(255,255,255,.06)"));

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
  }

  _renderLeftTabs() {
    const tabs = this._layoutTabs("leftDock") || [
      { id: "tab.library", title: "Library" },
      { id: "tab.scene", title: "Scene" },
      { id: "tab.assets", title: "Assets" }
    ];

    // Sicherstellen, dass Assets Tab existiert, auch wenn layout.json Tabs vorgibt
    if (!tabs.some((t) => String(t?.id) === "tab.assets")) {
      tabs.push({ id: "tab.assets", title: "Assets" });
    }

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

      const hint = document.createElement("div");
      hint.style.marginTop = "10px";
      hint.style.opacity = ".75";
      hint.style.fontSize = "12px";
      hint.textContent = "Select-Mode: Tap=Select, Drag Objekt=Move, Drag leer=Pan. Pan-Mode: Drag=Pan.";
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
      // -------------------------------------------------------------------
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Assets</div>` +
        `<div style="opacity:.75;font-size:12px;margin-bottom:10px;">Echte ProjectAssets aus dem Store (Step 5A). Klick = Selection.</div>`;

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

          const left = document.createElement("div");
          left.style.display = "flex";
          left.style.flexDirection = "column";
          left.style.gap = "2px";
          left.style.minWidth = "0";

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

          const badge = this._pill(
            hasAnyModel ? "✔" : "—",
            hasAnyModel ? "rgba(0,255,128,.10)" : "rgba(255,255,255,.06)"
          );
          badge.style.borderColor = hasAnyModel ? "rgba(0,255,128,.25)" : "rgba(255,255,255,.10)";

          right.appendChild(badge);

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
      hint.textContent = "Hinweis: Step 5A liest nur aus dem Store und setzt Selection. Nächster Schritt (5B): Place-Mode → Instanz in Szene.";
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
    hint.textContent =
      "Dummy-Renderer: zeigt Gruppen/Felder aus properties.schemas.json. Viewport: Tap selektiert, Drag leer=Pan, Drag auf Objekt=Move.";
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
        v.textContent = val === undefined ? "-" : String(val);

        row.appendChild(l);
        row.appendChild(v);
        gEl.appendChild(row);
      }

      box.appendChild(gEl);
    }

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

    // Live Settings (Workspace → Workarea)
    // msg: { workspace, applyDocks?:boolean, source?:string }
    const off2 = this.bus.on("cb:settings:workspace:changed", (msg = {}) => {
      const workspace = msg?.workspace;
      if (!workspace) return;

      const applyDocks = !!msg?.applyDocks;
      const source = String(msg?.source || "bus");

      // ✅ Wichtig: cfg DIREKT aus msg.workspace bauen (ohne Store-Abhängigkeit)
      this._applyWorkspaceSettings(workspace, `bus:${source}`, { applyDocks });
    });

    // Store-Updates: Wenn ProjectAssets geändert werden und Assets-Tab offen ist → re-render
    const off3 = this.bus.on("cb:store:changed", (msg = {}) => {
      try {
        if (msg?.key !== "app") return;
        if (!this._mounted) return;
        if (this.state.leftTabId !== "tab.assets") return;
        this._renderLeftPanel();
        this._renderTopbar();
      } catch {}
    });

    this._unsubs.push(off1, off2, off3);
  }

  /* ==========================================================================
   * Workspace Settings → Workarea
   * ========================================================================= */

  _getWorkspaceCfgFromStore() {
    const app = this.store?.get?.("app") || {};
    const ws = app?.settings?.workspace || {};
    return this._getWorkspaceCfgFromObject(ws);
  }

  /**
   * Zentraler Normalizer:
   * - akzeptiert Workspace-Objekt aus Store ODER aus Live-Event (Draft)
   * - liefert interne cfg, die Viewport + UI verstehen
   */
  _getWorkspaceCfgFromObject(ws = {}) {
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

  _applyWorkspaceSettingsFromStore(reason = "store") {
    const app = this.store?.get?.("app") || {};
    const ws = app?.settings?.workspace;

    // Wenn nichts im Store: Default cfg
    if (!ws) {
      this._cfg = this._getWorkspaceCfgFromStore();
      this._applyCfgToUI(reason, { applyDocks: false });
      return;
    }

    // Store cfg anwenden
    this._applyWorkspaceSettings(ws, reason, { applyDocks: false });
  }

  /**
   * WICHTIG (Fix):
   * - workspace kommt jetzt wirklich rein (Store oder Draft via Event)
   * - wir ignorieren NICHT mehr das workspace-Objekt
   */
  _applyWorkspaceSettings(workspace, reason = "apply", opts = {}) {
    this._cfg = this._getWorkspaceCfgFromObject(workspace || {});
    this._applyCfgToUI(reason, opts);
  }

  _applyCfgToUI(reason = "cfg", opts = {}) {
    void reason;

    const applyDocks = !!opts?.applyDocks;

    // Docks übernehmen wir NUR:
    // - wenn applyDocks:true kommt (z.B. Settings „Docks ausblenden“)
    // - oder wenn _respectManualDocks explizit ausgeschaltet wäre (hier nicht)
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

    // Topbar aktualisieren, damit z.B. Grid/Snap/Zoom-Range sichtbar aktuell ist
    if (this._mounted) this._renderTopbar();

    if (applyDocks) {
      this._setStatus("✅ Docks aus Workspace-Settings live übernommen");
    }
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

  /* ==========================================================================
   * Step 5A: ProjectAssets aus Store + Selection
   * ========================================================================= */

  _getProjectAssetsFromStore() {
    const app = this.store?.get?.("app") || {};
    const project = app.project || {};
    const list = Array.isArray(project.projectAssets) ? project.projectAssets : [];
    return list;
  }

  _slotHasModel(slot) {
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

    // SelectionPoint im Viewport nicht anfassen
    this.state.selectionPoint = null;

    this.state.selection = {
      id: pa.id || "PA-unknown",
      type: "projectAsset",
      data: {
        id: pa.id,
        type: "projectAsset",
        meta: { name: pa.name || pa.id || "Asset" },
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

    // Dummy objects
    for (const o of this._scene?.objects || []) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = (2 * dpr) / zoom;
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(o.x, o.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Overlay Debug
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = `${Math.floor(12 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const lines = [
      `Viewport Step 4 (Pan/Zoom/Grid + HitTest + Drag)`,
      `Mode: ${this.state.modeId}`,
      `Grid: ${this._cfg?.gridEnabled ? "on" : "off"} (${this._cfg?.gridSize || 50})  Snap: ${this._cfg?.snapEnabled ? "on" : "off"}`,
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
   * Zoom helpers (nur für Slider/Buttons)
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
          project: { id: "P-2026-0001", name: "Demo Project", timezone: "Europe/Berlin" }
        }
      };
    }
    return { id: "obj-1", type, data: { id: "obj-1", type, meta: { name: "Unknown" } } };
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
