# jsFlow API Documentation

## Overview

**jsFlow** is a React Flow–class visual flow editor built entirely in vanilla JavaScript with zero dependencies. It provides a state-driven, module-based architecture suitable for building workflow editors, chatbot builders, call-flow designers, and any node-graph visual tool.

---

## Architecture

```
jsFlow/src/
├── core/
│   └── FlowEditor.js        Public API entry point
├── state/
│   └── StateStore.js        Single source of truth (nodes, edges, viewport, selection)
├── viewport/
│   └── ViewportEngine.js    Pan / zoom / coordinate transforms
├── renderer/
│   ├── CanvasRenderer.js    Render orchestrator + requestAnimationFrame scheduler
│   ├── NodeRenderer.js      HTML node card layer
│   ├── EdgeRenderer.js      SVG edge layer (bezier / smooth-step / straight)
│   └── MiniMapRenderer.js   Canvas-based minimap
├── interactions/
│   └── InteractionManager.js Pointer event pipeline (pan, zoom, drag, marquee, connect)
├── models/
│   ├── Node.js              Node factory + default ports
│   └── Edge.js              Edge factory
├── utils/
│   ├── EventEmitter.js      Lightweight pub/sub
│   ├── Geometry.js          Bezier math, coordinate helpers, bounding boxes
│   ├── History.js           Undo/redo with snapshot stack
│   └── Serializer.js        JSON import/export
├── plugins/
│   └── PluginSystem.js      Plugin architecture
├── styles/
│   └── flow-editor.css      Professional dark-theme CSS
└── index.js                 Library exports
```

### Rendering Model

- **Node layer** — `<div>` elements positioned absolutely inside a world-space div
- **Edge layer** — `<svg>` with `overflow:visible` inside the same world-space div
- **Viewport transform** — the world-space div receives `transform: translate(x,y) scale(zoom)` on every render frame
- Rendering is **state-driven**: every `store.change` event schedules a `requestAnimationFrame` render cycle

### Coordinate System

```
Screen space:  pixel position relative to the container element
World space:   logical graph coordinates (independent of zoom/pan)

screen → world:  x_world = (x_screen - viewport.x) / viewport.zoom
world  → screen: x_screen = x_world * viewport.zoom + viewport.x
```

---

## Setup

```html
<link rel="stylesheet" href="src/styles/flow-editor.css" />
<div id="canvas" style="width:100%;height:100vh;"></div>

<script type="module">
  import { FlowEditor } from './src/index.js';

  const editor = new FlowEditor({
    container: document.getElementById('canvas'),
    nodes: [],
    edges: [],
  });
</script>
```

---

## Constructor Options

```js
new FlowEditor({
  container,    // HTMLElement   — required
  nodes,        // NodeModel[]  — initial nodes
  edges,        // EdgeModel[]  — initial edges
  viewport,     // { x, y, zoom } — initial viewport
  minZoom,      // number  default 0.1
  maxZoom,      // number  default 3
  grid,         // boolean default true
  minimap,      // boolean default true
  readonly,     // boolean default false
})
```

---

## Node Model

```ts
{
  id:           string           // unique identifier (auto-generated if omitted)
  type:         string           // 'default' | 'input' | 'output' | custom
  x:            number           // world-space X position
  y:            number           // world-space Y position
  width:        number           // default 180
  height:       number           // default 60
  data:         object           // arbitrary node data
  ports:        HandleDef[]      // connection ports
  selected:     boolean
}

// HandleDef
{
  id:       string               // port identifier
  type:     'source' | 'target'
  position: 'top' | 'bottom' | 'left' | 'right'
}
```

---

## Edge Model

```ts
{
  id:           string
  source:       string           // source node id
  sourceHandle: string           // source port id
  target:       string           // target node id
  targetHandle: string           // target port id
  type:         'bezier' | 'smoothstep' | 'straight'
  label:        string
  data:         object
  selected:     boolean
}
```

---

## Public API

### Node Methods

```js
editor.addNode(partial)            // → NodeModel
editor.updateNode(id, changes)     // → NodeModel | undefined
editor.removeNode(id)              // void
editor.getNode(id)                 // → NodeModel | undefined
editor.getNodes()                  // → NodeModel[]
```

### Edge Methods

```js
editor.addEdge(partial)            // → EdgeModel
editor.updateEdge(id, changes)     // → EdgeModel | undefined
editor.removeEdge(id)              // void
editor.getEdge(id)                 // → EdgeModel | undefined
editor.getEdges()                  // → EdgeModel[]
```

