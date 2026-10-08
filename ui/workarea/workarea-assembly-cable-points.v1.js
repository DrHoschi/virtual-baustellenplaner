/**
 * Workarea Assembly CablePoint domain methods.
 *
 * BP-RF-05 is a structural extraction only. Existing AssemblyLab, scene,
 * CableLine, persistence, schema and data-authority contracts remain unchanged.
 */
class WorkareaAssemblyCablePointsModule {
  /**
   * PATCH_assemblylab_cablepoints_v1
   * Aus den rollenbasierten Ports werden erste Kabelpunkte erzeugt.
   *
   * Wichtig:
   * - Das ist noch keine automatische Quelle/Ziel-Verdrahtung und noch keine
   *   finale Kabelliste. CablePoints sind die Zwischenschicht:
   *   Port -> Kabelpunkt -> spaeter Verbindung/Kabel.
   * - MOVIFIT/MOVIPRO-Ports bekommen dadurch getrennte Punkte fuer 400V,
   *   24V, Safety/STO, Bedienpult/Safety, Motorabgang und Profinet.
   * - Manuelle Werte werden spaeter ueber die CablePoint-ID erhalten.
   */

  _getAssemblyCablePointTypesV1() {
    return [
      { value: "power_400v", label: "Power 400V", short: "400V", cableTypeHint: "Leistungskabel / 5G…" },
      { value: "dc_24v", label: "24V DC", short: "24V", cableTypeHint: "Steuerleitung 24V" },
      { value: "safety_sto", label: "Safety / STO", short: "STO", cableTypeHint: "Safety-/STO-Leitung" },
      { value: "motor", label: "Motorleitung", short: "Motor", cableTypeHint: "Motorleitung U/V/W/PE, Bremse optional" },
      { value: "profinet", label: "Profinet / Netzwerk", short: "PN", cableTypeHint: "Profinet / Ethernet" },
      { value: "sensor", label: "Sensor / Signal", short: "Sensor", cableTypeHint: "M12 Sensorleitung" },
      { value: "pe_pa", label: "PE / Potentialausgleich", short: "PE/PA", cableTypeHint: "PE / PA" },
      { value: "terminal", label: "Klemme / Verteiler", short: "Klemme", cableTypeHint: "Klemmenverdrahtung" },
      { value: "generic", label: "Allgemein", short: "Allg.", cableTypeHint: "noch festlegen" }
    ];
  }

  _getAssemblyCablePointTypeLabelV1(type, mode = "label") {
    const key = String(type || "generic");
    const hit = this._getAssemblyCablePointTypesV1().find((t) => t.value === key);
    if (!hit) return key || "Allgemein";
    return mode === "short" ? (hit.short || hit.label || hit.value) : (hit.label || hit.value);
  }

