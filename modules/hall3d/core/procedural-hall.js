import { getProfileRenderSectionMeters } from "../../../core/library/structural-profiles.v1.js";

const FLOOR_THICKNESS = 0.12;
const WALL_THICKNESS = 0.12;
const ROOF_THICKNESS = 0.12;

function material(color) { return new THREE.MeshStandardMaterial({ color }); }
function tag(mesh, elementId, elementType) { mesh.userData = mesh.userData || {}; mesh.userData.elementId = elementId; mesh.userData.elementType = elementType; mesh.name = elementId; return mesh; }
function setPosition(object, x, y, z) { if (object.position?.set) object.position.set(x, y, z); else Object.assign(object.position || (object.position = {}), { x, y, z }); }
function setRotationAxis(object, axis, value) { if (!object?.rotation || typeof object.rotation !== "object") throw new Error("THREE object rotation is unavailable."); object.rotation[axis] = value; }
function buildBox({ id, type, size, position, rotationX = 0, visible = true, color = 0xb0b0b0 }) { const geometry = new THREE.BoxGeometry(size.x, size.y, size.z); const mesh = tag(new THREE.Mesh(geometry, material(color)), id, type); setPosition(mesh, position.x, position.y, position.z); setRotationAxis(mesh, "x", rotationX); mesh.visible = visible; return mesh; }

function addWall(group, hall, id) {
  const wall = hall?.envelope?.walls?.[id]; if (!wall || wall.construction === "open") return;
  const { length, width, eaveHeight } = hall.dimensions; const common = { id, type: "wall", visible: wall.visible !== false, color: 0xb8bcc2 };
  if (id === "wall:x0" || id === "wall:xMax") group.add(buildBox({ ...common, size: { x: WALL_THICKNESS, y: eaveHeight, z: width }, position: { x: id === "wall:x0" ? 0 : length, y: eaveHeight / 2, z: width / 2 } }));
  else group.add(buildBox({ ...common, size: { x: length, y: eaveHeight, z: WALL_THICKNESS }, position: { x: length / 2, y: eaveHeight / 2, z: id === "wall:z0" ? 0 : width } }));
}

function addRoof(group, hall) {
  const { length, width, eaveHeight } = hall.dimensions; const roofType = hall.roof.type; const peakHeight = roofType === "flat" ? eaveHeight : hall.roof.peakHeight;
  if (roofType === "flat") { group.add(buildBox({ id: "roof:main", type: "roof", size: { x: length, y: ROOF_THICKNESS, z: width }, position: { x: length / 2, y: eaveHeight + ROOF_THICKNESS / 2, z: width / 2 }, color: 0x8f969f })); return; }
  const rise = peakHeight - eaveHeight;
  if (roofType === "mono") { const slopeLength = Math.hypot(width, rise), pitch = Math.atan2(rise, width); group.add(buildBox({ id: "roof:main", type: "roof", size: { x: length, y: ROOF_THICKNESS, z: slopeLength }, position: { x: length / 2, y: eaveHeight + rise / 2, z: width / 2 }, rotationX: -pitch, color: 0x8f969f })); return; }
  const halfWidth = width / 2, slopeLength = Math.hypot(halfWidth, rise), pitch = Math.atan2(rise, halfWidth), roofY = eaveHeight + rise / 2;
  group.add(buildBox({ id: "roof:sideA", type: "roof", size: { x: length, y: ROOF_THICKNESS, z: slopeLength }, position: { x: length / 2, y: roofY, z: width / 4 }, rotationX: -pitch, color: 0x8f969f }));
  group.add(buildBox({ id: "roof:sideB", type: "roof", size: { x: length, y: ROOF_THICKNESS, z: slopeLength }, position: { x: length / 2, y: roofY, z: width * .75 }, rotationX: pitch, color: 0x8f969f }));
}

function mark(mesh, element) { mesh.userData.axisId = element.axisId; mesh.userData.profileRef = element.profileRef; mesh.userData.authority = "app.project.hall"; mesh.userData.projectionOnly = true; return mesh; }
function columnSection(profileRef) { const s = getProfileRenderSectionMeters(profileRef); if (!s) throw new Error(`Unknown structural profile ${profileRef}`); return { x: s.x, z: s.x }; }
function beamSection(profileRef) { const s = getProfileRenderSectionMeters(profileRef); if (!s) throw new Error(`Unknown structural profile ${profileRef}`); return { x: s.x, y: s.y }; }
function axisPosition(hall, element) { const axis = (hall?.grid?.longitudinal?.axes || []).find((candidate) => candidate?.id === element?.axisId); const position = Number(axis?.position); if (!axis || !Number.isFinite(position)) throw new Error(`Invalid structural axis reference ${element?.axisId || "(leer)"} for ${element?.id || "structural element"}.`); return position; }

