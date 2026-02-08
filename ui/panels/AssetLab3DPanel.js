/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.0.1-clean-standard (2026-02-08)
 *
 * Panel: Assets → AssetLab 3D (iframe)
 * ============================================================================
 * Rolle im System (jetzt sofort nutzbar)
 * -------------------------------------
 * AssetLab (Lite) ist aktuell unser:
 * - Viewer / Quick-Editor (Import/Orbit/Export)
 * - später: echter Editor (wenn Vendor/Editor vollständig integriert ist)
 *
 * WICHTIG (Clean-Standard):
 * - AssetLab selbst soll KEINE "eigene" Asset-Library verwalten.
 * - Die Wahrheit liegt im Baustellenplaner:
 *    - Projekt-Assets (projekt-spezifisch): app.settings.projectAssets
 *    - Bibliotheken (global): (später) app.settings.libraryBindings / libraryIndex
 *
 * Kontext-Übergabe (Projekt-Asset → AssetLab)
 * -------------------------------------------
 * Wenn du im Projekt-Assets Panel auf „In AssetLab öffnen“ klickst, setzen wir:
 *   app.ui.assetlab.context = { mode:"projectAsset", projectAssetId:"A-...." }
 *
 * Dieses Panel zeigt dann oben:
 * - Kontextanzeige
 * - ein kleines Preset-Transform Formular (nur Metadaten; kein 3D-Gizmo-Override)
 *
 * Hinweis:
 * - Die 3D-Szene selbst läuft im iframe unter modules/assetlab3d/iframe/
 * - Kommunikation läuft minimal per postMessage (ready/init/log).
 */

import { PanelBase } from "./PanelBase.js";
import { h, clear } from "../components/ui-dom.js";
import { FormField } from "../components/FormField.js";
import { Section } from "../components/Section.js";

function safeClone(obj) {
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch { /* ignore */ }
  try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
}

function findProjectAsset(app, id) {
  const arr = app?.settings?.projectAssets;
  if (!Array.isArray(arr) || !id) return null;
  return arr.find((a) => a && a.id === id) || null;
}

export class AssetLab3DPanel extends PanelBase {
  getTitle() { return "Assets – AssetLab 3D"; }

  getDescription() {
    const app = this.store.get("app") || {};
    const pid = app?.project?.id || "";
    const ctx = app?.ui?.assetlab?.context;
    const ctxMode = ctx?.mode || ctx?.type || null;
    const ctxTxt = ctxMode === "projectAsset" && ctx?.projectAssetId ? ` · Kontext: ${ctx.projectAssetId}` : "";
    return (pid ? `Projekt-ID: ${pid}` : "") + ctxTxt;
  }

  getToolbarConfig() {
    // PanelBase-Toolbar (Apply/Reset) hier nicht nötig – wir speichern gezielt per Button.
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
    const assetId = ctxMode === "projectAsset" ? ctx?.projectAssetId : null;
    const asset = findProjectAsset(app, assetId);

    // Preset-Defaults (falls noch nichts vorhanden)
    const preset = safeClone(asset?.presetTransform || { sx: 1, sy: 1, sz: 1, ryDeg: 0, ox: 0, oy: 0, oz: 0 });

    return {
      projectId: pid,
      context: ctx,
      contextAsset: asset ? { id: asset.id, name: asset.name || "" } : null,
      presetTransform: preset
    };
  }

  applyDraftToStore() {
    // bewusst NICHT genutzt (Toolbar aus). Speichern passiert per Button.
  }

  renderBody(root, draft) {
    clear(root);

    const projectId = draft?.projectId || "unknown";
    const iframeSrc = `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    // -----------------------------------------------------------------------
    // Kopfzeile (Buttons + Status + Kontext)
    // -----------------------------------------------------------------------
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

    root.appendChild(bar);

    // -----------------------------------------------------------------------
    // Kontext + Preset (nur wenn aus Projekt-Asset geöffnet)
    // -----------------------------------------------------------------------
    const ctx = draft?.context;
    const ctxAsset = draft?.contextAsset;

    const ctxSec = new Section({
      title: "Kontext",
      description: "Wenn du ein Projekt-Asset öffnest, speichert dieses Panel hier Preset-Metadaten im Projekt."
    });

    const ctxRow = h("div", { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" } });

    const ctxText = h("div", { style: { fontSize: "13px", opacity: ".85" } },
      ctxMode === "projectAsset" && ctxAsset
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

    // Preset Form (nur wenn Kontext aktiv)
    if (ctxMode === "projectAsset" && ctx?.projectAssetId) {
      const form = h("div", { style: { marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(3, minmax(140px, 1fr))", gap: "10px" } });

      const p = draft?.presetTransform || {};
      const makeNum = (label, key, step = "0.1") => new FormField({
        label,
        type: "number",
        value: (p[key] ?? 0),
        inputProps: { step },
        onInput: (v) => {
          const n = Number(v);
          draft.presetTransform[key] = Number.isFinite(n) ? n : 0;
          this.markDirty(); // nur UI-Hinweis; wir speichern per Button
        }
      });

      form.appendChild(makeNum("Scale X", "sx").el);
      form.appendChild(makeNum("Scale Y", "sy").el);
      form.appendChild(makeNum("Scale Z", "sz").el);
      form.appendChild(makeNum("Rot Y (°)", "ryDeg", "1").el);
      form.appendChild(makeNum("Offset X", "ox").el);
      form.appendChild(makeNum("Offset Y", "oy").el);
      form.appendChild(makeNum("Offset Z", "oz").el);

      ctxSec.append(form);

      const btnSavePreset = h("button", {
        className: "bp-btn",
        type: "button",
        style: { marginTop: "10px" },
        onclick: () => {
          const assetId = ctx.projectAssetId;
          const preset = safeClone(draft.presetTransform || {});
          this.store.update("app", (app) => {
            app.settings = app.settings || {};
            app.settings.projectAssets = Array.isArray(app.settings.projectAssets) ? app.settings.projectAssets : [];

            const a = app.settings.projectAssets.find((x) => x && x.id === assetId);
            if (a) a.presetTransform = preset;
          });
          status.textContent = "Preset gespeichert";
          this.markSaved();
        }
      }, "Preset speichern");

      ctxSec.append(btnSavePreset);
    }

    root.appendChild(ctxSec.el);

    // -----------------------------------------------------------------------
    // Iframe-Container
    // -----------------------------------------------------------------------
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
    // optional: sandbox – nur wenn du es wirklich willst (same-origin + downloads erlaubt)
    // iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads");

    this._iframe = iframe;
    iframeWrap.appendChild(iframe);

    // --- postMessage Bridge (minimal) ---
    const onMsg = (ev) => {
      if (!ev || !ev.data) return;

      // Nur Nachrichten vom eigenen iframe akzeptieren (wichtig bei mehreren iframes)
      if (ev.source !== iframe.contentWindow) return;

      const { type, payload } = ev.data || {};

      if (type === "assetlab:ready") {
        status.textContent = "🟢 AssetLab bereit";
        iframe.contentWindow?.postMessage({ type: "assetlab:init", payload: { projectId } }, window.location.origin);
        return;
      }
      if (type === "assetlab:log") {
        const msg = payload?.msg || "";
        if (msg) status.textContent = `ℹ️ ${msg}`;
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
