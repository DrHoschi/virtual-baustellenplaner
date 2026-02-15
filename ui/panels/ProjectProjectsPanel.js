/**
 * ui/panels/ProjectProjectsPanel.js
 * Version: v2.2.0-projectlist-store-fallback (2026-02-15)
 *
 * Fix für Playwright ui-wiring.spec.js:
 * - Test erwartet, dass in der Projektliste eine Projekt-ID wie /P-\d{4}-\d{4}/ sichtbar ist
 * - In CI ist localStorage oft leer (keine projectfile-Keys)
 * - Das aktive Projekt existiert aber im Store (app.project) nach Wizard-Step.
 *
 * Lösung:
 * - Projektliste rendert:
 *   (1) Projekte aus localStorage (baustellenplaner:projectfile:<id>)
 *   (2) PLUS das aktuell aktive Projekt aus dem Store (app.project), falls es
 *       noch nicht als projectfile in localStorage vorhanden ist.
 *
 * Zusätzlich:
 * - Heading "Projektliste" ist garantiert sichtbar (getTitle + <h2>)
 * - Sortierung nach createdAt (neueste zuerst)
 * - Duplizieren -> "(Kopie)" und ID im Format P-YYYY-NNNN
 * - Schnell-Export pro Projekt (exportiert projectfile, falls vorhanden, sonst Wrapper aus app.project)
 */

import { PanelBase } from "./PanelBase.js";

const STORAGE_PREFIX = "baustellenplaner:projectfile:";

/* ========================================================================== */
/*  Helpers                                                                   */
/* ========================================================================== */

function safeJsonParse(txt) { try { return JSON.parse(txt); } catch { return null; } }
function safeJsonStringify(obj) { try { return JSON.stringify(obj, null, 2); } catch { return null; } }

function getAllProjectKeys() {
  return Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
}

function loadProjectFileByKey(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  return safeJsonParse(raw);
}

function saveProjectFileByKey(key, data) {
  const txt = safeJsonStringify(data);
  if (!txt) return false;
  localStorage.setItem(key, txt);
  return true;
}

function generateProjectIdLikeTest() {
  const year = new Date().getFullYear();
  const n = Math.floor(Math.random() * 10000);
  return `P-${year}-${String(n).padStart(4, "0")}`;
}

function sanitizeProjectId(id) {
  const s = String(id || "").trim();
  const q = s.indexOf("?");
  const h = s.indexOf("#");
  let cut = s;
  if (q >= 0) cut = cut.slice(0, q);
  if (h >= 0) cut = cut.slice(0, h);
  return cut.trim();
}

function cloneDeep(obj) {
  try { return structuredClone(obj); } catch {
    try { return JSON.parse(JSON.stringify(obj)); } catch { return null; }
  }
}

function countProjectAssets(project) {
  const list = project && Array.isArray(project.projectAssets) ? project.projectAssets : [];
  const assets = list.length;
  let slots = 0;
  for (const a of list) {
    if (a && Array.isArray(a.slots)) slots += a.slots.length;
  }
  return { assets, slots };
}

/**
 * Versucht, an den Store zu kommen – robust gegen verschiedene PanelBase-Implementierungen.
 * (Wir wollen KEINEN Crash, wenn ein Feld nicht existiert.)
 */
function resolveStore(panelInstance) {
  return (
    panelInstance?.store ||
    panelInstance?.opts?.store ||
    panelInstance?.ctx?.store ||
    panelInstance?.services?.store ||
    window.__BP_STORE__ ||
    null
  );
}

/**
 * Wenn wir nur app.project haben (noch kein projectfile persistiert),
 * bauen wir einen minimalen Wrapper, der exportierbar ist.
 */
function buildWrapperFromAppProject(appProject) {
  const nowIso = new Date().toISOString();
  const id = sanitizeProjectId(appProject?.id);
  return {
    project: appProject || {},
    meta: {
      schema: "baustellenplaner.meta.v1",
      author: "",
      createdAt: nowIso,
      lastOpenedAt: nowIso
    },
    ui: {
      schema: "baustellenplaner.ui.state.v1",
      activeModule: "projectPanel:general",
      window: { leftPanelOpen: true }
    },
    config: {
      schema: "baustellenplaner.ui.config.v1",
      groups: [],
      icons: {}
    },
    app: {
      project: appProject || {},
      settings: {},
      ui: {
        schema: "baustellenplaner.ui.state.v1",
        activeModule: "projectPanel:general",
        window: { leftPanelOpen: true },
        drafts: {}
      },
      activeProject: { kind: "local", id },
      activeProjectId: id
    },
    plugins: { pack: null, manifests: [] }
  };
}

/* ========================================================================== */
/*  Panel                                                                      */
/* ========================================================================== */

export class ProjectProjectsPanel extends PanelBase {
  constructor(opts = {}) {
    super(opts);
    this._q = "";
  }

  // Framework-Heading (falls PanelBase daraus eine Heading rendert)
  getTitle() { return "Projektliste"; }

