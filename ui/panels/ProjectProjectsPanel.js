/**
 * ui/panels/ProjectProjectsPanel.js
 * Version: v1.3.0-projectlist-refine-export (2026-02-05)
 *
 * Panel: Projekt → Liste (localStorage)
 *
 * Ziel:
 * - Alle lokal (Browser/localStorage) angelegten Projekte auflisten.
 * - Aktionen: Öffnen, Umbenennen, Duplizieren, Löschen, Export/Backup (Download als JSON).
 *
 * Hinweis:
 * - Wizard legt Projekte als "baustellenplaner:projectfile:<id>" ab (Projekt-Datei).
 * - Persistor speichert weitere Daten unter "baustellenplaner:project:<id>" (App-State).
 * - Wir bieten einen schnellen Download beider Teile als kombiniertes JSON.
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { h } from "../components/ui-dom.js";

function nowIso() {
  try { return new Date().toISOString(); } catch { return ""; }
}

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function formatDt(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    // kurze, stabile Darstellung
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return String(iso);
  }
}

function downloadText(filename, text, mime = "application/json;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch {}
    try { a.remove(); } catch {}
  }, 500);
}

function makeNewIdLike(oldId) {
  // oldId: "P-YYYY-RRRR"
  const d = new Date();
  const yyyy = d.getFullYear();
  const rnd = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `P-${yyyy}-${rnd}`;
}

export class ProjectProjectsPanel extends PanelBase {
  getTitle() { return "Projekt – Liste (localStorage)"; }

  getDescription() {
    return "Zeigt alle im Browser gespeicherten Projekte an (localStorage).";
  }

  buildDraftFromStore() {
    // Dieses Panel schreibt keinen Draft in den globalen Store.
    return {
      sort: "updatedDesc", // updatedDesc | updatedAsc | nameAsc | nameDesc | idAsc | idDesc
      filter: ""
    };
  }

  applyDraftToStore(_draft) {
    // kein-op
  }

  _readAllProjectsFromLocalStorage() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!key.startsWith("baustellenplaner:projectfile:")) continue;

      const id = key.slice("baustellenplaner:projectfile:".length);
      const raw = localStorage.getItem(key);
      const projectfile = safeJsonParse(raw || "");

      // minimal fallback, falls JSON kaputt ist:
      const name = projectfile?.name || projectfile?.project?.name || id;
      const type = projectfile?.type || projectfile?.project?.type || "";
      const createdAt = projectfile?.createdAt || projectfile?.meta?.createdAt || "";
      const updatedAt = projectfile?.updatedAt || projectfile?.meta?.updatedAt || "";

      out.push({
        id,
        key,
        name,
        type,
        createdAt,
        updatedAt,
        projectfile
      });
    }
    return out;
  }

  _sort(list, sortKey) {
    const by = (fn) => (a, b) => {
      const av = fn(a);
      const bv = fn(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    };

    const byStr = (k) => by((x) => String(x[k] || "").toLowerCase());
    const byId = byStr("id");
    const byName = byStr("name");

    const byUpdated = by((x) => {
      const t = Date.parse(x.updatedAt || x.createdAt || "");
      return Number.isFinite(t) ? t : -1;
    });

    const byCreated = by((x) => {
      const t = Date.parse(x.createdAt || "");
      return Number.isFinite(t) ? t : -1;
    });

    const L = [...list];

    switch (sortKey) {
      case "updatedAsc":  L.sort(byUpdated); break;
      case "updatedDesc": L.sort((a,b)=>-byUpdated(a,b)); break;
      case "createdAsc":  L.sort(byCreated); break;
      case "createdDesc": L.sort((a,b)=>-byCreated(a,b)); break;
      case "nameDesc":    L.sort((a,b)=>-byName(a,b)); break;
      case "nameAsc":     L.sort(byName); break;
      case "idDesc":      L.sort((a,b)=>-byId(a,b)); break;
      case "idAsc":
      default:            L.sort(byId); break;
    }

    return L;
  }

  _matchesFilter(p, filter) {
    if (!filter) return true;
    const f = filter.trim().toLowerCase();
    if (!f) return true;
    return (
      String(p.id).toLowerCase().includes(f) ||
      String(p.name).toLowerCase().includes(f) ||
      String(p.type).toLowerCase().includes(f)
    );
  }

  _openProject(id) {
    // Konvention in loader: ?project=local:<id>
    const url = new URL(window.location.href);
    url.searchParams.set("project", `local:${id}`);
    // Reload ist okay/gewollt (du hattest gesagt: wenn das so gewollt ist, lassen wir es so)
    window.location.href = url.toString();
  }

  _renameProject(p) {
    const next = prompt("Neuer Projektname:", p.name || "");
    if (next == null) return; // abgebrochen
    const name = String(next).trim();
    if (!name) {
      alert("Name darf nicht leer sein.");
      return;
    }

    const obj = p.projectfile || {};
    // wir setzen mehrfach, damit es robust zu älteren Strukturen bleibt
    obj.name = name;
    if (obj.project && typeof obj.project === "object") obj.project.name = name;
    obj.updatedAt = nowIso();
    obj.meta = obj.meta || {};
    obj.meta.updatedAt = obj.updatedAt;

    localStorage.setItem(p.key, JSON.stringify(obj, null, 2));
    this._refresh();
  }

  _duplicateProject(p) {
    const newId = makeNewIdLike(p.id);
    const newKey = `baustellenplaner:projectfile:${newId}`;

    const obj = structuredClone(p.projectfile || {});
    obj.id = newId;
    obj.projectId = newId;
    obj.createdAt = nowIso();
    obj.updatedAt = obj.createdAt;
    obj.meta = obj.meta || {};
    obj.meta.createdAt = obj.createdAt;
    obj.meta.updatedAt = obj.updatedAt;

    // Name leicht markieren
    const baseName = obj.name || (obj.project && obj.project.name) || p.name || newId;
    const name = `${baseName} (Kopie)`;
    obj.name = name;
    if (obj.project && typeof obj.project === "object") obj.project.name = name;

    localStorage.setItem(newKey, JSON.stringify(obj, null, 2));

    // Optional: auch den Persist-State duplizieren (wenn vorhanden)
    const stateKeyOld = `baustellenplaner:project:${p.id}`;
    const stateKeyNew = `baustellenplaner:project:${newId}`;
    const rawState = localStorage.getItem(stateKeyOld);
    if (rawState) {
      try { localStorage.setItem(stateKeyNew, rawState); } catch {}
    }

    this._refresh();
  }

  _deleteProject(p) {
    const ok = confirm(`Projekt wirklich löschen?\n\n${p.id}\n${p.name}`);
    if (!ok) return;

    // Projektfile
    localStorage.removeItem(p.key);

    // Persist-State (falls vorhanden)
    localStorage.removeItem(`baustellenplaner:project:${p.id}`);

    this._refresh();
  }

  _exportProject(p) {
    const bundle = {
      schema: "baustellenplaner.project.export.v1",
      exportedAt: nowIso(),
      projectId: p.id,
      projectfile: p.projectfile || null,
      state: null
    };

    const rawState = localStorage.getItem(`baustellenplaner:project:${p.id}`);
    if (rawState) bundle.state = safeJsonParse(rawState) || rawState;

    const filename = `baustellenplaner_${p.id}_backup.json`;
    downloadText(filename, JSON.stringify(bundle, null, 2));
  }

  _exportAll(list) {
    const bundle = {
      schema: "baustellenplaner.project.exportAll.v1",
      exportedAt: nowIso(),
      projects: []
    };

    for (const p of list) {
      const rawState = localStorage.getItem(`baustellenplaner:project:${p.id}`);
      bundle.projects.push({
        projectId: p.id,
        projectfile: p.projectfile || null,
        state: rawState ? (safeJsonParse(rawState) || rawState) : null
      });
    }

    downloadText("baustellenplaner_backup_all.json", JSON.stringify(bundle, null, 2));
  }

  _refresh() {
    // Wir nutzen nur "render()" – keine komplexen Diff-Algorithmen.
    // PanelBase stellt typischerweise this.invalidate() oder this.requestRender() bereit,
    // aber falls nicht, reicht ein harter re-render via this.renderTo(...)
    try {
      this._render();
    } catch (e) {
      console.warn("[ProjectProjectsPanel] refresh failed:", e);
    }
  }

  async render(container) {
    // PanelBase ruft render() mit Container, wir speichern ihn für _refresh()
    this._container = container;
    this._render();
  }

  _render() {
    const container = this._container;
    if (!container) return;

    const draft = this.draft || this.buildDraftFromStore();
    const sortKey = draft.sort || "updatedDesc";
    const filter = draft.filter || "";

    let list = this._readAllProjectsFromLocalStorage();
    list = list.filter(p => this._matchesFilter(p, filter));
    list = this._sort(list, sortKey);

    const header = h("div", { class: "bp-row bp-row--between bp-gap-8", style: "align-items:center; flex-wrap:wrap;" },
      h("div", { style: "min-width: 240px;" },
        h("div", { class: "bp-muted", style: "font-size: 12px;" }, "Quelle: localStorage"),
        h("div", { style: "font-size: 18px; font-weight: 700;" }, `Anzahl: ${list.length}`)
      ),
      h("div", { class: "bp-row bp-gap-8", style: "align-items:center; flex-wrap:wrap;" },
        h("input", {
          class: "bp-input",
          placeholder: "Filter (Name/ID/Typ)…",
          value: filter,
          oninput: (e) => { this.draft = { ...draft, filter: e.target.value }; this._refresh(); }
        }),
        h("select", {
          class: "bp-input",
          value: sortKey,
          onchange: (e) => { this.draft = { ...draft, sort: e.target.value }; this._refresh(); }
        },
          h("option", { value: "updatedDesc" }, "Zuletzt geändert ↓"),
          h("option", { value: "updatedAsc" }, "Zuletzt geändert ↑"),
          h("option", { value: "createdDesc" }, "Erstellt ↓"),
          h("option", { value: "createdAsc" }, "Erstellt ↑"),
          h("option", { value: "nameAsc" }, "Name A→Z"),
          h("option", { value: "nameDesc" }, "Name Z→A"),
          h("option", { value: "idAsc" }, "ID A→Z"),
          h("option", { value: "idDesc" }, "ID Z→A"),
        ),
        h("button", {
          class: "bp-btn",
          onclick: () => this._refresh()
        }, "Aktualisieren"),
        h("button", {
          class: "bp-btn bp-btn--primary",
          onclick: () => this._exportAll(list),
          title: "Alle Projekte als JSON herunterladen"
        }, "Backup (alle)")
      )
    );

    const cards = list.map(p => {
      const meta = [
        p.type ? `Typ: ${p.type}` : "",
        p.updatedAt ? `Geändert: ${formatDt(p.updatedAt)}` : (p.createdAt ? `Erstellt: ${formatDt(p.createdAt)}` : ""),
      ].filter(Boolean).join(" · ");

      return h("div", { class: "bp-card", style: "padding:12px; margin-top:10px;" },
        h("div", { class: "bp-row bp-row--between bp-gap-8", style: "align-items:flex-start; flex-wrap:wrap;" },
          h("div", {},
            h("div", { style: "font-size: 22px; font-weight: 800; letter-spacing: 0.2px;" }, p.name || p.id),
            h("div", { class: "bp-muted", style: "margin-top:4px;" }, p.id),
            meta ? h("div", { class: "bp-muted", style: "margin-top:6px; font-size: 12px;" }, meta) : null
          ),
          h("div", { class: "bp-row bp-gap-8", style: "align-items:center; flex-wrap:wrap;" },
            h("button", { class: "bp-btn bp-btn--primary", onclick: () => this._openProject(p.id) }, "Öffnen"),
            h("button", { class: "bp-btn", onclick: () => this._renameProject(p) }, "Umbenennen"),
            h("button", { class: "bp-btn", onclick: () => this._duplicateProject(p) }, "Duplizieren"),
            h("button", { class: "bp-btn", onclick: () => this._exportProject(p) }, "Export/Backup"),
            h("button", { class: "bp-btn bp-btn--danger", onclick: () => this._deleteProject(p) }, "Löschen"),
          )
        )
      );
    });

    // Render (clear + append)
    container.innerHTML = "";
    container.appendChild(
      h(Section, {
        title: this.getTitle(),
        description: this.getDescription()
      }, header, ...cards)
    );
  }
}
