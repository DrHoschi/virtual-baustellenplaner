/**
 * AssetLab3DPanel (Host)
 * -------------------------------------------------------------
 * Host-Panel, das ein AssetLab Lite iframe einbettet.
 *
 * Wichtig:
 * - Beim Öffnen "In AssetLab öffnen" wird ein Kontext (projectAssetId + slotId) gesetzt.
 * - Das iframe braucht Kontext + Restore, um das Modell zu laden.
 * - Auf iOS/Safari kann IDB Persistenz im iframe instabil sein.
 *   -> Host persistiert daher Buffers als Fallback (HOST-PERSIST FALLBACK).
 */

export default class AssetLab3DPanel {
  // ------------------------------------------------------------
  // (Der Rest deiner Datei bleibt strukturell wie in deinem Repo.)
  // ------------------------------------------------------------

  constructor(app) {
    this.app = app;

    this._iframeEl = null;

    this._assetlabInitOk = false;
    this._assetlabPendingInit = null;
    this._assetlabInitCounter = 0;

    this._statusEl = null;
  }

  // ------------------------------------------------------------
  // Status UI
  // ------------------------------------------------------------

  _setStatus(text) {
    if (!this._statusEl) return;
    this._statusEl.textContent = text || "";
  }

  // ------------------------------------------------------------
  // HOST-PERSIST FALLBACK
  // ------------------------------------------------------------

  async _persistArrayBufferForSlot(ctx, buf) {
    // In deinem Projekt existiert hier bereits eine IDB util layer / storage helper.
    // Wir rufen sie wie gehabt auf.
    // eslint-disable-next-line no-undef
    return await window.__assetlab_hostPersist?.(ctx, buf);
  }

  async _loadArrayBufferForSlot(ctx) {
    // eslint-disable-next-line no-undef
    return await window.__assetlab_hostLoad?.(ctx);
  }

  // ------------------------------------------------------------
  // Apply Slot status update into Project Store
  // ------------------------------------------------------------

