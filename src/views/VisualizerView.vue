<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ProteinSelector from '../components/ProteinSelector.vue'
import { useDatasetProteins } from '../composables/useDatasetProteins'
import BackToMenu from '../components/BackToMenu.vue'
import { formatCount, type Dataset } from '../datasets'
import { useDatasetGraph } from '../composables/useDatasetGraph'
import { useGeneAnnotation } from '../composables/useGeneAnnotation'
import { requestGraphExpansion } from '../infrastructure/datasetsApi'
import { getStoredDataset } from '../infrastructure/datasetsStorage'

defineProps<{ datasets: readonly Dataset[] }>()
const dataset = defineModel<Dataset>({ required: true })
const { proteins, loadingProteins, proteinListError } = useDatasetProteins(dataset)
const emit = defineEmits<{ back: [] }>()
const mode = ref<'neighborhood' | 'shortest-path'>('neighborhood')
const origin = ref('')
const destination = ref('')
const generatedNeighborhoodScope = ref<'sample' | 'dataset'>('sample')
const queriedPathScope = ref<'sample' | 'dataset'>('sample')
const proteinId = ref('')
const distanceLevel = ref(2)
const pickerOpen = ref(false)
const pickerTrigger = ref<HTMLButtonElement | null>(null)

const {
  fullGraphNodeCount,
  graphHtml,
  selectedProtein,
  fullProteinDetails,
  subgraphProteinDetails,
  pathResult,
  pathStatus,
  subgraphKind,
  generateShortestPath,
  fullGraphHtml,
  fullGraphImageUrl,
  subgraphHtml,
  subgraphImageUrl,
  graphError,
  generatingGraph,
  downloadingGraph,
  hasFullGraph,
  hasSubgraph,
  activeGraph,
  generateGraph,
  generateSubgraph,
  downloadGraph,
  showGraph,
  clearGraph,
} = useDatasetGraph()
type ViewerState = { ids: string[], edges: [string, string][], connected: string[], canUndo: boolean }
const viewerStates = ref<Record<'full' | 'subgraph', ViewerState>>({
  full: { ids: [], edges: [], connected: [], canUndo: false },
  subgraph: { ids: [], edges: [], connected: [], canUndo: false },
})
const currentViewerState = computed(() => viewerStates.value[activeGraph.value])
const neighborhoodNodeBudget = computed(() => typeof nodeLimit.value === 'number' && Number.isSafeInteger(nodeLimit.value) && nodeLimit.value > 0 ? nodeLimit.value : 100)
const connectedNeighborIds = computed(() => new Set(currentViewerState.value.connected))
const remainingConnections = computed(() => (selectedProtein.value?.neighbors ?? []).filter(id => !connectedNeighborIds.value.has(id)).length)
const maxExpansionConnections = 20
const expansionAmount = ref<number | null>(10)
const expandingGraph = ref(false)
const globalProteinId = ref('')
const explorationStatus = ref('')
let pendingExpansion: AbortController | undefined
let expansionRequest = 0
let expansionTimeout: number | undefined

function cancelExpansion() {
  pendingExpansion?.abort()
  pendingExpansion = undefined
  window.clearTimeout(expansionTimeout)
  expandingGraph.value = false
  expansionRequest++
}

function sendExploration(action: string, payload: Record<string, unknown> = {}) {
  const frame = activeGraph.value === 'full' ? graphFrame.value : subgraphFrame.value
  frame?.contentWindow?.postMessage({ type: 'prote-prote:exploration', action, ...payload }, '*')
}

async function expandProtein(id: string, focus = false) {
  id = id.trim()
  if (!id || expandingGraph.value || loadingGraph.value) return
  if (!focus && activeGraph.value !== 'full') return
  const amount = focus ? 10 : expansionAmount.value
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1 || amount > maxExpansionConnections) return
  const bootstrap = !graphHtml.value
  const channel = activeGraph.value
  const current = currentViewerState.value
  const controller = new AbortController()
  pendingExpansion = controller
  const requestId = ++expansionRequest
  expandingGraph.value = true
  graphError.value = ''
  explorationStatus.value = ''
  expansionTimeout = window.setTimeout(() => {
    if (requestId !== expansionRequest) return
    controller.abort()
    expandingGraph.value = false
    graphError.value = 'La expansión tardó demasiado. Vuelve a intentarlo.'
  }, 60_000)
  try {
    const record = await getStoredDataset(dataset.value.name)
    if (controller.signal.aborted) return
    if (!record) throw new Error('No se pudo recuperar el dataset guardado.')
    const result = await requestGraphExpansion(record.file, record.hasHeader, id,
      bootstrap ? [] : current.ids,
      bootstrap || selectedProtein.value?.id !== id ? [] : current.connected,
      amount, bootstrap, controller.signal)
    if (controller.signal.aborted || requestId !== expansionRequest) return
    if (bootstrap) {
      if (!result.html) throw new Error('No se pudo abrir el visor interactivo.')
      clearGraph()
      fullGraphHtml.value = result.html
      fullGraphNodeCount.value = result.nodes.length
      fullProteinDetails.value = result.details
      proteinId.value = id
      generatedNodeLimit.value = typeof nodeLimit.value === 'number' && nodeLimit.value > 0 ? nodeLimit.value : 100
      generatedInteractive.value = true
      expandingGraph.value = false
      window.clearTimeout(expansionTimeout)
      explorationStatus.value = 'Exploración interactiva iniciada desde la proteína buscada.'
    } else {
      if (activeGraph.value !== channel) return
      sendExploration('expand', { ...result, requestId, focus })
      // The iframe confirms the applied patch before another expansion can start.
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      graphError.value = error instanceof Error ? error.message : 'No se pudieron agregar conexiones.'
      expandingGraph.value = false
      window.clearTimeout(expansionTimeout)
    }
  } finally {
    if (pendingExpansion === controller) pendingExpansion = undefined
  }
}

async function searchGlobalProtein(id = globalProteinId.value) {
  if (loadingGraph.value || expandingGraph.value) return
  mode.value = 'neighborhood'
  if (activeGraph.value !== 'full') {
    showGraph('full')
    await nextTick()
  }
  id = id.trim()
  if (graphHtml.value && currentViewerState.value.ids.includes(id)) {
    sendExploration('select', { id })
    sendExploration('center', { id })
    return
  }
  void expandProtein(id, true)
}

function undoExpansion() {
  if (!canControlGraph.value || expandingGraph.value || !currentViewerState.value.canUndo) return
  sendExploration('undo')
  explorationStatus.value = 'Se deshizo la última expansión de esta vista.'
}

function restartExploration() {
  if (loadingGraph.value || expandingGraph.value) return
  cancelExpansion()
  clearGraph()
  proteinId.value = ''
  globalProteinId.value = ''
  explorationStatus.value = ''
}

watch(() => selectedProtein.value?.id, () => {
  expansionAmount.value = Math.max(1, Math.min(10, remainingConnections.value))
})
watch(remainingConnections, remaining => {
  if (typeof expansionAmount.value === 'number' && expansionAmount.value > remaining) {
    expansionAmount.value = Math.max(1, remaining)
  }
})
watch(activeGraph, cancelExpansion)
watch(fullGraphHtml, () => { viewerStates.value.full = { ids: [], edges: [], connected: [], canUndo: false } })
watch(subgraphHtml, () => { viewerStates.value.subgraph = { ids: [], edges: [], connected: [], canUndo: false } })

