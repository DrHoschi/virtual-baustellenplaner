/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.0.8 - catalog-autolink (2026-02-28)
 *
 * Fixes (aus v1.0.6 bleiben drin):
 *  - Wenn Host-IDB (IndexedDB) auf iOS/Safari fehlschlägt:
 *      -> Buffer wird zusätzlich in localStorage (Base64) gespeichert
 *      -> Beim erneuten Öffnen wird aus localStorage restored und an iframe gesendet
 *
 * Architektur-Fix (NEU):
 *  - Panel speichert Projekt-Snapshots NICHT mehr direkt in localStorage.
 *  - Stattdessen: Panel macht store.update(...) und fordert Save nur per Event an:
 *      -> bus.emit("ui:project:save")
 *      -> optional bus.emit("ui:save")
 *
 *  - akzeptiert payload.fileName ODER payload.lastImportName
 *  - wenn Host Persist ok -> lastAction = "import" (statt "import (no persist)")
 *  - reqBuffer wird auch getriggert, wenn nur lastImportName vorhanden ist
 */

import { PanelBase } from "./PanelBase.js";
import { h, clear } from "../components/ui-dom.js";
import { FormField } from "../components/FormField.js";
import { Section } from "../components/Section.js";
import { idbPut, idbGet, makeModelKey } from "../../modules/assetlab3d/shared/idb-util.js";

/* ============================================================================
 * Helpers
 * ========================================================================== */

function safeClone(obj) {
  try { if (typeof structuredClone === "function") return structuredClone(obj); } catch {}
  try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
}

