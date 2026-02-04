
import { h } from "../components/ui-dom.js";
import { Toolbar } from "../components/Toolbar.js";

export class PanelBase {
  constructor({ store, rootEl }) {
    this.store = store;
    this.rootEl = rootEl;
  }

  async mount() {
    this.rootEl.style.display = "flex";
    this.rootEl.style.flexDirection = "column";
    this.rootEl.style.minHeight = "0";
    this.rootEl.innerHTML = "";

    const title = h("h3", {}, this.getTitle?.() || "Panel");
    const toolbar = Toolbar({});

    const body = h("div");
    const wrap = h("div", {
      className: "panel-content-wrap",
      style: { flex: "1 1 auto", minHeight: "0" }
    });

    wrap.appendChild(body);

    this.rootEl.appendChild(title);
    this.rootEl.appendChild(toolbar);
    this.rootEl.appendChild(wrap);
  }
}