const showPathResults = computed(() => activeGraph.value === 'subgraph' && subgraphKind.value === 'shortest-path')
const { annotation, loadingAnnotation, annotationError, retryAnnotation } = useGeneAnnotation(
  computed(() => selectedProtein.value?.id),
)
const showFullGeneSummary = ref(false)
watch(() => selectedProtein.value?.id, () => { showFullGeneSummary.value = false })
const geneSummaryPreview = computed(() => {
  const summary = annotation.value?.summary ?? ''
  return summary.length > 280 ? `${summary.slice(0, 280).replace(/\s+\S*$/, '')}…` : summary
})
const neighborQuery = ref('')
const neighborPage = ref(0)
const neighborsPerPage = 25
const filteredNeighbors = computed(() => {
  const query = neighborQuery.value.trim().toLowerCase()
  return (selectedProtein.value?.neighbors ?? []).filter(id => id.toLowerCase().includes(query))
    .sort((a, b) => Number(connectedNeighborIds.value.has(b)) - Number(connectedNeighborIds.value.has(a)))
})
const neighborPageCount = computed(() => Math.ceil(filteredNeighbors.value.length / neighborsPerPage))
const visibleNeighbors = computed(() => filteredNeighbors.value.slice(
  neighborPage.value * neighborsPerPage, (neighborPage.value + 1) * neighborsPerPage,
))
watch(selectedProtein, () => {
  neighborQuery.value = ''
  neighborPage.value = 0
})
watch(neighborQuery, () => { neighborPage.value = 0 })

const nodeLimit = ref<number | null>(100)
const interactiveLimit = 100
const interactive = ref(true)
const randomMode = ref(false)
const randomWarning = ref<HTMLDialogElement | null>(null)

function requestRandomMode(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.checked) { randomMode.value = false; return }
  input.checked = false
  randomWarning.value?.showModal()
}

function confirmRandomMode() {
  randomMode.value = true
  randomWarning.value?.close()
}
const generatedNodeLimit = ref<number | null>(null)
const generatedInteractive = ref(true)
const generatedSubgraphProtein = ref('')
const generatedSubgraphDistance = ref(2)
const queriedOrigin = ref('')
const queriedDestination = ref('')
const loadWarning = ref<HTMLDialogElement | null>(null)
const graphFrame = ref<HTMLIFrameElement | null>(null)
const subgraphFrame = ref<HTMLIFrameElement | null>(null)
const graphPanel = ref<HTMLElement | null>(null)
const graphStage = ref<HTMLDivElement | null>(null)
const isFullscreen = ref(false)
let resizeObserver: ResizeObserver | undefined
let pendingFit = 0
const fullViewerReady = ref(false)
const subgraphViewerReady = ref(false)
const viewerReady = computed(() => activeGraph.value === 'full' ? fullViewerReady.value : subgraphViewerReady.value)
const loadingGraph = computed(() => generatingGraph.value || (!!graphHtml.value && !viewerReady.value))
const canControlGraph = computed(() => !!graphHtml.value && viewerReady.value && !loadingGraph.value)

function controlGraph(action: 'zoom-in' | 'zoom-out' | 'fit' | 'resize' | 'download') {
  if (!canControlGraph.value) return
  const frame = activeGraph.value === 'full' ? graphFrame.value : subgraphFrame.value
  frame?.contentWindow?.postMessage({ type: 'prote-prote:graph-control', action }, '*')
}

function fitGraph() {
  window.cancelAnimationFrame(pendingFit)
  pendingFit = window.requestAnimationFrame(() => controlGraph('fit'))
}

function resizeGraph() {
  window.cancelAnimationFrame(pendingFit)
  // Wait for the fullscreen styles and iframe viewport to settle before resizing the canvas.
  pendingFit = window.requestAnimationFrame(() => {
    pendingFit = window.requestAnimationFrame(() => controlGraph('resize'))
  })
}

function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === graphPanel.value
  resizeGraph()
}

async function toggleFullscreen() {
  try {
    if (isFullscreen.value) await document.exitFullscreen()
    else await graphPanel.value?.requestFullscreen()
  } catch {
    graphError.value = 'No se pudo abrir la pantalla completa en este navegador.'
  }
}

watch(activeGraph, fitGraph, { flush: 'post' })
watch(graphStage, (stage) => {
  resizeObserver?.disconnect()
  if (stage) resizeObserver?.observe(stage)
}, { flush: 'post' })

watch(fullGraphHtml, (html, _, onCleanup) => {
  fullViewerReady.value = false
  if (!html) return

  const timeout = window.setTimeout(() => {
    if (fullViewerReady.value) return

    fullViewerReady.value = true
    graphError.value = 'El visor interactivo tardó demasiado. Prueba con menos nodos o usa el modo imagen.'
  }, 5 * 60 * 1_000)
  onCleanup(() => window.clearTimeout(timeout))
})

watch(subgraphHtml, (html, _, onCleanup) => {
  subgraphViewerReady.value = false
  if (!html) return

  const timeout = window.setTimeout(() => {
    if (subgraphViewerReady.value) return

    subgraphViewerReady.value = true
    graphError.value = 'El visor interactivo tardó demasiado. Prueba con menos nodos o usa el modo imagen.'
  }, 5 * 60 * 1_000)
  onCleanup(() => window.clearTimeout(timeout))
})

function syncNodeHighlights() {
  const message = {
    type: 'prote-prote:highlight-proteins',
    origin: mode.value === 'shortest-path' ? origin.value.trim() : '',
    destination: mode.value === 'shortest-path' ? destination.value.trim() : '',
  }
  graphFrame.value?.contentWindow?.postMessage({ ...message, selected: fullProteinDetails.value?.id ?? '', pickingPath: mode.value === 'shortest-path' }, '*')
  subgraphFrame.value?.contentWindow?.postMessage({ ...message, selected: subgraphProteinDetails.value?.id ?? '', pickingPath: mode.value === 'shortest-path' && subgraphKind.value === 'neighborhood' }, '*')
}

watch([mode, origin, destination, proteinId, fullProteinDetails, subgraphProteinDetails], syncNodeHighlights, { flush: 'post' })
watch(() => dataset.value.name, () => {
  cancelExpansion()
  globalProteinId.value = ''
  proteinId.value = ''
  origin.value = ''
  destination.value = ''
})

