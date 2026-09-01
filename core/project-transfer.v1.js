import { idbPut, makeModelKey } from "../modules/assetlab3d/shared/idb-util.js";

/*
  ============================================================================
  DATEI: /core/project-transfer.v1.js
  VERSION: v1.0.0-project-transfer-dialog
  STAND: 2026-05-18

  ZWECK:
  - Sauberer Projekt-Transfer für den Baustellenplaner.
  - Export mit Auswahlfenster: Projekt, Project-Assets, Workarea-Szene,
    UI/Settings, kompletter Snapshot.
  - Export als echte ZIP-Datei OHNE externe Bibliothek.
  - Import von ZIP oder JSON mit Vorschau und Auswahl:
      1) Als neues lokales Projekt importieren
      2) Aktuelles Projekt ersetzen
      3) Nur Assets übernehmen
      4) Nur Workarea-Szene übernehmen

  WICHTIG:
  - Diese Datei ist absichtlich als unabhängiges Modul gebaut.
  - Sie benötigt keine Änderungen an ProjectAssetsPanel.js oder WorkareaPanel.js.
  - Sie versucht zuerst den echten App-Store zu lesen.
  - Falls der Store nicht global erreichbar ist, nutzt sie den sichtbaren
    Debug-Snapshot aus #snapshot als Fallback.
  - Beim Import wird zusätzlich in localStorage gespeichert:
      baustellenplaner:activeProject
      baustellenplaner:projectfile:<ID>
    Danach wird die Seite neu geladen, damit der vorhandene Loader sauber
    hydratisieren kann.

  GRENZE v1:
  - Modelldaten aus localStorage-Fallbacks werden mitgenommen.
  - Modelldaten, die ausschließlich in IndexedDB liegen, werden hier noch nicht
    direkt ausgelesen. Dafür folgt später eine IDB-Erweiterung, falls nötig.
  ============================================================================
*/

// ============================================================================
// KONSTANTEN
// ============================================================================

const BP_TRANSFER_VERSION = "v1.0.1-quota-safe-import-foundation";
const TRANSFER_SCHEMA = "baustellenplaner.transfer.v1";
const ACTIVE_PROJECT_KEY = "baustellenplaner:activeProject";
const PROJECTFILE_PREFIX = "baustellenplaner:projectfile:";
const MODELBUF_PREFIX = "baustellenplaner:modelbuf:v1:";

const DEFAULT_INCLUDE = {
  fullSnapshot: true,
  project: true,
  projectAssets: true,
  workspaceScene: true,
  settings: true,
  ui: true,
  meta: true,
  config: true,
  localModelBuffers: true,
};

// ============================================================================
// KLEINE HILFSFUNKTIONEN
// ============================================================================

function nowIso() {
  return new Date().toISOString();
}

