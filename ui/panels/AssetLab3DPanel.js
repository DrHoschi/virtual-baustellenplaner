/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.1.0-assetlab-iframe-compact-iosfix (2026-02-06)
 *
 * Assets → AssetLab 3D (iframe)
 *
 * Ziele:
 * - Iframe einbetten + Reload/Popout
 * - postMessage Bridge: ready/init/log + lockScroll
 * - iOS Fix: Host-Scroll während Interaktion im Canvas sperren (ohne "festzufrieren")
 * - Smartphone: Host-UI oben kompakter machen, damit mehr Viewport sichtbar ist
 *
 * Wichtig:
 * - Der Scroll-Lock wird NUR während Pointer/Touch-Interaktion im iframe gesetzt
 * - Wir sperren NICHT dauerhaft, sondern sauber mit restore (position:fixed Trick)
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

export class AssetLab3DPanel extends PanelBase {

  // ------------------------------------------------------------
  // Panel Metas
  // ------------------------------------------------------------
  getTitle() { return "Assets – AssetLab 3D"; }

  getDescription() {
    const pid = this.store.get("app")?.project?.id || "";
    return pid ? `Projekt-ID: ${pid}` : "";
  }

  getToolbarConfig() {
    return {
      showReset: false,
      showApply: false,
      note: "AssetLab läuft als iframe. (Lite: Import/Transform/Export)"
    };
  }

