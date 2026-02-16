/**
 * modules/assetlab3d/iframe/assetlab-lite.js
 * Version: v2.0.3-lite-viewer-stable (2026-02-14)
 *
 * AssetLab 3D (Lite) — GH-Pages robust (ohne Three.js Editor-Kern)
 * =============================================================================
 * Ziel:
 *  - Stabiler 3D-Viewer/Editor (Import + Transform + Export),
 *    der auf GitHub Pages läuft und im Host (Baustellenplaner) als iframe
 *    eingebettet werden kann.
 *
 * Enthaltene Funktionen:
 *  - Import GLB (GLTF/GLB Loader) ✅
 *  - OrbitControls
 *  - TransformControls: Move / Rotate / Scale
 *  - Export GLB / GLTF
 *  - Optional: Draco-Decode (Import) + KTX2 (Import)
 *
 * Messaging (Parent <-> IFrame)
 * -----------------------------------------------------------------------------
 * Parent -> iframe:
 *   { type: "assetlab:init", payload: { projectId, projectAssetId, slotId, hasModel } }
 *   { type: "assetlab:restore", payload: { projectAssetId, slotId } }
 *
 * iframe -> Parent:
 *   { type: "assetlab:ready", payload: { projectId } }
 *   { type: "assetlab:log", payload: { msg } }
 *   { type: "assetlab:slotUpdate", payload: { projectAssetId, slotId, hasModel, fileName, updatedAt, kind } }
 *
 * WICHTIGER BUGFIX:
 *  - In alten Ständen wurde beim Import fälschlich currentCtx verwendet (existiert nicht).
 *    Dadurch wurde weder IDB gespeichert noch slotUpdate gesendet -> Slot blieb im Host "leer".
 *  - Jetzt: konsistent currentContext nutzen.
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
function postToParent(type, payload) {
  try {
    window.parent?.postMessage({ type, payload }, window.location.origin);
  } catch (e) {
    // no-op
  }
}

/** Statusanzeige (oben rechts) + optionaler Log an Host */
function setStatus(t) {
  const st = $("#st");
  if (st) st.textContent = t;
  postToParent("assetlab:log", { msg: t });
}

/** Badge/Quickstatus (kurz) */
function setStatusBadge(t) {
  setStatus(t);
}

/** Handshake: Host kann damit "ready" anzeigen und init schicken */
postToParent("assetlab:ready", { projectId });

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
// 1b) Parent-Context + Restore
// =============================================================================

/**
 * Parent setzt diesen Context beim Öffnen (assetlab:init).
 * Wir nutzen ihn für IDB Keys + Auto-Restore.
 */
let currentContext = {
  projectId: null,
  projectAssetId: null,
  slotId: null,
  hasModel: false,
  lastImportName: null,
};

async function restoreFromIDB() {
  const key = makeModelKey(currentContext.projectAssetId || "free", currentContext.slotId || "default");
  const rec = await idbGet(key);
  if (!rec || !rec.buffer) return false;

  await loadGLBBuffer(rec.buffer, rec.fileName || currentContext.lastImportName || "restore.glb");

  postToParent("assetlab:slotUpdate", {
    projectAssetId: currentContext.projectAssetId,
    slotId: currentContext.slotId,
    hasModel: true,
    fileName: rec.fileName || currentContext.lastImportName || "restore.glb",
    kind: "restore",
    updatedAt: rec.updatedAt || Date.now(),
  });

  return true;
}

// Parent Messages (init / restore)
window.addEventListener("message", async (ev) => {
  if (ev.origin !== window.location.origin) return;
  const data = ev.data || {};

  if (data.type === "assetlab:init") {
    currentContext = { ...currentContext, ...(data.payload || {}) };

    // Auto-Restore: wenn Slot bereits ein Modell hat
    if (currentContext.projectAssetId && currentContext.slotId) {
      if (currentContext.hasModel) await restoreFromIDB();
    }
  }

  if (data.type === "assetlab:restore") {
    currentContext = { ...currentContext, ...(data.payload || {}) };
    await restoreFromIDB();
  }
});

// =============================================================================
// 2) Three.js Setup
// =============================================================================

let renderer, scene, camera, orbit, tControls;
let raycaster, pointer;
let selected = null;
let rootGroup = null;

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);

  camera = new THREE.PerspectiveCamera(55, 1, 0.01, 500);
  camera.position.set(2.2, 1.6, 2.2);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  viewportEl.appendChild(renderer.domElement);

  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;

  tControls = new TransformControls(camera, renderer.domElement);
  tControls.addEventListener("dragging-changed", (e) => {
    orbit.enabled = !e.value;
  });
  scene.add(tControls);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  // Licht
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 1.1);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(2.5, 4, 1.5);
  dir.castShadow = false;
  scene.add(dir);

  // Boden / Grid
  const grid = new THREE.GridHelper(10, 20, 0x2a3344, 0x1c2230);
  grid.position.y = 0;
  scene.add(grid);

  // Resize
  const ro = new ResizeObserver(() => resize());
  ro.observe(viewportEl);

  // Pointer select
  renderer.domElement.addEventListener("pointerdown", onPointerDown);

  animate();
  resize();
}

