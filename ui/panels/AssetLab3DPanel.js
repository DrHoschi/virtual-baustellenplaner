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

// AssetLab Slot-Persistenz (same-origin IndexedDB, shared between parent + iframe)
import { idbPut, makeModelKey } from "../../modules/assetlab3d/shared/idb-util.js";

function safeClone(obj) {
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch { /* ignore */ }
  try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
}

function findProjectAsset(app, id) {
  const arr = app?.project?.projectAssets || app?.settings?.projectAssets;
  if (!Array.isArray(arr) || !id) return null;
  return arr.find((a) => a && a.id === id) || null;
}

// Persist Keys (redundant, aber robust)
const KEY_PROJECTFILE_PREFIX = "baustellenplaner:projectfile:";
const KEY_APPPERSIST_PREFIX = "baustellenplaner:project:";

function persistProjectSnapshot(project) {
  try {
    const id = project?.id;
    if (!id) return;

    // (1) projectfile (Wizard/Projektliste)
    try {
      localStorage.setItem(`${KEY_PROJECTFILE_PREFIX}${id}`, JSON.stringify(project, null, 2));
    } catch {
      // ignore
    }

    // (2) appPersistor Payload
    try {
      const payload = {
        project,
        settings: {},
        ui: { drafts: {} },
        _meta: { savedAt: new Date().toISOString(), projectId: id }
      };
      localStorage.setItem(`${KEY_APPPERSIST_PREFIX}${id}`, JSON.stringify(payload));
    } catch {
      // ignore
    }
  } catch {
    // Persistenz darf NIE crashen.
  }
}

