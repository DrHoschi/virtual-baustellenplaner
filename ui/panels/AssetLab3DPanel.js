/**
 * ui/panels/AssetLab3DPanel.js
 * Version: v1.0.2-stable-ios-msgcompat (2026-02-13)
 *
 * Panel: Assets → AssetLab 3D (iframe)
 * ============================================================================
 * Rolle im System (jetzt sofort nutzbar)
 * -------------------------------------
 * AssetLab (Lite) ist aktuell unser:
 * - Viewer / Quick-Editor (Import/Orbit/Export)
 * - später: echter Editor (Material, Presets, Varianten, Bibliotheken)
 *
 * WICHTIG:
 * - Dieses Panel hostet das AssetLab als IFrame (modules/assetlab3d/iframe/assetlab-lite.html)
 * - Der Datenfluss läuft via postMessage:
 *     Host -> IFrame: assetlab:init / assetlab:cmd
 *     IFrame -> Host: assetlab:ready / assetlab:slotUpdate
 *
 * Haupt-Bug (warum Slot "leer" bleibt):
 * - iFrame sendet teilweise "flat" (ohne payload-Objekt)
 * - Host hat nur {type,payload} geparst -> payload war undefined -> slotUpdate verpufft
 *
 * Fix:
 * - Message-Compat: payload = data.payload || data
 * - iOS/Safari: ev.source kann null sein -> Quelle nur prüfen, wenn ev.source vorhanden
 */

/* ============================================================================
 * Imports
 * ========================================================================== */
import { UIPanel } from "../ui-kit/UIPanel.js";
import { h } from "../ui-kit/dom.js";

/* ============================================================================
 * Konstanten
 * ========================================================================== */
const IFRAME_PATH = "./modules/assetlab3d/iframe/assetlab-lite.html";

/* ============================================================================
 * Hilfsfunktionen
 * ========================================================================== */

/**
 * Findet ein ProjectAsset (Dummy Asset) im Projekt.
 * @param {object} app - Store "app" state
 * @param {string} projectAssetId
 */
function findProjectAsset(app, projectAssetId) {
  const proj = app?.project;
  const list = proj?.projectAssets || [];
  return list.find((a) => a && a.id === projectAssetId) || null;
}

/**
 * Persistiert Projekt-Snapshot (LocalStorage/Store-Mechanik).
 * Achtung: Im Projekt gibt es bereits ein Persist-System – wir bleiben kompatibel:
 * - Wenn eine globale persistProjectSnapshot existiert, nutzen wir sie.
 * - Sonst: noop (der Store kann ggf. ohnehin auto-persisten).
 */
function persistProjectSnapshot(project) {
  try {
    // Falls im Projekt global verfügbar (wie in anderen Panels)
    if (typeof window.persistProjectSnapshot === "function") {
      window.persistProjectSnapshot(project);
      return;
    }
    // Fallback: Manche Stände haben persist über window.appPersist o.ä.
    if (typeof window.appPersistProject === "function") {
      window.appPersistProject(project);
      return;
    }
  } catch (e) {
    // bewusst still – Persist ist "best effort"
    console.warn("[AssetLab3DPanel] persistProjectSnapshot failed:", e);
  }
}

/**
 * Trägt Import/Export/Restore Status in einen Slot ein.
 * Wir speichern hier NICHT das GLB selbst, sondern nur:
 * - hasModel
 * - lastImportName
 * - updatedAt
 * - lastAction
 * - exportRef (optional)
 */
function applySlotStatusUpdate({ app, projectAssetId, slotId, fileName, updatedAt, kind }) {
  if (!app?.project?.projectAssets) return;

  const asset = app.project.projectAssets.find((a) => a && a.id === projectAssetId);
  if (!asset || !asset.slots) return;

  const slot = asset.slots.find((s) => s && s.id === slotId);
  if (!slot) return;

  // "kind" kommt vom IFrame: import | export | restore | clear | ...
  const k = (kind || "").toLowerCase();

  if (k === "import" || k === "restore") {
    slot.hasModel = true;
    slot.lastImportName = fileName || slot.lastImportName || "";
    slot.updatedAt = updatedAt || new Date().toISOString();
    slot.lastAction = k;
    // slot.model bleibt absichtlich null (GLB liegt in IDB im IFrame-Kontext)
    return;
  }

  if (k === "export") {
    slot.updatedAt = updatedAt || new Date().toISOString();
    slot.lastAction = "export";
    // optional: exportRef, falls IFrame sowas schickt
    return;
  }

  if (k === "clear" || k === "delete" || k === "reset") {
    slot.hasModel = false;
    slot.lastImportName = "";
    slot.updatedAt = updatedAt || new Date().toISOString();
    slot.lastAction = k;
    slot.exportRef = null;
    slot.model = null;
    return;
  }

  // default: nur timestamp/lastAction
  slot.updatedAt = updatedAt || new Date().toISOString();
  slot.lastAction = k || slot.lastAction || "";
}

/* ============================================================================
 * Panel-Klasse
 * ========================================================================== */
export class AssetLab3DPanel extends UIPanel {
  /**
   * @param {object} opts
   * @param {object} opts.store - App Store
   * @param {object} opts.bus   - EventBus (optional)
   */
  constructor(opts) {
    super(opts);
    this.id = "projectPanel:assetlab3d";
    this.title = "Assets – AssetLab 3D";
    this._iframe = null;
    this._onMsg = null;
  }

