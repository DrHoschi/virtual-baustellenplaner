/**
 * ui/panels/ProjectProjectsPanel.js
 * Version: v2.0.0-projectlist-polish (2026-02-15)
 *
 * Verbesserungen:
 * - Sortierung nach createdAt (neueste oben)
 * - Duplizieren benennt automatisch "(Kopie)"
 * - Schnell-Export Button
 */

import { PanelBase } from "./PanelBase.js";

const STORAGE_PREFIX = "baustellenplaner:projectfile:";

function getAllProjectKeys() {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(STORAGE_PREFIX));
}

function loadProjectFile(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function saveProjectFile(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function sanitizeId(id) {
  return String(id || "").split("?")[0].split("#")[0].trim();
}

function generateNewProjectId() {
  return "P-" + Date.now();
}

export class ProjectProjectsPanel extends PanelBase {

  renderBody() {
    const container = document.createElement("div");
    container.className = "project-list";

    const keys = getAllProjectKeys();

    const projects = keys
      .map(key => {
        const data = loadProjectFile(key);
        if (!data || !data.project) return null;
        return {
          key,
          data,
          createdAt: new Date(data.project.createdAt || 0)
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt); // neueste oben

    if (projects.length === 0) {
      container.innerHTML = "<p>Keine Projekte vorhanden.</p>";
      return container;
    }

    projects.forEach(({ key, data }) => {
      const project = data.project;

      const card = document.createElement("div");
      card.className = "project-card";

      const title = document.createElement("h3");
      title.textContent = project.name || "Unbenanntes Projekt";

      const meta = document.createElement("div");
      meta.className = "project-meta";
      meta.textContent = `ID: ${project.id} · ${project.type}`;

      const btnRow = document.createElement("div");
      btnRow.className = "project-actions";

      // Öffnen
      const openBtn = document.createElement("button");
      openBtn.textContent = "Öffnen";
      openBtn.onclick = () => {
        const cleanId = sanitizeId(project.id);
        window.location.href = `?project=${encodeURIComponent("local:" + cleanId)}`;
      };

      // Duplizieren
      const duplicateBtn = document.createElement("button");
      duplicateBtn.textContent = "Duplizieren";
      duplicateBtn.onclick = () => {
        const clone = structuredClone(data);

        const newId = generateNewProjectId();
        clone.project.id = newId;
        clone.project.name = (project.name || "Projekt") + " (Kopie)";
        clone.project.createdAt = new Date().toISOString();

        clone.app = clone.app || {};
        clone.app.activeProjectId = newId;

        const newKey = STORAGE_PREFIX + newId;
        saveProjectFile(newKey, clone);

        this.rerender();
      };

      // Export
      const exportBtn = document.createElement("button");
      exportBtn.textContent = "Export";
      exportBtn.onclick = () => {
        const blob = new Blob(
          [JSON.stringify(data, null, 2)],
          { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project.name || project.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };

      // Löschen
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Löschen";
      deleteBtn.onclick = () => {
        if (!confirm("Projekt wirklich löschen?")) return;
        localStorage.removeItem(key);
        this.rerender();
      };

      btnRow.append(openBtn, duplicateBtn, exportBtn, deleteBtn);
      card.append(title, meta, btnRow);
      container.appendChild(card);
    });

    return container;
  }
}
