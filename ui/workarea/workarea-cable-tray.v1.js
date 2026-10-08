/**
 * Workarea cable-tray domain methods.
 *
 * BP-RF-01 is a structural extraction only. The methods below retain the
 * existing Workarea state, persistence and scene authorities; this module
 * introduces no store, service or parallel data model.
 */
class WorkareaCableTrayModule {
  _normalizeCableTrayDutyClassV1(value = "") {
    return String(value || "") === "heavy" ? "heavy" : "standard";
  }

  _getCableTrayDutyClassLabelV1(value = "") {
    return this._normalizeCableTrayDutyClassV1(value) === "heavy" ? "Schwer" : "Standard";
  }

  _cableTrayMappingDutyClassMatchesV1(mapping = {}, dutyClass = "standard") {
    return this._normalizeCableTrayDutyClassV1(mapping?.dutyClass) === this._normalizeCableTrayDutyClassV1(dutyClass);
  }

  _getCableTrayRoutesForAssignmentV1() {
    return (this._scene?.objects || []).filter((o) =>
      o && String(o.type || "") === "cable-tray.route" && String(o.id || "").trim()
    );
  }

  _getCableTrayTraversalEndpointsV1(route, direction) {
    const points = Array.isArray(route?.points) ? route.points : [];
    if (points.length < 1 || (direction !== "forward" && direction !== "reverse")) return null;
    const first = points[0];
    const last = points[points.length - 1];
    if (![first?.x, first?.y, last?.x, last?.y].every((v) => Number.isFinite(Number(v)))) return null;
    const start = { x: Number(first.x), y: Number(first.y) };
    const end = { x: Number(last.x), y: Number(last.y) };
    return direction === "reverse"
      ? { entry: end, exit: start }
      : { entry: start, exit: end };
  }

  _sanitizeCableTrayFittingConnectionV1(raw) {
    if (!raw || typeof raw !== "object") return null;
    const routeId = String(raw.routeId || "").trim();
    const pointIndex = Number(raw.pointIndex);
    if (!routeId || !Number.isInteger(pointIndex) || pointIndex < 0) return null;
    return { routeId, pointIndex };
  }

  _sanitizeCableTrayFittingV1(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    const kind = String(raw.kind || "").trim();
    if (!id || !["bend", "tee", "reducer", "connector"].includes(kind)) return null;
    const connections = (Array.isArray(raw.connections) ? raw.connections : [])
      .map((connection) => this._sanitizeCableTrayFittingConnectionV1(connection))
      .filter(Boolean);
    return { id, kind, connections };
  }

  _getCableTrayFittingsFromStore() {
    const app = this.store?.get?.("app") || {};
    const raw = app?.project?.workspace?.scene?.cableTrayFittings;
    return (Array.isArray(raw) ? raw : [])
      .map((fitting) => this._sanitizeCableTrayFittingV1(fitting))
      .filter(Boolean);
  }

  _getCableTrayFittingRequiredConnectionCountV1(kind) {
    if (kind === "bend") return 1;
    if (kind === "tee") return 3;
    if (kind === "reducer" || kind === "connector") return 2;
    return 0;
  }

  _resolveCableTrayFittingConnectionV1(connection) {
    const clean = this._sanitizeCableTrayFittingConnectionV1(connection);
    if (!clean) return { connection: null, route: null, point: null, resolved: false };
    const route = this._findSceneObjectById(clean.routeId);
    if (!route || String(route.type || "") !== "cable-tray.route") {
      return { connection: clean, route: null, point: null, resolved: false };
    }
    const point = Array.isArray(route.points) ? route.points[clean.pointIndex] : null;
    if (!point) return { connection: clean, route, point: null, resolved: false };
    return { connection: clean, route, point, resolved: true };
  }

  _validateCableTrayFittingV1(fitting) {
    const clean = this._sanitizeCableTrayFittingV1(fitting);
    if (!clean) return { valid: false, reason: "Formteil-Datensatz ungültig" };
    const required = this._getCableTrayFittingRequiredConnectionCountV1(clean.kind);
    if (clean.connections.length !== required) {
      return { valid: false, reason: `${required} Trassenpunkt(e) erforderlich` };
    }
    const keys = new Set(clean.connections.map((c) => `${c.routeId}::${c.pointIndex}`));
    if (keys.size !== clean.connections.length) return { valid: false, reason: "Trassenpunkte müssen eindeutig sein" };
    const resolved = clean.connections.map((c) => this._resolveCableTrayFittingConnectionV1(c));
    if (resolved.some((r) => !r.resolved)) return { valid: false, reason: "Mindestens eine Referenz ist nicht auflösbar" };
    if (clean.kind === "bend") {
      const r = resolved[0];
      if (r.connection.pointIndex <= 0 || r.connection.pointIndex >= r.route.points.length - 1) {
        return { valid: false, reason: "Bogen benötigt einen inneren Punkt einer fertigen Trasse" };
      }
    }
    return { valid: true, reason: "" };
  }

