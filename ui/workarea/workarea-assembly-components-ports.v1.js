/**
 * Workarea Assembly component-role and port domain methods.
 *
 * BP-RF-04 is a structural extraction only. Existing AssemblyLab, scene,
 * persistence, schema and data-authority contracts remain unchanged.
 */
class WorkareaAssemblyComponentsPortsModule {
  /**
   * PATCH_assemblylab_component_roles_v1
   * Zentrale Rollenliste für Bauteile innerhalb einer Baugruppen-Variante.
   *
   * Wichtig:
   * - Diese Rollen sind bewusst technisch gehalten, damit wir später daraus
   *   Stückliste, Ports, Kabelpunkte, EPLAN-/BMK-Logik und Filter ableiten können.
   * - Gespeichert wird nur der stabile Key (z. B. "motor"), angezeigt wird das Label.
   */
  _getAssemblyComponentRolesV1() {
    return [
      { value: "component", label: "Bauteil", short: "Teil" },
      { value: "frame", label: "Rahmen / Grundkörper", short: "Rahmen" },
      { value: "roller", label: "Rolle / Rollensatz", short: "Rolle" },
      { value: "drive", label: "Antrieb / Motor", short: "Motor" },
      { value: "belt", label: "Riemen / Kette", short: "Riemen" },
      { value: "sensor", label: "Sensor", short: "Sensor" },
      { value: "control", label: "Steuerung / MOVIFIT", short: "MOVIFIT" },
      { value: "maintenance", label: "Wartungsschalter", short: "Wartung" },
      { value: "junction", label: "Klemmkasten / Verteiler", short: "Klemmk." },
      { value: "support", label: "Stütze / Fuß", short: "Stütze" },
      { value: "guard", label: "Schutz / Gitter", short: "Schutz" },
      { value: "accessory", label: "Zubehör", short: "Zubehör" }
    ];
  }

  _getAssemblyRoleLabelV1(role, mode = "label") {
    const key = String(role || "component");
    const hit = this._getAssemblyComponentRolesV1().find((r) => r.value === key);
    if (!hit) return key || "Bauteil";
    return mode === "short" ? (hit.short || hit.label || hit.value) : (hit.label || hit.value);
  }

  _inferAssemblyComponentRoleV1(pa, slot = null) {
    const hay = `${pa?.name || ""} ${pa?.title || ""} ${pa?.id || ""} ${slot?.name || ""} ${slot?.lastImportName || ""} ${slot?.importName || ""}`.toLowerCase();
    if (/movifit|movipro|umrichter|fu|steuer|controller|control/.test(hay)) return "control";
    if (/motor|antrieb|sew|drive|getriebe/.test(hay)) return "drive";
    if (/sensor|lichtschranke|initiator|geber|stop|langsam|schnell/.test(hay)) return "sensor";
    if (/wartung|schalter|hauptschalter|maintenance|disconnect/.test(hay)) return "maintenance";
    if (/klemm|verteiler|junction|box|klemmenkasten/.test(hay)) return "junction";
    if (/rahmen|frame|grundk[oö]rper|körper|chassis/.test(hay)) return "frame";
    if (/rolle|rollen|roller|rollerbahn/.test(hay)) return "roller";
    if (/riemen|belt|kette|chain/.test(hay)) return "belt";
    if (/st[üu]tze|fu[ßs]|support|stand/.test(hay)) return "support";
    if (/schutz|gitter|guard|zaun|fence/.test(hay)) return "guard";
    return "component";
  }


