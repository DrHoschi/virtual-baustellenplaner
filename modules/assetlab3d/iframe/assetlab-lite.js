/**
 * modules/assetlab3d/iframe/assetlab-lite.js
 * Version: v2.1.0-lite-viewer-ios-embed-final (2026-02-06)
 *
 * AssetLab 3D (Lite) – GH-Pages robust (ohne three.js Editor-Kern)
 * -----------------------------------------------------------------------------
 * Funktionen:
 *  - Import GLB (GLTF/GLB Loader) ✅ (GLTF mit externen Dateien nur eingeschränkt)
 *  - OrbitControls (Finger: drehen/zoomen)
 *  - Tap/Click: Objekt auswählen (Raycast)
 *  - Move/Rotate/Scale via TransformControls
 *  - Export GLB / GLTF (GLTFExporter)
 *  - Optional: Draco-Decode (Import) + KTX2/Basis (Import), wenn libs vorhanden
 *
 * iOS Embed Fix (WICHTIG):
 *  - In iOS Safari (scrollender Host + iframe + WebGL) kann es passieren, dass:
 *      a) der Host-Scroll „klebt“ (man kommt nicht mehr hoch zur Menüleiste)
 *      b) PointerUp/TouchEnd „verloren“ geht → Host bleibt gesperrt
 *  - Lösung:
 *      1) iframe sendet assetlab:lockScroll {lock:true|false} an den Host
 *      2) Wir haben Failsafes + Watchdog-Timer:
 *         - unlock bei pointerup/touchend/blur/pagehide/visibilitychange
 *         - zusätzlich Auto-Unlock nach kurzer Zeit, falls End-Event fehlt
 *
 * Voraussetzungen:
 *  - index.html hat Importmap für "three" & "three/addons/"
 *  - Host (ui/panels/AssetLab3DPanel.js) verarbeitet assetlab:lockScroll
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// =============================================================================
// 0) Helpers / Messaging
// =============================================================================
const $ = (s) => document.querySelector(s);

const q = new URLSearchParams(location.search);
const projectId = q.get("projectId") || "unknown";
const elPid = $("#pid");
const elSt = $("#st");

if (elPid) elPid.textContent = `Projekt: ${projectId}`;

/**
 * postMessage → Host (same-origin empfohlen)
 * Hinweis: window.location.origin passt für GH-Pages + same-origin iframe.
 */
function hostPost(type, payload) {
  window.parent?.postMessage({ type, payload }, window.location.origin);
}

/** Statusanzeige + Log zum Host */
function setStatus(t) {
  if (elSt) elSt.textContent = t;
  hostPost("assetlab:log", { msg: t });
}

// Handshake
hostPost("assetlab:ready", { projectId });

// =============================================================================
// 1) DOM
// =============================================================================
const viewportEl = $("#viewport");
const fileInput = $("#file");

const btnImport = $("#btnImport");
const btnMove = $("#btnMove");
const btnRotate = $("#btnRotate");
const btnScale = $("#btnScale");
const btnExportGLB = $("#btnExportGLB");
const btnExportGLTF = $("#btnExportGLTF");
const btnReset = $("#btnReset");
const chkDraco = $("#alDraco");

// Defensive: falls Buttons fehlen (z.B. altes HTML), nicht crashen.
function must(el, name) {
  if (!el) console.warn(`[assetlab-lite] Missing DOM element: ${name}`);
  return el;
}
must(viewportEl, "#viewport");
must(fileInput, "#file");
must(btnImport, "#btnImport");
must(btnMove, "#btnMove");
must(btnRotate, "#btnRotate");
must(btnScale, "#btnScale");
must(btnExportGLB, "#btnExportGLB");
must(btnExportGLTF, "#btnExportGLTF");
must(btnReset, "#btnReset");

// =============================================================================
// 2) Three basics (Renderer / Scene / Camera)
// =============================================================================
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(0x0e0f12, 1);

if (viewportEl) viewportEl.appendChild(renderer.domElement);

// iOS/Touch: Canvas soll NICHT als Page-Scroll interpretiert werden
renderer.domElement.style.touchAction = "none";
renderer.domElement.style.webkitTouchCallout = "none";
renderer.domElement.style.webkitUserSelect = "none";
renderer.domElement.style.userSelect = "none";

const scene = new THREE.Scene();

// Kamera + Orbit
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
camera.position.set(3, 2.2, 4);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 1, 0);

// Licht + Grid (damit sofort sichtbar ist, dass WebGL läuft)
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(5, 10, 5);
scene.add(dir);

const grid = new THREE.GridHelper(10, 10, 0x2a2f38, 0x1a1f28);
grid.position.y = 0;
scene.add(grid);

// TransformControls
const xform = new TransformControls(camera, renderer.domElement);
xform.addEventListener("dragging-changed", (ev) => {
  // Während Transform-Drag → Orbit aus (sonst „fight“)
  orbit.enabled = !ev.value;
});
scene.add(xform);

