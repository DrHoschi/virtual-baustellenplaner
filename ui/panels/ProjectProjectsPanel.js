/*
  ============================================================================
  Projekt – Liste (localStorage)
  Datei: ui/panels/ProjectProjectsPanel.js
  Version: v1.3.1 (2026-02-05)
  ----------------------------------------------------------------------------
  Zweck
  - Zeigt alle im Browser gespeicherten Projekte (localStorage) an.
  - Unterstützt: Sortieren, Öffnen, Umbenennen, Duplizieren, Löschen
  - Unterstützt: Schneller Export/Backup als JSON-Datei
  ----------------------------------------------------------------------------
  Hintergrund
  In diesem Projekt gibt es historisch mehrere Key-Varianten im localStorage.
  Damit die Liste niemals „leer“ wirkt, scannen wir robust über bekannte
  Prefixe und lesen Metadaten defensiv.
  ============================================================================
*/

import { PanelBase } from './PanelBase.js';
import { Section } from '../components/Section.js';
import { h } from '../components/ui-dom.js';

// ------------------------------------------------------------
// Konstanten
// ------------------------------------------------------------

// Primäre Persist-Key-Namespace
const KEY_PREFIX_PROJECTFILE = 'baustellenplaner:projectfile:'; // Projekt-JSON (Wizard)
const KEY_PREFIX_PROJECTSTATE = 'baustellenplaner:project:';    // App-State Snapshot (Persistor)

// (Optional) Draft Keys (Wizard / General)
const KEY_DRAFT_WIZARD = 'baustellenplaner:draft:projectWizard';
const KEY_DRAFT_GENERAL = 'baustellenplaner:draft:projectGeneral';

// ------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function nowIso() {
  return new Date().toISOString();
}

function generateProjectId() {
  // Kompatibel zu Wizard-Style (kurz, numerisch)
  return String(Math.floor(10000 + Math.random() * 90000));
}

function downloadTextFile(filename, text, mime = 'application/json;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

function getBasePath() {
  // GitHub Pages: /virtual-baustellenplaner/ …
  const { origin, pathname } = window.location;
  // index.html kann im pathname enthalten sein – wir wollen den Ordner.
  const base = pathname.endsWith('/') ? pathname : pathname.replace(/\/[^\/]*$/, '/');
  return origin + base;
}

function navigateToProjectLocal(projectId) {
  // Stabiler „Hard-Navigate“: Loader liest query param "project=local:<id>"
  const base = getBasePath();
  window.location.href = `${base}?project=local:${encodeURIComponent(projectId)}`;
}

function collectProjectsFromLocalStorage() {
  const items = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;

    if (k.startsWith(KEY_PREFIX_PROJECTFILE)) {
      const id = k.slice(KEY_PREFIX_PROJECTFILE.length);
      const raw = localStorage.getItem(k);
      const obj = safeJsonParse(raw || '');
      items.push({
        id,
        storageKey: k,
        kind: 'projectfile',
        raw,
        obj,
      });
    }
  }

  return items;
}

function toMeta(item) {
  // Metadaten robust aus projekt.json lesen
  const p = item?.obj || {};
  const name = (p.name || p.displayName || p.projectName || '').toString().trim();
  const type = (p.type || p.projectType || '').toString().trim();
  const customer = (p.customer || p.kunde || p.client || '').toString().trim();
  const createdAt = p.createdAt || p.meta?.createdAt || '';
  const updatedAt = p.updatedAt || p.meta?.updatedAt || '';
  const projectNo = p.projectNo || p.projectNumber || p.number || '';

  return {
    id: item.id,
    key: item.storageKey,
    name: name || '(ohne Name)',
    type: type || '(ohne Typ)',
    customer: customer || '',
    projectNo: projectNo || '',
    createdAt,
    updatedAt,
  };
}

