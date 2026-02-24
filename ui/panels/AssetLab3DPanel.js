/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.0.2-clean-standard (patched)
 *
 * Panel: Assets → AssetLab 3D (iframe)
 */

import { PanelBase } from "./PanelBase.js";
import { h, clear } from "../components/ui-dom.js";
import { FormField } from "../components/FormField.js";
import { Section } from "../components/Section.js";

// AssetLab Slot-Persistenz (same-origin IndexedDB, shared between parent + iframe)
import { idbPut, idbGet, makeModelKey } from "../../modules/assetlab3d/shared/idb-util.js";

function safeClone(obj) {
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch { /* ignore */ }
  try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
}

function findProjectAsset(app, id) {
  // Reihenfolge: app.project -> app.settings -> project (export) -> meta/settings Fallback
  const candidates = [
    app?.project?.projectAssets,
    app?.settings?.projectAssets,
    app?.projectAssets,                  // falls mal direkt
  ];

  for (const arr of candidates) {
    if (Array.isArray(arr) && id) {
      const hit = arr.find((a) => a && a.id === id);
      if (hit) return hit;
    }
  }
  return null;
}

// Persist Keys (redundant, aber robust)
const KEY_PROJECTFILE_PREFIX = "baustellenplaner:projectfile:";
const KEY_APPPERSIST_PREFIX = "baustellenplaner:project:";

function persistProjectSnapshot(project) {
  try {
    const id = project?.id;
    if (!id) return;

    try {
      localStorage.setItem(`${KEY_PROJECTFILE_PREFIX}${id}`, JSON.stringify(project, null, 2));
    } catch { /* ignore */ }

    try {
      const payload = {
        project,
        settings: {},
        ui: { drafts: {} },
        _meta: { savedAt: new Date().toISOString(), projectId: id }
      };
      localStorage.setItem(`${KEY_APPPERSIST_PREFIX}${id}`, JSON.stringify(payload));
    } catch { /* ignore */ }
  } catch { /* ignore */ }
}

