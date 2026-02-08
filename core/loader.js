/**
 * Baustellenplaner – Core Loader / App Bootstrap
 * Datei: core/loader.js
 * Version: v1.1.2-loader-fix (2026-02-08)
 *
 * WICHTIG (Warum dieser Patch):
 * - In deinem CI/Playwright-Test wird `startApp` aus `./core/loader.js` importiert.
 *   In deinem aktuellen Stand wurde aber zwar eine `init()` gebaut, jedoch NICHT exportiert.
 *   => Ergebnis: "does not provide an export named 'startApp'"
 *
 * - Zusätzlich ist bei einem "Fallback-Panel" `currentSettings` verwendet worden,
 *   ohne dass die Variable existiert => ReferenceError.
 *
 * Ziele dieses Patches:
 * 1) `startApp` sauber exportieren (und optional auch auto-starten, falls gewünscht).
 * 2) Fallback-Panels dürfen NIE mehr crashen – sie sollen nur Debug-Infos anzeigen.
 * 3) Bei fehlenden Panels/Imports: klare Fehleranzeige im UI, damit du sofort siehst,
 *    welches Panel/Plugin fehlt (statt "lädt..." oder stille Fehler).
 *
 * HINWEIS:
 * - Dieser Loader ist bewusst defensiv: ein fehlendes Panel soll die App nicht killen.
 * - Debug/Checker bleiben drin.
 */

/* ============================================================================
 * IMPORTS
 * ========================================================================== */

import { createBus } from "../app/bus.js";
import { createStore } from "../app/store.js";
import { createRegistry } from "../app/registry.js";

import { createFeatureGate } from "./featureGate.js";
import packManifest from "../manifest-pack.json" assert { type: "json" };

// Menü-Registry (Tabs/Anker) – wird als „Quelle der Wahrheit“ für die UI genutzt.
import menuRegistry from "../menu.registry.json" assert { type: "json" };

import { renderMenu } from "../app/ui/menu.js";
import { createPanelRegistry } from "../ui/panels/panel-registry.js";

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const VERSION = "v1.1.2-loader-fix (2026-02-08)";
const DEV = (() => {
  try { return !!(globalThis?.location && /localhost|127\.0\.0\.1/i.test(globalThis.location.host)); }
  catch { return false; }
})();

/* ============================================================================
 * HELPERS (defensiv, kein Crash)
 * ========================================================================== */

function $(sel) {
  return document.querySelector(sel);
}

function setActiveSubTitle(text) {
  const el = $("#active");
  if (el) el.textContent = text;
}

function safeStringify(v) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

function getSettingsSnapshot(store) {
  // Wir wissen nicht 100% welche Store-API du final nutzt. Daher defensiv:
  try {
    if (!store) return {};
    if (typeof store.get === "function") {
      return store.get("settings") ?? store.get("ui") ?? store.get("config") ?? {};
    }
    if (typeof store.snapshot === "function") {
      const snap = store.snapshot();
      return snap?.settings ?? snap?.ui ?? snap?.config ?? snap ?? {};
    }
    return store.state?.settings ?? store.state?.ui ?? store.state?.config ?? {};
  } catch {
    return {};
  }
}

/** Kleine UI-Fehlerbox (statt stiller Fehler) */
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

/* ============================================================================
 * PANEL FALLBACK – wenn Registry/Imports nicht stimmen
 * ========================================================================== */

function renderMissingPanel({ store, panelId, pluginId, moduleKey, reason }) {
  const view = $("#view");
  if (!view) return;

  const currentSettings = getSettingsSnapshot(store);

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
    `<b>pluginId:</b> ${pluginId || "-"}<br>` +
    `<b>panelId:</b> ${panelId || "-"}<br>` +
    (reason ? `<b>Grund:</b> ${reason}<br>` : "");
  box.appendChild(p);

  if (DEV) {
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.marginTop = "10px";
    pre.textContent =
      "Aktuelle Settings (Snapshot):\n" +
      safeStringify(currentSettings);
    box.appendChild(pre);
  } else {
    const hint = document.createElement("div");
    hint.style.marginTop = "10px";
    hint.textContent =
      "Tipp: Im CI/Trace siehst du in console.txt meistens den echten Import- oder Runtime-Fehler.";
    box.appendChild(hint);
  }

  view.innerHTML = "";
  view.appendChild(box);
}

