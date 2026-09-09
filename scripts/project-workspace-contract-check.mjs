import {
  DEFAULT_PROJECT_WORKSPACE_REGISTRY,
  PROJECT_WORKSPACE_STATE
} from "../core/navigation/project-workspace-registry.js";

function fail(message) {
  console.error(`[PROJECT-UI-02A] FAIL: ${message}`);
  process.exitCode = 1;
}

const available = DEFAULT_PROJECT_WORKSPACE_REGISTRY.listAvailable();
const planned = DEFAULT_PROJECT_WORKSPACE_REGISTRY.listPlanned();
const availableIds = available.map((item) => item.id);
const plannedIds = planned.map((item) => item.id);

// Backward-compatible inventory: implementations remain registered.
const expectedAvailable = ["general", "projects", "assets", "libraries"];
for (const id of expectedAvailable) {
  if (!availableIds.includes(id)) fail(`available project view missing: ${id}`);
}
if (availableIds.length !== expectedAvailable.length) {
  fail(`unexpected available project views: ${availableIds.join(", ")}`);
}

// PROJECT-UI-02A: visible navigation is state-owned.
const openIds = DEFAULT_PROJECT_WORKSPACE_REGISTRY
  .listAvailableForState(PROJECT_WORKSPACE_STATE.OPEN)
  .map((item) => item.id);
const noneIds = DEFAULT_PROJECT_WORKSPACE_REGISTRY
  .listAvailableForState(PROJECT_WORKSPACE_STATE.NONE)
  .map((item) => item.id);

for (const id of ["general", "assets", "libraries"]) {
  if (!openIds.includes(id)) fail(`OPEN project view missing: ${id}`);
}
if (openIds.length !== 3) {
  fail(`unexpected OPEN project views: ${openIds.join(", ")}`);
}
if (noneIds.length !== 1 || noneIds[0] !== "projects") {
  fail(`PROJECT_STATE_NONE must own only project management: ${noneIds.join(", ")}`);
}

if (DEFAULT_PROJECT_WORKSPACE_REGISTRY.resolveWorkspaceState("projectPanel:wizard") !== PROJECT_WORKSPACE_STATE.NONE) {
  fail("wizard must belong to PROJECT_STATE_NONE create flow");
}
for (const panelId of ["projectPanel:general", "projectPanel:assets", "projectPanel:libraries"]) {
  if (DEFAULT_PROJECT_WORKSPACE_REGISTRY.resolveWorkspaceState(panelId) !== PROJECT_WORKSPACE_STATE.OPEN) {
    fail(`panel must belong to PROJECT_STATE_OPEN: ${panelId}`);
  }
}

for (const id of ["structure", "versions"]) {
  if (!plannedIds.includes(id)) fail(`planned project view missing: ${id}`);
  if (availableIds.includes(id)) fail(`stub/planned view exposed as available: ${id}`);
}

const settings = DEFAULT_PROJECT_WORKSPACE_REGISTRY.settingsOwnership();
for (const [id, entry] of Object.entries(settings)) {
  if (entry?.owner !== "application") fail(`settings ownership must stay application: ${id}`);
}
if (settings.workspace?.statePath !== "app.settings.workspace") {
  fail("workspace settings state path must remain app.settings.workspace");
}

if (!process.exitCode) {
  console.log("[PROJECT-UI-02A] PASS project workspace state shell contract");
}
