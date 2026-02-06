/**
 * modules/assetlab3d/iframe/assetlab-lite.js
 * Version: v2.1.0-lite-viewer-hostcmd-sticky (2026-02-06)
 *
 * AssetLab 3D (Lite) – GH-Pages robust (ohne three.js Editor-Kern)
 * ---------------------------------------------------------------------------
 * Funktionen:
 * - Import GLB (GLTF/GLB Loader) ✅
 * - Orbit (Finger: drehen/zoomen)
 * - Tap/Click: Objekt auswählen
 * - Move/Rotate/Scale via TransformControls
 * - Export GLB / GLTF
 * - Optional: Draco-Decode (Import) + KTX2 (Import), wenn libs vorhanden
 *
 * iOS Embed Fix:
 * - iframe sendet assetlab:lockScroll {lock:true|false} an Host
 * - viele Failsafes (pointer/touch/orbit/blur/visibilitychange)
 *
 * Host Sticky-Controls:
 * - Host kann Befehle senden: assetlab:cmd
 *   cmd: import | mode | export | reset | draco
 *
 * Voraussetzungen:
 * - index.html hat Importmap für "three" & "three/addons/"
 * - Host verarbeitet assetlab:lockScroll
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// ---------------------------------------------------------------------------
// Helpers / Messaging
// ---------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);

const q = new URLSearchParams(location.search);
const projectId = q.get("projectId") || "unknown";
$("#pid").textContent = `Projekt: ${projectId}`;

/**
 * postMessage → Host (same-origin)
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

// iOS / Touch: Canvas soll nicht als Page-Scroll interpretiert werden
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

// Licht + Grid (damit man sofort was sieht)
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

let loadedRoot = null; // aktuell geladenes Model
let selected = null;

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

  // nach oben zum root
  let o = hits[0].object;
  while (o && o.parent && o.parent !== scene) o = o.parent;
  setSelected(o);
}

renderer.domElement.addEventListener("pointerdown", (ev) => {
  if (xform.dragging) return;
  pick(ev.clientX, ev.clientY);
}, { passive: true });

// ---------------------------------------------------------------------------
// iOS / Embed Fix: Host-Scroll während Interaktion sperren
// ---------------------------------------------------------------------------
const __scrollLock = { locked: false };

function hostLockScroll(lock) {
  lock = !!lock;
  if (lock === __scrollLock.locked) return;
  __scrollLock.locked = lock;
  hostPost("assetlab:lockScroll", { lock, projectId });
}
function hostUnlockFailsafe() {
  hostLockScroll(false);
}

// Pointer / Touch (breite Abdeckung)
renderer.domElement.addEventListener("pointerdown", () => hostLockScroll(true), { passive: true });
renderer.domElement.addEventListener("pointerup", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("pointercancel", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("pointerleave", hostUnlockFailsafe, { passive: true });

renderer.domElement.addEventListener("touchstart", () => hostLockScroll(true), { passive: true });
renderer.domElement.addEventListener("touchend", hostUnlockFailsafe, { passive: true });
renderer.domElement.addEventListener("touchcancel", hostUnlockFailsafe, { passive: true });

// OrbitControls Events (sehr zuverlässig)
orbit.addEventListener("start", () => hostLockScroll(true));
orbit.addEventListener("end", hostUnlockFailsafe);

// Tab/Window Failsafes (niemals hängen bleiben!)
window.addEventListener("blur", hostUnlockFailsafe, { passive: true });
window.addEventListener("pagehide", hostUnlockFailsafe, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hostUnlockFailsafe();
}, { passive: true });

// ---------------------------------------------------------------------------
// Loader Setup
// ---------------------------------------------------------------------------
const loader = new GLTFLoader();

// Draco (Import decode) – wenn Pfad existiert, super; sonst kein 404? (kann trotzdem ok sein)
const draco = new DRACOLoader();
draco.setDecoderPath("../vendor/threejs-editor/examples/jsm/libs/draco/");
loader.setDRACOLoader(draco);

// KTX2/Basis (Import decode)
const ktx2 = new KTX2Loader();
ktx2.setTranscoderPath("../vendor/threejs-editor/examples/jsm/libs/basis/");
ktx2.detectSupport(renderer);
loader.setKTX2Loader(ktx2);

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
function openImportPicker() {
  fileInput.click();
}

btnImport.onclick = openImportPicker;

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

    if (name.endsWith(".glb")) {
      const buf = await f.arrayBuffer();

      loader.parse(
        buf,
        "",
        (gltf) => {
          loadedRoot = gltf.scene || gltf.scenes?.[0];
          scene.add(loadedRoot);

          // Kamera auto-fit
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
      // glTF mit externen Dateien ist im Browser ohne Multi-File Handling schwierig
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
// Transform Modes
// ---------------------------------------------------------------------------
function setMode(mode) {
  xform.setMode(mode);
  setStatus(`mode: ${mode}`);
}

btnMove.onclick = () => setMode("translate");
btnRotate.onclick = () => setMode("rotate");
btnScale.onclick = () => setMode("scale");

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
      // Draco Export ist abhängig von three-Version / Addon-Stand → bleibt "exp."
      ...(chkDraco?.checked ? { dracoOptions: {} } : {})
    };

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
function doReset() {
  if (loadedRoot) scene.remove(loadedRoot);
  loadedRoot = null;
  setSelected(null);

  orbit.target.set(0, 1, 0);
  camera.position.set(3, 2.2, 4);

  hostUnlockFailsafe();
  setStatus("reset");
}

btnReset.onclick = doReset;

// ---------------------------------------------------------------------------
// Host Commands (Sticky-Bar)
// ---------------------------------------------------------------------------
// Host sendet: { type:"assetlab:cmd", payload:{cmd,...} }
window.addEventListener("message", (ev) => {
  // same-origin recommended
  if (!ev || !ev.data) return;
  const { type, payload } = ev.data || {};
  if (type !== "assetlab:cmd") return;

  const cmd = payload?.cmd;

  if (cmd === "import") {
    openImportPicker();
    return;
  }

  if (cmd === "mode") {
    const mode = payload?.mode;
    if (mode) setMode(mode);
    return;
  }

  if (cmd === "export") {
    const fmt = payload?.format;
    if (fmt === "glb" || fmt === "gltf") doExport(fmt);
    return;
  }

  if (cmd === "reset") {
    doReset();
    return;
  }

  if (cmd === "draco") {
    const en = !!payload?.enabled;
    if (chkDraco) chkDraco.checked = en;
    setStatus(en ? "draco: on (exp.)" : "draco: off");
    return;
  }
});

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
