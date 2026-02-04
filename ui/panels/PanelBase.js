/**
 * ui/panels/PanelBase.js
 * Version: v1.0.1-hardcut-modular-v3.4.6 (2026-02-04)
 *
 * Basis-Klasse für Panels:
 * - Draft-State (lokal)
 * - Dirty-Tracking (ungespeichert/gespeichert)
 * - Reset: Draft aus Store
 * - Speichern: Draft in Store schreiben (applyDraftToStore)
 *
 * WICHTIG:
 * - Persistenz in localStorage macht core/persist/app-persist.js (nicht hier).
 *
 * v3.4.6:
 * - Panel-Inhalt ist jetzt INNEN scrollbar (Wrapper: .panel-content-wrap)
 * - rootEl wird als Flex-Column konfiguriert (minHeight:0 / overflow:hidden)
 * - Damit bleibt Toolbar sticky und Formular scrollt sauber im Panel
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
    this._dirty = false;
    this._savedAt = null;

    this._mounted = false;
    this._toolbarEl = null;

    // NEU: Wrapper + Body (Body steckt im Wrapper)
    this._wrapEl = null;
    this._bodyEl = null;
  }

  /* ------------------------------
   * Public API (für Kinderklassen)
   * ------------------------------ */

  getTitle() {
    return "Panel";
  }

  getDescription() {
    return "";
  }

  buildDraftFromStore() {
    return {};
  }

  applyDraftToStore(_draft) {
    // Child überschreibt das
  }

  /**
   * Child rendert hier sein Formular / UI
   * @param {HTMLElement} root
   * @param {object} draft
   */
  renderBody(_root, _draft) {
    // Child überschreibt das
  }

  markDirty() {
    this._dirty = true;
    if (this._toolbarEl?.__setStatus) this._toolbarEl.__setStatus(this._statusText());
  }

  markSaved() {
    this._dirty = false;
    this._savedAt = new Date();
    if (this._toolbarEl?.__setStatus) this._toolbarEl.__setStatus(this._statusText());
  }

  /* ------------------------------
   * Lifecycle
   * ------------------------------ */

  async mount() {
    if (!this.rootEl) return;
    this._mounted = true;

    // Draft initialisieren
    this.draft = this.buildDraftFromStore();
    this._dirty = false;
    this._savedAt = null;

    // Root leeren & für Scrolllayout vorbereiten
    clear(this.rootEl);

    // WICHTIG: Root als Flex-Column, damit innerer Wrapper scrollen kann.
    this.rootEl.style.display = "flex";
    this.rootEl.style.flexDirection = "column";
    this.rootEl.style.minHeight = "0";
    this.rootEl.style.overflow = "hidden";

    const title = h("h3", { style: { margin: "0 0 6px" } }, this.getTitle());
    const descText = this.getDescription();
    const desc = h(
      "div",
      { style: { opacity: ".75", fontSize: "12px", margin: "0 0 10px" } },
      descText
    );

    // Toolbar (sticky wird über CSS gemacht: .panel-toolbar)
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

        // Nach Save: Draft neu aus Store ziehen (damit Panel synchron bleibt)
        this.draft = this.buildDraftFromStore();
        this._rerender();
      },
      status: this._statusText(),
      note: "Speichern schreibt in den Store; Persistenz erfolgt automatisch (localStorage)."
    });

    // NEU: Scroll-Wrapper + Body
    // Wrapper bekommt Klasse, damit ui-core.css greifen kann.
    this._wrapEl = h("div", {
      className: "panel-content-wrap",
      style: {
        flex: "1 1 auto",
        minHeight: "0"
      }
    });

    this._bodyEl = h("div", {
      style: {
        display: "block"
      }
    });

    this._wrapEl.appendChild(this._bodyEl);

    // Reihenfolge: Title -> Desc -> Toolbar -> Scroll-Content
    this.rootEl.appendChild(title);
    if (descText) this.rootEl.appendChild(desc);
    this.rootEl.appendChild(this._toolbarEl);
    this.rootEl.appendChild(this._wrapEl);

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

    // Toolbar-Status nach Render neu setzen (falls Child markDirty() gemacht hat)
    if (this._toolbarEl?.__setStatus) this._toolbarEl.__setStatus(this._statusText());
  }

  _statusText() {
    if (this._dirty) return "🟡 Ungespeichert";
    if (this._savedAt) {
      const t = this._savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return `🟢 Gespeichert (${t})`;
    }
    return "";
  }
}
