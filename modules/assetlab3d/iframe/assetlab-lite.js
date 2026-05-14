/**
 * modules/assetlab3d/iframe/assetlab-lite.js
 * Version: v2.5.0-lite-geometrylab-draw-takeover (2026-05-14)
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
import { analyzeCmoBuffer, cmoThumbnailToDataUrl, detectCmo, formatCmoSummary } from "../../geometrylab/importers/cmo-reader.js";
import { buildCmoPreviewObject, formatCmoMeshSummary } from "../../geometrylab/importers/cmo-to-mesh.js";
import { buildExtrudedPolygonObject, formatDrawExtrudeSummary, sanitizeDrawPoints } from "../../geometrylab/core/draw-extrude.js";

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
const btnCmoTakeover = $("#btnCmoTakeover");
const btnExportGLTF = $("#btnExportGLTF");

const btnGeomDraw = $("#btnGeomDraw");
const btnGeomClose = $("#btnGeomClose");
const btnGeomTakeover = $("#btnGeomTakeover");
const btnGeomReset = $("#btnGeomReset");
const geomHeightInput = $("#geomHeight");
const geomPanel = $("#geomPanel");
const geomInfo = $("#geomInfo");

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

// Step 3: letzter gültiger CMO-Preview-Stand.
// Dieser Zustand ist bewusst RAM-only, bis der Benutzer aktiv
// „CMO als GLB übernehmen“ klickt. Erst dann wird hasModel=true gesetzt.
let currentCmoPreview = null; // { buf:ArrayBuffer, fileName:string, report, parsed }

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
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); // IMPORTANT: needed for reliable thumbnails on iOS/Safari/WebGL
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

  // GeometryLab Draw/Extrude Step 1: Pointer-Punkte auf X/Z-Bodenebene setzen.
  renderer.domElement.addEventListener("pointerdown", handleGeometryDrawPointerDown, { passive: false });
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


// =============================================================================
// 4.5) GeometryLab Draw/Extrude Preview (Step 1)
// =============================================================================

const geometryDrawState = {
  enabled: false,
  points: [],
  helperGroup: null,
  previewGroup: null,
  lastPreview: null,
};

function readGeometryHeight() {
  const n = Number(geomHeightInput?.value || 1);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

function setGeometryInfo(text) {
  if (geomInfo) geomInfo.textContent = text || "";
  if (geomPanel) geomPanel.hidden = !geometryDrawState.enabled;
}

function updateGeometryTakeoverButton() {
  if (!btnGeomTakeover) return;
  const canTakeover = !!(geometryDrawState.lastPreview?.ok && geometryDrawState.lastPreview?.object3d);
  btnGeomTakeover.disabled = !canTakeover;
  btnGeomTakeover.title = canTakeover
    ? "Diese GeometryLab-Preview als echtes GLB-Projektmodell speichern"
    : "Erst eine gültige Extrude Preview erzeugen";
}

function ensureGeometryHelperGroup() {
  initThreeIfNeeded();
  if (geometryDrawState.helperGroup) return geometryDrawState.helperGroup;
  const g = new THREE.Group();
  g.name = "GeometryLab Draw Helpers";
  rootGroup.add(g);
  geometryDrawState.helperGroup = g;
  return g;
}

function disposeObjectTree(obj) {
  if (!obj) return;
  obj.traverse?.((node) => {
    if (node?.isMesh || node?.isLine || node?.isPoints) {
      if (node.geometry?.dispose) node.geometry.dispose();
      const mat = node.material;
      if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.());
      else mat?.dispose?.();
    }
  });
}

function removeGeometryPreviewOnly() {
  if (geometryDrawState.previewGroup) {
    try { tctrl?.detach?.(); } catch (_) {}
    rootGroup?.remove?.(geometryDrawState.previewGroup);
    disposeObjectTree(geometryDrawState.previewGroup);
  }
  geometryDrawState.previewGroup = null;
  geometryDrawState.lastPreview = null;
  updateGeometryTakeoverButton();
}

function refreshGeometryHelpers() {
  const helper = ensureGeometryHelperGroup();
  while (helper.children.length) {
    const child = helper.children.pop();
    disposeObjectTree(child);
  }

  const pts = sanitizeDrawPoints(geometryDrawState.points);

  // Kleine Punktmarker auf der Bodenebene.
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 8),
      new THREE.MeshBasicMaterial()
    );
    marker.name = `GeometryLab Punkt ${i + 1}`;
    marker.position.set(p.x, 0.015, p.z);
    helper.add(marker);
  }

  // Polyline inklusive Vorschau-Schlusskante, sobald mindestens 2 Punkte da sind.
  if (pts.length >= 2) {
    const vertices = [];
    for (const p of pts) vertices.push(p.x, 0.025, p.z);
    if (pts.length >= 3) vertices.push(pts[0].x, 0.025, pts[0].z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial()
    );
    line.name = "GeometryLab Kontur-Linie";
    helper.add(line);
  }

  setGeometryInfo(
    pts.length < 3
      ? `Zeichenmodus aktiv · ${pts.length} Punkt(e). Mindestens 3 Punkte setzen, dann „Extrude Preview“. `
      : `Zeichenmodus aktiv · ${pts.length} Punkt(e). „Extrude Preview“ erzeugt eine 3D-Vorschau. `
  );
}

function startGeometryDrawMode() {
  initThreeIfNeeded();

  // Für den ersten Step ist das Zeichenwerkzeug bewusst ein eigener sauberer
  // Preview-Zustand. Darum räumen wir importierte Preview-/Modellreste weg.
  clearModel();
  currentCmoPreview = null;
  if (btnCmoTakeover) btnCmoTakeover.disabled = true;

  geometryDrawState.enabled = true;
  geometryDrawState.points = [];
  geometryDrawState.helperGroup = null;
  geometryDrawState.previewGroup = null;
  geometryDrawState.lastPreview = null;
  updateGeometryTakeoverButton();

  if (orbit) orbit.enabled = false;
  if (geomPanel) geomPanel.hidden = false;
  refreshGeometryHelpers();
  setStatus("GeometryLab: Zeichenmodus aktiv — auf die Bodenfläche tippen/klicken");
}

function stopGeometryDrawMode() {
  geometryDrawState.enabled = false;
  if (orbit) orbit.enabled = true;
  if (geomPanel) geomPanel.hidden = true;
}

function resetGeometryDrawMode({ keepMode = true } = {}) {
  try { tctrl?.detach?.(); } catch (_) {}
  removeGeometryPreviewOnly();
  if (geometryDrawState.helperGroup) {
    rootGroup?.remove?.(geometryDrawState.helperGroup);
    disposeObjectTree(geometryDrawState.helperGroup);
  }
  geometryDrawState.helperGroup = null;
  geometryDrawState.points = [];
  geometryDrawState.lastPreview = null;
  updateGeometryTakeoverButton();
  activeObject = null;
  if (!keepMode) stopGeometryDrawMode();
  else refreshGeometryHelpers();
  setStatus(keepMode ? "GeometryLab: Zeichnung gelöscht" : "GeometryLab: Zeichenmodus beendet");
}

function getDrawPlanePointFromEvent(ev) {
  if (!renderer || !camera) return null;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Bodenebene Y=0
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(plane, hit);
  if (!ok) return null;

  // Kleine Rasterung für iPad-Bedienung. Das ist noch nicht das finale Workarea-
  // Snap-System, verhindert aber krumme Testwerte im ersten Preview-Schritt.
  const snap = 0.1;
  return {
    x: Math.round(hit.x / snap) * snap,
    z: Math.round(hit.z / snap) * snap,
  };
}

function handleGeometryDrawPointerDown(ev) {
  if (!geometryDrawState.enabled) return;
  if (!renderer || ev.target !== renderer.domElement) return;

  // TransformControls soll nicht gleichzeitig ziehen, während Punkte gesetzt werden.
  ev.preventDefault();
  ev.stopPropagation();

  const p = getDrawPlanePointFromEvent(ev);
  if (!p) {
    setStatus("GeometryLab: kein Schnittpunkt mit Bodenebene gefunden");
    return;
  }

  geometryDrawState.points.push(p);
  refreshGeometryHelpers();
  setStatus(`GeometryLab: Punkt ${geometryDrawState.points.length} gesetzt (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
}

function buildGeometryExtrudePreview() {
  initThreeIfNeeded();
  removeGeometryPreviewOnly();

  const pts = sanitizeDrawPoints(geometryDrawState.points);
  const result = buildExtrudedPolygonObject(THREE, pts, {
    height: readGeometryHeight(),
    name: "GeometryLab Draw Extrude Preview",
  });

  if (!result.ok) {
    setGeometryInfo(result.error || "Keine gültige Kontur");
    updateGeometryTakeoverButton();
    setStatus(`GeometryLab Preview ERROR: ${result.error || "ungültige Kontur"}`);
    return;
  }

  geometryDrawState.previewGroup = result.object3d;
  geometryDrawState.lastPreview = result;
  updateGeometryTakeoverButton();
  rootGroup.add(result.object3d);
  activeObject = result.object3d;
  try { tctrl?.attach?.(result.object3d); } catch (_) {}
  fitCameraToObject(result.object3d);

  const summary = formatDrawExtrudeSummary(result);
  setGeometryInfo(`${summary} · Preview-only. Zum Speichern „Zeichnung als GLB übernehmen“ klicken.`);
  setStatus(`${summary} · Preview-only: Zum Speichern „Zeichnung als GLB übernehmen“ klicken`);
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


/**
 * CMO Mesh-Preview (Step 2)
 * --------------------------------------------------------------------------
 * Diese Funktion versucht nach der Analyse jetzt auch eine echte Preview-
 * Geometrie aus POINTS/FACETS aufzubauen. Sie bleibt aber bewusst Preview-only:
 * - kein IDB-Speichern
 * - kein assetlab:slotUpdate
 * - kein hasModel=true
 * - kein lastImportName im ProjectAsset
 *
 * Erst wenn diese Vorschau in mehreren Testdateien stimmt, folgt Step 3:
 * Export/Speichern als GLB.
 */
