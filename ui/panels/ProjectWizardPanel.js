/**
 * ui/panels/ProjectWizardPanel.js
 * Version: v1.0.0-hardcut-modular-v3.5.0 (2026-02-04)
 *
 * Panel: Projekt → Neuer Projekt-Wizard
 *
 * Motivation:
 * - Static Hosting: wir können keine Dateien "schreiben".
 * - Lösung: ProjectState/UIState in localStorage persistieren und über ?project=local:<id> laden.
 *
 * Was macht der Wizard?
 * - Template, Projektname, Typ, UI-Preset
 * - Module auswählen (Auto-Dependency: core wird immer erzwungen)
 * - sendet nur req:project:create → Store/Persistor erzeugt ProjectState/UIState
 * - Danach Redirect auf ?project=local:<id>
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { FormField } from "../components/FormField.js";
import { h } from "../components/ui-dom.js";

function nowIso() {
  try { return new Date().toISOString(); } catch { return ""; }
}

function makeProjectId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  // kleine Zufalls-Komponente, weil wir keinen globalen Counter haben
  const rnd = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `P-${yyyy}-${rnd}`;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load JSON: ${url} (${res.status})`);
  return await res.json();
}

function unique(arr) {
  return [...new Set(arr)];
}

export class ProjectWizardPanel extends PanelBase {
  getTitle() { return "Projekt – Neu (Wizard)"; }

  getDescription() {
    return "Neues Projekt anlegen (Wizard) – persistiert ProjectState/UIState in localStorage.";
  }

  buildDraftFromStore() {
    // Default-Vorschläge – Wizard ist unabhängig vom Store
    return {
      name: "",
      templateKey: "structure",
      type: "industriebau",
      uiPreset: "standard",
      modules: ["core", "layout"] // Default-Start
    };
  }

  applyDraftToStore(_draft) {
    // Wizard speichert nicht in app.project, sondern erstellt ein neues Projekt.
    // (Core/loader.js lädt es dann über ?project=local:<id>)
  }

  async _ensureCatalog() {
    if (this._catalogLoaded) return;
    this._catalogLoaded = true;

    // Module-Katalog aus modules registry + module.json laden
    try {
      const reg = await fetchJson("modules/modules.registry.json");
      const specs = Array.isArray(reg?.modules) ? reg.modules : [];
      this._moduleSpecs = specs;

      // manifests laden (für dependencies + labels)
      const manifestMap = new Map();
      for (const spec of specs) {
        if (!spec?.key) continue;
        const manifestUrl = spec.manifest || `modules/${spec.key}/module.json`;
        try {
          const man = await fetchJson(manifestUrl);
          manifestMap.set(spec.key, man);
        } catch (e) {
          // wenn ein manifest fehlt, fallback: minimal
          manifestMap.set(spec.key, { key: spec.key, label: spec.key, dependencies: [] });
        }
      }
      this._manifestMap = manifestMap;
    } catch (e) {
      console.error("[Wizard] module catalog failed:", e);
      this._moduleSpecs = [];
      this._manifestMap = new Map();
    }
  }

  _expandDependencies(selectedKeys) {
    const map = this._manifestMap || new Map();
    const out = new Set(selectedKeys);

    // core immer erzwingen
    out.add("core");

    let changed = true;
    while (changed) {
      changed = false;
      for (const key of [...out]) {
        const man = map.get(key);
        const deps = Array.isArray(man?.dependencies) ? man.dependencies : [];
        for (const d of deps) {
          if (!out.has(d)) {
            out.add(d);
            changed = true;
          }
        }
      }
    }
    return [...out];
  }

  _writeLocalProject(project) {
    const id = project?.id;
    if (!id) throw new Error("Project id fehlt.");
    localStorage.setItem(`baustellenplaner:projectfile:${id}`, JSON.stringify(project, null, 2));
  }

  _redirectToLocalProject(projectId) {
    const url = new URL(location.href);
    url.searchParams.set("project", `local:${projectId}`);
    location.href = url.toString();
  }

  renderBody(bodyEl, draft) {
    // Async catalog load (nach mount) – beim ersten Render zeigen wir Placeholder
    if (!this._catalogLoaded) {
      this._ensureCatalog().then(() => this._rerender());
    }

    const moduleSpecs = this._moduleSpecs || [];
    const manifestMap = this._manifestMap || new Map();

    // UI
    bodyEl.appendChild(
      h("div", { className: "panel-note" },
        "Hinweis: Dieses Projekt wird als JSON in localStorage gespeichert. ",
        "Für echte Datei-Exports nutzt später den Export-Workflow."
      )
    );

    // ----------------------------
    // Abschnitt: Basis
    // ----------------------------
    bodyEl.appendChild(
      Section({
        title: "Projektbasis",
        children: [
          FormField({
            label: "Template",
            type: "select",
            value: draft.templateKey,
            options: [
              { value: "structure", label: "Struktur / Aufbauplanung" },
              { value: "workspace", label: "Workspace / Workflow" },
              { value: "sim_basic", label: "Simulation Basic" },
              { value: "sim_advanced", label: "Simulation Advanced" },
              { value: "analysis_basic", label: "Analyse Basic" },
              { value: "analysis_industry", label: "Analyse Industry" },
              { value: "export_basic", label: "Export Basic" },
              { value: "export_industry", label: "Export Industry" },
              { value: "export_pro", label: "Export Pro" }
            ],
            onInput: (v) => { draft.templateKey = v; this.markDirty(); }
          }),
          FormField({
            label: "Projektname",
            type: "text",
            value: draft.name,
            placeholder: "z. B. Baustelle Musterhalle",
            onInput: (v) => { draft.name = v; this.markDirty(); }
          }),
          FormField({
            label: "Projekt-Typ",
            type: "select",
            value: draft.type,
            options: [
              { value: "industriebau", label: "Industriebau" },
              { value: "infrastruktur", label: "Infrastruktur" },
              { value: "anlagenbau", label: "Anlagenbau" },
              { value: "hochbau", label: "Hochbau" }
            ],
            onInput: (v) => { draft.type = v; this.markDirty(); }
          }),
          FormField({
            label: "UI Preset",
            type: "select",
            value: draft.uiPreset,
            options: [
              { value: "standard", label: "Standard" },
              { value: "minimal", label: "Minimal" },
              { value: "presentation", label: "Präsentation" }
            ],
            onInput: (v) => { draft.uiPreset = v; this.markDirty(); }
          })
        ]
      })
    );

    // ----------------------------
    // Abschnitt: Module
    // ----------------------------
    const moduleList = h("div", { className: "wizard-modules" });

    if (moduleSpecs.length === 0) {
      moduleList.appendChild(
        h("div", { style: "opacity:.7" }, "Modul-Katalog wird geladen… (oder nicht verfügbar)")
      );
    } else {
      moduleSpecs.forEach((spec) => {
        const key = spec.key;
        const man = manifestMap.get(key) || { key, label: key, dependencies: [] };
        const isCore = key === "core";
        const checked = draft.modules.includes(key) || isCore;

        const deps = Array.isArray(man.dependencies) ? man.dependencies : [];
        const label = man.label || key;

        const row = h("label", { className: "wizard-moduleRow" },
          h("input", {
            type: "checkbox",
            checked,
            disabled: isCore,
            onChange: (e) => {
              const on = !!e.target.checked;
              if (on) draft.modules = unique([...draft.modules, key]);
              else draft.modules = draft.modules.filter((k) => k !== key);

              // Dependencies automatisch erweitern (core erzwingen)
              draft.modules = this._expandDependencies(draft.modules);

              this.markDirty();
              this._rerender();
            }
          }),
          h("span", { className: "wizard-moduleLabel" }, `${label} (${key})`),
          deps.length ? h("span", { className: "wizard-moduleDeps" }, `Deps: ${deps.join(", ")}`) : null
        );

        moduleList.appendChild(row);
      });

      // nach jeder Darstellung: Dependencies sicherstellen
      draft.modules = this._expandDependencies(draft.modules);
    }

    bodyEl.appendChild(
      Section({
        title: "Module",
        children: [
          h("div", { style: "margin-bottom:8px; opacity:.8" },
            "Core wird immer automatisch aktiviert. Dependencies werden automatisch ergänzt."
          ),
          moduleList
        ]
      })
    );

    // ----------------------------
    // Abschnitt: Anlegen
    // ----------------------------
    const btn = h("button", {
      type: "button",
      className: "btn-primary",
      onClick: () => {
        const name = (draft.name || "").trim();
        if (!name) {
          alert("Bitte einen Projektnamen eingeben.");
          return;
        }

        // --------------------------------------------
        // NEW FLOW (v1.1): Wizard besitzt KEINEN State.
        // Er sendet nur einen Command – Store/Persistor
        // erzeugt + persistiert Project/UI State.
        // --------------------------------------------

        const payload = {
          templateKey: draft.templateKey || "structure",
          name,
          type: draft.type || "industriebau",
          uiPreset: draft.uiPreset || "standard",
          modules: this._expandDependencies(draft.modules || [])
        };

        // One-shot Listener: wenn erstellt → Redirect
        const off = this.bus?.on("cb:project:created", ({ id }) => {
          try { off && off(); } catch {}
          this._redirectToLocalProject(id);
        });

        try {
          this.bus?.emit("req:project:create", payload);
        } catch (e) {
          console.error(e);
          alert("Projekt konnte nicht angelegt werden (siehe Konsole).");
          try { off && off(); } catch {}
        }
      }
    }, "Projekt anlegen (localStorage)");

    bodyEl.appendChild(
      Section({
        title: "Fertig",
        children: [
          h("div", { style: "opacity:.8; margin-bottom:10px" },
            "Erzeugt ein neues Projekt in localStorage und lädt es sofort."
          ),
          btn
        ]
      })
    );
  }
}
