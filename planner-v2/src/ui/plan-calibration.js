const SVG = "http://www.w3.org/2000/svg";

function svgNode(tag, attributes = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export function renderCalibration(root, project, { asset, onSave }) {
  const plan = project.planBackground;
  const width = plan.widthPx;
  const height = plan.heightPx;
  const imageUrl = asset?.blob ? URL.createObjectURL(asset.blob) : null;
  let pointA = plan.calibration?.pixelPoints?.[0] || null;
  let pointB = plan.calibration?.pixelPoints?.[1] || null;
  let activePoint = pointA ? "B" : "A";
  let interaction = "point";
  let zoom = 1;
  let centerX = width / 2;
  let centerY = height / 2;
  let drag = null;

  root.innerHTML = `<div class="calibration-box">
    <h4>Grundriss kalibrieren</h4>
    <p class="muted">Setze Punkt A und B direkt auf die Zeichnung. Die Werte werden in Originalpixeln erfasst. Zoome zum genauen Platzieren.</p>
    <div class="calibration-toolbar" role="group" aria-label="Kalibrierungswerkzeuge">
      <button class="secondary${activePoint === "A" ? " selected" : ""}" type="button" id="select-point-a" aria-pressed="${activePoint === "A"}">Punkt A setzen</button>
      <button class="secondary${activePoint === "B" ? " selected" : ""}" type="button" id="select-point-b" aria-pressed="${activePoint === "B"}">Punkt B setzen</button>
      <button class="secondary" type="button" id="pan-calibration">Ansicht verschieben</button>
      <button class="secondary" type="button" id="calibration-zoom-out" aria-label="Grundriss verkleinern">−</button>
      <button class="secondary" type="button" id="calibration-zoom-in" aria-label="Grundriss vergrößern">＋</button>
      <button class="secondary" type="button" id="calibration-fit">Einpassen</button>
    </div>
    <div class="calibration-canvas-wrap">
      <svg id="calibration-canvas" class="calibration-canvas" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grundriss zur Kalibrierung">
        ${imageUrl ? `<image href="${imageUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" pointer-events="none"></image>` : `<rect x="0" y="0" width="${width}" height="${height}" fill="#eef2f6"></rect>`}
        <g id="calibration-markers"></g>
      </svg>
    </div>
    <p id="calibration-help" class="muted calibration-help" aria-live="polite"></p>
    <div class="form-row">
      <label>Punkt A · X (px)<input name="ax" type="number" step="any" min="0" max="${width}" required value="${pointA?.x ?? ""}"></label>
      <label>Punkt A · Y (px)<input name="ay" type="number" step="any" min="0" max="${height}" required value="${pointA?.y ?? ""}"></label>
    </div>
    <div class="form-row">
      <label>Punkt B · X (px)<input name="bx" type="number" step="any" min="0" max="${width}" required value="${pointB?.x ?? ""}"></label>
      <label>Punkt B · Y (px)<input name="by" type="number" step="any" min="0" max="${height}" required value="${pointB?.y ?? ""}"></label>
    </div>
    <div class="form-row">
      <label>Reale Distanz<input name="distance" type="number" step="any" min="0.001" required value="${plan.calibration ? plan.calibration.realDistanceMm : ""}"></label>
      <label>Einheit<select name="unit"><option value="m">Meter</option><option value="cm">Zentimeter</option><option value="mm" ${plan.calibration ? "selected" : ""}>Millimeter</option></select></label>
    </div>
    <p class="calibration-summary" id="calibration-summary">${plan.calibration ? `Kalibriert · ${Math.round(plan.calibration.scaleMmPerPixel * 1000) / 1000} mm/px` : "Noch nicht kalibriert"}</p>
    <button class="primary" id="save-calibration" type="button">Maßstab speichern</button>
    <p class="form-error" id="calibration-error" role="alert"></p>
  </div>`;

  const svg = root.querySelector("#calibration-canvas");
  const markers = root.querySelector("#calibration-markers");
  const input = name => root.querySelector(`[name="${name}"]`);
  const help = root.querySelector("#calibration-help");

  function updateViewBox() {
    const viewWidth = width / zoom;
    const viewHeight = height / zoom;
    const x = Math.min(width - viewWidth, Math.max(0, centerX - viewWidth / 2));
    const y = Math.min(height - viewHeight, Math.max(0, centerY - viewHeight / 2));
    centerX = x + viewWidth / 2;
    centerY = y + viewHeight / 2;
    svg.setAttribute("viewBox", `${x} ${y} ${viewWidth} ${viewHeight}`);
  }

  function drawMarkers() {
    markers.replaceChildren();
    for (const [label, point, color] of [["A", pointA, "#dc2626"], ["B", pointB, "#2563eb"]]) {
      if (!point) continue;
      const group = svgNode("g", { "data-calibration-point": label, tabindex: 0, role: "button", "aria-label": `Kalibrierpunkt ${label}` });
      group.append(svgNode("circle", { cx: point.x, cy: point.y, r: 11 / zoom, fill: color, stroke: "white", "stroke-width": 3 / zoom }));
      group.append(svgNode("circle", { cx: point.x, cy: point.y, r: 3 / zoom, fill: "white", "pointer-events": "none" }));
      const text = svgNode("text", { x: point.x + 14 / zoom, y: point.y - 14 / zoom, "font-size": 16 / zoom, "font-weight": 800, fill: color, stroke: "white", "stroke-width": 4 / zoom, "paint-order": "stroke", "pointer-events": "none" });
      text.textContent = label;
      group.append(text);
      markers.append(group);
    }
  }

  function writePoint(label, point) {
    if (label === "A") pointA = point; else pointB = point;
    input(label.toLowerCase() + "x").value = String(Math.round(point.x * 100) / 100);
    input(label.toLowerCase() + "y").value = String(Math.round(point.y * 100) / 100);
    root.querySelector("#calibration-error").textContent = "";
    drawMarkers();
    const distance = pointA && pointB ? Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y) : null;
    help.textContent = distance ? `A und B liegen ${Math.round(distance * 100) / 100} px auseinander. Ziehe einen Marker zum Nachjustieren.` : `Punkt ${label} gesetzt. Wähle den anderen Punkt und tippe auf seine Position.`;
  }

  function setActivePoint(label) {
    activePoint = label;
    interaction = "point";
    for (const item of ["A", "B"]) {
      const button = root.querySelector(`#select-point-${item.toLowerCase()}`);
      button.classList.toggle("selected", item === label);
      button.setAttribute("aria-pressed", String(item === label));
    }
    root.querySelector("#pan-calibration").classList.remove("selected");
    help.textContent = `Tippe auf den Grundriss, um Punkt ${label} zu setzen. Vorhandene Marker kannst du zum Nachjustieren ziehen.`;
  }

  function imagePoint(event) {
    const screenPoint = svg.createSVGPoint();
    screenPoint.x = event.clientX;
    screenPoint.y = event.clientY;
    const point = screenPoint.matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.min(width, Math.max(0, point.x)), y: Math.min(height, Math.max(0, point.y)) };
  }

  for (const label of ["A", "B"]) {
    const suffix = label.toLowerCase();
    for (const axis of ["x", "y"]) input(suffix + axis).addEventListener("input", () => {
      const x = Number(input(suffix + "x").value), y = Number(input(suffix + "y").value);
      if (input(suffix + "x").value !== "" && input(suffix + "y").value !== "" && Number.isFinite(x) && Number.isFinite(y)) {
        if (label === "A") pointA = { x, y }; else pointB = { x, y };
        drawMarkers();
      }
    });
    root.querySelector(`#select-point-${suffix}`).onclick = () => setActivePoint(label);
  }
  root.querySelector("#pan-calibration").onclick = () => {
    interaction = "pan";
    root.querySelectorAll(".calibration-toolbar button").forEach(button => button.classList.toggle("selected", button.id === "pan-calibration"));
    help.textContent = "Ziehe die Zeichnung zum Verschieben. Ziehe einen Marker direkt, um ihn fein nachzujustieren.";
  };
  root.querySelector("#calibration-zoom-in").onclick = () => { zoom = Math.min(12, zoom * 1.5); updateViewBox(); drawMarkers(); };
  root.querySelector("#calibration-zoom-out").onclick = () => { zoom = Math.max(1, zoom / 1.5); updateViewBox(); drawMarkers(); };
  root.querySelector("#calibration-fit").onclick = () => { zoom = 1; centerX = width / 2; centerY = height / 2; updateViewBox(); drawMarkers(); };

  svg.addEventListener("pointerdown", event => {
    const marker = event.target.closest("[data-calibration-point]");
    if (marker) {
      const label = marker.dataset.calibrationPoint;
      drag = { type: "marker", label };
      svg.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (interaction === "pan") {
      drag = { type: "pan", startX: event.clientX, startY: event.clientY, centerX, centerY };
      svg.setPointerCapture(event.pointerId);
    } else {
      writePoint(activePoint, imagePoint(event));
      if (!pointA) setActivePoint("A"); else if (!pointB) setActivePoint("B");
    }
    event.preventDefault();
  });
  svg.addEventListener("pointermove", event => {
    if (!drag) return;
    if (drag.type === "marker") {
      const point = imagePoint(event);
      writePoint(drag.label, point);
      return;
    }
    const viewWidth = width / zoom, viewHeight = height / zoom;
    centerX = drag.centerX - (event.clientX - drag.startX) * viewWidth / svg.clientWidth;
    centerY = drag.centerY - (event.clientY - drag.startY) * viewHeight / svg.clientHeight;
    updateViewBox();
  });
  svg.addEventListener("pointerup", () => { drag = null; });
  svg.addEventListener("pointercancel", () => { drag = null; });

  root.querySelector("#save-calibration").onclick = () => {
    const error = root.querySelector("#calibration-error");
    if (!pointA || !pointB) { error.textContent = "Bitte zuerst Punkt A und Punkt B sichtbar im Grundriss setzen."; return; }
    if (![...root.querySelectorAll("input")].every(field => field.reportValidity())) return;
    const distance = Number(input("distance").value);
    if (!(distance > 0)) { error.textContent = "Bitte die reale Distanz größer als 0 eingeben."; return; }
    onSave({ pointA, pointB, realDistance: distance, unit: input("unit").value });
  };

  drawMarkers();
  help.textContent = "Tippe auf den Grundriss, um Punkt A zu setzen. Die Pixelwerte erscheinen darunter.";
  return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); };
}