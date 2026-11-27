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
  const node = (type, text = '') => ({ type, text, children: [], props: {}, style: {}, parent: null })
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

test('protein list is reused on reentry and fetched again after dataset replacement', async () => {
  let calls = 0
  let saves = 0
  let record = { dataset: { name: 'test.csv' }, file: {}, hasHeader: false, revision: '1' }
  const { useProteinComparison } = evaluate(readFileSync(new URL('../src/composables/useProteinComparison.ts', import.meta.url), 'utf8'), {
    '../infrastructure/datasetsApi': {
      requestDatasetProteins: async () => { calls++; return { proteins: ['A', 'B'] } },
    },
    '../infrastructure/datasetsStorage': {
      getStoredDataset: async () => record,
      saveDatasetProteins: async (_, proteins) => { saves++; record.proteins = proteins },
    },
  })
  async function enter() {
    let state
    const { host, root } = renderer()
    const app = host.createApp({ setup() { state = useProteinComparison(vue.ref({ name: 'test.csv' })); return () => null } })
    app.mount(root)
    await settle()
    return { state, app }
  }
  const first = await enter()
  assert.deepEqual([...first.state.proteins.value], ['A', 'B'])
  assert.equal(calls, 1)
  assert.equal(saves, 1)
  first.app.unmount()
  const second = await enter()
  assert.deepEqual([...second.state.proteins.value], ['A', 'B'])
  assert.equal(calls, 1)
  assert.equal(second.state.loadingProteins.value, false)
  second.app.unmount()
  record = { ...record, revision: '2', proteins: undefined }
  const replaced = await enter()
  assert.equal(calls, 2)
  assert.equal(saves, 2)
  replaced.app.unmount()
})

test('summary toggles mount and remove the two MST graph viewers', async () => {
  globalThis.document = { fullscreenElement: null, addEventListener() {}, removeEventListener() {} }
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  let mounts = 0
  let unmounts = 0
  const Graph = vue.defineComponent({ setup() {
    vue.onMounted(() => mounts++)
    vue.onBeforeUnmount(() => unmounts++)
    return () => vue.h('iframe')
  } })
  const protein = id => ({ id, degree: 1, neighbor_count: 1, neighbors: [], component: 1, component_id: '1', component_size: 2 })
  const result = vue.ref({ protein_a: protein('A'), protein_b: protein('B'), shared_neighbors: [], shared_neighbors_count: 0, same_component: true, directly_connected: true, degree_difference: 0, elapsed_ms: 0, graph_a: {}, graph_b: {} })
  const source = readFileSync(new URL('../src/views/CompareProteinsView.vue', import.meta.url), 'utf8')
  const compiled = compileScript(parse(source).descriptor, { id: 'comparison-test', inlineTemplate: true }).content
  const Empty = vue.defineComponent({ setup: () => () => vue.h('span') })
  const View = evaluate(compiled, {
    '../components/BackToMenu.vue': { default: Empty },
    '../components/GeneAnnotationSummary.vue': { default: Empty },
    '../components/ScientificComparisonInsight.vue': { default: Empty },
    '../components/ProteinSelector.vue': { default: Empty },
    '../components/ProteinComparisonGraph.vue': { default: Graph },
    '../datasets': { formatCount: String },
    '../composables/useProteinComparison': { useProteinComparison: () => ({
      proteins: vue.ref(['A', 'B']), comparisonResult: result, loadingProteins: vue.ref(false), proteinListError: vue.ref(''), comparisonError: vue.ref(''), comparing: vue.ref(false),
      comparisonSubgraphHtml: vue.ref(''), comparisonSubgraphError: vue.ref(''), mstComparisonResult: result, comparisonGraphMode: vue.ref('mst'),
      generatingComparisonSubgraph: vue.ref(false), downloadingComparisonSubgraph: vue.ref(false), compare: async () => true,
      generateComparisonSubgraph: async () => true, downloadComparisonSubgraph: async () => {}, clearComparison() {},
    }) },
  }).default
  const { host, root } = renderer()
  const app = host.createApp(View, { modelValue: { name: 'test.csv' }, datasets: [] })
  app.mount(root)
  await settle()
  const all = node => [node, ...node.children.flatMap(all)]
  const viewers = () => all(root).filter(node => node.type === 'iframe')
  const button = text => all(root).find(node => node.type === 'button' && all(node).some(child => child.text.includes(text)))
  assert.equal(viewers().length, 0)
  for (let i = 0; i < 2; i++) {
    button('Visualizar ambas').props.onClick()
    await settle()
    assert.equal(viewers().length, 2)
    button('Vista resumida').props.onClick()
    await settle()
    assert.equal(viewers().length, 0)
    assert.equal(mounts, 2 * (i + 1))
    assert.equal(unmounts, 2 * (i + 1))
  }
  app.unmount()
  delete globalThis.document
  delete globalThis.window
})
