/**
 * ui/panels/ProjectProjectsPanel.js
 * Version: v1.3.1-projectlist-visible (2026-02-05)
 *
 * Projektliste (localStorage)
 * ==========================
 * Ziel: Eine robuste, "Browser-only" Projektverwaltung:
 * - Liste aller Projekte aus localStorage
 * - Öffnen (setzt project.json = local:<id> und reload)
 * - Umbenennen (ändert projectfile.name + meta.name)
 * - Duplizieren (neue ID, kopiert Projectfile)
 * - Export/Backup: Download JSON (ein Projekt) oder "Alle"
 *
 * WICHTIG:
 * - Dieses Panel besitzt KEIN State-Eigentum. Es liest/schreibt in localStorage
 *   und nutzt den App-Bus/Store nur für UI-Status (Toast / optional).
 * - Dadurch bleibt app/store.js Single Source of Truth für das "laufende" Projekt,
 *   aber die Projektliste bleibt unabhängig davon bedienbar.
 */

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) n.setAttribute(k, String(v));
  }
  for (const c of children || []) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ------------------------------------------------------------
// LocalStorage Keys (Konvention aus core/loader.js loadJson())
// ------------------------------------------------------------
const LS_PROJECTFILE_PREFIX = "baustellenplaner:projectfile:"; // + projectId
const LS_LAST_PROJECT = "baustellenplaner:lastProjectId";      // optional

function listProjectIds() {
  const ids = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PROJECTFILE_PREFIX)) {
        ids.push(k.slice(LS_PROJECTFILE_PREFIX.length));
      }
    }
  } catch (err) {
    console.warn("[ProjectProjectsPanel] localStorage nicht lesbar:", err);
  }
  return ids;
}

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function readProjectfile(projectId) {
  let raw = null;
  try {
    raw = localStorage.getItem(`${LS_PROJECTFILE_PREFIX}${projectId}`);
  } catch (err) {
    console.warn("[ProjectProjectsPanel] localStorage.getItem fehlgeschlagen:", err);
    return null;
  }
  if (!raw) return null;
  return safeJsonParse(raw);
}

