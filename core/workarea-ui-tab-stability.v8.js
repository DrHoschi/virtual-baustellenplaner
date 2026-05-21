/**
 * core/workarea-ui-tab-stability.v8.js
 * Version: PATCH_workarea_ui_tab_stability_v8 (2026-05-21)
 *
 * ZIEL:
 * Der neue Crashlog zeigt: Der Detail-Editor-Save ist durch v7 weitgehend
 * abgefangen. Die verbleibenden Neustarts treten jetzt im Umfeld von
 * Workarea-Tabwechseln / Workarea-UI-Persist / Unmount-Mount-Ketten auf.
 *
 * Deshalb wird hier nur der mobile UI-Tab-Persist entschärft:
 * - leftTab/rightTab-Wechsel bleiben im laufenden WorkareaPanel-State.
 * - Es wird KEIN store.update("app") nur wegen leftTab/rightTab ausgelöst.
 * - Damit soll der Loader nicht unnötig neu rendern / remounten.
 *
 * WICHTIG:
 * Das ist ein Stabilitäts-Hotfix. Die Tab-Auswahl wird während der Sitzung
 * beibehalten, aber nicht dauerhaft gespeichert. Normale Projekt-/Scene-Saves
 * bleiben unberührt.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_ui_tab_stability_v8";
const GUARD_ID = "workarea-ui-tab-stability-v8";
const WRAP_FLAG = Symbol.for("baustellenplaner.workareaUiTabStability.v8.wrapper");

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

function shouldBlockUiPersist(reason) {
  const r = String(reason || "");
  return r === "leftTab" || r === "rightTab" || r === "tabs" || r.includes("leftTab") || r.includes("rightTab");
}

function wrapMethod(proto, name, wrapperFactory) {
  const current = proto?.[name];
  if (typeof current !== "function") return false;
  if (current[WRAP_FLAG]) return false;

  const wrapped = wrapperFactory(current);
  if (typeof wrapped !== "function") return false;
  wrapped[WRAP_FLAG] = true;
  wrapped.__previousWorkareaUiTabStabilityV8 = current;
  proto[name] = wrapped;
  return true;
}

function install(label = "initial") {
  const proto = WorkareaPanel?.prototype;
  if (!proto) return false;

  let changed = false;

  changed = wrapMethod(proto, "_persistWorkareaUiToStore", (original) => function patchedPersistWorkareaUiToStoreV8(reason = "ui", ...rest) {
    if (isMobileLike() && shouldBlockUiPersist(reason)) {
      // Keine Store-Aktualisierung nur für Tabwechsel. Der State ist bereits
      // direkt in this.state.leftTabId/rightTabId gesetzt, also funktioniert
      // das UI weiter. Wir vermeiden nur den schweren globalen Store-Snapshot.
      log(this, "workarea:ui:persist:blocked:v8", {
        reason: String(reason || "ui"),
        leftTab: this?.state?.leftTabId || null,
        rightTab: this?.state?.rightTabId || null,
        guard: GUARD_ID
      });
      return;
    }
    return original.call(this, reason, ...rest);
  }) || changed;

  // Diagnose: Wenn die Workarea trotzdem unmountet, steht nun deutlicher im Log,
  // ob es direkt nach einem Tabwechsel passiert.
  changed = wrapMethod(proto, "unmount", (original) => function patchedUnmountV8(...args) {
    log(this, "workarea:unmount:trace:v8", {
      leftTab: this?.state?.leftTabId || null,
      rightTab: this?.state?.rightTabId || null,
      guard: GUARD_ID
    });
    return original.apply(this, args);
  }) || changed;

  if (changed) {
    try { console.info(`[${PATCH_ID}] installed ${label}`); } catch {}
    try { window.BP_CRASH_RECORDER?.log?.("workarea:ui-tab-stability:v8-installed", { label, guard: GUARD_ID }); } catch {}
  }

  return changed;
}

install("initial");
for (const delay of [0, 50, 250, 750, 1500, 3000]) {
  window.setTimeout(() => install(`delayed-${delay}`), delay);
}

export {};
