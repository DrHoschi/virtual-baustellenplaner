/**
 * ProjectProjectsPanel.js
 * v1.3.4-clean-standard-migration (2026-02-08)
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
   * Legacy-Prefixe (Kompatibilität).
   *
   * Hintergrund:
   * - iOS/Safari oder frühere Stände können Projekte unter anderen Keys abgelegt haben.
   * - Außerdem kann man (versehentlich) auf einem anderen Origin testen → localStorage wirkt leer.
   *
   * Wir scannen daher mehrere mögliche Prefixe und bieten eine Migration an.
   */
  static LS_PROJECT_PREFIX_LEGACY = [
    'baustellenplaner:projectfile:',
    'baustellenplaner:projectFile:',
    'baustellenplaner:project:',
    'bp:projectfile:',
  ];

  /** Standard-Key (Ziel) für Migration */
  static LS_PROJECT_PREFIX_CANON = 'baustellenplaner:projectfile:';

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

    // --- Diagnose (super wichtig bei "plötzlich leer")
    const diag = this._diagnoseLocalStorage();


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

    // Diagnose-Info anzeigen (wie viele Keys wurden gefunden)
    controls.appendChild(
      h('div', { class: 'hint', style: 'margin-left: 12px; opacity:.8;' }, `LS: ${diag.totalKeys} Keys · Projekte: ${diag.foundProjects} · Prefix: ${diag.usedPrefixes}`)
    );

    // Wenn Legacy-Projekte gefunden wurden → Migration anbieten
    if (diag.legacyProjects > 0) {
      const btnMig = h('button', { class: 'btn', type: 'button' }, `Legacy migrieren (${diag.legacyProjects})`);
      btnMig.addEventListener('click', () => {
        const res = this._migrateLegacyProjects();
        alert(`Migration: ${res.migrated} migriert, ${res.skipped} übersprungen.\n\nDanach bitte einmal "Aktualisieren".`);
        // refresh
        this.setDraft({ ...this.getDraft(), items: this._readAllLocalProjects() });
        this._renderIntoBody();
      });
      controls.appendChild(btnMig);
    }

    // Import-Button (wenn localStorage wirklich leer ist)
    const btnImport = h('button', { class: 'btn', type: 'button' }, 'Import Backup (JSON)');
    btnImport.addEventListener('click', () => this._openImportDialog());
    controls.appendChild(btnImport);


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
          `Keine Projekte gefunden.

Tipp: Wenn hier früher Projekte waren und jetzt plötzlich alles leer ist, dann ist meist der localStorage leer / anderer Origin / privater Tab.
- Prüfe: iOS Safari Privatmodus? (localStorage kann blockiert sein)
- Prüfe: gleiche Domain wie früher?

Du kannst oben „Import Backup (JSON)“ nutzen oder im Wizard ein neues Projekt anlegen.`
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

  // Defensiv: localStorage kann in privaten Tabs / iOS-Konstellationen eingeschränkt sein.
  let ls;
  try { ls = window.localStorage; } catch (_e) { return []; }

  const prefixes = ProjectProjectsPanel.LS_PROJECT_PREFIX_LEGACY;
  const canonPrefix = ProjectProjectsPanel.LS_PROJECT_PREFIX_CANON;

  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    if (!key) continue;

    // 1) exakte Prefix-Matches
    let matchedPrefix = null;
    for (const p of prefixes) {
      if (key.startsWith(p)) { matchedPrefix = p; break; }
    }

    // 2) Fallback: heuristisch (falls jemand Keys umbenannt hat)
    //    Wir nehmen nur Keys, die "projectfile" enthalten UND nach JSON aussehen.
    if (!matchedPrefix) {
      if (!key.includes('projectfile')) continue;
      matchedPrefix = key.slice(0, key.indexOf('projectfile') + 'projectfile:'.length);
    }

    const id = key.slice(matchedPrefix.length);

    try {
      const rawText = ls.getItem(key);
      if (!rawText) continue;
      const raw = JSON.parse(rawText);

      const meta = raw?.meta || raw?.project || raw || {};
      const name = meta?.name || meta?.title || raw?.name || id;
      const type = meta?.type || raw?.type || '—';

      const updatedAt = raw?.updatedAt || raw?.meta?.updatedAt || raw?.meta?.savedAt || raw?.savedAt || null;
      const createdAt = raw?.createdAt || raw?.meta?.createdAt || raw?.meta?.created || raw?.created || null;

      items.push({
        id,
        key,
        sourcePrefix: matchedPrefix,
        isLegacy: matchedPrefix !== canonPrefix,
        meta: { name, type, createdAt, updatedAt },
        raw,
      });
    } catch (_e) {
      items.push({
        id,
        key,
        sourcePrefix: matchedPrefix,
        isLegacy: matchedPrefix !== canonPrefix,
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
// ===========================================================================
// Diagnose + Migration + Import
// ===========================================================================

/**
 * Kleine Diagnose: Wie viele Keys/Projekte sind im localStorage sichtbar?
 * Damit du sofort siehst, ob Safari/Origin/Privatmodus gerade "leer" ist.
 */
_diagnoseLocalStorage() {
  let ls;
  try { ls = window.localStorage; } catch (_e) {
    return { totalKeys: 0, foundProjects: 0, legacyProjects: 0, usedPrefixes: 'blocked' };
  }
  const totalKeys = ls.length;
  const items = this._readAllLocalProjects();
  const foundProjects = items.length;
  const legacyProjects = items.filter(x => x && x.isLegacy).length;
  const usedPrefixes = ProjectProjectsPanel.LS_PROJECT_PREFIX_LEGACY.join(' | ');
  return { totalKeys, foundProjects, legacyProjects, usedPrefixes };
}

/**
 * Migriert Projekte, die unter einem Legacy-Prefix liegen, auf den Canon-Prefix.
 * Wir überschreiben NICHT, wenn das Ziel schon existiert.
 */
_migrateLegacyProjects() {
  let ls;
  try { ls = window.localStorage; } catch (_e) { return { migrated: 0, skipped: 0 }; }

  const canon = ProjectProjectsPanel.LS_PROJECT_PREFIX_CANON;
  const items = this._readAllLocalProjects().filter(x => x && x.isLegacy && x.raw);
  let migrated = 0;
  let skipped = 0;

  for (const it of items) {
    const targetKey = `${canon}${it.id}`;
    if (ls.getItem(targetKey)) { skipped++; continue; }
    try {
      ls.setItem(targetKey, JSON.stringify(it.raw));
      migrated++;
    } catch (_e) {
      skipped++;
    }
  }
  return { migrated, skipped };
}

/**
 * Importiert Backup/Projekt JSON (kompatibel zum ProjectListPanel Export-Format).
 * - baustellenplaner.backup.v1  (projects: [{project:{...}}])
 * - Einzelprojekt (schema enthält "baustellenplaner.project")
 */
_openImportDialog() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const obj = JSON.parse(text);

      const canon = ProjectProjectsPanel.LS_PROJECT_PREFIX_CANON;

      // Fall 1: Backup v1
      if (obj && obj.schema === 'baustellenplaner.backup.v1' && Array.isArray(obj.projects)) {
        let imported = 0;
        for (const entry of obj.projects) {
          const p = entry && entry.project;
          if (!p || typeof p !== 'object') continue;
          const id = String(p.id || '').trim() || `P-${new Date().getFullYear()}-${String(Math.floor(Math.random()*10000)).padStart(4,'0')}`;
          p.id = id;
          if (!p.createdAt) p.createdAt = new Date().toISOString();
          window.localStorage.setItem(`${canon}${id}`, JSON.stringify(p));
          imported++;
        }
        alert(`Import fertig: ${imported} Projekte.\n\nBitte "Aktualisieren" drücken.`);
        return;
      }

      // Fall 2: Einzelprojekt
      if (obj && obj.schema && String(obj.schema).includes('baustellenplaner.project')) {
        const id = String(obj.id || '').trim() || `P-${new Date().getFullYear()}-${String(Math.floor(Math.random()*10000)).padStart(4,'0')}`;
        obj.id = id;
        if (!obj.createdAt) obj.createdAt = new Date().toISOString();
        window.localStorage.setItem(`${canon}${id}`, JSON.stringify(obj));
        alert(`Projekt importiert: ${obj.name || '(ohne Name)'}\nID: ${id}`);
        return;
      }

      alert('Unbekanntes JSON-Format. Erwartet: Backup v1 oder Projekt v1.');
    } catch (e) {
      console.error(e);
      alert('Import fehlgeschlagen (siehe Konsole).');
    }
  };
  input.click();
}

}