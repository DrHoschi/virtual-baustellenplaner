import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

console.log("main.js geladen");
document.body.style.background = "#e9eef3";


/* ============================================================
   PARAMETER (hier stellst du Länge/Breite/Raster/Höhe/Tore ein)
   ============================================================ */
const HALL = {
  length: 60,   // m
  width: 30,    // m
  bay: 15,      // m Raster (Feldgröße)
  eaveH: 6.0,   // Traufhöhe (Seitenwandhöhe) in m
  ridgeAdd: 1.5,// zusätzliche Firsthöhe (Satteldach) in m
  steel: { col: 0.25, beam: 0.18 },   // “Profil”-Dicken (optisch)
  cladding: { t: 0.08 },             // Dämm-Panel Dicke (optisch)
  doors: [
    // Tore an der Stirnseite (Z = -L/2 oder +L/2), X ist links/rechts
    { side: "front", xCenter: -6, w: 6, h: 5 },
    { side: "front", xCenter:  6, w: 6, h: 5 },
    // optional: eins hinten
    // { side: "back", xCenter: 0, w: 6, h: 5 },
  ]
};

// Helper: Meter -> Scene-Units (1 = 1m)
const M = (v) => v;

// ============================================================
// BASIS: Szene, Kamera, Licht, Controls
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9eef3);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 500);
camera.position.set(M(55), M(28), M(55));

//const renderer = new THREE.WebGLRenderer({ antialias: true });
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});
renderer.setClearColor(0xe9eef3, 1);
renderer.domElement.style.position = "fixed";
renderer.domElement.style.inset = "0";

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ============================================================
// HUD MENU + MODE SYSTEM (Planer-Menü)
// ============================================================
const HUD = {
  mode: "navigate", // navigate | issue | task | daily | measure | view
};

const hudMenuBtn  = document.getElementById("hudMenuBtn");
const hudMenu     = document.getElementById("hudMenu");
const hudModeText = document.getElementById("hudModeText");
const hudItems    = Array.from(document.querySelectorAll(".hudItem"));

function setMode(mode) {
  HUD.mode = mode;

  // Text im HUD
  const label = ({
    navigate: "Navigieren",
    issue: "Mangel anlegen",
    task: "Aufgabe anlegen",
    daily: "Bautagebuch",
    measure: "Messen",
    view: "Ansicht"
  })[mode] || mode;

  hudModeText.textContent = `Modus: ${label}`;

  // Active Button markieren
  hudItems.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));

  // Menü schließen nach Auswahl
  hudMenu.classList.add("hidden");
}

hudMenuBtn.addEventListener("click", () => {
  hudMenu.classList.toggle("hidden");
});

hudItems.forEach(btn => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    const action = btn.dataset.action;
    if (mode) {
      setMode(mode);
      return;
    }
    if (action === "issues") {
      openIssuesOverlay();
      // Menü schließen (Tablet)
      hudMenu.classList.add("hidden");
      return;
    }
  });
});

// Default
setMode("navigate");

// ============================================================
// PROJECT SYSTEM (localStorage) – Demo-funktional ohne Backend
// ============================================================
const LS_KEY_PROJECTS = "vbplanner.projects.v1";
const LS_KEY_ACTIVE  = "vbplanner.projects.activeId.v1";

function loadProjects() {
  try {
    const raw = localStorage.getItem(LS_KEY_PROJECTS);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.length) return arr;
  } catch (e) {}
  return [{
    id: "p_" + Date.now(),
    name: "Stahlträgerhalle Demo",
    location: "",
    createdAt: new Date().toISOString()
  }];
}

function saveProjects(list) {
  localStorage.setItem(LS_KEY_PROJECTS, JSON.stringify(list));
}

function getActiveProjectId(projects) {
  const saved = localStorage.getItem(LS_KEY_ACTIVE);
  if (saved && projects.some(p => p.id === saved)) return saved;
  return projects[0]?.id;
}
function setActiveProjectId(id) {
  localStorage.setItem(LS_KEY_ACTIVE, id);
}

let projects = loadProjects();
saveProjects(projects);
let activeProjectId = getActiveProjectId(projects);
setActiveProjectId(activeProjectId);

// UI
const projectSelect = document.getElementById("projectSelect");
const projectAddBtn = document.getElementById("projectAddBtn");
const hudTitleTop   = document.querySelector("#hudTitle .t1");

// Modal
const projectModal       = document.getElementById("projectModal");
const projectModalClose  = document.getElementById("projectModalClose");
const projectModalCancel = document.getElementById("projectModalCancel");
const projectModalCreate = document.getElementById("projectModalCreate");
const projectName        = document.getElementById("projectName");
const projectLocation    = document.getElementById("projectLocation");

function renderProjectSelect() {
  projectSelect.innerHTML = "";
  projects.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.location ? `${p.name} · ${p.location}` : p.name;
    projectSelect.appendChild(opt);
  });
  projectSelect.value = activeProjectId;

  const active = projects.find(p => p.id === activeProjectId);
  if (active && hudTitleTop) hudTitleTop.textContent = active.name || "Projekt";
}

