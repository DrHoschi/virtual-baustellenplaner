/**
 * Baustellenplaner – Core Loader / App Bootstrap
 * Datei: core/loader.js
 *
 * Basis: v1.2.0-browser-jsonfix-menu-wire (2026-02-09)
 *
 * PATCH (2026-02-25):
 * - BOOT-GUARD: nie direkt in projectPanel:assetlab3d booten (kann auf iOS am iframe-handshake hängen)
 * - MOUNT-TIMEOUT: switchView darf nie endlos auf panel.mount() warten -> Timeout + Fehleranzeige
 *
 * PATCH (2026-02-25, Save-Button only):
 * - Persistor wird initialisiert, aber KEIN Autosave.
 * - Speichern erfolgt nur über bus Event: "ui:project:save" (und als Fallback "ui:save")
 *
 * PATCH (2026-02-25, Fix Reload for file projects):
 * - Wenn ein gespeicherter Snapshot im localStorage existiert:
 *     baustellenplaner:project:<projectId>
 *   dann wird dieser Snapshot beim Start auch für "file"-Projekte genutzt.
 *   => ProjektAssets sind nach Reload NICHT wieder leer.
 *
 * Debug/Checker bleiben drin.
 */

/* ============================================================================
 * IMPORTS
 * ========================================================================== */

import { createBus } from "../core/bus.js";
import { createStore } from "../core/store.js";
import { createRegistry } from "../app/registry.js";

import { createFeatureGate } from "./featureGate.js";
import { loadManifestPack } from "./manifest-pack.js";

import { renderMenu } from "../app/ui/menu.js";
import { createPanelRegistry } from "../ui/panels/panel-registry.js";

// ✅ Persistor (Save-Button only; Migration bleibt im Loader)
import { createAppPersistor } from "./persist/app-persist.js";

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

// Version 1.0.0 – Konsolidierte Code‑Basis (2026‑05‑22)
// Diese Version markiert den Neustart des Baustellenplaners.
// Sie konsolidiert Module, vereinheitlicht die Persistenz und folgt den Zielen
// der Ziel‑Dokumentation in docs/Ziel_Dokument.md.  Weitere Details zum
// Bereinigungsprozess finden Sie dort.
const VERSION = "v1.0.2-clean-save-queue-status-v1 (2026-05-24)";
const DEV = (() => {
  try {
    return !!(globalThis?.location && /localhost|127\.0\.0\.1/i.test(globalThis.location.host));
  } catch {
    return false;
  }
})();

// Wie lange darf ein Panel maximal in mount() hängen, bevor wir abbrechen?
// iOS/Safari + iframe handshake kann sonst "für immer" blockieren.
const PANEL_MOUNT_TIMEOUT_MS = 8000;

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function $(sel) {
  return document.querySelector(sel);
}

function setActiveSubTitle(text) {
  const el = $("#active");
  if (el) el.textContent = text;
}

function safeStringify(v) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`loadJson: ${res.status} ${res.statusText} (${url})`);
  return await res.json();
}

function showFatalInView({ title, error, extra = "" }) {
  const view = $("#view");
  if (!view) return;

  const pre = document.createElement("pre");
  pre.style.whiteSpace = "pre-wrap";
  pre.style.padding = "12px";
  pre.style.border = "1px solid rgba(255,0,0,.35)";
  pre.style.background = "rgba(255,0,0,.06)";
  pre.style.borderRadius = "10px";

  const msg =
    `${title}\n` +
    `------------------------------------------------------------\n` +
    `${String(error?.message || error)}\n` +
    (error?.stack ? `\n${error.stack}\n` : "") +
    (extra ? `\n${extra}\n` : "");

  pre.textContent = msg;
  view.innerHTML = "";
  view.appendChild(pre);
}

function renderMissingPanel({ store, panelId, moduleKey, reason }) {
  const view = $("#view");
  if (!view) return;

  const snap = (() => {
    try {
      return store?.snapshot?.() ?? {};
    } catch {
      return {};
    }
  })();

  const box = document.createElement("div");
  box.style.padding = "12px";
  box.style.border = "1px solid rgba(255,165,0,.35)";
  box.style.background = "rgba(255,165,0,.08)";
  box.style.borderRadius = "10px";

  const h = document.createElement("h3");
  h.textContent = "⚠️ Panel fehlt / nicht registriert";
  h.style.margin = "0 0 8px 0";
  box.appendChild(h);

  const p = document.createElement("div");
  p.style.fontSize = "14px";
  p.style.lineHeight = "1.3";
  p.innerHTML =
    `<b>moduleKey:</b> ${moduleKey || "-"}<br>` +
    `<b>panelId:</b> ${panelId || "-"}<br>` +
    (reason ? `<b>Grund:</b> ${reason}<br>` : "");
  box.appendChild(p);

  if (DEV) {
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.marginTop = "10px";
    pre.textContent = "Store Snapshot:\n" + safeStringify(snap);
    box.appendChild(pre);
  }

  view.innerHTML = "";
  view.appendChild(box);
}

