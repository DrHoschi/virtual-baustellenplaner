import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

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

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

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

function addBox(w, h, d, x, y, z, mat, cast=true, receive=false) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  hallGroup.add(mesh);
  return mesh;
}

// Spalten (an den “Rahmen” Linien in Z-Richtung, links & rechts)
for (let iz = 0; iz <= nz; iz++) {
  const z = -halfL + iz * bay;
  // linke und rechte Stütze
  addBox(M(HALL.steel.col), eaveH, M(HALL.steel.col), -halfW, eaveH/2, z, matSteel);
  addBox(M(HALL.steel.col), eaveH, M(HALL.steel.col),  halfW, eaveH/2, z, matSteel);
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