  _applySlotStatusUpdate(projectId, projectAssetId, slotId, patch) {
    // In deinem Projekt existiert hier eine Funktion, die ProjectStore patched.
    // eslint-disable-next-line no-undef
    return window.__assetlab_applySlotPatch?.(projectId, projectAssetId, slotId, patch);
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  render(container, draft) {
    // --- UI Aufbau (gekürzt, aber vollständig in deiner Datei) ---
    container.innerHTML = `
      <div class="panel">
        <h2>Assets – AssetLab 3D</h2>
        <div class="row">
          <button class="btnReload">Reload</button>
          <button class="btnNewTab">In neuem Tab</button>
          <span class="status" data-status>ready</span>
        </div>
        <iframe class="assetlabFrame" style="width:100%;height:520px;border:0;"></iframe>
      </div>
    `;

    this._statusEl = container.querySelector("[data-status]");

    const iframe = container.querySelector("iframe.assetlabFrame");
    this._iframeEl = iframe;

    const btnReload = container.querySelector(".btnReload");
    const btnNewTab = container.querySelector(".btnNewTab");

    // --- Kontext aus Draft holen ---
    const projectId = draft?.project?.id || draft?.app?.project?.id || "";
    const ctx = draft?.app?.ui?.assetlab?.context || null;

    // contextAsset wird im Draft mitgeführt (Projekt-Asset Objekt inkl. Slots)
    const ctxAsset = draft?.contextAsset || null;

    // --- iframe URL ---
    // eslint-disable-next-line no-undef
    const iframeUrl = window.__assetlab_getIframeUrl?.() || "modules/assetlab3d/iframe/index.html";
    iframe.src = iframeUrl;

    // ------------------------------------------------------------
    // Helper: send init into iframe
    // ------------------------------------------------------------

    const sendInit = (reason) => {
      if (!iframe || !iframe.contentWindow) return;
      if (!projectId || !ctx?.projectAssetId || !ctx?.slotId) return;

      const projectAssetId = ctx.projectAssetId;
      const slotId = ctx.slotId;

      let hasModel = false;
      let lastImportName = "";

      // Wenn wir contextAsset haben, können wir hasModel stabil bestimmen.
      // (contextAsset kommt aus dem Draft und enthält die Slots.)
      if (ctxAsset && slotId) {
        const slot = (ctxAsset.slots || []).find((s) => s && s.id === slotId) || null;
        hasModel = !!(slot?.hasModel || slot?.model || slot?.exportRef || slot?.lastImportName);
        lastImportName = slot?.lastImportName || "";
      }

      const msg = {
        ns: "assetlab",
        type: "assetlab:init",
        payload: { projectId, projectAssetId, slotId, hasModel, lastImportName },
        meta: {
          reason: reason || "init",
          counter: ++this._assetlabInitCounter,
          at: new Date().toISOString(),
        },
      };

      this._assetlabPendingInit = msg;

      try {
        iframe.contentWindow.postMessage(msg, window.location.origin);
        this._setStatus(`init sent (${reason || "init"})`);
      } catch (e) {
        this._setStatus("init ERROR");
      }
    };

    // ------------------------------------------------------------
    // Reload / New Tab
    // ------------------------------------------------------------

    btnReload?.addEventListener("click", () => {
      try {
        iframe.src = iframeUrl + (iframeUrl.includes("?") ? "&" : "?") + "cb=" + Date.now();
        this._setStatus("reloading…");
      } catch (e) {
        // no-op
      }
    });

    btnNewTab?.addEventListener("click", () => {
      try {
        window.open(iframe.src, "_blank");
      } catch (e) {
        // no-op
      }
    });

    // ------------------------------------------------------------
    // Bridge: Host <-> iframe
    // ------------------------------------------------------------

    const onMsg = async (ev) => {
      const data = ev?.data || null;
      if (!data || data.ns !== "assetlab") return;

      const type = data.type;
      const payload = data.payload;

      // iframe sagt: bitte init senden
      if (type === "assetlab:requestInit") {
        sendInit("requestInit");
        return;
      }

      if (type === "assetlab:init:ack") {
        this._assetlabInitOk = true;
        this._setStatus("init ack");
        return;
      }

      if (type === "assetlab:ready") {
        this._assetlabInitOk = true;
        this._setStatus("ready");

        // Init idempotent senden (Handshake)
        sendInit("ready");

        // Nach "ready" zusätzlich ein Restore anstoßen.
        // Grund: Einige iOS/Safari Szenarien liefern beim init zwar Kontext, aber das Modell
        // wird ohne expliziten Restore nicht geladen (Race/Timing beim Viewer-Setup).
        try {
          const initPayload = this._assetlabPendingInit?.payload || null;
          if (initPayload && initPayload.projectId && initPayload.projectAssetId && initPayload.slotId) {
            iframe.contentWindow?.postMessage(
              { ns: "assetlab", type: "assetlab:restore", payload: initPayload },
              window.location.origin
            );
          }
        } catch (e) {
          // no-op
        }

        return;
      }

      // Statusmeldungen (import ok / import ERROR etc.)
      if (type === "assetlab:status") {
        const st = payload?.status || "";
        const detail = payload?.detail ? ` (${payload.detail})` : "";
        this._setStatus(`${st}${detail}`);
        return;
      }

      // ----------------------------------------------------------
      // Slot Update -> Persist + Store Patch
      // ----------------------------------------------------------
      if (type === "assetlab:slotUpdate") {
        const projectId2 = payload?.projectId || projectId;
        const projectAssetId2 = payload?.projectAssetId || ctx?.projectAssetId || "";
        const slotId2 = payload?.slotId || ctx?.slotId || "";
        const fileName = payload?.fileName || payload?.lastImportName || "";

        // Update store flags
        this._applySlotStatusUpdate(projectId2, projectAssetId2, slotId2, {
          hasModel: true,
          lastImportName: fileName,
          updatedAt: payload?.updatedAt || new Date().toISOString(),
          lastAction: payload?.lastAction || payload?.kind || "import",
        });

        // HOST-PERSIST FALLBACK: wenn Buffer geliefert wird, speichern wir ihn zuverlässig
        const buf = payload?.buffer;
        if (buf && buf instanceof ArrayBuffer) {
          try {
            await this._persistArrayBufferForSlot(
              { projectId: projectId2, projectAssetId: projectAssetId2, slotId: slotId2 },
              buf
            );
            this._setStatus("import ok (host persist)");
          } catch (e) {
            this._setStatus("import ok (persist FAILED)");
          }
        } else {
          // kein Buffer -> trotzdem ok (z.B. nur Meta)
          this._setStatus("import ok (no buffer)");
        }

        return;
      }
    };

    window.addEventListener("message", onMsg);

    // ------------------------------------------------------------
    // Kickstart: nach iframe load init senden
    // ------------------------------------------------------------

    iframe.addEventListener("load", () => {
      this._setStatus("iframe loaded");
      sendInit("iframe-load");
    });
  }
}
