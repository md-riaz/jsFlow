/**
 * @module CanvasRenderer
 * Orchestrates all rendering layers and schedules redraws via requestAnimationFrame.
 * Applies the viewport transform to the world-space layer.
 */

import { NodeRenderer } from './NodeRenderer.js';
import { EdgeRenderer } from './EdgeRenderer.js';
import { MiniMapRenderer } from './MiniMapRenderer.js';
import { handlePosition } from '../utils/Geometry.js';

const NS = 'http://www.w3.org/2000/svg';

export class CanvasRenderer {
  /**
   * @param {HTMLElement} container
   * @param {import('../state/StateStore.js').StateStore} store
   * @param {import('../viewport/ViewportEngine.js').ViewportEngine} viewportEngine
   * @param {{ grid?: boolean, minimap?: boolean }} options
   */
  constructor(container, store, viewportEngine, options = {}) {
    this._container = container;
    this._store = store;
    this._viewport = viewportEngine;
    this._options = options;
    this._rafId = null;
    this._dirty = false;

    this._buildDOM();

    this.nodes = new NodeRenderer(this._nodeLayer, store);
    this.edges = new EdgeRenderer(this._svg, store);
    this.minimap = options.minimap !== false
      ? new MiniMapRenderer(container, store, viewportEngine)
      : null;

    // Subscribe to state changes
    this._store.on('change', () => this.scheduleRender());
  }

  /** Build the DOM structure for the editor. */
  _buildDOM() {
    this._container.classList.add('jf-editor');

    // Interaction absorber (pointer events happen on this layer in screen space)
    this._hitLayer = document.createElement('div');
    this._hitLayer.className = 'jf-hit-layer';
    this._container.appendChild(this._hitLayer);

    // Viewport-transformed world layer
    this._worldLayer = document.createElement('div');
    this._worldLayer.className = 'jf-world-layer';
    this._container.appendChild(this._worldLayer);

    // Grid background (optional)
    if (this._options.grid !== false) {
      this._gridEl = document.createElement('div');
      this._gridEl.className = 'jf-grid';
      this._worldLayer.appendChild(this._gridEl);
    }

    // SVG layer for edges (behind nodes)
    this._svg = document.createElementNS(NS, 'svg');
    this._svg.classList.add('jf-svg-layer');
    this._svg.setAttribute('overflow', 'visible');
    this._worldLayer.appendChild(this._svg);

    // Node layer (in front of edges)
    this._nodeLayer = document.createElement('div');
    this._nodeLayer.className = 'jf-node-layer';
    this._worldLayer.appendChild(this._nodeLayer);

    // Selection marquee layer (screen-space overlay)
    this._marqueeEl = document.createElement('div');
    this._marqueeEl.className = 'jf-marquee';
    this._container.appendChild(this._marqueeEl);
  }

  /**
   * Schedule a render on the next animation frame (deduplicates multiple triggers).
   */
  scheduleRender() {
    if (this._dirty) return;
    this._dirty = true;
    this._rafId = requestAnimationFrame(() => {
      this._dirty = false;
      this._render();
    });
  }

  /** Synchronously perform a full render cycle. */
  _render() {
    this._applyViewportTransform();
    this.nodes.render();
    this.edges.render();
    this._renderMarquee();
    this._renderConnectionPreview();
    if (this.minimap) this.minimap.render();
  }

  /** Apply viewport CSS transform to the world layer. */
  _applyViewportTransform() {
    this._worldLayer.style.transform = this._viewport.cssTransform();
  }

  /** Update the marquee selection box. */
  _renderMarquee() {
    const m = this._store.marquee;
    if (!m.active) {
      this._marqueeEl.style.display = 'none';
      return;
    }
    this._marqueeEl.style.display = '';
    const x = m.width >= 0 ? m.x : m.x + m.width;
    const y = m.height >= 0 ? m.y : m.y + m.height;
    const w = Math.abs(m.width);
    const h = Math.abs(m.height);
    Object.assign(this._marqueeEl.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
  }

  /** Render the live edge-connection preview. */
  _renderConnectionPreview() {
    const conn = this._store.connection;
    if (!conn.active) {
      this.edges.hidePreview();
      return;
    }
    const srcNode = this._store.nodes.get(conn.sourceNodeId);
    if (!srcNode) return;

    const srcPort = srcNode.ports.find(p => p.id === conn.sourceHandle);
    const srcPos = srcPort?.position ?? 'bottom';
    const src = handlePosition(srcNode, srcPos);
    const tgt = { x: conn.x, y: conn.y };

    this.edges.renderPreview(src, tgt, srcPos);
  }

  /**
   * Register a custom node renderer.
   * @param {string} type
   * @param {Function} fn
   */
  registerNodeType(type, fn) {
    this.nodes.registerNodeType(type, fn);
  }

  /**
   * Register a custom edge renderer.
   * @param {string} type
   * @param {Function} fn
   */
  registerEdgeType(type, fn) {
    this.edges.registerEdgeType(type, fn);
  }

  /** Destroy all rendered content. */
  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.nodes.destroy();
    this.edges.destroy();
    if (this.minimap) this.minimap.destroy();
    this._container.innerHTML = '';
    this._container.classList.remove('jf-editor');
  }

  /** @returns {HTMLElement} The interaction hit layer */
  get hitLayer() { return this._hitLayer; }
}
