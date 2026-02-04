/**
 * ui/components/Toolbar.js
 * Version: v1.0.0-hardcut-modular-v3.2 (2026-02-04)
 *
 * Toolbar für Panels (sticky) mit:
 * - Reset
 * - Speichern (Apply)
 * - Status / Hinweis
 *
 * Wichtig für Mobile: immer sichtbar (position: sticky).
 */
import { h } from "./ui-dom.js";

function btn(label, onClick, kind = "secondary") {
  const base = {
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,.14)",
    background: kind === "primary" ? "rgba(80,160,255,.25)" : "rgba(0,0,0,.25)",
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

  const row = h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } });

  if (onReset) row.appendChild(btn("↩︎ Reset", onReset, "secondary"));
  if (onApply) row.appendChild(btn("💾 Speichern", onApply, "primary"));

  const right = h("div", { style: { marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" } });
  if (status) right.appendChild(h("div", { style: { fontSize: "12px", opacity: ".95" } }, status));
  if (note) right.appendChild(h("div", { style: { fontSize: "11px", opacity: ".65" } }, note));

  row.appendChild(right);
  wrap.appendChild(row);

  return wrap;
}
