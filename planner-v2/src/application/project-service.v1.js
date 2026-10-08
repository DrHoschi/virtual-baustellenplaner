import { createId, createProjectDocument } from "../domain/project-document.v1.js";
import { assertValidProject } from "../domain/project-validation.v1.js";
import { calibratePlan } from "../domain/plan-calibration.v1.js";
import { createProjectPackage, readProjectPackage } from "./project-transfer.v1.js";

function clone(value) { return structuredClone(value); }

export function createProjectService({ repository, now = () => new Date().toISOString() }) {
  return {
    getAsset: (id) => repository.getAsset(id),
    list: () => repository.list(),
    async create(fields) {
      const project = createProjectDocument(fields);
      assertValidProject(project);
      return repository.create(project);
    },
    get: (id) => repository.get(id),
    async save(project) {
      const next = clone(project);
      next.updatedAt = now();
      assertValidProject(next);
      return repository.save(next);
    },
    async attachPlan(projectId, file, { widthPx, heightPx }) {
      if (!file || !["image/png", "image/jpeg"].includes(file.type)) throw new Error("Bitte einen PNG- oder JPEG-Grundriss auswählen.");
      if (!Number.isInteger(widthPx) || widthPx <= 0 || !Number.isInteger(heightPx) || heightPx <= 0) throw new Error("Bildgröße konnte nicht gelesen werden.");
      const project = await repository.get(projectId);
      if (!project) throw new Error("Projekt wurde nicht gefunden.");
      const previousAssetId = project.planBackground?.assetId;
      const assetId = createId("asset");
      const next = clone(project);
      next.planBackground = { assetId, fileName: String(file.name || "Grundriss"), mimeType: file.type, widthPx, heightPx, calibration: null };
      next.updatedAt = now();
      assertValidProject(next);
      await repository.save(next, { assets: [{ id: assetId, fileName: next.planBackground.fileName, mimeType: file.type, width: widthPx, height: heightPx, blob: file }], removeAssetIds: previousAssetId ? [previousAssetId] : [] });
      return next;
    },
    async calibrate(projectId, { pointA, pointB, realDistance, unit }) {
      const project = await repository.get(projectId);
      if (!project?.planBackground) throw new Error("Bitte zuerst einen Grundriss laden.");
      const calibration = calibratePlan({ pointA, pointB, realDistance, unit, widthPx: project.planBackground.widthPx, heightPx: project.planBackground.heightPx });
      const next = clone(project);
      next.planBackground.calibration = calibration;
      next.updatedAt = now();
      assertValidProject(next);
      await repository.save(next);
      return next;
    },
    async exportFile(projectId) {
      const project = await repository.get(projectId);
      if (!project) throw new Error("Projekt wurde nicht gefunden.");
      const assets = await repository.getAssetsForProject(projectId);
      return createProjectPackage(project, assets);
    },
    async importFile(file) {
      const pkg = await readProjectPackage(file);
      const newId = createId("project");
      const remap = new Map(pkg.assets.map(asset => [asset.id, createId("asset")]));
      const project = clone(pkg.project);
      project.id = newId;
      project.name = `${project.name} (Import)`;
      project.updatedAt = now();
      if (project.planBackground) project.planBackground.assetId = remap.get(project.planBackground.assetId);
      const assets = pkg.assets.map(asset => ({ ...asset, id: remap.get(asset.id), projectId: newId }));
      assertValidProject(project);
      await repository.save(project, { assets });
      return project;
    },
  };
}
