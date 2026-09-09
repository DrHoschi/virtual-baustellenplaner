const FLOOR_THICKNESS = 0.12;
const WALL_THICKNESS = 0.12;
const ROOF_THICKNESS = 0.12;

function material(color) {
  return new THREE.MeshStandardMaterial({ color });
}

function tag(mesh, elementId, elementType) {
  mesh.userData = mesh.userData || {};
  mesh.userData.elementId = elementId;
  mesh.userData.elementType = elementType;
  mesh.name = elementId;
  return mesh;
}

function setPosition(object, x, y, z) {
  if (object.position?.set) object.position.set(x, y, z);
  else {
    object.position = object.position || {};
    object.position.x = x;
    object.position.y = y;
    object.position.z = z;
  }
}

function buildBox({ id, type, size, position, rotationX = 0, visible = true, color = 0xb0b0b0 }) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mesh = tag(new THREE.Mesh(geometry, material(color)), id, type);
  setPosition(mesh, position.x, position.y, position.z);
  mesh.rotation = mesh.rotation || { x: 0, y: 0, z: 0 };
  mesh.rotation.x = rotationX;
  mesh.visible = visible;
  return mesh;
}

function addWall(group, hall, id) {
  const wall = hall?.envelope?.walls?.[id];
  if (!wall || wall.construction === "open") return;

  const { length, width, eaveHeight } = hall.dimensions;
  const common = {
    id,
    type: "wall",
    visible: wall.visible !== false,
    color: 0xb8bcc2,
  };

  if (id === "wall:x0" || id === "wall:xMax") {
    group.add(buildBox({
      ...common,
      size: { x: WALL_THICKNESS, y: eaveHeight, z: width },
      position: {
        x: id === "wall:x0" ? 0 : length,
        y: eaveHeight / 2,
        z: width / 2,
      },
    }));
    return;
  }

  group.add(buildBox({
    ...common,
    size: { x: length, y: eaveHeight, z: WALL_THICKNESS },
    position: {
      x: length / 2,
      y: eaveHeight / 2,
      z: id === "wall:z0" ? 0 : width,
    },
  }));
}

function addRoof(group, hall) {
  const { length, width, eaveHeight } = hall.dimensions;
  const roofType = hall.roof.type;
  const peakHeight = roofType === "flat" ? eaveHeight : hall.roof.peakHeight;

  if (roofType === "flat") {
    group.add(buildBox({
      id: "roof:main",
      type: "roof",
      size: { x: length, y: ROOF_THICKNESS, z: width },
      position: { x: length / 2, y: eaveHeight + ROOF_THICKNESS / 2, z: width / 2 },
      color: 0x8f969f,
    }));
    return;
  }

  const rise = peakHeight - eaveHeight;

  if (roofType === "mono") {
    const slopeLength = Math.hypot(width, rise);
    const pitch = Math.atan2(rise, width);
    group.add(buildBox({
      id: "roof:main",
      type: "roof",
      size: { x: length, y: ROOF_THICKNESS, z: slopeLength },
      position: { x: length / 2, y: eaveHeight + rise / 2, z: width / 2 },
      rotationX: -pitch,
      color: 0x8f969f,
    }));
    return;
  }

  const halfWidth = width / 2;
  const slopeLength = Math.hypot(halfWidth, rise);
  const pitch = Math.atan2(rise, halfWidth);
  const roofY = eaveHeight + rise / 2;

  group.add(buildBox({
    id: "roof:sideA",
    type: "roof",
    size: { x: length, y: ROOF_THICKNESS, z: slopeLength },
    position: { x: length / 2, y: roofY, z: width / 4 },
    rotationX: -pitch,
    color: 0x8f969f,
  }));

  group.add(buildBox({
    id: "roof:sideB",
    type: "roof",
    size: { x: length, y: ROOF_THICKNESS, z: slopeLength },
    position: { x: length / 2, y: roofY, z: width * 0.75 },
    rotationX: pitch,
    color: 0x8f969f,
  }));
}

function applyHallTransform(group, hall) {
  const transform = hall?.transform || {};
  const position = transform.position || {};
  setPosition(group, Number(position.x) || 0, Number(position.y) || 0, Number(position.z) || 0);
  group.rotation = group.rotation || { x: 0, y: 0, z: 0 };
  group.rotation.y = Number(transform.rotationY) || 0;
}

/**
 * BP-HI01B.1 authoritative product generator.
 * Input is the already normalized project.hall plus its derived projection data.
 * This function does not read/write stores and does not persist derived geometry.
 */
export function buildHallFromProjectHall(hall, derived = {}) {
  if (!hall?.dimensions || !hall?.roof || !hall?.envelope?.walls) {
    throw new Error("buildHallFromProjectHall requires a normalized project.hall.");
  }

  const group = new THREE.Group();
  group.name = hall.id || "hall-main";
  group.userData = group.userData || {};
  group.userData.hallId = hall.id || "hall-main";
  group.userData.authority = "app.project.hall";
  group.userData.schema = hall.schema;
  group.userData.derived = {
    pitchDeg: Number(derived?.pitchDeg) || 0,
    ridgeElevation: Number(derived?.ridgeElevation) || hall.dimensions.eaveHeight,
  };

  const { length, width } = hall.dimensions;
  group.add(buildBox({
    id: "floor:0",
    type: "floor",
    size: { x: length, y: FLOOR_THICKNESS, z: width },
    position: { x: length / 2, y: -FLOOR_THICKNESS / 2, z: width / 2 },
    color: 0x777b80,
  }));

  for (const wallId of ["wall:x0", "wall:xMax", "wall:z0", "wall:zMax"]) {
    addWall(group, hall, wallId);
  }

  addRoof(group, hall);
  applyHallTransform(group, hall);
  return group;
}

/**
 * Legacy compatibility path. Not authoritative for new project halls.
 */
export function buildHallFromPreset(preset, overrides = {}) {
  const g = new THREE.Group();
  const p = { ...preset.params, ...overrides };

  const geo = new THREE.BoxGeometry(p.length, p.eaveH, p.width);
  const mat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.elementId = "hall_main";

  g.add(mesh);
  return g;
}
