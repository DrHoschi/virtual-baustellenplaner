import { normalizeStoredHall } from "../../../core/hall/hall-config.v1.js";
import { loadLibraries } from "./model-library.js";
import { buildHallFromPreset, buildHallFromProjectHall } from "./procedural-hall.js";
import {
  loadParamPack,
  mergeParams,
  applyParamPack,
  computeMetrics
} from "./param-engine.js";

const DIAG_EVENT_PREFIX = "project-ui-04a:rebuild:";
const bridgedDiagKeys = new Set();
let diagBridgeTimer = null;

function hallDiagSnapshot(project) {
  const hall = project?.hall || null;
  return {
    length: hall?.dimensions?.length ?? null,
    width: hall?.dimensions?.width ?? null,
    eaveHeight: hall?.dimensions?.eaveHeight ?? null,
    roofType: hall?.roof?.type ?? null,
    peakHeight: hall?.roof?.peakHeight ?? null,
    gridSpacing: hall?.grid?.longitudinal?.spacing ?? null,
  };
}

function flushRuntimeDiagToCrashRecorder() {
  if (typeof window === "undefined") return;
  const recorder = window.BP_CRASH_RECORDER;
  const entries = Array.isArray(window.__BP_04A_REBUILD_DIAG__)
    ? window.__BP_04A_REBUILD_DIAG__
    : [];
  if (!recorder?.log || !entries.length) return;

  for (const entry of entries) {
    const key = `${entry?.ts || ""}|${entry?.stage || ""}`;
    if (bridgedDiagKeys.has(key)) continue;
    bridgedDiagKeys.add(key);
    recorder.log(`${DIAG_EVENT_PREFIX}${entry?.stage || "event"}`, entry);
  }

  if (bridgedDiagKeys.size > 240) {
    const newest = Array.from(bridgedDiagKeys).slice(-120);
    bridgedDiagKeys.clear();
    newest.forEach((key) => bridgedDiagKeys.add(key));
  }
}

function ensureRuntimeDiagCrashBridge() {
  if (typeof window === "undefined" || diagBridgeTimer) return;
  flushRuntimeDiagToCrashRecorder();
  diagBridgeTimer = window.setInterval(flushRuntimeDiagToCrashRecorder, 100);
}

function logModelFactoryInput(project) {
  if (typeof window === "undefined") return;
  try {
    window.BP_CRASH_RECORDER?.log?.(`${DIAG_EVENT_PREFIX}before-model-factory-build`, {
      projectId: project?.id ?? null,
      ...hallDiagSnapshot(project),
    });
  } catch (_) { /* diagnosis must never affect product behavior */ }
}

export const ModelFactory = {
  async build(project) {
    // B-04A-002.1 diagnosis only: bridge Hall3D runtime diagnostics into the
    // existing crash recorder and record the exact hall input at build entry.
    ensureRuntimeDiagCrashBridge();
    flushRuntimeDiagToCrashRecorder();
    logModelFactoryInput(project);

    // BP-HI01B.1 product path:
    // app.project.hall is the only hall authority. Repository presets are not
    // re-applied here and no project.model copy is created.
    if (project?.hall !== undefined) {
      const normalized = normalizeStoredHall(project.hall);
      if (normalized.errors.length) {
        const error = new Error(`Invalid project.hall: ${normalized.errors.join(" | ")}`);
        error.code = "HALL_CONFIG_INVALID";
        error.errors = [...normalized.errors];
        throw error;
      }

      const group = buildHallFromProjectHall(normalized.hall, normalized.derived);
      return {
        group,
        elementMeshes: collect(group),
        hall: normalized.hall,
        derived: normalized.derived,
        warnings: normalized.warnings,
      };
    }

    // Legacy model path retained for compatibility with older standalone Hall3D/GLB data.
    const cfg = project?.model;
    if (!cfg) throw new Error("ModelFactory requires project.hall or legacy project.model.");

    const libs = await loadLibraries();

    if (cfg.kind === "procedural") {
      const preset = libs.presets.presets.find(p => p.id === cfg.presetId);
      const group = buildHallFromPreset(preset, cfg.overrides);
      return { group, elementMeshes: collect(group) };
    }

    if (cfg.kind === "glb") {
      const entry = libs.models.models.find(m => m.id === cfg.modelId);
      const loader = new THREE.GLTFLoader();
      const gltf = await loader.loadAsync(entry.url);

      // ------------------------------------------------------------
      // Param Engine (v1):
      // - optional entry.paramPackUrl (JSON) liefert defaults + apply rules + BOM
      // - project.model.params (overrides) werden gemerged
      // - applyParamPack() wendet die Regeln VISUELL am 3D Modell an
      // - computeMetrics() liefert Stückliste/Kosten/Metadaten für spätere Auswertungen
      // ------------------------------------------------------------
      let paramPack = null;
      let params = cfg.params || {};
      if (entry?.paramPackUrl) {
        paramPack = await loadParamPack(entry.paramPackUrl);
        params = mergeParams(paramPack?.defaults || {}, cfg.params || {});
        applyParamPack(gltf.scene, paramPack, params);
      }

      const metrics = paramPack ? computeMetrics(paramPack, params) : null;

      return {
        group: gltf.scene,
        elementMeshes: collect(gltf.scene),
        paramPack,
        params,
        metrics
      };
    }

    throw new Error(`Unsupported legacy model kind: ${String(cfg.kind)}`);
  }
};

function collect(root) {
  const map = new Map();
  root.traverse(o => {
    if (o.userData?.elementId) map.set(o.userData.elementId, o);
  });
  return map;
}
