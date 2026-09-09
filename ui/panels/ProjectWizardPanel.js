/**
 * ui/panels/ProjectWizardPanel.js
 * Version: v1.1.0-project-setup-01e1 (2026-09-09)
 *
 * PROJECT-SETUP-01E.1 – Hall Project Seed & Wizard Happy Path
 * - fachliche Startvorlage statt sichtbarer technischer Modulwahl
 * - erste Vorlage: Industriehalle / Hallenplanung
 * - project.hall wird vor dem ersten Speichern normalisiert
 * - bestehender bp-projectfile/localStorage/Redirect-Pfad bleibt unverändert
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { FormField } from "../components/FormField.js";
import { h } from "../components/ui-dom.js";
import {
  HALL_INDUSTRY_GABLE_V1,
  normalizeHallConfig,
} from "../../core/hall/hall-config.v1.js";

const TEMPLATE_EMPTY = "empty";
const TEMPLATE_HALL = HALL_INDUSTRY_GABLE_V1.id;

function nowIso() {
  try { return new Date().toISOString(); } catch { return ""; }
}

function makeProjectId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const rnd = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `P-${yyyy}-${rnd}`;
}

function hallDraftDefaults() {
  return {
    length: 60,
    width: 30,
    eaveHeight: 8,
    roofType: "gable",
    peakHeight: 10,
    gridSpacing: 5,
  };
}

function normalizeWizardDraft(saved) {
  const src = saved && typeof saved === "object" ? saved : {};
  return {
    name: typeof src.name === "string" ? src.name : "",
    type: typeof src.type === "string" && src.type ? src.type : "industriebau",
    templateId: src.templateId === TEMPLATE_HALL ? TEMPLATE_HALL : TEMPLATE_EMPTY,
    hall: {
      ...hallDraftDefaults(),
      ...(src.hall && typeof src.hall === "object" ? src.hall : {}),
    },
  };
}

function modulesForTemplate(templateId) {
  return templateId === TEMPLATE_HALL
    ? ["core", "layout", "hall3d"]
    : ["core", "layout"];
}

function templateButton(label, description, selected, onClick) {
  return h("button", {
    type: "button",
    "aria-pressed": selected ? "true" : "false",
    onClick,
    style: {
      textAlign: "left",
      padding: "12px",
      borderRadius: "12px",
      border: selected ? "2px solid currentColor" : "1px solid rgba(127,127,127,.35)",
      background: selected ? "rgba(80,160,255,.12)" : "rgba(127,127,127,.05)",
      color: "inherit",
      cursor: "pointer",
    },
  },
    h("div", { style: { fontWeight: "700", marginBottom: "4px" } }, label),
    h("div", { style: { fontSize: "12px", opacity: ".78" } }, description),
  );
}

export class ProjectWizardPanel extends PanelBase {
  getTitle() { return "Projekt – Neu"; }

  getDescription() {
    return "Projektbasis und fachliche Startvorlage festlegen.";
  }

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    return normalizeWizardDraft(app?.ui?.drafts?.projectWizard);
  }

  applyDraftToStore(draft) {
    this._storeDraft(draft);
  }

  _ensureAppState() {
    const cur = this.store.get("app");
    if (cur == null) {
      this.store.set("app", { ui: { drafts: {} } });
      return;
    }
    if (!cur.ui) cur.ui = {};
    if (!cur.ui.drafts) cur.ui.drafts = {};
    this.store.set("app", cur);
  }

  _storeDraft(draft) {
    this._ensureAppState();
    const clean = normalizeWizardDraft(draft);
    this.store.update("app", (app) => {
      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.projectWizard = clean;
    });
  }

  _syncDraft(draft) {
    this._storeDraft(draft);
  }

  _writeLocalProject(project) {
    const id = project?.id;
    if (!id) throw new Error("Project id fehlt.");

    const payload = {
      schema: "bp-projectfile",
      version: "1.0",
      project,
      app: {
        settings: {},
        ui: { drafts: {} },
      },
    };

    localStorage.setItem(
      `baustellenplaner:projectfile:${id}`,
      JSON.stringify(payload, null, 2)
    );
  }

  _redirectToLocalProject(projectId) {
    const url = new URL(location.href);
    url.searchParams.set("project", `local:${projectId}`);
    location.href = url.toString();
  }

  _buildHallResult(draft) {
    return normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
      dimensions: {
        length: draft.hall.length,
        width: draft.hall.width,
        eaveHeight: draft.hall.eaveHeight,
      },
      roof: {
        type: draft.hall.roofType,
        peakHeight: draft.hall.roofType === "flat" ? null : draft.hall.peakHeight,
      },
      grid: {
        longitudinal: {
          mode: "spacing",
          spacing: draft.hall.gridSpacing,
        },
      },
    });
  }

  renderBody(bodyEl, draft) {
    if (!draft || typeof draft !== "object") draft = this.buildDraftFromStore();
    if (!draft.hall || typeof draft.hall !== "object") draft.hall = hallDraftDefaults();

    bodyEl.appendChild(
      h("div", { className: "panel-note" },
        "Das Projekt wird im Browser gespeichert. Die Startvorlage erzeugt nur fachliche Projektdaten; Hallengeometrie folgt in einem späteren Schritt."
      )
    );

    bodyEl.appendChild(
      Section({
        title: "1 · Projekt",
        children: [
          FormField({
            label: "Projektname",
            type: "text",
            value: draft.name,
            placeholder: "z. B. Baustelle Musterhalle",
            onChange: (v) => {
              draft.name = v;
              this.markDirty();
              this._syncDraft(draft);
            },
          }),
          FormField({
            label: "Projekt-Typ",
            type: "select",
            value: draft.type,
            options: [
              { value: "industriebau", label: "Industriebau" },
              { value: "anlagenbau", label: "Anlagenbau" },
              { value: "hochbau", label: "Hochbau" },
              { value: "infrastruktur", label: "Infrastruktur" },
            ],
            onChange: (v) => {
              draft.type = v;
              this.markDirty();
              this._syncDraft(draft);
            },
          }),
        ],
      })
    );

    const templateGrid = h("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "10px",
      },
    });

    templateGrid.appendChild(templateButton(
      "Leeres Projekt",
      "Projekt ohne vorbereitete Halle.",
      draft.templateId === TEMPLATE_EMPTY,
      () => {
        draft.templateId = TEMPLATE_EMPTY;
        this.markDirty();
        this._syncDraft(draft);
        this._rerender();
      }
    ));

    templateGrid.appendChild(templateButton(
      "Industriehalle / Hallenplanung",
      "Bereitet project.hall vor und aktiviert Core, Layout und Hall3D automatisch.",
      draft.templateId === TEMPLATE_HALL,
      () => {
        draft.templateId = TEMPLATE_HALL;
        if (!draft.type) draft.type = "industriebau";
        this.markDirty();
        this._syncDraft(draft);
        this._rerender();
      }
    ));

    bodyEl.appendChild(
      Section({
        title: "2 · Startvorlage",
        children: [templateGrid],
      })
    );

    if (draft.templateId === TEMPLATE_HALL) {
      const hallFields = [
        FormField({
          label: "Hallenlänge (m)",
          type: "number",
          value: draft.hall.length,
          min: 1,
          step: 0.01,
          onChange: (v) => { draft.hall.length = v; this.markDirty(); this._syncDraft(draft); },
        }),
        FormField({
          label: "Hallenbreite (m)",
          type: "number",
          value: draft.hall.width,
          min: 1,
          step: 0.01,
          onChange: (v) => { draft.hall.width = v; this.markDirty(); this._syncDraft(draft); },
        }),
        FormField({
          label: "Traufhöhe (m)",
          type: "number",
          value: draft.hall.eaveHeight,
          min: 2,
          step: 0.01,
          onChange: (v) => { draft.hall.eaveHeight = v; this.markDirty(); this._syncDraft(draft); },
        }),
        FormField({
          label: "Dachform",
          type: "select",
          value: draft.hall.roofType,
          options: [
            { value: "gable", label: "Satteldach" },
            { value: "flat", label: "Flachdach" },
            { value: "mono", label: "Pultdach" },
          ],
          onChange: (v) => {
            draft.hall.roofType = v;
            this.markDirty();
            this._syncDraft(draft);
            this._rerender();
          },
        }),
      ];

      if (draft.hall.roofType !== "flat") {
        hallFields.push(
          FormField({
            label: draft.hall.roofType === "mono" ? "Hochpunkthöhe (m)" : "Firsthöhe (m)",
            type: "number",
            value: draft.hall.peakHeight,
            min: 2.01,
            step: 0.01,
            onChange: (v) => { draft.hall.peakHeight = v; this.markDirty(); this._syncDraft(draft); },
          })
        );
      }

      hallFields.push(
        FormField({
          label: "Rastermaß Länge (m)",
          type: "number",
          value: draft.hall.gridSpacing,
          min: 0.5,
          step: 0.01,
          onChange: (v) => { draft.hall.gridSpacing = v; this.markDirty(); this._syncDraft(draft); },
        })
      );

      bodyEl.appendChild(
        Section({
          title: "3 · Hallengrunddaten",
          children: [
            h("div", { style: { opacity: ".8", marginBottom: "6px" } },
              "Startzustand: Boden + vier vorhandene/sichtbare Außenwände + Stützen/Hauptträger aus dem Längsraster. Tore, Türen und Zwischenwände folgen im Halleneditor."
            ),
            ...hallFields,
          ],
        })
      );
    }

    bodyEl.appendChild(
      Section({
        title: "4 · Bibliotheken",
        children: [
          h("div", { style: { opacity: ".8" } },
            "PROJECT-SETUP-01E.1 legt noch keine Library-Bindings an. Globale Bibliotheken und ProjectAssets bleiben unverändert."
          ),
        ],
      })
    );

    const moduleSummary = modulesForTemplate(draft.templateId).join(" + ");
    const summaryChildren = [
      h("div", {}, `Projekt: ${draft.name?.trim() || "(noch ohne Name)"}`),
      h("div", {}, `Typ: ${draft.type || "industriebau"}`),
      h("div", {}, `Vorlage: ${draft.templateId === TEMPLATE_HALL ? "Industriehalle / Hallenplanung" : "Leeres Projekt"}`),
      h("div", { style: { opacity: ".72", fontSize: "12px", marginTop: "4px" } }, `Technische Module automatisch: ${moduleSummary}`),
    ];

    if (draft.templateId === TEMPLATE_HALL) {
      summaryChildren.push(
        h("div", { style: { marginTop: "8px" } },
          `Halle: ${draft.hall.length} × ${draft.hall.width} m · Traufe ${draft.hall.eaveHeight} m · Raster ${draft.hall.gridSpacing} m`
        )
      );
    }

    const btn = h("button", {
      type: "button",
      className: "btn-primary",
      onClick: () => {
        const name = (draft.name || "").trim();
        if (!name) {
          alert("Bitte einen Projektnamen eingeben.");
          return;
        }

        let hallResult = null;
        if (draft.templateId === TEMPLATE_HALL) {
          hallResult = this._buildHallResult(draft);
          if (hallResult.errors.length) {
            alert(`Halle kann noch nicht angelegt werden:\n\n${hallResult.errors.join("\n")}`);
            return;
          }
          if (hallResult.warnings.length) {
            const proceed = confirm(`Hinweise zur Hallenkonfiguration:\n\n${hallResult.warnings.join("\n")}\n\nProjekt trotzdem anlegen?`);
            if (!proceed) return;
          }
        }

        const id = makeProjectId();
        const project = {
          schema: "baustellenplaner.project.v1",
          id,
          name,
          type: draft.type || "industriebau",
          timezone: "Europe/Berlin",
          units: "metric",
          version: "1.0.0",
          createdAt: nowIso(),
          uiPreset: "standard",
          modules: modulesForTemplate(draft.templateId),
          // Legacy assets container remains for compatibility; projectAssets is authoritative.
          assets: {
            items: [],
            folders: [],
            settings: {},
          },
          projectAssets: [],
        };

        if (hallResult) project.hall = hallResult.hall;

        try {
          this._writeLocalProject(project);
          try {
            this.store.update("app", (app) => {
              if (app?.ui?.drafts) delete app.ui.drafts.projectWizard;
            });
          } catch (_) { /* ignore */ }
          this._redirectToLocalProject(id);
        } catch (e) {
          console.error(e);
          alert("Projekt konnte nicht angelegt werden (siehe Konsole).");
        }
      },
    }, "Projekt anlegen");

    bodyEl.appendChild(
      Section({
        title: "5 · Prüfen & Anlegen",
        children: [
          ...summaryChildren,
          h("div", { style: { marginTop: "12px" } }, btn),
        ],
      })
    );
  }
}
