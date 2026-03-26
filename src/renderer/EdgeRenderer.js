/**
 * @module EdgeRenderer
 * Renders SVG edges (bezier / smooth-step / straight) in the world-space SVG layer.
 * Supports custom edge renderers and a live connection-preview path.
 */

import { bezierPath, smoothStepPath, handlePosition } from '../utils/Geometry.js';

/**
 * @typedef {import('../models/Edge.js').EdgeModel} EdgeModel
 * @typedef {import('../models/Node.js').NodeModel} NodeModel
 * @typedef {(edge: EdgeModel, source: {x:number,y:number}, target: {x:number,y:number}) => string} EdgePathFn
 */

const NS = 'http://www.w3.org/2000/svg';

export class EdgeRenderer {
  /**
   * @param {SVGSVGElement} svg
   * @param {import('../state/StateStore.js').StateStore} store
   */
  constructor(svg, store) {
    this._svg = svg;
    this._store = store;
    /** @type {Map<string, SVGGElement>} */
    this._els = new Map();
    /** @type {Map<string, EdgePathFn>} */
    this._registry = new Map();
    /** @type {SVGPathElement|null} */
    this._previewPath = null;
    /** @type {SVGGElement} */
    this._edgeGroup = this._createGroup('jf-edges');
    /** @type {SVGGElement} */
    this._previewGroup = this._createGroup('jf-edge-preview');
  }

  /**
   * Register a custom path renderer for an edge type.
   * @param {string} type
   * @param {EdgePathFn} fn
   */
  registerEdgeType(type, fn) {
    this._registry.set(type, fn);
  }

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

    // Optional label
    const labelGroup = document.createElementNS(NS, 'g');
    labelGroup.classList.add('jf-edge__label-group');
    g.appendChild(labelGroup);

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

    const src = handlePosition(sourceNode, srcPort.position);
    const tgt = handlePosition(targetNode, tgtPort.position);
    const d = this._computePath(edge, src, tgt, srcPort.position, tgtPort.position);

    const hitPath = g.querySelector('.jf-edge__hit');
    const visPath = g.querySelector('.jf-edge__path');
    hitPath.setAttribute('d', d);
    visPath.setAttribute('d', d);

    g.classList.toggle('jf-edge--selected', edge.selected);

    // Label
    const labelGroup = g.querySelector('.jf-edge__label-group');
    labelGroup.innerHTML = '';
    if (edge.label) {
      const midX = (src.x + tgt.x) / 2;
      const midY = (src.y + tgt.y) / 2;
      const fo = document.createElementNS(NS, 'foreignObject');
      fo.setAttribute('width', '120');
      fo.setAttribute('height', '28');
      fo.setAttribute('x', String(midX - 60));
      fo.setAttribute('y', String(midY - 14));
      const div = document.createElement('div');
      div.className = 'jf-edge__label';
      div.textContent = edge.label;
      fo.appendChild(div);
      labelGroup.appendChild(fo);
    }
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

  /** Destroy all edge SVG elements. */
  destroy() {
    this._edgeGroup.innerHTML = '';
    this._previewGroup.innerHTML = '';
    this._els.clear();
    this._previewPath = null;
  }
}
