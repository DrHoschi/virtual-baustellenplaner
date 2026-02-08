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
import { loadManifestPack } from "./manifest-pack.js";

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
async function init() {
  // --- Debug: Version in Konsole
  console.log(`[loader] ${VERSION}`);

  // --- Core Instanzen
  const bus = createBus();
  const store = createStore(bus);
  const registry = createRegistry(bus, store);
  const panels = createPanelRegistry();

  // --- FeatureGate / Manifeste laden (defensiv)
  const gate = createFeatureGate({ store, registry });

  let manifestPack = null;
  try {
    manifestPack = await loadManifestPack({ registry, gate, bus, store });
  } catch (e) {
    // Manifest-Loading darf nicht "stumm" sterben
    console.error("[loader] loadManifestPack FAILED:", e);
    showFatalInView({
      title: "FATAL: manifest-pack konnte nicht geladen werden",
      error: e,
      extra: "Prüfe Pfade/Cachebuster und ob manifest-pack.js korrekt exportiert."
    });
  }

  // --- Menü-Modell aus Registry/Manifest bauen
  let menuModel = [];
  try {
    // Wenn registry eine Funktion liefert – nutzen.
    if (typeof registry.buildMenuModel === "function") {
      menuModel = registry.buildMenuModel();
    } else if (manifestPack?.menuModel) {
      menuModel = manifestPack.menuModel;
    } else if (registry?.menuModel) {
      menuModel = registry.menuModel;
    } else {
      // Fallback: leeres Menü, aber UI darf nicht crashen.
      menuModel = [];
    }
  } catch (e) {
    console.error("[loader] menuModel build FAILED:", e);
    menuModel = [];
  }

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

      // 1) Modul im Registry finden (dein Registry-Design kann variieren)
      let hit = null;
      if (typeof registry.getModuleByKey === "function") hit = registry.getModuleByKey(moduleKey);
      else if (typeof registry.get === "function") hit = registry.get(moduleKey);
      else if (registry?.modules?.[moduleKey]) hit = registry.modules[moduleKey];

      // 2) panelId herausfinden
      const panelId =
        hit?.panelId ||
        hit?.panel ||
        hit?.panelKey ||
        hit?.view ||
        hit?.mount ||
        null;

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
  return { bus, store, registry, panels, gate, manifestPack, switchView, VERSION };
}

/* ============================================================================
 * PUBLIC EXPORTS (für index.html + Tests)
 * ========================================================================== */

/**
 * startApp() ist der Entry-Point, den index.html importiert.
 * Playwright erwartet, dass dieser Export existiert.
 */
export async function startApp() {
  return await init();
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
