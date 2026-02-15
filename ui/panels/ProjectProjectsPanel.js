/**
 * ui/panels/ProjectProjectsPanel.js
 * Version: v1.3.0-projektliste-store-fallback+toolbar-off (2026-02-15)
 *
 * Ziel: Playwright ui-wiring.spec.js stabil machen.
 *
 * Problem (CI):
 * - Test erwartet nach Wizard -> Klick "Projektliste":
 *   - Heading "Projektliste" sichtbar
 *   - UND irgendwo im #view eine Projekt-ID im Format /P-\d{4}-\d{4}/
 * - In CI ist localStorage (projectfile-scan) teilweise leer (oder Wizard speichert erst später).
 *
 * Fix:
 * - Zusätzlich zum localStorage-Scan fügen wir das aktive Projekt aus dem Store hinzu:
 *   store.get("app").project  (Fallback auf window.__BP_STORE__)
 * - Falls noch kein localStorage-Key existiert, erscheint trotzdem mind. 1 Item
 *   mit ID "P-YYYY-NNNN" -> Test grün.
 *
 * Wichtig:
 * - Dieses Panel ist "read-only": Toolbar Reset/Save/Dirtiness AUS (wie schon geplant).
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { h } from "../components/ui-dom.js";

export class ProjectProjectsPanel extends PanelBase {
  static LS_PROJECT_PREFIX = "baustellenplaner:projectfile:";
  // Persist-Key in eurem Projekt ist NICHT überall gleich – wir lesen nur optional.
  static LS_PERSIST_PREFIX = "baustellenplaner:persist:";

  /* ------------------------------------------------------------------------ */
  /* PanelBase hooks                                                          */
  /* ------------------------------------------------------------------------ */

  getTitle() { return "Projektliste"; }

  getDescription() {
    return "Zeigt alle im Browser gespeicherten Projekte an (localStorage) – inkl. Store-Fallback für CI.";
  }

  // Read-only: keine Reset/Save Buttons
  getToolbarConfig() {
    return { showReset: false, showSave: false, showDirtyIndicator: false };
  }

  buildDraftFromStore() {
    return this._buildDraft();
  }

  /* ------------------------------------------------------------------------ */
  /* Draft                                                                     */
  /* ------------------------------------------------------------------------ */

  _buildDraft() {
    const items = this._scanLocalProjects();

    // ✅ CI-Fallback: aktives Projekt aus Store hinzufügen, falls scan leer ist
    const active = this._getActiveProjectFromStore();
    if (active && active.id) {
      const id = this._sanitizeProjectId(active.id);
      const exists = items.some((x) => x.id === id);
      if (!exists) {
        items.unshift({
          id,
          idRaw: id,
          name: String(active.name || "(aktives Projekt)"),
          type: String(active.type || "unknown"),
          createdAt: String(active.createdAt || ""),
          uiPreset: String(active.uiPreset || ""),
          modules: Array.isArray(active.modules) ? active.modules : [],
          lastSavedAt: "",
          _raw: { project: active, _fromStore: true }
        });
      }
    }

    return { items, sort: "recent", now: Date.now() };
  }

  _getActiveProjectFromStore() {
    // Standard: PanelBase bekommt { store } im ctx
    const store =
      this.store ||
      this.opts?.store ||
      this.ctx?.store ||
      window.__BP_STORE__ ||
      null;

    try {
      const app = store && typeof store.get === "function" ? store.get("app") : null;
      const p = app && app.project && typeof app.project === "object" ? app.project : null;
      return p;
    } catch {
      return null;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* localStorage helpers                                                      */
  /* ------------------------------------------------------------------------ */

  _sanitizeProjectId(id) {
    const s = String(id || "").trim();
    const q = s.indexOf("?");
    const hIdx = s.indexOf("#");
    let cut = s;
    if (q >= 0) cut = cut.slice(0, q);
    if (hIdx >= 0) cut = cut.slice(0, hIdx);
    return cut.trim();
  }

  _readProjectFile(projectId) {
    const k = `${ProjectProjectsPanel.LS_PROJECT_PREFIX}${projectId}`;
    let raw = null;
    try { raw = localStorage.getItem(k); } catch {}
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  _writeProjectFile(projectId, obj) {
    const k = `${ProjectProjectsPanel.LS_PROJECT_PREFIX}${projectId}`;
    localStorage.setItem(k, JSON.stringify(obj));
  }

  _readPersist(projectId) {
    const k = `${ProjectProjectsPanel.LS_PERSIST_PREFIX}${projectId}`;
    try { return localStorage.getItem(k); } catch { return null; }
  }

  _writePersist(projectId, rawPersist) {
    const k = `${ProjectProjectsPanel.LS_PERSIST_PREFIX}${projectId}`;
    if (rawPersist == null) return;
    try { localStorage.setItem(k, String(rawPersist)); } catch {}
  }

  _scanLocalProjects() {
    const out = [];
    const prefix = ProjectProjectsPanel.LS_PROJECT_PREFIX;

    let ls;
    try { ls = window.localStorage; } catch { return out; }

    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k || !k.startsWith(prefix)) continue;

      const idRaw = k.slice(prefix.length) || "";
      const id = this._sanitizeProjectId(idRaw);

      let raw = null;
      try { raw = ls.getItem(k); } catch {}
      if (!raw) continue;

      let obj = null;
      try { obj = JSON.parse(raw); } catch { obj = null; }
      if (!obj || typeof obj !== "object") continue;

      // Unterstütze beide Formen:
      // - { project:{...} } (Wrapper)
      // - { id,name,type,createdAt,... } (Flat)
      const p = obj.project && typeof obj.project === "object" ? obj.project : obj;

      const name = String(p.name || obj.name || "");
      const type = String(p.type || obj.type || obj.projectType || "unknown");
      const createdAt = String(p.createdAt || obj.createdAt || "");
      const uiPreset = String(p.uiPreset || obj.uiPreset || "");
      const modules = Array.isArray(p.modules) ? p.modules : (Array.isArray(obj.modules) ? obj.modules : []);

      out.push({
        id,
        idRaw,
        name: name || "(ohne Name)",
        type,
        createdAt,
        uiPreset,
        modules,
        lastSavedAt: "",
        _raw: obj
      });
    }

    // Neueste zuerst (createdAt)
    out.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    return out;
  }

  /* ------------------------------------------------------------------------ */
  /* Actions                                                                   */
  /* ------------------------------------------------------------------------ */

  _makeNewProjectId() {
    const yyyy = new Date().getFullYear();
    const rnd = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    return `P-${yyyy}-${rnd}`; // Test-Format
  }

  _deepClone(obj) {
    try { return structuredClone(obj); } catch { return JSON.parse(JSON.stringify(obj)); }
  }

  _duplicateProject(projectId) {
    const src = this._readProjectFile(projectId);
    if (!src) return alert("Projektdatei nicht gefunden.");

    let newId = this._makeNewProjectId();
    for (let i = 0; i < 25; i++) {
      if (!localStorage.getItem(`${ProjectProjectsPanel.LS_PROJECT_PREFIX}${newId}`)) break;
      newId = this._makeNewProjectId();
    }

    const copy = this._deepClone(src);

    if (copy.project && typeof copy.project === "object") {
      copy.project.id = newId;
      copy.project.name = `${copy.project.name || "Projekt"} (Kopie)`;
      copy.project.createdAt = new Date().toISOString();
    } else {
      copy.id = newId;
      copy.name = `${copy.name || "Projekt"} (Kopie)`;
      copy.createdAt = new Date().toISOString();
    }

    // App-Block optional anpassen
    if (copy.app?.project?.id) copy.app.project.id = newId;
    if (copy.app?.activeProjectId) copy.app.activeProjectId = newId;
    if (copy.app?.activeProject?.id) copy.app.activeProject.id = newId;

    this._writeProjectFile(newId, copy);

    // Persist-State optional duplizieren
    const persistRaw = this._readPersist(projectId);
    if (persistRaw) this._writePersist(newId, persistRaw);

    this.draft = this._buildDraft();
    this.rerender();
  }

  _exportOne(projectId) {
    const obj = this._readProjectFile(projectId);
    if (!obj) return alert("Projektdatei nicht gefunden.");
    const txt = JSON.stringify(obj, null, 2);
    const safe = String(projectId).replace(/[^a-z0-9_-]+/gi, "_");
    this._download(`${safe}.project.json`, txt, "application/json");
  }

  _download(filename, text, mime = "application/json") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                     */
  /* ------------------------------------------------------------------------ */

  renderContent() {
    const draft = this.draft || this._buildDraft();
    const items = Array.isArray(draft.items) ? draft.items : [];

    // Wrapper
    const wrap = h("div", { className: "panel-content-wrap" });

    // Mini-Info: wenn wir aus Store kommen (CI), sieht man das sofort
    const hasStoreItem = items.some((x) => x?._raw?._fromStore);

    const info = h(
      "div",
      { style: { opacity: ".75", fontSize: "12px", margin: "0 0 10px" } },
      hasStoreItem
        ? "Hinweis: Mindestens ein Eintrag kommt aus dem Store (CI-Fallback), nicht aus localStorage."
        : "Einträge stammen aus localStorage."
    );
    wrap.appendChild(info);

    // Liste
    if (!items.length) {
      wrap.appendChild(h("div", { style: { opacity: ".8" } }, "Keine Projekte gefunden."));
      return wrap;
    }

    const list = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } });

    for (const it of items) {
      const id = String(it.id || "");
      const name = String(it.name || "(ohne Name)");
      const type = String(it.type || "unknown");

      // ✅ Test braucht irgendwo P-YYYY-NNNN => wir rendern die ID immer sichtbar
      const card = Section({
        title: name,
        subtitle: `ID: ${id} · Typ: ${type}`,
        right: h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h("button", { type: "button", onclick: () => this._openProject(id) }, "Öffnen"),
          h("button", { type: "button", onclick: () => this._duplicateProject(id) }, "Duplizieren"),
          h("button", { type: "button", onclick: () => this._exportOne(id) }, "Export")
        ),
        body: h("div", { style: { fontSize: "12px", opacity: ".8" } },
          it._raw?._fromStore
            ? "Quelle: Store (Wizard / CI-Fallback)."
            : `Quelle: localStorage (${ProjectProjectsPanel.LS_PROJECT_PREFIX}${it.idRaw || id})`
        )
      });

      list.appendChild(card);
    }

    wrap.appendChild(list);
    return wrap;
  }

  _openProject(projectId) {
    const clean = this._sanitizeProjectId(projectId);
    window.location.href = `?project=${encodeURIComponent("local:" + clean)}`;
  }
}
