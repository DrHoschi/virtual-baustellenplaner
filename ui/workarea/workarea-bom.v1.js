/**
 * Workarea BOM / material-output module.
 *
 * Structural extraction only: persistence, schemas, data authorities and
 * product behavior remain owned by the existing WorkareaPanel contracts.
 */
export class WorkareaBomModule {
  _renderBOMPanelFull() {
    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";

    const title = document.createElement("div");
    title.style.fontWeight = "800";
    title.textContent = "BOM / Stückliste";
    box.appendChild(title);

    const hint = document.createElement("div");
    hint.style.fontSize = "12px";
    hint.style.opacity = ".75";
    hint.textContent =
      "AssemblyLab BOM v1: Bauteile werden nach Baugruppe, Rolle, Asset/Slot und Position ausgewertet. Preise und Stammdaten bleiben projektgebunden.";
    box.appendChild(hint);

    const rows = this._computeBOMRows();
    const currency = this._getBOMCurrency();
    const groups = this._groupBOMRowsByAssemblyV1(rows);

    // Actions
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";
    actions.style.flexWrap = "wrap";

    actions.appendChild(
      this._btn("↻ Refresh", () => {
        this._renderRightPanel();
        this._setStatus("BOM aktualisiert");
      })
    );

    actions.appendChild(
      this._btn("Export CSV", async () => {
        try {
          const csv = this._makeBOMCSV(rows, currency);
          await this._copyToClipboard(csv);
          this._setStatus("✅ BOM CSV in Clipboard");
        } catch {
          this._setStatus("⚠️ CSV Export fehlgeschlagen (Clipboard?)");
        }
      })
    );

    actions.appendChild(
      this._btn("Export BOM JSON", async () => {
        try {
          const payload = this._makeBOMExportPayload(rows, currency);
          const txt = JSON.stringify(payload, null, 2);
          await this._copyToClipboard(txt);
          this._setStatus("✅ BOM JSON in Clipboard");
        } catch {
          this._setStatus("⚠️ Export fehlgeschlagen (Clipboard?)");
        }
      })
    );

    box.appendChild(actions);

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.style.opacity = ".72";
      empty.style.fontSize = "13px";
      empty.textContent = "Noch keine Stücklistenpositionen. Füge Baugruppen oder Projekt-Assets in die Workarea ein.";
      box.appendChild(empty);
      return box;
    }

    // Kurze Übersicht je Baugruppe/Quelle.
    const summary = document.createElement("div");
    summary.style.display = "flex";
    summary.style.flexDirection = "column";
    summary.style.gap = "6px";

    const summaryTitle = document.createElement("div");
    summaryTitle.style.fontWeight = "700";
    summaryTitle.style.fontSize = "13px";
    summaryTitle.textContent = "Baugruppen-Übersicht";
    summary.appendChild(summaryTitle);

    for (const g of groups) {
      const card = document.createElement("div");
      card.style.border = "1px solid rgba(255,255,255,.10)";
      card.style.background = "rgba(0,0,0,.10)";
      card.style.borderRadius = "10px";
      card.style.padding = "8px";

      const head = document.createElement("div");
      head.style.display = "flex";
      head.style.justifyContent = "space-between";
      head.style.gap = "8px";
      head.style.alignItems = "baseline";

      const name = document.createElement("div");
      name.style.fontWeight = "700";
      name.style.fontSize = "13px";
      name.textContent = g.name || "BOM";
      head.appendChild(name);

      const count = document.createElement("div");
      count.style.fontSize = "12px";
      count.style.opacity = ".74";
      count.textContent = `${g.itemCount} Positionen · ${g.qty} Stk`;
      head.appendChild(count);
      card.appendChild(head);

      const meta = document.createElement("div");
      meta.style.fontSize = "12px";
      meta.style.opacity = ".70";
      meta.style.marginTop = "3px";
      meta.textContent = [g.conveyorGroup, g.location, g.equipmentTag].filter(Boolean).join(" · ") || "ohne Fördergruppe/Ort/BMK";
      card.appendChild(meta);

      const roles = document.createElement("div");
      roles.style.fontSize = "12px";
      roles.style.opacity = ".82";
      roles.style.marginTop = "4px";
      roles.textContent = g.roles.join(" · ") || "keine Rollen";
      card.appendChild(roles);

      summary.appendChild(card);
    }
    box.appendChild(summary);

