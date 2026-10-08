/**
 * modules/geometrylab/importers/cmo-reader.js
 * Version: v0.1.0-cmo-analyse-only (2026-05-14)
 *
 * Baustellenplaner / GeometryLab
 * =============================================================================
 * Zweck:
 * - Sehr defensiver Reader für alte Cybermotion/REPP3D-CMO-Dateien.
 * - Diese erste Version konvertiert CMO noch NICHT zu einem echten Mesh.
 * - Sie erkennt CMO-Dateien, liest ungefährliche Metadaten aus und extrahiert
 *   falls vorhanden die kleine RGB-Thumbnail-Vorschau.
 *
 * Warum analyse-only?
 * - Das CMO-Format ist proprietär/halb-binär. In den Dateien sind zwar Marker
 *   wie >POINTS und >FACETS sichtbar, die eigentlichen Zahlenblöcke liegen aber
 *   binär vor und müssen Schritt für Schritt reverse-engineered werden.
 * - Damit AssetLab/Workarea nicht falsche Modellzustände speichern, meldet diese
 *   Version nur Analyseinformationen. Ein Slot wird dadurch bewusst NICHT als
 *   "hat echtes Modell" markiert.
 *
 * Spätere Ausbaustufen:
 * - v0.2: POINTS/FACETS-Blöcke gezielt dekodieren.
 * - v0.3: THREE.BufferGeometry erzeugen.
 * - v0.4: Export als GLB und danach normales ProjectAsset.
 */

/* ============================================================================
 * Konstanten
 * ========================================================================== */

const CMO_MAGIC = "REPP3D-CM-BIN014";
const THUMB_MARKER = ">THUMBNAIL_RGB";

/* ============================================================================
 * Kleine Byte-/Text-Helfer
 * ========================================================================== */

function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input && input.buffer instanceof ArrayBuffer) {
    return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength || input.length || 0);
  }
  return new Uint8Array(0);
}

