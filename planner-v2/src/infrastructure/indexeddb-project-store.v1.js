const DB_NAME = "baustellenplaner-rebuild-v1";
const DB_VERSION = 1;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB-Anfrage fehlgeschlagen."));
  });
}

function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("Speichern wurde abgebrochen."));
    transaction.onerror = () => reject(transaction.error || new Error("Speichern ist fehlgeschlagen."));
  });
}

export class IndexedDbProjectStore {
  constructor({ indexedDB = globalThis.indexedDB, dbName = DB_NAME } = {}) {
    if (!indexedDB) throw new Error("Lokaler Projektspeicher ist in diesem Browser nicht verfügbar.");
    this.indexedDB = indexedDB;
    this.dbName = dbName;
    this.dbPromise = null;
  }

  open() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = this.indexedDB.open(this.dbName, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("assets")) {
          const assets = db.createObjectStore("assets", { keyPath: "id" });
          assets.createIndex("byProject", "projectId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Projektspeicher konnte nicht geöffnet werden."));
      request.onblocked = () => reject(new Error("Projektspeicher ist durch einen anderen offenen Tab blockiert."));
    }).catch(error => { this.dbPromise = null; throw error; });
    return this.dbPromise;
  }

  async save(project, { assets = [], removeAssetIds = [] } = {}) {
    const db = await this.open();
    const tx = db.transaction(["projects", "assets"], "readwrite");
    const done = transactionResult(tx);
    const projectStore = tx.objectStore("projects");
    const assetStore = tx.objectStore("assets");
    projectStore.put(project);
    for (const asset of assets) assetStore.put({ ...asset, projectId: project.id });
    for (const id of removeAssetIds) assetStore.delete(id);
    await done;
  }

  async get(id) {
    const db = await this.open();
    const tx = db.transaction("projects", "readonly");
    const [project, done] = [requestResult(tx.objectStore("projects").get(id)), transactionResult(tx)];
    const value = await project;
    await done;
    return value || null;
  }

  async list() {
    const db = await this.open();
    const tx = db.transaction("projects", "readonly");
    const result = await requestResult(tx.objectStore("projects").getAll());
    await transactionResult(tx);
    return result.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async getAsset(id) {
    const db = await this.open();
    const tx = db.transaction("assets", "readonly");
    const valuePromise = requestResult(tx.objectStore("assets").get(id));
    const done = transactionResult(tx);
    const value = await valuePromise;
    await done;
    return value || null;
  }

  async getAssetsForProject(projectId) {
    const db = await this.open();
    const tx = db.transaction("assets", "readonly");
    const valuesPromise = requestResult(tx.objectStore("assets").index("byProject").getAll(projectId));
    const done = transactionResult(tx);
    const values = await valuesPromise;
    await done;
    return values;
  }
}
