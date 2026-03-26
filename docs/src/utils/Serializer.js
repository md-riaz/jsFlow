/**
 * @module Serializer
 * JSON import/export helpers for the full graph state.
 */

/**
 * @typedef {import('../models/Node.js').NodeModel} NodeModel
 * @typedef {import('../models/Edge.js').EdgeModel} EdgeModel
 * @typedef {{ x: number, y: number, zoom: number }} Viewport
 */

/**
 * Export the current graph to a JSON-serialisable object.
 * @param {{ nodes: NodeModel[], edges: EdgeModel[], viewport: Viewport }} state
 * @returns {Object}
 */
export function exportGraph(state) {
  return {
    version: '1.0',
    viewport: { ...state.viewport },
    nodes: state.nodes.map(n => ({ ...n, selected: false })),
    edges: state.edges.map(e => ({ ...e, selected: false })),
  };
}

/**
 * Import a previously exported graph object.
 * Validates and normalises fields before returning.
 * @param {Object} data
 * @returns {{ nodes: NodeModel[], edges: EdgeModel[], viewport: Viewport }}
 */
export function importGraph(data) {
  if (!data || typeof data !== 'object') throw new TypeError('Invalid graph data');

  const viewport = {
    x: Number(data.viewport?.x ?? 0),
    y: Number(data.viewport?.y ?? 0),
    zoom: Number(data.viewport?.zoom ?? 1),
  };

  const nodes = (Array.isArray(data.nodes) ? data.nodes : []).map(n => ({
    id: String(n.id ?? ''),
    type: String(n.type ?? 'default'),
    x: Number(n.x ?? 0),
    y: Number(n.y ?? 0),
    width: Number(n.width ?? 180),
    height: Number(n.height ?? 60),
    data: n.data ?? {},
    ports: Array.isArray(n.ports) ? n.ports : [],
    selected: false,
  }));

  const edges = (Array.isArray(data.edges) ? data.edges : []).map(e => ({
    id: String(e.id ?? ''),
    source: String(e.source ?? ''),
    sourceHandle: String(e.sourceHandle ?? 'bottom'),
    target: String(e.target ?? ''),
    targetHandle: String(e.targetHandle ?? 'top'),
    type: String(e.type ?? 'bezier'),
    label: e.label ?? '',
    animated: Boolean(e.animated ?? false),
    markerEnd: e.markerEnd != null ? String(e.markerEnd) : undefined,
    markerColor: e.markerColor != null ? String(e.markerColor) : undefined,
    data: e.data ?? {},
    selected: false,
  }));

  return { nodes, edges, viewport };
}

/**
 * Serialise graph to a JSON string.
 * @param {{ nodes: NodeModel[], edges: EdgeModel[], viewport: Viewport }} state
 * @param {boolean} [pretty=false]
 * @returns {string}
 */
export function toJSON(state, pretty = false) {
  return JSON.stringify(exportGraph(state), null, pretty ? 2 : 0);
}

/**
 * Parse a JSON string back to graph data.
 * @param {string} json
 * @returns {{ nodes: NodeModel[], edges: EdgeModel[], viewport: Viewport }}
 */
export function fromJSON(json) {
  return importGraph(JSON.parse(json));
}
