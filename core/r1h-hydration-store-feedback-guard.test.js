import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

/**
 * R1h DIAGNOSTIC ONLY
 *
 * Verhindert die rekursive Store-Feedback-Schleife:
 * store.update("app") -> cb:store:changed -> _maybeHydrate()
 * -> _ensureProjectWorkspaceSceneShape() -> store.update("app") -> ...
 *
 * Die bestehende Ensure-/Migration-Logik bleibt erhalten. Sie wird nur dann
 * aufgerufen, wenn app.project.workspace.scene.objects tatsächlich fehlt oder
 * kein Array ist. Bei bereits gültiger Scene-Struktur erfolgt kein Store-Write.
 */

const proto = WorkareaPanel?.prototype;

if (proto && !proto.__r1hHydrationStoreFeedbackGuardInstalled) {
  const originalEnsure = proto._ensureProjectWorkspaceSceneShape;

  proto._ensureProjectWorkspaceSceneShape = function r1hEnsureProjectWorkspaceSceneShape(reason = "ensureProjectScene") {
    try {
      const app = this.store?.get?.("app") || {};
      const pid = String(app?.activeProjectId || "").trim();
      if (!pid) return false;

      const objects = app?.project?.workspace?.scene?.objects;
      if (Array.isArray(objects)) {
        return true;
      }
    } catch {}

    return typeof originalEnsure === "function"
      ? originalEnsure.call(this, reason)
      : false;
  };

  Object.defineProperty(proto, "__r1hHydrationStoreFeedbackGuardInstalled", {
    value: true,
    configurable: true
  });
}