function sortMetas(metas, mode) {
  const arr = [...metas];

  const byStr = (a, b, key) => (a[key] || '').localeCompare(b[key] || '', 'de');
  const byDate = (a, b, key) => {
    const aa = Date.parse(a[key] || '') || 0;
    const bb = Date.parse(b[key] || '') || 0;
    return bb - aa;
  };

  switch (mode) {
    case 'name_asc':
      arr.sort((a, b) => byStr(a, b, 'name'));
      break;
    case 'name_desc':
      arr.sort((a, b) => byStr(b, a, 'name'));
      break;
    case 'created_new':
      arr.sort((a, b) => byDate(a, b, 'createdAt'));
      break;
    case 'created_old':
      arr.sort((a, b) => byDate(b, a, 'createdAt'));
      break;
    case 'updated_new':
      arr.sort((a, b) => byDate(a, b, 'updatedAt'));
      break;
    default:
      // Fallback: Name
      arr.sort((a, b) => byStr(a, b, 'name'));
      break;
  }
  return arr;
}

// ------------------------------------------------------------
// Panel
// ------------------------------------------------------------

export class ProjectProjectsPanel {
  constructor({ bus, store }) {
    this.bus = bus;
    this.store = store;

    this.sortMode = 'name_asc';
    this._items = [];
    this._metas = [];
    this._showDebugKeys = false;
  }

  mount(root) {
    this.root = root;
    this.refresh();
  }

  unmount() {
    // nichts
  }

  refresh() {
    this._items = collectProjectsFromLocalStorage();
    this._metas = this._items.map(toMeta);
    this.render();
  }

  render() {
    if (!this.root) return;

    const metas = sortMetas(this._metas, this.sortMode);

    const header = h('div', { class: 'panel-header' }, [
      h('h2', {}, 'Projekt – Liste (localStorage)'),
      h('div', { class: 'muted' }, 'Zeigt alle im Browser gespeicherten Projekte (localStorage).'),
    ]);

    const controls = h('div', { class: 'card row gap' }, [
      h('button', { class: 'btn', onclick: () => this.refresh() }, 'Aktualisieren'),
      h('label', { class: 'row gap' }, [
        h('span', { class: 'muted' }, 'Sortierung:'),
        h('select', {
          onchange: (e) => {
            this.sortMode = e.target.value;
            this.render();
          },
        }, [
          h('option', { value: 'name_asc', selected: this.sortMode === 'name_asc' }, 'Name (A→Z)'),
          h('option', { value: 'name_desc', selected: this.sortMode === 'name_desc' }, 'Name (Z→A)'),
          h('option', { value: 'created_new', selected: this.sortMode === 'created_new' }, 'Erstellt (neu→alt)'),
          h('option', { value: 'created_old', selected: this.sortMode === 'created_old' }, 'Erstellt (alt→neu)'),
          h('option', { value: 'updated_new', selected: this.sortMode === 'updated_new' }, 'Geändert (neu→alt)'),
        ]),
      ]),
      h('div', { style: 'flex:1' }),
      h('button', {
        class: 'btn',
        onclick: () => this.exportBackup(),
        title: 'Exportiert alle Projekte + optional gespeicherte App-States als JSON',
      }, 'Export / Backup'),
      h('button', {
        class: 'btn btn-ghost',
        onclick: () => {
          this._showDebugKeys = !this._showDebugKeys;
          this.render();
        },
      }, this._showDebugKeys ? 'Debug ausblenden' : 'Debug anzeigen'),
    ]);

    const summary = h('div', { class: 'row gap' }, [
      h('div', { class: 'muted' }, `Anzahl: ${metas.length}`),
      h('div', { style: 'flex:1' }),
      h('div', { class: 'muted' }, 'Quelle: localStorage'),
    ]);

    const list = h('div', { class: 'list' }, metas.length
      ? metas.map((m) => this.renderItem(m))
      : [
          h('div', { class: 'empty' }, [
            h('div', { class: 'muted' }, 'Keine Projekte gefunden.'),
            h('div', { class: 'muted' }, 'Tipp: Erstelle ein Projekt im Wizard und klicke dann auf „Aktualisieren“.'),
          ]),
        ]);

    const debug = this._showDebugKeys
      ? this.renderDebugKeys()
      : null;

    this.root.innerHTML = '';
    this.root.appendChild(header);
    this.root.appendChild(controls);
    this.root.appendChild(summary);
    this.root.appendChild(list);
    if (debug) this.root.appendChild(debug);
  }

