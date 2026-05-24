/**
 * Baustellenplaner – Projekt Transfer Import/Export
 * Datei: modules/transfer/project-transfer.js
 * Version: v1.0.0-selective-json-zip-transfer (2026-05-18)
 *
 * Zweck:
 * - Projekt als übertragbare JSON-Datei oder ZIP-Datei exportieren.
 * - Vor dem Export erscheint ein Auswahlfenster, damit z. B. nur ein
 *   Grundstock/Template ohne platzierte Workarea-Objekte exportiert werden kann.
 * - JSON- und ZIP-Import werden als lokales Projekt in localStorage abgelegt.
 *
 * WICHTIGER STAND v1:
 * - Projekt-/Settings-/UI-/Workarea-/ProjectAssets-/Thumbnail-Daten werden aus dem Store exportiert.
 * - Bekannte lokale Modellbuffer aus localStorage (baustellenplaner:modelbuf:v1:...) werden optional mitgenommen.
 * - IndexedDB-GLB-Buffers werden in v1 noch NICHT vollständig ausgelesen. Dafür ist später v2 vorgesehen.
 */

/* ============================================================================
 * KONSTANTEN
 * ========================================================================== */

const VERSION = "v1.0.0-selective-json-zip-transfer";
const TRANSFER_SCHEMA = "baustellenplaner.transfer.v1";
const ZIP_MIME = "application/zip";
const JSON_MIME = "application/json;charset=utf-8";
const LS_ACTIVE_PROJECT_KEY = "baustellenplaner:activeProject";
const LS_PROJECTFILE_PREFIX = "baustellenplaner:projectfile:";
const LS_PROJECT_PERSIST_PREFIX = "baustellenplaner:project:";
const LS_MODELBUF_PREFIX = "baustellenplaner:modelbuf:v1:";

/* ============================================================================
 * KLEINE HILFSFUNKTIONEN
 * ========================================================================== */

function byId(id) {
  return document.getElementById(id);
}

function nowIso() {
  return new Date().toISOString();
}

function safeClone(value) {
  try { return value == null ? value : JSON.parse(JSON.stringify(value)); } catch { return null; }
}

