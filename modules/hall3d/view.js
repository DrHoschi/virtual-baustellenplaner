/**
 * modules/hall3d/view.js
 * Version: v1.3.0-project-ui-04a (2026-09-10)
 *
 * BP-HI01B.3 – Rapid Hall Edit Binding
 * PROJECT-UI-04A – Existing Project Hall Creation Entry
 * - app.project.hall remains the only hall authority
 * - existing halls still edit through the established edit boundary
 * - missing halls may be created for the currently opened project
 * - no writes to store.hall3d and no project-wizard reuse/refactor
 */

import { commitHallCreate } from "../../core/hall/hall-create.v1.js";
import { HALL_INDUSTRY_GABLE_V1 } from "../../core/hall/hall-config.v1.js";
import { commitHallEdit, HALL_EDIT_WALL_IDS } from "../../core/hall/hall-edit.v1.js";
import { initScene } from "./core/scene.js";
import { ModelFactory } from "./core/model-factory.js";

const ROOF_LABELS = {
  flat: "Flachdach",
  gable: "Satteldach",
  mono: "Pultdach",
};

const WALL_LABELS = {
  "wall:x0": "Stirnwand X0",
  "wall:xMax": "Stirnwand X max",
  "wall:z0": "Längswand Z0",
  "wall:zMax": "Längswand Z max",
};

function style(element, rules) {
  Object.assign(element.style, rules);
  return element;
}

function makeLabel(text) {
  const label = document.createElement("label");
  label.textContent = text;
  style(label, { fontSize: "12px", opacity: ".82" });
  return label;
}

function makeNumberInput(value, { min = null, step = "0.1" } = {}) {
  const input = document.createElement("input");
  input.type = "number";
  input.value = value == null ? "" : String(value);
  input.step = String(step);
  if (min != null) input.min = String(min);
  style(input, {
    width: "100%",
    boxSizing: "border-box",
    padding: "7px 8px",
    borderRadius: "7px",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.08)",
    color: "inherit",
  });
  return input;
}

function makeSelect(options, value) {
  const select = document.createElement("select");
  for (const option of options) {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    select.appendChild(el);
  }
  select.value = value;
  style(select, {
    width: "100%",
    boxSizing: "border-box",
    padding: "7px 8px",
    borderRadius: "7px",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(24,28,34,.96)",
    color: "inherit",
  });
  return select;
}

function addField(grid, labelText, control) {
  grid.appendChild(makeLabel(labelText));
  grid.appendChild(control);
}

