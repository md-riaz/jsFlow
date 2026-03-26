/**
 * @module ViewportEngine
 * Manages viewport pan/zoom state and coordinate transforms.
 * All viewport mutations go through this engine to ensure correct math.
 */

import { clamp, screenToWorld, worldToScreen, nodeBoundingBox } from '../utils/Geometry.js';

/** @typedef {{ x: number, y: number, zoom: number }} Viewport */

export class ViewportEngine {
  /**
   * @param {import('../state/StateStore.js').StateStore} store
   * @param {{ minZoom: number, maxZoom: number }} options
   */
  constructor(store, { minZoom = 0.1, maxZoom = 3 } = {}) {
    this._store = store;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
  }

  /** @returns {Viewport} */
  get viewport() { return this._store.viewport; }

  /**
   * Pan the canvas by a screen-space delta.
   * @param {number} dx
   * @param {number} dy
   */
  pan(dx, dy) {
    this._store.setViewport({
      x: this.viewport.x + dx,
      y: this.viewport.y + dy,
    });
  }

  /**
   * Zoom centred on a screen-space point.
   * @param {number} delta   - Positive = zoom in
   * @param {number} screenX
   * @param {number} screenY
   */
  zoomAt(delta, screenX, screenY) {
    const { x, y, zoom } = this.viewport;
    const factor = 1 + delta;
    const newZoom = clamp(zoom * factor, this.minZoom, this.maxZoom);
    if (newZoom === zoom) return;

    // Keep the world-space point under the cursor stationary
    const wx = (screenX - x) / zoom;
    const wy = (screenY - y) / zoom;
    this._store.setViewport({
      zoom: newZoom,
      x: screenX - wx * newZoom,
      y: screenY - wy * newZoom,
    });
  }

  /**
   * Set zoom to an exact level, optionally anchored on a screen point.
   * @param {number} zoom
   * @param {number} [screenX]
   * @param {number} [screenY]
   */
  zoomTo(zoom, screenX, screenY) {
    const clamped = clamp(zoom, this.minZoom, this.maxZoom);
    const current = this.viewport;
    if (screenX !== undefined && screenY !== undefined) {
      const wx = (screenX - current.x) / current.zoom;
      const wy = (screenY - current.y) / current.zoom;
      this._store.setViewport({
        zoom: clamped,
        x: screenX - wx * clamped,
        y: screenY - wy * clamped,
      });
    } else {
      this._store.setViewport({ zoom: clamped });
    }
  }

  /**
   * Fit all nodes into the visible container.
   * @param {HTMLElement} container
   * @param {number} [padding=40]
   */
  fitView(container, padding = 40) {
    const nodes = [...this._store.nodes.values()];
    if (!nodes.length) return;

    const bb = nodeBoundingBox(nodes);
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const scaleX = (cw - padding * 2) / bb.width;
    const scaleY = (ch - padding * 2) / bb.height;
    const zoom = clamp(Math.min(scaleX, scaleY), this.minZoom, this.maxZoom);

    const x = cw / 2 - (bb.x + bb.width / 2) * zoom;
    const y = ch / 2 - (bb.y + bb.height / 2) * zoom;

    this._store.setViewport({ x, y, zoom });
  }

  /**
   * Center the view on the centroid of all nodes without changing zoom.
   * @param {HTMLElement} container
   */
  centerView(container) {
    const nodes = [...this._store.nodes.values()];
    if (!nodes.length) return;

    const bb = nodeBoundingBox(nodes);
    const { zoom } = this.viewport;
    const x = container.clientWidth / 2 - (bb.x + bb.width / 2) * zoom;
    const y = container.clientHeight / 2 - (bb.y + bb.height / 2) * zoom;

    this._store.setViewport({ x, y });
  }

  /**
   * Reset viewport to default (zoom=1, centered at origin).
   */
  reset() {
    this._store.setViewport({ x: 0, y: 0, zoom: 1 });
  }

  /**
   * Convert screen coordinates to world coordinates.
   * @param {number} sx
   * @param {number} sy
   * @returns {{ x: number, y: number }}
   */
  toWorld(sx, sy) {
    return screenToWorld(sx, sy, this.viewport);
  }

  /**
   * Convert world coordinates to screen coordinates.
   * @param {number} wx
   * @param {number} wy
   * @returns {{ x: number, y: number }}
   */
  toScreen(wx, wy) {
    return worldToScreen(wx, wy, this.viewport);
  }

  /**
   * Return a CSS transform string for the world-space layer.
   * @returns {string}
   */
  cssTransform() {
    const { x, y, zoom } = this.viewport;
    return `translate(${x}px, ${y}px) scale(${zoom})`;
  }
}
