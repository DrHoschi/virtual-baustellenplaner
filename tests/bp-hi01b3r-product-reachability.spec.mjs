import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const pack = JSON.parse(read("manifest-pack.json"));
const plugin = JSON.parse(read("plugins/mod.project.hall3d.json"));
const registry = read("ui/panels/panel-registry.js");
const panel = read("ui/panels/Hall3DPanel.js");
const moduleRegistry = read("core/navigation/module-registry.js");
const moduleNavigation = read("ui/shell/ModuleNavigation.js");
const index = read("index.html");

assert.ok(
  pack.plugins.includes("plugins/mod.project.hall3d.json"),
  "Hall3D product plugin must be part of manifest-pack.json"
);

const entry = plugin.ui?.menuEntries?.[0];
assert.equal(entry?.anchor, "projectPanel");
assert.equal(entry?.tabId, "hall3d");
assert.equal(entry?.title, "3D Halle");

assert.match(registry, /import\s+\{\s*Hall3DPanel\s*\}\s+from\s+"\.\/Hall3DPanel\.js"/);
assert.match(registry, /register\("projectPanel",\s*"hall3d",\s*\(ctx\)\s*=>\s*new Hall3DPanel\(ctx\)\)/);

assert.match(panel, /createHall3DView/);
assert.match(panel, /three@0\.161\.0\/build\/three\.module\.js/);
assert.match(panel, /globalThis\.THREE\s*=\s*mod/);

assert.match(moduleRegistry, /id:\s*"module\.hall3d"/);
assert.match(moduleRegistry, /label:\s*"3D Halle"/);
assert.match(moduleRegistry, /status:\s*"available"/);
assert.match(moduleNavigation, /"module\.hall3d":\s*"projectPanel:hall3d"/);
assert.match(moduleNavigation, /"projectPanel:hall3d":\s*"module\.hall3d"/);

const buildMarkers = index.match(/data-bp-build-id="BP-HI01B\.3R-R2"/g) || [];
assert.equal(buildMarkers.length, 2, "R2 build identifier must be visible in desktop and mobile shell");
assert.match(index, /BP-HI01B\.3R · R2/);

console.log("[BP-HI01B.3R] PASS visible shell projection + Hall3D product reachability + R2 build identifier");
