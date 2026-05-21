/**
 * core/workarea-mobile-manual-save-stability.v9.js
 * Version: PATCH_workarea_mobile_manual_save_stability_v9 (2026-05-21)
 *
 * ZIEL
 * Nach v7/v8 sind die Detail-Editor- und Tab-Persist-Wege weitgehend ruhig.
 * Im Crashlog blieb auf iPhone/Safari vor allem der globale Autosave-/Input-
 * Pfad übrig: pointerdown + touchstart + mousedown + Timerketten.
 *
 * Dieser Patch schaltet Mobile/iOS deshalb bewusst auf MANUELLEN SAVE:
 * - Workarea-Autosave wird auf Mobile deaktiviert.
 * - automatische Projekt-Saves aus Workarea werden blockiert.
 * - pendingAfterGesture-/Idle-Timer werden gelöscht.
 * - Ein kleiner sichtbarer Speichern-Button löst den kontrollierten Save aus.
 *
 * WICHTIG
 * Das ist ein Stabilitäts-Hardcut. Ziel ist zuerst: keine iOS-Neustarts mehr.
 * Danach kann ein sauberer Dirty-State + kontrollierter Speichern-Kanal folgen.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_mobile_manual_save_stability_v9";
const GUARD_ID = "workarea-mobile-manual-save-stability-v9";
const WRAP_FLAG = Symbol.for("baustellenplaner.workareaMobileManualSave.v9.wrapper");

// Wichtig: main.js liest dieses Flag, bevor es den alten Autosave-Drag-Guard lädt.
try { window.BP_WORKAREA_MOBILE_MANUAL_SAVE_V9 = true; } catch {}

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

function isManualSaveReason(reason) {
  const r = String(reason || "").toLowerCase();
  return r.includes("manual") || r.includes("speichern-button") || r.includes("save-button") || r.includes("user-save");
}

function clearWorkareaSaveTimers(panel, reason = "manual-save-mode") {
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
      panel._waAutosave.suppress = true;
      panel._waAutosave.enabled = false;
    }
    log(panel, "workarea:autosave:timers-cleared:v9", { reason, guard: GUARD_ID });
  } catch {}
}

function setManualMode(panel, reason = "set-manual-mode") {
  if (!isMobileLike() || !panel) return;
  try {
    panel.__bpManualSaveV9 = true;
    window.__BP_WORKAREA_ACTIVE_PANEL__ = panel;
    if (panel._waAutosave) {
      panel._waAutosave.enabled = false;
      panel._waAutosave.suppress = true;
      panel._waAutosave.pendingAfterGesture = false;
      if (panel._waAutosave.timer) {
        try { clearTimeout(panel._waAutosave.timer); } catch {}
        panel._waAutosave.timer = 0;
      }
    }
    if (panel._waAutosaveGuard?.idleTimer) {
      try { clearTimeout(panel._waAutosaveGuard.idleTimer); } catch {}
      panel._waAutosaveGuard.idleTimer = 0;
    }
    if (!panel.__bpManualSaveV9Logged) {
      panel.__bpManualSaveV9Logged = true;
      log(panel, "workarea:autosave:disabled-mobile:v9", { reason, guard: GUARD_ID });
    }
  } catch {}
}

function wrapMethod(proto, name, wrapperFactory) {
  const current = proto?.[name];
  if (typeof current !== "function") return false;
  if (current[WRAP_FLAG]) return false;
  const wrapped = wrapperFactory(current);
  if (typeof wrapped !== "function") return false;
  wrapped[WRAP_FLAG] = true;
  wrapped.__previousWorkareaManualSaveV9 = current;
  proto[name] = wrapped;
  return true;
}

function ensureManualSaveButton() {
  if (!isMobileLike()) return;
  try {
    if (document.getElementById("bpWorkareaManualSaveV9")) return;

    const btn = document.createElement("button");
    btn.id = "bpWorkareaManualSaveV9";
    btn.type = "button";
    btn.textContent = "Speichern";
    btn.title = "Workarea manuell speichern";
    btn.setAttribute("aria-label", "Workarea manuell speichern");
    btn.style.position = "fixed";
    btn.style.right = "10px";
    btn.style.bottom = "10px";
    btn.style.zIndex = "99999";
    btn.style.border = "1px solid rgba(255,255,255,.24)";
    btn.style.borderRadius = "999px";
    btn.style.padding = "9px 13px";
    btn.style.font = "600 13px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    btn.style.background = "rgba(24, 33, 48, .94)";
    btn.style.color = "#fff";
    btn.style.boxShadow = "0 8px 24px rgba(0,0,0,.35)";
    btn.style.backdropFilter = "blur(8px)";

    btn.addEventListener("click", () => {
      const panel = window.__BP_WORKAREA_ACTIVE_PANEL__;
      if (!panel) {
        try { window.BP_CRASH_RECORDER?.log?.("workarea:manual-save:v9:no-panel", { guard: GUARD_ID }); } catch {}
        return;
      }
      try {
        const previousEnabled = !!panel._waAutosave?.enabled;
        const previousSuppress = !!panel._waAutosave?.suppress;

        // Scene bewusst in den Store schreiben. Der folgende Projekt-Save ist
        // erlaubt, weil der Grund "manual-save" enthält.
        try {
          if (typeof panel._persistSceneToStore === "function") {
            panel._persistSceneToStore("manual-save:v9");
          }
        } catch (e) {
          log(panel, "workarea:manual-save:v9:persist-error", { message: e?.message || String(e), guard: GUARD_ID });
        }

        if (panel._waAutosave) {
          panel._waAutosave.enabled = true;
          panel._waAutosave.suppress = false;
        }
        if (typeof panel._requestProjectSaveDebounced === "function") {
          panel._requestProjectSaveDebounced("manual-save:v9");
        } else if (panel.bus?.emit) {
          panel.bus.emit("ui:project:save", { source: "workarea", reason: "manual-save:v9", ts: Date.now() });
        }

        // Nach dem kontrollierten Save wieder in den sicheren Manual-Modus.
        window.setTimeout(() => {
          try {
            if (panel._waAutosave) {
              panel._waAutosave.enabled = previousEnabled && false;
              panel._waAutosave.suppress = previousSuppress || true;
            }
            setManualMode(panel, "after-manual-save");
          } catch {}
        }, 1200);

        log(panel, "workarea:manual-save:requested:v9", { guard: GUARD_ID });
      } catch (e) {
        log(panel, "workarea:manual-save:error:v9", { message: e?.message || String(e), guard: GUARD_ID });
      }
    }, { passive: true });

    document.body.appendChild(btn);
    try { window.BP_CRASH_RECORDER?.log?.("workarea:manual-save-button:ready:v9", { guard: GUARD_ID }); } catch {}
  } catch {}
}

function install(label = "initial") {
  const proto = WorkareaPanel?.prototype;
  if (!proto) return false;

  let changed = false;

  changed = wrapMethod(proto, "mount", (original) => async function patchedMountV9(...args) {
    const result = await original.apply(this, args);
    setManualMode(this, "mount");
    ensureManualSaveButton();
    return result;
  }) || changed;

  changed = wrapMethod(proto, "_requestProjectSaveDebounced", (original) => function patchedRequestProjectSaveDebouncedV9(reason = "workarea", ...rest) {
    if (isMobileLike() && !isManualSaveReason(reason)) {
      setManualMode(this, "request-block");
      clearWorkareaSaveTimers(this, String(reason || "workarea"));
      log(this, "workarea:autosave:blocked-mobile:v9", {
        reason: String(reason || "workarea"),
        guard: GUARD_ID
      });
      return;
    }

    // Manueller Save: kurz erlauben und danach wieder abschalten.
    if (isMobileLike() && isManualSaveReason(reason)) {
      try {
        if (this._waAutosave) {
          this._waAutosave.enabled = true;
          this._waAutosave.suppress = false;
          this._waAutosave.debounceMs = Math.min(Number(this._waAutosave.debounceMs || 650) || 650, 650);
        }
      } catch {}
      const result = original.call(this, reason, ...rest);
      window.setTimeout(() => setManualMode(this, "manual-save-finished"), 1600);
      return result;
    }

    return original.call(this, reason, ...rest);
  }) || changed;

  changed = wrapMethod(proto, "_onViewportPointerUp", (original) => function patchedPointerUpManualSaveV9(ev, ...rest) {
    const result = original.call(this, ev, ...rest);
    if (isMobileLike()) {
      // Der alte Guard würde nach pointerup einen Idle-Save planen. Mobile v9
      // räumt diese Kette sofort wieder ab.
      clearWorkareaSaveTimers(this, "pointerup-manual-mode");
    }
    return result;
  }) || changed;

  changed = wrapMethod(proto, "_onViewportPointerDown", (original) => function patchedPointerDownManualSaveV9(ev, ...rest) {
    setManualMode(this, "pointerdown");
    return original.call(this, ev, ...rest);
  }) || changed;

  if (changed) {
    try { console.info(`[${PATCH_ID}] installed ${label}`); } catch {}
    try { window.BP_CRASH_RECORDER?.log?.("workarea:mobile-manual-save:v9-installed", { label, guard: GUARD_ID }); } catch {}
  }

  ensureManualSaveButton();
  return changed;
}

install("initial");
for (const delay of [0, 50, 250, 750, 1500, 3000]) {
  window.setTimeout(() => install(`delayed-${delay}`), delay);
  window.setTimeout(() => ensureManualSaveButton(), delay + 10);
}

export {};
