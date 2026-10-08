import { DEFAULT_NAVIGATION_CONTROLLER } from "../core/navigation/navigation-controller.js";

const cases = [
  ["projectPanel:general", "workspace.project", "general", "projectPanel:general"],
  ["projectPanel:projects", "workspace.project", "projects", "projectPanel:projects"],
  ["projectPanel:assets", "workspace.project", "assets", "projectPanel:assets"],
  ["projectPanel:libraries", "workspace.project", "libraries", "projectPanel:libraries"],
  ["projectPanel:assetlab3d", "workspace.asset-development", "main", "projectPanel:assetlab3d"],
  ["tools:workarea", "workspace.planning", "main", "tools:workarea"],
  ["settings:workspace", "workspace.settings", "workspace", "settings:workspace"],
  ["workspace.project/general", "workspace.project", "general", "projectPanel:general"],
  ["workspace.planning", "workspace.planning", "main", "tools:workarea"],
  ["module.planning", "workspace.planning", "main", "tools:workarea"],
  ["module.asset-development", "workspace.asset-development", "main", "projectPanel:assetlab3d"]
];

for (const [input, workspaceId, viewId, legacyPanelId] of cases) {
  const resolved = DEFAULT_NAVIGATION_CONTROLLER.resolve(input);
  if (!resolved) throw new Error(`Navigation unresolved: ${input}`);
  if (resolved.workspaceId !== workspaceId) {
    throw new Error(`${input}: workspaceId ${resolved.workspaceId} !== ${workspaceId}`);
  }
  if (resolved.viewId !== viewId) {
    throw new Error(`${input}: viewId ${resolved.viewId} !== ${viewId}`);
  }
  if (resolved.legacyPanelId !== legacyPanelId) {
    throw new Error(`${input}: legacyPanelId ${resolved.legacyPanelId} !== ${legacyPanelId}`);
  }
}

const passthrough = DEFAULT_NAVIGATION_CONTROLLER.resolve("projectPanel:unknown-legacy-panel");
if (passthrough?.legacyPanelId !== "projectPanel:unknown-legacy-panel") {
  throw new Error("Unknown legacy keys must remain passthrough-compatible during IM01");
}

console.log(`Navigation Foundation Check PASS (${cases.length} mappings + passthrough)`);
