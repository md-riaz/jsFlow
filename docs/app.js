/**
 * jsFlow demo application — Library landing page
 * Demonstrates all editor features with multiple scenario presets.
 */

import { FlowEditor } from './src/core/FlowEditor.js';

// ── Scenario data ────────────────────────────────────────────────────────────

const DB_TABLE_LAYOUT = {
  headerHeight: 47,
  rowsPaddingTop: 10,
  rowHeight: 21,
};

function createDbPorts(columns = []) {
  const rowCount = Math.max(columns.length, 1);
  const totalHeight =
    DB_TABLE_LAYOUT.headerHeight +
    DB_TABLE_LAYOUT.rowsPaddingTop +
    DB_TABLE_LAYOUT.rowHeight * rowCount;

  return columns.flatMap((col, index) => {
    const rowCenterY =
      DB_TABLE_LAYOUT.headerHeight +
      DB_TABLE_LAYOUT.rowsPaddingTop +
      DB_TABLE_LAYOUT.rowHeight * index +
      DB_TABLE_LAYOUT.rowHeight / 2;
    const offset = Math.max(0, Math.min(1, rowCenterY / totalHeight));
    return [
      { id: `in:${col.name}`, type: 'target', position: 'left', offset },
      { id: `out:${col.name}`, type: 'source', position: 'right', offset },
    ];
  });
}

function createDbNode({ id, x, y, width, label, accent, columns }) {
  return {
    id,
    type: 'dbtable',
    x,
    y,
    width,
    data: { label, accent, columns },
    ports: createDbPorts(columns),
  };
}

function createIvrDigitPorts() {
  return [
    { id: 'in', type: 'target', position: 'left', offset: 0.5, label: 'Input' },
    ...['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit, index) => ({
      id: `d${digit}`,
      type: 'source',
      position: 'right',
      offset: 0.05 + index * 0.095,
      label: digit,
    })),
  ];
}

const DB_EDGE_STYLE = { type: 'smoothstep', markerEnd: false };

