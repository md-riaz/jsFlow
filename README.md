# jsFlow

**jsFlow** is a React Flow–class visual flow editor built entirely in modern vanilla JavaScript — no React, no Vue, no jQuery, no canvas frameworks. Zero dependencies.

> Build workflow editors, chatbot builders, call-flow designers, and logic-graph tools with a professional, extensible library.

---

## Features

- 🖼 **HTML nodes** + **SVG edges** (Bezier, Smooth-Step, Straight)
- 🗺 **State-driven architecture** — single source of truth for nodes, edges, viewport and selection
- 🔎 **Cursor-centered zoom**, smooth pan, fit-view, center-view
- 🖱 **Drag nodes**, multi-select, **marquee box selection**, drag-to-connect
- ↩ **Undo/redo** with snapshot history
- 📦 **JSON import/export**
- 🔌 **Custom node renderers** and custom edge renderers
- 🗺 **Minimap** overview
- ⌨ **Keyboard shortcuts** (Delete, Escape, Ctrl+A, Ctrl+Z, Ctrl+Y)
- 🔒 **Readonly mode**
- 🧩 **Plugin architecture**
- 📐 Clean, dark-theme **professional CSS**

---

## Quick Start

```html
<link rel="stylesheet" href="src/styles/flow-editor.css" />
<div id="canvas" style="width:100%;height:100vh;"></div>

<script type="module">
  import { FlowEditor } from './src/index.js';

  const editor = new FlowEditor({
    container: document.getElementById('canvas'),
    nodes: [
      { id: 'a', type: 'input',  x: 100, y: 100, data: { label: 'Start' } },
      { id: 'b', type: 'default', x: 100, y: 260, data: { label: 'Process' } },
    ],
    edges: [
      { source: 'a', sourceHandle: 'out', target: 'b', targetHandle: 'in' },
    ],
  });

  editor.fitView();
  editor.on('connect', edge => console.log('Connected:', edge));
</script>
```

---

## Demo

Open the live demo in `docs/index.html` (served via any static file server — ES modules require HTTP).

```bash
npx serve docs
# then open http://localhost:3000/
```

The `docs/src` directory vendors the library source so the demo works on GitHub Pages; update it alongside `src/` changes.

---

## Project Structure

```
jsflow/
├── src/
│   ├── core/            FlowEditor.js — public API
│   ├── state/           StateStore.js — single source of truth
│   ├── viewport/        ViewportEngine.js — pan/zoom/transforms
│   ├── renderer/        Node, Edge, MiniMap, Canvas renderers
│   ├── interactions/    InteractionManager — pointer event pipeline
│   ├── models/          Node / Edge data factories
│   ├── utils/           EventEmitter, Geometry, History, Serializer
│   ├── plugins/         PluginSystem
│   ├── styles/          flow-editor.css
│   └── index.js         Library entry
└── docs/
    ├── index.html       Live demo (GitHub Pages)
    ├── app.js           Demo application logic
    ├── src/             Bundled source for docs hosting
    └── api/
        └── index.md     Full API reference
```

---

## API

See **[API reference](docs/api/index.md)** for complete documentation including:
- Constructor options
- Node & edge CRUD methods
- Viewport controls
- Selection API
- Event hooks
- Custom renderers
- Plugin system
- Coordinate helpers

---

## Comparison with Other Libraries

| Feature | **jsFlow** | [React Flow](https://reactflow.dev) | [Vue Flow](https://vueflow.dev) | [Drawflow](https://github.com/jerosoler/Drawflow) | [jsPlumb](https://jsplumbtoolkit.com) |
|---|---|---|---|---|---|
| Framework dependency | None (Vanilla JS) | React | Vue 3 | None | None |
| Bundle size (min+gz) | ~15 KB | ~60 KB | ~45 KB | ~17 KB | ~100 KB+ |
| HTML nodes | ✅ | ✅ | ✅ | ✅ | ✅ |
| SVG edges | ✅ (Bezier / Smooth / Straight) | ✅ | ✅ | ✅ | ✅ |
| Animated edges | ✅ | ✅ | ✅ | ❌ | ❌ |
| Drag-to-connect | ✅ | ✅ | ✅ | ✅ | ✅ |
| Snap to grid | ✅ | ✅ | ✅ | ❌ | ✅ |
| Marquee selection | ✅ | ✅ | ✅ | ❌ | ❌ |
| Minimap | ✅ | ✅ | ✅ | ❌ | ❌ |
| Undo / redo | ✅ | ❌ (external) | ❌ (external) | ❌ | ❌ |
| JSON import/export | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom node renderers | ✅ | ✅ | ✅ | ✅ | ❌ |
| Plugin system | ✅ | ❌ | ❌ | ❌ | ❌ |
| Readonly mode | ✅ | ✅ | ✅ | ✅ | ✅ |
| Background variants | ✅ | ✅ | ✅ | ❌ | ❌ |
| Node resize | ✅ | ✅ (add-on) | ✅ | ❌ | ✅ |
| TypeScript types | JSDoc | ✅ | ✅ | Partial | ✅ |
| License | MIT | MIT | MIT | MIT | Commercial / MIT |

> jsFlow is the only zero-dependency option with built-in undo/redo and a plugin architecture. Choose React Flow or Vue Flow when you are already using those frameworks and need their ecosystem.

---



## License

MIT
