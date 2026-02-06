/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.0.1-assetlab-iframe-scrolllock (2026-02-06)
 *
 * Assets → AssetLab 3D (iframe)
 * ------------------------------------------------------------
 * Ziel:
 * - AssetLab Lite als iframe im Baustellenplaner anzeigen
 * - Minimaler Host + postMessage Bridge (ready/init/log)
 * - iOS Fix: Beim Interagieren im 3D-Viewport Host-Scroll sauber sperren
 *   (verhindert “Freeze / kein Scroll zurück / kein Orbit” in iOS Safari)
 *
 * Messages (iframe → host):
 * - assetlab:ready       { projectId }
 * - assetlab:log         { msg }
 * - assetlab:lockScroll  { lock: true|false, projectId }
 *
 * Messages (host → iframe):
 * - assetlab:init        { projectId }
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

export class AssetLab3DPanel extends PanelBase {
  // ---------------------------------------------------------------------------
  // PanelBase API
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
      note: "AssetLab läuft als iframe. (Three.js Editor Vendor wird später ergänzt.)"
    };
  }

  buildDraftFromStore() {
    // Kein klassisches Draft-Formular nötig, aber wir halten Metas für später bereit
    const pid = this.store.get("app")?.project?.id || "unknown";
    return { projectId: pid };
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  renderBody(root, draft) {
    const projectId = draft?.projectId || "unknown";

    // Hinweis: Pfad ist relativ zur App-Root, nicht zur Panel-Datei.
    // AssetLab läuft im iframe unter: modules/assetlab3d/iframe/index.html
    const iframeSrc =
      `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    // -------------------------------------------------------------------------
    // UI: obere Button-Leiste
    // -------------------------------------------------------------------------

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
    }, "");

    bar.appendChild(btnReload);
    bar.appendChild(btnPopout);
    bar.appendChild(status);

    // -------------------------------------------------------------------------
    // iOS Embed Fix: Scroll-Lock (sauber mit restore)
    //
    // Problem:
    // - iOS Safari + scrollender Host + interaktives Canvas im iframe
    //   → Touch/Pointer “verklebt” gerne (Freeze: kein Orbit + kein Scroll zurück)
    //
    // Lösung:
    // - Host-Scroll wird “festgenagelt”, solange der Nutzer im iframe interagiert.
    // - iframe sendet assetlab:lockScroll {lock:true|false}
    // -------------------------------------------------------------------------

    this._scrollLock = this._scrollLock || { locked: false, y: 0 };

    const setHostScrollLock = (lock) => {
      lock = !!lock;
      if (lock === this._scrollLock.locked) return;
      this._scrollLock.locked = lock;

      const body = document.body;

      if (lock) {
        // Aktuelle Scrollposition merken
        this._scrollLock.y = window.scrollY || 0;

        // Body “festnageln” (auf iOS zuverlässiger als nur overflow:hidden)
        body.style.position = "fixed";
        body.style.top = `-${this._scrollLock.y}px`;
        body.style.left = "0";
        body.style.right = "0";
        body.style.width = "100%";

        // Optional: verhindert Rubberband & Scroll-Gesten komplett
        body.style.overflow = "hidden";
        body.style.touchAction = "none";
      } else {
        // Styles zurücksetzen
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";
        body.style.overflow = "";
        body.style.touchAction = "";

        // Ursprüngliche Scrollposition wiederherstellen
        window.scrollTo(0, this._scrollLock.y || 0);
      }
    };

    // -------------------------------------------------------------------------
    // iframe Container
    // -------------------------------------------------------------------------

    const iframeWrap = h("div", {
      style: {
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "10px",
        overflow: "hidden",

        // Wichtig: Platz geben, damit das WebGL-Canvas sicher sichtbar ist
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

    // Optional: sandbox – nur wenn du es wirklich willst (same-origin + downloads erlaubt)
    // Achtung: Je nach Browser/Setup können Downloads aus iframes mit sandbox tricky sein.
    // iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads");

    this._iframe = iframe;
    iframeWrap.appendChild(iframe);

    // -------------------------------------------------------------------------
    // postMessage Bridge (minimal)
    // - Wichtig: nur Nachrichten vom EIGENEN iframe akzeptieren
    // - type: ready → init senden
    // - type: log → Status anzeigen
    // - type: lockScroll → Host-Scroll sperren/entsperren
    // -------------------------------------------------------------------------

    const onMsg = (ev) => {
      if (!ev || !ev.data) return;

      // Nur Nachrichten vom eigenen iframe akzeptieren (verhindert Fremd-Events)
      if (ev.source !== iframe.contentWindow) return;

      const { type, payload } = ev.data || {};

      if (type === "assetlab:ready") {
        status.textContent = "🟢 AssetLab bereit";

        // init an iframe senden
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
        setHostScrollLock(!!payload?.lock);
        return;
      }

      // später:
      // if (type === "assetlab:saveAsset") { ... speichern ... }
      // if (type === "assetlab:updateScene") { ... scene.json / store ... }
    };

    window.addEventListener("message", onMsg);
    this._onMsg = onMsg;

    // -------------------------------------------------------------------------
    // Mount UI
    // -------------------------------------------------------------------------

    root.appendChild(bar);
    root.appendChild(iframeWrap);

    root.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: In Phase 1 nutzen wir den iframe-Editor. In Phase 3 machen wir Export/Import sauber (JSON + Assets)."
      )
    );

    // -------------------------------------------------------------------------
    // Failsafe: Wenn Panel/Tab gewechselt wird, soll Scroll nie “fest” bleiben
    // -------------------------------------------------------------------------
    this._unlockScrollFailsafe = () => setHostScrollLock(false);
  }

  // ---------------------------------------------------------------------------
  // Unmount / Cleanup
  // ---------------------------------------------------------------------------

  unmount() {
    // Listener entfernen
    if (this._onMsg) window.removeEventListener("message", this._onMsg);
    this._onMsg = null;

    // Failsafe: Scroll sicher freigeben
    try {
      if (this._unlockScrollFailsafe) this._unlockScrollFailsafe();
    } catch (e) {
      // not critical
    }
    this._unlockScrollFailsafe = null;

    this._iframe = null;

    super.unmount();
  }
}
