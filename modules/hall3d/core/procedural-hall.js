export function buildHallFromPreset(preset, overrides={}) {
  const g = new THREE.Group();
  const p = { ...preset.params, ...overrides };

  const geo = new THREE.BoxGeometry(p.length, p.eaveH, p.width);
  const mat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.elementId = "hall_main";

  g.add(mesh);
  return g;
}