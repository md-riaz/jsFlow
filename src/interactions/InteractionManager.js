/**
 * @module InteractionManager
 * Unified pointer-event pipeline for pan, zoom, node drag, marquee selection,
 * and edge connection dragging.
 *
 * All coordinates that enter world-space go through ViewportEngine.toWorld().
 * State mutations go through StateStore only — no direct DOM manipulation here.
 */

import { rectsIntersect, screenToWorld } from '../utils/Geometry.js';

/** @typedef {'idle'|'panning'|'dragging-node'|'marquee'|'connecting'} InteractionMode */

export class InteractionManager {
  /**
   * @param {HTMLElement} container         - The root editor element
   * @param {import('../state/StateStore.js').StateStore} store
   * @param {import('../viewport/ViewportEngine.js').ViewportEngine} viewport
   * @param {import('../utils/EventEmitter.js').EventEmitter} emitter - Public event emitter
   * @param {import('../utils/History.js').History} history
   * @param {{ readonly?: boolean }} options
   */
  constructor(container, store, viewport, emitter, history, options = {}) {
    this._container = container;
    this._store = store;
    this._viewport = viewport;
    this._emitter = emitter;
    this._history = history;
    this._options = options;

    /** @type {InteractionMode} */
    this._mode = 'idle';

    // Track spacebar for pan-while-space
    this._spaceDown = false;

    // Pointerdown context
    this._dragStart = { x: 0, y: 0 };
    this._dragNodeId = null;
    this._dragNodeOffsets = new Map(); // nodeId → {dx, dy} in world space
    this._panStart = { vpX: 0, vpY: 0 };
    this._marqueeStart = { x: 0, y: 0 };

    // Connection context
    this._connectSourceNodeId = null;
    this._connectSourceHandle = null;

    this._bindEvents();
  }