function onViewerMessage(event: MessageEvent) {
  const fromFull = event.source === graphFrame.value?.contentWindow
  const fromSubgraph = event.source === subgraphFrame.value?.contentWindow
  if (!fromFull && !fromSubgraph) return
  const channel = fromFull ? 'full' : 'subgraph'
  const fromActive = channel === activeGraph.value
  if (event.data?.type === 'prote-prote:graph-state') {
    const data = event.data
    if (!Array.isArray(data.ids) || !data.ids.every((id: unknown) => typeof id === 'string') || !Array.isArray(data.visibleNeighbors) || !data.visibleNeighbors.every((id: unknown) => typeof id === 'string')) return
    const previous = viewerStates.value[channel]
    const edgePairs = Array.isArray(data.edges) && data.edges.every((pair: unknown) => Array.isArray(pair) && pair.length === 2 && pair.every(id => typeof id === 'string'))
      ? data.edges as [string, string][] : previous.edges
    viewerStates.value[channel] = { ids: data.ids, edges: edgePairs, connected: data.visibleNeighbors, canUndo: data.canUndo === true }
    if (fromFull) fullGraphNodeCount.value = data.ids.length
    if (data.requestId === expansionRequest && fromActive) {
      expandingGraph.value = false
      window.clearTimeout(expansionTimeout)
      explorationStatus.value = 'Red actualizada. Puedes continuar desde cualquier proteína.'
      syncNodeHighlights()
    }
    return
  }
  if (event.data?.type === 'prote-prote:graph-image') {
    if (!fromActive || typeof event.data.image !== 'string' || !event.data.image.startsWith('data:image/png;base64,')) return
    const anchor = document.createElement('a')
    anchor.href = event.data.image
    anchor.download = 'red-explorada.png'
    anchor.click()
    return
  }
  if (event.data?.type === 'prote-prote:protein-cleared') {
    if (!fromActive) return
    if (fromFull) fullProteinDetails.value = null
    else subgraphProteinDetails.value = null
    viewerStates.value[channel].connected = []
    proteinId.value = ''
    return
  }
  if (event.data?.type === 'prote-prote:protein-selected') {
    if (generatingGraph.value || (activeGraph.value === 'full' ? !fromFull : !fromSubgraph)) return
    const details = event.data.details
    const id = event.data.id ?? details?.id
    if (typeof id !== 'string' || !id) return
    if (mode.value === 'neighborhood') proteinId.value = id
    else if (fromFull || subgraphKind.value === 'neighborhood') {
      if (!origin.value.trim() || destination.value.trim()) {
        origin.value = id
        destination.value = ''
      } else if (id !== origin.value.trim()) destination.value = id
    }
    if (!details || typeof details.id !== 'string' || typeof details.degree !== 'number' || !Array.isArray(details.neighbors) || !details.neighbors.every((id: unknown) => typeof id === 'string') || typeof details.component !== 'string' || typeof details.component_size !== 'number') return
    viewerStates.value[channel].connected = Array.isArray(event.data.visible_neighbors)
      ? event.data.visible_neighbors.filter((id: unknown) => typeof id === 'string') : []
    if (fromFull) fullProteinDetails.value = details
    else subgraphProteinDetails.value = details
    return
  }
  if (event.data !== 'prote-prote:graph-ready') return
  if (event.source === graphFrame.value?.contentWindow) {
    fullViewerReady.value = true
  } else if (event.source === subgraphFrame.value?.contentWindow) {
    subgraphViewerReady.value = true
  }
  syncNodeHighlights()
  const viewer = event.source as Window
  viewer.postMessage({ type: 'prote-prote:exploration', action: 'state' }, '*')
  const selected = fromFull ? fullProteinDetails.value : subgraphProteinDetails.value
  if (selected) viewer.postMessage({ type: 'prote-prote:exploration', action: 'select', id: selected.id }, '*')
  if (activeGraph.value === 'full' ? fromFull : fromSubgraph) fitGraph()
}

onMounted(() => {
  window.addEventListener('message', onViewerMessage)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  resizeObserver = new ResizeObserver(resizeGraph)
  if (graphStage.value) resizeObserver.observe(graphStage.value)
})
onBeforeUnmount(() => {
  cancelExpansion()
  window.removeEventListener('message', onViewerMessage)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  resizeObserver?.disconnect()
  window.cancelAnimationFrame(pendingFit)
})

watch(nodeLimit, (limit) => {
  if (typeof limit === 'number') interactive.value = limit <= interactiveLimit
})

function requestGraph(confirmInteractive = false) {
  const limit = nodeLimit.value
  if (loadingGraph.value || expandingGraph.value || typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1) return

  if (interactive.value && limit > interactiveLimit && !confirmInteractive) {
    loadWarning.value?.showModal()
    return
  }

  loadWarning.value?.close()
  cancelExpansion()
  explorationStatus.value = ''
  generatedNodeLimit.value = limit
  generatedInteractive.value = interactive.value
  void generateGraph(dataset.value, limit, interactive.value, randomMode.value)
}

async function requestSubgraph(scope: 'sample' | 'dataset' = 'sample') {
  const id = proteinId.value.trim()
  if (loadingGraph.value || expandingGraph.value || !id || !Number.isInteger(distanceLevel.value) || distanceLevel.value < 1 || distanceLevel.value > 3) return
  const globalScope = scope === 'dataset'
  if (!globalScope && !hasFullGraph.value) {
    graphError.value = 'Genera una red muestra o elige explorar en todo el dataset.'
    return
  }
  const original = viewerStates.value.full
  if (!globalScope && fullGraphHtml.value && !original.ids.includes(id)) {
    graphError.value = 'La proteína no está en la red muestra. También puedes elegir Todo el dataset.'
    return
  }
  const distance = distanceLevel.value
  const budget = globalScope ? neighborhoodNodeBudget.value : generatedNodeLimit.value ?? 100
  const snapshot = !globalScope && fullGraphHtml.value ? { nodes: [...original.ids], edges: [...original.edges] } : undefined
  if (await generateSubgraph(dataset.value, id, distance, budget, true, snapshot, globalScope)) {
    generatedNeighborhoodScope.value = scope
    generatedSubgraphProtein.value = id
    generatedSubgraphDistance.value = distance
  }
}

function requestGraphDownload() {
  if (graphHtml.value) { controlGraph('download'); return }
  if (generatedNodeLimit.value === null) return
  void downloadGraph(dataset.value, generatedNodeLimit.value, generatedSubgraphProtein.value, generatedSubgraphDistance.value)
}

function requestShortestPath(scope: 'sample' | 'dataset' = 'sample') {
  const start = origin.value.trim()
  const end = destination.value.trim()
  if (loadingGraph.value || expandingGraph.value || !start || !end) return
  const globalScope = scope === 'dataset'
  if (!globalScope && !hasFullGraph.value) {
    graphError.value = 'Genera una red muestra o elige buscar en todo el dataset.'
    return
  }
  const original = viewerStates.value.full
  if (!globalScope && fullGraphHtml.value && (!original.ids.includes(start) || !original.ids.includes(end))) {
    graphError.value = 'Ambas proteínas deben estar en la red muestra. También puedes elegir Todo el dataset.'
    return
  }
  const snapshot = !globalScope && fullGraphHtml.value ? { nodes: [...original.ids], edges: [...original.edges] } : undefined
  queriedOrigin.value = start
  queriedDestination.value = end
  queriedPathScope.value = scope
  void generateShortestPath(dataset.value, start, end, generatedNodeLimit.value ?? 100, true, globalScope, snapshot)
}

function swapProteins() {
  const previousOrigin = origin.value
  origin.value = destination.value
  destination.value = previousOrigin
}

function resetPath() {
  if (loadingGraph.value) return
  origin.value = ''
  destination.value = ''
  queriedOrigin.value = ''
  queriedDestination.value = ''
  pathResult.value = null
  pathStatus.value = 'Sin consulta'
  graphError.value = ''
  if (hasFullGraph.value) showGraph('full')
  else clearGraph()
}

function closePicker() {
  pickerOpen.value = false
  pickerTrigger.value?.focus()
}

function selectDataset(option: Dataset) {
  if (expandingGraph.value) return
  if (option.name !== dataset.value.name) clearGraph()
  dataset.value = option
  closePicker()
}

