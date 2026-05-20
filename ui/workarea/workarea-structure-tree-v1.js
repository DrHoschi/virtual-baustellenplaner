/*
 * Baustellenplaner – Workarea Structure Tree v1
 * Patch: PATCH_workarea_structure_tree_v1
 *
 * Ziel:
 * - Leichter Strukturbaum für die Workarea.
 * - Zeigt nur Gruppierungen/Zusammenfassungen.
 * - Rendert keine kompletten Kabel-, BOM- oder Parameterdetails.
 * - Details werden nur über vorhandene Dialoge/Buttons geöffnet.
 *
 * Einbindung:
 * <script src="./ui/workarea/workarea-structure-tree-v1.js"></script>
 */

(function installWorkareaStructureTreeV1(global) {
  "use strict";

  const PATCH_ID = "PATCH_workarea_structure_tree_v1";
  const VERSION = "1.0.0";

  const ROLE_LABELS = {
    drive: "Antrieb / Motor",
    motor: "Antrieb / Motor",
    control: "Steuerung / MOVIFIT",
    movifit: "Steuerung / MOVIFIT",
    movipro: "Steuerung / MOVIPRO",
    sensor: "Sensoren",
    guard: "Schutz / Gitter",
    safety: "Sicherheit",
    panel: "Bedienpulte",
    cabinet: "Schränke",
    component: "Komponenten",
    unknown: "Sonstige Komponenten"
  };

  const ICONS = {
    project: "▣",
    location: "⌁",
    group: "FG",
    assembly: "▤",
    role: "◆",
    cable: "⚡",
    bom: "☷",
    params: "⚙"
  };

  function safeStr(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    const s = String(value).trim();
    return s || fallback;
  }

  function safeArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  }

  function countArrayOrObject(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    return 0;
  }

  function getObjectLocation(obj) {
    return safeStr(
      obj?.location || obj?.assembly?.location || obj?.assemblyMeta?.location || obj?.meta?.location || obj?.properties?.location,
      "Ohne Ort/Bereich"
    );
  }

  function getObjectConveyorGroup(obj) {
    return safeStr(
      obj?.conveyorGroup || obj?.assembly?.conveyorGroup || obj?.assemblyMeta?.conveyorGroup || obj?.meta?.conveyorGroup || obj?.properties?.conveyorGroup,
      "Ohne Fördergruppe"
    );
  }

  function getObjectName(obj) {
    return safeStr(obj?.name || obj?.assemblyName || obj?.label || obj?.equipmentTag || obj?.id, "Objekt");
  }

  function getObjectTypeLabel(obj) {
    const t = safeStr(obj?.type || obj?.assetType || obj?.propertiesType, "object");
    if (t === "assembly.instance") return "Baugruppe";
    if (t === "asset.instance") return "Asset";
    if (t.includes("cabinet")) return "Schrank";
    return t;
  }

  function getObjectComponentList(obj) {
    return safeArray(obj?.components || obj?.componentRefs || obj?.assembly?.components).filter(Boolean);
  }

  function getRoleKey(component) {
    const raw = safeStr(component?.role || component?.componentRole || component?.type, "unknown").toLowerCase();
    if (raw.includes("drive") || raw.includes("motor")) return "drive";
    if (raw.includes("control") || raw.includes("movifit")) return "control";
    if (raw.includes("movipro")) return "movipro";
    if (raw.includes("sensor")) return "sensor";
    if (raw.includes("guard") || raw.includes("gitter")) return "guard";
    if (raw.includes("safety") || raw.includes("safe")) return "safety";
    if (raw.includes("cabinet") || raw.includes("schrank")) return "cabinet";
    if (raw.includes("panel") || raw.includes("pult")) return "panel";
    return raw || "unknown";
  }

  function getRoleLabel(roleKey, component) {
    return safeStr(component?.roleLabel || component?.componentRoleLabel || ROLE_LABELS[roleKey], ROLE_LABELS.unknown);
  }

  function makeEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function emitDebug(name, payload) {
    try {
      global.dispatchEvent(new CustomEvent("bp:debug", { detail: { source: PATCH_ID, name, payload: payload || {} } }));
    } catch (_) {}
    try { console.debug(`[${PATCH_ID}] ${name}`, payload || {}); } catch (_) {}
  }

  function createModel(options) {
    const objects = safeArray(options.getObjects ? options.getObjects() : options.objects);
    const projectName = safeStr(options.getProjectName ? options.getProjectName() : options.projectName, "Projekt");
    const root = { id: "project", kind: "project", label: projectName, icon: ICONS.project, count: objects.length, children: [] };
    const locMap = new Map();

    for (const obj of objects) {
      if (!obj || typeof obj !== "object") continue;
      const location = getObjectLocation(obj);
      const conveyorGroup = getObjectConveyorGroup(obj);

      if (!locMap.has(location)) {
        locMap.set(location, { id: `loc:${location}`, kind: "location", label: location, icon: ICONS.location, count: 0, children: [], _groupMap: new Map() });
        root.children.push(locMap.get(location));
      }
      const locNode = locMap.get(location);
      locNode.count += 1;

      if (!locNode._groupMap.has(conveyorGroup)) {
        locNode._groupMap.set(conveyorGroup, { id: `loc:${location}:fg:${conveyorGroup}`, kind: "conveyorGroup", label: conveyorGroup, icon: ICONS.group, count: 0, children: [] });
        locNode.children.push(locNode._groupMap.get(conveyorGroup));
      }
      const fgNode = locNode._groupMap.get(conveyorGroup);
      fgNode.count += 1;

      const components = getObjectComponentList(obj);
      const roleMap = new Map();
      for (const component of components) {
        const roleKey = getRoleKey(component);
        const roleLabel = getRoleLabel(roleKey, component);
        if (!roleMap.has(roleKey)) roleMap.set(roleKey, { id: `${obj.id || getObjectName(obj)}:role:${roleKey}`, kind: "role", roleKey, label: roleLabel, icon: ICONS.role, count: 0, children: [] });
        roleMap.get(roleKey).count += 1;
      }

      const cablePointCount = countArrayOrObject(obj.cablePoints || obj.assembly?.cablePoints || obj.ports);
      const cableLineCount = countArrayOrObject(obj.cableLines || obj.assembly?.cableLines);
      const bomCount = countArrayOrObject(obj.bom || obj.bomLines || obj.material || obj.materialLines);
      const paramCount = countArrayOrObject(obj.params || obj.parameters);

      const asmNode = {
        id: `obj:${obj.id || getObjectName(obj)}`,
        objectId: obj.id || "",
        kind: "object",
        label: getObjectName(obj),
        sub: `${getObjectTypeLabel(obj)} · ${components.length} Komp.`,
        icon: ICONS.assembly,
        count: components.length,
        raw: obj,
        children: [...Array.from(roleMap.values())]
      };

      if (cablePointCount || cableLineCount) asmNode.children.push({ id: `${asmNode.id}:electrical`, kind: "action", action: "electrical", objectId: asmNode.objectId, label: "Elektrik", sub: `${cablePointCount} Punkte · ${cableLineCount} Leitungen`, icon: ICONS.cable, count: cablePointCount + cableLineCount, children: [] });
      if (bomCount) asmNode.children.push({ id: `${asmNode.id}:bom`, kind: "action", action: "bom", objectId: asmNode.objectId, label: "Stückliste / Material", sub: `${bomCount} Positionen`, icon: ICONS.bom, count: bomCount, children: [] });
      if (paramCount) asmNode.children.push({ id: `${asmNode.id}:params`, kind: "action", action: "params", objectId: asmNode.objectId, label: "Parameter", sub: `${paramCount} Werte`, icon: ICONS.params, count: paramCount, children: [] });

      fgNode.children.push(asmNode);
    }

    for (const loc of root.children) delete loc._groupMap;
    return root;
  }

  class WorkareaStructureTree {
    constructor(options) {
      this.options = options || {};
      this.host = this.options.host;
      this.stateKey = this.options.stateKey || "baustellenplaner:workarea:structureTree:v1";
      this.expanded = this._loadExpanded();
      this.disposed = false;
      this.model = null;
      this._renderCount = 0;
    }

    mount() {
      if (!this.host) { emitDebug("mount:missing-host"); return this; }
      this.host.classList.add("wa-structure-tree-host");
      this.refresh("mount");
      return this;
    }

    dispose() {
      this.disposed = true;
      if (this.host) this.host.innerHTML = "";
      this.model = null;
    }

    refresh(reason = "refresh") {
      if (this.disposed || !this.host) return;
      this.model = createModel(this.options);
      this._render(reason);
    }

    _loadExpanded() {
      try {
        const raw = global.localStorage?.getItem(this.stateKey);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === "object") return new Set(parsed.open || []);
      } catch (_) {}
      return new Set(["project"]);
    }

    _saveExpanded() {
      try { global.localStorage?.setItem(this.stateKey, JSON.stringify({ schema: "baustellenplaner.workarea.structureTree.ui.v1", open: Array.from(this.expanded), updatedAt: new Date().toISOString() })); } catch (_) {}
    }

    _isOpen(node) { return node?.kind === "project" || this.expanded.has(node?.id); }

    _toggle(node) {
      if (!node || !node.children || !node.children.length) return;
      if (this.expanded.has(node.id)) this.expanded.delete(node.id); else this.expanded.add(node.id);
      this._saveExpanded();
      this._render("toggle");
    }

    _selectObject(objectId) {
      if (!objectId) return;
      const cb = this.options.onSelectObject;
      if (typeof cb === "function") cb(objectId);
      else if (this.options.panel?._setSelectionToObject) this.options.panel._setSelectionToObject(objectId);
      else if (this.options.panel?._selectObjectById) this.options.panel._selectObjectById(objectId);
      this.refresh("select");
    }

    _openAction(node) {
      if (!node) return;
      const cb = this.options.onOpenDetails;
      if (typeof cb === "function") { cb(node.action || node.kind, { objectId: node.objectId || "", node }); return; }
      const panel = this.options.panel;
      if (panel?._openStructureDetailDialogV1) { panel._openStructureDetailDialogV1(node.action || node.kind, { objectId: node.objectId || "", node }); return; }
      if (panel?._openAssemblyElectricalDialogV1 && node.action === "electrical") { panel._openAssemblyElectricalDialogV1(node.objectId); return; }
      if (panel?._openAssemblyBomDialogV1 && node.action === "bom") { panel._openAssemblyBomDialogV1(node.objectId); return; }
      if (panel?._openAssemblyParamsDialogV1 && node.action === "params") { panel._openAssemblyParamsDialogV1(node.objectId); return; }
      emitDebug("action:no-handler", { action: node.action, objectId: node.objectId });
    }

    _render(reason) {
      if (this.disposed || !this.host) return;
      const mode = safeStr(this.options.getMode ? this.options.getMode() : this.options.mode, "select");
      const selectionId = safeStr(this.options.getSelectionId ? this.options.getSelectionId() : this.options.selectionId, "");
      this._renderCount += 1;
      this.host.innerHTML = "";

      const wrap = makeEl("div", "wa-structure-tree");
      wrap.dataset.patch = PATCH_ID;
      wrap.dataset.version = VERSION;
      wrap.dataset.mode = mode;

      const head = makeEl("div", "wa-structure-tree__head");
      const titleBox = makeEl("div", "wa-structure-tree__titlebox");
      titleBox.appendChild(makeEl("div", "wa-structure-tree__title", "Struktur"));
      titleBox.appendChild(makeEl("div", "wa-structure-tree__subtitle", `Modus: ${mode} · leicht geladen`));
      const actions = makeEl("div", "wa-structure-tree__headActions");
      const refreshBtn = makeEl("button", "wa-structure-tree__iconBtn", "↻");
      refreshBtn.type = "button";
      refreshBtn.title = "Struktur aktualisieren";
      refreshBtn.addEventListener("click", () => this.refresh("manual"));
      actions.appendChild(refreshBtn);
      head.appendChild(titleBox);
      head.appendChild(actions);
      wrap.appendChild(head);

      const body = makeEl("div", "wa-structure-tree__body");
      if (!this.model || !this.model.children.length) body.appendChild(makeEl("div", "wa-structure-tree__empty", "Keine Objekte in der Workarea."));
      else this._renderNode(body, this.model, 0, selectionId);
      wrap.appendChild(body);
      wrap.appendChild(makeEl("div", "wa-structure-tree__foot", "Details werden erst beim Öffnen eines Dialogs geladen."));
      this.host.appendChild(wrap);

      if (reason !== "toggle") emitDebug("render", { reason, count: this._renderCount, mode, selectionId, objects: this.model?.count || 0 });
    }

    _renderNode(parent, node, level, selectionId) {
      const hasChildren = !!(node.children && node.children.length);
      const isOpen = this._isOpen(node);
      const isSelectedObject = node.objectId && node.objectId === selectionId;
      const row = makeEl("div", "wa-structure-tree__row");
      row.dataset.kind = node.kind;
      row.dataset.level = String(level);
      if (isSelectedObject) row.classList.add("is-selected");

      const indent = makeEl("span", "wa-structure-tree__indent");
      indent.style.width = `${Math.min(level, 6) * 14}px`;
      row.appendChild(indent);

      const twist = makeEl("button", "wa-structure-tree__twist", hasChildren ? (isOpen ? "▾" : "▸") : "·");
      twist.type = "button";
      twist.disabled = !hasChildren;
      twist.addEventListener("click", (event) => { event.stopPropagation(); this._toggle(node); });
      row.appendChild(twist);
      row.appendChild(makeEl("span", "wa-structure-tree__icon", node.icon || "•"));

      const main = makeEl("button", "wa-structure-tree__main");
      main.type = "button";
      main.title = node.label || "";
      main.appendChild(makeEl("span", "wa-structure-tree__label", node.label || ""));
      if (node.sub) main.appendChild(makeEl("span", "wa-structure-tree__sub", node.sub));
      main.addEventListener("click", (event) => {
        event.stopPropagation();
        if (node.kind === "object" && node.objectId) this._selectObject(node.objectId);
        else if (node.kind === "action") this._openAction(node);
        else if (hasChildren) this._toggle(node);
      });
      row.appendChild(main);

      if (typeof node.count === "number") row.appendChild(makeEl("span", "wa-structure-tree__badge", String(node.count)));
      if (node.kind === "action") {
        const openBtn = makeEl("button", "wa-structure-tree__openBtn", "Öffnen");
        openBtn.type = "button";
        openBtn.addEventListener("click", (event) => { event.stopPropagation(); this._openAction(node); });
        row.appendChild(openBtn);
      }

      parent.appendChild(row);
      if (hasChildren && isOpen) for (const child of node.children) this._renderNode(parent, child, level + 1, selectionId);
    }
  }

  function mount(options) { return new WorkareaStructureTree(options || {}).mount(); }
  global.BPWorkareaStructureTree = { PATCH_ID, VERSION, mount, createModel };
})(window);
