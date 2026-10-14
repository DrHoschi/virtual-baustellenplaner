const SVG = "http://www.w3.org/2000/svg";
const clone = value => structuredClone(value);
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const esc = value => String(value ?? "").replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
import { ensureElectricalData, polylineLengthMm, plannedCableLengthMm, CABLE_STATUSES, MEASUREMENT_RESULTS, cableStatusSummary, deriveCableStatus, measurementLengthM, normalizeMeasurementResult, buildAcceptanceReport } from "../electrical/electrical-model.v1.js";
import { ensureCameraData, cameraFovPolygon, CAMERA_TYPES } from "../camera/camera-model.v1.js";

function defaultLayer() { return { id: "layer-ground", name: "Boden", elevationMm: 0, visible: true }; }
function ensurePlanningData(project) {
  if (!Array.isArray(project.layers) || !project.layers.length) project.layers = [defaultLayer()];
  if (!Array.isArray(project.objects)) project.objects = [];
  if (!project.workspace || typeof project.workspace !== "object" || Array.isArray(project.workspace)) project.workspace = {};
  if (!Array.isArray(project.workspace.workAreas)) project.workspace.workAreas = [];
  project.workspace.workAreas = project.workspace.workAreas
    .filter(area => area && typeof area === "object")
    .map((area, index) => ({
      id: String(area.id || `workarea-${index + 1}`),
      name: String(area.name || `Bereich ${index + 1}`),
      xMm: number(area.xMm),
      yMm: number(area.yMm),
      widthMm: Math.max(1, number(area.widthMm)),
      heightMm: Math.max(1, number(area.heightMm)),
      note: String(area.note || ""),
    }));
  if (!project.workspace.workAreas.some(area => area.id === project.workspace.activeWorkAreaId)) project.workspace.activeWorkAreaId = null;
  for (const object of project.objects) {
    if (!object.layerId || !project.layers.some(layer => layer.id === object.layerId)) object.layerId = project.layers[0].id;
    if (!Number.isFinite(object.zMm)) object.zMm = project.layers.find(layer => layer.id === object.layerId)?.elevationMm || 0;
  }
  return project;
}