function resize() {
  if (!renderer || !camera) return;
  const w = viewportEl.clientWidth || 1;
  const h = viewportEl.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  orbit?.update?.();
  renderer?.render?.(scene, camera);
}

// =============================================================================
// 3) Loader / Exporter
// =============================================================================

let _gltfLoader = null;

function getGltfLoader() {
  if (_gltfLoader) return _gltfLoader;

  const loader = new GLTFLoader();

  // Optional Draco
  if (chkDraco?.checked) {
    try {
      const draco = new DRACOLoader();
      draco.setDecoderPath("../vendor/threejs-editor/examples/jsm/libs/draco/");
      loader.setDRACOLoader(draco);
    } catch {
      // ignore
    }
  }

  // Optional KTX2 (falls verfügbar)
  try {
    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath("../vendor/threejs-editor/examples/jsm/libs/basis/");
    ktx2Loader.detectSupport(renderer);
    loader.setKTX2Loader(ktx2Loader);
  } catch {
    // ignore
  }

  _gltfLoader = loader;
  return loader;
}

function clearLoaded() {
  if (rootGroup) {
    scene.remove(rootGroup);
    rootGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          m.map?.dispose?.();
          m.dispose?.();
        });
      }
    });
  }
  rootGroup = null;
  selected = null;
  tControls.detach();
}

function setLoadedScene(obj3d) {
  clearLoaded();

  rootGroup = new THREE.Group();
  rootGroup.name = "ImportedRoot";
  if (obj3d) rootGroup.add(obj3d);

  scene.add(rootGroup);

  // Auto-Fit
  try {
    const box = new THREE.Box3().setFromObject(rootGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    rootGroup.position.sub(center);

    const max = Math.max(size.x, size.y, size.z) || 1;
    const dist = max * 1.8;
    camera.position.set(dist, dist * 0.7, dist);
    camera.lookAt(0, 0, 0);
    orbit.target.set(0, 0, 0);
    orbit.update();
  } catch {
    // ignore
  }
}

async function loadGLBBuffer(buffer, nameForUi) {
  const loader = getGltfLoader();

  // GLTFLoader.parse erwartet ArrayBuffer
  let arr = buffer;
  if (!(arr instanceof ArrayBuffer)) {
    // z.B. Uint8Array -> buffer
    arr = arr?.buffer || arr;
  }

  return new Promise((resolve, reject) => {
    loader.parse(
      arr,
      "",
      (gltf) => {
        setLoadedScene(gltf.scene || gltf.scenes?.[0]);
        setStatusBadge(`loaded: ${nameForUi || "model"}`);
        resolve(true);
      },
      (err) => {
        console.warn("parse error", err);
        setStatusBadge("load failed");
        reject(err);
      }
    );
  });
}

function exportGLTFBinary() {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    const obj = rootGroup || scene;

    exporter.parse(
      obj,
      (res) => {
        if (res instanceof ArrayBuffer) resolve(res);
        else reject(new Error("Expected ArrayBuffer for GLB export"));
      },
      (err) => reject(err),
      { binary: true }
    );
  });
}

function exportGLTFJson() {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    const obj = rootGroup || scene;

    exporter.parse(
      obj,
      (res) => resolve(res),
      (err) => reject(err),
      { binary: false }
    );
  });
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// =============================================================================
// 4) Pointer Select / Transform
// =============================================================================

function onPointerDown(ev) {
  if (!rootGroup) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(rootGroup, true);
  if (!hits.length) return;

  selected = hits[0].object;
  if (selected) {
    tControls.attach(selected);
    setStatus(`selected: ${selected.name || selected.type}`);
  }
}

function setMode(m) {
  tControls.setMode(m);
  setStatus(`mode: ${m}`);
}

// =============================================================================
// 5) UI Actions
// =============================================================================

