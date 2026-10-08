/**
 * Workarea layout-diagnostics domain methods.
 *
 * BP-RF-02 is a structural extraction only. The methods below retain the
 * existing Workarea state and UI authorities; this module introduces no
 * store, service or parallel data model.
 */
class WorkareaLayoutDiagnosticsModule {
  /* ===========================================================================
   * Workarea Layout Diagnostics v1
   * ===========================================================================
   * Dieser Block ist absichtlich passiv. Er baut das Mobile-Layout noch nicht um,
   * sondern liefert belastbare Messwerte für iPhone / iPad Hochkant / iPad Quer / Desktop.
   */

  _wireLayoutDiagnostics() {
    if (this._onWindowResizeForLayoutDiag) return;

    this._onWindowResizeForLayoutDiag = () => {
      try {
        if (this._layoutDiag?.timer) clearTimeout(this._layoutDiag.timer);

        if (this._layoutDiag) {
          this._layoutDiag.timer = setTimeout(() => {
            if (this._layoutDiag) this._layoutDiag.timer = 0;

            // PATCH_workarea_mobile_resize_guard_v3:
            // LayoutDiag darf nicht mehr direkt den Canvas resizen.
            // Erst Diagnose aktualisieren, dann Resize nur über den Guard anfragen.
            this._refreshWorkareaLayoutDiagnostics("window-resize", { renderTopbar: true });
            this._requestViewportCanvasResize("window-resize");
          }, 180);
        }
      } catch {}
    };

    try {
      window.addEventListener("resize", this._onWindowResizeForLayoutDiag, { passive: true });
      window.addEventListener("orientationchange", this._onWindowResizeForLayoutDiag, { passive: true });
    } catch {}
  }

  _detectWorkareaLayoutMode() {
    const iw = Math.max(0, Math.floor(window?.innerWidth || 0));
    const ih = Math.max(0, Math.floor(window?.innerHeight || 0));
    const sw = Math.min(iw, ih);
    const lw = Math.max(iw, ih);
    const dpr = Number(window?.devicePixelRatio || 1) || 1;
    const ua = String(navigator?.userAgent || "");
    const platform = String(navigator?.platform || "");
    const touch = Number(navigator?.maxTouchPoints || 0) || 0;
    const portrait = ih >= iw;

    // iPadOS kann sich als Macintosh melden. TouchPoints helfen als Signal.
    const looksLikeIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1);
    const looksLikePhone = /iPhone|Android.*Mobile/i.test(ua);

    let mode = "desktop";
    let reason = "width>=1024 oder Desktop-Fallback";

    // Harte Phone-Zone: echte schmale iPhone-/Smartphone-Ansicht.
    if (iw < 700 || (looksLikePhone && sw < 700)) {
      mode = "mobile";
      reason = "innerWidth<700 oder Phone-UA";
    }
    // Tablet kompakt: iPad hochkant / kleine Tablets.
    else if (iw < 1024 || (looksLikeIpad && portrait && iw < 1100)) {
      mode = "tablet";
      reason = "Tablet-/Portrait-Zone: >=700 und <1024/1100";
    }
    // Tablet quer / Desktop: bewusst Desktop-artig lassen.
    else {
      mode = "desktop";
      reason = looksLikeIpad ? "iPad quer/Desktop-Breite" : "Desktop-Breite";
    }

