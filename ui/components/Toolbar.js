/**
 * ui/components/Toolbar.js
 * Version: v1.1.0-hardcut-modular-v3.4.6 (2026-02-04)
 *
 * Panel-Toolbar (sticky) mit:
 *  - Reset
 *  - Speichern (Apply)
 *  - Statusanzeige (Ungespeichert / Gespeichert + Uhrzeit)
 *  - Hinweistext (Note)
 *
 * WICHTIG:
 * - Wir vergeben bewusst die CSS-Klasse `panel-toolbar`,
 *   damit Styling & Safari-Scroll-Fixes zentral in ui-core.css liegen.
 * - Zusätzlich hängen wir Setter an das DOM-Element (`__setStatus`, `__setNote`),
 *   damit PanelBase den Text aktualisieren kann, ohne die Toolbar neu zu bauen.
 */
import { h } from "./ui-dom.js";

/* ---------------------------------------------
 * Button-Helfer
 * --------------------------------------------- */
function btn(label, onClick, kind = "secondary") {
  const base = {
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,.10)",
    background: kind === "primary" ? "rgba(80,160,255,.20)" : "rgba(0,0,0,.06)",
    cursor: "pointer",
    color: "inherit",
    fontWeight: kind === "primary" ? "600" : "500"
  };
  return h("button", { type: "button", style: base, onclick: onClick }, label);
}

/**
 * @param {object} opts
 * @param {Function?} opts.onReset
 * @param {Function?} opts.onApply
 * @param {string} opts.note
 * @param {string} opts.status
 */
export function Toolbar({ onReset = null, onApply = null, note = "", status = "" } = {}) {
  // Wrapper: Klasse ist wichtig (ui-core.css)
  const wrap = h("div", {
    className: "panel-toolbar",
    style: {
      position: "sticky",
      top: "0px",
      zIndex: "10",
      borderRadius: "12px",
      padding: "8px",
      margin: "0 0 10px",
      backdropFilter: "blur(6px)"
    }
  });

  const row = h("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      minWidth: "0" // wichtig: flex overflow sauber
    }
  });

  // Links: Buttons
  const left = h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } });
  if (onReset) left.appendChild(btn("↩︎ Reset", onReset, "secondary"));
  if (onApply) left.appendChild(btn("💾 Speichern", onApply, "primary"));

  // Rechts: Status + Note (mit Klassen für CSS)
  const statusEl = h("div", { className: "panel-toolbar-status" }, status || "");
  const noteEl = h("div", { className: "panel-toolbar-note" }, note || "");

  const right = h("div", {
    className: "panel-toolbar-right",
    style: {
      marginLeft: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "2px",
      minWidth: "0" // erlaubt ellipsis
    }
  });

  right.appendChild(statusEl);
  right.appendChild(noteEl);

  row.appendChild(left);
  row.appendChild(right);
  wrap.appendChild(row);

  // Setter für PanelBase
  wrap.__setStatus = (txt) => { statusEl.textContent = txt || ""; };
  wrap.__setNote = (txt) => { noteEl.textContent = txt || ""; };

  return wrap;
}
