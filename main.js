/* ============================================================
   Baustellenplaner – Stahlträgerhalle Demo
   main.js v3.7  (OrbitControls-frei, damit iOS/CDN stabil läuft)

   ✅ WICHTIG:
   - THREE wird in index.html als globales Script geladen (three.min.js).
   - OrbitControls wird NICHT mehr extern geladen.
   - Wir verwenden eine kleine interne Steuerung (MiniOrbitControls).
   - Menü/Projekte/Mängel/Aufgaben funktionieren unabhängig davon, ob Controls da sind.
   ============================================================ */

console.log("[v3.7] main.js geladen");

// ------------------------------
// Debug UI Helpers
// ------------------------------
const $ = (id) => document.getElementById(id);

const ui = {
  errToast: $("errToast"),
  jsOk: $("jsOk"),

  hudModeText: $("hudModeText"),
  hudMenuBtn: $("hudMenuBtn"),
  hudMenu: $("hudMenu"),

  issueBadge: $("issueBadge"),
  taskBadge: $("taskBadge"),

  projectSelect: $("projectSelect"),
  projectAddBtn: $("projectAddBtn"),

  // Overlays
  issuesOverlay: $("issuesOverlay"),
  issuesClose: $("issuesClose"),
  issuesFilters: $("issuesFilters"),
  issuesList: $("issuesList"),

  tasksOverlay: $("tasksOverlay"),
  tasksClose: $("tasksClose"),
  tasksFilters: $("tasksFilters"),
  tasksList: $("tasksList"),

  // Project Modal
  projectModal: $("projectModal"),
  projectModalClose: $("projectModalClose"),
  projectModalCancel: $("projectModalCancel"),
  projectModalCreate: $("projectModalCreate"),
  projectName: $("projectName"),
  projectLocation: $("projectLocation"),

  // Issue Modal
  issueModal: $("issueModal"),
  issueModalTitle: $("issueModalTitle"),
  issueModalClose: $("issueModalClose"),
  issueCancel: $("issueCancel"),
  issueSave: $("issueSave"),
  issueDelete: $("issueDelete"),
  issueStatus: $("issueStatus"),
  issueDue: $("issueDue"),
  issueText: $("issueText"),
  issueAssignee: $("issueAssignee"),
  issuePhoto: $("issuePhoto"),
  issuePhotoPreview: $("issuePhotoPreview"),
  issuePhotoClear: $("issuePhotoClear"),
  issueElementInfo: $("issueElementInfo"),

  // Task Modal
  taskModal: $("taskModal"),
  taskModalTitle: $("taskModalTitle"),
  taskModalClose: $("taskModalClose"),
  taskCancel: $("taskCancel"),
  taskSave: $("taskSave"),
  taskDelete: $("taskDelete"),
  taskStatus: $("taskStatus"),
  taskDue: $("taskDue"),
  taskText: $("taskText"),
  taskAssignee: $("taskAssignee"),
  taskElementInfo: $("taskElementInfo"),
};

function showOkBadge() {
  if (!ui.jsOk) return;
  ui.jsOk.style.display = "block";
  setTimeout(() => (ui.jsOk.style.display = "none"), 1800);
}

function showError(msg) {
  console.error(msg);
  if (!ui.errToast) {
    alert(String(msg));
    return;
  }
  ui.errToast.textContent = String(msg);
  ui.errToast.style.display = "block";
  // Auto-hide nach ein paar Sekunden, damit nichts blockiert
  setTimeout(() => {
    if (ui.errToast) ui.errToast.style.display = "none";
  }, 6000);
}

// ============================================================
// STORAGE (lokal im Browser, Demo-Stand)
// ============================================================
const LS_KEY = "bp_demo_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("State load failed", e);
    return null;
  }
}

function saveState(s) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch (e) {
    console.warn("State save failed", e);
  }
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ------------------------------------------------------------
// Demo-Initial-State (mindestens 1 Projekt, sonst ist Select leer)
// ------------------------------------------------------------
const DEFAULT_STATE = {
  activeProjectId: null,
  projects: [
    {
      id: "p_demo",
      name: "Stahlträgerhalle Demo",
      location: "",
      createdAt: Date.now(),
      issues: [],
      tasks: [],
      // Bauteile (minimaler Start – später bauen wir das als echte Bauteil-Liste aus)
      elements: [
        { id: "e_frame_1", name: "Rahmen Achse 1", type: "frame" },
        { id: "e_frame_2", name: "Rahmen Achse 2", type: "frame" },
        { id: "e_gate_1", name: "Rolltor links", type: "gate" },
        { id: "e_gate_2", name: "Rolltor rechts", type: "gate" },
        { id: "e_roof", name: "Dach", type: "roof" },
        { id: "e_wall", name: "Wandpaneele", type: "wall" },
      ],
    },
  ],
};

