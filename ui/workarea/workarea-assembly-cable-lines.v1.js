/**
 * Workarea Assembly CableLine core domain methods.
 *
 * BP-RF-06 is a structural extraction only. Existing CableLine, routing,
 * length, persistence, schema, EPLAN, BOM and data-authority contracts
 * remain unchanged.
 */
class WorkareaAssemblyCableLinesModule {
  /**
   * PATCH_assemblylab_cablelist_v1
   * Erste automatische Kabellisten-Kandidaten aus den CablePoints.
   *
   * Wichtig:
   * - Das ist noch keine finale EPLAN-/Klemmenlogik.
   * - Die Liste verbindet typische Rollen/Ports zu plausiblen Kabeln:
   *   MOVIFIT -> Motor, 24V -> Sensor, Sensor -> Steuerung,
   *   Wartungsschalter/Schrank -> MOVIFIT, Safety/STO, Profinet, PE/PA.
   * - Manuelle Felder bleiben ueber die CableLine-ID erhalten.
   */
  _getAssemblyCableLineTypesV1() {
    return [
      { value: "power_400v", label: "400V Einspeisung", short: "400V", cableTypeHint: "Leistungskabel / 5G…" },
      { value: "motor", label: "Motorleitung", short: "Motor", cableTypeHint: "Motorleitung U/V/W/PE" },
      { value: "dc_24v", label: "24V DC", short: "24V", cableTypeHint: "Steuerleitung 24V" },
      { value: "sensor", label: "Sensorleitung", short: "Sensor", cableTypeHint: "M12 Sensorleitung" },
      { value: "safety_sto", label: "Safety / STO", short: "STO", cableTypeHint: "Safety-/STO-Leitung" },
      { value: "profinet", label: "Profinet / Netzwerk", short: "PN", cableTypeHint: "Profinet / Ethernet" },
      { value: "pe_pa", label: "PE / Potentialausgleich", short: "PE/PA", cableTypeHint: "PE / PA" },
      { value: "generic", label: "Allgemein", short: "Allg.", cableTypeHint: "noch festlegen" }
    ];
  }

  _getAssemblyCableLineTypeLabelV1(type, mode = "label") {
    const key = String(type || "generic");
    const hit = this._getAssemblyCableLineTypesV1().find((t) => t.value === key);
    if (!hit) return key || "Allgemein";
    return mode === "short" ? (hit.short || hit.label || hit.value) : (hit.label || hit.value);
  }

  _getAssemblyCableLineTypeHintV1(type) {
    const key = String(type || "generic");
    const hit = this._getAssemblyCableLineTypesV1().find((t) => t.value === key);
    return hit?.cableTypeHint || "noch festlegen";
  }

  _labelAssemblyCablePointV1(cp = {}) {
    return [cp.componentName || "Bauteil", cp.portLabel || cp.portKey || "Port"].filter(Boolean).join(" · ");
  }

  _makeAssemblyCableLineIdV1(assemblyId, type, sourceKey, targetKey, index = 0) {
    const clean = (v) => String(v || "x").replace(/[^a-zA-Z0-9:_-]+/g, "_").slice(0, 80);
    return `${assemblyId || "asm"}:cl:${clean(type)}:${clean(sourceKey)}:${clean(targetKey)}:${index}`;
  }

