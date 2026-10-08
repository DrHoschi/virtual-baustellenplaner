/**
 * ui/panels/ProjectLibrariesPanel.js
 * PROJECT-UI-03C – Project Library References
 *
 * Projekt → Bibliotheken owns only project-specific library references.
 * The global catalog is a separate application-level surface.
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { h, clear } from "../components/ui-dom.js";

export class ProjectLibrariesPanel extends PanelBase {
  getTitle() { return "Projekt – Bibliotheken"; }

  getDescription() {
    const app = this.store.get("app") || {};
    return `Projekt-ID: ${app?.project?.id || "?"}`;
  }

  buildDraftFromStore() {
    // PROJECT-UI-03C: Noch keine editierbaren Projekt-Library-Referenzen.
    // Keine globalen Katalogdaten in den Projekt-Store spiegeln.
    return { ok: true };
  }

  applyDraftToStore() {
    // Platzhalter bleibt absichtlich read-only.
  }

  getToolbarConfig() {
    return {
      showApply: false,
      showReset: false,
      note: "Projektbezogene Bibliotheks-Referenzen"
    };
  }

  renderBody(bodyEl) {
    clear(bodyEl);

    const sec = new Section({
      title: "Bibliotheken dieses Projekts",
      description: "Hier werden künftig ausschließlich die globalen Bibliotheken referenziert, die dieses Projekt verwendet. Der globale Katalog selbst gehört nicht zum Projekt."
    });

    const openCatalogButton = h(
      "button",
      {
        type: "button",
        className: "bp-btn",
        onClick: () => {
          document.dispatchEvent(new CustomEvent("bp:navigation:contextual-open", {
            detail: { target: "library:catalog" }
          }));
          this.bus?.emit?.("ui:menu:select", { moduleKey: "library:catalog" });
        }
      },
      "Globalen Bibliothekskatalog öffnen"
    );

    sec.append(
      h("div", { style: { fontSize: "13px", opacity: ".8" } },
        "Status: Noch keine Library-Referenzen für dieses Projekt konfigurierbar.",
        h("ul", {},
          h("li", {}, "Projekt speichert künftig nur Referenzen/Auswahl globaler Bibliotheken."),
          h("li", {}, "Globale Kataloginhalte bleiben projektunabhängig."),
          h("li", {}, "Projekt-Assets bleiben weiterhin separat unter Projekt → Assets.")
        ),
        openCatalogButton
      )
    );

    bodyEl.appendChild(sec.el);
  }
}
