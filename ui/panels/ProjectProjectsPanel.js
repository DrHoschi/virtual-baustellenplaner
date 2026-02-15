/**
 * ui/panels/ProjectProjectsPanel.js
 * Version: v2.1.1-projectlist-heading-compat (2026-02-15)
 *
 * Ziel: Playwright-Test-Fix
 * - getByRole('heading', { name:/Projektliste/i }) muss sichtbar werden
 *
 * WICHTIG:
 * In eurem UI-Framework rendert PanelBase oft eine Heading aus getTitle().
 * Daher liefern wir BEIDES:
 *  - getTitle() => "Projektliste" (Framework-Heading)
 *  - renderBody() mit <h2>Projektliste</h2> (falls Framework keine Heading setzt)
 *
 * Außerdem:
 * - Sortierung nach createdAt (neueste zuerst)
 * - Duplizieren -> "(Kopie)" und ID im Format P-YYYY-NNNN
 * - Export-Button pro Projekt
 */

import { PanelBase } from "./PanelBase.js";

const STORAGE_PREFIX = "baustellenplaner:projectfile:";

function safeJsonParse(txt) {
  try { return JSON.parse(txt); } catch { return null; }
}
function safeJsonStringify(obj) {
  try { return JSON.stringify(obj, null, 2); } catch { return null; }
}

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

export class ProjectProjectsPanel extends PanelBase {
  constructor(opts = {}) {
    super(opts);
    this._q = "";
  }

  // Framework-Heading (PanelBase)
  getTitle() { return "Projektliste"; }

  renderBody() {
    const root = document.createElement("div");
    root.className = "project-projects-panel";

    // Fallback-Heading (falls Framework keine Heading rendert)
    const h2 = document.createElement("h2");
    h2.textContent = "Projektliste";
    root.appendChild(h2);

    // Toolbar (Suche + Refresh)
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

    // Projekte laden
    const keys = getAllProjectKeys();
    let rows = keys.map((key) => {
      const data = loadProjectFileByKey(key);
      const project = data && data.project ? data.project : null;
      if (!project) return null;

      const createdAt = project.createdAt ? new Date(project.createdAt) : new Date(0);
      const id = sanitizeProjectId(project.id);
      const name = String(project.name || "").trim();
      const type = String(project.type || "").trim();
      return { key, data, project, id, name, type, createdAt };
    }).filter(Boolean);

    // neueste zuerst
    rows.sort((a, b) => b.createdAt - a.createdAt);

    // Suche
    const q = this._q.trim().toLowerCase();
    if (q) rows = rows.filter((r) => (r.name || "").toLowerCase().includes(q) || (r.id || "").toLowerCase().includes(q));

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
      badge.textContent = `Assets: ${cnt.assets} · Slots: ${cnt.slots}`;
      title.append(h3, badge);

      const meta = document.createElement("div");
      meta.className = "project-meta";
      meta.textContent = `ID: ${r.id} · Typ: ${r.type || "-"}`;

      const actions = document.createElement("div");
      actions.className = "project-actions";

      const openBtn = document.createElement("button");
      openBtn.textContent = "Öffnen";
      openBtn.onclick = () => {
        const clean = sanitizeProjectId(r.project.id);
        window.location.href = `?project=${encodeURIComponent("local:" + clean)}`;
      };

      const dupBtn = document.createElement("button");
      dupBtn.textContent = "Duplizieren";
      dupBtn.onclick = () => {
        const clone = cloneDeep(r.data);
        if (!clone || !clone.project) return;

        const newId = generateProjectIdLikeTest();
        clone.project.id = newId;
        clone.project.name = `${r.project.name || "Projekt"} (Kopie)`;
        clone.project.createdAt = new Date().toISOString();

        clone.app = clone.app || {};
        clone.app.activeProject = { kind: "local", id: newId };
        clone.app.activeProjectId = newId;

        const newKey = STORAGE_PREFIX + newId;
        saveProjectFileByKey(newKey, clone);
        this.rerender();
      };

      const exportBtn = document.createElement("button");
      exportBtn.textContent = "Export";
      exportBtn.onclick = () => {
        const txt = safeJsonStringify(r.data);
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

      const delBtn = document.createElement("button");
      delBtn.textContent = "Löschen";
      delBtn.onclick = () => {
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