function safeClone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_err) {
    return null;
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cssEscapeLite(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function makeId(prefix = "P") {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${new Date().getFullYear()}-${n}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function emitCrashEvent(type, detail = {}) {
  const payload = {
    mode: "module",
    source: "project-transfer",
    version: BP_TRANSFER_VERSION,
    ...detail,
  };

  try {
    window.dispatchEvent(new CustomEvent(type, { detail: payload }));
  } catch (_err) {
    // bewusst still
  }

  try {
    if (typeof window.__bpCrashRecord === "function") {
      window.__bpCrashRecord(type, payload);
    }
  } catch (_err) {
    // bewusst still
  }
}

function stringifyPretty(value) {
  return JSON.stringify(value, null, 2);
}

function parseJsonMaybe(text) {
  if (!text || !String(text).trim()) return null;
  try {
    return JSON.parse(String(text));
  } catch (_err) {
    return null;
  }
}

function getNested(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[key];
  }
  return cur;
}

function setNested(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (!isPlainObject(cur[key])) cur[key] = {};
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
}

// ============================================================================
// STORE / SNAPSHOT LESEN
// ============================================================================

function getStoreCandidate() {
  const candidates = [
    window.store,
    window.appStore,
    window.__store,
    window.__bpStore,
    window.app?.store,
    window.bp?.store,
    window.__bp?.store,
  ];

  return candidates.find((candidate) => candidate && typeof candidate === "object") || null;
}

function readSnapshotFromStore() {
  const store = getStoreCandidate();
  if (!store) return null;

  const methods = ["snapshot", "getSnapshot", "getState", "state"];
  for (const method of methods) {
    try {
      if (typeof store[method] === "function") {
        const value = store[method]();
        if (value && typeof value === "object") return safeClone(value);
      }
      if (store[method] && typeof store[method] === "object") {
        return safeClone(store[method]);
      }
    } catch (_err) {
      // nächster Versuch
    }
  }

  return null;
}

function readSnapshotFromDom() {
  const pre = document.getElementById("snapshot");
  const parsed = parseJsonMaybe(pre?.textContent || "");
  return parsed && typeof parsed === "object" ? parsed : null;
}

function readCurrentSnapshot() {
  return readSnapshotFromStore() || readSnapshotFromDom() || {};
}

// ============================================================================
// SNAPSHOT NORMALISIEREN
// ============================================================================

function getCanonicalProject(snapshot) {
  return (
    getNested(snapshot, ["app", "project"]) ||
    snapshot.project ||
    getNested(snapshot, ["settings", "project"]) ||
    null
  );
}

function getCanonicalSettings(snapshot) {
  return getNested(snapshot, ["app", "settings"]) || snapshot.settings || {};
}

function getCanonicalUi(snapshot) {
  return getNested(snapshot, ["app", "ui"]) || snapshot.ui || {};
}

function getCanonicalMeta(snapshot) {
  return snapshot.meta || getNested(snapshot, ["app", "meta"]) || {};
}

function getCanonicalConfig(snapshot) {
  return snapshot.config || getNested(snapshot, ["app", "config"]) || {};
}

function getProjectAssetsFromProject(project) {
  if (!project || typeof project !== "object") return [];
  return Array.isArray(project.projectAssets) ? project.projectAssets : [];
}

function getWorkspaceSceneFromProject(project) {
  return getNested(project, ["workspace", "scene"]) || { objects: [] };
}

function buildCompositeSnapshot(parts) {
  const project = safeClone(parts.project || {}) || {};
  const settings = safeClone(parts.settings || {}) || {};
  const ui = safeClone(parts.ui || {}) || {};
  const meta = safeClone(parts.meta || {}) || {};
  const config = safeClone(parts.config || {}) || {};

  // STORAGE-01C: Das Projekt liegt im Projectfile nur noch EINMAL kanonisch
  // unter `project`. `app` enthält nur die kleinen Begleitdaten, die der
  // bestehende Loader für local:-Projekte bereits lesen kann.
  return {
    project,
    settings,
    ui,
    meta,
    config,
    app: {
      settings: safeClone(settings),
      ui: safeClone(ui),
      meta: safeClone(meta),
      config: safeClone(config),
    },
  };
}

function readLocalModelBuffers(projectAssets) {
  const wanted = new Set();
  for (const asset of projectAssets || []) {
    for (const slot of asset?.slots || []) {
      if (asset?.id && slot?.id) wanted.add(`${asset.id}:${slot.id}`);
    }
  }

  const result = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(MODELBUF_PREFIX)) continue;
      const suffix = key.slice(MODELBUF_PREFIX.length);
      if (!wanted.has(suffix)) continue;
      result.push({ key, value: localStorage.getItem(key) || "" });
    }
  } catch (_err) {
    // localStorage kann in privaten Modi eingeschränkt sein
  }
  return result;
}

