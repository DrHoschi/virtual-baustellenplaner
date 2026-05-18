/**
 * main.js
 * Version: v1.4.8-project-transfer-v1 (2026-05-18)
 *
 * Zweck:
 * - App-Bootstrap über core/loader.js.
 * - Mobile Header/Menu/Debug/Snapshot-Logik bleibt aktiv.
 * - Crash-Recorder und Autosave-Drag-Guard werden optional/dynamisch geladen,
 *   damit der Import-Graph nicht scheitert, falls eine Zusatzdatei beim Upload
 *   einmal fehlt.
 *
 * WICHTIG:
 * - Statischer Import bleibt nur core/loader.js.
 * - Debug-/Snapshot-Buttons werden VOR startApp verdrahtet.
 */

import { startApp } from "./core/loader.js";

// ============================================================================
// KONSTANTEN
// ============================================================================

const DEFAULT_PROJECT_PATH = "projects/P-2026-0001/project.json";
const SNAPSHOT_COLLAPSE_KEY = "bp:snapshot:collapsed";
const MOBILE_SHELL_QUERY = "(max-width: 700px)";
const CRASH_RECORDER_MODULE_PATH = "./core/" + "crash-recorder.js";
const WORKAREA_AUTOSAVE_DRAG_GUARD_MODULE_PATH = "./core/" + "workarea-autosave-drag-guard.v1_3.js";
const PROJECT_TRANSFER_MODULE_PATH = "./core/" + "project-transfer.js";

// ============================================================================
// KLEINER FALLBACK-CRASH-RECORDER
// ============================================================================

function createFallbackCrashRecorder() {
  const events = [];
  const max = 80;

  const api = {
    __fallback: true,
    log(event, data = null) {
      try {
        events.push({
          t: new Date().toISOString(),
          event: String(event || "event"),
          data: data && typeof data === "object" ? data : (data == null ? null : { value: String(data) })
        });
        while (events.length > max) events.shift();
      } catch {}
      return null;
    },
    text() {
      try {
        return [
          "Baustellenplaner Crash Recorder Fallback",
          `Export: ${new Date().toISOString()}`,
          `Events: ${events.length}`,
          "",
          ...events.map((e, i) => `${String(i + 1).padStart(3, "0")} ${e.t} ${e.event} ${JSON.stringify(e.data || {})}`)
        ].join("\n");
      } catch {
        return "Baustellenplaner Crash Recorder Fallback: export failed";
      }
    },
    async copy() {
      const txt = api.text();
      try {
        await navigator.clipboard.writeText(txt);
        return true;
      } catch {
        return false;
      }
    },
    showInSnapshot() {
      const txt = api.text();
      try {
        const pre = document.querySelector("#snapshot");
        if (pre) pre.textContent = txt;
      } catch {}
      return txt;
    },
    sizeOf(value) {
      try { return new Blob([JSON.stringify(value)]).size; } catch {}
      try { return JSON.stringify(value).length; } catch {}
      return 0;
    }
  };

  return api;
}


function initOptionalWorkareaAutosaveDragGuard({ crashRecorder } = {}) {
  // Optional laden, damit der Import-Graph-Check nicht scheitert, wenn beim
  // GitHub-Mobile-Upload die Zusatzdatei einmal nicht im Commit gelandet ist.
  // Die App startet dann weiter, nur der Guard ist in diesem Lauf nicht aktiv.
  import(WORKAREA_AUTOSAVE_DRAG_GUARD_MODULE_PATH)
    .then((mod) => {
      const install = mod?.installWorkareaAutosaveDragGuard;
      if (typeof install === "function") {
        install({ crashRecorder: crashRecorder || window.BP_CRASH_RECORDER || null });
        window.BP_CRASH_RECORDER?.log?.("workarea:autosave-drag-guard:ready", { mode: "module" });
      } else {
        window.BP_CRASH_RECORDER?.log?.("workarea:autosave-drag-guard:missing-export", {});
      }
    })
    .catch((e) => {
      window.BP_CRASH_RECORDER?.log?.("workarea:autosave-drag-guard:optional-import-failed", {
        message: e?.message || String(e)
      });
      console.warn("[Baustellenplaner] Optionaler Workarea Autosave Drag Guard konnte nicht geladen werden:", e);
    });
}

