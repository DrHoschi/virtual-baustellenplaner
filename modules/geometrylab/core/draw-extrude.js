/**
 * modules/geometrylab/core/draw-extrude.js
 * Version: v0.1.3-viewplane-orientation (2026-05-17)
 *
 * GeometryLab — 2D-Kontur -> 3D-Extrude Preview
 * =============================================================================
 * Dieses Modul ist bewusst klein und unabhängig vom AssetLab-Host gehalten.
 * Es erzeugt aus einer 2D-Punktliste auf der X/Z-Ebene eine extrudierte
 * 3D-Geometrie mit Höhe entlang der Y-Achse.
 *
 * Sicherheitsprinzip:
 * - Preview und GLB-Übernahme bleiben sauber getrennt.
 * - Dieses Modul erzeugt nur die Geometrie. Der AssetLab-Host entscheidet,
 *   ob daraus ein Slot-Modell gespeichert wird.
 *
 * Patch v0.1.2:
 * - Dreiecks-Winding wird nach der X/Z -> X/Y/Z-Achsenumlegung korrigiert.
 *   Ohne diese Korrektur wirken die Körper wie „von innen“ sichtbar.
 *
 * Patch v0.1.3:
 * - Option `viewPlane` ergänzt: top/xz, front/xy, right/yz, left/yz.
 *   Damit kann das GeometryLab später eindeutig speichern, aus welcher
 *   Zeichenebene ein Körper entstanden ist. Die Workarea kann daraus eine
 *   saubere Draufsicht / Top-Thumbnail ableiten.
 */

const EPS = 1e-6;

function finiteNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}


function normalizeViewPlane(viewPlane) {
  const v = String(viewPlane || "top").toLowerCase().trim();
  if (v === "front" || v === "xy") return "front";
  if (v === "right" || v === "yz") return "right";
  if (v === "left") return "left";
  return "top";
}

function mapExtrudeVertexToWorld(x2d, y2d, depth, viewPlane) {
  // Lokale 2D-Zeichenpunkte heißen historisch x/z. THREE.ExtrudeGeometry
  // arbeitet intern aber mit (x2d, y2d, depth). Diese Funktion legt fest,
  // auf welche echte 3D-Ebene diese Werte geschrieben werden.
  const plane = normalizeViewPlane(viewPlane);

  if (plane === "front") {
    // Front/XY: Kontur liegt in X/Y, Extrusion geht in Z-Tiefe.
    return { x: x2d, y: y2d, z: depth };
  }

  if (plane === "right") {
    // Right/YZ: Kontur liegt in Z/Y, Extrusion geht nach X.
    return { x: depth, y: y2d, z: x2d };
  }

  if (plane === "left") {
    // Left/YZ gespiegelt: praktisch für linksseitige Seitenansichten.
    return { x: -depth, y: y2d, z: x2d };
  }

  // Top/XZ: Kontur liegt auf der Bodenebene X/Z, Extrusion geht nach Y.
  return { x: x2d, y: depth, z: y2d };
}

function almostSamePoint(a, b) {
  if (!a || !b) return false;
  return Math.abs(finiteNumber(a.x) - finiteNumber(b.x)) < EPS &&
         Math.abs(finiteNumber(a.z) - finiteNumber(b.z)) < EPS;
}

export function sanitizeDrawPoints(points) {
  const out = [];
  for (const p of Array.isArray(points) ? points : []) {
    const next = { x: finiteNumber(p?.x), z: finiteNumber(p?.z) };
    if (!out.length || !almostSamePoint(out[out.length - 1], next)) out.push(next);
  }

  // Falls der Nutzer bereits auf den Startpunkt zurückgeklickt hat, entfernen
  // wir den doppelten letzten Punkt. Die Kontur wird intern automatisch geschlossen.
  if (out.length > 2 && almostSamePoint(out[0], out[out.length - 1])) out.pop();
  return out;
}

export function polygonSignedAreaXZ(points) {
  const pts = sanitizeDrawPoints(points);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += (a.x * b.z) - (b.x * a.z);
  }
  return area * 0.5;
}

export function getDrawBounds(points) {
  const pts = sanitizeDrawPoints(points);
  if (!pts.length) {
    return {
      min: { x: 0, z: 0 },
      max: { x: 0, z: 0 },
      size: { x: 0, z: 0 },
      center: { x: 0, z: 0 },
    };
  }

  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxZ = Math.max(maxZ, p.z);
  }

  return {
    min: { x: minX, z: minZ },
    max: { x: maxX, z: maxZ },
    size: { x: maxX - minX, z: maxZ - minZ },
    center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
  };
}