const SCENARIOS = {
  chatbot: {
    nodes: [
      { id: 'start',   type: 'input',     x: 80,  y: 200, width: 180, data: { label: 'User Message',    icon: '💬', description: 'Incoming user input' } },
      { id: 'intent',  type: 'action',    x: 340, y: 200, width: 180, data: { label: 'Intent Detection', icon: '🧠', description: 'NLP classification' } },
      { id: 'decide',  type: 'decision',  x: 600, y: 200, width: 180, data: { label: 'Route Intent',     icon: '⬡', description: 'Branch by intent type' } },
      { id: 'faq',     type: 'action',    x: 860, y: 80,  width: 180, data: { label: 'FAQ Lookup',       icon: '📚', description: 'Search knowledge base', badge: 'RAG' } },
      { id: 'handoff', type: 'condition', x: 860, y: 200, width: 180, data: { label: 'Human Handoff',    icon: '👤', description: 'Escalate to agent' } },
      { id: 'fallback',type: 'action',    x: 860, y: 320, width: 180, data: { label: 'Fallback Reply',   icon: '🔄', description: 'Default response' } },
      { id: 'reply',   type: 'output',    x: 1120,y: 80,  width: 180, data: { label: 'Send Response',    icon: '📤', description: 'Deliver to user' } },
      { id: 'crm',     type: 'action',    x: 1120,y: 200, width: 180, data: { label: 'Update CRM',       icon: '🗂', description: 'Log interaction', badge: 'async' } },
      { id: 'end',     type: 'output',    x: 1120,y: 320, width: 180, data: { label: 'End Session',       icon: '🏁', description: 'Close conversation' } },
    ],
    edges: [
      { id: 'e1', source: 'start',   sourceHandle: 'out', target: 'intent',   targetHandle: 'in', type: 'smoothstep', animated: true },
      { id: 'e2', source: 'intent',  sourceHandle: 'out', target: 'decide',   targetHandle: 'in', type: 'smoothstep', animated: true },
      { id: 'e3', source: 'decide',  sourceHandle: 'out', target: 'faq',      targetHandle: 'in', label: 'FAQ',   type: 'bezier' },
      { id: 'e4', source: 'decide',  sourceHandle: 'out', target: 'handoff',  targetHandle: 'in', label: 'Agent', type: 'bezier' },
      { id: 'e5', source: 'decide',  sourceHandle: 'out', target: 'fallback', targetHandle: 'in', label: 'Other', type: 'bezier' },
      { id: 'e6', source: 'faq',     sourceHandle: 'out', target: 'reply',    targetHandle: 'in', type: 'smoothstep' },
      { id: 'e7', source: 'handoff', sourceHandle: 'out', target: 'crm',      targetHandle: 'in', type: 'smoothstep' },
      { id: 'e8', source: 'fallback',sourceHandle: 'out', target: 'end',      targetHandle: 'in', type: 'smoothstep' },
    ],
  },
  workflow: {
    nodes: [
      { id: 'trigger', type: 'trigger',   x: 80,  y: 240, width: 180, data: { label: 'Webhook Trigger',   icon: '⚡', description: 'POST /api/hook' } },
      { id: 'auth',    type: 'condition', x: 320, y: 240, width: 180, data: { label: 'Authenticate',      icon: '🔐', description: 'Validate JWT token' } },
      { id: 'enrich',  type: 'action',    x: 560, y: 140, width: 180, data: { label: 'Enrich Payload',    icon: '🔍', description: 'Add metadata', badge: 'transform' } },
      { id: 'validate',type: 'condition', x: 560, y: 320, width: 180, data: { label: 'Schema Validate',   icon: '✅', description: 'JSON Schema check' } },
      { id: 'db',      type: 'action',    x: 800, y: 240, width: 180, data: { label: 'Write to DB',       icon: '🗄', description: 'Persist record', badge: 'async' } },
      { id: 'notify',  type: 'action',    x: 1040,y: 140, width: 180, data: { label: 'Send Notification', icon: '🔔', description: 'Slack + email' } },
      { id: 'error',   type: 'output',    x: 560, y: 480, width: 180, data: { label: 'Error Handler',     icon: '❌', description: 'Log and alert' } },
      { id: 'done',    type: 'output',    x: 1040,y: 320, width: 180, data: { label: 'Return 200',        icon: '✓',  description: 'Success response' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'auth',     targetHandle: 'in', type: 'smoothstep', animated: true },
      { id: 'e2', source: 'auth',    sourceHandle: 'out', target: 'enrich',   targetHandle: 'in', label: 'valid', type: 'bezier' },
      { id: 'e3', source: 'auth',    sourceHandle: 'out', target: 'validate', targetHandle: 'in', label: 'check', type: 'bezier' },
      { id: 'e4', source: 'auth',    sourceHandle: 'out', target: 'error',    targetHandle: 'in', label: 'fail',  type: 'bezier' },
      { id: 'e5', source: 'enrich',  sourceHandle: 'out', target: 'db',       targetHandle: 'in', type: 'smoothstep' },
      { id: 'e6', source: 'validate',sourceHandle: 'out', target: 'db',       targetHandle: 'in', type: 'smoothstep' },
      { id: 'e7', source: 'db',      sourceHandle: 'out', target: 'notify',   targetHandle: 'in', type: 'bezier' },
      { id: 'e8', source: 'db',      sourceHandle: 'out', target: 'done',     targetHandle: 'in', type: 'bezier' },
    ],
  },
  pipeline: {
    nodes: [
      { id: 'ingest', type: 'input',     x: 60,  y: 200, width: 200, data: { label: 'Data Ingestion',    icon: '📥', description: 'S3 / Kafka / API', badge: 'streaming' } },
      { id: 'parse',  type: 'action',    x: 330, y: 200, width: 180, data: { label: 'Parse & Decode',    icon: '📄', description: 'JSON / Avro / Parquet' } },
      { id: 'filter', type: 'condition', x: 570, y: 200, width: 180, data: { label: 'Filter Rows',       icon: '⚗',  description: 'Quality rules' } },
      { id: 'join',   type: 'action',    x: 810, y: 100, width: 180, data: { label: 'Join Lookup',       icon: '⛓', description: 'Enrich with ref data' } },
      { id: 'agg',    type: 'action',    x: 810, y: 280, width: 180, data: { label: 'Aggregate',         icon: '∑',  description: 'Group & window', badge: 'SQL' } },
      { id: 'model',  type: 'action',    x: 1050,y: 200, width: 180, data: { label: 'ML Inference',      icon: '🤖', description: 'ONNX model scoring', badge: 'GPU' } },
      { id: 'sink',   type: 'output',    x: 1280,y: 100, width: 180, data: { label: 'Data Warehouse',    icon: '🏛', description: 'BigQuery / Snowflake' } },
      { id: 'alert',  type: 'output',    x: 1280,y: 280, width: 180, data: { label: 'Alert Pipeline',    icon: '🚨', description: 'PagerDuty / Opsgenie' } },
      { id: 'dlq',    type: 'output',    x: 570, y: 380, width: 180, data: { label: 'Dead Letter Queue', icon: '🗑', description: 'Failed records' } },
    ],
    edges: [
      { id: 'e1', source: 'ingest', sourceHandle: 'out', target: 'parse',  targetHandle: 'in', type: 'smoothstep', animated: true },
      { id: 'e2', source: 'parse',  sourceHandle: 'out', target: 'filter', targetHandle: 'in', type: 'smoothstep', animated: true },
      { id: 'e3', source: 'filter', sourceHandle: 'out', target: 'join',   targetHandle: 'in', label: 'pass', type: 'bezier' },
      { id: 'e4', source: 'filter', sourceHandle: 'out', target: 'agg',    targetHandle: 'in', label: 'pass', type: 'bezier' },
      { id: 'e5', source: 'filter', sourceHandle: 'out', target: 'dlq',    targetHandle: 'in', label: 'fail', type: 'straight' },
      { id: 'e6', source: 'join',   sourceHandle: 'out', target: 'model',  targetHandle: 'in', type: 'smoothstep' },
      { id: 'e7', source: 'agg',    sourceHandle: 'out', target: 'model',  targetHandle: 'in', type: 'smoothstep' },
      { id: 'e8', source: 'model',  sourceHandle: 'out', target: 'sink',   targetHandle: 'in', type: 'bezier' },
      { id: 'e9', source: 'model',  sourceHandle: 'out', target: 'alert',  targetHandle: 'in', type: 'bezier' },
    ],
  },
  callcenter: {
    nodes: [
      { id: 'inbound',     type: 'input',     x: 40,  y: 240, width: 200, data: { label: 'Incoming Call',     icon: '📞', description: 'SIP / PSTN trigger' } },
      { id: 'holiday',     type: 'condition', x: 300, y: 240, width: 200, data: { label: 'Check Holidays',    icon: '🎄', description: 'Calendar lookup' } },
      { id: 'holidayVm',   type: 'output',    x: 300, y: 420, width: 200, data: { label: 'Holiday Greeting',   icon: '🏝', description: 'Play message + voicemail' } },
      { id: 'hours',       type: 'condition', x: 560, y: 240, width: 200, data: { label: 'Business Hours',    icon: '⏰', description: 'Open/closed schedule' } },
      { id: 'afterHours',  type: 'output',    x: 560, y: 420, width: 200, data: { label: 'After-hours VM',     icon: '🌙', description: 'Route to voicemail box' } },
      { id: 'ivr',         type: 'decision',  x: 760, y: 120, width: 420, height: 520, data: {
          label: 'IVR Menu',
          icon: '☎',
          description: 'DTMF menu prompt',
          outputRows: {
            d0: 'Voicemail / timeout',
            d1: 'Sales ring group',
            d2: 'Support queue',
            d3: 'Dial extension',
          },
        },
        ports: createIvrDigitPorts(),
      },
      { id: 'sales',       type: 'action',    x: 1110,y: 80,  width: 200, data: { label: 'Sales Ring Group',   icon: '💼', description: 'Simultaneous ring (1)' } },
      { id: 'support',     type: 'action',    x: 1110,y: 200, width: 200, data: { label: 'Support Queue',      icon: '🛠', description: 'Ring group / queue (2)' } },
      { id: 'extension',   type: 'action',    x: 1110,y: 320, width: 200, data: { label: 'Dial Extension',     icon: '🔢', description: 'Direct extension (3)' } },
      { id: 'voicemail',   type: 'action',    x: 1110,y: 440, width: 200, data: { label: 'Voicemail Mailbox',  icon: '📥', description: '0 / timeout to VM' } },
      { id: 'operator',    type: 'output',    x: 1350,y: 200, width: 200, data: { label: 'Operator / Main',    icon: '👤', description: 'Fallback operator' } },
    ],
    edges: [
      { id: 'e1',  source: 'inbound',   sourceHandle: 'out', target: 'holiday',    targetHandle: 'in', type: 'smoothstep', animated: true },
      { id: 'e2',  source: 'holiday',   sourceHandle: 'out', target: 'hours',      targetHandle: 'in', label: 'not holiday', type: 'smoothstep' },
      { id: 'e3',  source: 'holiday',   sourceHandle: 'out', target: 'holidayVm',  targetHandle: 'in', label: 'holiday', type: 'bezier' },
      { id: 'e4',  source: 'hours',     sourceHandle: 'out', target: 'ivr',        targetHandle: 'in', label: 'open', type: 'smoothstep' },
      { id: 'e5',  source: 'hours',     sourceHandle: 'out', target: 'afterHours', targetHandle: 'in', label: 'closed', type: 'bezier' },
      { id: 'e6',  source: 'ivr',       sourceHandle: 'd1',  target: 'sales',      targetHandle: 'in', label: 'press 1', type: 'bezier' },
      { id: 'e7',  source: 'ivr',       sourceHandle: 'd2',  target: 'support',    targetHandle: 'in', label: 'press 2', type: 'bezier' },
      { id: 'e8',  source: 'ivr',       sourceHandle: 'd3',  target: 'extension',  targetHandle: 'in', label: 'press 3', type: 'bezier' },
      { id: 'e9',  source: 'ivr',       sourceHandle: 'd0',  target: 'voicemail',  targetHandle: 'in', label: 'press 0 / timeout', type: 'bezier' },
      { id: 'e10', source: 'support',   sourceHandle: 'out', target: 'operator',   targetHandle: 'in', label: 'fallback', type: 'smoothstep' },
      { id: 'e11', source: 'voicemail', sourceHandle: 'out', target: 'operator',   targetHandle: 'in', label: 'operator key', type: 'smoothstep' },
    ],
  },
  database: {
    nodes: [
      createDbNode({ id: 'chatroom_message', x: 70, y: 70, width: 410,
        label: 'chatroom_message', accent: '#5a66c4',
        columns: [
          { name: 'id', type: 'serial', pk: true },
          { name: 'chatroom_id', type: 'bigint' },
          { name: 'sender', type: 'int' },
          { name: 'content', type: 'text' },
          { name: 'created', type: 'timestamp' },
        ],
      }),
      createDbNode({ id: 'chatroom_participant', x: 120, y: 600, width: 410,
        label: 'chatroom_participant', accent: '#2d84c8',
        columns: [
          { name: 'id', type: 'serial', pk: true },
          { name: 'chatroom_id', type: 'bigint' },
          { name: 'party_id', type: 'bigint' },
          { name: 'created', type: 'timestamp' },
        ],
      }),
      createDbNode({ id: 'internal_chatroom', x: 650, y: 360, width: 430,
        label: 'internal_chatroom', accent: '#7f4ec9',
        columns: [
          { name: 'id', type: 'serial', pk: true },
          { name: 'name', type: 'varchar?' },
          { name: 'is_group', type: 'smallint' },
          { name: 'organization_id', type: 'bigint' },
          { name: 'owner_id', type: 'bigint', fk: true },
          { name: 'created', type: 'timestamp' },
          { name: 'updated', type: 'timestamp' },
        ],
      }),
      createDbNode({ id: 'chatroom_audit', x: 1280, y: 20, width: 420,
        label: 'chatroom_audit', accent: '#1ca8bf',
        columns: [
          { name: 'id', type: 'serial', pk: true },
          { name: 'chatroom_id', type: 'bigint' },
          { name: 'message_id', type: 'bigint', fk: true },
          { name: 'audit_type_id', type: 'bigint', fk: true },
          { name: 'audit_action_id', type: 'bigint', fk: true },
          { name: 'organization_id', type: 'bigint' },
          { name: 'action_by', type: 'bigint', fk: true },
          { name: 'created', type: 'timestamp' },
        ],
      }),
      createDbNode({ id: 'party', x: 1220, y: 690, width: 400,
        label: 'party', accent: '#d85b9a',
        columns: [
          { name: 'id', type: 'serial', pk: true },
          { name: 'name', type: 'varchar?' },
          { name: 'parent', type: 'int?' },
          { name: 'type', type: 'int' },
          { name: 'status', type: 'int' },
          { name: 'created', type: 'timestamp' },
          { name: 'updated', type: 'timestamp' },
        ],
      }),
    ],
    edges: [
      { id: 'e1', source: 'chatroom_message',  sourceHandle: 'out:id', target: 'chatroom_audit',       targetHandle: 'in:message_id',       ...DB_EDGE_STYLE },
      { id: 'e2', source: 'internal_chatroom', sourceHandle: 'out:id', target: 'chatroom_message',     targetHandle: 'in:chatroom_id',      ...DB_EDGE_STYLE },
      { id: 'e3', source: 'internal_chatroom', sourceHandle: 'out:id', target: 'chatroom_participant', targetHandle: 'in:chatroom_id',      ...DB_EDGE_STYLE },
      { id: 'e4', source: 'internal_chatroom', sourceHandle: 'out:id', target: 'chatroom_audit',       targetHandle: 'in:chatroom_id',      ...DB_EDGE_STYLE },
      { id: 'e5', source: 'party',             sourceHandle: 'out:id', target: 'internal_chatroom',    targetHandle: 'in:owner_id',         ...DB_EDGE_STYLE },
      { id: 'e6', source: 'party',             sourceHandle: 'out:id', target: 'chatroom_participant', targetHandle: 'in:party_id',         ...DB_EDGE_STYLE },
      { id: 'e7', source: 'party',             sourceHandle: 'out:id', target: 'chatroom_audit',       targetHandle: 'in:organization_id', ...DB_EDGE_STYLE },
      { id: 'e8', source: 'party',             sourceHandle: 'out:id', target: 'chatroom_audit',       targetHandle: 'in:action_by',        ...DB_EDGE_STYLE },
    ],
  },
  blank: { nodes: [], edges: [] },
};

// ── Palette node types ────────────────────────────────────────────────────────

const PALETTE_TYPES = [
  { group: 'Flow Control', items: [
    { type: 'input',     label: 'Trigger',    icon: '⚡', desc: 'Start of flow',      color: '#4f7df3' },
    { type: 'condition', label: 'Condition',  icon: '⬡',  desc: 'Branch by rule',     color: '#f3d24f' },
    { type: 'output',    label: 'Output',     icon: '🏁', desc: 'End of flow',         color: '#43c89c' },
  ]},
  { group: 'Operations', items: [
    { type: 'action',    label: 'Action',     icon: '⚙',  desc: 'Execute a task',     color: '#b06af3' },
    { type: 'trigger',   label: 'Webhook',    icon: '🔔', desc: 'HTTP trigger',        color: '#e0954a' },
    { type: 'action',    label: 'Transform',  icon: '⟳',  desc: 'Map / filter data',  color: '#4f7df3' },
  ]},
  { group: 'Integrations', items: [
    { type: 'action',    label: 'HTTP',       icon: '🌐', desc: 'API call',            color: '#43c89c' },
    { type: 'action',    label: 'Database',   icon: '🗄', desc: 'SQL / NoSQL query',   color: '#b06af3' },
    { type: 'action',    label: 'Email',      icon: '📧', desc: 'Send email',          color: '#f35858' },
    { type: 'action',    label: 'AI/LLM',     icon: '🤖', desc: 'Language model call', color: '#4f7df3', badge: 'AI' },
  ]},
  { group: 'Telephony', items: [
    { type: 'action',    label: 'IVR Menu',   icon: '☎',  desc: 'DTMF routing menu',   color: '#f3d24f' },
    { type: 'action',    label: 'Ring Group', icon: '📞', desc: 'Simultaneous ring',    color: '#43c89c' },
    { type: 'action',    label: 'Voicemail',  icon: '📥', desc: 'Mailbox / greeting',   color: '#f35858' },
    { type: 'action',    label: 'Extension',  icon: '🔢', desc: 'Direct extension dial',color: '#4a5080' },
  ]},
];

// ── Code snippets ─────────────────────────────────────────────────────────────

const CODE_SNIPPETS = {
  setup: {
    file: 'setup.js',
    html: `<span class="kw">import</span> { <span class="nm">FlowEditor</span> } <span class="kw">from</span> <span class="str">'jsflow'</span>;
<span class="kw">import</span> <span class="str">'jsflow/styles/flow-editor.css'</span>;

<span class="cm">// Create the editor</span>
<span class="kw">const</span> <span class="nm">editor</span> = <span class="kw">new</span> <span class="fn">FlowEditor</span>({
  container:  document.<span class="fn">getElementById</span>(<span class="str">'canvas'</span>),
  nodes:      initialNodes,
  edges:      initialEdges,
  minZoom:    <span class="nm">0.1</span>,
  maxZoom:    <span class="nm">3</span>,
  background: <span class="str">'dots'</span>,   <span class="cm">// 'lines' | 'dots' | 'cross' | 'none'</span>
  minimap:    <span class="kw">true</span>,
  snapToGrid: <span class="kw">true</span>,
  gridSize:   <span class="nm">20</span>,
  isValidConnection: (src, tgt) =>
    src.node.type <span class="op">!==</span> tgt.node.type,
});`,
  },
  nodes: {
    file: 'nodes.js',
    html: `<span class="cm">// Add a node</span>
<span class="kw">const</span> node = editor.<span class="fn">addNode</span>({
  type:  <span class="str">'action'</span>,
  x:     <span class="nm">200</span>,  y: <span class="nm">300</span>,
  width: <span class="nm">180</span>,
  data:  { label: <span class="str">'Send Email'</span>, icon: <span class="str">'📧'</span>, badge: <span class="str">'async'</span> },
});

<span class="cm">// Update a node</span>
editor.<span class="fn">updateNode</span>(node.id, {
  data: { ...node.data, label: <span class="str">'Updated Label'</span> },
});

<span class="cm">// Remove a node (also removes connected edges)</span>
editor.<span class="fn">removeNode</span>(node.id);

<span class="cm">// Get all / selected nodes</span>
<span class="kw">const</span> all      = editor.<span class="fn">getNodes</span>();
<span class="kw">const</span> selected = editor.<span class="fn">getSelectedNodes</span>();`,
  },
  edges: {
    file: 'edges.js',
    html: `<span class="cm">// Add a bezier edge</span>
editor.<span class="fn">addEdge</span>({
  source:      <span class="str">'nodeA'</span>,  sourceHandle: <span class="str">'out'</span>,
  target:      <span class="str">'nodeB'</span>,  targetHandle: <span class="str">'in'</span>,
  type:        <span class="str">'bezier'</span>,   <span class="cm">// 'smoothstep' | 'straight'</span>
  label:       <span class="str">'on success'</span>,
  animated:    <span class="kw">true</span>,
  markerEnd:   <span class="kw">true</span>,
  markerColor: <span class="str">'#43c89c'</span>,
});

<span class="cm">// Toggle animation on an edge</span>
editor.<span class="fn">updateEdge</span>(edge.id, { animated: <span class="kw">true</span> });

<span class="cm">// Custom edge path renderer</span>
editor.<span class="fn">registerEdgeType</span>(<span class="str">'dashed'</span>, (edge, src, tgt) =>
  \`M\${src.x},\${src.y} C ... L\${tgt.x},\${tgt.y}\`
);`,
  },
  events: {
    file: 'events.js',
    html: `<span class="cm">// Subscribe to editor events</span>
editor.<span class="fn">on</span>(<span class="str">'connect'</span>, edge => {
  console.<span class="fn">log</span>(<span class="str">'New connection:'</span>, edge);
});

editor.<span class="fn">on</span>(<span class="str">'nodeMove'</span>, nodes => {
  <span class="fn">savePositions</span>(nodes.map(n => ({ id: n.id, x: n.x, y: n.y })));
});

editor.<span class="fn">on</span>(<span class="str">'selectionChange'</span>, ({ nodes, edges }) => {
  setInspector(nodes[<span class="nm">0</span>] ?? edges[<span class="nm">0</span>]);
});

<span class="cm">// Programmatic delete of currently selected nodes/edges</span>
<span class="kw">const</span> deleted = editor.<span class="fn">deleteSelection</span>();
console.<span class="fn">log</span>(<span class="str">'Deleted:'</span>, deleted.nodes, <span class="str">'nodes and'</span>, deleted.edges, <span class="str">'edges'</span>);

<span class="cm">// Available events:</span>
<span class="cm">// nodeAdd, nodeRemove, nodeMove, nodeClick,</span>
<span class="cm">// edgeAdd, edgeRemove, edgeClick, connect,</span>
<span class="cm">// selectionChange, viewportChange, historyChange, paste</span>`,
  },
  custom: {
    file: 'custom-node.js',
    html: `<span class="cm">// Register a fully custom node renderer</span>
editor.<span class="fn">registerNodeType</span>(<span class="str">'metric'</span>, (node, bodyEl) => {
  <span class="kw">const</span> { label, value, trend, color } = node.data;
  bodyEl.innerHTML = \`
    &lt;div class="metric-node"&gt;
      &lt;div class="metric-title"&gt;\${label}&lt;/div&gt;
      &lt;div class="metric-value" style="color:\${color}"&gt;
        \${value}
      &lt;/div&gt;
      &lt;div class="metric-trend"&gt;\${trend}&lt;/div&gt;
    &lt;/div&gt;
  \`;
});

<span class="cm">// Then add nodes of that type</span>
editor.<span class="fn">addNode</span>({
  type: <span class="str">'metric'</span>,  x: <span class="nm">100</span>,  y: <span class="nm">100</span>,
    data: { label: <span class="str">'Revenue'</span>, value: <span class="str">'$1.2M'</span>, trend: <span class="str">'↑ 12%'</span>, color: <span class="str">'#43c89c'</span> },
});`,
  },
  multiOutput: {
    file: 'multi-output.js',
    html: `<span class="kw">import</span> { <span class="nm">createMultiOutputNode</span> } <span class="kw">from</span> <span class="str">'jsflow'</span>;

<span class="cm">// Single input + multiple outputs with row UI</span>
<span class="kw">const</span> router = <span class="fn">createMultiOutputNode</span>({
  type: <span class="str">'decision'</span>,
  x: <span class="nm">320</span>, y: <span class="nm">140</span>,
  data: {
    label: <span class="str">'Route Intent'</span>,
    description: <span class="str">'Branch by intent type'</span>,
    outputRows: {
      faq: <span class="str">'Knowledge base'</span>,
      agent: <span class="str">'Escalate to human'</span>,
      fallback: <span class="str">'Default response'</span>,
    },
  },
  outputs: [
    { id: <span class="str">'faq'</span>, label: <span class="str">'FAQ'</span> },
    { id: <span class="str">'agent'</span>, label: <span class="str">'Agent'</span> },
    { id: <span class="str">'fallback'</span>, label: <span class="str">'Other'</span> },
  ],
});

editor.<span class="fn">addNode</span>(router);`,
  },
  plugins: {
    file: 'plugin.js',
    html: `<span class="cm">// Create a reusable plugin</span>
<span class="kw">const</span> AutoLayoutPlugin = {
  <span class="fn">install</span>(editor) {
    editor.<span class="fn">on</span>(<span class="str">'nodeAdd'</span>, () => <span class="fn">applyLayout</span>(editor));

    editor.autoLayout = () => {
      <span class="kw">const</span> nodes = editor.<span class="fn">getNodes</span>();
      <span class="cm">// dagre / elk layout algorithm</span>
      nodes.<span class="fn">forEach</span>((n, i) =>
        editor.<span class="fn">updateNode</span>(n.id, { x: i * <span class="nm">220</span>, y: <span class="nm">0</span> })
      );
    };
  },
};

<span class="cm">// Install and use</span>
editor.<span class="fn">use</span>(<span class="str">'auto-layout'</span>, AutoLayoutPlugin);
editor.<span class="fn">autoLayout</span>();`,
  },
};

// ── State ─────────────────────────────────────────────────────────────────────

let editor = null;
let snapEnabled = false;
let animatedMode = false;
let readonlyMode = false;
let activePropsTab = 'properties';

function renderDatabaseTable(node, bodyEl) {
  const accent = /^#[0-9a-f]{6}$/i.test(node.data.accent ?? '') ? node.data.accent : '#6f79c6';
  const columns = Array.isArray(node.data.columns) ? node.data.columns : [];

  bodyEl.innerHTML = `
    <div class="db-table" style="--db-accent:${accent}">
      <div class="db-table__header">${esc(node.data.label ?? node.id)}</div>
      <div class="db-table__rows">
        ${columns.map(col => `
          <div class="db-table__row">
            <span class="db-table__name">${col.pk ? '🗝 ' : col.fk ? '↳ ' : ''}${esc(col.name)}</span>
            <span class="db-table__type">${esc(col.type)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
}

// ── Init editor ───────────────────────────────────────────────────────────────

function initEditor(scenario = 'chatbot') {
  const container = document.getElementById('flow-canvas');
  if (editor) { editor.destroy(); container.innerHTML = ''; }
  container.classList.toggle('db-scenario', scenario === 'database');

  const data = SCENARIOS[scenario] ?? { nodes: [], edges: [] };
  const isDatabaseScenario = scenario === 'database';
  editor = new FlowEditor({
    container,
    nodes:      data.nodes,
    edges:      data.edges,
    background: 'dots',
    minimap:    !isDatabaseScenario,
    snapToGrid: snapEnabled,
    gridSize:   20,
  });

  if (isDatabaseScenario) {
    editor.registerNodeType('dbtable', renderDatabaseTable);
    editor.getNodes().forEach(node => editor.updateNode(node.id, { data: { ...node.data } }));
  }
  editor.on('selectionChange', ({ nodes, edges }) => {
    document.getElementById('statusSelected').textContent =
      `${nodes.length + edges.length} selected`;
    updatePropsPanel(nodes, edges);
  });

  editor.on('viewportChange', vp => {
    document.getElementById('statusZoom').textContent =
      `${Math.round(vp.zoom * 100)}%`;
  });

  editor.on('nodeAdd',    refreshStatusCounts);
  editor.on('nodeRemove', refreshStatusCounts);
  editor.on('edgeAdd',    refreshStatusCounts);
  editor.on('edgeRemove', refreshStatusCounts);

  refreshStatusCounts();
  setTimeout(() => editor.fitView(60), 80);
}

function refreshStatusCounts() {
  if (!editor) return;
  document.getElementById('statusNodes').textContent = `${editor.getNodes().length} nodes`;
  document.getElementById('statusEdges').textContent = `${editor.getEdges().length} edges`;
}

// ── Properties panel ──────────────────────────────────────────────────────────

function updatePropsPanel(nodeIds, edgeIds) {
  const content = document.getElementById('propsContent');
  if (!editor) return;

  if (!nodeIds.length && !edgeIds.length) {
    content.innerHTML = `<div class="props-placeholder"><div class="props-placeholder-icon">🎯</div><div class="props-placeholder-text">Select a node or edge</div></div>`;
    return;
  }
  if (nodeIds.length > 1) {
    content.innerHTML = `<div class="props-placeholder"><div class="props-placeholder-icon">⬡</div><div class="props-placeholder-text">${nodeIds.length} nodes selected</div></div>`;
    return;
  }
  if (nodeIds.length === 1) {
    const node = editor.getNode(nodeIds[0]);
    if (node) renderNodeProps(content, node, activePropsTab);
    return;
  }
  const edge = editor.getEdge(edgeIds[0]);
  if (edge) renderEdgeProps(content, edge);
}

function renderNodeProps(content, node, tab) {
  if (tab === 'properties') {
    content.innerHTML = `
      <div class="props-form">
        <div class="props-section-title">Identity</div>
        <div class="field-group"><div class="field-label">Label</div><input class="field-input" id="pfLabel" value="${esc(node.data.label ?? '')}" /></div>
        <div class="field-group"><div class="field-label">Description</div><input class="field-input" id="pfDesc" value="${esc(node.data.description ?? '')}" /></div>
        <div class="field-row">
          <div class="field-group"><div class="field-label">X</div><input class="field-input" id="pfX" type="number" value="${Math.round(node.x)}" /></div>
          <div class="field-group"><div class="field-label">Y</div><input class="field-input" id="pfY" type="number" value="${Math.round(node.y)}" /></div>
        </div>
        <div class="field-row">
          <div class="field-group"><div class="field-label">Width</div><input class="field-input" id="pfW" type="number" value="${Math.round(node.width)}" /></div>
          <div class="field-group"><div class="field-label">Height</div><input class="field-input" id="pfH" type="number" value="${Math.round(node.height)}" /></div>
        </div>
        <div class="field-group"><div class="field-label">Icon</div><input class="field-input" id="pfIcon" value="${esc(node.data.icon ?? '')}" /></div>
        <div class="field-group"><div class="field-label">Badge</div><input class="field-input" id="pfBadge" value="${esc(node.data.badge ?? '')}" /></div>
        <div class="section-divider"></div>
        <div class="props-section-title">Ports</div>
        <div class="port-list">
          ${node.ports.map(p => `<div class="port-item"><div class="port-dot ${p.type}"></div><span>${esc(p.label ?? p.id)}</span><span class="port-id">${esc(p.position)}</span></div>`).join('')}
        </div>
      </div>`;
    wire('pfLabel', v => editor.updateNode(node.id, { data: { ...node.data, label: v } }));
    wire('pfDesc',  v => editor.updateNode(node.id, { data: { ...node.data, description: v } }));
    wire('pfX',     v => editor.updateNode(node.id, { x: +v }));
    wire('pfY',     v => editor.updateNode(node.id, { y: +v }));
    wire('pfW',     v => editor.updateNode(node.id, { width: Math.max(80, +v) }));
    wire('pfH',     v => editor.updateNode(node.id, { height: Math.max(40, +v) }));
    wire('pfIcon',  v => editor.updateNode(node.id, { data: { ...node.data, icon: v } }));
    wire('pfBadge', v => editor.updateNode(node.id, { data: { ...node.data, badge: v } }));
  } else if (tab === 'style') {
    content.innerHTML = `
      <div class="props-form">
        <div class="props-section-title">Node Type</div>
        <div class="field-group">
          <select class="field-select" id="pfType">
            ${['input','output','action','condition','trigger','decision'].map(t =>
              `<option value="${t}" ${node.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="section-divider"></div>
        <div class="props-section-title">ID</div>
        <div class="field-group"><input class="field-input" value="${esc(node.id)}" readonly style="opacity:.5" /></div>
      </div>`;
    const typeEl = document.getElementById('pfType');
    if (typeEl) typeEl.addEventListener('change', () => editor.updateNode(node.id, { type: typeEl.value }));
  } else {
    content.innerHTML = `
      <div class="props-form">
        <div class="props-section-title">Debug Info</div>
        <pre style="font-family:var(--mono);font-size:11px;color:var(--c-muted);line-height:1.6;white-space:pre-wrap;word-break:break-all">${esc(JSON.stringify({ id: node.id, type: node.type, x: Math.round(node.x), y: Math.round(node.y), ports: node.ports.length }, null, 2))}</pre>
      </div>`;
  }
}

function renderEdgeProps(content, edge) {
  content.innerHTML = `
    <div class="props-form">
      <div class="props-section-title">Edge</div>
      ${[['ID', edge.id], ['Source', edge.source], ['Target', edge.target], ['Type', edge.type], ['Label', edge.label || '—']].map(([k,v]) =>
        `<div class="edge-prop-row"><span class="edge-prop-key">${k}</span><span class="edge-prop-val">${esc(String(v))}</span></div>`).join('')}
      <div class="section-divider"></div>
      <div class="toggle-row"><span class="toggle-lbl">Animated</span>
        <label class="toggle"><input type="checkbox" id="efAnimated" ${edge.animated ? 'checked' : ''} /><span class="toggle-slider"></span></label>
      </div>
      <div class="toggle-row"><span class="toggle-lbl">Arrow marker</span>
        <label class="toggle"><input type="checkbox" id="efMarker" ${edge.markerEnd !== false ? 'checked' : ''} /><span class="toggle-slider"></span></label>
      </div>
      <div class="field-group" style="margin-top:12px"><div class="field-label">Label</div><input class="field-input" id="efLabel" value="${esc(edge.label ?? '')}" /></div>
      <div class="field-group"><div class="field-label">Type</div>
        <select class="field-select" id="efType">
          ${['bezier','smoothstep','straight'].map(t => `<option value="${t}" ${edge.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>`;
  document.getElementById('efAnimated')?.addEventListener('change', e => editor.updateEdge(edge.id, { animated: e.target.checked }));
  document.getElementById('efMarker')?.addEventListener('change',   e => editor.updateEdge(edge.id, { markerEnd: e.target.checked }));
  document.getElementById('efLabel')?.addEventListener('change',    e => editor.updateEdge(edge.id, { label: e.target.value }));
  document.getElementById('efType')?.addEventListener('change',     e => editor.updateEdge(edge.id, { type: e.target.value }));
}

function wire(id, updater) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => updater(el.value));
}

// ── Palette ───────────────────────────────────────────────────────────────────

function buildPalette() {
  const list = document.getElementById('paletteList');
  list.innerHTML = '';
  for (const group of PALETTE_TYPES) {
    const gl = document.createElement('div');
    gl.className = 'palette-group-label';
    gl.textContent = group.group;
    list.appendChild(gl);
    for (const item of group.items) {
      const el = document.createElement('div');
      el.className = 'palette-item';
      el.draggable = true;
      el.innerHTML = `
        <span class="palette-icon">${item.icon}</span>
        <div>
          <div class="palette-name">${item.label}${item.badge ? ` <span style="font-size:10px;color:${item.color};font-weight:600">${item.badge}</span>` : ''}</div>
          <div class="palette-desc">${item.desc}</div>
        </div>
        <div class="palette-accent" style="background:${item.color}"></div>`;
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('application/jsflow-node', JSON.stringify(item));
        showDragIndicator(`${item.icon} ${item.label}`);
      });
      el.addEventListener('dragend', hideDragIndicator);
      list.appendChild(el);
    }
  }
}

document.getElementById('paletteSearch').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  for (const el of document.querySelectorAll('.palette-item')) {
    el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
  }
});

