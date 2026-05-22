/**
 * core/workarea-mobile-save-hardcut.v11.js
 * Version: PATCH_workarea_mobile_save_hardcut_v11 (2026-05-22)
 *
 * ZIEL
 * ---------------------------------------------------------------------------
 * v9/v10 hatten auf iPhone/Safari weiterhin zwei Probleme:
 * 1) Mehrfach-Installationen über delayed-Timer (0/50/250/750/1500/3000/6000).
 * 2) Dirty-Anzeige kam verzögert und der manuelle Save konnte über alte
 *    Timer-/Debounce-Pfade wieder eine Seiten-Neuladung provozieren.
 *
 * v11 ist deshalb ein harter, einfacher Schnitt:
 * - genau EIN Modul, genau EIN Button, genau EIN Click-Handler.
 * - kein delayed install loop.
 * - Dirty sofort nach _persistSceneToStore().
 * - alle automatischen Workarea-Saves auf Mobile blockieren.
 * - manueller Save geht direkt über bus.emit("ui:project:save").
 * - der Button verhindert Default/Bubbling, damit kein Form-/Link-/UI-Klick
 *   daneben eine Navigation auslösen kann.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_mobile_save_hardcut_v11";
const GUARD_ID = "workarea-mobile-save-hardcut-v11";
const BUTTON_ID = "bpWorkareaManualSaveV11";
const LEGACY_BUTTON_ID = "bpWorkareaManualSaveV9";
const WRAP_FLAG = Symbol.for("baustellenplaner.workareaMobileSaveHardcut.v11.wrapper");

try {
  window.BP_WORKAREA_MOBILE_MANUAL_SAVE_V11 = true;
  window.BP_WORKAREA_MOBILE_MANUAL_SAVE_V9 = true; // main.js soll alten Autosave-Guard weiter skippen
  window.BP_WORKAREA_AUTOSAVE_DISABLED_MOBILE_V9 = true;
} catch {}

function isMobileLike() {
  try {
    if (window.matchMedia && window.matchMedia("(max-width: 800px)").matches) return true;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
  } catch {
    return false;
  }
}

function log(panel, event, data = {}) {
  try {
    if (panel && typeof panel._crashLog === "function") {
      panel._crashLog(event, data);
      return;
    }
  } catch {}
  try { window.BP_CRASH_RECORDER?.log?.(event, data); } catch {}
}

function getPanel() {
  try { return window.__BP_WORKAREA_ACTIVE_PANEL__ || null; } catch { return null; }
}

function setActivePanel(panel) {
  try {
    if (panel) window.__BP_WORKAREA_ACTIVE_PANEL__ = panel;
  } catch {}
}

function clearTimers(panel, reason = "v11") {
  try {
    if (panel?._waAutosave?.timer) {
      try { clearTimeout(panel._waAutosave.timer); } catch {}
      panel._waAutosave.timer = 0;
    }
    if (panel?._waAutosaveGuard?.idleTimer) {
      try { clearTimeout(panel._waAutosaveGuard.idleTimer); } catch {}
      panel._waAutosaveGuard.idleTimer = 0;
    }
    if (panel?._waAutosave) {
      panel._waAutosave.pendingAfterGesture = false;
      panel._waAutosave.enabled = false;
      panel._waAutosave.suppress = true;
    }
    log(panel, "workarea:mobile-save:timers-cleared:v11", { reason, guard: GUARD_ID });
  } catch {}
}

function styleButton(btn, state) {
  if (!btn) return;

  btn.type = "button";
  btn.style.position = "fixed";
  btn.style.right = "10px";
  btn.style.bottom = "10px";
  btn.style.zIndex = "99999";
  btn.style.borderRadius = "999px";
  btn.style.padding = "10px 14px";
  btn.style.font = "700 13px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  btn.style.backdropFilter = "blur(8px)";
  btn.style.transition = "background .18s ease, color .18s ease, border-color .18s ease, box-shadow .18s ease, transform .12s ease";

  if (state === "saving") {
    btn.textContent = "Speichere …";
    btn.disabled = true;
    btn.style.opacity = "0.9";
    btn.style.border = "1px solid rgba(255,255,255,.28)";
    btn.style.background = "rgba(30, 64, 175, .96)";
    btn.style.color = "#fff";
    btn.style.boxShadow = "0 8px 24px rgba(30,64,175,.35)";
    btn.style.transform = "scale(.99)";
    return;
  }

  btn.disabled = false;
  btn.style.opacity = "1";
  btn.style.transform = "scale(1)";

  if (state === "dirty") {
    btn.textContent = "● Speichern nötig";
    btn.title = "Es gibt ungespeicherte Änderungen";
    btn.style.border = "1px solid rgba(255,255,255,.38)";
    btn.style.background = "linear-gradient(135deg, rgba(217,119,6,.98), rgba(185,28,28,.98))";
    btn.style.color = "#fff";
    btn.style.boxShadow = "0 0 0 3px rgba(245,158,11,.28), 0 10px 28px rgba(185,28,28,.35)";
    return;
  }

  btn.textContent = "✓ Gespeichert";
  btn.title = "Keine ungespeicherten Änderungen";
  btn.style.border = "1px solid rgba(255,255,255,.22)";
  btn.style.background = "rgba(21, 128, 61, .95)";
  btn.style.color = "#fff";
  btn.style.boxShadow = "0 8px 24px rgba(0,0,0,.28)";
}

function setDirty(panel, reason = "changed") {
  if (!isMobileLike()) return;
  const p = panel || getPanel();
  setActivePanel(p);
  try {
    if (p) {
      p.__bpManualSaveDirtyV11 = true;
      p.__bpManualSaveDirtyReasonV11 = String(reason || "changed");
    }
    window.__BP_WORKAREA_DIRTY_V11 = true;
    const btn = ensureButton();
    styleButton(btn, "dirty");
    log(p, "workarea:mobile-save:dirty:v11", { reason: String(reason || "changed"), guard: GUARD_ID });
  } catch {}
}

function setSaved(panel, reason = "saved") {
  const p = panel || getPanel();
  try {
    if (p) {
      p.__bpManualSaveDirtyV11 = false;
      p.__bpManualSaveDirtyReasonV11 = null;
    }
    window.__BP_WORKAREA_DIRTY_V11 = false;
    const btn = ensureButton();
    styleButton(btn, "saved");
    log(p, "workarea:mobile-save:saved:v11", { reason: String(reason || "saved"), guard: GUARD_ID });
  } catch {}
}

function removeLegacyButtonIfNeeded() {
  try {
    const legacy = document.getElementById(LEGACY_BUTTON_ID);
    if (legacy) legacy.remove();
  } catch {}
}

function ensureButton() {
  if (!isMobileLike()) return null;
  removeLegacyButtonIfNeeded();

  let btn = document.getElementById(BUTTON_ID);
  if (!btn) {
    btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.dataset.bpV11Button = "1";
    btn.setAttribute("aria-label", "Workarea speichern");
    document.body.appendChild(btn);
  }

  if (btn.dataset.bpV11Click !== "1") {
    btn.dataset.bpV11Click = "1";
    btn.addEventListener("click", (ev) => {
      try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); } catch {}
      manualSave("button-click");
    }, { capture: true, passive: false });
  }

  styleButton(btn, window.__BP_WORKAREA_DIRTY_V11 ? "dirty" : "saved");
  return btn;
}

function manualSave(reason = "manual-save") {
  const panel = getPanel();
  if (!panel) {
    try { window.BP_CRASH_RECORDER?.log?.("workarea:mobile-save:no-panel:v11", { guard: GUARD_ID }); } catch {}
    return;
  }

  clearTimers(panel, `manual-save-start:${reason}`);
  styleButton(ensureButton(), "saving");

  try {
    // Bewusst zuerst aktuellen Scene-Zustand in Store spiegeln.
    if (typeof panel._persistSceneToStore === "function") {
      panel._persistSceneToStore("manual-save:v11");
    }

    // Autosave danach sofort wieder blockieren, weil _persistSceneToStore intern
    // noch den alten Debounce-Pfad aufrufen kann.
    clearTimers(panel, `manual-save-after-persist:${reason}`);

    if (panel.bus?.emit) {
      panel.bus.emit("ui:project:save", {
        source: "workarea",
        reason: "manual-save-direct:v11",
        ts: Date.now()
      });
      log(panel, "workarea:mobile-save:emit:v11", { guard: GUARD_ID });
    }

    // Falls der zentrale Persistor kein cb:persist:saved sendet, nicht ewig blau bleiben.
    window.setTimeout(() => setSaved(panel, "manual-save-timeout:v11"), 650);
  } catch (e) {
    styleButton(ensureButton(), "dirty");
    log(panel, "workarea:mobile-save:error:v11", { message: e?.message || String(e), guard: GUARD_ID });
  }
}

function wrapMethod(proto, name, wrapperFactory) {
  const current = proto?.[name];
  if (typeof current !== "function") return false;
  if (current[WRAP_FLAG]) return false;
  const wrapped = wrapperFactory(current);
  if (typeof wrapped !== "function") return false;
  wrapped[WRAP_FLAG] = true;
  wrapped.__previousWorkareaMobileSaveHardcutV11 = current;
  proto[name] = wrapped;
  return true;
}

function install() {
  if (!isMobileLike()) return false;
  if (window.__BP_WORKAREA_MOBILE_SAVE_HARDCUT_V11_INSTALLED) {
    ensureButton();
    return false;
  }
  window.__BP_WORKAREA_MOBILE_SAVE_HARDCUT_V11_INSTALLED = true;

  const proto = WorkareaPanel?.prototype;
  if (!proto) return false;

  wrapMethod(proto, "mount", (original) => async function patchedMountMobileSaveV11(...args) {
    const result = await original.apply(this, args);
    setActivePanel(this);
    clearTimers(this, "mount:v11");
    ensureButton();
    return result;
  });

  wrapMethod(proto, "_onViewportPointerDown", (original) => function patchedPointerDownMobileSaveV11(ev, ...rest) {
    setActivePanel(this);
    clearTimers(this, "pointerdown:v11");
    return original.call(this, ev, ...rest);
  });

  wrapMethod(proto, "_onViewportPointerUp", (original) => function patchedPointerUpMobileSaveV11(ev, ...rest) {
    const result = original.call(this, ev, ...rest);
    clearTimers(this, "pointerup:v11");
    return result;
  });

  wrapMethod(proto, "_persistSceneToStore", (original) => function patchedPersistSceneMobileSaveV11(reason = "scene", ...rest) {
    setActivePanel(this);
    const result = original.call(this, reason, ...rest);
    clearTimers(this, `persist:${reason}:v11`);
    if (!String(reason || "").toLowerCase().includes("manual-save")) {
      setDirty(this, reason);
    }
    return result;
  });

  wrapMethod(proto, "_requestProjectSaveDebounced", (original) => function patchedRequestSaveMobileSaveV11(reason = "workarea", ...rest) {
    if (isMobileLike()) {
      clearTimers(this, `debounced-block:${reason}:v11`);
      if (!String(reason || "").toLowerCase().includes("manual-save")) setDirty(this, reason);
      log(this, "workarea:mobile-save:debounced-blocked:v11", { reason: String(reason || "workarea"), guard: GUARD_ID });
      return;
    }
    return original.call(this, reason, ...rest);
  });

  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        const p = getPanel();
        clearTimers(p, "visibility-visible:v11");
        ensureButton();
      }
    }, { passive: true });
  } catch {}

  try {
    const bus = getPanel()?.bus;
    if (bus && !window.__BP_WORKAREA_MOBILE_SAVE_V11_BUS_HOOKED) {
      window.__BP_WORKAREA_MOBILE_SAVE_V11_BUS_HOOKED = true;
      bus.on?.("cb:persist:saved", () => setSaved(getPanel(), "cb:persist:saved:v11"));
    }
  } catch {}

  ensureButton();
  try { console.info(`[${PATCH_ID}] installed`); } catch {}
  try { window.BP_CRASH_RECORDER?.log?.("workarea:mobile-save:v11-installed", { guard: GUARD_ID }); } catch {}
  return true;
}

install();

export {};
