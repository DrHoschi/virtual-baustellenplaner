/**
 * ui/panels/ProjectProjectsPanel.js
 * Version: v1.2.6-projektliste-heading-scanfix (2026-02-09)
 *
 * Fixes:
 * 1) Playwright erwartet eine echte Heading "Projektliste" -> wir liefern sie zuverlässig
 *    via getTitle() (PanelBase rendert ein <h3> => role=heading).
 * 2) Robustere localStorage-Scan-Logik, damit nach Wizard-Speichern auch wirklich
 *    mindestens eine Projekt-ID (P-YYYY-NNNN) im #view auftaucht.
 * 3) Section-Komponente ist eine Funktion (Section({...})) und liefert ein DOM-Element
 *    -> kein `new Section()` / kein `.body`.
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { h } from "../components/ui-dom.js";

export class ProjectProjectsPanel extends PanelBase {
  static LS_PROJECT_PREFIX = "baustellenplaner:projectfile:";

  // ------------------------------------------------------------
  // PanelBase hooks
  // ------------------------------------------------------------
  getTitle() {
    return "Projektliste";
  }

  getDescription() {
    return "Zeigt alle im Browser gespeicherten Projekte an (localStorage).";
  }

  // Dieses Panel ist "read-only" – kein klassisches Speichern/Reset
  getToolbarConfig() {
    return {
      showReset: false,
      showSave: false,
      showDirtyIndicator: false,
    };
  }

  // PanelBase ruft das typischerweise beim Mount auf
  buildDraftFromStore() {
    return this._buildDraft();
  }

  // ------------------------------------------------------------
  // Draft / Daten
  // ------------------------------------------------------------
  _buildDraft() {
    const items = this._scanLocalProjects();
    return {
      items,
      sort: "recent",
      now: Date.now(),
    };
  }

  _scanLocalProjects() {
    const out = [];
    const prefix = ProjectProjectsPanel.LS_PROJECT_PREFIX;

    // Defensive: localStorage kann in manchen Sandbox/Privacy-Modi eingeschränkt sein
    let ls;
    try {
      ls = window.localStorage;
    } catch (e) {
      return out;
    }

    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k) continue;
      if (!k.startsWith(prefix)) continue;

      const id = k.slice(prefix.length) || "";
      let raw = null;
      try {
        raw = ls.getItem(k);
      } catch (e) {}

      // Minimal parse, aber stabil bleiben
      let name = "";
      let updatedAt = 0;

      if (raw) {
        try {
          const obj = JSON.parse(raw);
          name =
            obj?.project?.name ||
            obj?.meta?.name ||
            obj?.name ||
            obj?.projectName ||
            "";
          updatedAt =
            obj?.meta?.updatedAt ||
            obj?.meta?.savedAt ||
            obj?.updatedAt ||
            0;
        } catch (e) {
          // ignore parse errors
        }
      }

      out.push({
        id: id || "(ohne-id)",
        key: k,
        name: name || "(ohne Name)",
        updatedAt: Number(updatedAt || 0),
      });
    }

    // Neueste zuerst (fallback: id)
    out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || String(a.id).localeCompare(String(b.id)));
    return out;
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  renderBody(root, draft) {
    // Falls PanelBase draft nicht liefert, fallback
    if (!draft) draft = this._buildDraft();

    // Controls (Sort / Refresh)
    const controls = h("div", { class: "row", style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" } });

    const refreshBtn = h(
      "button",
      { class: "btn", type: "button" },
      "↻ Aktualisieren"
    );
    refreshBtn.addEventListener("click", () => {
      this.draft = this._buildDraft();
      this._dirty = false;
      this._render();
    });

    const count = Array.isArray(draft.items) ? draft.items.length : 0;
    controls.appendChild(refreshBtn);
    controls.appendChild(h("div", { style: { marginLeft: "auto", opacity: ".8", fontSize: "12px" } }, `Anzahl: ${count}`));
    root.appendChild(controls);

    // Liste
    const listWrap = h("div", { class: "cards", style: { display: "grid", gap: "10px" } });

    if (!count) {
      listWrap.appendChild(
        h("div", { style: { opacity: ".8" } }, "Keine Projekte im localStorage gefunden. (Erst im Wizard speichern.)")
      );
    } else {
      for (const it of draft.items) {
        // Wichtig für Playwright: die Projekt-ID soll als Text im #view auftauchen
        const card = h("div", {
          style: {
            border: "1px solid rgba(255,255,255,.10)",
            borderRadius: "12px",
            padding: "10px",
            background: "rgba(255,255,255,.04)",
          },
        });

        card.appendChild(h("div", { style: { fontWeight: "700" } }, String(it.id)));
        card.appendChild(h("div", { style: { opacity: ".85" } }, it.name));

        // Active Project: Öffnen (setzt ?project=local:<ID> und reloadet)
        const openBtn = h("button", { class: "btn", type: "button", style: { marginTop: "8px" } }, "Öffnen");
        openBtn.addEventListener("click", () => {
          try { localStorage.setItem("baustellenplaner:activeProject", "local:" + String(it.id)); } catch {}
          const u = new URL(location.href);
          u.searchParams.set("project", "local:" + String(it.id));
          location.href = u.toString();
        });
        card.appendChild(openBtn);
        if (it.updatedAt) {
          const d = new Date(it.updatedAt);
          card.appendChild(h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "4px" } }, `Updated: ${d.toLocaleString()}`));
        }

        listWrap.appendChild(card);
      }
    }

    const sec = Section({
      title: "Projektliste",
      description: "Quelle: localStorage",
      children: [listWrap],
    });

    root.appendChild(sec);
  }
}