function findProjectAsset(app, id) {
  const candidates = [
    app?.project?.projectAssets,
    app?.settings?.projectAssets,
    app?.projectAssets,
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr) && id) {
      const hit = arr.find((a) => a && a.id === id);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Emit a manual save request.
 * - Wir speichern NICHT mehr direkt aus dem Panel in localStorage.
 * - Stattdessen sendet das Panel nur ein Save-Event an den Host.
 * - Der Host (loader.js) entscheidet, wann/wo/wie gespeichert wird (Save-Button only).
 */
function emitManualSave(bus, reason = "panel") {
  try { bus?.emit?.("ui:project:save", { reason }); } catch {}
  // optionaler Alias (falls irgendwo noch "ui:save" verwendet wird)
  try { bus?.emit?.("ui:save", { reason }); } catch {}
}

function slotLooksLikeHasModel(slot) {
  if (!slot) return false;
  if (slot.hasModel) return true;
  if (slot.model) return true;
  if (slot.exportRef) return true;
  if (slot.lastImportName && String(slot.lastImportName).trim().length > 0) return true;
  if (slot.lastAction && String(slot.lastAction).toLowerCase().includes("import")) return true;
  return false;
}

function applySlotStatusUpdate({ app, projectAssetId, slotId, fileName, updatedAt, kind, lastAction, thumbnail, catalogId }) {
  if (!app) return;

  const list =
    Array.isArray(app?.project?.projectAssets) ? app.project.projectAssets :
    Array.isArray(app?.settings?.projectAssets) ? app.settings.projectAssets :
    null;

  if (!list) return;

  const asset = list.find((a) => a && a.id === projectAssetId);
  if (!asset) return;

  asset.slots = Array.isArray(asset.slots) ? asset.slots : [];
  const slot = asset.slots.find((s) => s && s.id === slotId);
  if (!slot) return;

  slot.updatedAt = updatedAt || new Date().toISOString();
  slot.lastAction = lastAction || kind || "";

  if (kind === "import" || kind === "restore") {
    slot.hasModel = true;
    if (fileName) slot.lastImportName = fileName;
    // CatalogId (nur setzen, wenn noch nicht explizit gesetzt)
    if (catalogId && !slot.catalogId) slot.catalogId = String(catalogId);
  }

  // NEW: project-bound thumbnail (small PNG dataUrl). Optional.
  // NEW: project-bound thumbnail(s). Optional.
  // Unterstützt:
  //  A) Legacy: { mime, dataUrl, w, h, updatedAt }
  //  B) Multi-View: { defaultView, views: { top/perspective/front/right: {dataUrl...} } }
  //     -> Wir behalten zusätzlich ein Legacy-Feld thumbnail.dataUrl (perspective),
  //        damit bestehende UIs weiterhin funktionieren.
  if (thumbnail && typeof thumbnail === "object") {
    // Multi-View
    if (thumbnail.views && typeof thumbnail.views === "object") {
      const def = thumbnail.defaultView || "perspective";
      const defDu = thumbnail.views?.[def]?.dataUrl || thumbnail.views?.perspective?.dataUrl || thumbnail.views?.top?.dataUrl;
      // Ensure legacy-compatible fields exist
      slot.thumbnail = {
        ...thumbnail,
        mime: thumbnail.mime || "image/png",
        dataUrl: typeof defDu === "string" ? defDu : (thumbnail.dataUrl || ""),
        w: Number.isFinite(thumbnail.w) ? thumbnail.w : 256,
        h: Number.isFinite(thumbnail.h) ? thumbnail.h : 256,
        updatedAt: thumbnail.updatedAt || (updatedAt || new Date().toISOString()),
      };
    } else if (typeof thumbnail.dataUrl === "string") {
      // Legacy single-view
      slot.thumbnail = {
        mime: thumbnail.mime || "image/png",
        dataUrl: thumbnail.dataUrl,
        w: Number.isFinite(thumbnail.w) ? thumbnail.w : 256,
        h: Number.isFinite(thumbnail.h) ? thumbnail.h : 256,
        updatedAt: thumbnail.updatedAt || (updatedAt || new Date().toISOString()),
      };
    }
  }

  // Mirror both places so export + UI stay aligned
  app.project = app.project || {};
  app.settings = app.settings || {};
  app.project.projectAssets = list;
  app.settings.projectAssets = list;
}

/* ============================================================================
 * Host Persist Fallback (localStorage Base64) – nur MODEL BUFFER, nicht Projekt
 * ========================================================================== */

function lsModelKey(projectAssetId, slotId) {
  // bewusst eigene Namespace, damit wir IDB und LS unterscheiden können
  return `baustellenplaner:modelbuf:v1:${projectAssetId}:${slotId}`;
}

function abToBase64(ab) {
  // Chunked conversion, damit iOS nicht bei großen Buffern abschmiert.
  const bytes = new Uint8Array(ab);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function base64ToAb(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function lsPutModel(projectAssetId, slotId, rec) {
  try {
    const key = lsModelKey(projectAssetId, slotId);
    const b64 = abToBase64(rec.buffer);
    const payload = {
      fileName: rec.fileName || "",
      updatedAt: rec.updatedAt || new Date().toISOString(),
      b64,
      bytes: rec.buffer?.byteLength || 0
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return { ok: true, key, bytes: payload.bytes };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function lsGetModel(projectAssetId, slotId) {
  try {
    const key = lsModelKey(projectAssetId, slotId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.b64) return null;
    const buffer = base64ToAb(obj.b64);
    return {
      fileName: obj.fileName || "",
      updatedAt: obj.updatedAt || new Date().toISOString(),
      buffer
    };
  } catch {
    return null;
  }
}

/* ============================================================================
 * Panel
 * ========================================================================== */

export class AssetLab3DPanel extends PanelBase {
  getTitle() { return "Assets – AssetLab 3D"; }

  getDescription() {
    const app = this.store.get("app") || {};
    const pid = app?.project?.id || "";
    const ctx = app?.ui?.assetlab?.context;
    const mode = ctx?.mode || ctx?.type;
    const ctxTxt = mode === "projectAsset" && ctx?.projectAssetId ? ` · Kontext: ${ctx.projectAssetId}` : "";
    return (pid ? `Projekt-ID: ${pid}` : "") + ctxTxt;
  }

  getToolbarConfig() {
    return { showReset: false, showApply: false, note: "AssetLab läuft als iframe. Preset-Metadaten werden im Projekt gespeichert." };
  }

  /**
   * Zentraler Save-Trigger (nur Event).
   * Der loader.js hört auf "ui:project:save" und speichert (nur via Save-Button Setup).
   */
  _requestSave(reason = "assetlab") {
    emitManualSave(this.bus, reason);
  }

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const pid = app?.project?.id || "unknown";
    const ctx = app?.ui?.assetlab?.context || null;
    const mode = ctx?.mode || ctx?.type || null;
    const assetId = mode === "projectAsset" ? ctx?.projectAssetId : null;
    const asset = findProjectAsset(app, assetId);

    const preset = safeClone(asset?.presetTransform || { sx: 1, sy: 1, sz: 1, ryDeg: 0, ox: 0, oy: 0, oz: 0 });

    return { projectId: pid, context: ctx, contextAsset: asset ? { id: asset.id, name: asset.name || "" } : null, presetTransform: preset };
  }

  applyDraftToStore() {}

  renderBody(root, draft) {
    clear(root);

    const projectId = draft?.projectId || "unknown";
    const ctx = draft?.context || null;
    const ctxAsset = draft?.contextAsset || null;

    let iframeSrc = `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    const mode = ctx?.mode || ctx?.type || null;
    if (mode === "projectAsset" && ctx?.projectAssetId) {
      const slotId = ctx?.slotId || "s1";
      iframeSrc += `&contextAssetId=${encodeURIComponent(ctx.projectAssetId)}`;
      iframeSrc += `&slotId=${encodeURIComponent(slotId)}`;
    }

    const bar = h("div", { style: { display: "flex", gap: "8px", alignItems: "center", margin: "0 0 10px", flexWrap: "wrap" } });
    const btnReload = h("button", { className: "bp-btn", type: "button", onclick: () => { if (this._iframe) this._iframe.src = this._iframe.src; } }, "↻ Reload");
    const btnPopout = h("button", { className: "bp-btn", type: "button", onclick: () => window.open(iframeSrc, "_blank") }, "↗︎ In neuem Tab");
    const status = h("span", { style: { opacity: ".75", fontSize: "12px", marginLeft: "auto" } }, "");
    bar.appendChild(btnReload);
    bar.appendChild(btnPopout);
    bar.appendChild(status);
    root.appendChild(bar);

    const ctxSec = new Section({
      title: "Kontext",
      description: "Wenn du ein Projekt-Asset öffnest, speichert dieses Panel hier Preset-Metadaten im Projekt."
    });

    const ctxRow = h("div", { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" } });

    const ctxText = h("div", { style: { fontSize: "13px", opacity: ".85" } },
      (mode === "projectAsset") && ctxAsset
        ? `Projekt-Asset: ${ctxAsset.name || "(ohne Name)"} · id: ${ctxAsset.id}`
        : "Kein Projekt-Asset Kontext (AssetLab als freier Viewer)."
    );

    const btnClearCtx = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => {
        this.store.update("app", (app) => {
          app.ui = app.ui || {};
          app.ui.assetlab = app.ui.assetlab || {};
          app.ui.assetlab.context = null;
        });
        // Kontext-Änderung ist projekt-relevant → Save anfordern (nur Event)
        this._requestSave("context:clear");

        this.draft = this.buildDraftFromStore();
        this._rerender();
      }
    }, "Kontext löschen");

    ctxRow.appendChild(ctxText);
    ctxRow.appendChild(btnClearCtx);
    ctxSec.append(ctxRow);

    if ((mode === "projectAsset") && ctx?.projectAssetId) {
      const form = h("div", {
        style: {
          marginTop: "10px",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(140px, 1fr))",
          gap: "10px"
        }
      });

      const p = draft?.presetTransform || {};
      const makeNum = (label, key, step = "0.1") => FormField({
        label,
        type: "number",
        value: (p[key] ?? 0),
        inputProps: { step },
        onInput: (v) => {
          const n = Number(v);
          draft.presetTransform[key] = Number.isFinite(n) ? n : 0;
          this.markDirty();
        }
      });

      form.appendChild(makeNum("Scale X", "sx"));
      form.appendChild(makeNum("Scale Y", "sy"));
      form.appendChild(makeNum("Scale Z", "sz"));
      form.appendChild(makeNum("Rot Y (°)", "ryDeg", "1"));
      form.appendChild(makeNum("Offset X", "ox"));
      form.appendChild(makeNum("Offset Y", "oy"));
      form.appendChild(makeNum("Offset Z", "oz"));

      ctxSec.append(form);

      const btnSavePreset = h("button", {
        className: "bp-btn",
        type: "button",
        style: { marginTop: "10px" },
        onclick: () => {
          const assetId = ctx.projectAssetId;
          const preset = safeClone(draft.presetTransform || {});
          this.store.update("app", (app) => {
            const asset = findProjectAsset(app, assetId);
            if (asset) asset.presetTransform = preset;
          });
          this._requestSave("presetTransform");

          status.textContent = "Preset gespeichert";
          this.markSaved();
        }
      }, "Preset speichern");

      ctxSec.append(btnSavePreset);
    }

    root.appendChild(ctxSec.el);

    const iframeWrap = h("div", {
      style: {
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "10px",
        overflow: "hidden",
        height: "calc(100vh - 340px)",
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

    const sendInit = (reason = "manual") => {
      try {
        const app = this.store.get("app") || {};
        const ctxNow = app?.ui?.assetlab?.context || null;

        const projectAssetId = ctxNow?.projectAssetId || null;
        const slotId = ctxNow?.slotId || null;

        let hasModel = false;
        let slot = null;

        if (projectAssetId && slotId) {
          const asset = findProjectAsset(app, projectAssetId);
          slot = asset?.slots?.find?.((s) => s && s.id === slotId) || null;
          hasModel = slotLooksLikeHasModel(slot);
        }

        iframe.contentWindow?.postMessage({
          ns: "assetlab",
          type: "assetlab:init",
          reason,
          payload: { projectId, projectAssetId, slotId, hasModel }
        }, window.location.origin);

        // Wenn wir ein Modell erwarten -> Restore versuchen (IDB, sonst LS fallback)
        if (projectAssetId && slotId && hasModel) {
          const key = makeModelKey(projectAssetId, slotId);

          void (async () => {
            try {
              // 1) IDB
              const rec = await idbGet(key);
              if (rec && rec.buffer) {
                const buf = rec.buffer;
                iframe.contentWindow?.postMessage({
                  ns: "assetlab",
                  type: "assetlab:restore",
                  payload: {
                    projectId,
                    projectAssetId,
                    slotId,
                    fileName: rec.fileName || (slot?.lastImportName || "restored.glb"),
                    buffer: buf
                  }
                }, window.location.origin, [buf]);
                status.textContent = "🟢 Restore (IDB)";
                return;
              }

              // 2) localStorage fallback (MODEL BUFFER)
              const rec2 = lsGetModel(projectAssetId, slotId);
              if (rec2 && rec2.buffer) {
                const buf2 = rec2.buffer;
                iframe.contentWindow?.postMessage({
                  ns: "assetlab",
                  type: "assetlab:restore",
                  payload: {
                    projectId,
                    projectAssetId,
                    slotId,
                    fileName: rec2.fileName || (slot?.lastImportName || "restored.glb"),
                    buffer: buf2
                  }
                }, window.location.origin, [buf2]);
                status.textContent = "🟡 Restore (LS)";
                return;
              }

              console.warn("[AssetLab3DPanel] restore miss (no IDB + no LS):", key);
              status.textContent = "⚠️ Restore miss";
            } catch (e) {
              console.warn("[AssetLab3DPanel] restore send failed", e);
              status.textContent = "⚠️ Restore failed";
            }
          })();
        }
      } catch (e) {
        console.warn("[AssetLab3DPanel] sendInit failed", e);
      }
    };

    const requestBufferFromIframe = (projectAssetId, slotId) => {
      try {
        iframe.contentWindow?.postMessage({
          ns: "assetlab",
          type: "assetlab:reqBuffer",
          payload: { projectId, projectAssetId, slotId }
        }, window.location.origin);
      } catch (e) {
        console.warn("[AssetLab3DPanel] reqBuffer failed", e);
      }
    };

    iframe.addEventListener("load", () => sendInit("iframe-load"));
    setTimeout(() => sendInit("iframe-timeout"), 50);

    const onMsg = (ev) => {
      if (!ev || !ev.data) return;
      if (ev.source && ev.source !== iframe.contentWindow) return;
      if (ev.origin !== window.location.origin) return;

      const data = ev.data || {};
      const type = data.type;
      const payload = data.payload || null;

      if (type === "assetlab:ready") {
        status.textContent = "🟢 AssetLab bereit";
        sendInit("ready");
        return;
      }

      if (type === "assetlab:log") {
        const msg = payload?.msg || "";
        if (msg) status.textContent = `ℹ️ ${msg}`;
        return;
      }

      // Antwort auf reqBuffer: Host bekommt Buffer
      if (type === "assetlab:buffer") {
        const projectAssetId = payload?.projectAssetId;
        const slotId = payload?.slotId;
        const buf = payload?.buffer;
        const fileName = payload?.fileName || "";
        const updatedAt = payload?.updatedAt || new Date().toISOString();

        if (!projectAssetId || !slotId || !buf) return;

        const key = makeModelKey(projectAssetId, slotId);

        void (async () => {
          // 1) IDB versuchen
          try {
            await idbPut(key, { fileName, updatedAt, buffer: buf });
            console.log("[AssetLab3DPanel] Host persisted buffer via reqBuffer (IDB):", key, buf.byteLength);
            status.textContent = "🟢 Host Persist ok (IDB)";

            this.store.update("app", (a) => {
              applySlotStatusUpdate({ app: a, projectAssetId, slotId, fileName, updatedAt, kind: "import", lastAction: "import", thumbnail: payload?.thumbnail, catalogId: quickCatalogGuess(fileName) });
            });
            this._requestSave("bufferPersist:idb");
            // Catalog refine (async): wenn ein Pattern im Catalog matcht, setzen wir slot.catalogId,
            // aber nur wenn noch nicht explizit gesetzt ist.
            loadAssetCatalogOnce().then((cat) => {
              const matched = matchCatalogIdByText(fileName, cat);
              if (!matched) return;
              this.store.update("app", (a) => {
                applySlotStatusUpdate({ app: a, projectAssetId, slotId, fileName, updatedAt, kind: "import", lastAction: "import", thumbnail: payload?.thumbnail, catalogId: matched });
              });
              this._requestSave("catalogRefine");
            });

            return;
          } catch (e) {
            console.warn("[AssetLab3DPanel] Host persist (IDB) failed:", e);
          }

          // 2) localStorage fallback (MODEL BUFFER)
          const r = lsPutModel(projectAssetId, slotId, { fileName, updatedAt, buffer: buf });
          if (r.ok) {
            console.log("[AssetLab3DPanel] Host persisted buffer via reqBuffer (LS):", r.key, r.bytes);
            status.textContent = "🟡 Host Persist ok (LS)";

            this.store.update("app", (a) => {
              applySlotStatusUpdate({ app: a, projectAssetId, slotId, fileName, updatedAt, kind: "import", lastAction: "import", thumbnail: payload?.thumbnail, catalogId: quickCatalogGuess(fileName) });
            });
            this._requestSave("bufferPersist:ls");
            // Catalog refine (async): wenn ein Pattern im Catalog matcht, setzen wir slot.catalogId,
            // aber nur wenn noch nicht explizit gesetzt ist.
            loadAssetCatalogOnce().then((cat) => {
              const matched = matchCatalogIdByText(fileName, cat);
              if (!matched) return;
              this.store.update("app", (a) => {
                applySlotStatusUpdate({ app: a, projectAssetId, slotId, fileName, updatedAt, kind: "import", lastAction: "import", thumbnail: payload?.thumbnail, catalogId: matched });
              });
              this._requestSave("catalogRefine");
            });

          } else {
            status.textContent = "⚠️ Host Persist fehlgeschlagen";
          }
        })();

        return;
      }

      // Import/Restore Status aus iframe
      if (type === "assetlab:slotUpdate" || type === "assetlab:payload") {
        const app = this.store.get("app") || {};
        const ctxNow = app?.ui?.assetlab?.context;

        const projectAssetId = ctxNow?.projectAssetId || payload?.projectAssetId;
        const slotId = payload?.slotId;

        if (!projectAssetId || !slotId) return;

        const effectiveName = payload?.fileName || payload?.lastImportName || "";
        const updatedAt = payload?.updatedAt || new Date().toISOString();

        // Wenn Buffer direkt mitkommt -> Host Persist (IDB -> LS fallback)
        if (payload?.buffer && (payload.buffer instanceof ArrayBuffer || typeof payload.buffer?.byteLength === "number")) {
          const buf = payload.buffer;
          const key = makeModelKey(projectAssetId, slotId);

          void (async () => {
            // 1) IDB
            try {
              await idbPut(key, { fileName: effectiveName, updatedAt, buffer: buf });
              console.log("[AssetLab3DPanel] Host persisted model buffer (IDB):", key, buf.byteLength);
              status.textContent = "🟢 Host Persist ok (IDB)";

              this.store.update("app", (a) => {
                applySlotStatusUpdate({ app: a, projectAssetId, slotId, fileName: effectiveName, updatedAt, kind: payload?.kind || "import", lastAction: "import", thumbnail: payload?.thumbnail });
              });
              this._requestSave("slotUpdatePersist:idb");
              return;
            } catch (e) {
              console.warn("[AssetLab3DPanel] Host persist (IDB) failed:", e);
            }

            // 2) localStorage fallback (MODEL BUFFER)
            const r = lsPutModel(projectAssetId, slotId, { fileName: effectiveName, updatedAt, buffer: buf });
            if (r.ok) {
              console.log("[AssetLab3DPanel] Host persisted model buffer (LS):", r.key, r.bytes);
              status.textContent = "🟡 Host Persist ok (LS)";

              this.store.update("app", (a) => {
                applySlotStatusUpdate({ app: a, projectAssetId, slotId, fileName: effectiveName, updatedAt, kind: payload?.kind || "import", lastAction: "import", thumbnail: payload?.thumbnail });
              });
              this._requestSave("slotUpdatePersist:ls");
            } else {
              status.textContent = "⚠️ Host Persist fehlgeschlagen";
            }
          })();
        } else {
          // Kein Buffer angekommen: wenn "no persist" -> reqBuffer versuchen
          const la = String(payload?.lastAction || "").toLowerCase();
          const kind = String(payload?.kind || "").toLowerCase();
          const nameOk = String(effectiveName || "").length > 0;

          if ((la.includes("no persist") || la.includes("pending") || kind === "import") && nameOk) {
            requestBufferFromIframe(projectAssetId, slotId);
          }
        }

        // Immer Slot Status updaten (auch wenn Persist separat passiert)
        this.store.update("app", (a) => {
          applySlotStatusUpdate({
            app: a,
            projectAssetId,
            slotId,
            fileName: effectiveName,
            updatedAt,
            kind: payload?.kind || "import",
            lastAction: payload?.lastAction || payload?.kind || "",
            thumbnail: payload?.thumbnail,
          });

          const asset = findProjectAsset(a, projectAssetId);
          const slot = asset?.slots?.find?.((s) => s && s.id === slotId);
          if (slot) {
            if (effectiveName) slot.lastImportName = effectiveName;
            if (String(payload?.lastAction || "").toLowerCase().includes("import")) slot.hasModel = true;
          }
        });
        this._requestSave("slotUpdate:meta");

        return;
      }
    };

    window.addEventListener("message", onMsg);
    this._onMsg = onMsg;

    root.appendChild(iframeWrap);

    root.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: Falls iOS/Safari IndexedDB blockiert, nutzt der Host automatisch einen localStorage-Fallback (Base64) nur für MODEL BUFFER."
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

export default AssetLab3DPanel;

// ------------------------------------------------------------
// Asset Catalog Cache (Generic)
// ------------------------------------------------------------
// NOTE:
// - AssetLab läuft als Host-Panel. Wir nutzen Catalog optional, um Slot.catalogId
//   nach Import automatisch zu setzen (deterministisch für Workarea).
let __assetCatalog = null;
let __assetCatalogPromise = null;

function loadAssetCatalogOnce() {
  if (__assetCatalog) return Promise.resolve(__assetCatalog);
  if (__assetCatalogPromise) return __assetCatalogPromise;

  __assetCatalogPromise = fetch("./data/assets.catalog.v1.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      __assetCatalog = j || { items: [] };
      return __assetCatalog;
    })
    .catch((e) => {
      console.warn("[AssetLab3DPanel] Catalog load failed:", e);
      __assetCatalog = { items: [] };
      return __assetCatalog;
    });

  return __assetCatalogPromise;
}

function matchCatalogIdByText(text, catalogJson) {
  const t = String(text || "").trim();
  if (!t) return null;

  const items = Array.isArray(catalogJson?.items) ? catalogJson.items : [];
  for (const it of items) {
    const pats = Array.isArray(it?.autoMatch?.patterns) ? it.autoMatch.patterns : [];
    for (const p of pats) {
      try {
        const re = new RegExp(String(p), "i");
        if (re.test(t)) return String(it.id);
      } catch (_) {}
    }
  }
  return null;
}

// Sofort-Guess (falls Catalog noch nicht geladen ist)
function quickCatalogGuess(name) {
  const n = String(name || "").toLowerCase();
  if (!n) return null;
  if (n.includes("rollerbahn") || n.includes("rollenbahn") || n.includes("rb")) return "conveyor.rollerbahn.v1";
  if (n.includes("transferwagen") || n.includes("verschiebewagen") || n.includes("transfercar") || n.includes("vw")) return "conveyor.transferwagen.vB.v1";
  if (n.includes("skid")) return "logistics.skid.production.v1";
  return null;
}
