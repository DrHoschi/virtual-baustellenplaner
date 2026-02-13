/**
 * v1.4.7 – AssetLab IDB Util
 *
 * Zweck: Importierte Modelle (GLB als ArrayBuffer) persistieren und wieder laden.
 */

export const IDB_DB_NAME = "bp-assetlab3d";
export const IDB_DB_VERSION = 1;
export const IDB_STORE_MODELS = "models";

/** @type {Promise<IDBDatabase> | null} */
let _dbP = null;

export function makeModelKey(projectAssetId, slotId) {
  return `${projectAssetId || "PA-unknown"}::${slotId || "default"}`;
}

/** @returns {Promise<IDBDatabase>} */
export function openDb() {
  if (_dbP) return _dbP;
  _dbP = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_MODELS)) {
        db.createObjectStore(IDB_STORE_MODELS, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IDB open failed"));
  });
  return _dbP;
}

/**
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function idbGet(key) {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_STORE_MODELS], "readonly");
    const st = tx.objectStore(IDB_STORE_MODELS);
    const req = st.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("IDB get failed"));
  });
}

/**
 * @param {any} record
 * @returns {Promise<void>}
 */
export async function idbPut(record) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_STORE_MODELS], "readwrite");
    const st = tx.objectStore(IDB_STORE_MODELS);
    const req = st.put(record);
    req.onsuccess = () => resolve(null);
    req.onerror = () => reject(req.error || new Error("IDB put failed"));
  });
}