function initOptionalCrashRecorderBackground() {
  let crashRecorder = window.BP_CRASH_RECORDER || createFallbackCrashRecorder();
  window.BP_CRASH_RECORDER = crashRecorder;

  // Nicht awaiten: Die App und Mobile-Buttons sollen sofort starten.
  import(CRASH_RECORDER_MODULE_PATH)
    .then((mod) => {
      if (mod?.initCrashRecorder) {
        const next = mod.initCrashRecorder({ max: 220 }) || crashRecorder;
        window.BP_CRASH_RECORDER = next;
        next?.log?.("crash-recorder:ready", { mode: "module" });
      }
    })
    .catch((e) => {
      crashRecorder?.log?.("crash-recorder:optional-import-failed", {
        message: e?.message || String(e)
      });
      console.warn("[Baustellenplaner] Optionaler Crash-Recorder konnte nicht geladen werden:", e);
    });

  return crashRecorder;
}


function initOptionalProjectTransferTools(appApi) {
  // Optional laden: Wenn die Transfer-Datei in einem Zwischenstand fehlt,
  // darf die App trotzdem starten. Der Button erscheint dann nur nicht.
  import(PROJECT_TRANSFER_MODULE_PATH)
    .then((mod) => {
      const install = mod?.installProjectTransferTools || mod?.default;
      if (typeof install === "function") {
        install({
          app: appApi,
          store: appApi?.store || null,
          bus: appApi?.bus || null,
          crashRecorder: window.BP_CRASH_RECORDER || crashRecorder || null
        });
      } else {
        window.BP_CRASH_RECORDER?.log?.("project-transfer:missing-export", {});
      }
    })
    .catch((e) => {
      window.BP_CRASH_RECORDER?.log?.("project-transfer:optional-import-failed", {
        message: e?.message || String(e)
      });
      console.warn("[Baustellenplaner] Optionaler Projekt-Transfer konnte nicht geladen werden:", e);
    });
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function byId(id) {
  return document.getElementById(id);
}

function isMobileShellWidth() {
  return window.matchMedia(MOBILE_SHELL_QUERY).matches;
}

function setExpanded(button, expanded) {
  if (!button) return;
  button.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function closeMobileMenu() {
  document.body.classList.remove("mobile-menu-open");
  setExpanded(byId("btnMobileMenu"), false);
}

function closeMobileDebug() {
  document.body.classList.remove("mobile-debug-open");
  setExpanded(byId("btnMobileDebug"), false);
}

// ============================================================================
// MOBILE HEADER / MENU / DEBUG
// ============================================================================

function setupMobileMenuToggle() {
  const btn = byId("btnMobileMenu");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("mobile-menu-open");
    setExpanded(btn, isOpen);
    if (isOpen) closeMobileDebug();
  });

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

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    closeMobileMenu();
    closeMobileDebug();
  });
}

function setupMobileDebugToggle() {
  const btn = byId("btnMobileDebug");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("mobile-debug-open");
    setExpanded(btn, isOpen);
    if (isOpen) closeMobileMenu();
  });
}

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
// SNAPSHOT / DEBUG TOOLS
// ============================================================================

function applyCollapsedState(isCollapsed) {
  document.body.classList.toggle("snapshot-collapsed", Boolean(isCollapsed));

  const btn = byId("btnToggleSnapshot");
  if (btn) btn.textContent = isCollapsed ? "Snapshot anzeigen" : "Snapshot ausblenden";
}

