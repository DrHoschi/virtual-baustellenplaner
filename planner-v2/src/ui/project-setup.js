export function renderSetup(root, { onCancel, onCreate }) {
  root.innerHTML = `<section class="form-panel"><button class="back-button" id="cancel">‹ Übersicht</button><p class="eyebrow">NEUES PROJEKT</p><h2>Projekt und Arbeitsfläche</h2><p class="muted">Lege einen Arbeitsbereich fest. Die Maße und der Grundriss können später angepasst werden.</p>
  <form id="setup-form"><label>Projektname<input name="name" required maxlength="120" placeholder="z. B. Kamerainstallation Halle 2"></label>
    <label>Arbeitsbereich<select name="areaKind"><option value="unconfigured">Noch offen</option><option value="whole-hall">Ganze Halle</option><option value="hall-section">Teil einer Halle</option><option value="free-area">Freie Fläche</option></select></label>
    <div class="form-row"><label>Breite (m)<input name="width" type="number" min="0.001" step="0.001" placeholder="optional"></label><label>Länge (m)<input name="height" type="number" min="0.001" step="0.001" placeholder="optional"></label></div>
    <p class="form-error" id="form-error" role="alert"></p><div class="form-actions"><button class="secondary" type="button" id="cancel-bottom">Abbrechen</button><button class="primary" type="submit">Projekt erstellen</button></div></form></section>`;
  root.querySelector("#cancel").onclick = onCancel; root.querySelector("#cancel-bottom").onclick = onCancel;
  root.querySelector("#setup-form").onsubmit = event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const width = data.get("width"); const height = data.get("height");
    if ((width && !height) || (!width && height)) { root.querySelector("#form-error").textContent = "Bitte beide Flächenmaße ausfüllen oder beide leer lassen."; return; }
    root.querySelector("#form-error").textContent = "";
    onCreate({ name: data.get("name"), areaKind: data.get("areaKind"), widthMm: width ? Number(width) * 1000 : null, heightMm: height ? Number(height) * 1000 : null });
  };
}
