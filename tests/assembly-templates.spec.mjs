#!/usr/bin/env node
/*
 * Minimaler Smoke-Test für das Assembly-Datenmodell.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createAssemblyInstance } from "../core/assemblies/assembly-model.js";
import { buildBomFromAssemblyInstance } from "../core/assemblies/assembly-bom.js";

const root = process.cwd();
const file = path.join(root, "data", "assembly-templates.v1.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const roller = data.templates.find((tpl) => tpl.id === "template.roller-conveyor.max.v1");

assert.ok(roller, "roller conveyor template exists");

const inst = createAssemblyInstance(roller, {
  name: "RB-6201",
  variantId: "rb.bidirectional.both_sides",
  x: 100,
  y: 200
});

assert.equal(inst.type, "assembly.instance");
assert.equal(inst.name, "RB-6201");
assert.equal(inst.variantId, "rb.bidirectional.both_sides");
assert.ok(inst.components.length > 0, "active components exist");
assert.ok(inst.ports.length > 0, "active ports exist");

const bom = buildBomFromAssemblyInstance(inst);
assert.ok(bom.length > 0, "bom lines exist");
assert.ok(bom.some((line) => line.label.includes("MOVIFIT")), "MOVIFIT in BOM");

console.log("[assembly-templates.spec] OK");
