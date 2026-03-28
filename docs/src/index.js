/**
 * jsFlow — React Flow–class visual flow editor in vanilla JavaScript
 *
 * Main library entry point.
 *
 * @example
 *   import { FlowEditor } from 'jsflow';
 *
 *   const editor = new FlowEditor({
 *     container: document.getElementById('app'),
 *     nodes: [],
 *     edges: [],
 *   });
 */

export { FlowEditor } from './core/FlowEditor.js';

// Utilities
export { EventEmitter }  from './utils/EventEmitter.js';
export { History }       from './utils/History.js';
export { exportGraph, importGraph, toJSON, fromJSON } from './utils/Serializer.js';
export { bezierPath, smoothStepPath, screenToWorld, worldToScreen, uid } from './utils/Geometry.js';

// Models
export { createNode, defaultPorts, createMultiOutputNode } from './models/Node.js';
export { createEdge }               from './models/Edge.js';

// Core sub-systems (for advanced usage / custom integrations)
export { StateStore }       from './state/StateStore.js';
export { ViewportEngine }   from './viewport/ViewportEngine.js';
export { CanvasRenderer }   from './renderer/CanvasRenderer.js';
export { NodeRenderer }     from './renderer/NodeRenderer.js';
export { EdgeRenderer }     from './renderer/EdgeRenderer.js';
export { MiniMapRenderer }  from './renderer/MiniMapRenderer.js';
export { InteractionManager } from './interactions/InteractionManager.js';
export { PluginSystem }     from './plugins/PluginSystem.js';
