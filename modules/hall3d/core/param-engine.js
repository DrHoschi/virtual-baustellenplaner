/**
 * modules/hall3d/core/param-engine.js
 * Version: v1.0.0 (2026-02-26)
 *
 * Param Engine (v1) – bewusst klein, aber „echt“ lauffähig.
 *
 * Ziele (B + C):
 *  B) Parameter visuell im 3D ändern
 *     - Skalieren / Verschieben
 *     - Sichtbarkeit von Sub-Nodes
 *     - Rotation (z.B. Wartungsklappe am Skid)
 *
 *  C) Parameter für Berechnungen nutzen
 *     - einfache Stückliste (BOM)
 *     - Kosten / Gewicht / Kennzahlen
 *
 * ParamPack Format (JSON):
 * {
 *   "schema": "baustellenplaner.paramPack.v1",
 *   "id": "skid_production_v1",
 *   "label": "Prozess-Skid 5.25m",
 *   "defaults": { "length": 5.25, "flapOpen": 0 },
 *   "ui": { "groups": [ ... ] },
 *   "apply": {
 *     "root": { "scale": {"xExpr":"length / 5.25"} },
 *     "nodes": [
 *       {"name": "RepairFlap", "rotate": {"axis":"x", "degExpr":"flapOpen"}}
 *     ]
 *   },
 *   "bom": {
 *     "items": [
 *       {"id":"STEEL", "label":"Stahl", "qtyExpr":"length * 120", "unit":"kg", "unitCost": 2.2}
 *     ]
 *   }
 * }
 */

import { evaluateExpr } from "./param-math.js";

let _packCache = new Map();

function _isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Shallow merge für Parameter.
 * (v1: absichtlich simpel; später können wir hier deep-merge + schema-validierung ergänzen.)
 */
export function mergeParams(defaults, overrides) {
  return { ...(defaults || {}), ...(overrides || {}) };
}

/**
 * Lädt ParamPack JSON – cached.
 * @param {string} url
 */
export async function loadParamPack(url) {
  if (!url) return null;
  if (_packCache.has(url)) return _packCache.get(url);
  const pack = await fetch(url).then((r) => r.json());
  _packCache.set(url, pack);
  return pack;
}

/**
 * Apply ParamPack rules to a THREE.Group/Scene.
 * @param {any} root THREE.Object3D
 * @param {any} pack
 * @param {Record<string,any>} params
 */
export function applyParamPack(root, pack, params) {
  if (!root || !pack || !_isObj(pack)) return;

  const ctx = { params, p: params }; // beides erlauben (p.length oder params.length)

  // ------------------------
  // Root transforms
  // ------------------------
  const applyRoot = pack.apply?.root;
  if (_isObj(applyRoot)) {
    if (_isObj(applyRoot.position)) {
      const px = applyRoot.position.xExpr ? evaluateExpr(applyRoot.position.xExpr, ctx) : null;
      const py = applyRoot.position.yExpr ? evaluateExpr(applyRoot.position.yExpr, ctx) : null;
      const pz = applyRoot.position.zExpr ? evaluateExpr(applyRoot.position.zExpr, ctx) : null;
      if (px != null) root.position.x = px;
      if (py != null) root.position.y = py;
      if (pz != null) root.position.z = pz;
    }
    if (_isObj(applyRoot.scale)) {
      const sx = applyRoot.scale.xExpr ? evaluateExpr(applyRoot.scale.xExpr, ctx) : null;
      const sy = applyRoot.scale.yExpr ? evaluateExpr(applyRoot.scale.yExpr, ctx) : null;
      const sz = applyRoot.scale.zExpr ? evaluateExpr(applyRoot.scale.zExpr, ctx) : null;
      if (sx != null) root.scale.x = sx;
      if (sy != null) root.scale.y = sy;
      if (sz != null) root.scale.z = sz;
    }
    if (_isObj(applyRoot.rotate)) {
      const axis = applyRoot.rotate.axis || "y";
      const deg = applyRoot.rotate.degExpr ? evaluateExpr(applyRoot.rotate.degExpr, ctx) : 0;
      const rad = (deg * Math.PI) / 180;
      if (axis === "x") root.rotation.x = rad;
      else if (axis === "y") root.rotation.y = rad;
      else if (axis === "z") root.rotation.z = rad;
    }
  }

  // ------------------------
  // Node rules by name
  // ------------------------
  const nodes = Array.isArray(pack.apply?.nodes) ? pack.apply.nodes : [];
  if (!nodes.length) return;

  // Index by name (für Performance + Stabilität)
  const byName = new Map();
  root.traverse((o) => {
    if (!o?.name) return;
    if (!byName.has(o.name)) byName.set(o.name, []);
    byName.get(o.name).push(o);
  });

  for (const rule of nodes) {
    if (!rule?.name) continue;
    const targets = byName.get(rule.name) || [];
    for (const obj of targets) {
      // visible
      if (typeof rule.visibleExpr === "string") {
        const v = !!evaluateExpr(rule.visibleExpr, ctx);
        obj.visible = v;
      }
      // position
      if (_isObj(rule.position)) {
        const px = rule.position.xExpr ? evaluateExpr(rule.position.xExpr, ctx) : null;
        const py = rule.position.yExpr ? evaluateExpr(rule.position.yExpr, ctx) : null;
        const pz = rule.position.zExpr ? evaluateExpr(rule.position.zExpr, ctx) : null;
        if (px != null) obj.position.x = px;
        if (py != null) obj.position.y = py;
        if (pz != null) obj.position.z = pz;
      }
      // scale
      if (_isObj(rule.scale)) {
        const sx = rule.scale.xExpr ? evaluateExpr(rule.scale.xExpr, ctx) : null;
        const sy = rule.scale.yExpr ? evaluateExpr(rule.scale.yExpr, ctx) : null;
        const sz = rule.scale.zExpr ? evaluateExpr(rule.scale.zExpr, ctx) : null;
        if (sx != null) obj.scale.x = sx;
        if (sy != null) obj.scale.y = sy;
        if (sz != null) obj.scale.z = sz;
      }
      // rotate
      if (_isObj(rule.rotate)) {
        const axis = rule.rotate.axis || "y";
        const deg = rule.rotate.degExpr ? evaluateExpr(rule.rotate.degExpr, ctx) : 0;
        const rad = (deg * Math.PI) / 180;
        if (axis === "x") obj.rotation.x = rad;
        else if (axis === "y") obj.rotation.y = rad;
        else if (axis === "z") obj.rotation.z = rad;
      }
    }
  }
}

/**
 * Compute BOM + costs.
 * @param {any} pack
 * @param {Record<string,any>} params
 */
export function computeMetrics(pack, params) {
  if (!pack?.bom?.items || !Array.isArray(pack.bom.items)) {
    return { bom: [], totals: { cost: 0 } };
  }

  const ctx = { params, p: params };
  const bom = [];
  let totalCost = 0;

  for (const it of pack.bom.items) {
    if (!it?.id) continue;
    const qty = typeof it.qtyExpr === "string" ? evaluateExpr(it.qtyExpr, ctx) : Number(it.qty) || 0;
    const unitCost = Number(it.unitCost) || 0;
    const cost = qty * unitCost;
    totalCost += cost;
    bom.push({
      id: it.id,
      label: it.label || it.id,
      unit: it.unit || "",
      qty,
      unitCost,
      cost
    });
  }

  // Optional: Gewicht / andere totals später
  return {
    bom,
    totals: {
      cost: totalCost
    }
  };
}