function openProjectModal() {
  projectName.value = "";
  projectLocation.value = "";
  projectModal.classList.remove("hidden");
  setTimeout(() => projectName.focus(), 30);
}
function closeProjectModal() {
  projectModal.classList.add("hidden");
}

projectAddBtn.addEventListener("click", openProjectModal);
projectModalClose.addEventListener("click", closeProjectModal);
projectModalCancel.addEventListener("click", closeProjectModal);
projectModal.addEventListener("click", (e) => { if (e.target === projectModal) closeProjectModal(); });

projectModalCreate.addEventListener("click", () => {
  const name = (projectName.value || "").trim();
  const loc  = (projectLocation.value || "").trim();
  if (!name) { alert("Bitte einen Projektnamen eingeben."); return; }

  const p = { id:"p_"+Date.now(), name, location:loc, createdAt:new Date().toISOString() };
  projects = [p, ...projects];
  saveProjects(projects);

  activeProjectId = p.id;
  setActiveProjectId(activeProjectId);
  renderProjectSelect();
  closeProjectModal();
});

projectSelect.addEventListener("change", () => {
  activeProjectId = projectSelect.value;
  setActiveProjectId(activeProjectId);
  renderProjectSelect();

  // Badge + Liste aktualisieren
  try { updateIssueBadge(); } catch (e) {}
  try { if (issuesOverlay && issuesOverlay.style.display === "flex") renderIssuesList(); } catch (e) {}
});

// init
renderProjectSelect();
updateIssueBadge();
updateTaskBadge();
rebuildIssueMarkers();
try { updateIssueBadge(); } catch (e) {}






// ============================================================
// ISSUES (Mängel) – pro Projekt in localStorage + UI (Badge/Liste/Modal)
// ============================================================
const LS_KEY_ISSUES = "vbplanner.issues.v1";

function loadIssues() {
  try {
    const raw = localStorage.getItem(LS_KEY_ISSUES);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function saveIssues(list) {
  localStorage.setItem(LS_KEY_ISSUES, JSON.stringify(list));
}

let issues = loadIssues();

// --- HUD Badge (Anzahl im aktuellen Projekt) ---
const hudIssueBadge = document.getElementById("hudIssueBadge");

function getProjectIssues() {
  return issues.filter(i => i.projectId === activeProjectId);
}

function updateIssueBadge() {
  const n = getProjectIssues().length;
  if (hudIssueBadge) hudIssueBadge.textContent = String(n);
}

// ============================================================
// TASKS (Aufgaben) – pro Projekt in localStorage + UI (Badge/Liste/Modal)
// ============================================================
const LS_KEY_TASKS = "vbplanner.tasks.v1";

function loadTasks() {
  try {
    const raw = localStorage.getItem(LS_KEY_TASKS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function saveTasks(list) {
  localStorage.setItem(LS_KEY_TASKS, JSON.stringify(list));
}

let tasks = loadTasks();

// --- HUD Badge (Anzahl im aktuellen Projekt) ---
const hudTaskBadge = document.getElementById("hudTaskBadge");

function getProjectTasks() {
  return tasks.filter(t => t.projectId === activeProjectId);
}
function updateTaskBadge() {
  const n = getProjectTasks().length;
  if (hudTaskBadge) hudTaskBadge.textContent = String(n);
}
// ============================================================
// ISSUE MARKERS (3D) – Punkt/Highlight pro Bauteil nach Status
// ============================================================
function statusRank(s) {
  // höher = wichtiger (rot)
  if (s === "Neu") return 3;
  if (s === "In Arbeit") return 2;
  if (s === "Erledigt") return 1;
  return 0;
}
function statusColor(s) {
  if (s === "Neu") return 0xcc2b2b;        // rot
  if (s === "In Arbeit") return 0xd4a017;  // gelb
  if (s === "Erledigt") return 0x2f9e44;   // grün
  return 0x888888;
}

function clearIssueMarkers() {
  while (issueMarkers.children.length) issueMarkers.remove(issueMarkers.children[0]);
}

function rebuildIssueMarkers() {
  clearIssueMarkers();

  // pro Bauteil "schlimmsten" Status ermitteln
  const byEl = new Map();
  getProjectIssues().forEach(i => {
    if (!i.elementId) return;
    const prev = byEl.get(i.elementId);
    if (!prev || statusRank(i.status) > statusRank(prev)) byEl.set(i.elementId, i.status || "Neu");
  });

  byEl.forEach((st, elementId) => {
    const mesh = elementById.get(elementId);
    if (!mesh) return;

    // Marker-Punkt über dem Bauteil
    const color = statusColor(st);
    const markerMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.0, emissive: new THREE.Color(color), emissiveIntensity: 0.25 });
    const markerGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const marker = new THREE.Mesh(markerGeo, markerMat);

    // Position: über BoundingBox
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const yTop = box.max.y;

    marker.position.set(center.x, yTop + 0.35, center.z);
    marker.userData = { type:"IssueMarker", elementId, status: st };
    issueMarkers.add(marker);

    // leichte Hervorhebung des Bauteils (emissive)
    if (mesh.material && mesh.material.isMeshStandardMaterial) {
      const base = mesh.material;
      const cloned = base.clone();
      cloned.emissive = new THREE.Color(color);
      cloned.emissiveIntensity = 0.10;
      mesh.material = cloned;
    }
  });
}





// --- Issues Overlay (Liste) ---
const issuesOverlay = document.getElementById("issuesOverlay");
const issuesClose   = document.getElementById("issuesClose");
const issuesListEl  = document.getElementById("issuesList");
const filterBtns    = Array.from(document.querySelectorAll("#issuesFilters .filterBtn"));
let issuesFilter = "all"; // all | Neu | In Arbeit | Erledigt

function statusClass(s) {
  if (s === "Neu") return "neu";
  if (s === "In Arbeit") return "inarbeit";
  if (s === "Erledigt") return "erledigt";
  return "";
}

function renderIssuesList() {
  if (!issuesListEl) return;
  const list = getProjectIssues().filter(i => issuesFilter === "all" ? true : i.status === issuesFilter);

  if (!list.length) {
    issuesListEl.innerHTML = '<div style="opacity:0.7;padding:8px;">Keine Mängel in diesem Filter.</div>';
    return;
  }

  issuesListEl.innerHTML = "";
  list.forEach(i => {
    const row = document.createElement("div");
    row.className = "issueRow";

    const due = i.dueDate ? ` · fällig ${i.dueDate}` : "";
    const ass = i.assignee ? ` · ${i.assignee}` : "";

    row.innerHTML = `
      <div class="top">
        <div class="title">${escapeHtml(i.elementLabel || "Bauteil")}</div>
        <div class="status ${statusClass(i.status)}">${escapeHtml(i.status || "Neu")}</div>
      </div>
      <div class="meta">${escapeHtml(i.loc || "")}${ass}${due}</div>
      <div class="note">${escapeHtml(i.note || "")}</div>
      <button type="button">Bearbeiten</button>
    `;

    row.querySelector("button").addEventListener("click", () => {
      openIssueModal({ mode: "edit", issue: i });
    });

    issuesListEl.appendChild(row);
  });
}

function openIssuesOverlay() {
  if (!issuesOverlay) return;
  issuesOverlay.style.display = "flex";
  renderIssuesList();
}
function closeIssuesOverlay() {
  if (!issuesOverlay) return;
  issuesOverlay.style.display = "none";
}

if (issuesClose) issuesClose.addEventListener("click", closeIssuesOverlay);
if (issuesOverlay) {
  issuesOverlay.addEventListener("click", (e) => {
    if (e.target === issuesOverlay) closeIssuesOverlay();
  });
}

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    issuesFilter = btn.dataset.filter || "all";
    filterBtns.forEach(b => b.classList.toggle("active", b === btn));
    renderIssuesList();
  });
});

