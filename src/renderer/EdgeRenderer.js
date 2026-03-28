/**
 * @module EdgeRenderer
 * Renders SVG edges (bezier / smooth-step / straight) in the world-space SVG layer.
 * Supports: arrowhead markers, animated edges, labels, custom edge renderers, live preview.
 */

import { bezierPath, smoothStepPath, handlePosition } from '../utils/Geometry.js';

/**
 * @typedef {import('../models/Edge.js').EdgeModel} EdgeModel
 * @typedef {import('../models/Node.js').NodeModel} NodeModel
 * @typedef {(edge: EdgeModel, source: {x:number,y:number}, target: {x:number,y:number}) => string} EdgePathFn
 */

const NS = 'http://www.w3.org/2000/svg';

/** Default arrowhead marker ID prefix */
const MARKER_DEFAULT = 'jf-arrow-default';
const MARKER_SELECTED = 'jf-arrow-selected';

export class EdgeRenderer {
  /**
   * @param {SVGSVGElement} svg
   * @param {import('../state/StateStore.js').StateStore} store
   * @param {HTMLElement} [labelLayer]
   */
  constructor(svg, store, labelLayer) {
    this._svg = svg;
    this._store = store;
    this._labelLayer = labelLayer ?? null;
    /** @type {Map<string, SVGGElement>} */
    this._els = new Map();
    /** @type {Map<string, HTMLElement>} */
    this._labelEls = new Map();
    /** @type {Map<string, EdgePathFn>} */
    this._registry = new Map();
    /** @type {SVGPathElement|null} */
    this._previewPath = null;

    this._setupDefs();

    /** @type {SVGGElement} */
    this._edgeGroup = this._createGroup('jf-edges');
    /** @type {SVGGElement} */
    this._previewGroup = this._createGroup('jf-edge-preview');
  }

  // ── Arrowhead defs ────────────────────────────────────────────────────────

  _setupDefs() {
    const defs = document.createElementNS(NS, 'defs');

    // Default arrowhead (grey)
    defs.appendChild(this._makeMarker(MARKER_DEFAULT, '#4a5080'));
    // Selected arrowhead (blue)
    defs.appendChild(this._makeMarker(MARKER_SELECTED, '#4f7df3'));
    // Animated arrowhead (lighter blue)
    defs.appendChild(this._makeMarker('jf-arrow-animated', '#7ba0ff'));

    this._svg.insertBefore(defs, this._svg.firstChild);
    this._defs = defs;
  }

