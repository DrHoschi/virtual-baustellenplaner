import { clickLegacyTarget } from "./ModuleNavigation.js";

const OPEN_TARGET_KEY = "bp:project-ui-02b:open-target";
const PROJECT_PREFIX = "baustellenplaner:projectfile:";
const PROJECT_MANAGEMENT_PANEL = "projectPanel:projects";
const PROJECT_OVERVIEW_PANEL = "projectPanel:general";

function activePanelId() {
  return String(document.getElementById("active")?.textContent || "").trim();
}

function isPanelTransitionPending(panelId) {
  const value = String(panelId || "").trim();
  return !value || /^\(lädt\.\.\.\)$/i.test(value);
}

function localProjectIds() {
  const ids = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PROJECT_PREFIX)) continue;
      const id = key.slice(PROJECT_PREFIX.length).trim();
      if (id) ids.push(id);
    }
  } catch {}
  return ids;
}

function projectIdForOpenButton(button) {
  const card = button?.parentElement?.parentElement || null;
  const text = String(card?.textContent || "");
  if (!text) return null;

  return localProjectIds()
    .sort((a, b) => b.length - a.length)
    .find((id) => text.includes(id)) || null;
}

function validateLocalProject(projectId) {
  if (!projectId) return false;
  try {
    const raw = localStorage.getItem(PROJECT_PREFIX + projectId);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    const project = (parsed.project && typeof parsed.project === "object") ? parsed.project : parsed;
    return !!project && typeof project === "object";
  } catch {
    return false;
  }
}

function rememberOverviewTarget(projectId) {
  try {
    sessionStorage.setItem(OPEN_TARGET_KEY, JSON.stringify({
      projectRef: `local:${projectId}`,
      target: PROJECT_OVERVIEW_PANEL
    }));
  } catch {}
}

function readPendingTarget() {
  try {
    const raw = sessionStorage.getItem(OPEN_TARGET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.target !== PROJECT_OVERVIEW_PANEL || !parsed.projectRef) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearPendingTarget() {
  try { sessionStorage.removeItem(OPEN_TARGET_KEY); } catch {}
}

function completePendingOpen() {
  const pending = readPendingTarget();
  if (!pending) return false;

  const currentProjectRef = new URLSearchParams(location.search).get("project") || "";
  if (currentProjectRef !== pending.projectRef) return false;

  const panelId = activePanelId();
  if (panelId === PROJECT_OVERVIEW_PANEL) {
    clearPendingTarget();
    return true;
  }

  // B-03B-002 – Pending Reopen Double-Navigation Guard
  // Beim lokalen Projekt-Reopen mountet der Loader bereits den in app.ui.activeModule
  // gespeicherten Overview-Target. Solange #active noch "(lädt...)" meldet, darf der
  // 02B-Pending-Open-Adapter keinen zweiten projectPanel:general-Request auslösen.
  // Der MutationObserver ruft completePendingOpen() erneut auf, sobald der Loader den
  // tatsächlichen Panelzustand veröffentlicht. Falls danach ein anderer Panelzustand
  // aktiv ist, bleibt der bestehende 02B-Fallback via clickLegacyTarget erhalten.
  if (isPanelTransitionPending(panelId)) return false;

  if (!clickLegacyTarget(PROJECT_OVERVIEW_PANEL)) return false;

  queueMicrotask(() => {
    if (activePanelId() === PROJECT_OVERVIEW_PANEL) clearPendingTarget();
  });
  return true;
}

function onProjectManagementClick(event) {
  if (activePanelId() !== PROJECT_MANAGEMENT_PANEL) return;

  const target = event.target instanceof Element ? event.target.closest("button") : null;
  if (!target) return;
  if (String(target.textContent || "").trim() !== "Öffnen") return;

  const projectId = projectIdForOpenButton(target);
  if (!projectId || !validateLocalProject(projectId)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    alert("Projekt konnte nicht geöffnet werden: Die lokale Projektdatei fehlt oder ist ungültig.");
    return;
  }

  rememberOverviewTarget(projectId);
}

export function installProjectManagementAdapter() {
  if (globalThis.__BP_PROJECT_UI_02B_MANAGEMENT_ADAPTER__) {
    return globalThis.__BP_PROJECT_UI_02B_MANAGEMENT_ADAPTER__;
  }

  const active = document.getElementById("active");
  document.addEventListener("click", onProjectManagementClick, true);

  const observer = active ? new MutationObserver(() => completePendingOpen()) : null;
  observer?.observe(active, {
    childList: true,
    subtree: true,
    characterData: true
  });

  completePendingOpen();

  const api = Object.freeze({
    completePendingOpen,
    destroy() {
      observer?.disconnect();
      document.removeEventListener("click", onProjectManagementClick, true);
      if (globalThis.__BP_PROJECT_UI_02B_MANAGEMENT_ADAPTER__ === api) {
        delete globalThis.__BP_PROJECT_UI_02B_MANAGEMENT_ADAPTER__;
      }
    }
  });

  globalThis.__BP_PROJECT_UI_02B_MANAGEMENT_ADAPTER__ = api;
  return api;
}
