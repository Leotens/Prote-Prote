import { runInNewContext } from 'node:vm'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { compileScript, parse } from '@vue/compiler-sfc'
import * as vue from 'vue'

function evaluate(source, dependencies) {
  const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS })
  const exports = {}
  new Function('require', 'exports', code)(name => {
    if (name === 'vue') return vue
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    const dependency = dependencies[name]
    return dependency.default ? { __esModule: true, ...dependency } : dependency
  }, exports)
  return exports
}

function renderer() {
  const node = (type, text = '') => ({ type, text, children: [], props: {}, style: {}, addEventListener() {}, removeEventListener() {}, contentWindow: type === 'iframe' ? vue.markRaw({ postMessage(message) { messages.push(message) } }) : undefined, parent: null })
  const host = vue.createRenderer({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insertStaticContent(content, parent, anchor) {
      const child = node('#static', content)
      child.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index < 0) parent.children.push(child)
      else parent.children.splice(index, 0, child)
      return [child, child]
    },
    insert(child, parent, anchor = null) {
      if (child.parent) this.remove(child)
      child.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index < 0) parent.children.push(child)
      else parent.children.splice(index, 0, child)
    },
    remove(child) { const siblings = child.parent?.children; if (siblings) siblings.splice(siblings.indexOf(child), 1); child.parent = null },
    setText: (node, text) => { node.text = text },
    setElementText: (node, text) => { node.text = text; node.children = [] },
    patchProp: (node, key, _, value) => { node.props[key] = value },
    parentNode: node => node.parent,
    nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  })
  return { host, root: node('root') }
}

async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve()
  await vue.nextTick()
}


const messages = []

test('node clicks fill exploration and path fields and synchronize endpoint highlights', async () => {
  const listeners = new Map()
  globalThis.window = {
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: name => listeners.delete(name),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout, clearTimeout,
  }
  globalThis.document = { addEventListener() {}, removeEventListener() {} }
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }
  const state = Object.fromEntries([
    ['graphHtml', '<html>graph</html>'], ['fullGraphHtml', '<html>graph</html>'],
    ['subgraphHtml', '<html>subgraph</html>'], ['fullGraphImageUrl', ''], ['subgraphImageUrl', ''],
    ['selectedProtein', null], ['fullProteinDetails', null], ['subgraphProteinDetails', null],
    ['pathResult', null], ['pathStatus', 'Sin consulta'], ['subgraphKind', 'neighborhood'],
    ['graphError', ''], ['generatingGraph', false], ['downloadingGraph', false],
    ['hasFullGraph', true], ['hasSubgraph', true], ['activeGraph', 'full'],
  ].map(([name, value]) => [name, vue.ref(value)]))
  for (const name of ['generateShortestPath', 'generateGraph', 'generateSubgraph', 'downloadGraph', 'showGraph', 'clearGraph']) state[name] = () => {}
  const Empty = vue.defineComponent({ setup: () => () => vue.h('span') })
  const Selector = vue.defineComponent({ props: ['id', 'modelValue', 'proteins'], setup: props => () => vue.h('input', { id: props.id, value: props.modelValue }) })
  const source = readFileSync(new URL('../src/views/VisualizerView.vue', import.meta.url), 'utf8')
  const compiled = compileScript(parse(source).descriptor, { id: 'visualizer-test', inlineTemplate: true }).content
  const View = evaluate(compiled, {
    '../components/BackToMenu.vue': { default: Empty },
    '../components/ProteinSelector.vue': { default: Selector },
    '../datasets': { formatCount: String },
    '../composables/useDatasetGraph': { useDatasetGraph: () => state },
    '../composables/useDatasetProteins': { useDatasetProteins: () => ({ proteins: vue.ref(['A', 'B', 'C']), loadingProteins: vue.ref(false), proteinListError: vue.ref('') }) },
    '../composables/useGeneAnnotation': { useGeneAnnotation: () => ({ annotation: vue.ref(null), loadingAnnotation: vue.ref(false), annotationError: vue.ref(''), retryAnnotation() {} }) },
    '../infrastructure/datasetsApi': { requestGraphExpansion: async () => ({}) },
    '../infrastructure/datasetsStorage': { getStoredDataset: async () => null },
  }).default
  const { host, root } = renderer()
  const app = host.createApp(View, { modelValue: { name: 'test.csv' }, datasets: [] })
  app.mount(root)
  await settle()
  const all = node => [node, ...node.children.flatMap(all)]
  const field = id => all(root).find(node => node.type === 'input' && node.props.id === id)
  const frames = all(root).filter(node => node.type === 'iframe')
  const send = (id, frame = frames[0]) => listeners.get('message')({ source: frame.contentWindow, data: { type: 'prote-prote:protein-selected', id } })
  send('A')
  await settle()
  assert.equal(field('protein-id').props.value, 'A')
  const pathButton = all(root).find(node => node.type === 'button' && node.text === 'Camino más corto')
  pathButton.props.onClick()
  await settle()
  send('A')
  await settle()
  assert.equal(field('origin-protein').props.value, 'A')
  assert.equal(field('destination-protein').props.value, '')
  send('A')
  await settle()
  assert.equal(field('destination-protein').props.value, '')
  send('B')
  await settle()
  assert.equal(field('destination-protein').props.value, 'B')
  assert.deepEqual(messages.at(-1), { type: 'prote-prote:highlight-proteins', origin: 'A', destination: 'B', selected: '', pickingPath: true })
  // Inactive viewers and unrelated windows cannot change the current selection.
  send('C', frames[1])
  listeners.get('message')({ source: {}, data: { type: 'prote-prote:protein-selected', id: 'C' } })
  await settle()
  assert.equal(field('origin-protein').props.value, 'A')
  send('C')
  await settle()
  assert.equal(field('origin-protein').props.value, 'C')
  assert.equal(field('destination-protein').props.value, '')
  state.generatingGraph.value = true
  send('B')
  await settle()
  assert.equal(field('destination-protein').props.value, '')
  app.unmount()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.ResizeObserver
})




