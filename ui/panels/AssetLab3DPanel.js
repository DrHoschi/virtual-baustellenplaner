/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.1.0-assetlab-context-preset (2026-02-07)
 *
 * Projekt → AssetLab 3D (iframe)
 * =============================================================================
 * Dieses Panel ist das "Werkzeug" (Viewer/Import/Export) für Assets.
 *
 * WICHTIGES Architektur-Prinzip:
 * - AssetLab selbst ist KEINE Bibliothek.
 * - Daten liegen in:
 *   (1) Globaler Bibliothek ("Bibliotheken")
 *   (2) Projekt-Assets ("Projekt-Assets")
 * - AssetLab wird immer in einem Kontext geöffnet:
 *   - Kontext: none      → Standalone (Import/Export/Viewer)
 *   - Kontext: project   → Projekt-Asset (PresetTransform numerisch)
 *
 * Dieses Patch bringt:
 * - Kontextanzeige oben ("Kontext: Projekt-Asset …")
 * - Preset-Felder (Scale/RotationY/OffsetY) direkt im AssetLab-Panel
 * - "In AssetLab öffnen" aus Projekt-Assets setzt app.ui.assetlabContext
 *
 * Hinweis:
 * - Wir schreiben Presets ins Projekt (store.app.project.assets.items).
 * - Der iframe bekommt optional Query-Params (projectAssetId), ist aber nicht zwingend.
 */
import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeClone(obj) {
  try { if (typeof structuredClone === "function") return structuredClone(obj); } catch {}
  try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
}

function degToRad(deg) {
  const n = Number(deg);
  if (!isFinite(n)) return 0;
  return (n * Math.PI) / 180;
}

function radToDeg(rad) {
  const n = Number(rad);
  if (!isFinite(n)) return 0;
  return (n * 180) / Math.PI;
}

function ensureProjectAssets(project) {
  project = project || {};
  if (!project.assets || typeof project.assets !== "object") project.assets = { items: [], folders: [], settings: {} };
  if (!Array.isArray(project.assets.items)) project.assets.items = [];
  return project;
}

function findProjectAsset(project, projectAssetId) {
  ensureProjectAssets(project);
  return (project.assets.items || []).find(a => a && a.id === projectAssetId) || null;
}

