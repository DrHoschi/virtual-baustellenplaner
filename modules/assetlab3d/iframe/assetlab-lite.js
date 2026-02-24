/**
 * modules/assetlab3d/iframe/assetlab-lite.js
 * FINAL v2.0.6 - reqBuffer responder
 *
 * Fixes:
 *  - File.arrayBuffer iOS fallback (FileReader)
 *  - send slotUpdate; if IDB persist fails -> still works
 *  - NEW: caches last import buffer in RAM and answers assetlab:reqBuffer with assetlab:buffer
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

import { idbGet, idbPut, makeModelKey } from "../shared/idb-util.js";

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const projectId = q.get("projectId") || "unknown";

const urlProjectAssetId = q.get("contextAssetId") || q.get("projectAssetId") || null;
const urlSlotId = q.get("slotId") || null;

const DEBUG = (q.get("debug") === "1" || q.get("debug") === "true");
function dlog(...args) { if (DEBUG) console.log("[assetlab-lite]", ...args); }

function postToParent(type, payload, transfer) {
  try {
    window.parent?.postMessage({ ns: "assetlab", type, payload }, window.location.origin, transfer);
  } catch {}
}

function setStatus(t) {
  const st = $("#st");
  if (st) st.textContent = t;
  postToParent("assetlab:log", { msg: t });
}

const pidEl = $("#pid");
if (pidEl) pidEl.textContent = `Projekt: ${projectId}`;

// --- RAM cache for fallback requests (IMPORTANT) -------------------------
let __lastImport = null; // { projectAssetId, slotId, buffer, fileName, updatedAt }

// --- handshake ----------------------------------------------------------
let __initReceived = false;

function startReadyHandshake() {
  postToParent("assetlab:ready", { projectId });
  let tries = 0;
  const maxTries = 20;
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

// --- DOM refs -----------------------------------------------------------
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

// --- context ------------------------------------------------------------
let currentContext = {
  projectId,
  projectAssetId: urlProjectAssetId,
  slotId: urlSlotId,
  hasModel: false,
  lastImportName: null,
};

function hasValidSlotCtx(ctx) {
  return !!(ctx && ctx.projectAssetId && ctx.slotId);
}

// --- restore from IDB ---------------------------------------------------
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
    projectAssetId: currentContext.projectAssetId,
    slotId: currentContext.slotId,
    hasModel: true,
    fileName: rec.fileName || currentContext.lastImportName || "restore.glb",
    kind: "restore",
    updatedAt: (typeof rec.updatedAt === "number") ? new Date(rec.updatedAt).toISOString()
      : (typeof rec.updatedAt === "string" && rec.updatedAt) ? rec.updatedAt
        : new Date().toISOString(),
    lastAction: "restore",
    exportRef: { kind: "idb", key },
  });

  setStatus(`restore ok: ${rec.fileName || "model"}`);
  return true;
}

// --- message listener ---------------------------------------------------
window.addEventListener("message", async (ev) => {
  if (ev.origin !== window.location.origin) return;
  const data = ev.data || {};
  if (data.ns !== "assetlab") return;

  if (data.type === "assetlab:init") {
    currentContext = { ...currentContext, ...(data.payload || {}) };
    __initReceived = true;

    postToParent("assetlab:init:ack", {
      projectId,
      projectAssetId: currentContext?.projectAssetId || null,
      slotId: currentContext?.slotId || null,
    });

    if (hasValidSlotCtx(currentContext) && currentContext.hasModel) {
      try { await restoreFromIDB(); } catch (e) { console.warn("[assetlab-lite] restore failed", e); }
    }
    return;
  }

  if (data.type === "assetlab:restore") {
    currentContext = { ...currentContext, ...(data.payload || {}) };
    try { await restoreFromIDB(); } catch (e) { console.warn("[assetlab-lite] restore failed", e); }
    return;
  }

  // NEW: host requests buffer (when no persist + no buffer reached host)
  if (data.type === "assetlab:reqBuffer") {
    const req = data.payload || {};
    const aId = req.projectAssetId;
    const sId = req.slotId;

    if (__lastImport && __lastImport.projectAssetId === aId && __lastImport.slotId === sId && __lastImport.buffer) {
      const buf = __lastImport.buffer;
      postToParent("assetlab:buffer", {
        projectId,
        projectAssetId: aId,
        slotId: sId,
        fileName: __lastImport.fileName || "",
        updatedAt: __lastImport.updatedAt || new Date().toISOString(),
        buffer: buf,
      }, [buf]);
      setStatus("buffer sent (host persist)");
    } else {
      postToParent("assetlab:log", { msg: "reqBuffer: no RAM buffer available (import must be repeated)" });
    }
    return;
  }
});

// --- Three.js setup -----------------------------------------------------
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

// --- resize -------------------------------------------------------------
function resize() {
  const w = viewportEl?.clientWidth || window.innerWidth;
  const h = viewportEl?.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// --- picking ------------------------------------------------------------
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
renderer.domElement.addEventListener("pointerdown", (ev) => { __down = { x: ev.clientX, y: ev.clientY }; }, { passive: true });
renderer.domElement.addEventListener("pointerup", (ev) => {
  if (!__down) return;
  if (xform.dragging) { __down = null; return; }
  const dx = Math.abs(ev.clientX - __down.x);
  const dy = Math.abs(ev.clientY - __down.y);
  const moved = (dx + dy) > 10;
  if (!moved) pick(ev.clientX, ev.clientY);
  __down = null;
}, { passive: true });

// --- loaders ------------------------------------------------------------
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

// --- helpers ------------------------------------------------------------
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

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    try {
      if (file && typeof file.arrayBuffer === "function") {
        file.arrayBuffer().then(resolve).catch(reject);
        return;
      }
      const r = new FileReader();
      r.onerror = () => reject(r.error || new Error("FileReader error"));
      r.onload = () => resolve(r.result);
      r.readAsArrayBuffer(file);
    } catch (e) {
      reject(e);
    }
  });
}

// --- import -------------------------------------------------------------
fileInput?.addEventListener("change", async () => {
  const f = fileInput.files?.[0];
  if (!f) return;

  try {
    setStatus("import…");

    const nameLower = (f.name || "").toLowerCase();

    if (nameLower.endsWith(".glb")) {
      const buf = await readAsArrayBuffer(f);
      await loadGLBBuffer(buf, f.name);

      // cache RAM for reqBuffer fallback
      __lastImport = {
        projectAssetId: currentContext.projectAssetId,
        slotId: currentContext.slotId,
        buffer: buf,
        fileName: f.name,
        updatedAt: new Date().toISOString(),
      };

      if (hasValidSlotCtx(currentContext)) {
        const key = makeModelKey(currentContext.projectAssetId, currentContext.slotId);
        const isoNow = __lastImport.updatedAt;

        let persisted = false;
        let persistError = null;

        try {
          await idbPut(key, { fileName: f.name, updatedAt: isoNow, buffer: buf });
          persisted = true;
        } catch (e) {
          persisted = false;
          persistError = (e && (e.message || String(e))) || "unknown";
          console.warn("[assetlab-lite] IDB persist failed:", e);
          postToParent("assetlab:log", { msg: `IDB persist failed (continuing): ${persistError}` });
        }

        currentContext.hasModel = true;
        currentContext.lastImportName = f.name;

        const lastAction = persisted ? "import" : "import (no persist)";

        // IMPORTANT:
        // - kind bleibt "import" (Host darf nicht vom Text abhängen)
        // - wenn persisted=false -> wir schicken buffer direkt mit (Transferable)
        const payload = {
          projectAssetId: currentContext.projectAssetId,
          slotId: currentContext.slotId,
          hasModel: true,
          fileName: f.name,
          updatedAt: isoNow,
          lastAction,
          exportRef: persisted ? { kind: "idb", key } : { kind: "host", note: "fallback" },
          kind: "import",
          error: persisted ? null : { scope: "idb", msg: persistError },
          ...(persisted ? {} : { buffer: buf, bufferByteLength: buf.byteLength }),
        };

        postToParent("assetlab:slotUpdate", payload, (persisted ? undefined : [buf]));
        setStatus(persisted ? "import ok" : "import ok (host fallback)");
      } else {
        setStatus("import ok (no slot ctx)");
      }

    } else if (nameLower.endsWith(".gltf")) {
      setStatus("gltf import (no persist)");
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

          if (hasValidSlotCtx(currentContext)) {
            const isoNow = new Date().toISOString();
            currentContext.hasModel = true;
            currentContext.lastImportName = f.name;

            postToParent("assetlab:slotUpdate", {
              projectAssetId: currentContext.projectAssetId,
              slotId: currentContext.slotId,
              hasModel: true,
              fileName: f.name,
              updatedAt: isoNow,
              lastAction: "import (gltf, no persist)",
              exportRef: { kind: "memory", note: "gltf_no_persist" },
              kind: "import",
            });
          }

          setStatus("import ok (gltf, no persist)");
        },
        undefined,
        (err) => {
          URL.revokeObjectURL(url);
          console.error(err);
          const msg = (err && (err.message || String(err))) || "unknown";
          setStatus(`import ERROR (gltf): ${msg}`);
        }
      );

    } else {
      setStatus("Bitte GLB/GLTF auswählen");
    }

  } catch (e) {
    console.error(e);
    setStatus(`import ERROR: ${(e && (e.message || String(e))) || "unknown"}`);
  } finally {
    fileInput.value = "";
  }
});

// --- transform buttons --------------------------------------------------
btnMove && (btnMove.onclick = () => xform.setMode("translate"));
btnRotate && (btnRotate.onclick = () => xform.setMode("rotate"));
btnScale && (btnScale.onclick = () => xform.setMode("scale"));

// --- export -------------------------------------------------------------
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

// --- reset --------------------------------------------------------------
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

// --- loop ---------------------------------------------------------------
function tick() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
setStatus("ready");
tick();
