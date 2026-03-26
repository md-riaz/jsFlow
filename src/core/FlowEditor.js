/**
 * @module FlowEditor
 * Public API entry point for jsFlow.
 *
 * Usage:
 *   import { FlowEditor } from './core/FlowEditor.js';
 *
 *   const editor = new FlowEditor({
 *     container: document.getElementById('app'),
 *     nodes: [...],
 *     edges: [...],
 *   });
 */

import { StateStore } from '../state/StateStore.js';
import { ViewportEngine } from '../viewport/ViewportEngine.js';
import { CanvasRenderer } from '../renderer/CanvasRenderer.js';
import { InteractionManager } from '../interactions/InteractionManager.js';
import { EventEmitter } from '../utils/EventEmitter.js';
import { History } from '../utils/History.js';
import { PluginSystem } from '../plugins/PluginSystem.js';
import { exportGraph, importGraph } from '../utils/Serializer.js';
import { createNode } from '../models/Node.js';
import { createEdge } from '../models/Edge.js';

/**
 * @typedef {Object} FlowEditorOptions
 * @property {HTMLElement} container
 * @property {Array} [nodes=[]]
 * @property {Array} [edges=[]]
 * @property {number} [minZoom=0.1]
 * @property {number} [maxZoom=3]
 * @property {boolean} [grid=true]
 * @property {boolean} [minimap=true]
 * @property {boolean} [readonly=false]
 * @property {{ x: number, y: number, zoom: number }} [viewport]
 */

