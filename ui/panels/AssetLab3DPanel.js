/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.1.0-assetlab-iframe-embed-final (2026-02-06)
 *
 * Assets → AssetLab 3D (iframe Host)
 * -----------------------------------------------------------------------------
 * Ziele:
 *  - iframe (AssetLab Lite) einbetten + Popout/Reload
 *  - postMessage Bridge:
 *      - assetlab:ready  -> Host sendet assetlab:init
 *      - assetlab:log    -> Statusanzeige
 *      - assetlab:lockScroll -> iOS Embed Fix (Scroll-Freeze vermeiden)
 *
 * iOS Problem:
 *  - iOS Safari + scrollender Container + iframe WebGL kann „kleben“:
 *    man kommt nicht mehr hoch zur Menüleiste.
 *
 * Lösung (wichtig):
 *  - Wir locken NICHT den <body>, sondern den Panel-Scrollcontainer
 *    (.panel-content-wrap) aus PanelBase.
 *  - Wir nutzen „freeze“ via overflow hidden + ScrollTop restore.
 *  - Failsafes: window pointerup/touchend -> unlock, plus Timer-Watchdog.
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

export class AssetLab3DPanel extends PanelBase {
  // ===========================================================================
  // 1) Panel-Metadaten
  // ===========================================================================
  getTitle() { return "Assets – AssetLab 3D"; }

  getDescription() {
    const pid = this.store.get("app")?.project?.id || "";
    return pid ? `Projekt-ID: ${pid}` : "";
  }

  getToolbarConfig() {
    // Kein Apply/Reset, weil wir hier nichts in den Store schreiben.
    return {
      showReset: false,
      showApply: false,
      note: "AssetLab läuft als iframe. Import/Export passiert im iframe (Lite)."
    };
  }

  buildDraftFromStore() {
    const pid = this.store.get("app")?.project?.id || "unknown";
    return { projectId: pid };
  }

