/**
 * ui/panels/ProjectListPanel.js
 * Version: v1.0.1-projectlist-dup-includes-projectAssets+persist (2026-02-14)
 *
 * Panel: Projekt → Liste (localStorage)
 *
 * Ziele:
 * - Projekte aus localStorage anzeigen + Aktionen:
 *   Öffnen / Umbenennen / Duplizieren / Export / Löschen
 * - Duplizieren übernimmt OPTIONAL auch Persist-State,
 *   damit projectAssets wirklich mitkommen können.
 *
 * Datenquellen:
 * - Projectfile: localStorage "baustellenplaner:projectfile:<id>"
 * - Persist-Blob: localStorage "baustellenplaner:project:<id>"
 */

import { h, clear } from "../components/ui-dom.js";
import { Section } from "../components/Section.js";

// ------------------------------------------------------------
// localStorage Keys
// ------------------------------------------------------------
const KEY_PREFIX_PROJECTFILE = "baustellenplaner:projectfile:";
const KEY_PREFIX_PERSIST = "baustellenplaner:project:";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
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

/**
 * Wichtig: In deiner Liste tauchen IDs wie "P-2026-1121?v=1" auf.
 * Das ist keine valide Projekt-ID, sondern Query-Müll.
 * Wir sanitizen für Anzeige/Öffnen/Copy – ohne still Keys umzubenennen.
 */
