export function initScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f2f5);

  const cam = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 500);
  cam.position.set(30, 25, 30);

  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const d = new THREE.DirectionalLight(0xffffff, 0.6);
  d.position.set(20,40,10);
  scene.add(d);

  function loop() {
    requestAnimationFrame(loop);
    renderer.render(scene, cam);
  }
  loop();

  return { scene, camera: cam, renderer };
}