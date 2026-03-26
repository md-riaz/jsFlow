/**
 * @module InteractionManager
 * Unified pointer-event pipeline for pan, zoom, node drag, node resize,
 * marquee selection, edge connection dragging, copy/paste, and context menu.
 *
 * All coordinates that enter world-space go through ViewportEngine.toWorld().
 * State mutations go through StateStore only — no direct DOM manipulation here.
 */

import { rectsIntersect } from '../utils/Geometry.js';
import { createNode } from '../models/Node.js';
import { uid } from '../utils/Geometry.js';

/** @typedef {'idle'|'panning'|'dragging-node'|'resizing-node'|'marquee'|'connecting'} InteractionMode */

export class InteractionManager {
  /**
   * @param {HTMLElement} container
   * @param {import('../state/StateStore.js').StateStore} store
   * @param {import('../viewport/ViewportEngine.js').ViewportEngine} viewport
   * @param {import('../utils/EventEmitter.js').EventEmitter} emitter
   * @param {import('../utils/History.js').History} history
   * @param {import('../renderer/CanvasRenderer.js').CanvasRenderer} renderer
   * @param {{
   *   readonly?: boolean,
   *   snapToGrid?: boolean,
   *   gridSize?: number,
   *   isValidConnection?: (src: Object, tgt: Object) => boolean
   * }} options
   */
  constructor(container, store, viewport, emitter, history, renderer, options = {}) {
    this._container = container;
    this._store     = store;
    this._viewport  = viewport;
    this._emitter   = emitter;
    this._history   = history;
    this._renderer  = renderer;
    this._options   = options;

    /** @type {InteractionMode} */
    this._mode = 'idle';
    this._spaceDown = false;

    // Drag state
    this._dragStart       = { x: 0, y: 0 };
    this._dragNodeId      = null;
    this._dragNodeOffsets = new Map();
    this._panStart        = { vpX: 0, vpY: 0 };
    this._marqueeStart    = { x: 0, y: 0 };
    this._preDragSnapshot = null;

    // Resize state
    this._resizeNodeId    = null;
    this._resizeStart     = { screenX: 0, screenY: 0, w: 0, h: 0 };

    // Connection state
    this._connectSourceNodeId = null;
    this._connectSourceHandle = null;

    // Clipboard
    this._clipboard = [];

    this._bindEvents();
  }

  _bindEvents() {
    const c = this._container;
    this._onPointerDownBound   = this._onPointerDown.bind(this);
    this._onPointerMoveBound   = this._onPointerMove.bind(this);
    this._onPointerUpBound     = this._onPointerUp.bind(this);
    this._onWheelBound         = this._onWheel.bind(this);
    this._onContextMenuBound   = this._onContextMenu.bind(this);
    this._onKeyDownBound       = this._onKeyDown.bind(this);
    this._onKeyUpBound         = this._onKeyUp.bind(this);
    this._hideContextMenuBound = () => this._renderer.hideContextMenu();

    c.addEventListener('pointerdown',   this._onPointerDownBound);
    c.addEventListener('pointermove',   this._onPointerMoveBound);
    c.addEventListener('pointerup',     this._onPointerUpBound);
    c.addEventListener('pointercancel', this._onPointerUpBound);
    c.addEventListener('wheel',         this._onWheelBound, { passive: false });
    c.addEventListener('contextmenu',   this._onContextMenuBound);

    window.addEventListener('keydown', this._onKeyDownBound);
    window.addEventListener('keyup',   this._onKeyUpBound);

    // Close context menu on outside click
    document.addEventListener('click', this._hideContextMenuBound, true);
  }

  // ── Pointer down ──────────────────────────────────────────────────────────