async function handleImport() {
  // ---------------------------------------------------------------------------
  // Import (GLB/GLTF) aus dem Browser-Dateidialog.
  //
  // Wichtig (Lifecycle/Restore):
  // - Wir versuchen, das importierte Binary in IndexedDB zu persistieren (idbPut).
  // - Auf iOS/Safari kann IndexedDB (je nach Modus/Quota) fehlschlagen.
  //   → Dann ist das Modell trotzdem im Viewer sichtbar, aber nicht "restorebar".
  // - In diesem Fall senden wir trotzdem ein slotUpdate an den Parent,
  //   damit der Slot im Projekt als "hat Modell" markiert wird
  //   (mit Flag _storageSaved=false).
  // ---------------------------------------------------------------------------
  try {
    const file = fileInput?.files?.[0];
    if (!file) return;

    setStatus("importing…");

    // 1) Laden in den Viewer (in-memory)
    const { gltf, raw } = await loadModelFromFile(file);
    setModelToScene(gltf);

    // 2) Slot-Key (stabil für Restore): projectId + assetId + slotId
    const slotKey = makeSlotKey(currentContext);
    const nowIso = new Date().toISOString();

    // 3) Persistenz (IndexedDB) – separat absichern, damit ein IDB-Fehler
    //    nicht den ganzen Import als "failed" markiert.
    let saved = false;
    let storageError = null;

    try {
      // raw ist typischerweise ArrayBuffer/Uint8Array → für IDB geeignet
      await idbPut(slotKey, raw);
      saved = true;
    } catch (e) {
      storageError = e;
      // NICHT throwen → Modell bleibt sichtbar; wir signalisieren nur Warnung.
      console.warn("[assetlab-lite] IDB save failed (model stays visible)", e);
    }

    // 4) Context-Meta (für kleine UI-Anzeigen)
    try {
      currentContext.lastImportName = file.name || "";
    } catch {}

    // 5) Parent informieren (Projekt-Assets Slot-Status aktualisieren)
    //    exportRef bleibt null, wenn IDB-Save fehlschlug.
    notifyParent("cb:assetlab:slotUpdate", {
      context: currentContext,
      slotUpdate: {
        hasModel: true,
        lastImportName: file.name || "",
        updatedAt: nowIso,
        lastAction: saved ? "import" : "import-nosave",
        exportRef: saved ? { kind: "idb", key: slotKey } : null,
        _storageSaved: !!saved
      },
      // Optional: Error-Info (nur textuell, kein riesiger Stack)
      error: saved ? null : {
        kind: "idb",
        message: storageError ? String(storageError?.message || storageError) : "unknown"
      }
    });

    // 6) Status-UI
    if (saved) {
      setStatus("import ok");
    } else {
      // Wichtig: NICHT "import failed" anzeigen – Modell ist sichtbar.
      setStatus("import ok (not saved)");
      // Parent kann optional Toast zeigen
      notifyParent("cb:assetlab:warn", {
        context: currentContext,
        kind: "idb-save-failed",
        message: "Import ok, aber Speichern (IndexedDB) fehlgeschlagen. Restore nach Reload evtl. nicht möglich."
      });
    }

    fileInput.value = "";
  } catch (e) {
    console.error("[assetlab-lite] import failed", e);
    setStatus("import failed");
  }
}

async function handleExportGLB() {
  try {
    if (!rootGroup) {
      setStatus("nothing to export");
      return;
    }
    setStatus("exporting glb...");
    const arr = await exportGLTFBinary();
    downloadBlob(new Blob([arr], { type: "model/gltf-binary" }), "export.glb");

    if (currentContext?.projectAssetId && currentContext?.slotId) {
      postToParent("assetlab:slotUpdate", {
        projectAssetId: currentContext.projectAssetId,
        slotId: currentContext.slotId,
        hasModel: true,
        fileName: "export.glb",
        updatedAt: Date.now(),
        kind: "export",
      });
    }

    setStatus("export glb ok");
  } catch (e) {
    console.error(e);
    setStatus("export glb failed");
  }
}

async function handleExportGLTF() {
  try {
    if (!rootGroup) {
      setStatus("nothing to export");
      return;
    }
    setStatus("exporting gltf...");
    const json = await exportGLTFJson();
    const str = JSON.stringify(json, null, 2);
    downloadBlob(new Blob([str], { type: "model/gltf+json" }), "export.gltf");

    if (currentContext?.projectAssetId && currentContext?.slotId) {
      postToParent("assetlab:slotUpdate", {
        projectAssetId: currentContext.projectAssetId,
        slotId: currentContext.slotId,
        hasModel: true,
        fileName: "export.gltf",
        updatedAt: Date.now(),
        kind: "export",
      });
    }

    setStatus("export gltf ok");
  } catch (e) {
    console.error(e);
    setStatus("export gltf failed");
  }
}

function handleReset() {
  clearLoaded();
  setStatus("reset");
}

// =============================================================================
// 6) Hook up UI
// =============================================================================

// iOS/Safari: Datei-Picker MUSS direkt durch User-Gesture geöffnet werden.
// Daher: Button -> fileInput.click() und Import erst nach "change".
btnImport?.addEventListener("click", () => {
  if (!fileInput) return;
  // Wichtig: input darf NICHT display:none sein (siehe HTML-Fix unten).
  fileInput.value = ""; // damit derselbe File erneut gewählt werden kann
  fileInput.click();
});

// Wenn User eine Datei gewählt hat, dann importieren.
fileInput?.addEventListener("change", () => {
  handleImport();
});
btnMove?.addEventListener("click", () => setMode("translate"));
btnRotate?.addEventListener("click", () => setMode("rotate"));
btnScale?.addEventListener("click", () => setMode("scale"));

btnExportGLB?.addEventListener("click", handleExportGLB);
btnExportGLTF?.addEventListener("click", handleExportGLTF);
btnReset?.addEventListener("click", handleReset);

// Init
initThree();
setStatus("ready");