  _inferAssemblyCablePointTypeFromPortV1(port = {}) {
    const kind = String(port?.kind || "").toLowerCase();
    const rawKey = String(port?.key || port?.id || "");
    const key = rawKey.toLowerCase();
    const label = String(port?.label || "").toLowerCase();
    const voltage = String(port?.voltage || "").toLowerCase();
    const signal = String(port?.signal || "").toLowerCase();
    const cableHint = String(port?.cableHint || "").toLowerCase();
    const hay = `${kind} ${key} ${label} ${voltage} ${signal} ${cableHint}`;

    // PATCH_assemblylab_cabletype_classifier_hotfix_v1
    // ------------------------------------------------------------
    // Wichtig: Vorher wurde sehr frueh nach "PE" gesucht. Dadurch wurden
    // Anschluesse wie L1/L2/L3/PE oder U/V/W/PE faelschlich komplett als
    // Potentialausgleich klassifiziert. Deshalb pruefen wir zuerst die
    // eindeutigen Port-Keys und technischen Hauptfunktionen. PE/PA kommt
    // erst am Ende als eigener Port-Typ.
    if (/^(pn_in|pn_out|profinet_in|profinet_out)$/i.test(rawKey)) return "profinet";
    if (/^(sto_in|sto_out|safety_in|safety_out|safety_panel_out)$/i.test(rawKey)) return "safety_sto";
    if (/^(motor_out|motor_power_in|motor_power_out)$/i.test(rawKey)) return "motor";
    if (/^(pwr_400v_in|pwr_400v_out|power_400v_in|power_400v_out)$/i.test(rawKey)) return "power_400v";
    if (/^(ctrl_24v_in|ctrl_24v_out|brake_in|brake_out|24v_in|24v_out)$/i.test(rawKey)) return "dc_24v";
    if (/^(sensor_24v|sensor_signal|sensor_in|sensor_out)$/i.test(rawKey)) return "sensor";
    if (/^(pe|pa|pe_pa|potentialausgleich)$/i.test(rawKey) || kind === "pe") return "pe_pa";

    if (/profinet|ethernet|pn_|network|netzwerk/.test(hay) || kind === "network") return "profinet";
    if (/sto|safety|bedienpult|not.?halt|enable/.test(hay) || kind === "safety") return "safety_sto";
    if (/motor|u\/v\/w|u-v-w|motorabgang|motor_power/.test(hay)) return "motor";
    if (/sensor|m12|di\s*\/\s*signal|sensorsignal/.test(hay) || kind === "signal") return "sensor";
    if (/24v|24\s*v|bremse/.test(hay) || kind === "control") return "dc_24v";
    if (/400v|400\s*v|l1\/l2\/l3|leistung/.test(hay) || kind === "power") return "power_400v";
    if (/klemme|terminal|tb_/.test(hay)) return "terminal";
    if (/\b(pe|pa)\b|potential|schutzleiter/.test(hay)) return "pe_pa";
    return "generic";
  }

  _makeAssemblyCablePointIdV1(assemblyId, port, index = 0) {
    const base = String(port?.id || port?.key || `P${index + 1}`).replace(/[^a-zA-Z0-9:_-]+/g, "_");
    return `${assemblyId || "asm"}:cp:${base}`;
  }

  _makeAssemblyCablePointFromPortV1(port = {}, sceneObj = {}, index = 0, previous = null) {
    const assemblyId = String(sceneObj?.id || "");
    const inferredType = this._inferAssemblyCablePointTypeFromPortV1(port);
    // Auto-generierte Kabelpunkte duerfen nach Classifier-Hotfix neu klassifiziert
    // werden. Nur explizit manuelle CablePoints (auto:false) behalten ihren Typ.
    const previousIsManual = previous && previous.auto === false;
    const type = previousIsManual ? (previous?.type || inferredType) : inferredType;
    const typeChanged = previous && previous.type && previous.type !== type;
    const typeMeta = this._getAssemblyCablePointTypesV1().find((t) => t.value === type) || null;
    const direction = String(port?.direction || "bidirectional");
    const portLabel = String(port?.label || port?.key || `Port ${index + 1}`);
    const componentName = String(port?.componentName || "Bauteil");
    const endpointLabel = `${componentName} · ${portLabel}`;

    let sourceHint = previous?.sourceHint || "noch zuordnen";
    let targetHint = previous?.targetHint || "noch zuordnen";
    if (!previous?.sourceHint && !previous?.targetHint) {
      if (direction === "output") sourceHint = endpointLabel;
      else if (direction === "input") targetHint = endpointLabel;
      else {
        sourceHint = endpointLabel;
        targetHint = "noch zuordnen";
      }
    }

    return {
      schema: "baustellenplaner.assemblylab.cablepoint.v1",
      id: previous?.id || this._makeAssemblyCablePointIdV1(assemblyId, port, index),
      assemblyId,
      assemblyName: String(sceneObj?.name || sceneObj?.config?.name || assemblyId || "Baugruppe"),
      templateId: String(sceneObj?.templateId || sceneObj?.assemblyLab?.templateId || ""),
      variantId: String(sceneObj?.variantId || sceneObj?.assemblyLab?.variantId || ""),
      conveyorGroup: String(sceneObj?.config?.conveyorGroup || sceneObj?.conveyorGroup || ""),
      location: String(sceneObj?.config?.location || sceneObj?.location || ""),
      equipmentTag: String(sceneObj?.config?.equipmentTag || sceneObj?.equipmentTag || ""),
      componentId: String(port?.componentId || port?.assemblyComponentId || ""),
      componentName,
      componentRole: String(port?.role || "component"),
      componentRoleLabel: String(port?.roleLabel || this._getAssemblyRoleLabelV1(port?.role || "component")),
      projectAssetId: port?.projectAssetId || null,
      slotId: port?.slotId || null,
      portId: String(port?.id || ""),
      portKey: String(port?.key || ""),
      portLabel,
      type,
      typeLabel: this._getAssemblyCablePointTypeLabelV1(type),
      direction,
      voltage: String(port?.voltage || ""),
      signal: String(port?.signal || ""),
      connector: String(port?.connector || ""),
      cableHint: String(port?.cableHint || ""),
      cableTypeHint: String((typeChanged ? "" : previous?.cableTypeHint) || port?.cableTypeHint || typeMeta?.cableTypeHint || port?.cableHint || "noch festlegen"),
      sourceHint,
      targetHint,
      status: String(previous?.status || "planned"),
      required: port?.required !== false,
      enabled: previous?.enabled !== false && port?.enabled !== false,
      x: Number(port?.x || 0),
      y: Number(port?.y || 0),
      z: Number(port?.z || 0),
      rotDeg: Number(port?.rotDeg || 0),
      comment: String(previous?.comment || port?.comment || ""),
      auto: previous?.auto !== false,
      updatedAt: new Date().toISOString(),
      createdAt: previous?.createdAt || new Date().toISOString()
    };
  }