  renderBody() {
    const root = document.createElement("div");
    root.className = "project-projects-panel";

    // Fallback-Heading (falls Framework keine Heading rendert)
    const h2 = document.createElement("h2");
    h2.textContent = "Projektliste";
    root.appendChild(h2);

    // Toolbar
    const bar = document.createElement("div");
    bar.className = "project-list-toolbar";

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Suchen (Name / ID)…";
    search.value = this._q;
    search.oninput = (e) => { this._q = e.target.value || ""; this.rerender(); };

    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "Aktualisieren";
    refreshBtn.onclick = () => this.rerender();

    bar.append(search, refreshBtn);
    root.appendChild(bar);

    // 1) Projekte aus localStorage
    const keys = getAllProjectKeys();
    let rows = keys.map((key) => {
      const data = loadProjectFileByKey(key);
      const project = data && data.project ? data.project : null;
      if (!project) return null;

      const createdAt = project.createdAt ? new Date(project.createdAt) : new Date(0);
      const id = sanitizeProjectId(project.id);
      const name = String(project.name || "").trim();
      const type = String(project.type || "").trim();
      return { key, data, project, id, name, type, createdAt, _fromStore: false };
    }).filter(Boolean);

    // 2) Fallback: aktives Projekt aus Store (app.project), wenn nicht in localStorage
    const store = resolveStore(this);
    let activeProject = null;
    try {
      const app = store && typeof store.get === "function" ? store.get("app") : null;
      if (app && app.project && typeof app.project === "object") activeProject = app.project;
    } catch { /* ignore */ }

    if (activeProject) {
      const activeId = sanitizeProjectId(activeProject.id);
      const exists = rows.some((r) => r.id === activeId);

      if (!exists && activeId) {
        const createdAt = activeProject.createdAt ? new Date(activeProject.createdAt) : new Date();
        rows.unshift({
          key: null,
          data: null, // keine projectfile-Daten vorhanden
          project: activeProject,
          id: activeId,
          name: String(activeProject.name || "").trim(),
          type: String(activeProject.type || "").trim(),
          createdAt,
          _fromStore: true
        });
      }
    }

    // Sortierung: neueste zuerst
    rows.sort((a, b) => b.createdAt - a.createdAt);

    // Suche
    const q = this._q.trim().toLowerCase();
    if (q) rows = rows.filter((r) => (r.name || "").toLowerCase().includes(q) || (r.id || "").toLowerCase().includes(q));

    // Wenn nichts da ist, zeigen wir trotzdem eine klare Info
    if (rows.length === 0) {
      const p = document.createElement("p");
      p.textContent = "Keine Projekte vorhanden.";
      root.appendChild(p);
      return root;
    }

    const list = document.createElement("div");
    list.className = "project-list";

    for (const r of rows) {
      const card = document.createElement("div");
      card.className = "project-card";

      const title = document.createElement("div");
      title.className = "project-card-title";

      const h3 = document.createElement("h3");
      h3.textContent = r.name || "Unbenanntes Projekt";

      const badge = document.createElement("span");
      badge.className = "project-badge";
      const cnt = countProjectAssets(r.project);
      badge.textContent = `Assets: ${cnt.assets} · Slots: ${cnt.slots}${r._fromStore ? " · (Store)" : ""}`;
      title.append(h3, badge);

      const meta = document.createElement("div");
      meta.className = "project-meta";
      meta.textContent = `ID: ${r.id} · Typ: ${r.type || "-"}`;

      const actions = document.createElement("div");
      actions.className = "project-actions";

      // Öffnen
      const openBtn = document.createElement("button");
      openBtn.textContent = "Öffnen";
      openBtn.onclick = () => {
        const clean = sanitizeProjectId(r.id);
        window.location.href = `?project=${encodeURIComponent("local:" + clean)}`;
      };

      // Duplizieren (funktioniert auch für Store-only rows: wir bauen dann Wrapper)
      const dupBtn = document.createElement("button");
      dupBtn.textContent = "Duplizieren";
      dupBtn.onclick = () => {
        const srcWrapper = r.data ? cloneDeep(r.data) : buildWrapperFromAppProject(r.project);
        if (!srcWrapper || !srcWrapper.project) return;

        const newId = generateProjectIdLikeTest();
        srcWrapper.project.id = newId;
        srcWrapper.project.name = `${r.project.name || "Projekt"} (Kopie)`;
        srcWrapper.project.createdAt = new Date().toISOString();

        // app spiegeln, falls vorhanden
        srcWrapper.app = srcWrapper.app || {};
        srcWrapper.app.project = srcWrapper.project;
        srcWrapper.app.activeProject = { kind: "local", id: newId };
        srcWrapper.app.activeProjectId = newId;

        const newKey = STORAGE_PREFIX + newId;
        saveProjectFileByKey(newKey, srcWrapper);
        this.rerender();
      };

      // Export
      const exportBtn = document.createElement("button");
      exportBtn.textContent = "Export";
      exportBtn.onclick = () => {
        const wrapper = r.data ? r.data : buildWrapperFromAppProject(r.project);
        const txt = safeJsonStringify(wrapper);
        if (!txt) return;

        const blob = new Blob([txt], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        const safeName = (r.project.name || r.id).replace(/[^\w\-äöüÄÖÜß ]+/g, "_").trim();
        a.download = `${safeName || r.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };

      // Löschen (nur wenn localStorage-Key existiert)
      const delBtn = document.createElement("button");
      delBtn.textContent = "Löschen";
      delBtn.disabled = !r.key;
      delBtn.title = r.key ? "" : "Dieses Projekt ist nur im Store (noch nicht gespeichert).";
      delBtn.onclick = () => {
        if (!r.key) return;
        if (!confirm("Projekt wirklich löschen?")) return;
        localStorage.removeItem(r.key);
        this.rerender();
      };

      actions.append(openBtn, dupBtn, exportBtn, delBtn);

      card.append(title, meta, actions);
      list.appendChild(card);
    }

    root.appendChild(list);
    return root;
  }
}