test('viewer colors both endpoints, restores previous colors, and ignores empty clicks', () => {
  const source = readFileSync(new URL('../backend/main.py', import.meta.url), 'utf8')
  const script = name => source.split(`${name} = """`)[1].split('"""')[0].replace(/<\/?script>/g, '')
  const records = new Map([['A', { id: 'A', color: '#ff8539' }], ['B', { id: 'B', color: '#ff8539' }]])
  let receive
  let click
  const published = []
  const parent = { postMessage: message => published.push(message) }
  const context = {
    nodes: {
      get: id => id === undefined ? [...records.values()] : records.get(id),
      getIds: () => [...records.keys()],
      update: updates => updates.forEach(update => records.set(update.id, { ...records.get(update.id), ...update })),
    },
    network: { on: (name, handler) => { if (name === 'click') click = handler }, getConnectedNodes: () => [], redraw() {} },
    window: { parent, addEventListener: (_, handler) => { receive = handler } },
  }
  runInNewContext(script('PROTEIN_SELECTION_SCRIPT'), context)
  runInNewContext(script('GRAPH_CONTROL_SCRIPT'), context)
  click({ nodes: [] })
  assert.equal(published.length, 0)
  click({ nodes: ['A'] })
  assert.equal(published[0].id, 'A')
  const highlight = (origin, destination, source = parent) => receive({ source, data: { type: 'prote-prote:highlight-proteins', origin, destination } })
  highlight('A', 'B')
  assert.equal(records.get('A').color.background, '#9857c8')
  assert.equal(records.get('B').color.background, '#20a464')
  assert.equal(records.get('B').color.highlight.background, '#20a464')
  highlight('B', '')
  assert.equal(records.get('A').color, '#ff8539')
  assert.equal(records.get('B').color.background, '#9857c8')
  highlight('A', 'B', {})
  assert.equal(records.get('B').color.background, '#9857c8')
  highlight('', '')
  assert.equal(records.get('B').color, '#ff8539')
})
