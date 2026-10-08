import { createHall3DView } from "../../modules/hall3d/view.js";

const THREE_MODULE_URL = "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

let threePromise = null;

async function ensureThree() {
  if (globalThis.THREE?.Scene && globalThis.THREE?.WebGLRenderer) return globalThis.THREE;
  if (!threePromise) {
    threePromise = import(THREE_MODULE_URL).then((mod) => {
      globalThis.THREE = mod;
      return mod;
    });
  }
  return await threePromise;
}

export class Hall3DPanel {
  constructor(ctx = {}) {
    this.ctx = ctx;
    this.view = null;
    this.rootEl = ctx.rootEl || null;
  }

  async mount(rootEl = null) {
    this.rootEl = rootEl || this.rootEl || this.ctx.rootEl;
    if (!this.rootEl) return;

    this.rootEl.dataset.bpHall3dPanel = "loading";

    try {
      await ensureThree();
      this.view = createHall3DView({ ...this.ctx, rootEl: this.rootEl });
      await this.view.mount();
      this.rootEl.dataset.bpHall3dPanel = "ready";
    } catch (error) {
      console.error("[BP-HI01B.3R] Hall3D panel mount failed", error);
      this.rootEl.innerHTML = "";
      const note = document.createElement("div");
      note.style.padding = "16px";
      note.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      note.textContent = `3D Halle konnte nicht geladen werden: ${error?.message || String(error)}`;
      this.rootEl.appendChild(note);
      this.rootEl.dataset.bpHall3dPanel = "error";
    }
  }

  async unmount() {
    try { this.view?.unmount?.(); } finally {
      this.view = null;
      if (this.rootEl) {
        try { delete this.rootEl.dataset.bpHall3dPanel; } catch (_) { /* ignore */ }
      }
    }
  }
}
