/**
 * modules/assetlab3d/iframe/assetlab-lite.js
 * Version: v2.1.0-lite-viewer-hostbuffer-reqbuffer (2026-02-25)
 *
 * AssetLab 3D (Lite) — GH-Pages robust (iframe)
 * =============================================================================
 * Ziel:
 *  - Stabiler 3D-Viewer/Quick-Editor: Import + Transform + Export
 *  - Same-Origin Einbettung im Host (Baustellenplaner) via postMessage
 *  - Persistenz für Slots via IndexedDB (shared/idb-util.js)
 *
 * Parent -> iframe:
 *   { ns:"assetlab", type:"assetlab:init",     payload:{ projectId, projectAssetId, slotId, hasModel } }
 *   { ns:"assetlab", type:"assetlab:restore",  payload:{ projectId, projectAssetId, slotId, fileName?, lastImportName?, buffer? } }
 *   { ns:"assetlab", type:"assetlab:reqBuffer",payload:{ projectId, projectAssetId, slotId } }
 *
 * iframe -> Parent:
 *   { ns:"assetlab", type:"assetlab:ready",      payload:{ projectId } }
 *   { ns:"assetlab", type:"assetlab:log",        payload:{ msg } }
 *   { ns:"assetlab", type:"assetlab:slotUpdate", payload:{ projectId, projectAssetId, slotId, hasModel, lastImportName, updatedAt, lastAction, exportRef, kind, persisted, buffer? } }
 *   { ns:"assetlab", type:"assetlab:buffer",     payload:{ projectId, projectAssetId, slotId, fileName, updatedAt, buffer, bufferByteLength } }
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

// Robust URL-Fallback (falls Host init verliert)
const urlProjectAssetId = q.get("contextAssetId") || q.get("projectAssetId") || null;
const urlSlotId = q.get("slotId") || null;

const DEBUG = (q.get("debug") === "1" || q.get("debug") === "true");
function dlog(...args) { if (DEBUG) console.log("[assetlab-lite]", ...args); }

function nowISO() { return new Date().toISOString(); }
function safeString(v) { return (typeof v === "string") ? v : ""; }

function isArrayBufferLike(x) {
  return (x instanceof ArrayBuffer) || (x && typeof x.byteLength === "number" && typeof x.slice === "function");
}

/**
 * Capture a lightweight 2D thumbnail of the current renderer output.
 * - Project-bound + exportable: we store as dataUrl on the slot.
 * - iOS/Safari friendly: small PNG (default 256x256).
 * - If renderer/canvas is not ready, returns null (caller should tolerate).
 */
function captureThumbnailPng(size = 256) {
  try {
    if (!renderer || !renderer.domElement) return null;

    // Ensure we have at least one rendered frame
    try { renderer.render(scene, camera); } catch (_) {}

    const src = renderer.domElement;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return null;

    // Scale-fit the source canvas into our thumbnail canvas
    ctx.drawImage(src, 0, 0, c.width, c.height);

    const dataUrl = c.toDataURL("image/png");
    if (!dataUrl || typeof dataUrl !== "string") return null;

    return {
      mime: "image/png",
      dataUrl,
      w: size,
      h: size,
      updatedAt: nowISO(),
    };
  } catch (e) {
    console.warn("[assetlab-lite] captureThumbnailPng failed:", e);
    return null;
  }
}

// Safari/WebView File/Blob -> ArrayBuffer Fallback
async function blobToArrayBuffer(blob) {
  if (!blob) throw new Error("blobToArrayBuffer: no blob");
  if (typeof blob.arrayBuffer === "function") return await blob.arrayBuffer();
  if (typeof FileReader !== "undefined") {
    return await new Promise((resolve, reject) => {
      try {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(fr.error || new Error("FileReader error"));
        fr.readAsArrayBuffer(blob);
      } catch (e) {
        reject(e);
      }
    });
  }
  throw new Error("blobToArrayBuffer: no arrayBuffer() and no FileReader available");
}

function postToParent(type, payload, transfers) {
  const msg = { ns: "assetlab", type, payload: payload || null };
  const tr = Array.isArray(transfers) ? transfers : undefined;
  try {
    window.parent && window.parent.postMessage(msg, "*", tr);
  } catch (e) {
    // Fallback ohne Transferables
    try { window.parent && window.parent.postMessage(msg, "*"); } catch {}
  }
}