    return {
      mode,
      reason,
      innerWidth: iw,
      innerHeight: ih,
      shortEdge: sw,
      longEdge: lw,
      dpr,
      orientation: portrait ? "portrait" : "landscape",
      touchPoints: touch,
      looksLikeIpad,
      looksLikePhone,
      userAgent: ua,
      platform
    };
  }

  _rectFor(el) {
    try {
      if (!el || typeof el.getBoundingClientRect !== "function") return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        display: String(el.style?.display || getComputedStyle(el).display || ""),
        flex: String(el.style?.flex || "")
      };
    } catch {
      return null;
    }
  }

  _getWorkareaLayoutDebug() {
    const app = this.store?.get?.("app") || {};
    const ws = app?.settings?.workspace || null;
    const uiw = app?.settings?.ui?.workarea || null;
    const vp = this._detectWorkareaLayoutMode();

    const leftDockRect = this._rectFor(this._els.leftDock);
    const rightDockRect = this._rectFor(this._els.rightDock);
    const hostRect = this._rectFor(this._vp.host);
    const canvasRect = this._rectFor(this._vp.canvas);
    const shellRect = this._rectFor(this._els.shell);

    return {
      schema: "baustellenplaner.workarea.layoutDebug.v1",
      createdAt: new Date().toISOString(),
      viewport: vp,
      project: {
        id: app?.project?.id || app?.activeProjectId || null,
        name: app?.project?.name || ""
      },
      state: {
        modeId: this.state.modeId,
        leftTabId: this.state.leftTabId,
        rightTabId: this.state.rightTabId,
        leftDockCollapsed: !!this.state.leftDockCollapsed,
        rightDockCollapsed: !!this.state.rightDockCollapsed,
        bottomCollapsed: !!this.state.bottomCollapsed,
        fullscreen: !!this.state.fullscreen,
        consoleOpen: !!this.state.consoleOpen,
        placeCtx: { ...(this.state.placeCtx || {}) }
      },
      settings: {
        workspaceDocks: ws?.docks || null,
        workareaUi: uiw ? {
          modeId: uiw.modeId || null,
          leftTabId: uiw.leftTabId || null,
          rightTabId: uiw.rightTabId || null,
          dockState: uiw.dockState || null,
          placeCtx: uiw.placeCtx || null,
          updatedAt: uiw.updatedAt || null,
          lastReason: uiw.lastReason || null
        } : null
      },
      cfg: this._cfg || null,
      rects: {
        root: this._rectFor(this.rootEl),
        header: this._rectFor(this._els.header),
        shell: shellRect,
        topbar: this._rectFor(this._els.topbar),
        leftDock: leftDockRect,
        center: this._rectFor(this._els.center),
        rightDock: rightDockRect,
        bottom: this._rectFor(this._els.bottom),
        viewportHost: hostRect,
        canvas: canvasRect
      },
      canvasInternal: {
        cssWidth: this._vp.w || 0,
        cssHeight: this._vp.h || 0,
        dpr: this._vp.dpr || 1,
        bitmapWidth: this._vp.canvas?.width || 0,
        bitmapHeight: this._vp.canvas?.height || 0,
        zoom: this._vp.zoom || 1,
        offsetX: this._vp.offsetX || 0,
        offsetY: this._vp.offsetY || 0
      },
      scene: {
        objects: Array.isArray(this._scene?.objects) ? this._scene.objects.length : 0,
        selectedType: this.state?.selection?.type || null
      },
      flags: {
        leftVisibleButCollapsed: !!(this.state.leftDockCollapsed && leftDockRect && leftDockRect.display !== "none" && leftDockRect.width > 0),
        rightVisibleButCollapsed: !!(this.state.rightDockCollapsed && rightDockRect && rightDockRect.display !== "none" && rightDockRect.width > 0),
        canvasTooNarrow: !!(hostRect && hostRect.width < 260),
        canvasOffRight: !!(hostRect && vp.innerWidth && hostRect.right > vp.innerWidth + 4),
        shellOverflowRight: !!(shellRect && vp.innerWidth && shellRect.right > vp.innerWidth + 4)
      }
    };
  }

  _layoutDebugSig(dbg) {
    try {
      const v = dbg?.viewport || {};
      const r = dbg?.rects || {};
      const c = r.viewportHost || {};
      return [
        v.mode,
        v.innerWidth,
        v.innerHeight,
        v.orientation,
        this.state.leftDockCollapsed ? 1 : 0,
        this.state.rightDockCollapsed ? 1 : 0,
        Math.round(c.width || 0),
        Math.round(c.height || 0),
        dbg?.flags?.canvasOffRight ? 1 : 0
      ].join("|");
    } catch {
      return "";
    }
  }

  _refreshWorkareaLayoutDiagnostics(reason = "diag", opts = {}) {
    try {
      const dbg = this._getWorkareaLayoutDebug();
      const sig = this._layoutDebugSig(dbg);
      const changed = sig !== this._layoutDiag?.lastSig;

      if (this._layoutDiag) {
        this._layoutDiag.lastMode = dbg?.viewport?.mode || "unknown";
        this._layoutDiag.lastSig = sig;
        this._layoutDiag.lastSnapshot = dbg;
      }

      if (this._els.layoutDiagBadge) {
        this._els.layoutDiagBadge.textContent = `Layout: ${dbg?.viewport?.mode || "?"}`;
        this._els.layoutDiagBadge.title = `${dbg?.viewport?.reason || ""}
${dbg?.viewport?.innerWidth}×${dbg?.viewport?.innerHeight} DPR ${dbg?.viewport?.dpr}`;
      }

      // Console Drawer bekommt eine kurze, gut kopierbare Zusammenfassung.
      if (this._els.consoleDrawer) {
        const f = dbg?.flags || {};
        this._els.consoleDrawer.textContent =
          `LayoutDiag ${dbg.viewport.mode} ${dbg.viewport.innerWidth}×${dbg.viewport.innerHeight} DPR ${dbg.viewport.dpr}
` +
          `orientation=${dbg.viewport.orientation} touch=${dbg.viewport.touchPoints} reason=${dbg.viewport.reason}
` +
          `canvas=${dbg.canvasInternal.cssWidth}×${dbg.canvasInternal.cssHeight} zoom=${Number(dbg.canvasInternal.zoom || 1).toFixed(2)}
` +
          `docks L=${dbg.state.leftDockCollapsed ? "collapsed" : "open"} R=${dbg.state.rightDockCollapsed ? "collapsed" : "open"} B=${dbg.state.bottomCollapsed ? "collapsed" : "open"}
` +
          `flags canvasTooNarrow=${!!f.canvasTooNarrow} canvasOffRight=${!!f.canvasOffRight} shellOverflowRight=${!!f.shellOverflowRight}`;
      }

      if (opts?.status) {
        const f = dbg?.flags || {};
        this._setStatus(
          `📐 Layout ${dbg.viewport.mode} ${dbg.viewport.innerWidth}×${dbg.viewport.innerHeight} · ` +
          `Canvas ${dbg.canvasInternal.cssWidth}×${dbg.canvasInternal.cssHeight}` +
          (f.canvasOffRight ? " · ⚠️ Canvas rechts abgeschnitten" : "")
        );
      }

      if (opts?.renderTopbar && changed && this._mounted) {
        const oldMode = this._layoutDiag?.lastRenderedMode || "";
        const nextMode = dbg?.viewport?.mode || "";
        if (oldMode !== nextMode) {
          this._layoutDiag.lastRenderedMode = nextMode;
          this._renderTopbar();
          this._renderBottomBar();
        }
      }

      return dbg;
    } catch (e) {
      console.warn("[workarea] layout diagnostics failed", e);
      return null;
    }
  }

  async _copyWorkareaLayoutDebug() {
    try {
      const dbg = this._refreshWorkareaLayoutDiagnostics("copy", { status: false, renderTopbar: false }) || this._getWorkareaLayoutDebug();
      const ok = await this._copyToClipboard(JSON.stringify(dbg, null, 2));
      this._setStatus(ok ? "✅ Workarea Layout JSON kopiert" : "⚠️ Layout JSON konnte nicht kopiert werden");
      return ok;
    } catch (e) {
      this._setStatus(`⚠️ Layout JSON Fehler: ${String(e?.message || e)}`);
      return false;
    }
  }

}

export function installWorkareaLayoutDiagnosticsModule(WorkareaPanelClass) {
  const descriptors = Object.getOwnPropertyDescriptors(WorkareaLayoutDiagnosticsModule.prototype);
  delete descriptors.constructor;
  Object.defineProperties(WorkareaPanelClass.prototype, descriptors);
}
