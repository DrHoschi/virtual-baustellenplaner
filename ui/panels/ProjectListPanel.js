/**
 * ui/panels/ProjectListPanel.js
 * Version: v1.0.0 (2026-02-05)
 *
 * Projektliste (localStorage):
 * - Listet alle gespeicherten Projekte (baustellenplaner:projectfile:*)
 * - Öffnen / Löschen / Refresh
 *
 * NOTE:
 * - Dieses Panel ist absichtlich "read-only" in Bezug auf den Store.
 * - Es nutzt PanelBase nur für sauberes Layout (Toolbar + inneres Scrolling).
 */

import { h, clear } from "../components/ui-dom.js";
import { PanelBase } from "./PanelBase.js";

const LS_PREFIX = "baustellenplaner:projectfile:";

function safeParseJson(txt) {
  try { return JSON.parse(txt); } catch { return null; }
}

function formatDate(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

function getAllProjectKeys() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) out.push(k);
    }
  } catch {
    // localStorage kann in manchen Browser-Mode eingeschränkt sein
  }
  out.sort();
  return out;
}

function readProjectMeta(lsKey) {
  const raw = (() => {
    try { return localStorage.getItem(lsKey); } catch { return null; }
  })();
  const obj = raw ? safeParseJson(raw) : null;

  // Minimal-Meta (robust gegen alte Formate)
  const projectId = lsKey.slice(LS_PREFIX.length);
  const p = obj?.project || obj?.data?.project || obj?.meta?.project || obj;

  return {
    lsKey,
    projectId,
    name: p?.name || p?.projectName || p?.title || "(ohne Namen)",
    type: p?.type || p?.projectType || "",
    customer: p?.customer || p?.kunde || "",
    location: p?.location || p?.ort || "",
    updatedAt: p?.updatedAt || p?.savedAt || obj?.savedAt || obj?.updatedAt || null,
    createdAt: p?.createdAt || obj?.createdAt || null
  };
}

export class ProjectListPanel extends PanelBase {
  getTitle() {
    return "Projekt – Liste (localStorage)";
  }

  getDescription() {
    return "Zeigt alle im Browser gespeicherten Projekte an (localStorage).";
  }

  // Toolbar nur als "Aktualisieren" verwenden
  getToolbarConfig() {
    return {
      showReset: true,
      showApply: false,
      resetLabel: "🔄 Aktualisieren",
      note: "Liste wird direkt aus localStorage gelesen (Browser-only)."
    };
  }

  // Kein Draft-State nötig
  buildDraftFromStore() {
    return { _nonce: Date.now() };
  }

  applyDraftToStore(_draft) {
    // no-op
  }

  renderBody(root, _draft) {
    const keys = getAllProjectKeys();
    const header = h("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "12px",
        margin: "6px 0 12px"
      }
    },
    h("div", { style: { fontWeight: "700" } }, `Anzahl: ${keys.length}`),
    h("div", { style: { opacity: ".7", fontSize: "12px" } }, "Quelle: localStorage")
    );

    root.appendChild(header);

    if (!keys.length) {
      root.appendChild(h("div", { className: "panel-note" },
        "Noch keine Projekte gefunden. Lege ein neues Projekt über den Wizard an – dann erscheint es hier automatisch."
      ));

      const row = h("div", { style: { display: "flex", gap: "10px" } });
      const gotoWizard = h("button", {
        type: "button",
        className: "btn-primary",
        onclick: () => {
          try { this.bus?.emit?.("ui:menu:select", { moduleKey: "panel:projectPanel:wizard" }); } catch {}
        }
      }, "Zum Projekt-Wizard");
      row.appendChild(gotoWizard);
      root.appendChild(row);
      return;
    }

    // Liste
    const list = h("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }
    });

    keys.forEach((k) => {
      const meta = readProjectMeta(k);

      const card = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.10)",
          borderRadius: "12px",
          padding: "10px 12px",
          background: "rgba(255,255,255,.85)"
        }
      });

      const titleRow = h("div", {
        style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }
      });

      const title = h("div", { style: { fontWeight: "800" } }, meta.name);
      const id = h("div", { style: { opacity: ".6", fontSize: "12px" } }, meta.projectId);
      titleRow.appendChild(title);
      titleRow.appendChild(id);
      card.appendChild(titleRow);

      const sub = h("div", {
        style: { marginTop: "4px", opacity: ".8", fontSize: "12px", lineHeight: "1.35" }
      },
      [
        meta.type ? `Typ: ${meta.type}` : null,
        meta.customer ? `Kunde: ${meta.customer}` : null,
        meta.location ? `Ort: ${meta.location}` : null,
        meta.updatedAt ? `Zuletzt: ${formatDate(meta.updatedAt)}` : null
      ].filter(Boolean).join(" · ") || "(keine Metadaten)"
      );
      card.appendChild(sub);

      const btnRow = h("div", { style: { display: "flex", gap: "10px", marginTop: "10px" } });

      const openBtn = h("button", {
        type: "button",
        style: {
          padding: "8px 10px",
          borderRadius: "10px",
          border: "1px solid rgba(0,0,0,.12)",
          background: "rgba(80,160,255,.18)",
          fontWeight: "700"
        },
        onclick: () => {
          // Standard: Projekt aus localStorage laden
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("project", `local:${meta.projectId}`);
            window.location.href = url.toString();
          } catch {
            // fallback: reload
            window.location.reload();
          }
        }
      }, "Öffnen");

      const delBtn = h("button", {
        type: "button",
        style: {
          padding: "8px 10px",
          borderRadius: "10px",
          border: "1px solid rgba(0,0,0,.12)",
          background: "rgba(0,0,0,.06)",
          fontWeight: "600"
        },
        onclick: () => {
          const ok = window.confirm(`Projekt wirklich löschen?\n\n${meta.name}\n(${meta.projectId})`);
          if (!ok) return;
          try { localStorage.removeItem(meta.lsKey); } catch {}
          // Refresh
          this.draft = this.buildDraftFromStore();
          this._dirty = false;
          this._savedAt = null;
          this._rerender();
        }
      }, "Löschen");

      btnRow.appendChild(openBtn);
      btnRow.appendChild(delBtn);
      card.appendChild(btnRow);

      list.appendChild(card);
    });

    root.appendChild(list);
  }
}