function updateSnapshot(store) {
  try {
    const el = $("#snapshot");
    if (!el) return;
    const snap = store?.snapshot?.() ?? {};
    el.textContent = safeStringify(snap);
  } catch {
    // Snapshot ist Debug – darf nie crashen.
  }
}

// Promise helper: Timeout für await mount()
function withTimeout(promise, ms, label) {
  let t = null;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (t) clearTimeout(t);
  });
}

/* ============================================================================
 * CENTRAL MIGRATION: projectAssets Drift stoppen (LOAD + POST-INIT)
 * ========================================================================== */

function __bp_isObj(x) { return !!x && typeof x === "object"; }
function __bp_arr(v) { return Array.isArray(v) ? v : []; }
function __bp_str(v) { return (typeof v === "string") ? v : ""; }

function __bp_scoreProjectAssets(list) {
  const arr = __bp_arr(list);
  let score = 0;
  score += arr.length * 10;

  for (const pa of arr) {
    const slots = __bp_arr(pa?.slots);
    score += slots.length * 2;
    for (const s of slots) {
      if (s?.hasModel === true) score += 20;
      if (__bp_str(s?.lastImportName).trim()) score += 10;
      if (__bp_str(s?.updatedAt).trim()) score += 2;
      if (__bp_str(s?.lastAction).toLowerCase().includes("import")) score += 1;
      if (s?.exportRef) score += 5;
      if (s?.model) score += 5;
    }
  }
  return score;
}

function __bp_firstSlotId(pa) {
  const slots = __bp_arr(pa?.slots);
  return slots[0]?.id || null;
}

function __bp_hasAssetId(list, id) {
  return __bp_arr(list).some((a) => a && a.id === id);
}

function __bp_migrateProjectAssets({ project, app }) {
  const proj = __bp_isObj(project) ? project : {};
  const a = __bp_isObj(app) ? app : {};

  const candA = __bp_arr(proj.projectAssets);
  const candB = __bp_arr(a?.project?.projectAssets);
  const candC = __bp_arr(a?.settings?.projectAssets);

  const scored = [
    { key: "project.projectAssets", list: candA, score: __bp_scoreProjectAssets(candA) },
    { key: "app.project.projectAssets", list: candB, score: __bp_scoreProjectAssets(candB) },
    { key: "app.settings.projectAssets", list: candC, score: __bp_scoreProjectAssets(candC) },
  ].sort((x, y) => y.score - x.score);

  const best = scored[0];
  const canonical = (best?.list && best.list.length) ? best.list : candA;

  proj.projectAssets = canonical;

  a.project = __bp_isObj(a.project) ? a.project : {};
  a.settings = __bp_isObj(a.settings) ? a.settings : {};
  a.project.projectAssets = canonical;
  // BP 2.0: projectAssets NICHT mehr in app.settings spiegeln (Doppelquelle vermeiden)
  if (a.settings && a.settings.projectAssets) delete a.settings.projectAssets;

  try {
    const ctx = a?.ui?.assetlab?.context;
    if (ctx && (ctx.projectAssetId || ctx.slotId)) {
      const wantAssetId = ctx.projectAssetId;
      const wantSlotId = ctx.slotId;

      if (wantAssetId && !__bp_hasAssetId(canonical, wantAssetId)) {
        if (canonical.length === 1 && canonical[0]?.id) {
          ctx.projectAssetId = canonical[0].id;
          ctx.slotId = __bp_firstSlotId(canonical[0]);
        } else {
          ctx.projectAssetId = null;
          ctx.slotId = null;
        }
      } else if (wantAssetId && wantSlotId) {
        const asset = __bp_arr(canonical).find((x) => x && x.id === wantAssetId) || null;
        const slots = __bp_arr(asset?.slots);
        const slotExists = slots.some((s) => s && s.id === wantSlotId);
        if (!slotExists) ctx.slotId = __bp_firstSlotId(asset);
      }
    }
  } catch {
    // non-fatal
  }

  return { project: proj, app: a, report: { chosenFrom: best?.key || "project.projectAssets" } };
}

