/**
 * @module FlowEditor
 * Public API entry point for jsFlow.
 *
 *   import { FlowEditor } from './core/FlowEditor.js';
 *
 *   const editor = new FlowEditor({ container, nodes, edges });
 */

import { StateStore }        from '../state/StateStore.js';
import { ViewportEngine }    from '../viewport/ViewportEngine.js';
import { CanvasRenderer }    from '../renderer/CanvasRenderer.js';
import { InteractionManager} from '../interactions/InteractionManager.js';
import { EventEmitter }      from '../utils/EventEmitter.js';
import { History }           from '../utils/History.js';
import { PluginSystem }      from '../plugins/PluginSystem.js';
import { exportGraph, importGraph } from '../utils/Serializer.js';

/**
 * @typedef {Object} FlowEditorOptions
 * @property {HTMLElement} container
 * @property {Array}  [nodes=[]]
 * @property {Array}  [edges=[]]
 * @property {number} [minZoom=0.1]
 * @property {number} [maxZoom=3]
 * @property {boolean|'dots'|'lines'|'cross'|'none'} [background='lines']
 * @property {boolean} [minimap=true]
 * @property {boolean} [readonly=false]
 * @property {boolean} [snapToGrid=false]
 * @property {number}  [gridSize=20]
 * @property {Function} [isValidConnection]
 * @property {{ x: number, y: number, zoom: number }} [viewport]
 */

export class FlowEditor {
  /** @param {FlowEditorOptions} options */
  constructor(options) {
    const {
      container,
      nodes         = [],
      edges         = [],
      minZoom       = 0.1,
      maxZoom       = 3,
      background    = 'lines',
      minimap       = true,
      readonly      = false,
      snapToGrid    = false,
      gridSize      = 20,
      isValidConnection,
      viewport,
    } = options;

    if (!container || !(container instanceof HTMLElement)) {
      throw new TypeError('[jsFlow] options.container must be an HTMLElement');
    }

    this._store          = new StateStore();
    this._history        = new History();
    this._emitter        = new EventEmitter();
    this._viewportEngine = new ViewportEngine(this._store, { minZoom, maxZoom });
    this._renderer       = new CanvasRenderer(container, this._store, this._viewportEngine,
                             { grid: background, minimap });
    this._interactions   = new InteractionManager(
      container,
      this._store,
      this._viewportEngine,
      this._emitter,
      this._history,
      this._renderer,
      { readonly, snapToGrid, gridSize, isValidConnection },
    );
    this._plugins   = new PluginSystem(this);
    this._container = container;

    this._buildControls(container);

    // Wire store events → public emitter
    this._store.on('nodeAdded',       n => this._emitter.emit('nodeAdd', n));
    this._store.on('nodeRemoved',     n => this._emitter.emit('nodeRemove', n));
    this._store.on('edgeAdded',       e => this._emitter.emit('edgeAdd', e));
    this._store.on('edgeRemoved',     e => this._emitter.emit('edgeRemove', e));
    this._store.on('selectionChange', s => this._emitter.emit('selectionChange', s));
    this._store.on('viewportChange',  v => this._emitter.emit('viewportChange', v));

    if (nodes.length || edges.length || viewport) {
      this._store.load({ nodes, edges, viewport });
    }

    this._renderer.scheduleRender();
    this._history.push('Initial', this._store.snapshot());
  }

  // ─── Nodes ────────────────────────────────────────────────────────────────

  addNode(partial) {
    const snap = this._store.snapshot();
    const node = this._store.addNode(partial);
    this._history.push('Add node', snap);
    return node;
  }

  updateNode(id, changes)  { return this._store.updateNode(id, changes); }

  removeNode(id) {
    const snap = this._store.snapshot();
    this._store.removeNode(id);
    this._history.push('Remove node', snap);
  }

  getNode(id)  { return this._store.nodes.get(id); }
  getNodes()   { return this._store.getNodes(); }

  // ─── Edges ────────────────────────────────────────────────────────────────

  addEdge(partial) {
    const snap = this._store.snapshot();
    const edge = this._store.addEdge(partial);
    this._history.push('Add edge', snap);
    return edge;
  }

  updateEdge(id, changes)  { return this._store.updateEdge(id, changes); }

  removeEdge(id) {
    const snap = this._store.snapshot();
    this._store.removeEdge(id);
    this._history.push('Remove edge', snap);
  }

  getEdge(id)  { return this._store.edges.get(id); }
  getEdges()   { return this._store.getEdges(); }

  // ─── Viewport ─────────────────────────────────────────────────────────────

