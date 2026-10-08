import { assertValidProject } from "../domain/project-validation.v1.js";

export class ProjectRepository {
  constructor(store) { this.store = store; }

  async create(project) {
    assertValidProject(project);
    await this.store.save(project);
    return project;
  }

  async list() { return this.store.list(); }

  async get(id) {
    const project = await this.store.get(id);
    if (!project) return null;
    assertValidProject(project);
    return project;
  }

  async save(project, options = {}) {
    assertValidProject(project);
    await this.store.save(project, options);
    return project;
  }

  getAsset(id) { return this.store.getAsset(id); }
  getAssetsForProject(id) { return this.store.getAssetsForProject(id); }
}