  /**
   * PATCH_assemblylab_ports_v1
   * Rollenbasierte Port-/Anschlussvorlagen fuer Baugruppen-Bauteile.
   *
   * Das ist bewusst noch keine finale Elektrokonstruktion, sondern ein stabiles
   * Startmodell fuer spaetere Kabelpunkte/Kabellisten. Die Ports werden direkt
   * am Component-Objekt gespeichert, damit Varianten und Workarea-Instanzen
   * reload-sicher bleiben.
   *
   * Hinweis aus der Praxis: MOVIFIT/MOVIPRO hat in unserem Startmodell nicht nur
   * 400V, sondern auch 24V DC und Safety/STO-Bezug. Zusaetzlich fuehren wir einen
   * Bedienpult/Safety-Output als Platzhalter, damit die spaetere Zuordnung zum
   * Sicherheitsbereich nicht verloren geht.
   */
  _getAssemblyPortTemplatesV1(role = "component") {
    const r = String(role || "component");
    const common = {
      enabled: true,
      required: false,
      voltage: "",
      signal: "",
      connector: "",
      cableHint: "",
      comment: ""
    };
    const p = (key, label, kind, direction, extra = {}) => ({
      ...common,
      key,
      label,
      kind,
      direction,
      required: true,
      ...extra
    });

    if (r === "control") {
      return [
        p("PWR_400V_IN", "400V Einspeisung", "power", "input", {
          voltage: "400V AC",
          signal: "L1/L2/L3/PE",
          cableHint: "Einspeisung / Leistung"
        }),
        p("CTRL_24V_IN", "24V DC Versorgung", "control", "input", {
          voltage: "24V DC",
          signal: "+24V/0V",
          cableHint: "Steuerspannung"
        }),
        p("STO_IN", "STO / Safety Eingang", "safety", "input", {
          voltage: "24V DC",
          signal: "STO A/B",
          cableHint: "Safety / STO"
        }),
        p("SAFETY_PANEL_OUT", "Bedienpult / Safety Ausgang", "safety", "output", {
          voltage: "24V DC",
          signal: "Safety/Enable zum Bedienpult",
          cableHint: "Bedienpult Sicherheitskreis",
          required: false
        }),
        p("MOTOR_OUT", "Motorabgang", "power", "output", {
          voltage: "400V AC",
          signal: "U/V/W/PE/Bremse optional",
          cableHint: "Motorleitung"
        }),
        p("PN_IN", "Profinet IN", "network", "input", {
          signal: "PN/ETH",
          connector: "M12/RJ45 je nach Geraet",
          cableHint: "Netzwerk"
        }),
        p("PN_OUT", "Profinet OUT", "network", "output", {
          signal: "PN/ETH",
          connector: "M12/RJ45 je nach Geraet",
          cableHint: "Netzwerk",
          required: false
        })
      ];
    }

    if (r === "drive") {
      return [
        p("MOTOR_POWER_IN", "Motor Leistung", "power", "input", {
          voltage: "400V AC",
          signal: "U/V/W/PE",
          cableHint: "vom MOVIFIT/MOVIPRO"
        }),
        p("BRAKE_IN", "Bremse 24V", "control", "input", {
          voltage: "24V DC",
          signal: "Bremse +/−",
          cableHint: "Bremsleitung optional",
          required: false
        }),
        p("PE", "PE / Potentialausgleich", "pe", "bidirectional", {
          signal: "PE/PA",
          cableHint: "Schutzleiter / PA"
        })
      ];
    }

    if (r === "sensor") {
      return [
        p("SENSOR_24V", "Sensor 24V", "control", "input", {
          voltage: "24V DC",
          signal: "+24V/0V",
          connector: "M12",
          cableHint: "Sensorleitung"
        }),
        p("SENSOR_SIGNAL", "Sensorsignal", "signal", "output", {
          voltage: "24V DC",
          signal: "DI / Signal",
          connector: "M12",
          cableHint: "Signal zur Steuerung"
        })
      ];
    }

    if (r === "maintenance") {
      return [
        p("PWR_400V_IN", "400V Eingang", "power", "input", {
          voltage: "400V AC",
          signal: "L1/L2/L3/PE",
          cableHint: "Zuleitung"
        }),
        p("PWR_400V_OUT", "400V Ausgang", "power", "output", {
          voltage: "400V AC",
          signal: "L1/L2/L3/PE",
          cableHint: "Abgang zur Baugruppe"
        }),
        p("PE", "PE / Potentialausgleich", "pe", "bidirectional", {
          signal: "PE/PA",
          cableHint: "Schutzleiter / PA"
        })
      ];
    }

    if (r === "junction") {
      return [
        p("TB_400V", "Klemmpunkt 400V", "power", "bidirectional", {
          voltage: "400V AC",
          signal: "L1/L2/L3/PE",
          cableHint: "Leistungsklemmen"
        }),
        p("TB_24V", "Klemmpunkt 24V", "control", "bidirectional", {
          voltage: "24V DC",
          signal: "+24V/0V",
          cableHint: "Steuerklemmen"
        }),
        p("TB_SAFETY", "Klemmpunkt Safety/STO", "safety", "bidirectional", {
          voltage: "24V DC",
          signal: "STO/Safety",
          cableHint: "Safety-Klemmen",
          required: false
        })
      ];
    }

    if (r === "frame" || r === "support" || r === "guard") {
      return [
        p("PE", "PE / Potentialausgleich", "pe", "bidirectional", {
          signal: "PE/PA",
          cableHint: "Potentialausgleich",
          required: false
        })
      ];
    }

    return [];
  }