function dismissPickerOnBlur(event: FocusEvent) {
  const selector = event.currentTarget as HTMLElement
  if (!selector.contains(event.relatedTarget as Node | null)) {
    pickerOpen.value = false
  }
}
</script>

<template>
  <section class="visualizer" :aria-label="`Visualización del dataset ${dataset.name}`">
    <div class="visualizer-grid">
      <aside class="parameters-panel">
        <section class="glass-panel parameter-section" aria-labelledby="prepare-network-title">
          <BackToMenu @back="emit('back')" />
          <h2 id="prepare-network-title">1. Preparar red</h2>
          <details class="sample-preparation" open>
            <summary>
              <span>Generar red muestra</span>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
            </summary>
            <div class="sample-fields">
              <label class="field-label" for="node-limit">Límite máximo de nodos</label>
              <input id="node-limit" class="protein-input" type="number" min="1" placeholder="100" v-model.number="nodeLimit" />
              <label class="field-label interactive-option">
                <input v-model="interactive" type="checkbox" />
                Modo interactivo
              </label>
              <div class="random-option">
                <label class="field-label interactive-option">
                  <input :checked="randomMode" type="checkbox" @change="requestRandomMode" />
                  Modo aleatorio
                </label>
              </div>
              <button
                class="graph-action dataset-graph-action"
                type="button"
                :disabled="loadingGraph || expandingGraph || typeof nodeLimit !== 'number' || !Number.isSafeInteger(nodeLimit) || nodeLimit < 1"
                @click="requestGraph()"
              >
                {{ loadingGraph ? 'Generando…' : 'Generar red muestra' }}
              </button>
            </div>
          </details>
          <details class="sample-preparation">
            <summary>
              <span>Buscar en todo el dataset</span>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
            </summary>
            <div class="sample-fields">
              <ProteinSelector id="global-protein" v-model="globalProteinId" label="Identificador de proteína" :proteins="proteins" :disabled="loadingGraph || expandingGraph" placeholder="ID de proteína…" @select="searchGlobalProtein" @submit="searchGlobalProtein()" />
              <button class="graph-action global-search-action" type="button" :disabled="loadingGraph || expandingGraph || !globalProteinId.trim()" @click="searchGlobalProtein()">Abrir proteína</button>
              <p v-if="loadingProteins" class="path-hint" role="status">Cargando proteínas…</p>
              <p v-if="proteinListError" class="path-hint" role="alert">{{ proteinListError }}</p>
              <p class="path-hint">Abre sus conexiones sin generar una muestra primero.</p>
            </div>
          </details>
          <template v-if="graphHtml">
            <p class="exploration-count">{{ formatCount(currentViewerState.ids.length) }} proteínas visibles</p>
            <div class="exploration-tools">
              <button type="button" :disabled="!canControlGraph || !selectedProtein || expandingGraph" @click="sendExploration('center', { id: selectedProtein?.id })">Centrar selección</button>
              <button type="button" :disabled="loadingGraph || expandingGraph" @click="restartExploration">Reiniciar</button>
            </div>
          </template>
          <p v-if="explorationStatus" class="path-hint" role="status">{{ explorationStatus }}</p>
        </section>

        <section class="glass-panel parameter-section" aria-labelledby="explore-network-title">
          <h2 id="explore-network-title">2. Explorar entorno</h2>
          <div class="mode-switch" aria-label="Modo de exploración">
            <button type="button" :disabled="expandingGraph" :aria-pressed="mode === 'neighborhood'" @click="mode = 'neighborhood'">Explorar entorno</button>
            <button type="button" :disabled="expandingGraph" :aria-pressed="mode === 'shortest-path'" @click="mode = 'shortest-path'">Camino más corto</button>
          </div>

          <div v-show="mode === 'neighborhood'" class="mode-fields">
            <ProteinSelector id="protein-id" v-model="proteinId" label="Consulta de entorno" :proteins="proteins" placeholder="Buscar proteína…" @submit="requestSubgraph()" />

            <div class="hop-options" role="group" aria-label="Distancia máxima" aria-describedby="distance-description">
              <button
                v-for="level in 3"
                :key="level"
                type="button"
                :aria-pressed="distanceLevel === level"
                @click="distanceLevel = level"
              >{{ level }} {{ level === 1 ? 'salto' : 'saltos' }}</button>
            </div>
            <p id="distance-description" class="distance-description">
              Hasta {{ distanceLevel }} {{ distanceLevel === 1 ? 'salto' : 'saltos' }} desde la proteína elegida.
            </p>

            <button class="graph-action neighborhood-action" type="button" :disabled="loadingGraph || expandingGraph || !hasFullGraph || !proteinId.trim()" @click="requestSubgraph('sample')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
              {{ generatingGraph ? 'Generando…' : 'Ver entorno en muestra' }}
            </button>
            <button class="graph-action neighborhood-action dataset-environment-action" type="button" :disabled="loadingGraph || expandingGraph || !proteinId.trim()" :title="`Explora todo el dataset y muestra hasta ${formatCount(neighborhoodNodeBudget)} proteínas`" @click="requestSubgraph('dataset')">Ver en todo el dataset</button>
          </div>

          <div v-show="mode === 'shortest-path'" class="mode-fields">
            <ProteinSelector id="origin-protein" v-model="origin" label="Proteína de origen (morado)" :proteins="proteins" placeholder="Buscar origen…" />
            <button class="swap-button" type="button" aria-label="Intercambiar origen y destino" @click="swapProteins">
              <span aria-hidden="true">⇅</span>
            </button>
            <ProteinSelector id="destination-protein" v-model="destination" label="Proteína de destino (verde)" :proteins="proteins" placeholder="Buscar destino…" />
            <button class="graph-action neighborhood-action" type="button" :disabled="loadingGraph || expandingGraph || !hasFullGraph || !origin.trim() || !destination.trim()" @click="requestShortestPath('sample')">
              {{ generatingGraph ? 'Buscando…' : 'Encontrar camino en muestra' }}
            </button>
            <button class="graph-action neighborhood-action dataset-environment-action" type="button" :disabled="loadingGraph || expandingGraph || !origin.trim() || !destination.trim()" @click="requestShortestPath('dataset')">Encontrar en todo el dataset</button>
            <p v-if="!showPathResults && pathStatus !== 'Sin consulta'" class="path-hint" role="status">{{ pathStatus }}</p>
          </div>
        </section>
      </aside>

      <section ref="graphPanel" class="glass-panel graph-panel" aria-label="Área del grafo">
        <header class="graph-header">
          <div class="dataset-info">
            <div class="dataset-selector" @keydown.esc="pickerOpen && closePicker()" @focusout="dismissPickerOnBlur">
              <button
                ref="pickerTrigger"
                class="dataset-trigger"
                type="button"
                :aria-expanded="pickerOpen"
                :title="`Dataset ${dataset.name}`"
                :disabled="loadingGraph || expandingGraph"
                aria-controls="visualizer-dataset-picker"
                @click="pickerOpen = !pickerOpen"
              >
                <span>Dataset {{ dataset.name }}</span>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
              </button>
              <Transition name="dataset-tray">
                <div v-show="pickerOpen" id="visualizer-dataset-picker" class="dataset-picker" role="group" aria-label="Datasets disponibles">
                  <button
                    v-for="option in datasets"
                    :key="option.name"
                    type="button"
                    :aria-pressed="option.name === dataset.name"
                    :disabled="loadingGraph || expandingGraph"
                    @click="selectDataset(option)"
                  >{{ option.name }}</button>
                </div>
              </Transition>
            </div>
            <div v-if="dataset.nodes !== undefined || dataset.edges !== undefined" class="dataset-counts">
              <span v-if="dataset.nodes !== undefined">{{ formatCount(dataset.nodes) }} proteínas</span>
              <span v-if="dataset.edges !== undefined">{{ formatCount(dataset.edges) }} asociaciones</span>
            </div>
          </div>
          <div class="graph-toolbar" aria-label="Herramientas del grafo">
            <button type="button" aria-label="Acercar" :disabled="!canControlGraph" @click="controlGraph('zoom-in')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7v7M7 10.5h7"/></svg>
            </button>
            <button type="button" aria-label="Alejar" :disabled="!canControlGraph" @click="controlGraph('zoom-out')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M7 10.5h7"/></svg>
            </button>
            <button type="button" aria-label="Centrar grafo" title="Centrar grafo" :disabled="!canControlGraph" @click="controlGraph('fit')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
            </button>
            <span class="toolbar-divider"></span>
            <button type="button" :aria-label="isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'" :aria-pressed="isFullscreen" @click="toggleFullscreen">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg>
            </button>
            <button
              type="button"
              aria-label="Descargar grafo como PNG"
              :title="downloadingGraph ? 'Preparando imagen PNG…' : 'Descargar la vista actual como PNG'"
              :disabled="(!hasFullGraph && !hasSubgraph) || loadingGraph || expandingGraph || downloadingGraph"
              @click="requestGraphDownload"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>
            </button>
          </div>
          <p v-if="hasFullGraph || hasSubgraph" class="sample-notice" role="status">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></svg>
            <span>
              {{ graphHtml ? `Vista actual: ${formatCount(currentViewerState.ids.length)} proteínas` : `Muestra: ${formatCount(fullGraphNodeCount ?? generatedNodeLimit ?? 0)} proteínas` }} ·
              {{ (graphHtml ? currentViewerState.ids.length : fullGraphNodeCount) === dataset.nodes ? 'Incluye todo el dataset.' : 'Vista parcial del dataset.' }}
            </span>
          </p>
        </header>


        <div v-if="hasSubgraph" class="graph-view-switch" aria-label="Vista del grafo">
          <button v-if="hasFullGraph" type="button" :disabled="generatingGraph || expandingGraph" :aria-pressed="activeGraph === 'full'" @click="showGraph('full')">Grafo original</button>
          <button type="button" :disabled="generatingGraph || expandingGraph" :aria-pressed="activeGraph === 'subgraph'" @click="showGraph('subgraph')">{{ subgraphKind === 'shortest-path' ? 'Camino más corto' : `Subgrafo · ${generatedNeighborhoodScope === 'sample' ? 'Muestra' : 'Dataset'}` }}</button>
        </div>

        <p v-if="graphError" role="alert">{{ graphError }}</p>
        <div v-if="hasFullGraph || hasSubgraph || loadingGraph" ref="graphStage" class="graph-stage">
          <iframe
            v-if="fullGraphHtml"
            ref="graphFrame"
            class="graph-frame"
            :class="{ 'graph-frame-pending': !fullViewerReady, 'graph-frame-inactive': activeGraph !== 'full' }"
            title="Grafo generado de interacciones entre proteínas"
            :srcdoc="fullGraphHtml"
            sandbox="allow-scripts"
          ></iframe>
          <iframe
            v-if="subgraphHtml"
            ref="subgraphFrame"
            class="graph-frame"
            :class="{ 'graph-frame-pending': !subgraphViewerReady, 'graph-frame-inactive': activeGraph !== 'subgraph' }"
            title="Subgrafo de interacciones entre proteínas"
            :srcdoc="subgraphHtml"
            sandbox="allow-scripts"
          ></iframe>
          <img
            v-if="fullGraphImageUrl"
            class="graph-image"
            :class="{ 'graph-image-inactive': activeGraph !== 'full' }"
            :src="fullGraphImageUrl"
            alt="Imagen del grafo de interacciones entre proteínas"
          />
          <img
            v-if="subgraphImageUrl"
            class="graph-image"
            :class="{ 'graph-image-inactive': activeGraph !== 'subgraph' }"
            :src="subgraphImageUrl"
            alt="Imagen del subgrafo de interacciones entre proteínas"
          />
          <div v-if="loadingGraph" class="empty-graph" role="status">
            <img class="mascot mascot-loading" src="/images/mascot.png" alt="" />
            <h2>Generando el grafo…</h2>
            <p>Estamos preparando las conexiones del dataset.</p>
          </div>
        </div>
        <div v-else class="empty-graph">
          <img class="mascot" src="/images/mascot.png" alt="Mascota de Prote-Prote" />
          <h2>Explora la red de proteínas</h2>
          <p>Busca cualquier proteína del dataset para comenzar desde sus conexiones, o pulsa <strong>Generar red muestra</strong> para obtener una vista inicial.</p>
          <p>Selecciona un nodo y agrega conexiones para continuar sin perder la red actual.</p>
        </div>
      </section>

      <aside class="glass-panel details-panel">
        <section v-if="showPathResults" class="path-results" aria-label="Resultados del camino">
          <h2>Resultados del camino</h2>
          <dl class="protein-details">
            <div><dt>Búsqueda en</dt><dd>{{ queriedPathScope === 'sample' ? 'Red muestra' : 'Todo el dataset' }}</dd></div>
            <div><dt>Proteína inicial</dt><dd>{{ pathStatus === 'Sin consulta' ? '--' : queriedOrigin }}</dd></div>
            <div><dt>Proteína final</dt><dd>{{ pathStatus === 'Sin consulta' ? '--' : queriedDestination }}</dd></div>
            <div><dt>Longitud mínima</dt><dd>{{ pathResult?.length ?? '--' }}</dd></div>
            <div><dt>Proteínas en la ruta</dt><dd>{{ pathResult ? pathResult.path.length : '--' }}</dd></div>
            <div><dt>Algoritmo</dt><dd>{{ pathStatus === 'Sin consulta' ? '--' : 'BFS' }}</dd></div>
            <div><dt>Tiempo BFS</dt><dd>{{ pathResult ? `${pathResult.elapsed_ms.toFixed(3)} ms` : '--' }}</dd></div>
            <div><dt>Estado</dt><dd role="status">{{ pathStatus }}</dd></div>
          </dl>
          <p v-if="pathResult?.path.length" class="path-route">{{ pathResult.path.join(' → ') }}</p>
          <button class="reset-path" type="button" :disabled="loadingGraph" @click="resetPath">Nueva consulta</button>
        </section>
        <section aria-label="Detalles de la proteína seleccionada">
          <template v-if="selectedProtein">
            <h2>Proteína {{ selectedProtein.id }}</h2>
            <section class="gene-info" aria-label="Información del gen">
              <p v-if="loadingAnnotation" class="gene-status" role="status">Consultando información del gen…</p>
              <div v-else-if="annotationError">
                <p class="gene-status" role="status">{{ annotationError }}</p>
                <button class="gene-toggle" type="button" @click="retryAnnotation">Reintentar</button>
              </div>
              <template v-else-if="annotation">
                <p v-if="annotation.symbol" class="gene-symbol">{{ annotation.symbol }}</p>
                <p v-if="annotation.name" class="gene-name">{{ annotation.name }}</p>
                <template v-if="annotation.summary">
                  <h3>Resumen del gen</h3>
                  <p class="gene-summary">{{ showFullGeneSummary ? annotation.summary : geneSummaryPreview }}</p>
                  <button v-if="annotation.summary.length > 280" class="gene-toggle" type="button" :aria-expanded="showFullGeneSummary" @click="showFullGeneSummary = !showFullGeneSummary">{{ showFullGeneSummary ? 'Ver menos' : 'Leer más' }}</button>
                </template>
                <p v-else class="gene-status">No hay un resumen disponible para este gen.</p>
                <a class="gene-source" :href="`https://mygene.info/v3/gene/${encodeURIComponent(annotation.id)}?fields=symbol,name,summary`" target="_blank" rel="noopener noreferrer">Fuente: MyGene.info · texto original</a>
              </template>
              <p v-else class="gene-status">No se encontró información para este ID en MyGene.info. Se admiten identificadores de gen Entrez y Ensembl.</p>
            </section>
            <dl class="protein-details">
              <div><dt>Conexiones directas</dt><dd>{{ formatCount(selectedProtein.neighbors.length) }}</dd></div>
              <div><dt>Conexiones visibles</dt><dd>{{ formatCount(connectedNeighborIds.size) }}</dd></div>
            </dl>
            <details :key="`${activeGraph}-${selectedProtein.id}`" class="neighbors-section">
              <summary>
                <span>Ver proteínas conectadas</span>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
              </summary>
              <div class="neighbors-content">
              <template v-if="selectedProtein.neighbors.length">
                <label class="field-label" for="neighbor-search">Buscar vecino por ID</label>
                <input id="neighbor-search" v-model="neighborQuery" class="protein-input" type="search" placeholder="Filtrar vecinos…" autocomplete="off" />
                <p class="neighbors-count" role="status">{{ formatCount(filteredNeighbors.length) }} de {{ formatCount(selectedProtein.neighbors.length) }} vecinos</p>
                <ul v-if="visibleNeighbors.length" class="neighbors-list" aria-label="Vecinos encontrados" tabindex="0">
                  <li v-for="(neighbor, index) in visibleNeighbors" :key="`${neighbor}-${index}`">
                    <button type="button" @click="searchGlobalProtein(neighbor)" :disabled="loadingGraph || expandingGraph" :aria-label="`Explorar proteína ${neighbor}`">{{ neighbor }}</button>
                    <span v-if="connectedNeighborIds.has(neighbor)" class="neighbor-visible">visible</span>
                  </li>
                </ul>
                <p v-else class="neighbors-empty">No se encontraron vecinos con ese ID.</p>
                <nav v-if="neighborPageCount > 1" class="neighbors-pagination" aria-label="Páginas de vecinos">
                  <button type="button" :disabled="neighborPage === 0" @click="neighborPage--">Anterior</button>
                  <span>{{ neighborPage + 1 }} / {{ neighborPageCount }}</span>
                  <button type="button" :disabled="neighborPage + 1 >= neighborPageCount" @click="neighborPage++">Siguiente</button>
                </nav>
              </template>
              <p v-else class="neighbors-empty">Esta proteína no tiene vecinos.</p>
              </div>
            </details>
            <div v-if="!showPathResults" class="expansion-actions">
              <template v-if="graphHtml && activeGraph === 'full'">
                <label class="field-label" for="expansion-amount">Conexiones a agregar (máx. 20)</label>
                <input id="expansion-amount" v-model.number="expansionAmount" class="protein-input" type="number" min="1" :max="Math.max(1, Math.min(maxExpansionConnections, remainingConnections))" :disabled="expandingGraph || !remainingConnections" />
                <p class="path-hint">{{ remainingConnections ? `${formatCount(remainingConnections)} conexiones por mostrar.` : 'Todas sus conexiones están visibles.' }}</p>
                <button class="graph-action" type="button" :disabled="!canControlGraph || expandingGraph || !remainingConnections || typeof expansionAmount !== 'number' || !Number.isSafeInteger(expansionAmount) || expansionAmount < 1 || expansionAmount > remainingConnections || expansionAmount > maxExpansionConnections" @click="expandProtein(selectedProtein.id)">
                  {{ expandingGraph ? 'Agregando…' : `Agregar ${expansionAmount ?? 0} ${expansionAmount === 1 ? 'conexión' : 'conexiones'}` }}
                </button>
                <button class="reset-path" type="button" :disabled="!canControlGraph || expandingGraph || !currentViewerState.canUndo" @click="undoExpansion">Deshacer última expansión</button>
              </template>
              <p v-else-if="activeGraph === 'subgraph'" class="path-hint">Agrega conexiones desde el grafo original. El subgrafo conserva únicamente sus conexiones visibles.</p>
              <p v-else class="path-hint">Abre una proteína desde la búsqueda global para explorar sus conexiones en modo interactivo.</p>
            </div>
          </template>
          <p v-else class="details-intro">Haz clic en un nodo del grafo para ver los detalles de la proteína.</p>
        </section>
      </aside>
    </div>
    <dialog ref="randomWarning" class="load-warning" aria-labelledby="random-warning-title" aria-describedby="random-warning-message">
      <h2 id="random-warning-title">¿Activar modo aleatorio?</h2>
      <p id="random-warning-message">Normalmente se toman nodos del grupo conectado más grande. El modo aleatorio elige de todo el dataset, sin optimizar la visualización; pueden quedar nodos aislados.</p>
      <form method="dialog" class="load-warning-actions">
        <button class="reset-path" autofocus>Cancelar</button>
        <button class="graph-action" type="button" @click="confirmRandomMode">Activar modo aleatorio</button>
      </form>
    </dialog>
    <dialog ref="loadWarning" class="load-warning" aria-labelledby="load-warning-title" aria-describedby="load-warning-message">
      <h2 id="load-warning-title">El grafo puede tardar en cargar</h2>
      <p id="load-warning-message">
        Pediste hasta {{ nodeLimit }} nodos. El modo interactivo puede tardar más con más de {{ interactiveLimit }} nodos.
      </p>
      <form method="dialog" class="load-warning-actions">
        <button class="reset-path" autofocus>Cancelar</button>
        <button class="graph-action" type="button" @click="requestGraph(true)">Generar interactivo</button>
      </form>
    </dialog>
  </section>
