/**
 * @module CanvasRenderer
 * Orchestrates all rendering layers and schedules redraws via requestAnimationFrame.
 * Applies the viewport transform to the world-space layer.
 */

import { NodeRenderer }   from './NodeRenderer.js';
import { EdgeRenderer }   from './EdgeRenderer.js';
import { MiniMapRenderer } from './MiniMapRenderer.js';
import { handlePosition } from '../utils/Geometry.js';

const NS = 'http://www.w3.org/2000/svg';

/**
 * @typedef {'dots'|'lines'|'cross'|'none'} BackgroundVariant
 */

export class CanvasRenderer {
  /**
   * @param {HTMLElement} container
   * @param {import('../state/StateStore.js').StateStore} store
   * @param {import('../viewport/ViewportEngine.js').ViewportEngine} viewportEngine
   * @param {{ grid?: boolean|BackgroundVariant, minimap?: boolean }} options
   */
  constructor(container, store, viewportEngine, options = {}) {
    this._container    = container;
    this._store        = store;
    this._viewport     = viewportEngine;
    this._options      = options;
    this._rafId        = null;
    this._dirty        = false;

    this._buildDOM();

    this.nodes   = new NodeRenderer(this._nodeLayer, store);
    this.edges   = new EdgeRenderer(this._svg, store);
    this.minimap = options.minimap !== false
      ? new MiniMapRenderer(container, store, viewportEngine)
      : null;

    this._store.on('change', () => this.scheduleRender());
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  _buildDOM() {
    this._container.classList.add('jf-editor');

    this._hitLayer = document.createElement('div');
    this._hitLayer.className = 'jf-hit-layer';
    this._container.appendChild(this._hitLayer);

    this._worldLayer = document.createElement('div');
    this._worldLayer.className = 'jf-world-layer';
    this._container.appendChild(this._worldLayer);

    // Background
    const bg = this._options.grid;
    if (bg && bg !== 'none') {
      this._bgEl = document.createElement('div');
      const variant = typeof bg === 'string' ? bg : 'lines';
      this._bgEl.className = `jf-bg jf-bg--${variant}`;
      this._worldLayer.appendChild(this._bgEl);
    }

    // SVG edge layer
    this._svg = document.createElementNS(NS, 'svg');
    this._svg.classList.add('jf-svg-layer');
    this._svg.setAttribute('overflow', 'visible');
    this._worldLayer.appendChild(this._svg);

    // Node layer
    this._nodeLayer = document.createElement('div');
    this._nodeLayer.className = 'jf-node-layer';
    this._worldLayer.appendChild(this._nodeLayer);

    // Context menu overlay (screen-space)
    this._contextMenu = document.createElement('div');
    this._contextMenu.className = 'jf-context-menu';
    this._contextMenu.style.display = 'none';
    this._container.appendChild(this._contextMenu);

    // Marquee
    this._marqueeEl = document.createElement('div');
    this._marqueeEl.className = 'jf-marquee';
    this._container.appendChild(this._marqueeEl);
  }

  // ── Scheduling ────────────────────────────────────────────────────────────

  scheduleRender() {
    if (this._dirty) return;
    this._dirty = true;
    this._rafId = requestAnimationFrame(() => {
      this._dirty = false;
      this._render();
    });
  }

  _render() {
    this._applyViewportTransform();
    this.nodes.render();
    this.edges.render();
    this._renderMarquee();
    this._renderConnectionPreview();
    if (this.minimap) this.minimap.render();
  }

  _applyViewportTransform() {
    this._worldLayer.style.transform = this._viewport.cssTransform();
  }

  _renderMarquee() {
    const m = this._store.marquee;
    if (!m.active) { this._marqueeEl.style.display = 'none'; return; }
    this._marqueeEl.style.display = '';
    const x = m.width  >= 0 ? m.x : m.x + m.width;
    const y = m.height >= 0 ? m.y : m.y + m.height;
    Object.assign(this._marqueeEl.style, {
      left: `${x}px`,
      top:  `${y}px`,
      width:  `${Math.abs(m.width)}px`,
      height: `${Math.abs(m.height)}px`,
    });
  }

  _renderConnectionPreview() {
    const conn = this._store.connection;
    if (!conn.active) { this.edges.hidePreview(); return; }
    const srcNode = this._store.nodes.get(conn.sourceNodeId);
    if (!srcNode) return;
    const srcPort = srcNode.ports.find(p => p.id === conn.sourceHandle);
    const srcPos  = srcPort?.position ?? 'bottom';
    const src = handlePosition(srcNode, srcPos);
    this.edges.renderPreview(src, { x: conn.x, y: conn.y }, srcPos);
  }

  // ── Context menu ──────────────────────────────────────────────────────────

  /**
   * Show a context menu.
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @param {Array<{ label: string, action: Function, disabled?: boolean, separator?: boolean }>} items
   */
  showContextMenu(x, y, items) {
    const menu = this._contextMenu;
    menu.innerHTML = '';

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'jf-context-menu__sep';
        menu.appendChild(sep);
        continue;
      }
      const btn = document.createElement('button');
      btn.className = 'jf-context-menu__item';
      btn.textContent = item.label;
      if (item.disabled) btn.disabled = true;
      btn.addEventListener('click', () => {
        this.hideContextMenu();
        item.action();
      });
      menu.appendChild(btn);
    }

    // Position, keeping inside viewport
    menu.style.display = '';
    menu.style.left = `${x}px`;
    menu.style.top  = `${y}px`;
    menu.style.opacity = '0';
    requestAnimationFrame(() => {
      const { width: mw, height: mh } = menu.getBoundingClientRect();
      const cw = this._container.clientWidth;
      const ch = this._container.clientHeight;
      menu.style.left = `${Math.min(x, cw - mw - 8)}px`;
      menu.style.top  = `${Math.min(y, ch - mh - 8)}px`;
      menu.style.opacity = '1';
    });
  }

  hideContextMenu() {
    this._contextMenu.style.display = 'none';
  }

  // ── Registration helpers ──────────────────────────────────────────────────

  registerNodeType(type, fn)  { this.nodes.registerNodeType(type, fn); }
  registerEdgeType(type, fn)  { this.edges.registerEdgeType(type, fn); }

  // ── Accessors ─────────────────────────────────────────────────────────────

  get hitLayer() { return this._hitLayer; }

  // ── Destroy ───────────────────────────────────────────────────────────────

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.nodes.destroy();
    this.edges.destroy();
    if (this.minimap) this.minimap.destroy();
    this._container.innerHTML = '';
    this._container.classList.remove('jf-editor');
  }
}