// --- Issue Modal (Anlegen/Bearbeiten) ---
const issueModal       = document.getElementById("issueModal");
const issueModalTitle  = document.getElementById("issueModalTitle");
const issueModalClose  = document.getElementById("issueModalClose");
const issueModalCancel = document.getElementById("issueModalCancel");
const issueModalSave   = document.getElementById("issueModalSave");

const issueElementLabel = document.getElementById("issueElementLabel");
const issueElementMeta  = document.getElementById("issueElementMeta");

const issueStatus   = document.getElementById("issueStatus");
const issueDue      = document.getElementById("issueDue");
const issueAssignee = document.getElementById("issueAssignee");
const issueText     = document.getElementById("issueText");

const issuePhotoBtn    = document.getElementById("issuePhotoBtn");
const issuePhotoInput  = document.getElementById("issuePhotoInput");
const issuePhotoName   = document.getElementById("issuePhotoName");
const issuePhotoPreview= document.getElementById("issuePhotoPreview");

// interner State fürs Modal
let issueDraft = {
  mode: "new",         // "new" | "edit"
  pickedObj: null,     // Mesh (optional)
  issueId: null,       // bei edit
  element: { id:"", label:"", type:"", loc:"" },
  photo: { name:"", dataUrl:"" }
};

function closeIssueModal() {
  if (!issueModal) return;
  issueModal.classList.add("hidden");
  // Reset Foto-Vorschau
  try {
    if (issuePhotoPreview) { issuePhotoPreview.src = ""; issuePhotoPreview.style.display = "none"; }
    if (issuePhotoName) issuePhotoName.textContent = "kein Foto";
    if (issuePhotoInput) issuePhotoInput.value = "";
  } catch (e) {}
}

// ============================================================
// TASKS UI (Overlay + Modal) – analog zu Mängeln
// ============================================================
const tasksOverlay = document.getElementById("tasksOverlay");
const tasksClose   = document.getElementById("tasksClose");
const tasksNewBtn  = document.getElementById("tasksNew");
const tasksListEl  = document.getElementById("tasksList");
const taskFilterBtns = Array.from(document.querySelectorAll("#tasksFilters .filterBtn"));
let tasksFilter = "all"; // all | Offen | In Arbeit | Erledigt