function setStatus(t) {
  const st = $("#st");
  if (st) st.textContent = t;
  postToParent("assetlab:log", { msg: String(t || "") });
}

const pidEl = $("#pid");
if (pidEl) pidEl.textContent = `Projekt: ${projectId}`;

// =============================================================================
// 1) Handshake ready/init (robust)
// =============================================================================

let __initReceived = false;

function startReadyHandshake() {
  postToParent("assetlab:ready", { projectId });
  let tries = 0;
  const maxTries = 20; // ~10s
  const iv = setInterval(() => {
    if (__initReceived) { clearInterval(iv); return; }
    tries++;
    postToParent("assetlab:ready", { projectId, retry: tries });
    if (tries >= maxTries) clearInterval(iv);
  }, 500);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", startReadyHandshake, { once: true });
} else {
  startReadyHandshake();
}

// =============================================================================
// 2) DOM-Refs
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
// 3) Slot Context + Pending Import Buffer (RAM)
// =============================================================================

let currentContext = {
  projectId,
  projectAssetId: urlProjectAssetId,
  slotId: urlSlotId,
  hasModel: false,
  lastImportName: "",
};

let pendingImport = null; // { buf:ArrayBuffer, fileName:string }

const __lastImport = {
  projectId: "",
  projectAssetId: "",
  slotId: "",
  fileName: "",
  buffer: null,
  updatedAt: "",
};

function cacheLastImport(ctx, buf, fileName) {
  __lastImport.projectId = ctx?.projectId || "";
  __lastImport.projectAssetId = ctx?.projectAssetId || "";
  __lastImport.slotId = ctx?.slotId || "";
  __lastImport.fileName = fileName || "";
  __lastImport.buffer = buf || null;
  __lastImport.updatedAt = nowISO();
}

function lastImportMatches(pid, aid, sid) {
  return (
    __lastImport.buffer &&
    __lastImport.projectId === (pid || "") &&
    __lastImport.projectAssetId === (aid || "") &&
    __lastImport.slotId === (sid || "")
  );
}

function hasValidSlotCtx(ctx) {
  return !!(ctx && ctx.projectAssetId && ctx.slotId);
}

// =============================================================================
// 4) Three.js Viewer Setup
// =============================================================================

let renderer = null;
let scene = null;
let camera = null;
let orbit = null;
let tctrl = null;

let rootGroup = null;    // enthält das geladene Modell
let activeObject = null; // fürs TransformControls

const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
const ktx2Loader = new KTX2Loader();

