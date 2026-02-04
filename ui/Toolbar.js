/**
 * ui/components/Toolbar.js
 * Version: v1.0.0-hardcut-modular-v3 (2026-02-04)
 *
 * Toolbar mit Standard-Buttons für Panels.
 */
import { h } from "./ui-dom.js";

function btn(label, onClick, kind = "secondary") {
  const base = {
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,.14)",
    background: kind === "primary" ? "rgba(80,160,255,.25)" : "rgba(0,0,0,.25)",
    cursor: "pointer",
    color: "inherit"
  };
  return h("button", { type: "button", style: base, onclick: onClick }, label);
}

export function Toolbar({ onReset = null, onApply = null, note = "" } = {}) {
  const row = h("div", { style: { display: "flex", alignItems: "center", gap: "10px", margin: "10px 0 0" } });

  if (onReset) row.appendChild(btn("Reset", onReset, "secondary"));
  if (onApply) row.appendChild(btn("Apply", onApply, "primary"));

  if (note) row.appendChild(h("div", { style: { marginLeft: "auto", opacity: ".65", fontSize: "12px" } }, note));

  return row;
}