function base64ToArrayBuffer(base64) {
  const binary = atob(String(base64 || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function restoreModelBuffersToIndexedDb(buffers, projectAssets) {
  const keyMap = new Map();
  for (const asset of projectAssets || []) {
    for (const slot of asset?.slots || []) {
      if (!asset?.id || !slot?.id) continue;
      keyMap.set(`${asset.id}:${slot.id}`, makeModelKey(asset.id, slot.id));
    }
  }

  let restored = 0;
  const failed = [];

  for (const entry of buffers || []) {
    if (!entry?.key || typeof entry.value !== "string") continue;
    if (!entry.key.startsWith(MODELBUF_PREFIX)) continue;

    const suffix = entry.key.slice(MODELBUF_PREFIX.length);
    const idbKey = keyMap.get(suffix);
    if (!idbKey) {
      failed.push({ key: entry.key, reason: "slot-not-found" });
      continue;
    }

    try {
      const payload = JSON.parse(entry.value);
      if (!payload?.b64) throw new Error("missing-b64");
      const buffer = base64ToArrayBuffer(payload.b64);
      await idbPut(idbKey, {
        fileName: payload.fileName || "",
        updatedAt: payload.updatedAt || nowIso(),
        buffer,
      });
      restored += 1;
    } catch (err) {
      failed.push({ key: entry.key, reason: err?.message || String(err) });
    }
  }

  if (failed.length) {
    const err = new Error(`IndexedDB-Modellimport unvollständig: ${restored} erfolgreich, ${failed.length} fehlgeschlagen.`);
    err.detail = { restored, failed };
    throw err;
  }

  return restored;
}

// ============================================================================
// TRANSFER-PAKET BAUEN / LESEN
// ============================================================================

function buildTransferPackage(include) {
  const snapshot = readCurrentSnapshot();
  const project = safeClone(getCanonicalProject(snapshot) || {}) || {};
  const settings = safeClone(getCanonicalSettings(snapshot) || {}) || {};
  const ui = safeClone(getCanonicalUi(snapshot) || {}) || {};
  const meta = safeClone(getCanonicalMeta(snapshot) || {}) || {};
  const config = safeClone(getCanonicalConfig(snapshot) || {}) || {};
  const projectAssets = safeClone(getProjectAssetsFromProject(project)) || [];
  const workspaceScene = safeClone(getWorkspaceSceneFromProject(project)) || { objects: [] };

  const transfer = {
    schema: TRANSFER_SCHEMA,
    version: BP_TRANSFER_VERSION,
    createdAt: nowIso(),
    source: {
      href: location.href,
      userAgent: navigator.userAgent,
    },
    include: safeClone(include),
    summary: {
      projectId: project.id || null,
      projectName: project.name || "Unbenanntes Projekt",
      projectAssetCount: projectAssets.length,
      slotCount: projectAssets.reduce((sum, asset) => sum + (asset?.slots?.length || 0), 0),
      workspaceObjectCount: Array.isArray(workspaceScene.objects) ? workspaceScene.objects.length : 0,
    },
    data: {},
  };

  if (include.fullSnapshot) transfer.data.snapshot = safeClone(snapshot);
  if (include.project) transfer.data.project = project;
  if (include.projectAssets) transfer.data.projectAssets = projectAssets;
  if (include.workspaceScene) transfer.data.workspaceScene = workspaceScene;
  if (include.settings) transfer.data.settings = settings;
  if (include.ui) transfer.data.ui = ui;
  if (include.meta) transfer.data.meta = meta;
  if (include.config) transfer.data.config = config;
  if (include.localModelBuffers) transfer.data.localModelBuffers = readLocalModelBuffers(projectAssets);

  return transfer;
}

function normalizeTransferInput(input) {
  if (!input || typeof input !== "object") return null;

  if (input.schema === TRANSFER_SCHEMA && input.data) return input;

  // Roh-Snapshot aus altem Debug-Export akzeptieren.
  const project = safeClone(getCanonicalProject(input) || input.project || {}) || {};
  const settings = safeClone(getCanonicalSettings(input) || {}) || {};
  const ui = safeClone(getCanonicalUi(input) || {}) || {};
  const meta = safeClone(getCanonicalMeta(input) || {}) || {};
  const config = safeClone(getCanonicalConfig(input) || {}) || {};
  const projectAssets = safeClone(getProjectAssetsFromProject(project)) || [];
  const workspaceScene = safeClone(getWorkspaceSceneFromProject(project)) || { objects: [] };

  return {
    schema: TRANSFER_SCHEMA,
    version: "from-raw-snapshot",
    createdAt: nowIso(),
    source: { href: "raw-json-import" },
    include: safeClone(DEFAULT_INCLUDE),
    summary: {
      projectId: project.id || null,
      projectName: project.name || "Unbenanntes Projekt",
      projectAssetCount: projectAssets.length,
      slotCount: projectAssets.reduce((sum, asset) => sum + (asset?.slots?.length || 0), 0),
      workspaceObjectCount: Array.isArray(workspaceScene.objects) ? workspaceScene.objects.length : 0,
    },
    data: {
      snapshot: safeClone(input),
      project,
      projectAssets,
      workspaceScene,
      settings,
      ui,
      meta,
      config,
      localModelBuffers: [],
    },
  };
}

// ============================================================================
// ECHTER ZIP-SCHREIBER: STORE-METHODE, KEINE KOMPRESSION
// ============================================================================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeU16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeU32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function concatUint8(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function createZipStored(entries) {
  const encoder = new TextEncoder();
  const fileChunks = [];
  const centralChunks = [];
  const centralRecords = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = typeof entry.content === "string" ? encoder.encode(entry.content) : entry.content;
    const crc = crc32(dataBytes);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0x0800); // UTF-8
    writeU16(localView, 8, 0); // store
    writeU16(localView, 10, dosTime);
    writeU16(localView, 12, dosDate);
    writeU32(localView, 14, crc);
    writeU32(localView, 18, dataBytes.length);
    writeU32(localView, 22, dataBytes.length);
    writeU16(localView, 26, nameBytes.length);
    writeU16(localView, 28, 0);
    local.set(nameBytes, 30);

    fileChunks.push(local, dataBytes);
    centralRecords.push({ nameBytes, dataBytes, crc, offset, dosTime, dosDate });
    offset += local.length + dataBytes.length;
  }

  const centralStart = offset;
  for (const record of centralRecords) {
    const central = new Uint8Array(46 + record.nameBytes.length);
    const view = new DataView(central.buffer);
    writeU32(view, 0, 0x02014b50);
    writeU16(view, 4, 20);
    writeU16(view, 6, 20);
    writeU16(view, 8, 0x0800);
    writeU16(view, 10, 0);
    writeU16(view, 12, record.dosTime);
    writeU16(view, 14, record.dosDate);
    writeU32(view, 16, record.crc);
    writeU32(view, 20, record.dataBytes.length);
    writeU32(view, 24, record.dataBytes.length);
    writeU16(view, 28, record.nameBytes.length);
    writeU16(view, 30, 0);
    writeU16(view, 32, 0);
    writeU16(view, 34, 0);
    writeU16(view, 36, 0);
    writeU32(view, 38, 0);
    writeU32(view, 42, record.offset);
    central.set(record.nameBytes, 46);
    centralChunks.push(central);
    offset += central.length;
  }

  const centralSize = offset - centralStart;
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  writeU32(eocdView, 0, 0x06054b50);
  writeU16(eocdView, 4, 0);
  writeU16(eocdView, 6, 0);
  writeU16(eocdView, 8, centralRecords.length);
  writeU16(eocdView, 10, centralRecords.length);
  writeU32(eocdView, 12, centralSize);
  writeU32(eocdView, 16, centralStart);
  writeU16(eocdView, 20, 0);

  return new Blob([concatUint8([...fileChunks, ...centralChunks, eocd])], { type: "application/zip" });
}

