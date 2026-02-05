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
 * @param {boolean=} opts.showReset
 * @param {boolean=} opts.showApply
 * @param {string=} opts.resetLabel
 * @param {string=} opts.applyLabel
 */
export function Toolbar({
  onReset = null,
  onApply = null,
  note = "",
  status = "",
  showReset = true,
  showApply = true,
  resetLabel = "↩︎ Reset",
  applyLabel = "💾 Speichern"
} = {}) {
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

  // Buttons sind optional (z.B. Projektliste braucht nur "Aktualisieren")
  const resetBtn = (showReset && onReset) ? btn(resetLabel, onReset, "secondary") : null;
  const applyBtn = (showApply && onApply) ? btn(applyLabel, onApply, "primary") : null;
  if (resetBtn) left.appendChild(resetBtn);
  if (applyBtn) left.appendChild(applyBtn);

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

  // Optional: "dirty/saved/idle" zur besseren CSS-Auszeichnung
  wrap.__setStatusKind = (kind) => {
    try { statusEl.dataset.kind = kind || ""; } catch { /* ignore */ }
  };

  // Optional: Apply-Button (Speichern) visuell/technisch deaktivieren
  wrap.__setApplyEnabled = (enabled) => {
    if (!applyBtn) return;
    applyBtn.disabled = !enabled;
    // kleine UX: Mauszeiger / Opacity
    applyBtn.style.opacity = enabled ? "1" : ".55";
    applyBtn.style.cursor = enabled ? "pointer" : "not-allowed";
  };

  return wrap;
}
