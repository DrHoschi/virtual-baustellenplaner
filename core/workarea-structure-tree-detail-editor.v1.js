/**
 * core/workarea-structure-tree-detail-editor.v1.js
 * Version: PATCH_workarea_structure_tree_detail_editor_v1 (2026-05-21)
 *
 * Zweck:
 * - Baut auf dem Strukturbaum-Untergruppen-Patch auf.
 * - Wenn im Strukturbaum ein Detailknoten angeklickt wird (Motor, MOVIFIT,
 *   Sensor, Wartungsschalter, Port, BOM), zeigt das rechte Properties-Dock
 *   nicht nur eine Infokarte, sondern eine kleine, direkte Bearbeitungsmaske.
 * - Die Felder sind bewusst praxisnah für Baustellenplaner/EPLAN vorbereitet:
 *   BMK, Funktion, Anschluss, Klemme, Hersteller, Typ, Artikelnummer,
 *   Leistungs-/Versorgungsdaten, Sensorfunktion, Kabelhinweise usw.
 *
 * Design-Regeln:
 * - Keine schweren Tabellen im mobilen Dock.
 * - Keine bestehenden Voll-Editoren ersetzen.
 * - Bestehende Objekt-/Baugruppen-Daten nur ergänzen, nicht umstrukturieren.
 * - Änderungen werden direkt am sceneObj/component/port/BOM gespeichert und
 *   über _assemblyPropsPersistScene(...) persistiert, falls vorhanden.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_detail_editor_v1";
const STYLE_ID = "bp-workarea-structure-tree-detail-editor-v1";

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function safeNumber(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function escapeHtml(value) {
  return safeString(value).replace(/[&<>'"]/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  }[ch]));
}

function makeEl(tag, className = "", text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== "") el.textContent = text;
  return el;
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
/* ${PATCH_ID} ------------------------------------------------------------- */
.wa-structure-editor-card {
  border: 1px solid rgba(52, 211, 153, 0.26);
  border-radius: 14px;
  padding: 10px;
  background: rgba(16, 185, 129, 0.07);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wa-structure-editor-card__title {
  font-weight: 850;
  line-height: 1.25;
}

.wa-structure-editor-card__sub {
  font-size: 12px;
  opacity: .72;
  line-height: 1.35;
}

.wa-structure-editor-section {
  border-top: 1px dashed rgba(255,255,255,.12);
  padding-top: 9px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.wa-structure-editor-section:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.wa-structure-editor-section__title {
  font-size: 12px;
  font-weight: 800;
  opacity: .9;
}

.wa-structure-editor-grid {
  display: grid;
  grid-template-columns: minmax(104px, .74fr) minmax(0, 1.35fr);
  gap: 7px 9px;
  align-items: center;
}

.wa-structure-editor-grid label {
  font-size: 12px;
  opacity: .76;
  line-height: 1.2;
}

.wa-structure-editor-grid input,
.wa-structure-editor-grid select,
.wa-structure-editor-grid textarea {
  min-width: 0;
  width: 100%;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.23);
  color: inherit;
  font: inherit;
  font-size: 12px;
  padding: 0 8px;
  box-sizing: border-box;
}

.wa-structure-editor-grid input,
.wa-structure-editor-grid select {
  height: 31px;
}

.wa-structure-editor-grid textarea {
  min-height: 58px;
  padding-top: 7px;
  resize: vertical;
}

.wa-structure-editor-mini {
  font-size: 11px;
  line-height: 1.35;
  opacity: .66;
}

.wa-structure-editor-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.wa-structure-editor-badge {
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 11px;
  background: rgba(0,0,0,.16);
  opacity: .9;
}
/* ------------------------------------------------------------------------- */
`;
  document.head.appendChild(style);
}

function getDetailState(panel) {
  const detail = panel?.state?.structureTreeDetailV1;
  return detail && typeof detail === "object" ? detail : null;
}

function getSceneObjects(panel) {
  try {
    const objects = panel?._getSceneObjectsLightV1?.();
    return Array.isArray(objects) ? objects.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function findSceneObjById(panel, objectId) {
  const id = safeString(objectId);
  if (!id) return null;
  return getSceneObjects(panel).find((obj) => safeString(obj?.id) === id) || null;
}

function getComponents(sceneObj) {
  if (Array.isArray(sceneObj?.components)) return sceneObj.components.filter(Boolean);
  if (Array.isArray(sceneObj?.componentRefs)) return sceneObj.componentRefs.filter(Boolean);
  return [];
}

function findComponent(sceneObj, componentId) {
  const id = safeString(componentId);
  if (!id) return null;
  return getComponents(sceneObj).find((cmp, index) => safeString(cmp?.id || `cmp-${index + 1}`) === id) || null;
}

function getPorts(panel, sceneObj) {
  if (Array.isArray(sceneObj?.ports) && sceneObj.ports.length) return sceneObj.ports.filter(Boolean);
  try {
    const ports = panel?._flattenAssemblyPortsV1?.(sceneObj?.components || []);
    return Array.isArray(ports) ? ports.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function findPort(panel, sceneObj, portId) {
  const id = safeString(portId);
  if (!id) return null;
  return getPorts(panel, sceneObj).find((port, index) => safeString(port?.id || port?.key || `port-${index + 1}`) === id) || null;
}

function findBomLine(sceneObj, bomKey) {
  const key = safeString(bomKey);
  const rows = Array.isArray(sceneObj?.bom) ? sceneObj.bom.filter(Boolean) : [];
  return rows.find((item, index) => safeString(item?.id || item?.code || item?.label || item?.title || `bom-${index + 1}`) === key) || null;
}

function resolveObjectName(obj) {
  return safeString(obj?.name || obj?.config?.name || obj?.visual?.label || obj?.importName || obj?.type, "Objekt");
}

function resolveLocation(obj) {
  return safeString(obj?.config?.location || obj?.location || obj?.eplan?.location || obj?.ort || obj?.area, "+? / nicht zugeordnet");
}

function roleLabel(panel, role, mode = "label") {
  const r = safeString(role, "component");
  try {
    return safeString(panel?._getAssemblyRoleLabelV1?.(r, mode), r);
  } catch {
    return r;
  }
}

function ensureObj(target, key) {
  if (!target[key] || typeof target[key] !== "object") target[key] = {};
  return target[key];
}

function persist(panel, sceneObj, reason) {
  try {
    if (typeof panel?._assemblyPropsPersistScene === "function") {
      panel._assemblyPropsPersistScene(sceneObj, reason || "structure-detail-editor");
    }
  } catch (err) {
    console.warn(`[${PATCH_ID}] persist failed`, err);
  }
}

function refresh(panel, message = "Gespeichert") {
  try { panel?._setStatus?.(message); } catch {}
  try { panel?._renderLeftPanel?.(); } catch {}
  try { panel?._renderRightPanel?.(); } catch {}
}

function getComponentEplan(panel, sceneObj, cmp) {
  if (!cmp || typeof cmp !== "object") return {};
  if (typeof panel?._ensureAssemblyComponentEplanV1 === "function") {
    try { return panel._ensureAssemblyComponentEplanV1(cmp, sceneObj); } catch {}
  }
  return ensureObj(cmp, "eplan");
}

function setComponentEplan(panel, sceneObj, cmp, field, value) {
  if (!cmp) return;
  if (typeof panel?._setAssemblyComponentEplanFieldV1 === "function") {
    panel._setAssemblyComponentEplanFieldV1(sceneObj, cmp.id, field, value);
    return;
  }
  const eplan = ensureObj(cmp, "eplan");
  eplan[field] = safeString(value);
  eplan.updatedAt = new Date().toISOString();
  persist(panel, sceneObj, `structure-detail-editor:eplan:${field}`);
}

function input(value, placeholder = "") {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value == null ? "" : String(value);
  el.placeholder = placeholder;
  return el;
}

function numberInput(value, placeholder = "") {
  const el = input(value, placeholder);
  el.inputMode = "decimal";
  return el;
}

function textarea(value, placeholder = "") {
  const el = document.createElement("textarea");
  el.value = value == null ? "" : String(value);
  el.placeholder = placeholder;
  return el;
}

function select(value, options = []) {
  const el = document.createElement("select");
  for (const opt of options) {
    const option = document.createElement("option");
    option.value = String(opt.value ?? opt);
    option.textContent = String(opt.label ?? opt.value ?? opt);
    if (String(option.value) === String(value ?? "")) option.selected = true;
    el.appendChild(option);
  }
  return el;
}

function addField(grid, label, el, onChange) {
  grid.appendChild(makeEl("label", "", label));
  if (typeof onChange === "function") {
    el.addEventListener("change", () => onChange(el.value, el));
  }
  grid.appendChild(el);
  return el;
}

function addCheckField(grid, label, value, onChange) {
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = Boolean(value);
  box.style.width = "auto";
  box.style.height = "auto";
  const wrap = makeEl("div");
  wrap.appendChild(box);
  grid.appendChild(makeEl("label", "", label));
  grid.appendChild(wrap);
  box.addEventListener("change", () => onChange(Boolean(box.checked), box));
  return box;
}

function section(title) {
  const sec = makeEl("div", "wa-structure-editor-section");
  sec.appendChild(makeEl("div", "wa-structure-editor-section__title", title));
  const grid = makeEl("div", "wa-structure-editor-grid");
  sec.appendChild(grid);
  return { sec, grid };
}

function setConfigField(panel, sceneObj, cmp, key, value, numeric = false) {
  cmp.config = cmp.config && typeof cmp.config === "object" ? cmp.config : {};
  cmp.config[key] = numeric ? safeNumber(value, "") : safeString(value);
  cmp.updatedAt = new Date().toISOString();
  persist(panel, sceneObj, `structure-detail-editor:component-config:${key}`);
}

function getConfigField(cmp, key, fallback = "") {
  return cmp?.config && Object.prototype.hasOwnProperty.call(cmp.config, key) ? cmp.config[key] : fallback;
}

function addCommonComponentFields(panel, sceneObj, cmp, card) {
  const eplan = getComponentEplan(panel, sceneObj, cmp);
  const { sec, grid } = section("Basis / EPLAN");

  addField(grid, "Name", input(cmp.name || cmp.label || "", "z. B. Motor -M1"), (value) => {
    cmp.name = safeString(value, cmp.name || cmp.label || "Bauteil");
    cmp.label = cmp.name;
    persist(panel, sceneObj, "structure-detail-editor:component:name");
    refresh(panel, `Bauteil gespeichert: ${cmp.name}`);
  });

  const roles = typeof panel?._getAssemblyComponentRolesV1 === "function"
    ? panel._getAssemblyComponentRolesV1().map((r) => ({ value: r.value, label: r.label || r.value }))
    : ["drive", "control", "sensor", "maintenance", "junction", "frame", "roller", "component"].map((r) => ({ value: r, label: r }));
  addField(grid, "Rolle", select(cmp.role || "component", roles), (value) => {
    cmp.role = safeString(value, "component");
    cmp.roleLabel = roleLabel(panel, cmp.role);
    if (!Array.isArray(cmp.ports) || !cmp.ports.length) {
      try { cmp.ports = panel?._makeAssemblyComponentPortsV1?.(cmp.role, cmp.id, cmp.name || cmp.label || "Bauteil") || []; } catch {}
    }
    persist(panel, sceneObj, "structure-detail-editor:component:role");
    refresh(panel, `Rolle gespeichert: ${cmp.roleLabel}`);
  });

  addField(grid, "BMK / Gerät", input(eplan.deviceTag || eplan.equipmentTag || cmp.equipmentTag || "", "z. B. -M1 / -A1 / -B1"), (value) => {
    setComponentEplan(panel, sceneObj, cmp, "deviceTag", value);
    refresh(panel, "BMK gespeichert");
  });

  addField(grid, "Funktion", input(eplan.functionText || cmp.functionText || "", "z. B. Antrieb Rollenbahn"), (value) => {
    setComponentEplan(panel, sceneObj, cmp, "functionText", value);
    refresh(panel, "Funktion gespeichert");
  });

  addField(grid, "Anschluss", input(eplan.connectionRef || "", "z. B. X1 / M12-1"), (value) => {
    setComponentEplan(panel, sceneObj, cmp, "connectionRef", value);
    refresh(panel, "Anschluss gespeichert");
  });

  addField(grid, "Klemme", input(eplan.terminalRef || "", "z. B. -X1:1-4"), (value) => {
    setComponentEplan(panel, sceneObj, cmp, "terminalRef", value);
    refresh(panel, "Klemme gespeichert");
  });

  addField(grid, "Seite/Pfad", input(eplan.pagePath || "", "z. B. 2000/01"), (value) => {
    setComponentEplan(panel, sceneObj, cmp, "pagePath", value);
    refresh(panel, "Seitenpfad gespeichert");
  });

  card.appendChild(sec);
}

function addArticleFields(panel, sceneObj, cmp, card) {
  const { sec, grid } = section("Artikel / Hersteller");
  addField(grid, "Hersteller", input(getConfigField(cmp, "manufacturer", ""), "z. B. SEW / Siemens / Sick"), (value) => {
    setConfigField(panel, sceneObj, cmp, "manufacturer", value);
    refresh(panel, "Hersteller gespeichert");
  });
  addField(grid, "Typ / Name", input(getConfigField(cmp, "typeName", cmp.typeName || ""), "z. B. MOVIFIT FC / DRN.."), (value) => {
    setConfigField(panel, sceneObj, cmp, "typeName", value);
    refresh(panel, "Typ gespeichert");
  });
  addField(grid, "Artikelnummer", input(getConfigField(cmp, "articleNo", cmp.articleNo || ""), "Hersteller-Art.-Nr."), (value) => {
    setConfigField(panel, sceneObj, cmp, "articleNo", value);
    refresh(panel, "Artikelnummer gespeichert");
  });
  addField(grid, "Kommentar", textarea(getConfigField(cmp, "comment", cmp.comment || ""), "Notiz für spätere Doku / Anschluss"), (value) => {
    setConfigField(panel, sceneObj, cmp, "comment", value);
    refresh(panel, "Kommentar gespeichert");
  });
  card.appendChild(sec);
}

function addRoleSpecificFields(panel, sceneObj, cmp, card) {
  const role = safeString(cmp.role, "component");

  if (role === "drive" || role === "motor") {
    const { sec, grid } = section("Motor / Antrieb");
    addField(grid, "Leistung kW", numberInput(getConfigField(cmp, "powerKw", ""), "z. B. 0.75"), (value) => {
      setConfigField(panel, sceneObj, cmp, "powerKw", value, true);
      refresh(panel, "Motorleistung gespeichert");
    });
    addField(grid, "Spannung", input(getConfigField(cmp, "voltage", "400V AC"), "z. B. 400V AC"), (value) => {
      setConfigField(panel, sceneObj, cmp, "voltage", value);
      refresh(panel, "Motorspannung gespeichert");
    });
    addField(grid, "Strom A", numberInput(getConfigField(cmp, "currentA", ""), "z. B. 2.1"), (value) => {
      setConfigField(panel, sceneObj, cmp, "currentA", value, true);
      refresh(panel, "Motorstrom gespeichert");
    });
    addField(grid, "Drehzahl", input(getConfigField(cmp, "speedRpm", ""), "z. B. 1400 rpm"), (value) => {
      setConfigField(panel, sceneObj, cmp, "speedRpm", value);
      refresh(panel, "Drehzahl gespeichert");
    });
    addField(grid, "Baugröße", input(getConfigField(cmp, "frameSize", ""), "z. B. 80M / 90S"), (value) => {
      setConfigField(panel, sceneObj, cmp, "frameSize", value);
      refresh(panel, "Baugröße gespeichert");
    });
    addField(grid, "Versorgt von", input(getConfigField(cmp, "fedFrom", "MOVIFIT / MOVIPRO"), "z. B. MOVIFIT -A1"), (value) => {
      setConfigField(panel, sceneObj, cmp, "fedFrom", value);
      refresh(panel, "Versorgung gespeichert");
    });
    addField(grid, "Antriebsseite", input(getConfigField(cmp, "driveSide", ""), "z. B. links / rechts / zwischen letzter Rolle"), (value) => {
      setConfigField(panel, sceneObj, cmp, "driveSide", value);
      refresh(panel, "Antriebsseite gespeichert");
    });
    card.appendChild(sec);
    return;
  }

  if (role === "control" || role === "controller" || role === "movifit" || role === "movipro") {
    const { sec, grid } = section("Steuerung / MOVIFIT / MOVIPRO");
    addField(grid, "400V Einspeisung", input(getConfigField(cmp, "supply400", "400V AC"), "z. B. 400V AC"), (value) => {
      setConfigField(panel, sceneObj, cmp, "supply400", value);
      refresh(panel, "400V gespeichert");
    });
    addField(grid, "24V Versorgung", input(getConfigField(cmp, "supply24", "24V DC"), "z. B. 24V DC"), (value) => {
      setConfigField(panel, sceneObj, cmp, "supply24", value);
      refresh(panel, "24V gespeichert");
    });
    addField(grid, "Safety / STO", input(getConfigField(cmp, "safety", "STO A/B"), "z. B. STO A/B"), (value) => {
      setConfigField(panel, sceneObj, cmp, "safety", value);
      refresh(panel, "Safety/STO gespeichert");
    });
    addField(grid, "Netzwerk", input(getConfigField(cmp, "network", "Profinet IN/OUT"), "z. B. Profinet IN/OUT"), (value) => {
      setConfigField(panel, sceneObj, cmp, "network", value);
      refresh(panel, "Netzwerk gespeichert");
    });
    addField(grid, "Quelle/Schrank", input(getConfigField(cmp, "sourceCabinet", ""), "z. B. +BS / +ES"), (value) => {
      setConfigField(panel, sceneObj, cmp, "sourceCabinet", value);
      refresh(panel, "Quelle gespeichert");
    });
    addField(grid, "IP / Adresse", input(getConfigField(cmp, "networkAddress", ""), "optional"), (value) => {
      setConfigField(panel, sceneObj, cmp, "networkAddress", value);
      refresh(panel, "Adresse gespeichert");
    });
    card.appendChild(sec);
    return;
  }

  if (role === "sensor" || role === "sensors") {
    const { sec, grid } = section("Sensorik");
    addField(grid, "Sensorfunktion", input(getConfigField(cmp, "sensorFunction", ""), "z. B. Stop vorwärts / Schnell-Langsam"), (value) => {
      setConfigField(panel, sceneObj, cmp, "sensorFunction", value);
      refresh(panel, "Sensorfunktion gespeichert");
    });
    addField(grid, "Signal", input(getConfigField(cmp, "signal", "DI 24V"), "z. B. DI 24V"), (value) => {
      setConfigField(panel, sceneObj, cmp, "signal", value);
      refresh(panel, "Signal gespeichert");
    });
    addField(grid, "Stecker", input(getConfigField(cmp, "connector", "M12"), "z. B. M12"), (value) => {
      setConfigField(panel, sceneObj, cmp, "connector", value);
      refresh(panel, "Stecker gespeichert");
    });
    addField(grid, "Ziel Eingang", input(getConfigField(cmp, "targetInput", ""), "z. B. MOVIFIT DI1"), (value) => {
      setConfigField(panel, sceneObj, cmp, "targetInput", value);
      refresh(panel, "Ziel Eingang gespeichert");
    });
    addField(grid, "Position", input(getConfigField(cmp, "mountPosition", ""), "z. B. 300 mm vor Stop"), (value) => {
      setConfigField(panel, sceneObj, cmp, "mountPosition", value);
      refresh(panel, "Sensorposition gespeichert");
    });
    card.appendChild(sec);
    return;
  }

  if (role === "maintenance" || role === "safety" || role === "disconnect") {
    const { sec, grid } = section("Wartung / Sicherheit");
    addField(grid, "Typ", input(getConfigField(cmp, "switchType", "Wartungsschalter 400V"), "z. B. Wartungsschalter 400V"), (value) => {
      setConfigField(panel, sceneObj, cmp, "switchType", value);
      refresh(panel, "Schaltertyp gespeichert");
    });
    addField(grid, "Nennstrom", input(getConfigField(cmp, "ratedCurrent", ""), "z. B. 16A / 32A"), (value) => {
      setConfigField(panel, sceneObj, cmp, "ratedCurrent", value);
      refresh(panel, "Nennstrom gespeichert");
    });
    addField(grid, "Versorgt", input(getConfigField(cmp, "feeds", ""), "z. B. RB-2001, RB-2002"), (value) => {
      setConfigField(panel, sceneObj, cmp, "feeds", value);
      refresh(panel, "Versorgte Gruppen gespeichert");
    });
    addField(grid, "Zuleitung von", input(getConfigField(cmp, "fedFrom", ""), "z. B. +BS / +ES"), (value) => {
      setConfigField(panel, sceneObj, cmp, "fedFrom", value);
      refresh(panel, "Zuleitung gespeichert");
    });
    addCheckField(grid, "Abschließbar", getConfigField(cmp, "lockable", true), (value) => {
      setConfigField(panel, sceneObj, cmp, "lockable", value);
      refresh(panel, "Abschließbar gespeichert");
    });
    card.appendChild(sec);
    return;
  }

  if (role === "junction" || role === "terminal" || role === "box") {
    const { sec, grid } = section("Klemmkasten / Verteiler");
    addField(grid, "Klemmenleiste", input(getConfigField(cmp, "terminalStrip", ""), "z. B. -X1"), (value) => {
      setConfigField(panel, sceneObj, cmp, "terminalStrip", value);
      refresh(panel, "Klemmenleiste gespeichert");
    });
    addField(grid, "Klemmenzahl", input(getConfigField(cmp, "terminalCount", ""), "z. B. 12"), (value) => {
      setConfigField(panel, sceneObj, cmp, "terminalCount", value);
      refresh(panel, "Klemmenzahl gespeichert");
    });
    addField(grid, "Einspeisung", input(getConfigField(cmp, "fedFrom", ""), "z. B. MOVIFIT / Schrank"), (value) => {
      setConfigField(panel, sceneObj, cmp, "fedFrom", value);
      refresh(panel, "Einspeisung gespeichert");
    });
    card.appendChild(sec);
  }
}

function renderComponentEditor(panel, sceneObj, detail) {
  const cmp = findComponent(sceneObj, detail.componentId);
  const card = makeEl("div", "wa-structure-editor-card");

  if (!cmp) {
    card.appendChild(makeEl("div", "wa-structure-editor-card__title", "Bauteil nicht gefunden"));
    card.appendChild(makeEl("div", "wa-structure-editor-card__sub", "Die Baugruppe wurde wahrscheinlich neu aufgebaut oder die Variante gewechselt."));
    return card;
  }

  const role = safeString(cmp.role, "component");
  const ports = getPorts(panel, sceneObj).filter((p) => safeString(p.componentId || p.assemblyComponentId) === safeString(cmp.id));

  card.appendChild(makeEl("div", "wa-structure-editor-card__title", `${roleLabel(panel, role)} · ${safeString(cmp.name || cmp.label || cmp.id, "Bauteil")}`));
  card.appendChild(makeEl("div", "wa-structure-editor-card__sub", `Objekt: ${resolveObjectName(sceneObj)} · Ort: ${resolveLocation(sceneObj)} · ID: ${safeString(cmp.id, "-")}`));

  const badges = makeEl("div", "wa-structure-editor-badges");
  badges.appendChild(makeEl("span", "wa-structure-editor-badge", `Rolle: ${roleLabel(panel, role, "short")}`));
  badges.appendChild(makeEl("span", "wa-structure-editor-badge", `Ports: ${ports.length}`));
  if (cmp.projectAssetId) badges.appendChild(makeEl("span", "wa-structure-editor-badge", "Asset-Bauteil"));
  card.appendChild(badges);

  addCommonComponentFields(panel, sceneObj, cmp, card);
  addArticleFields(panel, sceneObj, cmp, card);
  addRoleSpecificFields(panel, sceneObj, cmp, card);

  const hint = makeEl("div", "wa-structure-editor-mini", "Hinweis: Diese Felder sind die leichte Schnellbearbeitung. Große Tabellen für Kabel, BOM und Vollparameter bleiben im Voll-Editor/Elektrik-Dialog.");
  card.appendChild(hint);
  return card;
}

function updatePortField(panel, sceneObj, port, key, value) {
  // Wichtig: Falls der Port nur aus Komponenten abgeleitet wurde, speichern wir
  // direkt am Komponenten-Port, damit die Änderung nicht beim nächsten Rendern
  // verschwindet.
  const componentId = safeString(port.componentId || port.assemblyComponentId);
  const component = componentId ? findComponent(sceneObj, componentId) : null;
  let target = port;
  if (component) {
    component.ports = Array.isArray(component.ports) && component.ports.length
      ? component.ports
      : (panel?._makeAssemblyComponentPortsV1?.(component.role, component.id, component.name || component.label || "Bauteil") || []);
    const local = component.ports.find((p) => safeString(p.id || p.key) === safeString(port.id || port.key));
    if (local) target = local;
  }
  target[key] = key === "enabled" || key === "required" ? Boolean(value) : safeString(value);
  target.updatedAt = new Date().toISOString();
  if (Array.isArray(sceneObj.ports) && sceneObj.ports.length) {
    const scenePort = sceneObj.ports.find((p) => safeString(p.id || p.key) === safeString(port.id || port.key));
    if (scenePort) {
      scenePort[key] = target[key];
      scenePort.updatedAt = target.updatedAt;
    }
  }
  persist(panel, sceneObj, `structure-detail-editor:port:${key}`);
}

function renderPortEditor(panel, sceneObj, detail) {
  const port = findPort(panel, sceneObj, detail.portId);
  const card = makeEl("div", "wa-structure-editor-card");

  if (!port) {
    card.appendChild(makeEl("div", "wa-structure-editor-card__title", "Port nicht gefunden"));
    return card;
  }

  card.appendChild(makeEl("div", "wa-structure-editor-card__title", `Anschluss / Port · ${safeString(port.label || port.key || detail.portId, "Port")}`));
  card.appendChild(makeEl("div", "wa-structure-editor-card__sub", `Objekt: ${resolveObjectName(sceneObj)} · Bauteil: ${safeString(port.componentName || port.componentId, "-")}`));

  const { sec, grid } = section("Portdaten");
  addField(grid, "Label", input(port.label || "", "z. B. Motorabgang"), (value) => {
    updatePortField(panel, sceneObj, port, "label", value);
    refresh(panel, "Port-Label gespeichert");
  });
  addField(grid, "Key", input(port.key || "", "z. B. MOTOR_OUT"), (value) => {
    updatePortField(panel, sceneObj, port, "key", value);
    refresh(panel, "Port-Key gespeichert");
  });
  addField(grid, "Art", select(port.kind || "signal", ["power", "control", "safety", "network", "signal", "pe", "other"]), (value) => {
    updatePortField(panel, sceneObj, port, "kind", value);
    refresh(panel, "Port-Art gespeichert");
  });
  addField(grid, "Richtung", select(port.direction || "bidirectional", ["input", "output", "bidirectional"]), (value) => {
    updatePortField(panel, sceneObj, port, "direction", value);
    refresh(panel, "Port-Richtung gespeichert");
  });
  addField(grid, "Spannung", input(port.voltage || "", "z. B. 400V AC / 24V DC"), (value) => {
    updatePortField(panel, sceneObj, port, "voltage", value);
    refresh(panel, "Port-Spannung gespeichert");
  });
  addField(grid, "Signal", input(port.signal || "", "z. B. U/V/W/PE"), (value) => {
    updatePortField(panel, sceneObj, port, "signal", value);
    refresh(panel, "Port-Signal gespeichert");
  });
  addField(grid, "Stecker/Klemme", input(port.connector || port.terminal || "", "z. B. M12 / X1"), (value) => {
    updatePortField(panel, sceneObj, port, "connector", value);
    refresh(panel, "Stecker/Klemme gespeichert");
  });
  addField(grid, "Kabelhinweis", input(port.cableHint || port.cableTypeHint || "", "z. B. Motorleitung / Sensorleitung"), (value) => {
    updatePortField(panel, sceneObj, port, "cableHint", value);
    refresh(panel, "Kabelhinweis gespeichert");
  });
  addCheckField(grid, "Erforderlich", port.required !== false, (value) => {
    updatePortField(panel, sceneObj, port, "required", value);
    refresh(panel, "Port-Pflicht gespeichert");
  });
  addCheckField(grid, "Aktiv", port.enabled !== false, (value) => {
    updatePortField(panel, sceneObj, port, "enabled", value);
    refresh(panel, "Port aktiv/inaktiv gespeichert");
  });
  card.appendChild(sec);
  return card;
}

function renderBomEditor(panel, sceneObj, detail) {
  const row = findBomLine(sceneObj, detail.bomKey);
  const card = makeEl("div", "wa-structure-editor-card");
  if (!row) {
    card.appendChild(makeEl("div", "wa-structure-editor-card__title", "Materialposition nicht gefunden"));
    return card;
  }

  card.appendChild(makeEl("div", "wa-structure-editor-card__title", `Material · ${safeString(row.label || row.title || row.code, "Position")}`));
  card.appendChild(makeEl("div", "wa-structure-editor-card__sub", `Objekt: ${resolveObjectName(sceneObj)}`));

  const { sec, grid } = section("BOM / Material");
  const setBom = (key, value, numeric = false) => {
    row[key] = numeric ? safeNumber(value, row[key] || "") : safeString(value);
    row.updatedAt = new Date().toISOString();
    persist(panel, sceneObj, `structure-detail-editor:bom:${key}`);
  };

  addField(grid, "Bezeichnung", input(row.label || row.title || "", "Materialbezeichnung"), (value) => {
    row.label = safeString(value, row.label || row.title || "Material");
    setBom("label", row.label);
    refresh(panel, "Materialbezeichnung gespeichert");
  });
  addField(grid, "Code", input(row.code || row.id || "", "Interner Code"), (value) => {
    setBom("code", value);
    refresh(panel, "Materialcode gespeichert");
  });
  addField(grid, "Menge", numberInput(row.qty || 1, "z. B. 1"), (value) => {
    setBom("qty", value, true);
    refresh(panel, "Menge gespeichert");
  });
  addField(grid, "Einheit", input(row.uom || row.unit || "Stk", "Stk / m / Satz"), (value) => {
    row.uom = safeString(value, "Stk");
    setBom("uom", row.uom);
    refresh(panel, "Einheit gespeichert");
  });
  addField(grid, "Hersteller", input(row.manufacturer || "", "optional"), (value) => {
    setBom("manufacturer", value);
    refresh(panel, "Hersteller gespeichert");
  });
  addField(grid, "Artikelnummer", input(row.articleNo || "", "optional"), (value) => {
    setBom("articleNo", value);
    refresh(panel, "Artikelnummer gespeichert");
  });
  addField(grid, "Kommentar", textarea(row.comment || "", "Notiz"), (value) => {
    setBom("comment", value);
    refresh(panel, "Kommentar gespeichert");
  });
  card.appendChild(sec);
  return card;
}

function renderEditorProperties(panel, originalRenderPropertiesPanel) {
  const detail = getDetailState(panel);
  const sceneObj = detail?.objectId ? findSceneObjById(panel, detail.objectId) : null;
  if (!detail || !sceneObj) return originalRenderPropertiesPanel.call(panel);

  const box = document.createElement("div");
  box.className = "wa-properties-light wa-structure-detail-editor-host";
  box.style.padding = "10px";
  box.style.display = "flex";
  box.style.flexDirection = "column";
  box.style.gap = "10px";

  const title = detail.kind === "component" ? "Bauteil konfigurieren" : detail.kind === "port" ? "Anschluss konfigurieren" : detail.kind === "bom" ? "Material konfigurieren" : "Strukturdetail";
  box.appendChild(panel._makePanelCardV1?.(
    title,
    `Ausgewählt über Strukturbaum: ${resolveObjectName(sceneObj)} · ${safeString(detail.kind, "detail")}`
  ) || document.createElement("div"));

  if (detail.kind === "component") box.appendChild(renderComponentEditor(panel, sceneObj, detail));
  else if (detail.kind === "port") box.appendChild(renderPortEditor(panel, sceneObj, detail));
  else if (detail.kind === "bom") box.appendChild(renderBomEditor(panel, sceneObj, detail));
  else box.appendChild(makeEl("div", "wa-structure-editor-card", "Unbekannter Detailtyp."));

  const actions = makeEl("div", "wa-light-actions");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.flexWrap = "wrap";

  actions.appendChild(panel._btn?.("Objekt-Basis", () => {
    if (panel?.state) panel.state.structureTreeDetailV1 = null;
    panel?._setSelectionToObject?.(sceneObj, "structure-detail-editor:object-base");
    panel?._renderLeftPanel?.();
    panel?._renderRightPanel?.();
  }) || document.createElement("button"));

  actions.appendChild(panel._btn?.("Voll-Editor", () => {
    panel?._openWorkareaModalV1?.("Voll-Editor", () => panel._renderPropertiesPanelFull(), { wide: true });
  }) || document.createElement("button"));

  actions.appendChild(panel._btn?.("Elektrik", () => {
    panel?._openWorkareaModalV1?.("Elektrik / Kabel / EPLAN", () => panel._renderElectricalDialogLightV1(sceneObj), { wide: true });
  }) || document.createElement("button"));

  actions.appendChild(panel._btn?.("Struktur", () => {
    if (panel?.state) panel.state.leftTabId = "tab.structure";
    panel?._renderLeftTabs?.();
    panel?._renderLeftPanel?.();
    window.setTimeout(() => panel?._syncStructureComponentDetailStateV1?.(), 0);
  }) || document.createElement("button"));

  box.appendChild(actions);
  return box;
}

function installPatch() {
  installStyle();
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__workareaStructureTreeDetailEditorV1Installed) return;
  proto.__workareaStructureTreeDetailEditorV1Installed = true;

  const originalRenderPropertiesPanel = proto._renderPropertiesPanel;
  proto._renderPropertiesPanel = function patchedRenderPropertiesPanelWithDetailEditor() {
    return renderEditorProperties(this, originalRenderPropertiesPanel);
  };
  proto._renderPropertiesPanel.__workareaStructureTreeDetailEditorV1 = true;

  console.info(`[${PATCH_ID}] installed`);
}

installPatch();