function transferToZipBlob(transfer) {
  const entries = [
    { name: "manifest.json", content: stringifyPretty({ ...transfer, data: undefined }) },
  ];

  if (transfer.data?.snapshot) entries.push({ name: "snapshot.json", content: stringifyPretty(transfer.data.snapshot) });
  if (transfer.data?.project) entries.push({ name: "project.json", content: stringifyPretty(transfer.data.project) });
  if (transfer.data?.projectAssets) entries.push({ name: "project-assets.json", content: stringifyPretty(transfer.data.projectAssets) });
  if (transfer.data?.workspaceScene) entries.push({ name: "workspace-scene.json", content: stringifyPretty(transfer.data.workspaceScene) });
  if (transfer.data?.settings) entries.push({ name: "settings.json", content: stringifyPretty(transfer.data.settings) });
  if (transfer.data?.ui) entries.push({ name: "ui.json", content: stringifyPretty(transfer.data.ui) });
  if (transfer.data?.meta) entries.push({ name: "meta.json", content: stringifyPretty(transfer.data.meta) });
  if (transfer.data?.config) entries.push({ name: "config.json", content: stringifyPretty(transfer.data.config) });
  if (transfer.data?.localModelBuffers) entries.push({ name: "local-model-buffers.json", content: stringifyPretty(transfer.data.localModelBuffers) });

  // Komplettes Paket zusätzlich als eine Datei: komfortabel für Debug und JSON-Fallback.
  entries.push({ name: "transfer.json", content: stringifyPretty(transfer) });

  return createZipStored(entries);
}

// ============================================================================
// ZIP LESEN: STORE-METHODE
// ============================================================================

function findEndOfCentralDirectory(bytes) {
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      return i;
    }
  }
  return -1;
}

function readZipStored(bytes) {
  const decoder = new TextDecoder("utf-8");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) throw new Error("ZIP-Ende nicht gefunden. Datei ist keine gültige ZIP-Datei.");

  const centralCount = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const files = new Map();
  let ptr = centralOffset;

  for (let i = 0; i < centralCount; i += 1) {
    const sig = view.getUint32(ptr, true);
    if (sig !== 0x02014b50) throw new Error("ZIP-Zentralverzeichnis ist beschädigt.");

    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const fileNameLength = view.getUint16(ptr + 28, true);
    const extraLength = view.getUint16(ptr + 30, true);
    const commentLength = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.slice(ptr + 46, ptr + 46 + fileNameLength));

    if (method !== 0) {
      throw new Error(`ZIP-Datei „${name}“ ist komprimiert. Dieser interne Import unterstützt aktuell nur Store-ZIP ohne Deflate.`);
    }

    const localSig = view.getUint32(localOffset, true);
    if (localSig !== 0x04034b50) throw new Error(`ZIP-Datei „${name}“ hat einen ungültigen lokalen Header.`);

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    files.set(name, decoder.decode(data));

    ptr += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