</template>

<style scoped>
.visualizer {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
  padding: clamp(10px, 2dvh, 20px) 4px 0;
  color: #12333f;
}

.visualizer :is(button, input):focus-visible { outline: 2px solid #08485d; outline-offset: 3px; }

.graph-stage { position: relative; display: grid; flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
.graph-stage > * { grid-area: 1 / 1; }

.graph-frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: transparent;
}

.graph-frame-pending { visibility: hidden; }
.graph-frame-inactive, .graph-image-inactive { visibility: hidden; pointer-events: none; }
.graph-image { display: block; width: 100%; min-height: 0; max-height: 65dvh; flex: 1; object-fit: contain; }

.graph-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px 16px;
  padding: clamp(10px, 1.5vw, 20px);
}

.dataset-info { min-width: 0; }
.dataset-selector { position: relative; width: fit-content; max-width: 100%; }
.dataset-counts { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 0.9rem; }

.dataset-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.dataset-trigger span { min-width: 0; overflow-wrap: anywhere; }
.dataset-trigger:hover { text-decoration: underline; text-underline-offset: 3px; }
.dataset-trigger svg { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.75; }
.dataset-trigger[aria-expanded='true'] svg { transform: rotate(180deg); }

.dataset-picker {
  position: absolute;
  z-index: 2;
  inset-block-start: calc(100% + 4px);
  inset-inline-start: 0;
  display: grid;
  min-width: max(100%, 140px);
  max-height: 180px;
  gap: 4px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 12px;
  background: linear-gradient(#edfaff, #c8ebf1);
  box-shadow: 0 6px 16px rgb(12 76 103 / 24%);
}

.dataset-picker button {
  padding: 7px 14px;
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 10px;
  background: linear-gradient(#f2fdff, #c0e8ef);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dataset-picker button:hover { filter: brightness(1.05); }
.dataset-picker button[aria-pressed='true'] { background: linear-gradient(#28758b, #134a61); color: white; }
.dataset-tray-enter-active, .dataset-tray-leave-active { transition: opacity 160ms ease, transform 160ms ease; }
.dataset-tray-enter-from, .dataset-tray-leave-to { opacity: 0; transform: translateY(-6px); }

.visualizer-grid {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.9fr) minmax(0, 1.05fr);
  gap: clamp(10px, 1.4vw, 24px);
}

.parameters-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  flex-direction: column;
  gap: clamp(10px, 1.4vw, 24px);
}

.parameter-section {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  padding: clamp(10px, 2dvh, 22px) clamp(10px, 1.4vw, 22px);
}
.mode-fields :deep(.protein-selector) { margin-bottom: 12px; }
.mode-fields :deep(label) { text-transform: none; font-size: 0.875rem; }

.parameters-panel h2 {
  margin: 0 0 10px;
  font-size: clamp(1.2rem, 1.45vw, 1.5rem);
  font-weight: 700;
  line-height: 1.15;
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 34px;
  margin: 0 0 12px;
  gap: 3px;
  padding: 3px;
  border: 1px solid #96bdc8;
  border-radius: 11px;
  background: #c6e7ee;
}

.mode-switch button {
  border: 0;
  padding: 5px 3px;
  background: transparent;
  color: #164c5c;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  line-height: 1.2;
  font-weight: 600;
}

.mode-switch button[aria-pressed='true'] { border-radius: 8px; background: linear-gradient(#28758b, #134a61); box-shadow: inset 0 1px 0 rgb(255 255 255 / 45%); color: white; }
.mode-fields { display: flex; flex-direction: column; }
.field-label { margin: 0 0 5px; font-size: 0.875rem; font-weight: 700; line-height: 1.2; }
.protein-input { width: 100%; min-height: 34px; margin: 0 0 10px; border: 1px solid #8aafbb; border-radius: 8px; padding: 4px 10px; background: #f5fcff; color: inherit; font: inherit; font-size: 0.875rem; }
.protein-input::placeholder { color: #49636d; opacity: 1; }

.hop-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
  padding: 3px;
  border: 1px solid #96bdc8;
  border-radius: 11px;
  background: #c6e7ee;
}

.hop-options button {
  min-height: 34px;
  border: 0;
  border-radius: 8px;
  padding: 5px 3px;
  background: transparent;
  color: #164c5c;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.hop-options button[aria-pressed='true'] {
  background: linear-gradient(#28758b, #134a61);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 45%);
  color: white;
}

.distance-description { margin: 6px 0 14px; color: #34535e; font-size: 0.8rem; line-height: 1.4; }
.neighborhood-action { display: flex; align-items: center; justify-content: center; gap: 8px; }
.graph-action.neighborhood-action { width: 100%; }
.graph-action.dataset-environment-action { margin-top: 8px; border: 1px solid #8aafbb; background: #e4f7fb; color: #164c5c; box-shadow: inset 0 1px 0 rgb(255 255 255 / 45%); }
.neighborhood-action svg { width: 20px; height: 20px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }

.graph-action {
  width: min(100%, 190px);
  margin: 0 auto;
  min-height: 34px;
  border: 0;
  border-radius: 999px;
  padding: 6px 14px;
  background: linear-gradient(#22c0d3, #1550bd);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 45%), 0 4px 10px rgb(12 76 103 / 20%);
  color: white;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
}

.graph-action:disabled { cursor: not-allowed; opacity: 0.8; }
.interactive-option { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.interactive-option input { margin: 0; accent-color: #16566d; }
.random-option { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.random-option .interactive-option { margin: 0; }
.dataset-graph-action { margin-bottom: 16px; }
.swap-button, .reset-path {
  align-self: center;
  border: 1px solid #8aafbb;
  border-radius: 8px;
  padding: 4px 10px;
  background: #e4f7fb;
  color: #164c5c;
  font: inherit;
  cursor: pointer;
}
.swap-button { margin: 0 0 8px; }
.reset-path { display: block; margin: 16px auto 0; padding: 6px 14px; }
.load-warning {
  width: min(440px, calc(100% - 32px));
  padding: 20px;
  border: 1px solid #8aafbb;
  border-radius: 16px;
  background: #e4f7fb;
  color: #12333f;
}
.load-warning::backdrop { background: rgb(18 51 63 / 55%); }
.load-warning h2 { margin: 0 0 8px; font-size: 1.25rem; }
.load-warning p { margin: 0 0 16px; }
.load-warning-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.load-warning-actions button { width: auto; margin: 0; }

.graph-panel { display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(155deg, rgb(180 231 238 / 58%), rgb(154 217 227 / 43%) 52%, rgb(171 230 233 / 54%)); }
.graph-panel:fullscreen { width: 100vw; height: 100dvh; padding: 20px; overflow: hidden; background: #a5d6da; }
.graph-panel:fullscreen .graph-stage { min-height: 0; }
.graph-panel:fullscreen .graph-image { max-height: calc(100dvh - 160px); }
.sample-notice {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin: 6px 0 0;
  color: #34535e;
  font-size: 0.75rem;
  line-height: 1.4;
}
.sample-notice svg { width: 14px; height: 14px; flex: none; margin-top: 1px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.graph-view-switch { display: flex; align-self: center; gap: 4px; margin: 0 12px 8px; padding: 3px; border: 1px solid #96bdc8; border-radius: 11px; background: #c6e7ee; }
.graph-view-switch button { border: 0; border-radius: 8px; padding: 5px 12px; background: transparent; color: #164c5c; cursor: pointer; font: inherit; font-size: 0.85rem; }
.graph-view-switch button[aria-pressed='true'] { background: linear-gradient(#28758b, #134a61); color: white; }
.graph-toolbar { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid rgb(205 240 246 / 55%); border-radius: 14px; background: linear-gradient(rgb(203 237 243 / 82%), rgb(161 219 232 / 72%)); box-shadow: 0 3px 8px rgb(12 76 103 / 15%); }
.graph-toolbar button { display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: 8px; padding: 0; background: transparent; color: #154858; cursor: pointer; }
.graph-toolbar button:enabled:hover { background: #cde9f0; }
.graph-toolbar button:disabled { opacity: 0.55; cursor: not-allowed; }
.graph-toolbar svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.8; }
.toolbar-divider { width: 1px; height: 24px; margin: 0 3px; background: #8aafbb; }

.empty-graph { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; padding: 12px; text-align: center; }
.mascot { width: clamp(90px, min(14vw, 24dvh), 190px); height: auto; margin-bottom: clamp(8px, 2dvh, 22px); object-fit: contain; }
.mascot-loading { animation: mascot-float 1.6s ease-in-out infinite; }

@keyframes mascot-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

@media (prefers-reduced-motion: reduce) {
  .mascot-loading { animation: none; }
}

.empty-graph h2 { margin: 0; font-size: clamp(1.15rem, 1.8vw, 1.85rem); font-weight: 700; line-height: 1.25; }
.empty-graph p { max-width: 44ch; margin: clamp(8px, 1.6dvh, 20px) 0 0; font-size: clamp(1rem, 1.2vw, 1.2rem); line-height: 1.4; }

.details-panel { overflow-y: auto; overscroll-behavior: contain; padding: clamp(10px, 2dvh, 22px) clamp(10px, 1.4vw, 22px); }
.path-results { margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid rgb(43 100 104 / 25%); }
.details-panel h2 { margin: 0 0 clamp(8px, 1.5dvh, 18px); font-size: clamp(1.25rem, 1.65vw, 1.75rem); font-weight: 700; line-height: 1.15; }
.details-intro { margin: 0 0 clamp(8px, 1.5dvh, 18px); color: #34535e; font-size: clamp(0.95rem, 1.05vw, 1.12rem); line-height: 1.4; }
.gene-info { margin: 0 0 16px; padding-bottom: 14px; border-bottom: 1px solid rgb(43 100 104 / 25%); }
.gene-symbol { width: fit-content; margin: 0 0 6px; padding: 3px 9px; border-radius: 999px; background: #16566d; color: white; font-weight: 700; }
.gene-name { margin: 0 0 12px; font-size: 0.95rem; font-weight: 600; overflow-wrap: anywhere; }
.gene-info h3 { margin: 0 0 5px; font-size: 0.85rem; }
.gene-summary, .gene-status { margin: 0; color: #34535e; font-size: 0.85rem; line-height: 1.5; overflow-wrap: anywhere; }
.gene-summary { max-height: 220px; overflow-y: auto; }
.gene-toggle { display: block; margin: 5px 0; padding: 3px 0; border: 0; background: transparent; color: #164c5c; font: inherit; font-size: 0.8rem; text-decoration: underline; cursor: pointer; }
.gene-source { display: inline-block; margin-top: 10px; color: #164c5c; font-size: 0.75rem; }
.protein-details { margin: 0; }
.protein-details div { display: flex; justify-content: space-between; gap: 8px; padding: 8px 2px; border-bottom: 1px solid rgb(43 100 104 / 25%); font-size: clamp(0.95rem, 1vw, 1.05rem); }
.protein-details dt, .protein-details dd { margin: 0; }
.protein-details dd { color: #34535e; }
.protein-details dd { text-align: right; overflow-wrap: anywhere; min-width: 0; }
.neighbors-section { margin-top: 0; }
.neighbors-section summary { display: flex; align-items: center; gap: 8px; padding: 12px 0; color: #164c5c; font-size: 0.9rem; font-weight: 700; list-style: none; cursor: pointer; }
.neighbors-section summary::-webkit-details-marker { display: none; }
.neighbors-section summary:focus-visible { outline: 2px solid #08485d; outline-offset: 3px; border-radius: 6px; }
.neighbors-section summary svg { margin-left: auto; width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.75; }
.neighbors-section[open] summary svg { transform: rotate(180deg); }
.neighbors-content { padding-bottom: 4px; }
.neighbors-section .field-label { display: block; }
.neighbors-section .protein-input { margin-bottom: 6px; }
.neighbors-count, .neighbors-empty { margin: 0 0 8px; color: #34535e; font-size: 0.8rem; line-height: 1.4; }
.neighbors-list { max-height: 180px; overflow-y: auto; margin: 0; padding: 4px; border: 1px solid #96bdc8; border-radius: 10px; background: rgb(228 247 251 / 45%); list-style: none; }
.neighbors-list li { padding: 6px 8px; border-bottom: 1px solid rgb(43 100 104 / 15%); overflow-wrap: anywhere; font-size: 0.875rem; }
.neighbors-list li:last-child { border-bottom: 0; }
.neighbors-list:focus-visible { outline: 2px solid #08485d; outline-offset: 3px; }
.neighbors-pagination { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 8px; font-size: 0.75rem; }
.neighbors-pagination button { border: 1px solid #8aafbb; border-radius: 8px; padding: 5px 8px; background: #e4f7fb; color: #164c5c; font: inherit; cursor: pointer; }
.neighbors-pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
.path-hint { font-size: 0.8rem; }
.path-route { overflow-wrap: anywhere; line-height: 1.5; max-height: 180px; overflow-y: auto; }

@media (max-width: 850px) {
  .visualizer-grid { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr); grid-template-rows: minmax(0, 3fr) minmax(0, 2fr); }
  .details-panel { grid-column: 1 / -1; }
}

@media (max-width: 560px) {
  .visualizer-grid { grid-template-columns: 1fr; grid-template-rows: none; grid-auto-rows: auto; overflow-y: auto; overscroll-behavior: contain; }
  .parameters-panel { overflow: visible; }
  .graph-panel { height: 50dvh; min-height: 280px; }
  .details-panel { max-height: 60dvh; }
  .details-panel { grid-column: auto; }
}
.sample-preparation { margin-top: 8px; border: 1px solid #96bdc8; border-radius: 11px; background: rgb(198 231 238 / 40%); }
.sample-preparation summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px; font-size: 0.9rem; font-weight: 700; cursor: pointer; list-style: none; }
.sample-preparation summary::-webkit-details-marker { display: none; }
.sample-preparation summary:focus-visible { outline: 2px solid #08485d; outline-offset: 3px; border-radius: 10px; }
.sample-preparation summary svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.75; }
.sample-preparation[open] summary svg { transform: rotate(180deg); }
.sample-fields { display: flex; flex-direction: column; padding: 0 10px 10px; }
.sample-fields .dataset-graph-action { margin-bottom: 0; }
.global-search-action { margin-top: 12px; }
.exploration-count { margin: 10px 0 8px; font-size: 0.85rem; font-weight: 700; }
.exploration-tools { display: flex; flex-wrap: wrap; gap: 6px; }
.exploration-tools button { border: 1px solid #8aafbb; border-radius: 8px; padding: 5px 8px; background: #e4f7fb; color: #164c5c; font: inherit; font-size: 0.8rem; cursor: pointer; }
.exploration-tools button:disabled, .expansion-actions .reset-path:disabled { opacity: 0.5; cursor: not-allowed; }
.expansion-actions { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgb(43 100 104 / 25%); }
.expansion-actions .field-label { display: block; }
.expansion-actions .graph-action { display: block; width: 100%; }
.expansion-actions .reset-path { width: 100%; margin-top: 8px; font-size: 0.8rem; }
.neighbors-list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.neighbors-list li button { min-width: 0; border: 0; padding: 0; background: transparent; color: #164c5c; text-align: left; overflow-wrap: anywhere; font: inherit; cursor: pointer; }
.neighbors-list li button:hover { text-decoration: underline; }
.neighbor-visible { flex: none; border-radius: 999px; padding: 2px 6px; background: rgb(32 164 100 / 15%); color: #165b3d; font-size: 0.7rem; }
</style>