function openTasksOverlay() {
  if (!tasksOverlay) return;
  tasksOverlay.style.display = "flex";
  renderTasksList();
}
function closeTasksOverlay() {
  if (!tasksOverlay) return;
  tasksOverlay.style.display = "none";
}
if (tasksClose) tasksClose.addEventListener("click", closeTasksOverlay);
if (tasksOverlay) tasksOverlay.addEventListener("click", (e) => { if (e.target === tasksOverlay) closeTasksOverlay(); });

taskFilterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    taskFilterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    tasksFilter = btn.dataset.filter;
    renderTasksList();
  });
});

function renderTasksList() {
  if (!tasksListEl) return;
  const list = getProjectTasks().filter(t => tasksFilter === "all" ? true : t.status === tasksFilter);

  if (!list.length) {
    tasksListEl.innerHTML = '<div style="opacity:0.7;padding:8px;">Keine Aufgaben in diesem Filter.</div>';
    return;
  }

  tasksListEl.innerHTML = "";
  list.forEach(t => {
    const row = document.createElement("div");
    row.className = "taskRow";

    const due = t.dueDate ? ` · fällig ${t.dueDate}` : "";
    const ass = t.assignee ? ` · ${t.assignee}` : "";

    row.innerHTML = `
      <div class="top">
        <div class="title">${escapeHtml(t.title || (t.elementLabel || "Aufgabe"))}</div>
        <div class="status ${statusClass(t.status)}">${escapeHtml(t.status || "Offen")}</div>
      </div>
      <div class="meta">${escapeHtml(t.elementLabel || "")}${ass}${due}</div>
      <div class="note">${escapeHtml(t.note || "")}</div>
      <div style="display:flex; gap:8px; margin-top:6px;">
        <button class="btnGhost" data-act="edit">Bearbeiten</button>
      </div>
    `;

    row.querySelector('[data-act="edit"]').addEventListener("click", () => openTaskModal(t));
    tasksListEl.appendChild(row);
  });
}

// --- Task Modal ---
const taskModal = document.getElementById("taskModal");
const taskModalTitle = document.getElementById("taskModalTitle");
const taskModalClose = document.getElementById("taskModalClose");
const taskModalCancel = document.getElementById("taskModalCancel");
const taskModalSave = document.getElementById("taskModalSave");

const taskStatus = document.getElementById("taskStatus");
const taskTitle  = document.getElementById("taskTitle");
const taskNote   = document.getElementById("taskNote");
const taskAssignee = document.getElementById("taskAssignee");
const taskDueDate  = document.getElementById("taskDueDate");
const taskElementInfo = document.getElementById("taskElementInfo");

let taskEditing = null;
let taskElementCtx = null; // { elementId,label,type,loc }

function openTaskModal(taskOrNull=null, elementCtx=null) {
  taskEditing = taskOrNull;
  taskElementCtx = elementCtx || taskElementCtx;

  if (taskModalTitle) taskModalTitle.textContent = taskEditing ? "Aufgabe bearbeiten" : "Neue Aufgabe";

  const elLabel = (taskEditing?.elementLabel) || (taskElementCtx?.label) || "—";
  if (taskElementInfo) taskElementInfo.textContent = elLabel;

  taskStatus.value = taskEditing?.status || "Offen";
  taskTitle.value  = taskEditing?.title  || "";
  taskNote.value   = taskEditing?.note   || "";
  taskAssignee.value = taskEditing?.assignee || "";
  taskDueDate.value  = taskEditing?.dueDate || "";

  taskModal.classList.remove("hidden");
  setTimeout(() => taskTitle.focus(), 30);
}

function closeTaskModal() {
  taskModal.classList.add("hidden");
}

if (taskModalClose) taskModalClose.addEventListener("click", closeTaskModal);
if (taskModalCancel) taskModalCancel.addEventListener("click", closeTaskModal);
if (taskModal) taskModal.addEventListener("click", (e) => { if (e.target === taskModal) closeTaskModal(); });

if (taskModalSave) taskModalSave.addEventListener("click", () => {
  const tStatus = taskStatus.value || "Offen";
  const tTitle  = (taskTitle.value || "").trim();
  const tNote   = (taskNote.value || "").trim();
  const tAss    = (taskAssignee.value || "").trim();
  const tDue    = taskDueDate.value || "";

  if (!tTitle) { alert("Bitte einen Titel eingeben."); return; }

  const base = {
    projectId: activeProjectId,
    status: tStatus,
    title: tTitle,
    note: tNote,
    assignee: tAss,
    dueDate: tDue,
    elementId: taskEditing?.elementId || taskElementCtx?.elementId || "",
    elementLabel: taskEditing?.elementLabel || taskElementCtx?.label || "",
    elementType: taskEditing?.elementType || taskElementCtx?.type || "",
    loc: taskEditing?.loc || taskElementCtx?.loc || "",
  };

  if (taskEditing) {
    tasks = tasks.map(x => x.id === taskEditing.id ? { ...x, ...base, updatedAt: new Date().toISOString() } : x);
  } else {
    const newTask = { id:"t_"+Date.now(), createdAt:new Date().toISOString(), ...base };
    tasks = [newTask, ...tasks];
  }

  saveTasks(tasks);
  updateTaskBadge();
  renderTasksList();
  closeTaskModal();
});

