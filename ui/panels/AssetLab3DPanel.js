/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.1.0-assetlab-iframe-sticky-controls (2026-02-06)
 *
 * Ziel:
 * - AssetLab 3D als iframe einbetten
 * - PostMessage-Bridge (ready/init/log/lockScroll)
 * - iOS Fix: Host-Scroll während WebGL-Interaktion sperren (aber NIE "hängen bleiben")
 *
 * WICHTIGES UX-Fix (Smartphone):
 * - Die AssetLab-Buttons sollen NICHT verschwinden, wenn man im Host scrollt.
 * - Lösung: Eine STICKY Host-Controlbar (Import/Move/Rotate/Scale/Export/Reset/Draco),
 *   die immer sichtbar bleibt.
 *
 * Hinweis:
 * - Die Buttons im iframe bleiben weiterhin vorhanden (als Backup).
 * - Die Sticky-Bar schickt Befehle per postMessage an das iframe.
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
    return {
      showReset: false,
      showApply: false,
      note: "AssetLab läuft als iframe (Lite). Vendor bleibt extern, Backups bleiben klein."
    };
  }

  buildDraftFromStore() {
    const pid = this.store.get("app")?.project?.id || "unknown";
    return { projectId: pid };
  }

  // ---------------------------------------------------------------------------
  // iOS Scroll-Lock (Host-Seite)
  // ---------------------------------------------------------------------------
  // Problem: iOS Safari + iframe + WebGL kann "verkleben":
  // - Wenn der Host scrollt, während im Canvas getoucht wird, kann man nicht mehr sauber zurückscrollen.
  //
  // Lösung: Wir "nageln" den Host-Body kurz fest (position:fixed),
  // ABER: immer mit Restore + Failsafe (Timeout + unmount).
  //
  // WICHTIG: Lock wird nur auf Message "assetlab:lockScroll" gesetzt, also vom iframe gesteuert.
  _scrollLock = { locked: false, y: 0, tFail: null };

  _setHostScrollLock(lock) {
    lock = !!lock;
    if (lock === this._scrollLock.locked) return;
    this._scrollLock.locked = lock;

    // Failsafe-Timer: falls irgendwas hängen bleibt, lösen wir nach 2s automatisch.
    if (this._scrollLock.tFail) clearTimeout(this._scrollLock.tFail);
    this._scrollLock.tFail = setTimeout(() => {
      // Nur unlocken, wenn noch gelocked (niemals auto-lock!)
      if (this._scrollLock.locked) this._setHostScrollLock(false);
    }, 2000);

    const body = document.body;

    if (lock) {
      this._scrollLock.y = window.scrollY || 0;

      body.style.position = "fixed";
      body.style.top = `-${this._scrollLock.y}px`;
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

      window.scrollTo(0, this._scrollLock.y);
    }
  }

  // ---------------------------------------------------------------------------
  // Host -> iframe: Command Bridge (für sticky Controls)
  // ---------------------------------------------------------------------------
  _postToIframe(type, payload = {}) {
    if (!this._iframe?.contentWindow) return;
    this._iframe.contentWindow.postMessage({ type, payload }, window.location.origin);
  }

  renderBody(root, draft) {
    const projectId = draft?.projectId || "unknown";
    const iframeSrc = `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    // -----------------------------
    // 1) Host Topbar (Reload/Popout/Status)
    // -----------------------------
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

    // -----------------------------
    // 2) STICKY Controls (damit Buttons nie "weg" sind)
    // -----------------------------
    // -> Diese Leiste bleibt oben kleben, während du im Host scrollst.
    // -> Sie sendet Befehle an das iframe (assetlab:cmd).
    const sticky = h("div", {
      style: {
        position: "sticky",
        top: "8px",
        zIndex: 20,
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        alignItems: "center",
        padding: "8px",
        borderRadius: "12px",
        border: "1px solid rgba(0,0,0,.08)",
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(8px)"
      }
    });

    const mkBtn = (label, cmd, payload = {}) => h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => this._postToIframe("assetlab:cmd", { cmd, ...payload })
    }, label);

    // Import: triggert den Filepicker im iframe
    const bImport = mkBtn("Import (GLB/GLTF)", "import");

    // Transform modes
    const bMove   = mkBtn("Move",   "mode", { mode: "translate" });
    const bRotate = mkBtn("Rotate", "mode", { mode: "rotate" });
    const bScale  = mkBtn("Scale",  "mode", { mode: "scale" });

    // Export
    const bExportGLB  = mkBtn("Export GLB",  "export", { format: "glb" });
    const bExportGLTF = mkBtn("Export GLTF", "export", { format: "gltf" });

    // Draco Toggle (nur ein UI-Schalter → Wert geht per cmd:draco ins iframe)
    const dracoWrap = h("label", {
      style: {
        display: "inline-flex",
        gap: "8px",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: "10px",
        border: "1px solid rgba(0,0,0,.12)",
        background: "rgba(255,255,255,.75)"
      }
    });

    const draco = h("input", {
      type: "checkbox",
      onchange: () => this._postToIframe("assetlab:cmd", { cmd: "draco", enabled: !!draco.checked })
    });

    dracoWrap.appendChild(draco);
    dracoWrap.appendChild(h("span", { style: { fontSize: "12px", opacity: ".8" } }, "Draco (exp.)"));

    const bReset = mkBtn("Reset", "reset");

    sticky.appendChild(bImport);
    sticky.appendChild(bMove);
    sticky.appendChild(bRotate);
    sticky.appendChild(bScale);
    sticky.appendChild(bExportGLB);
    sticky.appendChild(bExportGLTF);
    sticky.appendChild(dracoWrap);
    sticky.appendChild(bReset);

    // -----------------------------
    // 3) Iframe Container (GROß lassen!)
    // -----------------------------
    // Wichtig: nicht klein machen. Wir geben dem iframe auf Phone/Tablet viel Platz:
    // - mit clamp: min 520px, ideal 78vh, max 900px
    const iframeWrap = h("div", {
      style: {
        border: "1px solid rgba(0,0,0,.08)",
        borderRadius: "12px",
        overflow: "hidden",
        height: "clamp(520px, 78vh, 900px)",
        minHeight: "520px"
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

    // -----------------------------
    // 4) postMessage Bridge
    // -----------------------------
    const onMsg = (ev) => {
      if (!ev || !ev.data) return;
      if (ev.source !== iframe.contentWindow) return; // nur eigenes iframe akzeptieren

      const { type, payload } = ev.data || {};

      if (type === "assetlab:ready") {
        status.textContent = "ready";
        // init senden
        this._postToIframe("assetlab:init", { projectId });
        return;
      }

      if (type === "assetlab:log") {
        const msg = payload?.msg || "";
        if (msg) status.textContent = msg;
        return;
      }

      // iOS: Host Scroll sperren/entsperren
      if (type === "assetlab:lockScroll") {
        this._setHostScrollLock(!!payload?.lock);
        return;
      }
    };

    window.addEventListener("message", onMsg);
    this._onMsg = onMsg;

    // -----------------------------
    // Mount DOM
    // -----------------------------
    root.appendChild(bar);
    root.appendChild(sticky);
    root.appendChild(iframeWrap);

    root.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: Sticky-Leiste bleibt sichtbar (Smartphone-Fix). Popout bleibt für Vollbild-Workflow."
      )
    );
  }

  unmount() {
    // Aufräumen: Message Listener entfernen
    if (this._onMsg) window.removeEventListener("message", this._onMsg);
    this._onMsg = null;

    // Failsafe: falls Host gerade gelocked wäre → sofort unlocken
    try { this._setHostScrollLock(false); } catch {}

    // Timer kill
    if (this._scrollLock?.tFail) clearTimeout(this._scrollLock.tFail);

    this._iframe = null;
    super.unmount();
  }
}
