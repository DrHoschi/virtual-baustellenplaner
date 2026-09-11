/**
 * ui/panels/AssetLibraryPanel.js
 * PROJECT-UI-03C – Global Library Catalog
 *
 * Authoritative global/project-independent library surface.
 * Project-specific selection/references stay in ProjectLibrariesPanel.
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

export class AssetLibraryPanel extends PanelBase {
  getTitle() {
    return "Bibliothekskatalog";
  }

  getDescription() {
    return "Globaler, projektunabhängiger Asset-Katalog.";
  }

  getToolbarConfig() {
    return { showReset: false, showApply: false, note: "Globaler Katalog" };
  }

  buildDraftFromStore() {
    // PROJECT-UI-03C: Der globale Katalog besitzt hier noch keine editierbaren Daten.
    return {};
  }

  renderBody(root) {
    root.appendChild(
      h("div", { className: "bp-card" },
        h("div", { className: "bp-card__title" }, "Globaler Bibliothekskatalog"),
        h("div", { className: "bp-card__desc" },
          "Diese Surface ist die autoritative Heimat für globale Asset-Kataloge. Sie gehört keinem einzelnen Projekt."
        ),
        h("ul", { style: { margin: "10px 0 0", paddingLeft: "18px" } },
          h("li", null, "Standard-Katalog (Read-only)"),
          h("li", null, "Eigene globale Bibliothek"),
          h("li", null, "Import/Export-Packs (später)"),
          h("li", null, "Übernahme in ein Projekt erfolgt später über Projekt-Referenzen bzw. Projekt-Assets")
        ),
        h("div", { style: { opacity: .75, fontSize: "12px", marginTop: "10px" } },
          "PROJECT-UI-03C trennt ausschließlich Ownership und Surface-Verantwortung; keine neue Library-Funktionalität."
        )
      )
    );
  }
}