async function readTransferFile(file) {
  const name = file?.name || "";
  const lower = name.toLowerCase();

  if (lower.endsWith(".zip")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const files = readZipStored(bytes);
    const transferText = files.get("transfer.json");
    if (transferText) return normalizeTransferInput(JSON.parse(transferText));

    // Fallback: aus Einzeldateien zusammensetzen.
    const manifest = parseJsonMaybe(files.get("manifest.json") || "{}") || {};
    const data = {
      snapshot: parseJsonMaybe(files.get("snapshot.json") || ""),
      project: parseJsonMaybe(files.get("project.json") || ""),
      projectAssets: parseJsonMaybe(files.get("project-assets.json") || ""),
      workspaceScene: parseJsonMaybe(files.get("workspace-scene.json") || ""),
      settings: parseJsonMaybe(files.get("settings.json") || ""),
      ui: parseJsonMaybe(files.get("ui.json") || ""),
      meta: parseJsonMaybe(files.get("meta.json") || ""),
      config: parseJsonMaybe(files.get("config.json") || ""),
      localModelBuffers: parseJsonMaybe(files.get("local-model-buffers.json") || "[]") || [],
    };
    return normalizeTransferInput({ ...manifest, schema: TRANSFER_SCHEMA, data });
  }

  const text = await file.text();
  return normalizeTransferInput(JSON.parse(text));
}

// ============================================================================
// IMPORT ANWENDEN
// ============================================================================

function getIncomingParts(transfer) {
  const data = transfer?.data || {};
  const snap = data.snapshot || {};
  const project = safeClone(data.project || getCanonicalProject(snap) || {}) || {};

  if (Array.isArray(data.projectAssets)) {
    project.projectAssets = safeClone(data.projectAssets);
  }

  if (data.workspaceScene) {
    setNested(project, ["workspace", "scene"], safeClone(data.workspaceScene));
  }

  return {
    project,
    settings: safeClone(data.settings || getCanonicalSettings(snap) || {}) || {},
    ui: safeClone(data.ui || getCanonicalUi(snap) || {}) || {},
    meta: safeClone(data.meta || getCanonicalMeta(snap) || {}) || {},
    config: safeClone(data.config || getCanonicalConfig(snap) || {}) || {},
    localModelBuffers: Array.isArray(data.localModelBuffers) ? data.localModelBuffers : [],
  };
}

function mergeAssetsIntoProject(currentProject, incomingAssets) {
  const next = safeClone(currentProject || {}) || {};
  const existing = Array.isArray(next.projectAssets) ? next.projectAssets : [];
  const map = new Map(existing.map((asset) => [asset.id, asset]));

  for (const asset of incomingAssets || []) {
    if (!asset?.id) continue;
    map.set(asset.id, safeClone(asset));
  }

  next.projectAssets = Array.from(map.values());
  return next;
}

async function applyTransfer(transfer, mode) {
  const currentSnapshot = readCurrentSnapshot();
  const currentProject = safeClone(getCanonicalProject(currentSnapshot) || {}) || {};
  const currentSettings = safeClone(getCanonicalSettings(currentSnapshot) || {}) || {};
  const currentUi = safeClone(getCanonicalUi(currentSnapshot) || {}) || {};
  const currentMeta = safeClone(getCanonicalMeta(currentSnapshot) || {}) || {};
  const currentConfig = safeClone(getCanonicalConfig(currentSnapshot) || {}) || {};
  const incoming = getIncomingParts(transfer);

  let project = safeClone(currentProject);
  let settings = safeClone(currentSettings);
  let ui = safeClone(currentUi);
  let meta = safeClone(currentMeta);
  let config = safeClone(currentConfig);

  if (mode === "new" || mode === "replace") {
    project = safeClone(incoming.project || {}) || {};
    settings = safeClone(incoming.settings || {}) || {};
    ui = safeClone(incoming.ui || {}) || {};
    meta = safeClone(incoming.meta || {}) || {};
    config = safeClone(incoming.config || {}) || {};
  }

  if (mode === "new") {
    project.id = makeId("P");
    project.name = `${project.name || "Importiertes Projekt"} (Import)`;
    project.createdAt = nowIso();
  }

  if (mode === "assets") {
    project = mergeAssetsIntoProject(project, incoming.project?.projectAssets || []);
  }

  if (mode === "scene") {
    const scene = getWorkspaceSceneFromProject(incoming.project);
    setNested(project, ["workspace", "scene"], safeClone(scene));
  }

  // STORAGE-01C: Große Modellbuffer nie mehr in localStorage zurückschreiben.
  // Sie werden in denselben IndexedDB-Store übernommen, den AssetLab zum
  // Restore bereits bevorzugt liest.
  const restoredBuffers = await restoreModelBuffersToIndexedDb(
    incoming.localModelBuffers,
    incoming.project?.projectAssets || []
  );
  const composite = buildCompositeSnapshot({ project, settings, ui, meta, config });
  const id = project.id || makeId("P");
  composite.project.id = id;

  try {
    localStorage.setItem(`${PROJECTFILE_PREFIX}${id}`, JSON.stringify(composite));
    localStorage.setItem(ACTIVE_PROJECT_KEY, `local:${id}`);
  } catch (err) {
    throw new Error(`Import konnte nicht in localStorage gespeichert werden: ${err?.message || err}`);
  }

  emitCrashEvent("project-transfer:import:applied", {
    projectId: id,
    mode,
    restoredBuffers,
    assetCount: getProjectAssetsFromProject(project).length,
    sceneObjects: getWorkspaceSceneFromProject(project)?.objects?.length || 0,
  });

  return { projectId: id, restoredBuffers };
}