// =============================================================================
// 3) Resize
// =============================================================================
function resize() {
  const w = (viewportEl?.clientWidth) || window.innerWidth;
  const h = (viewportEl?.clientHeight) || window.innerHeight;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// =============================================================================
// 4) Selection via Raycaster
// =============================================================================
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let loadedRoot = null; // aktuell geladenes Model
let selected = null;   // aktuell ausgewähltes Object3D

function setSelected(obj) {
  selected = obj;
  if (selected) xform.attach(selected);
  else xform.detach();
}

function pick(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

  ray.setFromCamera(pointer, camera);

  const hits = ray.intersectObjects(scene.children, true);
  if (!hits.length) {
    setSelected(null);
    return;
  }

  // Nicht „unten“ selektieren (Mesh-Leaf), sondern bis zum Modell-Root hochgehen
  let o = hits[0].object;
  while (o && o.parent && o.parent !== scene) o = o.parent;

  setSelected(o);
}

// =============================================================================
// 5) iOS / Embed Fix: Host-Scroll Lock + Failsafes + Watchdog
// =============================================================================

/**
 * Internes Lock-Flag + Watchdog-Timer
 * Idee:
 * - Lock beim Start einer Interaktion (pointerdown/orbit.start)
 * - Unlock bei End-Events
 * - Falls End-Event fehlt: Watchdog löst automatisch nach kurzer Zeit
 */
const __scrollLock = {
  locked: false,
  watchdog: null,
  lastKick: 0
};

function hostLockScroll(lock) {
  lock = !!lock;
  if (lock === __scrollLock.locked) return;

  __scrollLock.locked = lock;
  hostPost("assetlab:lockScroll", { lock, projectId });

  // Watchdog verwalten
  if (lock) {
    kickWatchdog();
  } else {
    clearWatchdog();
  }
}

/** Watchdog: wenn iOS kein pointerup liefert, wird trotzdem wieder freigegeben */
function kickWatchdog() {
  __scrollLock.lastKick = Date.now();

  // Timer neu setzen (damit „Dauer-Geste“ nicht ständig unlockt)
  clearWatchdog();
  __scrollLock.watchdog = setTimeout(() => {
    // Wenn seit dem letzten Kick genug Zeit vergangen ist → unlock
    // (Der Timer wird bei pointermove/touchmove/orbit events immer wieder „gekickt“)
    hostLockScroll(false);
  }, 1400);
}

function clearWatchdog() {
  if (__scrollLock.watchdog) {
    clearTimeout(__scrollLock.watchdog);
    __scrollLock.watchdog = null;
  }
}

function hostUnlockFailsafe() {
  hostLockScroll(false);
}

/**
 * 5.1) Pointer/Touch Events auf Canvas
 * - pointermove/touchmove „kickt“ den Watchdog → während Gesten bleibt Lock stabil
 */
renderer.domElement.addEventListener("pointerdown", () => hostLockScroll(true), { passive: true });
renderer.domElement.addEventListener("pointerup", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("pointercancel", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("pointerleave", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("pointermove", () => { if (__scrollLock.locked) kickWatchdog(); }, { passive: true });

renderer.domElement.addEventListener("touchstart", () => hostLockScroll(true), { passive: true });
renderer.domElement.addEventListener("touchend", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("touchcancel", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("touchmove", () => { if (__scrollLock.locked) kickWatchdog(); }, { passive: true });

/**
 * 5.2) OrbitControls Events (sehr zuverlässig)
 */
orbit.addEventListener("start", () => hostLockScroll(true));
orbit.addEventListener("change", () => { if (__scrollLock.locked) kickWatchdog(); });
orbit.addEventListener("end", hostUnlockFailsafe);

/**
 * 5.3) Tab/Window Failsafes
 */
window.addEventListener("blur", hostUnlockFailsafe, { passive: true });
window.addEventListener("pagehide", hostUnlockFailsafe, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hostUnlockFailsafe();
}, { passive: true });

// =============================================================================
// 6) Selection (Tap) – NACH Lock-Setup
// =============================================================================
renderer.domElement.addEventListener("pointerdown", (ev) => {
  // Wenn TransformControls gerade ziehen → nicht neu selektieren
  if (xform.dragging) return;
  pick(ev.clientX, ev.clientY);
}, { passive: true });

// =============================================================================
// 7) Loader Setup (GLTFLoader + optional Draco/KTX2)
// =============================================================================
const loader = new GLTFLoader();

// Draco (Decode beim Import)
try {
  const draco = new DRACOLoader();
  draco.setDecoderPath("../vendor/threejs-editor/examples/jsm/libs/draco/");
  loader.setDRACOLoader(draco);
} catch (e) {
  console.warn("[assetlab-lite] Draco loader init failed:", e);
}

// KTX2/Basis (Import)
try {
  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath("../vendor/threejs-editor/examples/jsm/libs/basis/");
  ktx2.detectSupport(renderer);
  loader.setKTX2Loader(ktx2);
} catch (e) {
  console.warn("[assetlab-lite] KTX2 loader init failed:", e);
}

// =============================================================================
// 8) Import
// =============================================================================
function disposeRoot(root) {
  if (!root) return;

  root.traverse((n) => {
    if (n.geometry) n.geometry.dispose?.();
    if (n.material) {
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach((m) => {
        for (const k in m) {
          const v = m[k];
          if (v && v.isTexture) v.dispose?.();
        }
        m.dispose?.();
      });
    }
  });
}

function fitCameraToObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());

  orbit.target.copy(center);

  // Kamera passend positionieren
  camera.position
    .copy(center)
    .add(new THREE.Vector3(size * 0.6, size * 0.4, size * 0.6));

  camera.near = Math.max(0.01, size / 1000);
  camera.far = Math.max(5000, size * 10);
  camera.updateProjectionMatrix();
}

if (btnImport && fileInput) {
  btnImport.onclick = () => fileInput.click();

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    if (!f) return;

    try {
      setStatus("import…");

      // Vorheriges Model entfernen
      if (loadedRoot) {
        scene.remove(loadedRoot);
        disposeRoot(loadedRoot);
        loadedRoot = null;
        setSelected(null);
      }

      const name = f.name.toLowerCase();

      // Empfehlung: GLB (self-contained)
      if (name.endsWith(".glb")) {
        const buf = await f.arrayBuffer();

        loader.parse(
          buf,
          "",
          (gltf) => {
            loadedRoot = gltf.scene || gltf.scenes?.[0];
            if (!loadedRoot) {
              setStatus("import ERROR (no scene)");
              return;
            }

            scene.add(loadedRoot);
            fitCameraToObject(loadedRoot);

            setStatus("import ok");
          },
          (err) => {
            console.error(err);
            setStatus("import ERROR (parse)");
          }
        );
      } else if (name.endsWith(".gltf")) {
        // glTF (JSON) kann externe .bin/Textures referenzieren → im Browser schwierig ohne Multi-File Picker.
        const url = URL.createObjectURL(f);

        loader.load(
          url,
          (gltf) => {
            URL.revokeObjectURL(url);

            loadedRoot = gltf.scene || gltf.scenes?.[0];
            if (!loadedRoot) {
              setStatus("import ERROR (no scene)");
              return;
            }

            scene.add(loadedRoot);
            fitCameraToObject(loadedRoot);

            setStatus("import ok (gltf)");
          },
          undefined,
          (err) => {
            URL.revokeObjectURL(url);
            console.error(err);
            setStatus("import ERROR (gltf)");
          }
        );
      } else {
        setStatus("Bitte GLB/GLTF auswählen");
      }
    } finally {
      // Wichtig: input resetten, sonst kann man gleiche Datei nicht 2x wählen
      fileInput.value = "";
      hostUnlockFailsafe(); // sicherheitshalber (Import-Dialog kann iOS Events verschlucken)
    }
  });
}

// =============================================================================
// 9) Transform Mode Buttons
// =============================================================================
if (btnMove) btnMove.onclick = () => xform.setMode("translate");
if (btnRotate) btnRotate.onclick = () => xform.setMode("rotate");
if (btnScale) btnScale.onclick = () => xform.setMode("scale");

// =============================================================================
// 10) Export
// =============================================================================
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(a.href);
  }, 1500);
}