// ============================================================
// UI State / Mode
// ============================================================
const Mode = {
  NAV: "navigate",
  ISSUE: "issue",
  TASK: "task",
};

let mode = Mode.NAV;

// Dieses "selectedElement" wird beim Tap auf ein 3D-Teil gesetzt.
// In v3.7 ist das noch "Demo-Pick" (wir picken per Raycast später richtig).
let selectedElementId = "e_frame_1";

// ============================================================
// Helpers: Project access
// ============================================================
let state = loadState();
if (!state || !state.projects || !state.projects.length) {
  state = structuredClone ? structuredClone(DEFAULT_STATE) : JSON.parse(JSON.stringify(DEFAULT_STATE));
}
if (!state.activeProjectId) state.activeProjectId = state.projects[0].id;
saveState(state);

function getProjectById(pid) {
  return state.projects.find((p) => p.id === pid) || null;
}
function getActiveProject() {
  return getProjectById(state.activeProjectId);
}

// ============================================================
// RENDER: Project select + Badges
// ============================================================
function refreshProjectSelect() {
  const sel = ui.projectSelect;
  if (!sel) return;

  // Clear
  sel.innerHTML = "";
  for (const p of state.projects) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
  sel.value = state.activeProjectId || (state.projects[0] && state.projects[0].id) || "";
}

function refreshBadges() {
  const p = getActiveProject();
  if (!p) return;
  const openIssues = p.issues.length;
  const openTasks = p.tasks.length;

  if (ui.issueBadge) ui.issueBadge.textContent = String(openIssues);
  if (ui.taskBadge) ui.taskBadge.textContent = String(openTasks);
}

function setMode(nextMode) {
  mode = nextMode;
  if (ui.hudModeText) {
    ui.hudModeText.textContent =
      "Modus: " + (mode === Mode.NAV ? "Navigieren" : mode === Mode.ISSUE ? "Mangel anlegen" : "Aufgabe anlegen");
  }
  // mark active in menu
  if (ui.hudMenu) {
    for (const btn of ui.hudMenu.querySelectorAll(".hudItem[data-mode]")) {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
    }
  }
}

// ============================================================
// LIST OVERLAYS (Mängel/Aufgaben)
// ============================================================
function makeFilterChips(container, activeKey, setKeyCb) {
  container.innerHTML = "";

  const keys = ["Alle", "Neu", "In Arbeit", "Erledigt"];
  for (const k of keys) {
    const b = document.createElement("button");
    b.className = "chip" + (k === activeKey ? " active" : "");
    b.textContent = k;
    b.addEventListener("click", () => setKeyCb(k));
    container.appendChild(b);
  }
}

function renderIssuesList(filterKey = "Alle") {
  const p = getActiveProject();
  if (!p) return;

  const list = ui.issuesList;
  if (!list) return;
  list.innerHTML = "";

  let arr = p.issues.slice();
  if (filterKey !== "Alle") arr = arr.filter((x) => x.status === filterKey);

  if (!arr.length) {
    const empty = document.createElement("div");
    empty.style.opacity = "0.7";
    empty.style.padding = "8px";
    empty.textContent = "Keine Einträge.";
    list.appendChild(empty);
    return;
  }

  for (const it of arr) {
    const row = document.createElement("div");
    row.className = "rowItem";

    const left = document.createElement("div");
    left.className = "left";
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = it.text || "(ohne Text)";
    const s = document.createElement("div");
    s.className = "s";
    const el = p.elements.find((e) => e.id === it.elementId);
    s.textContent = `${it.status} • Bauteil: ${el ? el.name : "-"} • fällig: ${it.due || "-"}`;
    left.appendChild(t);
    left.appendChild(s);

    const right = document.createElement("div");
    right.className = "right";
    const edit = document.createElement("button");
    edit.className = "miniBtn";
    edit.textContent = "Bearbeiten";
    edit.addEventListener("click", () => openIssueModal(it.id));
    right.appendChild(edit);

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  }
}

function renderTasksList(filterKey = "Alle") {
  const p = getActiveProject();
  if (!p) return;

  const list = ui.tasksList;
  if (!list) return;
  list.innerHTML = "";

  let arr = p.tasks.slice();
  if (filterKey !== "Alle") arr = arr.filter((x) => x.status === filterKey);

  if (!arr.length) {
    const empty = document.createElement("div");
    empty.style.opacity = "0.7";
    empty.style.padding = "8px";
    empty.textContent = "Keine Einträge.";
    list.appendChild(empty);
    return;
  }

  for (const it of arr) {
    const row = document.createElement("div");
    row.className = "rowItem";

    const left = document.createElement("div");
    left.className = "left";
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = it.text || "(ohne Text)";
    const s = document.createElement("div");
    s.className = "s";
    const el = p.elements.find((e) => e.id === it.elementId);
    s.textContent = `${it.status} • Bauteil: ${el ? el.name : "-"} • fällig: ${it.due || "-"}`;
    left.appendChild(t);
    left.appendChild(s);

    const right = document.createElement("div");
    right.className = "right";
    const edit = document.createElement("button");
    edit.className = "miniBtn";
    edit.textContent = "Bearbeiten";
    edit.addEventListener("click", () => openTaskModal(it.id));
    right.appendChild(edit);

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  }
}

