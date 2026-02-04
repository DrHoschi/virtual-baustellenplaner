/**
 * ui/panels/PanelBase.js
 * Version: v1.0.1-hardcut-modular-v3.4.2-fix (2026-02-04)
 *
 * WICHTIGER FIX:
 * - In v3.4.2 ist versehentlich eine MINI/Stub-Version von PanelBase im Repo gelandet.
 * - Diese Stub-Version ist auch genau das, was GitHub Pages ausliefert (sehr kleine Datei).
 * - Ergebnis: Panels verlieren ihre Basis-Funktionalität (Draft, Render, Dirty/Save, etc.).
 *
 * Diese Datei stellt die volle PanelBase wieder her und ergänzt:
 * - Scroll-Container (.panel-content-wrap) für Tablet/iPhone
 * - Root als Flex-Column (iPad Safari: min-height:0 nötig)
 */

import { h, clear } from "../components/ui-dom.js";
import { Toolbar } from "../components/Toolbar.js";

export class PanelBase {
  constructor({ bus, store, rootEl, context = {} } = {}) {
    this.bus = bus;
    this.store = store;
    this.rootEl = rootEl;
    this.context = context;

    this.draft = null;
    this._mounted = false;

    this._dirty = false;
    this._savedAt = null;

    this._toolbarEl = null;
    this._bodyEl = null;
    this._contentWrapEl = null;
  }

  // ---------------------------
  // Override points
  // ---------------------------

  getTitle() { return "Panel"; }
  getDescription() { return ""; }

  /** @returns {any} */
  buildDraftFromStore() { return {}; }

  /** @param {any} draft */
  applyDraftToStore(draft) { /* override */ }

  /** @param {HTMLElement} bodyEl @param {any} draft */
  renderBody(bodyEl, draft) {
    bodyEl.appendChild(h("div", { style: { opacity: ".7" } }, "No UI."));
  }

  // ---------------------------
  // Dirty/Save helpers
  // ---------------------------

  markDirty() {
    this._dirty = true;
    this._updateToolbar();
  }

  markSaved() {
    this._dirty = false;
    this._savedAt = new Date();
    this._updateToolbar();
  }

  _statusText() {
    if (this._dirty) return "🟡 Ungespeichert";
    if (this._savedAt) return `🟢 Gespeichert (${this._savedAt.toLocaleTimeString()})`;
    return "—";
  }

  _buildToolbar() {
    return Toolbar({
      onReset: () => {
        this.draft = this.buildDraftFromStore();
        this._dirty = false;
        this._savedAt = null;
        this._rerender();
      },
      onApply: () => {
        this.applyDraftToStore(this.draft);
        this.markSaved();
        // Draft neu ziehen (z.B. Normalisierung)
        this.draft = this.buildDraftFromStore();
        this._rerender();
      },
      status: this._statusText(),
      note: "Speichern schreibt in den Store; Persistenz erfolgt automatisch (localStorage)."
    });
  }

  _updateToolbar() {
    if (!this._toolbarEl) return;
    const parent = this._toolbarEl.parentElement;
    if (!parent) return;

    const newTb = this._buildToolbar();
    parent.replaceChild(newTb, this._toolbarEl);
    this._toolbarEl = newTb;
  }

  // ---------------------------
  // Lifecycle
  // ---------------------------

  async mount() {
    if (!this.rootEl) return;
    this._mounted = true;

    this.draft = this.buildDraftFromStore();
    this._dirty = false;
    this._savedAt = null;

    // v3.4.x: Root als Flex-Container (iPad Safari)
    this.rootEl.style.display = "flex";
    this.rootEl.style.flexDirection = "column";
    this.rootEl.style.minHeight = "0";

    clear(this.rootEl);

    const title = h("h3", { style: { margin: "0 0 6px" } }, this.getTitle());
    const desc = h("div", { style: { opacity: ".75", fontSize: "12px", margin: "0 0 10px" } }, this.getDescription());

    this._toolbarEl = this._buildToolbar();

    this._bodyEl = h("div");

    // v3.4: Scroll-Container unter der Toolbar
    this._contentWrapEl = h("div", {
      className: "panel-content-wrap",
      style: {
        flex: "1 1 auto",
        minHeight: "0"
      }
    });
    this._contentWrapEl.appendChild(this._bodyEl);

    this.rootEl.appendChild(title);
    if (this.getDescription()) this.rootEl.appendChild(desc);
    this.rootEl.appendChild(this._toolbarEl);
    this.rootEl.appendChild(this._contentWrapEl);

    this._rerender();
  }

  unmount() {
    this._mounted = false;
    if (this.rootEl) clear(this.rootEl);
  }

  _rerender() {
    if (!this._mounted || !this._bodyEl) return;
    clear(this._bodyEl);
    this.renderBody(this._bodyEl, this.draft);
  }
}