  _makeAssemblyComponentPortsV1(role = "component", componentId = "", componentName = "") {
    const templates = this._getAssemblyPortTemplatesV1(role);
    return templates.map((tpl, index) => ({
      schema: "baustellenplaner.assemblylab.port.v1",
      id: `${componentId || "cmp"}:${tpl.key || `P${index + 1}`}`,
      componentId: componentId || "",
      componentName: componentName || "",
      role: String(role || "component"),
      roleLabel: this._getAssemblyRoleLabelV1(role || "component"),
      key: tpl.key || `P${index + 1}`,
      label: tpl.label || tpl.key || `Port ${index + 1}`,
      kind: tpl.kind || "signal",
      direction: tpl.direction || "bidirectional",
      voltage: tpl.voltage || "",
      signal: tpl.signal || "",
      connector: tpl.connector || "",
      cableHint: tpl.cableHint || "",
      required: tpl.required !== false,
      enabled: tpl.enabled !== false,
      comment: tpl.comment || "",
      auto: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  }

  _normalizeAssemblyComponentPortsV1(component = {}) {
    const c = component && typeof component === "object" ? component : {};
    const role = String(c.role || "component");
    const name = String(c.name || c.projectAssetId || "Bauteil");
    let ports = Array.isArray(c.ports) ? c.ports : [];

    // Fuer alte Komponenten ohne Ports: Default-Ports aus der Rolle erzeugen.
    if (!ports.length) {
      ports = this._makeAssemblyComponentPortsV1(role, c.id || "", name);
    }

    return ports.map((port, index) => {
      const key = String(port?.key || port?.id || `P${index + 1}`);
      return {
        schema: "baustellenplaner.assemblylab.port.v1",
        id: String(port?.id || `${c.id || "cmp"}:${key}`),
        componentId: String(port?.componentId || c.id || ""),
        componentName: String(port?.componentName || name || ""),
        role,
        roleLabel: this._getAssemblyRoleLabelV1(role),
        key,
        label: String(port?.label || key),
        kind: String(port?.kind || "signal"),
        direction: String(port?.direction || "bidirectional"),
        voltage: String(port?.voltage || ""),
        signal: String(port?.signal || ""),
        connector: String(port?.connector || ""),
        cableHint: String(port?.cableHint || ""),
        required: port?.required !== false,
        enabled: port?.enabled !== false,
        comment: String(port?.comment || ""),
        auto: port?.auto !== false,
        updatedAt: port?.updatedAt || new Date().toISOString(),
        createdAt: port?.createdAt || new Date().toISOString()
      };
    });
  }

  _normalizeAssemblyComponentsWithPortsV1(components = []) {
    return (Array.isArray(components) ? components : []).map((cmp) => {
      const c = this._assemblyLabClone(cmp, cmp) || {};
      c.role = c.role || "component";
      c.roleLabel = this._getAssemblyRoleLabelV1(c.role);
      c.ports = this._normalizeAssemblyComponentPortsV1(c);
      return c;
    });
  }

  _flattenAssemblyPortsV1(components = []) {
    const result = [];
    for (const c of Array.isArray(components) ? components : []) {
      const ports = this._normalizeAssemblyComponentPortsV1(c);
      for (const port of ports) {
        if (port.enabled === false) continue;
        result.push({
          ...port,
          assemblyComponentId: c.id || port.componentId || "",
          componentId: c.id || port.componentId || "",
          componentName: c.name || port.componentName || "",
          projectAssetId: c.projectAssetId || null,
          slotId: c.slotId || null,
          x: Number(c.x || 0),
          y: Number(c.y || 0),
          z: Number(c.z || 0),
          rotDeg: Number(c.rotDeg || 0)
        });
      }
    }
    return result;
  }

  _formatAssemblyPortSummaryV1(ports = [], max = 5) {
    const list = (Array.isArray(ports) ? ports : []).filter((p) => p && p.enabled !== false);
    if (!list.length) return "keine Ports";
    const labels = list.slice(0, max).map((p) => {
      const parts = [p.label || p.key, p.voltage, p.direction].filter(Boolean);
      return parts.join(" · ");
    });
    if (list.length > max) labels.push(`+${list.length - max}`);
    return labels.join(" | ");
  }

}

export function installWorkareaAssemblyComponentsPortsModule(WorkareaPanelClass) {
  const descriptors = Object.getOwnPropertyDescriptors(WorkareaAssemblyComponentsPortsModule.prototype);
  delete descriptors.constructor;
  Object.defineProperties(WorkareaPanelClass.prototype, descriptors);
}