function sanitizeProjectId(id) {
  const s = String(id || "").trim();
  // Schneide alles nach "?" oder "#" ab
  const q = s.indexOf("?");
  const hIdx = s.indexOf("#");
  let cut = s;
  if (q >= 0) cut = cut.slice(0, q);
  if (hIdx >= 0) cut = cut.slice(0, hIdx);
  return cut.trim();
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
 * @returns {Array<{id:string, idRaw:string, name:string, type:string, createdAt?:string, uiPreset?:string, modules?:string[], lastSavedAt?:string, _raw:any}>}
 */
function scanLocalProjects() {
  const items = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX_PROJECTFILE)) continue;

    const idRaw = k.slice(KEY_PREFIX_PROJECTFILE.length);
    const id = sanitizeProjectId(idRaw);

    const raw = localStorage.getItem(k);
    const obj = raw ? safeJsonParse(raw) : null;
    if (!obj || typeof obj !== "object") continue;

    // lastSavedAt aus Persist-Blob (wenn vorhanden)
    const persistRaw = localStorage.getItem(`${KEY_PREFIX_PERSIST}${idRaw}`) || localStorage.getItem(`${KEY_PREFIX_PERSIST}${id}`);
    const persistObj = persistRaw ? safeJsonParse(persistRaw) : null;
    const lastSavedAt = persistObj && persistObj._meta ? persistObj._meta.savedAt : "";

    items.push({
      id,      // sanitizt (für Anzeige/Öffnen)
      idRaw,   // original key suffix
      name: String(obj.name || "(ohne Name)"),
      type: String(obj.type || obj.projectType || "unknown"),
      createdAt: obj.createdAt || "",
      uiPreset: obj.uiPreset || "",
      modules: Array.isArray(obj.modules) ? obj.modules : [],
      lastSavedAt: lastSavedAt || "",
      _raw: obj
    });
  }

  // Sort: zuletzt gespeichert (Persist), sonst createdAt
  items.sort((a, b) => {
    const ta = tsFromIso(a.lastSavedAt) || tsFromIso(a.createdAt);
    const tb = tsFromIso(b.lastSavedAt) || tsFromIso(b.createdAt);
    if (tb !== ta) return tb - ta;
    return String(a.name).localeCompare(String(b.name));
  });

  return items;
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

    // ✅ Sichtbarer Marker: damit du SOFORT siehst ob diese Datei wirklich aktiv ist
    const title = h(
      "h3",
      { style: { margin: "0 0 6px" } },
      "Projektliste (localStorage) — v1.0.1 (dup incl. projectAssets+persist)"
    );

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

    const hint = h(
      "div",
      { style: { opacity: ".65", fontSize: "11px", margin: "6px 0 10px" } },
      "Hinweis: Wenn IDs wie „P-…?v=1“ auftauchen, ist das Query-Müll im Storage-Key. Diese Anzeige/Öffnen nutzt automatisch die saubere ID ohne „?…“."
    );

    // Liste
    const list = this._renderList();

    this.rootEl.appendChild(title);
    this.rootEl.appendChild(desc);
    this.rootEl.appendChild(toolsRow);
    this.rootEl.appendChild(hint);
    this.rootEl.appendChild(list);
  }

  _renderList() {
    const filter = String(this._filter || "").trim().toLowerCase();
    const rows = filter
      ? this._list.filter((p) => {
        const hay = `${p.name} ${p.id} ${p.idRaw} ${p.type}`.toLowerCase();
        return hay.includes(filter);
      })
      : this._list;

    const countRow = h(
      "div",
      {
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
          children: [h("div", { style: "opacity:.8" }, "Lege ein Projekt im Wizard an oder importiere ein Backup.")]
        })
      );
      return wrap;
    }

    for (const p of rows) wrap.appendChild(this._renderProjectCard(p));
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
    const meta = h("div", { style: { opacity: ".75", fontSize: "12px" } }, `${p.id} · Typ: ${p.type}`);

    // Zeig raw-id nur wenn sie abweicht (Debug, damit man den Bug erkennt)
    if (p.idRaw && p.idRaw !== p.id) {
      titleLeft.appendChild(big);
      titleLeft.appendChild(meta);
      titleLeft.appendChild(
        h("div", { style: { opacity: ".55", fontSize: "11px", marginTop: "2px" } }, `Storage-Key-ID: ${p.idRaw}`)
      );
    } else {
      titleLeft.appendChild(big);
      titleLeft.appendChild(meta);
    }

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
    actions.appendChild(btn("Umbenennen", () => this._renameProject(p.idRaw), "secondary"));
    actions.appendChild(btn("Duplizieren", () => this._duplicateProject(p.idRaw), "secondary"));
    actions.appendChild(btn("Export", () => this._exportOne(p.idRaw), "secondary"));
    actions.appendChild(btn("Löschen", () => this._deleteProject(p.idRaw), "secondary"));

    card.appendChild(header);
    card.appendChild(actions);
    return card;
  }

  // ----------------------------------------------------------
  // Storage Read/Write
  // ----------------------------------------------------------
  _readProjectFile(projectIdRawOrClean) {
    const raw1 = localStorage.getItem(`${KEY_PREFIX_PROJECTFILE}${projectIdRawOrClean}`);
    if (raw1) return safeJsonParse(raw1);

    const clean = sanitizeProjectId(projectIdRawOrClean);
    const raw2 = localStorage.getItem(`${KEY_PREFIX_PROJECTFILE}${clean}`);
    return raw2 ? safeJsonParse(raw2) : null;
  }

  _writeProjectFile(projectId, obj) {
    const txt = safeJsonStringify(obj);
    if (!txt) throw new Error("Could not stringify project JSON");
    localStorage.setItem(`${KEY_PREFIX_PROJECTFILE}${projectId}`, txt);
  }

  _readPersist(projectIdRawOrClean) {
    const raw1 = localStorage.getItem(`${KEY_PREFIX_PERSIST}${projectIdRawOrClean}`);
    if (raw1) return safeJsonParse(raw1);

    const clean = sanitizeProjectId(projectIdRawOrClean);
    const raw2 = localStorage.getItem(`${KEY_PREFIX_PERSIST}${clean}`);
    return raw2 ? safeJsonParse(raw2) : null;
  }

  _writePersist(projectId, obj) {
    const txt = safeJsonStringify(obj);
    if (!txt) throw new Error("Could not stringify persist JSON");
    localStorage.setItem(`${KEY_PREFIX_PERSIST}${projectId}`, txt);
  }

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------
  _openProject(projectId) {
    const clean = sanitizeProjectId(projectId);
    const url = `?project=local:${encodeURIComponent(clean)}`;
    window.location.href = url;
  }

  _deleteProject(projectIdRawOrClean) {
    const clean = sanitizeProjectId(projectIdRawOrClean);
    const obj = this._readProjectFile(projectIdRawOrClean);
    const name = obj?.name ? String(obj.name) : clean;

    const ok = confirm(
      `Projekt wirklich löschen?\n\n${name}\n(${clean})\n\nHinweis: Das löscht auch den Autosave-Persist-State.`
    );
    if (!ok) return;

    try {
      // wir löschen beide Varianten sicherheitshalber
      localStorage.removeItem(`${KEY_PREFIX_PROJECTFILE}${projectIdRawOrClean}`);
      localStorage.removeItem(`${KEY_PREFIX_PROJECTFILE}${clean}`);
      localStorage.removeItem(`${KEY_PREFIX_PERSIST}${projectIdRawOrClean}`);
      localStorage.removeItem(`${KEY_PREFIX_PERSIST}${clean}`);
      this._render();
    } catch (e) {
      console.error(e);
      alert("Löschen fehlgeschlagen (siehe Konsole).");
    }
  }

  _renameProject(projectIdRawOrClean) {
    const clean = sanitizeProjectId(projectIdRawOrClean);
    const obj = this._readProjectFile(projectIdRawOrClean);
    if (!obj) {
      alert("Projekt nicht gefunden (localStorage).");
      return;
    }
    const current = String(obj.name || "");
    const next = prompt("Neuer Projektname:", current);
    if (next == null) return;
    const cleaned = String(next).trim();
    if (!cleaned) {
      alert("Name darf nicht leer sein.");
      return;
    }
    try {
      obj.name = cleaned;
      obj.updatedAt = nowIso();
      this._writeProjectFile(clean, obj);
      this._render();
    } catch (e) {
      console.error(e);
      alert("Umbenennen fehlgeschlagen (siehe Konsole).");
    }
  }

  /**
   * ✅ Duplizieren inkl. projectAssets:
   * - kopiert Projectfile
   * - kopiert (optional) Persist-Blob, damit projectAssets im State wirklich mitkommen
   */
  _duplicateProject(projectIdRawOrClean) {
    const clean = sanitizeProjectId(projectIdRawOrClean);

    const obj = this._readProjectFile(projectIdRawOrClean);
    if (!obj) {
      alert("Projekt nicht gefunden (localStorage).");
      return;
    }

    // neue ID
    const newId = makeProjectId();

    // --- Projectfile kopieren
    const copy = JSON.parse(JSON.stringify(obj));
    copy.id = newId;
    copy.createdAt = nowIso();
    copy.updatedAt = nowIso();
    copy.name = `${String(obj.name || "Projekt")} (Kopie)`;

    // Falls projectAssets im Projectfile liegen: explizit sicherstellen, dass sie mitkopiert sind
    if (Array.isArray(obj.projectAssets)) {
      copy.projectAssets = JSON.parse(JSON.stringify(obj.projectAssets));
    }

    // --- Persist kopieren (damit app.project.projectAssets wirklich mitkommen kann)
    const persist = this._readPersist(projectIdRawOrClean);

    const alsoCopyPersist = !!persist; // wenn vorhanden → kopieren
    let copiedPersist = false;

    try {
      // 1) Projectfile schreiben
      this._writeProjectFile(newId, copy);

      // 2) Persist schreiben (wenn vorhanden)
      if (alsoCopyPersist) {
        const p2 = JSON.parse(JSON.stringify(persist));

        // Versuche die typischen Stellen zu aktualisieren (wir halten das bewusst robust/defensiv)
        if (p2?.project && typeof p2.project === "object") {
          p2.project.id = newId;
          p2.project.name = copy.name;
        }
        if (p2?.app?.project && typeof p2.app.project === "object") {
          p2.app.project.id = newId;
          p2.app.project.name = copy.name;
        }
        if (p2?.app && typeof p2.app === "object") {
          p2.app.activeProjectId = newId;
          if (p2.app.activeProject && typeof p2.app.activeProject === "object") {
            p2.app.activeProject.id = newId;
          }
        }
        // Metadaten
        p2._meta = p2._meta || {};
        p2._meta.savedAt = nowIso();

        this._writePersist(newId, p2);
        copiedPersist = true;
      }

      this._render();

      alert(
        `Dupliziert:\n${copy.name}\nID: ${newId}\n\nprojectAssets: ${Array.isArray(copy.projectAssets) ? "ja" : "nein"}\nPersist kopiert: ${copiedPersist ? "ja" : "nein"}`
      );
    } catch (e) {
      console.error(e);
      alert("Duplizieren fehlgeschlagen (siehe Konsole).");
    }
  }

  _exportOne(projectIdRawOrClean) {
    const clean = sanitizeProjectId(projectIdRawOrClean);
    const obj = this._readProjectFile(projectIdRawOrClean);
    if (!obj) {
      alert("Projekt nicht gefunden (localStorage).");
      return;
    }
    const txt = safeJsonStringify(obj);
    if (!txt) {
      alert("Export fehlgeschlagen (JSON konnte nicht erstellt werden).");
      return;
    }
    downloadTextFile({ filename: `baustellenplaner-project-${clean}.json`, text: txt });
  }

  _exportAll() {
    const list = scanLocalProjects();
    const payload = {
      schema: "baustellenplaner.backup.v1",
      exportedAt: nowIso(),
      count: list.length,
      projects: list.map((p) => ({
        project: p._raw
      }))
    };

    const txt = safeJsonStringify(payload);
    if (!txt) {
      alert("Backup fehlgeschlagen (JSON konnte nicht erstellt werden).");
      return;
    }

    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
    downloadTextFile({ filename: `baustellenplaner-backup-${stamp}.json`, text: txt });
  }

  _openImportDialog() {
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

        // Backup
        if (obj.schema === "baustellenplaner.backup.v1" && Array.isArray(obj.projects)) {
          let imported = 0;
          for (const entry of obj.projects) {
            const p = entry && entry.project;
            if (!p || typeof p !== "object") continue;
            const id = sanitizeProjectId(String(p.id || "").trim()) || makeProjectId();
            p.id = id;
            if (!p.createdAt) p.createdAt = nowIso();
            this._writeProjectFile(id, p);
            imported++;
          }
          alert(`Import fertig: ${imported} Projekte.`);
          this._render();
          return;
        }

        // Einzelprojekt
        if (obj.schema && String(obj.schema).includes("baustellenplaner.project")) {
          const id = sanitizeProjectId(String(obj.id || "").trim()) || makeProjectId();
          obj.id = id;
          if (!obj.createdAt) obj.createdAt = nowIso();
          this._writeProjectFile(id, obj);
          alert(`Projekt importiert: ${obj.name || "(ohne Name)"}\nID: ${id}`);
          this._render();
          return;
        }

        alert("Unbekanntes JSON-Format. Erwartet: Backup v1 oder Projekt v1.");
      } catch (e) {
        console.error(e);
        alert("Import fehlgeschlagen (siehe Konsole).");
      }
    };

    input.click();
  }
}
