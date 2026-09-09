import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const nav = read("ui/shell/ModuleNavigation.js");
const commandBar = read("ui/shell/GlobalCommandBar.js");
const shellCss = read("ui/css/ui-shell-im02.css");
const index = read("index.html");

assert.match(nav, /const PRIMARY_MODULE_IDS = Object\.freeze\(\[\s*"module\.project",\s*"module\.planning",\s*"module\.asset-development",\s*"module\.settings"/s,
  "global shell must expose exactly the approved four primary product areas");
assert.doesNotMatch(nav, /PRIMARY_MODULE_IDS[\s\S]*?"module\.hall3d"[\s\S]*?\]\);/,
  "3D Halle must not be promoted to a fifth primary product area");
assert.match(nav, /createNavButton\(hall, \{ secondary: true \}\)/,
  "3D Halle must remain reachable as a Planning secondary entry");
assert.match(nav, /bp-module-nav__icon/);
assert.match(nav, /<svg viewBox="0 0 24 24"/);
assert.doesNotMatch(nav, /bp-module-nav__mark/,
  "legacy square navigation markers must be removed from the visible shell");
assert.match(nav, /is-parent-active/,
  "Planning must remain visually related while Hall3D is active");

assert.match(commandBar, /const BUILD_ID = "UI-REC-01B · B1"/);
assert.match(commandBar, /buildId\.dataset\.bpBuildId = "UI-REC-01B-B1"/);
assert.match(commandBar, /COMMAND_ICONS/);
assert.match(commandBar, /icon: "new"/);
assert.match(commandBar, /icon: "file"/);
assert.match(commandBar, /icon: "debug"/);

assert.match(shellCss, /--bp-shell-rail-w:\s*88px/,
  "desktop shell must use the compact icon rail");
assert.match(shellCss, /grid-column:\s*1;\s*\n\s*grid-row:\s*1 \/ -1/,
  "desktop icon rail must span the product shell vertically");
assert.match(shellCss, /\.bp-module-nav__item\s*\{[\s\S]*flex-direction:\s*column/,
  "desktop navigation must be icon-first");
assert.match(shellCss, /\.bp-module-nav__item--secondary/,
  "Planning secondary navigation styling must exist");
assert.match(shellCss, /@media \(max-width: 700px\)[\s\S]*\.bp-module-nav__item,[\s\S]*flex-direction:\s*row/s,
  "phone drawer must switch navigation to icon + text rows");
assert.match(shellCss, /\.bp-commandbar__button-label[\s\S]*clip:/,
  "global command buttons must use compact icon presentation with accessible labels");

assert.match(index, /ui-shell-im02\.css\?v=ui-rec-01b-b1/);
assert.match(index, /shell-bootstrap\.js\?v=ui-rec-01b-b1/);

console.log("[UI-REC-01B] PASS global product shell icon layout");
