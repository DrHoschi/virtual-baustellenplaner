/**
 * modules/assetlab3d/iframe/assetlab-lite.js
 * Version: v2.0.2-lite-viewer-clean (2026-02-06)
 *
 * AssetLab 3D (Lite) — GH-Pages robust (ohne Three.js Editor-Kern)
 * =============================================================================
 * Ziel:
 *  - Ein kleiner, stabiler 3D-Viewer/Editor (Import + Transform + Export),
 *    der auf GitHub Pages läuft und im Host (Baustellenplaner) als iframe
 *    eingebettet werden kann.
 *
 * Enthaltene Funktionen:
 *  - Import GLB (GLTF/GLB Loader) ✅
 *    (GLTF mit externen .bin/.png/.jpg nur eingeschränkt, da Browser-File-Handling
 *     dafür ein Multi-File-Picker/Resolver bräuchte.)
 *  - OrbitControls (Drehen/Zoomen/Schwenken)
 *  - Tap/Click: Objekt auswählen (Raycast)
 *  - TransformControls: Move / Rotate / Scale
 *  - Export GLB (binary) / GLTF (JSON)
 *  - Optional: Draco-Decode (Import) + KTX2 (Import), falls libs vorhanden
 *
 * WICHTIG:
 *  - Dieses File ist bewusst "clean" gehalten:
 *    KEINE Host-Scroll-Sperren / KEIN assetlab:lockScroll / keine iOS-Fixes,
 *    damit wir wieder auf einem stabilen Stand sind.
 *
 * Voraussetzungen (index.html im selben Ordner):
 *  - Importmap für:
 *      "three"           -> ../vendor/threejs-editor/build/three.module.js
 *      "three/addons/"   -> ../vendor/threejs-editor/examples/jsm/
 *  - DOM-IDs:
 *      #viewport, #pid, #st, #file,
 *      #btnImport, #btnMove, #btnRotate, #btnScale,
 *      #btnExportGLB, #btnExportGLTF, #btnReset, #alDraco
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// =============================================================================
// 0) Mini-Helpers / Messaging
// =============================================================================

/** DOM helper */
const $ = (s) => document.querySelector(s);

/** projectId kommt über ?projectId=... vom Host */
const q = new URLSearchParams(location.search);
const projectId = q.get("projectId") || "unknown";
$("#pid").textContent = `Projekt: ${projectId}`;

/**
 * postMessage → Host (Baustellenplaner)
 * Hinweis:
 * - Wir nutzen window.location.origin (same-origin).
 * - Falls du später cross-origin einbettest, muss der targetOrigin angepasst werden.
 */
function hostPost(type, payload) {
  window.parent?.postMessage({ type, payload }, window.location.origin);
}

/** Statusanzeige (oben rechts) + optionaler Log an Host */
function setStatus(t) {
  const st = $("#st");
  if (st) st.textContent = t;
  hostPost("assetlab:log", { msg: t });
}

/** Handshake: Host kann damit "ready" anzeigen und init schicken */
hostPost("assetlab:ready", { projectId });

// =============================================================================
// 1) DOM-Refs
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

// =============================================================================
// 2) Three.js Setup (Renderer / Scene / Camera / Controls / Light)
// =============================================================================

/** WebGL Renderer */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(0x0e0f12, 1);
viewportEl.appendChild(renderer.domElement);

/**
 * Touch-Handling:
 * - Im iframe soll der Canvas NICHT als Page-Scroll interpretiert werden.
 * - Das ist KEIN Host-Lock — betrifft nur die Canvas-Interaktion.
 */
renderer.domElement.style.touchAction = "none";

/** Scene */
const scene = new THREE.Scene();

/** Camera */
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
camera.position.set(3, 2.2, 4);

/** OrbitControls */
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 1, 0);

/** Licht + Grid (damit sofort etwas sichtbar ist) */
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(5, 10, 5);
scene.add(dir);

const grid = new THREE.GridHelper(10, 10, 0x2a2f38, 0x1a1f28);
grid.position.y = 0;
scene.add(grid);

/** TransformControls */
const xform = new TransformControls(camera, renderer.domElement);
xform.addEventListener("dragging-changed", (ev) => {
  // Während Transform-Drag kein Orbit (damit es nicht "zappelt")
  orbit.enabled = !ev.value;
});
scene.add(xform);

// =============================================================================
// 3) Resize
// =============================================================================

function resize() {
  const w = viewportEl.clientWidth || window.innerWidth;
  const h = viewportEl.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// =============================================================================
// 4) Auswahl (Raycaster) — Tap/Click auf Objekt
// =============================================================================

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let loadedRoot = null; // aktuell geladenes Modell (glTF root)
let selected = null;   // aktuell ausgewähltes Object3D

function setSelected(obj) {
  selected = obj;
  if (selected) xform.attach(selected);
  else xform.detach();
}

/**
 * Pick helper
 * - raycast auf Szene
 * - versucht ein "oberes" Objekt (nahe Root) zu wählen
 */
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

  // Nicht bis ganz hoch "Scene" — aber wenigstens bis zum Root-Model
  let o = hits[0].object;

  // Wenn wir ein loadedRoot haben, wandern wir hoch bis ein Kind von loadedRoot
  if (loadedRoot) {
    while (o && o.parent && o.parent !== loadedRoot && o.parent !== scene) o = o.parent;
  } else {
    while (o && o.parent && o.parent !== scene) o = o.parent;
  }

  setSelected(o);
}

