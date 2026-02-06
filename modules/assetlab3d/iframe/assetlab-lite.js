/**
 * modules/assetlab3d/iframe/assetlab-lite.js
 * Version: v2.0.1-lite-viewer-scrolllock (2026-02-06)
 *
 * AssetLab 3D (Lite) – GH-Pages robust (ohne three.js Editor-Kern)
 * ---------------------------------------------------------------------------
 * Funktionen:
 * - Import GLB (GLTF/GLB Loader)  ✅ (GLTF mit externen Dateien nur eingeschränkt)
 * - Orbit (Finger: drehen/zoomen)
 * - Tap/Click: Objekt auswählen
 * - Move/Rotate/Scale via TransformControls
 * - Export GLB / GLTF
 * - Optional: Draco-Decode (Import) + KTX2 (Import), wenn libs vorhanden
 *
 * iOS Embed Fix (NEU):
 * - Im eingebetteten Baustellenplaner (scrollender Host + iframe + WebGL)
 *   kann iOS Safari “verkleben”: kein Orbit, kein Scroll zurück.
 * - Lösung: iframe sendet assetlab:lockScroll {lock:true|false} an Host
 *   beim Interagieren + Failsafes (touchcancel/blur/visibilitychange/pagehide).
 *
 * Voraussetzungen:
 * - index.html hat Importmap für "three" & "three/addons/"
 * - Host (ui/panels/AssetLab3DPanel.js) verarbeitet assetlab:lockScroll
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
// Meshopt ist optional – wenn vorhanden, kann man es später dazu nehmen.

// ---------------------------------------------------------------------------
// Helpers / Messaging
// ---------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);

const q = new URLSearchParams(location.search);
const projectId = q.get("projectId") || "unknown";
$("#pid").textContent = `Projekt: ${projectId}`;

/**
 * postMessage → Host
 * (same-origin empfohlen, sonst origin anpassen)
 */
function hostPost(type, payload) {
  window.parent?.postMessage({ type, payload }, window.location.origin);
}

/**
 * Statusanzeige (oben rechts) + Log zum Host
 */
function setStatus(t) {
  $("#st").textContent = t;
  hostPost("assetlab:log", { msg: t });
}

// Handshake
hostPost("assetlab:ready", { projectId });

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Three basics
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(0x0e0f12, 1);
viewportEl.appendChild(renderer.domElement);

// iOS / Touch: Canvas soll NICHT als Page-Scroll interpretiert werden
// (zusätzlich zum Host-Lock)
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

// Licht + Grid (damit du sofort was siehst!)
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
  orbit.enabled = !ev.value;
});
scene.add(xform);

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function resize() {
  const w = viewportEl.clientWidth || window.innerWidth;
  const h = viewportEl.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------------------
// Selection via Raycaster
// ---------------------------------------------------------------------------
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let loadedRoot = null;      // die aktuell geladene Szene/Root
let selected = null;        // ausgewähltes Object3D

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

  // Wir wollen nicht Grid/Lichter auswählen → nach oben zum "Model root"
  let o = hits[0].object;
  while (o && o.parent && o.parent !== scene) o = o.parent;

  // Falls wir ein Root-Model haben, bevorzugen wir das
  if (loadedRoot && (o === loadedRoot || loadedRoot.children.includes(o))) {
    setSelected(o);
  } else {
    setSelected(o);
  }
}

// ---------------------------------------------------------------------------
// iOS / Embed Fix: Host-Scroll während Viewport-Interaktion sperren
// ---------------------------------------------------------------------------

/**
 * Internes Lock-Flag (damit wir nicht dauernd posten)
 */
const __scrollLock = { locked: false };

/**
 * Host sperren/entsperren (nur wenn Zustand wechselt)
 */
function hostLockScroll(lock) {
  lock = !!lock;
  if (lock === __scrollLock.locked) return;
  __scrollLock.locked = lock;

  hostPost("assetlab:lockScroll", { lock, projectId });
}

/**
 * Failsafe unlock (bei iOS geht manchmal pointerup “verloren”)
 */
function hostUnlockFailsafe() {
  hostLockScroll(false);
}

