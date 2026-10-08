export function renderOverview(root, projects, { onNew, onOpen, onExport, onImport }) {
  root.innerHTML = `<section class="welcome"><div><p class="eyebrow">PROJEKTÜBERSICHT</p><h2>Womit möchtest du arbeiten?</h2><p class="muted">Deine Projekte werden lokal auf diesem Gerät gespeichert.</p></div><button class="primary" id="new-project">＋ Projekt anlegen</button></section>
  <div class="overview-actions"><label class="secondary file-button">Projektdatei importieren<input id="project-import" type="file" accept=".bp-project,application/vnd.baustellenplaner.project,application/zip"></label></div>
  <section class="project-list" aria-label="Gespeicherte Projekte"></section>`;
  root.querySelector("#new-project").onclick = onNew;
  root.querySelector("#project-import").onchange = event => { if (event.target.files[0]) onImport(event.target.files[0]); };
  const list = root.querySelector(".project-list");
  if (!projects.length) list.innerHTML = '<div class="empty-card"><span>▱</span><h3>Noch keine Projekte</h3><p>Lege ein Projekt an. Grundriss und Maßstab kannst du danach ergänzen.</p></div>';
  for (const project of projects) {
    const card = document.createElement("article"); card.className = "project-card";
    const title = document.createElement("h3"); title.textContent = project.name;
    const meta = document.createElement("p"); meta.className = "muted"; meta.textContent = `${project.siteArea.kind === "unconfigured" ? "Fläche offen" : project.siteArea.kind} · zuletzt geändert ${new Date(project.updatedAt).toLocaleString("de-DE")}`;
    const open = document.createElement("button"); open.className = "primary"; open.textContent = "Öffnen"; open.onclick = () => onOpen(project.id);
    const exportButton = document.createElement("button"); exportButton.className = "secondary"; exportButton.textContent = "Datei sichern"; exportButton.onclick = () => onExport(project.id);
    const actions = document.createElement("div"); actions.className = "card-actions"; actions.append(open, exportButton); card.append(title, meta, actions); list.append(card);
  }
}
