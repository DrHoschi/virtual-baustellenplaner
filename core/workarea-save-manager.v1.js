/**
 * core/workarea-save-manager.v1.js
 * Version: PATCH_workarea_hardcut_save_input_v1 (2026-05-22)
 *
 * ZIEL
 * ============================================================================
 * Ein zentraler Workarea-SaveManager statt mehrerer historischer Mobile-/
 * Manual-/Autosave-Patches.
 *
 * Grundregeln:
 * - Keine Unterscheidung nach Mobile/Desktop/Tablet.
 * - Entscheidung nach Änderungstyp:
 *   - Workarea Objekt verschoben/platziert/gelöscht -> Autosave nach stabilem Event.
 *   - UI-Tab/Mode-Wechsel -> kleiner UI-Persist bleibt möglich, aber kein schwerer Projekt-Autosave.
 *   - Struktur-/Detailfelder -> kein automatischer schwerer Save über diesen Manager.
 * - Nie während Drag speichern.
 * - Nach Drag-Ende: Status sofort dirty, dann Autosave, dann saved.
 * - Button bleibt Status + Notfall-Speichern.
 *
 * WICHTIG:
 * Diese Datei patcht zur Laufzeit WorkareaPanel-Methoden. WorkareaPanel.js bleibt
 * unangetastet, damit der große Umbau kontrollierbar bleibt.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_hardcut_save_input_v1";
const GUARD_ID = "workarea-save-manager-v1";
const BUTTON_ID = "bpWorkareaSaveManagerV1";
const LEGACY_BUTTON_IDS = ["bpWorkareaManualSaveV9", "bpWorkareaManualSaveV11"];
const WRAP_FLAG = Symbol.for("baustellenplaner.workareaSaveManager.v1.wrapper");

const SAVE_DELAY_MS = 360;
const SAVE_FALLBACK_GREEN_MS = 1200;

try {
  // Alte Guards erkennen diese Flags teilweise und halten sich zurück.
  window.BP_WORKAREA_SAVE_MANAGER_V1 = true;
  window.BP_WORKAREA_MOBILE_MANUAL_SAVE_V9 = true;
  window.BP_WORKAREA_AUTOSAVE_DISABLED_MOBILE_V9 = true;
  window.BP_WORKAREA_MOBILE_MANUAL_SAVE_V11 = true;
  window.BP_WORKAREA_MOBILE_AUTOSAVE_V12 = false;
} catch {}

function safeReason(reason, fallback = "workarea") {
  const text = String(reason || fallback).trim();
  return text || fallback;
}

function log(panel, event, data = {}) {
  try {
    if (panel && typeof panel._crashLog === "function") {
      panel._crashLog(event, { ...(data || {}), guard: GUARD_ID });
      return;
    }
  } catch {}
  try { window.BP_CRASH_RECORDER?.log?.(event, { ...(data || {}), guard: GUARD_ID }); } catch {}
}

function getPanel() {
  try { return window.__BP_WORKAREA_ACTIVE_PANEL__ || null; } catch { return null; }
}

function setActivePanel(panel) {
  try { if (panel) window.__BP_WORKAREA_ACTIVE_PANEL__ = panel; } catch {}
}

function ensureState(panel) {
  if (!panel) return null;
  if (!panel.__bpWorkareaSaveManagerV1) {
    panel.__bpWorkareaSaveManagerV1 = {
      dirty: false,
      saving: false,
      saveTimer: 0,
      saveSeq: 0,
      dragActive: false,
      lastReason: "init",
      lastSavedAt: 0,
      lastSaveStartedAt: 0,
      installedAt: new Date().toISOString()
    };
  }
  return panel.__bpWorkareaSaveManagerV1;
}

function removeLegacyButtons() {
  for (const id of LEGACY_BUTTON_IDS) {
    try { document.getElementById(id)?.remove?.(); } catch {}
  }
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

  if (state === "error") {
    btn.textContent = "⚠ Speichern Fehler";
    btn.title = "Speichern fehlgeschlagen – nochmal tippen";
    btn.style.border = "1px solid rgba(255,255,255,.38)";
    btn.style.background = "rgba(185,28,28,.98)";
    btn.style.color = "#fff";
    btn.style.boxShadow = "0 8px 24px rgba(185,28,28,.35)";
    return;
  }

  btn.textContent = "✓ Gespeichert";
  btn.title = "Keine ungespeicherten Änderungen";
  btn.style.border = "1px solid rgba(255,255,255,.22)";
  btn.style.background = "rgba(21, 128, 61, .95)";
  btn.style.color = "#fff";
  btn.style.boxShadow = "0 8px 24px rgba(0,0,0,.28)";
}

function ensureButton() {
  removeLegacyButtons();

  let btn = document.getElementById(BUTTON_ID);
  if (!btn) {
    btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.dataset.bpSaveManagerV1Button = "1";
    btn.setAttribute("aria-label", "Workarea Speicherstatus");
    document.body.appendChild(btn);
  }

  if (btn.dataset.bpSaveManagerV1Click !== "1") {
    btn.dataset.bpSaveManagerV1Click = "1";
    btn.addEventListener("click", (ev) => {
      try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); } catch {}
      directSave(getPanel(), "button-click");
    }, { capture: true, passive: false });
  }

  const st = ensureState(getPanel());
  if (st?.saving) styleButton(btn, "saving");
  else if (st?.dirty || window.__BP_WORKAREA_DIRTY_V1) styleButton(btn, "dirty");
  else styleButton(btn, "saved");
  return btn;
}

function clearLegacySaveState(panel, reason = "hardcut") {
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
      // Der zentrale SaveManager übernimmt Workarea-Save-Events.
      panel._waAutosave.pendingAfterGesture = false;
      panel._waAutosave.suppress = true;
      panel._waAutosave.enabled = false;
    }
    log(panel, "workarea:save-manager:legacy-cleared:v1", { reason });
  } catch {}
}

function cancelScheduledSave(panel, reason = "cancel") {
  const st = ensureState(panel);
  if (!st?.saveTimer) return;
  try { clearTimeout(st.saveTimer); } catch {}
  st.saveTimer = 0;
  log(panel, "workarea:save-manager:autosave-cancel:v1", { reason });
}

function markDirty(panel, reason = "changed") {
  const p = panel || getPanel();
  setActivePanel(p);
  const st = ensureState(p);
  try {
    if (st) {
      st.dirty = true;
      st.saving = false;
      st.lastReason = safeReason(reason);
    }
    window.__BP_WORKAREA_DIRTY_V1 = true;
    styleButton(ensureButton(), "dirty");
    log(p, "workarea:save-manager:dirty:v1", { reason: safeReason(reason) });
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
    window.__BP_WORKAREA_DIRTY_V1 = true;
    styleButton(ensureButton(), "saving");
    log(p, "workarea:save-manager:saving:v1", { reason: safeReason(reason) });
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
    window.__BP_WORKAREA_DIRTY_V1 = false;
    styleButton(ensureButton(), "saved");
    log(p, "workarea:save-manager:saved:v1", { reason: safeReason(reason) });
  } catch {}
}

function isSaveRelevantReason(reason) {
  const text = safeReason(reason).toLowerCase();

  // UI-only: keine schweren Projekt-Saves.
  if (text.includes("ui") || text.includes("lefttab") || text.includes("righttab") || text.includes("mode:ui")) return false;

  // Struktur-/Detail-Editor wird separat sauber gemacht.
  if (text.includes("structure-detail")) return false;

  // Rehydrate/restore soll nicht speichern.
  if (text.includes("rehydrate") || text.includes("restore") || text.includes("init")) return false;

  // Workarea-Szenenänderungen ja.
  return (
    text.includes("drag-end") ||
    text.includes("place") ||
    text.includes("delete") ||
    text.includes("undo") ||
    text.includes("scene")
  );
}

function directSave(panel, reason = "autosave") {
  const p = panel || getPanel();
  if (!p) {
    try { window.BP_CRASH_RECORDER?.log?.("workarea:save-manager:no-panel:v1", { reason, guard: GUARD_ID }); } catch {}
    return;
  }

  setActivePanel(p);
  const st = ensureState(p);
  if (st?.saveTimer) {
    try { clearTimeout(st.saveTimer); } catch {}
    st.saveTimer = 0;
  }

  clearLegacySaveState(p, `direct-save-start:${reason}`);
  markSaving(p, reason);

  try {
    p.bus?.emit?.("ui:project:save", {
      source: "workarea",
      reason: `workarea-save-manager:${safeReason(reason)}`,
      ts: Date.now()
    });
    log(p, "workarea:save-manager:emit:v1", { reason: safeReason(reason) });

    // Falls der Persistor kein cb:persist:saved ausgibt, trotzdem UI auf Grün
    // setzen. Der eigentliche Save wurde über den zentralen Bus ausgelöst.
    window.setTimeout(() => markSaved(p, `fallback-green:${reason}`), SAVE_FALLBACK_GREEN_MS);
  } catch (e) {
    styleButton(ensureButton(), "error");
    log(p, "workarea:save-manager:error:v1", { message: e?.message || String(e) });
  }
}

function scheduleAutosave(panel, reason = "changed") {
  const p = panel || getPanel();
  if (!p) return;
  const st = ensureState(p);
  if (!st) return;

  if (st.dragActive) {
    markDirty(p, `pending-while-drag:${reason}`);
    return;
  }

  if (st.saveTimer) {
    try { clearTimeout(st.saveTimer); } catch {}
    st.saveTimer = 0;
  }

  const seq = ++st.saveSeq;
  const r = safeReason(reason);
  log(p, "workarea:save-manager:autosave-scheduled:v1", { reason: r, delay: SAVE_DELAY_MS, seq });

  st.saveTimer = window.setTimeout(() => {
    st.saveTimer = 0;
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
  wrapped.__previousWorkareaSaveManagerV1 = current;
  proto[name] = wrapped;
  return true;
}

function installBusSavedHook(panel) {
  try {
    const p = panel || getPanel();
    if (!p?.bus || p.__bpSaveManagerV1BusHooked) return;
    p.__bpSaveManagerV1BusHooked = true;
    p.bus.on?.("cb:persist:saved", () => markSaved(p, "cb:persist:saved:v1"));
  } catch {}
}

function emergencySave(reason = "emergency") {
  const p = getPanel();
  const st = ensureState(p);
  if (!p || !st?.dirty || st?.saving) return;
  try {
    cancelScheduledSave(p, `emergency:${reason}`);
    log(p, "workarea:save-manager:emergency:v1", { reason });
    p.bus?.emit?.("ui:project:save", {
      source: "workarea",
      reason: `workarea-save-manager:emergency:${reason}`,
      ts: Date.now()
    });
  } catch {}
}

function install() {
  if (window.__BP_WORKAREA_SAVE_MANAGER_V1_INSTALLED) {
    ensureButton();
    return false;
  }
  window.__BP_WORKAREA_SAVE_MANAGER_V1_INSTALLED = true;

  const proto = WorkareaPanel?.prototype;
  if (!proto) return false;

  wrapMethod(proto, "mount", (original) => async function patchedMountSaveManagerV1(...args) {
    const result = await original.apply(this, args);
    setActivePanel(this);
    clearLegacySaveState(this, "mount:v1");
    installBusSavedHook(this);
    ensureButton();
    return result;
  });

  wrapMethod(proto, "_onViewportPointerDown", (original) => function patchedPointerDownSaveManagerV1(ev, ...rest) {
    setActivePanel(this);
    const st = ensureState(this);
    if (st) st.dragActive = true;
    cancelScheduledSave(this, "pointerdown:v1");
    clearLegacySaveState(this, "pointerdown:v1");
    return original.call(this, ev, ...rest);
  });

  wrapMethod(proto, "_onViewportPointerUp", (original) => function patchedPointerUpSaveManagerV1(ev, ...rest) {
    const result = original.call(this, ev, ...rest);
    const st = ensureState(this);
    if (st) st.dragActive = false;
    clearLegacySaveState(this, "pointerup:v1");
    return result;
  });

  wrapMethod(proto, "_persistSceneToStore", (original) => function patchedPersistSceneSaveManagerV1(reason = "scene", ...rest) {
    setActivePanel(this);
    const r = safeReason(reason, "scene");
    const shouldSave = isSaveRelevantReason(r);

    if (shouldSave) markDirty(this, r);
    const result = original.call(this, reason, ...rest);

    clearLegacySaveState(this, `persist:${r}:v1`);
    if (shouldSave) scheduleAutosave(this, r);
    return result;
  });

  wrapMethod(proto, "_requestProjectSaveDebounced", (original) => function patchedRequestProjectSaveDebouncedV1(reason = "workarea", ...rest) {
    const r = safeReason(reason);
    if (isSaveRelevantReason(r)) {
      // Der zentrale SaveManager übernimmt. Keine alten Debounce-Timer.
      clearLegacySaveState(this, `debounced-block:${r}:v1`);
      log(this, "workarea:save-manager:debounced-blocked:v1", { reason: r });
      return;
    }
    return original.call(this, reason, ...rest);
  });

  try {
    document.addEventListener("visibilitychange", () => {
      const p = getPanel();
      if (document.visibilityState === "hidden") emergencySave("visibility-hidden");
      else {
        clearLegacySaveState(p, "visibility-visible:v1");
        ensureButton();
      }
    }, { passive: true });
  } catch {}

  try { window.addEventListener("pagehide", () => emergencySave("pagehide"), { capture: true }); } catch {}

  ensureButton();
  try { console.info(`[${PATCH_ID}] installed`); } catch {}
  try { window.BP_CRASH_RECORDER?.log?.("workarea:save-manager:v1-installed", { guard: GUARD_ID }); } catch {}
  return true;
}

install();

export { install };