// ============================================================
// MODALS
// ============================================================
function openProjectModal() {
  ui.projectModal?.classList.remove("hidden");
  ui.projectName.value = "";
  ui.projectLocation.value = "";
  setTimeout(() => ui.projectName?.focus(), 30);
}

function closeProjectModal() {
  ui.projectModal?.classList.add("hidden");
}

function createProject() {
  const name = (ui.projectName.value || "").trim();
  const loc = (ui.projectLocation.value || "").trim();
  if (!name) {
    showError("Bitte einen Projektnamen eingeben.");
    return;
  }
  const p = {
    id: uid("p"),
    name,
    location: loc,
    createdAt: Date.now(),
    issues: [],
    tasks: [],
    elements: JSON.parse(JSON.stringify(DEFAULT_STATE.projects[0].elements)),
  };
  state.projects.push(p);
  state.activeProjectId = p.id;
  saveState(state);
  refreshProjectSelect();
  refreshBadges();
  closeProjectModal();
  showOkBadge();
}

function openIssueModal(issueId = null, elementId = null) {
  const p = getActiveProject();
  if (!p) return;

  ui.issueModal?.classList.remove("hidden");

  const isEdit = Boolean(issueId);
  ui.issueModalTitle.textContent = isEdit ? "Mangel bearbeiten" : "Mangel anlegen";

  // Default element: wenn über Tap -> elementId, sonst selectedElementId
  const eid = elementId || selectedElementId || (p.elements[0] && p.elements[0].id);
  const el = p.elements.find((e) => e.id === eid);

  ui.issueElementInfo.textContent = el ? el.name : "-";

  // Reset photo preview
  ui.issuePhoto.value = "";
  ui.issuePhotoPreview.style.display = "none";
  ui.issuePhotoPreview.src = "";

  if (!isEdit) {
    ui.issueDelete.style.display = "none";
    ui.issueStatus.value = "Neu";
    ui.issueDue.value = "";
    ui.issueText.value = "";
    ui.issueAssignee.value = "";
    ui.issueModal.dataset.editId = "";
    ui.issueModal.dataset.elementId = eid;
    return;
  }

  const it = p.issues.find((x) => x.id === issueId);
  if (!it) {
    showError("Mangel nicht gefunden.");
    closeIssueModal();
    return;
  }

  ui.issueDelete.style.display = "inline-block";
  ui.issueStatus.value = it.status || "Neu";
  ui.issueDue.value = it.due || "";
  ui.issueText.value = it.text || "";
  ui.issueAssignee.value = it.assignee || "";
  ui.issueModal.dataset.editId = it.id;
  ui.issueModal.dataset.elementId = it.elementId || eid;

  if (it.photoDataUrl) {
    ui.issuePhotoPreview.src = it.photoDataUrl;
    ui.issuePhotoPreview.style.display = "block";
  }
}

function closeIssueModal() {
  ui.issueModal?.classList.add("hidden");
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Foto konnte nicht gelesen werden."));
    r.readAsDataURL(file);
  });
}

async function saveIssueFromModal() {
  const p = getActiveProject();
  if (!p) return;

  const editId = ui.issueModal.dataset.editId || "";
  const elementId = ui.issueModal.dataset.elementId || selectedElementId || "";
  const status = ui.issueStatus.value;
  const due = ui.issueDue.value;
  const text = (ui.issueText.value || "").trim();
  const assignee = (ui.issueAssignee.value || "").trim();

  // Foto (optional)
  let photoDataUrl = null;
  if (ui.issuePhoto.files && ui.issuePhoto.files[0]) {
    // ⚠️ Demo: wir speichern DataURL in localStorage -> nur kleine Bilder!
    photoDataUrl = await readFileAsDataUrl(ui.issuePhoto.files[0]);
  } else if (editId) {
    // bei Edit: vorhandenes behalten
    const itOld = p.issues.find((x) => x.id === editId);
    photoDataUrl = itOld?.photoDataUrl || null;
  }

  if (!text) {
    showError("Bitte einen Text zum Mangel eingeben.");
    return;
  }

  if (!editId) {
    p.issues.unshift({
      id: uid("i"),
      status,
      due,
      text,
      assignee,
      elementId,
      photoDataUrl,
      createdAt: Date.now(),
    });
  } else {
    const it = p.issues.find((x) => x.id === editId);
    if (!it) return;
    it.status = status;
    it.due = due;
    it.text = text;
    it.assignee = assignee;
    it.elementId = elementId;
    it.photoDataUrl = photoDataUrl;
  }

  saveState(state);
  refreshBadges();
  closeIssueModal();
  showOkBadge();
}