// 1) Pointer Events (modern)
renderer.domElement.addEventListener("pointerdown", () => hostLockScroll(true), { passive: true });
renderer.domElement.addEventListener("pointerup", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("pointercancel", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("pointerleave", hostUnlockFailsafe, { passive: true });

// 2) Touch Events (zusätzlich, falls Safari komisch ist)
renderer.domElement.addEventListener("touchstart", () => hostLockScroll(true), { passive: true });
renderer.domElement.addEventListener("touchend", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("touchcancel", hostUnlockFailsafe, { passive: true });

// 3) OrbitControls-Events (sehr zuverlässig fürs “Drehen/Zoomen”)
orbit.addEventListener("start", () => hostLockScroll(true));
orbit.addEventListener("end", hostUnlockFailsafe);

// 4) Window/Tab Failsafes (damit Scroll nie “hängenbleibt”)
window.addEventListener("blur", hostUnlockFailsafe, { passive: true });
window.addEventListener("pagehide", hostUnlockFailsafe, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hostUnlockFailsafe();
}, { passive: true });

// ---------------------------------------------------------------------------
// Pointer Events (Tap auf iOS) — Selection
// Hinweis: Wir locken oben schon auf pointerdown, deshalb nur picken,
// wenn gerade kein Transform-Drag aktiv ist.
// ---------------------------------------------------------------------------
renderer.domElement.addEventListener("pointerdown", (ev) => {
  if (xform.dragging) return;
  pick(ev.clientX, ev.clientY);
}, { passive: true });

// ---------------------------------------------------------------------------
// Loader Setup
// ---------------------------------------------------------------------------
const loader = new GLTFLoader();

// Draco (Import)
const draco = new DRACOLoader();
draco.setDecoderPath("../vendor/threejs-editor/examples/jsm/libs/draco/");
loader.setDRACOLoader(draco);

// KTX2/Basis (Import)
const ktx2 = new KTX2Loader();
ktx2.setTranscoderPath("../vendor/threejs-editor/examples/jsm/libs/basis/");
ktx2.detectSupport(renderer);
loader.setKTX2Loader(ktx2);

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
btnImport.onclick = () => fileInput.click();

fileInput.addEventListener("change", async () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  try {
    setStatus("import…");

    // Vorheriges Model entfernen + Ressourcen frei geben
    if (loadedRoot) {
      scene.remove(loadedRoot);
      loadedRoot.traverse((n) => {
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
      loadedRoot = null;
      setSelected(null);
    }

    const name = f.name.toLowerCase();

    // Empfehlung: GLB
    if (name.endsWith(".glb")) {
      const buf = await f.arrayBuffer();

      loader.parse(
        buf,
        "", // path leer (bei GLB ok)
        (gltf) => {
          loadedRoot = gltf.scene || gltf.scenes?.[0];
          scene.add(loadedRoot);

          // Auto-Fit Kamera auf Model
          const box = new THREE.Box3().setFromObject(loadedRoot);
          const size = box.getSize(new THREE.Vector3()).length();
          const center = box.getCenter(new THREE.Vector3());

          orbit.target.copy(center);
          camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.4, size * 0.6));
          camera.near = Math.max(0.01, size / 1000);
          camera.far = Math.max(5000, size * 10);
          camera.updateProjectionMatrix();

          setStatus("import ok");
        },
        (err) => {
          console.error(err);
          setStatus("import ERROR (parse)");
        }
      );
    } else if (name.endsWith(".gltf")) {
      // glTF mit externen Dateien ist im Browser ohne extra File-Picker-Handling schwierig.
      const url = URL.createObjectURL(f);

      loader.load(
        url,
        (gltf) => {
          URL.revokeObjectURL(url);
          loadedRoot = gltf.scene || gltf.scenes?.[0];
          scene.add(loadedRoot);
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
    fileInput.value = "";
  }
});

// ---------------------------------------------------------------------------
// Transform Mode Buttons
// ---------------------------------------------------------------------------
btnMove.onclick = () => xform.setMode("translate");
btnRotate.onclick = () => xform.setMode("rotate");
btnScale.onclick = () => xform.setMode("scale");

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function doExport(mode) {
  try {
    setStatus(mode === "glb" ? "export glb…" : "export gltf…");

    const exporter = new GLTFExporter();
    const options = {
      binary: mode === "glb",
      trs: true,
      onlyVisible: false,
      truncateDrawRange: true,
      embedImages: mode === "glb",

      // Draco Export ist je nach three-Version nicht zuverlässig verfügbar.
      // Checkbox bleibt als "exp." — hier nur als Options-Hinweis:
      ...(chkDraco?.checked ? { dracoOptions: {} } : {})
    };

    // Wichtig: Standardmäßig nur das geladene Model exportieren
    // (sonst landen Grid/Licht mit im Export)
    const root = loadedRoot || scene;

    exporter.parse(
      root,
      (result) => {
        if (mode === "glb") {
          downloadBlob(new Blob([result], { type: "model/gltf-binary" }), `assetlab_${projectId}.glb`);
        } else {
          const json = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          downloadBlob(new Blob([json], { type: "model/gltf+json" }), `assetlab_${projectId}.gltf`);
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
  }
}

btnExportGLB.onclick = () => doExport("glb");
btnExportGLTF.onclick = () => doExport("gltf");

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
btnReset.onclick = () => {
  if (loadedRoot) scene.remove(loadedRoot);
  loadedRoot = null;
  setSelected(null);

  orbit.target.set(0, 1, 0);
  camera.position.set(3, 2.2, 4);

  // Wichtig: Beim Reset sicher Scroll freigeben
  hostUnlockFailsafe();

  setStatus("reset");
};

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
function tick() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

setStatus("ready");
tick();