function ensurePreset(asset) {
  asset.presetTransform = asset.presetTransform || { pos:[0,0,0], rot:[0,0,0], scale:[1,1,1] };
  const pt = asset.presetTransform;
  if (!Array.isArray(pt.pos)) pt.pos = [0,0,0];
  if (!Array.isArray(pt.rot)) pt.rot = [0,0,0];
  if (!Array.isArray(pt.scale)) pt.scale = [1,1,1];
  return pt;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export class AssetLab3DPanel extends PanelBase {
  getTitle() { return "Projekt – AssetLab 3D"; }

  getDescription() {
    const pid = this.store.get("app")?.project?.id || "";
    const ctx = this.store.get("app")?.ui?.assetlabContext || null;

    if (!pid) return "";
    if (ctx?.mode === "project" && ctx?.projectAssetId) {
      return `Projekt-ID: ${pid} · Kontext: Projekt-Asset ${ctx.projectAssetId}`;
    }
    return `Projekt-ID: ${pid}`;
  }

  getToolbarConfig() {
    // PanelBase-Toolbar (Apply/Reset) hier nicht nötig
    return {
      showReset: false,
      showApply: false,
      note: "AssetLab ist das Werkzeug (Viewer/Import/Export). PresetTransform wird hier numerisch gesetzt."
    };
  }

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const pid = app?.project?.id || "unknown";
    const ctx = app?.ui?.assetlabContext || null;

    return {
      projectId: pid,
      context: ctx && typeof ctx === "object" ? safeClone(ctx) : null
    };
  }

  renderBody(root, draft) {
    const projectId = draft?.projectId || "unknown";
    const ctx = draft?.context || null;

    // iframe URL (wir geben projectAssetId optional mit – ist später fürs iframe nützlich)
    const projectAssetId = (ctx?.mode === "project") ? (ctx?.projectAssetId || "") : "";
    const iframeSrc =
      `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`
      + (projectAssetId ? `&projectAssetId=${encodeURIComponent(projectAssetId)}` : "");

    // ------------------------------------------------------------
    // Header Bar (Reload/Popout/Status)
    // ------------------------------------------------------------
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

    const status = h("span", { style: { opacity: ".75", fontSize: "12px", marginLeft: "auto" } }, "…");

    bar.appendChild(btnReload);
    bar.appendChild(btnPopout);
    bar.appendChild(status);

    // ------------------------------------------------------------
    // Kontext-Block + Preset-Felder (NUR wenn Kontext=Projekt-Asset)
    // ------------------------------------------------------------
    const ctxWrap = h("div", {
      style: {
        display: "block",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "10px",
        padding: "10px",
        margin: "0 0 10px",
        background: "rgba(0,0,0,.18)"
      }
    });

    const ctxTitle = h("div", { style: { display:"flex", gap:"10px", alignItems:"baseline", flexWrap:"wrap" } },
      h("b", {}, "Kontext:"),
      h("span", { style: { opacity: ".85" } }, (ctx?.mode === "project" && projectAssetId) ? "Projekt-Asset" : "Kein Kontext (Standalone)")
    );

    const ctxSub = h("div", { style: { opacity: ".7", fontSize:"12px", marginTop:"4px" } },
      (ctx?.mode === "project" && projectAssetId)
        ? `Asset-ID: ${projectAssetId}`
        : "Du kannst importieren/exportieren. Für Preset-Editing öffne AssetLab aus „Projekt-Assets“."
    );

    ctxWrap.appendChild(ctxTitle);
    ctxWrap.appendChild(ctxSub);

    // Preset-Felder nur im Projekt-Kontext
    if (ctx?.mode === "project" && projectAssetId) {
      const app = this.store.get("app") || {};
      const project = ensureProjectAssets(app.project || {});
      const asset = findProjectAsset(project, projectAssetId);

      // Wenn Asset nicht gefunden: Hinweis statt Felder
      if (!asset) {
        ctxWrap.appendChild(
          h("div", { style: { marginTop:"8px", fontSize:"12px", opacity:".85" } },
            "⚠️ Projekt-Asset wurde nicht gefunden (evtl. gelöscht). Öffne es erneut aus „Projekt-Assets“."
          )
        );
      } else {
        // Name anzeigen (wenn vorhanden)
        const name = asset.name || "(ohne Name)";
        ctxWrap.appendChild(
          h("div", { style: { marginTop:"8px", fontSize:"12px", opacity:".85" } },
            `Name: ${name}`
          )
        );

        const pt = ensurePreset(asset);

        // Felder-Row
        const fields = h("div", { style: { display:"flex", gap:"10px", flexWrap:"wrap", marginTop:"10px", alignItems:"flex-end" } });

        // Scale (uniform)
        const inScale = h("input", {
          type: "number",
          step: "0.01",
          value: String(Number(pt.scale?.[0] ?? 1)),
          style: { width: "110px" },
          oninput: (e) => {
            const v = Number(e.target.value);
            const s = isFinite(v) && v > 0 ? v : 1;
            this._writePreset(projectAssetId, { scale: [s,s,s] });
          }
        });

        // RotY deg
        const inRot = h("input", {
          type: "number",
          step: "1",
          value: String(Math.round(radToDeg(Number(pt.rot?.[1] ?? 0)))),
          style: { width: "130px" },
          oninput: (e) => {
            const deg = Number(e.target.value);
            this._writePreset(projectAssetId, { rot: [0, degToRad(deg), 0] });
          }
        });

        // OffsetY
        const inOff = h("input", {
          type: "number",
          step: "0.01",
          value: String(Number(pt.pos?.[1] ?? 0)),
          style: { width: "130px" },
          oninput: (e) => {
            const y = Number(e.target.value) || 0;
            this._writePreset(projectAssetId, { pos: [0, y, 0] });
          }
        });

        const btnReset = h("button", {
          className: "bp-btn",
          type: "button",
          onclick: () => {
            this._writePreset(projectAssetId, { pos:[0,0,0], rot:[0,0,0], scale:[1,1,1] }, true);
            // UI-Felder aktualisieren (schnell/robust: rerender)
            this.rerender();
          }
        }, "Preset reset");

        fields.appendChild(h("div", {}, h("div", { style:{fontSize:"12px",opacity:".75"} }, "Scale"), inScale));
        fields.appendChild(h("div", {}, h("div", { style:{fontSize:"12px",opacity:".75"} }, "Rot Y (°)"), inRot));
        fields.appendChild(h("div", {}, h("div", { style:{fontSize:"12px",opacity:".75"} }, "Offset Y"), inOff));
        fields.appendChild(btnReset);

        ctxWrap.appendChild(fields);
      }
    }

    // ------------------------------------------------------------
    // iframe
    // ------------------------------------------------------------
    const iframeWrap = h("div", {
      style: {
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "10px",
        overflow: "hidden",
        height: "calc(100vh - 320px)",
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

    // ------------------------------------------------------------
    // postMessage Bridge (minimal)
    // ------------------------------------------------------------
    const onMsg = (ev) => {
      if (!ev || !ev.data) return;
      if (ev.source !== iframe.contentWindow) return;

      const { type, payload } = ev.data || {};

      if (type === "assetlab:ready") {
        status.textContent = "🟢 AssetLab bereit";
        iframe.contentWindow?.postMessage({
          type: "assetlab:init",
          payload: { projectId, projectAssetId }
        }, window.location.origin);
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

    root.appendChild(bar);
    root.appendChild(ctxWrap);
    root.appendChild(iframeWrap);
  }

  /**
   * Preset in den Store schreiben (Projekt-Asset)
   * - merge=false: wir mergen einzelne Felder (pos/rot/scale)
   * - force=true: kompletten Preset überschreiben
   */
  _writePreset(projectAssetId, patch, force = false) {
    try {
      this.store.update("app", (app) => {
        app.project = ensureProjectAssets(app.project || {});
        const a = findProjectAsset(app.project, projectAssetId);
        if (!a) return app;

        const pt = ensurePreset(a);

        if (force) {
          a.presetTransform = safeClone(patch);
        } else {
          if (patch.pos) pt.pos = safeClone(patch.pos);
          if (patch.rot) pt.rot = safeClone(patch.rot);
          if (patch.scale) pt.scale = safeClone(patch.scale);
        }

        // meta updatedAt
        a.meta = a.meta || {};
        try { a.meta.updatedAt = new Date().toISOString(); } catch {}

        return app;
      });
    } catch (e) {
      console.warn("Preset update failed", e);
    }
  }

  unmount() {
    if (this._onMsg) window.removeEventListener("message", this._onMsg);
    this._onMsg = null;
    this._iframe = null;
    super.unmount();
  }
}
