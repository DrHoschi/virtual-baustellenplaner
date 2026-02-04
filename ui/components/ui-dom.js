/**
 * ui/components/ui-dom.js
 * Version: v1.0.0-hardcut-modular-v3 (2026-02-04)
 *
 * Tiny DOM helpers (kein Framework).
 * - h(): Element bauen (ähnlich hyperscript)
 * - clear(): Element leeren
 */

export function h(tag, attrs = null, ...children) {
  const el = document.createElement(tag);

  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;

      if (k === "style" && typeof v === "object") {
        Object.assign(el.style, v);
        continue;
      }

      if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.slice(2).toLowerCase(), v);
        continue;
      }

      if (k === "className") {
        el.className = String(v);
        continue;
      }

      // boolean attributes
      if (typeof v === "boolean") {
        if (v) el.setAttribute(k, "");
        continue;
      }

      el.setAttribute(k, String(v));
    }
  }

  for (const c of children.flat()) {
    if (c == null) continue;
    if (typeof c === "string" || typeof c === "number") {
      el.appendChild(document.createTextNode(String(c)));
    } else {
      el.appendChild(c);
    }
  }

  return el;
}

export function clear(el) {
  if (!el) return;
  el.innerHTML = "";
}
