/*
 * =====================================================================
 * DATEI: /core/workarea-assembly-insert-and-variant-panel.v1.js
 * VERSION: v1.1.0-single-fire-insert
 * STAND: 2026-05-18
 * PATCH: PATCH_workarea_assembly_insert_and_variant_panel_v1
 *
 * ZWECK:
 * - Fügt ein erstes Baugruppen-/Variantenfenster für die Workarea ein.
 * - Auswahl: Rollenbahn, Verschiebewagen, Heber, Rollenbogen.
 * - Auswahl: Varianten je Baugruppe.
 * - Vorschau: Stückliste und Ports.
 * - Einfügen: erzeugt eine assembly.instance und versucht sie robust an die
 *   vorhandene Workarea/App zu übergeben.
 *
 * DESIGN:
 * - Additiv und defensiv: Kein bestehender Code wird überschrieben.
 * - Wenn die echte Workarea-API noch anders heißt, wird trotzdem ein Event
 *   ausgelöst, damit spätere Module sauber daran andocken können.
 * - Auf iOS/Safari werden schwere Operationen vermieden.
 * =====================================================================
 */

import {
  ASSEMBLY_CATALOG,
  buildAssemblyInstance,
  getAssemblyTemplate,
  getAssemblyVariant,
  listAssemblyTemplates
} from "./workarea-assembly-catalog.v1.js";

// ---------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------

const VERSION = "v1.1.0-single-fire-insert";
const PATCH_NAME = "PATCH_workarea_assembly_insert_single_fire_v1";
const ROOT_ID = "bp-assembly-panel-root";
const STYLE_ID = "bp-assembly-panel-style";
const STORAGE_KEY = "baustellenplaner:assembly:last-selection:v1";

// ---------------------------------------------------------------------
// Logging / Crash Recorder Bridge
// ---------------------------------------------------------------------

function logEvent(type, detail = {}) {
  const payload = {
    panel: "workarea-assembly",
    version: VERSION,
    patch: PATCH_NAME,
    ...detail
  };

  try {
    window.dispatchEvent(new CustomEvent("bp:debug:event", { detail: { type, ...payload } }));
  } catch {
    // Debug-Events dürfen niemals die App stören.
  }

  try {
    if (window.__bpCrashRecorder?.log) window.__bpCrashRecorder.log(type, payload);
    else if (window.BaustellenplanerCrashRecorder?.log) window.BaustellenplanerCrashRecorder.log(type, payload);
  } catch {
    // Crash Recorder ist optional.
  }

  // Bewusst kein console.log-Spam im Normalbetrieb.
}

// ---------------------------------------------------------------------
// App-/Workarea-Adapter – Single-Fire v1
// ---------------------------------------------------------------------

