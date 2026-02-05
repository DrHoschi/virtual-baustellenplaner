/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.0.0-assetlab-iframe (2026-02-05)
 *
 * Assets → AssetLab 3D (iframe)
 * - minimaler Host
 * - postMessage Bridge (ready/init/log)
 */
import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

export class AssetLab3DPanel extends PanelBase {
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
      note: "AssetLab läuft als iframe. (Three.js Editor Vendor wird später ergänzt.)"
    };
  }

  buildDraftFromStore() {
    // Kein klassisches Draft-Formular nötig, aber wir halten Metas für später bereit
    const pid = this.store.get("app")?.project?.id || "unknown";
    return { projectId: pid };
  }

  renderBody(root, draft) {
    const projectId = draft?.projectId || "unknown";
    const iframeSrc = `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

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

    const status = h("span", { style: { opacity: ".75", fontSize: "12px", marginLeft: "auto" } }, "");

    bar.appendChild(btnReload);
    bar.appendChild(btnPopout);
    bar.appendChild(status);

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
    // optional: sandbox – nur wenn du es wirklich willst (same-origin + downloads erlaubt)
    // iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads");

    this._iframe = iframe;
    iframeWrap.appendChild(iframe);

    // --- postMessage Bridge (minimal) ---
    const onMsg = (ev) => {
      // same-origin check (bei local hosting ist origin gleich)
      if (!ev || !ev.data) return;
      const { type, payload } = ev.data || {};
      if (type === "assetlab:ready") {
        status.textContent = "🟢 AssetLab bereit";
        // init senden
        iframe.contentWindow?.postMessage({
          type: "assetlab:init",
          payload: { projectId }
        }, window.location.origin);
      }
      if (type === "assetlab:log") {
        const msg = payload?.msg || "";
        status.textContent = msg ? `ℹ️ ${msg}` : status.textContent;
      }
      // später:
      // if (type === "assetlab:saveAsset") { ... speichern ... }
      // if (type === "assetlab:updateScene") { ... scene.json / store ... }
    };

    window.addEventListener("message", onMsg);
    this._onMsg = onMsg;

    root.appendChild(bar);
    root.appendChild(iframeWrap);

    root.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: In Phase 1 nutzen wir den iframe-Editor. In Phase 3 machen wir Export/Import sauber (JSON + Assets)."
      )
    );
  }

  unmount() {
    if (this._onMsg) window.removeEventListener("message", this._onMsg);
    this._onMsg = null;
    this._iframe = null;
    super.unmount();
  }
}
