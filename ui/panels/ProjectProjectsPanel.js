/**
 * ProjectProjectsPanel.js
 * v1.3.3 (2026-02-05)
 *
 * Projektliste (localStorage)
 *
 * Warum diese Datei wichtig ist:
 * - Der Menüpunkt "Liste (localStorage)" sendet ein ui:navigate auf
 *   { panel: 'projectPanel:projects' }.
 * - Wenn panel-registry.js keinen Handler für 'projects' registriert,
 *   bleibt der Inhaltsbereich leer, obwohl "Aktives Modul" korrekt
 *   "panel:projectPanel:projects" anzeigt.
 *
 * Datenquelle:
 * - ProjectWizardPanel schreibt Projekte als JSON in localStorage unter:
 *   baustellenplaner:projectfile:<projectId>
 * - Dieses Panel scannt localStorage nach diesem Prefix.
 */

import { PanelBase } from './PanelBase.js';
import { Section } from '../components/Section.js';
import { h } from '../components/ui-dom.js';

export class ProjectProjectsPanel extends PanelBase {
  /**
   * Gemeinsamer Prefix für lokale Projekt-Dateien.
   * (Muss 1:1 zum Wizard passen.)
   */
  static LS_PROJECT_PREFIX = 'baustellenplaner:projectfile:';

  /**
   * UI-Optionen für die PanelBase-Toolbar.
   * - Wir nutzen hier KEIN "Speichern" im klassischen Sinne,
   *   sondern Aktionen pro Projektkarte.
   */
  static defaultOptions() {
    return {
      title: 'Projekt – Liste (localStorage)',
      subtitle: 'Zeigt alle im Browser gespeicherten Projekte an (localStorage).',
      showToolbar: false,
      showSave: false,
      showReset: false,
      // Dirty-Indicator macht bei Listen-Panel keinen Sinn.
      showDirtyIndicator: false,
    };
  }

  /**
   * Draft-Form dieses Panels.
   * Wir speichern NICHT dauerhaft – es ist nur eine Render-Quelle.
   */
  buildDraftFromStore(_store) {
    return {
      items: this._readAllLocalProjects(),
      sort: 'recent', // 'recent' | 'name' | 'type'
    };
  }

  /**
   * Wird von PanelBase aufgerufen, wenn Draft in Store geschrieben werden soll.
   * Für dieses Panel: kein persistenter Store-Write.
   */
  applyDraftToStore(_store, _draft) {
    // absichtlich leer
  }

