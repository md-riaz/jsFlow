/**
 * @module EdgeModel
 * Factory and default values for edge data objects.
 */

import { uid } from '../utils/Geometry.js';

/**
 * @typedef {Object} EdgeModel
 * @property {string} id
 * @property {string} source        - Source node id
 * @property {string} sourceHandle  - Source port id
 * @property {string} target        - Target node id
 * @property {string} targetHandle  - Target port id
 * @property {'bezier'|'smoothstep'|'straight'} type
 * @property {string} label
 * @property {Object} data
 * @property {boolean} selected
 */

/**
 * Create a new edge with defaults merged with the provided partial.
 * @param {Partial<EdgeModel>} partial
 * @returns {EdgeModel}
 */
export function createEdge(partial = {}) {
  return {
    id: partial.id ?? uid(),
    source: partial.source ?? '',
    sourceHandle: partial.sourceHandle ?? 'out',
    target: partial.target ?? '',
    targetHandle: partial.targetHandle ?? 'in',
    type: partial.type ?? 'bezier',
    label: partial.label ?? '',
    data: partial.data ?? {},
    selected: partial.selected ?? false,
  };
}
