/**
 * ui/components/Section.js
 * Version: v1.2.9-section-dual-api (2026-02-09)
 *
 * FIX: "Section" wurde in verschiedenen Ständen uneinheitlich benutzt:
 *  - als Funktions-Factory:    Section({title,...}) -> HTMLElement
 *  - als Konstruktor:          new Section({...})  -> { el, append() }
 *
 * Einige Panels erwarten explizit .el und .append(), andere erwarten
 * ein direktes HTMLElement zur Einhaengung.
 *
 * Loesung:
 *  - Section ist weiterhin eine Funktion, kann aber auch mit `new` aufgerufen werden.
 *  - Ohne `new` liefert Section wie bisher ein HTMLElement.
 *  - Mit `new` liefert Section eine Instanz mit .el und .append().
 */

import { h } from "./ui-dom.js";

function buildSectionEl({ title = "", description = "", children = [] } = {}) {
  const box = h("div", {
    style: {
      border: "1px solid rgba(255,255,255,.10)",
      borderRadius: "12px",
      padding: "12px",
      margin: "12px 0",
      background: "rgba(255,255,255,.04)"
    }
  });

  if (title) {
    box.appendChild(h("div", { style: { fontWeight: "700", margin: "0 0 6px" } }, title));
  }
  if (description) {
    box.appendChild(h("div", { style: { opacity: ".75", fontSize: "12px", margin: "0 0 10px" } }, description));
  }

  const content = h("div");
  children.forEach((c) => c && content.appendChild(c));
  box.appendChild(content);

  // Wir merken uns den Content-Slot, damit die Konstruktor-Variante append() anbieten kann.
  box.__content = content;

  return box;
}

/**
 * Section(opts)
 * - Factory-Variante:   const el = Section({title,...});
 * - Konstruktor-Variante: const sec = new Section({title,...}); sec.append(node); root.appendChild(sec.el)
 */
export function Section(opts = {}) {
  // Wird die Funktion als Konstruktor benutzt?
  if (new.target) {
    // this ist die Instanz
    this.el = buildSectionEl(opts);

    // Append-Helfer (konsequent Node-only)
    this.append = (node) => {
      if (!node) return;
      const content = this.el && this.el.__content;
      if (!content) return;
      content.appendChild(node);
    };

    return; // bei Konstruktoren kein explizites return-Objekt
  }

  // Factory-Fall -> direktes HTMLElement
  return buildSectionEl(opts);
}
