/**
 * jsFlow Basic Demo Application
 * Demonstrates nodes, edges, interactions and public API usage.
 */

import { FlowEditor } from '../../src/core/FlowEditor.js';

// ─── Initial graph data ──────────────────────────────────────────────────────

const initialNodes = [
  {
    id: 'start',
    type: 'input',
    x: 220,
    y: 80,
    width: 180,
    height: 60,
    data: { label: 'Start', icon: '▶', description: 'Entry point' },
  },
  {
    id: 'greet',
    type: 'action',
    x: 200,
    y: 220,
    width: 200,
    height: 60,
    data: { label: 'Send Greeting', icon: '💬', description: 'Say hello to user' },
  },
  {
    id: 'decide',
    type: 'decision',
    x: 180,
    y: 370,
    width: 220,
    height: 60,
    data: { label: 'User Responded?', icon: '⬡', description: 'Check for reply' },
  },
  {
    id: 'yes',
    type: 'action',
    x: 60,
    y: 520,
    width: 180,
    height: 60,
    data: { label: 'Process Reply', icon: '✅', description: 'Handle positive path' },
  },
  {
    id: 'no',
    type: 'action',
    x: 320,
    y: 520,
    width: 180,
    height: 60,
    data: { label: 'Send Reminder', icon: '🔔', description: 'Handle negative path' },
  },
  {
    id: 'end',
    type: 'output',
    x: 200,
    y: 670,
    width: 180,
    height: 60,
    data: { label: 'End', icon: '⏹', description: 'Flow complete' },
  },
];

const initialEdges = [
  { id: 'e1', source: 'start',  sourceHandle: 'out', target: 'greet',  targetHandle: 'in', label: '' },
  { id: 'e2', source: 'greet',  sourceHandle: 'out', target: 'decide', targetHandle: 'in', label: '' },
  { id: 'e3', source: 'decide', sourceHandle: 'out', target: 'yes',    targetHandle: 'in', label: 'Yes' },
  { id: 'e4', source: 'decide', sourceHandle: 'out', target: 'no',     targetHandle: 'in', label: 'No' },
  { id: 'e5', source: 'yes',    sourceHandle: 'out', target: 'end',    targetHandle: 'in', label: '' },
  { id: 'e6', source: 'no',     sourceHandle: 'out', target: 'end',    targetHandle: 'in', label: '' },
];

// ─── Create editor ───────────────────────────────────────────────────────────

const container = document.getElementById('canvas');

const editor = new FlowEditor({
  container,
  nodes: initialNodes,
  edges: initialEdges,
  minZoom: 0.1,
  maxZoom: 3,
  grid: true,
  minimap: true,
});

// Fit view after a short delay so layout is painted
setTimeout(() => editor.fitView(60), 100);

// ─── Register custom node types ──────────────────────────────────────────────

editor.registerNodeType('decision', (node, body) => {
  body.innerHTML = `
    <div class="jf-node__header" style="background:linear-gradient(135deg,#3d2a1b,#2e2018);">
      <span class="jf-node__icon">${node.data.icon ?? '⬡'}</span>
      <span class="jf-node__title">${node.data.label ?? 'Decision'}</span>
    </div>
    ${node.data.description ? `<div class="jf-node__desc">${node.data.description}</div>` : ''}
  `;
});

editor.registerNodeType('action', (node, body) => {
  body.innerHTML = `
    <div class="jf-node__header" style="background:linear-gradient(135deg,#2a1b3d,#201828);">
      <span class="jf-node__icon">${node.data.icon ?? '⚡'}</span>
      <span class="jf-node__title">${node.data.label ?? 'Action'}</span>
    </div>
    ${node.data.description ? `<div class="jf-node__desc">${node.data.description}</div>` : ''}
  `;
});

// ─── Status bar updates ──────────────────────────────────────────────────────

const sbZoom     = document.getElementById('sb-zoom');
const sbPan      = document.getElementById('sb-pan');
const lblNodes   = document.getElementById('lbl-nodes');
const lblEdges   = document.getElementById('lbl-edges');
const lblSelected = document.getElementById('lbl-selected');

function updateStatus() {
  const vp = editor.getViewport();
  sbZoom.textContent = `Zoom: ${Math.round(vp.zoom * 100)}%`;
  sbPan.textContent  = `Pan: ${Math.round(vp.x)}, ${Math.round(vp.y)}`;
  lblNodes.textContent   = `${editor.getNodes().length} nodes`;
  lblEdges.textContent   = `${editor.getEdges().length} edges`;
}

editor.on('viewportChange', updateStatus);
editor.on('nodeAdd',    updateStatus);
editor.on('nodeRemove', updateStatus);
editor.on('edgeAdd',    updateStatus);
editor.on('edgeRemove', updateStatus);

updateStatus();

// ─── Selection → properties panel ────────────────────────────────────────────

const propsPanel   = document.getElementById('props-panel');
const propsContent = document.getElementById('props-content');

editor.on('selectionChange', ({ nodes, edges }) => {
  lblSelected.textContent = `${nodes.length + edges.length} selected`;

  if (nodes.length === 1) {
    const node = editor.getNode(nodes[0]);
    showNodeProps(node);
  } else if (edges.length === 1) {
    const edge = editor.getEdge(edges[0]);
    showEdgeProps(edge);
  } else {
    propsPanel.classList.remove('active');
  }
});