/* ============================================================================
 * CORE BOOTSTRAP
 * ========================================================================== */

/**
 * init() baut Bus/Store/Registry/PanelRegistry und verbindet Menü + View-Switch.
 * Diese Funktion wird jetzt von startApp() genutzt.
 */
async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`loadJson: ${res.status} ${res.statusText} (${url})`);
  return await res.json();
}

function dirname(path) {
  const s = String(path || "");
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(0, i) : ".";
}

function joinPath(a, b) {
  const A = String(a || "").replace(/\/+$/, "");
  const B = String(b || "").replace(/^\/+/, "");
  return A ? `${A}/${B}` : B;
}

async function tryLoadJson(url, fallback = null) {
  try { return await loadJson(url); } catch { return fallback; }
}

function deepMerge(target, source) {
  if (!source || typeof source !== "object") return target;
  if (!target || typeof target !== "object") return source;
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      target[k] = deepMerge(target[k] && typeof target[k] === "object" ? target[k] : {}, v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

/**
 * init() baut Bus/Store/Registry/PanelRegistry und verbindet Menü + View-Switch.
 * WICHTIG: In diesem Backup ist "projectPath" der zentrale Startpunkt.
 */
async function init({ projectPath = "./projects/P-2026-0001/project.json", resetUIState = true } = {}) {
  // --- Debug: Version in Konsole
  console.log(`[loader] ${VERSION}`);

  // --- Core Instanzen
  const bus = createBus();

  // FIX: createStore erwartet { bus }, nicht bus direkt.
  const store = createStore({ bus });

  // Registry ist in diesem Stand noch leichtgewichtig. Wir nutzen sie als Container,
  // aber die UI wird minimal über menu.registry.json gebaut, damit nichts "leer" bleibt.
  const registry = createRegistry();
  const panels = createPanelRegistry();

  // --- FeatureGate / Manifeste laden (defensiv)
  const gate = createFeatureGate({ store, registry });

  // ------------------------------------------------------------------------
  // 1) Projekt + UI Config/State laden (damit Panels Daten haben)
  // ------------------------------------------------------------------------
  let project = null;
  try {
    project = await loadJson(projectPath);
  } catch (e) {
    console.error("[loader] project load FAILED:", e);
    showFatalInView({
      title: "FATAL: project.json konnte nicht geladen werden",
      error: e,
      extra: `projectPath=${projectPath}`
    });
  }

  const projectDir = dirname(projectPath);
  const uiConfig = await tryLoadJson(joinPath(projectDir, "ui/ui.config.json"), null);
  const uiStateFile = await tryLoadJson(joinPath(projectDir, "ui/ui.state.json"), null);

  // ------------------------------------------------------------------------
  // 2) Defaults sauber reinmischen (damit "Allgemein / Assets" nicht leer sind)
  // ------------------------------------------------------------------------
  const defaultsGeneral = await tryLoadJson("./defaults/projectSettings.general.json", {});
  const defaultsAssets = await tryLoadJson("./defaults/projectSettings.assets.json", {});
  const defaultsWorkspace = await tryLoadJson("./defaults/projectSettings.workspace.json", {});
  const defaultsLibraries = await tryLoadJson("./defaults/projectSettings.libraries.json", {});
  const defaultsPalette = await tryLoadJson("./defaults/projectSettings.palette.json", {});
  const defaultsPlugins = await tryLoadJson("./defaults/projectSettings.plugins.json", {});
  const defaultsVersions = await tryLoadJson("./defaults/projectSettings.versions.json", {});
  const defaultsLicense = await tryLoadJson("./defaults/projectSettings.license.json", {});

  const mergedSettings = {};
  deepMerge(mergedSettings, defaultsGeneral);
  deepMerge(mergedSettings, defaultsAssets);
  deepMerge(mergedSettings, defaultsWorkspace);
  deepMerge(mergedSettings, defaultsLibraries);
  deepMerge(mergedSettings, defaultsPalette);
  deepMerge(mergedSettings, defaultsPlugins);
  deepMerge(mergedSettings, defaultsVersions);
  deepMerge(mergedSettings, defaultsLicense);

  // ------------------------------------------------------------------------
  // 3) UI-State Reset (Minimal Patch): Damit Wizard/Projektliste wieder sichtbar
  // ------------------------------------------------------------------------
  const effectiveUIState = (() => {
    const base = (uiStateFile && typeof uiStateFile === "object") ? uiStateFile : {};
    if (!resetUIState) return base;
    // Sehr bewusst minimal: Schaltet Sidepanel an + startet auf Allgemein.
    return {
      ...base,
      window: { ...(base.window || {}), leftPanelOpen: true },
      // Wenn irgendein alter "activeModule" Mist ist, kommen wir wenigstens in ein Panel.
      activeModule: "projectPanel:general",
    };
  })();

  // Store initialisieren: Panels im Repo lesen in diesem Stand aus "app".
  store.init("app", {
    project: project || {},
    settings: mergedSettings || {},
    ui: {
      config: uiConfig || {},
      state: effectiveUIState || {},
      drafts: {},
    },
    meta: { pack: packManifest || {}, projectPath },
  });

  // Zusätzlich (für spätere Migration) auch die empfohlenen Keys bereitstellen.
  store.init("project", project || {});
  store.init("ui", { config: uiConfig || {}, state: effectiveUIState || {} });

  // ------------------------------------------------------------------------
  // 4) Menü-Modell bauen (minimal, aber stabil)
  //    Quelle: menu.registry.json (Tabs) + project/ui.config (Gruppen)
  // ------------------------------------------------------------------------
  const groups = Array.isArray(uiConfig?.groups) ? uiConfig.groups : [
    { key: "projekt", label: "Projekt", order: 1 },
    { key: "tools", label: "Tools", order: 99 },
  ];

  const groupByAnchor = {
    projectPanel: "projekt",
    topbar: "tools",
  };

  /** @type {Map<string, {key:string,label:string,order:number,items:any[]}>} */
  const groupMap = new Map(groups.map(g => [g.key, { ...g, items: [] }]));

  for (const e of (menuRegistry?.entries || [])) {
    if (!e?.anchor || !e?.tabId) continue;
    const gKey = groupByAnchor[e.anchor] || "tools";
    const g = groupMap.get(gKey) || groupMap.get("tools");
    if (!g) continue;

    // Wichtig: moduleKey = Panel-ID (Loader kann das direkt mounten)
    const panelId = `${e.anchor}:${e.tabId}`;
    g.items.push({
      moduleKey: panelId,
      label: e.title || e.tabId,
      icon: null,
      order: e.order ?? 999,
    });
  }

  for (const g of groupMap.values()) {
    g.items.sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.label).localeCompare(String(b.label)));
  }
  const menuModel = [...groupMap.values()].sort((a, b) => (a.order || 0) - (b.order || 0));

  // NOTE: menuModel ist oben bereits stabil gebaut.

  // --- Menü rendern
  try {
    const menuRoot = $("#menu");
    if (menuRoot) renderMenu({ rootEl: menuRoot, menuModel, bus });
  } catch (e) {
    console.error("[loader] renderMenu FAILED:", e);
    // Menü-Fehler anzeigen, damit du es siehst
    showFatalInView({ title: "FATAL: Menü konnte nicht gerendert werden", error: e });
  }

  // --- View Switch (Menu -> Panel)
  async function switchView(moduleKey) {
    try {
      setActiveSubTitle("(lädt...)");

      // Minimal-Fix: In diesem Stand ist moduleKey oft direkt eine Panel-ID
      // (z.B. "projectPanel:general"). Dann mounten wir ohne Registry-Lookup.
      const looksLikePanelId = typeof moduleKey === "string" && moduleKey.includes(":");

      // 1) Modul im Registry finden (dein Registry-Design kann variieren)
      let hit = null;
      if (typeof registry.getModuleByKey === "function") hit = registry.getModuleByKey(moduleKey);
      else if (typeof registry.get === "function") hit = registry.get(moduleKey);
      else if (registry?.modules?.[moduleKey]) hit = registry.modules[moduleKey];

      // 2) panelId herausfinden
      const panelId = (
        hit?.panelId ||
        hit?.panel ||
        hit?.panelKey ||
        hit?.view ||
        hit?.mount ||
        (looksLikePanelId ? moduleKey : null)
      );

      const pluginId = hit?.pluginId || hit?.plugin || hit?.id || null;

      // 3) Panel mounten (wenn registriert)
      const view = $("#view");
      if (!view) return;

      // Falls das Panel-Registry eine API hat:
      const panelFactory =
        (typeof panels.get === "function" ? panels.get(panelId) : null) ||
        (typeof panels.resolve === "function" ? panels.resolve(panelId) : null) ||
        null;

      if (!panelId || !panelFactory) {
        // Debug-Panel statt Crash
        renderMissingPanel({
          store,
          panelId,
          pluginId,
          moduleKey,
          reason: !panelId ? "Kein panelId im Registry-Eintrag" : "Panel nicht im PanelRegistry registriert"
        });
        setActiveSubTitle(panelId || moduleKey || "(unbekannt)");
        return;
      }

      // Panel mounten
      view.innerHTML = "";
      const api = await panelFactory.mount?.({ root: view, bus, store, registry, gate }) ??
                  await panelFactory?.({ root: view, bus, store, registry, gate });

      setActiveSubTitle(panelId);

      return api;
    } catch (e) {
      console.error("[loader] switchView FAILED:", e);
      showFatalInView({ title: `FATAL: switchView(${moduleKey})`, error: e });
    }
  }

  // --- Bus-Hook: Menü Klick
  bus.on?.("ui:menu:select", ({ moduleKey }) => switchView(moduleKey));
  bus.on?.("ui:menu:select", (payload) => {
    // Manche Bus-Implementierungen liefern nur payload ohne destructuring:
    if (payload?.moduleKey) switchView(payload.moduleKey);
  });

  // --- Initiale View
  // (wenn registry initialModule definiert, nutzen, sonst erstes Menü-Item)
  let initialKey = null;
  try {
    initialKey = registry.initialModuleKey?.() ?? registry.initialModuleKey ?? null;
  } catch {}
  if (!initialKey && menuModel?.[0]?.items?.[0]?.moduleKey) initialKey = menuModel[0].items[0].moduleKey;

  if (initialKey) {
    await switchView(initialKey);
  } else {
    setActiveSubTitle("(kein Modul)");
  }

  // --- API zurückgeben (für Debug/Tests)
  return { bus, store, registry, panels, gate, manifestPack: packManifest, switchView, VERSION };
}

/* ============================================================================
 * PUBLIC EXPORTS (für index.html + Tests)
 * ========================================================================== */

/**
 * startApp() ist der Entry-Point, den index.html importiert.
 * Playwright erwartet, dass dieser Export existiert.
 */
export async function startApp(opts = {}) {
  return await init(opts);
}

/**
 * Optional: Wenn du startApp NICHT manuell im index.html aufrufen willst,
 * kannst du den Auto-Start aktivieren. Im Moment lassen wir es AUS,
 * weil dein index.html es explizit aufruft.
 */
// if (typeof window !== "undefined") startApp();

/* Debug: Für Console-Handarbeit (nur Dev) */
if (DEV) {
  globalThis.__BP_STARTAPP__ = startApp;
  globalThis.__BP_LOADER_VERSION__ = VERSION;
}