function writeProjectfile(projectId, obj) {
  localStorage.setItem(`${LS_PROJECTFILE_PREFIX}${projectId}`, JSON.stringify(obj, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

/** Wenn meta fehlt, erzeugen wir minimale Defaults, damit Sort/Anzeige stabil bleibt. */
function ensureMeta(pf, projectId) {
  pf.meta = pf.meta || {};
  pf.meta.id = pf.meta.id || projectId || pf.meta.projectId || pf.id || "P-unknown";
  pf.meta.createdAt = pf.meta.createdAt || nowIso();
  pf.meta.updatedAt = pf.meta.updatedAt || pf.meta.createdAt || nowIso();
  // "name" liegt bei dir teils in pf.project.name oder pf.name – wir normalisieren NUR zur Anzeige.
  return pf;
}

function getDisplayName(pf) {
  return (
    pf?.project?.name ||
    pf?.name ||
    pf?.meta?.name ||
    pf?.meta?.id ||
    "Unbenannt"
  );
}

function setDisplayName(pf, name) {
  // möglichst kompatibel schreiben:
  pf.project = pf.project || {};
  pf.project.name = name;
  pf.name = name;
  pf.meta = pf.meta || {};
  pf.meta.name = name;
  pf.meta.updatedAt = nowIso();
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function cloneDeep(x) {
  return JSON.parse(JSON.stringify(x));
}

function makeNewId() {
  // "P-YYYY-XXXX" ähnlich deiner Beispiele, aber kollisionsarm
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `P-${y}${m}${day}-${rand}`;
}

// ------------------------------------------------------------

export class ProjectProjectsPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.root = null;

    this.state = {
      sort: "updatedDesc" // updatedDesc | createdDesc | nameAsc | idAsc
    };
  }

  mount(container) {
    this.root = el("div", { class: "bp-panel bp-projects" });

    // Header
    const h1 = el("h2", { text: "Projekt – Liste (localStorage)" });
    const p = el("p", { class: "bp-muted", text: "Zeigt alle im Browser gespeicherten Projekte an (localStorage)." });

    // Controls row
    const controls = el("div", { class: "bp-row" }, [
      el("button", { class: "bp-btn", onClick: () => this.refresh(), text: "Aktualisieren" }),
      el("select", {
        class: "bp-select",
        onChange: (e) => { this.state.sort = e.target.value; this.refresh(); }
      }, [
        el("option", { value: "updatedDesc", text: "Sort: zuletzt geändert" }),
        el("option", { value: "createdDesc", text: "Sort: zuletzt erstellt" }),
        el("option", { value: "nameAsc", text: "Sort: Name (A→Z)" }),
        el("option", { value: "idAsc", text: "Sort: ID" })
      ]),
      el("button", {
        class: "bp-btn",
        onClick: () => this.exportAll(),
        text: "Backup (alle) – JSON"
      })
    ]);

    this.listEl = el("div", { class: "bp-list" });

    this.root.append(h1, p, controls, this.listEl);

    // Mini-Styles (nur falls Module-Styles fehlen)
    // Hinweis: Wir halten es klein, damit es dein UI nicht zerstört.
    const style = el("style", { text: `
      .bp-panel { padding: 12px; }
      .bp-muted { opacity: .75; margin-top: -6px; }
      .bp-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin: 8px 0 12px; }
      .bp-btn { padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.12); background:#fff; }
      .bp-select { padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.12); background:#fff; }
      .bp-card { border:1px solid rgba(0,0,0,.10); border-radius:16px; padding:12px; margin:10px 0; background:#fff; }
      .bp-card h3 { margin:0 0 6px; }
      .bp-card .bp-meta { opacity:.7; font-size: 12px; margin-bottom:10px; display:flex; gap:10px; flex-wrap:wrap; }
      .bp-card .bp-actions { display:flex; gap:10px; flex-wrap:wrap; }
      .bp-btn.primary { background: #dbeafe; }
      .bp-btn.danger { background: #fee2e2; }
    `});

    this.root.appendChild(style);
    container.appendChild(this.root);

    this.refresh();
  }

  unmount() {
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
  }

  refresh() {
    // Robust gegen lokale Storage-Probleme (iOS/Safari) & kaputte JSON-Einträge.
    // Wenn hier ein Fehler passiert, zeigen wir ihn im Panel an, statt still "leer" zu wirken.
    this._lastError = null;

    let ids = [];
    const rows = [];

    try {
      ids = listProjectIds();

      for (const id of ids) {
        const pf = readProjectfile(id);
        if (!pf) continue; // kaputtes JSON o. ä. ignorieren
        ensureMeta(pf, id);

        rows.push({
          id,
          name: getDisplayName(pf),
          createdAt: pf.meta.createdAt || "",
          updatedAt: pf.meta.updatedAt || "",
          type: pf.project?.type || pf.type || pf.meta?.type || ""
        });
      }
    } catch (err) {
      this._lastError = err;
    }

    // sort (nur wenn kein Fehler vorliegt)
    const s = this.state.sort;
    rows.sort((a, b) => {
      if (s === "updatedDesc") return String(b.updatedAt).localeCompare(String(a.updatedAt));
      if (s === "createdDesc") return String(b.createdAt).localeCompare(String(a.createdAt));
      if (s === "nameAsc") return String(a.name).localeCompare(String(b.name));
      if (s === "idAsc") return String(a.id).localeCompare(String(b.id));
      return 0;
    });

    // render
    this.listEl.innerHTML = "";
    const headline = el("div", {
      class: "bp-meta",
      text: `Anzahl: ${rows.length} — Quelle: localStorage${this._lastError ? " — ⚠️ Fehler" : ""}`
    });
    this.listEl.appendChild(headline);

    if (this._lastError) {
      const msg = (this._lastError && (this._lastError.message || String(this._lastError))) || "Unbekannter Fehler";
      this.listEl.appendChild(
        el("div", {
          class: "bp-card bp-error",
          html: `
            <div style="font-weight:800; margin-bottom:6px;">Projektliste kann nicht gelesen werden</div>
            <div style="opacity:.85; font-size:12px;">${escapeHtml(msg)}</div>
            <div style="opacity:.75; font-size:12px; margin-top:6px;">Tipp: In iOS/Safari kann localStorage manchmal blockiert sein (Privatmodus / Storage-Policy). Öffne die Seite einmal normal (nicht privat) und versuche erneut.</div>
          `
        })
      );
      // trotzdem versuchen wir, bereits geladene Rows anzuzeigen
    }

    for (const r of rows) {
      this.listEl.appendChild(this.renderCard(r));
    }

    if (rows.length === 0) {
      this.listEl.appendChild(el("div", { class: "bp-muted", text: "Keine Projekte gefunden. Lege ein neues Projekt im Wizard an." }));
    }
  }

  renderCard(r) {
    const title = el("h3", { text: r.name || "Unbenannt" });
    const meta = el("div", { class: "bp-meta" }, [
      el("span", { text: `ID: ${r.id}` }),
      el("span", { text: r.type ? `Typ: ${r.type}` : "Typ: —" }),
      el("span", { text: r.updatedAt ? `Geändert: ${r.updatedAt.slice(0,19).replace("T"," ")}` : "" })
    ]);

    const btnOpen = el("button", { class: "bp-btn primary", text: "Öffnen", onClick: () => this.open(r.id) });
    const btnRename = el("button", { class: "bp-btn", text: "Umbenennen", onClick: () => this.rename(r.id) });
    const btnDup = el("button", { class: "bp-btn", text: "Duplizieren", onClick: () => this.duplicate(r.id) });
    const btnExport = el("button", { class: "bp-btn", text: "Export/Backup", onClick: () => this.exportOne(r.id) });
    const btnDelete = el("button", { class: "bp-btn danger", text: "Löschen", onClick: () => this.remove(r.id) });

    const actions = el("div", { class: "bp-actions" }, [btnOpen, btnRename, btnDup, btnExport, btnDelete]);

    return el("div", { class: "bp-card" }, [title, meta, actions]);
  }

  open(projectId) {
    localStorage.setItem(LS_LAST_PROJECT, projectId);
    // Konvention: project.json lädt "project.json" => in deiner App kann project.json auch per Store gesetzt werden.
    // Wir machen den robusten Weg: URL-Param "project=local:<id>" (falls unterstützt) – sonst hard reload + lastProject.
    // Wichtig: Dein core/loader.js kann "local:<id>" laden.
    const url = new URL(window.location.href);
    url.searchParams.set("project", `local:${projectId}`);
    window.location.href = url.toString();
  }

  rename(projectId) {
    const pf = readProjectfile(projectId);
    if (!pf) return;
    const current = getDisplayName(pf);
    const name = prompt("Neuer Projektname:", current);
    if (!name) return;
    ensureMeta(pf, projectId);
    setDisplayName(pf, name.trim());
    writeProjectfile(projectId, pf);
    this.refresh();
  }

  duplicate(projectId) {
    const pf = readProjectfile(projectId);
    if (!pf) return;
    const newId = makeNewId();
    const copy = cloneDeep(pf);
    ensureMeta(copy, newId);
    copy.meta.id = newId;
    copy.meta.createdAt = nowIso();
    copy.meta.updatedAt = nowIso();
    // Name suffix
    const baseName = getDisplayName(copy);
    setDisplayName(copy, `${baseName} (Kopie)`);
    writeProjectfile(newId, copy);
    this.refresh();
  }

  exportOne(projectId) {
    const pf = readProjectfile(projectId);
    if (!pf) return;
    const payload = {
      schema: "baustellenplaner.backup.single.v1",
      exportedAt: nowIso(),
      projectId,
      projectfile: pf
    };
    downloadJson(`baustellenplaner_${projectId}.json`, payload);
  }

  exportAll() {
    const ids = listProjectIds();
    const projects = [];
    for (const id of ids) {
      const pf = readProjectfile(id);
      if (pf) projects.push({ projectId: id, projectfile: pf });
    }
    const payload = {
      schema: "baustellenplaner.backup.all.v1",
      exportedAt: nowIso(),
      count: projects.length,
      projects
    };
    downloadJson(`baustellenplaner_backup_all_${new Date().toISOString().slice(0,10)}.json`, payload);
  }

  remove(projectId) {
    const ok = confirm(`Projekt wirklich löschen?\n\n${projectId}`);
    if (!ok) return;
    localStorage.removeItem(`${LS_PROJECTFILE_PREFIX}${projectId}`);
    this.refresh();
  }
}
