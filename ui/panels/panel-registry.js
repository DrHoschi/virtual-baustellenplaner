/**
 * ui/panels/panel-registry.js
 * Version: v1.1.0-panels-merge-fix (2026-02-07)
 *
 * Zentrale Panel-Registry
 * ---------------------------------------------------------------------------
 * Problem-Hintergrund (war bei dir sichtbar):
 * - Menü-Buttons existieren ("Projekt-Assets", "Bibliotheken"), aber beim Klick
 *   ist die Fläche leer (oder man sieht ein großes "?"), weil der Panel-Key
 *   zwar in plugin/menu registry auftaucht, aber im panel-registry nicht
 *   registriert ist.
 *
 * Lösung:
 * - Alle relevanten Projekt-Panels (inkl. Bibliotheken + Projekt-Assets)
 *   werden hier sauber registriert.
 * - Zusätzlich ein Alias für die Projektliste (projectList -> projects),
 *   damit alte/abweichende Menüeinträge nicht mehr ins Leere laufen.
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { ProjectWizardPanel } from "./ProjectWizardPanel.js";
import { ProjectGeneralPanel } from "./ProjectGeneralPanel.js";
import { ProjectProjectsPanel } from "./ProjectProjectsPanel.js";

// (neu) Asset-Bereich
import { AssetLibraryPanel } from "./AssetLibraryPanel.js";
import { ProjectAssetsPanel } from "./ProjectAssetsPanel.js";

// AssetLab (iframe-host) – existiert in deinem Repo bereits.
// Hinweis: Falls die Datei bei dir anders heißt, bitte diesen Import anpassen.
import { AssetLab3DPanel } from "./AssetLab3DPanel.js";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Erzeugt die Panel-Registry (Key -> PanelClass)
 *
 * @returns {Record<string, any>}
 */
export function createPanelRegistry() {
  /** @type {Record<string, any>} */
  const panels = {};

  // -------------------------------------------------------------------------
  // Projekt: Core
  // -------------------------------------------------------------------------
  panels["projectPanel:core"] = ProjectWizardPanel; // (historisch) – in deinem Menü als "Neu (Wizard)" usw.
  panels["projectPanel:general"] = ProjectGeneralPanel;

  // Projektliste / Projekte
  panels["projectPanel:projects"] = ProjectProjectsPanel;

  // ALIAS (wichtig!): einige Patches/Buttons referenzieren "projectList".
  // Damit knallt nichts mehr, zeigen wir dafür die gleiche Panel-Klasse.
  panels["projectPanel:projectList"] = ProjectProjectsPanel;

  // -------------------------------------------------------------------------
  // Assets
  // -------------------------------------------------------------------------
  panels["projectPanel:libraries"] = AssetLibraryPanel; // globaler Katalog
  panels["projectPanel:assets"] = ProjectAssetsPanel;   // Projekt-Assets
  panels["projectPanel:assetlab3d"] = AssetLab3DPanel;  // Viewer/Import/Export

  // -------------------------------------------------------------------------
  // TODO: hier später weitere Panels ergänzen (Simulation/Analyse/Export/...)
  // -------------------------------------------------------------------------

  return panels;
}