function bytesToLatin1(bytes, maxBytes = 1024 * 1024) {
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

function nextValueAfterTag(lines, tag) {
  const idx = lines.findIndex((l) => normalizeLine(l) === tag);
  if (idx < 0) return "";
  for (let i = idx + 1; i < lines.length; i++) {
    const v = normalizeLine(lines[i]);
    if (!v) continue;
    if (v.startsWith(">")) return "";
    return v;
  }
  return "";
}

function countMarker(text, marker) {
  if (!text || !marker) return 0;
  let count = 0;
  let at = 0;
  while (true) {
    const idx = text.indexOf(marker, at);
    if (idx < 0) break;
    count++;
    at = idx + marker.length;
  }
  return count;
}

function uniqueStrings(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

/* ============================================================================
 * Öffentliche API: Erkennung + Analyse
 * ========================================================================== */

export function detectCmo(input) {
  const u8 = toUint8Array(input);
  if (!u8.length) return false;
  const head = bytesToLatin1(u8.subarray(0, 64), 64);
  return head.startsWith(CMO_MAGIC) || head.includes(CMO_MAGIC);
}

export function analyzeCmoBuffer(input, options = {}) {
  const u8 = toUint8Array(input);
  const textLimit = Number.isFinite(options.textLimit) ? options.textLimit : 1024 * 1024;
  const text = bytesToLatin1(u8, textLimit);
  const lines = text.split(/\r?\n/);

  const isCmo = detectCmo(u8);
  const version = nextValueAfterTag(lines, "VERSION");
  const date = nextValueAfterTag(lines, "DATE");

  const objectCount = Math.max(0, countMarker(text, ">BEGIN_OBJECT")
    - countMarker(text, ">BEGIN_OBJECT_CAMERA")
    - countMarker(text, ">BEGIN_OBJECT_LIGHT")
    - countMarker(text, ">BEGIN_OBJECT_BACKGROUND"));

  const cameraCount = countMarker(text, ">BEGIN_OBJECT_CAMERA");
  const lightCount = countMarker(text, ">BEGIN_OBJECT_LIGHT");
  const pointBlocks = countMarker(text, ">POINTS");
  const facetBlocks = countMarker(text, ">FACETS");

  const textureRefs = uniqueStrings(
    Array.from(text.matchAll(/[A-Za-z0-9_ .\-ØÄÖÜäöüß]+\.(?:jpg|jpeg|png|bmp|tga|gif)/gi))
      .map((m) => normalizeLine(m[0]))
  );

  const objectNames = [];
  for (let i = 0; i < lines.length; i++) {
    if (normalizeLine(lines[i]) !== ">BEGIN_OBJECT") continue;
    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
      if (normalizeLine(lines[j]) === ">NAME") {
        const name = normalizeLine(lines[j + 1]);
        if (name && !name.startsWith(">")) objectNames.push(name);
        break;
      }
    }
  }

  const thumb = readCmoThumbnail(input);

  return {
    ok: isCmo,
    format: isCmo ? "REPP3D-CMO" : "unknown",
    magic: isCmo ? CMO_MAGIC : "",
    byteLength: u8.byteLength,
    version,
    date,
    objectCount,
    cameraCount,
    lightCount,
    pointBlocks,
    facetBlocks,
    textureRefs,
    objectNames: uniqueStrings(objectNames),
    thumbnail: thumb ? { width: thumb.width, height: thumb.height, byteLength: thumb.rgb.length } : null,
    note: "Analyse-only: Mesh-Konvertierung ist noch nicht aktiv."
  };
}

/* ============================================================================
 * Thumbnail-Extraktion
 * ========================================================================== */

function findLineEnd(u8, from) {
  for (let i = Math.max(0, from); i < u8.length; i++) {
    if (u8[i] === 10) return i;
  }
  return -1;
}

function skipNewlines(u8, from) {
  let i = from;
  while (i < u8.length && (u8[i] === 10 || u8[i] === 13 || u8[i] === 32 || u8[i] === 9)) i++;
  return i;
}

function parseDimLine(line) {
  const m = String(line || "").match(/(\d+)\s*;\s*(\d+)/);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

export function readCmoThumbnail(input) {
  const u8 = toUint8Array(input);
  if (!u8.length) return null;

  const text = bytesToLatin1(u8, Math.min(u8.length, 256 * 1024));
  const markerIdx = text.indexOf(THUMB_MARKER);
  if (markerIdx < 0) return null;

  // markerIdx ist bei Latin1 1:1 zum Byte-Offset.
  const markerLineEnd = findLineEnd(u8, markerIdx);
  if (markerLineEnd < 0) return null;

  const dimLineStart = skipNewlines(u8, markerLineEnd + 1);
  const dimLineEnd = findLineEnd(u8, dimLineStart);
  if (dimLineEnd < 0) return null;

  const dimLine = bytesToLatin1(u8.subarray(dimLineStart, dimLineEnd), 128);
  const dim = parseDimLine(dimLine);
  if (!dim) return null;

  const dataStart = skipNewlines(u8, dimLineEnd + 1);
  const expected = dim.width * dim.height * 3;
  if (dataStart + expected > u8.length) return null;

  const rgb = u8.slice(dataStart, dataStart + expected);
  return { width: dim.width, height: dim.height, rgb };
}

export function cmoThumbnailToDataUrl(input) {
  const thumb = readCmoThumbnail(input);
  if (!thumb) return null;

  // Browser-only: wird im AssetLab iframe verwendet. In Node/CI gibt es kein document.
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = thumb.width;
  canvas.height = thumb.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const img = ctx.createImageData(thumb.width, thumb.height);
  for (let src = 0, dst = 0; src < thumb.rgb.length && dst < img.data.length; src += 3, dst += 4) {
    img.data[dst + 0] = thumb.rgb[src + 0] || 0;
    img.data[dst + 1] = thumb.rgb[src + 1] || 0;
    img.data[dst + 2] = thumb.rgb[src + 2] || 0;
    img.data[dst + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function formatCmoSummary(report) {
  if (!report || !report.ok) return "CMO nicht erkannt";
  const parts = [
    `CMO erkannt`,
    report.version ? `Version ${report.version}` : "Version ?",
    report.objectCount ? `${report.objectCount} Objekt(e)` : "0 Objekte",
    report.pointBlocks ? `${report.pointBlocks} Punktblock(s)` : "0 Punktblöcke",
    report.facetBlocks ? `${report.facetBlocks} Facetblock(s)` : "0 Facetblöcke",
  ];
  if (report.textureRefs?.length) parts.push(`${report.textureRefs.length} Textur-Ref(s)`);
  return parts.join(" · ");
}
