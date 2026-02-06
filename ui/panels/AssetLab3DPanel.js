/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.1.0-final-scroll-mobile (2026-02-06)
 *
 * AssetLab 3D – Host Panel (iframe)
 * ------------------------------------------------------------
 * Aufgaben:
 * - iframe einbetten
 * - postMessage Bridge
 * - iOS Scroll-Lock NUR während echter 3D-Interaktion
 * - Mobile: Header kompakter, damit Scroll nie "verloren" geht
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

export class AssetLab3DPanel extends PanelBase {

  getTitle() {
    return "Assets – AssetLab 3D";
  }

  getDescription() {
    const pid = this.store.get("app")?.project?.id || "";
    return pid ? `Projekt-ID: ${pid}` : "";
  }

  getToolbarConfig() {
    return {
      showReset: false,
      showApply: false,
      note: "AssetLab läuft als eingebetteter 3D-Editor"
    };
  }

  buildDraftFromStore() {
    const pid = this.store.get("app")?.project?.id || "unknown";
    return { projectId: pid };
  }

  renderBody(root, draft) {
    const projectId = draft.projectId;
    const iframeSrc =
      `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    /* ------------------------------------------------------------
       Scroll-Lock (iOS-sicher, reversibel)
       ------------------------------------------------------------ */
    const scrollState = { locked: false, y: 0 };

    const setScrollLock = (lock) => {
      lock = !!lock;
      if (lock === scrollState.locked) return;
      scrollState.locked = lock;

      const body = document.body;

      if (lock) {
        scrollState.y = window.scrollY || 0;
        body.style.position = "fixed";
        body.style.top = `-${scrollState.y}px`;
        body.style.left = "0";
        body.style.right = "0";
        body.style.width = "100%";
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
        window.scrollTo(0, scrollState.y);
      }
    };

    /* ------------------------------------------------------------
       Toolbar (kompakt auf Mobile)
       ------------------------------------------------------------ */
    const bar = h("div", {
      className: "panel-toolbar",
      style: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "wrap"
      }
    });

    const btnReload = h("button", {
      className: "bp-btn",
      onclick: () => {
        if (this._iframe) this._iframe.src = this._iframe.src;
      }
    }, "↻ Reload");

    const btnPopout = h("button", {
      className: "bp-btn",
      onclick: () => window.open(iframeSrc, "_blank")
    }, "↗︎ In neuem Tab");

    const status = h("span", {
      className: "panel-toolbar-status",
      style: { marginLeft: "auto" }
    }, "…");

    bar.append(btnReload, btnPopout, status);

    /* ------------------------------------------------------------
       iframe Container
       ------------------------------------------------------------ */
    const iframeWrap = h("div", {
      style: {
        border: "1px solid rgba(0,0,0,.12)",
        borderRadius: "12px",
        overflow: "hidden",
        flex: "1 1 auto",
        minHeight: "320px"
      }
    });

    const iframe = document.createElement("iframe");
    iframe.src = iframeSrc;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";

    iframeWrap.appendChild(iframe);
    this._iframe = iframe;

    /* ------------------------------------------------------------
       postMessage Bridge
       ------------------------------------------------------------ */
    const onMsg = (ev) => {
      if (!ev?.data || ev.source !== iframe.contentWindow) return;

      const { type, payload } = ev.data;

      if (type === "assetlab:ready") {
        status.textContent = "🟢 bereit";
        iframe.contentWindow.postMessage(
          { type: "assetlab:init", payload: { projectId } },
          window.location.origin
        );
        return;
      }

      if (type === "assetlab:log") {
        if (payload?.msg) status.textContent = payload.msg;
        return;
      }

      if (type === "assetlab:lockScroll") {
        setScrollLock(!!payload?.lock);
      }
    };

    window.addEventListener("message", onMsg);
    this._onMsg = onMsg;

    /* ------------------------------------------------------------
       Render
       ------------------------------------------------------------ */
    root.append(bar, iframeWrap);
  }

  unmount() {
    if (this._onMsg) window.removeEventListener("message", this._onMsg);
    this._onMsg = null;
    this._iframe = null;
    super.unmount();
  }
}