// New Task button
if (tasksNewBtn) tasksNewBtn.addEventListener("click", () => {
  taskEditing = null;
  taskElementCtx = null;
  openTaskModal(null, null);
});

// ============================================================
// EXPORT (JSON/CSV) – pro Projekt
// ============================================================
const exportModal = document.getElementById("exportModal");
const exportModalClose = document.getElementById("exportModalClose");
const exportModalOk = document.getElementById("exportModalOk");
const exportIssuesJson = document.getElementById("exportIssuesJson");
const exportIssuesCsv  = document.getElementById("exportIssuesCsv");
const exportTasksJson  = document.getElementById("exportTasksJson");
const exportTasksCsv   = document.getElementById("exportTasksCsv");

function openExportModal() { exportModal.classList.remove("hidden"); }
function closeExportModal(){ exportModal.classList.add("hidden"); }

if (exportModalClose) exportModalClose.addEventListener("click", closeExportModal);
if (exportModalOk) exportModalOk.addEventListener("click", closeExportModal);
if (exportModal) exportModal.addEventListener("click", (e) => { if (e.target === exportModal) closeExportModal(); });

function downloadBlob(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replaceAll('"','""') + '"';
  return s;
}

function exportIssues(asCsv=false) {
  const data = getProjectIssues();
  const p = projects.find(p => p.id === activeProjectId);
  const baseName = (p?.name || "projekt").replace(/[^a-z0-9\- _]/gi, "_");

  if (!asCsv) {
    downloadBlob(`${baseName}_maengel.json`, "application/json", JSON.stringify(data, null, 2));
    return;
  }

  const cols = ["id","createdAt","status","elementId","elementLabel","elementType","loc","assignee","dueDate","note"];
  const rows = [cols.join(",")].concat(data.map(i => cols.map(c => csvEscape(i[c] || "")).join(",")));
  downloadBlob(`${baseName}_maengel.csv`, "text/csv", rows.join("\n"));
}

function exportTasks(asCsv=false) {
  const data = getProjectTasks();
  const p = projects.find(p => p.id === activeProjectId);
  const baseName = (p?.name || "projekt").replace(/[^a-z0-9\- _]/gi, "_");

  if (!asCsv) {
    downloadBlob(`${baseName}_aufgaben.json`, "application/json", JSON.stringify(data, null, 2));
    return;
  }

  const cols = ["id","createdAt","status","title","elementId","elementLabel","elementType","loc","assignee","dueDate","note"];
  const rows = [cols.join(",")].concat(data.map(t => cols.map(c => csvEscape(t[c] || "")).join(",")));
  downloadBlob(`${baseName}_aufgaben.csv`, "text/csv", rows.join("\n"));
}

if (exportIssuesJson) exportIssuesJson.addEventListener("click", () => exportIssues(false));
if (exportIssuesCsv)  exportIssuesCsv.addEventListener("click", () => exportIssues(true));
if (exportTasksJson)  exportTasksJson.addEventListener("click", () => exportTasks(false));
if (exportTasksCsv)   exportTasksCsv.addEventListener("click", () => exportTasks(true));



function openIssueModal({ mode, pickedObj=null, issue=null }) {
  if (!issueModal) return;

  issueDraft = {
    mode: mode || "new",
    pickedObj,
    issueId: issue ? issue.id : null,
    element: {
      id:   issue?.elementId   || pickedObj?.userData?.id    || "",
      label:issue?.elementLabel|| pickedObj?.userData?.label || "Bauteil",
      type: issue?.elementType || pickedObj?.userData?.type  || "",
      loc:  issue?.loc         || pickedObj?.userData?.loc   || ""
    },
    photo: {
      name: issue?.photoName || "",
      dataUrl: issue?.photoDataUrl || ""
    }
  };

  // Titel + Meta
  if (issueModalTitle) issueModalTitle.textContent = (issueDraft.mode === "edit") ? "Mangel bearbeiten" : "Mangel anlegen";
  if (issueElementLabel) issueElementLabel.textContent = issueDraft.element.label || "Bauteil";
  if (issueElementMeta) issueElementMeta.textContent = [
    issueDraft.element.type ? `Typ: ${issueDraft.element.type}` : "",
    issueDraft.element.id ? `ID: ${issueDraft.element.id}` : "",
    issueDraft.element.loc ? `Ort: ${issueDraft.element.loc}` : ""
  ].filter(Boolean).join(" · ") || "–";

  // Felder
  if (issueStatus) issueStatus.value = issue?.status || "Neu";
  if (issueDue) issueDue.value = issue?.dueDate || "";
  if (issueAssignee) issueAssignee.value = issue?.assignee || "";
  if (issueText) issueText.value = issue?.note || "";

  // Foto Placeholder
  if (issuePhotoName) issuePhotoName.textContent = issueDraft.photo.name ? issueDraft.photo.name : "kein Foto";
  if (issuePhotoPreview) {
    if (issueDraft.photo.dataUrl) {
      issuePhotoPreview.src = issueDraft.photo.dataUrl;
      issuePhotoPreview.style.display = "block";
    } else {
      issuePhotoPreview.src = "";
      issuePhotoPreview.style.display = "none";
    }
  }

  issueModal.classList.remove("hidden");
}

