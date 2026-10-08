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

// Backward-compatible inventory: these project areas remain registered and available.
for (const id of ["general", "projects", "assets", "libraries"]) {
  if (!availableIds.includes(id)) fail(`available project area missing: ${id}`);
}
if (availableIds.length !== 4) {
  fail(`unexpected available project areas: ${availableIds.join(", ")}`);
}

// PROJECT_STATE_OPEN exposes project content only.
const openIds = DEFAULT_PROJECT_WORKSPACE_REGISTRY
  .listAvailableForState(PROJECT_WORKSPACE_STATE.OPEN)
  .map((item) => item.id);
const expectedOpen = ["general", "assets", "libraries"];
if (openIds.length !== expectedOpen.length || expectedOpen.some((id) => !openIds.includes(id))) {
  fail(`PROJECT_STATE_OPEN must expose exactly ${expectedOpen.join(", ")}; got: ${openIds.join(", ")}`);
}
if (openIds.includes("projects")) {
  fail("project management must not be exposed as PROJECT_STATE_OPEN content");
}

// PROJECT_STATE_NONE is project management / create-flow territory.
const noneIds = DEFAULT_PROJECT_WORKSPACE_REGISTRY
  .listAvailableForState(PROJECT_WORKSPACE_STATE.NONE)
  .map((item) => item.id);
if (noneIds.length !== 1 || noneIds[0] !== "projects") {
  fail(`PROJECT_STATE_NONE must expose exactly projects; got: ${noneIds.join(", ")}`);
}

if (DEFAULT_PROJECT_WORKSPACE_REGISTRY.resolveWorkspaceState("projectPanel:wizard") !== PROJECT_WORKSPACE_STATE.NONE) {
  fail("projectPanel:wizard must resolve to PROJECT_STATE_NONE");
}
for (const panelId of ["projectPanel:general", "projectPanel:assets", "projectPanel:libraries"]) {
  if (DEFAULT_PROJECT_WORKSPACE_REGISTRY.resolveWorkspaceState(panelId) !== PROJECT_WORKSPACE_STATE.OPEN) {
    fail(`${panelId} must resolve to PROJECT_STATE_OPEN`);
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
  console.log("[PROJECT-UI-02A] PASS project workspace state-shell contract");
}
