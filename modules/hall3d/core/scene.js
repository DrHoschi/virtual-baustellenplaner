/**
 * modules/hall3d/core/scene.js
 * Version: v1.1.0 (2026-02-04)
 *
 * Änderung ggü. Modular-Standalone:
 * - Nimmt nun ein Root-Element entgegen (kein document.body.append mehr)
 * - Gibt mount()/unmount() zurück (damit Blueprint Module sauber umschalten können)
 * - Resizing: beobachtet Root-Größe + window resize
 *
 * Erwartet globales THREE (über index.html Script-Tag).
 */

export function initScene({ rootEl }) {
  if (!rootEl) throw new Error("initScene: rootEl fehlt");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f2f5);

  // Kamera / Renderer
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  cam.position.set(30, 25, 30);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

  // Licht
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(40, 60, 20);
  scene.add(dir);

  // Ground
  const grid = new THREE.GridHelper(120, 60, 0x999999, 0xdddddd);
  grid.position.y = 0;
  scene.add(grid);

  // --- Mount
  let raf = 0;
  let ro = null;

  function _resize() {
    const rect = rootEl.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function _loop() {
    raf = requestAnimationFrame(_loop);
    renderer.render(scene, cam);
  }

  function mount() {
    // Cleanup root, dann Canvas rein
    rootEl.innerHTML = "";
    rootEl.appendChild(renderer.domElement);
    _resize();
    _loop();

    // Resize Observer (besser als nur window resize)
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(_resize);
      ro.observe(rootEl);
    }
    window.addEventListener("resize", _resize);
  }

  function unmount() {
    cancelAnimationFrame(raf);
    raf = 0;

    window.removeEventListener("resize", _resize);
    if (ro) {
      ro.disconnect();
      ro = null;
    }

    // Canvas entfernen (Renderer entsorgen)
    try {
      renderer.dispose();
    } catch (_) {}
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  return { scene, cam, renderer, mount, unmount };
}