async function loadCmoAnalysisPreview(buf, fileName) {
  initThreeIfNeeded();
  clearModel();

  const report = analyzeCmoBuffer(buf);
  if (!report.ok) throw new Error("CMO signature not detected");

  let preview = null;
  try {
    preview = buildCmoPreviewObject(THREE, buf, {
      name: `CMO Mesh Preview: ${fileName || "import.cmo"}`,
      addAxes: true,
    });
  } catch (e) {
    console.warn("[assetlab-lite] CMO mesh preview failed, falling back to analysis placeholder", e);
    preview = null;
  }

  let group = null;
  let meshSummary = "";

  if (preview?.ok && preview.object3d) {
    group = preview.object3d;
    group.userData.cmoAnalysis = report;
    meshSummary = formatCmoMeshSummary(preview.parsed);
  } else {
    group = new THREE.Group();
    group.name = `CMO Analyse: ${fileName || "import.cmo"}`;

    // Fallback-Platzhalter: Wird verwendet, wenn die Geometrie noch nicht
    // dekodierbar ist. Auch dann bleibt der Slot bewusst leer/hasModel=false.
    const boxGeo = new THREE.BoxGeometry(1.6, 0.12, 1.0);
    const boxMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.05 });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.name = "CMO Analyse Placeholder";
    group.add(box);
  }

  // Das eingebettete Thumbnail bleibt als kleine Debug-Karte erhalten. Bei echter
  // Mesh-Preview setzen wir es seitlich neben das Modell, damit man sofort sieht,
  // ob Preview und CMO-Vorschaubild ungefähr zusammenpassen.
  const thumbUrl = cmoThumbnailToDataUrl(buf);
  if (thumbUrl) {
    const tex = await new Promise((resolve) => {
      new THREE.TextureLoader().load(thumbUrl, resolve, undefined, () => resolve(null));
    });
    if (tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(120, 90),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
      );
      plane.name = "CMO eingebettetes Thumbnail (Debug)";
      plane.position.set(0, 10, 0);
      plane.rotation.x = -Math.PI / 2;

      if (preview?.parsed?.bounds?.max) {
        const b = preview.parsed.bounds;
        const sx = Math.max(120, Math.abs(b.size?.[0] || 0) * 0.35);
        plane.position.set((b.max[0] || 0) + sx, (b.max[1] || 0) + 10, b.center?.[2] || 0);
      }
      group.add(plane);
    }
  }

  group.userData.cmoAnalysis = report;
  rootGroup.add(group);
  activeObject = group;
  tctrl.attach(group);
  fitCameraToObject(group);

  const summary = formatCmoSummary(report);
  console.info("[assetlab-lite] CMO analysis", report);
  if (preview?.parsed) console.info("[assetlab-lite] CMO mesh preview", preview.parsed);

  if (preview?.ok) {
    currentCmoPreview = {
      buf: buf.slice ? buf.slice(0) : buf,
      fileName: fileName || "import.cmo",
      report,
      parsed: preview?.parsed || null,
    };
    if (btnCmoTakeover) {
      btnCmoTakeover.disabled = false;
      btnCmoTakeover.title = "Diese CMO-Preview als echtes GLB-Projektmodell speichern";
    }
    setStatus(`${summary} · ${meshSummary} · Preview-only: Zum Speichern „CMO als GLB übernehmen“ klicken`);
  } else {
    currentCmoPreview = null;
    if (btnCmoTakeover) {
      btnCmoTakeover.disabled = true;
      btnCmoTakeover.title = "Keine gültige CMO-Mesh-Preview vorhanden";
    }
    setStatus(`${summary} · Analyse-only, Mesh-Preview noch nicht möglich, kein GLB-Modell gespeichert`);
  }

  postToParent("assetlab:cmoAnalysis", {
    projectId: currentContext.projectId || projectId,
    projectAssetId: currentContext.projectAssetId,
    slotId: currentContext.slotId,
    fileName: fileName || "",
    updatedAt: nowISO(),
    report,
    meshPreview: preview?.parsed || null,
  });
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

    if (geometryDrawState.enabled || geometryDrawState.points.length || geometryDrawState.previewGroup) {
      resetGeometryDrawMode({ keepMode: false });
    }

    if (lower.endsWith(".glb") || lower.endsWith(".gltf")) {
      currentCmoPreview = null;
      await loadGLBBuffer(buf, fileName);
      cacheLastImport(currentContext, buf, fileName);
      await persistAndNotifyHost(buf, fileName);
      return;
    }

    if (lower.endsWith(".cmo") || detectCmo(buf)) {
      await loadCmoAnalysisPreview(buf, fileName);
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

  // SlotUpdate (restore)
const payload = {
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
};

// NEW: generate thumbnail on restore as well (project-bound, exportable)
const thumb = captureThumbnailPng(256);
if (thumb) payload.thumbnail = thumb;

postToParent("assetlab:slotUpdate", payload);

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
      // NEW: notify host about restore as well, incl. thumbnail (so slot.thumbnail gets filled)
try {
  const payload2 = {
    projectId: currentContext.projectId || projectId,
    projectAssetId: currentContext.projectAssetId,
    slotId: currentContext.slotId,
    hasModel: true,
    lastImportName: fileName,
    kind: "restore",
    updatedAt: nowISO(),
    lastAction: "restore (host buffer)",
    exportRef: { kind: "host", bytes: (buf && buf.byteLength) ? buf.byteLength : 0 },
    persisted: true,
  };
  const thumb2 = captureThumbnailPng(256);
  if (thumb2) payload2.thumbnail = thumb2;
  postToParent("assetlab:slotUpdate", payload2);
} catch (_) {}
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
        // Optional: include latest thumbnail so Host can paint cards even after reqBuffer
        thumbnail: captureThumbnailPng(256) || null,
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
          // Optional: include latest thumbnail so Host can paint cards even after reqBuffer
          thumbnail: captureThumbnailPng(256) || null,
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
// 6.5) CMO Preview -> echtes GLB/Slot-Modell übernehmen (Step 3)
// =============================================================================

function makeConvertedCmoFileName(fileName) {
  const base = safeString(fileName || "import.cmo") || "import.cmo";
  if (/\.cmo$/i.test(base)) return base.replace(/\.cmo$/i, ".converted.glb");
  if (/\.(gltf|glb)$/i.test(base)) return base.replace(/\.(gltf|glb)$/i, ".converted.glb");
  return `${base}.converted.glb`;
}

function exportObjectToGlbBuffer(object3d, options = {}) {
  const exporter = new GLTFExporter();
  const opts = { binary: true, trs: false, onlyVisible: true, ...options };

  return new Promise((resolve, reject) => {
    try {
      exporter.parse(
        object3d,
        (res) => {
          try {
            if (res instanceof ArrayBuffer) return resolve(res);
            if (ArrayBuffer.isView(res)) return resolve(res.buffer.slice(res.byteOffset, res.byteOffset + res.byteLength));
            reject(new Error("GLTFExporter returned non-binary result"));
          } catch (e) {
            reject(e);
          }
        },
        (err) => reject(err instanceof Error ? err : new Error(String(err?.message || err))),
        opts
      );
    } catch (e) {
      reject(e);
    }
  });
}

async function takeoverCurrentCmoPreviewAsGlb() {
  if (!currentCmoPreview?.buf) {
    setStatus("CMO übernehmen: keine aktive Mesh-Preview");
    return;
  }

  if (!hasValidSlotCtx(currentContext)) {
    setStatus("CMO übernehmen ERROR: kein Projekt-Asset/Slot-Kontext");
    return;
  }

  try {
    if (btnCmoTakeover) btnCmoTakeover.disabled = true;
    setStatus("CMO übernehmen: GLB wird erzeugt …");

    // Wichtig: Für das gespeicherte Modell bauen wir eine saubere Export-Version:
    // - keine Debug-Achsen
    // - keine Wireframe-Hilfsmeshes
    // - kein eingebettetes Thumbnail-Plane
    const cleanPreview = buildCmoPreviewObject(THREE, currentCmoPreview.buf, {
      name: `CMO Converted GLB: ${currentCmoPreview.fileName || "import.cmo"}`,
      addAxes: false,
      addWireframe: false,
    });

    if (!cleanPreview?.ok || !cleanPreview.object3d) {
      throw new Error("CMO Mesh-Preview konnte nicht als sauberes Export-Objekt gebaut werden");
    }

    const glbBuffer = await exportObjectToGlbBuffer(cleanPreview.object3d, { binary: true });
    const outName = makeConvertedCmoFileName(currentCmoPreview.fileName);

    // Direkt danach das erzeugte GLB im Viewer laden. Dadurch sieht der Nutzer
    // exakt das Modell, das gleich im Slot landet; außerdem erzeugt
    // captureThumbnailPng() danach ein Thumbnail vom übernommenen GLB.
    await loadGLBBuffer(glbBuffer.slice ? glbBuffer.slice(0) : glbBuffer, outName);
    cacheLastImport(currentContext, glbBuffer.slice ? glbBuffer.slice(0) : glbBuffer, outName);
    await persistAndNotifyHost(glbBuffer, outName);

    currentCmoPreview = null;
    setStatus(`CMO als GLB übernommen: ${outName}`);
  } catch (e) {
    console.error("[assetlab-lite] CMO takeover failed", e);
    setStatus(`CMO übernehmen ERROR: ${String(e?.message || e)}`);
  } finally {
    if (btnCmoTakeover) btnCmoTakeover.disabled = !currentCmoPreview?.buf;
  }
}


// =============================================================================
// 6.6) GeometryLab Draw/Extrude Preview -> echtes GLB/Slot-Modell übernehmen
// =============================================================================

function makeGeometryExtrudeFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `geometrylab-extrude-${stamp}.glb`;
}