function setupSnapshotToggle() {
  applyCollapsedState(localStorage.getItem(SNAPSHOT_COLLAPSE_KEY) === "1");

  byId("btnToggleSnapshot")?.addEventListener("click", () => {
    const isCollapsed = document.body.classList.toggle("snapshot-collapsed");
    localStorage.setItem(SNAPSHOT_COLLAPSE_KEY, isCollapsed ? "1" : "0");
    applyCollapsedState(isCollapsed);
  });
}

function readSnapshotObject() {
  const pre = byId("snapshot");
  const txt = pre ? (pre.textContent || "").trim() : "";
  if (!txt) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

function getFilteredSnapshotText() {
  const filter = byId("snapshotFilter")?.value || "__ALL__";
  const pre = byId("snapshot");
  const raw = pre ? (pre.textContent || "") : "";
  const obj = readSnapshotObject();

  if (!obj || filter === "__ALL__") return raw;

  const sub = Object.prototype.hasOwnProperty.call(obj, filter) ? obj[filter] : {};
  try { return JSON.stringify({ [filter]: sub }, null, 2); } catch { return raw; }
}

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
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

function setupGlobalCrashLogButton() {
  const tools = byId("debugTools");
  if (!tools || byId("btnCrashLogGlobal")) return;

  const btn = document.createElement("button");
  btn.id = "btnCrashLogGlobal";
  btn.className = "bp-btn bp-btn-secondary";
  btn.type = "button";
  btn.textContent = "CrashLog";
  btn.title = "Letzte Reload-/Fehler-/Workarea-Ereignisse anzeigen und kopieren";

  btn.addEventListener("click", async () => {
    const rec = window.BP_CRASH_RECORDER || crashRecorder;
    try { rec?.log?.("ui:crashlog:button", { source: "global-debug" }); } catch {}

    let txt = "Crash Recorder nicht verfügbar.";
    try {
      if (rec?.text) txt = rec.text();
      else if (rec?.showInSnapshot) txt = rec.showInSnapshot();
    } catch (e) {
      txt = `CrashLog konnte nicht gelesen werden: ${e?.message || String(e)}`;
    }

    const pre = byId("snapshot");
    if (pre) pre.textContent = txt;

    // Snapshot sichtbar machen, damit man auf dem iPhone sofort sieht, was kopiert wurde.
    localStorage.setItem(SNAPSHOT_COLLAPSE_KEY, "0");
    applyCollapsedState(false);
    document.body.classList.add("mobile-debug-open");
    setExpanded(byId("btnMobileDebug"), true);

    try {
      const ok = await copyText(txt);
      btn.textContent = ok ? "CrashLog kopiert" : "CrashLog angezeigt";
      setTimeout(() => { btn.textContent = "CrashLog"; }, 1600);
    } catch {
      btn.textContent = "CrashLog angezeigt";
      setTimeout(() => { btn.textContent = "CrashLog"; }, 1600);
    }
  });

  const copyBtn = byId("btnCopySnapshot");
  if (copyBtn?.parentNode) copyBtn.parentNode.insertBefore(btn, copyBtn.nextSibling);
  else tools.appendChild(btn);
}


function setupMobileCrashLogFab() {
  if (document.getElementById("btnCrashLogMobileFab")) return;

  const btn = document.createElement("button");
  btn.id = "btnCrashLogMobileFab";
  btn.type = "button";
  btn.textContent = "CrashLog";
  btn.title = "CrashLog anzeigen und kopieren";
  btn.setAttribute("aria-label", "CrashLog anzeigen und kopieren");

  btn.style.display = "none";
  btn.style.position = "fixed";
  btn.style.right = "max(12px, env(safe-area-inset-right))";
  btn.style.bottom = "max(12px, env(safe-area-inset-bottom))";
  btn.style.zIndex = "9999";
  btn.style.minHeight = "44px";
  btn.style.padding = "10px 14px";
  btn.style.borderRadius = "999px";
  btn.style.border = "1px solid rgba(15, 23, 42, 0.22)";
  btn.style.background = "rgba(255,255,255,0.96)";
  btn.style.color = "#0f172a";
  btn.style.fontWeight = "700";
  btn.style.boxShadow = "0 10px 24px rgba(15,23,42,0.22)";

  const applyVisibility = () => {
    btn.style.display = window.matchMedia("(max-width: 700px)").matches ? "inline-flex" : "none";
  };

  applyVisibility();
  window.addEventListener("resize", applyVisibility, { passive: true });

  btn.addEventListener("click", async () => {
    const rec = window.BP_CRASH_RECORDER || crashRecorder;
    try { rec?.log?.("ui:crashlog:button", { source: "mobile-fab-main" }); } catch {}

    let txt = "Crash Recorder nicht verfügbar.";
    try {
      if (rec?.text) txt = rec.text();
      else if (rec?.showInSnapshot) txt = rec.showInSnapshot();
    } catch (e) {
      txt = `CrashLog konnte nicht gelesen werden: ${e?.message || String(e)}`;
    }

    const pre = byId("snapshot");
    if (pre) pre.textContent = txt;

    localStorage.setItem(SNAPSHOT_COLLAPSE_KEY, "0");
    applyCollapsedState(false);
    document.body.classList.add("mobile-debug-open");
    document.body.classList.remove("mobile-menu-open");
    setExpanded(byId("btnMobileDebug"), true);
    setExpanded(byId("btnMobileMenu"), false);

    try {
      await copyText(txt);
      btn.textContent = "Kopiert";
      setTimeout(() => { btn.textContent = "CrashLog"; }, 1600);
    } catch {
      btn.textContent = "Angezeigt";
      setTimeout(() => { btn.textContent = "CrashLog"; }, 1600);
    }
  });

  document.body.appendChild(btn);
}

function setupSnapshotCopyAndExport() {
  setupGlobalCrashLogButton();
  setupMobileCrashLogFab();

  byId("btnCopySnapshot")?.addEventListener("click", async () => {
    await copyText(getFilteredSnapshotText());
  });

  byId("btnDownloadSnapshot")?.addEventListener("click", () => {
    const text = getFilteredSnapshotText();
    const filter = byId("snapshotFilter")?.value || "__ALL__";
    const tag = filter === "__ALL__" ? "ALL" : filter;

    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
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
  console.error("[Baustellenplaner] startApp failed:", error);
  window.BP_CRASH_RECORDER?.log?.("app:startApp:failed", {
    message: error?.message || String(error),
    stack: error?.stack || null
  });

  const active = byId("active");
  if (active) active.textContent = "Fehler beim Start (siehe Console)";

  const mobileActive = byId("mobileActiveValue");
  if (mobileActive) mobileActive.textContent = "Fehler beim Start";

  const snapshot = byId("snapshot");
  if (snapshot) snapshot.textContent = String(error?.stack || error);

  document.body.classList.add("mobile-debug-open");
  setExpanded(byId("btnMobileDebug"), true);
}

// Wichtig: zuerst UI-Buttons verdrahten, dann App starten.
const crashRecorder = initOptionalCrashRecorderBackground();
initOptionalWorkareaAutosaveDragGuard({ crashRecorder });
setupMobileMenuToggle();
setupMobileDebugToggle();
setupActiveModuleMirror();
setupResponsiveCleanup();
setupSnapshotToggle();
setupSnapshotCopyAndExport();

const projectPath = getProjectPathFromUrl();
crashRecorder?.log?.("app:start", { projectPath });

startApp({ projectPath })
  .then((appApi) => {
    // Projekt-Transfer nach erfolgreichem App-Start installieren, weil erst dann
    // Store und Bus sicher verfügbar sind.
    initOptionalProjectTransferTools(appApi);
  })
  .catch(showStartError);
