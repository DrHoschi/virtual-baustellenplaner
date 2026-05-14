/**
 * modules/geometrylab/importers/cmo-to-mesh.js
 * Version: v0.2.0-cmo-mesh-preview (2026-05-14)
 *
 * Baustellenplaner / GeometryLab
 * =============================================================================
 * Zweck:
 * - Experimenteller, defensiver CMO-Geometrie-Parser für Step 2.
 * - Liest aus alten REPP3D/Cybermotion-CMO-Dateien die sichtbaren
 *   >POINTS / >POINTSTART / >DOUBLE und >FACETS / >FACETSTART / >INTEGER
 *   Blöcke aus.
 * - Baut daraus eine reine Preview-Geometrie für AssetLab.
 *
 * Wichtig:
 * - Diese Datei speichert NICHT in ProjectAssets.
 * - Sie setzt NICHT hasModel=true.
 * - Sie dient nur dazu, die dekodierte Geometrie im Viewer zu prüfen.
 *
 * Stand der Reverse-Engineering-Annahme:
 * - Punkte liegen als little-endian Float64/Doubles vor.
 * - Facets liegen als little-endian Int32-Tripel vor.
 * - Facet-Indizes sind in den getesteten Dateien 1-basiert.
 * - CMO-Koordinaten werden für die Vorschau zunächst unverändert übernommen.
 */

/* ============================================================================
 * Byte-/Text-Helfer
 * ========================================================================== */

function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input && input.buffer instanceof ArrayBuffer) {
    return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength || input.length || 0);
  }
  return new Uint8Array(0);
}

