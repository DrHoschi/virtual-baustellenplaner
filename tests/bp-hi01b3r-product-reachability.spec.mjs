import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const pack = JSON.parse(read("manifest-pack.json"));
const plugin = JSON.parse(read("plugins/mod.project.hall3d.json"));
const registry = read("ui/panels/panel-registry.js");
const panel = read("ui/panels/Hall3DPanel.js");
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

const buildMarkers = index.match(/data-bp-build-id="BP-HI01B\.3R-R1"/g) || [];
assert.equal(buildMarkers.length, 2, "Build identifier must be visible in desktop and mobile shell");
assert.match(index, /BP-HI01B\.3R · R1/);

console.log("[BP-HI01B.3R] PASS Hall3D product reachability + visible build identifier");
