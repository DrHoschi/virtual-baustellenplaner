/**
 * ui/panels/ProjectListPanel.js
 * Version: v1.0.1-projectlist-veredelung-v2 (2026-02-14)
 *
 * Panel: Projekt → Liste (localStorage)
 *
 * Ziel (UX):
 * - Alle lokal gespeicherten Projekte sichtbar + schnell bedienbar
 * - Aktionen direkt in der Liste:
 *    - Öffnen
 *    - Umbenennen (Projekt.name im Projectfile)
 *    - Duplizieren (neue ID + Kopie)
 *    - Löschen (inkl. bestätigung + auch Persist-Key löschen)
 * - Export/Backup:
 *    - Einzelprojekt als JSON herunterladen
 *    - Komplettes Backup (alle Projekte) als eine JSON-Datei
 *    - (Optional) Import: Backup/Projekt JSON wieder einspielen
 *
 * Datenquellen:
 * - Projectfile: localStorage "baustellenplaner:projectfile:<id>"
 * - Persist-Blob (Editor-Autosave): localStorage "baustellenplaner:project:<id>"
 *   (dort liegt _meta.savedAt → für Sortierung/Anzeige)
 *
 * WICHTIG (Format-Kompatibilität):
 * - Neu/Bevorzugt: Wrapper-Format (von ProjectGeneralPanel.persist)
 *     { schema:"bp-projectfile", version:"1.0", project:{...}, app:{ settings:{...}, ui:{...} } }
 * - Legacy: "nacktes" Projektobjekt
 *     { schema:"baustellenplaner.project.v1", id:"P-...", name:"...", ... }
 *
 * Dieses Panel kann beide Formate lesen + schreiben.
 */

import { h, clear } from "../components/ui-dom.js";
import { Section } from "../components/Section.js";

// ------------------------------------------------------------
// localStorage Keys
// ------------------------------------------------------------
const KEY_PREFIX_PROJECTFILE = "baustellenplaner:projectfile:";
const KEY_PREFIX_PERSIST = "baustellenplaner:project:";

// ------------------------------------------------------------
// Projectfile Format Helpers
// ------------------------------------------------------------

function isWrapperProjectfile(obj) {
  return !!(obj && typeof obj === "object" && obj.schema === "bp-projectfile" && obj.project);
}

/**
 * Liefert IMMER ein Projektobjekt zurück.
 * - Wrapper → obj.project
 * - Legacy  → obj
 */
function unwrapProject(obj) {
  if (!obj || typeof obj !== "object") return null;
  return isWrapperProjectfile(obj) ? (obj.project || null) : obj;
}

/**
 * Schreibt ein Projektfile in das bevorzugte Wrapper-Format.
 * - Wenn bereits Wrapper: normalisiert nur project.id
 * - Wenn Legacy: wrapped das Projekt und übernimmt minimal app/settings/ui leer.
 */
function normalizeToWrapper(projectId, rawProjectfile) {
  const pj = unwrapProject(rawProjectfile);
  if (!pj || typeof pj !== "object") return null;

  // ID konsistent halten
  pj.id = String(projectId || pj.id || "").trim() || pj.id;

  if (isWrapperProjectfile(rawProjectfile)) {
    // Wrapper behalten, aber project/id sicher setzen
    const out = {
      schema: "bp-projectfile",
      version: String(rawProjectfile.version || "1.0"),
      project: pj,
      app: rawProjectfile.app && typeof rawProjectfile.app === "object" ? rawProjectfile.app : { settings: {}, ui: {} }
    };
    // defensive: app.settings/ui immer objects
    out.app.settings = out.app.settings && typeof out.app.settings === "object" ? out.app.settings : {};
    out.app.ui = out.app.ui && typeof out.app.ui === "object" ? out.app.ui : {};
    return out;
  }

  return {
    schema: "bp-projectfile",
    version: "1.0",
    project: pj,
    app: {
      settings: {},
      ui: {}
    }
  };
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function safeJsonStringify(obj) {
  try { return JSON.stringify(obj, null, 2); } catch { return null; }
}

function nowIso() {
  try { return new Date().toISOString(); } catch { return ""; }
}

function makeProjectId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const rnd = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `P-${yyyy}-${rnd}`;
}

