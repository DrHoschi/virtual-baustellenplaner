/**
 * modules/assetlab3d/iframe/assetlab-lite.js
 * Version: v2.0.3-lite-viewer-restorefix (2026-02-16)
 *
 * AssetLab 3D (Lite) — GH-Pages robust (iframe)
 * =============================================================================
 * Ziel:
 *  - Kleiner stabiler 3D-Viewer/Quick-Editor: Import + Transform + Export
 *  - Same-Origin Einbettung im Host (Baustellenplaner) via postMessage
 *  - Persistenz für Slots via IndexedDB (shared/idb-util.js)
 *
 * Parent -> iframe:
 *   { ns:"assetlab", type:"assetlab:init",    payload:{ projectId, projectAssetId, slotId, hasModel } }
 *   { ns:"assetlab", type:"assetlab:restore", payload:{ projectAssetId, slotId } }
 *
 * iframe -> Parent:
 *   { ns:"assetlab", type:"assetlab:ready",      payload:{ projectId } }
 *   { ns:"assetlab", type:"assetlab:log",        payload:{ msg } }
 *   { ns:"assetlab", type:"assetlab:slotUpdate", payload:{ projectAssetId, slotId, hasModel, fileName, updatedAt, lastAction, exportRef, kind } }
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// Shared IDB util (same-origin)
import { idbGet, idbPut, makeModelKey } from "../shared/idb-util.js";

// =============================================================================
// 0) Mini-Helpers / Messaging
// =============================================================================

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const projectId = q.get("projectId") || "unknown";
const DEBUG = (q.get("debug") === "1" || q.get("debug") === "true");
function dlog(...args) { if (DEBUG) console.log("[assetlab-lite]", ...args); }

function postToParent(type, payload) {
  try {
    window.parent?.postMessage({ ns: "assetlab", type, payload }, window.location.origin);
  } catch (e) {
    // no-op
  }
}

// Variante mit Transferables (z.B. ArrayBuffer)
function postToParentX(type, payload, transfer) {
  try {
    window.parent?.postMessage({ ns: "assetlab", type, payload }, window.location.origin, transfer);
  } catch (e) {
    // no-op
  }
}

function setStatus(t) {
  const st = $("#st");
  if (st) st.textContent = t;
  postToParent("assetlab:log", { msg: t });
}

const pidEl = $("#pid");
if (pidEl) pidEl.textContent = `Projekt: ${projectId}`;

// ---------------------------------------------------------------------------
// Handshake: "ready" darf NICHT zu früh kommen.
//
// In der Praxis kann es passieren, dass die Parent-App den message-listener
// noch nicht registriert hat, während das iframe bereits synchron dieses
// Script ausführt. Dann geht "assetlab:ready" verloren -> Parent sendet
// nie "assetlab:init" -> wir haben kein Slot-Context ("no slot ctx").
//
// Fix:
// - ready wird erst nach DOMContentLoaded gesendet
// - ready wird kurz wiederholt, bis init eingegangen ist
// ---------------------------------------------------------------------------
let __initReceived = false;

function startReadyHandshake() {
  // einmal sofort (nach DOM ready)
  postToParent("assetlab:ready", { projectId });

  // dann wiederholen wir das "ready" ein paar Mal, bis init ankommt.
  let tries = 0;
  const maxTries = 20; // ~10s bei 500ms
  const iv = setInterval(() => {
    if (__initReceived) {
      clearInterval(iv);
      return;
    }
    tries++;
    postToParent("assetlab:ready", { projectId, retry: tries });
    if (tries >= maxTries) clearInterval(iv);
  }, 500);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", startReadyHandshake, { once: true });
} else {
  // DOM ist bereits ready (z.B. bei very-fast reload)
  startReadyHandshake();
}

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
// 2) Parent-Context + Restore
// =============================================================================

let currentContext = {
  projectId: projectId,
  projectAssetId: null,
  slotId: null,
  hasModel: false,
  lastImportName: null,
};

function hasValidSlotCtx(ctx) {
  return !!(ctx && ctx.projectAssetId && ctx.slotId);
}

// Host-Buffer-Fallback
let __pendingBufferReq = null;
function requestBufferFromParent(projectAssetId, slotId, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (__pendingBufferReq) return resolve(null);
    const t = setTimeout(() => { __pendingBufferReq = null; resolve(null); }, timeoutMs);
    __pendingBufferReq = { projectAssetId, slotId, done: (buf) => { clearTimeout(t); __pendingBufferReq = null; resolve(buf||null);} };
    postToParent("assetlab:reqBuffer", { projectAssetId, slotId });
  });
}

async function restoreFromIDB() {
  if (!hasValidSlotCtx(currentContext)) return false;

  const key = makeModelKey(currentContext.projectAssetId, currentContext.slotId);
  let rec = null;
  try {
    rec = await idbGet(key);
  } catch (e) {
    console.warn("[assetlab-lite] idbGet failed (will try host fallback)", e);
    rec = null;
  }

  if (!rec || !rec.buffer) {
    dlog("restore: nothing in idb for", key);

    try {
      const buf = await requestBufferFromParent(currentContext.projectAssetId, currentContext.slotId, 5000);
      if (buf) {
        await loadGLBBuffer(buf, currentContext.lastImportName || "restore.glb");
        setStatus("restore ok (host): model");
        return true;
      }
    } catch (e) {
      console.warn("[assetlab-lite] host restore failed", e);
    }

    return false;
  }

  await loadGLBBuffer(rec.buffer, rec.fileName || currentContext.lastImportName || "restore.glb");

  postToParent("assetlab:slotUpdate", {
    projectAssetId: currentContext.projectAssetId,
    slotId: currentContext.slotId,
    hasModel: true,
    fileName: rec.fileName || currentContext.lastImportName || "restore.glb",
    kind: "restore",
    updatedAt: rec.updatedAt || Date.now(),
    lastAction: "restore",
    exportRef: { kind: "idb", key },
  });

  setStatus(`restore ok: ${rec.fileName || "model"}`);
  return true;
}

window.addEventListener("message", async (ev) => {
  if (ev.origin !== window.location.origin) return;
  const data = ev.data || {};
  if (data.ns !== "assetlab") return;

  if (data.type === "assetlab:init") {
    currentContext = { ...currentContext, ...(data.payload || {}) };
    __initReceived = true;
    dlog("init ctx", currentContext);

    // Optionales Ack (Parent kann das ignorieren, hilft aber beim Debugging)
    postToParent("assetlab:init:ack", {
      projectId,
      projectAssetId: currentContext?.projectAssetId || null,
      slotId: currentContext?.slotId || null,
    });

    if (hasValidSlotCtx(currentContext) && currentContext.hasModel) {
      try { await restoreFromIDB(); } catch (e) { console.warn("[assetlab-lite] restore failed", e); }
    }
  }

  if (data.type === "assetlab:restore") {
    currentContext = { ...currentContext, ...(data.payload || {}) };
    dlog("restore cmd ctx", currentContext);
    try { await restoreFromIDB(); } catch (e) { console.warn("[assetlab-lite] restore failed", e); }
  }
});

// =============================================================================
// 3) Three.js Setup
// =============================================================================

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(0x0e0f12, 1);
viewportEl.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";

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

const grid = new THREE.GridHelper(10, 10, 0x2a2f38, 0x1a1f28);
grid.position.y = 0;
scene.add(grid);

const xform = new TransformControls(camera, renderer.domElement);
xform.addEventListener("dragging-changed", (ev) => { orbit.enabled = !ev.value; });
scene.add(xform);

// =============================================================================
// 4) Resize
// =============================================================================

function resize() {
  const w = viewportEl?.clientWidth || window.innerWidth;
  const h = viewportEl?.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// =============================================================================
// 5) Auswahl (Raycaster)
// =============================================================================

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let loadedRoot = null;
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
  if (!hits.length) { setSelected(null); return; }

  let o = hits[0].object;

  if (loadedRoot) {
    while (o && o.parent && o.parent !== loadedRoot && o.parent !== scene) o = o.parent;
  } else {
    while (o && o.parent && o.parent !== scene) o = o.parent;
  }

  setSelected(o);
}

let __down = null;
renderer.domElement.addEventListener("pointerdown", (ev) => {
  __down = { x: ev.clientX, y: ev.clientY };
}, { passive: true });

renderer.domElement.addEventListener("pointerup", (ev) => {
  if (!__down) return;
  if (xform.dragging) { __down = null; return; }

  const dx = Math.abs(ev.clientX - __down.x);
  const dy = Math.abs(ev.clientY - __down.y);
  const moved = (dx + dy) > 10;
  if (!moved) pick(ev.clientX, ev.clientY);

  __down = null;
}, { passive: true });

// =============================================================================
// 6) Loader Setup
// =============================================================================

const loader = new GLTFLoader();

try {
  const draco = new DRACOLoader();
  draco.setDecoderPath("../vendor/threejs-editor/examples/jsm/libs/draco/");
  loader.setDRACOLoader(draco);
} catch (e) { console.warn("[assetlab-lite] Draco init skipped:", e); }

try {
  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath("../vendor/threejs-editor/examples/jsm/libs/basis/");
  ktx2.detectSupport(renderer);
  loader.setKTX2Loader(ktx2);
} catch (e) { console.warn("[assetlab-lite] KTX2 init skipped:", e); }

// =============================================================================
// 7) Import + IDB Persist Slot
// =============================================================================

btnImport && (btnImport.onclick = () => fileInput?.click());

function disposeObject3D(root) {
  root?.traverse?.((n) => {
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
  camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.4, size * 0.6));
  camera.near = Math.max(0.01, size / 1000);
  camera.far = Math.max(5000, size * 10);
  camera.updateProjectionMatrix();
}

function loadGLBBuffer(buf, fileName = "model.glb") {
  return new Promise((resolve, reject) => {
    loader.parse(
      buf,
      "",
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0] || null;
        if (!root) { reject(new Error("GLB parse ok, aber keine Szene gefunden")); return; }

        if (loadedRoot) {
          scene.remove(loadedRoot);
          disposeObject3D(loadedRoot);
          loadedRoot = null;
          setSelected(null);
        }

        loadedRoot = root;
        scene.add(loadedRoot);
        fitCameraToObject(loadedRoot);

        resolve({ root: loadedRoot, fileName });
      },
      (err) => reject(err)
    );
  });
}

fileInput?.addEventListener("change", async () => {
  const f = fileInput.files?.[0];
  if (!f) return;

  try {
    setStatus("import…");

    const nameLower = (f.name || "").toLowerCase();

    if (nameLower.endsWith(".glb")) {
      const buf = await f.arrayBuffer();
      await loadGLBBuffer(buf, f.name);

      if (hasValidSlotCtx(currentContext)) {
        const key = makeModelKey(currentContext.projectAssetId, currentContext.slotId);
        await idbPut(key, { fileName: f.name, updatedAt: Date.now(), buffer: buf });

        currentContext.hasModel = true;
        currentContext.lastImportName = f.name;

        postToParent("assetlab:slotUpdate", {
          projectAssetId: currentContext.projectAssetId,
          slotId: currentContext.slotId,
          hasModel: true,
          fileName: f.name,
          updatedAt: Date.now(),
          lastAction: "import",
          exportRef: { kind: "idb", key },
          kind: "import",
        });

        setStatus("import ok");
      } else {
        setStatus("import ok (no slot ctx)");
      }

    } else if (nameLower.endsWith(".gltf")) {
      const url = URL.createObjectURL(f);

      loader.load(
        url,
        (gltf) => {
          URL.revokeObjectURL(url);

          if (loadedRoot) {
            scene.remove(loadedRoot);
            disposeObject3D(loadedRoot);
            loadedRoot = null;
            setSelected(null);
          }

          loadedRoot = gltf.scene || gltf.scenes?.[0] || null;
          if (!loadedRoot) { setStatus("import ERROR (no scene)"); return; }

          scene.add(loadedRoot);
          fitCameraToObject(loadedRoot);
          setStatus("import ok (gltf, no persist)");
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

  } catch (e) {
    console.error(e);
    setStatus("import ERROR");
  } finally {
    fileInput.value = "";
  }
});

// =============================================================================
// 8) Transform Mode Buttons
// =============================================================================

btnMove && (btnMove.onclick = () => xform.setMode("translate"));
btnRotate && (btnRotate.onclick = () => xform.setMode("rotate"));
btnScale && (btnScale.onclick = () => xform.setMode("scale"));

// =============================================================================
// 9) Export
// =============================================================================

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function doExport(mode) {
  setStatus(mode === "glb" ? "export glb…" : "export gltf…");

  const exporter = new GLTFExporter();
  const options = {
    binary: mode === "glb",
    trs: true,
    onlyVisible: false,
    truncateDrawRange: true,
    embedImages: mode === "glb",
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
}

btnExportGLB && (btnExportGLB.onclick = () => doExport("glb"));
btnExportGLTF && (btnExportGLTF.onclick = () => doExport("gltf"));

// =============================================================================
// 10) Reset
// =============================================================================

btnReset && (btnReset.onclick = () => {
  if (loadedRoot) {
    scene.remove(loadedRoot);
    disposeObject3D(loadedRoot);
  }
  loadedRoot = null;
  setSelected(null);

  orbit.target.set(0, 1, 0);
  camera.position.set(3, 2.2, 4);

  setStatus("reset");
});

// =============================================================================
// 11) Render Loop
// =============================================================================

function tick() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

setStatus("ready");
tick();