function createSvgElement(tag, attributes = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export function renderWorkarea(root, sourceProject, asset, { onSave, setStatus = () => {} } = {}) {
  const project = ensurePlanningData(clone(sourceProject));
  let electrical = ensureElectricalData(project);
  let cameraData = ensureCameraData(project);
  const history = [clone(project)];
  let historyIndex = 0;
  let selectedId = null;
  let activeLayerId = project.layers[0].id;
  let drag = null;
  let selectedTrayId = null;
  let selectedCameraId = null;
  let selectedWorkAreaId = project.workspace.activeWorkAreaId;
  let draftTrayPoints = null;
  // UI context is transient: tool changes never rewrite project layer visibility.
  let activeTool = "select";
  let activeGroup = "objects";
  let selectedCableId = null;
  let assetUrl = asset?.blob ? URL.createObjectURL(asset.blob) : null;

  const calibration = project.planBackground?.calibration;
  const scale = calibration?.scaleMmPerPixel;
  const imageWidth = scale ? project.planBackground.widthPx * scale : project.planBackground?.widthPx || 0;
  const imageHeight = scale ? project.planBackground.heightPx * scale : project.planBackground?.heightPx || 0;
  const origin = calibration?.pixelPoints?.[0];
  const imageLeft = scale && origin ? -origin.x * scale : 0;
  const imageBottom = scale && origin ? (origin.y - project.planBackground.heightPx) * scale : 0;
  const imageTop = imageBottom + imageHeight;
  const areaWidth = project.siteArea.widthMm || (scale ? imageWidth : 12000);
  const areaHeight = project.siteArea.heightMm || (scale ? imageHeight : 8000);
  const areaLeft = project.siteArea.originXmm || 0;
  const areaBottom = project.siteArea.originYmm || 0;
  const minX = Math.min(areaLeft, assetUrl ? imageLeft : areaLeft);
  const maxX = Math.max(areaLeft + areaWidth, assetUrl ? imageLeft + imageWidth : areaLeft + areaWidth);
  const minY = Math.min(areaBottom, assetUrl ? imageBottom : areaBottom);
  const maxY = Math.max(areaBottom + areaHeight, assetUrl ? imageTop : areaBottom + areaHeight);
  const viewWidth = Math.max(1000, maxX - minX);
  const viewHeight = Math.max(1000, maxY - minY);
  const yTop = maxY;
  const metricReady = Boolean(scale || (project.siteArea.widthMm && project.siteArea.heightMm));
  const MAX_ZOOM = 48;
  let zoom = 1;
  let viewCenterX = viewWidth / 2;
  let viewCenterY = viewHeight / 2;

  root.innerHTML = `<section class="workarea-head"><div><p class="eyebrow">2D-WORKAREA</p><h2>${esc(project.name)}</h2><p class="muted">${esc(project.siteArea.kind === "whole-hall" ? "Ganze Halle" : project.siteArea.kind === "hall-section" ? "Hallenteil" : project.siteArea.kind === "free-area" ? "Freie Fläche" : "Arbeitsfläche")}${metricReady ? " · Maßangaben in mm" : " · noch ohne bestätigten Maßstab"}</p></div><button class="secondary" id="workarea-save">Speichern</button></section>
  <div class="workarea-tools"><div class="mode-context" aria-label="Werkzeugauswahl"><label>Fachgruppe<select id="workarea-group"><option value="all">Alle Elemente</option><option value="objects">Objekte</option><option value="cameras">Kameras</option><option value="trays">Trassen</option><option value="cables">Kabel</option></select></label><label>Tätigkeit<select id="workarea-action" aria-label="Tätigkeit"></select></label><div class="tool-options" aria-live="polite"><button class="secondary" id="finish-tray" hidden disabled>Trasse abschließen</button><button class="secondary" id="cancel-tool" hidden>Abbrechen</button></div></div><div class="tool-group view-controls" aria-label="Ansicht und Verlauf"><button class="secondary" id="zoom-out" aria-label="Ansicht verkleinern">−</button><button class="secondary" id="zoom-in" aria-label="Ansicht vergrößern">＋</button><button class="secondary" id="zoom-fit">Einpassen</button><button class="secondary" id="undo" disabled>↶ Rückgängig</button><button class="secondary" id="redo" disabled>↷ Wiederholen</button><button class="secondary" id="add-layer">＋ Ebene</button></div><span id="active-tool-label" class="tool-status" aria-live="polite">Aktives Werkzeug: Auswählen</span><span class="scale-readout">${metricReady ? `Fläche ${Math.round(areaWidth)} × ${Math.round(areaHeight)} mm` : "Maßstab noch offen"}</span></div>
  <section class="workarea-layout"><aside class="panel workarea-sidebar"><details id="tree-disclosure" open><summary>Objektbaum</summary><div class="tree-content"><h3>Plan</h3><button class="object-row" id="focus-full-plan">Gesamtplan</button><div id="workarea-list"></div><button class="secondary" id="add-workarea">＋ Arbeitsbereich</button><h3 class="objects-title">Ebenen</h3><div id="layer-list"></div><h3 class="objects-title">Objekte</h3><div id="object-list"></div><p class="muted empty-object-hint">Objekte hier antippen, um sie auszuwählen.</p><h3 class="objects-title">Trassen</h3><div id="tray-list"></div><h3 class="objects-title">Kabel</h3><button class="secondary" id="new-cable">＋ Kabel anlegen</button><div id="cable-overview" class="cable-overview" aria-live="polite"></div><div id="cable-list"></div><h3 class="objects-title">Nachweis</h3><div class="acceptance-panel"><select id="acceptance-filter" aria-label="Nachweisfilter"><option value="all">Alle Kabel</option><option value="open">Offen</option><option value="installed">Installiert</option><option value="measured">Gemessen</option><option value="passed">Bestanden</option><option value="failed">Fehler</option></select><button class="secondary" id="acceptance-export">JSON exportieren</button><div id="acceptance-summary" class="acceptance-summary" aria-live="polite"></div><div id="acceptance-list"></div></div><h3 class="objects-title">Kameras</h3><div id="camera-list"></div></div></details></aside>
  <div class="panel workarea-stage"><div class="canvas-wrap" id="canvas-wrap"></div><p class="muted canvas-help">${metricReady ? "Tippe auf die Fläche, um ein Objekt zu setzen. Ziehe Objekte zum Verschieben." : "Lege Flächenmaße fest oder kalibriere zuerst den Grundriss, damit Positionen maßstäblich sind."}</p></div>
  <aside class="panel workarea-properties" id="properties"><details id="properties-disclosure" open><summary>Eigenschaften</summary><div id="properties-content"><p class="muted">Wähle ein Element aus, um seine Eigenschaften zu bearbeiten.</p></div></details></aside></section>`;
  // Wrap existing sidebar sections, keeping their stable IDs and event bindings.
  const sidebar = root.querySelector(".workarea-sidebar");
  const sectionGroups = ["plan", "layers", "objects", "trays", "cables", "measure", "cameras"];
  let sectionIndex = -1, section = null;
  for (const child of [...sidebar.querySelector(".tree-content").children]) {
    if (child.tagName === "H3") {
      section = document.createElement("section");
      section.dataset.uiSection = sectionGroups[++sectionIndex];
      child.parentElement.insertBefore(section, child);
    }
    section?.append(child);
  }
  const mobilePanels = window.matchMedia("(max-width: 560px)").matches;
  root.querySelector("#tree-disclosure").open = !mobilePanels;
  root.querySelector("#properties-disclosure").open = !mobilePanels;
  const svg = createSvgElement("svg", { class: "plan-svg", viewBox: `0 0 ${viewWidth} ${viewHeight}`, role: "img", "aria-label": "Maßstäbliche 2D-Baustellenfläche" });
  function requiredGroups() {
    if (activeTool === "place") return ["objects"];
    if (activeTool === "camera") return ["cameras"];
    if (activeTool === "tray") return ["trays"];
    if (activeTool === "cable") return ["cables", "trays"];
    if (activeTool === "measure") return ["cables"];
    return activeGroup === "all" ? ["objects", "cameras", "trays", "cables"] : [activeGroup];
  }
  function groupVisible(group) { return requiredGroups().includes(group); }
  function groupEditable(group) { return ["select", "edit"].includes(activeTool) && (activeGroup === "all" || activeGroup === group); }
  const activities = {
    all: [["select", "Auswählen"], ["pan", "Ansicht verschieben"], ["place", "Objekt platzieren"], ["camera", "Kamera platzieren"], ["tray", "Trasse zeichnen"], ["cable", "Kabel zuordnen"], ["measure", "Prüfen / Messnachweis"]],
    objects: [["select", "Auswählen"], ["pan", "Ansicht verschieben"], ["place", "Objekt platzieren"]],
    cameras: [["select", "Auswählen"], ["pan", "Ansicht verschieben"], ["camera", "Kamera platzieren"]],
    trays: [["select", "Auswählen"], ["pan", "Ansicht verschieben"], ["tray", "Trasse zeichnen"]],
    cables: [["select", "Auswählen"], ["pan", "Ansicht verschieben"], ["cable", "Kabel zuordnen"], ["measure", "Prüfen / Messnachweis"]],
  };
  function syncActionOptions() {
    const select = root.querySelector("#workarea-action");
    const choices = activities[activeGroup] || activities.all;
    select.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
    const displayedTool = activeTool === "edit" ? "select" : activeTool;
    select.value = choices.some(([value]) => value === displayedTool) ? displayedTool : "select";
  }
  function applyModeUI() {
    const selecting = ["select", "edit"].includes(activeTool);
    for (const block of sidebar.querySelectorAll("[data-ui-section]")) {
      const group = block.dataset.uiSection;
      block.hidden = group === "plan" ? false : activeTool === "pan" || (group === "measure" ? activeTool !== "measure" : group === "layers" ? activeTool === "measure" : !requiredGroups().includes(group));
    }
    root.querySelector("#finish-tray").hidden = activeTool !== "tray";
    root.querySelector("#cancel-tool").hidden = activeTool !== "tray";
    root.querySelector("#add-layer").hidden = activeTool === "pan" || activeTool === "measure";
    root.querySelector("#workarea-group").value = activeGroup;
    root.querySelector("#workarea-group").disabled = Boolean(draftTrayPoints?.length);
    root.querySelector("#workarea-action").disabled = Boolean(draftTrayPoints?.length);
    syncActionOptions();
    root.querySelector("#new-cable").hidden = activeTool !== "cable";
    root.querySelector("#properties").hidden = activeTool === "pan";
    objectLayer.style.pointerEvents = groupEditable("objects") ? "auto" : "none";
    cameraLayer.style.pointerEvents = groupEditable("cameras") ? "auto" : "none";
    trayLayer.style.pointerEvents = groupEditable("trays") ? "auto" : "none";
    workAreaLayer.style.pointerEvents = activeTool === "select" ? "auto" : "none";
    for (const [group, id] of [["objects", "object-list"], ["cameras", "camera-list"], ["trays", "tray-list"]]) {
      root.querySelectorAll(`#${id} button`).forEach(button => button.disabled = !groupEditable(group));
    }
    root.querySelector(".canvas-help").textContent = !metricReady ? "Lege Flächenmaße fest oder kalibriere zuerst den Grundriss." : activeTool === "pan" ? "Ziehe den Plan, um die Ansicht zu verschieben." : activeTool === "tray" ? "Setze Verlaufspunkte. Abschließen speichert, Abbrechen verwirft den Entwurf." : activeTool === "place" || activeTool === "camera" ? "Tippe auf den Plan, um das gewählte Element zu platzieren." : activeTool === "edit" ? "Bearbeite das ausgewählte Element." : activeTool === "measure" ? "Wähle ein Kabel für seinen Messnachweis." : "Tippe zum Auswählen. Ziehe Elemente der gewählten Fachgruppe zum Verschieben.";
  }
  function updateViewBox() { const width = viewWidth / zoom, height = viewHeight / zoom; svg.setAttribute("viewBox", `${viewCenterX - width / 2} ${viewCenterY - height / 2} ${width} ${height}`); }
  function screenPointToSvg(clientX, clientY) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }
  function visibleSvgRect() {
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !svg.getScreenCTM()) {
      const width = viewWidth / zoom;
      const height = viewHeight / zoom;
      return { x: viewCenterX - width / 2, y: viewCenterY - height / 2, width, height };
    }
    const points = [
      screenPointToSvg(bounds.left, bounds.top),
      screenPointToSvg(bounds.right, bounds.top),
      screenPointToSvg(bounds.right, bounds.bottom),
      screenPointToSvg(bounds.left, bounds.bottom),
    ];
    const xs = points.map(point => point.x).filter(Number.isFinite);
    const ys = points.map(point => point.y).filter(Number.isFinite);
    if (!xs.length || !ys.length) {
      const width = viewWidth / zoom;
      const height = viewHeight / zoom;
      return { x: viewCenterX - width / 2, y: viewCenterY - height / 2, width, height };
    }
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
  }
  function currentVisibleWorkAreaBounds() {
    const visible = visibleSvgRect();
    const visibleLeft = minX + visible.x;
    const visibleBottom = yTop - (visible.y + visible.height);
    return {
      xMm: Math.round(visibleLeft),
      yMm: Math.round(visibleBottom),
      widthMm: Math.max(1, Math.round(visible.width)),
      heightMm: Math.max(1, Math.round(visible.height)),
    };
  }
  function focusFullPlan({ save = true } = {}) { zoom = 1; viewCenterX = viewWidth / 2; viewCenterY = viewHeight / 2; project.workspace.activeWorkAreaId = null; selectedWorkAreaId = null; updateViewBox(); drawWorkAreas(); drawLists(); if (save) persist(); }
  function focusWorkArea(area, { save = true } = {}) {
    if (!area) return focusFullPlan({ save });
    const targetWidth = Math.max(1, number(area.widthMm));
    const targetHeight = Math.max(1, number(area.heightMm));
    viewCenterX = number(area.xMm) + targetWidth / 2 - minX;
    viewCenterY = yTop - (number(area.yMm) + targetHeight / 2);
    zoom = Math.max(0.5, Math.min(MAX_ZOOM, Math.min(viewWidth / targetWidth, viewHeight / targetHeight)));
    project.workspace.activeWorkAreaId = area.id;
    selectedWorkAreaId = area.id;
    updateViewBox(); drawWorkAreas(); drawLists(); if (save) persist();
  }
  const defs = createSvgElement("defs");
  const pattern = createSvgElement("pattern", { id: "work-grid", width: 1000, height: 1000, patternUnits: "userSpaceOnUse" });
  pattern.append(createSvgElement("path", { d: "M 1000 0 L 0 0 0 1000", fill: "none", stroke: "#dbe3ec", "stroke-width": 12 }));
  defs.append(pattern); svg.append(defs);
  svg.append(createSvgElement("rect", { x: 0, y: 0, width: viewWidth, height: viewHeight, fill: "#f8fafc" }));
  if (metricReady) svg.append(createSvgElement("rect", { x: areaLeft - minX, y: yTop - (areaBottom + areaHeight), width: areaWidth, height: areaHeight, fill: "url(#work-grid)", stroke: "#2672c9", "stroke-width": 24 }));
  if (assetUrl && scale) svg.append(createSvgElement("image", { href: assetUrl, x: imageLeft - minX, y: yTop - imageTop, width: imageWidth, height: imageHeight, opacity: 0.72, preserveAspectRatio: "none", "pointer-events": "none" }));
  if (assetUrl && !scale) svg.append(createSvgElement("image", { href: assetUrl, x: areaLeft - minX, y: yTop - (areaBottom + areaHeight), width: areaWidth, height: areaHeight, opacity: 0.55, preserveAspectRatio: "xMidYMid meet", "pointer-events": "none" }));
  if (assetUrl && metricReady) svg.append(createSvgElement("rect", { x: areaLeft - minX, y: yTop - (areaBottom + areaHeight), width: areaWidth, height: areaHeight, fill: "none", stroke: "#2672c9", "stroke-width": 24, "pointer-events": "none" }));
  if (!assetUrl) {
    const grid = createSvgElement("rect", { x: 0, y: 0, width: viewWidth, height: viewHeight, fill: "url(#work-grid)" });
    svg.append(grid);
    svg.append(createSvgElement("rect", { x: areaLeft - minX, y: yTop - (areaBottom + areaHeight), width: areaWidth, height: areaHeight, fill: "transparent", stroke: "#2672c9", "stroke-width": 24 }));
  }
  const workAreaLayer = createSvgElement("g", { class: "plan-workareas" }); svg.append(workAreaLayer);
  const trayLayer = createSvgElement("g", { class: "plan-trays" }); svg.append(trayLayer);
  const cameraLayer = createSvgElement("g", { class: "plan-cameras" }); svg.append(cameraLayer);
  const objectLayer = createSvgElement("g", { class: "plan-objects" }); svg.append(objectLayer);
  if (metricReady) { const ruler = createSvgElement("g", { class: "scale-bar", "pointer-events": "none" }); const x = Math.max(20, viewWidth - 1400), y = viewHeight - 250; ruler.append(createSvgElement("path", { d: `M ${x} ${y} h 1000 m -1000 -90 v 180 m 1000 -180 v 180`, stroke: "#17202b", "stroke-width": 28, fill: "none" })); const label = createSvgElement("text", { x: x + 500, y: y - 120, "text-anchor": "middle", "font-size": 220, fill: "#17202b" }); label.textContent = "1 m"; ruler.append(label); svg.append(ruler); }
  root.querySelector("#canvas-wrap").append(svg);

  function record(next) {
    history.splice(historyIndex + 1);
    history.push(clone(next)); historyIndex = history.length - 1;
    project.objects = next.objects; project.layers = next.layers; project.workspace = next.workspace; project.modules = next.modules; ensurePlanningData(project); electrical = ensureElectricalData(project); cameraData = ensureCameraData(project);
    if (!project.workspace.workAreas.some(area => area.id === selectedWorkAreaId)) selectedWorkAreaId = project.workspace.activeWorkAreaId;
    updateHistoryButtons(); drawWorkAreas(); drawObjects(); drawTrays(); drawCameras(); drawLists(); drawProperties();
    persist();
  }
  function persist() { onSave?.(clone(project)); }
  function updateHistoryButtons() {
    root.querySelector("#undo").disabled = historyIndex <= 0;
    root.querySelector("#redo").disabled = historyIndex >= history.length - 1;
  }
  function toWorld(event) {
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    const at = p.matrixTransform(svg.getScreenCTM().inverse());
    return { xMm: at.x + minX, yMm: yTop - at.y };
  }
  function resultLabel(result) {
    const normalized = normalizeMeasurementResult(result);
    if (normalized === "pass") return "PASS / bestanden";
    if (normalized === "fail") return "FAIL / Fehler";
    return "OPEN / offen";
  }
  function cableStatusLabel(status) {
    return ({ planned: "planned", installed: "installed", measured: "measured", passed: "passed", failed: "failed" })[status] || status;
  }
  function measurementSummary(measurement) {
    if (!measurement) return "Noch keine Messung";
    const lengthM = measurementLengthM(measurement);
    const parts = [
      measurement.device || "Messgerät offen",
      lengthM === null ? "Länge offen" : `${lengthM} m`,
      resultLabel(measurement.result),
    ];
    if (measurement.measuredAt) parts.push(new Date(measurement.measuredAt).toLocaleString());
    if (measurement.note) parts.push(measurement.note);
    return parts.join(" · ");
  }
  function toDateTimeLocal(value) {
    const date = value ? new Date(value) : new Date();
    if (!Number.isFinite(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  function downloadTextFile(name, text, type = "application/json;charset=utf-8") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function renderAcceptance() {
    const report = buildAcceptanceReport(project);
    const filter = root.querySelector("#acceptance-filter")?.value || "all";
    const summary = root.querySelector("#acceptance-summary");
    const list = root.querySelector("#acceptance-list");
    if (!summary || !list) return;
    summary.textContent = `Gesamt ${report.summary.totalCables} · Offen ${report.summary.open} · Installiert ${report.summary.installed} · Gemessen ${report.summary.measured} · Bestanden ${report.summary.passed} · Fehler ${report.summary.failed}`;
    list.replaceChildren();
    const items = report.items.filter(item => filter === "all" || item.status === filter);
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "muted acceptance-empty";
      empty.textContent = "Keine Kabel für diesen Filter.";
      list.append(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement("button");
      row.className = `object-row acceptance-row status-${item.status}`;
      row.type = "button";
      row.textContent = `${item.cableId} · ${cableStatusLabel(item.status)}${item.cameraName ? ` · ${item.cameraName}` : ""}`;
      row.title = `${item.source} → ${item.target}${item.latestMeasurement ? ` · ${measurementSummary(item.latestMeasurement)}` : " · keine Messung"}${item.trayIds.length ? "" : " · keine Trasse"}`;
      row.onclick = () => {
        const cable = electrical.cables.find(candidate => candidate.id === item.cableId);
        if (cable) drawCableProperties(cable);
      };
      list.append(row);
    }
  }
  function drawWorkAreas() {
    workAreaLayer.replaceChildren();
    for (const area of project.workspace.workAreas) {
      const x = number(area.xMm) - minX;
      const y = yTop - (number(area.yMm) + number(area.heightMm));
      const active = area.id === project.workspace.activeWorkAreaId;
      const selected = area.id === selectedWorkAreaId;
      const group = createSvgElement("g", { class: `plan-workarea${active ? " is-active" : ""}${selected ? " is-selected" : ""}`, "data-workarea-id": area.id, tabindex: 0, role: "button", "aria-label": `Arbeitsbereich ${area.name}` });
      group.append(createSvgElement("rect", { x, y, width: number(area.widthMm), height: number(area.heightMm), rx: 140, fill: active ? "#2f80ed" : "#38bdf8", opacity: active ? ".12" : ".08", stroke: selected ? "#f59e0b" : "#0284c7", "stroke-width": selected ? 90 : 55, "pointer-events": "all" }));
      const label = createSvgElement("text", { x: x + 180, y: y + 320, "font-size": 260, fill: "#075985", "font-weight": 800, "pointer-events": "none" });
      label.textContent = area.name;
      group.append(label);
      workAreaLayer.append(group);
    }
  }
  function drawObjects() {
    objectLayer.replaceChildren();
    if (!groupVisible("objects")) return;
    for (const object of project.objects) {
      const layer = project.layers.find(item => item.id === object.layerId);
      if (layer?.visible === false) continue;
      const w = Math.max(300, number(object.widthMm) || 700), h = Math.max(300, number(object.depthMm) || 500);
      const cx = number(object.xMm) - minX, cy = yTop - number(object.yMm);
      const group = createSvgElement("g", { class: `plan-object${object.id === selectedId ? " is-selected" : ""}`, "data-object-id": object.id, transform: `rotate(${-number(object.rotationDeg)} ${cx} ${cy})`, tabindex: 0, role: "button", "aria-label": object.name || "Planobjekt" });
      group.append(createSvgElement("rect", { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: Math.min(w, h) * 0.12, fill: object.id === selectedId ? "#f59e0b" : "#1565c0", stroke: "#fff", "stroke-width": 60 }));
      const label = createSvgElement("text", { x: cx, y: cy + 55, "text-anchor": "middle", "font-size": Math.max(250, Math.min(w, h) * 0.35), fill: "white", "pointer-events": "none" }); label.textContent = object.name || "Objekt"; group.append(label); objectLayer.append(group);
    }
  }
  function drawCameras() {
    cameraLayer.replaceChildren();
    if (!groupVisible("cameras")) return;
    for (const camera of cameraData.cameras) {
      const layer = project.layers.find(item => item.id === camera.layerId);
      if (layer?.visible === false) continue;
      const cx = number(camera.xMm) - minX, cy = yTop - number(camera.yMm);
      const fov = cameraFovPolygon(camera);
      if (fov.length && camera.id === selectedCameraId && ["edit", "camera"].includes(activeTool)) {
        const points = fov.map(point => `${point.xMm - minX},${yTop - point.yMm}`).join(" ");
        cameraLayer.append(createSvgElement("polygon", { class: `camera-fov${camera.id === selectedCameraId ? " is-selected" : ""}`, points, fill: "#2f80ed", stroke: "#1558ad", "stroke-width": 40, opacity: camera.id === selectedCameraId ? ".28" : ".16", "pointer-events": "none" }));
      }
      const group = createSvgElement("g", { class: `plan-camera${camera.id === selectedCameraId ? " is-selected" : ""}`, "data-camera-id": camera.id, transform: `rotate(${-number(camera.rotationDeg)} ${cx} ${cy})`, tabindex: 0, role: "button", "aria-label": camera.name || "Kamera" });
      group.append(createSvgElement("circle", { cx, cy, r: 190, fill: camera.id === selectedCameraId ? "#f59e0b" : "#0f766e", stroke: "#fff", "stroke-width": 55 }));
      group.append(createSvgElement("path", { d: `M ${cx} ${cy} L ${cx + 430} ${cy}`, stroke: "#063d39", "stroke-width": 70, "stroke-linecap": "round", "pointer-events": "none" }));
      const label = createSvgElement("text", { x: cx, y: cy - 300, "text-anchor": "middle", "font-size": 230, fill: "#0f172a", "pointer-events": "none" }); label.textContent = camera.name || "Kamera"; group.append(label);
      cameraLayer.append(group);
    }
  }
  function drawTrays() {
    trayLayer.replaceChildren();
    if (!groupVisible("trays")) return;
    for (const tray of electrical.trays) {
      const layer = project.layers.find(item => item.id === tray.layerId);
      if (layer?.visible === false || tray.points.length < 2) continue;
      const coords = tray.points.map(point => `${point.xMm - minX},${yTop - point.yMm}`).join(" ");
      const group = createSvgElement("g", { class: "electrical-tray", "data-tray-id": tray.id, tabindex: 0, role: "button", "aria-label": tray.name });
      group.append(createSvgElement("polyline", { points: coords, fill: "none", stroke: tray.id === selectedTrayId ? "#f59e0b" : "#d04a3a", "stroke-width": Math.max(100, tray.widthMm), "stroke-linecap": "round", "stroke-linejoin": "round", opacity: ".62" }));
      if (activeTool === "edit" && tray.id === selectedTrayId && groupEditable("trays")) tray.points.forEach((point, index) => group.append(createSvgElement("circle", { cx: point.xMm - minX, cy: yTop - point.yMm, r: 180, fill: "white", stroke: "#a83226", "stroke-width": 55, "data-tray-point": index, "data-tray-id": tray.id, class: "tray-point" })));
      trayLayer.append(group);
    }
    if (draftTrayPoints?.length) {
      const coords = draftTrayPoints.map(point => `${point.xMm - minX},${yTop - point.yMm}`).join(" ");
      trayLayer.append(createSvgElement("polyline", { points: coords, fill: "none", stroke: "#d04a3a", "stroke-width": 120, "stroke-dasharray": "250 160", "pointer-events": "none" }));
      draftTrayPoints.forEach(point => trayLayer.append(createSvgElement("circle", { cx: point.xMm - minX, cy: yTop - point.yMm, r: 180, fill: "white", stroke: "#a83226", "stroke-width": 55, "pointer-events": "none" })));
    }
  }
  function drawLists() {
    applyModeUI();
    const fullPlan = root.querySelector("#focus-full-plan");
    fullPlan.className = "object-row" + (!project.workspace.activeWorkAreaId ? " active" : "");
    fullPlan.onclick = () => { selectedWorkAreaId = null; selectedId = null; selectedCameraId = null; selectedTrayId = null; focusFullPlan(); drawProperties(); };
    const workAreaList = root.querySelector("#workarea-list"); workAreaList.replaceChildren();
    for (const area of project.workspace.workAreas) {
      const button = document.createElement("button");
      button.className = "object-row" + (area.id === selectedWorkAreaId ? " active" : "");
      button.textContent = `${area.name} · ${(number(area.widthMm) / 1000).toFixed(1)}×${(number(area.heightMm) / 1000).toFixed(1)} m`;
      button.title = `X ${Math.round(number(area.xMm))} mm · Y ${Math.round(number(area.yMm))} mm`;
      button.onclick = () => { selectedWorkAreaId = area.id; selectedId = null; selectedCameraId = null; selectedTrayId = null; focusWorkArea(area); drawProperties(); };
      workAreaList.append(button);
    }
    const layers = root.querySelector("#layer-list"); layers.replaceChildren();
    for (const layer of project.layers) {
      const row = document.createElement("div"); row.className = `layer-row${layer.id === activeLayerId ? " active" : ""}`;
      const choose = document.createElement("button"); choose.className = "layer-choice"; choose.textContent = layer.name; choose.onclick = () => { activeLayerId = layer.id; drawLists(); drawObjects(); drawCameras(); };
      const height = document.createElement("input"); height.type = "number"; height.step = "1"; height.value = layer.elevationMm; height.setAttribute("aria-label", `Höhe ${layer.name} in mm`); height.onchange = () => { const next = clone(project); const target = next.layers.find(item => item.id === layer.id); target.elevationMm = number(height.value); for (const obj of next.objects.filter(item => item.layerId === layer.id)) obj.zMm = target.elevationMm; for (const camera of ensureCameraData(next).cameras.filter(item => item.layerId === layer.id)) camera.zMm = target.elevationMm; record(next); };
      const visible = document.createElement("input"); visible.type = "checkbox"; visible.checked = layer.visible !== false; visible.setAttribute("aria-label", `Ebene ${layer.name} sichtbar`); visible.onchange = () => { const next = clone(project); next.layers.find(item => item.id === layer.id).visible = visible.checked; record(next); };
      row.append(choose, height, visible); layers.append(row);
    }
    const list = root.querySelector("#object-list"); list.replaceChildren();
    for (const object of project.objects) {
      const layer = project.layers.find(item => item.id === object.layerId);
      const button = document.createElement("button");
      button.className = "object-row" + (object.id === selectedId ? " active" : "");
      button.textContent = object.name || "Planobjekt";
      button.title = "Ebene: " + (layer?.name || "Unbekannt") + (layer?.visible === false ? " · ausgeblendet" : "");
      button.onclick = () => { selectedId = object.id; selectedCameraId = null; selectedTrayId = null; selectedWorkAreaId = null; activeLayerId = object.layerId; drawLists(); drawObjects(); drawCameras(); drawTrays(); drawWorkAreas(); drawProperties(); };
      list.append(button);
    }
    root.querySelector(".empty-object-hint").hidden = project.objects.length > 0;
    const trayList = root.querySelector("#tray-list"); trayList.replaceChildren();
    for (const tray of electrical.trays) { const button = document.createElement("button"); button.className = "object-row"; button.textContent = `${tray.name} · ${(polylineLengthMm(tray.points) / 1000).toFixed(2)} m`; button.onclick = () => { selectedTrayId = tray.id; selectedId = null; selectedCameraId = null; selectedWorkAreaId = null; drawTrays(); drawCameras(); drawWorkAreas(); drawLists(); drawProperties(); }; trayList.append(button); }
    const overview = root.querySelector("#cable-overview"); const summary = cableStatusSummary(electrical.cables);
    overview.textContent = `Offen ${summary.open} · gemessen ${summary.measured} · bestanden ${summary.passed} · Fehler ${summary.failed}`;
    const cableList = root.querySelector("#cable-list"); cableList.replaceChildren();
    for (const cable of electrical.cables) { const button = document.createElement("button"); button.className = "object-row"; const length = plannedCableLengthMm(electrical, cable); const latest = cable.measurements?.at(-1); button.textContent = `${cable.id} · ${cableStatusLabel(deriveCableStatus(cable))}${length === null ? "" : ` · ${(length / 1000).toFixed(2)} m`}`; button.title = `${cable.source.name}:${cable.source.port} → ${cable.target.name}:${cable.target.port}${latest ? ` · ${measurementSummary(latest)}` : ""}`; button.onclick = () => { selectedTrayId = null; selectedId = null; selectedCameraId = null; selectedWorkAreaId = null; drawWorkAreas(); drawCableProperties(cable); drawCameras(); }; cableList.append(button); }
    renderAcceptance();
    const cameraList = root.querySelector("#camera-list"); cameraList.replaceChildren();
    for (const camera of cameraData.cameras) {
      const button = document.createElement("button");
      button.className = "object-row" + (camera.id === selectedCameraId ? " active" : "");
      button.textContent = `${camera.name || camera.id} · ${Math.round(number(camera.rangeMm) / 1000)} m`;
      button.onclick = () => { selectedCameraId = camera.id; selectedTrayId = null; selectedId = null; selectedWorkAreaId = null; activeLayerId = camera.layerId; drawLists(); drawCameras(); drawWorkAreas(); drawProperties(); };
      cameraList.append(button);
    }
    applyModeUI();
  }
  function drawProperties() {
    const panelContext = root.querySelector("#properties-content");
    if (["place", "camera", "tray"].includes(activeTool)) {
      panelContext.innerHTML = `<h3>${activeTool === "tray" ? "Trasse zeichnen" : activeTool === "camera" ? "Kamera platzieren" : "Objekt platzieren"}</h3><p class="muted">Aktive Ebene: ${esc(project.layers.find(layer => layer.id === activeLayerId)?.name || "Boden")}. ${activeTool === "tray" ? "Neue Trasse: 200 mm Breite. Danach unter Bearbeiten anpassen." : "Nach dem Setzen können die Eigenschaften unter Bearbeiten angepasst werden."}</p>`;
      return;
    }
    if (activeTool === "pan") { panelContext.replaceChildren(); return; }
    if (activeTool === "select" && selectedCableId && !selectedId && !selectedCameraId && !selectedTrayId && !selectedWorkAreaId) {
      const cable = electrical.cables.find(item => item.id === selectedCableId);
      if (cable) return drawCableProperties(cable);
    }
    if (activeTool === "cable" || activeTool === "measure") {
      const cable = electrical.cables.find(item => item.id === selectedCableId);
      if (cable) return drawCableProperties(cable);
      panelContext.innerHTML = '<h3>Kabel auswählen</h3><p class="muted">Wähle ein Kabel aus der Liste.</p>';
      return;
    }
    if (activeTool === "select" && !(selectedWorkAreaId && !selectedId && !selectedCameraId && !selectedTrayId)) {
      const selected = project.objects.find(item => item.id === selectedId) || cameraData.cameras.find(item => item.id === selectedCameraId) || electrical.trays.find(item => item.id === selectedTrayId);
      panelContext.innerHTML = selected ? `<h3>${esc(selected.name || selected.id)}</h3><p class="muted">${selected.points ? `${selected.points.length} Verlaufspunkte` : `X ${number(selected.xMm)} mm · Y ${number(selected.yMm)} mm · Drehung ${number(selected.rotationDeg)}°`}</p><button class="secondary" id="open-edit">Bearbeiten</button>` : '<h3>Auswahl</h3><p class="muted">Wähle ein Element der aktiven Fachgruppe.</p>';
      const editButton = panelContext.querySelector("#open-edit");
      if (editButton) editButton.onclick = () => setTool("edit");
      return;
    }
    if (selectedWorkAreaId && !selectedId && !selectedCameraId && !selectedTrayId) {
      const area = project.workspace.workAreas.find(item => item.id === selectedWorkAreaId);
      if (!area) { selectedWorkAreaId = null; return drawProperties(); }
      return drawWorkAreaProperties(area);
    }
    if (selectedCameraId) {
      const camera = cameraData.cameras.find(item => item.id === selectedCameraId);
      if (!camera) { selectedCameraId = null; return drawProperties(); }
      return drawCameraProperties(camera);
    }
    if (selectedTrayId) {
      const tray = electrical.trays.find(item => item.id === selectedTrayId), panel = root.querySelector("#properties-content");
      if (!tray) { selectedTrayId = null; return drawProperties(); }
      panel.innerHTML = `<h3>Trasseneigenschaften</h3><label>Bezeichnung<input name="name" value="${esc(tray.name)}"></label><label>Breite · mm<input name="widthMm" type="number" min="1" value="${tray.widthMm}"></label><label>Ebene<select name="layerId">${project.layers.map(layer => `<option value="${esc(layer.id)}" ${layer.id === tray.layerId ? "selected" : ""}>${esc(layer.name)} · ${layer.elevationMm} mm</option>`).join("")}</select></label><p class="muted">Geplante Länge: ${(polylineLengthMm(tray.points) / 1000).toFixed(2)} m · ${tray.points.length} Punkte. Verlaufspunkte direkt im Plan ziehen.</p><button class="secondary danger" id="delete-tray">Trasse löschen</button>`;
      panel.querySelectorAll("input,select").forEach(input => input.onchange = () => { const next = clone(project), target = next.modules.electrical.trays.find(item => item.id === tray.id); target[input.name] = input.name === "widthMm" ? Number(input.value) : input.value; record(next); });
      panel.querySelector("#delete-tray").onclick = () => { const next = clone(project); next.modules.electrical.trays = next.modules.electrical.trays.filter(item => item.id !== tray.id); next.modules.electrical.cables.forEach(cable => cable.trayIds = cable.trayIds.filter(id => id !== tray.id)); selectedTrayId = null; record(next); };
      return;
    }
    const panel = root.querySelector("#properties-content"); const object = project.objects.find(item => item.id === selectedId);
    if (!object) { panel.innerHTML = '<h3>Eigenschaften</h3><p class="muted">Wähle ein Objekt aus, um seine Lage und Ebene zu bearbeiten.</p>'; return; }
    panel.innerHTML = `<h3>Objekt-Eigenschaften</h3><label>Name<input name="name" maxlength="80" value="${esc(object.name)}"></label><div class="form-row"><label>X · mm<input name="xMm" type="number" step="1" value="${number(object.xMm)}"></label><label>Y · mm<input name="yMm" type="number" step="1" value="${number(object.yMm)}"></label></div><div class="form-row"><label>Breite · mm<input name="widthMm" type="number" min="1" step="1" value="${number(object.widthMm) || 700}"></label><label>Tiefe · mm<input name="depthMm" type="number" min="1" step="1" value="${number(object.depthMm) || 500}"></label></div><label>Drehung · °<input name="rotationDeg" type="number" step="1" value="${number(object.rotationDeg)}"></label><label>Ebene<select name="layerId">${project.layers.map(layer => `<option value="${esc(layer.id)}" ${layer.id === object.layerId ? "selected" : ""}>${esc(layer.name)} · ${number(layer.elevationMm)} mm</option>`).join("")}</select></label><p class="muted">Höhe Z: ${number(project.layers.find(layer => layer.id === object.layerId)?.elevationMm)} mm</p><button class="secondary danger" id="delete-object">Objekt löschen</button>`;
    panel.querySelectorAll("input,select").forEach(input => input.addEventListener("change", () => { const next = clone(project); const target = next.objects.find(item => item.id === selectedId); target[input.name] = input.name === "name" || input.name === "layerId" ? input.value : number(input.value); if (input.name === "layerId") target.zMm = next.layers.find(layer => layer.id === input.value)?.elevationMm || 0; record(next); }));
    panel.querySelector("#delete-object").onclick = () => { const next = clone(project); next.objects = next.objects.filter(item => item.id !== selectedId); selectedId = null; record(next); };
  }
  function drawWorkAreaProperties(area) {
    const panel = root.querySelector("#properties-content");
    panel.innerHTML = `<h3>Arbeitsbereich</h3><label>Name<input name="name" maxlength="80" value="${esc(area.name)}"></label><div class="form-row"><label>X · mm<input name="xMm" type="number" step="1" value="${number(area.xMm)}"></label><label>Y · mm<input name="yMm" type="number" step="1" value="${number(area.yMm)}"></label></div><div class="form-row"><label>Breite · mm<input name="widthMm" type="number" min="1" step="1" value="${number(area.widthMm)}"></label><label>Höhe · mm<input name="heightMm" type="number" min="1" step="1" value="${number(area.heightMm)}"></label></div><label>Notiz<input name="note" value="${esc(area.note)}"></label><p class="muted">Arbeitsbereiche fokussieren nur den Ausschnitt. Objekte, Trassen, Kabel und Kameras bleiben im globalen Koordinatensystem.</p><div class="property-actions"><button class="secondary" id="focus-workarea">Ausschnitt fokussieren</button><button class="secondary danger" id="delete-workarea">Arbeitsbereich löschen</button></div>`;
    panel.querySelectorAll("input").forEach(input => input.addEventListener("change", () => {
      const next = clone(project);
      const target = next.workspace.workAreas.find(item => item.id === area.id);
      target[input.name] = input.name === "name" || input.name === "note" ? input.value : number(input.value);
      if (input.name === "widthMm" || input.name === "heightMm") target[input.name] = Math.max(1, target[input.name]);
      record(next);
      const updated = project.workspace.workAreas.find(item => item.id === area.id);
      if (project.workspace.activeWorkAreaId === area.id) focusWorkArea(updated, { save: false });
    }));
    panel.querySelector("#focus-workarea").onclick = () => focusWorkArea(area);
    panel.querySelector("#delete-workarea").onclick = () => {
      const next = clone(project);
      next.workspace.workAreas = next.workspace.workAreas.filter(item => item.id !== area.id);
      if (next.workspace.activeWorkAreaId === area.id) next.workspace.activeWorkAreaId = null;
      selectedWorkAreaId = null;
      record(next);
      focusFullPlan({ save: false });
      drawProperties();
    };
  }
  function drawCameraProperties(camera) {
    const panel = root.querySelector("#properties-content");
    const cableOptions = electrical.cables.map(cable => `<option value="${esc(cable.id)}" ${camera.cableId === cable.id ? "selected" : ""}>${esc(cable.id)} · ${esc(cable.name)}</option>`).join("");
    const linkedCable = electrical.cables.find(cable => cable.id === camera.cableId);
    const cableHint = linkedCable ? `<p class="measurement-status" role="status">Kabelstatus ${esc(linkedCable.id)}: ${esc(cableStatusLabel(deriveCableStatus(linkedCable)))} · ${esc(measurementSummary(linkedCable.measurements?.at(-1)))}</p>` : `<p class="electrical-diagnostic" role="status">Noch keinem Kabel zugeordnet.</p>`;
    panel.innerHTML = `<h3>Kamera-Eigenschaften</h3><label>Name<input name="name" maxlength="80" value="${esc(camera.name)}"></label><label>Typ<select name="type">${CAMERA_TYPES.map(type => `<option value="${type}" ${type === camera.type ? "selected" : ""}>${type}</option>`).join("")}</select></label><div class="form-row"><label>X · mm<input name="xMm" type="number" step="1" value="${number(camera.xMm)}"></label><label>Y · mm<input name="yMm" type="number" step="1" value="${number(camera.yMm)}"></label></div><div class="form-row"><label>Drehung · °<input name="rotationDeg" type="number" step="1" value="${number(camera.rotationDeg)}"></label><label>Reichweite · m<input name="rangeM" type="number" min="0.001" step="0.1" value="${number(camera.rangeMm) / 1000}"></label></div><div class="form-row"><label>Sichtwinkel · °<input name="fovDeg" type="number" min="1" max="179" step="1" value="${number(camera.fovDeg)}"></label><label>Montagehöhe · m<input name="mountingHeightM" type="number" min="0" step="0.1" value="${number(camera.mountingHeightMm) / 1000}"></label></div><label>Montageort<input name="mountingLocation" value="${esc(camera.mountingLocation)}" placeholder="Wand, Decke, Mast ..."></label><label>Verknüpftes Kabel<select name="cableId"><option value="" ${!camera.cableId ? "selected" : ""}>Noch nicht zugeordnet</option>${cableOptions}</select></label><label>Ebene<select name="layerId">${project.layers.map(layer => `<option value="${esc(layer.id)}" ${layer.id === camera.layerId ? "selected" : ""}>${esc(layer.name)} · ${number(layer.elevationMm)} mm</option>`).join("")}</select></label><label>Notiz<input name="note" value="${esc(camera.note)}"></label>${cableHint}<p class="muted">FOV: ${(number(camera.rangeMm) / 1000).toFixed(1)} m Reichweite · ${number(camera.fovDeg)}° horizontal.</p><button class="secondary danger" id="delete-camera">Kamera löschen</button>`;
    panel.querySelectorAll("input,select").forEach(input => input.addEventListener("change", () => {
      const next = clone(project);
      const target = next.modules.camera.cameras.find(item => item.id === selectedCameraId);
      if (input.name === "rangeM") target.rangeMm = Math.round(number(input.value) * 1000);
      else if (input.name === "mountingHeightM") target.mountingHeightMm = Math.round(number(input.value) * 1000);
      else if (input.name === "cableId") target.cableId = input.value || null;
      else if (["xMm", "yMm", "rotationDeg", "fovDeg"].includes(input.name)) target[input.name] = number(input.value);
      else target[input.name] = input.value;
      if (input.name === "layerId") target.zMm = next.layers.find(layer => layer.id === input.value)?.elevationMm || 0;
      record(next);
    }));
    panel.querySelector("#delete-camera").onclick = () => { const next = clone(project); next.modules.camera.cameras = next.modules.camera.cameras.filter(item => item.id !== selectedCameraId); selectedCameraId = null; record(next); };
  }
  function drawCableProperties(cable = null) {
    selectedCableId = cable?.id || null;
    const panel = root.querySelector("#properties-content");
    if (cable && activeTool === "select") {
      panel.innerHTML = `<h3>${esc(cable.id)} · ${esc(cable.name)}</h3><p class="muted">${esc(cable.source.name)}:${esc(cable.source.port)} → ${esc(cable.target.name)}:${esc(cable.target.port)}</p><button class="secondary" id="open-cable-edit">Kabel zuordnen</button>`;
      panel.querySelector("#open-cable-edit").onclick = () => setTool("cable");
      return;
    }
    if (!cable) {
      panel.innerHTML = `<h3>Neues Kabel</h3><form id="cable-form"><label>Kabel-ID<input name="id" required></label><label>Bezeichnung<input name="name" required></label><div class="form-row"><label>Quelle<input name="source" required></label><label>Quell-Port<input name="sourcePort" required></label></div><div class="form-row"><label>Ziel<input name="target" required></label><label>Ziel-Port<input name="targetPort" required></label></div><label>Status<select name="status">${CABLE_STATUSES.map(value => `<option value="${value}">${value}</option>`).join("")}</select></label><label>Trasse<select name="trayId"><option value="">Noch nicht zugeordnet</option>${electrical.trays.map(tray => `<option value="${esc(tray.id)}">${esc(tray.name)}</option>`).join("")}</select></label><button class="primary">Kabel speichern</button></form>`;
      panel.querySelector("#cable-form").onsubmit = event => { event.preventDefault(); const form = new FormData(event.currentTarget), id = String(form.get("id")).trim(); if (electrical.cables.some(item => item.id === id)) { setStatus("Kabel-ID bereits vergeben", "error"); return; } const next = clone(project), item = { id, name: String(form.get("name")).trim(), source: { name: String(form.get("source")).trim(), port: String(form.get("sourcePort")).trim() }, target: { name: String(form.get("target")).trim(), port: String(form.get("targetPort")).trim() }, trayIds: form.get("trayId") ? [String(form.get("trayId"))] : [], status: String(form.get("status")), measurements: [] }; next.modules.electrical.cables.push(item); record(next); drawCableProperties(item); };
      return;
    }
    const plannedLength = plannedCableLengthMm(electrical, cable);
    const effectiveStatus = deriveCableStatus(cable);
    const latest = cable.measurements?.at(-1);
    const diagnostics = [!cable.trayIds.length ? "Noch keiner Trasse zugeordnet." : "", plannedLength === null && cable.trayIds.length ? "Trassenlänge nicht verfügbar." : "", ["measured", "passed", "failed"].includes(cable.status) && !cable.measurements.length ? "Status mit Messbezug, aber Messnachweis fehlt." : "", cable.status !== effectiveStatus && latest ? `Wirksamer Status aus letzter Messung: ${cableStatusLabel(effectiveStatus)}.` : ""].filter(Boolean);
    panel.innerHTML = `<h3>${esc(cable.id)} · ${esc(cable.name)}</h3><p class="muted">${esc(cable.source.name)}:${esc(cable.source.port)} → ${esc(cable.target.name)}:${esc(cable.target.port)}</p><p class="measurement-status" role="status">Wirksamer Kabelstatus: ${esc(cableStatusLabel(effectiveStatus))} · Letzte Messung: ${esc(measurementSummary(latest))}</p><label>Status<select id="cable-status">${CABLE_STATUSES.map(value => `<option value="${value}" ${value === cable.status ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Zugeordnete Trasse<select id="cable-tray"><option value="" ${!cable.trayIds.length ? "selected" : ""}>Noch nicht zugeordnet</option>${electrical.trays.map(tray => `<option value="${esc(tray.id)}" ${cable.trayIds[0] === tray.id ? "selected" : ""}>${esc(tray.name)}</option>`).join("")}</select></label><p>Geplante Trassenlänge: ${plannedLength === null ? "offen" : `${(plannedLength / 1000).toFixed(2)} m`}</p>${diagnostics.length ? `<p class="electrical-diagnostic" role="status">${diagnostics.map(esc).join(" · ")}</p>` : ""}<h4>Messung hinzufügen</h4><form id="measurement-form"><label>Messgerät<input name="device"></label><label>Messdatum<input name="measuredAt" type="datetime-local" value="${esc(toDateTimeLocal())}"></label><label>Gemessene Länge · m<input name="measuredLengthM" type="number" min="0" step="0.001"></label><label>Ergebnis<select name="result">${MEASUREMENT_RESULTS.map(value => `<option value="${value}">${esc(resultLabel(value))}</option>`).join("")}</select></label><label>Notiz<input name="note"></label><button class="primary">Messung speichern</button></form><h4>Messprotokoll</h4><div id="measurement-list"></div>`;
    const list = panel.querySelector("#measurement-list");
    for (const measurement of cable.measurements || []) { const row = document.createElement("p"); row.className = "muted"; row.textContent = measurementSummary(measurement); list.append(row); }
    panel.querySelector("#measurement-form").onsubmit = event => { event.preventDefault(); const form = new FormData(event.currentTarget), next = clone(project), target = next.modules.electrical.cables.find(item => item.id === cable.id); const measuredAtInput = String(form.get("measuredAt") || ""); const measuredLengthRaw = String(form.get("measuredLengthM") || ""); const measuredLengthM = Number(measuredLengthRaw); const measurement = { id: `measurement-${crypto.randomUUID?.() || Date.now()}`, device: String(form.get("device") || "").trim(), measuredAt: measuredAtInput ? new Date(measuredAtInput).toISOString() : new Date().toISOString(), result: normalizeMeasurementResult(form.get("result")) || "open", note: String(form.get("note") || "").trim() }; if (measuredLengthRaw.trim() !== "" && Number.isFinite(measuredLengthM)) measurement.measuredLengthM = measuredLengthM; target.measurements ||= []; target.measurements.push(measurement); target.status = deriveCableStatus(target); record(next); drawCableProperties(target); };
    panel.querySelector("#cable-status").onchange = event => { const next = clone(project), target = next.modules.electrical.cables.find(item => item.id === cable.id); target.status = event.target.value; record(next); drawCableProperties(target); };
    panel.querySelector("#cable-tray").onchange = event => { const next = clone(project), target = next.modules.electrical.cables.find(item => item.id === cable.id); target.trayIds = event.target.value ? [event.target.value] : []; record(next); drawCableProperties(target); };
    // Route assignment and test evidence are separate activities.
    const measuring = activeTool === "measure";
    panel.querySelector("#measurement-form").hidden = !measuring;
    panel.querySelector("#measurement-list").hidden = !measuring;
    panel.querySelectorAll("h4").forEach(heading => heading.hidden = !measuring);
    for (const id of ["cable-status", "cable-tray"]) panel.querySelector(`#${id}`).closest("label").hidden = measuring;
  }
  function setTool(tool) {
    if (tool === "edit" && selectedCableId && !selectedId && !selectedCameraId && !selectedTrayId) tool = "cable";
    if (activeTool === "tray" && tool !== "tray" && draftTrayPoints?.length) {
      setStatus("Trassenentwurf zuerst abschließen oder mit Abbrechen verwerfen", "");
      return;
    }
    activeTool = tool;
    drag = null;
    if (["place", "camera", "tray"].includes(tool)) selectedCableId = null;
    if (tool === "place") activeGroup = "objects";
    if (tool === "camera") activeGroup = "cameras";
    if (tool === "tray") activeGroup = "trays";
    if (tool === "cable" || tool === "measure") activeGroup = "cables";
    if (activeGroup !== "all") {
      if (activeGroup !== "objects") selectedId = null;
      if (activeGroup !== "cameras") selectedCameraId = null;
      if (activeGroup !== "trays") selectedTrayId = null;
    }
    const labels = { select: "Auswählen", edit: "Bearbeiten", cable: "Kabel zuordnen", measure: "Prüfen / Messnachweis", place: "Objekt platzieren", camera: "Kamera setzen", pan: "Ansicht verschieben", tray: "Trasse zeichnen" };
    svg.dataset.tool = tool;
    root.querySelector("#active-tool-label").textContent = "Aktives Werkzeug: " + (labels[tool] || tool);
    if (tool === "tray" && !draftTrayPoints) { draftTrayPoints = []; root.querySelector("#finish-tray").disabled = true; }
    applyModeUI(); drawObjects(); drawTrays(); drawCameras(); drawProperties();
  }
  root.querySelector("#cancel-tool").onclick = () => { draftTrayPoints = null; setTool("select"); };
  root.querySelector("#workarea-group").onchange = event => {
    if (draftTrayPoints?.length) { event.target.value = activeGroup; return; }
    activeGroup = event.target.value;
    selectedId = selectedCameraId = selectedTrayId = selectedCableId = null;
    setTool("select"); drawLists();
  };
  root.querySelector("#workarea-action").onchange = event => setTool(event.target.value);
  setTool("select");
  root.querySelector("#add-workarea").onclick = () => {
    if (draftTrayPoints?.length) { setStatus("Trassenentwurf zuerst abschließen oder abbrechen", ""); return; }
    if (!metricReady) { setStatus("Arbeitsbereiche brauchen Flächenmaße oder Kalibrierung", "error"); return; }
    const next = clone(project);
    const count = next.workspace.workAreas.length + 1;
    const visibleArea = currentVisibleWorkAreaBounds();
    const area = { id: `workarea-${crypto.randomUUID?.() || Date.now()}`, name: `Bereich ${count}`, ...visibleArea, note: "" };
    next.workspace.workAreas.push(area);
    next.workspace.activeWorkAreaId = area.id;
    selectedWorkAreaId = area.id; selectedId = null; selectedCameraId = null; selectedTrayId = null;
    setTool("select");
    record(next);
    setStatus("Arbeitsbereich aus sichtbarem Ausschnitt angelegt", "success");
  };
  root.querySelector("#add-layer").onclick = () => { const next = clone(project); const numberOfLayers = next.layers.length + 1; const layer = { id: `layer-${crypto.randomUUID?.() || Date.now()}`, name: `Ebene ${numberOfLayers}`, elevationMm: (numberOfLayers - 1) * 3000, visible: true }; next.layers.push(layer); activeLayerId = layer.id; record(next); };
  function restoreHistory(index) { historyIndex = index; const state = clone(history[historyIndex]); project.objects = state.objects; project.layers = state.layers; project.workspace = state.workspace; project.modules = state.modules; ensurePlanningData(project); electrical = ensureElectricalData(project); cameraData = ensureCameraData(project); if (!project.layers.some(layer => layer.id === activeLayerId)) activeLayerId = project.layers[0].id; if (!project.workspace.workAreas.some(area => area.id === selectedWorkAreaId)) selectedWorkAreaId = project.workspace.activeWorkAreaId; if (!project.objects.some(object => object.id === selectedId)) selectedId = null; if (!electrical.trays.some(tray => tray.id === selectedTrayId)) selectedTrayId = null; if (!cameraData.cameras.some(camera => camera.id === selectedCameraId)) selectedCameraId = null; drawLists(); drawWorkAreas(); drawObjects(); drawTrays(); drawCameras(); drawProperties(); updateHistoryButtons(); persist(); }
  root.querySelector("#undo").onclick = () => { if (historyIndex > 0) restoreHistory(historyIndex - 1); };
  root.querySelector("#redo").onclick = () => { if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1); };
  root.querySelector("#workarea-save").onclick = persist;
  root.querySelector("#finish-tray").onclick = () => { if (!draftTrayPoints || draftTrayPoints.length < 2) { setStatus("Eine Trasse braucht mindestens zwei Punkte", "error"); return; } const next = clone(project); const number = next.modules.electrical.trays.length + 1; const tray = { id: `tray-${crypto.randomUUID?.() || Date.now()}`, name: `Trasse ${number}`, kind: "cable-tray", widthMm: 200, layerId: activeLayerId, points: clone(draftTrayPoints) }; next.modules.electrical.trays.push(tray); selectedTrayId = tray.id; draftTrayPoints = null; root.querySelector("#finish-tray").disabled = true; record(next); setTool("select"); setStatus("Trasse gespeichert", "success"); };
  root.querySelector("#new-cable").onclick = () => { selectedTrayId = null; selectedId = null; selectedCameraId = null; root.querySelector("#properties-disclosure").open = true; drawCableProperties(); drawCameras(); };
  root.querySelector("#acceptance-filter").onchange = renderAcceptance;
  root.querySelector("#acceptance-export").onclick = () => {
    const report = buildAcceptanceReport(project);
    const safeName = String(project.name || project.id || "projekt").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "projekt";
    downloadTextFile(`${safeName}-abnahmenachweis.json`, JSON.stringify(report, null, 2));
    setStatus(`Nachweis exportiert · ${report.summary.totalCables} Kabel · ${report.warnings.length} Hinweise`, report.warnings.length ? "" : "success");
  };
  root.querySelector("#zoom-in").onclick = () => { zoom = Math.min(MAX_ZOOM, zoom * 1.25); updateViewBox(); };
  root.querySelector("#zoom-out").onclick = () => { zoom = Math.max(0.5, zoom / 1.25); updateViewBox(); };
  root.querySelector("#zoom-fit").onclick = () => { zoom = 1; viewCenterX = viewWidth / 2; viewCenterY = viewHeight / 2; updateViewBox(); };
  svg.addEventListener("pointerdown", event => {
    if (activeTool === "pan") { drag = { pan: true, clientX: event.clientX, clientY: event.clientY }; svg.setPointerCapture(event.pointerId); event.preventDefault(); return; }
    const workAreaTarget = event.target.closest("[data-workarea-id]");
    if (workAreaTarget && svg.dataset.tool === "select") {
      const area = project.workspace.workAreas.find(item => item.id === workAreaTarget.dataset.workareaId);
      selectedWorkAreaId = area?.id || null; selectedId = null; selectedCameraId = null; selectedTrayId = null;
      drawWorkAreas(); drawLists(); drawProperties(); event.preventDefault(); return;
    }
    const trayPoint = event.target.closest("[data-tray-point]");
    if (trayPoint && activeTool === "edit" && groupEditable("trays")) { selectedTrayId = trayPoint.dataset.trayId; selectedCameraId = null; selectedId = null; selectedWorkAreaId = null; drag = { trayId: selectedTrayId, pointIndex: Number(trayPoint.dataset.trayPoint) }; svg.setPointerCapture(event.pointerId); drawLists(); drawCameras(); drawWorkAreas(); drawProperties(); event.preventDefault(); return; }
    const trayTarget = event.target.closest("[data-tray-id]");
    if (trayTarget && groupEditable("trays")) { selectedTrayId = trayTarget.dataset.trayId; selectedCameraId = selectedId = selectedWorkAreaId = null; drawLists(); drawTrays(); drawCameras(); drawWorkAreas(); drawProperties(); event.preventDefault(); return; }
    const cameraTarget = event.target.closest("[data-camera-id]");
    if (cameraTarget && groupEditable("cameras")) { selectedCameraId = cameraTarget.dataset.cameraId; selectedId = null; selectedTrayId = null; selectedWorkAreaId = null; const pos = toWorld(event); const camera = cameraData.cameras.find(item => item.id === selectedCameraId); drag = { cameraId: selectedCameraId, start: pos, x: camera.xMm, y: camera.yMm, moved: false }; svg.setPointerCapture(event.pointerId); drawLists(); drawObjects(); drawTrays(); drawWorkAreas(); drawCameras(); drawProperties(); event.preventDefault(); return; }
    const target = event.target.closest("[data-object-id]");
    if (target && groupEditable("objects")) { selectedId = target.dataset.objectId; selectedCameraId = null; selectedTrayId = null; selectedWorkAreaId = null; const pos = toWorld(event); const object = project.objects.find(item => item.id === selectedId); drag = { id: selectedId, start: pos, x: object.xMm, y: object.yMm, moved: false }; svg.setPointerCapture(event.pointerId); drawLists(); drawObjects(); drawCameras(); drawTrays(); drawWorkAreas(); drawProperties(); event.preventDefault(); return; }
    if (svg.dataset.tool === "pan") { drag = { pan: true, clientX: event.clientX, clientY: event.clientY }; svg.setPointerCapture(event.pointerId); event.preventDefault(); return; }
    if (svg.dataset.tool === "tray" && metricReady) { draftTrayPoints.push(toWorld(event)); root.querySelector("#finish-tray").disabled = draftTrayPoints.length < 2; applyModeUI(); drawTrays(); event.preventDefault(); return; }
    if (svg.dataset.tool === "camera" && metricReady) { const pos = toWorld(event); const next = clone(project); ensureCameraData(next); const camera = { id: `camera-${crypto.randomUUID?.() || Date.now()}`, name: `Kamera ${next.modules.camera.cameras.length + 1}`, type: "color", xMm: Math.round(pos.xMm), yMm: Math.round(pos.yMm), zMm: next.layers.find(layer => layer.id === activeLayerId)?.elevationMm || 0, rotationDeg: 0, rangeMm: 12000, fovDeg: 60, mountingHeightMm: 3000, mountingLocation: "", layerId: activeLayerId, cableId: null, note: "" }; next.modules.camera.cameras.push(camera); selectedCameraId = camera.id; selectedId = null; selectedTrayId = null; selectedWorkAreaId = null; record(next); setTool("select"); event.preventDefault(); return; }
    if (svg.dataset.tool === "place" && metricReady) { const pos = toWorld(event); const next = clone(project); const obj = { id: `object-${crypto.randomUUID?.() || Date.now()}`, type: "generic-plan-object", module: "core", name: `Objekt ${next.objects.length + 1}`, xMm: Math.round(pos.xMm), yMm: Math.round(pos.yMm), zMm: project.layers.find(layer => layer.id === activeLayerId)?.elevationMm || 0, widthMm: 700, depthMm: 500, rotationDeg: 0, layerId: activeLayerId }; next.objects.push(obj); selectedId = obj.id; selectedCameraId = null; selectedTrayId = null; selectedWorkAreaId = null; record(next); setTool("select"); event.preventDefault(); }
  });
  svg.addEventListener("pointermove", event => { if (!drag) return; if (drag.pan) { const width = viewWidth / zoom, height = viewHeight / zoom; viewCenterX -= (event.clientX - drag.clientX) * width / svg.clientWidth; viewCenterY -= (event.clientY - drag.clientY) * height / svg.clientHeight; drag.clientX = event.clientX; drag.clientY = event.clientY; updateViewBox(); return; } if (drag.trayId) { const pos = toWorld(event), tray = electrical.trays.find(item => item.id === drag.trayId); tray.points[drag.pointIndex] = { xMm: Math.round(pos.xMm), yMm: Math.round(pos.yMm) }; drawTrays(); return; } if (drag.cameraId) { const pos = toWorld(event), camera = cameraData.cameras.find(item => item.id === drag.cameraId); camera.xMm = Math.round(drag.x + pos.xMm - drag.start.xMm); camera.yMm = Math.round(drag.y + pos.yMm - drag.start.yMm); drag.moved = true; drawCameras(); return; } const pos = toWorld(event); const obj = project.objects.find(item => item.id === drag.id); obj.xMm = Math.round(drag.x + pos.xMm - drag.start.xMm); obj.yMm = Math.round(drag.y + pos.yMm - drag.start.yMm); drag.moved = true; drawObjects(); });
  svg.addEventListener("pointerup", () => { if (!drag) return; if (!drag.pan) { const next = clone(project); record(next); } drag = null; });
  svg.addEventListener("pointercancel", () => { drag = null; });
  const initialWorkArea = project.workspace.workAreas.find(area => area.id === project.workspace.activeWorkAreaId);
  if (initialWorkArea) focusWorkArea(initialWorkArea, { save: false });
  else updateViewBox();
  drawLists(); drawWorkAreas(); drawObjects(); drawTrays(); drawCameras(); drawProperties(); updateHistoryButtons();
  if (!metricReady) setStatus("Maßstab offen · Flächenmaße festlegen oder Grundriss kalibrieren", "");
  return () => { if (assetUrl) URL.revokeObjectURL(assetUrl); };
}
