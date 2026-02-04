/**
 * ui/panels/PanelBase.js
 * Version: v1.1.0-hardcut-modular-v3.1 (2026-02-04)
 *
 * Basis-Klasse für alle Panels:
 * - hält Draft-State (lokal)
 * - Reset: Draft neu aus Store
 * - Apply: Draft in Store schreiben
 * - Optional Auto-Apply (debounced) -> verhindert "Tab verlassen = alles weg"
 *
 * WICHTIG:
 * - Panels schreiben (v3.1) in den Store UND (über core/loader.js) in localStorage (per Project-ID),
 *   damit Browser-Reload/Tab-Wechsel nicht mehr alles verliert.
 * - Persistenz zurück in project.json folgt später (Export/Save).
 */

import { h, clear } from "../components/ui-dom.js";
import { Toolbar } from "../components/Toolbar.js";

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export class PanelBase {
  constructor({ bus, store, rootEl, context = {} } = {}) {
    this.bus = bus;
    this.store = store;
    this.rootEl = rootEl;
    this.context = context;

    this.draft = null;
    this._mounted = false;

    // Auto-Apply ist standardmäßig AN (weil du genau dieses Verhalten willst)
    this.autoApply = true;

    this._dirty = false;
    this._lastSavedAt = 0;

    this._debouncedAutoApply = debounce(() => {
      if (!this._mounted) return;
      if (!this._dirty) return;
      this._applyNow();
    }, 300);
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

  // --- Helpers for derived panels ------------------------------------------

  /** Markiert Draft als geändert und triggert ggf. Auto-Apply */
  markDirty() {
    this._dirty = true;
    if (this.autoApply) this._debouncedAutoApply();
    this._updateToolbarNote();
  }

  /** Sofortiges Apply (für Button) */
  _applyNow() {
    this.applyDraftToStore(this.draft);
    this._dirty = false;
    this._lastSavedAt = Date.now();

    // Nach Apply neu aus Store lesen (damit Normalisierung sichtbar ist)
    this.draft = this.buildDraftFromStore();
    if (this._bodyEl) this._rerender(this._bodyEl);

    this._updateToolbarNote();
  }

  // --- Lifecycle ------------------------------------------------------------

  async mount() {
    if (!this.rootEl) return;
    this._mounted = true;

    this.draft = this.buildDraftFromStore();

    clear(this.rootEl);

    const title = h("h3", { style: { margin: "0 0 6px" } }, this.getTitle());
    const desc = h("div", { style: { opacity: ".75", fontSize: "12px", margin: "0 0 10px" } }, this.getDescription());

    // Container: Toolbar oben (sticky) + Body darunter
    const wrap = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } });

    const toolbarWrap = h("div", {
      style: {
        position: "sticky",
        top: "0px",
        zIndex: 2,
        padding: "8px 0",
        background: "linear-gradient(to bottom, rgba(20,20,20,.95), rgba(20,20,20,.70))",
        backdropFilter: "blur(4px)"
      }
    });

    this._toolbarNoteEl = h("div", { style: { marginLeft: "auto", opacity: ".65", fontSize: "12px" } }, "");
    this._toolbarEl = Toolbar({
      onReset: () => {
        this.draft = this.buildDraftFromStore();
        this._dirty = false;
        this._rerender(this._bodyEl);
        this._updateToolbarNote();
      },
      onApply: () => this._applyNow(),
      // NOTE: Toolbar.js kann optional ein noteElement akzeptieren; falls nicht, nutzen wir note string.
      note: ""
    });

    // Note rechts in Toolbar einhängen (robust, unabhängig vom Toolbar-Implementationsdetail)
    // (Toolbar liefert ein Flex-Row; wir hängen Note ans Ende)
    this._toolbarEl.appendChild(this._toolbarNoteEl);

    toolbarWrap.appendChild(this._toolbarEl);

    this._bodyEl = h("div");

    this.rootEl.appendChild(title);
    if (this.getDescription()) this.rootEl.appendChild(desc);

    wrap.appendChild(toolbarWrap);
    wrap.appendChild(this._bodyEl);

    this.rootEl.appendChild(wrap);

    this._rerender(this._bodyEl);
    this._updateToolbarNote();
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

  _updateToolbarNote() {
    if (!this._toolbarNoteEl) return;

    if (this._dirty) {
      this._toolbarNoteEl.textContent = "● ungespeichert (Auto‑Apply aktiv)";
      this._toolbarNoteEl.style.opacity = ".85";
    } else if (this._lastSavedAt) {
      const dt = new Date(this._lastSavedAt);
      const hh = String(dt.getHours()).padStart(2, "0");
      const mm = String(dt.getMinutes()).padStart(2, "0");
      const ss = String(dt.getSeconds()).padStart(2, "0");
      this._toolbarNoteEl.textContent = `✓ gespeichert ${hh}:${mm}:${ss} (localStorage)`;
      this._toolbarNoteEl.style.opacity = ".65";
    } else {
      this._toolbarNoteEl.textContent = "Änderungen: Auto‑Apply (Store + localStorage).";
      this._toolbarNoteEl.style.opacity = ".65";
    }
  }
}
