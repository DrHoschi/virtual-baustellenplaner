/**
 * main.js
 * Version: v1.4.0-mobile-header-clean (2026-05-16)
 *
 * ZWECK:
 * - Bootstrap der Baustellenplaner-App.
 * - Mobile-Header-Logik: Menü öffnen/schließen, Debug öffnen/schließen.
 * - Snapshot-Funktionen: einklappen, kopieren, exportieren.
 *
 * WICHTIG:
 * - Debug-/Snapshot-Funktionen bleiben erhalten.
 * - Es gibt keinen zweiten Mobile-Menü-Button mehr im gerenderten Menü.
 * - Die eigentliche App startet weiterhin über core/loader.js.
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { startApp } from "./core/loader.js?v=347";

// ============================================================================
// KONSTANTEN
// ============================================================================

const DEFAULT_PROJECT_PATH = "./projects/P-2026-0001/project.json";
const SNAPSHOT_COLLAPSE_KEY = "bp:snapshot:collapsed";
const MOBILE_SHELL_QUERY = "(max-width: 700px)";

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Sucht ein Element sicher per ID.
 */
function byId(id) {
  return document.getElementById(id);
}

/**
 * Prüft, ob das schmale Mobile-Layout aktiv ist.
 * CSS entscheidet final; JS nutzt das nur für Komfortverhalten.
 */
function isMobileShellWidth() {
  return window.matchMedia(MOBILE_SHELL_QUERY).matches;
}

/**
 * Setzt ARIA-expanded sauber für Buttons.
 */
function setExpanded(button, expanded) {
  if (!button) return;
  button.setAttribute("aria-expanded", expanded ? "true" : "false");
}

/**
 * Schließt das mobile Menü.
 */
function closeMobileMenu() {
  document.body.classList.remove("mobile-menu-open");
  setExpanded(byId("btnMobileMenu"), false);
}

/**
 * Schließt den mobilen Debugbereich.
 */
function closeMobileDebug() {
  document.body.classList.remove("mobile-debug-open");
  setExpanded(byId("btnMobileDebug"), false);
}

// ============================================================================
// MOBILE-SHELL-LOGIK
// ============================================================================

/**
 * Mobile Menü ein-/ausklappen.
 *
 * Das echte Menü bleibt #menu.
 * Auf Mobile wird es per CSS als Overlay angezeigt, wenn body die Klasse
 * "mobile-menu-open" hat.
 */
function setupMobileMenuToggle() {
  const btn = byId("btnMobileMenu");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("mobile-menu-open");
    setExpanded(btn, isOpen);

    // Menü und Debug sollen sich auf Mobile nicht gegenseitig überlagern.
    if (isOpen) closeMobileDebug();
  });

  // Klick außerhalb des Menü-Overlays schließt das Menü.
  document.addEventListener("click", (ev) => {
    if (!isMobileShellWidth()) return;
    if (!document.body.classList.contains("mobile-menu-open")) return;

    const menu = byId("menu");
    const target = ev.target;

    if (target instanceof Node) {
      if (btn.contains(target)) return;
      if (menu && menu.contains(target)) return;
    }

    closeMobileMenu();
  }, true);

  // Escape schließt geöffnete Mobile-Ebenen.
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    closeMobileMenu();
    closeMobileDebug();
  });
}

/**
 * Mobile Debug ein-/ausklappen.
 *
 * Auf Mobile zeigt Debug:
 * - Store Snapshot Toolbar
 * - optional Snapshot Body
 *
 * Desktop bleibt unverändert.
 */
function setupMobileDebugToggle() {
  const btn = byId("btnMobileDebug");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("mobile-debug-open");
    setExpanded(btn, isOpen);

    if (isOpen) closeMobileMenu();
  });
}

/**
 * Kopiert den Text aus #active in die mobile Kopfzeile.
 *
 * Warum MutationObserver?
 * - #active wird vom Loader / von der App später aktualisiert.
 * - Wir müssen dafür loader.js nicht anfassen.
 */