function doExport(mode) {
  try {
    setStatus(mode === "glb" ? "export glb…" : "export gltf…");

    const exporter = new GLTFExporter();
    const options = {
      binary: mode === "glb",
      trs: true,
      onlyVisible: false,
      truncateDrawRange: true,
      embedImages: mode === "glb",

      // Draco Export ist abhängig von three-Version/Exporter-Implementierung.
      // Checkbox bleibt “exp.” – wir reichen Optionen durch, wenn vorhanden.
      ...(chkDraco?.checked ? { dracoOptions: {} } : {})
    };

    // Standard: nur das geladene Model exportieren (nicht Grid/Licht)
    const root = loadedRoot || scene;

    exporter.parse(
      root,
      (result) => {
        if (mode === "glb") {
          downloadBlob(
            new Blob([result], { type: "model/gltf-binary" }),
            `assetlab_${projectId}.glb`
          );
        } else {
          const json = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          downloadBlob(
            new Blob([json], { type: "model/gltf+json" }),
            `assetlab_${projectId}.gltf`
          );
        }

        setStatus(chkDraco?.checked ? "export ok (draco exp.)" : "export ok");
      },
      (err) => {
        console.error(err);
        setStatus("export ERROR");
      },
      options
    );
  } catch (e) {
    console.error(e);
    setStatus("export ERROR (exception)");
  } finally {
    hostUnlockFailsafe();
  }
}

if (btnExportGLB) btnExportGLB.onclick = () => doExport("glb");
if (btnExportGLTF) btnExportGLTF.onclick = () => doExport("gltf");

// =============================================================================
// 11) Reset
// =============================================================================
if (btnReset) {
  btnReset.onclick = () => {
    if (loadedRoot) {
      scene.remove(loadedRoot);
      disposeRoot(loadedRoot);
    }

    loadedRoot = null;
    setSelected(null);

    orbit.target.set(0, 1, 0);
    camera.position.set(3, 2.2, 4);
    camera.updateProjectionMatrix();

    hostUnlockFailsafe();
    setStatus("reset");
  };
}

// =============================================================================
// 12) Render loop
// =============================================================================
function tick() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

setStatus("ready");
tick();
