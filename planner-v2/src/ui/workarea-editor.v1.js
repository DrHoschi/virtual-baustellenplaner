const SVG = "http://www.w3.org/2000/svg";
const clone = value => structuredClone(value);
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const esc = value => String(value ?? "").replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
import { ensureElectricalData, polylineLengthMm, plannedCableLengthMm, CABLE_STATUSES } from "../electrical/electrical-model.v1.js";
import { ensureCameraData, cameraFovPolygon, CAMERA_TYPES } from "../camera/camera-model.v1.js";

function defaultLayer() { return { id: "layer-ground", name: "Boden", elevationMm: 0, visible: true }; }
function ensurePlanningData(project) {
  if (!Array.isArray(project.layers) || !project.layers.length) project.layers = [defaultLayer()];
  if (!Array.isArray(project.objects)) project.objects = [];
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
  let draftTrayPoints = null;
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
  let zoom = 1;
  let viewCenterX = viewWidth / 2;
  let viewCenterY = viewHeight / 2;

  root.innerHTML = `<section class="workarea-head"><div><p class="eyebrow">2D-WORKAREA</p><h2>${esc(project.name)}</h2><p class="muted">${esc(project.siteArea.kind === "whole-hall" ? "Ganze Halle" : project.siteArea.kind === "hall-section" ? "Hallenteil" : project.siteArea.kind === "free-area" ? "Freie Fläche" : "Arbeitsfläche")}${metricReady ? " · Maßangaben in mm" : " · noch ohne bestätigten Maßstab"}</p></div><button class="secondary" id="workarea-save">Speichern</button></section>
  <div class="workarea-tools"><button class="secondary selected" data-tool="select" aria-pressed="true">Auswählen</button><button class="primary" data-tool="place" aria-pressed="false">＋ Objekt platzieren</button><button class="secondary" data-tool="camera" aria-pressed="false">＋ Kamera setzen</button><button class="secondary" data-tool="tray" id="draw-tray" aria-pressed="false">＋ Trasse zeichnen</button><button class="secondary" id="finish-tray" disabled>Trasse abschließen</button><button class="secondary" data-tool="pan" aria-pressed="false">Ansicht verschieben</button><button class="secondary" id="zoom-out" aria-label="Ansicht verkleinern">−</button><button class="secondary" id="zoom-in" aria-label="Ansicht vergrößern">＋</button><button class="secondary" id="zoom-fit">Einpassen</button><button class="secondary" id="undo" disabled>↶ Rückgängig</button><button class="secondary" id="redo" disabled>↷ Wiederholen</button><button class="secondary" id="add-layer">＋ Ebene</button><span id="active-tool-label" class="tool-status" aria-live="polite">Aktives Werkzeug: Auswählen</span><span class="scale-readout">${metricReady ? `Fläche ${Math.round(areaWidth)} × ${Math.round(areaHeight)} mm` : "Maßstab noch offen"}</span></div>
  <section class="workarea-layout"><aside class="panel workarea-sidebar"><h3>Ebenen</h3><div id="layer-list"></div><h3 class="objects-title">Objekte</h3><div id="object-list"></div><p class="muted empty-object-hint">Objekte hier antippen, um sie auszuwählen.</p><h3 class="objects-title">Kabeltrassen</h3><div id="tray-list"></div><button class="secondary" id="new-cable">＋ Kabel anlegen</button><div id="cable-list"></div><h3 class="objects-title">Kameras</h3><div id="camera-list"></div></aside>
  <div class="panel workarea-stage"><div class="canvas-wrap" id="canvas-wrap"></div><p class="muted canvas-help">${metricReady ? "Tippe auf die Fläche, um ein Objekt zu setzen. Ziehe Objekte zum Verschieben." : "Lege Flächenmaße fest oder kalibriere zuerst den Grundriss, damit Positionen maßstäblich sind."}</p></div>
  <aside class="panel workarea-properties" id="properties"><h3>Eigenschaften</h3><p class="muted">Wähle ein Objekt aus, um seine Lage und Ebene zu bearbeiten.</p></aside></section>`;

  const svg = createSvgElement("svg", { class: "plan-svg", viewBox: `0 0 ${viewWidth} ${viewHeight}`, role: "img", "aria-label": "Maßstäbliche 2D-Baustellenfläche" });
  function updateViewBox() { const width = viewWidth / zoom, height = viewHeight / zoom; svg.setAttribute("viewBox", `${viewCenterX - width / 2} ${viewCenterY - height / 2} ${width} ${height}`); }
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
  const trayLayer = createSvgElement("g", { class: "plan-trays" }); svg.append(trayLayer);
  const cameraLayer = createSvgElement("g", { class: "plan-cameras" }); svg.append(cameraLayer);
  const objectLayer = createSvgElement("g", { class: "plan-objects" }); svg.append(objectLayer);
  if (metricReady) { const ruler = createSvgElement("g", { class: "scale-bar", "pointer-events": "none" }); const x = Math.max(20, viewWidth - 1400), y = viewHeight - 250; ruler.append(createSvgElement("path", { d: `M ${x} ${y} h 1000 m -1000 -90 v 180 m 1000 -180 v 180`, stroke: "#17202b", "stroke-width": 28, fill: "none" })); const label = createSvgElement("text", { x: x + 500, y: y - 120, "text-anchor": "middle", "font-size": 220, fill: "#17202b" }); label.textContent = "1 m"; ruler.append(label); svg.append(ruler); }
  root.querySelector("#canvas-wrap").append(svg);

  function record(next) {
    history.splice(historyIndex + 1);
    history.push(clone(next)); historyIndex = history.length - 1;
    project.objects = next.objects; project.layers = next.layers; project.modules = next.modules; electrical = ensureElectricalData(project); cameraData = ensureCameraData(project);
    updateHistoryButtons(); drawObjects(); drawTrays(); drawCameras(); drawLists(); drawProperties();
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
  function drawObjects() {
    objectLayer.replaceChildren();
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
    for (const camera of cameraData.cameras) {
      const layer = project.layers.find(item => item.id === camera.layerId);
      if (layer?.visible === false) continue;
      const cx = number(camera.xMm) - minX, cy = yTop - number(camera.yMm);
      const fov = cameraFovPolygon(camera);
      if (fov.length) {
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
    for (const tray of electrical.trays) {
      const layer = project.layers.find(item => item.id === tray.layerId);
      if (layer?.visible === false || tray.points.length < 2) continue;
      const coords = tray.points.map(point => `${point.xMm - minX},${yTop - point.yMm}`).join(" ");
      const group = createSvgElement("g", { class: "electrical-tray", "data-tray-id": tray.id, tabindex: 0, role: "button", "aria-label": tray.name });
      group.append(createSvgElement("polyline", { points: coords, fill: "none", stroke: tray.id === selectedTrayId ? "#f59e0b" : "#d04a3a", "stroke-width": Math.max(100, tray.widthMm), "stroke-linecap": "round", "stroke-linejoin": "round", opacity: ".62" }));
      tray.points.forEach((point, index) => group.append(createSvgElement("circle", { cx: point.xMm - minX, cy: yTop - point.yMm, r: 180, fill: "white", stroke: "#a83226", "stroke-width": 55, "data-tray-point": index, "data-tray-id": tray.id, class: "tray-point" })));
      trayLayer.append(group);
    }
    if (draftTrayPoints?.length) {
      const coords = draftTrayPoints.map(point => `${point.xMm - minX},${yTop - point.yMm}`).join(" ");
      trayLayer.append(createSvgElement("polyline", { points: coords, fill: "none", stroke: "#d04a3a", "stroke-width": 120, "stroke-dasharray": "250 160", "pointer-events": "none" }));
      draftTrayPoints.forEach(point => trayLayer.append(createSvgElement("circle", { cx: point.xMm - minX, cy: yTop - point.yMm, r: 180, fill: "white", stroke: "#a83226", "stroke-width": 55, "pointer-events": "none" })));
    }
  }
  function drawLists() {
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
      button.onclick = () => { selectedId = object.id; selectedCameraId = null; selectedTrayId = null; activeLayerId = object.layerId; drawLists(); drawObjects(); drawCameras(); drawTrays(); drawProperties(); };
      list.append(button);
    }
    root.querySelector(".empty-object-hint").hidden = project.objects.length > 0;
    const trayList = root.querySelector("#tray-list"); trayList.replaceChildren();
    for (const tray of electrical.trays) { const button = document.createElement("button"); button.className = "object-row"; button.textContent = `${tray.name} · ${(polylineLengthMm(tray.points) / 1000).toFixed(2)} m`; button.onclick = () => { selectedTrayId = tray.id; selectedId = null; selectedCameraId = null; drawTrays(); drawCameras(); drawLists(); drawProperties(); }; trayList.append(button); }
    const cableList = root.querySelector("#cable-list"); cableList.replaceChildren();
    for (const cable of electrical.cables) { const button = document.createElement("button"); button.className = "object-row"; const length = plannedCableLengthMm(electrical, cable); button.textContent = `${cable.id} · ${cable.status}${length === null ? "" : ` · ${(length / 1000).toFixed(2)} m`}`; button.title = `${cable.source.name}:${cable.source.port} → ${cable.target.name}:${cable.target.port}`; button.onclick = () => { selectedTrayId = null; selectedId = null; selectedCameraId = null; drawCableProperties(cable); drawCameras(); }; cableList.append(button); }
    const cameraList = root.querySelector("#camera-list"); cameraList.replaceChildren();
    for (const camera of cameraData.cameras) {
      const button = document.createElement("button");
      button.className = "object-row" + (camera.id === selectedCameraId ? " active" : "");
      button.textContent = `${camera.name || camera.id} · ${Math.round(number(camera.rangeMm) / 1000)} m`;
      button.onclick = () => { selectedCameraId = camera.id; selectedTrayId = null; selectedId = null; activeLayerId = camera.layerId; drawLists(); drawCameras(); drawProperties(); };
      cameraList.append(button);
    }
  }
  function drawProperties() {
    if (selectedCameraId) {
      const camera = cameraData.cameras.find(item => item.id === selectedCameraId);
      if (!camera) { selectedCameraId = null; return drawProperties(); }
      return drawCameraProperties(camera);
    }
    if (selectedTrayId) {
      const tray = electrical.trays.find(item => item.id === selectedTrayId), panel = root.querySelector("#properties");
      if (!tray) { selectedTrayId = null; return drawProperties(); }
      panel.innerHTML = `<h3>Trasseneigenschaften</h3><label>Bezeichnung<input name="name" value="${esc(tray.name)}"></label><label>Breite · mm<input name="widthMm" type="number" min="1" value="${tray.widthMm}"></label><label>Ebene<select name="layerId">${project.layers.map(layer => `<option value="${esc(layer.id)}" ${layer.id === tray.layerId ? "selected" : ""}>${esc(layer.name)} · ${layer.elevationMm} mm</option>`).join("")}</select></label><p class="muted">Geplante Länge: ${(polylineLengthMm(tray.points) / 1000).toFixed(2)} m · ${tray.points.length} Punkte. Verlaufspunkte direkt im Plan ziehen.</p><button class="secondary danger" id="delete-tray">Trasse löschen</button>`;
      panel.querySelectorAll("input,select").forEach(input => input.onchange = () => { const next = clone(project), target = next.modules.electrical.trays.find(item => item.id === tray.id); target[input.name] = input.name === "widthMm" ? Number(input.value) : input.value; record(next); });
      panel.querySelector("#delete-tray").onclick = () => { const next = clone(project); next.modules.electrical.trays = next.modules.electrical.trays.filter(item => item.id !== tray.id); next.modules.electrical.cables.forEach(cable => cable.trayIds = cable.trayIds.filter(id => id !== tray.id)); selectedTrayId = null; record(next); };
      return;
    }
    const panel = root.querySelector("#properties"); const object = project.objects.find(item => item.id === selectedId);
    if (!object) { panel.innerHTML = '<h3>Eigenschaften</h3><p class="muted">Wähle ein Objekt aus, um seine Lage und Ebene zu bearbeiten.</p>'; return; }
    panel.innerHTML = `<h3>Objekt-Eigenschaften</h3><label>Name<input name="name" maxlength="80" value="${esc(object.name)}"></label><div class="form-row"><label>X · mm<input name="xMm" type="number" step="1" value="${number(object.xMm)}"></label><label>Y · mm<input name="yMm" type="number" step="1" value="${number(object.yMm)}"></label></div><div class="form-row"><label>Breite · mm<input name="widthMm" type="number" min="1" step="1" value="${number(object.widthMm) || 700}"></label><label>Tiefe · mm<input name="depthMm" type="number" min="1" step="1" value="${number(object.depthMm) || 500}"></label></div><label>Drehung · °<input name="rotationDeg" type="number" step="1" value="${number(object.rotationDeg)}"></label><label>Ebene<select name="layerId">${project.layers.map(layer => `<option value="${esc(layer.id)}" ${layer.id === object.layerId ? "selected" : ""}>${esc(layer.name)} · ${number(layer.elevationMm)} mm</option>`).join("")}</select></label><p class="muted">Höhe Z: ${number(project.layers.find(layer => layer.id === object.layerId)?.elevationMm)} mm</p><button class="secondary danger" id="delete-object">Objekt löschen</button>`;
    panel.querySelectorAll("input,select").forEach(input => input.addEventListener("change", () => { const next = clone(project); const target = next.objects.find(item => item.id === selectedId); target[input.name] = input.name === "name" || input.name === "layerId" ? input.value : number(input.value); if (input.name === "layerId") target.zMm = next.layers.find(layer => layer.id === input.value)?.elevationMm || 0; record(next); }));
    panel.querySelector("#delete-object").onclick = () => { const next = clone(project); next.objects = next.objects.filter(item => item.id !== selectedId); selectedId = null; record(next); };
  }
  function drawCameraProperties(camera) {
    const panel = root.querySelector("#properties");
    const cableOptions = electrical.cables.map(cable => `<option value="${esc(cable.id)}" ${camera.cableId === cable.id ? "selected" : ""}>${esc(cable.id)} · ${esc(cable.name)}</option>`).join("");
    const cableHint = camera.cableId ? "" : `<p class="electrical-diagnostic" role="status">Noch keinem Kabel zugeordnet.</p>`;
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
    const panel = root.querySelector("#properties");
    if (!cable) {
      panel.innerHTML = `<h3>Neues Kabel</h3><form id="cable-form"><label>Kabel-ID<input name="id" required></label><label>Bezeichnung<input name="name" required></label><div class="form-row"><label>Quelle<input name="source" required></label><label>Quell-Port<input name="sourcePort" required></label></div><div class="form-row"><label>Ziel<input name="target" required></label><label>Ziel-Port<input name="targetPort" required></label></div><label>Status<select name="status">${CABLE_STATUSES.map(value => `<option value="${value}">${value}</option>`).join("")}</select></label><label>Trasse<select name="trayId"><option value="">Noch nicht zugeordnet</option>${electrical.trays.map(tray => `<option value="${esc(tray.id)}">${esc(tray.name)}</option>`).join("")}</select></label><button class="primary">Kabel speichern</button></form>`;
      panel.querySelector("#cable-form").onsubmit = event => { event.preventDefault(); const form = new FormData(event.currentTarget), id = String(form.get("id")).trim(); if (electrical.cables.some(item => item.id === id)) { setStatus("Kabel-ID bereits vergeben", "error"); return; } const next = clone(project), item = { id, name: String(form.get("name")).trim(), source: { name: String(form.get("source")).trim(), port: String(form.get("sourcePort")).trim() }, target: { name: String(form.get("target")).trim(), port: String(form.get("targetPort")).trim() }, trayIds: form.get("trayId") ? [String(form.get("trayId"))] : [], status: String(form.get("status")), measurements: [] }; next.modules.electrical.cables.push(item); record(next); drawCableProperties(item); };
      return;
    }
    const plannedLength = plannedCableLengthMm(electrical, cable);
    const diagnostics = [!cable.trayIds.length ? "Noch keiner Trasse zugeordnet." : "", plannedLength === null && cable.trayIds.length ? "Trassenlänge nicht verfügbar." : "", cable.status === "measured" && !cable.measurements.length ? "Status gemessen, aber Messnachweis fehlt." : ""].filter(Boolean);
    panel.innerHTML = `<h3>${esc(cable.id)} · ${esc(cable.name)}</h3><p class="muted">${esc(cable.source.name)}:${esc(cable.source.port)} → ${esc(cable.target.name)}:${esc(cable.target.port)}</p><label>Status<select id="cable-status">${CABLE_STATUSES.map(value => `<option value="${value}" ${value === cable.status ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Zugeordnete Trasse<select id="cable-tray"><option value="" ${!cable.trayIds.length ? "selected" : ""}>Noch nicht zugeordnet</option>${electrical.trays.map(tray => `<option value="${esc(tray.id)}" ${cable.trayIds[0] === tray.id ? "selected" : ""}>${esc(tray.name)}</option>`).join("")}</select></label><p>Geplante Trassenlänge: ${plannedLength === null ? "offen" : `${(plannedLength / 1000).toFixed(2)} m`}</p>${diagnostics.length ? `<p class="electrical-diagnostic" role="status">${diagnostics.map(esc).join(" · ")}</p>` : ""}<h4>Messung hinzufügen</h4><form id="measurement-form"><label>Messgerät<input name="device" required></label><label>Gemessene Länge · m<input name="lengthM" type="number" min="0.001" step="0.001" required></label><label>Ergebnis<input name="result" required placeholder="PASS / bestanden"></label><label>Notiz<input name="note"></label><button class="primary">Messung speichern</button></form><h4>Messprotokoll</h4><div id="measurement-list"></div>`;
    const list = panel.querySelector("#measurement-list");
    for (const measurement of cable.measurements) { const row = document.createElement("p"); row.className = "muted"; row.textContent = `${measurement.device} · ${measurement.lengthMm / 1000} m · ${measurement.result} · ${new Date(measurement.measuredAt).toLocaleString()}${measurement.note ? ` · ${measurement.note}` : ""}`; list.append(row); }
    panel.querySelector("#measurement-form").onsubmit = event => { event.preventDefault(); const form = new FormData(event.currentTarget), next = clone(project), target = next.modules.electrical.cables.find(item => item.id === cable.id); target.measurements.push({ id: `measurement-${crypto.randomUUID?.() || Date.now()}`, device: String(form.get("device")).trim(), lengthMm: Math.round(Number(form.get("lengthM")) * 1000), result: String(form.get("result")).trim(), measuredAt: new Date().toISOString(), note: String(form.get("note")).trim() }); record(next); drawCableProperties(target); };
    panel.querySelector("#cable-status").onchange = event => { const next = clone(project), target = next.modules.electrical.cables.find(item => item.id === cable.id); target.status = event.target.value; record(next); drawCableProperties(target); };
    panel.querySelector("#cable-tray").onchange = event => { const next = clone(project), target = next.modules.electrical.cables.find(item => item.id === cable.id); target.trayIds = event.target.value ? [event.target.value] : []; record(next); drawCableProperties(target); };
  }
  function setTool(tool) {
    const labels = { select: "Auswählen", place: "Objekt platzieren", camera: "Kamera setzen", pan: "Ansicht verschieben", tray: "Trasse zeichnen" };
    root.querySelectorAll(".workarea-tools [data-tool]").forEach(button => {
      const active = button.dataset.tool === tool;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    svg.dataset.tool = tool;
    root.querySelector("#active-tool-label").textContent = "Aktives Werkzeug: " + (labels[tool] || tool);
    if (tool === "tray") { draftTrayPoints = []; root.querySelector("#finish-tray").disabled = true; drawTrays(); }
  }
  root.querySelectorAll(".workarea-tools [data-tool]").forEach(button => button.onclick = () => setTool(button.dataset.tool));
  setTool("select");
  root.querySelector("#add-layer").onclick = () => { const next = clone(project); const numberOfLayers = next.layers.length + 1; const layer = { id: `layer-${crypto.randomUUID?.() || Date.now()}`, name: `Ebene ${numberOfLayers}`, elevationMm: (numberOfLayers - 1) * 3000, visible: true }; next.layers.push(layer); activeLayerId = layer.id; record(next); };
  function restoreHistory(index) { historyIndex = index; const state = clone(history[historyIndex]); project.objects = state.objects; project.layers = state.layers; project.modules = state.modules; electrical = ensureElectricalData(project); cameraData = ensureCameraData(project); if (!project.layers.some(layer => layer.id === activeLayerId)) activeLayerId = project.layers[0].id; if (!project.objects.some(object => object.id === selectedId)) selectedId = null; if (!electrical.trays.some(tray => tray.id === selectedTrayId)) selectedTrayId = null; if (!cameraData.cameras.some(camera => camera.id === selectedCameraId)) selectedCameraId = null; drawLists(); drawObjects(); drawTrays(); drawCameras(); drawProperties(); updateHistoryButtons(); persist(); }
  root.querySelector("#undo").onclick = () => { if (historyIndex > 0) restoreHistory(historyIndex - 1); };
  root.querySelector("#redo").onclick = () => { if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1); };
  root.querySelector("#workarea-save").onclick = persist;
  root.querySelector("#draw-tray").onclick = () => { setTool("tray"); setStatus("Trasse zeichnen · Punkte antippen, dann abschließen", ""); };
  root.querySelector("#finish-tray").onclick = () => { if (!draftTrayPoints || draftTrayPoints.length < 2) { setStatus("Eine Trasse braucht mindestens zwei Punkte", "error"); return; } const next = clone(project); const number = next.modules.electrical.trays.length + 1; const tray = { id: `tray-${crypto.randomUUID?.() || Date.now()}`, name: `Trasse ${number}`, kind: "cable-tray", widthMm: 200, layerId: activeLayerId, points: clone(draftTrayPoints) }; next.modules.electrical.trays.push(tray); selectedTrayId = tray.id; draftTrayPoints = null; root.querySelector("#finish-tray").disabled = true; record(next); setTool("select"); setStatus("Trasse gespeichert", "success"); };
  root.querySelector("#new-cable").onclick = () => { selectedTrayId = null; selectedId = null; selectedCameraId = null; drawCableProperties(); drawCameras(); };
  root.querySelector("#zoom-in").onclick = () => { zoom = Math.min(12, zoom * 1.25); updateViewBox(); };
  root.querySelector("#zoom-out").onclick = () => { zoom = Math.max(0.5, zoom / 1.25); updateViewBox(); };
  root.querySelector("#zoom-fit").onclick = () => { zoom = 1; viewCenterX = viewWidth / 2; viewCenterY = viewHeight / 2; updateViewBox(); };
  svg.addEventListener("pointerdown", event => {
    const trayPoint = event.target.closest("[data-tray-point]");
    if (trayPoint) { selectedTrayId = trayPoint.dataset.trayId; selectedCameraId = null; selectedId = null; drag = { trayId: selectedTrayId, pointIndex: Number(trayPoint.dataset.trayPoint) }; svg.setPointerCapture(event.pointerId); drawLists(); drawCameras(); drawProperties(); event.preventDefault(); return; }
    const cameraTarget = event.target.closest("[data-camera-id]");
    if (cameraTarget) { selectedCameraId = cameraTarget.dataset.cameraId; selectedId = null; selectedTrayId = null; const pos = toWorld(event); const camera = cameraData.cameras.find(item => item.id === selectedCameraId); drag = { cameraId: selectedCameraId, start: pos, x: camera.xMm, y: camera.yMm, moved: false }; svg.setPointerCapture(event.pointerId); drawLists(); drawObjects(); drawTrays(); drawCameras(); drawProperties(); event.preventDefault(); return; }
    const target = event.target.closest("[data-object-id]");
    if (target) { selectedId = target.dataset.objectId; selectedCameraId = null; selectedTrayId = null; const pos = toWorld(event); const object = project.objects.find(item => item.id === selectedId); drag = { id: selectedId, start: pos, x: object.xMm, y: object.yMm, moved: false }; svg.setPointerCapture(event.pointerId); drawLists(); drawObjects(); drawCameras(); drawTrays(); drawProperties(); event.preventDefault(); return; }
    if (svg.dataset.tool === "pan") { drag = { pan: true, clientX: event.clientX, clientY: event.clientY }; svg.setPointerCapture(event.pointerId); event.preventDefault(); return; }
    if (svg.dataset.tool === "tray" && metricReady) { draftTrayPoints.push(toWorld(event)); root.querySelector("#finish-tray").disabled = draftTrayPoints.length < 2; drawTrays(); event.preventDefault(); return; }
    if (svg.dataset.tool === "camera" && metricReady) { const pos = toWorld(event); const next = clone(project); ensureCameraData(next); const camera = { id: `camera-${crypto.randomUUID?.() || Date.now()}`, name: `Kamera ${next.modules.camera.cameras.length + 1}`, type: "color", xMm: Math.round(pos.xMm), yMm: Math.round(pos.yMm), zMm: next.layers.find(layer => layer.id === activeLayerId)?.elevationMm || 0, rotationDeg: 0, rangeMm: 12000, fovDeg: 60, mountingHeightMm: 3000, mountingLocation: "", layerId: activeLayerId, cableId: null, note: "" }; next.modules.camera.cameras.push(camera); selectedCameraId = camera.id; selectedId = null; selectedTrayId = null; record(next); setTool("select"); event.preventDefault(); return; }
    if (svg.dataset.tool === "place" && metricReady) { const pos = toWorld(event); const next = clone(project); const obj = { id: `object-${crypto.randomUUID?.() || Date.now()}`, type: "generic-plan-object", module: "core", name: `Objekt ${next.objects.length + 1}`, xMm: Math.round(pos.xMm), yMm: Math.round(pos.yMm), zMm: project.layers.find(layer => layer.id === activeLayerId)?.elevationMm || 0, widthMm: 700, depthMm: 500, rotationDeg: 0, layerId: activeLayerId }; next.objects.push(obj); selectedId = obj.id; selectedCameraId = null; selectedTrayId = null; record(next); setTool("select"); event.preventDefault(); }
  });
  svg.addEventListener("pointermove", event => { if (!drag) return; if (drag.pan) { const width = viewWidth / zoom, height = viewHeight / zoom; viewCenterX -= (event.clientX - drag.clientX) * width / svg.clientWidth; viewCenterY -= (event.clientY - drag.clientY) * height / svg.clientHeight; drag.clientX = event.clientX; drag.clientY = event.clientY; updateViewBox(); return; } if (drag.trayId) { const pos = toWorld(event), tray = electrical.trays.find(item => item.id === drag.trayId); tray.points[drag.pointIndex] = { xMm: Math.round(pos.xMm), yMm: Math.round(pos.yMm) }; drawTrays(); return; } if (drag.cameraId) { const pos = toWorld(event), camera = cameraData.cameras.find(item => item.id === drag.cameraId); camera.xMm = Math.round(drag.x + pos.xMm - drag.start.xMm); camera.yMm = Math.round(drag.y + pos.yMm - drag.start.yMm); drag.moved = true; drawCameras(); return; } const pos = toWorld(event); const obj = project.objects.find(item => item.id === drag.id); obj.xMm = Math.round(drag.x + pos.xMm - drag.start.xMm); obj.yMm = Math.round(drag.y + pos.yMm - drag.start.yMm); drag.moved = true; drawObjects(); });
  svg.addEventListener("pointerup", () => { if (!drag) return; if (!drag.pan) { const next = clone(project); record(next); } drag = null; });
  svg.addEventListener("pointercancel", () => { drag = null; });
  drawLists(); drawObjects(); drawTrays(); drawCameras(); drawProperties(); updateHistoryButtons();
  if (!metricReady) setStatus("Maßstab offen · Flächenmaße festlegen oder Grundriss kalibrieren", "");
  return () => { if (assetUrl) URL.revokeObjectURL(assetUrl); };
}