  // ===========================================================================
  // 2) Render
  // ===========================================================================
  renderBody(root, draft) {
    const projectId = draft?.projectId || "unknown";
    const iframeSrc = `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    // -------------------------------------------------------------------------
    // 2.1) Kleine Inline-Styles: mehr Platz auf Smartphone + nicer Buttons
    // (Wir ändern keine globalen CSS-Dateien, nur panel-lokal.)
    // -------------------------------------------------------------------------
    const style = h("style", {}, `
      /* AssetLab Panel – mobile kompakter */
      @media (max-width: 520px) {
        .alhost-bar { margin: 0 0 8px !important; gap: 6px !important; }
        .alhost-bar .bp-btn { padding: 8px 10px !important; }
        .alhost-hint { display:none !important; }
      }
      .alhost-bar .bp-btn { white-space: nowrap; }
      .alhost-status { opacity:.78; font-size:12px; white-space:nowrap; }
    `);
    root.appendChild(style);

    // -------------------------------------------------------------------------
    // 2.2) Top-Bar (Reload / Popout / Status / Quick-Top)
    // -------------------------------------------------------------------------
    const bar = h("div", {
      className: "alhost-bar",
      style: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        margin: "0 0 10px"
      }
    });

    const status = h("span", { className: "alhost-status", style: { marginLeft: "auto" } }, "");

    const btnReload = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => {
        if (this._iframe) this._iframe.src = this._iframe.src; // simple reload
      }
    }, "↻ Reload");

    const btnPopout = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => window.open(iframeSrc, "_blank")
    }, "↗︎ In neuem Tab");

    // Quick-Top: wenn man unten hängt, kommt man IMMER wieder hoch zu den Buttons.
    // (Das ist dein Smartphone-Problem in der Praxis.)
    const btnTop = h("button", {
      className: "bp-btn",
      type: "button",
      title: "Zum Panel-Anfang",
      onclick: () => {
        const wrap = this._getPanelScrollWrap();
        if (wrap) wrap.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, "⬆︎ Top");

    bar.appendChild(btnReload);
    bar.appendChild(btnPopout);
    bar.appendChild(btnTop);
    bar.appendChild(status);

    // -------------------------------------------------------------------------
    // 2.3) iframe Wrapper – mehr Höhe (wichtig für Smartphone)
    // -------------------------------------------------------------------------
    const iframeWrap = h("div", {
      style: {
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "10px",
        overflow: "hidden",

        // Mehr sichtbarer Viewport: clamp(min, preferred(vh), max)
        height: "clamp(420px, 65vh, 980px)",
        minHeight: "420px"
      }
    });

    const iframe = document.createElement("iframe");
    iframe.src = iframeSrc;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.allow = "fullscreen";

    this._iframe = iframe;
    iframeWrap.appendChild(iframe);

    // -------------------------------------------------------------------------
    // 2.4) postMessage Bridge + iOS ScrollLock Handling
    // -------------------------------------------------------------------------

    // ScrollLock State (wir locken den PANEL-SCROLLER, nicht den Body)
    this._scrollLock = this._scrollLock || {
      locked: false,
      scrollTop: 0,
      prevOverflow: "",
      watchdog: null
    };

    const lockPanelScroll = (lock) => {
      lock = !!lock;
      if (lock === this._scrollLock.locked) return;

      const wrap = this._getPanelScrollWrap();
      if (!wrap) return;

      this._scrollLock.locked = lock;

      // Watchdog: falls unlock verloren geht, nach kurzer Zeit automatisch lösen
      this._kickWatchdog();

      if (lock) {
        this._scrollLock.scrollTop = wrap.scrollTop;
        this._scrollLock.prevOverflow = wrap.style.overflow || "";

        // Sperren
        wrap.style.overflow = "hidden";
      } else {
        // Entsperren
        wrap.style.overflow = this._scrollLock.prevOverflow || "";
        wrap.scrollTop = this._scrollLock.scrollTop || 0;

        this._clearWatchdog();
      }
    };

    const onMsg = (ev) => {
      if (!ev || !ev.data) return;

      // Nur Nachrichten vom eigenen iframe akzeptieren
      if (ev.source !== iframe.contentWindow) return;

      const { type, payload } = ev.data || {};

      if (type === "assetlab:ready") {
        status.textContent = "🟢 ready";
        // init senden
        iframe.contentWindow?.postMessage(
          { type: "assetlab:init", payload: { projectId } },
          window.location.origin
        );
        return;
      }

      if (type === "assetlab:log") {
        const msg = payload?.msg || "";
        if (msg) status.textContent = `ℹ️ ${msg}`;
        return;
      }

      if (type === "assetlab:lockScroll") {
        lockPanelScroll(!!payload?.lock);
        return;
      }
    };

    window.addEventListener("message", onMsg);
    this._onMsg = onMsg;

    // Extra Failsafe: egal was passiert → wenn User Finger hebt, unlock.
    // (hilft genau gegen „ich komm nicht mehr hochscrollen“)
    this._onGlobalUp = () => lockPanelScroll(false);
    window.addEventListener("pointerup", this._onGlobalUp, { passive: true });
    window.addEventListener("touchend", this._onGlobalUp, { passive: true });
    window.addEventListener("touchcancel", this._onGlobalUp, { passive: true });

    // -------------------------------------------------------------------------
    // 2.5) Append
    // -------------------------------------------------------------------------
    root.appendChild(bar);
    root.appendChild(iframeWrap);

    root.appendChild(
      h("div", { className: "alhost-hint", style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Tipp: Auf Smartphone: „⬆︎ Top“ bringt dich immer zurück zur Leiste, falls du weit runter bist."
      )
    );
  }

  // ===========================================================================
  // 3) Helpers (Panel-Scroller finden + Watchdog)
  // ===========================================================================
  _getPanelScrollWrap() {
    // PanelBase baut: rootEl -> ... -> .panel-content-wrap -> body
    // Wir sind im body, also suchen wir nach oben.
    if (!this.rootEl) return null;
    return this.rootEl.querySelector(".panel-content-wrap");
  }

  _kickWatchdog() {
    if (!this._scrollLock) return;

    // Jeder Lock/Unlock kickt den Watchdog – so bleibt es stabil.
    this._clearWatchdog();
    this._scrollLock.watchdog = setTimeout(() => {
      // Wenn irgendwas hängen blieb: entsperren
      try {
        const wrap = this._getPanelScrollWrap();
        if (!wrap) return;
        wrap.style.overflow = this._scrollLock.prevOverflow || "";
        this._scrollLock.locked = false;
      } catch (_) {}
    }, 1600);
  }

  _clearWatchdog() {
    if (this._scrollLock?.watchdog) {
      clearTimeout(this._scrollLock.watchdog);
      this._scrollLock.watchdog = null;
    }
  }

  // ===========================================================================
  // 4) Unmount (wichtig: Listener sauber entfernen)
  // ===========================================================================
  unmount() {
    if (this._onMsg) window.removeEventListener("message", this._onMsg);
    this._onMsg = null;

    if (this._onGlobalUp) {
      window.removeEventListener("pointerup", this._onGlobalUp);
      window.removeEventListener("touchend", this._onGlobalUp);
      window.removeEventListener("touchcancel", this._onGlobalUp);
    }
    this._onGlobalUp = null;

    // Im Zweifel immer entsperren
    try {
      const wrap = this._getPanelScrollWrap();
      if (wrap) wrap.style.overflow = this._scrollLock?.prevOverflow || "";
    } catch (_) {}

    this._clearWatchdog();

    this._iframe = null;
    super.unmount();
  }
}