function flipTriangleWinding(geometry) {
  if (!geometry) return geometry;

  // Indexed Geometry: pro Dreieck Index 1 und 2 tauschen.
  // Dadurch zeigen die Normalen nach der Achsenumlegung wieder nach außen.
  const idx = geometry.index;
  if (idx && idx.array && idx.count >= 3) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      const b = idx.getX(i + 2);
      idx.setX(i + 1, b);
      idx.setX(i + 2, a);
    }
    idx.needsUpdate = true;
    return geometry;
  }

  // Non-indexed Geometry: jedes Dreieck besteht direkt aus 3 Positions-Tripeln.
  // Wir tauschen Vertex 1 und 2 inklusive aller vorhandenen vertex-basierten
  // Attribute mit passender ItemSize. Das hält UVs/Normalen defensiv synchron.
  const pos = geometry.attributes?.position;
  if (!pos || pos.count < 3) return geometry;

  const attrNames = Object.keys(geometry.attributes || {});
  for (let tri = 0; tri < pos.count; tri += 3) {
    const ia = tri + 1;
    const ib = tri + 2;

    for (const name of attrNames) {
      const attr = geometry.attributes[name];
      if (!attr || !attr.array || typeof attr.itemSize !== "number") continue;
      const size = attr.itemSize;
      for (let k = 0; k < size; k++) {
        const va = attr.getComponent(ia, k);
        const vb = attr.getComponent(ib, k);
        attr.setComponent(ia, k, vb);
        attr.setComponent(ib, k, va);
      }
      attr.needsUpdate = true;
    }
  }

  return geometry;
}

/**
 * Erzeugt eine Three.js-Gruppe mit extrudiertem Mesh aus einer X/Z-Kontur.
 *
 * Technische Notiz:
 * THREE.ExtrudeGeometry extrudiert standardmäßig entlang +Z. Über `viewPlane`
 * legen wir fest, ob diese 2D-Kontur als Top-/Front-/Right-/Left-Ansicht in
 * das Baustellen-Koordinatensystem geschrieben wird.
 */
export function buildExtrudedPolygonObject(THREE, points, options = {}) {
  if (!THREE) throw new Error("buildExtrudedPolygonObject: THREE missing");

  const clean = sanitizeDrawPoints(points);
  const height = Math.max(0.001, finiteNumber(options.height, 1));
  const name = String(options.name || "GeometryLab Extrude Preview");
  const viewPlane = normalizeViewPlane(options.viewPlane || options.plane || "top");

  if (clean.length < 3) {
    return {
      ok: false,
      error: "Kontur braucht mindestens 3 Punkte",
      pointCount: clean.length,
    };
  }

  // Shape-Richtung stabilisieren. Das verhindert in vielen Fällen invertierte
  // Deckflächen bei einfacher Polygon-Geometrie.
  let shapePoints = clean.slice();
  if (polygonSignedAreaXZ(shapePoints) < 0) shapePoints = shapePoints.reverse();

  const shape = new THREE.Shape();
  shape.moveTo(shapePoints[0].x, shapePoints[0].z);
  for (let i = 1; i < shapePoints.length; i++) {
    shape.lineTo(shapePoints[i].x, shapePoints[i].z);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x2d = pos.getX(i);
    const y2d = pos.getY(i);
    const depth = pos.getZ(i);
    const mapped = mapExtrudeVertexToWorld(x2d, y2d, depth, viewPlane);
    pos.setXYZ(i, mapped.x, mapped.y, mapped.z);
  }
  pos.needsUpdate = true;

  // WICHTIG:
  // Einige Achsen-Umlegungen tauschen mathematisch Achsen und kippen damit die
  // Händigkeit des Koordinatensystems. Die Winding-Korrektur ist für Top sicher
  // nötig und für die anderen Ebenen defensiv stabiler als ein halbseitiger
  // Spezialfall.
  flipTriangleWinding(geo);

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.75,
    metalness: 0.02,
    transparent: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `${name} Mesh`;
  mesh.userData.geometryLab = {
    kind: "draw-extrude-preview",
    schema: "baustellenplaner.geometry.drawExtrude.v1",
    pointCount: clean.length,
    height,
    points: clean.map((p) => ({ x: p.x, z: p.z })),
    viewPlane,
  };

  const group = new THREE.Group();
  group.name = name;
  group.userData.geometryLab = mesh.userData.geometryLab;
  group.add(mesh);

  const bounds = getDrawBounds(clean);

  return {
    ok: true,
    object3d: group,
    mesh,
    pointCount: clean.length,
    height,
    viewPlane,
    bounds,
    triangleCount: Math.floor(pos.count / 3),
  };
}

export function formatDrawExtrudeSummary(result) {
  if (!result?.ok) return `GeometryLab: ${result?.error || "keine gültige Kontur"}`;
  const sx = result.bounds?.size?.x ?? 0;
  const sz = result.bounds?.size?.z ?? 0;
  const plane = result.viewPlane ? ` · Ebene ${result.viewPlane}` : "";
  return `GeometryLab Preview · ${result.pointCount} Punkt(e) · Höhe ${Number(result.height).toFixed(2)}${plane} · BBox ${Number(sx).toFixed(2)} × ${Number(result.height).toFixed(2)} × ${Number(sz).toFixed(2)} · ${result.triangleCount} Dreieck(e)`;
}