function deleteIssueFromModal() {
  const p = getActiveProject();
  if (!p) return;
  const editId = ui.issueModal.dataset.editId || "";
  if (!editId) return;
  p.issues = p.issues.filter((x) => x.id !== editId);
  saveState(state);
  refreshBadges();
  closeIssueModal();
  showOkBadge();
}

// Task modal
function openTaskModal(taskId = null, elementId = null) {
  const p = getActiveProject();
  if (!p) return;

  ui.taskModal?.classList.remove("hidden");

  const isEdit = Boolean(taskId);
  ui.taskModalTitle.textContent = isEdit ? "Aufgabe bearbeiten" : "Aufgabe anlegen";

  const eid = elementId || selectedElementId || (p.elements[0] && p.elements[0].id);
  const el = p.elements.find((e) => e.id === eid);
  ui.taskElementInfo.textContent = el ? el.name : "-";

  if (!isEdit) {
    ui.taskDelete.style.display = "none";
    ui.taskStatus.value = "Offen";
    ui.taskDue.value = "";
    ui.taskText.value = "";
    ui.taskAssignee.value = "";
    ui.taskModal.dataset.editId = "";
    ui.taskModal.dataset.elementId = eid;
    return;
  }

  const it = p.tasks.find((x) => x.id === taskId);
  if (!it) {
    showError("Aufgabe nicht gefunden.");
    closeTaskModal();
    return;
  }

  ui.taskDelete.style.display = "inline-block";
  ui.taskStatus.value = it.status || "Offen";
  ui.taskDue.value = it.due || "";
  ui.taskText.value = it.text || "";
  ui.taskAssignee.value = it.assignee || "";
  ui.taskModal.dataset.editId = it.id;
  ui.taskModal.dataset.elementId = it.elementId || eid;
}

function closeTaskModal() {
  ui.taskModal?.classList.add("hidden");
}

function saveTaskFromModal() {
  const p = getActiveProject();
  if (!p) return;

  const editId = ui.taskModal.dataset.editId || "";
  const elementId = ui.taskModal.dataset.elementId || selectedElementId || "";
  const status = ui.taskStatus.value;
  const due = ui.taskDue.value;
  const text = (ui.taskText.value || "").trim();
  const assignee = (ui.taskAssignee.value || "").trim();

  if (!text) {
    showError("Bitte einen Text zur Aufgabe eingeben.");
    return;
  }

  if (!editId) {
    p.tasks.unshift({
      id: uid("t"),
      status,
      due,
      text,
      assignee,
      elementId,
      createdAt: Date.now(),
    });
  } else {
    const it = p.tasks.find((x) => x.id === editId);
    if (!it) return;
    it.status = status;
    it.due = due;
    it.text = text;
    it.assignee = assignee;
    it.elementId = elementId;
  }

  saveState(state);
  refreshBadges();
  closeTaskModal();
  showOkBadge();
}

function deleteTaskFromModal() {
  const p = getActiveProject();
  if (!p) return;
  const editId = ui.taskModal.dataset.editId || "";
  if (!editId) return;
  p.tasks = p.tasks.filter((x) => x.id !== editId);
  saveState(state);
  refreshBadges();
  closeTaskModal();
  showOkBadge();
}

// ============================================================
// EXPORT (JSON + CSV) – pro Projekt
// ============================================================
function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 150);
}

function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function exportProject(p) {
  // JSON
  downloadText(`${p.name.replaceAll(" ", "_")}_export.json`, JSON.stringify(p, null, 2), "application/json");

  // CSV: Issues
  const issueRows = [
    ["id", "status", "due", "text", "assignee", "elementId", "elementName", "createdAt"],
    ...p.issues.map((it) => {
      const el = p.elements.find((e) => e.id === it.elementId);
      return [it.id, it.status, it.due, it.text, it.assignee, it.elementId, el ? el.name : "", new Date(it.createdAt).toISOString()];
    }),
  ];
  downloadText(`${p.name.replaceAll(" ", "_")}_maengel.csv`, toCSV(issueRows), "text/csv");

  // CSV: Tasks
  const taskRows = [
    ["id", "status", "due", "text", "assignee", "elementId", "elementName", "createdAt"],
    ...p.tasks.map((it) => {
      const el = p.elements.find((e) => e.id === it.elementId);
      return [it.id, it.status, it.due, it.text, it.assignee, it.elementId, el ? el.name : "", new Date(it.createdAt).toISOString()];
    }),
  ];
  downloadText(`${p.name.replaceAll(" ", "_")}_aufgaben.csv`, toCSV(taskRows), "text/csv");
}

