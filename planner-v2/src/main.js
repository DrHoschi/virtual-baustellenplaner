import { IndexedDbProjectStore } from "./infrastructure/indexeddb-project-store.v1.js";
import { ProjectRepository } from "./application/project-repository.v1.js";
import { createProjectService } from "./application/project-service.v1.js";
import { renderOverview } from "./ui/project-overview.js";
import { renderSetup } from "./ui/project-setup.js";
import { renderCalibration } from "./ui/plan-calibration.js";
import { renderWorkarea } from "./ui/workarea-editor.v1.js";

const status = document.querySelector("#save-status");
const screen = document.querySelector("#screen");
let service;
let activeProjectId = null;
let cleanupWorkarea = null;
let cleanupCalibration = null;

function setStatus(text, kind = "") { status.textContent = text; status.className = `save-status ${kind}`; }
function errorMessage(error) { setStatus(error?.name === "QuotaExceededError" ? "Speicher voll · nicht gespeichert" : "Fehler · nicht gespeichert", "error"); }
function withErrors(action) { return async (...args) => { try { await action(...args); } catch (error) { errorMessage(error); console.error(error); } }; }
fetch("./build-info.json", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(info => {
  if (info?.blockId && info?.testBuild && info?.shortSha) document.querySelector("#build-id").textContent = `NEUAUFBAU · PAKET D · TESTBUILD ${info.testBuild} · ${info.shortSha}`;
}).catch(() => {});

async function overview() {
  cleanupWorkarea?.(); cleanupWorkarea = null;
  cleanupCalibration?.(); cleanupCalibration = null;
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
  cleanupWorkarea?.(); cleanupWorkarea = null;
  cleanupCalibration?.(); cleanupCalibration = null;
  const asset = project.planBackground ? await service.getAsset(project.planBackground.assetId) : null;
  screen.innerHTML = `<section class="project-head"><button class="back-button" id="back">‹ Projekte</button><div><p class="eyebrow">PROJEKT</p><h2></h2></div><button class="secondary" id="export">Projektdatei sichern</button></section>
    <section class="plan-setup panel"><div><h3>Baustellenfläche und Grundriss</h3><p class="muted area-description"></p></div><label class="file-button secondary">PNG oder JPEG laden<input id="plan-file" type="file" accept="image/png,image/jpeg"></label>
    <div class="area-editor"><label>Bereich<select id="area-kind"><option value="unconfigured">Noch offen</option><option value="whole-hall">Ganze Halle</option><option value="hall-section">Hallenteil</option><option value="free-area">Freie Fläche</option></select></label><label>Breite · m<input id="area-width" type="number" min="0.001" step="0.001"></label><label>Länge · m<input id="area-height" type="number" min="0.001" step="0.001"></label><button class="secondary" id="apply-area">Fläche übernehmen</button><span class="form-error" id="area-error" role="alert"></span></div>
    <p class="muted plan-info" id="plan-info"></p><div id="calibration-slot"></div></section>
    <div id="workarea-root"></div>`;
  screen.querySelector("h2").textContent = project.name;
  const areaName = project.siteArea.kind === "whole-hall" ? "Ganze Halle" : project.siteArea.kind === "hall-section" ? "Hallenteil" : project.siteArea.kind === "free-area" ? "Freie Fläche" : "Arbeitsfläche noch nicht festgelegt";
  screen.querySelector(".area-description").textContent = `${areaName}${project.siteArea.widthMm ? ` · ${project.siteArea.widthMm} × ${project.siteArea.heightMm} mm` : " · Maße offen"} · Höhe und Sichtbarkeit werden über Ebenen gesteuert.`;
  screen.querySelector("#area-kind").value = project.siteArea.kind;
  screen.querySelector("#area-width").value = project.siteArea.widthMm ? project.siteArea.widthMm / 1000 : "";
  screen.querySelector("#area-height").value = project.siteArea.heightMm ? project.siteArea.heightMm / 1000 : "";
  screen.querySelector("#back").onclick = withErrors(overview);
  screen.querySelector("#export").onclick = withErrors(async () => download(await service.exportFile(project.id), `${project.id}.bp-project`));
  if (asset?.blob) screen.querySelector("#plan-info").textContent = `${project.planBackground.fileName} · ${project.planBackground.widthPx} × ${project.planBackground.heightPx} px${project.planBackground.calibration ? ` · kalibriert mit ${Math.round(project.planBackground.calibration.scaleMmPerPixel * 1000) / 1000} mm/px` : " · noch nicht kalibriert"}`;
  if (project.planBackground) cleanupCalibration = renderCalibration(screen.querySelector("#calibration-slot"), project, { asset,
    onSave: withErrors(async input => { setStatus("Speichert Kalibrierung …"); project = await service.calibrate(project.id, input); setStatus("Gespeichert", "success"); await editProject(project); }),
  });
  cleanupWorkarea = renderWorkarea(screen.querySelector("#workarea-root"), project, asset, { setStatus, onSave: withErrors(async next => { setStatus("Speichert …"); project = await service.save(next); setStatus("Gespeichert", "success"); }) });
  const calibrationDetails = screen.querySelector("#calibration-slot details");
  if (calibrationDetails) {
    const workareaRoot = screen.querySelector("#workarea-root");
    const syncCalibrationVisibility = () => { workareaRoot.hidden = calibrationDetails.open; };
    calibrationDetails.addEventListener("toggle", syncCalibrationVisibility);
    syncCalibrationVisibility();
  }
  screen.querySelector("#apply-area").onclick = withErrors(async () => {
    const width = Number(screen.querySelector("#area-width").value), height = Number(screen.querySelector("#area-height").value);
    if (!(width > 0 && height > 0)) { screen.querySelector("#area-error").textContent = "Bitte Breite und Länge größer als 0 m angeben."; return; }
    const next = structuredClone(project); next.siteArea.kind = screen.querySelector("#area-kind").value; next.siteArea.widthMm = Math.round(width * 1000); next.siteArea.heightMm = Math.round(height * 1000);
    setStatus("Speichert Fläche …"); project = await service.save(next); setStatus("Gespeichert", "success"); await editProject(project);
  });
  screen.querySelector("#plan-file").onchange = withErrors(async event => {
    const file = event.target.files[0]; if (!file) return;
    const dimensions = await readImageDimensions(file);
    setStatus("Speichert Grundriss …"); project = await service.attachPlan(project.id, file, dimensions); setStatus("Gespeichert", "success"); await editProject(project);
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