// ── Drop from palette ─────────────────────────────────────────────────────────

const canvasWrap = document.querySelector('.canvas-wrap');

canvasWrap.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
canvasWrap.addEventListener('drop', e => {
  e.preventDefault();
  hideDragIndicator();
  const raw = e.dataTransfer.getData('application/jsflow-node');
  if (!raw || !editor) return;
  const item  = JSON.parse(raw);
  const rect  = document.getElementById('flow-canvas').getBoundingClientRect();
  const world = editor.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const isIvrMenu = item.label === 'IVR Menu';
  editor.addNode({
    type: isIvrMenu ? 'decision' : item.type,
    x: world.x - 90,
    y: world.y - 30,
    width: isIvrMenu ? 280 : 180,
    height: isIvrMenu ? 360 : undefined,
    data: { label: item.label, icon: item.icon, description: item.desc },
    ports: isIvrMenu ? createIvrDigitPorts() : undefined,
  });
});

// ── Drag indicator ────────────────────────────────────────────────────────────

const dragEl = document.getElementById('dragIndicator');
function showDragIndicator(label) { dragEl.textContent = label; dragEl.style.display = 'flex'; }
function hideDragIndicator() { dragEl.style.display = 'none'; }
document.addEventListener('dragover', e => { dragEl.style.left = `${e.clientX + 14}px`; dragEl.style.top = `${e.clientY + 14}px`; });