// ============================================================
// UI Events (Menü / Buttons / Select)
// ============================================================
function toggleHudMenu(force = null) {
  const m = ui.hudMenu;
  if (!m) return;
  const wantOpen = force === null ? m.classList.contains("hidden") : Boolean(force);
  m.classList.toggle("hidden", !wantOpen);
}

function wireUI() {
  // Menü-Button
  ui.hudMenuBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleHudMenu();
  });

  // Klick außerhalb Menü -> schließen (auf Touch wichtig)
  document.addEventListener("pointerdown", (e) => {
    const menu = ui.hudMenu;
    if (!menu || menu.classList.contains("hidden")) return;
    const isInside = menu.contains(e.target) || ui.hudMenuBtn.contains(e.target);
    if (!isInside) toggleHudMenu(false);
  });

  // Menü Items
  ui.hudMenu?.addEventListener("click", (e) => {
    const btn = e.target.closest(".hudItem");
    if (!btn) return;

    const m = btn.getAttribute("data-mode");
    const a = btn.getAttribute("data-action");

    if (m) {
      setMode(m);
      toggleHudMenu(false);
      return;
    }

    if (a === "showIssues") {
      openIssuesOverlay();
      toggleHudMenu(false);
      return;
    }
    if (a === "showTasks") {
      openTasksOverlay();
      toggleHudMenu(false);
      return;
    }
    if (a === "exportMenu") {
      const p = getActiveProject();
      if (!p) return;
      exportProject(p);
      toggleHudMenu(false);
      return;
    }
  });

  // Project select
  ui.projectSelect?.addEventListener("change", () => {
    state.activeProjectId = ui.projectSelect.value;
    saveState(state);
    refreshBadges();
  });

  // Project add
  ui.projectAddBtn?.addEventListener("click", () => openProjectModal());

  // Project modal buttons
  ui.projectModalClose?.addEventListener("click", closeProjectModal);
  ui.projectModalCancel?.addEventListener("click", closeProjectModal);
  ui.projectModalCreate?.addEventListener("click", createProject);

  // Issues overlay
  ui.issuesClose?.addEventListener("click", () => ui.issuesOverlay.classList.add("hidden"));
  ui.tasksClose?.addEventListener("click", () => ui.tasksOverlay.classList.add("hidden"));

  // Issue modal
  ui.issueModalClose?.addEventListener("click", closeIssueModal);
  ui.issueCancel?.addEventListener("click", closeIssueModal);
  ui.issueSave?.addEventListener("click", () => saveIssueFromModal().catch(showError));
  ui.issueDelete?.addEventListener("click", deleteIssueFromModal);

  ui.issuePhotoClear?.addEventListener("click", () => {
    ui.issuePhoto.value = "";
    ui.issuePhotoPreview.style.display = "none";
    ui.issuePhotoPreview.src = "";
  });
  ui.issuePhoto?.addEventListener("change", async () => {
    try {
      if (ui.issuePhoto.files && ui.issuePhoto.files[0]) {
        const dataUrl = await readFileAsDataUrl(ui.issuePhoto.files[0]);
        ui.issuePhotoPreview.src = dataUrl;
        ui.issuePhotoPreview.style.display = "block";
      }
    } catch (e) {
      showError(e.message || e);
    }
  });

  // Task modal
  ui.taskModalClose?.addEventListener("click", closeTaskModal);
  ui.taskCancel?.addEventListener("click", closeTaskModal);
  ui.taskSave?.addEventListener("click", saveTaskFromModal);
  ui.taskDelete?.addEventListener("click", deleteTaskFromModal);

  // Overlays click outside card -> close
  ui.issuesOverlay?.addEventListener("click", (e) => {
    if (e.target === ui.issuesOverlay) ui.issuesOverlay.classList.add("hidden");
  });
  ui.tasksOverlay?.addEventListener("click", (e) => {
    if (e.target === ui.tasksOverlay) ui.tasksOverlay.classList.add("hidden");
  });
}

let issuesFilter = "Alle";
let tasksFilter = "Alle";

function openIssuesOverlay() {
  ui.issuesOverlay.classList.remove("hidden");
  makeFilterChips(ui.issuesFilters, issuesFilter, (k) => {
    issuesFilter = k;
    makeFilterChips(ui.issuesFilters, issuesFilter, arguments.callee); // (wird nicht ausgeführt – Safari strenger)
  });
  // Safari: kein arguments.callee -> deshalb nochmal sauber:
  makeFilterChips(ui.issuesFilters, issuesFilter, (k) => {
    issuesFilter = k;
    openIssuesOverlay(); // rebuild
  });
  renderIssuesList(issuesFilter);
}

function openTasksOverlay() {
  ui.tasksOverlay.classList.remove("hidden");
  makeFilterChips(ui.tasksFilters, tasksFilter, (k) => {
    tasksFilter = k;
    openTasksOverlay();
  });
  renderTasksList(tasksFilter);
}