if (issueModalClose) issueModalClose.addEventListener("click", closeIssueModal);
if (issueModalCancel) issueModalCancel.addEventListener("click", closeIssueModal);
if (issueModal) {
  issueModal.addEventListener("click", (e) => { if (e.target === issueModal) closeIssueModal(); });
}

// Foto hinzufügen
if (issuePhotoBtn && issuePhotoInput) {
  issuePhotoBtn.addEventListener("click", () => issuePhotoInput.click());
}
if (issuePhotoInput) {
  issuePhotoInput.addEventListener("change", async () => {
    const f = issuePhotoInput.files && issuePhotoInput.files[0];
    if (!f) return;
    if (issuePhotoName) issuePhotoName.textContent = f.name;

    // Preview + optional speichern (kleine Demo)
    const dataUrl = await fileToDataUrl(f).catch(() => "");
    issueDraft.photo.name = f.name;

    // Datenlimit (localStorage) – wir speichern nur, wenn es nicht zu groß ist
    if (dataUrl && dataUrl.length <= 200000) { // ~200 KB
      issueDraft.photo.dataUrl = dataUrl;
    } else {
      issueDraft.photo.dataUrl = "";
    }

    if (issuePhotoPreview && dataUrl) {
      issuePhotoPreview.src = dataUrl;
      issuePhotoPreview.style.display = "block";
    }
  });
}

if (issueModalSave) {
  issueModalSave.addEventListener("click", () => {
    const status = (issueStatus?.value || "Neu").trim();
    const dueDate = (issueDue?.value || "").trim();
    const assignee = (issueAssignee?.value || "").trim();
    const note = (issueText?.value || "").trim();

    if (!note) {
      alert("Bitte einen Text für den Mangel eingeben.");
      return;
    }

    if (issueDraft.mode === "edit") {
      const idx = issues.findIndex(i => i.id === issueDraft.issueId);
      if (idx >= 0) {
        issues[idx] = {
          ...issues[idx],
          status,
          dueDate,
          assignee,
          note,
          photoName: issueDraft.photo.name || issues[idx].photoName || "",
          photoDataUrl: issueDraft.photo.dataUrl || issues[idx].photoDataUrl || ""
        };
      }
    } else {
      const issue = {
        id: "i_" + Date.now(),
        projectId: activeProjectId,
        createdAt: new Date().toISOString(),
        elementId: issueDraft.element.id,
        elementLabel: issueDraft.element.label,
        elementType: issueDraft.element.type,
        loc: issueDraft.element.loc,
        status,
        dueDate,
        assignee,
        note,
        photoName: issueDraft.photo.name || "",
        photoDataUrl: issueDraft.photo.dataUrl || ""
      };
      issues = [issue, ...issues];
    }

    saveIssues(issues);
    updateIssueBadge();
    renderIssuesList();

    // Visuelles Feedback am Mesh, falls vorhanden
    const obj = issueDraft.pickedObj;
    if (obj) {
      obj.userData = obj.userData || {};
      obj.userData.status = status === "Erledigt" ? "OK" : "Mangel";

      try {
        if (obj.material && obj.material.isMeshStandardMaterial) {
          obj.material = obj.material.clone();
          if (status === "Erledigt") {
            obj.material.emissive = new THREE.Color(0x003a00);
            obj.material.emissiveIntensity = 0.18;
          } else {
            obj.material.emissive = new THREE.Color(0x3a0000);
            obj.material.emissiveIntensity = 0.35;
          }
        }
      } catch (e) {}
    }

    closeIssueModal();
  });
}

// Utilities (klein + robust)
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Initial Badge
updateIssueBadge();
// ---------- PICKING (Tap/Klick auf Bauteile) ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let lastPicked = null;

const panel = document.getElementById("panel");
const pTitle = document.getElementById("pTitle");
const pBody  = document.getElementById("pBody");
document.getElementById("pClose").onclick = () => panel.style.display = "none";

document.getElementById("pIssue").onclick = () => {
  if (!lastPicked) return;
  // Öffnet das Mangel-Modal für das zuletzt angetippte Bauteil
  openIssueModal({ mode: "new", pickedObj: lastPicked });
};
document.getElementById("pOk").onclick = () => {
  if (!lastPicked) return;
  // Quick-Demo: Status am Bauteil auf OK setzen
  lastPicked.userData = lastPicked.userData || {};
  lastPicked.userData.status = "OK";
  try {
    if (lastPicked.material && lastPicked.material.isMeshStandardMaterial) {
      lastPicked.material = lastPicked.material.clone();
      lastPicked.material.emissive = new THREE.Color(0x003a00);
      lastPicked.material.emissiveIntensity = 0.10;
    }
  } catch (e) {}
  panel.style.display = "none";
};