  buildDraftFromStore() {
    const pid = this.store.get("app")?.project?.id || "unknown";
    return { projectId: pid };
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  renderBody(root, draft) {
    const projectId = draft?.projectId || "unknown";
    const iframeSrc = `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    // ----------------------------------------------------------
    // (A) Smartphone Compact Mode (nur wenn Panel aktiv)
    // ----------------------------------------------------------
    // Idee: Auf kleinen Screens reduzieren wir nur für dieses Panel
    // Abstände/Überschriften. Das ist absichtlich "lokal" und
    // greift nicht dauerhaft, weil wir es in unmount wieder entfernen.
    this._installCompactModeCSS();

    // ----------------------------------------------------------
    // (B) iOS Host Scroll Lock (robust)
    // ----------------------------------------------------------
    // Wir "nageln" den Body fest (position:fixed) und merken ScrollY.
    // Beim unlock stellen wir den Scroll exakt wieder her.
    const _scrollLock = { locked: false, y: 0 };

    const setHostScrollLock = (lock) => {
      lock = !!lock;
      if (lock === _scrollLock.locked) return;
      _scrollLock.locked = lock;

      const body = document.body;

      if (lock) {
        _scrollLock.y = window.scrollY || 0;

        body.style.position = "fixed";
        body.style.top = `-${_scrollLock.y}px`;
        body.style.left = "0";
        body.style.right = "0";
        body.style.width = "100%";

        // hilft gegen iOS Rubberband + accidental scroll
        body.style.overflow = "hidden";
        body.style.touchAction = "none";
      } else {
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";
        body.style.overflow = "";
        body.style.touchAction = "";

        window.scrollTo(0, _scrollLock.y);
      }
    };

    // ----------------------------------------------------------
    // (C) Top-Bar (Reload / Popout / Status)
    // ----------------------------------------------------------
    const bar = h("div", {
      className: "assetlab-hostbar",
      style: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        margin: "0 0 10px"
      }
    });

    const btnReload = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => {
        if (this._iframe) this._iframe.src = this._iframe.src;
      }
    }, "↻ Reload");

    const btnPopout = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => window.open(iframeSrc, "_blank")
    }, "↗︎ In neuem Tab");

    const status = h("span", {
      style: { opacity: ".75", fontSize: "12px", marginLeft: "auto", whiteSpace: "nowrap" }
    }, "");

    bar.appendChild(btnReload);
    bar.appendChild(btnPopout);
    bar.appendChild(status);

    // ----------------------------------------------------------
    // (D) Iframe Wrap
    // ----------------------------------------------------------
    // Wichtig: minHeight für Desktop, aber auf Mobile soll es
    // möglichst viel Platz bekommen.
    const iframeWrap = h("div", {
      className: "assetlab-iframewrap",
      style: {
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "10px",
        overflow: "hidden",

        // Desktop/Tablet: gut sichtbar
        minHeight: "460px",

        // Mobile: nimmt möglichst viel Höhe, ohne dein Layout zu sprengen
        height: "min(72vh, 760px)"
      }
    });

    const iframe = document.createElement("iframe");
    iframe.src = iframeSrc;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.allow = "fullscreen";

    // iOS: hilft manchmal, dass Touches nicht “durchfallen”
    iframe.style.background = "transparent";

    this._iframe = iframe;
    iframeWrap.appendChild(iframe);

    // ----------------------------------------------------------
    // (E) postMessage Bridge (nur vom eigenen iframe akzeptieren!)
    // ----------------------------------------------------------
    const onMsg = (ev) => {
      if (!ev || !ev.data) return;

      // Nur Nachrichten vom eigenen iframe akzeptieren
      if (ev.source !== iframe.contentWindow) return;

      const { type, payload } = ev.data || {};

      if (type === "assetlab:ready") {
        status.textContent = "🟢 ready";
        iframe.contentWindow?.postMessage({
          type: "assetlab:init",
          payload: { projectId }
        }, window.location.origin);
        return;
      }

      if (type === "assetlab:log") {
        const msg = payload?.msg || "";
        if (msg) status.textContent = `ℹ️ ${msg}`;
        return;
      }

      // iOS: Scroll Lock steuern (kommt aus assetlab-lite.js)
      if (type === "assetlab:lockScroll") {
        setHostScrollLock(!!payload?.lock);
        return;
      }
    };

    window.addEventListener("message", onMsg);
    this._onMsg = onMsg;

    // ----------------------------------------------------------
    // (F) Render in Root
    // ----------------------------------------------------------
    root.appendChild(bar);
    root.appendChild(iframeWrap);

    root.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: Auf iPhone sperrt AssetLab beim Drag/Zoom kurz den Host-Scroll, damit das Canvas sauber bedienbar bleibt."
      )
    );
  }

  // ------------------------------------------------------------
  // Compact Mode CSS (nur für dieses Panel)
  // ------------------------------------------------------------
  _installCompactModeCSS() {
    // CSS wird einmal pro Mount gesetzt
    if (this._compactStyleEl) return;

    const style = document.createElement("style");
    style.setAttribute("data-assetlab-compact", "1");

    // Nur auf schmalen Screens: wir “komprimieren” in deinem Host
    // v.a. Überschriften, Abstände und Box-Padding.
    // Das trifft genau den von dir markierten Bereich: weniger Höhe, mehr Viewport.
    style.textContent = `
      @media (max-width: 520px) {
        /* Host-Panel spacing kompakter */
        .panel-content, .panel-body, .panel-inner { padding-top: 8px !important; }

        /* Überschrift im Panel kleiner + weniger Abstand */
        h1, h2, .panel-title { margin: 8px 0 !important; line-height: 1.05 !important; }
        .panel-desc { margin: 4px 0 8px !important; }

        /* "Store Snapshot" Block / Cards kompakter (falls vorhanden) */
        .card, .bp-card, .panel-card {
          padding: 10px !important;
          border-radius: 10px !important;
        }

        /* Unsere Hostbar noch kompakter */
        .assetlab-hostbar { margin: 0 0 8px !important; }
        .assetlab-iframewrap { height: min(76vh, 820px) !important; min-height: 420px !important; }
      }
    `;

    document.head.appendChild(style);
    this._compactStyleEl = style;
  }

  // ------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------
  unmount() {
    if (this._onMsg) window.removeEventListener("message", this._onMsg);
    this._onMsg = null;
    this._iframe = null;

    // Compact CSS wieder entfernen
    if (this._compactStyleEl) {
      this._compactStyleEl.remove();
      this._compactStyleEl = null;
    }

    super.unmount();
  }
}
