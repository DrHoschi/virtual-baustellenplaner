// core/loader.js
// Version: v2.0.0-loader-stable (2026-02-08)
//
// ZIEL
// - App-Boot robust machen (CI + GitHub Pages + lokal).
// - Menü/Views dürfen NICHT mehr am Loader crashen.
// - currentSettings MUSS immer existieren (sonst bricht UI-Mount).
// - startApp MUSS exportiert sein (index.html importiert das).
//
// HINWEIS ZU PFADEN
// - Diese Datei liegt in /core/loader.js
// - UI liegt in /ui/...
// - App-Services (bus/store/registry) liegen in /app/...
//
// Wenn deine Repo-Struktur anders ist, musst du NUR diese 4 Imports anpassen.
// (Der Rest ist absichtlich API-tolerant.)

import * as BusMod from "../app/bus.js";
import * as StoreMod from "../app/store.js";
import * as RegistryMod from "../app/registry.js";
import * as MountUIMod from "../ui/mount-ui.js";

/* ========================================================================== */
/* Helpers                                                                     */
/* ========================================================================== */

function $(sel) {
  return document.querySelector(sel);
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function setActive(text) {
  const el = $("#active");
  if (el) el.textContent = text;
}

/**
 * Schreibt einen sichtbaren Fehler in die UI (damit man NICHT im "lädt..." hängt).
 */
function showFatal(where, err) {
  console.error(`[LOADER:FATAL] ${where}`, err);

  const msg =
    `FEHLER im Loader (${where})\n` +
    `${err?.name || "Error"}: ${err?.message || String(err)}`;

  setActive(msg);

  // Optional: einfacher Fehlerblock im #view, falls vorhanden.
  const view = $("#view");
  if (view) {
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.padding = "12px";
    pre.style.border = "1px solid #f88";
    pre.style.background = "rgba(255,0,0,0.06)";
    pre.textContent = msg + (err?.stack ? `\n\n${err.stack}` : "");
    view.innerHTML = "";
    view.appendChild(pre);
  }
}

/* ========================================================================== */
/* Settings (WICHTIG: currentSettings darf nie undefined sein)                  */
/* ========================================================================== */

/**
 * Minimal-Defaults – du kannst später erweitern.
 * Wichtig ist nur: currentSettings existiert, sonst crashen Panels.
 */
const DEFAULT_SETTINGS = {
  ui: {
    // Beispiel: Theme / Layout / Skalierung
    theme: "default",
    scale: 1,
  },
  dev: {
    debug: true,
  },
};

/**
 * Lädt Settings aus localStorage, falls vorhanden.
 * Key bewusst generisch gehalten.
 */
function loadCurrentSettings() {
  const raw = localStorage.getItem("bp:settings");
  const parsed = raw ? safeJsonParse(raw, null) : null;

  // Merge: Defaults + gespeicherte Werte
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(parsed && typeof parsed === "object" ? parsed : {}),
    ui: {
      ...DEFAULT_SETTINGS.ui,
      ...(parsed?.ui && typeof parsed.ui === "object" ? parsed.ui : {}),
    },
    dev: {
      ...DEFAULT_SETTINGS.dev,
      ...(parsed?.dev && typeof parsed.dev === "object" ? parsed.dev : {}),
    },
  };

  return settings;
}

function saveCurrentSettings(settings) {
  try {
    localStorage.setItem("bp:settings", JSON.stringify(settings));
  } catch (e) {
    console.warn("[LOADER] Konnte Settings nicht speichern:", e);
  }
}

/* ========================================================================== */
/* Resolve module APIs (named vs default export)                               */
/* ========================================================================== */

function resolveFactory(mod, names) {
  for (const n of names) {
    if (typeof mod?.[n] === "function") return mod[n];
  }
  // Fallback: default export als function
  if (typeof mod?.default === "function") return mod.default;
  return null;
}

/* ========================================================================== */
/* App Context bauen                                                           */
/* ========================================================================== */

function createAppContext() {
  // createBus / createStore / createRegistry sind je nach Repo ggf. anders benannt.
  const createBus = resolveFactory(BusMod, ["createBus", "makeBus", "Bus"]);
  const createStore = resolveFactory(StoreMod, ["createStore", "makeStore", "Store"]);
  const createRegistry = resolveFactory(RegistryMod, ["createRegistry", "makeRegistry", "Registry"]);

  if (!createBus) throw new Error("app/bus.js: keine createBus/makeBus/default()-Factory gefunden");
  if (!createStore) throw new Error("app/store.js: keine createStore/makeStore/default()-Factory gefunden");
  if (!createRegistry) throw new Error("app/registry.js: keine createRegistry/makeRegistry/default()-Factory gefunden");

  const bus = createBus();
  const store = createStore();
  const registry = createRegistry();

  return { bus, store, registry };
}

/* ========================================================================== */
/* startApp                                                                    */
/* ========================================================================== */

/**
 * startApp wird von index.html importiert und gestartet.
 * Diese Funktion MUSS existieren und exportiert sein.
 */
export async function startApp() {
  try {
    setActive("(lädt...)");

    // 1) Settings laden (KRITISCH: currentSettings definieren)
    const currentSettings = loadCurrentSettings();

    // GLOBAL verfügbar machen, damit Panels/Tools nicht crashen.
    // (Genau DAS hat dir heute den ganzen Tag alles zerlegt.)
    globalThis.currentSettings = currentSettings;

    // Optional: kleine Save-API global (praktisch fürs Debuggen)
    globalThis.__bpSaveSettings = () => saveCurrentSettings(globalThis.currentSettings);

    // 2) Core Context
    const ctx = createAppContext();

    // Auch global verfügbar machen (hilft bei Debug & Inspector)
    globalThis.__bp = {
      ...ctx,
      currentSettings,
    };

    // 3) Registry initialisieren (wenn API vorhanden)
    // (Wir prüfen defensiv, damit es nicht an "init()" vs "loadAll()" scheitert.)
    if (typeof ctx.registry?.init === "function") {
      await ctx.registry.init(ctx);
    } else if (typeof ctx.registry?.loadAll === "function") {
      await ctx.registry.loadAll(ctx);
    }

    // 4) UI mounten
    const mountUI = resolveFactory(MountUIMod, ["mountUI", "mount"]);
    if (!mountUI) {
      throw new Error("ui/mount-ui.js: keine mountUI/mount/default()-Funktion gefunden");
    }

    // DOM-Handles (falls mount-ui das nutzt)
    const dom = {
      app: $("#app") || document.body,
      menu: $("#menu"),
      view: $("#view"),
      active: $("#active"),
    };

    // mountUI darf extra args ignorieren – JS ist tolerant.
    await mountUI(ctx, dom, currentSettings);

    // 5) Boot fertig
    setActive("OK");

  } catch (err) {
    showFatal("startApp()", err);
    throw err; // wichtig für CI: Test soll “rot” werden, nicht still hängen
  }
}

/* ========================================================================== */
/* Auto-Start (optional)                                                       */
/* ========================================================================== */

/**
 * Wenn du startApp schon in index.html explizit aufrufst, kannst du das hier
 * deaktivieren. Ich lasse es drin, weil es “idiotensicher” ist:
 * - Wenn index.html vergisst zu starten → App startet trotzdem.
 * - Wenn index.html schon startet → wird durch Guard verhindert.
 */
if (typeof window !== "undefined") {
  // Guard gegen Doppelstart
  if (!window.__bpLoaderStarted) {
    window.__bpLoaderStarted = true;

    // NICHT awaiten – Browser soll rendern können.
    startApp();
  }
}
