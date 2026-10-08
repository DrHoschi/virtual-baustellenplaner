import "./r1f-single-scene-store-write.test.js";
import "./r1i-localstorage-key-inventory.test.js";
import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

/**
 * R1e diagnostic: compact memory/storage baseline around Workarea mount.
 * No polling and no large payloads are retained or logged.
 */
function jsonBytes(value) {
  try { return new Blob([JSON.stringify(value)]).size; } catch {}
  try { return JSON.stringify(value).length; } catch { return 0; }
}

function storageStats() {
  let totalChars = 0;
  let projectChars = 0;
  let crashChars = 0;
  let keys = 0;
  try {
    keys = localStorage.length;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = String(localStorage.key(i) || "");
      const value = localStorage.getItem(key) || "";
      totalChars += value.length;
      if (key.startsWith("baustellenplaner:project:")) projectChars += value.length;
      if (key === "baustellenplaner:crash-recorder:v1") crashChars = value.length;
    }
  } catch {}
  return { keys, totalChars, projectChars, crashChars };
}

function sceneStats(panel) {
  const objects = Array.isArray(panel?._scene?.objects) ? panel._scene.objects : [];
  const largest = objects
    .map((o) => ({ id: String(o?.id || ""), type: String(o?.type || ""), bytes: jsonBytes(o) }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 3);
  return { objects: objects.length, sceneBytes: jsonBytes(panel?._scene || null), largest };
}

function canvasStats(panel) {
  const canvas = panel?._vp?.canvas;
  const w = Number(canvas?.width || 0);
  const h = Number(canvas?.height || 0);
  return { w, h, approxRgbaBytes: w * h * 4 };
}

function memoryStats() {
  const pm = performance?.memory;
  return {
    deviceMemoryGB: Number(navigator?.deviceMemory || 0) || null,
    jsHeapUsed: Number(pm?.usedJSHeapSize || 0) || null,
    jsHeapTotal: Number(pm?.totalJSHeapSize || 0) || null,
    jsHeapLimit: Number(pm?.jsHeapSizeLimit || 0) || null
  };
}

function log(event, data) {
  try { window.BP_CRASH_RECORDER?.log?.(event, data); } catch {}
}

async function storageEstimate(event) {
  try {
    if (!navigator?.storage?.estimate) return;
    const estimate = await navigator.storage.estimate();
    log(event, {
      usage: Number(estimate?.usage || 0) || 0,
      quota: Number(estimate?.quota || 0) || 0,
      ratio: estimate?.quota ? Number((estimate.usage / estimate.quota).toFixed(6)) : null
    });
  } catch {}
}

const proto = WorkareaPanel?.prototype;
if (proto && !proto.__r1eMemoryStorageBaselineInstalled) {
  const originalMount = proto.mount;

  proto.mount = function r1eMount(...args) {
    const app = this.store?.get?.("app");
    const project = this.store?.get?.("project");
    log("diag:r1e:workarea:before-mount", {
      appBytes: jsonBytes(app),
      projectBytes: jsonBytes(project),
      storage: storageStats(),
      memory: memoryStats()
    });
    storageEstimate("diag:r1e:storage-estimate:before-mount");

    const result = typeof originalMount === "function" ? originalMount.apply(this, args) : undefined;

    setTimeout(() => {
      log("diag:r1e:workarea:after-mount", {
        scene: sceneStats(this),
        canvas: canvasStats(this),
        storage: storageStats(),
        memory: memoryStats()
      });
      storageEstimate("diag:r1e:storage-estimate:after-mount");
    }, 900);

    return result;
  };

  Object.defineProperty(proto, "__r1eMemoryStorageBaselineInstalled", {
    value: true,
    configurable: true
  });
}
