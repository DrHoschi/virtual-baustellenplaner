/**
 * ui/panels/ProjectGeneralPanel.js
 * Version: v1.0.0-hardcut-modular-v3 (2026-02-04)
 *
 * Erstes echtes Editor-Panel:
 * - Projekt → Allgemein
 * - Editiert project + settings (app-root)
 *
 * Hinweis:
 * - Persistenz (Zurückschreiben in project.json) kommt später.
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

function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

export class ProjectGeneralPanel extends PanelBase {
  getTitle() {
    return "Projekt – Allgemein";
  }

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
    // Wir schreiben bewusst nur die relevanten Teilbäume zurück.
    this.store.update("app", (app) => {
      app.project = app.project || {};
      app.settings = app.settings || {};

      // project.*
      Object.assign(app.project, draft.project);

      // settings.* (flach im aktuellen Default)
      Object.assign(app.settings, draft.settings);
    });
  }

  renderBody(bodyEl, draft) {
    // Section: Projekt
    const s1 = Section({
      title: "Projekt",
      description: "Metadaten des Projekts (project.json → project.*)",
      children: [
        FormField({
          label: "Name",
          value: draft.project.name,
          placeholder: "z.B. Baustelle Musterhalle",
          onChange: (v) => (draft.project.name = v)
        }),
        FormField({
          label: "Typ",
          value: draft.project.type,
          placeholder: "z.B. industriebau",
          onChange: (v) => (draft.project.type = v)
        }),
        FormField({
          label: "Kunde",
          value: draft.project.customer,
          placeholder: "optional",
          onChange: (v) => (draft.project.customer = v)
        }),
        FormField({
          label: "Ort",
          value: draft.project.location,
          placeholder: "optional",
          onChange: (v) => (draft.project.location = v)
        }),
        FormField({
          label: "Zeitzone",
          value: draft.project.timezone,
          placeholder: "Europe/Berlin",
          onChange: (v) => (draft.project.timezone = v)
        }),
        FormField({
          label: "Einheiten",
          type: "select",
          value: draft.project.units,
          options: [
            { value: "metric", label: "metric (m, kg)" },
            { value: "imperial", label: "imperial (ft, lb)" }
          ],
          onChange: (v) => (draft.project.units = v)
        })
      ]
    });

    // Section: UI/Settings
    const s2 = Section({
      title: "Anzeige / Beschreibung",
      description: "Projekt-Settings (defaults/projectSettings.general.json → app.settings.*)",
      children: [
        FormField({
          label: "Display Name",
          value: draft.settings.displayName,
          placeholder: "Name im UI",
          onChange: (v) => (draft.settings.displayName = v)
        }),
        FormField({
          label: "Projekt-Kategorie",
          value: draft.settings.projectType,
          placeholder: "z.B. conveyor_sim",
          onChange: (v) => (draft.settings.projectType = v)
        }),
        FormField({
          label: "Beschreibung",
          type: "textarea",
          value: draft.settings.description,
          placeholder: "kurze Beschreibung",
          onChange: (v) => (draft.settings.description = v)
        }),
        FormField({
          label: "Autor",
          value: draft.settings.author,
          placeholder: "optional",
          onChange: (v) => (draft.settings.author = v)
        }),
        FormField({
          label: "Firma",
          value: draft.settings.company,
          placeholder: "optional",
          onChange: (v) => (draft.settings.company = v)
        }),
        FormField({
          label: "Locale",
          value: draft.settings.locale,
          placeholder: "de-DE",
          onChange: (v) => (draft.settings.locale = v)
        }),
        FormField({
          label: "Sprache",
          value: draft.settings.language,
          placeholder: "de-DE",
          onChange: (v) => (draft.settings.language = v)
        })
      ]
    });

    bodyEl.appendChild(s1);
    bodyEl.appendChild(s2);

    bodyEl.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: Persistenz in project.json kommt später. Aktuell wird nur der Store geändert."
      )
    );
  }
}
