/**
 * ui/panels/PanelBase.js
 * Version: v1.0.0-hardcut-modular-v3.4.3 (2026-02-04)
 *
 * WICHTIG:
 * - Diese Datei darf NICHT "minimal/stub" sein.
 * - ProjectGeneralPanel (und spätere Panels) erwarten:
 *   - buildDraftFromStore()
 *   - applyDraftToStore(draft)
 *   - renderBody(bodyEl, draft)
 *   - markDirty() / markSaved()
 *
 * v3.4.x:
 * - Panel-Inhalte sollen intern scrollen (iPad/iPhone)
 *   => Wrapper .panel-content-wrap (CSS) + Flex-Layout
 */

import { h, clear } from "../components/ui-dom.js";
import { Toolbar } from "../components/Toolbar.js";

export class PanelBase {
  /**
   * @param {object} ctx
   * @param {object} ctx.store
   * @param {object} [ctx.bus]
   * @param {HTMLElement} ctx.rootEl
   * @param {object} [ctx.context]
   */
  constructor({ store, bus = null, rootEl, context = null } = {}) {
    this.store = store;
    this.bus = bus;
    this.rootEl = rootEl;
    this.context = context;

    this._mounted = false;
    this._dirty = false;
    this._savedAt = null;

    this.draft = null;

    this._toolbarEl = null;
    this._bodyEl = null;
    this._contentWrap = null;
  }

  // --------------------------------------------------------
  // Overridables (werden vom konkreten Panel implementiert)
  // --------------------------------------------------------
  getTitle() { return "Panel"; }
  getDescription() { return ""; }

  buildDraftFromStore() {
    throw new Error("PanelBase.buildDraftFromStore() muss im Panel überschrieben werden.");
  }

  applyDraftToStore(_draft) {
    throw new Error("PanelBase.applyDraftToStore(draft) muss im Panel überschrieben werden.");
  }

  renderBody(_bodyEl, _draft) {
    throw new Error("PanelBase.renderBody(bodyEl, draft) muss im Panel überschrieben werden.");
  }

  // --------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------
  async mount() {
    if (!this.rootEl) return;
    this._mounted = true;

    // Root muss Flex-Container sein, sonst funktioniert internes Scrollen nicht zuverlässig (iPad Safari)
    this.rootEl.style.display = "flex";
    this.rootEl.style.flexDirection = "column";
    this.rootEl.style.minHeight = "0";

    clear(this.rootEl);

    // Draft initialisieren
    try {
      this.draft = this.buildDraftFromStore();
    } catch (e) {
      console.error(e);
      this.draft = {};
    }
    this._dirty = false;
    this._savedAt = null;

    // Header
    const title = h("div", { style: { fontWeight: "700", fontSize: "18px", margin: "0 0 6px" } }, this.getTitle());
    const descText = this.getDescription();
    const desc = descText
      ? h("div", { style: { opacity: ".75", fontSize: "12px", margin: "0 0 10px" } }, descText)
      : null;

    // Toolbar (erstmal bauen)
    this._toolbarEl = this._buildToolbar();

    // Body + Scroll-Wrapper
    this._bodyEl = h("div");
    this._contentWrap = h("div", {
      className: "panel-content-wrap",
      style: {
        flex: "1 1 auto",
        minHeight: "0"
      }
    });
    this._contentWrap.appendChild(this._bodyEl);

    this.rootEl.appendChild(title);
    if (desc) this.rootEl.appendChild(desc);
    this.rootEl.appendChild(this._toolbarEl);
    this.rootEl.appendChild(this._contentWrap);

    // Erste Render-Pass
    this._rerender();
  }

  async unmount() {
    this._mounted = false;
    if (this.rootEl) clear(this.rootEl);
  }

  // --------------------------------------------------------
  // Dirty / Save Status
  // --------------------------------------------------------
  markDirty() {
    this._dirty = true;
    this._refreshToolbar();
  }

  markSaved() {
    this._dirty = false;
    this._savedAt = new Date();
    this._refreshToolbar();
  }

  _statusText() {
    if (this._dirty) return "🟡 Ungespeichert";
    if (this._savedAt) {
      const hh = String(this._savedAt.getHours()).padStart(2, "0");
      const mm = String(this._savedAt.getMinutes()).padStart(2, "0");
      const ss = String(this._savedAt.getSeconds()).padStart(2, "0");
      return `🟢 Gespeichert (${hh}:${mm}:${ss})`;
    }
    return "";
  }

  _buildToolbar() {
    return Toolbar({
      onReset: () => {
        try {
          this.draft = this.buildDraftFromStore();
        } catch (e) {
          console.error(e);
          this.draft = {};
        }
        this._dirty = false;
        this._savedAt = null;
        this._rerender();
      },
      onApply: () => {
        try {
          this.applyDraftToStore(this.draft);
          this.markSaved();
          // Draft neu aus Store ziehen (Quelle der Wahrheit)
          this.draft = this.buildDraftFromStore();
          this._rerender();
        } catch (e) {
          console.error(e);
          // Sichtbares Feedback im Body
          this._showError("Speichern fehlgeschlagen", e);
        }
      },
      status: this._statusText(),
      note: "Speichern schreibt in den Store; Persistenz erfolgt automatisch (localStorage)."
    });
  }

  _refreshToolbar() {
    if (!this._toolbarEl || !this.rootEl) return;
    const next = this._buildToolbar();
    this.rootEl.replaceChild(next, this._toolbarEl);
    this._toolbarEl = next;
  }

  // --------------------------------------------------------
  // Rendering
  // --------------------------------------------------------
  _rerender() {
    if (!this._mounted || !this._bodyEl) return;
    clear(this._bodyEl);

    try {
      this.renderBody(this._bodyEl, this.draft);
    } catch (e) {
      console.error(e);
      this._showError("Panel-Renderfehler", e);
    }

    // optional: Snapshot refresh via Bus (wenn vorhanden)
    try {
      this.bus?.emit?.("cb:panel:rendered", { title: this.getTitle() });
    } catch (_) {}
  }

  _showError(title, err) {
    if (!this._bodyEl) return;
    const box = h("div", {
      style: {
        border: "1px solid #fecaca",
        background: "#fff1f2",
        color: "#7f1d1d",
        borderRadius: "12px",
        padding: "12px"
      }
    });
    box.appendChild(h("div", { style: { fontWeight: "700", marginBottom: "6px" } }, title));
    box.appendChild(h("pre", { style: { margin: 0, whiteSpace: "pre-wrap" } }, String(err?.stack || err)));
    this._bodyEl.appendChild(box);
  }
}