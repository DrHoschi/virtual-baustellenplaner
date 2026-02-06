/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.0.1-assetlab-iframe-clean (2026-02-06)
 *
 * Assets → AssetLab 3D (iframe Host)
 * =============================================================================
 * Ziel:
 *  - Sehr schlanker Host-Wrapper für das AssetLab-iframe.
 *  - Kein klassisches Formular (PanelBase Draft) nötig.
 *  - Minimaler postMessage-Handshake:
 *      iframe → host: assetlab:ready  (Signal "ich bin da")
 *      host   → iframe: assetlab:init (Projekt-ID)
 *      iframe → host: assetlab:log    (Status/Debug)
 *
 * WICHTIG (CLEAN STAND):
 *  - Dieses File enthält ABSICHTLICH KEINE Scroll-Locks / iOS-Embed-Fixes.
 *    (Das war das "hin und her".)
 *
 * Pfad:
 *  - iframe entry: modules/assetlab3d/iframe/index.html
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

export class AssetLab3DPanel extends PanelBase {

  // ---------------------------------------------------------------------------
  // Panel Meta
  // ---------------------------------------------------------------------------

  getTitle() { return "Assets – AssetLab 3D"; }

  getDescription() {
    const pid = this.store.get("app")?.project?.id || "";
    return pid ? `Projekt-ID: ${pid}` : "";
  }

  getToolbarConfig() {
    // PanelBase-Toolbar (Apply/Reset) hier nicht nötig
    return {
      showReset: false,
      showApply: false,
      note: "AssetLab läuft als iframe (Lite). Vendor bleibt extern; Backup kann vendor auslassen."
    };
  }

  // ---------------------------------------------------------------------------
  // Draft (wir brauchen nur projectId, keine Form)
  // ---------------------------------------------------------------------------

  buildDraftFromStore() {
    const pid = this.store.get("app")?.project?.id || "unknown";
    return { projectId: pid };
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  renderBody(root, draft) {
    const projectId = draft?.projectId || "unknown";

    // iframe-URL (same-origin)
    const iframeSrc = `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    // --- Top-Bar im Panel (Reload + Popout + Status) ---
    const bar = h("div", {
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
        if (this._iframe) this._iframe.src = this._iframe.src; // simple reload
      }
    }, "↻ Reload");

    const btnPopout = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => window.open(iframeSrc, "_blank")
    }, "↗︎ In neuem Tab");

    const status = h("span", {
      style: { opacity: ".75", fontSize: "12px", marginLeft: "auto" }
    }, "…");

    bar.appendChild(btnReload);
    bar.appendChild(btnPopout);
    bar.appendChild(status);

    // --- Iframe Wrapper ---
    // Höhe bleibt bewusst "groß", damit du möglichst viel Canvas siehst.
    // (Die globale "mobile compact" Optimierung passiert über CSS, nicht hier.)
    const iframeWrap = h("div", {
      style: {
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "10px",
        overflow: "hidden",
        height: "calc(100vh - 280px)",
        minHeight: "420px"
      }
    });

    const iframe = document.createElement("iframe");
    iframe.src = iframeSrc;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.allow = "fullscreen";

    // OPTIONAL: sandbox — nur aktivieren, wenn du es wirklich brauchst/willst.
    // Downloads aus dem iframe können bei strenger Sandbox blockiert werden.
    // iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads");

    this._iframe = iframe;
    iframeWrap.appendChild(iframe);

    // --- postMessage Bridge (minimal) ---
    const onMsg = (ev) => {
      if (!ev || !ev.data) return;
      if (ev.source !== iframe.contentWindow) return; // nur eigenes iframe

      const { type, payload } = ev.data || {};

      if (type === "assetlab:ready") {
        status.textContent = "ready";
        // init zurück in das iframe schicken
        iframe.contentWindow?.postMessage({
          type: "assetlab:init",
          payload: { projectId }
        }, window.location.origin);
        return;
      }

      if (type === "assetlab:log") {
        const msg = payload?.msg || "";
        if (msg) status.textContent = msg;
        return;
      }

      // (später)
      // if (type === "assetlab:saveAsset") { ... }
      // if (type === "assetlab:updateScene") { ... }
    };

    window.addEventListener("message", onMsg);
    this._onMsg = onMsg;

    root.appendChild(bar);
    root.appendChild(iframeWrap);

    // Kleine Hilfe-Notiz
    root.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: Lite-Viewer im iframe. Export/Import (GLB/GLTF) erfolgt im iframe."
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  unmount() {
    if (this._onMsg) window.removeEventListener("message", this._onMsg);
    this._onMsg = null;
    this._iframe = null;
    super.unmount();
  }
}
