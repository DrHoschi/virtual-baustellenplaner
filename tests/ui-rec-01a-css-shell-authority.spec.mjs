import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const index = read("index.html");
const geometry = read("ui/css/ui-planning-geometry.css");
const controls = read("ui/css/ui-planning-controls-cleanup.css");
const bootstrap = read("ui/shell/shell-bootstrap.js");
const commandBar = read("ui/shell/GlobalCommandBar.js");
const authority = read("docs/UI_REC_01A_ACTIVE_CSS_SHELL_AUTHORITY.md");

assert.doesNotMatch(index, /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["'][^"']*ui-planning-ownership\.css(?:\?[^"']*)?["'])[^>]*>/i,
  "obsolete Planning ownership hard-disable layer must not be loaded");
assert.doesNotMatch(index, /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["'][^"']*ui-planning-left-content-fit\.css(?:\?[^"']*)?["'])[^>]*>/i,
  "legacy left content-fit layer must not be loaded after migration");

assert.match(index, /ui-planning-geometry\.css\?v=ui-rec-01a-single-geometry-authority/);
assert.match(index, /ui-planning-right-content-fit\.css\?v=ui-rec-01a-right-content-fit/);
assert.match(index, /ui-planning-controls-cleanup\.css\?v=ui-rec-01a-chrome-content-owner/);
assert.match(index, /ui-workarea\.css\?v=ui-rec-01a-content-only/);

assert.match(geometry, /Core Planning geometry|Approved Workarea Usability Layout/);
assert.match(geometry, /\.wa-shell\[data-bp-planning-layout="three-region-v1"\]/);

assert.match(controls, /\.wa-center > \.wa-console-drawer/,
  "remaining ownership-layer console suppression must be migrated to current chrome owner");
assert.match(controls, /UI-REC-01A: migrated non-geometric left-region content-fit rules/);
assert.match(controls, /\.wa-structure-tree__label/);
assert.match(controls, /\[data-bp-insert-sources\]/);
assert.doesNotMatch(controls, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  "legacy G.1 two-column tab geometry must not be migrated into the current chrome owner");

assert.match(bootstrap, /ui-project-workspace-nav\.css/);
assert.match(bootstrap, /ui-planning-topbar\.css/);
assert.match(bootstrap, /ui-planning-context\.css/);
assert.match(bootstrap, /ui-planning-status\.css/);

assert.match(commandBar, /const BUILD_ID = "UI-REC-01A · A1"/);
assert.match(commandBar, /buildId\.dataset\.bpBuildId = "UI-REC-01A-A1"/);

assert.match(authority, /ui\/css\/ui-planning-ownership\.css` \| UNLOAD/);
assert.match(authority, /ui\/css\/ui-planning-left-content-fit\.css` \| MERGE THEN UNLOAD/);
assert.match(authority, /ui\/css\/ui-planning-geometry\.css` \| KEEP/);
assert.match(authority, /PlanningWorkspaceAdapter\.js` \| FUNCTIONAL DO NOT TOUCH/);
assert.match(authority, /Keine Navigation wird in UI-REC-01A optisch neu gestaltet/);

console.log("[UI-REC-01A] PASS active CSS / shell authority cut");