// ============================================================
// 3D: Setup (THREE global) + MiniOrbitControls
// ============================================================
function ensureTHREE() {
  if (!window.THREE) {
    throw new Error("THREE ist nicht geladen (three.min.js).");
  }
  return window.THREE;
}

/* ------------------------------------------------------------
   MiniOrbitControls (sehr klein, aber brauchbar für Demo)
   - 1 Finger / linke Maus: Orbit (drehen)
   - Wheel / Pinch: Zoom
   - 2 Finger / rechte Maus: Pan (schieben)
   ------------------------------------------------------------ */
class MiniOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.enabled = true;
    this.target = new THREE.Vector3(0, 3, 0);

    // Spherical coords
    this.radius = 90;
    this.theta = Math.PI * 0.75; // around Y
    this.phi = Math.PI * 0.32;   // up/down

    this.rotateSpeed = 0.006;
    this.zoomSpeed = 0.0016;
    this.panSpeed = 0.0025;

    // pointers
    this.ptr = new Map();
    this.mode = "none"; // "rotate" or "pan"
    this.last = { x: 0, y: 0 };
    this.lastDist = 0;
    this.lastMid = { x: 0, y: 0 };

    // Prevent page scroll
    this.domElement.style.touchAction = "none";

    this._bind();
    this.update(true);
  }

  _bind() {
    this.domElement.addEventListener("pointerdown", (e) => this._onDown(e));
    this.domElement.addEventListener("pointermove", (e) => this._onMove(e));
    this.domElement.addEventListener("pointerup", (e) => this._onUp(e));
    this.domElement.addEventListener("pointercancel", (e) => this._onUp(e));
    this.domElement.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });

    // context menu off (long press / right click)
    this.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _onDown(e) {
    if (!this.enabled) return;
    this.domElement.setPointerCapture?.(e.pointerId);
    this.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType, button: e.button });

    const n = this.ptr.size;

    // Desktop: right click -> pan
    if (e.pointerType === "mouse" && e.button === 2) {
      this.mode = "pan";
      this.last.x = e.clientX; this.last.y = e.clientY;
      return;
    }

    // Touch: 1 finger rotate, 2 fingers pan+pinch
    if (n === 1) {
      this.mode = "rotate";
      this.last.x = e.clientX; this.last.y = e.clientY;
    } else if (n === 2) {
      this.mode = "pinchpan";
      const pts = Array.from(this.ptr.values());
      this.lastDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.lastMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }
  }

  _onMove(e) {
    if (!this.enabled) return;
    if (!this.ptr.has(e.pointerId)) return;

    // Update pointer
    this.ptr.set(e.pointerId, { ...this.ptr.get(e.pointerId), x: e.clientX, y: e.clientY });

    const n = this.ptr.size;

    if (this.mode === "rotate" && n === 1) {
      const dx = e.clientX - this.last.x;
      const dy = e.clientY - this.last.y;
      this.last.x = e.clientX; this.last.y = e.clientY;

      this.theta -= dx * this.rotateSpeed;
      this.phi -= dy * this.rotateSpeed;
      this.phi = Math.max(0.08, Math.min(Math.PI - 0.08, this.phi));
    }

    if (this.mode === "pan" && n === 1) {
      const dx = e.clientX - this.last.x;
      const dy = e.clientY - this.last.y;
      this.last.x = e.clientX; this.last.y = e.clientY;
      this._pan(dx, dy);
    }

    if (this.mode === "pinchpan" && n === 2) {
      const pts = Array.from(this.ptr.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

      // pinch zoom
      const dd = dist - this.lastDist;
      this.lastDist = dist;
      this.radius *= (1 - dd * this.zoomSpeed);
      this.radius = Math.max(10, Math.min(220, this.radius));

      // pan by mid movement
      const dx = mid.x - this.lastMid.x;
      const dy = mid.y - this.lastMid.y;
      this.lastMid = mid;
      this._pan(dx, dy);
    }
  }

  _onUp(e) {
    if (this.ptr.has(e.pointerId)) this.ptr.delete(e.pointerId);
    if (this.ptr.size === 0) this.mode = "none";
    if (this.ptr.size === 1) {
      const pts = Array.from(this.ptr.values());
      this.mode = "rotate";
      this.last.x = pts[0].x; this.last.y = pts[0].y;
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY;
    this.radius *= (1 + delta * this.zoomSpeed);
    this.radius = Math.max(10, Math.min(220, this.radius));
  }

  _pan(dx, dy) {
    // Pan in camera plane: approximate by using camera's right and up vectors
    const cam = this.camera;
    cam.updateMatrixWorld();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);

    const scale = this.radius * this.panSpeed;
    this.target.addScaledVector(right, -dx * scale);
    this.target.addScaledVector(up, dy * scale);

    // keep target above ground
    this.target.y = Math.max(0.1, this.target.y);
  }

  update(force = false) {
    // Convert spherical -> cartesian
    const r = this.radius;
    const sinPhi = Math.sin(this.phi);
    const x = r * sinPhi * Math.sin(this.theta);
    const y = r * Math.cos(this.phi);
    const z = r * sinPhi * Math.cos(this.theta);

    this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
    this.camera.lookAt(this.target);
  }
}

