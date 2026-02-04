let markerGroup;

export function rebuildProfiMarkers(scene, project, elementMeshes) {
  if (!markerGroup) {
    markerGroup = new THREE.Group();
    scene.add(markerGroup);
  }
  markerGroup.clear();

  for (const [id, mesh] of elementMeshes.entries()) {
    const spr = makeSprite("1");
    spr.position.copy(mesh.position).add(new THREE.Vector3(0,5,0));
    markerGroup.add(spr);
  }
}

function makeSprite(txt) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle="#fff";
  ctx.beginPath();
  ctx.arc(64,64,50,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle="#000";
  ctx.font="bold 48px sans-serif";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(txt,64,64);
  const tex = new THREE.CanvasTexture(c);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
}