export class FlowEditor {
  /**
   * @param {FlowEditorOptions} options
   */
  constructor(options) {
    const {
      container,
      nodes = [],
      edges = [],
      minZoom = 0.1,
      maxZoom = 3,
      grid = true,
      minimap = true,
      readonly = false,
      viewport,
    } = options;

    if (!container || !(container instanceof HTMLElement)) {
      throw new TypeError('[jsFlow] options.container must be an HTMLElement');
    }

    // ── Core systems ────────────────────────────────────────────────────────
    this._store = new StateStore();
    this._history = new History();
    this._emitter = new EventEmitter();
    this._viewportEngine = new ViewportEngine(this._store, { minZoom, maxZoom });
    this._renderer = new CanvasRenderer(container, this._store, this._viewportEngine, { grid, minimap });
    this._interactions = new InteractionManager(
      container,
      this._store,
      this._viewportEngine,
      this._emitter,
      this._history,
      { readonly },
    );
    this._plugins = new PluginSystem(this);
    this._container = container;

    // ── Build controls toolbar ───────────────────────────────────────────────
    this._buildControls(container);

    // ── Wire state events → public emitter ──────────────────────────────────
    this._store.on('nodeAdded',       n => this._emitter.emit('nodeAdd', n));
    this._store.on('nodeRemoved',     n => this._emitter.emit('nodeRemove', n));
    this._store.on('edgeAdded',       e => this._emitter.emit('edgeAdd', e));
    this._store.on('edgeRemoved',     e => this._emitter.emit('edgeRemove', e));
    this._store.on('selectionChange', s => this._emitter.emit('selectionChange', s));
    this._store.on('viewportChange',  v => this._emitter.emit('viewportChange', v));

    // ── Initial data load ────────────────────────────────────────────────────
    if (nodes.length || edges.length || viewport) {
      this._store.load({ nodes, edges, viewport });
    }

    // ── Initial render ───────────────────────────────────────────────────────
    this._renderer.scheduleRender();

    // Push initial history snapshot
    this._history.push('Initial', this._store.snapshot());
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Add a node to the graph.
   * @param {Partial<import('../models/Node.js').NodeModel>} partial
   * @returns {import('../models/Node.js').NodeModel}
   */
  addNode(partial) {
    const snap = this._store.snapshot();
    const node = this._store.addNode(partial);
    this._history.push('Add node', snap);
    return node;
  }

  /**
   * Update a node's properties.
   * @param {string} id
   * @param {Partial<import('../models/Node.js').NodeModel>} changes
   * @returns {import('../models/Node.js').NodeModel|undefined}
   */
  updateNode(id, changes) {
    return this._store.updateNode(id, changes);
  }

  /**
   * Remove a node (and its connected edges).
   * @param {string} id
   */
  removeNode(id) {
    const snap = this._store.snapshot();
    this._store.removeNode(id);
    this._history.push('Remove node', snap);
  }

  /**
   * Get a node by id.
   * @param {string} id
   * @returns {import('../models/Node.js').NodeModel|undefined}
   */
  getNode(id) {
    return this._store.nodes.get(id);
  }

  /**
   * Get all nodes.
   * @returns {import('../models/Node.js').NodeModel[]}
   */
  getNodes() {
    return this._store.getNodes();
  }

  /**
   * Add an edge.
   * @param {Partial<import('../models/Edge.js').EdgeModel>} partial
   * @returns {import('../models/Edge.js').EdgeModel}
   */
  addEdge(partial) {
    const snap = this._store.snapshot();
    const edge = this._store.addEdge(partial);
    this._history.push('Add edge', snap);
    return edge;
  }

  /**
   * Update an edge's properties.
   * @param {string} id
   * @param {Partial<import('../models/Edge.js').EdgeModel>} changes
   * @returns {import('../models/Edge.js').EdgeModel|undefined}
   */
  updateEdge(id, changes) {
    return this._store.updateEdge(id, changes);
  }

  /**
   * Remove an edge.
   * @param {string} id
   */
  removeEdge(id) {
    const snap = this._store.snapshot();
    this._store.removeEdge(id);
    this._history.push('Remove edge', snap);
  }

  /**
   * Get an edge by id.
   * @param {string} id
   * @returns {import('../models/Edge.js').EdgeModel|undefined}
   */
  getEdge(id) {
    return this._store.edges.get(id);
  }

  /**
   * Get all edges.
   * @returns {import('../models/Edge.js').EdgeModel[]}
   */
  getEdges() {
    return this._store.getEdges();
  }

  // ─── Viewport ─────────────────────────────────────────────────────────────

  /** Fit all nodes into the visible area. */
  fitView(padding = 40) {
    this._viewportEngine.fitView(this._container, padding);
  }

  /** Center the view without changing zoom. */
  centerView() {
    this._viewportEngine.centerView(this._container);
  }

  /**
   * Zoom to an exact level.
   * @param {number} zoom
   */
  zoomTo(zoom) {
    this._viewportEngine.zoomTo(zoom);
  }

  /**
   * Set the viewport explicitly.
   * @param {{ x?: number, y?: number, zoom?: number }} vp
   */
  setViewport(vp) {
    this._store.setViewport(vp);
  }

  /**
   * Get the current viewport state.
   * @returns {{ x: number, y: number, zoom: number }}
   */
  getViewport() {
    return { ...this._store.viewport };
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  /**
   * Set the selection.
   * @param {string[]} nodeIds
   * @param {string[]} [edgeIds=[]]
   */
  setSelection(nodeIds, edgeIds = []) {
    this._store.setSelection(nodeIds, edgeIds);
  }

  /** Clear the selection. */
  clearSelection() {
    this._store.clearSelection();
  }

  /**
   * Get currently selected nodes.
   * @returns {import('../models/Node.js').NodeModel[]}
   */
  getSelectedNodes() {
    return this._store.getSelectedNodes();
  }

  // ─── Undo / Redo ──────────────────────────────────────────────────────────

  undo() {
    const snap = this._history.undo();
    if (snap) this._history.suspend(() => this._store.restoreSnapshot(snap.state));
    this._emitter.emit('historyChange', this._history.status());
  }

  redo() {
    const snap = this._history.redo();
    if (snap) this._history.suspend(() => this._store.restoreSnapshot(snap.state));
    this._emitter.emit('historyChange', this._history.status());
  }

  /** @returns {{ canUndo: boolean, canRedo: boolean }} */
  getHistoryStatus() {
    return this._history.status();
  }

  // ─── Import / Export ──────────────────────────────────────────────────────

  /**
   * Export the current graph to a plain object.
   * @returns {Object}
   */
  export() {
    return exportGraph({
      nodes: this._store.getNodes(),
      edges: this._store.getEdges(),
      viewport: this._store.viewport,
    });
  }

  /**
   * Import graph data, replacing the current state.
   * @param {Object} data
   */
  import(data) {
    const parsed = importGraph(data);
    const snap = this._store.snapshot();
    this._store.load(parsed);
    this._history.push('Import', snap);
  }

  // ─── Readonly mode ────────────────────────────────────────────────────────

  /**
   * Toggle readonly mode.
   * @param {boolean} val
   */
  setReadonly(val) {
    this._interactions.setReadonly(val);
    this._container.classList.toggle('jf-editor--readonly', val);
  }

  // ─── Custom renderers ─────────────────────────────────────────────────────

  /**
   * Register a custom node type renderer.
   * @param {string} type
   * @param {Function} fn  (node, bodyEl) => void
   */
  registerNodeType(type, fn) {
    this._renderer.registerNodeType(type, fn);
  }

  /**
   * Register a custom edge path renderer.
   * @param {string} type
   * @param {Function} fn  (edge, src, tgt) => svgPathString
   */
  registerEdgeType(type, fn) {
    this._renderer.registerEdgeType(type, fn);
  }

  // ─── Plugin system ────────────────────────────────────────────────────────

  /**
   * Install a plugin.
   * @param {string} name
   * @param {{ install: (editor: FlowEditor) => void }} plugin
   */
  use(name, plugin) {
    this._plugins.use(name, plugin);
  }

  /**
   * Access the plugin registry.
   * @returns {import('../plugins/PluginSystem.js').PluginSystem}
   */
  get plugins() { return this._plugins; }

  // ─── Event hooks ──────────────────────────────────────────────────────────

  /**
   * Subscribe to an editor event.
   *
   * Events: 'nodeAdd' | 'nodeRemove' | 'nodeMove' | 'nodeClick' |
   *         'edgeAdd' | 'edgeRemove' | 'edgeClick' | 'connect' |
   *         'selectionChange' | 'viewportChange' | 'historyChange'
   *
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} unsubscribe
   */
  on(event, handler) {
    return this._emitter.on(event, handler);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    this._emitter.off(event, handler);
  }

  // ─── Coordinate helpers ───────────────────────────────────────────────────

  /**
   * Convert screen coordinates to world coordinates.
   * @param {number} x
   * @param {number} y
   * @returns {{ x: number, y: number }}
   */
  screenToWorld(x, y) {
    return this._viewportEngine.toWorld(x, y);
  }

  /**
   * Convert world coordinates to screen coordinates.
   * @param {number} x
   * @param {number} y
   * @returns {{ x: number, y: number }}
   */
  worldToScreen(x, y) {
    return this._viewportEngine.toScreen(x, y);
  }

  // ─── Destroy ──────────────────────────────────────────────────────────────

  /** Destroy the editor and release all resources. */
  destroy() {
    this._interactions.destroy();
    this._renderer.destroy();
    this._store.removeAllListeners();
    this._emitter.removeAllListeners();
    this._history.clear();
  }

  // ─── Controls toolbar ─────────────────────────────────────────────────────

  /** @param {HTMLElement} container */
  _buildControls(container) {
    const controls = document.createElement('div');
    controls.className = 'jf-controls';

    const buttons = [
      { title: 'Zoom in',    icon: '+',   action: () => this._viewportEngine.zoomAt(0.15, container.clientWidth / 2, container.clientHeight / 2) },
      { title: 'Zoom out',   icon: '−',   action: () => this._viewportEngine.zoomAt(-0.15, container.clientWidth / 2, container.clientHeight / 2) },
      { title: 'Fit view',   icon: '⊡',   action: () => this.fitView() },
      { title: 'Reset zoom', icon: '⊙',   action: () => this._viewportEngine.reset() },
    ];

    for (const { title, icon, action } of buttons) {
      const btn = document.createElement('button');
      btn.className = 'jf-controls__btn';
      btn.title = title;
      btn.textContent = icon;
      btn.addEventListener('click', (e) => { e.stopPropagation(); action(); });
      controls.appendChild(btn);
    }

    container.appendChild(controls);
  }
}