  /**
   * Render / Mount
   */
  mount(root) {
    super.mount(root);

    const app = this.store.get("app") || {};
    const projectId = app?.project?.id || "(kein Projekt)";

    // Kontext aus Store (vom Projekt-Assets Panel gesetzt)
    const ctx = app?.ui?.assetlab?.context || null;

    const projectAssetId = ctx?.projectAssetId || "";
    const slotId = ctx?.slotId || "";

    const header = h("div", { className: "panel__header" },
      h("div", { style: { fontWeight: "700", fontSize: "18px" } }, "Assets – AssetLab 3D"),
      h("div", { style: { opacity: ".75", fontSize: "12px", marginTop: "6px" } },
        `Projekt-ID: ${projectId} · Kontext: ${projectAssetId || "(keiner)"}`
      )
    );

    const status = h("div", {
      style: {
        padding: "8px 10px",
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: "10px",
        marginTop: "10px",
        fontSize: "12px",
        opacity: ".85",
      }
    }, "⏳ AssetLab wird geladen …");

    const btnClearCtx = h("button", {
      className: "btn",
      style: { marginTop: "10px" },
      onClick: () => {
        this.store.update("app", (a) => {
          a.ui = a.ui || {};
          a.ui.assetlab = a.ui.assetlab || {};
          a.ui.assetlab.context = null;
          a.ui.assetlab.pendingCmd = null;
        });
        status.textContent = "🧹 Kontext gelöscht. Öffne AssetLab erneut aus einem Slot.";
      }
    }, "Kontext löschen");

    const iframeWrap = h("div", {
      style: {
        marginTop: "12px",
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(0,0,0,.20)",
      }
    });

    const iframe = document.createElement("iframe");
    iframe.src = IFRAME_PATH;
    iframe.style.width = "100%";
    iframe.style.height = "560px";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframeWrap.appendChild(iframe);
    this._iframe = iframe;

    root.appendChild(header);
    root.appendChild(status);
    root.appendChild(btnClearCtx);

    // -----------------------------------------------------------------------
    // postMessage Bridge: IFrame -> Host
    // -----------------------------------------------------------------------
    const onMsg = (ev) => {
      if (!ev || !ev.data) return;

      // Nur Nachrichten vom eigenen iframe akzeptieren (wichtig bei mehreren iframes)
      // NOTE (iOS/Safari/WebViews): `ev.source` kann NULL sein. Dann koennen wir
      // die Quelle nicht hart verifizieren – wir verlassen uns auf Origin + type.
      if (ev.source && ev.source !== iframe.contentWindow) return;

      // -------------------------------------------------------------------
      // Message-Format-Compat:
      // - Neu/sauber: { type, payload: {...} }
      // - Alt/leichtgewichtig (Lite): { type, ...payloadFields }
      // iOS/Safari kann zudem ev.data als Proxy liefern -> defensiv kopieren.
      // -------------------------------------------------------------------
      const data = ev.data || {};
      const type = data.type;
      // IMPORTANT: Wenn kein `payload` existiert, nutzen wir das Root-Objekt als Payload.
      // So verpuffen slotUpdates nicht mehr, wenn das IFrame "flat" sendet.
      const payload = data.payload || data;

      if (type === "assetlab:ready") {
        status.textContent = "🟢 AssetLab bereit";

        // Kontext + Pending-Cmd aus dem Store lesen (vom ProjectAssetsPanel gesetzt)
        const appNow = this.store.get("app") || {};
        const ctxNow = appNow?.ui?.assetlab?.context || null;
        const pendingCmd = appNow?.ui?.assetlab?.pendingCmd || null;

        // -------------------------------------------------------------------
        // Init an das IFrame senden (KRITISCH fuer Restore/Persistenz)
        // -------------------------------------------------------------------
        // Das AssetLab-Lite erwartet flache Keys:
        //   { projectId, projectAssetId, slotId, hasModel }
        // Bisher wurde { context: {...} } gesendet -> Restore fand NIE statt.
        let paId = ctxNow?.projectAssetId || null;
        let psId = ctxNow?.slotId || null;
        let hasModel = false;

        if (paId && psId) {
          const asset = findProjectAsset(appNow, paId);
          const slot = asset?.slots?.find?.((s) => s && s.id === psId) || null;
          hasModel = !!slot?.hasModel;
        }

        // Hinweis: origin ist grundsätzlich gut, kann aber bei Redirect/Domain-Varianten nerven.
        // Wir lassen es erstmal korrekt (origin) und halten die Bridge robust.
        iframe.contentWindow?.postMessage({
          type: "assetlab:init",
          payload: {
            projectId,
            projectAssetId: paId,
            slotId: psId,
            hasModel,
          }
        }, window.location.origin);

        // Optional: einmalig eine PendingCmd schicken (z.B. Export)
        if (pendingCmd && pendingCmd.cmd) {
          iframe.contentWindow?.postMessage(
            { type: "assetlab:cmd", payload: pendingCmd },
            window.location.origin
          );

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

      // Slot-Status Update vom iframe (Import/Export/Restore/Clear)
      // Kompatibilität: ältere Stände senden "assetlab:payload".
      if (type === "assetlab:slotUpdate" || type === "assetlab:payload") {
        const appNow = this.store.get("app") || {};
        const ctxNow = appNow?.ui?.assetlab?.context;

        const paId = ctxNow?.projectAssetId || payload?.projectAssetId;
        const psId = payload?.slotId || ctxNow?.slotId;

        if (!paId || !psId) return;

        this.store.update("app", (a) => {
          applySlotStatusUpdate({
            app: a,
            projectAssetId: paId,
            slotId: psId,
            fileName: payload?.fileName || payload?.name || "",
            updatedAt: payload?.updatedAt || new Date().toISOString(),
            kind: payload?.kind || payload?.action || "",
          });

          // Persist (damit Reload stabil bleibt)
          persistProjectSnapshot(a.project);
        });

        // Optional: Host-Signal
        this.bus?.emit?.("cb:assetlab:slotUpdated", { projectAssetId: paId, slotId: psId, kind: payload?.kind || "" });
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
