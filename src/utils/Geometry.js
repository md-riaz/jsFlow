/**
 * @module Geometry
 * Pure math utilities for coordinate transformations and Bezier path generation.
 */

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ x: number, y: number, zoom: number }} Viewport
 */

/**
 * Convert screen (pixel) coordinates to world (canvas) coordinates.
 * @param {number} screenX
 * @param {number} screenY
 * @param {Viewport} viewport
 * @returns {Point}
 */
export function screenToWorld(screenX, screenY, viewport) {
  return {
    x: (screenX - viewport.x) / viewport.zoom,
    y: (screenY - viewport.y) / viewport.zoom,
  };
}

/**
 * Convert world (canvas) coordinates to screen (pixel) coordinates.
 * @param {number} worldX
 * @param {number} worldY
 * @param {Viewport} viewport
 * @returns {Point}
 */
export function worldToScreen(worldX, worldY, viewport) {
  return {
    x: worldX * viewport.zoom + viewport.x,
    y: worldY * viewport.zoom + viewport.y,
  };
}

/**
 * Clamp a value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get the center point of a node bounding box.
 * @param {{ x: number, y: number, width: number, height: number }} node
 * @returns {Point}
 */
export function nodeCenter(node) {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

/**
 * Compute the connection anchor point for a given handle position on a node.
 * Handle positions: 'top' | 'bottom' | 'left' | 'right'
 * @param {{ x: number, y: number, width: number, height: number }} node
 * @param {string} position
 * @param {number} [offset=0.5] - Normalised offset (0..1) along the edge for top/bottom (X) or left/right (Y)
 * @returns {Point}
 */
export function handlePosition(node, position, offset = 0.5) {
  const clampOffset = Math.min(1, Math.max(0, offset));
  switch (position) {
    case 'top':
      return { x: node.x + node.width * clampOffset, y: node.y };
    case 'bottom':
      return { x: node.x + node.width * clampOffset, y: node.y + node.height };
    case 'left':
      return { x: node.x, y: node.y + node.height * clampOffset };
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height * clampOffset };
    default:
      return nodeCenter(node);
  }
}

/**
 * Generate a smooth cubic Bezier SVG path string between two points.
 * Automatically determines control-point offsets from source/target handle sides.
 * @param {Point} source
 * @param {Point} target
 * @param {string} [sourcePos='bottom']
 * @param {string} [targetPos='top']
 * @returns {string} SVG path d attribute
 */
export function bezierPath(source, target, sourcePos = 'bottom', targetPos = 'top') {
  const dx = Math.abs(target.x - source.x);
  const dy = Math.abs(target.y - source.y);
  const offset = Math.max(50, Math.min(Math.max(dx, dy) * 0.5, 200));

  const cp1 = { ...source };
  const cp2 = { ...target };

  switch (sourcePos) {
    case 'right':  cp1.x += offset; break;
    case 'left':   cp1.x -= offset; break;
    case 'bottom': cp1.y += offset; break;
    case 'top':    cp1.y -= offset; break;
  }

  switch (targetPos) {
    case 'left':   cp2.x -= offset; break;
    case 'right':  cp2.x += offset; break;
    case 'top':    cp2.y -= offset; break;
    case 'bottom': cp2.y += offset; break;
  }

  return `M${source.x},${source.y} C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${target.x},${target.y}`;
}

/**
 * Generate a smooth-step (rounded right-angle) SVG path between two points.
 * @param {Point} source
 * @param {Point} target
 * @param {string} [sourcePos='bottom']
 * @param {string} [targetPos='top']
 * @returns {string}
 */
export function smoothStepPath(source, target, sourcePos = 'bottom', targetPos = 'top') {
  const r = 8; // corner radius
  const midY = (source.y + target.y) / 2;
  const midX = (source.x + target.x) / 2;

  if (sourcePos === 'bottom' || sourcePos === 'top') {
    // vertical flow
    const sy = sourcePos === 'bottom' ? source.y + 20 : source.y - 20;
    const ty = targetPos === 'top' ? target.y - 20 : target.y + 20;
    return (
      `M${source.x},${source.y}` +
      `L${source.x},${midY - r}` +
      `Q${source.x},${midY} ${source.x > target.x ? source.x - r : source.x + r},${midY}` +
      `L${target.x > source.x ? target.x - r : target.x + r},${midY}` +
      `Q${target.x},${midY} ${target.x},${midY + r}` +
      `L${target.x},${target.y}`
    );
  }

  // horizontal flow
  const dy = target.y - source.y;
  const dir = Math.sign(dy);
  const bend = Math.min(Math.abs(dy) / 2, r) * dir; // zero when perfectly aligned

  return (
    `M${source.x},${source.y}` +
    `L${midX - r},${source.y}` +
    `Q${midX},${source.y} ${midX},${source.y + bend}` +
    `L${midX},${target.y - bend}` +
    `Q${midX},${target.y} ${midX + r},${target.y}` +
    `L${target.x},${target.y}`
  );
}

/**
 * Compute the bounding box of an array of nodes.
 * @param {Array<{ x: number, y: number, width: number, height: number }>} nodes
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
export function nodeBoundingBox(nodes) {
  if (!nodes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Check if rect A contains point.
 * @param {{ x:number, y:number, width:number, height:number }} rect
 * @param {Point} point
 * @returns {boolean}
 */
export function rectContainsPoint(rect, point) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if two rectangles intersect.
 * @param {{ x:number, y:number, width:number, height:number }} a
 * @param {{ x:number, y:number, width:number, height:number }} b
 * @returns {boolean}
 */
export function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Generate a simple unique id.
 * @returns {string}
 */
export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