// ============================================================================
// UI / MODAL
// ============================================================================

function injectStyles() {
  if (document.getElementById("bpProjectTransferStyles")) return;
  const style = document.createElement("style");
  style.id = "bpProjectTransferStyles";
  style.textContent = `
    .bp-transfer-inline-btn {
      margin-left: 8px;
      white-space: nowrap;
    }

    .bp-transfer-fab {
      position: fixed;
      right: 12px;
      bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      z-index: 99999;
      border: 1px solid rgba(255,255,255,.24);
      border-radius: 999px;
      padding: 10px 14px;
      background: rgba(20, 26, 36, .94);
      color: #fff;
      font: 600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 10px 30px rgba(0,0,0,.28);
    }

    .bp-transfer-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: rgba(0,0,0,.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .bp-transfer-modal {
      width: min(760px, 100%);
      max-height: min(90vh, 760px);
      overflow: auto;
      border-radius: 18px;
      background: #131923;
      color: #eef3ff;
      border: 1px solid rgba(255,255,255,.14);
      box-shadow: 0 24px 80px rgba(0,0,0,.45);
      font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .bp-transfer-modal header,
    .bp-transfer-modal footer {
      position: sticky;
      background: #131923;
      z-index: 1;
      padding: 14px 16px;
      border-color: rgba(255,255,255,.1);
    }

    .bp-transfer-modal header { top: 0; border-bottom: 1px solid rgba(255,255,255,.1); }
    .bp-transfer-modal footer { bottom: 0; border-top: 1px solid rgba(255,255,255,.1); display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

    .bp-transfer-modal h2 { margin: 0; font-size: 17px; }
    .bp-transfer-modal main { padding: 16px; display: grid; gap: 14px; }
    .bp-transfer-box { border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 12px; background: rgba(255,255,255,.045); }
    .bp-transfer-box h3 { margin: 0 0 8px; font-size: 14px; color: #fff; }
    .bp-transfer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; }
    .bp-transfer-check, .bp-transfer-radio { display: flex; align-items: flex-start; gap: 8px; padding: 8px; border-radius: 10px; background: rgba(255,255,255,.04); }
    .bp-transfer-muted { color: rgba(238,243,255,.72); font-size: 12px; }
    .bp-transfer-summary { white-space: pre-wrap; background: rgba(0,0,0,.22); padding: 10px; border-radius: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .bp-transfer-file { width: 100%; box-sizing: border-box; }
    .bp-transfer-btn {
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 10px;
      padding: 8px 10px;
      background: rgba(255,255,255,.08);
      color: #fff;
      font-weight: 600;
    }
    .bp-transfer-btn-primary { background: #2563eb; border-color: #3b82f6; }
    .bp-transfer-btn-danger { background: #8b1d1d; border-color: #c33; }

    @media (max-width: 720px) {
      .bp-transfer-modal-backdrop { align-items: stretch; padding: 8px; }
      .bp-transfer-modal { max-height: calc(100vh - 16px); border-radius: 14px; }
      .bp-transfer-fab { right: 10px; bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }
    }
  `;
  document.head.appendChild(style);
}

function createCheck(id, label, checked = true, note = "") {
  return `
    <label class="bp-transfer-check">
      <input id="${id}" type="checkbox" ${checked ? "checked" : ""}>
      <span><strong>${label}</strong>${note ? `<br><span class="bp-transfer-muted">${note}</span>` : ""}</span>
    </label>
  `;
}