function applySlotStatusUpdate({ app, projectAssetId, slotId, fileName, updatedAt, kind }) {
  if (!app) return;
  const list = Array.isArray(app?.project?.projectAssets) ? app.project.projectAssets
    : Array.isArray(app?.settings?.projectAssets) ? app.settings.projectAssets
      : null;
  if (!list) return;

  const asset = list.find((a) => a && a.id === projectAssetId);
  if (!asset) return;

  // Slot-Format sicherstellen
  asset.slots = Array.isArray(asset.slots) ? asset.slots : [];
  const slot = asset.slots.find((s) => s && s.id === slotId);
  if (!slot) return;

  slot.updatedAt = updatedAt || new Date().toISOString();
  slot.lastAction = kind || "";

  // Import / Restore
  // Restore kommt z.B. beim erneuten Oeffnen, wenn ein Modell in IDB liegt.
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

  // Spiegeln, damit Alt-Pfade funktionieren
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
    const mode = ctx?.mode || ctx?.type || null;
    const assetId = mode === "projectAsset" ? ctx?.projectAssetId : null;
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

    // ---------------------------------------------------------------------
    // IFrame-URL
    // IMPORTANT:
    // - Ohne Kontext-Parameter weiss das AssetLab nicht, welches Projekt-Asset
    //   und welcher Slot gemeint ist. Dann kann es weder IDB-Keys sauber
    //   bilden noch per postMessage Slot-Updates an den Host senden.
    // - Das war der Grund fuer "nach Reload ist alles wieder leer".
    // ---------------------------------------------------------------------
    let iframeSrc = `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(projectId)}`;

    // Kontext aus dem Draft nur EINMAL definieren (sonst SyntaxError: ctx already declared)
    const ctx = draft?.context || null;
    const ctxAsset = draft?.contextAsset || null;

    const mode = ctx?.mode || ctx?.type || null;
    if (mode === "projectAsset" && ctx?.projectAssetId) {
      const slotId = ctx?.slotId || "s1";
      iframeSrc += `&contextAssetId=${encodeURIComponent(ctx.projectAssetId)}`;
      iframeSrc += `&slotId=${encodeURIComponent(slotId)}`;
    }

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

    // Preset Form (nur wenn Kontext aktiv)
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
          this.markDirty(); // nur UI-Hinweis; wir speichern per Button
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

            // Kanonisch: Projekt-Assets liegen im Projektobjekt.
            const list = app.project.projectAssets.length ? app.project.projectAssets : app.settings.projectAssets;

            const a = list.find((x) => x && x.id === assetId);
            if (a) a.presetTransform = preset;

            // Spiegeln, damit Alt-Pfade weiter funktionieren
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

    // -------------------------------------------------------------------
    // Handshake-Fix (Race-Condition):
    //
    // Das iframe kann in manchen Situationen schneller sein als unser
    // message-listener (oder Safari/iOS verliert `ev.source`). Dann kommt
    // "assetlab:ready" nie an -> wir schicken kein init -> iframe hat
    // keinen Slot-Context ("import ok (no slot ctx)").
    //
    // Fix: Init wird auch pro-aktiv nach iframe-load + per kurzer Timeout-
    // Absicherung gesendet (idempotent).
    // -------------------------------------------------------------------
    // Init-Retry (iOS/Safari): wir senden `assetlab:init` mehrfach,
// bis das iframe ein `assetlab:init:ack` zurückschickt.
// So stellen wir sicher, dass der Slot-Context IMMER ankommt,
// bevor der User importiert (sonst: "import ok (no persist)").
let _initAcked = false;
let _initRetryTimer = null;

const startInitRetry = (reason = "auto") => {
  _initAcked = false;
  if (_initRetryTimer) {
    clearInterval(_initRetryTimer);
    _initRetryTimer = null;
  }
  let tries = 0;
  _initRetryTimer = setInterval(() => {
    tries++;
    // Sicherheitsbremse: nach ~6 Sekunden aufgeben
    if (_initAcked || tries > 12) {
      clearInterval(_initRetryTimer);
      _initRetryTimer = null;
      return;
    }
    sendInit(`retry:${reason}:${tries}`);
  }, 500);
};

const sendInit = (reason = "manual") => {
      try {
        // Kontext + Pending-Cmd aus dem Store lesen (vom ProjectAssetsPanel gesetzt)
        const app = this.store.get("app") || {};
        const ctx = app?.ui?.assetlab?.context || null;

        // AssetLab-Lite erwartet flache Keys:
        //   { projectId, projectAssetId, slotId, hasModel }
        const projectAssetId = ctx?.projectAssetId || null;
        const slotId = ctx?.slotId || null;
        this._lastCtx = { projectAssetId, slotId };

        let hasModel = false;
        if (projectAssetId && slotId) {
          const asset = findProjectAsset(app, projectAssetId);
          const slot = asset?.slots?.find?.((s) => s && s.id === slotId) || null;
          hasModel = !!(slot?.hasModel || slot?.model || slot?.exportRef || slot?.lastImportName);
        }

        iframe.contentWindow?.postMessage({
          type: "assetlab:init",
          reason,
          payload: { projectId, projectAssetId, slotId, hasModel }
        }, window.location.origin);
        // Wenn das iframe die Init noch nicht bestätigt hat, starten wir Retry.
        if (!String(reason).startsWith("retry:")) startInitRetry(reason);
      } catch (e) {
        console.warn("[AssetLab3DPanel] sendInit failed", e);
      }
    };

    iframe.addEventListener("load", () => sendInit("iframe-load"));
    setTimeout(() => sendInit("iframe-timeout"), 50);

    // --- postMessage Bridge (minimal) ---
    const onMsg = (ev) => {
      if (!ev || !ev.data) return;

      // Nur Nachrichten vom eigenen iframe akzeptieren (wichtig bei mehreren iframes)
      // NOTE (iOS/Safari/WebViews): `ev.source` kann NULL sein. Dann koennen wir
      // die Quelle nicht hart verifizieren – wir verlassen uns auf Origin + type.
      if (ev.source && ev.source !== iframe.contentWindow) return;

      const { type, payload } = ev.data || {};

      // ---------------------------------------------------------------------
      // Init-Handshake (stabiler Context-Setup)
      // ---------------------------------------------------------------------
      // 1) iframe bestätigt, dass es den Init-Context erhalten hat → Retry stop
      if (type === "assetlab:init:ack") {
        _initAcked = true;
        if (_initRetryTimer) {
          clearInterval(_initRetryTimer);
          _initRetryTimer = null;
        }
        return;
      }

      // 2) iframe fordert Init erneut an (z.B. Import gedrückt, aber Context fehlt)
      if (type === "assetlab:requestInit") {
        sendInit("requestInit");
        return;
      }

      if (type === "assetlab:ready") {
        status.textContent = "🟢 AssetLab bereit";
        // Init idempotent senden (Handshake)
        sendInit("ready");

        // Optional: einmalig eine PendingCmd schicken (z.B. Export)
        const app = this.store.get("app") || {};
        const pendingCmd = app?.ui?.assetlab?.pendingCmd || null;
        if (pendingCmd && pendingCmd.cmd) {
          iframe.contentWindow?.postMessage({ type: "assetlab:cmd", payload: pendingCmd }, window.location.origin);

          // PendingCmd im Store leeren, damit es nicht erneut feuert
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

      // Slot-Status Update vom iframe (Import/Export)
      // Kompatibilität: ältere Stände senden "assetlab:payload".
      if (type === "assetlab:slotUpdate" || type === "assetlab:payload") {
        const app = this.store.get("app") || {};
        const ctx = app?.ui?.assetlab?.context;
        const projectAssetId = ctx?.projectAssetId || payload?.projectAssetId;
        const slotId = payload?.slotId;
        if (!projectAssetId || !slotId) return;

        // -------------------------------------------------------------------
        // HOST-PERSIST FALLBACK:
        // Wenn das iframe IDB nicht schreiben kann (iOS/Safari/WebView), kann es optional den
        // GLB-Buffer im slotUpdate mitsenden. Da IndexedDB same-origin ist, kann der Parent
        // den Buffer speichern, sodass das iframe beim nächsten Öffnen wieder restor'en kann.
        // -------------------------------------------------------------------
        if (payload?.buffer && (payload.buffer instanceof ArrayBuffer || typeof payload.buffer?.byteLength === "number")) {
          const buf = payload.buffer;
          const fileName = payload?.fileName || "";
          const updatedAt = payload?.updatedAt || new Date().toISOString();
          const key = makeModelKey(projectAssetId, slotId);

          // fire-and-forget (UI darf nicht blockieren)
          void (async () => {
            try {
              await idbPut(key, { fileName, updatedAt, buffer: buf });
              // Optionales Debug-Log (geht in Store Snapshot / Konsole)
              // eslint-disable-next-line no-console
              console.log("[AssetLab3DPanel] Host persisted model buffer into IDB:", key, buf.byteLength);
            } catch (e) {
              // eslint-disable-next-line no-console
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
          });

          // Persist (damit Reload stabil bleibt)
          persistProjectSnapshot(a.project);
        });

        // Optional: Host-Signal
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