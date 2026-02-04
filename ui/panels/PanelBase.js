/**
 * ui/panels/PanelBase.js
 * Version: v1.0.0-hardcut-modular-v3 (2026-02-04)
 *
 * Basis-Klasse für alle Panels:
 * - hält Draft-State (lokal)
 * - Reset: Draft neu aus Store
 * - Apply: Draft in Store schreiben
 * - Standard-Layout (Titel + Beschreibung + Sections + Toolbar)
 *
 * Panels sind bewusst "Framework-free" und arbeiten nur mit DOM.
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
  }

  // --- Override points ------------------------------------------------------

  getTitle() {
    return "Panel";
  }

  getDescription() {
    return "";
  }

  /** @returns {any} */
  buildDraftFromStore() {
    return {};
  }

  /** @param {any} draft */
  applyDraftToStore(draft) {
    // override
  }

  /** @param {HTMLElement} bodyEl @param {any} draft */
  renderBody(bodyEl, draft) {
    bodyEl.appendChild(h("div", { style: { opacity: ".7" } }, "No UI."));
  }

  // --- Lifecycle ------------------------------------------------------------

  async mount() {
    if (!this.rootEl) return;
    this._mounted = true;

    this.draft = this.buildDraftFromStore();

    clear(this.rootEl);

    const title = h("h3", { style: { margin: "0 0 6px" } }, this.getTitle());
    const desc = h("div", { style: { opacity: ".75", fontSize: "12px", margin: "0 0 10px" } }, this.getDescription());

    const body = h("div");

    const toolbar = Toolbar({
      onReset: () => {
        this.draft = this.buildDraftFromStore();
        this._rerender(body);
      },
      onApply: () => {
        this.applyDraftToStore(this.draft);
        // Optional: nach Apply neu aus Store lesen (damit Normalisierung sichtbar ist)
        this.draft = this.buildDraftFromStore();
        this._rerender(body);
      },
      note: "Änderungen werden im Store gespeichert (kein Auto-File-Save in v3)."
    });

    this.rootEl.appendChild(title);
    if (this.getDescription()) this.rootEl.appendChild(desc);
    this.rootEl.appendChild(body);
    this.rootEl.appendChild(toolbar);

    this._rerender(body);
  }

  unmount() {
    this._mounted = false;
    if (this.rootEl) clear(this.rootEl);
  }

  _rerender(bodyEl) {
    if (!this._mounted) return;
    clear(bodyEl);
    this.renderBody(bodyEl, this.draft);
  }
}