function tsFromIso(iso) {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t) ? t : 0;
}

function downloadTextFile({ filename, text, mime = "application/json" } = {}) {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  } catch (e) {
    console.error("[ProjectListPanel] download failed:", e);
    alert("Download fehlgeschlagen (siehe Konsole).\n\nTipp: iOS Safari kann Downloads manchmal blockieren – bitte erneut versuchen.");
  }
}

/**
 * Liest alle Projekte aus localStorage.
 * @returns {Array<{id:string, name:string, type:string, createdAt?:string, uiPreset?:string, modules?:string[], lastSavedAt?:string, _raw:any}>}
 */
function scanLocalProjects() {
  const items = [];

  // localStorage ist iterierbar
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX_PROJECTFILE)) continue;
    const id = k.slice(KEY_PREFIX_PROJECTFILE.length);
    const raw = localStorage.getItem(k);
    const obj = raw ? safeJsonParse(raw) : null;
    if (!obj || typeof obj !== "object") continue;

    // lastSavedAt aus Persist-Blob (wenn vorhanden)
    const persistRaw = localStorage.getItem(`${KEY_PREFIX_PERSIST}${id}`);
    const persistObj = persistRaw ? safeJsonParse(persistRaw) : null;
    const lastSavedAt = persistObj && persistObj._meta ? persistObj._meta.savedAt : "";

    const project = unwrapProject(obj) || {};

    items.push({
      id,
      name: String(project.name || "(ohne Name)"),
      type: String(project.type || project.projectType || "unknown"),
      createdAt: project.createdAt || "",
      uiPreset: project.uiPreset || "",
      modules: Array.isArray(project.modules) ? project.modules : [],
      lastSavedAt: lastSavedAt || "",
      _raw: obj,        // original raw projectfile (wrapper oder legacy)
      _project: project // normalisiertes Projekt
    });
  }

  // Default Sort: zuletzt gespeichert (Persist), sonst createdAt
  items.sort((a, b) => {
    const ta = tsFromIso(a.lastSavedAt) || tsFromIso(a.createdAt);
    const tb = tsFromIso(b.lastSavedAt) || tsFromIso(b.createdAt);
    // Desc
    if (tb !== ta) return tb - ta;
    return String(a.name).localeCompare(String(b.name));
  });

  return items;
}

