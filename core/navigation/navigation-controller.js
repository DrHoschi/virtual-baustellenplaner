/**
 * UI-MIG-02-IM01 – Navigation Controller Foundation
 *
 * IM01 löst Navigation nur semantisch auf. Sichtbare Shell, History/Back,
 * Workspace-State-Preservation und Kontext-Transitions folgen in IM02/IM03.
 */

import { DEFAULT_MODULE_REGISTRY } from "./module-registry.js";
import { DEFAULT_WORKSPACE_REGISTRY } from "./workspace-registry.js";
import { DEFAULT_LEGACY_NAVIGATION_ADAPTER } from "./legacy-navigation-adapter.js";

function parseWorkspaceTarget(input) {
  const raw = String(input || "").trim();
  if (!raw.startsWith("workspace.")) return null;

  // Unterstützt sowohl "workspace.project/general" als auch den reinen
  // Workspace-Key "workspace.project". Der Workspace liefert dann seine
  // Default-View.
  const slash = raw.indexOf("/");
  if (slash < 0) return { workspaceId: raw, viewId: null };

  return {
    workspaceId: raw.slice(0, slash),
    viewId: raw.slice(slash + 1) || null
  };
}

export function createNavigationController({
  moduleRegistry = DEFAULT_MODULE_REGISTRY,
  workspaceRegistry = DEFAULT_WORKSPACE_REGISTRY,
  legacyAdapter = DEFAULT_LEGACY_NAVIGATION_ADAPTER
} = {}) {
  function resolve(input) {
    const raw = String(input || "").trim();
    if (!raw) return null;

    const legacy = legacyAdapter.resolve(raw);
    if (legacy) {
      const target = workspaceRegistry.resolve(legacy.workspaceId, legacy.viewId);
      return target ? { ...target, source: "legacy", input: raw, legacyKey: legacy.legacyKey } : null;
    }

    const workspaceTarget = parseWorkspaceTarget(raw);
    if (workspaceTarget) {
      const target = workspaceRegistry.resolve(workspaceTarget.workspaceId, workspaceTarget.viewId);
      return target ? { ...target, source: "workspace", input: raw } : null;
    }

    const module = moduleRegistry.get(raw);
    if (module?.workspaceId) {
      const target = workspaceRegistry.resolve(module.workspaceId, null);
      return target ? { ...target, source: "module", input: raw } : null;
    }

    // Unbekannte historische Panel-IDs werden bewusst nicht blockiert.
    // Dadurch bleiben während der Parallelmigration noch nicht gemappte
    // Registry-/Stub-Einträge über das alte Panel-System erreichbar.
    return {
      source: "passthrough",
      input: raw,
      workspaceId: null,
      moduleId: null,
      viewId: null,
      legacyPanelId: raw,
      status: "legacy-passthrough"
    };
  }

  return Object.freeze({
    resolve,

    resolvePanelId(input) {
      return resolve(input)?.legacyPanelId || null;
    },

    resolveModule(input) {
      const target = resolve(input);
      return target?.moduleId ? moduleRegistry.get(target.moduleId) : null;
    }
  });
}

export const DEFAULT_NAVIGATION_CONTROLLER = createNavigationController();