  _deriveAssemblyCablePointsV1(sceneObj = {}) {
    const ports = Array.isArray(sceneObj?.ports) && sceneObj.ports.length
      ? sceneObj.ports
      : this._flattenAssemblyPortsV1(sceneObj?.components || []);
    const previous = Array.isArray(sceneObj?.cablePoints)
      ? sceneObj.cablePoints
      : (Array.isArray(sceneObj?.cablepoints) ? sceneObj.cablepoints : []);
    const prevByPort = new Map();
    const prevById = new Map();
    for (const cp of previous) {
      if (!cp || typeof cp !== "object") continue;
      if (cp.portId) prevByPort.set(String(cp.portId), cp);
      if (cp.id) prevById.set(String(cp.id), cp);
    }

    const list = [];
    for (const [index, port] of (Array.isArray(ports) ? ports : []).entries()) {
      if (!port || port.enabled === false) continue;
      const id = this._makeAssemblyCablePointIdV1(sceneObj?.id || "", port, index);
      const prev = prevByPort.get(String(port.id || "")) || prevById.get(id) || null;
      list.push(this._makeAssemblyCablePointFromPortV1(port, sceneObj, index, prev));
    }
    return list;
  }

  _formatAssemblyCablePointSummaryV1(cablePoints = [], max = 5) {
    const list = (Array.isArray(cablePoints) ? cablePoints : []).filter((cp) => cp && cp.enabled !== false);
    if (!list.length) return "keine Kabelpunkte";
    const labels = list.slice(0, max).map((cp) => {
      const parts = [this._getAssemblyCablePointTypeLabelV1(cp.type, "short"), cp.portLabel, cp.direction].filter(Boolean);
      return parts.join(" · ");
    });
    if (list.length > max) labels.push(`+${list.length - max}`);
    return labels.join(" | ");
  }

}

export function installWorkareaAssemblyCablePointsModule(WorkareaPanelClass) {
  const descriptors = Object.getOwnPropertyDescriptors(WorkareaAssemblyCablePointsModule.prototype);
  delete descriptors.constructor;
  Object.defineProperties(WorkareaPanelClass.prototype, descriptors);
}
