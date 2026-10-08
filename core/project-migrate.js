/**
 * core/project-migrate.js
 * Version: v1.0.0-projectAssets-canonical-migration (2026-02-25)
 *
 * Zweck:
 * - Verhindert projectAssets-Drift:
 *   project.projectAssets != app.project.projectAssets != app.settings.projectAssets
 * - Drift ist fatal für Restore/Persist (IDB Keys hängen an projectAssetId + slotId).
 *
 * Regel:
 * - Es gibt GENAU EINE Wahrheit: project.projectAssets
 * - app.project.projectAssets und app.settings.projectAssets werden darauf gespiegelt.
 *
 * Heuristik:
 * - Wenn mehrere Kandidatenlisten existieren, wählen wir die „reichste“ Liste
 *   (mehr Slots, mehr hasModel/lastImportName/updatedAt).
 *
 * Wichtig:
 * - Wir erzeugen KEINE neuen IDs (kein „neu generieren“), sondern übernehmen
 *   eine bestehende Kandidatenliste 1:1, um Restore Keys stabil zu halten.
 */

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function isObj(x) {
  return !!x && typeof x === "object";
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeStr(v) {
  return typeof v === "string" ? v : "";
}

function scoreProjectAssets(list) {
  const arr = ensureArray(list);
  let score = 0;

  // Basis: Anzahl Assets + Slots
  score += arr.length * 10;
  for (const pa of arr) {
    const slots = ensureArray(pa?.slots);
    score += slots.length * 2;

    for (const s of slots) {
      if (s?.hasModel === true) score += 20;
      if (safeStr(s?.lastImportName).trim()) score += 10;
      if (safeStr(s?.updatedAt).trim()) score += 2;
      if (safeStr(s?.lastAction).toLowerCase().includes("import")) score += 1;
      if (s?.exportRef) score += 5;
      if (s?.model) score += 5;
    }
  }

  return score;
}

function firstSlotId(pa) {
  const slots = ensureArray(pa?.slots);
  return slots[0]?.id || null;
}

function hasAssetId(list, id) {
  return ensureArray(list).some((a) => a && a.id === id);
}

function findAssetByName(list, name) {
  const n = safeStr(name).trim();
  if (!n) return null;
  return ensureArray(list).find((a) => safeStr(a?.name).trim() === n) || null;
}

/* ============================================================================
 * PUBLIC API
 * ========================================================================== */

/**
 * migrateProjectState({ project, app })
 *
 * @param {{project?:any, app?:any}} state
 * @returns {{project:any, app:any, report:{changed:boolean, reason:string, chosenFrom:string}}}
 */
export function migrateProjectState(state) {
  const project = isObj(state?.project) ? state.project : {};
  const app = isObj(state?.app) ? state.app : {};

  const candA = ensureArray(project.projectAssets);
  const candB = ensureArray(app?.project?.projectAssets);
  const candC = ensureArray(app?.settings?.projectAssets);

  const scores = [
    { key: "project.projectAssets", list: candA, score: scoreProjectAssets(candA) },
    { key: "app.project.projectAssets", list: candB, score: scoreProjectAssets(candB) },
    { key: "app.settings.projectAssets", list: candC, score: scoreProjectAssets(candC) },
  ].sort((x, y) => (y.score - x.score));

  // „best“ gewinnt – aber nur, wenn überhaupt irgendwas da ist.
  const best = scores[0];
  const canonical = (best && best.list && best.list.length) ? best.list : candA;

  const driftDetected =
    (candA.length && candB.length && candA[0]?.id !== candB[0]?.id) ||
    (candA.length && candC.length && candA[0]?.id !== candC[0]?.id) ||
    (!candA.length && (candB.length || candC.length));

  // Spiegeln – project ist kanonisch
  project.projectAssets = canonical;
  app.project = isObj(app.project) ? app.project : {};
  app.settings = isObj(app.settings) ? app.settings : {};
  app.project.projectAssets = canonical;
  app.settings.projectAssets = canonical;

  // Kontext-Fix: wenn UI auf eine „alte“ Asset-ID zeigt, die nicht mehr existiert
  try {
    const ctx = app?.ui?.assetlab?.context;
    if (ctx && (ctx.projectAssetId || ctx.slotId)) {
      const wantAssetId = ctx.projectAssetId;
      const wantSlotId = ctx.slotId;

      if (wantAssetId && !hasAssetId(canonical, wantAssetId)) {
        // 1) Versuch: über Asset-Name matchen (falls du ctx.assetName später setzt)
        const prevName = safeStr(ctx.assetName || "");
        const byName = findAssetByName(canonical, prevName);

        // 2) Fallback: wenn genau 1 Asset vorhanden, nimm das.
        const fallback = (canonical.length === 1) ? canonical[0] : null;
        const chosen = byName || fallback;

        if (chosen && chosen.id) {
          ctx.projectAssetId = chosen.id;
          ctx.slotId = firstSlotId(chosen);
        } else {
          // Nichts Sinnvolles gefunden → Kontext leeren (besser als falsch)
          ctx.projectAssetId = null;
          ctx.slotId = null;
        }
      } else if (wantAssetId && wantSlotId) {
        // Slot prüfen
        const asset = ensureArray(canonical).find((a) => a && a.id === wantAssetId) || null;
        const slots = ensureArray(asset?.slots);
        const slotExists = slots.some((s) => s && s.id === wantSlotId);
        if (!slotExists) ctx.slotId = firstSlotId(asset);
      }
    }
  } catch {
    // Context-Fix darf niemals fatal sein.
  }

  return {
    project,
    app,
    report: {
      changed: !!driftDetected,
      reason: driftDetected ? "projectAssets drift normalized" : "no drift detected",
      chosenFrom: best?.key || "project.projectAssets",
    },
  };
}
