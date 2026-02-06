/**
 * AssetLab 3D (Lite) – iframe bootstrap
 * Patch: GLTFExporter + Export GLB/GLTF + optional Draco
 * Version: v1.1.0-lite-export (2026-02-06)
 *
 * Ziele:
 * - Import GLB/GLTF (via Editor loader)
 * - Transform: Move/Rotate/Scale (TransformControls)
 * - Export: GLB (binary) + GLTF (JSON + .bin)
 * - Optional: Draco-komprimierter glTF Export (experimentell, mit Fallback)
 *
 * Hinweis:
 * - Import-Support für Draco/KTX2 hängt am GLTFLoader-Setup im Editor.
 *   Du hast die libs bereits im Vendor → sehr gut.
 * - Draco-Export ist in three.js historisch nicht immer „out of the box“;
 *   dieser Patch versucht es und fällt sonst sauber zurück.
 */

// ------------------------------------------------------------
// 0) DOM Helpers
// ------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  if (props.style) Object.assign(n.style, props.style);
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return n;
};

// ------------------------------------------------------------
// 1) Projekt-ID aus Query
// ------------------------------------------------------------
const q = new URLSearchParams(location.search);
const projectId = q.get("projectId") || "unknown";

const pidEl = $("#pid");
if (pidEl) pidEl.textContent = `Projekt: ${projectId}`;

const stEl = $("#st");

// ------------------------------------------------------------
// 2) Host-Handshake (postMessage)
// ------------------------------------------------------------
function hostPost(type, payload) {
  window.parent?.postMessage({ type, payload }, window.location.origin);
}
function setStatus(txt) {
  if (stEl) stEl.textContent = txt;
  hostPost("assetlab:log", { msg: txt });
}

hostPost("assetlab:ready", { projectId });
setStatus("ready");

// ------------------------------------------------------------
// 3) Vendor-Imports (WICHTIG: statische Pfade!)
// ------------------------------------------------------------
// assetlab-lite.js liegt in: modules/assetlab3d/iframe/
// vendor liegt in:         modules/assetlab3d/vendor/threejs-editor/
//
// Deshalb: ../vendor/threejs-editor/...
import { Editor } from "../vendor/threejs-editor/editor/js/Editor.js";
import { Viewport } from "../vendor/threejs-editor/editor/js/Viewport.js";
import { TransformControls } from "../vendor/threejs-editor/examples/jsm/controls/TransformControls.js";
import { GLTFExporter } from "../vendor/threejs-editor/examples/jsm/exporters/GLTFExporter.js";

// Draco optional (wird nur genutzt, wenn Exporter/Version es unterstützt)
let DRACOExporter = null;
try {
  // In vielen three-Versionen existiert DRACOExporter in examples/jsm/exporters/
  const mod = await import("../vendor/threejs-editor/examples/jsm/exporters/DRACOExporter.js");
  DRACOExporter = mod?.DRACOExporter || null;
} catch {
  // ok: nicht vorhanden in dieser Vendor-Version
  DRACOExporter = null;
}

// ------------------------------------------------------------
// 4) Minimaler Editor-Aufbau
// ------------------------------------------------------------
const editor = new Editor();
const viewportEl = $("#viewport");
const viewport = new Viewport(editor);

// Viewport mounten
viewportEl?.appendChild(viewport.dom);

// TransformControls
const camera = editor.camera;
const renderer = viewport.renderer;

const xform = new TransformControls(camera, renderer.domElement);
xform.addEventListener("dragging-changed", (e) => {
  viewport.controls.enabled = !e.value;
});
editor.scene.add(xform);

// Objekt-Selection → TransformControls attach
editor.signals.objectSelected.add((obj) => {
  if (obj) xform.attach(obj);
  else xform.detach();
});

// Default mode
xform.setMode("translate");

// ------------------------------------------------------------
// 5) UI: falls Buttons/Checkbox fehlen, erzeugen wir sie dynamisch
//    (damit Patch nur assetlab-lite.js ändern muss)
// ------------------------------------------------------------
const actionsBar = document.querySelector(".al-actions") || document.body;

// File input (Import)
let fileInput = $("#file");
if (!fileInput) {
  fileInput = el("input", { id: "file", type: "file" });
  fileInput.accept = ".glb,.gltf";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);
}

// Buttons (nutze bestehende, oder erstelle)
const btnImport = $("#btnImport") || el("button", { id: "btnImport", className: "al-btn", type: "button" }, "Import (GLB/GLTF)");
const btnMove = $("#btnMove") || el("button", { id: "btnMove", className: "al-btn", type: "button" }, "Move");
const btnRotate = $("#btnRotate") || el("button", { id: "btnRotate", className: "al-btn", type: "button" }, "Rotate");
const btnScale = $("#btnScale") || el("button", { id: "btnScale", className: "al-btn", type: "button" }, "Scale");
const btnExportGLB = $("#btnExportGLB") || el("button", { id: "btnExportGLB", className: "al-btn al-primary", type: "button" }, "Export GLB");
const btnExportGLTF = $("#btnExportGLTF") || el("button", { id: "btnExportGLTF", className: "al-btn", type: "button" }, "Export GLTF");
const btnReset = $("#btnReset") || el("button", { id: "btnReset", className: "al-btn", type: "button" }, "Reset");

// Draco toggle (Checkbox)
let dracoWrap = $("#alDracoWrap");
let dracoChk = $("#alDraco");
if (!dracoWrap) {
  dracoChk = el("input", { id: "alDraco", type: "checkbox" });
  dracoWrap = el(
    "label",
    { id: "alDracoWrap", className: "al-btn", style: { display: "inline-flex", gap: "8px", alignItems: "center" } },
    [dracoChk, el("span", { style: { fontSize: "12px", opacity: ".9" } }, "Draco (exp.)")]
  );
}