  _bindEvents() {
    const c = this._container;

    // Pointer events (unified mouse/touch/pen)
    c.addEventListener('pointerdown', this._onPointerDown.bind(this));
    c.addEventListener('pointermove', this._onPointerMove.bind(this));
    c.addEventListener('pointerup', this._onPointerUp.bind(this));
    c.addEventListener('pointercancel', this._onPointerUp.bind(this));

    // Wheel for zoom
    c.addEventListener('wheel', this._onWheel.bind(this), { passive: false });

    // Keyboard shortcuts
    this._onKeyDownBound = this._onKeyDown.bind(this);
    this._onKeyUpBound   = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDownBound);
    window.addEventListener('keyup',   this._onKeyUpBound);
  }

  /** @param {PointerEvent} e */
  _onPointerDown(e) {
    if (this._options.readonly) return;
    e.preventDefault();
    this._container.setPointerCapture(e.pointerId);

    const target = e.target;
    const screenX = e.clientX - this._container.getBoundingClientRect().left;
    const screenY = e.clientY - this._container.getBoundingClientRect().top;

    // ── Handle (port) — start connection drag ────────────────────────────
    if (target.classList.contains('jf-handle') && target.dataset.handleType === 'source') {
      this._mode = 'connecting';
      this._connectSourceNodeId = target.dataset.nodeId;
      this._connectSourceHandle = target.dataset.handleId;
      const world = this._viewport.toWorld(screenX, screenY);
      this._store.setConnection({
        active: true,
        sourceNodeId: this._connectSourceNodeId,
        sourceHandle: this._connectSourceHandle,
        x: world.x,
        y: world.y,
      });
      return;
    }

    // ── Node body — start node drag ───────────────────────────────────────
    const nodeEl = target.closest('[data-node-id]');
    if (nodeEl && !target.classList.contains('jf-handle')) {
      const nodeId = nodeEl.dataset.nodeId;
      const node = this._store.nodes.get(nodeId);
      if (!node) return;

      const world = this._viewport.toWorld(screenX, screenY);

      if (!node.selected) {
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        if (additive) {
          this._store.selectNode(nodeId, true);
        } else {
          this._store.setSelection([nodeId], []);
        }
        this._emitter.emit('nodeClick', node, e);
      }

      this._mode = 'dragging-node';
      this._dragStart = { x: screenX, y: screenY };
      this._dragNodeId = nodeId;

      // Record world-space offset from each selected node's origin to cursor
      this._dragNodeOffsets.clear();
      for (const selId of this._store.selectedNodeIds) {
        const n = this._store.nodes.get(selId);
        if (n) {
          this._dragNodeOffsets.set(selId, { dx: world.x - n.x, dy: world.y - n.y });
        }
      }

      // Snapshot for undo
      this._preDragSnapshot = this._store.snapshot();
      return;
    }

    // ── Edge click ────────────────────────────────────────────────────────
    if (target.dataset.edgeId) {
      const edgeId = target.dataset.edgeId;
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      this._store.selectEdge(edgeId, additive);
      const edge = this._store.edges.get(edgeId);
      if (edge) this._emitter.emit('edgeClick', edge, e);
      return;
    }

    // ── Canvas background — pan or marquee ────────────────────────────────
    if (e.button === 1 || (e.button === 0 && (e.altKey || this._spaceDown))) {
      this._startPan(e, screenX, screenY);
      return;
    }

    if (e.button === 0) {
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      if (!additive) {
        this._store.clearSelection();
      }
      this._mode = 'marquee';
      this._marqueeStart = { x: screenX, y: screenY };
      this._store.setMarquee({ active: true, x: screenX, y: screenY, width: 0, height: 0 });
      return;
    }

    if (e.button === 1 || e.button === 2) {
      this._startPan(e, screenX, screenY);
    }
  }

  /** @param {PointerEvent} e */
  _startPan(e, screenX, screenY) {
    this._mode = 'panning';
    this._dragStart = { x: screenX, y: screenY };
    this._panStart = { vpX: this._store.viewport.x, vpY: this._store.viewport.y };
  }

  /** @param {PointerEvent} e */
  _onPointerMove(e) {
    if (this._mode === 'idle') return;

    const rect = this._container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    switch (this._mode) {
      case 'panning':
        this._doPan(screenX, screenY);
        break;
      case 'dragging-node':
        this._doDragNodes(screenX, screenY);
        break;
      case 'marquee':
        this._doMarquee(screenX, screenY);
        break;
      case 'connecting':
        this._doConnect(screenX, screenY);
        break;
    }
  }

  _doPan(screenX, screenY) {
    const dx = screenX - this._dragStart.x;
    const dy = screenY - this._dragStart.y;
    this._store.setViewport({
      x: this._panStart.vpX + dx,
      y: this._panStart.vpY + dy,
    });
    this._emitter.emit('viewportChange', { ...this._store.viewport });
  }

  _doDragNodes(screenX, screenY) {
    const world = this._viewport.toWorld(screenX, screenY);
    for (const [id, off] of this._dragNodeOffsets) {
      const node = this._store.nodes.get(id);
      if (!node) continue;
      const newX = world.x - off.dx;
      const newY = world.y - off.dy;
      this._store.updateNode(id, { x: newX, y: newY });
    }
    this._emitter.emit('nodeMove', [...this._store.selectedNodeIds].map(id => this._store.nodes.get(id)).filter(Boolean));
  }

  _doMarquee(screenX, screenY) {
    const x = Math.min(this._marqueeStart.x, screenX);
    const y = Math.min(this._marqueeStart.y, screenY);
    const width = screenX - this._marqueeStart.x;
    const height = screenY - this._marqueeStart.y;

    this._store.setMarquee({ active: true, x: this._marqueeStart.x, y: this._marqueeStart.y, width, height });

    // Find nodes intersecting the marquee (both in screen space)
    const rect = this._container.getBoundingClientRect();
    const marqueeWorld = {
      x: Math.min(screenX, this._marqueeStart.x),
      y: Math.min(screenY, this._marqueeStart.y),
      width: Math.abs(width),
      height: Math.abs(height),
    };
    // Convert to world-space for node comparison
    const wTopLeft = this._viewport.toWorld(marqueeWorld.x, marqueeWorld.y);
    const wBottomRight = this._viewport.toWorld(marqueeWorld.x + marqueeWorld.width, marqueeWorld.y + marqueeWorld.height);
    const worldRect = {
      x: wTopLeft.x,
      y: wTopLeft.y,
      width: wBottomRight.x - wTopLeft.x,
      height: wBottomRight.y - wTopLeft.y,
    };

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

  /** @param {PointerEvent} e */
  _onPointerUp(e) {
    const rect = this._container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    switch (this._mode) {
      case 'dragging-node':
        this._endDragNodes();
        break;
      case 'marquee':
        this._store.setMarquee({ active: false });
        this._emitter.emit('selectionChange', {
          nodes: [...this._store.selectedNodeIds],
          edges: [...this._store.selectedEdgeIds],
        });
        break;
      case 'connecting':
        this._endConnect(screenX, screenY, e.target);
        break;
    }

    this._mode = 'idle';
    this._dragNodeOffsets.clear();
  }

  _endDragNodes() {
    // Emit move events and record undo
    const movedNodes = [...this._store.selectedNodeIds]
      .map(id => this._store.nodes.get(id))
      .filter(Boolean);

    if (movedNodes.length && this._preDragSnapshot) {
      this._history.push('Move nodes', this._preDragSnapshot);
      this._emitter.emit('nodeMove', movedNodes);
    }
    this._preDragSnapshot = null;
  }

  /**
   * @param {number} screenX
   * @param {number} screenY
   * @param {EventTarget} target
   */
  _endConnect(screenX, screenY, target) {
    this._store.setConnection({ active: false });

    // Did we drop on a target handle?
    const handle = /** @type {HTMLElement} */ (target).closest?.('.jf-handle[data-handle-type="target"]');
    if (!handle) return;

    const targetNodeId = handle.dataset.nodeId;
    const targetHandle = handle.dataset.handleId;

    if (!targetNodeId || targetNodeId === this._connectSourceNodeId) return;

    // Avoid duplicate edges
    for (const edge of this._store.edges.values()) {
      if (
        edge.source === this._connectSourceNodeId &&
        edge.sourceHandle === this._connectSourceHandle &&
        edge.target === targetNodeId &&
        edge.targetHandle === targetHandle
      ) return;
    }

    const snapshot = this._store.snapshot();
    const edge = this._store.addEdge({
      source: this._connectSourceNodeId,
      sourceHandle: this._connectSourceHandle,
      target: targetNodeId,
      targetHandle,
    });
    this._history.push('Add edge', snapshot);
    this._emitter.emit('connect', edge);
  }

  /** @param {WheelEvent} e */
  _onWheel(e) {
    e.preventDefault();
    const rect = this._container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Normalise delta
    const delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
    const factor = -delta * 0.001;
    this._viewport.zoomAt(factor, screenX, screenY);
    this._emitter.emit('viewportChange', { ...this._store.viewport });
  }

  /** @param {KeyboardEvent} e */
  _onKeyUp(e) {
    if (e.key === ' ') this._spaceDown = false;
  }

  /** @param {KeyboardEvent} e */
  _onKeyDown(e) {
    if (e.key === ' ') this._spaceDown = true;
    if (this._options.readonly) return;
    // Don't intercept if focus is in an input
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        this._deleteSelected();
        break;
      case 'Escape':
        this._store.clearSelection();
        this._store.setConnection({ active: false });
        break;
      case 'a':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this._store.setSelection([...this._store.nodes.keys()], [...this._store.edges.keys()]);
        }
        break;
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            this._redo();
          } else {
            this._undo();
          }
        }
        break;
      case 'y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this._redo();
        }
        break;
    }
  }

  _deleteSelected() {
    const snap = this._store.snapshot();
    let changed = false;

    for (const id of [...this._store.selectedEdgeIds]) {
      this._store.removeEdge(id);
      changed = true;
    }
    for (const id of [...this._store.selectedNodeIds]) {
      this._store.removeNode(id);
      changed = true;
    }

    if (changed) {
      this._history.push('Delete selected', snap);
      this._emitter.emit('selectionChange', { nodes: [], edges: [] });
    }
  }

  _undo() {
    const snap = this._history.undo();
    if (snap) {
      this._history.suspend(() => this._store.restoreSnapshot(snap.state));
    }
    this._emitter.emit('historyChange', this._history.status());
  }

  _redo() {
    const snap = this._history.redo();
    if (snap) {
      this._history.suspend(() => this._store.restoreSnapshot(snap.state));
    }
    this._emitter.emit('historyChange', this._history.status());
  }

  /** Unbind all events (call on destroy). */
  destroy() {
    window.removeEventListener('keydown', this._onKeyDownBound);
    window.removeEventListener('keyup',   this._onKeyUpBound);
  }

  /** @param {boolean} val */
  setReadonly(val) {
    this._options.readonly = val;
  }
}
