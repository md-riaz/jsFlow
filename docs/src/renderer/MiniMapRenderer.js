/**
 * @module MiniMapRenderer
 * Renders a minimap overview of the entire graph.
 * Shows node positions and the current viewport window.
 */

import { nodeBoundingBox } from '../utils/Geometry.js';

const MINIMAP_W = 180;
const MINIMAP_H = 120;
const PADDING = 10;

export class MiniMapRenderer {
  /**
   * @param {HTMLElement} container - The flow editor root element
   * @param {import('../state/StateStore.js').StateStore} store
   * @param {import('../viewport/ViewportEngine.js').ViewportEngine} viewport
   */
  constructor(container, store, viewport) {
    this._store = store;
    this._viewport = viewport;

    this._el = document.createElement('div');
    this._el.className = 'jf-minimap';
    container.appendChild(this._el);

    this._canvas = document.createElement('canvas');
    this._canvas.width = MINIMAP_W;
    this._canvas.height = MINIMAP_H;
    this._el.appendChild(this._canvas);

    this._ctx = this._canvas.getContext('2d');
    this._visible = true;

    this._canvas.addEventListener('click', this._onMapClick.bind(this));
  }

  render() {
    if (!this._visible) return;
    const ctx = this._ctx;
    const nodes = [...this._store.nodes.values()];
    const bb = nodeBoundingBox(nodes);

    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

    // Background
    ctx.fillStyle = 'rgba(30,32,40,0.85)';
    ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

    if (!bb) return;

    const contentW = bb.width + PADDING * 2;
    const contentH = bb.height + PADDING * 2;
    const scale = Math.min((MINIMAP_W - PADDING * 2) / contentW, (MINIMAP_H - PADDING * 2) / contentH);
    const offsetX = PADDING + (MINIMAP_W - contentW * scale) / 2;
    const offsetY = PADDING + (MINIMAP_H - contentH * scale) / 2;

    const toMini = (wx, wy) => ({
      x: (wx - bb.x + PADDING) * scale + offsetX,
      y: (wy - bb.y + PADDING) * scale + offsetY,
    });

    // Draw nodes
    for (const node of nodes) {
      const { x, y } = toMini(node.x, node.y);
      const w = node.width * scale;
      const h = node.height * scale;

      ctx.fillStyle = node.selected ? '#4f7df3' : '#3a3d4d';
      ctx.strokeStyle = node.selected ? '#7ba0ff' : '#5a5e72';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, Math.max(h, 4), 2);
      ctx.fill();
      ctx.stroke();
    }

    // Draw viewport rectangle
    const vp = this._store.viewport;
    // Convert viewport bounds to world coordinates
    const { clientWidth: cw, clientHeight: ch } = this._canvas.parentElement.parentElement;
    const vpWorldX = -vp.x / vp.zoom;
    const vpWorldY = -vp.y / vp.zoom;
    const vpWorldW = cw / vp.zoom;
    const vpWorldH = ch / vp.zoom;

    const vpMini = toMini(vpWorldX, vpWorldY);
    ctx.strokeStyle = 'rgba(130,180,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vpMini.x, vpMini.y, vpWorldW * scale, vpWorldH * scale);
  }

  /** Handle clicking on the minimap to navigate. */
  _onMapClick(e) {
    const rect = this._canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const nodes = [...this._store.nodes.values()];
    const bb = nodeBoundingBox(nodes);
    if (!bb) return;

    const contentW = bb.width + PADDING * 2;
    const contentH = bb.height + PADDING * 2;
    const scale = Math.min((MINIMAP_W - PADDING * 2) / contentW, (MINIMAP_H - PADDING * 2) / contentH);
    const offsetX = PADDING + (MINIMAP_W - contentW * scale) / 2;
    const offsetY = PADDING + (MINIMAP_H - contentH * scale) / 2;

    const worldX = (cx - offsetX) / scale + bb.x - PADDING;
    const worldY = (cy - offsetY) / scale + bb.y - PADDING;

    const container = this._canvas.parentElement.parentElement;
    const { zoom } = this._store.viewport;
    this._store.setViewport({
      x: container.clientWidth / 2 - worldX * zoom,
      y: container.clientHeight / 2 - worldY * zoom,
    });
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    this._visible = visible;
    this._el.style.display = visible ? '' : 'none';
  }

  destroy() {
    this._el.remove();
  }
}