function asciiBytes(text) {
  const s = String(text || "");
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function bytesToLatin1(bytes, maxBytes = 4096) {
  const u8 = toUint8Array(bytes);
  const n = Math.min(u8.length, maxBytes);
  let out = "";
  const chunk = 8192;
  for (let i = 0; i < n; i += chunk) {
    const part = u8.subarray(i, Math.min(i + chunk, n));
    out += String.fromCharCode(...part);
  }
  return out;
}

function normalizeLine(s) {
  return String(s || "").replace(/\0/g, "").trim();
}

function indexOfBytes(haystack, needle, from = 0, to = haystack.length) {
  const h = toUint8Array(haystack);
  const n = toUint8Array(needle);
  if (!h.length || !n.length || n.length > h.length) return -1;
  const end = Math.min(to, h.length) - n.length;
  for (let i = Math.max(0, from); i <= end; i++) {
    let ok = true;
    for (let j = 0; j < n.length; j++) {
      if (h[i + j] !== n[j]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

function findLineEnd(u8, from, to = u8.length) {
  for (let i = Math.max(0, from); i < Math.min(to, u8.length); i++) {
    if (u8[i] === 10 || u8[i] === 13) return i;
  }
  return -1;
}

function skipNewlinesAndSpaces(u8, from, to = u8.length) {
  let i = Math.max(0, from);
  const end = Math.min(to, u8.length);
  while (i < end && (u8[i] === 10 || u8[i] === 13 || u8[i] === 32 || u8[i] === 9)) i++;
  return i;
}

function readLineAt(u8, from, to = u8.length) {
  const start = skipNewlinesAndSpaces(u8, from, to);
  const end = findLineEnd(u8, start, to);
  if (end < 0) return { text: "", start, end: start, next: start };
  return {
    text: normalizeLine(bytesToLatin1(u8.subarray(start, end), 512)),
    start,
    end,
    next: skipNewlinesAndSpaces(u8, end + 1, to),
  };
}

/**
 * Sucht einen Marker als eigene Zeile.
 * Dadurch wird z. B. >POINTS nicht versehentlich in >POINTSTART gefunden.
 */
function findExactLineMarker(u8, marker, from = 0, to = u8.length) {
  const needle = asciiBytes(marker);
  let at = Math.max(0, from);
  const end = Math.min(to, u8.length);

  while (at < end) {
    const idx = indexOfBytes(u8, needle, at, end);
    if (idx < 0) return -1;

    // Wichtig: Nach Binärblöcken steht der nächste Marker in CMO-Dateien
    // teilweise DIREKT hinter dem letzten Datenbyte, ohne vorheriges CR/LF.
    // Darum prüfen wir nur das Zeichen NACH dem Marker. So vermeiden wir
    // weiterhin Prefix-Treffer wie >POINTS in >POINTSTART, finden aber
    // trotzdem >FACETS direkt nach Double-Daten.
    const after = idx + needle.length;
    const afterOk = after >= end || u8[after] === 10 || u8[after] === 13 || u8[after] === 32 || u8[after] === 9;

    if (afterOk) return idx;
    at = idx + 1;
  }

  return -1;
}

function readIntLineAfterMarker(u8, markerIdx, markerText, to = u8.length) {
  const lineEnd = findLineEnd(u8, markerIdx + markerText.length, to);
  if (lineEnd < 0) return { value: 0, next: markerIdx + markerText.length };
  const line = readLineAt(u8, lineEnd + 1, to);
  const value = Number.parseInt(line.text, 10);
  return { value: Number.isFinite(value) ? value : 0, next: line.next };
}

function readTypedNumberBlock(u8, typeMarker, from, expectedCount, bytesPerValue, readValue, to = u8.length) {
  const typeIdx = findExactLineMarker(u8, typeMarker, from, to);
  if (typeIdx < 0) return null;

  const countInfo = readIntLineAfterMarker(u8, typeIdx, typeMarker, to);
  const count = Math.max(0, countInfo.value || 0);
  const dataStart = countInfo.next;
  const safeCount = expectedCount && expectedCount > 0 ? Math.min(count, expectedCount) : count;
  const dataByteLength = safeCount * bytesPerValue;

  if (dataStart + dataByteLength > Math.min(to, u8.length)) return null;

  const dv = new DataView(u8.buffer, u8.byteOffset + dataStart, dataByteLength);
  const values = [];
  for (let i = 0; i < safeCount; i++) values.push(readValue(dv, i * bytesPerValue));

  return {
    count,
    values,
    dataStart,
    dataEnd: dataStart + dataByteLength,
  };
}

/* ============================================================================
 * CMO-Geometrie auslesen
 * ========================================================================== */

function parseObjectName(u8, from, to) {
  const nameIdx = findExactLineMarker(u8, ">NAME", from, to);
  if (nameIdx < 0) return "";
  const lineEnd = findLineEnd(u8, nameIdx + 5, to);
  if (lineEnd < 0) return "";
  const line = readLineAt(u8, lineEnd + 1, to);
  return line.text && !line.text.startsWith(">") ? line.text : "";
}

function parsePointBlock(u8, from, to) {
  const pointsIdx = findExactLineMarker(u8, ">POINTS", from, to);
  if (pointsIdx < 0) return null;

  const pointCountInfo = readIntLineAfterMarker(u8, pointsIdx, ">POINTS", to);
  const pointCount = Math.max(0, pointCountInfo.value || 0);

  const pointStartIdx = findExactLineMarker(u8, ">POINTSTART", pointCountInfo.next, to);
  if (pointStartIdx < 0) return null;

  const doubleBlock = readTypedNumberBlock(
    u8,
    ">DOUBLE",
    pointStartIdx,
    pointCount * 3,
    8,
    (dv, off) => dv.getFloat64(off, true),
    to
  );

  if (!doubleBlock || doubleBlock.values.length < 3) return null;

  const points = [];
  for (let i = 0; i + 2 < doubleBlock.values.length; i += 3) {
    const x = doubleBlock.values[i + 0];
    const y = doubleBlock.values[i + 1];
    const z = doubleBlock.values[i + 2];
    if ([x, y, z].every(Number.isFinite)) points.push([x, y, z]);
  }

  return {
    declaredPointCount: pointCount,
    doubleCount: doubleBlock.count,
    points,
    dataStart: doubleBlock.dataStart,
    dataEnd: doubleBlock.dataEnd,
  };
}

function parseFacetBlock(u8, from, to, pointCount) {
  const facetsIdx = findExactLineMarker(u8, ">FACETS", from, to);
  if (facetsIdx < 0) return null;

  const facetCountInfo = readIntLineAfterMarker(u8, facetsIdx, ">FACETS", to);
  const facetCount = Math.max(0, facetCountInfo.value || 0);

  const facetStartIdx = findExactLineMarker(u8, ">FACETSTART", facetCountInfo.next, to);
  if (facetStartIdx < 0) return null;

  const intBlock = readTypedNumberBlock(
    u8,
    ">INTEGER",
    facetStartIdx,
    facetCount * 3,
    4,
    (dv, off) => dv.getInt32(off, true),
    to
  );

  if (!intBlock || intBlock.values.length < 3) return null;

  const raw = intBlock.values;
  const triangles = [];
  let minIdx = Number.POSITIVE_INFINITY;
  let maxIdx = Number.NEGATIVE_INFINITY;
  for (const v of raw) {
    if (Number.isFinite(v)) {
      minIdx = Math.min(minIdx, v);
      maxIdx = Math.max(maxIdx, v);
    }
  }

  // Die getesteten CMO-Dateien sind 1-basiert. Falls später ein 0-basiertes
  // CMO auftaucht, akzeptieren wir das defensiv ebenfalls.
  const indexBase = (minIdx >= 1 && maxIdx <= pointCount) ? 1 : 0;

  for (let i = 0; i + 2 < raw.length; i += 3) {
    const a = raw[i + 0] - indexBase;
    const b = raw[i + 1] - indexBase;
    const c = raw[i + 2] - indexBase;
    if (a >= 0 && b >= 0 && c >= 0 && a < pointCount && b < pointCount && c < pointCount) {
      // Degenerierte Dreiecke ignorieren.
      if (a !== b && b !== c && a !== c) triangles.push([a, b, c]);
    }
  }

  return {
    declaredFacetCount: facetCount,
    integerCount: intBlock.count,
    indexBase,
    triangles,
    dataStart: intBlock.dataStart,
    dataEnd: intBlock.dataEnd,
  };
}

function updateBounds(bounds, p) {
  if (!p) return;
  bounds.min[0] = Math.min(bounds.min[0], p[0]);
  bounds.min[1] = Math.min(bounds.min[1], p[1]);
  bounds.min[2] = Math.min(bounds.min[2], p[2]);
  bounds.max[0] = Math.max(bounds.max[0], p[0]);
  bounds.max[1] = Math.max(bounds.max[1], p[1]);
  bounds.max[2] = Math.max(bounds.max[2], p[2]);
}

function makeEmptyBounds() {
  return {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  };
}

function finalizeBounds(bounds) {
  const ok = bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite);
  if (!ok) return null;
  return {
    min: bounds.min,
    max: bounds.max,
    size: [
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2],
    ],
    center: [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ],
  };
}

export function parseCmoGeometry(input, options = {}) {
  const u8 = toUint8Array(input);
  const objects = [];
  const globalBounds = makeEmptyBounds();
  const maxObjects = Number.isFinite(options.maxObjects) ? options.maxObjects : 200;

  let at = 0;
  while (objects.length < maxObjects) {
    const begin = findExactLineMarker(u8, ">BEGIN_OBJECT", at);
    if (begin < 0) break;

    const end = findExactLineMarker(u8, ">END_OBJECT", begin + 1);
    const objectEnd = end >= 0 ? end : u8.length;
    const name = parseObjectName(u8, begin, objectEnd) || `CMO Objekt ${objects.length + 1}`;

    const pointBlock = parsePointBlock(u8, begin, objectEnd);
    const facetBlock = pointBlock ? parseFacetBlock(u8, pointBlock.dataEnd, objectEnd, pointBlock.points.length) : null;

    if (pointBlock && facetBlock && pointBlock.points.length && facetBlock.triangles.length) {
      const bounds = makeEmptyBounds();
      for (const p of pointBlock.points) {
        updateBounds(bounds, p);
        updateBounds(globalBounds, p);
      }

      objects.push({
        name,
        points: pointBlock.points,
        triangles: facetBlock.triangles,
        bounds: finalizeBounds(bounds),
        declaredPointCount: pointBlock.declaredPointCount,
        declaredFacetCount: facetBlock.declaredFacetCount,
        doubleCount: pointBlock.doubleCount,
        integerCount: facetBlock.integerCount,
        indexBase: facetBlock.indexBase,
      });
    }

    at = objectEnd + 1;
  }

  const pointTotal = objects.reduce((sum, o) => sum + o.points.length, 0);
  const triangleTotal = objects.reduce((sum, o) => sum + o.triangles.length, 0);

  return {
    ok: objects.length > 0 && triangleTotal > 0,
    objects,
    objectCount: objects.length,
    pointTotal,
    triangleTotal,
    bounds: finalizeBounds(globalBounds),
    note: "Experimentelle Mesh-Preview: CMO wurde noch nicht als GLB gespeichert.",
  };
}

/* ============================================================================
 * THREE.js Preview-Aufbau
 * ========================================================================== */

function makeMeshGeometry(THREE, object) {
  const positions = [];
  for (const tri of object.triangles) {
    for (const idx of tri) {
      const p = object.points[idx];
      if (!p) continue;
      positions.push(p[0], p[1], p[2]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildCmoPreviewObject(THREE, input, options = {}) {
  const parsed = parseCmoGeometry(input, options);
  if (!parsed.ok) return { ok: false, parsed, object3d: null };

  const group = new THREE.Group();
  group.name = options.name || "CMO Mesh Preview";
  group.userData.cmoMeshPreview = parsed;

  const material = new THREE.MeshStandardMaterial({
    roughness: 0.72,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });

  const wireMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
    transparent: true,
    opacity: 0.22,
  });

  parsed.objects.forEach((obj, index) => {
    const geometry = makeMeshGeometry(THREE, obj);
    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.name = obj.name || `CMO Mesh ${index + 1}`;
    mesh.userData.cmoObject = {
      pointCount: obj.points.length,
      triangleCount: obj.triangles.length,
      declaredPointCount: obj.declaredPointCount,
      declaredFacetCount: obj.declaredFacetCount,
      indexBase: obj.indexBase,
      bounds: obj.bounds,
    };
    group.add(mesh);

    // Dezentes Wireframe hilft beim Debuggen der Facet-Reihenfolge.
    const wire = new THREE.Mesh(geometry.clone(), wireMaterial.clone());
    wire.name = `${mesh.name} Wireframe`;
    group.add(wire);
  });

  // Kleine Achsenhilfe direkt am Modell: Sie wird nicht gespeichert, nur Preview.
  if (options.addAxes !== false) {
    const axes = new THREE.AxesHelper(100);
    axes.name = "CMO Preview Axes";
    group.add(axes);
  }

  return { ok: true, parsed, object3d: group };
}

export function formatCmoMeshSummary(parsed) {
  if (!parsed || !parsed.ok) return "CMO Mesh-Preview nicht möglich";
  const parts = [
    "CMO Mesh-Preview",
    `${parsed.objectCount} Mesh-Objekt(e)`,
    `${parsed.pointTotal} Punkt(e)`,
    `${parsed.triangleTotal} Dreieck(e)`,
  ];
  if (parsed.bounds?.size) {
    const s = parsed.bounds.size.map((v) => Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
    parts.push(`BBox ${s[0]} × ${s[1]} × ${s[2]}`);
  }
  return parts.join(" · ");
}
