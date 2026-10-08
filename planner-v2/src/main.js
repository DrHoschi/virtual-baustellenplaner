import { IndexedDbProjectStore } from "./infrastructure/indexeddb-project-store.v1.js";
import { ProjectRepository } from "./application/project-repository.v1.js";
import { createProjectService } from "./application/project-service.v1.js";
import { renderOverview } from "./ui/project-overview.js";
import { renderSetup } from "./ui/project-setup.js";
import { renderCalibration } from "./ui/plan-calibration.js";

const status = document.querySelector("#save-status");
const screen = document.querySelector("#screen");
let service;
let activeProjectId = null;

function setStatus(text, kind = "") { status.textContent = text; status.className = `save-status ${kind}`; }
function errorMessage(error) { setStatus(error?.name === "QuotaExceededError" ? "Speicher voll · nicht gespeichert" : "Fehler · nicht gespeichert", "error"); }
function withErrors(action) { return async (...args) => { try { await action(...args); } catch (error) { errorMessage(error); console.error(error); } }; }

async function overview() {
  const projects = await service.list();
  renderOverview(screen, projects, {
    onNew: () => { screen.innerHTML = ""; renderSetup(screen, { onCancel: overview, onCreate: withErrors(async fields => { setStatus("Speichert …"); const project = await service.create(fields); activeProjectId = project.id; setStatus("Gespeichert", "success"); await editProject(project); }) }); },
    onOpen: withErrors(async id => { const project = await service.get(id); if (!project) throw new Error("Projekt nicht gefunden."); activeProjectId = id; await editProject(project); }),
    onExport: withErrors(async id => download(await service.exportFile(id), `${id}.bp-project`)),
    onImport: withErrors(async file => { setStatus("Prüft Projektdatei …"); await service.importFile(file); setStatus("Projekt importiert", "success"); await overview(); }),
  });
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function editProject(project) {
  const asset = project.planBackground ? await service.repository.getAsset(project.planBackground.assetId) : null;
  screen.innerHTML = `
    <section class="project-head"><button class="back-button" id="back">‹ Projekte</button><div><p class="eyebrow">PROJEKT</p><h2></h2></div><button class="secondary" id="export">Projektdatei sichern</button></section>
    <section class="editor-grid"><div class="panel">
      <h3>Baustellenfläche</h3><p class="muted">Einheit: mm · Ursprung: unten links · Höhe: später je Bauteil-/Planungsebene</p>
      <div class="area-card"><span class="area-icon">⌗</span><div><b></b><span class="muted area-dims"></span></div></div>
      <h3>Grundriss</h3><label class="file-button">PNG oder JPEG laden<input id="plan-file" type="file" accept="image/png,image/jpeg"></label>
      <p class="muted" id="plan-info"></p><div id="calibration-slot"></div>
    </div><div class="panel plan-panel"><div class="plan-toolbar"><h3>Arbeitsfläche</h3><span class="muted">2D · maßstäblich nach Kalibrierung</span></div><div class="plan-canvas" id="plan-canvas"></div><p class="muted">Paket A: Projekt, Fläche und Grundriss. Platzierung, Leitungswege und Undo/Redo folgen in Paket B.</p></div></section>`;
  screen.querySelector("h2").textContent = project.name;
  screen.querySelector(".area-card b").textContent = project.siteArea.kind === "whole-hall" ? "Ganze Halle" : project.siteArea.kind === "hall-section" ? "Hallenteil" : project.siteArea.kind === "free-area" ? "Freie Fläche" : "Fläche noch nicht festgelegt";
  screen.querySelector(".area-dims").textContent = project.siteArea.widthMm ? `${project.siteArea.widthMm} × ${project.siteArea.heightMm} mm` : "Abmessungen offen";
  screen.querySelector("#back").onclick = withErrors(overview);
  screen.querySelector("#export").onclick = withErrors(async () => download(await service.exportFile(project.id), `${project.id}.bp-project`));
  if (asset?.blob) {
    const img = document.createElement("img"); img.alt = "Projektgrundriss"; img.src = URL.createObjectURL(asset.blob); screen.querySelector("#plan-canvas").append(img);
    screen.querySelector("#plan-info").textContent = `${project.planBackground.fileName} · ${project.planBackground.widthPx} × ${project.planBackground.heightPx} px`;
  } else screen.querySelector("#plan-canvas").innerHTML = '<div class="empty-plan"><span>＋</span><b>Noch kein Grundriss</b><small>Grundriss laden, um die Fläche vorzubereiten.</small></div>';
  screen.querySelector("#plan-file").onchange = withErrors(async event => {
    const file = event.target.files[0]; if (!file) return;
    const dimensions = await readImageDimensions(file);
    setStatus("Speichert Grundriss …"); project = await service.attachPlan(project.id, file, dimensions); setStatus("Gespeichert", "success"); await editProject(project);
  });
  if (project.planBackground) renderCalibration(screen.querySelector("#calibration-slot"), project, {
    onSave: withErrors(async input => { setStatus("Speichert Kalibrierung …"); project = await service.calibrate(project.id, input); setStatus("Gespeichert", "success"); await editProject(project); }),
  });
}

function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const image = new Image(); const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve({ widthPx: image.naturalWidth, heightPx: image.naturalHeight }); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Bild konnte nicht gelesen werden.")); };
    image.src = url;
  });
}

async function start() {
  try {
    service = createProjectService({ repository: new ProjectRepository(new IndexedDbProjectStore()) });
    await overview(); setStatus("Lokal bereit", "success");
  } catch (error) {
    setStatus("Lokaler Speicher nicht verfügbar", "error");
    screen.innerHTML = '<div class="error-panel"><h2>Planer kann nicht gestartet werden</h2><p>Der lokale Projektspeicher ist nicht verfügbar. Projekte wurden nicht gespeichert.</p><button id="retry">Erneut versuchen</button></div>';
    screen.querySelector("#retry").onclick = start;
  }
}

start();
