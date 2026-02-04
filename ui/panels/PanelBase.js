/**
 * ui/panels/PanelBase.js
 * Version: v1.0.0-hardcut-modular-v3.2 (2026-02-04)
 *
 * Basis-Klasse für Panels:
 * - Draft-State (lokal)
 * - Dirty-Tracking (ungespeichert/gespeichert)
 * - Reset: Draft aus Store
 * - Speichern: Draft in Store schreiben (applyDraftToStore)
 *
 * WICHTIG:
 * - Persistenz in localStorage macht core/persist/app-persist.js (nicht hier).
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
  }

  // --- Override points ------------------------------------------------------

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

  // --- State helpers --------------------------------------------------------

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

  _updateToolbar() {
    if (!this._toolbarEl) return;
    // Toolbar komplett neu bauen (simpel & robust)
    const parent = this._toolbarEl.parentElement;
    if (!parent) return;

    const newTb = Toolbar({
      onReset: () => {
        this.draft = this.buildDraftFromStore();
        this._dirty = false;
        this._savedAt = null;
        this._rerender();
      },
      onApply: () => {
        this.applyDraftToStore(this.draft);
        this.markSaved();
        // Danach Draft aus Store neu ziehen (falls Normalisierung)
        this.draft = this.buildDraftFromStore();
        this._rerender();
      },
      status: this._statusText(),
      note: "Speichern schreibt in den Store; Persistenz erfolgt automatisch (localStorage)."
    });

    parent.replaceChild(newTb, this._toolbarEl);
    this._toolbarEl = newTb;
  }

  // --- Lifecycle ------------------------------------------------------------

  async mount() {
  if (!this.rootEl) return;
  this._mounted = true;

  this.draft = this.buildDraftFromStore();
  this._dirty = false;
  this._savedAt = null;

  // v3.4.1: Root als Flex-Container (WICHTIG für iPad Safari)
  this.rootEl.style.display = "flex";
  this.rootEl.style.flexDirection = "column";
  this.rootEl.style.minHeight = "0";

  // Root leeren
  this.rootEl.innerHTML = "";

  const title = h("h3", { style: { margin: "0 0 6px" } }, this.getTitle());
  const desc = h(
    "div",
    { style: { opacity: ".75", fontSize: "12px", margin: "0 0 10px" } },
    this.getDescription()
  );

  this._toolbarEl = Toolbar({
    onReset: () => {
      this.draft = this.buildDraftFromStore();
      this._dirty = false;
      this._savedAt = null;
      this._rerender();
    },
    onApply: () => {
      this.applyDraftToStore(this.draft);
      this.markSaved();
      this.draft = this.buildDraftFromStore();
      this._rerender();
    },
    status: this._statusText(),
    note: "Speichern schreibt in den Store; Persistenz erfolgt automatisch (localStorage)."
  });

  // Body
  this._bodyEl = h("div");

  // v3.4.1: Scroll-Container für Panel-Inhalte
  const contentWrap = h("div", {
    className: "panel-content-wrap",
    style: {
      flex: "1 1 auto",
      minHeight: "0"
    }
  });

  contentWrap.appendChild(this._bodyEl);

  // DOM-Aufbau
  this.rootEl.appendChild(title);
  if (this.getDescription()) this.rootEl.appendChild(desc);
  this.rootEl.appendChild(this._toolbarEl);
  this.rootEl.appendChild(contentWrap);

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
