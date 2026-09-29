import fs from "node:fs";

export const MATERIAL_CATALOG_PATH = "data/global-material-catalog.v1.json";
export const MATERIAL_CATALOG_SCHEMA = "baustellenplaner.globalMaterialCatalog.v1";
export const MATERIAL_CATALOG_VERSION = "1.0.0";
export const REQUIRED_MATERIAL_FIELDS = Object.freeze([
  "materialId",
  "manufacturer",
  "articleNumber",
  "name",
  "unit"
]);

const UNKNOWN_PLACEHOLDERS = new Set(["?", "unknown", "n/a", "tbd"]);

function normalized(value) {
  return String(value).trim().toLocaleLowerCase("en-US");
}

export function validateGlobalMaterialCatalogV1(catalog) {
  const errors = [];

  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    return ["catalog must be an object"];
  }
  if (catalog.schema !== MATERIAL_CATALOG_SCHEMA) {
    errors.push(`schema must be ${MATERIAL_CATALOG_SCHEMA}`);
  }
  if (catalog.version !== MATERIAL_CATALOG_VERSION) {
    errors.push(`version must be ${MATERIAL_CATALOG_VERSION}`);
  }
  if (!Array.isArray(catalog.materials)) {
    errors.push("materials must be an array");
    return errors;
  }

  const materialIds = new Map();
  const manufacturerArticles = new Map();

  catalog.materials.forEach((material, index) => {
    const prefix = `materials[${index}]`;
    if (!material || typeof material !== "object" || Array.isArray(material)) {
      errors.push(`${prefix} must be an object`);
      return;
    }

    for (const field of REQUIRED_MATERIAL_FIELDS) {
      const value = material[field];
      if (typeof value !== "string") {
        errors.push(`${prefix}.${field} must be a string`);
        continue;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        errors.push(`${prefix}.${field} must not be empty`);
        continue;
      }
      if (UNKNOWN_PLACEHOLDERS.has(normalized(trimmed))) {
        errors.push(`${prefix}.${field} must not use an unknown placeholder`);
      }
    }

    const materialId = typeof material.materialId === "string" ? material.materialId.trim() : "";
    if (materialId) {
      if (materialIds.has(materialId)) {
        errors.push(`${prefix}.materialId duplicates ${materialIds.get(materialId)}`);
      } else {
        materialIds.set(materialId, prefix);
      }
    }

    const manufacturer = typeof material.manufacturer === "string" ? material.manufacturer.trim() : "";
    const articleNumber = typeof material.articleNumber === "string" ? material.articleNumber.trim() : "";
    if (manufacturer && articleNumber) {
      const key = `${normalized(manufacturer)}\u0000${normalized(articleNumber)}`;
      if (manufacturerArticles.has(key)) {
        errors.push(`${prefix} duplicates manufacturer + articleNumber of ${manufacturerArticles.get(key)}`);
      } else {
        manufacturerArticles.set(key, prefix);
      }
    }
  });

  return errors;
}

export function assertGlobalMaterialCatalogV1(catalog) {
  const errors = validateGlobalMaterialCatalogV1(catalog);
  if (errors.length) {
    throw new Error(`Global material catalog validation failed:\n- ${errors.join("\n- ")}`);
  }
}

export function validateCatalogFile(path = MATERIAL_CATALOG_PATH) {
  const catalog = JSON.parse(fs.readFileSync(path, "utf8"));
  assertGlobalMaterialCatalogV1(catalog);
  return catalog;
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
if (invokedPath === import.meta.url) {
  try {
    const catalog = validateCatalogFile();
    console.log(`BP-029 material catalog valid (${catalog.materials.length} material(s)).`);
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}