function showPanelFor(obj) {
  lastPicked = obj;
  panel.style.display = "block";
  pTitle.textContent = obj.userData?.label || "Bauteil";
  const ud = obj.userData || {};
  pBody.innerHTML = `
    <div><b>Typ:</b> ${ud.type || "-"}</div>
    <div><b>ID:</b> ${ud.id || "-"}</div>
    <div><b>Ort:</b> ${ud.loc || "-"}</div>
    <div><b>Status:</b> ${(ud.status || "OK")}</div>
  `;
}

function pickAt(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(hallGroup.children, true);
  if (hits.length) {
    const hitObj = hits[0].object;

    // Tablet: Menü zu, sobald man in die Szene tippt
    try { hudMenu.classList.add("hidden"); } catch (e) {}

    if (HUD.mode === "issue") {
      // Im Modus „Mangel anlegen“: Modal öffnen (statt prompt)
      openIssueModal({ mode: "new", pickedObj: hitObj });
      return;
    }

    showPanelFor(hitObj);
  }
}

// Pointer Events (funktioniert Maus + Touch)
renderer.domElement.addEventListener("pointerdown", (e) => {
  // Wenn der Nutzer gerade schiebt/zoomt, trotzdem ok – wir nehmen pointerdown als “tap”
  pickAt(e.clientX, e.clientY);
});

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, M(3), 0);

// Licht (hell, “Büro/Daylight”)
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7680, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(M(80), M(60), M(40));
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

// Boden + Grid
const floorGeo = new THREE.PlaneGeometry(M(140), M(140));
const floorMat = new THREE.MeshStandardMaterial({ color: 0xd6dde6, roughness: 0.9, metalness: 0.0 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(M(140), 140, 0x9aa6b2, 0xc0c9d3);
grid.position.y = 0.01;
scene.add(grid);

// ============================================================
// MATERIALS
// ============================================================
const matSteel = new THREE.MeshStandardMaterial({ color: 0x6f7a86, metalness: 0.6, roughness: 0.35 });
const matPanel = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, metalness: 0.05, roughness: 0.85 });
const matRoof  = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.08, roughness: 0.9 });
const matDoor  = new THREE.MeshStandardMaterial({ color: 0xbac2cc, metalness: 0.12, roughness: 0.75 });

// ============================================================
// HALLEN-GEOMETRIE (parametrisch)
// Koordinaten: X = Breite, Z = Länge, Y = Höhe
// Zentrum in (0,0,0). Halle steht zentriert.
// ============================================================
const L = M(HALL.length);
const W = M(HALL.width);
const bay = M(HALL.bay);
const eaveH = M(HALL.eaveH);
const ridgeH = eaveH + M(HALL.ridgeAdd);

const halfL = L / 2;
const halfW = W / 2;

const hallGroup = new THREE.Group();
scene.add(hallGroup);

// Element-Registry (für Marker/Picking)
const elementById = new Map();
const issueMarkers = new THREE.Group();
scene.add(issueMarkers);

// --- 1) Stahlstützen auf Rasterpunkten (Perimeter + Innenrahmen an Rasterlinien) ---
const nx = Math.round(W / bay); // 30/15 = 2 Felder => 3 Rasterlinien (0..2)
const nz = Math.round(L / bay); // 60/15 = 4 Felder => 5 Rasterlinien (0..4)

function addBox(w, h, d, x, y, z, mat, cast=true, receive=false, meta=null) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;

  // Meta-Infos fürs Anklicken
  if (meta) mesh.userData = meta;

  // Registry: id -> mesh
  if (meta && meta.id) elementById.set(meta.id, mesh);

  hallGroup.add(mesh);
  return mesh;
}

// Spalten (an den “Rahmen” Linien in Z-Richtung, links & rechts)
for (let iz = 0; iz <= nz; iz++) {
  const z = -halfL + iz * bay;
  // linke und rechte Stütze
  addBox(M(HALL.steel.col), eaveH, M(HALL.steel.col), -halfW, eaveH/2, z, matSteel, true, false, {
    type: "Stütze",
    id: `COL-L-Z${iz}`,
    loc: `Raster Z${iz} links`,
    label: `Stütze links Z${iz}`,
    status: "OK"
  });
  addBox(M(HALL.steel.col), eaveH, M(HALL.steel.col),  halfW, eaveH/2, z, matSteel, true, false, {
    type: "Stütze",
    id: `COL-R-Z${iz}`,
    loc: `Raster Z${iz} rechts`,
    label: `Stütze rechts Z${iz}`,
    status: "OK"
  });
}