function openTransferDialog() {
  injectStyles();

  const old = document.getElementById("bpProjectTransferDialog");
  if (old) old.remove();

  const snapshot = readCurrentSnapshot();
  const project = getCanonicalProject(snapshot) || {};
  const projectAssets = getProjectAssetsFromProject(project);
  const scene = getWorkspaceSceneFromProject(project);
  const summary = [
    `Projekt: ${project.name || "Unbenannt"}`,
    `ID: ${project.id || "—"}`,
    `Assets: ${projectAssets.length}`,
    `Slots: ${projectAssets.reduce((sum, asset) => sum + (asset?.slots?.length || 0), 0)}`,
    `Workarea-Objekte: ${Array.isArray(scene.objects) ? scene.objects.length : 0}`,
  ].join("\n");

  const backdrop = document.createElement("div");
  backdrop.id = "bpProjectTransferDialog";
  backdrop.className = "bp-transfer-modal-backdrop";
  backdrop.innerHTML = `
    <section class="bp-transfer-modal" role="dialog" aria-modal="true" aria-label="Projekt Transfer">
      <header>
        <h2>Projekt Transfer</h2>
        <div class="bp-transfer-muted">Export / Import für Projekt, Assets und Workarea-Szene</div>
      </header>

      <main>
        <div class="bp-transfer-box">
          <h3>Aktueller Stand</h3>
          <div class="bp-transfer-summary">${summary}</div>
        </div>

        <div class="bp-transfer-box">
          <h3>Export-Auswahl</h3>
          <div class="bp-transfer-grid">
            ${createCheck("bpTrFull", "Kompletter Snapshot", true, "sicherster Export")}
            ${createCheck("bpTrProject", "Projekt-Stammdaten", true)}
            ${createCheck("bpTrAssets", "Project-Assets", true, "Slots, Namen, Thumbnails, Model-Metadaten")}
            ${createCheck("bpTrScene", "Workarea-Szene", true, "platzierte Objekte, Positionen, Rotation, Skalierung")}
            ${createCheck("bpTrSettings", "Settings", true, "Workspace, Grid, Docks usw.")}
            ${createCheck("bpTrUi", "UI-Zustand", true)}
            ${createCheck("bpTrBuffers", "Lokale Modellpuffer", true, "localStorage-Fallbacks, falls vorhanden")}
          </div>
        </div>

        <div class="bp-transfer-box">
          <h3>Import</h3>
          <input id="bpTransferFile" class="bp-transfer-file" type="file" accept=".zip,.json,application/zip,application/json">
          <div id="bpTransferImportSummary" class="bp-transfer-summary" style="margin-top:10px;">Noch keine Import-Datei ausgewählt.</div>
          <div class="bp-transfer-grid" style="margin-top:10px;">
            <label class="bp-transfer-radio"><input name="bpTransferMode" type="radio" value="new" checked><span><strong>Als neues Projekt importieren</strong><br><span class="bp-transfer-muted">sicherste Variante</span></span></label>
            <label class="bp-transfer-radio"><input name="bpTransferMode" type="radio" value="replace"><span><strong>Aktuelles Projekt ersetzen</strong><br><span class="bp-transfer-muted">gleiche Arbeitsfläche wird überschrieben</span></span></label>
            <label class="bp-transfer-radio"><input name="bpTransferMode" type="radio" value="assets"><span><strong>Nur Assets übernehmen</strong><br><span class="bp-transfer-muted">bestehende Workarea bleibt</span></span></label>
            <label class="bp-transfer-radio"><input name="bpTransferMode" type="radio" value="scene"><span><strong>Nur Workarea-Szene übernehmen</strong><br><span class="bp-transfer-muted">Assets sollten dazu vorhanden sein</span></span></label>
          </div>
        </div>
      </main>

      <footer>
        <button id="bpTransferClose" class="bp-transfer-btn" type="button">Schließen</button>
        <button id="bpTransferExportJson" class="bp-transfer-btn" type="button">Export JSON</button>
        <button id="bpTransferExportZip" class="bp-transfer-btn bp-transfer-btn-primary" type="button">Export ZIP</button>
        <button id="bpTransferImport" class="bp-transfer-btn bp-transfer-btn-danger" type="button">Import anwenden</button>
      </footer>
    </section>
  `;

  document.body.appendChild(backdrop);

  let selectedTransfer = null;

  function readIncludeFromUi() {
    return {
      fullSnapshot: document.getElementById("bpTrFull")?.checked !== false,
      project: document.getElementById("bpTrProject")?.checked !== false,
      projectAssets: document.getElementById("bpTrAssets")?.checked !== false,
      workspaceScene: document.getElementById("bpTrScene")?.checked !== false,
      settings: document.getElementById("bpTrSettings")?.checked !== false,
      ui: document.getElementById("bpTrUi")?.checked !== false,
      meta: true,
      config: true,
      localModelBuffers: document.getElementById("bpTrBuffers")?.checked !== false,
    };
  }

  function selectedMode() {
    return document.querySelector('input[name="bpTransferMode"]:checked')?.value || "new";
  }

  function showImportSummary(transfer) {
    const data = transfer?.data || {};
    const p = data.project || getCanonicalProject(data.snapshot || {}) || {};
    const assets = data.projectAssets || p.projectAssets || [];
    const scene = data.workspaceScene || getWorkspaceSceneFromProject(p);
    const buffers = data.localModelBuffers || [];
    document.getElementById("bpTransferImportSummary").textContent = [
      "Import-Datei erkannt:",
      `Projekt: ${p.name || transfer?.summary?.projectName || "Unbenannt"}`,
      `ID: ${p.id || transfer?.summary?.projectId || "—"}`,
      `Assets: ${Array.isArray(assets) ? assets.length : 0}`,
      `Slots: ${Array.isArray(assets) ? assets.reduce((sum, asset) => sum + (asset?.slots?.length || 0), 0) : 0}`,
      `Workarea-Objekte: ${Array.isArray(scene?.objects) ? scene.objects.length : 0}`,
      `Lokale Modellpuffer: ${Array.isArray(buffers) ? buffers.length : 0}`,
    ].join("\n");
  }

  document.getElementById("bpTransferClose")?.addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) backdrop.remove();
  });

  document.getElementById("bpTransferExportJson")?.addEventListener("click", () => {
    const transfer = buildTransferPackage(readIncludeFromUi());
    const safeName = cssEscapeLite(transfer.summary.projectName || "projekt");
    const blob = new Blob([stringifyPretty(transfer)], { type: "application/json" });
    downloadBlob(blob, `${safeName}_transfer_${Date.now()}.json`);
    emitCrashEvent("project-transfer:export:json", transfer.summary);
  });

  document.getElementById("bpTransferExportZip")?.addEventListener("click", () => {
    const transfer = buildTransferPackage(readIncludeFromUi());
    const safeName = cssEscapeLite(transfer.summary.projectName || "projekt");
    const blob = transferToZipBlob(transfer);
    downloadBlob(blob, `${safeName}_transfer_${Date.now()}.zip`);
    emitCrashEvent("project-transfer:export:zip", transfer.summary);
  });

  document.getElementById("bpTransferFile")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      selectedTransfer = await readTransferFile(file);
      if (!selectedTransfer) throw new Error("Transfer-Datei konnte nicht gelesen werden.");
      showImportSummary(selectedTransfer);
      emitCrashEvent("project-transfer:import:file-ready", selectedTransfer.summary || {});
    } catch (err) {
      selectedTransfer = null;
      document.getElementById("bpTransferImportSummary").textContent = `Import-Fehler:\n${err?.message || err}`;
      emitCrashEvent("project-transfer:import:file-error", { message: err?.message || String(err) });
    }
  });

  document.getElementById("bpTransferImport")?.addEventListener("click", async () => {
    if (!selectedTransfer) {
      alert("Bitte zuerst eine Import-Datei auswählen.");
      return;
    }

    const mode = selectedMode();
    const modeLabel = {
      new: "als neues Projekt importieren",
      replace: "aktuelles Projekt ersetzen",
      assets: "nur Assets übernehmen",
      scene: "nur Workarea-Szene übernehmen",
    }[mode] || mode;

    const ok = confirm(`Import wirklich anwenden?\n\nModus: ${modeLabel}\n\nDanach wird die Seite neu geladen.`);
    if (!ok) return;

    try {
      const result = await applyTransfer(selectedTransfer, mode);
      alert(`Import gespeichert.\nProjekt: ${result.projectId}\nModellpuffer in IndexedDB wiederhergestellt: ${result.restoredBuffers}\n\nDie Seite wird jetzt neu geladen.`);
      window.location.reload();
    } catch (err) {
      alert(`Import fehlgeschlagen:\n${err?.message || err}`);
      emitCrashEvent("project-transfer:import:apply-error", { message: err?.message || String(err) });
    }
  });
}