  fitView(padding = 40)    { this._viewportEngine.fitView(this._container, padding); }
  centerView()             { this._viewportEngine.centerView(this._container); }
  zoomTo(zoom)             { this._viewportEngine.zoomTo(zoom); }
  setViewport(vp)          { this._store.setViewport(vp); }
  getViewport()            { return { ...this._store.viewport }; }

  zoomIn()  { this._viewportEngine.zoomAt(0.2, this._container.clientWidth / 2, this._container.clientHeight / 2); }
  zoomOut() { this._viewportEngine.zoomAt(-0.2, this._container.clientWidth / 2, this._container.clientHeight / 2); }
  setMinZoom(zoom) { this._viewportEngine.minZoom = zoom; }
  setMaxZoom(zoom) { this._viewportEngine.maxZoom = zoom; }
  getMinZoom()     { return this._viewportEngine.minZoom; }
  getMaxZoom()     { return this._viewportEngine.maxZoom; }

  // ─── Selection ────────────────────────────────────────────────────────────

  setSelection(nodeIds, edgeIds = []) { this._store.setSelection(nodeIds, edgeIds); }
  clearSelection()                     { this._store.clearSelection(); }
  selectAll()                          { this._store.setSelection([...this._store.nodes.keys()], [...this._store.edges.keys()]); }
  getSelectedNodes()                   { return this._store.getSelectedNodes(); }
  getSelectedEdges()                   { return this._store.getSelectedEdges(); }

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

  getHistoryStatus()  { return this._history.status(); }

  // ─── Import / Export ──────────────────────────────────────────────────────

  export() {
    return exportGraph({
      nodes: this._store.getNodes(),
      edges: this._store.getEdges(),
      viewport: this._store.viewport,
    });
  }

  import(data) {
    const snap = this._store.snapshot();
    this._store.load(importGraph(data));
    this._history.push('Import', snap);
  }

  // ─── Readonly / Options ───────────────────────────────────────────────────

  setReadonly(val)   {
    this._interactions.setReadonly(val);
    this._container.classList.toggle('jf-editor--readonly', val);
  }

  setSnapToGrid(val, size) {
    this._interactions.setSnapToGrid(val);
    if (size !== undefined) this._interactions.setGridSize(size);
  }

  setIsValidConnection(fn) { this._interactions.setIsValidConnection(fn); }
  getReadonly()            { return this._interactions.getReadonly(); }
  getSnapToGrid()          { return this._interactions.getSnapToGrid(); }
  getGridSize()            { return this._interactions.getGridSize(); }
  getIsValidConnection()   { return this._interactions.getIsValidConnection(); }

  // ─── Custom renderers ─────────────────────────────────────────────────────

  registerNodeType(type, fn) { this._renderer.registerNodeType(type, fn); }
  registerEdgeType(type, fn) { this._renderer.registerEdgeType(type, fn); }

  // ─── Plugin system ────────────────────────────────────────────────────────

  use(name, plugin) { this._plugins.use(name, plugin); }
  get plugins()     { return this._plugins; }

  // ─── Events ───────────────────────────────────────────────────────────────

  on(event, handler)  { return this._emitter.on(event, handler); }
  off(event, handler) { this._emitter.off(event, handler); }

  // ─── Coordinates ──────────────────────────────────────────────────────────

  screenToWorld(x, y) { return this._viewportEngine.toWorld(x, y); }
  worldToScreen(x, y) { return this._viewportEngine.toScreen(x, y); }

  // ─── Destroy ──────────────────────────────────────────────────────────────

  destroy() {
    this._interactions.destroy();
    this._renderer.destroy();
    this._store.removeAllListeners();
    this._emitter.removeAllListeners();
    this._history.clear();
  }

  // ─── Controls toolbar ─────────────────────────────────────────────────────

  _buildControls(container) {
    const controls = document.createElement('div');
    controls.className = 'jf-controls';

    const buttons = [
      { title: 'Zoom in',    icon: '+',  action: () => this.zoomIn() },
      { title: 'Zoom out',   icon: '−',  action: () => this.zoomOut() },
      { title: 'Fit view',   icon: '⊡',  action: () => this.fitView() },
      { title: 'Reset zoom', icon: '⊙',  action: () => this._viewportEngine.reset() },
    ];

    for (const { title, icon, action } of buttons) {
      const btn = document.createElement('button');
      btn.className = 'jf-controls__btn';
      btn.title     = title;
      btn.textContent = icon;
      btn.addEventListener('click', e => { e.stopPropagation(); action(); });
      controls.appendChild(btn);
    }

    container.appendChild(controls);
  }
}