// ============================================================
// 3D: Hallenmodell (dein param. Modell – aus deiner Version)
// ============================================================
function buildHall(scene) {
  // Parameter (wie bei dir)
  const HALL = {
    length: 60,
    width: 30,
    bay: 15,
    eaveH: 6.0,
    ridgeAdd: 1.5,
    steel: { col: 0.25, beam: 0.18 },
    cladding: { t: 0.08 },
    doors: [
      { side: "front", xCenter: -6, w: 6, h: 5 },
      { side: "front", xCenter: 6, w: 6, h: 5 },
    ],
  };

  const M = (v) => v;

  const matSteel = new THREE.MeshStandardMaterial({ color: 0x6f7a86, metalness: 0.6, roughness: 0.35 });
  const matPanel = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, metalness: 0.05, roughness: 0.85 });
  const matRoof = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.08, roughness: 0.9 });
  const matDoor = new THREE.MeshStandardMaterial({ color: 0xbac2cc, metalness: 0.12, roughness: 0.75 });

  const L = M(HALL.length);
  const W = M(HALL.width);
  const bay = M(HALL.bay);
  const eaveH = M(HALL.eaveH);
  const ridgeH = eaveH + M(HALL.ridgeAdd);

  const halfL = L / 2;
  const halfW = W / 2;

  const hallGroup = new THREE.Group();
  scene.add(hallGroup);

  // Helper
  function addBox(w, h, d, x, y, z, mat, cast = true, receive = false, meta = null) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    if (meta) {
      mesh.userData = { ...(mesh.userData || {}), ...meta };
    }
    hallGroup.add(mesh);
    return mesh;
  }

  const nx = Math.round(W / bay);
  const nz = Math.round(L / bay);

  // Stützen links/rechts
  for (let iz = 0; iz <= nz; iz++) {
    const z = -halfL + iz * bay;
    addBox(M(HALL.steel.col), eaveH, M(HALL.steel.col), -halfW, eaveH / 2, z, matSteel, true, false, { elementId: "e_wall" });
    addBox(M(HALL.steel.col), eaveH, M(HALL.steel.col), halfW, eaveH / 2, z, matSteel, true, false, { elementId: "e_wall" });
  }

  // Querrahmen / Sparren
  for (let iz = 0; iz <= nz; iz++) {
    const z = -halfL + iz * bay;

    addBox(W + M(HALL.steel.col), M(HALL.steel.beam), M(HALL.steel.beam), 0, eaveH, z, matSteel, true, false, { elementId: "e_frame_1" });

    const rise = ridgeH - eaveH;
    const slopeLen = Math.sqrt(halfW * halfW + rise * rise);
    const slopeT = M(HALL.steel.beam);

    const leftSlope = addBox(slopeLen, slopeT, slopeT, -halfW / 2, eaveH + rise / 2, z, matSteel, true, false, { elementId: "e_roof" });
    leftSlope.rotation.z = Math.atan2(rise, halfW);

    const rightSlope = addBox(slopeLen, slopeT, slopeT, halfW / 2, eaveH + rise / 2, z, matSteel, true, false, { elementId: "e_roof" });
    rightSlope.rotation.z = -Math.atan2(rise, halfW);
  }

  // Dachplatten
  {
    const rise = ridgeH - eaveH;
    const slopeLen = Math.sqrt(halfW * halfW + rise * rise);
    const roofT = M(0.12);

    const roofL = addBox(slopeLen, roofT, L, -halfW / 2, eaveH + rise / 2, 0, matRoof, false, false, { elementId: "e_roof" });
    roofL.rotation.z = Math.atan2(rise, halfW);

    const roofR = addBox(slopeLen, roofT, L, halfW / 2, eaveH + rise / 2, 0, matRoof, false, false, { elementId: "e_roof" });
    roofR.rotation.z = -Math.atan2(rise, halfW);
  }

  // Wände + Tore
  const panelT = M(HALL.cladding.t);

  function doorCutsForSide(side) {
    return HALL.doors.filter((d) => d.side === side);
  }

  function addEndWallWithDoors(zPos, side) {
    const doors = doorCutsForSide(side);
    if (!doors.length) {
      addBox(W, eaveH, panelT, 0, eaveH / 2, zPos, matPanel, false, false, { elementId: "e_wall" });
      addBox(W * 0.7, ridgeH - eaveH, panelT, 0, eaveH + (ridgeH - eaveH) / 2, zPos, matPanel, false, false, { elementId: "e_wall" });
      return;
    }

    doors.sort((a, b) => a.xCenter - b.xCenter);

    let xLeft = -halfW;
    for (const d of doors) {
      const halfDoorW = M(d.w) / 2;
      const cutL = M(d.xCenter) - halfDoorW;
      const cutR = M(d.xCenter) + halfDoorW;

      const segW1 = cutL - xLeft;
      if (segW1 > 0.05) addBox(segW1, eaveH, panelT, xLeft + segW1 / 2, eaveH / 2, zPos, matPanel, false, false, { elementId: "e_wall" });

      const overH = eaveH - M(d.h);
      if (overH > 0.05) {
        addBox(M(d.w), overH, panelT, M(d.xCenter), M(d.h) + overH / 2, zPos, matPanel, false, false, { elementId: "e_wall" });

        // Torblatt als eigenes Bauteil
        addBox(
          M(d.w) * 0.96,
          M(d.h) * 0.96,
          panelT * 0.8,
          M(d.xCenter),
          M(d.h) / 2,
          zPos + (panelT * 0.2) * (side === "front" ? -1 : 1),
          matDoor,
          false,
          false,
          { elementId: d.xCenter < 0 ? "e_gate_1" : "e_gate_2" }
        );
      }
      xLeft = cutR;
    }

    const segW2 = halfW - xLeft;
    if (segW2 > 0.05) addBox(segW2, eaveH, panelT, xLeft + segW2 / 2, eaveH / 2, zPos, matPanel, false, false, { elementId: "e_wall" });

    addBox(W * 0.7, ridgeH - eaveH, panelT, 0, eaveH + (ridgeH - eaveH) / 2, zPos, matPanel, false, false, { elementId: "e_wall" });
  }

  // Längswände
  addBox(panelT, eaveH, L, -halfW, eaveH / 2, 0, matPanel, false, false, { elementId: "e_wall" });
  addBox(panelT, eaveH, L, halfW, eaveH / 2, 0, matPanel, false, false, { elementId: "e_wall" });

  addEndWallWithDoors(-halfL, "front");
  addEndWallWithDoors(halfL, "back");

  // Sockel
  addBox(
    W + panelT * 2,
    M(0.12),
    L + panelT * 2,
    0,
    M(0.06),
    0,
    new THREE.MeshStandardMaterial({ color: 0xc7cfd9, roughness: 0.95, metalness: 0.0 }),
    false,
    true,
    { elementId: "e_wall" }
  );

  return hallGroup;
}

