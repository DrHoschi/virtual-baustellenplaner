import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

/**
 * R1f diagnostic test: single Scene store write
 *
 * Goal:
 * - Keep Workarea Scene serialization identical.
 * - Persist Scene only to app.project.workspace.scene.objects (canonical source).
 * - Skip the legacy mirror write to store.project.workspace.scene.objects.
 * - Keep cb:scene:changed and the existing Workarea save request unchanged.
 *
 * This isolates the cost of the second full store.update() / JSON deep clone.
 */

const proto = WorkareaPanel?.prototype;

if (proto && !proto.__r1fSingleSceneStoreWriteInstalled) {
  proto._persistSceneToStore = function r1fPersistSceneToStore(reason = "scene") {
    if (!this.store?.update) return;

    const startedAt = performance.now();

    const snapshot = (this._scene?.objects || []).map((o) => {
      const item = {
        id: o.id,
        type: o.type,
        name: o.name,
        x: o.x,
        y: o.y,
        r: o.r,
        rotDeg: Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0,
        rotation: Number.isFinite(Number(o.rotation))
          ? Number(o.rotation)
          : (Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0),
        projectAssetId: o.projectAssetId || null,
        slotId: o.slotId || null,
        importName: o.importName || null,
        preset: o.preset || null,
        presetTransform: o.presetTransform || null,
        catalogId: o.catalogId || null,
        assetType: o.assetType || null,
        propertiesType: o.propertiesType || null,
        paramPackUrl: o.paramPackUrl || null,
        params: o.params || null
      };

      if (String(o.type || "") === "assembly.instance") {
        const keepKeys = [
          "schema", "templateId", "templateTitle", "variantId", "variantTitle",
          "area", "conveyorGroup", "scale", "w", "h", "width", "height",
          "config", "bom", "ports", "cablePoints", "cablepoints", "cableLines", "cableList", "visual", "meta", "autoName", "nameSource",
          "components", "componentRefs", "assemblyLab"
        ];
        for (const key of keepKeys) {
          if (o[key] !== undefined && o[key] !== null) item[key] = this._cloneJsonSafe(o[key]);
        }
      }

      return item;
    });

    const persistBytes = window.BP_CRASH_RECORDER?.sizeOf?.(snapshot) || 0;
    if (this._crashDiag) this._crashDiag.lastPersistBytes = persistBytes;
    this._crashLog("workarea:scene:persist", { reason, count: snapshot.length, bytes: persistBytes });

    const beforeAppUpdate = performance.now();

    // Canonical Scene source only. The legacy store.project mirror is
    // intentionally skipped in R1f to isolate its clone/memory cost.
    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      next.project.workspace = next.project.workspace && typeof next.project.workspace === "object" ? next.project.workspace : {};
      next.project.workspace.scene = next.project.workspace.scene && typeof next.project.workspace.scene === "object" ? next.project.workspace.scene : {};
      next.project.workspace.scene.objects = snapshot;
      return next;
    });

    const afterAppUpdate = performance.now();

    try {
      this.bus?.emit?.("cb:scene:changed", { source: "workarea", reason, count: snapshot.length });
    } catch {}

    this._requestProjectSaveDebounced(`scene:${reason}`);

    this._crashLog?.("diag:r1f:single-scene-store-write", {
      reason,
      count: snapshot.length,
      bytes: persistBytes,
      snapshotBuildMs: Math.round((beforeAppUpdate - startedAt) * 10) / 10,
      appUpdateMs: Math.round((afterAppUpdate - beforeAppUpdate) * 10) / 10,
      totalMs: Math.round((performance.now() - startedAt) * 10) / 10
    });
  };

  Object.defineProperty(proto, "__r1fSingleSceneStoreWriteInstalled", {
    value: true,
    configurable: true
  });
}
