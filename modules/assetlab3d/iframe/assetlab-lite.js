/**
 * AssetLab 3D (Lite)
 * Version: v2.1.0-final-embed-safe (2026-02-06)
 *
 * Fokus:
 * - stabil in iframe
 * - iOS Scroll NIE dauerhaft blockiert
 * - Scroll-Lock nur bei echter 3D-Interaktion
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const $ = (s) => document.querySelector(s);

/* ------------------------------------------------------------
   Messaging
   ------------------------------------------------------------ */
const q = new URLSearchParams(location.search);
const projectId = q.get("projectId") || "unknown";
$("#pid").textContent = `Projekt: ${projectId}`;

function hostPost(type, payload) {
  window.parent?.postMessage({ type, payload }, window.location.origin);
}

function setStatus(t) {
  $("#st").textContent = t;
  hostPost("assetlab:log", { msg: t });
}

hostPost("assetlab:ready", { projectId });

/* ------------------------------------------------------------
   Three.js Setup
   ------------------------------------------------------------ */
const viewport = $("#viewport");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(0x0e0f12, 1);
renderer.domElement.style.touchAction = "none";
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
camera.position.set(3, 2.2, 4);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 1, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(5, 10, 5);
scene.add(dir);
scene.add(new THREE.GridHelper(10, 10));

const xform = new TransformControls(camera, renderer.domElement);
xform.addEventListener("dragging-changed", e => orbit.enabled = !e.value);
scene.add(xform);

/* ------------------------------------------------------------
   Resize
   ------------------------------------------------------------ */
function resize() {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

/* ------------------------------------------------------------
   Scroll-Lock (nur während Interaktion!)
   ------------------------------------------------------------ */
let scrollLocked = false;

function lockScroll(on) {
  if (on === scrollLocked) return;
  scrollLocked = on;
  hostPost("assetlab:lockScroll", { lock: on, projectId });
}

orbit.addEventListener("start", () => lockScroll(true));
orbit.addEventListener("end", () => lockScroll(false));
xform.addEventListener("dragging-changed", e => lockScroll(e.value));

window.addEventListener("blur", () => lockScroll(false));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) lockScroll(false);
});

/* ------------------------------------------------------------
   Import (GLB)
   ------------------------------------------------------------ */
const loader = new GLTFLoader();
let loadedRoot = null;

$("#btnImport").onclick = () => $("#file").click();

$("#file").addEventListener("change", async () => {
  const f = $("#file").files[0];
  if (!f) return;

  setStatus("import…");

  if (loadedRoot) {
    scene.remove(loadedRoot);
    loadedRoot = null;
  }

  const buf = await f.arrayBuffer();
  loader.parse(buf, "", gltf => {
    loadedRoot = gltf.scene;
    scene.add(loadedRoot);
    setStatus("import ok");
  });

  $("#file").value = "";
});

/* ------------------------------------------------------------
   Export
   ------------------------------------------------------------ */
const exporter = new GLTFExporter();

$("#btnExportGLB").onclick = () => {
  exporter.parse(
    loadedRoot || scene,
    res => {
      const blob = new Blob([res], { type: "model/gltf-binary" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `assetlab_${projectId}.glb`;
      a.click();
      setStatus("export ok");
    },
    { binary: true }
  );
};

/* ------------------------------------------------------------
   Loop
   ------------------------------------------------------------ */
function tick() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
setStatus("ready");
tick();