/* ============================================================================
 * MENU MODEL BUILDER
 * ========================================================================== */

async function buildMenuModel({ projectBaseUrl, uiConfig }) {
  const menuRegistryUrl = new URL("./menu.registry.json", window.location.href).toString();
  const reg = await loadJson(menuRegistryUrl);

  const groups = Array.isArray(uiConfig?.groups) ? uiConfig.groups : [];
  const groupMap = new Map(groups.map((g) => [g.key, { ...g, items: [] }]));

  const anchorToGroup = {
    projectPanel: "projekt",
    topbar: "tools"
  };

  const entries = Array.isArray(reg?.entries) ? reg.entries : [];
  for (const e of entries) {
    const anchor = e?.anchor || "tools";
    const tabId = e?.tabId || "default";
    const moduleKey = `${anchor}:${tabId}`;

    const gKey = anchorToGroup[anchor] || "tools";
    const g = groupMap.get(gKey) || groupMap.get("tools");
    if (!g) continue;

    g.items.push({
      moduleKey,
      label: e?.title || moduleKey,
      icon: null,
      order: e?.order ?? 999
    });
  }

  for (const g of groupMap.values()) {
    g.items.sort((a, b) => (a.order || 0) - (b.order || 0) || a.label.localeCompare(b.label));
  }

  return groups
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((g) => groupMap.get(g.key))
    .filter((g) => g && g.items && g.items.length);
}

/* ============================================================================
 * CORE BOOTSTRAP
 * ========================================================================== */