function applySlotStatusUpdate({ app, projectAssetId, slotId, fileName, updatedAt, kind, lastAction }) {
  if (!app) return;
  const list = Array.isArray(app?.project?.projectAssets) ? app.project.projectAssets
    : Array.isArray(app?.settings?.projectAssets) ? app.settings.projectAssets
      : null;
  if (!list) return;

  const asset = list.find((a) => a && a.id === projectAssetId);
  if (!asset) return;

  asset.slots = Array.isArray(asset.slots) ? asset.slots : [];
  const slot = asset.slots.find((s) => s && s.id === slotId);
  if (!slot) return;

  slot.updatedAt = updatedAt || new Date().toISOString();

  // ✅ PATCH: lastAction separat führen (menschlicher Text), kind bleibt Enum
  slot.lastAction = lastAction || kind || "";

  // Import / Restore
  if (kind === "import" || kind === "restore") {
    slot.hasModel = true;
    slot.lastImportName = fileName || slot.lastImportName || "";
  }

  // Export
  if (kind === "export") {
    slot.exportRef = {
      fileName: fileName || (slot.exportRef ? slot.exportRef.fileName : ""),
      updatedAt: slot.updatedAt,
    };
  }

  // Spiegeln
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
    return {
      showReset: false,
      showApply: false,
      note: "AssetLab läuft als iframe. Preset-Metadaten werden im Projekt gespeichert."
    };
  }

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const pid = app?.project?.id || "unknown";

    const ctx = app?.ui?.assetlab?.context || null;
    const mode = ctx?.mode || ctx?.type || null;
    const assetId = mode === "projectAsset" ? ctx?.projectAssetId : null;
    const asset = findProjectAsset(app, assetId);

    const preset = safeClone(asset?.presetTransform || { sx: 1, sy: 1, sz: 1, ryDeg: 0, ox: 0, oy: 0, oz: 0 });

    return {
      projectId: pid,
      context: ctx,
      contextAsset: asset ? { id: asset.id, name: asset.name || "" } : null,
      presetTransform: preset
    };
  }

  applyDraftToStore() { /* not used */ }

  renderBody(root, draft) {
    clear(root);

    const projectId = draft?.projectId || "unknown";

    let iframeSrc = `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    const ctx = draft?.context || null;
    const ctxAsset = draft?.contextAsset || null;

    const mode = ctx?.mode || ctx?.type || null;
    if (mode === "projectAsset" && ctx?.projectAssetId) {
      const slotId = ctx?.slotId || "s1";
      iframeSrc += `&contextAssetId=${encodeURIComponent(ctx.projectAssetId)}`;
      iframeSrc += `&slotId=${encodeURIComponent(slotId)}`;
    }

    const bar = h("div", {
      style: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        margin: "0 0 10px",
        flexWrap: "wrap"
      }
    });

    const btnReload = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => {
        if (this._iframe) this._iframe.src = this._iframe.src;
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
      const form = h("div", { style: { marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(3, minmax(140px, 1fr))", gap: "10px" } });

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
            app.project = app.project || {};
            app.project.projectAssets = Array.isArray(app.project.projectAssets) ? app.project.projectAssets : [];
            app.settings = app.settings || {};
            app.settings.projectAssets = Array.isArray(app.settings.projectAssets) ? app.settings.projectAssets : [];

            const list = app.project.projectAssets.length ? app.project.projectAssets : app.settings.projectAssets;

            const a = list.find((x) => x && x.id === assetId);
            if (a) a.presetTransform = preset;

            app.project.projectAssets = list;
            app.settings.projectAssets = list;
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

    // -------------------------------------------------------------------
    // ✅ PATCH: Host->iframe init/restore mit ns + Transferables
    // -------------------------------------------------------------------
    const sendInit = (reason = "manual") => {
      try {
        const app = this.store.get("app") || {};
        const ctx = app?.ui?.assetlab?.context || null;

        const projectAssetId = ctx?.projectAssetId || null;
        const slotId = ctx?.slotId || null;
        this._lastCtx = { projectAssetId, slotId };

        let hasModel = false;
        if (projectAssetId && slotId) {
          const asset = findProjectAsset(app, projectAssetId);
          const slot = asset?.slots?.find?.((s) => s && s.id === slotId) || null;
          hasModel = !!(
           slot?.hasModel ||
           slot?.model ||
           slot?.exportRef ||
           (slot?.lastImportName && String(slot.lastImportName).trim().length > 0) ||
           (slot?.lastAction && String(slot.lastAction).includes("import"))
           );
        }

        iframe.contentWindow?.postMessage({
          ns: "assetlab",
          type: "assetlab:init",
          reason,
          payload: { projectId, projectAssetId, slotId, hasModel }
        }, window.location.origin);

        // Restore (Host -> iframe)
        if (projectAssetId && slotId && hasModel) {
          const key = makeModelKey(projectAssetId, slotId);
          void (async () => {
            try {
              const rec = await idbGet(key);
              if (rec && rec.buffer) {
                // ✅ Transferable + ns
                iframe.contentWindow?.postMessage({
                  ns: "assetlab",
                  type: "assetlab:restore",
                  payload: {
                    projectId,
                    projectAssetId,
                    slotId,
                    fileName: rec.fileName || "restored.glb",
                    buffer: rec.buffer
                  }
                }, window.location.origin, [rec.buffer]);
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

    iframe.addEventListener("load", () => sendInit("iframe-load"));
    setTimeout(() => sendInit("iframe-timeout"), 50);

    const onMsg = (ev) => {
      if (!ev || !ev.data) return;
      if (ev.source && ev.source !== iframe.contentWindow) return;

      const { type, payload } = ev.data || {};

      if (type === "assetlab:init" && payload && payload.want === "context") {
        sendInit("iframe-request");
        return;
      }

      if (type === "assetlab:ready") {
        status.textContent = "🟢 AssetLab bereit";
        sendInit("ready");

        const app = this.store.get("app") || {};
        const pendingCmd = app?.ui?.assetlab?.pendingCmd || null;
        if (pendingCmd && pendingCmd.cmd) {
          iframe.contentWindow?.postMessage(
            { ns: "assetlab", type: "assetlab:cmd", payload: pendingCmd },
            window.location.origin
          );

          this.store.update("app", (a) => {
            a.ui = a.ui || {};
            a.ui.assetlab = a.ui.assetlab || {};
            a.ui.assetlab.pendingCmd = null;
          });
        }
        return;
      }

      if (type === "assetlab:log") {
        const msg = payload?.msg || "";
        if (msg) status.textContent = `ℹ️ ${msg}`;
        return;
      }

      if (type === "assetlab:slotUpdate" || type === "assetlab:payload") {
        const app = this.store.get("app") || {};
        const ctx = app?.ui?.assetlab?.context;
        const projectAssetId = ctx?.projectAssetId || payload?.projectAssetId;
        const slotId = payload?.slotId;
        if (!projectAssetId || !slotId) return;

        // ✅ Host persist fallback: Buffer mitschicken -> IDB speichern
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
        }

        this.store.update("app", (a) => {
          applySlotStatusUpdate({
            app: a,
            projectAssetId,
            slotId,
            fileName: payload?.fileName || "",
            updatedAt: payload?.updatedAt || new Date().toISOString(),
            kind: payload?.kind || "",
            lastAction: payload?.lastAction || "",
          });

          persistProjectSnapshot(a.project);
        });

        this.bus?.emit?.("cb:assetlab:slotUpdated", { projectAssetId, slotId, kind: payload?.kind || "" });
        return;
      }
    };

    window.addEventListener("message", onMsg);
    this._onMsg = onMsg;

    root.appendChild(iframeWrap);

    root.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: AssetLab Lite ist aktuell ein Viewer/Quick-Editor. Projekt-Integration (Assets übernehmen/exportieren) bauen wir als Nächstes aus."
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