function setupActiveModuleMirror() {
  const source = byId("active");
  const target = byId("mobileActiveValue");

  if (!source || !target) return;

  const sync = () => {
    const txt = (source.textContent || "").trim();
    target.textContent = txt || "(lädt...)";
  };

  sync();

  const observer = new MutationObserver(sync);
  observer.observe(source, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

/**
 * Wenn von Mobile auf Desktop gewechselt wird, offene Mobile-Zustände
 * zurücksetzen, damit keine Overlay-Klasse hängen bleibt.
 */
function setupResponsiveCleanup() {
  const mq = window.matchMedia(MOBILE_SHELL_QUERY);

  const cleanupIfDesktop = () => {
    if (mq.matches) return;
    closeMobileMenu();
    closeMobileDebug();
  };

  if (mq.addEventListener) {
    mq.addEventListener("change", cleanupIfDesktop);
  } else if (mq.addListener) {
    mq.addListener(cleanupIfDesktop);
  }

  cleanupIfDesktop();
}

// ============================================================================
// SNAPSHOT TOGGLE
// ============================================================================

/**
 * Wendet den gespeicherten Snapshot-Zustand an.
 * Persist-Key:
 * - "1" = collapsed / versteckt
 * - "0" oder null = sichtbar
 */
function applyCollapsedState(isCollapsed) {
  document.body.classList.toggle("snapshot-collapsed", Boolean(isCollapsed));

  const btn = byId("btnToggleSnapshot");
  if (btn) {
    btn.textContent = isCollapsed ? "Snapshot anzeigen" : "Snapshot ausblenden";
  }
}

function setupSnapshotToggle() {
  applyCollapsedState(localStorage.getItem(SNAPSHOT_COLLAPSE_KEY) === "1");

  byId("btnToggleSnapshot")?.addEventListener("click", () => {
    const isCollapsed = document.body.classList.toggle("snapshot-collapsed");
    localStorage.setItem(SNAPSHOT_COLLAPSE_KEY, isCollapsed ? "1" : "0");
    applyCollapsedState(isCollapsed);
  });
}

// ============================================================================
// SNAPSHOT COPY / EXPORT
// ============================================================================

/**
 * Versucht den Snapshot aus <pre id="snapshot"> als JSON zu parsen.
 */
function readSnapshotObject() {
  const pre = byId("snapshot");
  const txt = pre ? (pre.textContent || "").trim() : "";

  if (!txt) return null;

  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

/**
 * Liefert den Snapshot-Text, optional gefiltert:
 * - Filter "__ALL__" → kompletter Snapshot-Text
 * - Filter z. B. "project" → JSON.stringify({ project: ... })
 */
function getFilteredSnapshotText() {
  const filter = byId("snapshotFilter")?.value || "__ALL__";
  const pre = byId("snapshot");
  const raw = pre ? (pre.textContent || "") : "";
  const obj = readSnapshotObject();

  if (!obj || filter === "__ALL__") return raw;

  const sub = Object.prototype.hasOwnProperty.call(obj, filter) ? obj[filter] : {};

  try {
    return JSON.stringify({ [filter]: sub }, null, 2);
  } catch {
    return raw;
  }
}

/**
 * Copy to clipboard – robust für iOS/Safari:
 * - Modern: navigator.clipboard.writeText
 * - Fallback: hidden textarea + document.execCommand("copy")
 */
async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";

  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);

  let ok = false;

  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  document.body.removeChild(ta);
  return ok;
}

function setupSnapshotCopyAndExport() {
  byId("btnCopySnapshot")?.addEventListener("click", async () => {
    const text = getFilteredSnapshotText();
    await copyText(text);
  });

  byId("btnDownloadSnapshot")?.addEventListener("click", () => {
    const text = getFilteredSnapshotText();
    const filter = byId("snapshotFilter")?.value || "__ALL__";
    const tag = filter === "__ALL__" ? "ALL" : filter;

    const blob = new Blob([text], {
      type: "application/json;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `snapshot_${tag}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

// ============================================================================
// APP START
// ============================================================================

function getProjectPathFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("project") || DEFAULT_PROJECT_PATH;
}

function showStartError(error) {
  console.error("startApp() failed:", error);

  const active = byId("active");
  if (active) active.textContent = "Fehler beim Start (siehe Console)";

  const mobileActive = byId("mobileActiveValue");
  if (mobileActive) mobileActive.textContent = "Fehler beim Start";

  const snapshot = byId("snapshot");
  if (snapshot) snapshot.textContent = String(error?.stack || error);

  // Bei Startfehlern Debug auf Mobile automatisch öffnen.
  document.body.classList.add("mobile-debug-open");
  setExpanded(byId("btnMobileDebug"), true);
}

setupMobileMenuToggle();
setupMobileDebugToggle();
setupActiveModuleMirror();
setupResponsiveCleanup();
setupSnapshotToggle();
setupSnapshotCopyAndExport();

startApp({ projectPath: getProjectPathFromUrl() }).catch(showStartError);