function initThreeIfNeeded() {
  if (renderer) return;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(viewportEl.clientWidth, viewportEl.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewportEl.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();

  // Light
  const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1.0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(5, 8, 6);
  scene.add(dir);

  // Camera
  camera = new THREE.PerspectiveCamera(45, viewportEl.clientWidth / viewportEl.clientHeight, 0.01, 1000);
  camera.position.set(2.5, 2.2, 2.8);

  // Controls
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;

  tctrl = new TransformControls(camera, renderer.domElement);
  tctrl.addEventListener("dragging-changed", (e) => {
    orbit.enabled = !e.value;
  });
  scene.add(tctrl);

  rootGroup = new THREE.Group();
  scene.add(rootGroup);

  // Loaders Setup
  dracoLoader.setDecoderPath("../vendor/threejs-editor/examples/jsm/libs/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);

  ktx2Loader.setTranscoderPath("../vendor/threejs-editor/examples/jsm/libs/basis/");
  ktx2Loader.detectSupport(renderer);
  gltfLoader.setKTX2Loader(ktx2Loader);

  // Resize
  window.addEventListener("resize", () => {
    if (!renderer || !camera) return;
    const w = viewportEl.clientWidth;
    const h = viewportEl.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  // Render loop
  const tick = () => {
    requestAnimationFrame(tick);
    if (orbit) orbit.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
  };
  tick();
}

function clearModel() {
  if (!rootGroup) return;
  tctrl.detach();
  activeObject = null;

  // Dispose meshes/materials/textures (basic)
  rootGroup.traverse((obj) => {
    if (obj && obj.isMesh) {
      if (obj.geometry) obj.geometry.dispose();
      const m = obj.material;
      if (Array.isArray(m)) m.forEach(mm => mm && mm.dispose && mm.dispose());
      else if (m && m.dispose) m.dispose();
    }
  });

  while (rootGroup.children.length) rootGroup.remove(rootGroup.children[0]);
}

function fitCameraToObject(obj) {
  if (!obj || !camera || !orbit) return;

  const box = new THREE.Box3().setFromObject(obj);
  if (!box.isEmpty()) {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.6;

    camera.position.set(center.x + cameraZ, center.y + cameraZ * 0.6, center.z + cameraZ);
    camera.near = Math.max(0.01, cameraZ / 100);
    camera.far = Math.max(1000, cameraZ * 10);
    camera.updateProjectionMatrix();

    orbit.target.copy(center);
    orbit.update();
  }
}

async function loadGLBBuffer(buf, fileName) {
  initThreeIfNeeded();
  clearModel();

  const blob = new Blob([buf], { type: "model/gltf-binary" });
  const url = URL.createObjectURL(blob);

  try {
    const gltf = await new Promise((resolve, reject) => {
      gltfLoader.load(url, resolve, undefined, reject);
    });

    const model = gltf.scene || gltf.scenes?.[0];
    if (!model) throw new Error("GLTF loaded but scene missing");

    rootGroup.add(model);
    activeObject = model;
    tctrl.attach(model);

    fitCameraToObject(model);

    setStatus(`model loaded: ${fileName || "import.glb"}`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// =============================================================================
// 5) Import / Persist / SlotUpdate
// =============================================================================

async function persistAndNotifyHost(buf, fileName) {
  if (!buf) return;

  if (!hasValidSlotCtx(currentContext)) {
    pendingImport = { buf, fileName };
    setStatus("import ok (pending ctx)");
    return;
  }

  const key = makeModelKey(currentContext.projectAssetId, currentContext.slotId);
  let persisted = false;
  let exportRef = null;

  try {
    await idbPut(key, { fileName: fileName || "", updatedAt: nowISO(), buffer: buf });
    persisted = true;
    exportRef = { kind: "idb", key, bytes: buf.byteLength };
    setStatus("import ok (persisted)");
  } catch (e) {
    // iOS/Safari: IDB kann in iframes gelegentlich fehlschlagen -> Host persist
    persisted = false;
    exportRef = { kind: "memory", bytes: buf.byteLength, note: String(e?.message || e) };
    setStatus("import ok (no persist)");
  }

  // SlotUpdate
  const payload = {
    projectId: currentContext.projectId || projectId,
    projectAssetId: currentContext.projectAssetId,
    slotId: currentContext.slotId,
    hasModel: true,
    lastImportName: fileName || "",
    updatedAt: nowISO(),
    lastAction: persisted ? "import" : "import (no persist)",
    exportRef,
    kind: "import",
    persisted,
  };

  // NEW: lightweight preview thumbnail (project-bound, exportable)
  const thumb = captureThumbnailPng(256);
  if (thumb) payload.thumbnail = thumb;


  // Wenn nicht persistiert, schicken wir den Buffer als Transferable an den Host
  if (!persisted) {
    payload.buffer = buf; // Transferable
    postToParent("assetlab:slotUpdate", payload, [buf]);
  } else {
    postToParent("assetlab:slotUpdate", payload);
  }
}

async function handleFileSelected(file) {
  if (!file) return;

  const fileName = safeString(file.name || "import.glb");
  const lower = fileName.toLowerCase();

  try {
    const buf = await blobToArrayBuffer(file);
    if (!(buf instanceof ArrayBuffer)) throw new Error("import buffer not ArrayBuffer");

    if (lower.endsWith(".glb") || lower.endsWith(".gltf")) {
      await loadGLBBuffer(buf, fileName);
      cacheLastImport(currentContext, buf, fileName);
      await persistAndNotifyHost(buf, fileName);
      return;
    }

    setStatus("import ERROR: unsupported file type");
  } catch (e) {
    console.error("[assetlab-lite] import failed", e);
    setStatus(`import ERROR: ${String(e?.message || e)}`);
  }
}

// =============================================================================
// 6) Restore + reqBuffer Support
// =============================================================================

async function restoreFromIDB() {
  if (!hasValidSlotCtx(currentContext)) return false;

  const key = makeModelKey(currentContext.projectAssetId, currentContext.slotId);
  const rec = await idbGet(key);

  if (!rec || !rec.buffer) {
    dlog("restore: nothing in idb for", key);
    return false;
  }

  await loadGLBBuffer(rec.buffer, rec.fileName || currentContext.lastImportName || "restore.glb");

  postToParent("assetlab:slotUpdate", {
    projectId: currentContext.projectId || projectId,
    projectAssetId: currentContext.projectAssetId,
    slotId: currentContext.slotId,
    hasModel: true,
    lastImportName: rec.fileName || currentContext.lastImportName || "restore.glb",
    kind: "restore",
    updatedAt: (typeof rec.updatedAt === "string" && rec.updatedAt) ? rec.updatedAt : nowISO(),
    lastAction: "restore",
    exportRef: { kind: "idb", key },
    persisted: true,
  });

  setStatus(`restore ok: ${rec.fileName || "model"}`);
  return true;
}

async function handleRestore(payload) {
  if (!payload) return;

  const pid = payload.projectId || projectId;
  const aid = payload.projectAssetId || null;
  const sid = payload.slotId || null;

  currentContext = {
    ...currentContext,
    projectId: pid,
    projectAssetId: aid,
    slotId: sid,
    hasModel: !!payload.hasModel,
    lastImportName: safeString(payload.lastImportName || payload.fileName || ""),
  };

  // 1) Wenn Host bereits Buffer liefert -> DIREKT laden
  if (isArrayBufferLike(payload.buffer)) {
    try {
      const fileName = safeString(payload.fileName || payload.lastImportName || "restored.glb");
      const buf = payload.buffer;
      await loadGLBBuffer(buf, fileName);
      cacheLastImport(currentContext, buf, fileName);
      setStatus("restore ok (host buffer)");
      return true;
    } catch (e) {
      console.warn("[assetlab-lite] restore (host buffer) failed", e);
      setStatus(`restore ERROR (host buffer): ${String(e?.message || e)}`);
      // fallback to IDB below
    }
  }

  // 2) Fallback: iframe IDB
  try {
    const ok = await restoreFromIDB();
    if (ok) return true;
  } catch (e) {
    // ignore
  }

  setStatus("restore miss");
  return false;
}

async function handleReqBuffer(payload) {
  const pid = payload?.projectId || currentContext?.projectId || projectId;
  const aid = payload?.projectAssetId || currentContext?.projectAssetId || "";
  const sid = payload?.slotId || currentContext?.slotId || "";

  if (!pid || !aid || !sid) return;

  // 1) RAM-Buffer aus letztem Import
  if (lastImportMatches(pid, aid, sid) && __lastImport.buffer) {
    const hostBuf = __lastImport.buffer.slice(0);
    postToParent(
      "assetlab:buffer",
      {
        projectId: pid,
        projectAssetId: aid,
        slotId: sid,
        fileName: __lastImport.fileName || "import.glb",
        updatedAt: __lastImport.updatedAt || nowISO(),
        buffer: hostBuf,
        bufferByteLength: hostBuf.byteLength,
      },
      [hostBuf]
    );
    setStatus("reqBuffer -> sent RAM buffer");
    return;
  }

  // 2) IDB lesen (iframe)
  try {
    const key = makeModelKey(aid, sid);
    const rec = await idbGet(key);
    if (rec && isArrayBufferLike(rec.buffer)) {
      const hostBuf = rec.buffer.slice(0);
      postToParent(
        "assetlab:buffer",
        {
          projectId: pid,
          projectAssetId: aid,
          slotId: sid,
          fileName: safeString(rec.fileName || "restored.glb"),
          updatedAt: safeString(rec.updatedAt || nowISO()),
          buffer: hostBuf,
          bufferByteLength: hostBuf.byteLength,
        },
        [hostBuf]
      );
      setStatus("reqBuffer -> sent IDB buffer");
      return;
    }
  } catch (e) {
    // ignore
  }

  setStatus("reqBuffer -> no buffer available");
}

// =============================================================================
// 7) UI Wiring
// =============================================================================

function wireUi() {
  // Import
  if (btnImport && fileInput) {
    btnImport.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = (fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;
      fileInput.value = "";
      await handleFileSelected(file);
    });
  }

  // Transform Mode Buttons
  const setMode = (mode) => {
    if (!tctrl) return;
    if (mode === "move") tctrl.setMode("translate");
    if (mode === "rotate") tctrl.setMode("rotate");
    if (mode === "scale") tctrl.setMode("scale");
    setStatus(`mode: ${mode}`);
  };

  btnMove && btnMove.addEventListener("click", () => setMode("move"));
  btnRotate && btnRotate.addEventListener("click", () => setMode("rotate"));
  btnScale && btnScale.addEventListener("click", () => setMode("scale"));

  // Reset
  btnReset && btnReset.addEventListener("click", () => {
    try {
      if (activeObject) {
        activeObject.position.set(0, 0, 0);
        activeObject.rotation.set(0, 0, 0);
        activeObject.scale.set(1, 1, 1);
        setStatus("reset ok");
      }
    } catch (e) {
      setStatus(`reset ERROR: ${String(e?.message || e)}`);
    }
  });

  // Export
  const exporter = new GLTFExporter();

  function exportBinary() {
    if (!rootGroup || rootGroup.children.length === 0) {
      setStatus("export: no model");
      return;
    }
    const sceneToExport = rootGroup.children[0];

    exporter.parse(
      sceneToExport,
      (res) => {
        try {
          const blob = new Blob([res], { type: "model/gltf-binary" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = (currentContext?.lastImportName || "export.glb").replace(/\.(gltf|glb)$/i, ".glb");
          a.click();
          URL.revokeObjectURL(url);
          setStatus("export glb ok");
        } catch (e) {
          setStatus(`export ERROR: ${String(e?.message || e)}`);
        }
      },
      (err) => setStatus(`export ERROR: ${String(err?.message || err)}`),
      { binary: true }
    );
  }

  function exportGltf() {
    if (!rootGroup || rootGroup.children.length === 0) {
      setStatus("export: no model");
      return;
    }
    const sceneToExport = rootGroup.children[0];

    exporter.parse(
      sceneToExport,
      (res) => {
        try {
          const json = JSON.stringify(res, null, 2);
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = (currentContext?.lastImportName || "export.gltf").replace(/\.(gltf|glb)$/i, ".gltf");
          a.click();
          URL.revokeObjectURL(url);
          setStatus("export gltf ok");
        } catch (e) {
          setStatus(`export ERROR: ${String(e?.message || e)}`);
        }
      },
      (err) => setStatus(`export ERROR: ${String(err?.message || err)}`),
      { binary: false }
    );
  }

  btnExportGLB && btnExportGLB.addEventListener("click", exportBinary);
  btnExportGLTF && btnExportGLTF.addEventListener("click", exportGltf);

  // Draco Toggle (optional)
  if (chkDraco) {
    chkDraco.addEventListener("change", () => {
      const use = !!chkDraco.checked;
      // (Nur Info – Encoder im Export wäre ein eigenes Thema)
      setStatus(use ? "draco: ON (exp.)" : "draco: OFF");
    });
  }
}

wireUi();
initThreeIfNeeded();
setStatus("ready");

// =============================================================================
// 8) Host Message Listener
// =============================================================================

window.addEventListener("message", async (ev) => {
  // Same-origin guard (Host ist bei dir same-origin GH-Pages)
  // -> wenn du es mal cross-origin nutzt, musst du das lockern.
  if (ev.origin !== window.location.origin) return;

  const data = ev.data || {};
  if (data.ns !== "assetlab") return;

  const type = data.type;
  const payload = data.payload || null;

  if (type === "assetlab:init") {
    currentContext = { ...currentContext, ...(payload || {}) };
    __initReceived = true;
    dlog("init ctx", currentContext);

    postToParent("assetlab:init:ack", { ok: true, at: nowISO() });

    // Wenn wir vorher importiert haben, aber kein ctx hatten -> jetzt persist + slotUpdate auslösen
    if (pendingImport && pendingImport.buf) {
      const { buf, fileName } = pendingImport;
      pendingImport = null;
      cacheLastImport(currentContext, buf, fileName);
      await persistAndNotifyHost(buf, fileName);
    }

    // Wenn Host sagt: hasModel -> versuchen wir zu restoren
    if (currentContext?.hasModel) {
      try { await restoreFromIDB(); } catch {}
    }
    return;
  }

  if (type === "assetlab:restore") {
    await handleRestore(payload);
    return;
  }

  if (type === "assetlab:reqBuffer") {
    await handleReqBuffer(payload);
    return;
  }
});