function fmtTime(iso) {
  if (!iso) return "";
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return d.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// ------------------------------------------------------------
// Panel
// ------------------------------------------------------------

export class ProjectListPanel {
  constructor({ bus, store, rootEl } = {}) {
    this.bus = bus;
    this.store = store;
    this.rootEl = rootEl;

    this._mounted = false;
    this._list = [];
    this._filter = "";
  }

  async mount() {
    if (!this.rootEl) return;
    this._mounted = true;
    this._render();
  }

  unmount() {
    this._mounted = false;
    if (this.rootEl) clear(this.rootEl);
  }

  _reload() {
    this._list = scanLocalProjects();
  }

  _render() {
    if (!this._mounted) return;
    this._reload();
    clear(this.rootEl);

    const title = h("h3", { style: { margin: "0 0 6px" } }, "Projekt – Liste (localStorage)");
    const desc = h(
      "div",
      { style: { opacity: ".75", fontSize: "12px", margin: "0 0 10px" } },
      "Zeigt alle im Browser gespeicherten Projekte an (localStorage)."
    );

    // Top-Tools
    const toolsRow = h("div", {
      style: {
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        alignItems: "center",
        margin: "0 0 10px"
      }
    });

    const btn = (label, onClick, kind = "secondary") => {
      const base = {
        padding: "8px 10px",
        borderRadius: "10px",
        border: "1px solid rgba(0,0,0,.10)",
        background: kind === "primary" ? "rgba(80,160,255,.20)" : "rgba(0,0,0,.06)",
        cursor: "pointer",
        color: "inherit",
        fontWeight: kind === "primary" ? "600" : "500"
      };
      return h("button", { type: "button", style: base, onclick: onClick }, label);
    };

    const filterInput = h("input", {
      type: "text",
      placeholder: "Filter (Name / ID / Typ)…",
      value: this._filter,
      style: {
        padding: "8px 10px",
        borderRadius: "10px",
        border: "1px solid rgba(0,0,0,.12)",
        minWidth: "220px",
        flex: "1 1 220px"
      },
      oninput: (e) => {
        this._filter = e.target.value || "";
        this._render();
      }
    });

    const exportAllBtn = btn("⬇︎ Backup (alle Projekte)", () => this._exportAll(), "primary");
    const importBtn = btn("⬆︎ Import (Backup/Projekt)", () => this._openImportDialog(), "secondary");
    const refreshBtn = btn("⟳ Aktualisieren", () => this._render(), "secondary");

    toolsRow.appendChild(refreshBtn);
    toolsRow.appendChild(filterInput);
    toolsRow.appendChild(exportAllBtn);
    toolsRow.appendChild(importBtn);

    // Liste
    const list = this._renderList();

    this.rootEl.appendChild(title);
    this.rootEl.appendChild(desc);
    this.rootEl.appendChild(toolsRow);
    this.rootEl.appendChild(list);
  }

  _renderList() {
    const filter = String(this._filter || "").trim().toLowerCase();
    const rows = filter
      ? this._list.filter((p) => {
        const hay = `${p.name} ${p.id} ${p.type}`.toLowerCase();
        return hay.includes(filter);
      })
      : this._list;

    const countRow = h("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        margin: "0 0 8px"
      }
    },
      h("div", { style: { fontWeight: "700" } }, `Anzahl: ${rows.length}`),
      h("div", { style: { opacity: ".7" } }, "Quelle: localStorage")
    );

    const wrap = h("div", {});
    wrap.appendChild(countRow);

    if (rows.length === 0) {
      wrap.appendChild(
        Section({
          title: "Keine Projekte gefunden",
          children: [
            h("div", { style: "opacity:.8" }, "Lege ein Projekt im Wizard an oder importiere ein Backup.")
          ]
        })
      );
      return wrap;
    }

    for (const p of rows) {
      wrap.appendChild(this._renderProjectCard(p));
    }
    return wrap;
  }

  _renderProjectCard(p) {
    const card = h("div", {
      style: {
        border: "1px solid rgba(0,0,0,.10)",
        borderRadius: "12px",
        padding: "12px",
        margin: "0 0 10px",
        background: "rgba(0,0,0,.02)"
      }
    });

    const header = h("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "10px",
        alignItems: "baseline"
      }
    });

    const titleLeft = h("div", {});
    const big = h("div", { style: { fontSize: "22px", fontWeight: "800" } }, p.name || "(ohne Name)");
    const meta = h(
      "div",
      { style: { opacity: ".75", fontSize: "12px" } },
      `${p.id} · Typ: ${p.type}`
    );
    titleLeft.appendChild(big);
    titleLeft.appendChild(meta);

    const right = h("div", { style: { textAlign: "right", minWidth: "140px" } });
    const savedTxt = p.lastSavedAt ? `Letzter Save: ${fmtTime(p.lastSavedAt)}` : "Noch kein Save";
    const createdTxt = p.createdAt ? `Erstellt: ${fmtTime(p.createdAt)}` : "";
    right.appendChild(h("div", { style: { opacity: ".75", fontSize: "12px" } }, savedTxt));
    if (createdTxt) right.appendChild(h("div", { style: { opacity: ".5", fontSize: "11px" } }, createdTxt));

    header.appendChild(titleLeft);
    header.appendChild(right);

    // Actions
    const actions = h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" } });
    const btn = (label, onClick, kind = "secondary") => {
      const base = {
        padding: "8px 10px",
        borderRadius: "10px",
        border: "1px solid rgba(0,0,0,.10)",
        background: kind === "primary" ? "rgba(80,160,255,.20)" : "rgba(0,0,0,.06)",
        cursor: "pointer",
        color: "inherit",
        fontWeight: kind === "primary" ? "600" : "500"
      };
      return h("button", { type: "button", style: base, onclick: onClick }, label);
    };

    actions.appendChild(btn("Öffnen", () => this._openProject(p.id), "primary"));
    actions.appendChild(btn("Umbenennen", () => this._renameProject(p.id), "secondary"));
    actions.appendChild(btn("Duplizieren", () => this._duplicateProject(p.id), "secondary"));
    actions.appendChild(btn("Export", () => this._exportOne(p.id), "secondary"));
    actions.appendChild(btn("Löschen", () => this._deleteProject(p.id), "secondary"));

    card.appendChild(header);
    card.appendChild(actions);
    return card;
  }

  /* ----------------------------------------------------------
   * Actions
   * ---------------------------------------------------------- */

  _openProject(projectId) {
    // Convention aus core/loader.js
    const url = `?project=local:${encodeURIComponent(projectId)}`;
    window.location.href = url;
  }

  _readProjectFile(projectId) {
    const raw = localStorage.getItem(`${KEY_PREFIX_PROJECTFILE}${projectId}`);
    return raw ? safeJsonParse(raw) : null;
  }

  _writeProjectFile(projectId, obj) {
    const txt = safeJsonStringify(obj);
    if (!txt) throw new Error("Could not stringify project JSON");
    localStorage.setItem(`${KEY_PREFIX_PROJECTFILE}${projectId}`, txt);
  }

  _deleteProject(projectId) {
    const p = this._readProjectFile(projectId);
    const pj = unwrapProject(p) || {};
    const name = pj?.name ? String(pj.name) : projectId;

    const ok = confirm(`Projekt wirklich löschen?\n\n${name}\n(${projectId})\n\nHinweis: Das löscht auch den Autosave-Persist-State.`);
    if (!ok) return;

    try {
      localStorage.removeItem(`${KEY_PREFIX_PROJECTFILE}${projectId}`);
      localStorage.removeItem(`${KEY_PREFIX_PERSIST}${projectId}`);
      this._render();
    } catch (e) {
      console.error(e);
      alert("Löschen fehlgeschlagen (siehe Konsole). ");
    }
  }

  _renameProject(projectId) {
    const obj = this._readProjectFile(projectId);
    if (!obj) {
      alert("Projekt nicht gefunden (localStorage)." );
      return;
    }
    const pj = unwrapProject(obj) || {};
    const current = String(pj.name || "");
    const next = prompt("Neuer Projektname:", current);
    if (next == null) return; // abgebrochen
    const cleaned = String(next).trim();
    if (!cleaned) {
      alert("Name darf nicht leer sein.");
      return;
    }
    try {
      pj.name = cleaned;
      // kleine Meta-Notiz
      pj.updatedAt = nowIso();

      // bevorzugtes Wrapper-Format schreiben
      const wrapped = normalizeToWrapper(projectId, obj);
      if (!wrapped) throw new Error("Invalid projectfile");
      wrapped.project = pj;
      this._writeProjectFile(projectId, wrapped);
      this._render();
    } catch (e) {
      console.error(e);
      alert("Umbenennen fehlgeschlagen (siehe Konsole)." );
    }
  }

  _duplicateProject(projectId) {
    const obj = this._readProjectFile(projectId);
    if (!obj) {
      alert("Projekt nicht gefunden (localStorage)." );
      return;
    }

    // neue ID
    const newId = makeProjectId();
    const wrapped = normalizeToWrapper(newId, obj);
    if (!wrapped) {
      alert("Duplizieren fehlgeschlagen: ungültiges Projektformat." );
      return;
    }

    // Deep-Copy (inkl. projectAssets!)
    const copy = JSON.parse(JSON.stringify(wrapped));
    const pj = copy.project || {};
    pj.id = newId;
    pj.createdAt = nowIso();
    pj.updatedAt = nowIso();
    pj.name = `${String(pj.name || "Projekt")} (Kopie)`;

    // App-UI NICHT mitspeichern (damit keine "drafts"/Panelzustände migrieren)
    // Settings dürfen aber mit übernommen werden.
    if (copy.app && typeof copy.app === "object") {
      copy.app.ui = {};
    }

    try {
      this._writeProjectFile(newId, copy);
      // Persist-Blob NICHT kopieren (weil UI/Editor-Snapshots sonst verwirrend sind)
      this._render();
      alert(`Dupliziert: ${pj.name}\nID: ${newId}`);
    } catch (e) {
      console.error(e);
      alert("Duplizieren fehlgeschlagen (siehe Konsole)." );
    }
  }

  _exportOne(projectId) {
    const obj = this._readProjectFile(projectId);
    if (!obj) {
      alert("Projekt nicht gefunden (localStorage)." );
      return;
    }
    // Export: immer Wrapper-Format, damit Import konsistent bleibt.
    const wrapped = normalizeToWrapper(projectId, obj);
    const txt = safeJsonStringify(wrapped || obj);
    if (!txt) {
      alert("Export fehlgeschlagen (JSON konnte nicht erstellt werden)." );
      return;
    }
    downloadTextFile({ filename: `baustellenplaner-project-${projectId}.json`, text: txt });
  }

  _exportAll() {
    const list = scanLocalProjects();
    const payload = {
      schema: "baustellenplaner.backup.v1",
      exportedAt: nowIso(),
      count: list.length,
      projects: list.map((p) => ({
        // Wir exportieren Projectfiles im Wrapper-Format (ohne Persist)
        projectfile: normalizeToWrapper(p.id, p._raw) || p._raw
        // persist könnte später optional ergänzt werden
      }))
    };
    const txt = safeJsonStringify(payload);
    if (!txt) {
      alert("Backup fehlgeschlagen (JSON konnte nicht erstellt werden)." );
      return;
    }

    // Dateiname: sicher, kurz, sortierbar
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
    downloadTextFile({ filename: `baustellenplaner-backup-${stamp}.json`, text: txt });
  }

  _openImportDialog() {
    // Minimaler Import (nur Projectfiles)
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const obj = safeJsonParse(text);
        if (!obj || typeof obj !== "object") throw new Error("invalid json");

        // Fall 1: Backup-Schema
        if (obj.schema === "baustellenplaner.backup.v1" && Array.isArray(obj.projects)) {
          let imported = 0;
          for (const entry of obj.projects) {
            const raw = entry && (entry.projectfile || entry.project);
            if (!raw || typeof raw !== "object") continue;

            // ID ermitteln
            const pj = unwrapProject(raw) || {};
            const id = String(pj.id || "").trim() || makeProjectId();
            pj.id = id;
            if (!pj.createdAt) pj.createdAt = nowIso();

            const wrapped = normalizeToWrapper(id, raw);
            if (!wrapped) continue;
            wrapped.project = pj;
            // Import soll keine alten UI-Drafts mitschleppen
            if (wrapped.app) wrapped.app.ui = {};

            this._writeProjectFile(id, wrapped);
            imported++;
          }
          alert(`Import fertig: ${imported} Projekte.`);
          this._render();
          return;
        }

        // Fall 2: Einzel-Wrapper (bp-projectfile)
        if (obj.schema === "bp-projectfile" && obj.project) {
          const pj = unwrapProject(obj) || {};
          const id = String(pj.id || "").trim() || makeProjectId();
          pj.id = id;
          if (!pj.createdAt) pj.createdAt = nowIso();
          const wrapped = normalizeToWrapper(id, obj);
          if (!wrapped) throw new Error("invalid wrapper");
          wrapped.project = pj;
          if (wrapped.app) wrapped.app.ui = {};
          this._writeProjectFile(id, wrapped);
          alert(`Projekt importiert: ${pj.name || "(ohne Name)"}\nID: ${id}`);
          this._render();
          return;
        }

        // Fall 3: Einzel-Projekt (schema baustellenplaner.project.v1)
        if (obj.schema && String(obj.schema).includes("baustellenplaner.project")) {
          const id = String(obj.id || "").trim() || makeProjectId();
          obj.id = id;
          if (!obj.createdAt) obj.createdAt = nowIso();
          const wrapped = normalizeToWrapper(id, obj);
          if (!wrapped) throw new Error("invalid project");
          this._writeProjectFile(id, wrapped);
          alert(`Projekt importiert: ${obj.name || "(ohne Name)"}\nID: ${id}`);
          this._render();
          return;
        }

        alert("Unbekanntes JSON-Format. Erwartet: Backup v1 oder Projekt v1.");
      } catch (e) {
        console.error(e);
        alert("Import fehlgeschlagen (siehe Konsole)." );
      }
    };

    // iOS Safari braucht oft User-Geste → direkt click()
    input.click();
  }
}