    const listTitle = document.createElement("div");
    listTitle.style.fontWeight = "700";
    listTitle.style.fontSize = "13px";
    listTitle.textContent = "Positionen";
    box.appendChild(listTitle);

    // Mobile-freundliche Karten statt breiter Tabelle.
    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";

    let grand = 0;

    const mkInput = (placeholder, value, width = "120px") => {
      const i = document.createElement("input");
      i.type = "text";
      i.value = String(value || "");
      i.placeholder = placeholder;
      i.style.padding = "6px 8px";
      i.style.borderRadius = "10px";
      i.style.border = "1px solid rgba(255,255,255,.14)";
      i.style.background = "rgba(0,0,0,.20)";
      i.style.color = "inherit";
      i.style.fontSize = "12px";
      i.style.minWidth = width;
      return i;
    };

    for (const row of rows) {
      const unitPrice = this._getBOMUnitPrice(row.key);
      const sku = this._getBOMSKU(row.key);
      const uom = this._getBOMUOM(row.key) || row.uom || "Stk";
      const manufacturer = this._getBOMManufacturer(row.key);
      const supplier = this._getBOMSupplier(row.key);
      const comment = this._getBOMComment(row.key);
      const qty = Number(row.qty || 0) || 0;
      const sum = (unitPrice || 0) * qty;
      grand += sum;

      const card = document.createElement("div");
      card.style.border = "1px solid rgba(255,255,255,.10)";
      card.style.background = "rgba(0,0,0,.08)";
      card.style.borderRadius = "12px";
      card.style.padding = "9px";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "7px";

      const top = document.createElement("div");
      top.style.display = "grid";
      top.style.gridTemplateColumns = "minmax(0, 1fr) auto";
      top.style.gap = "8px";
      top.style.alignItems = "start";

      const labelWrap = document.createElement("div");
      labelWrap.style.minWidth = "0";

      const label = document.createElement("div");
      label.style.fontWeight = "700";
      label.style.fontSize = "13px";
      label.style.overflow = "hidden";
      label.style.textOverflow = "ellipsis";
      label.style.whiteSpace = "nowrap";
      label.title = row.label || row.key;
      label.textContent = row.label || row.key;
      labelWrap.appendChild(label);

      const meta = document.createElement("div");
      meta.style.fontSize = "12px";
      meta.style.opacity = ".68";
      meta.textContent = [row.assemblyName, row.roleLabel || row.category, row.projectAssetId ? "Projekt-Asset" : row.kind].filter(Boolean).join(" · ");
      labelWrap.appendChild(meta);
      top.appendChild(labelWrap);

      const qtyBadge = document.createElement("div");
      qtyBadge.style.fontSize = "12px";
      qtyBadge.style.fontWeight = "700";
      qtyBadge.style.textAlign = "right";
      qtyBadge.textContent = `${qty} ${uom || ""}`.trim();
      top.appendChild(qtyBadge);
      card.appendChild(top);

      const priceRow = document.createElement("div");
      priceRow.style.display = "flex";
      priceRow.style.justifyContent = "space-between";
      priceRow.style.gap = "8px";
      priceRow.style.fontSize = "12px";
      priceRow.style.opacity = ".82";
      const left = document.createElement("div");
      left.textContent = row.conveyorGroup || row.location || row.equipmentTag ? [row.conveyorGroup, row.location, row.equipmentTag].filter(Boolean).join(" · ") : "";
      const right = document.createElement("div");
      right.style.fontWeight = "700";
      right.textContent = sum ? `${sum.toFixed(2)} ${currency}` : "";
      priceRow.appendChild(left);
      priceRow.appendChild(right);
      card.appendChild(priceRow);

      const fields = document.createElement("div");
      fields.style.display = "flex";
      fields.style.flexWrap = "wrap";
      fields.style.gap = "6px";

      const skuIn = mkInput("Artikel-Nr.", sku, "95px");
      skuIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "sku", String(skuIn.value || "").trim(), "bom:sku");
        this._renderRightPanel();
      });
      fields.appendChild(skuIn);

      const priceIn = mkInput("Preis", unitPrice ? String(unitPrice) : "", "82px");
      priceIn.type = "number";
      priceIn.step = "0.01";
      priceIn.inputMode = "decimal";
      priceIn.addEventListener("change", () => {
        const v = Number(priceIn.value || 0);
        const p = Number.isFinite(v) && v > 0 ? v : 0;
        this._setBOMLineField(row.key, "unitPrice", p, "bom:price");
        this._renderRightPanel();
      });
      fields.appendChild(priceIn);

      const uomSel = document.createElement("select");
      uomSel.style.padding = "6px 8px";
      uomSel.style.borderRadius = "10px";
      uomSel.style.border = "1px solid rgba(255,255,255,.14)";
      uomSel.style.background = "rgba(0,0,0,.20)";
      uomSel.style.color = "inherit";
      uomSel.style.fontSize = "12px";
      const uomOptions = ["", "Stk", "m", "kg", "Satz"];
      for (const opt of uomOptions) {
        const oel = document.createElement("option");
        oel.value = opt;
        oel.textContent = opt ? `UOM: ${opt}` : "UOM: —";
        uomSel.appendChild(oel);
      }
      uomSel.value = String(uom || "");
      uomSel.addEventListener("change", () => {
        this._setBOMLineField(row.key, "uom", String(uomSel.value || "").trim(), "bom:uom");
        this._renderRightPanel();
      });
      fields.appendChild(uomSel);

      const manIn = mkInput("Hersteller", manufacturer, "130px");
      manIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "manufacturer", String(manIn.value || "").trim(), "bom:manufacturer");
        this._renderRightPanel();
      });
      fields.appendChild(manIn);

      const supIn = mkInput("Lieferant", supplier, "130px");
      supIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "supplier", String(supIn.value || "").trim(), "bom:supplier");
        this._renderRightPanel();
      });
      fields.appendChild(supIn);

      const comIn = mkInput("Kommentar", comment, "180px");
      comIn.style.flex = "1 1 180px";
      comIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "comment", String(comIn.value || "").trim(), "bom:comment");
        this._renderRightPanel();
      });
      fields.appendChild(comIn);

      card.appendChild(fields);
      list.appendChild(card);
    }

    box.appendChild(list);

    // Footer: total + currency
    const footer = document.createElement("div");
    footer.style.marginTop = "6px";
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";
    footer.style.alignItems = "center";
    footer.style.gap = "10px";
    footer.style.flexWrap = "wrap";

    const total = document.createElement("div");
    total.style.fontWeight = "800";
    total.textContent = `Gesamt: ${grand ? grand.toFixed(2) : "—"} ${currency}`;
    footer.appendChild(total);

    const currencyWrap = document.createElement("div");
    currencyWrap.style.display = "flex";
    currencyWrap.style.gap = "6px";
    currencyWrap.style.alignItems = "center";

    const curLbl = document.createElement("div");
    curLbl.style.fontSize = "12px";
    curLbl.style.opacity = ".75";
    curLbl.textContent = "Währung:";
    currencyWrap.appendChild(curLbl);

    const curIn = document.createElement("input");
    curIn.type = "text";
    curIn.value = String(currency || "EUR");
    curIn.style.width = "70px";
    curIn.style.padding = "6px 8px";
    curIn.style.borderRadius = "10px";
    curIn.style.border = "1px solid rgba(255,255,255,.14)";
    curIn.style.background = "rgba(0,0,0,.20)";
    curIn.style.color = "inherit";
    curIn.style.fontSize = "13px";

    curIn.addEventListener("change", () => {
      const v = String(curIn.value || "EUR").trim().toUpperCase();
      this._setBOMCurrency(v || "EUR", "bom:currency");
      this._renderRightPanel();
    });

    currencyWrap.appendChild(curIn);
    footer.appendChild(currencyWrap);
    box.appendChild(footer);

    const note = document.createElement("div");
    note.style.fontSize = "12px";
    note.style.opacity = ".70";
    note.style.marginTop = "4px";
    note.textContent =
      "Hinweis: BOM v1 nutzt Baugruppen-Bauteile und Rollen. Nächster Schritt: Ports/Anschlusspunkte und Kabelpunkte.";
    box.appendChild(note);

    return box;
  }

  _groupBOMRowsByAssemblyV1(rows = []) {
    const byKey = new Map();
    const add = (row) => {
      const k = row.assemblyId ? `asm:${row.assemblyId}` : `kind:${row.kind || row.type || "other"}`;
      const cur = byKey.get(k) || {
        key: k,
        name: row.assemblyName || (row.assemblyId ? row.assemblyId : "Sonstige Positionen"),
        conveyorGroup: row.conveyorGroup || "",
        location: row.location || "",
        equipmentTag: row.equipmentTag || "",
        itemCount: 0,
        qty: 0,
        rolesSet: new Set()
      };
      cur.itemCount += 1;
      cur.qty += Number(row.qty || 0) || 0;
      if (row.roleLabel || row.category) cur.rolesSet.add(String(row.roleLabel || row.category));
      cur.conveyorGroup = cur.conveyorGroup || row.conveyorGroup || "";
      cur.location = cur.location || row.location || "";
      cur.equipmentTag = cur.equipmentTag || row.equipmentTag || "";
      byKey.set(k, cur);
    };
    for (const row of rows || []) add(row || {});
    return Array.from(byKey.values()).map((g) => ({ ...g, roles: Array.from(g.rolesSet || []) }));
  }

  _computeBOMRows() {
    const scene = this._getSceneObjectsFromStore() || [];
    const assets = this._getProjectAssetsFromStore() || [];
    const paById = new Map(assets.map((a) => [String(a.id), a]));

    const byKey = new Map();
    const clean = (s) => String(s || "").trim();
    const safeKey = (s) => clean(s).replace(/\s+/g, "_") || "na";

    const getSlotName = (pa, slotId) => {
      if (!pa || !Array.isArray(pa.slots) || !slotId) return "";
      const s = pa.slots.find((x) => String(x?.id) === String(slotId));
      return clean(s?.name);
    };

    const makeAssetLabel = (projectAssetId, slotId, fallback = "Bauteil") => {
      const paId = clean(projectAssetId);
      const pa = paId ? paById.get(paId) : null;
      const paName = clean(pa?.name) || clean(fallback) || "Asset";
      const slotName = getSlotName(pa, slotId);
      return slotName ? `${paName} · ${slotName}` : paName;
    };

    const add = (row, qtyOverride = null) => {
      const key = clean(row.key);
      if (!key) return;
      const qty = Number(qtyOverride ?? row.qty ?? 1);
      const qtySafe = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const cur = byKey.get(key) || { ...row, qty: 0 };
      cur.qty += qtySafe;
      cur.kind = cur.kind || row.kind || "bom";
      cur.type = cur.type || row.type || cur.kind;
      cur.projectAssetId = cur.projectAssetId || row.projectAssetId || null;
      cur.slotId = cur.slotId || row.slotId || null;
      cur.importName = cur.importName || row.importName || null;
      cur.label = cur.label || row.label || key;
      cur.uom = cur.uom || row.uom || "Stk";
      cur.role = cur.role || row.role || "";
      cur.roleLabel = cur.roleLabel || row.roleLabel || "";
      cur.category = cur.category || row.category || cur.roleLabel || "";
      cur.assemblyId = cur.assemblyId || row.assemblyId || null;
      cur.assemblyName = cur.assemblyName || row.assemblyName || "";
      cur.templateId = cur.templateId || row.templateId || null;
      cur.variantId = cur.variantId || row.variantId || null;
      cur.conveyorGroup = cur.conveyorGroup || row.conveyorGroup || "";
      cur.location = cur.location || row.location || "";
      cur.equipmentTag = cur.equipmentTag || row.equipmentTag || "";
      byKey.set(key, cur);
    };

    const assemblyMeta = (o) => {
      const cfg = o?.config && typeof o.config === "object" ? o.config : {};
      return {
        assemblyId: o?.id || null,
        assemblyName: clean(o?.name) || clean(cfg?.name) || clean(o?.visual?.label) || "Baugruppe",
        templateId: clean(o?.templateId) || clean(o?.assemblyLab?.templateId) || null,
        variantId: clean(o?.variantId) || clean(o?.assemblyLab?.variantId) || null,
        conveyorGroup: clean(cfg?.conveyorGroup) || clean(o?.conveyorGroup),
        location: clean(cfg?.location) || clean(cfg?.area) || clean(o?.location),
        equipmentTag: clean(cfg?.equipmentTag) || clean(o?.equipmentTag)
      };
    };

    for (const o of scene) {
      if (!o) continue;

      if (o.type === "assembly.instance") {
        const meta = assemblyMeta(o);
        const components = Array.isArray(o.components) ? o.components : [];

        if (components.length) {
          for (const c of components) {
            if (!c || c.visible === false) continue;
            const role = clean(c.role) || "component";
            const roleLabel = clean(c.roleLabel) || this._getAssemblyRoleLabelV1?.(role, "short") || role;
            const paId = clean(c.projectAssetId);
            const slotId = clean(c.slotId);
            const assetLabel = makeAssetLabel(paId, slotId, c.name || roleLabel);
            const label = `${roleLabel}: ${clean(c.name) || assetLabel}`;
            const key = `asm:${safeKey(meta.assemblyId)}:role:${safeKey(role)}:${paId ? `pa:${safeKey(paId)}:${safeKey(slotId)}` : `name:${safeKey(c.name || roleLabel)}`}`;
            add({
              key,
              kind: "assembly.component",
              type: "assembly.component",
              label,
              uom: "Stk",
              role,
              roleLabel,
              category: roleLabel,
              projectAssetId: paId || null,
              slotId: slotId || null,
              importName: clean(c.importName) || null,
              ...meta
            }, 1);
          }
          continue;
        }

        // Fallback für ältere Baugruppen, die nur bom[] und keine components[] besitzen.
        if (Array.isArray(o.bom) && o.bom.length) {
          for (const line of o.bom) {
            const role = clean(line?.role) || clean(line?.category) || "component";
            const roleLabel = clean(line?.roleLabel) || clean(line?.category) || this._getAssemblyRoleLabelV1?.(role, "short") || role;
            const code = clean(line?.code) || clean(line?.id) || clean(line?.label) || clean(line?.title) || "ASSEMBLY-BOM";
            const qtyLine = Number(line?.qty ?? 1);
            const qtySafe = Number.isFinite(qtyLine) && qtyLine > 0 ? qtyLine : 1;
            const unit = clean(line?.uom) || clean(line?.unit) || "Stk";
            const paId = clean(line?.projectAssetId);
            const slotId = clean(line?.slotId);
            const title = clean(line?.label) || clean(line?.title) || makeAssetLabel(paId, slotId, code);
            const key = `asm:${safeKey(meta.assemblyId)}:bom:${safeKey(role)}:${safeKey(code)}:${paId ? `pa:${safeKey(paId)}:${safeKey(slotId)}` : ""}`;
            add({
              key,
              kind: "assembly.bom",
              type: "assembly.bom",
              label: `${roleLabel}: ${title}`,
              uom: unit,
              role,
              roleLabel,
              category: roleLabel,
              projectAssetId: paId || null,
              slotId: slotId || null,
              importName: clean(line?.importName) || null,
              ...meta
            }, qtySafe);
          }
          continue;
        }

        add({
          key: `asm:${safeKey(meta.assemblyId)}:empty`,
          kind: "assembly.instance",
          type: "assembly.instance",
          label: meta.assemblyName,
          uom: "Stk",
          role: "assembly",
          roleLabel: "Baugruppe",
          category: "Baugruppe",
          ...meta
        }, 1);
        continue;
      }

      if (o.type === "asset.instance" && o.projectAssetId) {
        const paId = String(o.projectAssetId);
        const slotId = o.slotId ? String(o.slotId) : "";
        const key = `asset:${paId}:${slotId}`;
        add({
          key,
          kind: "asset.instance",
          type: "asset.instance",
          label: makeAssetLabel(paId, slotId, o?.importName || o?.name || "Asset"),
          uom: "Stk",
          role: "asset",
          roleLabel: "Asset",
          category: "Asset",
          projectAssetId: paId,
          slotId: slotId || null,
          importName: clean(o?.importName) || null,
        }, 1);
        continue;
      }

      const t = clean(o.type) || "unknown";
      const name = clean(o?.name);
      const importName = clean(o?.importName) || "";
      const labelParts = [t];
      if (name) labelParts.push(name);
      if (importName) labelParts.push(importName);
      add({
        key: `type:${t}`,
        kind: t,
        type: t,
        label: labelParts.join(" | "),
        uom: "Stk",
        role: t,
        roleLabel: t,
        category: t,
        projectAssetId: null,
        slotId: null,
        importName: importName || null,
      }, 1);
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const ga = String(a.assemblyName || "ZZZ");
      const gb = String(b.assemblyName || "ZZZ");
      if (ga !== gb) return ga.localeCompare(gb);
      const ra = String(a.roleLabel || a.category || "");
      const rb = String(b.roleLabel || b.category || "");
      if (ra !== rb) return ra.localeCompare(rb);
      return String(a.label || "").localeCompare(String(b.label || ""));
    });
  }

  _getBOMCurrency() {
    try {
      const app = this.store?.get?.("app") || {};
      const cur = app?.project?.assets?.settings?.bom?.currency;
      return String(cur || "EUR").trim() || "EUR";
    } catch {
      return "EUR";
    }
  }

  _setBOMCurrency(currency = "EUR", reason = "bom") {
    if (!this.store?.update) return;
    const cur = String(currency || "EUR").trim().toUpperCase() || "EUR";


    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      next.project.assets = next.project.assets && typeof next.project.assets === "object" ? next.project.assets : {};
      next.project.assets.settings = next.project.assets.settings && typeof next.project.assets.settings === "object" ? next.project.assets.settings : {};
      next.project.assets.settings.bom = next.project.assets.settings.bom && typeof next.project.assets.settings.bom === "object" ? next.project.assets.settings.bom : {};
      next.project.assets.settings.bom.currency = cur;
      return next;
    });

    try {
      this.store.update("project", (p) => {
        const proj = p && typeof p === "object" ? p : {};
        proj.assets = proj.assets && typeof proj.assets === "object" ? proj.assets : {};
        proj.assets.settings = proj.assets.settings && typeof proj.assets.settings === "object" ? proj.assets.settings : {};
        proj.assets.settings.bom = proj.assets.settings.bom && typeof proj.assets.settings.bom === "object" ? proj.assets.settings.bom : {};
        proj.assets.settings.bom.currency = cur;
        return proj;
      });
    } catch {}

    this._requestProjectSaveDebounced(`bom:currency:${reason}`);
  }

  _getBOMLineMap() {
    /**
     * BOM v2:
     * - bom.lines: { [key]: { unitPrice, sku, uom, note } }
     * Backward-Compat:
     * - bom.prices: { [key]: number }
     */
    try {
      const app = this.store?.get?.("app") || {};
      const bom = app?.project?.assets?.settings?.bom || {};
      const lines = bom?.lines && typeof bom.lines === "object" ? bom.lines : null;
      if (lines) return lines;

      const prices = bom?.prices && typeof bom.prices === "object" ? bom.prices : {};
      const map = {};
      for (const [k, v] of Object.entries(prices)) {
        const n = Number(v);
        map[String(k)] = { unitPrice: Number.isFinite(n) ? n : 0 };
      }
      return map;
    } catch {
      return {};
    }
  }

  _getBOMUnitPrice(key) {
    const k = String(key || "").trim();
    if (!k) return 0;
    const map = this._getBOMLineMap();
    const line = map?.[k];
    const n = Number(line?.unitPrice || 0);
    return Number.isFinite(n) ? n : 0;
  }

  _getBOMSKU(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.sku || "").trim();
  }

  _getBOMUOM(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.uom || "").trim();
  }

  _getBOMManufacturer(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.manufacturer || "").trim();
  }

  _getBOMSupplier(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.supplier || "").trim();
  }

  _getBOMComment(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.comment || map?.[k]?.note || "").trim();
  }

  _setBOMLineField(key, field, value, reason = "bom") {
    if (!this.store?.update) return;
    const k = String(key || "").trim();
    if (!k) return;

    const f = String(field || "").trim();

    // Normalisierung
    let v = value;
    if (f === "unitPrice") {
      const n = Number(v);
      v = Number.isFinite(n) && n > 0 ? n : 0;
    } else {
      v = String(v ?? "").trim();
      if (!v) v = "";
    }

    const apply = (obj) => {
      const next = obj && typeof obj === "object" ? obj : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      next.project.assets = next.project.assets && typeof next.project.assets === "object" ? next.project.assets : {};
      next.project.assets.settings = next.project.assets.settings && typeof next.project.assets.settings === "object" ? next.project.assets.settings : {};
      next.project.assets.settings.bom = next.project.assets.settings.bom && typeof next.project.assets.settings.bom === "object" ? next.project.assets.settings.bom : {};
      const bom = next.project.assets.settings.bom;

      bom.lines = bom.lines && typeof bom.lines === "object" ? bom.lines : {};
      bom.lines[k] = bom.lines[k] && typeof bom.lines[k] === "object" ? bom.lines[k] : {};

      if (f === "unitPrice") {
        if (v > 0) bom.lines[k].unitPrice = v;
        else delete bom.lines[k].unitPrice;

        // Backward-Compat: bom.prices spiegeln
        bom.prices = bom.prices && typeof bom.prices === "object" ? bom.prices : {};
        if (v > 0) bom.prices[k] = v;
        else delete bom.prices[k];
      } else {
        if (v) bom.lines[k][f] = v;
        else delete bom.lines[k][f];
      }

      // Cleanup: wenn line leer -> entfernen
      const line = bom.lines[k];
      if (line && typeof line === "object" && Object.keys(line).length === 0) {
        delete bom.lines[k];
      }

      return next;
    };

    // app + project parallel halten
    this.store.update("app", (app) => apply(app));
    try {
      this.store.update("project", (p0) => {
        const proj = p0 && typeof p0 === "object" ? p0 : {};
        proj.assets = proj.assets && typeof proj.assets === "object" ? proj.assets : {};
        proj.assets.settings = proj.assets.settings && typeof proj.assets.settings === "object" ? proj.assets.settings : {};
        proj.assets.settings.bom = proj.assets.settings.bom && typeof proj.assets.settings.bom === "object" ? proj.assets.settings.bom : {};
        const bom = proj.assets.settings.bom;

        bom.lines = bom.lines && typeof bom.lines === "object" ? bom.lines : {};
        bom.lines[k] = bom.lines[k] && typeof bom.lines[k] === "object" ? bom.lines[k] : {};
        if (f === "unitPrice") {
          if (v > 0) bom.lines[k].unitPrice = v;
          else delete bom.lines[k].unitPrice;

          bom.prices = bom.prices && typeof bom.prices === "object" ? bom.prices : {};
          if (v > 0) bom.prices[k] = v;
          else delete bom.prices[k];
        } else {
          if (v) bom.lines[k][f] = v;
          else delete bom.lines[k][f];
        }
        const line = bom.lines[k];
        if (line && typeof line === "object" && Object.keys(line).length === 0) {
          delete bom.lines[k];
        }

        return proj;
      });
    } catch {}

    this._requestProjectSaveDebounced(`bom:${f}:${reason}`);
  }

  _setBOMPrice(key, price, reason = "bom") {
    // Backward-Compat: bestehender Code nutzt _setBOMPrice(...)
    const v = Number(price);
    const p = Number.isFinite(v) && v > 0 ? v : 0;
    this._setBOMLineField(key, "unitPrice", p, reason);
  }

  _makeBOMExportPayload(rows, currency) {
    const cur = String(currency || "EUR").trim().toUpperCase() || "EUR";

    const items = [];
    for (const r of rows || []) {
      const key = String(r.key || "");
      const qty = Number(r.qty || 0) || 0;
      const unitPrice = this._getBOMUnitPrice(key);
      const sku = this._getBOMSKU(key);
      const uom = this._getBOMUOM(key) || r.uom || "";
      const manufacturer = this._getBOMManufacturer(key);
      const supplier = this._getBOMSupplier(key);
      const comment = this._getBOMComment(key);

      items.push({
        key,
        label: r.label || key,
        qty,
        sku: sku || "",
        uom: uom || "",
        manufacturer: manufacturer || "",
        supplier: supplier || "",
        comment: comment || "",
        unitPrice: unitPrice || 0,
        currency: cur,
        total: (unitPrice || 0) * qty,
        kind: r.kind || "",
        type: r.type || "",
        role: r.role || "",
        roleLabel: r.roleLabel || "",
        category: r.category || "",
        assemblyId: r.assemblyId || null,
        assemblyName: r.assemblyName || "",
        templateId: r.templateId || null,
        variantId: r.variantId || null,
        conveyorGroup: r.conveyorGroup || "",
        location: r.location || "",
        equipmentTag: r.equipmentTag || "",
        projectAssetId: r.projectAssetId || null,
        slotId: r.slotId || null,
        importName: r.importName || null,
      });
    }

    const total = items.reduce((a, b) => a + (Number(b.total) || 0), 0);

    return {
      schema: "baustellenplaner.bom.assemblylab.v1",
      createdAt: new Date().toISOString(),
      currency: cur,
      total,
      groups: this._groupBOMRowsByAssemblyV1(rows).map((g) => ({
        key: g.key,
        name: g.name,
        conveyorGroup: g.conveyorGroup || "",
        location: g.location || "",
        equipmentTag: g.equipmentTag || "",
        itemCount: g.itemCount || 0,
        qty: g.qty || 0,
        roles: g.roles || []
      })),
      items,
    };
  }

  _makeBOMCSV(rows, currency) {
    const cur = String(currency || "EUR").trim().toUpperCase() || "EUR";

    const esc = (v) => {
      const s = String(v ?? "");
      if (/[";\n\r]/.test(s)) return '"' + s.replaceAll('"', '""') + '"';
      return s;
    };

    const header = [
      "assemblyName",
      "conveyorGroup",
      "location",
      "equipmentTag",
      "roleLabel",
      "label",
      "qty",
      "uom",
      "sku",
      "manufacturer",
      "supplier",
      "comment",
      "unitPrice",
      "currency",
      "total",
      "kind",
      "type",
      "assemblyId",
      "templateId",
      "variantId",
      "projectAssetId",
      "slotId",
      "importName",
      "key",
    ];

    const lines = [header.map(esc).join(";")];

    for (const r of rows || []) {
      const key = String(r.key || "");
      const qty = Number(r.qty || 0) || 0;
      const unitPrice = this._getBOMUnitPrice(key);
      const total = (unitPrice || 0) * qty;

      const row = [
        r.assemblyName || "",
        r.conveyorGroup || "",
        r.location || "",
        r.equipmentTag || "",
        r.roleLabel || r.category || "",
        r.label || key,
        qty,
        this._getBOMUOM(key) || r.uom || "",
        this._getBOMSKU(key) || "",
        this._getBOMManufacturer(key) || "",
        this._getBOMSupplier(key) || "",
        this._getBOMComment(key) || "",
        unitPrice || "",
        cur,
        total || "",
        r.kind || "",
        r.type || "",
        r.assemblyId || "",
        r.templateId || "",
        r.variantId || "",
        r.projectAssetId || "",
        r.slotId || "",
        r.importName || "",
        key,
      ];

      lines.push(row.map(esc).join(";"));
    }

    return lines.join("\n");
  }

  _renderBOMPanel() {
    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    box.appendChild(this._makePanelCardV1("BOM / Stückliste", "Die Stückliste wird nicht mehr permanent im Dock berechnet. Öffne sie nur bei Bedarf."));
    box.appendChild(this._btn("BOM-Fenster öffnen", () => this._openWorkareaModalV1("BOM / Stückliste", () => this._renderBOMPanelFull(), { wide: true })));
    return box;
  }
}

export function installWorkareaBomModule(WorkareaPanelClass) {
  const descriptors = Object.getOwnPropertyDescriptors(WorkareaBomModule.prototype);
  delete descriptors.constructor;
  Object.defineProperties(WorkareaPanelClass.prototype, descriptors);
}
