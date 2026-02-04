/**
 * ui/panels/ProjectGeneralPanel.js
 * Version: v1.0.0-hardcut-modular-v3.2 (2026-02-04)
 *
 * Panel: Projekt → Allgemein
 * - editierbare Metadaten (app.project.*)
 * - zusätzliche UI/Settings Felder (app.settings.*)
 *
 * v3.2:
 * - Dirty-Tracking: jede Eingabe markiert "Ungespeichert"
 * - Speichern (Toolbar) schreibt in Store; Persistenz via AppPersistor (localStorage)
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { FormField } from "../components/FormField.js";
import { h } from "../components/ui-dom.js";

function getSafe(obj, path, fallback = "") {
  try {
    return path.split(".").reduce((a, k) => (a && a[k] != null ? a[k] : null), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

export class ProjectGeneralPanel extends PanelBase {
  getTitle() { return "Projekt – Allgemein"; }

  getDescription() {
    const pid = this.store.get("app")?.project?.id || "";
    return pid ? `Projekt-ID: ${pid}` : "";
  }

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const project = app.project || {};
    const settings = app.settings || {};

    return {
      project: {
        name: project.name || "",
        type: project.type || "",
        customer: project.customer || "",
        location: project.location || "",
        timezone: project.timezone || "",
        units: project.units || "metric"
      },
      settings: {
        displayName: getSafe(settings, "displayName", ""),
        projectType: getSafe(settings, "projectType", ""),
        description: getSafe(settings, "description", ""),
        author: getSafe(settings, "author", ""),
        company: getSafe(settings, "company", ""),
        locale: getSafe(settings, "locale", "de-DE"),
        language: getSafe(settings, "language", "de-DE")
      }
    };
  }

  applyDraftToStore(draft) {
    this.store.update("app", (app) => {
      app.project = app.project || {};
      app.settings = app.settings || {};
      Object.assign(app.project, draft.project);
      Object.assign(app.settings, draft.settings);
    });
  }

  renderBody(bodyEl, draft) {
    const dirty = () => this.markDirty();

    const s1 = Section({
      title: "Projekt",
      description: "Metadaten des Projekts (project.json → project.*)",
      children: [
        FormField({ label: "Name", value: draft.project.name, placeholder: "z.B. Baustelle Musterhalle",
          onChange: (v) => { draft.project.name = v; dirty(); } }),
        FormField({ label: "Typ", value: draft.project.type, placeholder: "z.B. industriebau",
          onChange: (v) => { draft.project.type = v; dirty(); } }),
        FormField({ label: "Kunde", value: draft.project.customer, placeholder: "optional",
          onChange: (v) => { draft.project.customer = v; dirty(); } }),
        FormField({ label: "Ort", value: draft.project.location, placeholder: "optional",
          onChange: (v) => { draft.project.location = v; dirty(); } }),
        FormField({ label: "Zeitzone", value: draft.project.timezone, placeholder: "Europe/Berlin",
          onChange: (v) => { draft.project.timezone = v; dirty(); } }),
        FormField({
          label: "Einheiten",
          type: "select",
          value: draft.project.units,
          options: [
            { value: "metric", label: "metric (m, kg)" },
            { value: "imperial", label: "imperial (ft, lb)" }
          ],
          onChange: (v) => { draft.project.units = v; dirty(); }
        })
      ]
    });

    const s2 = Section({
      title: "Anzeige / Beschreibung",
      description: "Projekt-Settings (defaults/projectSettings.general.json → app.settings.*)",
      children: [
        FormField({ label: "Display Name", value: draft.settings.displayName, placeholder: "Name im UI",
          onChange: (v) => { draft.settings.displayName = v; dirty(); } }),
        FormField({ label: "Projekt-Kategorie", value: draft.settings.projectType, placeholder: "z.B. conveyor_sim",
          onChange: (v) => { draft.settings.projectType = v; dirty(); } }),
        FormField({ label: "Beschreibung", type: "textarea", value: draft.settings.description, placeholder: "kurze Beschreibung",
          onChange: (v) => { draft.settings.description = v; dirty(); } }),
        FormField({ label: "Autor", value: draft.settings.author, placeholder: "optional",
          onChange: (v) => { draft.settings.author = v; dirty(); } }),
        FormField({ label: "Firma", value: draft.settings.company, placeholder: "optional",
          onChange: (v) => { draft.settings.company = v; dirty(); } }),
        FormField({ label: "Locale", value: draft.settings.locale, placeholder: "de-DE",
          onChange: (v) => { draft.settings.locale = v; dirty(); } }),
        FormField({ label: "Sprache", value: draft.settings.language, placeholder: "de-DE",
          onChange: (v) => { draft.settings.language = v; dirty(); } })
      ]
    });

    bodyEl.appendChild(s1);
    bodyEl.appendChild(s2);

    bodyEl.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: 'Speichern' schreibt in den Store. Persistenz (localStorage) ist aktiv. Export in Datei kommt später."
      )
    );
  }
}
