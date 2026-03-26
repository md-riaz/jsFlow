/**
 * @module NodeModel
 * Factory and default values for node data objects.
 */

import { uid } from '../utils/Geometry.js';

/**
 * @typedef {Object} HandleDef
 * @property {string} id
 * @property {'source'|'target'} type
 * @property {'top'|'bottom'|'left'|'right'} position
 */

/**
 * @typedef {Object} NodeModel
 * @property {string} id
 * @property {string} type
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {Object} data
 * @property {HandleDef[]} ports
 * @property {boolean} selected
 */

/**
 * Create a new node with defaults merged with the provided partial.
 * @param {Partial<NodeModel>} partial
 * @returns {NodeModel}
 */
export function createNode(partial = {}) {
  return {
    id: partial.id ?? uid(),
    type: partial.type ?? 'default',
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    width: partial.width ?? 180,
    height: partial.height ?? 60,
    data: partial.data ?? {},
    ports: partial.ports ?? defaultPorts(partial.type ?? 'default'),
    selected: partial.selected ?? false,
  };
}

/**
 * Return default port definitions for a given node type.
 * Custom node types can override this via the node registry.
 * @param {string} type
 * @returns {HandleDef[]}
 */
export function defaultPorts(type) {
  switch (type) {
    case 'input':
      return [{ id: 'out', type: 'source', position: 'bottom' }];
    case 'output':
      return [{ id: 'in', type: 'target', position: 'top' }];
    default:
      return [
        { id: 'in', type: 'target', position: 'top' },
        { id: 'out', type: 'source', position: 'bottom' },
      ];
  }
}
