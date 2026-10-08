export function renderCalibration(root, project, { onSave }) {
  const plan = project.planBackground;
  root.innerHTML = `<div class="calibration-box"><h4>Grundriss kalibrieren</h4><p class="muted">Zwei Bildpunkte und ihre reale Distanz festlegen. Punkte beziehen sich auf das Bild in Originalpixeln.</p>
  <div class="form-row"><label>Punkt A · X (px)<input name="ax" type="number" step="any" min="0" required value="${plan.calibration?.pixelPoints[0].x ?? ""}"></label><label>Punkt A · Y (px)<input name="ay" type="number" step="any" min="0" required value="${plan.calibration?.pixelPoints[0].y ?? ""}"></label></div>
  <div class="form-row"><label>Punkt B · X (px)<input name="bx" type="number" step="any" min="0" required value="${plan.calibration?.pixelPoints[1].x ?? ""}"></label><label>Punkt B · Y (px)<input name="by" type="number" step="any" min="0" required value="${plan.calibration?.pixelPoints[1].y ?? ""}"></label></div>
  <div class="form-row"><label>Reale Distanz<input name="distance" type="number" step="any" min="0.001" required value="${plan.calibration ? plan.calibration.realDistanceMm : ""}"></label><label>Einheit<select name="unit"><option value="m">Meter</option><option value="cm">Zentimeter</option><option value="mm" ${plan.calibration ? "selected" : ""}>Millimeter</option></select></label></div>
  <p class="calibration-summary">${plan.calibration ? `Kalibriert · ${Math.round(plan.calibration.scaleMmPerPixel * 1000) / 1000} mm/px` : "Noch nicht kalibriert"}</p>
  <button class="primary" id="save-calibration">Maßstab speichern</button><p class="form-error" id="calibration-error" role="alert"></p></div>`;
  root.querySelector("#save-calibration").onclick = () => {
    const form = root.querySelector(".calibration-box");
    if (![...form.querySelectorAll("input")].every(input => input.reportValidity())) return;
    const value = name => root.querySelector(`[name="${name}"]`).value;
    const input = { pointA: { x: Number(value("ax")), y: Number(value("ay")) }, pointB: { x: Number(value("bx")), y: Number(value("by")) }, realDistance: Number(value("distance")), unit: value("unit") };
    onSave(input);
  };
}