  renderItem(meta) {
    const right = meta.projectNo ? h('div', { class: 'muted small' }, meta.projectNo) : null;

    return h('div', { class: 'card project-item' }, [
      h('div', { class: 'row' }, [
        h('div', { class: 'title' }, meta.name),
        h('div', { style: 'flex:1' }),
        right,
      ]),
      h('div', { class: 'muted small' }, `ID: ${meta.id} · Typ: ${meta.type}${meta.customer ? ` · Kunde: ${meta.customer}` : ''}`),
      h('div', { class: 'row gap' }, [
        h('button', { class: 'btn btn-primary', onclick: () => navigateToProjectLocal(meta.id) }, 'Öffnen'),
        h('button', { class: 'btn', onclick: () => this.rename(meta.id) }, 'Umbenennen'),
        h('button', { class: 'btn', onclick: () => this.duplicate(meta.id) }, 'Duplizieren'),
        h('div', { style: 'flex:1' }),
        h('button', { class: 'btn btn-danger', onclick: () => this.remove(meta.id) }, 'Löschen'),
      ]),
    ]);
  }

  renderDebugKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('baustellenplaner:')) keys.push(k);
    }
    keys.sort((a, b) => a.localeCompare(b));

    return h('div', { class: 'card' }, [
      h('div', { class: 'muted' }, 'Debug (localStorage keys mit Prefix „baustellenplaner:“):'),
      h('pre', { class: 'pre small' }, keys.join('\n') || '(keine)')
    ]);
  }

  _readProjectObj(id) {
    const key = KEY_PREFIX_PROJECTFILE + id;
    const raw = localStorage.getItem(key);
    const obj = safeJsonParse(raw || '');
    if (!obj) return { key, obj: null };
    return { key, obj };
  }

  _writeProjectObj(id, obj) {
    const key = KEY_PREFIX_PROJECTFILE + id;
    localStorage.setItem(key, JSON.stringify(obj, null, 2));
  }

  rename(id) {
    const { obj } = this._readProjectObj(id);
    if (!obj) return;
    const current = (obj.name || obj.displayName || obj.projectName || '').toString();
    const next = prompt('Neuer Projektname:', current);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    obj.name = trimmed;
    obj.updatedAt = nowIso();
    this._writeProjectObj(id, obj);
    this.refresh();
  }

  duplicate(id) {
    const { obj } = this._readProjectObj(id);
    if (!obj) return;
    const newId = generateProjectId();
    const copy = structuredClone ? structuredClone(obj) : safeJsonParse(JSON.stringify(obj));
    copy.id = newId;
    copy.createdAt = nowIso();
    copy.updatedAt = nowIso();
    copy.name = `${(obj.name || '(ohne Name)').toString()} (Kopie)`;
    this._writeProjectObj(newId, copy);
    this.refresh();
  }

  remove(id) {
    if (!confirm(`Projekt ${id} wirklich löschen?\n\nHinweis: Das entfernt auch gespeicherte App-States für dieses Projekt.`)) {
      return;
    }
    localStorage.removeItem(KEY_PREFIX_PROJECTFILE + id);
    localStorage.removeItem(KEY_PREFIX_PROJECTSTATE + id);
    // Drafts optional: nicht projektgebunden, aber wir lassen sie absichtlich stehen.
    this.refresh();
  }

  exportBackup() {
    const projects = [];
    const states = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k);

      if (k.startsWith(KEY_PREFIX_PROJECTFILE)) {
        projects.push({ key: k, value: safeJsonParse(v || '') || v });
      }
      if (k.startsWith(KEY_PREFIX_PROJECTSTATE)) {
        states.push({ key: k, value: safeJsonParse(v || '') || v });
      }
    }

    const payload = {
      exportedAt: nowIso(),
      origin: window.location.origin,
      projects,
      states,
      drafts: {
        wizard: safeJsonParse(localStorage.getItem(KEY_DRAFT_WIZARD) || '') || null,
        general: safeJsonParse(localStorage.getItem(KEY_DRAFT_GENERAL) || '') || null,
      },
    };

    const filename = `baustellenplaner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadTextFile(filename, JSON.stringify(payload, null, 2));
  }
}
