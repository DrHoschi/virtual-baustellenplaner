/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.1.0 - responsive-ui-clean (2026-02-25)
 *
 * UI Update:
 *  - Responsive Preset Grid
 *  - Flex Layout statt calc()
 *  - Saubere Toolbar
 *
 * LOGIK UNVERÄNDERT.
 */

import { PanelBase } from "./PanelBase.js";
import { h, clear } from "../components/ui-dom.js";
import { FormField } from "../components/FormField.js";
import { Section } from "../components/Section.js";
import { idbPut, idbGet, makeModelKey } from "../../modules/assetlab3d/shared/idb-util.js";

/* ============================================================================
 * (ALLE HELPER FUNKTIONEN UNVERÄNDERT)
 * ========================================================================== */

/* --- deine komplette Helper-Sektion bleibt exakt gleich --- */
/* (aus Platzgründen hier nicht erneut gekürzt) */
/* BITTE: Lasse deinen bestehenden Helper-Code unverändert stehen */

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
    const ctxTxt = mode === "projectAsset" && ctx?.projectAssetId
      ? ` · Kontext: ${ctx.projectAssetId}`
      : "";
    return (pid ? `Projekt-ID: ${pid}` : "") + ctxTxt;
  }

  getToolbarConfig() {
    return {
      showReset: false,
      showApply: false,
      note: "AssetLab läuft als iframe. Preset-Metadaten werden im Projekt gespeichert."
    };
  }

  _requestSave(reason = "assetlab") {
    try { this.bus?.emit?.("ui:project:save", { reason }); } catch {}
    try { this.bus?.emit?.("ui:save", { reason }); } catch {}
  }

  renderBody(root, draft) {

    clear(root);

    /* ============================================================
       Root Container (Flex Layout)
       ============================================================ */

    const container = h("div", { className: "bp-assetlab-root" });
    root.appendChild(container);

    const projectId = draft?.projectId || "unknown";
    const ctx = draft?.context || null;
    const ctxAsset = draft?.contextAsset || null;

    let iframeSrc =
      `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    const mode = ctx?.mode || ctx?.type || null;
    if (mode === "projectAsset" && ctx?.projectAssetId) {
      const slotId = ctx?.slotId || "s1";
      iframeSrc += `&contextAssetId=${encodeURIComponent(ctx.projectAssetId)}`;
      iframeSrc += `&slotId=${encodeURIComponent(slotId)}`;
    }

    /* ============================================================
       Toolbar
       ============================================================ */

    const bar = h("div", { className: "bp-assetlab-toolbar" });

    const btnReload = h("button", {
      className: "bp-btn",
      onclick: () => { if (this._iframe) this._iframe.src = this._iframe.src; }
    }, "↻ Reload");

    const btnPopout = h("button", {
      className: "bp-btn",
      onclick: () => window.open(iframeSrc, "_blank")
    }, "↗︎ In neuem Tab");

    const status = h("span", { className: "bp-assetlab-status" }, "");

    bar.appendChild(btnReload);
    bar.appendChild(btnPopout);
    bar.appendChild(status);

    container.appendChild(bar);

    /* ============================================================
       Kontext Section
       ============================================================ */

    const ctxSec = new Section({
      title: "Kontext",
      description: "Wenn du ein Projekt-Asset öffnest, speichert dieses Panel hier Preset-Metadaten im Projekt."
    });

    const ctxRow = h("div", { className: "bp-assetlab-context-row" });

    const ctxText = h("div", { style: { fontSize: "13px", opacity: ".85" } },
      (mode === "projectAsset") && ctxAsset
        ? `Projekt-Asset: ${ctxAsset.name || "(ohne Name)"} · id: ${ctxAsset.id}`
        : "Kein Projekt-Asset Kontext (AssetLab als freier Viewer)."
    );

    const btnClearCtx = h("button", {
      className: "bp-btn",
      onclick: () => {
        this.store.update("app", (app) => {
          app.ui = app.ui || {};
          app.ui.assetlab = app.ui.assetlab || {};
          app.ui.assetlab.context = null;
        });
        this._requestSave("context:clear");
        this.draft = this.buildDraftFromStore();
        this._rerender();
      }
    }, "Kontext löschen");

    ctxRow.appendChild(ctxText);
    ctxRow.appendChild(btnClearCtx);
    ctxSec.append(ctxRow);

    /* ============================================================
       Preset Grid (Responsive)
       ============================================================ */

    if (mode === "projectAsset" && ctx?.projectAssetId) {

      const form = h("div", {
        className: "bp-assetlab-grid",
        style: { marginTop: "10px" }
      });

      const p = draft?.presetTransform || {};

      const makeNum = (label, key, step = "0.1") =>
        FormField({
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
        style: { marginTop: "10px" },
        onclick: () => {
          const assetId = ctx.projectAssetId;
          const preset = structuredClone(draft.presetTransform || {});
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

    container.appendChild(ctxSec.el);

    /* ============================================================
       Iframe (Flex Height)
       ============================================================ */

    const iframeWrap = h("div", {
      className: "bp-assetlab-iframe-wrap"
    });

    const iframe = document.createElement("iframe");
    iframe.src = iframeSrc;
    iframe.allow = "fullscreen";

    this._iframe = iframe;
    iframeWrap.appendChild(iframe);

    container.appendChild(iframeWrap);

    /* ============================================================
       Hinweis
       ============================================================ */

    container.appendChild(
      h("div", {
        style: { opacity: ".65", fontSize: "12px" }
      },
      "Hinweis: Falls iOS/Safari IndexedDB blockiert, nutzt der Host automatisch einen localStorage-Fallback (Base64) nur für MODEL BUFFER."
      )
    );
  }

  unmount() {
    this._iframe = null;
    super.unmount();
  }
}

export default AssetLab3DPanel;