function addColumn(group, hall, element) { const sec = columnSection(element.profileRef); const y = hall.dimensions.eaveHeight; const x = axisPosition(hall, element); group.add(mark(buildBox({ id: element.id, type: "column", size: { x: sec.x, y, z: sec.z }, position: { x, y: y / 2, z: element.z }, color: 0x555b63 }), element)); }
function addPrimary(group, hall, element) {
  const sec = beamSection(element.profileRef), x = axisPosition(hall, element), { width, eaveHeight } = hall.dimensions, roofType = hall.roof.type, peak = roofType === "flat" ? eaveHeight : hall.roof.peakHeight, common = { id: element.id, type: "primary-beam", color: 0x4d535b };
  if (roofType === "flat") { group.add(mark(buildBox({ ...common, size: { x: sec.x, y: sec.y, z: width }, position: { x, y: eaveHeight, z: width / 2 } }), element)); return; }
  const rise = peak - eaveHeight;
  if (roofType === "mono") { const length = Math.hypot(width, rise), pitch = Math.atan2(rise, width); group.add(mark(buildBox({ ...common, size: { x: sec.x, y: sec.y, z: length }, position: { x, y: eaveHeight + rise / 2, z: width / 2 }, rotationX: -pitch }), element)); return; }
  const half = width / 2, length = Math.hypot(half, rise), pitch = Math.atan2(rise, half), y = eaveHeight + rise / 2;
  group.add(mark(buildBox({ ...common, id: `${element.id}:sideA`, size: { x: sec.x, y: sec.y, z: length }, position: { x, y, z: width / 4 }, rotationX: -pitch }), element));
  group.add(mark(buildBox({ ...common, id: `${element.id}:sideB`, size: { x: sec.x, y: sec.y, z: length }, position: { x, y, z: width * .75 }, rotationX: pitch }), element));
}
function addPrimaryStructure(group, hall) { if (hall?.structure?.columnsEnabled === true) for (const e of hall.structure.columns || []) addColumn(group, hall, e); if (hall?.structure?.primaryBeamsEnabled === true) for (const e of hall.structure.primaryMembers || []) addPrimary(group, hall, e); }
function applyHallTransform(group, hall) { const p = hall?.transform?.position || {}; setPosition(group, Number(p.x) || 0, Number(p.y) || 0, Number(p.z) || 0); setRotationAxis(group, "y", Number(hall?.transform?.rotationY) || 0); }

export function buildHallFromProjectHall(hall, derived = {}) {
  if (!hall?.dimensions || !hall?.roof || !hall?.envelope?.walls) throw new Error("buildHallFromProjectHall requires a normalized project.hall.");
  const group = new THREE.Group(); group.name = hall.id || "hall-main"; group.userData = { ...(group.userData || {}), hallId: hall.id || "hall-main", authority: "app.project.hall", schema: hall.schema, derived: { pitchDeg: Number(derived?.pitchDeg) || 0, ridgeElevation: Number(derived?.ridgeElevation) || hall.dimensions.eaveHeight, axisPositions: Array.isArray(derived?.axisPositions) ? [...derived.axisPositions] : [] } };
  const { length, width } = hall.dimensions; group.add(buildBox({ id: "floor:0", type: "floor", size: { x: length, y: FLOOR_THICKNESS, z: width }, position: { x: length / 2, y: -FLOOR_THICKNESS / 2, z: width / 2 }, color: 0x777b80 }));
  for (const id of ["wall:x0", "wall:xMax", "wall:z0", "wall:zMax"]) addWall(group, hall, id); addRoof(group, hall); addPrimaryStructure(group, hall); applyHallTransform(group, hall); return group;
}
export function buildHallFromPreset(preset, overrides = {}) { const g = new THREE.Group(), p = { ...preset.params, ...overrides }, geo = new THREE.BoxGeometry(p.length, p.eaveH, p.width), mat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0 }), mesh = new THREE.Mesh(geo, mat); mesh.userData.elementId = "hall_main"; g.add(mesh); return g; }
