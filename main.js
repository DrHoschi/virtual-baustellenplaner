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
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
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
});

// init
renderProjectSelect();





// ============================================================
// ISSUES (Mängel) – pro Projekt in localStorage
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

function createIssueForPicked(obj) {
  const ud = obj.userData || {};
  const titleDefault = ud.label || "Bauteil";

  const note = prompt(`Mangeltext für: ${titleDefault}`, "z. B. Schrauben fehlen / Delle / Undichtigkeit");
  if (note === null) return; // Abbruch

  const issue = {
    id: "i_" + Date.now(),
    projectId: activeProjectId,
    createdAt: new Date().toISOString(),
    elementId: ud.id || "",
    elementLabel: ud.label || "",
    elementType: ud.type || "",
    loc: ud.loc || "",
    status: "Neu",
    note: (note || "").trim()
  };

  issues = [issue, ...issues];
  saveIssues(issues);

  // Status am Bauteil markieren (UI-Feedback)
  obj.userData.status = "Mangel";

  // Material optisch abheben (visuelles Feedback)
  try {
    if (obj.material && obj.material.isMeshStandardMaterial) {
      obj.material = obj.material.clone();
      obj.material.emissive = new THREE.Color(0x3a0000);
      obj.material.emissiveIntensity = 0.35;
    }
  } catch (e) {}

  showPanelFor(obj);
  alert("Mangel gespeichert (Demo).");
}

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
  alert(`(Demo) Mangel anlegen für: ${lastPicked.userData?.label || "Bauteil"}`);
};
document.getElementById("pOk").onclick = () => {
  if (!lastPicked) return;
  alert(`(Demo) OK markiert: ${lastPicked.userData?.label || "Bauteil"}`);
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
      createIssueForPicked(hitObj);
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
