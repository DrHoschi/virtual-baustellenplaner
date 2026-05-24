/**
 * Baustellenplaner – Save Status Anzeige
 * Datei: ui/status/save-status.js
 * Version: v1.0.0-save-status-emergency-flush-v1
 * Stand: 2026-05-24
 *
 * ZWECK:
 * - Kleine, robuste Speicherstatus-Anzeige in der Debug-/Topbar-Zone.
 * - Hört ausschließlich auf "app:save:status" aus core/loader.js.
 * - Speichert NICHT selbst.
 * - Baut KEINE zweite Save-Queue.
 *
 * ANGEZEIGTE STATUS:
 * - Ungespeichert
 * - Speichert…
 * - Gespeichert
 * - Fehler
 *
 * WICHTIG:
 * Diese Datei darf auch dann geladen werden, wenn Debug/Snapshot ausgeblendet ist.
 * Sie hängt sich bevorzugt in #debugTools ein. Falls #debugTools fehlt, legt sie
 * eine kleine feste Anzeige oben rechts an.
 */

/* ============================================================================
 * KONSTANTEN
 * ========================================================================== */

const SAVE_STATUS_VERSION = "v1.0.0-save-status-emergency-flush-v1";
const STATUS_ID = "bpSaveStatusIndicator";

/* ============================================================================
 * HILFSFUNKTIONEN
 * ========================================================================== */

function safeText(value, fallback = "") {
  const s = String(value ?? "").trim();
  return s || fallback;
}

function normalizeStatus(status, dirty, running) {
  const s = safeText(status, "").toLowerCase();

  if (s === "saving" || running === true) {
    return {
      key: "saving",
      text: "Speichert…",
      title: "Projekt wird gerade gespeichert."
    };
  }

  if (s === "dirty" || dirty === true) {
    return {
      key: "dirty",
      text: "Ungespeichert",
      title: "Es gibt Änderungen, die noch gespeichert werden müssen."
    };
  }

  if (s === "error") {
    return {
      key: "error",
      text: "Fehler",
      title: "Beim Speichern ist ein Fehler aufgetreten. Bitte Crashlog prüfen."
    };
  }

  return {
    key: "saved",
    text: "Gespeichert",
    title: "Alle bekannten Änderungen sind gespeichert."
  };
}

function injectStyleOnce() {
  if (document.getElementById("bpSaveStatusStyle")) return;

  const style = document.createElement("style");
  style.id = "bpSaveStatusStyle";
  style.textContent = `
    .bp-save-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 30px;
      padding: 0 10px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 999px;
      background: rgba(0,0,0,.18);
      color: inherit;
      font: inherit;
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
      user-select: none;
      -webkit-user-select: none;
    }

    .bp-save-status__dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: currentColor;
      opacity: .85;
      flex: 0 0 auto;
    }

    .bp-save-status[data-status="saved"] {
      opacity: .86;
    }

    .bp-save-status[data-status="dirty"] {
      opacity: 1;
      font-weight: 700;
    }

    .bp-save-status[data-status="saving"] {
      opacity: 1;
      font-weight: 700;
    }

    .bp-save-status[data-status="error"] {
      opacity: 1;
      font-weight: 800;
      border-color: rgba(255,0,0,.45);
      background: rgba(255,0,0,.12);
    }

    .bp-save-status--floating {
      position: fixed;
      z-index: 99998;
      top: calc(8px + env(safe-area-inset-top, 0px));
      right: calc(8px + env(safe-area-inset-right, 0px));
      background: rgba(20,20,20,.82);
      color: #fff;
      box-shadow: 0 6px 24px rgba(0,0,0,.22);
    }
  `;
  document.head.appendChild(style);
}

function createStatusElement() {
  let el = document.getElementById(STATUS_ID);
  if (el) return el;

  injectStyleOnce();

  el = document.createElement("div");
  el.id = STATUS_ID;
  el.className = "bp-save-status";
  el.dataset.status = "saved";
  el.title = "Speicherstatus";

  const dot = document.createElement("span");
  dot.className = "bp-save-status__dot";
  dot.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "bp-save-status__text";
  text.textContent = "Gespeichert";

  el.appendChild(dot);
  el.appendChild(text);

  const debugTools = document.getElementById("debugTools");
  if (debugTools) {
    debugTools.appendChild(el);
  } else {
    el.classList.add("bp-save-status--floating");
    document.body.appendChild(el);
  }

  return el;
}

function renderStatus(payload = {}) {
  const el = createStatusElement();
  const state = normalizeStatus(payload.status, payload.dirty, payload.running);

  el.dataset.status = state.key;
  el.title = state.title + (payload.reason ? `\nGrund: ${payload.reason}` : "");

  const text = el.querySelector(".bp-save-status__text");
  if (text) text.textContent = state.text;
}

/* ============================================================================
 * HAUPTLOGIK
 * ========================================================================== */

function bootSaveStatus() {
  createStatusElement();

  // Falls loader.js schon vor dieser Datei ein Status-Event gesendet hat.
  try {
    if (window.__BP_LAST_SAVE_STATUS__) {
      renderStatus(window.__BP_LAST_SAVE_STATUS__);
    }
  } catch {}

  window.addEventListener("app:save:status", (ev) => {
    renderStatus(ev?.detail || {});
  });

  try {
    window.BP_CRASH_RECORDER?.log?.("save-status:ready", { version: SAVE_STATUS_VERSION });
  } catch {}
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSaveStatus, { once: true });
} else {
  bootSaveStatus();
}

/* ============================================================================
 * EXPORTS
 * ========================================================================== */

export {};
