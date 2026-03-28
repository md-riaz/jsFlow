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
      return [{ id: 'out', type: 'source', position: 'right' }];
    case 'output':
      return [{ id: 'in', type: 'target', position: 'left' }];
    default:
      return [
        { id: 'in', type: 'target', position: 'left' },
        { id: 'out', type: 'source', position: 'right' },
      ];
  }
}

/**
 * Create a node with one input and multiple outputs.
 * Useful for decision / router style nodes.
 * @param {Partial<NodeModel> & { outputs?: Array<{ id: string, label?: string }> }} partial
 * @returns {NodeModel}
 */
export function createMultiOutputNode(partial = {}) {
  const outputs = Array.isArray(partial.outputs) && partial.outputs.length
    ? partial.outputs
    : [{ id: 'out', label: 'out' }];
  const total = outputs.length;
  const baseHeight = 47;
  const rowHeight = 21;
  const minHeight = 60;
  const height = partial.height ?? Math.max(minHeight, baseHeight + total * rowHeight);
  const existingRows = partial.data?.outputRows;
  const outputRows = existingRows && typeof existingRows === 'object'
    ? existingRows
    : Object.fromEntries(outputs.map(output => [output.id, '']));

  return createNode({
    ...partial,
    height,
    data: {
      ...(partial.data ?? {}),
      outputRows,
    },
    ports: [
      { id: 'in', type: 'target', position: 'left', offset: 0.5, label: 'Input' },
      ...outputs.map((output, index) => ({
        id: output.id,
        label: output.label ?? output.id,
        type: 'source',
        position: 'right',
        offset: total === 1 ? 0.5 : (index + 1) / (total + 1),
      })),
    ],
  });
}
