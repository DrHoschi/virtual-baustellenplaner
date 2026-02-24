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
 * - Host -> iframe: assetlab:init / assetlab:cmd / assetlab:restore
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

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function safeString(v) {
    return typeof v === "string" ? v : "";
  }

  // ------------------------------------------------------------
  // postMessage -> Host
  // ------------------------------------------------------------

  function postToParent(type, payload, transfer) {
    try {
      // 3. Parameter (transfer) wird z.B. für ArrayBuffer genutzt, damit große Buffers effizient
      // zwischen iframe <-> Host übergeben werden können.
      // Safari/iOS unterstützt Transferables, aber wir bleiben defensiv.
      window.parent?.postMessage(
        { ns: "assetlab", type, payload },
        window.location.origin,
        Array.isArray(transfer) ? transfer : undefined
      );
    } catch (e) {
      // no-op
    }
  }

  // ------------------------------------------------------------
  // Minimal State
  // ------------------------------------------------------------

  let currentContext = null;
  let viewerReady = false;

  // (Simple) last import buffer in RAM (nicht persistent!)
  const __lastImport = {
    projectId: "",
    projectAssetId: "",
    slotId: "",
    fileName: "",
    buffer: null, // ArrayBuffer
    updatedAt: "",
  };

  // ------------------------------------------------------------
  // DOM + Viewer bootstrap (vereinfachtes Beispiel)
  // ------------------------------------------------------------

  // In deinem Projekt ist hier der existierende Viewer-Setup-Code (three.js etc.)
  // Wir belassen deine bestehende Struktur – hier nur Platzhalter für "viewerReady".
  async function initViewerIfNeeded() {
    if (viewerReady) return;
    // ... existing viewer init ...
    viewerReady = true;
  }

  // ------------------------------------------------------------
  // IDB Restore / Persist Hooks (bestehende Funktionen bleiben)
  // ------------------------------------------------------------

  // In deiner Version existieren restoreFromIDB / persistToIDB bereits.
  // Wir greifen sie nur an den richtigen Stellen auf.
  async function restoreFromIDB() {
    // In deinem Projekt existiert diese Funktion bereits (IDB key based on ctx)
    // Hier wird sie unverändert genutzt.
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

    // Update RAM cache
    __lastImport.projectId = currentContext?.projectId || "";
    __lastImport.projectAssetId = currentContext?.projectAssetId || "";
    __lastImport.slotId = currentContext?.slotId || "";
    __lastImport.fileName = fileName || "";
    __lastImport.buffer = buf;
    __lastImport.updatedAt = nowISO();
  }

  // ------------------------------------------------------------
  // Import Handler
  // ------------------------------------------------------------

  async function handleImportFile(file) {
    const fileName = safeString(file?.name || "import.glb");
    const nameLower = fileName.toLowerCase();

    await initViewerIfNeeded();

    // ----------------------------------------------------------
    // SAFARI/iOS: file.arrayBuffer kann fehlen (manche WebViews)
    // ----------------------------------------------------------
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
      return;
    }

    if (!(buf instanceof ArrayBuffer)) {
      console.error("[assetlab-lite] import failed: buffer is not ArrayBuffer", buf);
      postToParent("assetlab:status", { status: "import ERROR", detail: "buffer not ArrayBuffer" });
      return;
    }

    // ----------------------------------------------------------
    // GLB/GLTF Branching
    // ----------------------------------------------------------
    if (nameLower.endsWith(".glb")) {
      // Apply to viewer
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

      // Inform host (model exists in slot)
      if (hasValidSlotCtx(currentContext)) {
        const projectId = currentContext.projectId;
        const projectAssetId = currentContext.projectAssetId;
        const slotId = currentContext.slotId;

        // Wir schicken IMMER einen Buffer an den Host (auch wenn IDB persist im iframe geklappt hat),
        // damit der Host unabhängig davon eine stabile Persistenz/Restore-Quelle hat.
        // Wichtig: Wir übertragen eine Kopie (slice), damit der Buffer im iframe weiterhin nutzbar bleibt.
        const hostBuf = buf.slice(0);
        postToParent(
          "assetlab:slotUpdate",
          {
            projectId,
            projectAssetId,
            slotId,
            hasModel: true,
            lastImportName: fileName,
            updatedAt: new Date().toISOString(),
            lastAction: persisted ? "import" : "import (no persist)",
            persisted,
            buffer: hostBuf,
            bufferByteLength: hostBuf.byteLength,
          },
          [hostBuf]
        );
      } else {
        // No slot ctx: still report import ok
        postToParent("assetlab:status", { status: "import ok (no slot ctx)" });
      }

      postToParent("assetlab:status", {
        status: persisted ? "import ok (persisted)" : "import ok (no persist)",
      });
      return;
    }

    if (nameLower.endsWith(".gltf")) {
      // Optional: Implement GLTF support - in deinem Projekt existiert ggf. GLTF loader via URL.
      postToParent("assetlab:status", { status: "import ok (gltf) - not persisted" });
      return;
    }

    postToParent("assetlab:status", { status: "import ERROR", detail: "Unsupported file type" });
  }

  // ------------------------------------------------------------
  // Restore Handler (Host -> iframe)
  // ------------------------------------------------------------

  async function handleRestoreRequest(payload) {
    // payload enthält projectId, projectAssetId, slotId, (optional) hasModel/lastImportName
    if (!payload || !payload.projectId || !payload.projectAssetId || !payload.slotId) return;

    currentContext = {
      projectId: payload.projectId,
      projectAssetId: payload.projectAssetId,
      slotId: payload.slotId,
      hasModel: !!payload.hasModel,
      lastImportName: safeString(payload.lastImportName || ""),
    };

    await initViewerIfNeeded();

    // 1) Versuche IDB restore
    try {
      await restoreFromIDB();
      postToParent("assetlab:status", { status: "restore ok (idb)" });
      return;
    } catch (e) {
      // continue
    }

    // 2) Fallback: wenn Host einen Buffer liefert (Host-Persist-Fallback),
    // kommt das in einem anderen Message-Typ (assetlab:restoreBuffer) – abhängig von deinem Projekt.
    postToParent("assetlab:status", { status: "restore miss (idb)" });
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

      // ack
      postToParent("assetlab:init:ack", { ok: true, at: nowISO() });

      // Auto-Restore: wir versuchen IMMER ein Restore, sobald Slot-Kontext vorhanden ist.
      // Grund: Der Host sendet bei init ggf. nur projectId/projectAssetId/slotId; "hasModel"
      // kann dann undefined sein, obwohl in der Project-Assets-UI ein Modell existiert.
      if (hasValidSlotCtx(currentContext)) {
        try {
          await restoreFromIDB();
        } catch (e) {
          console.warn("[assetlab-lite] restore failed", e);
        }
      }

      // ready
      postToParent("assetlab:ready", { ok: true, at: nowISO() });
      return;
    }

    if (type === "assetlab:cmd") {
      // Host commands (optional)
      // z.B. request import etc.
      return;
    }

    if (type === "assetlab:restore") {
      await handleRestoreRequest(payload);
      return;
    }

    if (type === "assetlab:requestInit") {
      // Host fragt init an
      postToParent("assetlab:requestInit", { ok: true, at: nowISO() });
      return;
    }
  });

  // ------------------------------------------------------------
  // UI Hook: Import Button
  // ------------------------------------------------------------

  // In deinem Projekt existiert bereits ein Import Button.
  // Wir binden hier defensiv, ohne deine UI zu überschreiben.
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