  _makeAssemblyCableLineCandidateV1(sceneObj = {}, cfg = {}, previous = null, index = 0) {
    const assemblyId = String(sceneObj?.id || "");
    const type = String(previous?.type || cfg.type || "generic");
    const sourceCp = cfg.sourceCp || null;
    const targetCp = cfg.targetCp || null;
    const sourceLabel = String(previous?.sourceLabel || cfg.sourceLabel || (sourceCp ? this._labelAssemblyCablePointV1(sourceCp) : "Quelle offen"));
    const targetLabel = String(previous?.targetLabel || cfg.targetLabel || (targetCp ? this._labelAssemblyCablePointV1(targetCp) : "Ziel offen"));
    const sourceKey = sourceCp?.id || sourceLabel;
    const targetKey = targetCp?.id || targetLabel;
    const id = previous?.id || this._makeAssemblyCableLineIdV1(assemblyId, type, sourceKey, targetKey, index);

    return {
      schema: "baustellenplaner.assemblylab.cableline.v1",
      id,
      assemblyId,
      assemblyName: String(sceneObj?.name || sceneObj?.config?.name || assemblyId || "Baugruppe"),
      templateId: String(sceneObj?.templateId || sceneObj?.assemblyLab?.templateId || ""),
      variantId: String(sceneObj?.variantId || sceneObj?.assemblyLab?.variantId || ""),
      conveyorGroup: String(sceneObj?.config?.conveyorGroup || sceneObj?.conveyorGroup || ""),
      location: String(sceneObj?.config?.location || sceneObj?.location || ""),
      equipmentTag: String(sceneObj?.config?.equipmentTag || sceneObj?.equipmentTag || ""),
      type,
      typeLabel: this._getAssemblyCableLineTypeLabelV1(type),
      sourceCablePointId: sourceCp?.id || previous?.sourceCablePointId || "",
      targetCablePointId: targetCp?.id || previous?.targetCablePointId || "",
      sourceComponentId: sourceCp?.componentId || previous?.sourceComponentId || "",
      targetComponentId: targetCp?.componentId || previous?.targetComponentId || "",
      sourceLabel,
      targetLabel,
      cableTypeHint: String(previous?.cableTypeHint || cfg.cableTypeHint || sourceCp?.cableTypeHint || targetCp?.cableTypeHint || this._getAssemblyCableLineTypeHintV1(type)),
      cableType: String(previous?.cableType || cfg.cableType || ""),
      cableNo: String(previous?.cableNo || cfg.cableNo || ""),
      lengthM: previous?.lengthM ?? cfg.lengthM ?? "",
      sourceReserveM: previous?.sourceReserveM ?? cfg.sourceReserveM ?? "",
      targetReserveM: previous?.targetReserveM ?? cfg.targetReserveM ?? "",
      cutAllowanceM: previous?.cutAllowanceM ?? cfg.cutAllowanceM ?? "",
      wires: String(previous?.wires || cfg.wires || ""),
      crossSection: String(previous?.crossSection || cfg.crossSection || ""),
      route: String(previous?.route || cfg.route || ""),
      routeRefs: this._normalizeCableLineRouteRefsV1(previous?.routeRefs ?? cfg.routeRefs ?? []),
      routeDirections: this._normalizeCableLineRouteDirectionsV1(
        previous?.routeDirections ?? cfg.routeDirections ?? {},
        previous?.routeRefs ?? cfg.routeRefs ?? []
      ),
      status: String(previous?.status || cfg.status || "planned"),
      required: cfg.required !== false,
      enabled: previous?.enabled !== false,
      auto: previous?.auto !== false,
      comment: String(previous?.comment || cfg.comment || ""),
      eplan: {
        ...this._defaultCableLineEplanV1(sceneObj, cfg, sourceCp, targetCp),
        ...(previous?.eplan && typeof previous.eplan === "object" ? previous.eplan : {})
      },
      sourceDeviceTag: String(previous?.sourceDeviceTag || previous?.eplan?.sourceDeviceTag || cfg.sourceDeviceTag || ""),
      sourceConnection: String(previous?.sourceConnection || previous?.eplan?.sourceConnection || cfg.sourceConnection || ""),
      targetDeviceTag: String(previous?.targetDeviceTag || previous?.eplan?.targetDeviceTag || cfg.targetDeviceTag || ""),
      targetConnection: String(previous?.targetConnection || previous?.eplan?.targetConnection || cfg.targetConnection || ""),
      terminalRef: String(previous?.terminalRef || previous?.eplan?.sourceTerminal || cfg.terminalRef || ""),
      eplanPage: String(previous?.eplanPage || previous?.eplan?.pagePath || cfg.eplanPage || ""),
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  _deriveAssemblyCableListV1(sceneObj = {}) {
    const cablePoints = Array.isArray(sceneObj?.cablePoints) && sceneObj.cablePoints.length
      ? sceneObj.cablePoints
      : this._deriveAssemblyCablePointsV1(sceneObj);
    const cps = (Array.isArray(cablePoints) ? cablePoints : []).filter((cp) => cp && cp.enabled !== false);
    const previous = Array.isArray(sceneObj?.cableLines)
      ? sceneObj.cableLines
      : (Array.isArray(sceneObj?.cableList) ? sceneObj.cableList : []);

    const prevBySignature = new Map();
    const sigFor = (type, src, dst) => `${String(type || "generic")}::${String(src || "")}::${String(dst || "")}`;
    for (const cl of previous) {
      if (!cl || typeof cl !== "object") continue;
      const sig = sigFor(cl.type, cl.sourceCablePointId || cl.sourceLabel, cl.targetCablePointId || cl.targetLabel);
      prevBySignature.set(sig, cl);
      if (cl.id) prevBySignature.set(String(cl.id), cl);
    }

    const byType = (type) => cps.filter((cp) => String(cp.type || "") === String(type));
    const byTypeDir = (type, dir) => byType(type).filter((cp) => String(cp.direction || "") === dir);
    const byTypeRole = (type, role) => byType(type).filter((cp) => String(cp.componentRole || "") === role);
    const hasRole = (cp, role) => String(cp?.componentRole || "") === role;

    const out = [];
    const add = (cfg) => {
      const type = String(cfg.type || "generic");
      const srcKey = cfg.sourceCp?.id || cfg.sourceLabel || "";
      const dstKey = cfg.targetCp?.id || cfg.targetLabel || "";
      const sig = sigFor(type, srcKey, dstKey);
      const id = this._makeAssemblyCableLineIdV1(sceneObj?.id || "", type, srcKey, dstKey, out.length);
      const prev = prevBySignature.get(sig) || prevBySignature.get(id) || null;
      out.push(this._makeAssemblyCableLineCandidateV1(sceneObj, cfg, prev, out.length));
    };

    const controlMotorOut = byType("motor").find((cp) => hasRole(cp, "control") && cp.direction === "output") || byTypeDir("motor", "output")[0] || null;
    for (const motorIn of byType("motor").filter((cp) => cp.direction === "input" && (hasRole(cp, "drive") || /motor/i.test(cp.portLabel || "")))) {
      add({ type: "motor", sourceCp: controlMotorOut, targetCp: motorIn, sourceLabel: controlMotorOut ? undefined : "MOVIFIT/MOVIPRO Motorabgang", cableTypeHint: "Motorleitung U/V/W/PE" });
    }

    const maintenanceOut = byType("power_400v").find((cp) => hasRole(cp, "maintenance") && cp.direction === "output") || null;
    for (const powerIn of byType("power_400v").filter((cp) => cp.direction === "input" && hasRole(cp, "control"))) {
      add({ type: "power_400v", sourceCp: maintenanceOut, sourceLabel: maintenanceOut ? undefined : "Wartungsschalter / Schaltschrank 400V", targetCp: powerIn, cableTypeHint: "400V Einspeisung / Leistung" });
    }

    const control24 = byType("dc_24v").find((cp) => hasRole(cp, "control")) || null;
    for (const ctrl24 of byType("dc_24v").filter((cp) => cp.direction === "input" && hasRole(cp, "control"))) {
      add({ type: "dc_24v", sourceLabel: "24V DC Netzteil / Schaltschrank", targetCp: ctrl24, cableTypeHint: "Steuerleitung 24V" });
    }
    for (const sensor24 of byType("dc_24v").filter((cp) => cp.direction === "input" && hasRole(cp, "sensor"))) {
      add({ type: "dc_24v", sourceCp: control24, sourceLabel: control24 ? undefined : "MOVIFIT/MOVIPRO 24V DC", targetCp: sensor24, cableTypeHint: "Sensorversorgung 24V" });
    }
    for (const brake24 of byType("dc_24v").filter((cp) => cp.direction === "input" && hasRole(cp, "drive") && /bremse|brake/i.test(cp.portLabel || ""))) {
      add({ type: "dc_24v", sourceLabel: "MOVIFIT/MOVIPRO Bremsausgang 24V", targetCp: brake24, cableTypeHint: "Bremsleitung 24V optional", required: false });
    }

    for (const sig of byType("sensor").filter((cp) => cp.direction === "output" && hasRole(cp, "sensor"))) {
      add({ type: "sensor", sourceCp: sig, targetLabel: "MOVIFIT/MOVIPRO DI / Steuerung", cableTypeHint: "M12 Sensorleitung / Signal" });
    }
    for (const sensorIn of byType("sensor").filter((cp) => cp.direction === "input" && hasRole(cp, "sensor"))) {
      add({ type: "sensor", sourceLabel: "MOVIFIT/MOVIPRO Sensorversorgung", targetCp: sensorIn, cableTypeHint: "M12 Sensorleitung / Versorgung" });
    }

    for (const stoIn of byType("safety_sto").filter((cp) => cp.direction === "input")) {
      add({ type: "safety_sto", sourceLabel: "Bedienpult / Safety-Kreis", targetCp: stoIn, cableTypeHint: "Safety-/STO-Leitung" });
    }
    for (const safetyOut of byType("safety_sto").filter((cp) => cp.direction === "output")) {
      add({ type: "safety_sto", sourceCp: safetyOut, targetLabel: "Bedienpult / Sicherheitsbereich", cableTypeHint: "Bedienpult Sicherheitskreis", required: false });
    }

    for (const pnIn of byType("profinet").filter((cp) => cp.direction === "input")) {
      add({ type: "profinet", sourceLabel: "Profinet vorheriges Gerät / Switch", targetCp: pnIn, cableTypeHint: "Profinet / Ethernet" });
    }
    for (const pnOut of byType("profinet").filter((cp) => cp.direction === "output")) {
      add({ type: "profinet", sourceCp: pnOut, targetLabel: "Profinet nächstes Gerät", cableTypeHint: "Profinet / Ethernet", required: false });
    }

    for (const pe of byType("pe_pa")) {
      add({ type: "pe_pa", sourceLabel: "PE/PA-Schiene / Potentialausgleich", targetCp: pe, cableTypeHint: "PE / PA" });
    }

    // Deduplizieren, falls ein Port ueber mehrere einfache Regeln getroffen wurde.
    const seen = new Set();
    return out.filter((cl) => {
      const k = `${cl.type}::${cl.sourceLabel}::${cl.targetLabel}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return cl.enabled !== false;
    });
  }

  _formatAssemblyCableListSummaryV1(cableLines = [], max = 5) {
    const list = (Array.isArray(cableLines) ? cableLines : []).filter((cl) => cl && cl.enabled !== false);
    if (!list.length) return "keine Kabelliste";
    const labels = list.slice(0, max).map((cl) => {
      const parts = [this._getAssemblyCableLineTypeLabelV1(cl.type, "short"), cl.sourceLabel, "→", cl.targetLabel].filter(Boolean);
      return parts.join(" ");
    });
    if (list.length > max) labels.push(`+${list.length - max}`);
    return labels.join(" | ");
  }


  /**
   * PATCH_assemblylab_cablelist_fields_v1
   * Editierbare Montage-/EPLAN-Felder fuer Kabellisten-Zeilen.
   *
   * Die automatische CableList bleibt weiterhin ein Vorschlag. Diese Felder
   * machen daraus eine praktische Baustellenliste: Kabelnummer, Quelle, Ziel,
   * Kabeltyp, Adern/Querschnitt, Laenge, Status und Bemerkung bleiben direkt
   * an der Workarea-Baugruppen-Instanz gespeichert.
   */
  _getAssemblyCableLineStatusOptionsV1() {
    return [
      { value: "planned", label: "geplant" },
      { value: "to_pull", label: "ziehen" },
      { value: "pulled", label: "gezogen" },
      { value: "measured", label: "gemessen" },
      { value: "connected", label: "angeschlossen" },
      { value: "checked", label: "geprüft" },
      { value: "open", label: "offen" },
      { value: "ignore", label: "ignorieren" }
    ];
  }

  _getAssemblyCableLineStatusLabelV1(status) {
    const key = String(status || "planned");
    const hit = this._getAssemblyCableLineStatusOptionsV1().find((x) => x.value === key);
    return hit?.label || key;
  }

}

export function installWorkareaAssemblyCableLinesModule(WorkareaPanelClass) {
  const descriptors = Object.getOwnPropertyDescriptors(WorkareaAssemblyCableLinesModule.prototype);
  delete descriptors.constructor;
  Object.defineProperties(WorkareaPanelClass.prototype, descriptors);
}
