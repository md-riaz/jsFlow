/**
 * @module StateStore
 * Single source of truth for the entire flow editor state.
 * All mutations happen through explicit methods which emit change events.
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { createNode } from '../models/Node.js';
import { createEdge } from '../models/Edge.js';

/**
 * @typedef {import('../models/Node.js').NodeModel} NodeModel
 * @typedef {import('../models/Edge.js').EdgeModel} EdgeModel
 * @typedef {{ x: number, y: number, zoom: number }} Viewport
 *
 * @typedef {Object} FlowState
 * @property {Map<string, NodeModel>} nodes
 * @property {Map<string, EdgeModel>} edges
 * @property {Set<string>} selectedNodeIds
 * @property {Set<string>} selectedEdgeIds
 * @property {Viewport} viewport
 * @property {{ active: boolean, x: number, y: number, width: number, height: number }} marquee
 * @property {{ active: boolean, sourceNode: string|null, sourceHandle: string|null, x: number, y: number }} connection
 * @property {boolean} readonly
 */

export class StateStore extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, NodeModel>} */
    this.nodes = new Map();
    /** @type {Map<string, EdgeModel>} */
    this.edges = new Map();
    /** @type {Set<string>} */
    this.selectedNodeIds = new Set();
    /** @type {Set<string>} */
    this.selectedEdgeIds = new Set();
    /** @type {Viewport} */
    this.viewport = { x: 0, y: 0, zoom: 1 };
    /** @type {{ active: boolean, x: number, y: number, width: number, height: number }} */
    this.marquee = { active: false, x: 0, y: 0, width: 0, height: 0 };
    /**
     * Live connection-drag state.
     * @type {{ active: boolean, sourceNodeId: string|null, sourceHandle: string|null, x: number, y: number }}
     */
    this.connection = { active: false, sourceNodeId: null, sourceHandle: null, x: 0, y: 0 };
    /** @type {boolean} */
    this.readonly = false;
  }

  // ─── Nodes ────────────────────────────────────────────────────────────────

  /**
   * @param {Partial<NodeModel>} partial
   * @returns {NodeModel}
   */
  addNode(partial) {
    const node = createNode(partial);
    this.nodes.set(node.id, node);
    this.emit('nodeAdded', node);
    this.emit('change');
    return node;
  }

  /**
   * @param {string} id
   * @param {Partial<NodeModel>} changes
   * @returns {NodeModel|undefined}
   */
  updateNode(id, changes) {
    const node = this.nodes.get(id);
    if (!node) return undefined;
    Object.assign(node, changes);
    this.emit('nodeUpdated', node);
    this.emit('change');
    return node;
  }

  /**
   * @param {string} id
   */
  removeNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;
    this.nodes.delete(id);
    this.selectedNodeIds.delete(id);
    // Remove connected edges
    for (const [eid, edge] of this.edges) {
      if (edge.source === id || edge.target === id) {
        this.edges.delete(eid);
        this.selectedEdgeIds.delete(eid);
        this.emit('edgeRemoved', edge);
      }
    }
    this.emit('nodeRemoved', node);
    this.emit('change');
  }

  // ─── Edges ────────────────────────────────────────────────────────────────

  /**
   * @param {Partial<EdgeModel>} partial
   * @returns {EdgeModel}
   */
  addEdge(partial) {
    const edge = createEdge(partial);
    this.edges.set(edge.id, edge);
    this.emit('edgeAdded', edge);
    this.emit('change');
    return edge;
  }

  /**
   * @param {string} id
   * @param {Partial<EdgeModel>} changes
   * @returns {EdgeModel|undefined}
   */
  updateEdge(id, changes) {
    const edge = this.edges.get(id);
    if (!edge) return undefined;
    Object.assign(edge, changes);
    this.emit('edgeUpdated', edge);
    this.emit('change');
    return edge;
  }

  /**
   * @param {string} id
   */
  removeEdge(id) {
    const edge = this.edges.get(id);
    if (!edge) return;
    this.edges.delete(id);
    this.selectedEdgeIds.delete(id);
    this.emit('edgeRemoved', edge);
    this.emit('change');
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  /**
   * @param {string[]} nodeIds
   * @param {string[]} [edgeIds=[]]
   */
  setSelection(nodeIds, edgeIds = []) {
    this.selectedNodeIds = new Set(nodeIds);
    this.selectedEdgeIds = new Set(edgeIds);
    for (const [id, node] of this.nodes) {
      node.selected = this.selectedNodeIds.has(id);
    }
    for (const [id, edge] of this.edges) {
      edge.selected = this.selectedEdgeIds.has(id);
    }
    this.emit('selectionChange', {
      nodes: [...this.selectedNodeIds],
      edges: [...this.selectedEdgeIds],
    });
    this.emit('change');
  }

  clearSelection() {
    this.setSelection([], []);
  }

  /**
   * @param {string} id
   * @param {boolean} [add=false] - If true, add to existing selection
   */
  selectNode(id, add = false) {
    if (add) {
      const nodes = [...this.selectedNodeIds, id];
      this.setSelection(nodes, [...this.selectedEdgeIds]);
    } else {
      this.setSelection([id], []);
    }
  }

  /**
   * @param {string} id
   * @param {boolean} [add=false]
   */
  selectEdge(id, add = false) {
    if (add) {
      const edges = [...this.selectedEdgeIds, id];
      this.setSelection([...this.selectedNodeIds], edges);
    } else {
      this.setSelection([], [id]);
    }
  }

  /** Toggle node selection state */
  toggleNodeSelection(id) {
    if (this.selectedNodeIds.has(id)) {
      const nodes = [...this.selectedNodeIds].filter(n => n !== id);
      this.setSelection(nodes, [...this.selectedEdgeIds]);
    } else {
      this.selectNode(id, true);
    }
  }

  // ─── Viewport ─────────────────────────────────────────────────────────────

  /**
   * @param {Partial<Viewport>} changes
   */
  setViewport(changes) {
    Object.assign(this.viewport, changes);
    this.emit('viewportChange', { ...this.viewport });
    this.emit('change');
  }

  // ─── Marquee ──────────────────────────────────────────────────────────────

  /**
   * @param {{ active: boolean, x?: number, y?: number, width?: number, height?: number }} changes
   */
  setMarquee(changes) {
    Object.assign(this.marquee, changes);
    this.emit('change');
  }

  // ─── Connection drag ──────────────────────────────────────────────────────

  /**
   * @param {{ active: boolean, sourceNodeId?: string|null, sourceHandle?: string|null, x?: number, y?: number }} changes
   */
  setConnection(changes) {
    Object.assign(this.connection, changes);
    this.emit('change');
  }

  // ─── Bulk load ────────────────────────────────────────────────────────────

  /**
   * Replace the entire state.
   * @param {{ nodes: NodeModel[], edges: EdgeModel[], viewport?: Viewport }} data
   */
  load({ nodes = [], edges = [], viewport }) {
    this.nodes.clear();
    this.edges.clear();
    this.selectedNodeIds.clear();
    this.selectedEdgeIds.clear();
    this.marquee = { active: false, x: 0, y: 0, width: 0, height: 0 };
    this.connection = { active: false, sourceNodeId: null, sourceHandle: null, x: 0, y: 0 };

    for (const n of nodes) this.nodes.set(n.id, createNode(n));
    for (const e of edges) this.edges.set(e.id, createEdge(e));
    if (viewport) Object.assign(this.viewport, viewport);

    this.emit('load');
    this.emit('change');
  }

  /**
   * Produce a plain-object snapshot of current state (for history).
   * @returns {Object}
   */
  snapshot() {
    return {
      nodes: [...this.nodes.values()].map(n => ({ ...n })),
      edges: [...this.edges.values()].map(e => ({ ...e })),
      viewport: { ...this.viewport },
    };
  }

  /**
   * Restore a snapshot without triggering history entries.
   * @param {Object} snap
   */
  restoreSnapshot(snap) {
    this.load(snap);
  }

  /** @returns {NodeModel[]} */
  getNodes() { return [...this.nodes.values()]; }

  /** @returns {EdgeModel[]} */
  getEdges() { return [...this.edges.values()]; }

  /** @returns {NodeModel[]} */
  getSelectedNodes() {
    return [...this.selectedNodeIds]
      .map(id => this.nodes.get(id))
      .filter(Boolean);
  }
}
