/**
 * @module NodeRenderer
 * Renders HTML node cards in the world-space node layer.
 * Supports custom type renderers, resize handles, and drag-resize.
 */

import { handlePosition } from '../utils/Geometry.js';

/**
 * @typedef {import('../models/Node.js').NodeModel} NodeModel
 * @typedef {(node: NodeModel, el: HTMLElement) => void} NodeRendererFn
 */

export class NodeRenderer {
  /**
   * @param {HTMLElement} layer
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

  /** Full reconciliation render */
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

    for (const [id, el] of this._els) {
      if (!seen.has(id)) {
        el.remove();
        this._els.delete(id);
      }
    }
  }

  /** @param {NodeModel} node */
  _createElement(node) {
    const el = document.createElement('div');
    el.className = 'jf-node';
    el.dataset.nodeId = node.id;
    el.dataset.nodeType = node.type;
    el.dataset.renderedWidth  = node.width;
    el.dataset.renderedHeight = node.height;
    el.style.cssText = `position:absolute;width:${node.width}px;min-height:${node.height}px;left:${node.x}px;top:${node.y}px;`;

    this._renderNodeContent(node, el);
    this._renderHandles(node, el);
    this._renderResizeHandle(node, el);

    this._layer.appendChild(el);
    this._els.set(node.id, el);

    // Sync actual rendered height to the model so edge endpoints land on the
    // visual card edge rather than inside it.
    this._scheduleHeightSync(node.id);
  }

  /** @param {string} nodeId */
  _scheduleHeightSync(nodeId) {
    requestAnimationFrame(() => {
      const el   = this._els.get(nodeId);
      const node = this._store.nodes.get(nodeId);
      if (!el || !node) return;
      const actualH = el.offsetHeight;
      if (actualH > 0 && actualH !== node.height) {
        this._store.updateNode(nodeId, { height: actualH });
      }
    });
  }

  /** @param {NodeModel} node */
  _updateElement(node) {
    const el = this._els.get(node.id);
    if (!el) return;

    el.style.left    = `${node.x}px`;
    el.style.top     = `${node.y}px`;

    const prevW = Number(el.dataset.renderedWidth);
    const prevH = Number(el.dataset.renderedHeight);
    const sizeChanged = prevW !== node.width || prevH !== node.height;

    el.style.width     = `${node.width}px`;
    el.style.minHeight = `${node.height}px`;
    el.dataset.renderedWidth  = node.width;
    el.dataset.renderedHeight = node.height;

    el.classList.toggle('jf-node--selected', !!node.selected);

    // Re-render only the body content
    const body = el.querySelector('.jf-node__body');
    if (body) {
      const renderer = this._registry.get(node.type);
      renderer ? renderer(node, body) : this._defaultContent(node, body);
    }

    // Re-render handles when dimensions changed so ports stay aligned
    if (sizeChanged) {
      this._renderHandles(node, el);
    }
  }

  /** @param {NodeModel} node  @param {HTMLElement} el */
  _renderNodeContent(node, el) {
    el.classList.toggle('jf-node--selected', !!node.selected);
    el.classList.add(`jf-node--${node.type}`);

    const body = document.createElement('div');
    body.className = 'jf-node__body';

    const renderer = this._registry.get(node.type);
    renderer ? renderer(node, body) : this._defaultContent(node, body);

    el.appendChild(body);
  }

  /** @param {NodeModel} node  @param {HTMLElement} body */
  _defaultContent(node, body) {
    body.innerHTML = '';
    const label = this._escapeHTML(node.data.label ?? node.type);
    const icon  = this._escapeHTML(node.data.icon  ?? '');
    const badge = this._escapeHTML(node.data.badge ?? '');
    const description = this._escapeHTML(node.data.description ?? '');
    const footerHtml = typeof node.data.footerHtml === 'string'
      ? this._sanitizeHTML(node.data.footerHtml)
      : '';
    const customHeaderHtml = typeof node.data.headerHtml === 'string'
      ? this._sanitizeHTML(node.data.headerHtml)
      : '';
    const inputPorts = node.ports.filter(port => port.type === 'target');
    const outputPorts = node.ports.filter(port => port.type === 'source');
    const inputRows = node.data.inputRows && typeof node.data.inputRows === 'object'
      ? node.data.inputRows
      : {};
    const outputRows = node.data.outputRows && typeof node.data.outputRows === 'object'
      ? node.data.outputRows
      : {};
    const hasLegacyRowOutputs = inputPorts.length === 1 && outputPorts.length > 1;
    const hasInputRows = Object.keys(inputRows).length > 0;
    const hasOutputRows = Object.keys(outputRows).length > 0;
    const showInputRows = hasInputRows;
    const showOutputRows = hasLegacyRowOutputs || hasOutputRows;
    const inputRowsMarkup = showInputRows
      ? inputPorts.map(port => `
          <div class="jf-node__row jf-node__row--input">
            <span class="jf-node__row-key">${this._escapeHTML(port.label ?? port.id)}</span>
            <span class="jf-node__row-value">${this._escapeHTML(inputRows[port.id] ?? '')}</span>
          </div>
        `).join('')
      : '';
    const outputRowsMarkup = showOutputRows
      ? outputPorts.map(port => `
          <div class="jf-node__row jf-node__row--output">
            <span class="jf-node__row-key">${this._escapeHTML(port.label ?? port.id)}</span>
            <span class="jf-node__row-value">${this._escapeHTML(outputRows[port.id] ?? '')}</span>
          </div>
        `).join('')
      : '';

    body.innerHTML = `
      <div class="jf-node__header">${customHeaderHtml || `
        ${icon ? `<span class="jf-node__icon">${icon}</span>` : ''}
        <span class="jf-node__title">${label}</span>
        ${badge ? `<span class="jf-node__badge">${badge}</span>` : ''}
      `}</div>
      ${description ? `<div class="jf-node__desc">${description}</div>` : ''}
      ${(showInputRows || showOutputRows) ? `
        <div class="jf-node__rows">
          ${inputRowsMarkup}
          ${outputRowsMarkup}
        </div>
      ` : ''}
      ${footerHtml ? `<div class="jf-node__desc jf-node__footer">${footerHtml}</div>` : ''}
    `;
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  _escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Minimal sanitization for optional node HTML sections.
   * @param {string} html
   * @returns {string}
   */
  _sanitizeHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const blockedTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta']);
    for (const el of template.content.querySelectorAll('*')) {
      if (blockedTags.has(el.tagName.toLowerCase())) {
        el.remove();
        continue;
      }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith('on') || value.startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      }
    }
    return template.innerHTML;
  }

  /** @param {NodeModel} node  @param {HTMLElement} el */
  _renderHandles(node, el) {
    for (const h of el.querySelectorAll('.jf-handle')) h.remove();

    const tempNode = { x: 0, y: 0, width: node.width, height: node.height };
    for (const port of node.ports) {
      const handle = document.createElement('div');
      handle.className = `jf-handle jf-handle--${port.type} jf-handle--${port.position}`;
      handle.dataset.handleId       = port.id;
      handle.dataset.handleType     = port.type;
      handle.dataset.handlePosition = port.position;
      handle.dataset.nodeId         = node.id;

      const pos = handlePosition(tempNode, port.position, port.offset);
      handle.style.left = `${pos.x}px`;
      handle.style.top  = `${pos.y}px`;

      if (port.label) {
        const lbl = document.createElement('span');
        lbl.className = 'jf-handle__label';
        lbl.textContent = port.label;
        handle.appendChild(lbl);
      }

      el.appendChild(handle);
    }
  }

  /**
   * Add a resize handle to the bottom-right corner.
   * @param {NodeModel} node  @param {HTMLElement} el
   */
  _renderResizeHandle(node, el) {
    const rh = document.createElement('div');
    rh.className = 'jf-node__resize-handle';
    rh.dataset.resizeNodeId = node.id;
    el.appendChild(rh);
  }

  refreshHandles(nodeId) {
    const node = this._store.nodes.get(nodeId);
    const el   = this._els.get(nodeId);
    if (!node || !el) return;
    this._renderHandles(node, el);
  }

  getElement(id) { return this._els.get(id); }

  destroy() {
    this._layer.innerHTML = '';
    this._els.clear();
  }
}

/**
 * @typedef {import('../models/Node.js').NodeModel} NodeModel
 * @typedef {(node: NodeModel, el: HTMLElement) => void} NodeRendererFn
 */
