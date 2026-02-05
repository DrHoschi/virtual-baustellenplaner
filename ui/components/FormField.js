/**
 * ui/components/FormField.js
 * Version: v1.0.1-wizard-fix-formfield-events (2026-02-05)
 *
 * Wiederverwendbares Formularfeld (Label + Input).
 * Unterstützt: text, textarea, number, select, checkbox
 *
 * Bugfix / Backwards-Compat:
 * - Manche Panels haben historisch `onInput` statt `onChange` übergeben.
 * - Dann wird der Draft nie aktualisiert -> beim Re-Render ist das Feld wieder leer
 *   und Validierungen schlagen fehl ("Bitte Namen eingeben" obwohl Text sichtbar war).
 *
 * Lösung:
 * - Wir akzeptieren sowohl `onChange` als auch `onInput`.
 * - Intern nutzen wir eine einzige Callback-Referenz.
 */

import { h } from "./ui-dom.js";

export function FormField({
  label,
  type = "text",
  value = "",
  placeholder = "",
  options = null, // [{value,label}]
  min = null,
  max = null,
  step = null,
  onChange = null,
  onInput = null
} = {}) {
  // Backwards-Compat: falls Panels `onInput` liefern, nutzen wir das als Fallback
  const cb = onChange || onInput || null;

  const wrap = h("div", { style: { margin: "10px 0" } });

  const lab = h(
    "div",
    { style: { fontSize: "12px", opacity: ".8", margin: "0 0 4px" } },
    label || ""
  );
  wrap.appendChild(lab);

  let input = null;

  if (type === "textarea") {
    input = h("textarea", {
      style: {
        width: "100%",
        minHeight: "64px",
        padding: "8px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(0,0,0,.25)",
        color: "inherit",
        outline: "none",
        resize: "vertical"
      },
      placeholder,
      oninput: (e) => cb && cb(e.target.value)
    });
    input.value = value ?? "";
  } else if (type === "select") {
    input = h("select", {
      style: {
        width: "100%",
        padding: "8px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(0,0,0,.25)",
        color: "inherit",
        outline: "none"
      },
      onchange: (e) => cb && cb(e.target.value)
    });

    (options || []).forEach((opt) => {
      const o = h("option", { value: String(opt.value) }, opt.label ?? String(opt.value));
      input.appendChild(o);
    });

    input.value = value ?? "";
  } else if (type === "checkbox") {
    const row = h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } });
    input = h("input", {
      type: "checkbox",
      checked: !!value,
      onchange: (e) => cb && cb(!!e.target.checked)
    });
    row.appendChild(input);
    row.appendChild(h("div", { style: { opacity: ".85" } }, placeholder || ""));
    wrap.appendChild(row);
    return wrap;
  } else {
    input = h("input", {
      type,
      style: {
        width: "100%",
        padding: "8px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(0,0,0,.25)",
        color: "inherit",
        outline: "none"
      },
      placeholder,
      oninput: (e) => {
        if (!cb) return;
        const raw = e.target.value;
        if (type === "number") {
          cb(raw === "" ? "" : Number(raw));
        } else {
          cb(raw);
        }
      }
    });

    if (min != null) input.min = String(min);
    if (max != null) input.max = String(max);
    if (step != null) input.step = String(step);

    input.value = value ?? "";
  }

  wrap.appendChild(input);
  return wrap;
}