  /** @param {PointerEvent} e */
  _onPointerDown(e) {
    // Always dismiss context menu on any pointer down
    this._renderer.hideContextMenu();

    if (this._options.readonly) return;

    const rect    = this._container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const target  = e.target;

    // Right-click → context menu (handled in contextmenu event)
    if (e.button === 2) return;

    e.preventDefault();
    this._container.setPointerCapture(e.pointerId);

    // ── Resize handle ───────────────────────────────────────────────────────
    if (target.dataset.resizeNodeId) {
      const nodeId = target.dataset.resizeNodeId;
      const node   = this._store.nodes.get(nodeId);
      if (!node) return;
      this._mode          = 'resizing-node';
      this._resizeNodeId  = nodeId;
      this._resizeStart   = { screenX, screenY, w: node.width, h: node.height };
      this._preDragSnapshot = this._store.snapshot();
      return;
    }

    // ── Source handle → connection drag ─────────────────────────────────────
    if (target.classList.contains('jf-handle') && target.dataset.handleType === 'source') {
      this._mode = 'connecting';
      this._connectSourceNodeId = target.dataset.nodeId;
      this._connectSourceHandle = target.dataset.handleId;
      const world = this._viewport.toWorld(screenX, screenY);
      this._store.setConnection({
        active: true,
        sourceNodeId: this._connectSourceNodeId,
        sourceHandle: this._connectSourceHandle,
        x: world.x, y: world.y,
      });
      return;
    }

    // ── Node body → node drag ───────────────────────────────────────────────
    const nodeEl = target.closest('[data-node-id]');
    if (nodeEl && !target.classList.contains('jf-handle')) {
      const nodeId = nodeEl.dataset.nodeId;
      const node   = this._store.nodes.get(nodeId);
      if (!node) return;

      const world = this._viewport.toWorld(screenX, screenY);
      if (!node.selected) {
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        additive ? this._store.selectNode(nodeId, true) : this._store.setSelection([nodeId], []);
        this._emitter.emit('nodeClick', node, e);
      }

      this._mode       = 'dragging-node';
      this._dragStart  = { x: screenX, y: screenY };
      this._dragNodeId = nodeId;
      this._dragNodeOffsets.clear();
      for (const selId of this._store.selectedNodeIds) {
        const n = this._store.nodes.get(selId);
        if (n) this._dragNodeOffsets.set(selId, { dx: world.x - n.x, dy: world.y - n.y });
      }
      this._preDragSnapshot = this._store.snapshot();
      return;
    }

    // ── Edge hit area → edge click ──────────────────────────────────────────
    if (target.dataset.edgeId) {
      const edgeId  = target.dataset.edgeId;
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      this._store.selectEdge(edgeId, additive);
      const edge = this._store.edges.get(edgeId);
      if (edge) this._emitter.emit('edgeClick', edge, e);
      return;
    }

    // ── Canvas background → pan or marquee ─────────────────────────────────
    if (e.button === 1 || this._spaceDown || e.altKey) {
      this._startPan(screenX, screenY); return;
    }

    if (e.button === 0) {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        // Modifier + drag = marquee selection
        this._mode         = 'marquee';
        this._marqueeStart = { x: screenX, y: screenY };
        this._store.setMarquee({ active: true, x: screenX, y: screenY, width: 0, height: 0 });
      } else {
        // Plain left drag = pan; clear selection on click
        this._store.clearSelection();
        this._startPan(screenX, screenY);
      }
    }
  }

  _startPan(screenX, screenY) {
    this._mode     = 'panning';
    this._dragStart = { x: screenX, y: screenY };
    this._panStart  = { vpX: this._store.viewport.x, vpY: this._store.viewport.y };
  }

  // ── Pointer move ──────────────────────────────────────────────────────────

  /** @param {PointerEvent} e */
  _onPointerMove(e) {
    if (this._mode === 'idle') return;
    const rect    = this._container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    switch (this._mode) {
      case 'panning':        this._doPan(screenX, screenY);        break;
      case 'dragging-node':  this._doDragNodes(screenX, screenY);  break;
      case 'resizing-node':  this._doResize(screenX, screenY);     break;
      case 'marquee':        this._doMarquee(screenX, screenY);    break;
      case 'connecting':     this._doConnect(screenX, screenY);    break;
    }
  }

  _doPan(screenX, screenY) {
    this._store.setViewport({
      x: this._panStart.vpX + (screenX - this._dragStart.x),
      y: this._panStart.vpY + (screenY - this._dragStart.y),
    });
    this._emitter.emit('viewportChange', { ...this._store.viewport });
  }

  _doDragNodes(screenX, screenY) {
    const world    = this._viewport.toWorld(screenX, screenY);
    const snap     = this._options.snapToGrid;
    const gridSize = this._options.gridSize ?? 20;

    for (const [id, off] of this._dragNodeOffsets) {
      const node = this._store.nodes.get(id);
      if (!node) continue;
      let nx = world.x - off.dx;
      let ny = world.y - off.dy;
      if (snap) {
        nx = Math.round(nx / gridSize) * gridSize;
        ny = Math.round(ny / gridSize) * gridSize;
      }
      this._store.updateNode(id, { x: nx, y: ny });
    }
    this._emitter.emit('nodeMove', [...this._store.selectedNodeIds]
      .map(id => this._store.nodes.get(id)).filter(Boolean));
  }

  _doResize(screenX, screenY) {
    const node = this._store.nodes.get(this._resizeNodeId);
    if (!node) return;
    const { zoom } = this._store.viewport;
    const dxScreen = screenX - this._resizeStart.screenX;
    const dyScreen = screenY - this._resizeStart.screenY;
    const newW = Math.max(120, this._resizeStart.w + dxScreen / zoom);
    const newH = Math.max(50,  this._resizeStart.h + dyScreen / zoom);
    this._store.updateNode(this._resizeNodeId, { width: newW, height: newH });
  }

  _doMarquee(screenX, screenY) {
    const width  = screenX - this._marqueeStart.x;
    const height = screenY - this._marqueeStart.y;
    this._store.setMarquee({ active: true, x: this._marqueeStart.x, y: this._marqueeStart.y, width, height });

    const wTL = this._viewport.toWorld(Math.min(screenX, this._marqueeStart.x), Math.min(screenY, this._marqueeStart.y));
    const wBR = this._viewport.toWorld(Math.max(screenX, this._marqueeStart.x), Math.max(screenY, this._marqueeStart.y));
    const worldRect = { x: wTL.x, y: wTL.y, width: wBR.x - wTL.x, height: wBR.y - wTL.y };

    const selected = [];
    for (const [id, node] of this._store.nodes) {
      if (rectsIntersect(worldRect, node)) selected.push(id);
    }
    this._store.setSelection(selected, []);
  }

  _doConnect(screenX, screenY) {
    const world = this._viewport.toWorld(screenX, screenY);
    this._store.setConnection({ x: world.x, y: world.y });
  }

  // ── Pointer up ────────────────────────────────────────────────────────────

  /** @param {PointerEvent} e */
  _onPointerUp(e) {
    const rect    = this._container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    switch (this._mode) {
      case 'dragging-node':  this._endDragNodes();                         break;
      case 'resizing-node':  this._endResize();                            break;
      case 'marquee':
        this._store.setMarquee({ active: false });
        break;
      case 'connecting':
        this._endConnect(screenX, screenY, document.elementFromPoint(e.clientX, e.clientY));
        break;
    }
    this._mode = 'idle';
    this._dragNodeOffsets.clear();
  }

  _endDragNodes() {
    if (this._preDragSnapshot) {
      const movedNodes = [...this._store.selectedNodeIds]
        .map(id => this._store.nodes.get(id)).filter(Boolean);
      if (movedNodes.length) {
        this._history.push('Move nodes', this._preDragSnapshot);
        this._emitter.emit('nodeMove', movedNodes);
      }
    }
    this._preDragSnapshot = null;
  }

  _endResize() {
    if (this._preDragSnapshot) {
      this._history.push('Resize node', this._preDragSnapshot);
    }
    this._preDragSnapshot = null;
    this._resizeNodeId = null;
  }

  /** @param {number} sx  @param {number} sy  @param {EventTarget} target */
  _endConnect(sx, sy, target) {
    this._store.setConnection({ active: false });

    if (!target) return;
    const handle = /** @type {HTMLElement} */ (target).closest?.('.jf-handle[data-handle-type="target"]');
    if (!handle) return;

    const targetNodeId  = handle.dataset.nodeId;
    const targetHandleId = handle.dataset.handleId;

    if (!targetNodeId || targetNodeId === this._connectSourceNodeId) return;

    // isValidConnection check
    if (this._options.isValidConnection) {
      const srcNode = this._store.nodes.get(this._connectSourceNodeId);
      const tgtNode = this._store.nodes.get(targetNodeId);
      if (!this._options.isValidConnection(
        { node: srcNode, handleId: this._connectSourceHandle },
        { node: tgtNode, handleId: targetHandleId }
      )) return;
    }

    // Avoid duplicate edges
    for (const edge of this._store.edges.values()) {
      if (edge.source === this._connectSourceNodeId &&
          edge.sourceHandle === this._connectSourceHandle &&
          edge.target === targetNodeId &&
          edge.targetHandle === targetHandleId) return;
    }

    const snap = this._store.snapshot();
    const edge = this._store.addEdge({
      source: this._connectSourceNodeId,
      sourceHandle: this._connectSourceHandle,
      target: targetNodeId,
      targetHandle: targetHandleId,
    });
    this._history.push('Add edge', snap);
    this._emitter.emit('connect', edge);
  }

  // ── Context menu ──────────────────────────────────────────────────────────

  /** @param {MouseEvent} e */
  _onContextMenu(e) {
    e.preventDefault();
    if (this._options.readonly) return;

    const rect    = this._container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const target  = e.target;

    const nodeEl = target.closest?.('[data-node-id]');
    const edgeTarget = target.dataset?.edgeId;

    if (nodeEl) {
      const nodeId = nodeEl.dataset.nodeId;
      const node   = this._store.nodes.get(nodeId);
      if (!node.selected) this._store.setSelection([nodeId], []);

      this._renderer.showContextMenu(screenX, screenY, [
        { label: '✂ Delete node',    action: () => this._deleteSelected() },
        { label: '⧉ Duplicate',      action: () => this._duplicateSelected() },
        { separator: true },
        { label: '⧉ Copy',           action: () => this._copySelected() },
        { label: '📋 Paste',         action: () => this._paste(screenX, screenY) },
      ]);
      return;
    }

    if (edgeTarget) {
      this._store.selectEdge(edgeTarget);
      this._renderer.showContextMenu(screenX, screenY, [
        { label: '✂ Delete edge',    action: () => this._deleteSelected() },
        { label: '⟳ Toggle animated', action: () => {
          const edge = this._store.edges.get(edgeTarget);
          if (edge) this._store.updateEdge(edgeTarget, { animated: !edge.animated });
        }},
      ]);
      return;
    }

    // Canvas
    this._renderer.showContextMenu(screenX, screenY, [
      { label: '⧉ Paste',           action: () => this._paste(screenX, screenY), disabled: !this._clipboard.length },
      { label: '⊡ Fit view',        action: () => this._viewport.fitView(this._container) },
      { separator: true },
      { label: '✔ Select all',      action: () => this._store.setSelection(
          [...this._store.nodes.keys()], [...this._store.edges.keys()]) },
      { label: '✗ Clear selection', action: () => this._store.clearSelection() },
    ]);
  }

  // ── Wheel ─────────────────────────────────────────────────────────────────

  /** @param {WheelEvent} e */
  _onWheel(e) {
    e.preventDefault();
    const rect    = this._container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const delta   = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
    this._viewport.zoomAt(-delta * 0.001, screenX, screenY);
    this._emitter.emit('viewportChange', { ...this._store.viewport });
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  /** @param {KeyboardEvent} e */
  _onKeyUp(e) { if (e.key === ' ') this._spaceDown = false; }

  /** @param {KeyboardEvent} e */
  _onKeyDown(e) {
    // Space toggles pan mode — only when not typing in a form field
    if (e.key === ' ') {
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        this._spaceDown = true;
        e.preventDefault(); // prevent page scroll
      }
      return;
    }
    if (this._options.readonly) return;
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;

    const ctrl = e.ctrlKey || e.metaKey;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        this._deleteSelected(); break;
      case 'Escape':
        this._store.clearSelection();
        this._store.setConnection({ active: false });
        this._renderer.hideContextMenu();
        break;
      case 'a':
        if (ctrl) {
          e.preventDefault();
          this._store.setSelection([...this._store.nodes.keys()], [...this._store.edges.keys()]);
        }
        break;
      case 'c':
        if (ctrl) { e.preventDefault(); this._copySelected(); }
        break;
      case 'v':
        if (ctrl) { e.preventDefault(); this._paste(); }
        break;
      case 'd':
        if (ctrl) { e.preventDefault(); this._duplicateSelected(); }
        break;
      case 'z':
        if (ctrl) {
          e.preventDefault();
          e.shiftKey ? this._redo() : this._undo();
        }
        break;
      case 'y':
        if (ctrl) { e.preventDefault(); this._redo(); }
        break;
    }
  }

  // ── Clipboard operations ──────────────────────────────────────────────────

  _copySelected() {
    this._clipboard = [...this._store.selectedNodeIds]
      .map(id => this._store.nodes.get(id))
      .filter(Boolean)
      .map(n => ({ ...n, data: { ...n.data }, ports: n.ports.map(p => ({ ...p })) }));
  }

  /** @param {number} [screenX]  @param {number} [screenY] */
  _paste(screenX, screenY) {
    if (!this._clipboard.length) return;
    const snap = this._store.snapshot();

    const offset = screenX !== undefined
      ? (() => {
          const world = this._viewport.toWorld(screenX, screenY);
          const cx = this._clipboard.reduce((s, n) => s + n.x, 0) / this._clipboard.length;
          const cy = this._clipboard.reduce((s, n) => s + n.y, 0) / this._clipboard.length;
          return { x: world.x - cx, y: world.y - cy };
        })()
      : { x: 30, y: 30 };

    const newIds = [];
    for (const src of this._clipboard) {
      const node = this._store.addNode({
        ...src,
        id: uid(),
        x: src.x + offset.x,
        y: src.y + offset.y,
        selected: false,
      });
      newIds.push(node.id);
    }
    this._store.setSelection(newIds, []);
    this._history.push('Paste', snap);
    this._emitter.emit('paste', newIds);
  }

  _duplicateSelected() {
    this._copySelected();
    this._paste();
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  _deleteSelected() {
    const snap = this._store.snapshot();
    let changed = false;
    for (const id of [...this._store.selectedEdgeIds]) { this._store.removeEdge(id); changed = true; }
    for (const id of [...this._store.selectedNodeIds]) { this._store.removeNode(id); changed = true; }
    if (changed) {
      this._history.push('Delete selected', snap);
      this._emitter.emit('selectionChange', { nodes: [], edges: [] });
    }
  }

  // ── Undo/Redo ─────────────────────────────────────────────────────────────

  _undo() {
    const snap = this._history.undo();
    if (snap) this._history.suspend(() => this._store.restoreSnapshot(snap.state));
    this._emitter.emit('historyChange', this._history.status());
  }

  _redo() {
    const snap = this._history.redo();
    if (snap) this._history.suspend(() => this._store.restoreSnapshot(snap.state));
    this._emitter.emit('historyChange', this._history.status());
  }

  // ── Setters ───────────────────────────────────────────────────────────────

  setReadonly(val)    { this._options.readonly    = val; }
  setSnapToGrid(val)  { this._options.snapToGrid  = val; }
  setGridSize(val)    { this._options.gridSize    = val; }
  setIsValidConnection(fn) { this._options.isValidConnection = fn; }

  // ── Destroy ───────────────────────────────────────────────────────────────

  destroy() {
    const c = this._container;
    c.removeEventListener('pointerdown',   this._onPointerDownBound);
    c.removeEventListener('pointermove',   this._onPointerMoveBound);
    c.removeEventListener('pointerup',     this._onPointerUpBound);
    c.removeEventListener('pointercancel', this._onPointerUpBound);
    c.removeEventListener('wheel',         this._onWheelBound);
    c.removeEventListener('contextmenu',   this._onContextMenuBound);
    window.removeEventListener('keydown',  this._onKeyDownBound);
    window.removeEventListener('keyup',    this._onKeyUpBound);
    document.removeEventListener('click',  this._hideContextMenuBound, true);
  }
}