### Viewport Methods

```js
editor.fitView(padding?)           // fit all nodes into view
editor.centerView()                // center without zoom change
editor.zoomTo(zoomLevel)           // set exact zoom
editor.setViewport({ x, y, zoom }) // set viewport state
editor.getViewport()               // → { x, y, zoom }
```

### Selection Methods

```js
editor.setSelection(nodeIds, edgeIds)  // replace selection
editor.clearSelection()                // deselect all
editor.getSelectedNodes()              // → NodeModel[]
```

### History / Undo–Redo

```js
editor.undo()
editor.redo()
editor.getHistoryStatus()   // → { canUndo, canRedo, undoLabel, redoLabel }
```

### Import / Export

```js
editor.export()             // → plain object (JSON-serialisable)
editor.import(data)         // load from plain object
```

### Readonly Mode

```js
editor.setReadonly(true)    // disable all interactions
editor.setReadonly(false)
```

### Coordinate Helpers

```js
editor.screenToWorld(x, y)  // → { x, y } in world space
editor.worldToScreen(x, y)  // → { x, y } in screen space
```

---

## Custom Node Renderers

```js
editor.registerNodeType('myType', (node, bodyEl) => {
  bodyEl.innerHTML = `
    <div class="jf-node__header">
      <span class="jf-node__title">${node.data.label}</span>
    </div>
  `;
});

editor.addNode({
  type: 'myType',
  x: 100,
  y: 100,
  data: { label: 'My Node' },
});
```

---

## Custom Edge Renderers

```js
editor.registerEdgeType('dashed', (edge, src, tgt) => {
  return `M${src.x},${src.y} L${tgt.x},${tgt.y}`;
});

editor.addEdge({
  source: 'a', sourceHandle: 'out',
  target: 'b', targetHandle: 'in',
  type: 'dashed',
});
```

---

## Event Hooks

```js
// Subscribe
const unsub = editor.on('connect', (edge) => { ... });

// Unsubscribe
unsub();     // or editor.off('connect', handler)
```

| Event               | Payload                          | Description                        |
|---------------------|----------------------------------|------------------------------------|
| `nodeAdd`           | `NodeModel`                      | Node added                         |
| `nodeRemove`        | `NodeModel`                      | Node removed                       |
| `nodeMove`          | `NodeModel[]`                    | Node(s) dragged                    |
| `nodeClick`         | `(NodeModel, PointerEvent)`      | Node clicked                       |
| `edgeAdd`           | `EdgeModel`                      | Edge added                         |
| `edgeRemove`        | `EdgeModel`                      | Edge removed                       |
| `edgeClick`         | `(EdgeModel, PointerEvent)`      | Edge clicked                       |
| `connect`           | `EdgeModel`                      | New connection made via drag       |
| `selectionChange`   | `{ nodes: string[], edges: string[] }` | Selection updated           |
| `viewportChange`    | `{ x, y, zoom }`                 | Pan or zoom changed                |
| `historyChange`     | `{ canUndo, canRedo, ... }`      | Undo/redo stack changed            |

---

## Plugin Architecture

```js
const MyPlugin = {
  install(editor) {
    // extend the editor however you need
    editor.on('nodeAdd', (node) => console.log('Node added', node));
    editor.myCustomMethod = () => { /* ... */ };
  }
};

editor.use('my-plugin', MyPlugin);

// Check if installed
editor.plugins.has('my-plugin');
```

---

## Keyboard Shortcuts

| Shortcut          | Action                  |
|-------------------|-------------------------|
| `Delete`          | Delete selected         |
| `Escape`          | Clear selection         |
| `Ctrl/Cmd + A`    | Select all              |
| `Ctrl/Cmd + Z`    | Undo                    |
| `Ctrl/Cmd + Y`    | Redo                    |
| `Ctrl/Cmd + Shift + Z` | Redo               |

---

## Extending the Editor

For deep customisation, import sub-systems directly:

```js
import {
  StateStore,
  ViewportEngine,
  CanvasRenderer,
  InteractionManager,
} from './src/index.js';

// Build a custom editor composition
const store = new StateStore();
const viewport = new ViewportEngine(store);
const renderer = new CanvasRenderer(container, store, viewport);
```

---

## Browser Support

Requires browsers that support:
- ES Modules (`import`/`export`)
- Pointer Events API
- CSS `transform-origin`
- `requestAnimationFrame`
- `ResizeObserver` (optional, for future container-resize support)

Modern Chromium, Firefox 95+, Safari 15+.
