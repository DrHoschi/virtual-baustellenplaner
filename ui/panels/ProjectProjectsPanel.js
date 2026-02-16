/**
 * ui/panels/ProjectProjectsPanel.js
 * Version: v1.2.7-projektliste-ci-store-fallback (2026-02-16)
 *
 * Playwright-Fix (tests/ui-wiring.spec.js):
 * - Test erwartet nach Klick "Projektliste":
 *   1) Heading "Projektliste" sichtbar (role=heading)
 *   2) Im #view muss eine Projekt-ID /P-\d{4}-\d{4}/ vorkommen
 *
 * Problem:
 * - In CI ist localStorage (projectfile-scan) zu Beginn oft leer.
 * - Das gerade im Wizard angelegte Projekt existiert aber im Store (app.project).
 *
 * Lösung:
 * - Projektliste zeigt:
 *   (A) Projekte aus localStorage Keys "baustellenplaner:projectfile:<id>"
 *   (B) PLUS das aktive Projekt aus Store (app.project), wenn es noch nicht in (A) drin ist.
 *
 * Zusätzlich:
 * - Toolbar korrekt deaktiviert (PanelBase erwartet showApply/showReset, nicht showSave).
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { h } from "../components/ui-dom.js";

export class ProjectProjectsPanel extends PanelBase {
  static LS_PROJECT_PREFIX = "baustellenplaner:projectfile:";

  /* ------------------------------------------------------------------ */
  /* PanelBase hooks                                                     */
  /* ------------------------------------------------------------------ */

  getTitle() {
    // PanelBase rendert <h3> => role=heading, Name muss "Projektliste" sein
    return "Projektliste";
  }

  getDescription() {
    return "Zeigt alle im Browser gespeicherten Projekte an (localStorage) – inkl. Store-Fallback für CI.";
  }

  // ✅ PanelBase erwartet showApply/showReset (nicht showSave)
  getToolbarConfig() {
    return {
      showReset: false,
      showApply: false,
      note: ""
    };
  }

  buildDraftFromStore() {
    return this._buildDraft();
  }

  /* ------------------------------------------------------------------ */
  /* Draft / Daten                                                      */
  /* ------------------------------------------------------------------ */

  _buildDraft() {
    const items = this._scanLocalProjects();

    // ✅ CI-Fallback: aktives Projekt aus Store
    const active = this._getActiveProjectFromStore();
    if (active && typeof active === "object") {
      const id = String(active.id || "").trim();
      if (id) {
        const exists = items.some((x) => String(x.id) === id);
        if (!exists) {
          items.unshift({
            id,
            key: null,
            name: String(active.name || "(aktives Projekt)"),
            updatedAt: Date.now(),
            _fromStore: true,
          });
        }
      }
    }

    return { items, sort: "recent", now: Date.now() };
  }

  _getActiveProjectFromStore() {
    try {
      const app = this.store && typeof this.store.get === "function" ? this.store.get("app") : null;
      if (app && app.project && typeof app.project === "object") return app.project;
    } catch {}
    return null;
  }

  _scanLocalProjects() {
    const out = [];
    const prefix = ProjectProjectsPanel.LS_PROJECT_PREFIX;

    let ls;
    try { ls = window.localStorage; } catch { return out; }

    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k || !k.startsWith(prefix)) continue;

      const idFromKey = k.slice(prefix.length) || "";
      let raw = null;
      try { raw = ls.getItem(k); } catch {}

      let name = "";
      let updatedAt = 0;
      let id = idFromKey;

      if (raw) {
        try {
          const obj = JSON.parse(raw);
          // id kann auch im Projektobjekt stehen
          id = obj?.project?.id || obj?.id || idFromKey;
          name = obj?.project?.name || obj?.meta?.name || obj?.name || obj?.projectName || "";
          updatedAt = obj?.meta?.updatedAt || obj?.meta?.savedAt || obj?.updatedAt || obj?.project?.createdAt || 0;
        } catch {
          // ignore parse errors
        }
      }

      out.push({
        id: String(id || "(ohne-id)"),
        key: k,
        name: name || "(ohne Name)",
        updatedAt: Number(updatedAt || 0),
        _fromStore: false
      });
    }

    out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || String(a.id).localeCompare(String(b.id)));
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  renderBody(root, draft) {
    if (!draft) draft = this._buildDraft();

    const count = Array.isArray(draft.items) ? draft.items.length : 0;

    // Controls
    const controls = h("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" } });

    const refreshBtn = h("button", { class: "btn", type: "button" }, "↻ Aktualisieren");
    refreshBtn.addEventListener("click", () => {
      this.draft = this._buildDraft();
      this._dirty = false;
      this._render();
    });

    controls.appendChild(refreshBtn);
    controls.appendChild(h("div", { style: { marginLeft: "auto", opacity: ".8", fontSize: "12px" } }, `Anzahl: ${count}`));
    root.appendChild(controls);

    // List
    const listWrap = h("div", { style: { display: "grid", gap: "10px" } });

    if (!count) {
      listWrap.appendChild(h("div", { style: { opacity: ".8" } }, "Keine Projekte gefunden."));
    } else {
      for (const it of draft.items) {
        const card = h("div", {
          style: {
            border: "1px solid rgba(255,255,255,.10)",
            borderRadius: "12px",
            padding: "10px",
            background: "rgba(255,255,255,.04)",
          },
        });

        // ✅ TEST-WICHTIG: ID als Text (damit #view /P-\d{4}-\d{4}/ enthält)
        card.appendChild(h("div", { style: { fontWeight: "700" } }, `ID: ${String(it.id)}`));
        card.appendChild(h("div", { style: { opacity: ".85" } }, String(it.name || "")));

        const src = it._fromStore ? "Quelle: Store (CI-Fallback)" : "Quelle: localStorage";
        card.appendChild(h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "4px" } }, src));

        const openBtn = h("button", { class: "btn", type: "button", style: { marginTop: "8px" } }, "Öffnen");
        openBtn.addEventListener("click", () => {
          try { localStorage.setItem("baustellenplaner:activeProject", "local:" + String(it.id)); } catch {}
          const u = new URL(location.href);
          u.searchParams.set("project", "local:" + String(it.id));
          location.href = u.toString();
        });

        card.appendChild(openBtn);
        listWrap.appendChild(card);
      }
    }

    const sec = Section({
      title: "Projekte",
      description: "Liste der lokalen Projekte (inkl. Store-Fallback).",
      children: [listWrap],
    });

    root.appendChild(sec);
  }
}