// --- 2) Querrahmen / Dachträger je Rasterfeld (Satteldach) ---
for (let iz = 0; iz <= nz; iz++) {
  const z = -halfL + iz * bay;

  // Querträger an Traufe (links->rechts) auf eaveH
  addBox(W + M(HALL.steel.col), M(HALL.steel.beam), M(HALL.steel.beam),
         0, eaveH, z, matSteel);

  // Dachschrägen (2 Sparren) als Boxen (optisch)
  // Länge der Schräge: hypotenuse(halfW, ridgeAdd)
  const rise = ridgeH - eaveH;
  const slopeLen = Math.sqrt(halfW*halfW + rise*rise);
  const slopeT = M(HALL.steel.beam);

  // linke Dachschräge
  const leftSlope = addBox(slopeLen, slopeT, slopeT, -halfW/2, eaveH + rise/2, z, matSteel);
  leftSlope.rotation.z = Math.atan2(rise, halfW); // anheben Richtung First

  // rechte Dachschräge
  const rightSlope = addBox(slopeLen, slopeT, slopeT, halfW/2, eaveH + rise/2, z, matSteel);
  rightSlope.rotation.z = -Math.atan2(rise, halfW);
}

// --- 3) Dachflächen (2 Platten) ---
{
  const rise = ridgeH - eaveH;
  const slopeLen = Math.sqrt(halfW*halfW + rise*rise);
  const roofT = M(0.12);

  // Dach links
  const roofL = addBox(slopeLen, roofT, L, -halfW/2, eaveH + rise/2, 0, matRoof, false, false);
  roofL.rotation.z = Math.atan2(rise, halfW);

  // Dach rechts
  const roofR = addBox(slopeLen, roofT, L, halfW/2, eaveH + rise/2, 0, matRoof, false, false);
  roofR.rotation.z = -Math.atan2(rise, halfW);
}

// --- 4) Außenwand-Panels (gedämmte Hülle), mit Rolltor-Öffnungen an Stirnseiten ---
const panelT = M(HALL.cladding.t);

function doorCutsForSide(side) {
  // side: "front" => z = -halfL, "back" => z = +halfL
  return HALL.doors.filter(d => d.side === side);
}

function addEndWallWithDoors(zPos, side) {
  // Wir bauen die Stirnwand als mehrere Paneel-Streifen links/rechts/oben um die Tore herum.
  const doors = doorCutsForSide(side);

  // Wenn keine Tore: eine durchgehende Wand
  if (!doors.length) {
    addBox(W, eaveH, panelT, 0, eaveH/2, zPos, matPanel, false, false);
    // Giebelteil (Dreieck optisch als Box-Stufe)
    addBox(W*0.70, (ridgeH - eaveH), panelT, 0, eaveH + (ridgeH-eaveH)/2, zPos, matPanel, false, false);
    return;
  }

  // Sortiere Tore nach X
  doors.sort((a,b) => a.xCenter - b.xCenter);

  // Basiswand bis Traufe: wir schneiden horizontal nur um Torbreiten (vereinfachte “Paneel-Segmente”)
  let xLeft = -halfW;
  for (const d of doors) {
    const halfDoorW = M(d.w)/2;
    const cutL = M(d.xCenter) - halfDoorW;
    const cutR = M(d.xCenter) + halfDoorW;

    // Segment links vom Tor
    const segW1 = cutL - xLeft;
    if (segW1 > 0.05) addBox(segW1, eaveH, panelT, xLeft + segW1/2, eaveH/2, zPos, matPanel, false, false);

    // Segment über dem Tor (bis Traufe)
    const overH = eaveH - M(d.h);
    if (overH > 0.05) {
      addBox(M(d.w), overH, panelT, M(d.xCenter), M(d.h) + overH/2, zPos, matPanel, false, false);
      // “Torblatt” als optisches Element
      addBox(M(d.w)*0.96, M(d.h)*0.96, panelT*0.8, M(d.xCenter), M(d.h)/2, zPos + (panelT*0.2)*(side==="front"?-1:1), matDoor, false, false);
    }

    xLeft = cutR;
  }

  // Segment rechts vom letzten Tor
  const segW2 = halfW - xLeft;
  if (segW2 > 0.05) addBox(segW2, eaveH, panelT, xLeft + segW2/2, eaveH/2, zPos, matPanel, false, false);

  // Giebelteil (vereinfacht als Box)
  addBox(W*0.70, (ridgeH - eaveH), panelT, 0, eaveH + (ridgeH-eaveH)/2, zPos, matPanel, false, false);
}

// Längswände (links/rechts) – durchgehend
addBox(panelT, eaveH, L, -halfW, eaveH/2, 0, matPanel, false, false);
addBox(panelT, eaveH, L,  halfW, eaveH/2, 0, matPanel, false, false);

// Stirnwände: front/back mit Toröffnungen
addEndWallWithDoors(-halfL, "front");
addEndWallWithDoors( halfL, "back");

// Kleine “Sockel”-Markierung (damit es nicht schwebt)
addBox(W+panelT*2, M(0.12), L+panelT*2, 0, M(0.06), 0,
       new THREE.MeshStandardMaterial({ color: 0xc7cfd9, roughness: 0.95, metalness: 0.0 }),
       false, true);

// ============================================================
// Render loop + resize
// ============================================================
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ============================================================
// test block
// ============================================================
//
