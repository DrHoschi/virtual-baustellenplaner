/**
 * core/workarea-mobile-manual-save-dirty-indicator.v10.js
 * Version: PATCH_workarea_mobile_manual_save_dirty_indicator_v10 (2026-05-21)
 *
 * ZIEL
 * v9 hat Mobile/iPhone auf bewussten manuellen Save umgestellt. Der Crashlog
 * zeigt aber: Der v9-Speichern-Button ruft noch den alten debounced Save-Pfad
 * (_requestProjectSaveDebounced) auf. Dadurch entstehen wieder save:scheduled-
 * Timer. Außerdem fehlt eine klare Anzeige, ob gespeichert werden muss.
 *
 * v10 ergänzt deshalb:
 * - Dirty-State: Änderungen färben den Speichern-Button deutlich orange/rot.
 * - Text: „Speichern nötig“ vs. „Gespeichert“.
 * - Manueller Save ohne debounced Autosave-Timer.
 * - v9-Button wird ersetzt, damit dessen alter Click-Handler nicht mehr läuft.
 *
 * LADEREIHENFOLGE
 * Nach v9 laden:
 * <script type="module" src="./core/workarea-mobile-manual-save-dirty-indicator.v10.js?v=10"></script>
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_mobile_manual_save_dirty_indicator_v10";
const GUARD_ID = "workarea-mobile-manual-save-dirty-indicator-v10";
const WRAP_FLAG = Symbol.for("baustellenplaner.workareaMobileManualSaveDirty.v10.wrapper");
const BUTTON_ID = "bpWorkareaManualSaveV9"; // absichtlich gleicher Button wie v9, wird aber ersetzt

try { window.BP_WORKAREA_MOBILE_MANUAL_SAVE_DIRTY_V10 = true; } catch {}

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

function isManualReason(reason) {
  const r = String(reason || "").toLowerCase();
  return r.includes("manual-save") || r.includes("manual") || r.includes("speichern-button") || r.includes("user-save");
}

function clearTimers(panel, reason = "v10") {
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
    log(panel, "workarea:manual-save:timers-cleared:v10", { reason, guard: GUARD_ID });
  } catch {}
}

function setDirty(panel, reason = "changed") {
  if (!isMobileLike()) return;
  try {
    const p = panel || getPanel();
    if (p) {
      p.__bpManualSaveDirtyV10 = true;
      p.__bpManualSaveDirtyReasonV10 = String(reason || "changed");
      window.__BP_WORKAREA_ACTIVE_PANEL__ = p;
    }
    window.__BP_WORKAREA_DIRTY_V10 = true;
    updateButton("dirty", reason);
    log(p, "workarea:manual-save:dirty:v10", { reason: String(reason || "changed"), guard: GUARD_ID });
  } catch {}
}

function setSaved(panel, reason = "saved") {
  try {
    const p = panel || getPanel();
    if (p) {
      p.__bpManualSaveDirtyV10 = false;
      p.__bpManualSaveDirtyReasonV10 = null;
    }
    window.__BP_WORKAREA_DIRTY_V10 = false;
    updateButton("saved", reason);
    log(p, "workarea:manual-save:saved-state:v10", { reason: String(reason || "saved"), guard: GUARD_ID });
  } catch {}
}

function styleButton(btn, state = "saved") {
  if (!btn) return;

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
    btn.title = "Änderungen werden gespeichert";
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

function updateButton(state = null, reason = "update") {
  try {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    const finalState = state || (window.__BP_WORKAREA_DIRTY_V10 ? "dirty" : "saved");
    styleButton(btn, finalState);
    btn.dataset.bpDirtyState = finalState;
    btn.dataset.bpDirtyReason = String(reason || "update");
  } catch {}
}

function replaceV9Button() {
  if (!isMobileLike()) return null;
  try {
    let btn = document.getElementById(BUTTON_ID);

    // Wenn v9 bereits einen Button mit altem Click-Handler angelegt hat:
    // klonen und ersetzen entfernt sicher alle alten Listener.
    if (btn && btn.dataset.bpV10Button !== "1") {
      const clone = btn.cloneNode(false);
      clone.id = BUTTON_ID;
      clone.type = "button";
      clone.dataset.bpV10Button = "1";
      btn.replaceWith(clone);
      btn = clone;
    }

    if (!btn) {
      btn = document.createElement("button");
      btn.id = BUTTON_ID;
      btn.type = "button";
      btn.dataset.bpV10Button = "1";
      document.body.appendChild(btn);
    }

    if (btn.dataset.bpV10Click !== "1") {
      btn.dataset.bpV10Click = "1";
      btn.addEventListener("click", () => manualSave(), { passive: true });
    }

    updateButton(null, "ensure-button");
    return btn;
  } catch {
    return null;
  }
}

function manualSave() {
  const panel = getPanel();
  if (!panel) {
    try { window.BP_CRASH_RECORDER?.log?.("workarea:manual-save:no-panel:v10", { guard: GUARD_ID }); } catch {}
    return;
  }

  updateButton("saving", "manual-save-start");
  clearTimers(panel, "manual-save-start:v10");

  try {
    // 1) Scene/Objekte bewusst in app.project + project spiegeln.
    // Die anschließende _requestProjectSaveDebounced-Kette wird von v10 blockiert.
    try {
      if (typeof panel._persistSceneToStore === "function") {
        panel._persistSceneToStore("manual-save:v10");
      }
    } catch (e) {
      log(panel, "workarea:manual-save:persist-error:v10", { message: e?.message || String(e), guard: GUARD_ID });
    }

    // 2) Kein debounce, keine Timer-Kette: direkter bewusst ausgelöster Save.
    try {
      panel.bus?.emit?.("ui:project:save", {
        source: "workarea",
        reason: "manual-save-direct:v10",
        ts: Date.now()
      });
      log(panel, "workarea:manual-save:direct-emit:v10", { guard: GUARD_ID });
    } catch (e) {
      log(panel, "workarea:manual-save:direct-emit-error:v10", { message: e?.message || String(e), guard: GUARD_ID });
    }

    // 3) Sofort wieder in sicheren manuellen Modus.
    clearTimers(panel, "manual-save-finished:v10");
    window.setTimeout(() => {
      clearTimers(panel, "manual-save-final-cleanup:v10");
      setSaved(panel, "manual-save:v10");
    }, 120);
  } catch (e) {
    updateButton("dirty", "manual-save-error");
    log(panel, "workarea:manual-save:error:v10", { message: e?.message || String(e), guard: GUARD_ID });
  }
}

function wrapMethod(proto, name, wrapperFactory) {
  const current = proto?.[name];
  if (typeof current !== "function") return false;
  if (current[WRAP_FLAG]) return false;
  const wrapped = wrapperFactory(current);
  if (typeof wrapped !== "function") return false;
  wrapped[WRAP_FLAG] = true;
  wrapped.__previousWorkareaManualSaveDirtyV10 = current;
  proto[name] = wrapped;
  return true;
}

function install(label = "initial") {
  if (!isMobileLike()) return false;
  const proto = WorkareaPanel?.prototype;
  if (!proto) return false;

  let changed = false;

  changed = wrapMethod(proto, "mount", (original) => async function patchedMountV10(...args) {
    const result = await original.apply(this, args);
    try { window.__BP_WORKAREA_ACTIVE_PANEL__ = this; } catch {}
    replaceV9Button();
    updateButton(null, "mount");
    return result;
  }) || changed;

  changed = wrapMethod(proto, "_persistSceneToStore", (original) => function patchedPersistSceneToStoreV10(reason = "scene", ...rest) {
    const reasonText = String(reason || "scene");
    const result = original.call(this, reason, ...rest);

    // Manueller Save soll nicht erneut dirty machen.
    if (!isManualReason(reasonText)) {
      setDirty(this, reasonText);
    }
    return result;
  }) || changed;

  changed = wrapMethod(proto, "_requestProjectSaveDebounced", (original) => function patchedRequestProjectSaveDebouncedV10(reason = "workarea", ...rest) {
    const reasonText = String(reason || "workarea");

    if (isMobileLike()) {
      // v10: Auch manual-save darf NICHT mehr durch den debounced Timer-Pfad.
      // Der Button macht den direkten bus.emit("ui:project:save") selbst.
      clearTimers(this, `request-block:${reasonText}`);
      if (!isManualReason(reasonText)) setDirty(this, reasonText);
      log(this, "workarea:manual-save:debounced-request-blocked:v10", {
        reason: reasonText,
        guard: GUARD_ID
      });
      return;
    }

    return original.call(this, reason, ...rest);
  }) || changed;

  // Persist-Erfolg vom zentralen Persistor: Button grün setzen.
  try {
    const panel = getPanel();
    const bus = panel?.bus;
    if (bus && !window.__BP_WORKAREA_SAVE_DIRTY_V10_BUS_HOOKED) {
      window.__BP_WORKAREA_SAVE_DIRTY_V10_BUS_HOOKED = true;
      bus.on?.("cb:persist:saved", () => {
        const p = getPanel();
        setSaved(p, "cb:persist:saved");
      });
    }
  } catch {}

  replaceV9Button();

  if (changed) {
    try { console.info(`[${PATCH_ID}] installed ${label}`); } catch {}
    try { window.BP_CRASH_RECORDER?.log?.("workarea:manual-save-dirty:v10-installed", { label, guard: GUARD_ID }); } catch {}
  }
  return changed;
}

install("initial");
for (const delay of [0, 50, 250, 750, 1500, 3000, 6000]) {
  window.setTimeout(() => install(`delayed-${delay}`), delay);
  window.setTimeout(() => replaceV9Button(), delay + 15);
}

export {};
