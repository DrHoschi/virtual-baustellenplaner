import { assertValidProject } from "../domain/project-validation.v1.js";

export const PACKAGE_SCHEMA = "baustellenplaner.project-package";
export const PACKAGE_VERSION = 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function bytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function join(chunks) {
  const size = chunks.reduce((total, item) => total + item.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const item of chunks) { output.set(item, offset); offset += item.length; }
  return output;
}
function u16(v) { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, v, true); return a; }
function u32(v) { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, v >>> 0, true); return a; }

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = bytes(entry.data);
    if (name.length > 65535 || data.length > 0xffffffff || offset > 0xffffffff) throw new Error("Projektpaket ist für ZIP-Version 1 zu groß.");
    const crc = crc32(data);
    const local = join([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
    ]);
    const central = join([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralBytes = join(centrals);
  const end = join([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBytes.length), u32(offset), u16(0)]);
  return join([...locals, centralBytes, end]);
}

function findEndRecord(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const lower = Math.max(0, data.length - 65557);
  for (let i = data.length - 22; i >= lower; i -= 1) if (view.getUint32(i, true) === 0x06054b50) return i;
  throw new Error("Projektdatei hat keinen gültigen ZIP-Abschluss.");
}

function unzipStore(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const end = findEndRecord(data);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error("Mehrteilige Projektdateien werden nicht unterstützt.");
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff || centralOffset + centralSize > end) throw new Error("ZIP64-Projektdateien werden nicht unterstützt.");
  const files = new Map();
  let cursor = centralOffset;
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("ZIP-Verzeichnis ist beschädigt.");
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressed = view.getUint32(cursor + 20, true);
    const uncompressed = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const nameStart = cursor + 46;
    const name = decoder.decode(data.subarray(nameStart, nameStart + nameLength));
    if (flags & 1 || !(flags & 0x0800) || method !== 0 || compressed !== uncompressed) throw new Error("Projektdatei verwendet eine nicht unterstützte ZIP-Kodierung.");
    if (name.startsWith("/") || name.split("/").includes("..") || files.has(name)) throw new Error("Projektdatei enthält einen ungültigen oder doppelten Dateipfad.");
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("ZIP-Dateikopf ist beschädigt.");
    const localFlags = view.getUint16(localOffset + 6, true);
    const localMethod = view.getUint16(localOffset + 8, true);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localNameStart = localOffset + 30;
    if (localFlags !== flags || localMethod !== method || decoder.decode(data.subarray(localNameStart, localNameStart + localNameLength)) !== name) throw new Error("ZIP-Dateikopf stimmt nicht mit dem Verzeichnis überein.");
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + uncompressed;
    if (dataEnd > centralOffset) throw new Error("ZIP-Dateiinhalt liegt außerhalb des gültigen Bereichs.");
    const content = data.slice(dataStart, dataEnd);
    if (crc32(content) !== crc) throw new Error(`Prüfsumme für ${name} stimmt nicht.`);
    files.set(name, content);
    cursor = nameStart + nameLength + extraLength + commentLength;
  }
  if (cursor !== centralOffset + centralSize) throw new Error("ZIP-Verzeichnisgröße ist ungültig.");
  return files;
}

function safeFileName(name) { return String(name || "asset.bin").replace(/[\\/\0]/g, "_").slice(0, 120); }

export async function createProjectPackage(project, assets = []) {
  assertValidProject(project);
  const entries = [];
  const assetIndex = [];
  for (const asset of assets) {
    if (!asset?.id || !asset.blob || asset.projectId !== project.id) throw new Error("Projekt enthält ein ungültiges Asset.");
    const path = `assets/${asset.id}.bin`;
    entries.push({ name: path, data: new Uint8Array(await asset.blob.arrayBuffer()) });
    assetIndex.push({ id: asset.id, path, fileName: safeFileName(asset.fileName), mimeType: asset.mimeType, width: asset.width || null, height: asset.height || null });
  }
  const manifest = { schema: PACKAGE_SCHEMA, version: PACKAGE_VERSION, projectId: project.id, files: ["project.json", ...assetIndex.map(a => a.path)] };
  entries.unshift({ name: "project.json", data: encoder.encode(JSON.stringify(project)) });
  entries.unshift({ name: "manifest.json", data: encoder.encode(JSON.stringify({ ...manifest, assets: assetIndex })) });
  return new Blob([zipStore(entries)], { type: "application/vnd.baustellenplaner.project" });
}

export async function readProjectPackage(input) {
  const data = bytes(input instanceof Uint8Array ? input : await input.arrayBuffer());
  const files = unzipStore(data);
  const manifestBytes = files.get("manifest.json");
  const projectBytes = files.get("project.json");
  if (!manifestBytes || !projectBytes) throw new Error("Projektpaket benötigt manifest.json und project.json.");
  let manifest; let project;
  try { manifest = JSON.parse(decoder.decode(manifestBytes)); project = JSON.parse(decoder.decode(projectBytes)); }
  catch { throw new Error("Projektpaket enthält ungültige JSON-Daten."); }
  if (manifest.schema !== PACKAGE_SCHEMA || manifest.version !== PACKAGE_VERSION) throw new Error("Projektpaket-Version wird nicht unterstützt.");
  assertValidProject(project);
  if (manifest.projectId !== project.id || !Array.isArray(manifest.assets) || !Array.isArray(manifest.files)) throw new Error("Projektpaket-Manifest passt nicht zum Projekt.");
  const assetIds = new Set();
  const assetPaths = new Set();
  for (const item of manifest.assets) {
    if (!item || typeof item.id !== "string" || !item.id || item.path !== `assets/${item.id}.bin` || assetIds.has(item.id) || assetPaths.has(item.path)) throw new Error("Asset im Projektpaket ist ungültig oder doppelt.");
    if (!["image/png", "image/jpeg"].includes(item.mimeType)) throw new Error("Assetformat im Projektpaket wird nicht unterstützt.");
    assetIds.add(item.id); assetPaths.add(item.path);
  }
  const allowed = new Set(["manifest.json", "project.json", ...assetPaths]);
  const expectedFiles = new Set(["project.json", ...assetPaths]);
  if ([...files.keys()].some(path => !allowed.has(path)) || manifest.files.length !== expectedFiles.size || new Set(manifest.files).size !== expectedFiles.size || manifest.files.some(path => !expectedFiles.has(path) || !files.has(path))) throw new Error("Projektpaket enthält fehlende oder unerwartete Dateien.");
  const assets = manifest.assets.map(item => {
    const content = files.get(item.path);
    if (!content || item.path !== `assets/${item.id}.bin`) throw new Error("Asset im Projektpaket ist ungültig.");
    return { id: item.id, fileName: safeFileName(item.fileName), mimeType: item.mimeType, width: item.width, height: item.height, blob: new Blob([content], { type: item.mimeType }) };
  });
  if (project.planBackground && !assets.some(a => a.id === project.planBackground.assetId)) throw new Error("Grundrissbild fehlt im Projektpaket.");
  return { project, assets };
}
