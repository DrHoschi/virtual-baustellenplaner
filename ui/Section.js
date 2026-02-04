/**
 * ui/components/Section.js
 * Version: v1.0.0-hardcut-modular-v3 (2026-02-04)
 *
 * Section-Container für Panels (Titel + Beschreibung + Content-Slot)
 */
import { h } from "./ui-dom.js";

export function Section({ title = "", description = "", children = [] } = {}) {
  const box = h("div", {
    style: {
      border: "1px solid rgba(255,255,255,.10)",
      borderRadius: "12px",
      padding: "12px",
      margin: "12px 0",
      background: "rgba(255,255,255,.04)"
    }
  });

  if (title) box.appendChild(h("div", { style: { fontWeight: "700", margin: "0 0 6px" } }, title));
  if (description) box.appendChild(h("div", { style: { opacity: ".75", fontSize: "12px", margin: "0 0 10px" } }, description));

  const content = h("div");
  children.forEach((c) => c && content.appendChild(c));
  box.appendChild(content);
  return box;
}
