import { DEFAULT_PROJECT_WORKSPACE_REGISTRY } from "../core/navigation/project-workspace-registry.js";

function fail(message) {
  console.error(`[UI-MIG-04B] FAIL: ${message}`);
  process.exitCode = 1;
}

const available = DEFAULT_PROJECT_WORKSPACE_REGISTRY.listAvailable();
const planned = DEFAULT_PROJECT_WORKSPACE_REGISTRY.listPlanned();
const availableIds = available.map((item) => item.id);
const plannedIds = planned.map((item) => item.id);

const expectedAvailable = ["general", "projects", "assets", "libraries"];
for (const id of expectedAvailable) {
  if (!availableIds.includes(id)) fail(`available project view missing: ${id}`);
}
if (availableIds.length !== expectedAvailable.length) {
  fail(`unexpected available project views: ${availableIds.join(", ")}`);
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
  console.log("[UI-MIG-04B] PASS project workspace contract");
}