// ── Toolbar buttons ───────────────────────────────────────────────────────────

document.getElementById('btnUndo').addEventListener('click',    () => editor?.undo());
document.getElementById('btnRedo').addEventListener('click',    () => editor?.redo());
document.getElementById('btnFit').addEventListener('click',     () => editor?.fitView(60));
document.getElementById('btnZoomIn').addEventListener('click',  () => editor?.zoomIn());
document.getElementById('btnZoomOut').addEventListener('click', () => editor?.zoomOut());

document.getElementById('btnSnap').addEventListener('click', e => {
  snapEnabled = !snapEnabled;
  editor?.setSnapToGrid(snapEnabled);
  e.currentTarget.style.color = snapEnabled ? 'var(--c-accent)' : '';
});

document.getElementById('btnAnimated').addEventListener('click', e => {
  animatedMode = !animatedMode;
  if (editor) editor.updateEdges({ animated: animatedMode });
  e.currentTarget.style.color = animatedMode ? 'var(--c-accent)' : '';
});

document.getElementById('btnExport').addEventListener('click', () => {
  if (!editor) return;
  const blob = new Blob([JSON.stringify(editor.export(), null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'jsflow-graph.json' });
  a.click(); URL.revokeObjectURL(a.href);
});

document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFileInput').click());
document.getElementById('importFileInput').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file || !editor) return;
  const reader = new FileReader();
  reader.onload = ev => { try { editor.import(JSON.parse(ev.target.result)); } catch { alert('Invalid JSON file.'); } };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btnReadonly').addEventListener('click', e => {
  readonlyMode = !readonlyMode;
  editor?.setReadonly(readonlyMode);
  e.currentTarget.textContent = readonlyMode ? '🔓' : '🔒';
  document.getElementById('statusMode').textContent = readonlyMode ? 'readonly' : 'normal';
});

