export const PROJECT_SCHEMA = "baustellenplaner.rebuild.project";
export const PROJECT_VERSION = 1;

export function createId(prefix = "id") {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createProjectDocument({ name, areaKind = "unconfigured", widthMm = null, heightMm = null } = {}) {
  const now = new Date().toISOString();
  return {
    schema: PROJECT_SCHEMA,
    formatVersion: PROJECT_VERSION,
    id: createId("project"),
    name: String(name || "").trim(),
    createdAt: now,
    updatedAt: now,
    units: "mm",
    coordinateSystem: "x-right-y-up-z-up",
    siteArea: {
      kind: areaKind,
      widthMm: widthMm === "" ? null : widthMm,
      heightMm: heightMm === "" ? null : heightMm,
      originXmm: 0,
      originYmm: 0,
    },
    planBackground: null,
    objects: [],
    layers: [{ id: createId("layer"), name: "Boden", elevationMm: 0, visible: true }],
    modules: {},
  };
}