  /**
   * UI rendern
   */
  renderBody(_store, draft) {
    const root = h('div', { class: 'panel-body' });

    // --- Kopfbereich / Controls
    const controls = h('div', { class: 'toolbar-row' });

    const btnRefresh = h('button', { class: 'btn', type: 'button' }, 'Aktualisieren');
    btnRefresh.addEventListener('click', () => {
      this.setDraft({
        ...this.getDraft(),
        items: this._readAllLocalProjects(),
      });
      this._renderIntoBody();
    });

    const sortSelect = h('select', { class: 'input', style: 'max-width: 220px;' });
    sortSelect.appendChild(h('option', { value: 'recent' }, 'Sortierung: zuletzt geändert'));
    sortSelect.appendChild(h('option', { value: 'name' }, 'Sortierung: Name'));
    sortSelect.appendChild(h('option', { value: 'type' }, 'Sortierung: Typ'));
    sortSelect.value = draft.sort || 'recent';
    sortSelect.addEventListener('change', () => {
      this.setDraft({ ...this.getDraft(), sort: sortSelect.value });
      this._renderIntoBody();
    });

    controls.appendChild(btnRefresh);
    controls.appendChild(h('div', { style: 'width: 8px;' }));
    controls.appendChild(sortSelect);

    const count = Array.isArray(draft.items) ? draft.items.length : 0;
    controls.appendChild(h('div', { class: 'hint', style: 'margin-left:auto;' }, `Anzahl: ${count}`));

    root.appendChild(controls);

    // --- Liste
    const listSection = new Section({
      title: 'Projektliste',
      subtitle: 'Quelle: localStorage',
    });

    const listWrap = h('div', { class: 'cards' });

    const items = this._sortedItems(draft.items || [], draft.sort || 'recent');

    if (!items.length) {
      listWrap.appendChild(
        h('div', { class: 'hint', style: 'padding: 12px 4px;' },
          'Keine Projekte gefunden. Lege ein neues Projekt im Wizard an – danach hier "Aktualisieren" drücken.'
        )
      );
    } else {
      for (const it of items) {
        listWrap.appendChild(this._renderProjectCard(it));
      }
    }

    listSection.body.appendChild(listWrap);
    root.appendChild(listSection.el);

    // --- Schnell-Export (alle)
    const exportAllSection = new Section({
      title: 'Schnell-Backup',
      subtitle: 'Exportiert alle Projekte als eine JSON-Datei (Browser-Download).',
    });

    const btnExportAll = h('button', { class: 'btn btn-primary', type: 'button' }, 'Alle Projekte exportieren (JSON)');
    btnExportAll.addEventListener('click', () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        schema: 'baustellenplaner-project-backup-v1',
        projects: items.map(p => ({
          id: p.id,
          meta: p.meta,
          data: p.raw,
        })),
      };
      this._downloadJSON(payload, `baustellenplaner-backup_${this._safeDateStamp()}.json`);
    });

    exportAllSection.body.appendChild(btnExportAll);
    root.appendChild(exportAllSection.el);

    return root;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Liest alle Projekt-Dateien aus localStorage.
   */
  _readAllLocalProjects() {
    const items = [];

    // Achtung: localStorage kann in privaten Tabs / iOS-Konstellationen eingeschränkt sein.
    // Wir versuchen es defensiv.
    let ls;
    try {
      ls = window.localStorage;
    } catch (_e) {
      return [];
    }

    const prefix = ProjectProjectsPanel.LS_PROJECT_PREFIX;

    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key || !key.startsWith(prefix)) continue;

      const id = key.slice(prefix.length);

      try {
        const rawText = ls.getItem(key);
        if (!rawText) continue;
        const raw = JSON.parse(rawText);

        // "meta" ist optional. Wir versuchen best-effort die typischen Felder zu zeigen.
        const meta = raw?.meta || raw?.project || raw || {};
        const name = meta?.name || meta?.title || raw?.name || id;
        const type = meta?.type || raw?.type || '—';

        const updatedAt = raw?.updatedAt || raw?.meta?.updatedAt || raw?.meta?.savedAt || raw?.savedAt || null;
        const createdAt = raw?.createdAt || raw?.meta?.createdAt || raw?.meta?.created || raw?.created || null;

        items.push({
          id,
          key,
          meta: { name, type, createdAt, updatedAt },
          raw,
        });
      } catch (_e) {
        // Wenn ein Eintrag kaputt ist, überspringen wir ihn.
        items.push({
          id,
          key,
          meta: { name: id, type: '⚠️ JSON fehlerhaft', createdAt: null, updatedAt: null },
          raw: null,
          parseError: true,
        });
      }
    }

    return items;
  }

  _sortedItems(items, mode) {
    const arr = [...items];

    if (mode === 'name') {
      arr.sort((a, b) => String(a?.meta?.name || a?.id).localeCompare(String(b?.meta?.name || b?.id), 'de'));
      return arr;
    }

    if (mode === 'type') {
      arr.sort((a, b) => String(a?.meta?.type || '').localeCompare(String(b?.meta?.type || ''), 'de'));
      return arr;
    }

    // default: recent
    arr.sort((a, b) => {
      const ta = this._toTime(a?.meta?.updatedAt) || this._toTime(a?.meta?.createdAt) || 0;
      const tb = this._toTime(b?.meta?.updatedAt) || this._toTime(b?.meta?.createdAt) || 0;
      return tb - ta;
    });
    return arr;
  }

  _toTime(v) {
    if (!v) return 0;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }

  _renderProjectCard(it) {
    const name = it?.meta?.name || it?.id;
    const type = it?.meta?.type || '—';

    const card = h('div', { class: 'card', style: 'padding: 12px;' });

    const header = h('div', { class: 'row', style: 'align-items:center;' });
    header.appendChild(h('div', { class: 'card-title', style: 'font-size: 18px; font-weight: 700;' }, name));
    header.appendChild(h('div', { class: 'hint', style: 'margin-left:auto; font-size: 12px;' }, it.id));

    card.appendChild(header);

    const metaLine = h('div', { class: 'hint', style: 'margin-top: 2px;' }, `Typ: ${type}`);
    card.appendChild(metaLine);

    // Zeitstempel (wenn vorhanden)
    const ts = it?.meta?.updatedAt || it?.meta?.createdAt;
    if (ts) {
      card.appendChild(h('div', { class: 'hint', style: 'margin-top: 2px;' }, `Stand: ${String(ts)}`));
    }

    // Buttons
    const actions = h('div', { class: 'row', style: 'gap: 8px; margin-top: 10px; flex-wrap: wrap;' });

    const btnOpen = h('button', { class: 'btn btn-primary', type: 'button' }, 'Öffnen');
    btnOpen.addEventListener('click', () => this._openProject(it.id));

    const btnRename = h('button', { class: 'btn', type: 'button' }, 'Umbenennen');
    btnRename.addEventListener('click', () => this._renameProject(it));

    const btnDup = h('button', { class: 'btn', type: 'button' }, 'Duplizieren');
    btnDup.addEventListener('click', () => this._duplicateProject(it));

    const btnExport = h('button', { class: 'btn', type: 'button' }, 'Export');
    btnExport.addEventListener('click', () => {
      this._downloadJSON(it.raw, `project_${it.id}_${this._safeDateStamp()}.json`);
    });

    const btnDelete = h('button', { class: 'btn btn-danger', type: 'button' }, 'Löschen');
    btnDelete.addEventListener('click', () => this._deleteProject(it));

    actions.appendChild(btnOpen);
    actions.appendChild(btnRename);
    actions.appendChild(btnDup);
    actions.appendChild(btnExport);
    actions.appendChild(btnDelete);

    card.appendChild(actions);

    return card;
  }

  _openProject(projectId) {
    // Wir nutzen den gleichen Mechanismus wie der Wizard: URL-Redirect.
    const url = new URL(window.location.href);
    url.searchParams.set('project', `local:${projectId}`);

    // Hinweis: Reload ist hier bewusst – sorgt für sauberen App-Start mit neuer Projektquelle.
    window.location.href = url.toString();
  }

  _renameProject(it) {
    if (!it || !it.raw) return;

    const currentName = it?.meta?.name || it.id;
    const nextName = window.prompt('Neuer Projektname:', currentName);
    if (nextName == null) return;

    // defensiv: trim
    const clean = String(nextName).trim();
    if (!clean) return;

    // write-back
    const raw = it.raw;
    raw.meta = raw.meta || {};
    raw.meta.name = clean;
    raw.meta.updatedAt = new Date().toISOString();

    try {
      window.localStorage.setItem(it.key, JSON.stringify(raw));
    } catch (_e) {
      // falls Quota o.ä.
      alert('Konnte Projekt nicht umbenennen (localStorage Fehler).');
    }

    // refresh
    this.setDraft({
      ...this.getDraft(),
      items: this._readAllLocalProjects(),
    });
    this._renderIntoBody();
  }

  _duplicateProject(it) {
    if (!it || !it.raw) return;

    const source = it.raw;

    // neue ID (simple): timestamp + random
    const newId = this._makeId();
    const key = `${ProjectProjectsPanel.LS_PROJECT_PREFIX}${newId}`;

    const clone = JSON.parse(JSON.stringify(source));
    clone.meta = clone.meta || {};
    clone.meta.name = `${clone.meta.name || it.id} (Kopie)`;
    clone.meta.createdAt = new Date().toISOString();
    clone.meta.updatedAt = new Date().toISOString();

    try {
      window.localStorage.setItem(key, JSON.stringify(clone));
    } catch (_e) {
      alert('Konnte Projekt nicht duplizieren (localStorage Fehler).');
      return;
    }

    this.setDraft({
      ...this.getDraft(),
      items: this._readAllLocalProjects(),
    });
    this._renderIntoBody();
  }

  _deleteProject(it) {
    if (!it) return;

    const ok = window.confirm(`Projekt wirklich löschen?\n\n${it?.meta?.name || it.id}`);
    if (!ok) return;

    try {
      window.localStorage.removeItem(it.key);
    } catch (_e) {
      alert('Konnte Projekt nicht löschen (localStorage Fehler).');
      return;
    }

    this.setDraft({
      ...this.getDraft(),
      items: this._readAllLocalProjects(),
    });
    this._renderIntoBody();
  }

  _downloadJSON(obj, filename) {
    try {
      const text = JSON.stringify(obj, null, 2);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();

      // etwas später wieder freigeben
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (_e) {
      alert('Export fehlgeschlagen (JSON).');
    }
  }

  _safeDateStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  _makeId() {
    // Kompakt & URL-safe.
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return `P-${t}-${r}`;
  }

  /**
   * PanelBase rendert standardmäßig einmal – wir brauchen hier eine kleine
   * Helferfunktion, um nach Draft-Updates den Body neu aufzubauen.
   */
  _renderIntoBody() {
    if (!this.el) return;

    const body = this.el.querySelector('.panel-body');
    if (!body) return;

    // kompletten Body ersetzen
    const newBody = this.renderBody(this.store, this.getDraft());

    body.replaceWith(newBody);
  }
}
