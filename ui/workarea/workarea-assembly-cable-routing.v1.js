/**
 * Workarea Assembly CableLine routing, length and diagnostics methods.
 *
 * BP-RF-07 is a structural extraction only. Existing CableLine routeRefs,
 * routeDirections, world-coordinate, route length, reserve, cut allowance and
 * diagnostics authorities remain unchanged.
 */
class WorkareaAssemblyCableRoutingModule {
  _normalizeCableLineRouteRefsV1(routeRefs = []) {
    const seen = new Set();
    const out = [];
    for (const raw of (Array.isArray(routeRefs) ? routeRefs : [])) {
      const id = String(raw || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  _normalizeCableLineRouteDirectionsV1(routeDirections = {}, routeRefs = []) {
    const source = routeDirections && typeof routeDirections === "object" && !Array.isArray(routeDirections)
      ? routeDirections
      : {};
    const out = {};
    for (const routeId of this._normalizeCableLineRouteRefsV1(routeRefs)) {
      const direction = String(source[routeId] || "").trim();
      if (direction === "forward" || direction === "reverse") out[routeId] = direction;
    }
    return out;
  }

  _getAssemblyCablePointWorldPositionV1(sceneObj = {}, cablePoint = null) {
    if (!sceneObj || String(sceneObj?.type || "") !== "assembly.instance" || !cablePoint) return null;
    const componentId = String(cablePoint?.componentId || "").trim();
    if (!componentId) return null;
    const component = (Array.isArray(sceneObj?.components) ? sceneObj.components : [])
      .find((item) => item && String(item.id || "") === componentId);
    if (!component) return null;

    const values = [sceneObj?.x, sceneObj?.y, sceneObj?.rotDeg, component?.x, component?.y];
    if (!values.every((value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)))) return null;

    const assemblyX = Number(sceneObj.x);
    const assemblyY = Number(sceneObj.y);
    const localX = Number(component.x);
    const localY = Number(component.y);
    const rotRad = (Number(sceneObj.rotDeg) * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);
    return {
      x: assemblyX + localX * cos - localY * sin,
      y: assemblyY + localX * sin + localY * cos,
      authority: "component-origin"
    };
  }

  _resolveCableLineEndpointWorldPositionV1(sceneObj = {}, cablePointId = "") {
    const id = String(cablePointId || "").trim();
    if (!id) return null;
    const cablePoints = Array.isArray(sceneObj?.cablePoints) ? sceneObj.cablePoints : [];
    const cablePoint = cablePoints.find((item) => item && item.enabled !== false && String(item.id || "") === id) || null;
    return cablePoint ? this._getAssemblyCablePointWorldPositionV1(sceneObj, cablePoint) : null;
  }

  _getDirectDistanceM2dV1(fromPoint, toPoint) {
    if (!fromPoint || !toPoint) return null;
    if (![fromPoint.x, fromPoint.y, toPoint.x, toPoint.y].every((value) => Number.isFinite(Number(value)))) return null;
    return Math.hypot(Number(toPoint.x) - Number(fromPoint.x), Number(toPoint.y) - Number(fromPoint.y)) / 1000;
  }

  _getCableLineRouteAssignmentV1(cableLine = {}, sceneObj = null) {
    const routeRefs = this._normalizeCableLineRouteRefsV1(cableLine?.routeRefs);
    const routeDirections = this._normalizeCableLineRouteDirectionsV1(cableLine?.routeDirections, routeRefs);
    const byId = new Map(this._getCableTrayRoutesForAssignmentV1().map((route) => [String(route.id), route]));
    const routes = routeRefs.map((id) => byId.get(id) || null);
    const knownMinimumTrayPathM = routes.reduce((sum, route) => sum + (route ? this._getCableTrayLengthM(route) : 0), 0);
    const transitions = [];
    for (let index = 0; index < routes.length - 1; index += 1) {
      const fromRoute = routes[index];
      const toRoute = routes[index + 1];
      const fromId = routeRefs[index];
      const toId = routeRefs[index + 1];
      const fromEndpoints = this._getCableTrayTraversalEndpointsV1(fromRoute, routeDirections[fromId]);
      const toEndpoints = this._getCableTrayTraversalEndpointsV1(toRoute, routeDirections[toId]);
      const closed = Boolean(
        fromEndpoints && toEndpoints &&
        fromEndpoints.exit.x === toEndpoints.entry.x &&
        fromEndpoints.exit.y === toEndpoints.entry.y
      );
      transitions.push({
        fromId,
        toId,
        status: closed ? "continuous" : "undetermined",
        lengthM: closed ? 0 : null
      });
    }
    const manualLengthRaw = String(cableLine?.lengthM ?? "").trim().replace(",", ".");
    const manualLengthM = manualLengthRaw !== "" && Number.isFinite(Number(manualLengthRaw))
      ? Number(manualLengthRaw)
      : null;
    const manualMinusKnownMinimumM = manualLengthM === null ? null : manualLengthM - knownMinimumTrayPathM;
    const parseReserveM = (value) => {
      const raw = String(value ?? "").trim().replace(",", ".");
      if (raw === "") return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };
    const sourceReserveM = parseReserveM(cableLine?.sourceReserveM);
    const targetReserveM = parseReserveM(cableLine?.targetReserveM);
    const cutAllowanceM = parseReserveM(cableLine?.cutAllowanceM);
    const hasMissingRoutes = routes.some((route) => !route);
    const hasUndeterminedDirections = routeRefs.some((id) => !["forward", "reverse"].includes(routeDirections[id]));
    const hasUndeterminedTransitions = transitions.some((transition) => transition.status !== "continuous");
    const plannedRequiredLengthM = (
      routeRefs.length > 0 &&
      !hasMissingRoutes &&
      !hasUndeterminedDirections &&
      !hasUndeterminedTransitions &&
      sourceReserveM !== null &&
      targetReserveM !== null
    )
      ? knownMinimumTrayPathM + sourceReserveM + targetReserveM
      : null;
    const plannedCutLengthM = plannedRequiredLengthM !== null && cutAllowanceM !== null
      ? plannedRequiredLengthM + cutAllowanceM
      : null;
    const sourceWorld = sceneObj ? this._resolveCableLineEndpointWorldPositionV1(sceneObj, cableLine?.sourceCablePointId) : null;
    const targetWorld = sceneObj ? this._resolveCableLineEndpointWorldPositionV1(sceneObj, cableLine?.targetCablePointId) : null;
    const firstRouteId = routeRefs[0] || "";
    const lastRouteId = routeRefs.length ? routeRefs[routeRefs.length - 1] : "";
    const firstEndpoints = routes.length
      ? this._getCableTrayTraversalEndpointsV1(routes[0], routeDirections[firstRouteId])
      : null;
    const lastEndpoints = routes.length
      ? this._getCableTrayTraversalEndpointsV1(routes[routes.length - 1], routeDirections[lastRouteId])
      : null;
    const sourceDirectDistanceM = sourceWorld && firstEndpoints
      ? this._getDirectDistanceM2dV1(sourceWorld, firstEndpoints.entry)
      : null;
    const targetDirectDistanceM = targetWorld && lastEndpoints
      ? this._getDirectDistanceM2dV1(lastEndpoints.exit, targetWorld)
      : null;
    const hasUndeterminedPortions = routeRefs.length > 0 && (
      sourceDirectDistanceM === null ||
      targetDirectDistanceM === null ||
      hasUndeterminedTransitions
    );
    return {
      routeRefs,
      routeDirections,
      routes,
      transitions,
      trayPathLengthM: knownMinimumTrayPathM,
      knownMinimumTrayPathM,
      sourceReserveM,
      targetReserveM,
      cutAllowanceM,
      plannedRequiredLengthM,
      plannedCutLengthM,
      manualLengthM,
      manualMinusKnownMinimumM,
      sourceWorld,
      targetWorld,
      sourceDirectDistanceM,
      targetDirectDistanceM,
      sourceTargetAuthority: sourceWorld || targetWorld ? "component-origin" : null,
      hasUndeterminedTransitions,
      hasUndeterminedPortions
    };
  }

  _setCableLineRouteRefsV1(sceneObj, cableLineId, routeRefs = []) {
    if (!sceneObj || !Array.isArray(sceneObj.cableLines)) return false;
    const cableLine = sceneObj.cableLines.find((line) => String(line?.id || "") === String(cableLineId || ""));
    if (!cableLine) return false;
    const next = this._normalizeCableLineRouteRefsV1(routeRefs);
    const prev = this._normalizeCableLineRouteRefsV1(cableLine.routeRefs);
    if (JSON.stringify(prev) === JSON.stringify(next)) return false;
    cableLine.routeRefs = next;
    cableLine.routeDirections = this._normalizeCableLineRouteDirectionsV1(cableLine.routeDirections, next);
    this._assemblyPropsPersistScene(sceneObj, "assemblyprops:cable-route-assignment");
    return true;
  }

  _setCableLineRouteDirectionV1(sceneObj, cableLineId, routeId, direction) {
    if (!sceneObj || !Array.isArray(sceneObj.cableLines)) return false;
    const cableLine = sceneObj.cableLines.find((line) => String(line?.id || "") === String(cableLineId || ""));
    if (!cableLine) return false;
    const routeRefs = this._normalizeCableLineRouteRefsV1(cableLine.routeRefs);
    const id = String(routeId || "").trim();
    if (!routeRefs.includes(id)) return false;
    const nextDirection = direction === "forward" || direction === "reverse" ? direction : "";
    const next = this._normalizeCableLineRouteDirectionsV1(cableLine.routeDirections, routeRefs);
    if (nextDirection) next[id] = nextDirection;
    else delete next[id];
    const prev = this._normalizeCableLineRouteDirectionsV1(cableLine.routeDirections, routeRefs);
    if (JSON.stringify(prev) === JSON.stringify(next)) return false;
    cableLine.routeDirections = next;
    this._assemblyPropsPersistScene(sceneObj, "assemblyprops:cable-route-direction");
    return true;
  }
}

export function installWorkareaAssemblyCableRoutingModule(WorkareaPanelClass) {
  const descriptors = Object.getOwnPropertyDescriptors(WorkareaAssemblyCableRoutingModule.prototype);
  delete descriptors.constructor;
  Object.defineProperties(WorkareaPanelClass.prototype, descriptors);
}