// ============================================================
// 3D + Picking: Tap on Bauteil -> je nach Modus Modal öffnen
// ============================================================
let renderer, scene, camera, controls, raycaster, pointerNDC;
let pickables = [];

function setup3D() {
  ensureTHREE();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef3);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 500);
  camera.position.set(55, 28, 55);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0xe9eef3, 1);
  renderer.domElement.style.position = "fixed";
  renderer.domElement.style.inset = "0";
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Controls (Mini)
  controls = new MiniOrbitControls(camera, renderer.domElement);

  // Lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7680, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(80, 60, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  // Floor + Grid
  const floorGeo = new THREE.PlaneGeometry(140, 140);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xd6dde6, roughness: 0.9, metalness: 0.0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(140, 140, 0x9aa6b2, 0xc0c9d3);
  grid.position.y = 0.01;
  scene.add(grid);

  // Hall model
  const hall = buildHall(scene);

  // Pickables: alle Meshes mit elementId
  pickables = [];
  hall.traverse((obj) => {
    if (obj && obj.isMesh && obj.userData && obj.userData.elementId) {
      pickables.push(obj);
    }
  });

  raycaster = new THREE.Raycaster();
  pointerNDC = new THREE.Vector2();

  // Tap on canvas
  renderer.domElement.addEventListener("pointerup", (e) => {
    // In Navigieren-Modus: Tap soll NICHT automatisch was öffnen.
    if (mode === Mode.NAV) return;

    // Wenn der User gerade im "Drag" war, nicht öffnen:
    // simple Heuristik: pointerup ohne große Bewegung -> ok
    // (wir lassen das erstmal, kann man später verbessern)

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    pointerNDC.set(x, y);

    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    if (!hits.length) return;

    const hit = hits[0].object;
    const eid = hit.userData.elementId;
    selectedElementId = eid;

    if (mode === Mode.ISSUE) openIssueModal(null, eid);
    if (mode === Mode.TASK) openTaskModal(null, eid);
  });

  // Resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animate
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

// ============================================================
// INIT
// ============================================================
function init() {
  wireUI();
  refreshProjectSelect();
  refreshBadges();
  setMode(Mode.NAV);
  showOkBadge();

  // 3D starten (wenn THREE nicht da -> Fehler anzeigen, Menü bleibt trotzdem bedienbar)
  try {
    setup3D();
  } catch (e) {
    showError(e?.message || e);
  }
}

init();