function isObj(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function safeStringify(value, pretty = true) {
  try { return JSON.stringify(value, null, pretty ? 2 : 0); } catch { return "{}"; }
}

function safeParseJson(text) {
  try { return JSON.parse(String(text || "")); } catch { return null; }
}

function sanitizeFilePart(value, fallback = "project") {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || fallback;
}

function makeNewProjectId() {
  const y = new Date().getFullYear();
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `P-${y}-${rnd}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function getByPath(root, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cur = root;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function deleteByPath(root, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return;
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur?.[parts[i]];
    if (!cur || typeof cur !== "object") return;
  }
  delete cur[parts[parts.length - 1]];
}

function setByPath(root, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return;
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isObj(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function stripThumbnailsFromProjectAssets(project) {
  const assets = Array.isArray(project?.projectAssets) ? project.projectAssets : [];
  for (const asset of assets) {
    const slots = Array.isArray(asset?.slots) ? asset.slots : [];
    for (const slot of slots) {
      if (slot && typeof slot === "object") delete slot.thumbnail;
    }
  }
}

function collectLocalModelBuffers(projectId) {
  const out = [];
  try {
    const pid = String(projectId || "");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LS_MODELBUF_PREFIX)) continue;
      if (pid && !key.includes(pid) && !key.includes(":" + pid + ":")) {
        // Viele Buffer-Keys enthalten nur projectAssetId/slotId, nicht projectId.
        // Deshalb NICHT hart filtern; wir lassen diesen Kommentar als Hinweis stehen.
      }
      const value = localStorage.getItem(key);
      if (!value) continue;
      out.push({ key, value, bytes: value.length });
    }
  } catch {}
  return out;
}

function restoreLocalModelBuffers(buffers) {
  let count = 0;
  if (!Array.isArray(buffers)) return count;
  for (const item of buffers) {
    try {
      if (!item?.key || !String(item.key).startsWith(LS_MODELBUF_PREFIX)) continue;
      localStorage.setItem(String(item.key), String(item.value || ""));
      count++;
    } catch {}
  }
  return count;
}

/* ============================================================================
 * EXPORT-PAKET BAUEN
 * ========================================================================== */

function readAppSnapshot({ store }) {
  const snap = typeof store?.snapshot === "function" ? store.snapshot() : {};
  const app = safeClone(snap.app || {});

  // Fallback, falls app in einem Sonderstand leer wäre.
  if (!app.project && snap.project) app.project = safeClone(snap.project);
  if (!app.ui && snap.ui) app.ui = safeClone(snap.ui);
  if (!app.settings && snap.meta?.settings) app.settings = safeClone(snap.meta.settings);

  app.project = isObj(app.project) ? app.project : {};
  app.settings = isObj(app.settings) ? app.settings : {};
  app.ui = isObj(app.ui) ? app.ui : {};

  return { snap, app };
}

function applyExportSelection(app, options) {
  const next = safeClone(app) || { project: {}, settings: {}, ui: {} };
  next.project = isObj(next.project) ? next.project : {};
  next.settings = isObj(next.settings) ? next.settings : {};
  next.ui = isObj(next.ui) ? next.ui : {};

  if (!options.includeSettings) next.settings = {};
  if (!options.includeUi) next.ui = {};

  if (!options.includeProjectAssets) {
    delete next.project.projectAssets;
    delete next.project.assets;
    delete next.settings.projectAssets;
  } else if (!options.includeThumbnails) {
    stripThumbnailsFromProjectAssets(next.project);
  }

  if (!options.includeWorkareaScene) {
    deleteByPath(next, "project.workspace.scene.objects");
    deleteByPath(next, "settings.workspace.scene.objects");
  }

  if (!options.includeAssetLabContext) {
    deleteByPath(next, "ui.assetlab");
  }

  return next;
}

function buildTransferPayload({ store, crashRecorder, options }) {
  const { app } = readAppSnapshot({ store });
  const selectedApp = applyExportSelection(app, options);
  const project = selectedApp.project || {};
  const projectId = String(project.id || app.activeProjectId || "unknown");

  const payload = {
    schema: TRANSFER_SCHEMA,
    version: VERSION,
    exportedAt: nowIso(),
    exportOptions: { ...options },
    app: selectedApp,
    meta: {
      source: "baustellenplaner",
      projectId,
      projectName: project.name || "Projekt",
      note: "Selective transfer export. IndexedDB GLB extraction is planned for transfer v2."
    }
  };

  if (options.includeCrashLog) {
    try { payload.diagnostics = { crashLog: crashRecorder?.text?.() || null }; } catch {}
  }

  if (options.includeModelBuffers) {
    payload.modelBuffers = collectLocalModelBuffers(projectId);
  }

  return payload;
}

/* ============================================================================
 * ZIP: UNKOMPRIMIERTER WRITER + MINIMALER READER
 * ========================================================================== */

let CRC_TABLE = null;

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(bytes) {
  if (!CRC_TABLE) CRC_TABLE = makeCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function textBytes(text) {
  return new TextEncoder().encode(String(text ?? ""));
}

function base64ToBytes(base64) {
  const bin = atob(String(base64 || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function dataUrlToBytes(dataUrl) {
  const s = String(dataUrl || "");
  const m = s.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!m) return null;
  if (m[2]) return base64ToBytes(m[3]);
  return textBytes(decodeURIComponent(m[3] || ""));
}

function writeU16(arr, v) {
  arr.push(v & 255, (v >>> 8) & 255);
}

function writeU32(arr, v) {
  arr.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
}

function concatUint8(chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function createStoredZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = textBytes(file.name);
    const data = file.bytes instanceof Uint8Array ? file.bytes : textBytes(file.text || "");
    const crc = crc32(data);

    const local = [];
    writeU32(local, 0x04034b50);
    writeU16(local, 20); // version needed
    writeU16(local, 0);  // flags
    writeU16(local, 0);  // method 0 = stored
    writeU16(local, 0);  // time
    writeU16(local, 0);  // date
    writeU32(local, crc);
    writeU32(local, data.length);
    writeU32(local, data.length);
    writeU16(local, nameBytes.length);
    writeU16(local, 0);

    const localBytes = concatUint8([new Uint8Array(local), nameBytes, data]);
    chunks.push(localBytes);

    const c = [];
    writeU32(c, 0x02014b50);
    writeU16(c, 20); // made by
    writeU16(c, 20); // needed
    writeU16(c, 0);
    writeU16(c, 0);
    writeU16(c, 0);
    writeU16(c, 0);
    writeU32(c, crc);
    writeU32(c, data.length);
    writeU32(c, data.length);
    writeU16(c, nameBytes.length);
    writeU16(c, 0);
    writeU16(c, 0);
    writeU16(c, 0);
    writeU16(c, 0);
    writeU32(c, 0);
    writeU32(c, offset);

    central.push(concatUint8([new Uint8Array(c), nameBytes]));
    offset += localBytes.length;
  }

  const centralStart = offset;
  for (const c of central) {
    chunks.push(c);
    offset += c.length;
  }
  const centralSize = offset - centralStart;

  const end = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0);
  writeU16(end, 0);
  writeU16(end, files.length);
  writeU16(end, files.length);
  writeU32(end, centralSize);
  writeU32(end, centralStart);
  writeU16(end, 0);
  chunks.push(new Uint8Array(end));

  return new Blob([concatUint8(chunks)], { type: ZIP_MIME });
}

function readU16(bytes, off) {
  return bytes[off] | (bytes[off + 1] << 8);
}

function readU32(bytes, off) {
  return (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
}

function parseStoredZip(bytes) {
  const entries = new Map();
  let off = 0;
  const dec = new TextDecoder();

  while (off + 30 < bytes.length) {
    const sig = readU32(bytes, off);
    if (sig === 0x02014b50 || sig === 0x06054b50) break;
    if (sig !== 0x04034b50) break;

    const method = readU16(bytes, off + 8);
    const compressedSize = readU32(bytes, off + 18);
    const nameLen = readU16(bytes, off + 26);
    const extraLen = readU16(bytes, off + 28);
    const nameStart = off + 30;
    const name = dec.decode(bytes.slice(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;

    if (method !== 0) {
      throw new Error(`ZIP-Eintrag ist komprimiert und wird in v1 noch nicht gelesen: ${name}`);
    }

    entries.set(name, bytes.slice(dataStart, dataEnd));
    off = dataEnd;
  }

  return entries;
}

function extractThumbnailsAsFiles(payload) {
  const files = [];
  const assets = Array.isArray(payload?.app?.project?.projectAssets) ? payload.app.project.projectAssets : [];

  for (const asset of assets) {
    const assetId = sanitizeFilePart(asset?.id || "asset");
    const slots = Array.isArray(asset?.slots) ? asset.slots : [];
    for (const slot of slots) {
      const slotId = sanitizeFilePart(slot?.id || "slot");
      const thumb = slot?.thumbnail;
      const views = thumb?.views && typeof thumb.views === "object" ? thumb.views : {};

      const addView = (viewName, node) => {
        const bytes = dataUrlToBytes(node?.dataUrl);
        if (!bytes) return;
        files.push({
          name: `assets/thumbnails/${assetId}__${slotId}__${sanitizeFilePart(viewName)}.png`,
          bytes
        });
      };

      if (thumb?.dataUrl) addView(thumb.defaultView || "default", thumb);
      for (const [viewName, node] of Object.entries(views)) addView(viewName, node);
    }
  }

  return files;
}

function buildZipBlob(payload) {
  const files = [
    { name: "manifest.json", text: safeStringify({
      schema: "baustellenplaner.transfer.zipManifest.v1",
      createdAt: payload.exportedAt,
      transferSchema: payload.schema,
      version: payload.version,
      projectId: payload.meta?.projectId || null,
      projectName: payload.meta?.projectName || null,
      note: "ZIP is stored/uncompressed for browser-only import compatibility."
    }) },
    { name: "app-state.json", text: safeStringify(payload) },
    { name: "project.json", text: safeStringify(payload.app?.project || {}) },
    { name: "settings.json", text: safeStringify(payload.app?.settings || {}) },
    { name: "ui-state.json", text: safeStringify(payload.app?.ui || {}) }
  ];

  if (payload?.diagnostics?.crashLog) {
    files.push({ name: "diagnostics/crash-recorder.txt", text: payload.diagnostics.crashLog });
  }

  if (Array.isArray(payload?.modelBuffers)) {
    files.push({ name: "assets/model-buffers/localStorage-model-buffers.json", text: safeStringify(payload.modelBuffers) });
  }

  if (payload?.exportOptions?.includeThumbnails) {
    files.push(...extractThumbnailsAsFiles(payload));
  }

  return createStoredZip(files);
}

/* ============================================================================
 * IMPORT
 * ========================================================================== */

function normalizeTransferInput(obj) {
  if (!obj || typeof obj !== "object") return null;

  if (obj.schema === TRANSFER_SCHEMA && isObj(obj.app)) {
    return obj;
  }

  // Debug-Snapshot-Import: { app, project, ui, ... }
  if (isObj(obj.app)) {
    return {
      schema: TRANSFER_SCHEMA,
      version: VERSION,
      exportedAt: nowIso(),
      app: safeClone(obj.app),
      meta: { source: "snapshot", projectId: obj.app?.project?.id || obj.app?.activeProjectId || null }
    };
  }

  // Persistor-Format: { project, settings, ui, _meta }
  if (isObj(obj.project)) {
    return {
      schema: TRANSFER_SCHEMA,
      version: VERSION,
      exportedAt: obj?._meta?.savedAt || nowIso(),
      app: {
        project: safeClone(obj.project || {}),
        settings: safeClone(obj.settings || {}),
        ui: safeClone(obj.ui || {})
      },
      meta: { source: "persistor", projectId: obj.project?.id || obj?._meta?.projectId || null }
    };
  }

  return null;
}

async function readTransferFile(file) {
  const name = String(file?.name || "").toLowerCase();

  if (name.endsWith(".zip")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = parseStoredZip(bytes);
    const appState = entries.get("app-state.json");
    if (!appState) throw new Error("ZIP enthält keine app-state.json.");
    const txt = new TextDecoder().decode(appState);
    const parsed = safeParseJson(txt);
    const transfer = normalizeTransferInput(parsed);
    if (!transfer) throw new Error("app-state.json ist kein gültiges Transfer-Paket.");
    return transfer;
  }

  const txt = await file.text();
  const parsed = safeParseJson(txt);
  const transfer = normalizeTransferInput(parsed);
  if (!transfer) throw new Error("Die Datei ist kein gültiges Baustellenplaner-Projektpaket.");
  return transfer;
}

function importTransferPayload({ payload, mode }) {
  const app = safeClone(payload.app || {}) || {};
  const project = isObj(app.project) ? app.project : {};
  const settings = isObj(app.settings) ? app.settings : {};
  const ui = isObj(app.ui) ? app.ui : {};

  const oldId = String(project.id || payload.meta?.projectId || makeNewProjectId());
  const newId = mode === "keepId" ? oldId : makeNewProjectId();

  project.id = newId;
  project.name = mode === "keepId"
    ? (project.name || "Importiertes Projekt")
    : `${project.name || "Importiertes Projekt"} (Import)`;
  project.updatedAt = nowIso();
  project.importedAt = nowIso();

  const importedApp = {
    project,
    settings,
    ui,
    activeProject: { kind: "local", id: newId },
    activeProjectId: newId
  };

  const localProjectFile = {
    schema: "baustellenplaner.localProjectFile.v1",
    importedAt: nowIso(),
    importSource: {
      schema: payload.schema || null,
      exportedAt: payload.exportedAt || null,
      oldProjectId: oldId,
      mode
    },
    project,
    app: importedApp
  };

  const persistPayload = {
    project,
    settings,
    ui,
    _meta: {
      savedAt: nowIso(),
      projectId: newId,
      importedFrom: oldId,
      source: "project-transfer"
    }
  };

  localStorage.setItem(LS_PROJECTFILE_PREFIX + newId, safeStringify(localProjectFile, false));
  localStorage.setItem(LS_PROJECT_PERSIST_PREFIX + newId, safeStringify(persistPayload, false));
  localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "local:" + newId);

  const restoredBuffers = restoreLocalModelBuffers(payload.modelBuffers);

  return { newId, oldId, restoredBuffers };
}

/* ============================================================================
 * MODAL / UI
 * ========================================================================== */

function ensureStyles() {
  if (document.getElementById("bpProjectTransferStyles")) return;
  const st = document.createElement("style");
  st.id = "bpProjectTransferStyles";
  st.textContent = `
    .bp-transfer-backdrop{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.48);display:flex;align-items:center;justify-content:center;padding:14px;}
    .bp-transfer-modal{width:min(720px,100%);max-height:min(760px,92vh);overflow:auto;border-radius:18px;background:#fff;color:#0f172a;box-shadow:0 28px 80px rgba(15,23,42,.35);border:1px solid rgba(15,23,42,.16);}
    .bp-transfer-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(15,23,42,.12);}
    .bp-transfer-title{font-weight:800;font-size:17px;line-height:1.25;}
    .bp-transfer-sub{margin-top:4px;color:#64748b;font-size:13px;line-height:1.35;}
    .bp-transfer-x{border:1px solid rgba(15,23,42,.18);background:#f8fafc;border-radius:12px;min-width:40px;min-height:38px;font-weight:800;}
    .bp-transfer-body{padding:16px 18px;display:grid;gap:14px;}
    .bp-transfer-box{border:1px solid rgba(15,23,42,.12);background:#f8fafc;border-radius:14px;padding:12px;}
    .bp-transfer-box h3{font-size:14px;margin:0 0 8px 0;}
    .bp-transfer-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;}
    .bp-transfer-check,.bp-transfer-radio{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.25;}
    .bp-transfer-check input,.bp-transfer-radio input{margin-top:2px;}
    .bp-transfer-help{font-size:12px;color:#64748b;margin-top:8px;line-height:1.35;}
    .bp-transfer-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;padding:14px 18px;border-top:1px solid rgba(15,23,42,.12);background:#f8fafc;border-radius:0 0 18px 18px;}
    .bp-transfer-btn{border:1px solid rgba(15,23,42,.18);background:#fff;border-radius:12px;min-height:40px;padding:8px 12px;font-weight:700;}
    .bp-transfer-btn.primary{background:#0f172a;color:#fff;border-color:#0f172a;}
    .bp-transfer-status{font-size:12px;color:#334155;white-space:pre-wrap;}
    .bp-transfer-file{max-width:100%;}
    @media (max-width:700px){.bp-transfer-backdrop{align-items:flex-end;padding:8px}.bp-transfer-modal{max-height:90vh;border-radius:18px 18px 10px 10px}.bp-transfer-grid{grid-template-columns:1fr}.bp-transfer-actions{justify-content:stretch}.bp-transfer-btn{flex:1}.bp-transfer-head{padding:14px}.bp-transfer-body{padding:14px}.bp-transfer-actions{padding:12px 14px}}
  `;
  document.head.appendChild(st);
}

function checkboxHtml(id, label, checked = true) {
  return `<label class="bp-transfer-check"><input id="${id}" type="checkbox" ${checked ? "checked" : ""}> <span>${label}</span></label>`;
}

function openTransferModal(ctx) {
  ensureStyles();
  document.getElementById("bpProjectTransferModal")?.remove();

  const wrap = document.createElement("div");
  wrap.id = "bpProjectTransferModal";
  wrap.className = "bp-transfer-backdrop";
  wrap.innerHTML = `
    <div class="bp-transfer-modal" role="dialog" aria-modal="true" aria-label="Projekt Transfer">
      <div class="bp-transfer-head">
        <div>
          <div class="bp-transfer-title">Projekt exportieren / importieren</div>
          <div class="bp-transfer-sub">Wähle vor dem Export aus, welche Teile ins Projektpaket sollen. Für einen Grundstock kannst du z. B. die Workarea-Objekte abwählen.</div>
        </div>
        <button class="bp-transfer-x" type="button" data-bp-transfer-close>×</button>
      </div>
      <div class="bp-transfer-body">
        <div class="bp-transfer-box">
          <h3>Exportformat</h3>
          <label class="bp-transfer-radio"><input type="radio" name="bpTransferFormat" value="json" checked> <span>JSON – schnell, gut für Debug und einfachen Transfer</span></label>
          <label class="bp-transfer-radio"><input type="radio" name="bpTransferFormat" value="zip"> <span>ZIP – Projektpaket mit Manifest, Einzeldateien, Thumbnails und Diagnose-Dateien</span></label>
        </div>
        <div class="bp-transfer-box">
          <h3>Export-Inhalt</h3>
          <div class="bp-transfer-grid">
            ${checkboxHtml("bpExpProjectAssets", "Projekt-Assets und Slots", true)}
            ${checkboxHtml("bpExpThumbnails", "Thumbnails / Vorschaubilder", true)}
            ${checkboxHtml("bpExpWorkareaScene", "Workarea: platzierte Objekte / Scene", true)}
            ${checkboxHtml("bpExpSettings", "Projekt- und UI-Einstellungen", true)}
            ${checkboxHtml("bpExpUi", "UI-Zustand, zuletzt geöffnete Bereiche", true)}
            ${checkboxHtml("bpExpAssetLab", "AssetLab-Kontext", true)}
            ${checkboxHtml("bpExpCrashLog", "CrashLog / Diagnose", true)}
            ${checkboxHtml("bpExpModelBuffers", "lokale Modellbuffer soweit verfügbar", true)}
          </div>
          <div class="bp-transfer-help">Tipp: Für ein Template/Grundstock „Workarea: platzierte Objekte“ abwählen. Für einen vollständigen Gerätetransfer alles aktiviert lassen.</div>
        </div>
        <div class="bp-transfer-box">
          <h3>Import</h3>
          <input id="bpTransferImportFile" class="bp-transfer-file" type="file" accept=".json,.zip,application/json,application/zip">
          <div class="bp-transfer-help">Import legt standardmäßig eine neue lokale Projektkopie an, damit nichts überschrieben wird.</div>
          <label class="bp-transfer-radio"><input type="radio" name="bpImportMode" value="newCopy" checked> <span>Als neues lokales Projekt importieren</span></label>
          <label class="bp-transfer-radio"><input type="radio" name="bpImportMode" value="keepId"> <span>Projekt-ID aus Datei beibehalten / ersetzen</span></label>
        </div>
        <div id="bpTransferStatus" class="bp-transfer-status"></div>
      </div>
      <div class="bp-transfer-actions">
        <button class="bp-transfer-btn" type="button" data-bp-transfer-close>Schließen</button>
        <button id="bpTransferImportBtn" class="bp-transfer-btn" type="button">Datei importieren</button>
        <button id="bpTransferExportBtn" class="bp-transfer-btn primary" type="button">Export erstellen</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  const status = byId("bpTransferStatus");
  const setStatus = (msg) => { if (status) status.textContent = String(msg || ""); };

  const close = () => wrap.remove();
  wrap.querySelectorAll("[data-bp-transfer-close]").forEach((el) => el.addEventListener("click", close));
  wrap.addEventListener("click", (ev) => { if (ev.target === wrap) close(); });

  byId("bpTransferExportBtn")?.addEventListener("click", () => {
    try {
      const format = wrap.querySelector("input[name='bpTransferFormat']:checked")?.value || "json";
      const options = {
        includeProjectAssets: !!byId("bpExpProjectAssets")?.checked,
        includeThumbnails: !!byId("bpExpThumbnails")?.checked,
        includeWorkareaScene: !!byId("bpExpWorkareaScene")?.checked,
        includeSettings: !!byId("bpExpSettings")?.checked,
        includeUi: !!byId("bpExpUi")?.checked,
        includeAssetLabContext: !!byId("bpExpAssetLab")?.checked,
        includeCrashLog: !!byId("bpExpCrashLog")?.checked,
        includeModelBuffers: !!byId("bpExpModelBuffers")?.checked
      };

      const payload = buildTransferPayload({ store: ctx.store, crashRecorder: ctx.crashRecorder, options });
      const pid = sanitizeFilePart(payload.meta?.projectId || "project");
      const stamp = nowIso().replace(/[:.]/g, "-");

      if (format === "zip") {
        const blob = buildZipBlob(payload);
        downloadBlob(blob, `baustellenplaner-project-${pid}-${stamp}.zip`);
        setStatus(`ZIP-Export erstellt.\nProjekt: ${pid}\nHinweis: IndexedDB-GLB-Extraktion folgt später in v2.`);
      } else {
        const blob = new Blob([safeStringify(payload)], { type: JSON_MIME });
        downloadBlob(blob, `baustellenplaner-project-${pid}-${stamp}.json`);
        setStatus(`JSON-Export erstellt.\nProjekt: ${pid}`);
      }

      ctx.crashRecorder?.log?.("project-transfer:export", { format, projectId: pid, options });
    } catch (e) {
      console.error("[project-transfer] export failed", e);
      setStatus(`Export fehlgeschlagen: ${e?.message || String(e)}`);
      ctx.crashRecorder?.log?.("project-transfer:export:error", { message: e?.message || String(e) });
    }
  });

  byId("bpTransferImportBtn")?.addEventListener("click", async () => {
    try {
      const input = byId("bpTransferImportFile");
      const file = input?.files?.[0];
      if (!file) {
        setStatus("Bitte zuerst eine JSON- oder ZIP-Datei auswählen.");
        return;
      }

      setStatus("Import läuft …");
      const payload = await readTransferFile(file);
      const mode = wrap.querySelector("input[name='bpImportMode']:checked")?.value || "newCopy";
      const result = importTransferPayload({ payload, mode });

      ctx.crashRecorder?.log?.("project-transfer:import", {
        file: file.name,
        oldId: result.oldId,
        newId: result.newId,
        restoredBuffers: result.restoredBuffers
      });

      setStatus(`Import fertig.\nNeue Projekt-ID: ${result.newId}\nModellbuffer wiederhergestellt: ${result.restoredBuffers}\nDie App wird jetzt mit dem importierten Projekt geöffnet …`);

      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("project", "local:" + result.newId);
        window.location.href = url.toString();
      }, 700);
    } catch (e) {
      console.error("[project-transfer] import failed", e);
      setStatus(`Import fehlgeschlagen: ${e?.message || String(e)}`);
      ctx.crashRecorder?.log?.("project-transfer:import:error", { message: e?.message || String(e) });
    }
  });
}

/* ============================================================================
 * INSTALLATION
 * ========================================================================== */

export function installProjectTransferTools({ app = null, store = null, bus = null, crashRecorder = null } = {}) {
  const realStore = store || app?.store || null;
  const realBus = bus || app?.bus || null;
  const rec = crashRecorder || window.BP_CRASH_RECORDER || null;

  if (!realStore || document.getElementById("btnProjectTransfer")) return false;

  const addButton = () => {
    const tools = byId("debugTools");
    if (!tools || document.getElementById("btnProjectTransfer")) return false;

    const btn = document.createElement("button");
    btn.id = "btnProjectTransfer";
    btn.className = "bp-btn bp-btn-secondary";
    btn.type = "button";
    btn.textContent = "Projekt Transfer";
    btn.title = "Projekt selektiv als JSON/ZIP exportieren oder importieren";
    btn.addEventListener("click", () => openTransferModal({ store: realStore, bus: realBus, crashRecorder: rec }));

    const exportBtn = byId("btnDownloadSnapshot");
    if (exportBtn?.parentNode) exportBtn.parentNode.insertBefore(btn, exportBtn.nextSibling);
    else tools.appendChild(btn);

    rec?.log?.("project-transfer:ready", { version: VERSION });
    return true;
  };

  if (addButton()) return true;
  setTimeout(addButton, 250);
  setTimeout(addButton, 1000);
  return true;
}

export default installProjectTransferTools;
