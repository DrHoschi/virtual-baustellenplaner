/**
 * core/workarea-mobile-save-hardcut.v11.js
 * Version: PATCH_workarea_mobile_autosave_after_drag_v12 (2026-05-22)
 *
 * WICHTIGER HINWEIS ZUM DATEINAMEN
 * ---------------------------------------------------------------------------
 * Die Datei bleibt absichtlich bei v11.js, damit die vorhandene index.html nicht
 * erneut geändert werden muss. Inhaltlich ist dies die v12-Logik.
 *
 * ZIEL
 * ---------------------------------------------------------------------------
 * - Workarea soll nach Drag/Place automatisch speichern.
 * - Der Button bleibt als Statusanzeige: orange = Änderung erkannt,
 *   blau = speichert, grün = gespeichert.
 * - Kein alter v9/v10-delayed-Installationspfad.
 * - Kein debounced Save während Drag.
 * - Save erst NACH _persistSceneToStore(), also nachdem die Szene im Store liegt.
 * - Dirty/Status wird VOR dem schweren Store-Persist sichtbar gesetzt, damit auf
 *   iPhone/Safari nicht erst Sekunden später etwas passiert.
 * - Bei pagehide/visibility hidden wird ein letzter Not-Save versucht.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_mobile_autosave_after_drag_v12";
const GUARD_ID = "workarea-mobile-autosave-after-drag-v12";
const BUTTON_ID = "bpWorkareaManualSaveV11";
const LEGACY_BUTTON_ID = "bpWorkareaManualSaveV9";
const WRAP_FLAG = Symbol.for("baustellenplaner.workareaMobileSaveHardcut.v12.wrapper");

const SAVE_DELAY_MS = 420;
const SAVE_FALLBACK_GREEN_MS = 900;

try {
  window.BP_WORKAREA_MOBILE_MANUAL_SAVE_V11 = true;
  window.BP_WORKAREA_MOBILE_AUTOSAVE_V12 = true;
  window.BP_WORKAREA_MOBILE_MANUAL_SAVE_V9 = true;
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

function safeReason(reason, fallback = "workarea") {
  const text = String(reason || fallback).trim();
  return text || fallback;
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
  try { if (panel) window.__BP_WORKAREA_ACTIVE_PANEL__ = panel; } catch {}
}

function ensureState(panel) {
  if (!panel) return null;
  if (!panel.__bpMobileAutosaveV12) {
    panel.__bpMobileAutosaveV12 = {
      dirty: false,
      saving: false,
      saveTimer: 0,
      saveSeq: 0,
      lastReason: "init",
      lastSavedAt: 0,
      lastSaveStartedAt: 0
    };
  }
  return panel.__bpMobileAutosaveV12;
}

function clearLegacyTimers(panel, reason = "v12") {
  try {
    // Alte Workarea-Autosave-Timer (v9/v10/WorkareaPanel) stoppen.
    // Den eigenen v12 saveTimer löschen wir hier bewusst NICHT pauschal,
    // sonst würde pointerup den geplanten Autosave wieder entfernen.
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
    log(panel, "workarea:mobile-save:legacy-timers-cleared:v12", { reason, guard: GUARD_ID });
  } catch {}
}

function cancelPendingV12Save(panel, reason = "cancel") {
  const st = ensureState(panel);
  if (!st?.saveTimer) return;
  try { clearTimeout(st.saveTimer); } catch {}
  st.saveTimer = 0;
  log(panel, "workarea:mobile-save:autosave-cancel:v12", { reason, guard: GUARD_ID });
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
    btn.style.opacity = "0.92";
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
    btn.title = "Änderung erkannt – Autosave läuft gleich";
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
    btn.dataset.bpV12Button = "1";
    btn.setAttribute("aria-label", "Workarea Speichern Status");
    document.body.appendChild(btn);
  }

  if (btn.dataset.bpV12Click !== "1") {
    btn.dataset.bpV12Click = "1";
    btn.addEventListener("click", (ev) => {
      try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); } catch {}
      directSave(getPanel(), "button-click:v12");
    }, { capture: true, passive: false });
  }

  const p = getPanel();
  const st = ensureState(p);
  if (st?.saving) styleButton(btn, "saving");
  else if (st?.dirty || window.__BP_WORKAREA_DIRTY_V12) styleButton(btn, "dirty");
  else styleButton(btn, "saved");
  return btn;
}

function markDirty(panel, reason = "changed") {
  if (!isMobileLike()) return;
  const p = panel || getPanel();
  setActivePanel(p);
  const st = ensureState(p);
  try {
    if (st) {
      st.dirty = true;
      st.saving = false;
      st.lastReason = safeReason(reason, "changed");
    }
    window.__BP_WORKAREA_DIRTY_V12 = true;
    styleButton(ensureButton(), "dirty");
    log(p, "workarea:mobile-save:dirty:v12", { reason: safeReason(reason), guard: GUARD_ID });
  } catch {}
}

function markSaving(panel, reason = "saving") {
  const p = panel || getPanel();
  const st = ensureState(p);
  try {
    if (st) {
      st.saving = true;
      st.dirty = true;
      st.lastSaveStartedAt = Date.now();
      st.lastReason = safeReason(reason);
    }
    window.__BP_WORKAREA_DIRTY_V12 = true;
    styleButton(ensureButton(), "saving");
    log(p, "workarea:mobile-save:saving:v12", { reason: safeReason(reason), guard: GUARD_ID });
  } catch {}
}

function markSaved(panel, reason = "saved") {
  const p = panel || getPanel();
  const st = ensureState(p);
  try {
    if (st) {
      st.dirty = false;
      st.saving = false;
      st.lastSavedAt = Date.now();
      st.lastReason = safeReason(reason);
    }
    window.__BP_WORKAREA_DIRTY_V12 = false;
    styleButton(ensureButton(), "saved");
    log(p, "workarea:mobile-save:saved:v12", { reason: safeReason(reason), guard: GUARD_ID });
  } catch {}
}

function directSave(panel, reason = "autosave") {
  const p = panel || getPanel();
  if (!p) {
    try { window.BP_CRASH_RECORDER?.log?.("workarea:mobile-save:no-panel:v12", { reason, guard: GUARD_ID }); } catch {}
    return;
  }

  setActivePanel(p);
  const st = ensureState(p);
  if (st?.saveTimer) {
    try { clearTimeout(st.saveTimer); } catch {}
    st.saveTimer = 0;
  }

  clearLegacyTimers(p, `direct-save-start:${reason}`);
  markSaving(p, reason);

  try {
    // Nicht erneut _persistSceneToStore() aufrufen. Die Szene wurde bereits in
    // WorkareaPanel persistiert; erneutes Persistieren könnte wieder alte
    // debounce-Pfade auslösen und auf iOS unnötig Arbeit erzeugen.
    if (p.bus?.emit) {
      p.bus.emit("ui:project:save", {
        source: "workarea",
        reason: `autosave-after-workarea:${safeReason(reason)}`,
        ts: Date.now()
      });
      log(p, "workarea:mobile-save:emit:v12", { reason: safeReason(reason), guard: GUARD_ID });
    }

    window.setTimeout(() => markSaved(p, `fallback-green:${reason}`), SAVE_FALLBACK_GREEN_MS);
  } catch (e) {
    markDirty(p, `save-error:${reason}`);
    log(p, "workarea:mobile-save:error:v12", { message: e?.message || String(e), guard: GUARD_ID });
  }
}

function scheduleAutosave(panel, reason = "changed") {
  if (!isMobileLike()) return;
  const p = panel || getPanel();
  if (!p) return;
  const st = ensureState(p);
  if (!st) return;

  if (st.saveTimer) {
    try { clearTimeout(st.saveTimer); } catch {}
    st.saveTimer = 0;
  }

  const seq = ++st.saveSeq;
  const r = safeReason(reason, "changed");
  log(p, "workarea:mobile-save:autosave-scheduled:v12", { reason: r, delay: SAVE_DELAY_MS, seq, guard: GUARD_ID });

  st.saveTimer = window.setTimeout(() => {
    st.saveTimer = 0;
    // Wenn inzwischen eine neue Änderung kam, ist seq veraltet.
    if (seq !== st.saveSeq) return;
    directSave(p, `scheduled:${r}`);
  }, SAVE_DELAY_MS);
}

function wrapMethod(proto, name, wrapperFactory) {
  const current = proto?.[name];
  if (typeof current !== "function") return false;
  if (current[WRAP_FLAG]) return false;
  const wrapped = wrapperFactory(current);
  if (typeof wrapped !== "function") return false;
  wrapped[WRAP_FLAG] = true;
  wrapped.__previousWorkareaMobileSaveV12 = current;
  proto[name] = wrapped;
  return true;
}

function shouldAutosaveReason(reason) {
  const text = safeReason(reason).toLowerCase();
  if (text.includes("manual-save")) return false;
  if (text.includes("autosave-after-workarea")) return false;
  if (text.includes("ui:")) return false;
  // Struktur-Detail-Editor bleibt bewusst ohne schweren Autosave.
  if (text.includes("structure-detail")) return false;
  return true;
}

function installBusSavedHook(panel) {
  try {
    const p = panel || getPanel();
    if (!p?.bus || p.__bpMobileAutosaveV12BusHooked) return;
    p.__bpMobileAutosaveV12BusHooked = true;
    p.bus.on?.("cb:persist:saved", () => markSaved(p, "cb:persist:saved:v12"));
  } catch {}
}

function emergencySave(reason = "emergency") {
  const p = getPanel();
  const st = ensureState(p);
  if (!p || !st?.dirty) return;
  try {
    cancelPendingV12Save(p, `emergency:${reason}`);
    log(p, "workarea:mobile-save:emergency:v12", { reason, guard: GUARD_ID });
    p.bus?.emit?.("ui:project:save", {
      source: "workarea",
      reason: `emergency:${reason}:v12`,
      ts: Date.now()
    });
  } catch {}
}

function install() {
  if (!isMobileLike()) return false;
  if (window.__BP_WORKAREA_MOBILE_AUTOSAVE_V12_INSTALLED) {
    ensureButton();
    return false;
  }
  window.__BP_WORKAREA_MOBILE_AUTOSAVE_V12_INSTALLED = true;

  const proto = WorkareaPanel?.prototype;
  if (!proto) return false;

  wrapMethod(proto, "mount", (original) => async function patchedMountMobileSaveV12(...args) {
    const result = await original.apply(this, args);
    setActivePanel(this);
    clearLegacyTimers(this, "mount:v12");
    installBusSavedHook(this);
    ensureButton();
    return result;
  });

  wrapMethod(proto, "_onViewportPointerDown", (original) => function patchedPointerDownMobileSaveV12(ev, ...rest) {
    setActivePanel(this);
    // Neue Geste: eventuell geplanten Save abbrechen, aber alten Legacy-Kram stoppen.
    cancelPendingV12Save(this, "pointerdown:v12");
    clearLegacyTimers(this, "pointerdown:v12");
    return original.call(this, ev, ...rest);
  });

  wrapMethod(proto, "_onViewportPointerUp", (original) => function patchedPointerUpMobileSaveV12(ev, ...rest) {
    const result = original.call(this, ev, ...rest);
    clearLegacyTimers(this, "pointerup:v12");
    return result;
  });

  wrapMethod(proto, "_persistSceneToStore", (original) => function patchedPersistSceneMobileSaveV12(reason = "scene", ...rest) {
    setActivePanel(this);
    const r = safeReason(reason, "scene");

    // Sofort sichtbar machen, BEVOR der schwere Store-Persist auf iOS läuft.
    if (shouldAutosaveReason(r)) markDirty(this, r);

    const result = original.call(this, reason, ...rest);

    clearLegacyTimers(this, `persist:${r}:v12`);
    if (shouldAutosaveReason(r)) scheduleAutosave(this, r);
    return result;
  });

  wrapMethod(proto, "_requestProjectSaveDebounced", (original) => function patchedRequestSaveMobileSaveV12(reason = "workarea", ...rest) {
    if (isMobileLike()) {
      // Auf Mobile übernimmt v12 das Speichern nach _persistSceneToStore().
      // Dieser alte Debounce-Pfad wird geblockt, damit keine Doppel-Timer laufen.
      clearLegacyTimers(this, `debounced-block:${reason}:v12`);
      log(this, "workarea:mobile-save:debounced-blocked:v12", { reason: safeReason(reason), guard: GUARD_ID });
      return;
    }
    return original.call(this, reason, ...rest);
  });

  try {
    document.addEventListener("visibilitychange", () => {
      const p = getPanel();
      if (document.visibilityState === "hidden") emergencySave("visibility-hidden");
      else {
        clearLegacyTimers(p, "visibility-visible:v12");
        ensureButton();
      }
    }, { passive: true });
  } catch {}

  try {
    window.addEventListener("pagehide", () => emergencySave("pagehide"), { capture: true });
  } catch {}

  ensureButton();
  try { console.info(`[${PATCH_ID}] installed`); } catch {}
  try { window.BP_CRASH_RECORDER?.log?.("workarea:mobile-save:v12-installed", { guard: GUARD_ID, file: "workarea-mobile-save-hardcut.v11.js" }); } catch {}
  return true;
}

install();