  _makeCableTrayFittingIdV1() {
    return `tray-fitting-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _beginCableTrayFittingDraftV1(kind = "bend", existingId = null) {
    this._finishCableTrayRoute("fitting-authoring");
    const cleanKind = ["bend", "tee", "reducer", "connector"].includes(String(kind)) ? String(kind) : "bend";
    const existing = existingId
      ? (this._scene?.cableTrayFittings || []).find((f) => String(f?.id || "") === String(existingId))
      : null;
    this._cableTrayFittingDraft.active = true;
    this._cableTrayFittingDraft.kind = existing?.kind || cleanKind;
    this._cableTrayFittingDraft.connections = existing
      ? existing.connections.map((c) => ({ routeId: c.routeId, pointIndex: c.pointIndex }))
      : [];
    this._cableTrayFittingDraft.editingId = existing?.id || null;
    this._setStatus(existing ? "Formteil bearbeiten: Trassenpunkte wählen" : "Formteil: Trassenpunkte wählen");
    this._renderTopbar();
  }

  _cancelCableTrayFittingDraftV1() {
    this._cableTrayFittingDraft.active = false;
    this._cableTrayFittingDraft.connections = [];
    this._cableTrayFittingDraft.editingId = null;
    this._setStatus("Formteil-Auswahl beendet");
    this._renderTopbar();
  }

  _addCableTrayFittingDraftConnectionV1(route, pointIndex) {
    if (!this._cableTrayFittingDraft?.active) return false;
    if (!route || String(route.type || "") !== "cable-tray.route") return false;
    if (String(route.id || "") === String(this._cableTrayDraft?.activeRouteId || "")) return false;
    if (!Array.isArray(route.points) || route.points.length < 2) return false;
    const index = Number(pointIndex);
    if (!Number.isInteger(index) || index < 0 || !route.points[index]) return false;
    const key = `${route.id}::${index}`;
    const current = this._cableTrayFittingDraft.connections || [];
    if (current.some((c) => `${c.routeId}::${c.pointIndex}` === key)) {
      this._cableTrayFittingDraft.connections = current.filter((c) => `${c.routeId}::${c.pointIndex}` !== key);
    } else {
      const required = this._getCableTrayFittingRequiredConnectionCountV1(this._cableTrayFittingDraft.kind);
      if (current.length >= required) {
        this._setStatus(`Formteil: maximal ${required} Trassenpunkt(e)`);
        return false;
      }
      this._cableTrayFittingDraft.connections = [...current, { routeId: String(route.id), pointIndex: index }];
    }
    const required = this._getCableTrayFittingRequiredConnectionCountV1(this._cableTrayFittingDraft.kind);
    this._setStatus(`Formteil: ${this._cableTrayFittingDraft.connections.length}/${required} Trassenpunkt(e)`);
    this._renderTopbar();
    return true;
  }

  _saveCableTrayFittingDraftV1() {
    if (!this._cableTrayFittingDraft?.active) return false;
    const fitting = {
      id: this._cableTrayFittingDraft.editingId || this._makeCableTrayFittingIdV1(),
      kind: this._cableTrayFittingDraft.kind,
      connections: this._cableTrayFittingDraft.connections.map((c) => ({ routeId: c.routeId, pointIndex: c.pointIndex }))
    };
    const validation = this._validateCableTrayFittingV1(fitting);
    if (!validation.valid) {
      this._setStatus(`⚠️ Formteil unvollständig: ${validation.reason}`);
      return false;
    }
    const list = Array.isArray(this._scene.cableTrayFittings) ? this._scene.cableTrayFittings : [];
    const index = list.findIndex((f) => String(f?.id || "") === fitting.id);
    if (index >= 0) list[index] = fitting;
    else list.push(fitting);
    this._scene.cableTrayFittings = list;
    this._cableTrayFittingDraft.selectedFittingId = fitting.id;
    this._cableTrayFittingDraft.active = false;
    this._cableTrayFittingDraft.connections = [];
    this._cableTrayFittingDraft.editingId = null;
    this._persistSceneToStore("cable-tray-fitting-save");
    this._setStatus(`Formteil gespeichert: ${fitting.kind}`);
    this._renderTopbar();
    return true;
  }

  _removeSelectedCableTrayFittingV1() {
    const id = String(this._cableTrayFittingDraft?.selectedFittingId || "");
    if (!id) return false;
    const before = Array.isArray(this._scene?.cableTrayFittings) ? this._scene.cableTrayFittings : [];
    const next = before.filter((f) => String(f?.id || "") !== id);
    if (next.length === before.length) return false;
    this._scene.cableTrayFittings = next;
    this._cableTrayFittingDraft.selectedFittingId = null;
    this._persistSceneToStore("cable-tray-fitting-remove");
    this._setStatus("Formteil entfernt – Trassengeometrie unverändert");
    this._renderTopbar();
    return true;
  }

  _sanitizeCableTrayEndpointRef(ref) {
    if (!ref || typeof ref !== "object") return null;
    const objectId = String(ref.objectId || "").trim();
    if (!objectId) return null;
    const portId = String(ref.portId || "").trim();
    return portId ? { objectId, portId } : { objectId };
  }

  _getCableTrayBindingObjects() {
    return (this._scene?.objects || []).filter((o) => o && String(o.type || "") !== "cable-tray.route" && String(o.id || "").trim());
  }

  _resolveCableTrayEndpointRef(ref) {
    const clean = this._sanitizeCableTrayEndpointRef(ref);
    if (!clean) return { ref: null, object: null, port: null, label: "nicht zugewiesen" };
    const object = this._findSceneObjectById(clean.objectId) || null;
    if (!object) return { ref: clean, object: null, port: null, label: `fehlend: ${clean.objectId}` };
    const ports = Array.isArray(object.ports) ? object.ports : [];
    const port = clean.portId ? (ports.find((p) => String(p?.id || "") === clean.portId) || null) : null;
    const objectLabel = String(object.name || object.autoName || object.id);
    const portLabel = port ? String(port.label || port.name || port.key || port.id) : (clean.portId ? `fehlender Port: ${clean.portId}` : "");
    return { ref: clean, object, port, label: portLabel ? `${objectLabel} · ${portLabel}` : objectLabel };
  }

  _setCableTrayEndpointRef(route, side, ref) {
    if (!route || String(route.type || "") !== "cable-tray.route") return false;
    const key = side === "end" ? "endRef" : "startRef";
    const next = this._sanitizeCableTrayEndpointRef(ref);
    const prev = this._sanitizeCableTrayEndpointRef(route[key]);
    if (JSON.stringify(prev) === JSON.stringify(next)) return false;
    route[key] = next;
    this._persistSceneToStore(`cable-tray-${side}-binding`);
    this._setStatus(`${side === "end" ? "Ziel" : "Start"}: ${this._resolveCableTrayEndpointRef(next).label}`);
    this._renderTopbar();
    return true;
  }

  _getCableTrayLengthWorld(route) {
    const pts = Array.isArray(route?.points) ? route.points : [];
    let total = 0;
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      total += Math.hypot(Number(b?.x || 0) - Number(a?.x || 0), Number(b?.y || 0) - Number(a?.y || 0));
    }
    return total;
  }

  _getCableTrayLengthM(route) {
    // Workarea geometry uses millimetre-scale world coordinates (grid/asset dimensions).
    return this._getCableTrayLengthWorld(route) / 1000;
  }

  _getCableTrayEvaluation() {
    const totals = {
      new: { 100: 0, 200: 0 },
      existing: { 100: 0, 200: 0 }
    };
    const routes = [];
    for (const o of this._scene?.objects || []) {
      if (String(o?.type || "") !== "cable-tray.route") continue;
      const widthMm = Number(o?.tray?.widthMm) === 100 ? 100 : 200;
      const routeClass = String(o?.tray?.routeClass || "") === "existing" ? "existing" : "new";
      const dutyClass = this._normalizeCableTrayDutyClassV1(o?.tray?.dutyClass);
      const lengthM = this._getCableTrayLengthM(o);
      totals[routeClass][widthMm] += lengthM;
      routes.push({
        id: String(o?.id || ""),
        name: String(o?.name || `Kabelrinne ${widthMm} mm`),
        widthMm,
        trayType: String(o?.tray?.trayType || "cable-tray"),
        dutyClass,
        coverRequired: Boolean(o?.tray?.coverRequired),
        dividerCount: Math.max(0, Math.floor(Number(o?.tray?.dividerCount) || 0)),
        supportSpacingM: Number.isFinite(Number(o?.tray?.supportSpacingM)) && Number(o?.tray?.supportSpacingM) > 0
          ? Number(o.tray.supportSpacingM)
          : null,
        supportType: typeof o?.tray?.supportType === "string" && o.tray.supportType.trim()
          ? o.tray.supportType.trim()
          : null,
        routeClass,
        lengthM
      });
    }
    return { routes, totals };
  }

  _getCableTrayGroupedTotals() {
    return this._getCableTrayEvaluation().totals;
  }

  _getCableTrayMaterialRequirement() {
    const totals = this._getCableTrayGroupedTotals();
    const stickLengthM = 3;
    const makeRow = (widthMm) => {
      const plannedLengthM = Number(totals?.new?.[widthMm] || 0);
      const requiredStickCount = Math.ceil(plannedLengthM / stickLengthM);
      const purchaseLengthM = requiredStickCount * stickLengthM;
      const offcutM = purchaseLengthM - plannedLengthM;
      return { widthMm, plannedLengthM, stickLengthM, requiredStickCount, purchaseLengthM, offcutM };
    };
    return {
      stickLengthM,
      rows: [makeRow(100), makeRow(200)]
    };
  }

  _getCableTrayFittingMaterialPreparationV1() {
    const fittings = Array.isArray(this._scene?.cableTrayFittings) ? this._scene.cableTrayFittings : [];
    const labels = {
      bend: "Bogen",
      tee: "T-Stück",
      reducer: "Reduzierung",
      connector: "Verbinder"
    };
    const counts = new Map();
    let unresolvedCount = 0;

    for (const fitting of fittings) {
      const validation = this._validateCableTrayFittingV1(fitting);
      if (!validation.valid) {
        unresolvedCount += 1;
        continue;
      }
      const kind = String(fitting?.kind || "");
      if (!Object.prototype.hasOwnProperty.call(labels, kind)) {
        unresolvedCount += 1;
        continue;
      }
      counts.set(kind, (counts.get(kind) || 0) + 1);
    }

    const rows = ["bend", "tee", "reducer", "connector"]
      .filter((kind) => counts.has(kind))
      .map((kind) => ({
        kind,
        name: labels[kind],
        unit: "Stk",
        quantity: counts.get(kind)
      }));

    return { rows, unresolvedCount };
  }

  async _loadGlobalMaterialCatalogV1() {
    try {
      const response = await fetch("data/global-material-catalog.v1.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`material catalog HTTP ${response.status}`);
      const data = await response.json();
      const materials = Array.isArray(data?.materials)
        ? data.materials.filter((row) =>
            typeof row?.materialId === "string" && row.materialId.trim() &&
            typeof row?.manufacturer === "string" &&
            typeof row?.articleNumber === "string" &&
            typeof row?.name === "string" &&
            typeof row?.unit === "string"
          )
        : [];
      this._globalMaterialCatalogV1 = { loaded: true, materials };
      return this._globalMaterialCatalogV1;
    } catch {
      this._globalMaterialCatalogV1 = { loaded: true, materials: [] };
      return this._globalMaterialCatalogV1;
    }
  }

  _getProjectMaterialMappingsV1() {
    try {
      const app = this.store?.get?.("app") || {};
      const rows = app?.project?.materialMappings;
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  _materialMappingKeyMatchesV1(row, key) {
    if (!row || !key || String(row.sourceKind || "") !== String(key.sourceKind || "")) return false;
    if (key.sourceKind === "tray") {
      return String(row.trayType || "") === String(key.trayType || "") &&
        Number(row.widthMm) === Number(key.widthMm);
    }
    if (key.sourceKind === "accessory") {
      return String(row.accessoryKind || "") === String(key.accessoryKind || "") &&
        String(row.trayType || "") === String(key.trayType || "") &&
        Number(row.widthMm) === Number(key.widthMm);
    }
    if (key.sourceKind === "fitting") {
      return String(row.fittingKind || "") === String(key.fittingKind || "");
    }
    return false;
  }

  _setProjectMaterialMappingV1(keyValue, materialIdValue) {
    const key = keyValue && typeof keyValue === "object" ? { ...keyValue } : null;
    const materialId = typeof materialIdValue === "string" ? materialIdValue.trim() : "";
    if (!key || !["tray", "accessory", "fitting"].includes(String(key.sourceKind || ""))) return false;
    if (materialId && !this._findGlobalMaterialV1(materialId)) return false;
    if (!this.store?.update) return false;

    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      const current = Array.isArray(next.project.materialMappings) ? next.project.materialMappings : [];
      const rows = current.filter((row) => !this._materialMappingKeyMatchesV1(row, key));
      if (materialId) rows.push({ ...key, materialId });
      next.project.materialMappings = rows;
      return next;
    });
    this._requestProjectSaveDebounced("material-assignment");
    return true;
  }

  _setSupportMaterialComponentMaterialIdV1(supportTypeValue, componentIndexValue, materialIdValue) {
    const supportType = typeof supportTypeValue === "string" ? supportTypeValue.trim() : "";
    const componentIndex = Number(componentIndexValue);
    const materialId = typeof materialIdValue === "string" ? materialIdValue.trim() : "";
    if (!supportType || !Number.isInteger(componentIndex) || componentIndex < 0) return false;
    if (materialId && !this._findGlobalMaterialV1(materialId)) return false;
    if (!this.store?.update) return false;
    let updated = false;

    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      const compositions = Array.isArray(next.project.supportMaterialCompositions)
        ? next.project.supportMaterialCompositions
        : [];
      const compositionIndex = compositions.findIndex((row) =>
        typeof row?.supportType === "string" && row.supportType.trim() === supportType
      );
      if (compositionIndex < 0) return next;
      const composition = compositions[compositionIndex];
      const components = Array.isArray(composition?.components) ? composition.components.slice() : [];
      if (!components[componentIndex] || typeof components[componentIndex] !== "object") return next;
      components[componentIndex] = { ...components[componentIndex], materialId: materialId || null };
      compositions[compositionIndex] = { ...composition, components };
      next.project.supportMaterialCompositions = compositions;
      updated = true;
      return next;
    });
    if (updated) this._requestProjectSaveDebounced("material-assignment");
    return updated;
  }

  _getCableTrayMaterialAssignmentRowsV1() {
    const rows = [];
    for (const row of this._getCableTrayMaterialPreparationV1().rows) {
      rows.push({
        sourceKind: "tray",
        title: "Kabelrinne",
        detail: `${row.widthMm} mm · ${row.trayType} · ${this._getCableTrayDutyClassLabelV1(row.dutyClass)}`,
        quantity: `${Number(row.purchaseLengthM || 0).toFixed(2)} m · ${row.requiredStickCount} × ${row.stickLengthM} m`,
        mappingKey: { sourceKind: "tray", trayType: row.trayType, widthMm: row.widthMm, dutyClass: row.dutyClass },
        materialId: this._resolveProjectMaterialMappingV1((mapping) =>
          mapping?.sourceKind === "tray" &&
          String(mapping?.trayType || "") === String(row.trayType || "") &&
          Number(mapping?.widthMm) === Number(row.widthMm) &&
          this._cableTrayMappingDutyClassMatchesV1(mapping, row.dutyClass)
        ).materialId
      });
    }
    for (const row of this._getCableTrayAccessoryPreparationV1().rows) {
      rows.push({
        sourceKind: "accessory",
        title: row.kind === "cover" ? "Deckel" : "Trennsteg",
        detail: `${row.widthMm} mm · ${row.trayType} · ${this._getCableTrayDutyClassLabelV1(row.dutyClass)}`,
        quantity: `${Number(row.purchaseLengthM || 0).toFixed(2)} m · ${row.requiredStickCount} × ${row.stickLengthM} m`,
        mappingKey: {
          sourceKind: "accessory",
          accessoryKind: row.kind,
          trayType: row.trayType,
          widthMm: row.widthMm,
          dutyClass: row.dutyClass
        },
        materialId: this._resolveProjectMaterialMappingV1((mapping) =>
          mapping?.sourceKind === "accessory" &&
          String(mapping?.accessoryKind || "") === String(row.kind || "") &&
          String(mapping?.trayType || "") === String(row.trayType || "") &&
          Number(mapping?.widthMm) === Number(row.widthMm) &&
          this._cableTrayMappingDutyClassMatchesV1(mapping, row.dutyClass)
        ).materialId
      });
    }

    const supportPreparation = this._getCableTraySupportPreparationV1().rows;
    const compositions = this._getSupportMaterialCompositionsV1();
    for (const supportRow of supportPreparation) {
      const supportType = typeof supportRow?.supportType === "string" ? supportRow.supportType.trim() : "";
      if (!supportType) continue;
      const composition = compositions.find((row) =>
        typeof row?.supportType === "string" && row.supportType.trim() === supportType
      );
      const components = Array.isArray(composition?.components) ? composition.components : [];
      components.forEach((component, componentIndex) => {
        const name = typeof component?.name === "string" ? component.name.trim() : "";
        const quantityPerSupport = Number(component?.quantityPerSupport);
        const unit = typeof component?.unit === "string" ? component.unit.trim() : "";
        if (!name || !(Number.isFinite(quantityPerSupport) && quantityPerSupport > 0) || !unit) return;
        rows.push({
          sourceKind: "support",
          title: name,
          detail: `Unterstützung · ${supportType}`,
          quantity: `${supportRow.supportCount * quantityPerSupport} ${unit}`,
          supportType,
          componentIndex,
          materialId: typeof component?.materialId === "string" && component.materialId.trim()
            ? component.materialId.trim()
            : null
        });
      });
    }

    for (const row of this._getCableTrayFittingMaterialPreparationV1().rows) {
      rows.push({
        sourceKind: "fitting",
        title: row.name,
        detail: "Formteil",
        quantity: `${row.quantity} ${row.unit}`,
        mappingKey: { sourceKind: "fitting", fittingKind: row.kind },
        materialId: this._resolveProjectMaterialMappingV1((mapping) =>
          mapping?.sourceKind === "fitting" &&
          String(mapping?.fittingKind || "") === String(row.kind || "")
        ).materialId
      });
    }
    return rows;
  }

  _openCableTrayMaterialAssignmentV1() {
    this._openWorkareaModalV1(
      "Materialzuordnung",
      () => this._renderCableTrayMaterialAssignmentV1(),
      { wide: true }
    );
  }

  _renderCableTrayMaterialAssignmentV1() {
    const box = document.createElement("div");
    box.className = "wa-material-assignment";

    const hint = document.createElement("div");
    hint.className = "wa-material-assignment-hint";
    hint.textContent = "Vorhandenen Materialbedarf einem Artikel aus dem globalen Materialkatalog zuordnen. Mengen werden dabei nicht verändert.";
    box.appendChild(hint);

    const materials = Array.isArray(this._globalMaterialCatalogV1?.materials)
      ? this._globalMaterialCatalogV1.materials
      : [];
    if (!materials.length) {
      const empty = document.createElement("div");
      empty.className = "wa-material-assignment-empty";
      empty.textContent = "Keine Materialartikel im globalen Katalog vorhanden.";
      box.appendChild(empty);
    }

    const rows = this._getCableTrayMaterialAssignmentRowsV1();
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "wa-material-assignment-empty";
      empty.textContent = "Im aktuellen Projekt gibt es noch keine zuordenbaren Materialpositionen.";
      box.appendChild(empty);
      return box;
    }

    for (const row of rows) {
      const card = document.createElement("div");
      card.className = "wa-material-assignment-row";

      const meta = document.createElement("div");
      meta.className = "wa-material-assignment-meta";
      const title = document.createElement("div");
      title.className = "wa-material-assignment-title";
      title.textContent = row.title;
      const detail = document.createElement("div");
      detail.className = "wa-material-assignment-detail";
      detail.textContent = `${row.detail} · ${row.quantity}`;
      meta.appendChild(title);
      meta.appendChild(detail);

      const controls = document.createElement("div");
      controls.className = "wa-material-assignment-controls";
      const select = document.createElement("select");
      select.className = "wa-material-assignment-select";
      select.setAttribute("aria-label", `Artikel für ${row.title}`);
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "Nicht zugeordnet";
      select.appendChild(none);
      for (const material of materials) {
        const option = document.createElement("option");
        option.value = material.materialId;
        option.textContent = `${material.manufacturer} · ${material.articleNumber} · ${material.name} · ${material.unit}`;
        select.appendChild(option);
      }
      select.value = row.materialId && materials.some((material) => material.materialId === row.materialId)
        ? row.materialId
        : "";
      select.disabled = materials.length === 0;

      const current = document.createElement("div");
      current.className = "wa-material-assignment-current";
      const currentMaterial = this._findGlobalMaterialV1(row.materialId);
      current.textContent = currentMaterial
        ? `${currentMaterial.manufacturer} · ${currentMaterial.articleNumber} · ${currentMaterial.name}`
        : "Nicht zugeordnet";

      select.addEventListener("change", () => {
        const materialId = String(select.value || "").trim();
        const ok = row.sourceKind === "support"
          ? this._setSupportMaterialComponentMaterialIdV1(row.supportType, row.componentIndex, materialId)
          : this._setProjectMaterialMappingV1(row.mappingKey, materialId);
        if (!ok) {
          this._setStatus("⚠️ Materialzuordnung konnte nicht gespeichert werden");
          return;
        }
        const material = this._findGlobalMaterialV1(materialId);
        current.textContent = material
          ? `${material.manufacturer} · ${material.articleNumber} · ${material.name}`
          : "Nicht zugeordnet";
        this._setStatus(material ? `Material zugeordnet: ${material.articleNumber}` : "Materialzuordnung entfernt");
      });

      controls.appendChild(select);
      controls.appendChild(current);
      card.appendChild(meta);
      card.appendChild(controls);
      box.appendChild(card);
    }
    return box;
  }

  _findGlobalMaterialV1(materialIdValue) {
    const materialId = typeof materialIdValue === "string" ? materialIdValue.trim() : "";
    if (!materialId) return null;
    const rows = Array.isArray(this._globalMaterialCatalogV1?.materials)
      ? this._globalMaterialCatalogV1.materials
      : [];
    return rows.find((row) => String(row?.materialId || "").trim() === materialId) || null;
  }

  _resolveProjectMaterialMappingV1(predicate) {
    const mapping = this._getProjectMaterialMappingsV1().find((row) => {
      try { return predicate(row); } catch { return false; }
    });
    const materialId = typeof mapping?.materialId === "string" ? mapping.materialId.trim() : "";
    const material = this._findGlobalMaterialV1(materialId);
    return material ? { materialId, material } : { materialId: null, material: null };
  }

  _getCableTrayMaterialIdentityResolutionV1() {
    const unresolved = [];
    const rows = [];
    const add = (sourceKind, sourceRow, resolved) => {
      if (resolved?.materialId && resolved?.material) {
        rows.push({ sourceKind, sourceRow, materialId: resolved.materialId, material: resolved.material });
      } else {
        unresolved.push({ sourceKind, sourceRow, reason: "material-identity-unresolved" });
      }
    };

    for (const row of this._getCableTrayMaterialPreparationV1().rows) {
      add("tray", row, this._resolveProjectMaterialMappingV1((mapping) =>
        mapping?.sourceKind === "tray" &&
        String(mapping?.trayType || "") === String(row.trayType || "") &&
        Number(mapping?.widthMm) === Number(row.widthMm) &&
        this._cableTrayMappingDutyClassMatchesV1(mapping, row.dutyClass)
      ));
    }

    for (const row of this._getCableTrayAccessoryPreparationV1().rows) {
      add("accessory", row, this._resolveProjectMaterialMappingV1((mapping) =>
        mapping?.sourceKind === "accessory" &&
        String(mapping?.accessoryKind || "") === String(row.kind || "") &&
        String(mapping?.trayType || "") === String(row.trayType || "") &&
        Number(mapping?.widthMm) === Number(row.widthMm) &&
        this._cableTrayMappingDutyClassMatchesV1(mapping, row.dutyClass)
      ));
    }

    for (const row of this._getCableTraySupportMaterialPreparationV1().rows) {
      const materialId = typeof row?.materialId === "string" ? row.materialId.trim() : "";
      const material = this._findGlobalMaterialV1(materialId);
      add("support", row, material ? { materialId, material } : null);
    }

    for (const row of this._getCableTrayFittingMaterialPreparationV1().rows) {
      add("fitting", row, this._resolveProjectMaterialMappingV1((mapping) =>
        mapping?.sourceKind === "fitting" &&
        String(mapping?.fittingKind || "") === String(row.kind || "")
      ));
    }

    return { rows, unresolved };
  }

  _getCableTrayMaterialPreparationV1() {
    const routes = this._getCableTrayEvaluation().routes;
    const stickLengthM = 3;
    const groups = new Map();

    for (const route of routes) {
      if (route.routeClass !== "new") continue;
      const widthMm = Number(route.widthMm);
      const trayType = String(route.trayType || "cable-tray");
      const dutyClass = this._normalizeCableTrayDutyClassV1(route.dutyClass);
      const key = `${widthMm}|${trayType}|${dutyClass}`;
      if (!groups.has(key)) groups.set(key, { widthMm, trayType, dutyClass, plannedLengthM: 0 });
      groups.get(key).plannedLengthM += Number(route.lengthM || 0);
    }

    const rows = Array.from(groups.values()).map((row) => {
      const requiredStickCount = Math.ceil(row.plannedLengthM / stickLengthM);
      const purchaseLengthM = requiredStickCount * stickLengthM;
      const offcutM = purchaseLengthM - row.plannedLengthM;
      return { ...row, stickLengthM, requiredStickCount, purchaseLengthM, offcutM };
    });

    return { stickLengthM, rows };
  }

  _getCableTrayAccessoryPreparationV1() {
    const routes = this._getCableTrayEvaluation().routes;
    const stickLengthM = 3;
    const groups = new Map();

    const addLength = (kind, route, plannedLengthM) => {
      if (!(plannedLengthM > 0)) return;
      const widthMm = Number(route.widthMm);
      const trayType = String(route.trayType || "cable-tray");
      const dutyClass = this._normalizeCableTrayDutyClassV1(route.dutyClass);
      const key = `${kind}|${widthMm}|${trayType}|${dutyClass}`;
      if (!groups.has(key)) groups.set(key, { kind, widthMm, trayType, dutyClass, plannedLengthM: 0 });
      groups.get(key).plannedLengthM += plannedLengthM;
    };

    for (const route of routes) {
      if (route.routeClass !== "new") continue;
      const routeLengthM = Number(route.lengthM || 0);
      if (route.coverRequired) addLength("cover", route, routeLengthM);
      const dividerCount = Math.max(0, Math.floor(Number(route.dividerCount) || 0));
      if (dividerCount > 0) addLength("divider", route, routeLengthM * dividerCount);
    }

    const rows = Array.from(groups.values()).map((row) => {
      const requiredStickCount = Math.ceil(row.plannedLengthM / stickLengthM);
      const purchaseLengthM = requiredStickCount * stickLengthM;
      const offcutM = purchaseLengthM - row.plannedLengthM;
      return { ...row, stickLengthM, requiredStickCount, purchaseLengthM, offcutM };
    });

    return { stickLengthM, rows };
  }

  _getCableTraySupportPreparationV1() {
    const routes = this._getCableTrayEvaluation().routes;
    const groups = new Map();
    const undeterminedRoutes = [];

    for (const route of routes) {
      if (route.routeClass !== "new") continue;
      const routeLengthM = Number(route.lengthM || 0);
      if (!(routeLengthM > 0)) continue;
      const supportSpacingM = Number(route.supportSpacingM);
      if (!(Number.isFinite(supportSpacingM) && supportSpacingM > 0)) {
        undeterminedRoutes.push(route);
        continue;
      }

      const supportCount = Math.max(2, Math.ceil(routeLengthM / supportSpacingM) + 1);
      const widthMm = Number(route.widthMm);
      const trayType = String(route.trayType || "cable-tray");
      const supportType = typeof route.supportType === "string" && route.supportType.trim()
        ? route.supportType.trim()
        : null;
      const key = `${widthMm}|${trayType}|${supportSpacingM}|${supportType || ""}`;
      if (!groups.has(key)) groups.set(key, {
        widthMm,
        trayType,
        supportSpacingM,
        supportType,
        routeCount: 0,
        plannedLengthM: 0,
        supportCount: 0
      });
      const group = groups.get(key);
      group.routeCount += 1;
      group.plannedLengthM += routeLengthM;
      group.supportCount += supportCount;
    }

    return { rows: Array.from(groups.values()), undeterminedRoutes };
  }

  _getSupportMaterialCompositionsV1() {
    try {
      const app = this.store?.get?.("app") || {};
      const rows = app?.project?.supportMaterialCompositions;
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  _setSupportMaterialCompositionComponentV1(supportTypeValue, componentValue) {
    const supportType = typeof supportTypeValue === "string" ? supportTypeValue.trim() : "";
    const name = typeof componentValue?.name === "string" ? componentValue.name.trim() : "";
    const quantityPerSupport = Number(componentValue?.quantityPerSupport);
    const unit = typeof componentValue?.unit === "string" ? componentValue.unit.trim() : "";
    const materialId = typeof componentValue?.materialId === "string" ? componentValue.materialId.trim() : "";
    if (!supportType || !name || !(Number.isFinite(quantityPerSupport) && quantityPerSupport > 0) || !unit) return false;
    if (!this.store?.update) return false;

    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      const compositions = Array.isArray(next.project.supportMaterialCompositions)
        ? next.project.supportMaterialCompositions
        : [];
      const index = compositions.findIndex((row) =>
        typeof row?.supportType === "string" && row.supportType.trim() === supportType
      );
      const current = index >= 0 && compositions[index] && typeof compositions[index] === "object"
        ? compositions[index]
        : { supportType, components: [] };
      const components = Array.isArray(current.components) ? current.components.slice() : [];
      components.push({ name, quantityPerSupport, unit, materialId: materialId || null });
      const updated = { supportType, components };
      if (index >= 0) compositions[index] = updated;
      else compositions.push(updated);
      next.project.supportMaterialCompositions = compositions;
      return next;
    });
    this._requestProjectSaveDebounced("support-material-composition");
    return true;
  }

  _getCableTraySupportMaterialPreparationV1() {
    const supportRows = this._getCableTraySupportPreparationV1().rows;
    const compositions = this._getSupportMaterialCompositionsV1();
    const rows = [];
    const unresolved = [];

    for (const supportRow of supportRows) {
      const supportType = typeof supportRow?.supportType === "string" && supportRow.supportType.trim()
        ? supportRow.supportType.trim()
        : null;
      if (!supportType) {
        unresolved.push({ ...supportRow, reason: "support-type-undetermined" });
        continue;
      }
      const composition = compositions.find((row) =>
        typeof row?.supportType === "string" && row.supportType.trim() === supportType
      );
      const components = Array.isArray(composition?.components) ? composition.components : [];
      const validComponents = components.filter((component) => {
        const name = typeof component?.name === "string" ? component.name.trim() : "";
        const quantityPerSupport = Number(component?.quantityPerSupport);
        const unit = typeof component?.unit === "string" ? component.unit.trim() : "";
        return name && Number.isFinite(quantityPerSupport) && quantityPerSupport > 0 && unit;
      });
      if (!validComponents.length) {
        unresolved.push({ ...supportRow, reason: "composition-undetermined" });
        continue;
      }
      for (const component of validComponents) {
        const name = component.name.trim();
        const quantityPerSupport = Number(component.quantityPerSupport);
        const unit = component.unit.trim();
        rows.push({
          supportType,
          name,
          quantityPerSupport,
          unit,
          materialId: typeof component?.materialId === "string" && component.materialId.trim()
            ? component.materialId.trim()
            : null,
          supportCount: supportRow.supportCount,
          derivedQuantity: supportRow.supportCount * quantityPerSupport
        });
      }
    }

    return { rows, unresolved };
  }

  _getCableTrayMaterialOutputRowsV1() {
    const materialRows = this._getCableTrayMaterialPreparationV1().rows;
    const accessoryRows = this._getCableTrayAccessoryPreparationV1().rows;
    return [
      ...materialRows.map((row) => ({ category: "Kabelrinne", ...row })),
      ...accessoryRows.map((row) => ({
        category: row.kind === "cover" ? "Deckel" : "Trennsteg",
        ...row
      }))
    ];
  }

  _getCombinedCableTrayMaterialOutputRowsV1() {
    const trayRows = this._getCableTrayMaterialOutputRowsV1();
    const supportRows = this._getCableTraySupportMaterialPreparationV1().rows;
    const fittingRows = this._getCableTrayFittingMaterialPreparationV1().rows;
    const identityFields = (resolved) => ({
      materialId: resolved?.materialId || null,
      manufacturer: resolved?.material?.manufacturer || "",
      articleNumber: resolved?.material?.articleNumber || ""
    });
    return [
      ...trayRows.map((row) => {
        const resolved = row.kind
          ? this._resolveProjectMaterialMappingV1((mapping) =>
              mapping?.sourceKind === "accessory" &&
              String(mapping?.accessoryKind || "") === String(row.kind || "") &&
              String(mapping?.trayType || "") === String(row.trayType || "") &&
              Number(mapping?.widthMm) === Number(row.widthMm) &&
              this._cableTrayMappingDutyClassMatchesV1(mapping, row.dutyClass)
            )
          : this._resolveProjectMaterialMappingV1((mapping) =>
              mapping?.sourceKind === "tray" &&
              String(mapping?.trayType || "") === String(row.trayType || "") &&
              Number(mapping?.widthMm) === Number(row.widthMm) &&
              this._cableTrayMappingDutyClassMatchesV1(mapping, row.dutyClass)
            );
        return {
          category: row.category || "",
          name: row.category || "",
          unit: "m",
          quantity: Number.isFinite(Number(row.purchaseLengthM)) ? Number(row.purchaseLengthM) : null,
          supportType: null,
          trayType: row.trayType ?? null,
          widthMm: row.widthMm ?? null,
          dutyClass: this._normalizeCableTrayDutyClassV1(row.dutyClass),
          plannedLengthM: row.plannedLengthM ?? null,
          stickLengthM: row.stickLengthM ?? null,
          requiredStickCount: row.requiredStickCount ?? null,
          purchaseLengthM: row.purchaseLengthM ?? null,
          offcutM: row.offcutM ?? null,
          ...identityFields(resolved)
        };
      }),
      ...supportRows.map((row) => {
        const materialId = typeof row?.materialId === "string" ? row.materialId.trim() : "";
        const material = this._findGlobalMaterialV1(materialId);
        return {
          category: "Unterstützungsmaterial",
          name: row.name,
          unit: row.unit,
          quantity: row.derivedQuantity,
          supportType: row.supportType,
          trayType: null,
          widthMm: null,
          dutyClass: null,
          plannedLengthM: null,
          stickLengthM: null,
          requiredStickCount: null,
          purchaseLengthM: null,
          offcutM: null,
          ...identityFields(material ? { materialId, material } : null)
        };
      }),
      ...fittingRows.map((row) => {
        const resolved = this._resolveProjectMaterialMappingV1((mapping) =>
          mapping?.sourceKind === "fitting" &&
          String(mapping?.fittingKind || "") === String(row.kind || "")
        );
        return {
          category: "Formteil",
          name: row.name,
          unit: row.unit,
          quantity: row.quantity,
          supportType: null,
          trayType: null,
          widthMm: null,
          dutyClass: null,
          plannedLengthM: null,
          stickLengthM: null,
          requiredStickCount: null,
          purchaseLengthM: null,
          offcutM: null,
          ...identityFields(resolved)
        };
      })
    ];
  }

  _makeCombinedCableTrayMaterialCSVV1(rows = []) {
    const esc = (value) => {
      const text = String(value ?? "");
      return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const numberValue = (value) =>
      value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))
        ? Number(value).toFixed(2)
        : "";

    const headers = [
      "Kategorie",
      "Bezeichnung",
      "Einheit",
      "Menge",
      "Stützart",
      "Trassentyp",
      "Breite_mm",
      "Ausfuehrungsklasse",
      "Planlaenge_m",
      "Stangenlaenge_m",
      "Anzahl_Stangen",
      "Einkaufslaenge_m",
      "Verschnitt_m",
      "Material_ID",
      "Hersteller",
      "Artikelnummer"
    ];

    const lines = [headers.map(esc).join(";")];
    for (const row of (Array.isArray(rows) ? rows : [])) {
      lines.push([
        row?.category || "",
        row?.name || "",
        row?.unit || "",
        numberValue(row?.quantity),
        row?.supportType || "",
        row?.trayType || "",
        row?.widthMm ?? "",
        row?.dutyClass || "",
        numberValue(row?.plannedLengthM),
        numberValue(row?.stickLengthM),
        row?.requiredStickCount ?? "",
        numberValue(row?.purchaseLengthM),
        numberValue(row?.offcutM),
        row?.materialId || "",
        row?.manufacturer || "",
        row?.articleNumber || ""
      ].map(esc).join(";"));
    }
    return lines.join("\n");
  }

  async _exportCombinedCableTrayMaterialCSVV1() {
    try {
      const rows = this._getCombinedCableTrayMaterialOutputRowsV1();
      const csv = this._makeCombinedCableTrayMaterialCSVV1(rows);
      const fileName = `trassenmaterial_gesamt_${new Date().toISOString().slice(0, 10)}.csv`;
      const downloaded = this._downloadTextFileV1(fileName, csv, "text/csv;charset=utf-8");
      const copied = await this._copyToClipboard(csv);
      if (downloaded && copied) this._setStatus("✅ Gesamtmaterial CSV exportiert + in Clipboard");
      else if (downloaded) this._setStatus("✅ Gesamtmaterial CSV Export gestartet");
      else if (copied) this._setStatus("✅ Gesamtmaterial CSV in Clipboard (Download blockiert?)");
      else this._setStatus("⚠️ Gesamtmaterial CSV Export fehlgeschlagen");
    } catch (err) {
      this._setStatus(`⚠️ Gesamtmaterial CSV Export fehlgeschlagen: ${err?.message || "unbekannt"}`);
    }
  }

  _makeCableTrayMaterialCSVV1(rows = []) {
    const esc = (value) => {
      const text = String(value ?? "");
      return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const numberValue = (value) =>
      Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "";

    const headers = [
      "Kategorie",
      "Trassentyp",
      "Breite_mm",
      "Ausfuehrungsklasse",
      "Planlaenge_m",
      "Stangenlaenge_m",
      "Anzahl_Stangen",
      "Einkaufslaenge_m",
      "Verschnitt_m"
    ];

    const lines = [headers.map(esc).join(";")];
    for (const row of (Array.isArray(rows) ? rows : [])) {
      lines.push([
        row?.category || "",
        row?.trayType || "",
        Number.isFinite(Number(row?.widthMm)) ? Number(row.widthMm) : "",
        row?.dutyClass || "",
        numberValue(row?.plannedLengthM),
        numberValue(row?.stickLengthM),
        Number.isFinite(Number(row?.requiredStickCount)) ? Number(row.requiredStickCount) : "",
        numberValue(row?.purchaseLengthM),
        numberValue(row?.offcutM)
      ].map(esc).join(";"));
    }
    return lines.join("\n");
  }

  async _exportCableTrayMaterialCSVV1() {
    try {
      const rows = this._getCableTrayMaterialOutputRowsV1();
      const csv = this._makeCableTrayMaterialCSVV1(rows);
      const fileName = `trassenmaterial_${new Date().toISOString().slice(0, 10)}.csv`;
      const downloaded = this._downloadTextFileV1(fileName, csv, "text/csv;charset=utf-8");
      const copied = await this._copyToClipboard(csv);
      if (downloaded && copied) this._setStatus("✅ Trassenmaterial CSV exportiert + in Clipboard");
      else if (downloaded) this._setStatus("✅ Trassenmaterial CSV Export gestartet");
      else if (copied) this._setStatus("✅ Trassenmaterial CSV in Clipboard (Download blockiert?)");
      else this._setStatus("⚠️ Trassenmaterial CSV Export fehlgeschlagen");
    } catch (err) {
      this._setStatus(`⚠️ Trassenmaterial CSV Export fehlgeschlagen: ${err?.message || "unbekannt"}`);
    }
  }

  _showCableTrayEvaluation() {
    const evaluation = this._getCableTrayEvaluation();
    const lines = evaluation.routes.map((route, index) => {
      const routeClassLabel = route.routeClass === "existing" ? "Bestand/Brücke" : "Neu";
      const dutyClassLabel = this._getCableTrayDutyClassLabelV1(route.dutyClass);
      return `${index + 1}. ${route.name} · ${routeClassLabel} · ${dutyClassLabel} · ${route.widthMm} mm · ${route.lengthM.toFixed(2)} m`;
    });
    const totals = evaluation.totals;
    const summary =
      `Neu 100: ${totals.new[100].toFixed(2)} m · Neu 200: ${totals.new[200].toFixed(2)} m · ` +
      `Bestand 100: ${totals.existing[100].toFixed(2)} m · Bestand 200: ${totals.existing[200].toFixed(2)} m`;
    const material = this._getCableTrayMaterialPreparationV1();
    const materialLines = material.rows.map((row) =>
      `${row.trayType} · ${this._getCableTrayDutyClassLabelV1(row.dutyClass)} · Neu ${row.widthMm} · ${row.plannedLengthM.toFixed(2)} m → ${row.requiredStickCount} × ${row.stickLengthM} m = ${row.purchaseLengthM.toFixed(2)} m · Verschnitt ${row.offcutM.toFixed(2)} m`
    );
    const accessories = this._getCableTrayAccessoryPreparationV1();
    const accessoryLines = accessories.rows.map((row) => {
      const label = row.kind === "cover" ? "Deckel" : "Trennsteg";
      return `${label} · ${row.trayType} · ${this._getCableTrayDutyClassLabelV1(row.dutyClass)} · Neu ${row.widthMm} · ${row.plannedLengthM.toFixed(2)} m → ${row.requiredStickCount} × ${row.stickLengthM} m = ${row.purchaseLengthM.toFixed(2)} m · Verschnitt ${row.offcutM.toFixed(2)} m`;
    });
    const supports = this._getCableTraySupportPreparationV1();
    const supportLines = supports.rows.map((row) =>
      `${row.trayType} · Neu ${row.widthMm} · Abstand ${row.supportSpacingM.toFixed(2)} m · Stützart ${row.supportType || "unbestimmt"} · ${row.routeCount} Trasse(n) / ${row.plannedLengthM.toFixed(2)} m → ${row.supportCount} Unterstützungen`
    );
    if (supports.undeterminedRoutes.length) {
      supportLines.push(`${supports.undeterminedRoutes.length} neue Trasse(n): Stützabstand unbestimmt`);
    }
    const supportMaterial = this._getCableTraySupportMaterialPreparationV1();
    const supportMaterialLines = supportMaterial.rows.map((row) =>
      `${row.supportType} · ${row.name} · ${row.supportCount} × ${row.quantityPerSupport} ${row.unit} = ${row.derivedQuantity} ${row.unit}`
    );
    if (supportMaterial.unresolved.length) {
      supportMaterialLines.push(`${supportMaterial.unresolved.length} Unterstützungsgruppe(n): Materialzusammensetzung unbestimmt`);
    }
        const detail = lines.length ? lines.join("\n") : "Keine Trassen vorhanden.";
    this._setStatus(`Trassenauswertung · ${summary} · ${evaluation.routes.length} Trasse(n)`);
    window.alert(`Trassenauswertung\n\n${detail}\n\nSummen\n${summary}\n\nMaterialbedarf (Neu)\n${materialLines.join("\n")}\n\nZubehörbedarf (Neu)\n${accessoryLines.length ? accessoryLines.join("\n") : "Kein Deckel/Trennsteg geplant."}\n\nUnterstützungsplanung (Neu)\n${supportLines.length ? supportLines.join("\n") : "Keine Unterstützungen ableitbar."}\n\nUnterstützungsmaterial (Neu)\n${supportMaterialLines.length ? supportMaterialLines.join("\n") : "Kein Unterstützungsmaterial ableitbar."}`);
  }

  _startCableTrayRoute(world) {
    const widthMm = Number(this._cableTrayDraft?.widthMm) === 100 ? 100 : 200;
    const dutyClass = this._normalizeCableTrayDutyClassV1(this._cableTrayDraft?.dutyClass);
    const route = {
      id: this._makeId("tray"),
      type: "cable-tray.route",
      name: `Kabelrinne ${widthMm} mm`,
      x: Number(world.wx),
      y: Number(world.wy),
      r: 18,
      rotDeg: 0,
      rotation: 0,
      tray: {
        widthMm,
        trayType: String(this._cableTrayDraft?.trayType || "cable-tray"),
        dutyClass,
        routeClass: String(this._cableTrayDraft?.routeClass || "") === "existing" ? "existing" : "new",
        coverRequired: false,
        dividerCount: 0,
        supportSpacingM: null,
        supportType: null
      },
      points: [{ x: Number(world.wx), y: Number(world.wy) }]
    };
    this._scene.objects = Array.isArray(this._scene?.objects) ? this._scene.objects : [];
    this._scene.objects.push(route);
    this._cableTrayDraft.activeRouteId = route.id;
    this._setStatus(`Trasse ${widthMm} mm gestartet – nächsten Punkt setzen`);
    return route;
  }

  _appendCableTrayPoint(world) {
    let route = this._findSceneObjectById(this._cableTrayDraft?.activeRouteId);
    if (!route || String(route.type || "") !== "cable-tray.route") route = this._startCableTrayRoute(world);
    else route.points.push({ x: Number(world.wx), y: Number(world.wy) });

    if (route.points.length >= 2) {
      route.x = route.points[0].x;
      route.y = route.points[0].y;
      this._persistSceneToStore("cable-tray-point");
      const len = this._getCableTrayLengthM(route);
      const totals = this._getCableTrayGroupedTotals();
      this._setStatus(
        `Trasse: ${len.toFixed(2)} m · Neu 100: ${totals.new[100].toFixed(2)} m · Neu 200: ${totals.new[200].toFixed(2)} m · Bestand 100: ${totals.existing[100].toFixed(2)} m · Bestand 200: ${totals.existing[200].toFixed(2)} m`
      );
      this._renderTopbar();
    }
    return route;
  }

  _finishCableTrayRoute(reason = "finish") {
    const route = this._findSceneObjectById(this._cableTrayDraft?.activeRouteId);
    let removedIncompleteRoute = false;
    if (route && String(route.type || "") === "cable-tray.route" && (!Array.isArray(route.points) || route.points.length < 2)) {
      this._scene.objects = (this._scene.objects || []).filter((o) => o?.id !== route.id);
      removedIncompleteRoute = true;
    }
    this._cableTrayDraft.activeRouteId = null;
    if (removedIncompleteRoute) this._persistSceneToStore("cable-tray-discard-incomplete");
    else if (route && String(route.type || "") === "cable-tray.route") this._persistSceneToStore("cable-tray-finish");
    this._setStatus(`Trasse abgeschlossen (${reason})`);
    if (String(this.state?.leftTabId || "") === "tab.structure") this._renderLeftPanel();
    this._renderTopbar();
  }

  _undoCableTrayPoint() {
    const route = this._findSceneObjectById(this._cableTrayDraft?.activeRouteId);
    if (!route || !Array.isArray(route.points)) return;
    route.points.pop();
    if (!route.points.length) {
      this._scene.objects = (this._scene.objects || []).filter((o) => o?.id !== route.id);
      this._cableTrayDraft.activeRouteId = null;
    } else {
      route.x = route.points[0].x;
      route.y = route.points[0].y;
    }
    this._persistSceneToStore("cable-tray-undo-point");
    this._renderTopbar();
  }

  _hitTestCableTrayPoint(wx, wy) {
    const zoom = Math.max(Number(this._vp?.zoom || 1), 1e-6);
    const dpr = Math.max(Number(this._vp?.dpr || 1), 1);
    const radiusWorld = Math.max(8, (14 * dpr) / zoom);
    let best = null;
    let bestD2 = Infinity;
    for (const route of this._scene?.objects || []) {
      if (String(route?.type || "") !== "cable-tray.route") continue;
      const pts = Array.isArray(route.points) ? route.points : [];
      for (let pointIndex = 0; pointIndex < pts.length; pointIndex += 1) {
        const p = pts[pointIndex];
        const dx = Number(wx) - Number(p?.x || 0);
        const dy = Number(wy) - Number(p?.y || 0);
        const d2 = dx * dx + dy * dy;
        if (d2 <= radiusWorld * radiusWorld && d2 < bestD2) {
          best = { route, pointIndex };
          bestD2 = d2;
        }
      }
    }
    return best;
  }
}

export function installWorkareaCableTrayModule(WorkareaPanelClass) {
  const descriptors = Object.getOwnPropertyDescriptors(WorkareaCableTrayModule.prototype);
  delete descriptors.constructor;
  Object.defineProperties(WorkareaPanelClass.prototype, descriptors);
}