async function init({ projectPath } = {}) {
  console.log(`[loader] ${VERSION}`);

  const bus = createBus();
  const store = createStore({ bus });
  const registry = createRegistry();
  const panels = createPanelRegistry();

  const DEFAULT_PROJECT_PATH = "./projects/P-2026-0001/project.json";
  const pPath = projectPath || DEFAULT_PROJECT_PATH;

  /*
   * CI-/Browser-Fix v1.2.5:
   * Query-Parameter wie ?project=local:P-2026-.... sind keine echte URL.
   * Der lokale Projektinhalt kommt zwar aus localStorage, aber Meta/Config/UI-Dateien
   * muessen weiterhin aus dem Standard-Projektordner geladen werden.
   *
   * Vorher wurde aus "local:P-..." eine projectBaseUrl abgeleitet. Dadurch krachte
   * new URL("./meta.json", projectBaseUrl) im Playwright-Test mit:
   * "Failed to construct 'URL': Invalid URL".
   */
  function resolveProjectUrlForBundle(rawPath) {
    const val = String(rawPath || "").trim();

    // Lokale Projekte sind virtuelle Referenzen. Fuer Bundle-Dateien nutzen wir
    // bewusst den stabilen Standard-Projektpfad als Basis.
    if (/^local:/i.test(val)) {
      return new URL(DEFAULT_PROJECT_PATH, window.location.href).toString();
    }

    // file:<url> ist unsere eigene gespeicherte Referenz-Schreibweise. Fuer den
    // fetchbaren Pfad wird der Prefix entfernt.
    if (/^file:/i.test(val)) {
      return new URL(val.slice("file:".length), window.location.href).toString();
    }

    return new URL(val || DEFAULT_PROJECT_PATH, window.location.href).toString();
  }

  const projectUrl = resolveProjectUrlForBundle(pPath);
  const projectBaseUrl = projectUrl.replace(/\/project\.json(\?.*)?$/, "/");

  let projectJson = null;
  let metaJson = null;
  let uiConfig = null;
  let uiState = null;

  const LS_ACTIVE_PROJECT_KEY = "baustellenplaner:activeProject";
  const LS_PROJECTFILE_PREFIX = "baustellenplaner:projectfile:";

  let activeProjectRef = { kind: "file", url: projectUrl };
  let localProjectFileObj = null;

  const urlProjectParam = new URLSearchParams(location.search).get("project");
  if (urlProjectParam) {
    const val = String(urlProjectParam).trim();
    if (/^local:/i.test(val)) {
      activeProjectRef = { kind: "local", id: val.slice("local:".length) };
      try { localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "local:" + activeProjectRef.id); } catch {}
    } else if (/^file:/i.test(val)) {
      activeProjectRef = { kind: "file", url: val.slice("file:".length) };
      try { localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "file:" + activeProjectRef.url); } catch {}
    } else {
      activeProjectRef = { kind: "file", url: val };
      try { localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "file:" + activeProjectRef.url); } catch {}
    }
  } else {
    try {
      const last = localStorage.getItem(LS_ACTIVE_PROJECT_KEY);
      if (last && /^local:/i.test(last)) activeProjectRef = { kind: "local", id: last.slice("local:".length) };
      if (last && /^file:/i.test(last)) activeProjectRef = { kind: "file", url: last.slice("file:".length) };
    } catch {}
  }

  try {
    if (activeProjectRef.kind === "local") {
      const key = LS_PROJECTFILE_PREFIX + activeProjectRef.id;
      const raw = localStorage.getItem(key);
      if (!raw) throw new Error("[loader] local projectfile not found: " + key);
      const obj = JSON.parse(raw);
      localProjectFileObj = obj;

      const proj = (obj && (obj.project || obj)) || {};
      projectJson = proj;

      metaJson = metaJson || {};
      metaJson.settings = (obj && obj.app && obj.app.settings) || metaJson.settings || {};

      // ✅ uiState aus local projectfile benutzen (wenn vorhanden)
      uiState = (obj && obj.app && obj.app.ui) || uiState;
    } else {
      projectJson = await loadJson(projectUrl);
    }

    metaJson = await loadJson(new URL("./meta.json", projectBaseUrl).toString());
    uiConfig = await loadJson(new URL("./ui/ui.config.json", projectBaseUrl).toString());

    // ✅ NICHT überschreiben, wenn uiState aus local projectfile kam
    if (!uiState) {
      uiState = await loadJson(new URL("./ui/ui.state.json", projectBaseUrl).toString());
    }
  } catch (e) {
    console.error("[loader] Project bundle load FAILED:", e);
    showFatalInView({
      title: "FATAL: Projekt-Dateien konnten nicht geladen werden",
      error: e,
      extra: `projectPath=${pPath}`
    });
    // Fatal: wir brechen trotzdem nicht hart ab, damit Debug/Overlay sichtbar bleiben
  }

  /* ============================================================================
   * SNAPSHOT OVERRIDE (FILE PROJECTS)
   * ==========================================================================
   */
  let __snapSettingsForApp = null;
  let __hasSnapOverride = false;
  let __snapUiForApp = null;
  let __snapProjectForApp = null;

  /* ==========================================================================
   * ==========================================================================
   */
  try {
    // ✅ ID robust ermitteln (Wrapper oder Project-only)
    const baseProject =
      (projectJson && typeof projectJson === "object" && projectJson.project && typeof projectJson.project === "object")
        ? projectJson.project
        : projectJson;

    const pid = (baseProject && baseProject.id) ? String(baseProject.id) : null;

    if (pid) {
      const snapKey = `baustellenplaner:project:${pid}`;
      const raw = localStorage.getItem(snapKey);

      if (raw) {
        const snap = JSON.parse(raw);

        // Snapshot kann:
        // A) { project, settings, ui, _meta } (Persistor-Format)
        // B) direkt das Projektobjekt sein (Project-only)
        if (snap && typeof snap === "object") {
          const snapProject =
            (snap.project && typeof snap.project === "object")
              ? snap.project
              : snap; // fallback: snap itself is the project

          if (snapProject && typeof snapProject === "object") {
            console.log("[loader] using saved snapshot override:", snapKey);
            projectJson = snapProject;
          }

          if (snap.settings && typeof snap.settings === "object") {
            // BP 2.0: Settings gehören nicht mehr in meta.json.
            // Wir merken sie für app.settings und lassen meta "clean".
            __snapSettingsForApp = snap.settings;
            __hasSnapOverride = true;
          }

          if (snap.ui && typeof snap.ui === "object") {
            uiState = snap.ui;
            __snapUiForApp = snap.ui;
            __hasSnapOverride = true;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[loader] snapshot override failed (non-fatal)", e);
  }


  // ✅ SNAPSHOT OVERRIDE MERGE (wichtig für local-Projekte!)
  // Hintergrund:
  // - Bei local-Projekten kommt appCandidate sonst aus localProjectFileObj.app
  //   und würde damit snapshot-override (projectJson/settings/ui) IGNORIEREN.
  // - Das führt genau zu deinem Symptom: Loader meldet "using saved snapshot override",
  //   aber Workarea ist nach Reload/Safari-Neustart leer bzw. hängt im "Projekt wird geladen…".
  try {
    if (__hasSnapOverride && activeProjectRef.kind === "local" && localProjectFileObj && localProjectFileObj.app) {
      localProjectFileObj.app = localProjectFileObj.app && typeof localProjectFileObj.app === "object" ? localProjectFileObj.app : {};
      if (__snapProjectForApp && typeof __snapProjectForApp === "object") {
        localProjectFileObj.app.project = __snapProjectForApp;
      }
      if (__snapSettingsForApp && typeof __snapSettingsForApp === "object") {
        localProjectFileObj.app.settings = __snapSettingsForApp;
      }
      if (__snapUiForApp && typeof __snapUiForApp === "object") {
        localProjectFileObj.app.ui = __snapUiForApp;
      }
    }
  } catch (e) {
    console.warn("[loader] snapshot merge into localProjectFileObj.app failed (non-fatal)", e);
  }

  // MIGRATION (LOAD)
  try {
    const appCandidate =
      (activeProjectRef.kind === "local" && localProjectFileObj && localProjectFileObj.app)
        ? localProjectFileObj.app
        : { project: projectJson || {}, settings: (__snapSettingsForApp || ((metaJson && metaJson.settings) ? metaJson.settings : {})), ui: uiState || {} };

    const migrated = __bp_migrateProjectAssets({ project: projectJson || {}, app: appCandidate });
    projectJson = migrated.project;

    if (DEV) console.log("[loader] migrate projectAssets (LOAD):", migrated?.report?.chosenFrom);
  } catch (e) {
    console.warn("[loader] migrate projectAssets (LOAD) failed (non-fatal)", e);
  }

  store.init("project", projectJson || {});
  // BP 2.0: meta.json enthält nur Metadaten (createdAt/lastOpenedAt etc.).
  // Settings (workspace/ui/tool-state) leben ausschließlich in app.settings.
  if (metaJson && typeof metaJson === "object" && metaJson.settings) {
    // Falls meta.json (oder Legacy-Snapshots) noch settings enthält, konsumieren wir
    // sie in app.settings (siehe _appInitSettings) und entfernen sie hier.
    // Dadurch vermeiden wir Doppelquellen (meta.settings vs app.settings).
    delete metaJson.settings;
  }
  store.init("meta", metaJson || {});
  store.init("ui", uiState || {});
  store.init("config", uiConfig || {});

  const _appInitProject = (projectJson && (projectJson.project || projectJson)) || (projectJson || {});
  const _appInitSettings = (__snapSettingsForApp || ((metaJson && metaJson.settings) ? metaJson.settings : {})) || {};
  const _appInitUi = uiState || {};
  store.init("app", {
    project: _appInitProject,
    settings: _appInitSettings,
    ui: _appInitUi,
    activeProject: activeProjectRef,
    activeProjectId: (_appInitProject && _appInitProject.id) ? String(_appInitProject.id) : (activeProjectRef.id || null)
  });

  /* ============================================================================
   * PERSISTOR (Nur Save-Button, KEIN Autosave)
   * ==========================================================================
   */
  const persistor = createAppPersistor({
    bus,
    store,
    projectId: store.get("app")?.activeProjectId
  });

  /* ============================================================================
   * CLEAN SAVE QUEUE V1
   * ==========================================================================
   * Loader/Persistor ist die einzige echte Projekt-Speicherstelle.
   * WorkareaPanel meldet nur Dirty. Der Loader debounced, fasst zusammen,
   * flushed bei pagehide/visibility-hidden und meldet app:save:status.
   */
  let __bpSaveTimer = null;
  let __bpSaveSeq = 0;
  let __bpSaveDirty = false;
  let __bpSaveRunning = false;
  let __bpPendingAfterRun = false;
  let __bpLastSaveStatus = "idle";

  function __bpLog(type, detail = {}) {
    try { window.BP_CRASH_RECORDER?.log?.(type, detail); } catch {}
    try { window.__bpCrashRecorder?.log?.(type, detail); } catch {}
  }

  function __bpEmitSaveStatus(status, detail = {}) {
    __bpLastSaveStatus = String(status || "unknown");
    const payload = { source: "loader-clean-save-queue-v1", status: __bpLastSaveStatus, dirty: __bpSaveDirty, running: __bpSaveRunning, ts: Date.now(), ...detail };
    try { bus.emit("app:save:status", payload); } catch {}
    try { window.dispatchEvent(new CustomEvent("app:save:status", { detail: payload })); } catch {}
    __bpLog("app:save:status", payload);
  }

  function __bpIsUiOnlySaveReason(reason = "") {
    const r = String(reason || "");
    return r.startsWith("structure-ui:") || r === "structure" || r === "structure:bulk" || r === "group-toggle" || r === "object-toggle" || r === "tap" || r === "selection" || r === "props:select";
  }

  function __bpClampSaveDelay(delay, reason = "") {
    if (String(reason || "").startsWith("scene:drag-end")) return 1600;
    const n = Number(delay);
    if (!Number.isFinite(n)) return 1800;
    return Math.max(400, Math.min(4000, n));
  }

  function __doManualSave(reason = "manual") {
    try {
      if (__bpSaveTimer) {
        clearTimeout(__bpSaveTimer);
        __bpSaveTimer = null;
      }
      if (__bpSaveRunning) {
        __bpPendingAfterRun = true;
        __bpLog("workarea:save:dedup-running:v1", { source: "loader-clean-save-queue-v1", reason });
        return true;
      }
      __bpSaveRunning = true;
      __bpEmitSaveStatus("saving", { reason });

      const ok = persistor.saveNow(reason);
      __bpSaveDirty = false;
      __bpSaveRunning = false;

      __bpLog("workarea:save:executed:v5", { source: "loader-clean-save-queue-v1", reason, ok: ok !== false });
      __bpEmitSaveStatus(ok === false ? "error" : "saved", { reason, ok: ok !== false });
      if (__bpPendingAfterRun) {
        __bpPendingAfterRun = false;
        __scheduleProjectSave("pending-after-run", 1200);
      }
      if (DEV) console.log("[loader] project save executed:", reason);
      return ok;
    } catch (e) {
      __bpSaveRunning = false;
      console.error("[loader] project save failed:", e);
      __bpLog("workarea:save:error:v5", { source: "loader-clean-save-queue-v1", reason, message: e?.message || String(e) });
      __bpEmitSaveStatus("error", { reason, message: e?.message || String(e) });
      return false;
    }
  }

  function __scheduleProjectSave(reason = "scheduled", delay = 1800) {
    const saveReason = String(reason || "scheduled");
    if (__bpIsUiOnlySaveReason(saveReason)) {
      __bpLog("workarea:save:ignored-ui-state:v5", { source: "loader-clean-save-queue-v1", reason: saveReason });
      return false;
    }
    __bpSaveDirty = true;
    const seq = ++__bpSaveSeq;
    const ms = __bpClampSaveDelay(delay, saveReason);
    if (__bpSaveTimer) clearTimeout(__bpSaveTimer);
    __bpEmitSaveStatus("dirty", { reason: saveReason, delay: ms });
    __bpLog("workarea:save:scheduled:v5", { source: "loader-clean-save-queue-v1", reason: saveReason, delay: ms, seq });
    __bpSaveTimer = setTimeout(() => {
      if (seq !== __bpSaveSeq) return;
      __doManualSave(`scheduled:${saveReason}`);
    }, ms);
    return true;
  }

  function __flushProjectSave(reason = "flush") {
    if (!__bpSaveDirty && !__bpSaveTimer) return false;
    __bpLog("workarea:save:flush:v5", { source: "loader-clean-save-queue-v1", reason });
    return __doManualSave(`flush:${reason}`);
  }

  bus.on("ui:project:save", (msg = {}) => __doManualSave(msg?.reason || "ui:project:save"));
  bus.on("ui:save", (msg = {}) => __doManualSave(msg?.reason || "ui:save"));
  bus.on("cb:workarea:dirty", (msg = {}) => __scheduleProjectSave(msg?.reason || "cb:workarea:dirty", msg?.delay || 1800));
  bus.on("workarea:dirty", (msg = {}) => __scheduleProjectSave(msg?.reason || "workarea:dirty", msg?.delay || 1800));
  bus.on("workarea:dirty:marked", (msg = {}) => __scheduleProjectSave(msg?.reason || "workarea:dirty:marked", msg?.delay || 1800));

  window.addEventListener("cb:workarea:dirty", (ev) => {
    const d = ev?.detail || {};
    __scheduleProjectSave(d.reason || "window:cb:workarea:dirty", d.delay || 1800);
  });
  window.addEventListener("workarea:dirty", (ev) => {
    const d = ev?.detail || {};
    __scheduleProjectSave(d.reason || "window:workarea:dirty", d.delay || 1800);
  });
  window.addEventListener("pagehide", () => __flushProjectSave("pagehide"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") __flushProjectSave("visibility-hidden");
  });

  if (DEV) {
    globalThis.__BP_FORCE_SAVE__ = __doManualSave;
    globalThis.__BP_FLUSH_SAVE__ = __flushProjectSave;
    globalThis.__BP_SAVE_STATUS__ = () => ({ status: __bpLastSaveStatus, dirty: __bpSaveDirty, running: __bpSaveRunning, timer: !!__bpSaveTimer, seq: __bpSaveSeq });
  }

  // MIGRATION (POST-INIT)
  try {
    const migrated2 = __bp_migrateProjectAssets({ project: store.get("project"), app: store.get("app") });
    store.set("project", migrated2.project);
    store.set("app", migrated2.app);
    if (DEV) console.log("[loader] migrate projectAssets (POST-INIT):", migrated2?.report?.chosenFrom);
  } catch (e) {
    console.warn("[loader] migrate projectAssets (POST-INIT) failed (non-fatal)", e);
  }

  const gate = createFeatureGate({ appMode: DEV ? "dev" : "prod", projectJson: projectJson || {} });

  let pack = null;
  let pluginManifests = [];
  try {
    const packUrl = new URL("./manifest-pack.json", window.location.href).toString();
    const r = await loadManifestPack(packUrl);
    pack = r.pack;
    pluginManifests = r.manifests;
  } catch (e) {
    console.warn("[loader] manifest-pack load failed (non-fatal):", e);
  }
  store.init("plugins", { pack: pack || null, manifests: pluginManifests || [] });

  let menuModel = [];
  try {
    menuModel = await buildMenuModel({ projectBaseUrl, uiConfig });
  } catch (e) {
    console.error("[loader] buildMenuModel FAILED:", e);
    menuModel = [];
  }

  try {
    const menuRoot = $("#menu");
    if (menuRoot) renderMenu({ rootEl: menuRoot, menuModel, bus });
  } catch (e) {
    console.error("[loader] renderMenu FAILED:", e);
    showFatalInView({ title: "FATAL: Menü konnte nicht gerendert werden", error: e });
  }

  bus.on("ui:menu:select", ({ moduleKey } = {}) => {
    if (!moduleKey) return;

    // PATCH_workarea_router_same_panel_guard_v8:
    // Auf iPhone/Safari ist ein unnötiges Unmount/Mount der Workarea teuer.
    // Wenn der Nutzer im Menü versehentlich/erneut das bereits aktive Panel
    // auswählt, darf switchView NICHT erneut laufen.
    if (currentPanel && currentPanelId && String(moduleKey) === String(currentPanelId)) {
      try { window.BP_CRASH_RECORDER?.log?.("loader:same-panel-select:ignored:v8", { panelId: currentPanelId, source: "ui:menu:select" }); } catch {}
      setActiveSubTitle(currentPanelId);
      return;
    }

    switchView(moduleKey);
  });

  bus.on("ui:navigate", (msg = {}) => {
    try {
      const panelId = msg.panel || msg.module || msg.moduleKey || msg.view || msg.id || "";
      if (!panelId) return;

      // PATCH_workarea_router_same_panel_guard_v8:
      // Gleiche Navigation ohne {force:true} ignorieren, damit die Workarea
      // bei Dock-/Tab-/Property-Aktionen nicht unnötig unmountet.
      if (currentPanel && currentPanelId && String(panelId) === String(currentPanelId) && msg.force !== true) {
        try { window.BP_CRASH_RECORDER?.log?.("loader:same-panel-select:ignored:v8", { panelId: currentPanelId, source: "ui:navigate" }); } catch {}
        setActiveSubTitle(currentPanelId);
        return;
      }

      const ctx = (msg.payload && "context" in msg.payload) ? msg.payload.context : msg.context;
      if (ctx !== undefined) {
        store.update("app", (app) => {
          app = app || {};
          app.ui = app.ui || {};
          app.ui.assetlab = app.ui.assetlab || {};
          app.ui.assetlab.context = ctx;
          return app;
        });
      }

      switchView(panelId);
    } catch (e) {
      console.error("[loader] ui:navigate failed", e);
    }
  });

  updateSnapshot(store);
  bus.on("cb:store:changed", () => updateSnapshot(store));

  let currentPanel = null;
  let currentPanelId = null;
  let _switchSeq = 0;

  async function switchView(moduleKey) {
    try {
      const seq = ++_switchSeq;
      setActiveSubTitle("(lädt...)");

      const panelId = String(moduleKey || "");

      // PATCH_workarea_router_same_panel_guard_v8:
      // Doppelte switchView-Aufrufe auf dasselbe aktive Panel sind gefährlich,
      // weil sie currentPanel.unmount() und danach mount() auslösen.
      if (currentPanel && currentPanelId && panelId && String(panelId) === String(currentPanelId)) {
        try { window.BP_CRASH_RECORDER?.log?.("loader:same-panel-switch:ignored:v8", { panelId: currentPanelId }); } catch {}
        setActiveSubTitle(currentPanelId);
        return;
      }

      const LEGACY_PANEL_MAP = {
        "projectPanel:workspace": "settings:workspace",
        "projectPanel:app_settings": "settings:app_settings"
      };
      const mappedPanelId = LEGACY_PANEL_MAP[panelId] || null;

      const factory =
        (typeof panels.get === "function" && panels.get(panelId)) ||
        (typeof panels.resolve === "function" && panels.resolve(panelId)) ||
        null;

      if (!factory && mappedPanelId) {
        const factory2 =
          (typeof panels.get === "function" && panels.get(mappedPanelId)) ||
          (typeof panels.resolve === "function" && panels.resolve(mappedPanelId)) ||
          null;
        if (factory2) return switchView(mappedPanelId);
      }

      if (!factory) {
        console.warn("[loader] missing panel factory:", panelId);
        renderMissingPanel({ store, panelId, moduleKey, reason: "PanelRegistry hat keinen Eintrag" });
        setActiveSubTitle(panelId);
        return;
      }

      if (seq !== _switchSeq) return;

      try {
        if (currentPanel && typeof currentPanel.unmount === "function") currentPanel.unmount();
      } catch (e) {
        console.warn("[loader] panel.unmount failed:", e);
      }

      if (seq !== _switchSeq) return;

      const view = $("#view");
      if (!view) return;
      view.innerHTML = "";

      const ctx = { bus, store, registry, gate, moduleKey, panelId, version: VERSION, rootEl: view };

      const panel = factory(ctx);

      // ✅ Mount mit Timeout-Guard
      if (panel && typeof panel.mount === "function") {
        const label = `panel.mount(${panelId})`;
        const mountPromise = (panel.mount.length >= 1) ? panel.mount(view) : panel.mount();
        await withTimeout(Promise.resolve(mountPromise), PANEL_MOUNT_TIMEOUT_MS, label);
      } else if (panel && typeof panel.render === "function") {
        panel.render(view);
      } else {
        view.textContent = `Panel Factory lieferte kein mount/render: ${panelId}`;
      }

      if (seq !== _switchSeq) {
        try { if (panel && typeof panel.unmount === "function") panel.unmount(); } catch {}
        return;
      }

      currentPanel = panel;
      currentPanelId = panelId;
      setActiveSubTitle(panelId);
    } catch (e) {
      console.error("[loader] switchView FAILED:", e);
      showFatalInView({
        title: "Panel hängt oder crashte beim Laden",
        error: e,
        extra:
          `Hinweis: Wenn das projectPanel:assetlab3d ist, lade zuerst Projekt→Assets und öffne AssetLab von dort.\n` +
          `TimeoutGuard: ${PANEL_MOUNT_TIMEOUT_MS}ms`
      });
      setActiveSubTitle("Fehler (Console)");
    }
  }

  // ✅ BOOT-GUARD: nicht in AssetLab3D booten
  const snapUi = (uiState && typeof uiState === "object") ? uiState : (store.get("ui") || null);
  const desiredKeyRaw = (snapUi && snapUi.activeModule) ? String(snapUi.activeModule) : "";
  const firstKey = menuModel?.[0]?.items?.[0]?.moduleKey || "projectPanel:general";

  let desiredKey = desiredKeyRaw || firstKey;
  if (/projectPanel:assetlab3d/i.test(desiredKey)) {
    desiredKey = "projectPanel:assets";
  }

  await switchView(desiredKey);

  // Optional: Debug-Zugriff im DEV (ändert nichts am Release-Verhalten)
  if (DEV) {
    globalThis.__BP_PERSISTOR__ = persistor;
  }

  return { bus, store, registry, panels, gate, switchView, VERSION };
}

/* ============================================================================
 * PUBLIC EXPORTS
 * ========================================================================== */

export async function startApp(opts = {}) {
  return await init(opts);
}

if (DEV) {
  globalThis.__BP_STARTAPP__ = startApp;
  globalThis.__BP_LOADER_VERSION__ = VERSION;
}
