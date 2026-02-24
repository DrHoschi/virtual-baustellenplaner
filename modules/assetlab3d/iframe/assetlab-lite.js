/**
 * AssetLab Lite (iframe)
 * -------------------------------------------------------------
 * Zweck:
 * - Minimaler GLB/GLTF Viewer + Quick-Editor in einem iframe
 * - Kommunikation mit Host (Baustellenplaner UI) via postMessage
 *
 * WICHTIG (Projekt-Integration / Persistenz):
 * - Import erfolgt im iframe (FilePicker).
 * - Persistenz ist auf iOS/Safari manchmal instabil, daher:
 *   -> wir spiegeln den ArrayBuffer IMMER an den Host,
 *      damit der Host zuverlässig persistieren kann.
 *
 * Events (ns:"assetlab"):
 * - assetlab:ready / assetlab:init:ack / assetlab:requestInit
 * - assetlab:slotUpdate (payload enthält buffer + Metadaten)
 * - Host -> iframe: assetlab:init / assetlab:cmd / assetlab:restore / assetlab:reqBuffer
 */

(() => {
  "use strict";

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  function nowISO() {
    return new Date().toISOString();
  }

  function hasValidSlotCtx(ctx) {
    return !!(ctx && ctx.projectId && ctx.projectAssetId && ctx.slotId);
  }

  function safeString(v) {
    return typeof v === "string" ? v : "";
  }

  function isArrayBufferLike(x) {
    return (x instanceof ArrayBuffer) || (x && typeof x.byteLength === "number" && typeof x.slice === "function");
  }

  // ------------------------------------------------------------
  // postMessage -> Host
  // ------------------------------------------------------------

  function postToParent(type, payload, transfer) {
    try {
      window.parent?.postMessage(
        { ns: "assetlab", type, payload },
        window.location.origin,
        Array.isArray(transfer) ? transfer : undefined
      );
    } catch (e) {
      // no-op
    }
  }

  // Optional: unify status -> HostPanel listens often on assetlab:log
  function postLog(msg) {
    if (!msg) return;
    postToParent("assetlab:log", { msg: String(msg) });
  }

  // ------------------------------------------------------------
  // Minimal State
  // ------------------------------------------------------------

  let currentContext = null;
  let viewerReady = false;

  // last import buffer in RAM (nicht persistent!)
  const __lastImport = {
    projectId: "",
    projectAssetId: "",
    slotId: "",
    fileName: "",
    buffer: null, // ArrayBuffer
    updatedAt: "",
  };

  function cacheLastImport(ctx, buf, fileName) {
    __lastImport.projectId = ctx?.projectId || "";
    __lastImport.projectAssetId = ctx?.projectAssetId || "";
    __lastImport.slotId = ctx?.slotId || "";
    __lastImport.fileName = fileName || "";
    __lastImport.buffer = buf || null;
    __lastImport.updatedAt = nowISO();
  }

  function lastImportMatches(projectId, projectAssetId, slotId) {
    return (
      __lastImport.buffer &&
      __lastImport.projectId === (projectId || "") &&
      __lastImport.projectAssetId === (projectAssetId || "") &&
      __lastImport.slotId === (slotId || "")
    );
  }

  // ------------------------------------------------------------
  // Viewer bootstrap (dein bestehender three.js code hängt hier dran)
  // ------------------------------------------------------------

  async function initViewerIfNeeded() {
    if (viewerReady) return;
    // ... existing viewer init ...
    viewerReady = true;
  }

  // ------------------------------------------------------------
  // IDB Restore / Persist Hooks (bestehende Funktionen bleiben)
  // ------------------------------------------------------------

  async function restoreFromIDB() {
    // In deinem Projekt existiert diese Funktion bereits (IDB key based on ctx)
    // eslint-disable-next-line no-undef
    return await window.__assetlab_restoreFromIDB?.(currentContext);
  }

  async function persistToIDB(buf) {
    // eslint-disable-next-line no-undef
    return await window.__assetlab_persistToIDB?.(currentContext, buf);
  }

  async function applyImportedGLBBuffer(buf, fileName) {
    await initViewerIfNeeded();

    // Existing: GLB parse & load into scene.
    // eslint-disable-next-line no-undef
    await window.__assetlab_loadGLBBuffer?.(buf, fileName);

    cacheLastImport(currentContext, buf, fileName);
  }

  // ------------------------------------------------------------
  // Import Handler
  // ------------------------------------------------------------

  async function handleImportFile(file) {
    const fileName = safeString(file?.name || "import.glb");
    const nameLower = fileName.toLowerCase();

    await initViewerIfNeeded();

    let buf = null;
    try {
      if (file && typeof file.arrayBuffer === "function") {
        buf = await file.arrayBuffer();
      } else {
        // Fallback: FileReader
        buf = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onerror = () => reject(new Error("FileReader failed"));
          fr.onload = () => resolve(fr.result);
          fr.readAsArrayBuffer(file);
        });
      }
    } catch (e) {
      console.error("[assetlab-lite] import failed: cannot read file buffer", e);
      postToParent("assetlab:status", { status: "import ERROR", detail: String(e?.message || e) });
      postLog(`import ERROR: ${String(e?.message || e)}`);
      return;
    }

    if (!(buf instanceof ArrayBuffer)) {
      console.error("[assetlab-lite] import failed: buffer is not ArrayBuffer", buf);
      postToParent("assetlab:status", { status: "import ERROR", detail: "buffer not ArrayBuffer" });
      postLog("import ERROR: buffer not ArrayBuffer");
      return;
    }

    if (nameLower.endsWith(".glb")) {
      await applyImportedGLBBuffer(buf, fileName);

      // Try persist in iframe IDB (may be unstable on iOS)
      let persisted = false;
      try {
        if (hasValidSlotCtx(currentContext)) {
          persisted = await persistToIDB(buf);
        }
      } catch (e) {
        persisted = false;
      }

      if (hasValidSlotCtx(currentContext)) {
        const projectId = currentContext.projectId;
        const projectAssetId = currentContext.projectAssetId;
        const slotId = currentContext.slotId;

        // Always mirror to host (copy)
        const hostBuf = buf.slice(0);

        postToParent(
          "assetlab:slotUpdate",
          {
            projectId,
            projectAssetId,
            slotId,
            hasModel: true,
            fileName,              // <-- HostPanel nutzt payload.fileName
            lastImportName: fileName,
            updatedAt: nowISO(),
            lastAction: persisted ? "import" : "import (no persist)",
            kind: "import",
            persisted,
            buffer: hostBuf,
            bufferByteLength: hostBuf.byteLength,
          },
          [hostBuf]
        );
      } else {
        postToParent("assetlab:status", { status: "import ok (no slot ctx)" });
        postLog("import ok (no slot ctx)");
      }

      postToParent("assetlab:status", { status: persisted ? "import ok (persisted)" : "import ok (no persist)" });
      postLog(persisted ? "import ok (persisted)" : "import ok (no persist)");
      return;
    }

    if (nameLower.endsWith(".gltf")) {
      postToParent("assetlab:status", { status: "import ok (gltf) - not persisted" });
      postLog("import ok (gltf) - not persisted");
      return;
    }

    postToParent("assetlab:status", { status: "import ERROR", detail: "Unsupported file type" });
    postLog("import ERROR: Unsupported file type");
  }

  // ------------------------------------------------------------
  // Restore Handler (Host -> iframe)
  // ------------------------------------------------------------

  async function handleRestoreRequest(payload) {
    if (!payload || !payload.projectId || !payload.projectAssetId || !payload.slotId) return;

    currentContext = {
      projectId: payload.projectId,
      projectAssetId: payload.projectAssetId,
      slotId: payload.slotId,
      hasModel: !!payload.hasModel,
      lastImportName: safeString(payload.lastImportName || payload.fileName || ""),
    };

    await initViewerIfNeeded();

    // ✅ WICHTIG: Wenn Host bereits buffer liefert -> DIREKT laden
    if (isArrayBufferLike(payload.buffer)) {
      try {
        const fileName = safeString(payload.fileName || payload.lastImportName || "restored.glb");
        const buf = payload.buffer;

        await applyImportedGLBBuffer(buf, fileName);
        postToParent("assetlab:status", { status: "restore ok (host buffer)" });
        postLog("restore ok (host buffer)");
        return;
      } catch (e) {
        console.warn("[assetlab-lite] restore (host buffer) failed", e);
        postToParent("assetlab:status", { status: "restore ERROR (host buffer)", detail: String(e?.message || e) });
        postLog(`restore ERROR (host buffer): ${String(e?.message || e)}`);
        // fallback continues
      }
    }

    // 1) Try IDB restore (iframe)
    try {
      await restoreFromIDB();
      postToParent("assetlab:status", { status: "restore ok (idb)" });
      postLog("restore ok (idb)");
      return;
    } catch (e) {
      postToParent("assetlab:status", { status: "restore miss (idb)" });
      postLog("restore miss (idb)");
    }
  }

  // ------------------------------------------------------------
  // NEW: Host requests buffer (assetlab:reqBuffer)
  // ------------------------------------------------------------

  async function handleReqBuffer(payload) {
    const projectId = payload?.projectId || currentContext?.projectId || "";
    const projectAssetId = payload?.projectAssetId || currentContext?.projectAssetId || "";
    const slotId = payload?.slotId || currentContext?.slotId || "";

    if (!projectId || !projectAssetId || !slotId) return;

    // 1) RAM buffer available from last import -> answer immediately
    if (lastImportMatches(projectId, projectAssetId, slotId) && __lastImport.buffer) {
      const hostBuf = __lastImport.buffer.slice(0);
      postToParent(
        "assetlab:buffer",
        {
          projectId,
          projectAssetId,
          slotId,
          fileName: __lastImport.fileName || "import.glb",
          updatedAt: __lastImport.updatedAt || nowISO(),
          buffer: hostBuf,
          bufferByteLength: hostBuf.byteLength,
        },
        [hostBuf]
      );
      postLog("reqBuffer -> sent RAM buffer");
      return;
    }

    // 2) If no RAM buffer: we cannot reliably "recreate" it here unless your iframe exposes an IDB-get API.
    // If you add window.__assetlab_getFromIDB(ctx) later, we support it:
    try {
      // eslint-disable-next-line no-undef
      const rec = await window.__assetlab_getFromIDB?.({ projectId, projectAssetId, slotId });
      if (rec && isArrayBufferLike(rec.buffer)) {
        const hostBuf = rec.buffer.slice(0);
        postToParent(
          "assetlab:buffer",
          {
            projectId,
            projectAssetId,
            slotId,
            fileName: safeString(rec.fileName || "restored.glb"),
            updatedAt: safeString(rec.updatedAt || nowISO()),
            buffer: hostBuf,
            bufferByteLength: hostBuf.byteLength,
          },
          [hostBuf]
        );
        postLog("reqBuffer -> sent IDB buffer via __assetlab_getFromIDB");
        return;
      }
    } catch (e) {
      // ignore
    }

    // nothing to send
    postLog("reqBuffer -> no buffer available (RAM/IDB)");
  }

  // ------------------------------------------------------------
  // Message Listener (Host -> iframe)
  // ------------------------------------------------------------

  window.addEventListener("message", async (ev) => {
    const data = ev?.data || null;
    if (!data || data.ns !== "assetlab") return;

    const type = data.type;
    const payload = data.payload;

    if (type === "assetlab:init") {
      currentContext = payload || null;

      await initViewerIfNeeded();

      postToParent("assetlab:init:ack", { ok: true, at: nowISO() });

      // Auto-Restore attempt (IDB) - ok if host doesn't send buffer yet
      if (hasValidSlotCtx(currentContext)) {
        try {
          await restoreFromIDB();
        } catch (e) {
          // ignore
        }
      }

      postToParent("assetlab:ready", { ok: true, at: nowISO() });
      return;
    }

    if (type === "assetlab:cmd") {
      return;
    }

    if (type === "assetlab:restore") {
      await handleRestoreRequest(payload);
      return;
    }

    // ✅ NEW: Host requests buffer (after slotUpdate missing buffer etc.)
    if (type === "assetlab:reqBuffer") {
      await handleReqBuffer(payload);
      return;
    }

    if (type === "assetlab:requestInit") {
      postToParent("assetlab:requestInit", { ok: true, at: nowISO() });
      return;
    }
  });

  // ------------------------------------------------------------
  // UI Hook: Import Button
  // ------------------------------------------------------------

  function wireImportButton() {
    const btn = document.querySelector("[data-assetlab-import-btn]") || document.querySelector(".btnImport");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".glb,.gltf";
    input.style.display = "none";
    document.body.appendChild(input);

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      input.value = "";
      if (!file) return;
      try {
        await handleImportFile(file);
      } catch (e) {
        console.error("[assetlab-lite] import error", e);
        postToParent("assetlab:status", { status: "import ERROR", detail: String(e?.message || e) });
        postLog(`import ERROR: ${String(e?.message || e)}`);
      }
    });

    if (btn) {
      btn.addEventListener("click", () => input.click());
    }
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------

  (async () => {
    await initViewerIfNeeded();
    wireImportButton();

    // signal ready (pre-init) – Host kann dann init senden
    postToParent("assetlab:requestInit", { ok: true, at: nowISO() });
  })();
})();