/**
 * Selection Events
 * - Wir picken auf pointerup (nicht pointerdown), damit Orbit-Gesten
 *   nicht sofort "auswählen" und sich das natürlicher anfühlt.
 */
let __down = null;
renderer.domElement.addEventListener("pointerdown", (ev) => {
  __down = { x: ev.clientX, y: ev.clientY, t: performance.now() };
}, { passive: true });

renderer.domElement.addEventListener("pointerup", (ev) => {
  if (!__down) return;

  // Wenn Transform gerade zieht: nicht picken
  if (xform.dragging) { __down = null; return; }

  // "Tap" = wenig Bewegung
  const dx = Math.abs(ev.clientX - __down.x);
  const dy = Math.abs(ev.clientY - __down.y);
  const moved = (dx + dy) > 10; // px
  if (!moved) pick(ev.clientX, ev.clientY);

  __down = null;
}, { passive: true });

// =============================================================================
// 5) Loader Setup (GLTFLoader + optional Draco/KTX2)
// =============================================================================

const loader = new GLTFLoader();

/** Draco (Import) — wenn Decoder-Files vorhanden sind */
try {
  const draco = new DRACOLoader();
  draco.setDecoderPath("../vendor/threejs-editor/examples/jsm/libs/draco/");
  loader.setDRACOLoader(draco);
} catch (e) {
  // optional — kein harter Fehler
  console.warn("[assetlab-lite] Draco init skipped:", e);
}

/** KTX2/Basis (Import) — wenn Transcoder-Files vorhanden sind */
try {
  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath("../vendor/threejs-editor/examples/jsm/libs/basis/");
  ktx2.detectSupport(renderer);
  loader.setKTX2Loader(ktx2);
} catch (e) {
  // optional — kein harter Fehler
  console.warn("[assetlab-lite] KTX2 init skipped:", e);
}

// =============================================================================
// 6) Import (GLB/GLTF)
// =============================================================================

btnImport.onclick = () => fileInput.click();

/** Ressourcen sauber freigeben (Geometrien/Materialien/Texturen) */
function disposeObject3D(root) {
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

  // Kamera etwas schräg von oben
  camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.4, size * 0.6));
  camera.near = Math.max(0.01, size / 1000);
  camera.far = Math.max(5000, size * 10);
  camera.updateProjectionMatrix();
}

fileInput.addEventListener("change", async () => {
  const f = fileInput.files?.[0];
  if (!f) return;

  try {
    setStatus("import…");

    // Vorheriges Modell entfernen
    if (loadedRoot) {
      scene.remove(loadedRoot);
      disposeObject3D(loadedRoot);
      loadedRoot = null;
      setSelected(null);
    }

    const name = f.name.toLowerCase();

    if (name.endsWith(".glb")) {
      const buf = await f.arrayBuffer();

      loader.parse(
        buf,
        "", // GLB braucht keinen basePath
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
      // glTF mit externen Files ist im Browser ohne Resolver schwierig.
      // Wir versuchen objectURL — kann scheitern, wenn .bin/Textures fehlen.
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
    // Wichtig: Input zurücksetzen, damit man dieselbe Datei erneut wählen kann
    fileInput.value = "";
  }
});

// =============================================================================
// 7) Transform Mode Buttons (Move/Rotate/Scale)
// =============================================================================

btnMove.onclick = () => xform.setMode("translate");
btnRotate.onclick = () => xform.setMode("rotate");
btnScale.onclick = () => xform.setMode("scale");

// =============================================================================
// 8) Export (GLB / GLTF)
// =============================================================================

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function doExport(mode /* "glb" | "gltf" */) {
  setStatus(mode === "glb" ? "export glb…" : "export gltf…");

  const exporter = new GLTFExporter();

  const options = {
    binary: mode === "glb",
    trs: true,
    onlyVisible: false,
    truncateDrawRange: true,
    embedImages: mode === "glb",

    // Draco Export ist je nach three-Version nicht überall stabil.
    // Checkbox bleibt daher "exp." (experimentell).
    ...(chkDraco?.checked ? { dracoOptions: {} } : {})
  };

  // Standard: nur das geladene Modell exportieren (ohne Grid/Licht)
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
}

btnExportGLB.onclick = () => doExport("glb");
btnExportGLTF.onclick = () => doExport("gltf");

// =============================================================================
// 9) Reset
// =============================================================================

btnReset.onclick = () => {
  if (loadedRoot) {
    scene.remove(loadedRoot);
    disposeObject3D(loadedRoot);
  }
  loadedRoot = null;
  setSelected(null);

  orbit.target.set(0, 1, 0);
  camera.position.set(3, 2.2, 4);

  setStatus("reset");
};

// =============================================================================
// 10) Render Loop
// =============================================================================

function tick() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

setStatus("ready");
tick();