function installButton() {
  injectStyles();

  const debugTools = document.getElementById("debugTools");
  if (debugTools && !document.getElementById("btnProjectTransfer")) {
    const btn = document.createElement("button");
    btn.id = "btnProjectTransfer";
    btn.className = "bp-btn bp-btn-secondary bp-transfer-inline-btn";
    btn.type = "button";
    btn.textContent = "Projekt Transfer";
    btn.addEventListener("click", openTransferDialog);
    debugTools.appendChild(btn);
  }

  if (!document.getElementById("bpProjectTransferFab")) {
    const fab = document.createElement("button");
    fab.id = "bpProjectTransferFab";
    fab.className = "bp-transfer-fab";
    fab.type = "button";
    fab.textContent = "Transfer";
    fab.title = "Projekt Export / Import";
    fab.addEventListener("click", openTransferDialog);
    document.body.appendChild(fab);
  }
}

// ============================================================================
// HAUPTLOGIK
// ============================================================================

function bootProjectTransfer() {
  installButton();
  emitCrashEvent("project-transfer:ready", { strategy: "standalone-dialog" });

  // Falls debugTools später durch die App neu gerendert wird, Button wieder ergänzen.
  window.setInterval(() => {
    try {
      installButton();
    } catch (_err) {
      // bewusst still
    }
  }, 2000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootProjectTransfer, { once: true });
} else {
  bootProjectTransfer();
}

// ============================================================================
// EXPORTS FÜR DEBUG / TESTS
// ============================================================================

export {
  buildTransferPackage,
  transferToZipBlob,
  readTransferFile,
  applyTransfer,
};