function makeInsertTxId() {
  return `asm-tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Zentraler Insert-Versuch ab PATCH_workarea_assembly_insert_single_fire_v1.
 *
 * WICHTIG:
 * - Vorher hat dieses Panel mehrere kompatible Events + direkte Fallbacks
 *   ausgelöst. Dadurch konnte ein einziger Klick mehrere Inserts erzeugen.
 * - Jetzt gibt es exakt EINEN kanonischen Window-Event pro Klick.
 * - WorkareaPanel.js ist der einzige Empfänger und entscheidet dort über
 *   Persistenz, Rendern, Save und Duplicate-Guards.
 */
function insertAssemblyInstance(instance) {
  const txId = makeInsertTxId();

  try {
    instance.meta = instance.meta && typeof instance.meta === "object" ? instance.meta : {};
    instance.meta.insertTxId = txId;
    instance.meta.insertPatch = PATCH_NAME;
  } catch {
    // Instanz ist normalerweise JSON-safe; falls nicht, trotzdem Event versuchen.
  }

  const detail = {
    schema: "baustellenplaner.workarea.assemblyInsert.request.v1",
    source: "assembly-panel",
    patch: PATCH_NAME,
    version: VERSION,
    txId,
    object: instance
  };

  let emitted = false;
  try {
    window.dispatchEvent(new CustomEvent("workarea:assembly-insert:request", { detail }));
    emitted = true;
  } catch (err) {
    logEvent("workarea:assembly-insert:dispatch-error", {
      id: instance?.id || null,
      txId,
      message: String(err?.message || err)
    });
  }

  logEvent("workarea:assembly-insert:request", {
    id: instance?.id || null,
    txId,
    templateId: instance?.templateId,
    variantId: instance?.variantId,
    emitted
  });

  return { direct: false, emitted, txId };
}

// ---------------------------------------------------------------------
// UI-Styles
// ---------------------------------------------------------------------

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --bp-asm-bg: rgba(18, 22, 30, 0.96);
      --bp-asm-panel: rgba(28, 34, 45, 0.98);
      --bp-asm-border: rgba(255,255,255,0.16);
      --bp-asm-text: #f5f7fb;
      --bp-asm-muted: rgba(245,247,251,0.72);
      --bp-asm-accent: #77a7ff;
      --bp-asm-good: #7ce38b;
      --bp-asm-warn: #ffd37a;
      --bp-asm-shadow: 0 18px 48px rgba(0,0,0,0.35);
    }

    #${ROOT_ID} {
      position: fixed;
      z-index: 99999;
      left: max(10px, env(safe-area-inset-left));
      bottom: max(10px, env(safe-area-inset-bottom));
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--bp-asm-text);
      pointer-events: none;
    }

    .bp-asm-toggle {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 42px;
      padding: 10px 14px;
      border-radius: 14px;
      border: 1px solid var(--bp-asm-border);
      background: var(--bp-asm-bg);
      color: var(--bp-asm-text);
      box-shadow: var(--bp-asm-shadow);
      font-weight: 700;
      letter-spacing: 0.01em;
      touch-action: manipulation;
    }

    .bp-asm-panel {
      pointer-events: auto;
      display: none;
      width: min(420px, calc(100vw - 20px));
      max-height: min(76vh, 720px);
      overflow: auto;
      margin-bottom: 10px;
      border-radius: 18px;
      border: 1px solid var(--bp-asm-border);
      background: var(--bp-asm-panel);
      box-shadow: var(--bp-asm-shadow);
      -webkit-overflow-scrolling: touch;
    }

    .bp-asm-panel.is-open { display: block; }

    .bp-asm-head {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 14px;
      border-bottom: 1px solid var(--bp-asm-border);
      background: rgba(28, 34, 45, 0.98);
      backdrop-filter: blur(10px);
    }

    .bp-asm-title { font-weight: 800; font-size: 15px; }
    .bp-asm-subtitle { font-size: 12px; color: var(--bp-asm-muted); margin-top: 2px; }

    .bp-asm-close,
    .bp-asm-action,
    .bp-asm-template,
    .bp-asm-variant {
      border: 1px solid var(--bp-asm-border);
      background: rgba(255,255,255,0.06);
      color: var(--bp-asm-text);
      border-radius: 12px;
      touch-action: manipulation;
    }

    .bp-asm-close { width: 38px; height: 38px; font-size: 18px; }

    .bp-asm-body { padding: 12px; display: grid; gap: 12px; }
    .bp-asm-section { display: grid; gap: 8px; }
    .bp-asm-section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--bp-asm-muted); }

    .bp-asm-template-list,
    .bp-asm-variant-list { display: grid; gap: 8px; }

    .bp-asm-template,
    .bp-asm-variant {
      text-align: left;
      padding: 10px;
      display: grid;
      gap: 4px;
    }

    .bp-asm-template.is-active,
    .bp-asm-variant.is-active {
      outline: 2px solid var(--bp-asm-accent);
      background: rgba(119,167,255,0.16);
    }

    .bp-asm-row { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
    .bp-asm-main { font-weight: 750; }
    .bp-asm-desc { font-size: 12px; color: var(--bp-asm-muted); line-height: 1.35; }
    .bp-asm-badge { font-size: 11px; color: #111; background: var(--bp-asm-warn); padding: 2px 6px; border-radius: 999px; font-weight: 800; }

    .bp-asm-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .bp-asm-field { display: grid; gap: 4px; }
    .bp-asm-field label { font-size: 11px; color: var(--bp-asm-muted); }
    .bp-asm-field input,
    .bp-asm-field select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--bp-asm-border);
      background: rgba(0,0,0,0.18);
      color: var(--bp-asm-text);
      border-radius: 10px;
      min-height: 36px;
      padding: 8px;
    }

    .bp-asm-bom,
    .bp-asm-ports {
      display: grid;
      gap: 6px;
      font-size: 12px;
    }

    .bp-asm-line {
      display: grid;
      grid-template-columns: 42px 1fr auto;
      gap: 8px;
      align-items: center;
      padding: 7px 8px;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      background: rgba(255,255,255,0.04);
    }

    .bp-asm-port {
      display: grid;
      grid-template-columns: 76px 1fr;
      gap: 8px;
      align-items: center;
      padding: 7px 8px;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      background: rgba(255,255,255,0.04);
    }

    .bp-asm-footer {
      position: sticky;
      bottom: 0;
      display: grid;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--bp-asm-border);
      background: rgba(28, 34, 45, 0.98);
      backdrop-filter: blur(10px);
    }

    .bp-asm-action {
      min-height: 44px;
      font-weight: 800;
      background: rgba(124,227,139,0.18);
      border-color: rgba(124,227,139,0.45);
    }

    .bp-asm-status { font-size: 12px; color: var(--bp-asm-muted); min-height: 18px; }

    @media (max-width: 520px) {
      .bp-asm-fields { grid-template-columns: 1fr; }
      #${ROOT_ID} { right: max(10px, env(safe-area-inset-right)); }
      .bp-asm-panel { width: calc(100vw - 20px); max-height: 74vh; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------
// UI-Erzeugung
// ---------------------------------------------------------------------

function loadSelection() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveSelection(selection) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // optional
  }
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function renderPanel(root) {
  const templates = listAssemblyTemplates();
  const saved = loadSelection();
  let selectedTemplateId = saved.templateId || templates[0]?.id;
  let selectedVariantId = saved.variantId || getAssemblyTemplate(selectedTemplateId)?.variants?.[0]?.id;

  root.innerHTML = "";

  const panel = createEl("div", "bp-asm-panel");
  const toggle = createEl("button", "bp-asm-toggle", "▦ Baugruppen");
  toggle.type = "button";

  const head = createEl("div", "bp-asm-head");
  const titleBox = createEl("div");
  titleBox.appendChild(createEl("div", "bp-asm-title", "Baugruppe einfügen"));
  titleBox.appendChild(createEl("div", "bp-asm-subtitle", "Master + Variante + Stückliste + Ports"));
  const close = createEl("button", "bp-asm-close", "×");
  close.type = "button";
  head.append(titleBox, close);

  const body = createEl("div", "bp-asm-body");
  const footer = createEl("div", "bp-asm-footer");
  const status = createEl("div", "bp-asm-status", "Bereit.");
  const insertBtn = createEl("button", "bp-asm-action", "In Workarea einfügen");
  insertBtn.type = "button";

  function update() {
    const template = getAssemblyTemplate(selectedTemplateId) || templates[0];
    if (!template) return;
    const variant = getAssemblyVariant(template.id, selectedVariantId) || template.variants[0];
    selectedTemplateId = template.id;
    selectedVariantId = variant.id;
    saveSelection({ templateId: selectedTemplateId, variantId: selectedVariantId });

    body.innerHTML = "";

    // Template-Auswahl --------------------------------------------------
    const templateSection = createEl("section", "bp-asm-section");
    templateSection.appendChild(createEl("div", "bp-asm-section-title", "1. Baugruppe"));
    const templateList = createEl("div", "bp-asm-template-list");

    for (const t of templates) {
      const btn = createEl("button", `bp-asm-template ${t.id === selectedTemplateId ? "is-active" : ""}`);
      btn.type = "button";
      btn.innerHTML = `
        <div class="bp-asm-row">
          <span class="bp-asm-main">${escapeHtml(t.icon || "▦")} ${escapeHtml(t.title)}</span>
          <span class="bp-asm-badge">${escapeHtml(t.group || "")}</span>
        </div>
        <div class="bp-asm-desc">${escapeHtml(t.description || "")}</div>
      `;
      btn.addEventListener("click", () => {
        selectedTemplateId = t.id;
        selectedVariantId = t.variants?.[0]?.id;
        update();
      });
      templateList.appendChild(btn);
    }
    templateSection.appendChild(templateList);
    body.appendChild(templateSection);

    // Varianten-Auswahl -------------------------------------------------
    const variantSection = createEl("section", "bp-asm-section");
    variantSection.appendChild(createEl("div", "bp-asm-section-title", "2. Variante"));
    const variantList = createEl("div", "bp-asm-variant-list");

    for (const v of template.variants || []) {
      const btn = createEl("button", `bp-asm-variant ${v.id === selectedVariantId ? "is-active" : ""}`);
      btn.type = "button";
      btn.innerHTML = `
        <div class="bp-asm-row">
          <span class="bp-asm-main">${escapeHtml(v.title)}</span>
          <span class="bp-asm-badge">${escapeHtml(v.badge || "VAR")}</span>
        </div>
        <div class="bp-asm-desc">${escapeHtml(v.description || "")}</div>
      `;
      btn.addEventListener("click", () => {
        selectedVariantId = v.id;
        update();
      });
      variantList.appendChild(btn);
    }
    variantSection.appendChild(variantList);
    body.appendChild(variantSection);

    // Konfigurationsfelder ---------------------------------------------
    const fieldsSection = createEl("section", "bp-asm-section");
    fieldsSection.appendChild(createEl("div", "bp-asm-section-title", "3. Grunddaten"));
    const fields = createEl("div", "bp-asm-fields");
    const mergedConfig = { ...(template.defaultConfig || {}), ...(variant.patchConfig || {}) };

    fields.appendChild(makeInput("Name", "asm-name", mergedConfig.name || template.shortTitle || template.title));
    fields.appendChild(makeInput("Bereich", "asm-area", mergedConfig.area || "+A"));
    fields.appendChild(makeInput("Fördergruppe", "asm-fg", mergedConfig.conveyorGroup || "FG-0000"));
    fields.appendChild(makeInput("Skalierung", "asm-scale", mergedConfig.scale || 1, "number", "0.1"));
    fields.appendChild(makeInput("Länge mm", "asm-length", mergedConfig.lengthMm || template.defaultSize?.w || 1000, "number", "50"));
    fields.appendChild(makeInput("Breite mm", "asm-width", mergedConfig.widthMm || template.defaultSize?.h || 1000, "number", "50"));
    fieldsSection.appendChild(fields);
    body.appendChild(fieldsSection);

    // Stückliste --------------------------------------------------------
    const bomSection = createEl("section", "bp-asm-section");
    bomSection.appendChild(createEl("div", "bp-asm-section-title", "4. Stückliste Vorschau"));
    const bom = createEl("div", "bp-asm-bom");
    for (const line of variant.bom || []) {
      const row = createEl("div", "bp-asm-line");
      row.innerHTML = `
        <strong>${escapeHtml(String(line.qty ?? 1))} ${escapeHtml(line.unit || "")}</strong>
        <span>${escapeHtml(line.title || line.code || "")}</span>
        <small>${escapeHtml(line.group || "")}</small>
      `;
      bom.appendChild(row);
    }
    if (!variant.bom?.length) bom.appendChild(createEl("div", "bp-asm-desc", "Keine Stücklistenpositionen hinterlegt."));
    bomSection.appendChild(bom);
    body.appendChild(bomSection);

    // Ports -------------------------------------------------------------
    const portSection = createEl("section", "bp-asm-section");
    portSection.appendChild(createEl("div", "bp-asm-section-title", "5. Anschlussports Vorbereitung"));
    const ports = createEl("div", "bp-asm-ports");
    for (const port of template.ports || []) {
      const row = createEl("div", "bp-asm-port");
      row.innerHTML = `<strong>${escapeHtml(port.kind || "port")}</strong><span>${escapeHtml(port.title || port.id)}</span>`;
      ports.appendChild(row);
    }
    if (!template.ports?.length) ports.appendChild(createEl("div", "bp-asm-desc", "Für diese Baugruppe sind noch keine Ports hinterlegt."));
    portSection.appendChild(ports);
    body.appendChild(portSection);
  }

  insertBtn.addEventListener("click", () => {
    try {
      const template = getAssemblyTemplate(selectedTemplateId);
      const variant = getAssemblyVariant(selectedTemplateId, selectedVariantId);
      if (!template || !variant) throw new Error("Keine gültige Baugruppe gewählt.");

      const config = {
        name: document.getElementById("asm-name")?.value || template.shortTitle || template.title,
        area: document.getElementById("asm-area")?.value || "+A",
        conveyorGroup: document.getElementById("asm-fg")?.value || "FG-0000",
        scale: Number(document.getElementById("asm-scale")?.value || 1),
        lengthMm: Number(document.getElementById("asm-length")?.value || template.defaultSize?.w || 1000),
        widthMm: Number(document.getElementById("asm-width")?.value || template.defaultSize?.h || 1000)
      };

      const instance = buildAssemblyInstance({
        templateId: selectedTemplateId,
        variantId: selectedVariantId,
        x: 0,
        y: 0,
        rotation: 0,
        config
      });

      const result = insertAssemblyInstance(instance);
      status.textContent = result.direct
        ? `Eingefügt: ${instance.name}`
        : `Übergeben/gespeichert: ${instance.name}`;
    } catch (err) {
      status.textContent = `Fehler: ${String(err?.message || err)}`;
      logEvent("workarea:assembly:insert-error", { message: String(err?.message || err) });
    }
  });

  toggle.addEventListener("click", () => {
    panel.classList.toggle("is-open");
    logEvent("workarea:assembly:panel-toggle", { open: panel.classList.contains("is-open") });
  });

  close.addEventListener("click", () => panel.classList.remove("is-open"));

  footer.append(insertBtn, status);
  panel.append(head, body, footer);
  root.append(panel, toggle);

  update();
}

function makeInput(labelText, id, value, type = "text", step) {
  const wrap = createEl("div", "bp-asm-field");
  const label = createEl("label", "", labelText);
  label.setAttribute("for", id);
  const input = document.createElement("input");
  input.id = id;
  input.type = type;
  input.value = value ?? "";
  if (step) input.step = step;
  wrap.append(label, input);
  return wrap;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------------------------------------------------------------------
// Installation
// ---------------------------------------------------------------------

export function installWorkareaAssemblyPanel() {
  if (document.getElementById(ROOT_ID)) return;
  ensureStyles();

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("data-version", VERSION);
  document.body.appendChild(root);

  renderPanel(root);

  // Katalog/API global bereitstellen, damit Debugger und spätere Module
  // darauf zugreifen können.
  window.BPAssemblyPatch = {
    version: VERSION,
    catalog: ASSEMBLY_CATALOG,
    buildAssemblyInstance,
    insertAssemblyInstance,
    listAssemblyTemplates
  };

  logEvent("workarea:assembly-panel:ready", {
    templates: ASSEMBLY_CATALOG.templates.length,
    catalogVersion: ASSEMBLY_CATALOG.version
  });
}

function bootWhenReady() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installWorkareaAssemblyPanel, { once: true });
  } else {
    installWorkareaAssemblyPanel();
  }
}

bootWhenReady();
