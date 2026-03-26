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

Open `examples/basic/index.html` in a browser (served via any static file server — ES modules require HTTP).

```bash
npx serve .
# then open http://localhost:3000/examples/basic/
```

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
├── examples/
│   └── basic/           Working demo (index.html + app.js)
└── docs/
    └── API.md           Full API reference
```

---

## API

See **[docs/API.md](docs/API.md)** for complete documentation including:
- Constructor options
- Node & edge CRUD methods
- Viewport controls
- Selection API
- Event hooks
- Custom renderers
- Plugin system
- Coordinate helpers

---

## License

MIT
