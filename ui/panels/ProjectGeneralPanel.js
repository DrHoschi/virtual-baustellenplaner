/**
 * ui/panels/ProjectGeneralPanel.js
 * Version: v1.0.1-project-hall-readback (2026-09-09)
 *
 * Panel: Projekt → Allgemein
 * - editierbare Metadaten (app.project.*)
 * - zusätzliche UI/Settings Felder (app.settings.*)
 * - PROJECT-SETUP-01E.1: project.hall read-only sichtbar machen
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

function safeClone(obj) {
  // Safari/iOS kompatibel (structuredClone ist nicht überall garantiert)
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch { /* ignore */ }
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

function formatMeters(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  try {
    return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)} m`;
  } catch {
    return `${n} m`;
  }
}

function roofLabel(roof = {}) {
  const type = String(roof?.type || "");
  if (type === "flat") return "Flachdach";
  if (type === "mono") return "Pultdach";
  if (type === "gable") return "Satteldach";
  return type || "–";
}

function hallReadbackRows(hall) {
  if (!hall || typeof hall !== "object") return [];

  const length = hall?.dimensions?.length;
  const width = hall?.dimensions?.width;
  const eaveHeight = hall?.dimensions?.eaveHeight;
  const spacing = hall?.grid?.longitudinal?.spacing;
  const peakHeight = hall?.roof?.peakHeight;
  const roofType = hall?.roof?.type;
  const presetId = hall?.presetRef?.id || "–";

  const walls = hall?.envelope?.walls && typeof hall.envelope.walls === "object"
    ? Object.values(hall.envelope.walls)
    : [];
  const presentWalls = walls.filter((wall) => wall?.construction === "present").length;
  const visibleWalls = walls.filter((wall) => wall?.construction === "present" && wall?.visible !== false).length;

  const roofText = roofType === "flat"
    ? roofLabel(hall.roof)
    : `${roofLabel(hall.roof)} · ${roofType === "mono" ? "Hochpunkt" : "First"} ${formatMeters(peakHeight)}`;

  return [
    ["Vorlage", presetId],
    ["Grundmaß", `${formatMeters(length)} × ${formatMeters(width)}`],
    ["Traufhöhe", formatMeters(eaveHeight)],
    ["Dach", roofText],
    ["Längsraster", formatMeters(spacing)],
    ["Außenwände", `${presentWalls} vorhanden · ${visibleWalls} sichtbar`],
  ];
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

    // Optional: Draft-Zwischenspeicher (Tab-Wechsel ohne Speichern)
    const savedDraft = app?.ui?.drafts?.projectGeneral;

    const draft = {
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

    if (savedDraft && typeof savedDraft === "object") {
      // flach mergen, damit ältere Drafts kompatibel bleiben
      if (savedDraft.project) Object.assign(draft.project, savedDraft.project);
      if (savedDraft.settings) Object.assign(draft.settings, savedDraft.settings);
    }

    return draft;
  }

  applyDraftToStore(draft) {
    this.store.update("app", (app) => {
      app.project = app.project || {};
      app.settings = app.settings || {};
      Object.assign(app.project, draft.project);
      Object.assign(app.settings, draft.settings);

      // Draft ebenfalls ablegen (damit UI beim Tab-Wechsel nicht "leer" wirkt)
      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.projectGeneral = safeClone(draft);
    });

    // Speichern soll bei localStorage-Projekten auch wirklich im Projectfile landen,
    // sonst ist die Projektliste / Reload nicht konsistent.
    this._persistActiveProjectFile();
  }

  // ------------------------------------------------------------
  // Persist: Active Project -> localStorage (projectfile)
  // ------------------------------------------------------------
  _persistActiveProjectFile() {
    try {
      const app = this.store.get("app") || {};
      const ref = app.activeProject;
      if (!ref || ref.kind !== "local" || !ref.id) return;

      const project = app.project || {};
      const payload = {
        schema: "bp-projectfile",
        version: "1.0",
        project: project,
        app: {
          settings: app.settings || {},
          ui: app.ui || {}
        }
      };

      localStorage.setItem("baustellenplaner:projectfile:" + ref.id, JSON.stringify(payload));
    } catch (e) {
      // NICHT fatal machen – UI soll weiter laufen.
      console.warn("[ProjectGeneralPanel] persistActiveProjectFile failed", e);
    }
  }

  renderBody(bodyEl, draft) {
    const dirty = () => this.markDirty();
    const sync = () => {
      // Live-Sync: Eingaben bleiben erhalten, auch wenn man den Tab wechselt,
      // ohne explizit "Speichern" zu drücken.
      this.store.update("app", (app) => {
        app.ui = app.ui || {};
        app.ui.drafts = app.ui.drafts || {};
        app.ui.drafts.projectGeneral = safeClone(draft);
      });
    };

    const s1 = Section({
      title: "Projekt",
      description: "Metadaten des Projekts (project.json → project.*)",
      children: [
        FormField({ label: "Name", value: draft.project.name, placeholder: "z.B. Baustelle Musterhalle",
          onChange: (v) => { draft.project.name = v; dirty(); sync(); } }),
        FormField({ label: "Typ", value: draft.project.type, placeholder: "z.B. industriebau",
          onChange: (v) => { draft.project.type = v; dirty(); sync(); } }),
        FormField({ label: "Kunde", value: draft.project.customer, placeholder: "optional",
          onChange: (v) => { draft.project.customer = v; dirty(); sync(); } }),
        FormField({ label: "Ort", value: draft.project.location, placeholder: "optional",
          onChange: (v) => { draft.project.location = v; dirty(); sync(); } }),
        FormField({ label: "Zeitzone", value: draft.project.timezone, placeholder: "Europe/Berlin",
          onChange: (v) => { draft.project.timezone = v; dirty(); sync(); } }),
        FormField({
          label: "Einheiten",
          type: "select",
          value: draft.project.units,
          options: [
            { value: "metric", label: "metric (m, kg)" },
            { value: "imperial", label: "imperial (ft, lb)" }
          ],
          onChange: (v) => { draft.project.units = v; dirty(); sync(); }
        })
      ]
    });

    const hall = this.store.get("app")?.project?.hall || null;
    const hallRows = hallReadbackRows(hall);
    const hallChildren = hallRows.length
      ? [
          h("div", {
            style: {
              display: "grid",
              gridTemplateColumns: "minmax(110px, .8fr) minmax(0, 1.6fr)",
              gap: "8px 12px",
              padding: "10px 0",
            },
          },
          ...hallRows.flatMap(([label, value]) => [
            h("div", { style: { opacity: ".68", fontSize: "12px" } }, label),
            h("div", { style: { fontWeight: "600", overflowWrap: "anywhere" } }, value),
          ])),
          h("div", {
            style: {
              gridColumn: "1 / -1",
              marginTop: "4px",
              paddingTop: "8px",
              borderTop: "1px solid rgba(127,127,127,.18)",
              opacity: ".65",
              fontSize: "11px",
            },
          }, "Read-only aus project.hall · Bearbeitung folgt im Hallenplaner."),
        ]
      : [
          h("div", { style: { opacity: ".72" } },
            "Für dieses Projekt ist noch keine Halle konfiguriert."
          ),
        ];

    const sHall = Section({
      title: "Halle",
      description: hall ? "Gespeicherte Hallenparameter" : "Keine Hallenkonfiguration",
      children: hallChildren,
    });

    const s2 = Section({
      title: "Anzeige / Beschreibung",
      description: "Projekt-Settings (defaults/projectSettings.general.json → app.settings.*)",
      children: [
        FormField({ label: "Display Name", value: draft.settings.displayName, placeholder: "Name im UI",
          onChange: (v) => { draft.settings.displayName = v; dirty(); sync(); } }),
        FormField({ label: "Projekt-Kategorie", value: draft.settings.projectType, placeholder: "z.B. conveyor_sim",
          onChange: (v) => { draft.settings.projectType = v; dirty(); sync(); } }),
        FormField({ label: "Beschreibung", type: "textarea", value: draft.settings.description, placeholder: "kurze Beschreibung",
          onChange: (v) => { draft.settings.description = v; dirty(); sync(); } }),
        FormField({ label: "Autor", value: draft.settings.author, placeholder: "optional",
          onChange: (v) => { draft.settings.author = v; dirty(); sync(); } }),
        FormField({ label: "Firma", value: draft.settings.company, placeholder: "optional",
          onChange: (v) => { draft.settings.company = v; dirty(); sync(); } }),
        FormField({ label: "Locale", value: draft.settings.locale, placeholder: "de-DE",
          onChange: (v) => { draft.settings.locale = v; dirty(); sync(); } }),
        FormField({ label: "Sprache", value: draft.settings.language, placeholder: "de-DE",
          onChange: (v) => { draft.settings.language = v; dirty(); sync(); } })
      ]
    });

    bodyEl.appendChild(s1);
    bodyEl.appendChild(sHall);
    bodyEl.appendChild(s2);

    bodyEl.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Hinweis: 'Speichern' schreibt in den Store. Persistenz (localStorage) ist aktiv. Export in Datei kommt später."
      )
    );
  }
}