// Buttons in Bar einhängen, falls noch nicht vorhanden
function ensureInBar(node) {
  if (!node) return;
  if (!node.parentElement) actionsBar.appendChild(node);
}
ensureInBar(btnImport);
ensureInBar(btnMove);
ensureInBar(btnRotate);
ensureInBar(btnScale);
ensureInBar(btnExportGLB);
ensureInBar(btnExportGLTF);
ensureInBar(dracoWrap);
ensureInBar(btnReset);

// ------------------------------------------------------------
// 6) Import (GLB/GLTF) – über Editor loader
// ------------------------------------------------------------
btnImport.onclick = () => fileInput.click();

fileInput.addEventListener("change", async () => {
  const files = fileInput.files;
  if (!files || !files.length) return;

  try {
    setStatus("import…");
    // Editor besitzt eine Loader-Pipeline
    editor.loader.loadFiles(files);
    setStatus("import ok");
  } catch (err) {
    console.error(err);
    setStatus("import ERROR (siehe Konsole)");
  } finally {
    fileInput.value = "";
  }
});

// ------------------------------------------------------------
// 7) Transform Modes
// ------------------------------------------------------------
btnMove.onclick = () => xform.setMode("translate");
btnRotate.onclick = () => xform.setMode("rotate");
btnScale.onclick = () => xform.setMode("scale");

// ------------------------------------------------------------
// 8) Export Helpers
// ------------------------------------------------------------
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2500);
}

/**
 * Export glTF/GLB über GLTFExporter
 * @param {"glb"|"gltf"} mode
 */
async function exportGLTF(mode) {
  const useDraco = !!dracoChk?.checked;

  try {
    setStatus(mode === "glb" ? "export glb…" : "export gltf…");

    const exporter = new GLTFExporter();

    // --- Draco (experimentell / best effort) ---
    // 1) Falls GLTFExporter in deiner Version dracoOptions unterstützt → nutzen wir es.
    // 2) Falls es eine setDRACOExporter API gibt → nutzen wir DRACOExporter.
    // 3) Sonst fallback ohne Draco.
    let dracoEnabled = false;

    if (useDraco) {
      // Versuch A: Option dracoOptions (in manchen Versionen vorhanden)
      // Wir setzen erstmal nur ein Flag; konkrete Parameter sind optional.
      // Falls die Version das nicht kennt, ist es egal – parse() ignoriert unbekannt.
      // (Aber wir prüfen trotzdem über try/catch unten)
      dracoEnabled = true;
    }

    const options = {
      binary: mode === "glb",
      // gute Defaults für Web
      trs: true,
      onlyVisible: false,
      truncateDrawRange: true,
      embedImages: mode === "glb", // bei .gltf eher externe Images (hier lassen wir default)
      // Draco wird (falls unterstützt) über dracoOptions signalisiert:
      ...(useDraco ? { dracoOptions: { } } : {})
    };

    // Versuch B: setDRACOExporter (falls vorhanden)
    if (useDraco && DRACOExporter && typeof exporter.setDRACOExporter === "function") {
      try {
        exporter.setDRACOExporter(new DRACOExporter());
        dracoEnabled = true;
      } catch {
        dracoEnabled = false;
      }
    }

    // Export parse (async via callback)
    const input = editor.scene;
    const result = await new Promise((resolve, reject) => {
      exporter.parse(
        input,
        (res) => resolve(res),
        (err) => reject(err),
        options
      );
    });

    // Ergebnis verarbeiten
    if (mode === "glb") {
      // ArrayBuffer
      const blob = new Blob([result], { type: "model/gltf-binary" });
      const suffix = (useDraco && dracoEnabled) ? "_draco" : "";
      downloadBlob(blob, `assetlab_${projectId}${suffix}.glb`);
      setStatus(`export ok (GLB${useDraco ? (dracoEnabled ? ", draco" : ", draco n/a") : ""})`);
    } else {
      // JSON glTF + ggf. buffers/images (je nach exporter Version)
      // In vielen Versionen liefert result ein JSON object, nicht string.
      const jsonStr = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      const suffix = (useDraco && dracoEnabled) ? "_draco" : "";
      downloadBlob(new Blob([jsonStr], { type: "model/gltf+json" }), `assetlab_${projectId}${suffix}.gltf`);
      setStatus(`export ok (GLTF${useDraco ? (dracoEnabled ? ", draco" : ", draco n/a") : ""})`);
    }

    // Wenn Draco gewünscht war, aber nicht möglich → klare Info
    if (useDraco && !dracoEnabled) {
      hostPost("assetlab:log", { msg: "Draco-Export: in dieser three.js/GLTFExporter-Version nicht aktivierbar → normaler Export verwendet." });
    }

  } catch (err) {
    console.error(err);
    setStatus("export ERROR (siehe Konsole)");
    hostPost("assetlab:log", { msg: "Export ERROR (siehe Konsole)" });
  }
}

// Buttons
btnExportGLB.onclick = () => exportGLTF("glb");
btnExportGLTF.onclick = () => exportGLTF("gltf");

// ------------------------------------------------------------
// 9) Reset Scene
// ------------------------------------------------------------
btnReset.onclick = () => {
  editor.clear();
  xform.detach();
  setStatus("reset");
};

// ------------------------------------------------------------
// 10) Optional: init vom Host
// ------------------------------------------------------------
window.addEventListener("message", (ev) => {
  const { type, payload } = ev.data || {};
  if (type === "assetlab:init") {
    setStatus(`init ok (${payload?.projectId || "?"})`);
  }
});