document.getElementById('btnClear').addEventListener('click', () => {
  if (!editor) return;
  if (!confirm('Clear all nodes and edges?')) return;
  editor.clearGraph();
});

// ── Scenario tabs ─────────────────────────────────────────────────────────────

for (const tab of document.querySelectorAll('.demo-tab')) {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.demo-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    initEditor(tab.dataset.scenario);
    document.getElementById('statusSelected').textContent = '0 selected';
    document.getElementById('statusZoom').textContent = '100%';
    document.getElementById('statusMode').textContent = readonlyMode ? 'readonly' : 'normal';
  });
}

// ── Properties panel tabs ─────────────────────────────────────────────────────

for (const tab of document.querySelectorAll('.props-tab')) {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.props-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activePropsTab = tab.dataset.tab;
    if (editor) {
      const sel = editor.getSelectedNodes();
      if (sel.length) renderNodeProps(document.getElementById('propsContent'), sel[0], activePropsTab);
    }
  });
}

// ── Code snippet tabs ─────────────────────────────────────────────────────────

function showSnippet(key) {
  const snip = CODE_SNIPPETS[key];
  if (!snip) return;
  document.getElementById('codeContent').innerHTML = snip.html;
  document.getElementById('codeFileName').textContent = snip.file;
}

for (const btn of document.querySelectorAll('.code-tab-btn')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.code-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showSnippet(btn.dataset.snippet);
  });
}

document.getElementById('copyCodeBtn').addEventListener('click', () => {
  const text = document.getElementById('codeContent').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyCodeBtn');
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  });
});

document.getElementById('npmPill').addEventListener('click', () => {
  navigator.clipboard.writeText("import { FlowEditor } from 'jsflow';");
});

// ── Utils ─────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────

buildPalette();
showSnippet('setup');
initEditor('chatbot');
