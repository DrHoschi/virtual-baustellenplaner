/*
 * ============================================================================
 * DATEI: core/assemblies/assembly-connections.js
 * VERSION: v1.0.0-configurable-assemblies
 *
 * ZWECK:
 * - Verwaltet technische Verbindungen zwischen Assembly-Ports.
 * - Vorbereitung für spätere B-Lines / Kabel- und Signal-Linien in der Workarea.
 * ============================================================================
 */

function uniqueId(prefix = "con") {
  const a = Date.now().toString(36);
  const b = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${a}-${b}`;
}

function assertEndpoint(endpoint, name) {
  if (!endpoint || typeof endpoint !== "object") {
    throw new Error(`${name} endpoint missing.`);
  }
  if (!endpoint.instanceId || !endpoint.portId) {
    throw new Error(`${name} endpoint needs instanceId and portId.`);
  }
}

export function createAssemblyConnection({ from, to, kind = "generic", label = "", cableType = "", data = {} }) {
  assertEndpoint(from, "from");
  assertEndpoint(to, "to");

  return {
    id: uniqueId("con"),
    kind,
    label,
    cableType,
    from: {
      instanceId: from.instanceId,
      portId: from.portId
    },
    to: {
      instanceId: to.instanceId,
      portId: to.portId
    },
    data: { ...data },
    createdAt: new Date().toISOString()
  };
}

export function listConnectionsForInstance(connections, instanceId) {
  const list = Array.isArray(connections) ? connections : [];
  return list.filter((c) => c?.from?.instanceId === instanceId || c?.to?.instanceId === instanceId);
}

export function listConnectionsForPort(connections, instanceId, portId) {
  const list = Array.isArray(connections) ? connections : [];
  return list.filter((c) => {
    const a = c?.from?.instanceId === instanceId && c?.from?.portId === portId;
    const b = c?.to?.instanceId === instanceId && c?.to?.portId === portId;
    return a || b;
  });
}
