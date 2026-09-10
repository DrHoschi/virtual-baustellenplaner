import fs from "node:fs";

const adapterPath = "ui/shell/ProjectManagementAdapter.js";
const bootstrapPath = "ui/shell/shell-bootstrap.js";
const workspacePath = "core/navigation/project-workspace-registry.js";
const moduleNavPath = "ui/shell/ModuleNavigation.js";

for (const path of [adapterPath, bootstrapPath, workspacePath, moduleNavPath]) {
  if (!fs.existsSync(path)) throw new Error(`PROJECT-UI-02B contract: missing ${path}`);
}

const adapter = fs.readFileSync(adapterPath, "utf8");
const bootstrap = fs.readFileSync(bootstrapPath, "utf8");
const workspace = fs.readFileSync(workspacePath, "utf8");
const moduleNav = fs.readFileSync(moduleNavPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`PROJECT-UI-02B contract: ${message}`);
}

// 02B: existing-project Open is guarded and may only complete at Overview.
assert(adapter.includes('const PROJECT_MANAGEMENT_PANEL = "projectPanel:projects"'), "management source must stay projectPanel:projects");
assert(adapter.includes('const PROJECT_OVERVIEW_PANEL = "projectPanel:general"'), "successful Open target must be projectPanel:general");
assert(adapter.includes("validateLocalProject(projectId)"), "Open must validate the local project before transition");
assert(adapter.includes("event.preventDefault()") && adapter.includes("event.stopImmediatePropagation()"), "invalid Open must be blocked before legacy navigation runs");
assert(adapter.includes("sessionStorage.setItem(OPEN_TARGET_KEY"), "successful Open target must remain a transient session hint, not a new durable project authority");
assert(adapter.includes("clickLegacyTarget(PROJECT_OVERVIEW_PANEL)"), "pending successful Open must complete through the existing navigation bridge");
const adapterImportContract = [
  "import { installProjectManagementAdapter } from ",
  '".',
  '/ProjectManagementAdapter.js"'
].join("");
assert(bootstrap.includes(adapterImportContract), "02B adapter must be installed by the shell bootstrap");
assert(bootstrap.includes("installProjectManagementAdapter();"), "02B adapter installation missing");

// Frozen 02A invariants.
assert(workspace.includes('NONE: "PROJECT_STATE_NONE"'), "PROJECT_STATE_NONE must remain defined");
assert(workspace.includes('OPEN: "PROJECT_STATE_OPEN"'), "PROJECT_STATE_OPEN must remain defined");
for (const id of ["general", "assets", "libraries"]) {
  const pattern = new RegExp(`id:\\s*"${id}"[\\s\\S]*?workspaceState:\\s*PROJECT_WORKSPACE_STATE\\.OPEN`);
  assert(pattern.test(workspace), `${id} must remain an OPEN project-content view`);
}
assert(/id:\s*"projects"[\s\S]*?state:\s*PROJECT_WORKSPACE_STATE\.NONE/.test(workspace), "projects must remain PROJECT_STATE_NONE");
assert(/panelId:\s*"projectPanel:wizard"[\s\S]*?state:\s*PROJECT_WORKSPACE_STATE\.NONE/.test(workspace), "wizard must remain PROJECT_STATE_NONE");

// UI-REC-01B / Hall3D preservation invariant.
assert(moduleNav.includes('"module.hall3d": "projectPanel:hall3d"'), "3D Halle target must remain registered");
assert(moduleNav.includes('availableModule("module.hall3d")'), "3D Halle must remain exposed beneath Planning");
assert(moduleNav.includes('mod.id === "module.planning"'), "Hall3D parent placement under Planning must remain intact");

console.log("PROJECT-UI-02B Management Transition Contract: PASS");