function showNodeProps(node) {
  propsPanel.classList.add('active');
  propsContent.innerHTML = `
    <div class="prop-row">
      <label>ID</label>
      <input type="text" value="${node.id}" readonly style="opacity:0.5;" />
    </div>
    <div class="prop-row">
      <label>Type</label>
      <input type="text" value="${node.type}" id="prop-type" />
    </div>
    <div class="prop-row">
      <label>Label</label>
      <input type="text" value="${node.data.label ?? ''}" id="prop-label" />
    </div>
    <div class="prop-row">
      <label>Description</label>
      <input type="text" value="${node.data.description ?? ''}" id="prop-desc" />
    </div>
    <div class="prop-row">
      <label>X</label>
      <input type="number" value="${Math.round(node.x)}" id="prop-x" />
    </div>
    <div class="prop-row">
      <label>Y</label>
      <input type="number" value="${Math.round(node.y)}" id="prop-y" />
    </div>
  `;

  document.getElementById('prop-label').addEventListener('input', e => {
    editor.updateNode(node.id, { data: { ...node.data, label: e.target.value } });
  });
  document.getElementById('prop-desc').addEventListener('input', e => {
    editor.updateNode(node.id, { data: { ...node.data, description: e.target.value } });
  });
  document.getElementById('prop-x').addEventListener('change', e => {
    editor.updateNode(node.id, { x: Number(e.target.value) });
  });
  document.getElementById('prop-y').addEventListener('change', e => {
    editor.updateNode(node.id, { y: Number(e.target.value) });
  });
}

function showEdgeProps(edge) {
  propsPanel.classList.add('active');
  propsContent.innerHTML = `
    <div class="prop-row">
      <label>ID</label>
      <input type="text" value="${edge.id}" readonly style="opacity:0.5;" />
    </div>
    <div class="prop-row">
      <label>Label</label>
      <input type="text" value="${edge.label ?? ''}" id="prop-edge-label" />
    </div>
    <div class="prop-row">
      <label>Type</label>
      <select id="prop-edge-type">
        <option value="bezier" ${edge.type === 'bezier' ? 'selected' : ''}>Bezier</option>
        <option value="smoothstep" ${edge.type === 'smoothstep' ? 'selected' : ''}>Smooth Step</option>
        <option value="straight" ${edge.type === 'straight' ? 'selected' : ''}>Straight</option>
      </select>
    </div>
  `;

  document.getElementById('prop-edge-label').addEventListener('input', e => {
    editor.updateEdge(edge.id, { label: e.target.value });
  });
  document.getElementById('prop-edge-type').addEventListener('change', e => {
    editor.updateEdge(edge.id, { type: e.target.value });
  });
}

// ─── Toolbar buttons ──────────────────────────────────────────────────────────

document.getElementById('btn-undo').addEventListener('click', () => editor.undo());
document.getElementById('btn-redo').addEventListener('click', () => editor.redo());
document.getElementById('btn-fit').addEventListener('click', () => editor.fitView());

let isReadonly = false;
document.getElementById('btn-readonly').addEventListener('click', () => {
  isReadonly = !isReadonly;
  editor.setReadonly(isReadonly);
  document.getElementById('sb-mode').textContent = `Mode: ${isReadonly ? 'readonly' : 'normal'}`;
  document.getElementById('btn-readonly').textContent = isReadonly ? '🔓 Unlock' : '🔒 Toggle Readonly';
});

document.getElementById('btn-export').addEventListener('click', () => {
  const data = editor.export();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jsflow-graph.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      editor.import(data);
      setTimeout(() => editor.fitView(), 100);
    } catch (err) {
      alert('Invalid JSON file');
    }
  });
  input.click();
});

// ─── Drag-from-palette to add nodes ──────────────────────────────────────────

let _dragPaletteItem = null;

document.querySelectorAll('.node-palette-item').forEach(item => {
  item.addEventListener('dragstart', e => {
    _dragPaletteItem = { type: item.dataset.type, label: item.dataset.label };
    e.dataTransfer.effectAllowed = 'copy';
  });
});

container.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

container.addEventListener('drop', e => {
  e.preventDefault();
  if (!_dragPaletteItem) return;

  const rect = container.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  const world = editor.screenToWorld(screenX, screenY);

  editor.addNode({
    type: _dragPaletteItem.type,
    x: world.x - 90,
    y: world.y - 30,
    data: { label: _dragPaletteItem.label, icon: getIcon(_dragPaletteItem.type) },
  });

  _dragPaletteItem = null;
  updateStatus();
});

function getIcon(type) {
  const map = { input: '▶', action: '⚡', decision: '⬡', default: '⬜', output: '⏹' };
  return map[type] ?? '⬜';
}

// ─── Event logging ────────────────────────────────────────────────────────────

editor.on('connect', edge => {
  console.log('[jsFlow] Connected:', edge.source, '→', edge.target);
});

editor.on('historyChange', status => {
  document.getElementById('btn-undo').style.opacity = status.canUndo ? '1' : '0.4';
  document.getElementById('btn-redo').style.opacity = status.canRedo ? '1' : '0.4';
});