async function takeoverCurrentGeometryPreviewAsGlb() {
  if (!geometryDrawState.lastPreview?.ok || !geometryDrawState.lastPreview?.object3d) {
    setStatus("GeometryLab übernehmen: keine gültige Extrude Preview");
    updateGeometryTakeoverButton();
    return;
  }

  if (!hasValidSlotCtx(currentContext)) {
    setStatus("GeometryLab übernehmen ERROR: kein Projekt-Asset/Slot-Kontext");
    return;
  }

  try {
    if (btnGeomTakeover) btnGeomTakeover.disabled = true;
    setStatus("GeometryLab übernehmen: GLB wird erzeugt …");

    const cleanPoints = sanitizeDrawPoints(geometryDrawState.points);
    const cleanExport = buildExtrudedPolygonObject(THREE, cleanPoints, {
      height: readGeometryHeight(),
      name: "GeometryLab Draw Extrude GLB",
    });

    if (!cleanExport?.ok || !cleanExport.object3d) {
      throw new Error(cleanExport?.error || "GeometryLab Export-Objekt konnte nicht gebaut werden");
    }

    // Metadaten bleiben im GLB erhalten und helfen später beim Bearbeiten/Erkennen.
    cleanExport.object3d.userData.geometryLab = {
      ...(cleanExport.object3d.userData.geometryLab || {}),
      source: "draw-extrude",
      exportedAt: nowISO(),
      pointCount: cleanExport.pointCount,
      height: cleanExport.height,
    };

    const glbBuffer = await exportObjectToGlbBuffer(cleanExport.object3d, { binary: true });
    const outName = makeGeometryExtrudeFileName();

    // Das erzeugte GLB direkt wieder laden: Nutzer sieht exakt das Slot-Modell,
    // captureThumbnailPng() erzeugt danach die richtige Vorschau.
    await loadGLBBuffer(glbBuffer.slice ? glbBuffer.slice(0) : glbBuffer, outName);
    cacheLastImport(currentContext, glbBuffer.slice ? glbBuffer.slice(0) : glbBuffer, outName);
    await persistAndNotifyHost(glbBuffer, outName);

    // loadGLBBuffer() hat die Preview/Helper aus rootGroup entfernt und das
    // erzeugte GLB als aktives Modell geladen. Darum hier nur den Zeichenzustand
    // aufräumen, ohne das gerade geladene GLB wieder zu entfernen.
    geometryDrawState.enabled = false;
    geometryDrawState.points = [];
    geometryDrawState.helperGroup = null;
    geometryDrawState.previewGroup = null;
    geometryDrawState.lastPreview = null;
    if (geomPanel) geomPanel.hidden = true;
    if (orbit) orbit.enabled = true;
    updateGeometryTakeoverButton();

    setStatus(`GeometryLab als GLB übernommen: ${outName}`);
  } catch (e) {
    console.error("[assetlab-lite] GeometryLab takeover failed", e);
    setStatus(`GeometryLab übernehmen ERROR: ${String(e?.message || e)}`);
  } finally {
    updateGeometryTakeoverButton();
  }
}