export function createHall3DView({ bus, store, rootEl }) {
  let sceneCtx = null;
  let currentGroup = null;
  let elementMeshes = new Map();
  let editorHost = null;

  function currentProject() {
    const app = store.get("app") || {};
    return app?.project || null;
  }

  function clearStatusAttributes() {
    try {
      delete rootEl.dataset.hall3dStatus;
      delete rootEl.dataset.hallAuthority;
    } catch (_) { /* ignore */ }
  }

  function showStatus(message, status) {
    rootEl.innerHTML = "";
    const note = document.createElement("div");
    note.textContent = message;
    style(note, {
      padding: "16px",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      fontSize: "13px",
      opacity: ".8",
    });
    rootEl.appendChild(note);
    rootEl.dataset.hall3dStatus = status;
    rootEl.dataset.hallAuthority = "app.project.hall";
  }

  function renderCreateForm() {
    rootEl.innerHTML = "";
    rootEl.dataset.hall3dStatus = "no-hall";
    rootEl.dataset.hallAuthority = "app.project.hall";

    const defaults = HALL_INDUSTRY_GABLE_V1.defaults;
    const host = document.createElement("div");
    host.dataset.bpHallCreate = "project-ui-04a";
    style(host, {
      width: "min(430px, calc(100% - 24px))",
      boxSizing: "border-box",
      margin: "12px",
      padding: "14px",
      borderRadius: "10px",
      border: "1px solid rgba(127,127,127,.35)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    });

    const title = document.createElement("div");
    title.textContent = "Halle anlegen";
    style(title, { fontWeight: "700", fontSize: "15px", marginBottom: "4px" });
    host.appendChild(title);

    const note = document.createElement("div");
    note.textContent = "Für dieses Projekt ist noch keine Halle konfiguriert. Die Halle wird dem geöffneten Projekt zugeordnet.";
    style(note, { fontSize: "12px", opacity: ".75", marginBottom: "12px", lineHeight: "1.4" });
    host.appendChild(note);

    const authority = document.createElement("div");
    authority.textContent = "Autorität: project.hall";
    style(authority, { fontSize: "11px", opacity: ".62", marginBottom: "10px" });
    host.appendChild(authority);

    const form = document.createElement("form");
    form.dataset.bpHallCreateForm = "true";

    const grid = document.createElement("div");
    style(grid, {
      display: "grid",
      gridTemplateColumns: "1fr 130px",
      gap: "8px 10px",
      alignItems: "center",
    });

    const lengthInput = makeNumberInput(defaults.dimensions.length, { min: 1 });
    const widthInput = makeNumberInput(defaults.dimensions.width, { min: 1 });
    const eaveInput = makeNumberInput(defaults.dimensions.eaveHeight, { min: 2 });
    const roofSelect = makeSelect(
      Object.entries(ROOF_LABELS).map(([value, label]) => ({ value, label })),
      defaults.roof.type
    );
    const peakInput = makeNumberInput(defaults.roof.peakHeight, { min: 0 });
    const spacingInput = makeNumberInput(defaults.grid.longitudinal.spacing, { min: 0.5 });

    lengthInput.dataset.bpHallCreateField = "length";
    widthInput.dataset.bpHallCreateField = "width";
    eaveInput.dataset.bpHallCreateField = "eaveHeight";
    roofSelect.dataset.bpHallCreateField = "roofType";
    peakInput.dataset.bpHallCreateField = "peakHeight";
    spacingInput.dataset.bpHallCreateField = "gridSpacing";

    addField(grid, "Länge [m]", lengthInput);
    addField(grid, "Breite [m]", widthInput);
    addField(grid, "Traufhöhe [m]", eaveInput);
    addField(grid, "Dachform", roofSelect);
    addField(grid, "First / Hochpunkt [m]", peakInput);
    addField(grid, "Längsraster [m]", spacingInput);
    form.appendChild(grid);

    const status = document.createElement("div");
    status.dataset.bpHallCreateStatus = "true";
    style(status, {
      minHeight: "16px",
      marginTop: "10px",
      fontSize: "11px",
      lineHeight: "1.35",
      opacity: ".82",
    });
    form.appendChild(status);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.dataset.bpHallCreateSubmit = "true";
    submit.textContent = "Halle anlegen";
    style(submit, {
      width: "100%",
      marginTop: "4px",
      padding: "9px 10px",
      border: "0",
      borderRadius: "8px",
      fontWeight: "700",
      cursor: "pointer",
    });
    form.appendChild(submit);

    function syncRoofDraft() {
      const flat = roofSelect.value === "flat";
      peakInput.disabled = flat;
      if (flat) {
        peakInput.value = "";
        return;
      }
      const eave = Number(eaveInput.value);
      const peak = Number(peakInput.value);
      if (!Number.isFinite(peak) || !Number.isFinite(eave) || peak <= eave) {
        peakInput.value = Number.isFinite(eave) ? String(eave + 2) : "";
      }
    }

    roofSelect.addEventListener("change", syncRoofDraft);
    eaveInput.addEventListener("change", () => {
      if (roofSelect.value !== "flat") syncRoofDraft();
    });
    syncRoofDraft();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      status.textContent = "";

      const roofType = roofSelect.value;
      const result = commitHallCreate({
        store,
        bus,
        input: {
          dimensions: {
            length: Number(lengthInput.value),
            width: Number(widthInput.value),
            eaveHeight: Number(eaveInput.value),
          },
          roof: {
            type: roofType,
            peakHeight: roofType === "flat" ? null : Number(peakInput.value),
          },
          grid: {
            longitudinal: {
              mode: "spacing",
              spacing: Number(spacingInput.value),
            },
          },
        },
      });

      if (!result.committed) {
        status.textContent = result.errors.join(" · ") || "Halle konnte nicht angelegt werden.";
        return;
      }

      if (result.warnings.length) status.textContent = result.warnings.join(" · ");
    });

    host.appendChild(form);
    rootEl.appendChild(host);
  }

  function frameHall(project, built) {
    if (!sceneCtx?.cam || !built?.hall?.dimensions) return;

    const hall = built.hall;
    const { length, width, eaveHeight } = hall.dimensions;
    const top = hall.roof.type === "flat" ? eaveHeight : hall.roof.peakHeight;
    const span = Math.max(length, width, top, 10);
    const offset = hall.transform?.position || { x: 0, y: 0, z: 0 };
    const center = {
      x: (Number(offset.x) || 0) + length / 2,
      y: (Number(offset.y) || 0) + top * 0.45,
      z: (Number(offset.z) || 0) + width / 2,
    };

    sceneCtx.cam.position.set(
      center.x + span * 0.65,
      center.y + span * 0.45,
      center.z + span * 0.65
    );
    sceneCtx.cam.lookAt(center.x, center.y, center.z);
  }

  function renderEditor() {
    const hall = currentProject()?.hall;
    if (!sceneCtx?.container || !hall) return;
    if (editorHost) editorHost.remove();

    const host = document.createElement("div");
    host.dataset.bpHallEdit = "rapid-v1";
    style(host, {
      position: "absolute",
      top: "12px",
      right: "12px",
      width: "330px",
      maxWidth: "calc(100% - 24px)",
      maxHeight: "calc(100% - 24px)",
      overflow: "auto",
      boxSizing: "border-box",
      padding: "12px",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,.14)",
      background: "rgba(20,24,30,.90)",
      color: "#f3f5f7",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      zIndex: "6",
      boxShadow: "0 8px 28px rgba(0,0,0,.22)",
    });

    const title = document.createElement("div");
    title.textContent = "Halle bearbeiten";
    style(title, { fontWeight: "700", fontSize: "14px", marginBottom: "2px" });
    host.appendChild(title);

    const authority = document.createElement("div");
    authority.textContent = "Autorität: project.hall";
    style(authority, { fontSize: "11px", opacity: ".62", marginBottom: "10px" });
    host.appendChild(authority);

    const form = document.createElement("form");
    form.dataset.bpHallEditForm = "true";

    const grid = document.createElement("div");
    style(grid, {
      display: "grid",
      gridTemplateColumns: "1fr 120px",
      gap: "8px 10px",
      alignItems: "center",
    });

    const lengthInput = makeNumberInput(hall.dimensions.length, { min: 1 });
    const widthInput = makeNumberInput(hall.dimensions.width, { min: 1 });
    const eaveInput = makeNumberInput(hall.dimensions.eaveHeight, { min: 2 });
    const roofSelect = makeSelect(
      Object.entries(ROOF_LABELS).map(([value, label]) => ({ value, label })),
      hall.roof.type
    );
    const peakInput = makeNumberInput(
      hall.roof.type === "flat" ? "" : hall.roof.peakHeight,
      { min: 0 }
    );
    const spacingInput = makeNumberInput(hall.grid?.longitudinal?.spacing, { min: 0.5 });

    addField(grid, "Länge [m]", lengthInput);
    addField(grid, "Breite [m]", widthInput);
    addField(grid, "Traufhöhe [m]", eaveInput);
    addField(grid, "Dachform", roofSelect);
    addField(grid, "First / Hochpunkt [m]", peakInput);
    addField(grid, "Längsraster [m]", spacingInput);

    form.appendChild(grid);

    const wallTitle = document.createElement("div");
    wallTitle.textContent = "Außenwände";
    style(wallTitle, {
      marginTop: "12px",
      paddingTop: "10px",
      borderTop: "1px solid rgba(255,255,255,.12)",
      fontWeight: "650",
      fontSize: "12px",
    });
    form.appendChild(wallTitle);

    const wallControls = new Map();
    for (const wallId of HALL_EDIT_WALL_IDS) {
      const wall = hall.envelope?.walls?.[wallId] || { construction: "present", visible: true };
      const row = document.createElement("div");
      style(row, {
        display: "grid",
        gridTemplateColumns: "1fr 100px 62px",
        gap: "6px",
        alignItems: "center",
        marginTop: "7px",
      });

      row.appendChild(makeLabel(WALL_LABELS[wallId] || wallId));
      const construction = makeSelect([
        { value: "present", label: "vorhanden" },
        { value: "open", label: "offen" },
      ], wall.construction);

      const visibleLabel = document.createElement("label");
      style(visibleLabel, {
        display: "flex",
        gap: "4px",
        alignItems: "center",
        justifyContent: "flex-end",
        fontSize: "11px",
      });
      const visible = document.createElement("input");
      visible.type = "checkbox";
      visible.checked = wall.construction === "present" && wall.visible !== false;
      visible.disabled = wall.construction === "open";
      visibleLabel.appendChild(visible);
      visibleLabel.appendChild(document.createTextNode("sichtbar"));

      construction.addEventListener("change", () => {
        const isOpen = construction.value === "open";
        visible.disabled = isOpen;
        if (isOpen) visible.checked = false;
        else if (!visible.checked) visible.checked = true;
      });

      row.appendChild(construction);
      row.appendChild(visibleLabel);
      form.appendChild(row);
      wallControls.set(wallId, { construction, visible });
    }

    const status = document.createElement("div");
    status.dataset.bpHallEditStatus = "true";
    style(status, {
      minHeight: "16px",
      marginTop: "10px",
      fontSize: "11px",
      lineHeight: "1.35",
      opacity: ".82",
    });
    form.appendChild(status);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Halle übernehmen";
    style(submit, {
      width: "100%",
      marginTop: "4px",
      padding: "9px 10px",
      border: "0",
      borderRadius: "8px",
      fontWeight: "700",
      cursor: "pointer",
    });
    form.appendChild(submit);

    function syncRoofDraft() {
      const flat = roofSelect.value === "flat";
      peakInput.disabled = flat;
      if (flat) {
        peakInput.value = "";
        return;
      }

      const eave = Number(eaveInput.value);
      const peak = Number(peakInput.value);
      if (!Number.isFinite(peak) || !Number.isFinite(eave) || peak <= eave) {
        peakInput.value = Number.isFinite(eave) ? String(eave + 2) : "";
      }
    }

    roofSelect.addEventListener("change", syncRoofDraft);
    eaveInput.addEventListener("change", () => {
      if (roofSelect.value !== "flat") syncRoofDraft();
    });
    syncRoofDraft();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      status.textContent = "";

      const walls = {};
      for (const [wallId, controls] of wallControls.entries()) {
        walls[wallId] = {
          construction: controls.construction.value,
          visible: controls.construction.value === "present" && controls.visible.checked,
        };
      }

      const roofType = roofSelect.value;
      const result = commitHallEdit({
        store,
        bus,
        reason: "bp-hi01b3:rapid-hall-edit",
        changes: {
          dimensions: {
            length: Number(lengthInput.value),
            width: Number(widthInput.value),
            eaveHeight: Number(eaveInput.value),
          },
          roof: {
            type: roofType,
            peakHeight: roofType === "flat" ? null : Number(peakInput.value),
          },
          grid: {
            longitudinal: { spacing: Number(spacingInput.value) },
          },
          envelope: { walls },
        },
      });

      if (!result.committed) {
        status.textContent = result.errors.join(" · ") || "Änderung konnte nicht übernommen werden.";
        return;
      }

      if (result.warnings.length) status.textContent = result.warnings.join(" · ");
    });

    host.appendChild(form);
    sceneCtx.container.appendChild(host);
    editorHost = host;
  }

  async function mount() {
    if (sceneCtx) return;

    const project = currentProject();
    if (!project?.hall) {
      renderCreateForm();
      return;
    }

    sceneCtx = initScene({ rootEl });
    sceneCtx.mount();
    rootEl.style.position = "relative";
    rootEl.style.overflow = "hidden";

    try {
      const built = await ModelFactory.build(project);
      if (!built?.group) throw new Error("Hall generator returned no group.");

      sceneCtx.scene.add(built.group);
      currentGroup = built.group;
      elementMeshes = built.elementMeshes || new Map();
      frameHall(project, built);
      renderEditor();

      rootEl.dataset.hall3dStatus = "ready";
      rootEl.dataset.hallAuthority = "app.project.hall";
      rootEl.dataset.hallElementCount = String(elementMeshes.size);
    } catch (error) {
      try { sceneCtx.unmount(); } catch (_) { /* ignore */ }
      sceneCtx = null;
      currentGroup = null;
      elementMeshes = new Map();
      editorHost = null;
      console.error("[BP-HI01B.3] Hall projection failed", error);
      showStatus(`Halle kann nicht dargestellt werden: ${error?.message || "ungültige Hallendaten"}`, "invalid-hall");
    }
  }

  function unmount() {
    if (sceneCtx) {
      try {
        if (currentGroup) sceneCtx.scene.remove(currentGroup);
        sceneCtx.unmount();
      } catch (_) { /* ignore */ }
    }

    sceneCtx = null;
    currentGroup = null;
    elementMeshes = new Map();
    editorHost = null;
    rootEl.innerHTML = "";
    clearStatusAttributes();
    try { delete rootEl.dataset.hallElementCount; } catch (_) { /* ignore */ }
  }

  // Trigger only. Payload never carries hall authority: regeneration always
  // rereads the current app.project.hall after the central save event.
  bus.on("req:hall3d:rebuild", async () => {
    const core = store.get("core");
    if (core?.ui?.activeModule !== "hall3d") return;
    unmount();
    await mount();
  });

  return { mount, unmount };
}
