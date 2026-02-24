/**
 * ui/panels/AssetLab3DPanel.js
 * FINAL v1.0.4 - reqBuffer fallback
 *
 * Fixes:
 *  - robust hasModel detection
 *  - host persist fallback for payload.buffer
 *  - NEW: if (no persist) and no buffer in slotUpdate -> request buffer from iframe (assetlab:reqBuffer)
 *  - restore via IDB + Transferable
 */

import { PanelBase } from "./PanelBase.js";
import { h, clear } from "../components/ui-dom.js";
import { FormField } from "../components/FormField.js";
import { Section } from "../components/Section.js";
import { idbPut, idbGet, makeModelKey } from "../../modules/assetlab3d/shared/idb-util.js";

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

function persistProjectSnapshot(project) {
  try {
    const id = project?.id;
    if (!id) return;
    try { localStorage.setItem(`baustellenplaner:projectfile:${id}`, JSON.stringify(project, null, 2)); } catch {}
    try {
      const payload = { project, settings: {}, ui: { drafts: {} }, _meta: { savedAt: new Date().toISOString(), projectId: id } };
      localStorage.setItem(`baustellenplaner:project:${id}`, JSON.stringify(payload));
    } catch {}
  } catch {}
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

function applySlotStatusUpdate({ app, projectAssetId, slotId, fileName, updatedAt, kind, lastAction }) {
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
    slot.lastImportName = fileName || slot.lastImportName || "";
  }

  // Mirror both places so export + UI stay aligned
  app.project = app.project || {};
  app.settings = app.settings || {};
  app.project.projectAssets = list;
  app.settings.projectAssets = list;
}

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
            persistProjectSnapshot(app.project);
          });
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

    // --- helpers ---------------------------------------------------------

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

        // init
        iframe.contentWindow?.postMessage({
          ns: "assetlab",
          type: "assetlab:init",
          reason,
          payload: { projectId, projectAssetId, slotId, hasModel }
        }, window.location.origin);

        // restore if IDB has buffer
        if (projectAssetId && slotId && hasModel) {
          const key = makeModelKey(projectAssetId, slotId);

          void (async () => {
            try {
              const rec = await idbGet(key);
              if (rec && rec.buffer) {
                iframe.contentWindow?.postMessage({
                  ns: "assetlab",
                  type: "assetlab:restore",
                  payload: {
                    projectId,
                    projectAssetId,
                    slotId,
                    fileName: rec.fileName || (slot?.lastImportName || "restored.glb"),
                    buffer: rec.buffer
                  }
                }, window.location.origin, [rec.buffer]);
              } else {
                // IDB leer -> wir versuchen NICHT im Reopen zu "zaubern"
                // (Buffer kann nur direkt nach Import aus iframe RAM kommen)
                console.warn("[AssetLab3DPanel] restore skipped: no IDB record for", key);
              }
            } catch (e) {
              console.warn("[AssetLab3DPanel] restore send failed", e);
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

    // --- message bridge --------------------------------------------------

    const onMsg = (ev) => {
      if (!ev || !ev.data) return;
      if (ev.source && ev.source !== iframe.contentWindow) return;
      if (ev.origin !== window.location.origin) return;

      const { type, payload } = ev.data || {};

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

      // NEW: iframe sends buffer on request
      if (type === "assetlab:buffer") {
        const projectAssetId = payload?.projectAssetId;
        const slotId = payload?.slotId;
        const buf = payload?.buffer;
        const fileName = payload?.fileName || "";
        const updatedAt = payload?.updatedAt || new Date().toISOString();

        if (!projectAssetId || !slotId || !buf) return;

        const key = makeModelKey(projectAssetId, slotId);

        void (async () => {
          try {
            await idbPut(key, { fileName, updatedAt, buffer: buf });
            console.log("[AssetLab3DPanel] Host persisted buffer via reqBuffer:", key, buf.byteLength);
            status.textContent = "🟢 Host Persist ok";
          } catch (e) {
            console.warn("[AssetLab3DPanel] Host persist (reqBuffer) failed:", e);
            status.textContent = "⚠️ Host Persist fehlgeschlagen";
          }
        })();

        return;
      }

      // SlotUpdate from iframe
      if (type === "assetlab:slotUpdate" || type === "assetlab:payload") {
        const app = this.store.get("app") || {};
        const ctxNow = app?.ui?.assetlab?.context;

        const projectAssetId = ctxNow?.projectAssetId || payload?.projectAssetId;
        const slotId = payload?.slotId;

        if (!projectAssetId || !slotId) return;

        // 1) Host persist if buffer exists
        if (payload?.buffer && (payload.buffer instanceof ArrayBuffer || typeof payload.buffer?.byteLength === "number")) {
          const buf = payload.buffer;
          const fileName = payload?.fileName || "";
          const updatedAt = payload?.updatedAt || new Date().toISOString();
          const key = makeModelKey(projectAssetId, slotId);

          void (async () => {
            try {
              await idbPut(key, { fileName, updatedAt, buffer: buf });
              console.log("[AssetLab3DPanel] Host persisted model buffer into IDB:", key, buf.byteLength);
            } catch (e) {
              console.warn("[AssetLab3DPanel] Host persist failed:", e);
            }
          })();
        } else {
          // 2) NEW: no buffer included -> if it smells like no-persist import, request it immediately
          const la = String(payload?.lastAction || "").toLowerCase();
          const kind = String(payload?.kind || "").toLowerCase();
          if ((la.includes("no persist") || la.includes("pending") || kind === "import") && String(payload?.fileName || "").length > 0) {
            requestBufferFromIframe(projectAssetId, slotId);
          }
        }

        // 3) Update store meta
        this.store.update("app", (a) => {
          applySlotStatusUpdate({
            app: a,
            projectAssetId,
            slotId,
            fileName: payload?.fileName || "",
            updatedAt: payload?.updatedAt || new Date().toISOString(),
            kind: payload?.kind || "import",
            lastAction: payload?.lastAction || payload?.kind || "",
          });

          const asset = findProjectAsset(a, projectAssetId);
          const slot = asset?.slots?.find?.((s) => s && s.id === slotId);
          if (slot) {
            if (payload?.fileName) slot.lastImportName = payload.fileName;
            if (String(payload?.lastAction || "").toLowerCase().includes("import")) slot.hasModel = true;
          }

          persistProjectSnapshot(a.project);
        });

        return;
      }
    };

    window.addEventListener("message", onMsg);
    this._onMsg = onMsg;

    root.appendChild(iframeWrap);

    root.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: AssetLab Lite ist aktuell ein Viewer/Quick-Editor. Projekt-Integration bauen wir als Nächstes aus."
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

// ✅ IMPORTANT: Playwright/Test importiert named export; einige Stellen im App-Code nutzen default.
// -> Wir liefern BEIDES:
export default AssetLab3DPanel;