// =============================================================================
// 7) UI Wiring
// =============================================================================

function wireUi() {
  // Import
  if (btnImport && fileInput) {
    /**
     * CMO/Filepicker-Fix v2
     * -------------------------------------------------------------------------
     * iOS/Safari blendet unbekannte Dateiendungen wie .cmo aus, sobald am
     * <input type="file"> ein accept-Filter hängt. Darum entfernen wir den
     * Filter nicht nur statisch in index.html, sondern direkt vor jedem Klick
     * noch einmal zur Laufzeit. Das schützt auch gegen alte gecachte HTML-Versionen
     * oder Browser, die Attribute aus einer vorherigen Session wiederverwenden.
     */
    btnImport.addEventListener("click", () => {
      try {
        fileInput.removeAttribute("accept");
        fileInput.accept = "";
        fileInput.value = "";
      } catch (_) {}
      fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
      const file = (fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;
      fileInput.value = "";
      await handleFileSelected(file);
    });
  }

  // GeometryLab Draw/Extrude Preview
  btnGeomDraw && btnGeomDraw.addEventListener("click", () => {
    if (geometryDrawState.enabled) {
      stopGeometryDrawMode();
      setStatus("GeometryLab: Zeichenmodus pausiert");
      return;
    }
    startGeometryDrawMode();
  });

  btnGeomClose && btnGeomClose.addEventListener("click", () => {
    if (!geometryDrawState.enabled) {
      startGeometryDrawMode();
      return;
    }
    buildGeometryExtrudePreview();
  });

  btnGeomTakeover && btnGeomTakeover.addEventListener("click", takeoverCurrentGeometryPreviewAsGlb);
  updateGeometryTakeoverButton();

  btnGeomReset && btnGeomReset.addEventListener("click", () => {
    resetGeometryDrawMode({ keepMode: geometryDrawState.enabled });
  });

  geomHeightInput && geomHeightInput.addEventListener("change", () => {
    if (geometryDrawState.enabled && sanitizeDrawPoints(geometryDrawState.points).length >= 3) {
      buildGeometryExtrudePreview();
    }
  });

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
  btnCmoTakeover && btnCmoTakeover.addEventListener("click", takeoverCurrentCmoPreviewAsGlb);
  if (btnCmoTakeover) {
    btnCmoTakeover.disabled = true;
    btnCmoTakeover.title = "Erst eine CMO-Datei importieren, dann übernehmen";
  }
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
