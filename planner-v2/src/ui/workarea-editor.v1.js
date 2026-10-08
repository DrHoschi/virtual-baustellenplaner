const SVG = "http://www.w3.org/2000/svg";
const clone = value => structuredClone(value);
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const esc = value => String(value ?? "").replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));

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
  const history = [clone(project)];
  let historyIndex = 0;
  let selectedId = null;
  let activeLayerId = project.layers[0].id;
  let drag = null;
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
  <div class="workarea-tools"><button class="secondary selected" data-tool="select" aria-pressed="true">Auswählen</button><button class="primary" data-tool="place" aria-pressed="false">＋ Objekt platzieren</button><button class="secondary" data-tool="pan" aria-pressed="false">Ansicht verschieben</button><button class="secondary" id="zoom-out" aria-label="Ansicht verkleinern">−</button><button class="secondary" id="zoom-in" aria-label="Ansicht vergrößern">＋</button><button class="secondary" id="zoom-fit">Einpassen</button><button class="secondary" id="undo" disabled>↶ Rückgängig</button><button class="secondary" id="redo" disabled>↷ Wiederholen</button><button class="secondary" id="add-layer">＋ Ebene</button><span id="active-tool-label" class="tool-status" aria-live="polite">Aktives Werkzeug: Auswählen</span><span class="scale-readout">${metricReady ? `Fläche ${Math.round(areaWidth)} × ${Math.round(areaHeight)} mm` : "Maßstab noch offen"}</span></div>
  <section class="workarea-layout"><aside class="panel workarea-sidebar"><h3>Ebenen</h3><div id="layer-list"></div><h3 class="objects-title">Objekte</h3><div id="object-list"></div><p class="muted empty-object-hint">Objekte hier antippen, um sie auszuwählen.</p></aside>
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
  const objectLayer = createSvgElement("g", { class: "plan-objects" }); svg.append(objectLayer);
  if (metricReady) { const ruler = createSvgElement("g", { class: "scale-bar", "pointer-events": "none" }); const x = Math.max(20, viewWidth - 1400), y = viewHeight - 250; ruler.append(createSvgElement("path", { d: `M ${x} ${y} h 1000 m -1000 -90 v 180 m 1000 -180 v 180`, stroke: "#17202b", "stroke-width": 28, fill: "none" })); const label = createSvgElement("text", { x: x + 500, y: y - 120, "text-anchor": "middle", "font-size": 220, fill: "#17202b" }); label.textContent = "1 m"; ruler.append(label); svg.append(ruler); }
  root.querySelector("#canvas-wrap").append(svg);

  function record(next) {
    history.splice(historyIndex + 1);
    history.push(clone(next)); historyIndex = history.length - 1;
    project.objects = next.objects; project.layers = next.layers;
    updateHistoryButtons(); drawObjects(); drawLists(); drawProperties();
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
  function drawLists() {
    const layers = root.querySelector("#layer-list"); layers.replaceChildren();
    for (const layer of project.layers) {
      const row = document.createElement("div"); row.className = `layer-row${layer.id === activeLayerId ? " active" : ""}`;
      const choose = document.createElement("button"); choose.className = "layer-choice"; choose.textContent = layer.name; choose.onclick = () => { activeLayerId = layer.id; drawLists(); drawObjects(); };
      const height = document.createElement("input"); height.type = "number"; height.step = "1"; height.value = layer.elevationMm; height.setAttribute("aria-label", `Höhe ${layer.name} in mm`); height.onchange = () => { const next = clone(project); const target = next.layers.find(item => item.id === layer.id); target.elevationMm = number(height.value); for (const obj of next.objects.filter(item => item.layerId === layer.id)) obj.zMm = target.elevationMm; record(next); };
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
      button.onclick = () => { selectedId = object.id; activeLayerId = object.layerId; drawLists(); drawObjects(); drawProperties(); };
      list.append(button);
    }
    root.querySelector(".empty-object-hint").hidden = project.objects.length > 0;
  }
  function drawProperties() {
    const panel = root.querySelector("#properties"); const object = project.objects.find(item => item.id === selectedId);
    if (!object) { panel.innerHTML = '<h3>Eigenschaften</h3><p class="muted">Wähle ein Objekt aus, um seine Lage und Ebene zu bearbeiten.</p>'; return; }
    panel.innerHTML = `<h3>Objekt-Eigenschaften</h3><label>Name<input name="name" maxlength="80" value="${esc(object.name)}"></label><div class="form-row"><label>X · mm<input name="xMm" type="number" step="1" value="${number(object.xMm)}"></label><label>Y · mm<input name="yMm" type="number" step="1" value="${number(object.yMm)}"></label></div><div class="form-row"><label>Breite · mm<input name="widthMm" type="number" min="1" step="1" value="${number(object.widthMm) || 700}"></label><label>Tiefe · mm<input name="depthMm" type="number" min="1" step="1" value="${number(object.depthMm) || 500}"></label></div><label>Drehung · °<input name="rotationDeg" type="number" step="1" value="${number(object.rotationDeg)}"></label><label>Ebene<select name="layerId">${project.layers.map(layer => `<option value="${esc(layer.id)}" ${layer.id === object.layerId ? "selected" : ""}>${esc(layer.name)} · ${number(layer.elevationMm)} mm</option>`).join("")}</select></label><p class="muted">Höhe Z: ${number(project.layers.find(layer => layer.id === object.layerId)?.elevationMm)} mm</p><button class="secondary danger" id="delete-object">Objekt löschen</button>`;
    panel.querySelectorAll("input,select").forEach(input => input.addEventListener("change", () => { const next = clone(project); const target = next.objects.find(item => item.id === selectedId); target[input.name] = input.name === "name" || input.name === "layerId" ? input.value : number(input.value); if (input.name === "layerId") target.zMm = next.layers.find(layer => layer.id === input.value)?.elevationMm || 0; record(next); }));
    panel.querySelector("#delete-object").onclick = () => { const next = clone(project); next.objects = next.objects.filter(item => item.id !== selectedId); selectedId = null; record(next); };
  }
  function setTool(tool) {
    const labels = { select: "Auswählen", place: "Objekt platzieren", pan: "Ansicht verschieben" };
    root.querySelectorAll(".workarea-tools [data-tool]").forEach(button => {
      const active = button.dataset.tool === tool;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    svg.dataset.tool = tool;
    root.querySelector("#active-tool-label").textContent = "Aktives Werkzeug: " + (labels[tool] || tool);
  }
  root.querySelectorAll(".workarea-tools [data-tool]").forEach(button => button.onclick = () => setTool(button.dataset.tool));
  setTool("select");
  root.querySelector("#add-layer").onclick = () => { const next = clone(project); const numberOfLayers = next.layers.length + 1; const layer = { id: `layer-${crypto.randomUUID?.() || Date.now()}`, name: `Ebene ${numberOfLayers}`, elevationMm: (numberOfLayers - 1) * 3000, visible: true }; next.layers.push(layer); activeLayerId = layer.id; record(next); };
  root.querySelector("#undo").onclick = () => { if (historyIndex <= 0) return; historyIndex--; const state = clone(history[historyIndex]); project.objects = state.objects; project.layers = state.layers; drawLists(); drawObjects(); drawProperties(); updateHistoryButtons(); persist(); };
  root.querySelector("#redo").onclick = () => { if (historyIndex >= history.length - 1) return; historyIndex++; const state = clone(history[historyIndex]); project.objects = state.objects; project.layers = state.layers; drawLists(); drawObjects(); drawProperties(); updateHistoryButtons(); persist(); };
  root.querySelector("#workarea-save").onclick = persist;
  root.querySelector("#zoom-in").onclick = () => { zoom = Math.min(12, zoom * 1.25); updateViewBox(); };
  root.querySelector("#zoom-out").onclick = () => { zoom = Math.max(0.5, zoom / 1.25); updateViewBox(); };
  root.querySelector("#zoom-fit").onclick = () => { zoom = 1; viewCenterX = viewWidth / 2; viewCenterY = viewHeight / 2; updateViewBox(); };
  svg.addEventListener("pointerdown", event => {
    const target = event.target.closest("[data-object-id]");
    if (target) { selectedId = target.dataset.objectId; const pos = toWorld(event); const object = project.objects.find(item => item.id === selectedId); drag = { id: selectedId, start: pos, x: object.xMm, y: object.yMm, moved: false }; svg.setPointerCapture(event.pointerId); drawLists(); drawObjects(); drawProperties(); event.preventDefault(); return; }
    if (svg.dataset.tool === "pan") { drag = { pan: true, clientX: event.clientX, clientY: event.clientY }; svg.setPointerCapture(event.pointerId); event.preventDefault(); return; }
    if (svg.dataset.tool === "place" && metricReady) { const pos = toWorld(event); const next = clone(project); const obj = { id: `object-${crypto.randomUUID?.() || Date.now()}`, type: "generic-plan-object", module: "core", name: `Objekt ${next.objects.length + 1}`, xMm: Math.round(pos.xMm), yMm: Math.round(pos.yMm), zMm: project.layers.find(layer => layer.id === activeLayerId)?.elevationMm || 0, widthMm: 700, depthMm: 500, rotationDeg: 0, layerId: activeLayerId }; next.objects.push(obj); selectedId = obj.id; record(next); setTool("select"); event.preventDefault(); }
  });
  svg.addEventListener("pointermove", event => { if (!drag) return; if (drag.pan) { const width = viewWidth / zoom, height = viewHeight / zoom; viewCenterX -= (event.clientX - drag.clientX) * width / svg.clientWidth; viewCenterY -= (event.clientY - drag.clientY) * height / svg.clientHeight; drag.clientX = event.clientX; drag.clientY = event.clientY; updateViewBox(); return; } const pos = toWorld(event); const obj = project.objects.find(item => item.id === drag.id); obj.xMm = Math.round(drag.x + pos.xMm - drag.start.xMm); obj.yMm = Math.round(drag.y + pos.yMm - drag.start.yMm); drag.moved = true; drawObjects(); });
  svg.addEventListener("pointerup", () => { if (!drag) return; if (!drag.pan) { const next = clone(project); record(next); } drag = null; });
  svg.addEventListener("pointercancel", () => { drag = null; });
  drawLists(); drawObjects(); drawProperties(); updateHistoryButtons();
  if (!metricReady) setStatus("Maßstab offen · Flächenmaße festlegen oder Grundriss kalibrieren", "");
  return () => { if (assetUrl) URL.revokeObjectURL(assetUrl); };
}
