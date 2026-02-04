/**
 * ui/components/FormField.js
 * Version: v1.0.0-hardcut-modular-v3 (2026-02-04)
 *
 * Wiederverwendbares Formularfeld (Label + Input).
 * Unterstützt: text, textarea, number, select, checkbox
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
  onChange = null
} = {}) {
  const wrap = h("div", { style: { margin: "10px 0" } });

  const lab = h("div", { style: { fontSize: "12px", opacity: ".8", margin: "0 0 4px" } }, label || "");
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
      oninput: (e) => onChange && onChange(e.target.value)
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
      onchange: (e) => onChange && onChange(e.target.value)
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
      onchange: (e) => onChange && onChange(!!e.target.checked)
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
      oninput: (e) => onChange && onChange(type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)
    });

    if (min != null) input.min = String(min);
    if (max != null) input.max = String(max);
    if (step != null) input.step = String(step);

    input.value = value ?? "";
  }

  wrap.appendChild(input);
  return wrap;
}