  /**
   * Create an SVG arrowhead marker element.
   * @param {string} id
   * @param {string} color
   * @returns {SVGMarkerElement}
   */
  _makeMarker(id, color) {
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);
    return marker;
  }

  /**
   * Ensure a custom-colour arrowhead marker exists in defs.
   * @param {string} color
   * @returns {string} marker id
   */
  _ensureColorMarker(color) {
    const id = `jf-arrow-${color.replace(/[^a-z0-9]/gi, '')}`;
    if (!this._svg.getElementById(id)) {
      this._defs.appendChild(this._makeMarker(id, color));
    }
    return id;
  }

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a custom path renderer for an edge type.
   * @param {string} type
   * @param {EdgePathFn} fn
   */
  registerEdgeType(type, fn) {
    this._registry.set(type, fn);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  /**
   * Full reconciliation render of all edges.
   */
  render() {
    const edges = this._store.edges;
    const seen = new Set();

    for (const [id, edge] of edges) {
      seen.add(id);
      const sourceNode = this._store.nodes.get(edge.source);
      const targetNode = this._store.nodes.get(edge.target);
      if (!sourceNode || !targetNode) continue;

      if (!this._els.has(id)) {
        this._createElement(edge, sourceNode, targetNode);
      } else {
        this._updateElement(edge, sourceNode, targetNode);
      }
    }

    // Remove stale edge groups
    for (const [id, g] of this._els) {
      if (!seen.has(id)) {
        g.remove();
        const labelEl = this._labelEls.get(id);
        if (labelEl) {
          labelEl.remove();
          this._labelEls.delete(id);
        }
        this._els.delete(id);
      }
    }
  }

  /**
   * Create SVG group for an edge.
   * @param {EdgeModel} edge
   * @param {NodeModel} sourceNode
   * @param {NodeModel} targetNode
   */
  _createElement(edge, sourceNode, targetNode) {
    const g = document.createElementNS(NS, 'g');
    g.classList.add('jf-edge');
    g.dataset.edgeId = edge.id;

    // Invisible wide hit area
    const hitPath = document.createElementNS(NS, 'path');
    hitPath.classList.add('jf-edge__hit');
    hitPath.dataset.edgeId = edge.id;

    // Visible path
    const visPath = document.createElementNS(NS, 'path');
    visPath.classList.add('jf-edge__path');
    visPath.dataset.edgeId = edge.id;

    g.appendChild(hitPath);
    g.appendChild(visPath);

    this._edgeGroup.appendChild(g);
    this._els.set(edge.id, g);
    this._updateElement(edge, sourceNode, targetNode);
  }

  /**
   * Update an existing edge SVG group.
   * @param {EdgeModel} edge
   * @param {NodeModel} sourceNode
   * @param {NodeModel} targetNode
   */
  _updateElement(edge, sourceNode, targetNode) {
    const g = this._els.get(edge.id);
    if (!g) return;

    const srcPort = sourceNode.ports.find(p => p.id === edge.sourceHandle) ?? { position: 'bottom' };
    const tgtPort = targetNode.ports.find(p => p.id === edge.targetHandle) ?? { position: 'top' };

    const src = handlePosition(sourceNode, srcPort.position, srcPort.offset);
    const tgt = handlePosition(targetNode, tgtPort.position, tgtPort.offset);
    const d = this._computePath(edge, src, tgt, srcPort.position, tgtPort.position);

    const hitPath = g.querySelector('.jf-edge__hit');
    const visPath = g.querySelector('.jf-edge__path');
    hitPath.setAttribute('d', d);
    visPath.setAttribute('d', d);

    // Selection + animation classes
    g.classList.toggle('jf-edge--selected', !!edge.selected);
    g.classList.toggle('jf-edge--animated', !!edge.animated);

    // Arrowhead marker
    if (edge.markerEnd !== false) {
      let markerId;
      if (edge.markerColor) {
        markerId = this._ensureColorMarker(edge.markerColor);
      } else if (edge.selected) {
        markerId = MARKER_SELECTED;
      } else if (edge.animated) {
        markerId = 'jf-arrow-animated';
      } else {
        markerId = MARKER_DEFAULT;
      }
      visPath.setAttribute('marker-end', `url(#${markerId})`);
    } else {
      visPath.removeAttribute('marker-end');
    }

    this._syncLabel(edge, src, tgt);
  }

  /**
   * Compute the SVG path string for an edge.
   * @param {EdgeModel} edge
   * @param {{ x: number, y: number }} src
   * @param {{ x: number, y: number }} tgt
   * @param {string} srcPos
   * @param {string} tgtPos
   * @returns {string}
   */
  _computePath(edge, src, tgt, srcPos, tgtPos) {
    const custom = this._registry.get(edge.type);
    if (custom) return custom(edge, src, tgt);

    switch (edge.type) {
      case 'smoothstep':
        return smoothStepPath(src, tgt, srcPos, tgtPos);
      case 'straight':
        return `M${src.x},${src.y} L${tgt.x},${tgt.y}`;
      default: // bezier
        return bezierPath(src, tgt, srcPos, tgtPos);
    }
  }

  // ── Connection preview ────────────────────────────────────────────────────

  /**
   * Render the live connection-preview path.
   * @param {{ x: number, y: number }} src
   * @param {{ x: number, y: number }} tgt
   * @param {string} [srcPos='bottom']
   */
  renderPreview(src, tgt, srcPos = 'bottom') {
    if (!this._previewPath) {
      this._previewPath = document.createElementNS(NS, 'path');
      this._previewPath.classList.add('jf-edge__preview');
      this._previewGroup.appendChild(this._previewPath);
    }
    const d = bezierPath(src, tgt, srcPos, 'top');
    this._previewPath.setAttribute('d', d);
    this._previewPath.style.display = '';
  }

  /** Hide the preview path. */
  hidePreview() {
    if (this._previewPath) {
      this._previewPath.style.display = 'none';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * @param {string} className
   * @returns {SVGGElement}
   */
  _createGroup(className) {
    const g = document.createElementNS(NS, 'g');
    g.classList.add(className);
    this._svg.appendChild(g);
    return g;
  }

  /**
   * Keep edge labels in a dedicated HTML layer so they always render above nodes.
   * @param {EdgeModel} edge
   * @param {{ x: number, y: number }} src
   * @param {{ x: number, y: number }} tgt
   */
  _syncLabel(edge, src, tgt) {
    if (!this._labelLayer) return;
    const existing = this._labelEls.get(edge.id);
    if (!edge.label) {
      if (existing) {
        existing.remove();
        this._labelEls.delete(edge.id);
      }
      return;
    }

    const midX = (src.x + tgt.x) / 2;
    const midY = (src.y + tgt.y) / 2;
    const labelEl = existing ?? document.createElement('div');
    if (!existing) {
      labelEl.className = 'jf-edge__label jf-edge__label--floating';
      this._labelLayer.appendChild(labelEl);
      this._labelEls.set(edge.id, labelEl);
    }
    labelEl.textContent = edge.label;
    labelEl.style.left = `${midX}px`;
    labelEl.style.top = `${midY}px`;
  }

  /** Destroy all edge SVG elements. */
  destroy() {
    this._edgeGroup.innerHTML = '';
    this._previewGroup.innerHTML = '';
    for (const labelEl of this._labelEls.values()) labelEl.remove();
    this._labelEls.clear();
    this._els.clear();
    this._previewPath = null;
  }
}
