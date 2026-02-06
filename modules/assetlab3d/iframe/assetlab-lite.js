/**
 * AssetLab 3D (Lite) – iframe bootstrap
 * Version: v1.0.0-lite (2026-02-05)
 *
 * Ziele:
 * - Import GLB/GLTF
 * - Transform: Move/Rotate/Scale
 * - Export GLTF
 *
 * NOTE:
 * - Das nutzt den three.js Editor-Kern aus vendor/threejs-editor/editor/
 * - Wir laden den Editor als Module und bauen eine minimal UI drumherum.
 */

// ------------------------------------------------------------
// 1) Projekt-ID aus Query
// ------------------------------------------------------------
const q = new URLSearchParams(location.search);
const projectId = q.get("projectId") || "unknown";
document.getElementById("pid").textContent = `Projekt: ${projectId}`;
const $st = document.getElementById("st");

// ------------------------------------------------------------
// 2) Host-Handshake (postMessage)
// ------------------------------------------------------------
function hostPost(type, payload) {
  window.parent?.postMessage({ type, payload }, window.location.origin);
}
hostPost("assetlab:ready", { projectId });
$st.textContent = "ready";

// ------------------------------------------------------------
// 3) Editor-Kern laden (Vendor Pfade)
// ------------------------------------------------------------
// Passe diese Basis an, falls du Vendor woanders ablegst:
const VENDOR = "../vendor/threejs-editor";

// IMPORTANT: Wir greifen auf Editor-Module zu.
// In der three.js Repo-Struktur sind das Dateien im /editor/jsm/ Bereich.
// Wenn deine Vendor-Struktur anders ist, sag Bescheid, dann passe ich es 1:1 an.
import { Editor } from `${VENDOR}/editor/js/Editor.js`;
import { Viewport } from `${VENDOR}/editor/js/Viewport.js`;
import { TransformControls } from `${VENDOR}/examples/jsm/controls/TransformControls.js`;

// ------------------------------------------------------------
// 4) Minimaler Editor-Aufbau
// ------------------------------------------------------------
const editor = new Editor();
const viewportEl = document.getElementById("viewport");

// Viewport mounten
const viewport = new Viewport(editor);
viewportEl.appendChild(viewport.dom);

// TransformControls (Lite)
const camera = editor.camera;
const renderer = viewport.renderer;
const controls = new TransformControls(camera, renderer.domElement);
controls.addEventListener("dragging-changed", (e) => {
  // Während Dragging Orbit/Viewport Controls sperren
  viewport.controls.enabled = !e.value;
});
editor.scene.add(controls);

// Objekt-Selection → TransformControls attach
editor.signals.objectSelected.add((obj) => {
  if (obj) controls.attach(obj);
  else controls.detach();
});

// ------------------------------------------------------------
// 5) Import (GLB/GLTF)
// ------------------------------------------------------------
const fileInput = document.getElementById("file");
document.getElementById("btnImport").onclick = () => fileInput.click();

fileInput.addEventListener("change", async () => {
  const files = fileInput.files;
  if (!files || !files.length) return;

  try {
    $st.textContent = "import…";

    // Editor hat eine eingebaute Loader-Pipeline
    // Falls diese Methode in deiner Editor-Version anders heißt:
    // -> ich passe es dann exakt an deine Vendor-Struktur an.
    editor.loader.loadFiles(files);

    $st.textContent = "import ok";
    hostPost("assetlab:log", { msg: "Import ok" });
  } catch (err) {
    console.error(err);
    $st.textContent = "import error";
    hostPost("assetlab:log", { msg: "Import ERROR (siehe Konsole)" });
  } finally {
    fileInput.value = "";
  }
});

// ------------------------------------------------------------
// 6) Transform Mode Buttons
// ------------------------------------------------------------
document.getElementById("btnMove").onclick = () => controls.setMode("translate");
document.getElementById("btnRotate").onclick = () => controls.setMode("rotate");
document.getElementById("btnScale").onclick = () => controls.setMode("scale");

// Default
controls.setMode("translate");

// ------------------------------------------------------------
// 7) Export (GLTF) – erstmal als Download (Phase 1)
//    Später: postMessage an Host (Phase 3: Export/Import sauber)
// ------------------------------------------------------------
document.getElementById("btnExport").onclick = async () => {
  try {
    $st.textContent = "export…";

    // Editor hat Exporter-Helfer. In manchen Versionen über:
    // editor.toJSON() + GLTFExporter selbst
    // -> wir starten pragmatisch: JSON Export (Scene) + später GLTFExporter
    const json = editor.toJSON();

    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `assetlab_${projectId}_scene.json`;
    a.click();
    URL.revokeObjectURL(a.href);

    $st.textContent = "export ok";
    hostPost("assetlab:log", { msg: "Export ok (scene.json)" });
  } catch (err) {
    console.error(err);
    $st.textContent = "export error";
    hostPost("assetlab:log", { msg: "Export ERROR (siehe Konsole)" });
  }
};

// ------------------------------------------------------------
// 8) Reset
// ------------------------------------------------------------
document.getElementById("btnReset").onclick = () => {
  editor.clear();
  controls.detach();
  $st.textContent = "reset";
  hostPost("assetlab:log", { msg: "Scene reset" });
};
