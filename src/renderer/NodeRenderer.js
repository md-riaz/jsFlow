/**
 * @module NodeRenderer
 * Renders HTML node cards in the world-space node layer.
 * Supports custom node type renderers via a registry.
 */

import { handlePosition } from '../utils/Geometry.js';

/**
 * @typedef {import('../models/Node.js').NodeModel} NodeModel
 * @typedef {(node: NodeModel, el: HTMLElement) => void} NodeRendererFn
 */

export class NodeRenderer {
  /**
   * @param {HTMLElement} layer        - The node layer div (in world space)
   * @param {import('../state/StateStore.js').StateStore} store
   */
  constructor(layer, store) {
    this._layer = layer;
    this._store = store;
    /** @type {Map<string, HTMLElement>} */
    this._els = new Map();
    /** @type {Map<string, NodeRendererFn>} */
    this._registry = new Map();
  }

  /**
   * Register a custom renderer for a node type.
   * @param {string} type
   * @param {NodeRendererFn} fn
   */
  registerNodeType(type, fn) {
    this._registry.set(type, fn);
  }

  /**
   * Full reconciliation render — called when the graph structure changes.
   */
  render() {
    const nodes = this._store.nodes;
    const seen = new Set();

    for (const [id, node] of nodes) {
      seen.add(id);
      if (!this._els.has(id)) {
        this._createElement(node);
      } else {
        this._updateElement(node);
      }
    }

    // Remove stale elements
    for (const [id, el] of this._els) {
      if (!seen.has(id)) {
        el.remove();
        this._els.delete(id);
      }
    }
  }

  /**
   * Create and insert a DOM element for a node.
   * @param {NodeModel} node
   */
  _createElement(node) {
    const el = document.createElement('div');
    el.className = 'jf-node';
    el.dataset.nodeId = node.id;
    el.dataset.nodeType = node.type;
    el.style.cssText = `
      position: absolute;
      width: ${node.width}px;
      min-height: ${node.height}px;
      left: ${node.x}px;
      top: ${node.y}px;
    `;

    this._renderNodeContent(node, el);
    this._renderHandles(node, el);

    this._layer.appendChild(el);
    this._els.set(node.id, el);
  }

  /**
   * Update an existing element's position, content and selected state.
   * @param {NodeModel} node
   */
  _updateElement(node) {
    const el = this._els.get(node.id);
    if (!el) return;

    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.width}px`;

    el.classList.toggle('jf-node--selected', node.selected);

    // Re-render content (only the body, handles stay)
    const body = el.querySelector('.jf-node__body');
    if (body) {
      const renderer = this._registry.get(node.type);
      if (renderer) {
        renderer(node, body);
      } else {
        this._defaultContent(node, body);
      }
    }
  }

  /**
   * Render node body using custom renderer or default template.
   * @param {NodeModel} node
   * @param {HTMLElement} el
   */
  _renderNodeContent(node, el) {
    el.classList.toggle('jf-node--selected', node.selected);
    el.classList.add(`jf-node--${node.type}`);

    const body = document.createElement('div');
    body.className = 'jf-node__body';

    const renderer = this._registry.get(node.type);
    if (renderer) {
      renderer(node, body);
    } else {
      this._defaultContent(node, body);
    }

    el.appendChild(body);
  }

  /**
   * Default node body template.
   * @param {NodeModel} node
   * @param {HTMLElement} body
   */
  _defaultContent(node, body) {
    body.innerHTML = '';

    const label = node.data.label ?? node.type;
    const icon = node.data.icon ?? '';

    body.innerHTML = `
      <div class="jf-node__header">
        ${icon ? `<span class="jf-node__icon">${icon}</span>` : ''}
        <span class="jf-node__title">${label}</span>
      </div>
      ${node.data.description ? `<div class="jf-node__desc">${node.data.description}</div>` : ''}
    `;
  }

  /**
   * Render port handles onto a node element.
   * @param {NodeModel} node
   * @param {HTMLElement} el
   */
  _renderHandles(node, el) {
    // Remove any stale handles first
    for (const h of el.querySelectorAll('.jf-handle')) h.remove();

    const tempNode = { x: 0, y: 0, width: node.width, height: node.height };
    for (const port of node.ports) {
      const handle = document.createElement('div');
      handle.className = `jf-handle jf-handle--${port.type} jf-handle--${port.position}`;
      handle.dataset.handleId = port.id;
      handle.dataset.handleType = port.type;
      handle.dataset.handlePosition = port.position;
      handle.dataset.nodeId = node.id;

      const pos = handlePosition(tempNode, port.position);
      handle.style.left = `${pos.x}px`;
      handle.style.top = `${pos.y}px`;

      el.appendChild(handle);
    }
  }

  /**
   * Re-render handles only (after geometry change etc.)
   * @param {string} nodeId
   */
  refreshHandles(nodeId) {
    const node = this._store.nodes.get(nodeId);
    const el = this._els.get(nodeId);
    if (!node || !el) return;
    this._renderHandles(node, el);
  }

  /**
   * Get the DOM element for a node.
   * @param {string} id
   * @returns {HTMLElement|undefined}
   */
  getElement(id) {
    return this._els.get(id);
  }

  /**
   * Destroy all node elements.
   */
  destroy() {
    this._layer.innerHTML = '';
    this._els.clear();
  }
}
