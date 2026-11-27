<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BackToMenu from '../components/BackToMenu.vue'
import GeneAnnotationSummary from '../components/GeneAnnotationSummary.vue'
import ProteinComparisonGraph from '../components/ProteinComparisonGraph.vue'
import ProteinSelector from '../components/ProteinSelector.vue'
import ScientificComparisonInsight from '../components/ScientificComparisonInsight.vue'
import { useProteinComparison } from '../composables/useProteinComparison'
import { formatCount, type Dataset } from '../datasets'
import type { ProteinDetails } from '../infrastructure/datasetsApi'

defineProps<{ datasets: readonly Dataset[] }>()
const dataset = defineModel<Dataset>({ required: true })
const emit = defineEmits<{ back: [] }>()
const proteinA = ref('')
const proteinB = ref('')
const pickerOpen = ref(false)
const pickerTrigger = ref<HTMLButtonElement | null>(null)
const subgraphPanel = ref<HTMLElement | null>(null)
const comparisonGraphFrame = ref<HTMLIFrameElement | null>(null)
const isFullscreen = ref(false)
const comparisonGraphReady = ref(false)
const mstReadySides = ref<Set<'A' | 'B'>>(new Set())
const selectedComparisonProtein = ref<ProteinDetails | null>(null)
const displayMode = ref<'summary' | 'subgraph'>('summary')
const expandedWarning = ref<HTMLDialogElement | null>(null)
const sharedNeighborsDialog = ref<HTMLDialogElement | null>(null)
const expandedRelationLimit = 100
const {
  comparisonResult,
  proteins,
  loadingProteins,
  proteinListError,
  comparisonError,
  comparing,
  comparisonSubgraphHtml,
  comparisonSubgraphError,
  mstComparisonResult,
  comparisonGraphMode,
  generatingComparisonSubgraph,
  downloadingComparisonSubgraph,
  compare,
  generateComparisonSubgraph,
  downloadComparisonSubgraph,
  clearComparison,
} = useProteinComparison(dataset)
const proteinCards = computed(() => [
  { label: 'A', details: comparisonResult.value?.protein_a },
  { label: 'B', details: comparisonResult.value?.protein_b },
])
const sharedNeighborSet = computed(() => new Set(comparisonResult.value?.shared_neighbors ?? []))
const exclusiveNeighborsA = computed(() => comparisonResult.value
  ? comparisonResult.value.protein_a.neighbors.filter(neighbor => !sharedNeighborSet.value.has(neighbor)).length
  : 0)
const exclusiveNeighborsB = computed(() => comparisonResult.value
  ? comparisonResult.value.protein_b.neighbors.filter(neighbor => !sharedNeighborSet.value.has(neighbor)).length
  : 0)
const hasComparisonGraph = computed(() => !!comparisonSubgraphHtml.value || !!mstComparisonResult.value)
const graphLegendReady = computed(() => {
  if (displayMode.value !== 'subgraph' || generatingComparisonSubgraph.value) return false
  return comparisonGraphMode.value === 'mst'
    ? mstReadySides.value.size === 2
    : comparisonGraphReady.value
})

function resetGraphReadiness() {
  comparisonGraphReady.value = false
  mstReadySides.value = new Set()
}

function markMstGraphReady(side: 'A' | 'B') {
  const readySides = new Set(mstReadySides.value)
  readySides.add(side)
  mstReadySides.value = readySides
}
function comparisonComponentNumber(side: 'A' | 'B') {
  if (!comparisonResult.value) return '--'
  return side === 'A' || comparisonResult.value.same_component ? 1 : 2
}
const hasManyRelations = computed(() => {
  const result = comparisonResult.value
  if (!result) return false
  return result.protein_a.degree + result.protein_b.degree - Number(result.directly_connected) > expandedRelationLimit
})
const biologicalInterpretation = computed(() => {
  const result = comparisonResult.value
  if (!result) return null
  const shared = result.shared_neighbors_count
  if (shared === 0) {
    return {
      title: 'Sin vecinos compartidos',
      description: result.same_component
        ? 'Las proteínas pertenecen al mismo grupo conectado, pero no comparten vecinos directos. Esto no implica por sí solo una función biológica común.'
        : 'No se observan vecinos compartidos ni un camino de asociaciones entre ambas proteínas en este dataset.',
    }
  }
  const sharedLabel = shared === 1 ? '1 vecino compartido' : `${shared} vecinos compartidos`
  const neighborUnion = Math.max(1, result.protein_a.degree + result.protein_b.degree - shared)
  const similarity = (shared / neighborUnion) * 100
  if (similarity < 5) {
    return {
      title: 'Superposición baja entre entornos',
      description: `Ambas proteínas comparten ${sharedLabel}, pero estos representan solo el ${similarity.toFixed(2)} % de sus vecinos diferentes. La coincidencia es limitada y no permite inferir una función común.`,
    }
  }
  if (similarity <= 20) {
    return {
      title: 'Superposición moderada entre entornos',
      description: `Ambas proteínas comparten ${sharedLabel} y el ${similarity.toFixed(2)} % de sus vecinos diferentes coincide. Esto sugiere una posible relación funcional que requiere evidencia adicional.`,
    }
  }
  return {
    title: 'Superposición alta entre entornos',
    description: `Ambas proteínas comparten ${sharedLabel} y el ${similarity.toFixed(2)} % de sus vecinos diferentes coincide. Sus entornos son similares, aunque esto no confirma una interacción directa ni una función común.`,
  }
})

function closePicker() {
  pickerOpen.value = false
  pickerTrigger.value?.focus()
}

function openSharedNeighbors() {
  if (comparisonResult.value) sharedNeighborsDialog.value?.showModal()
}

function selectDataset(option: Dataset) {
  clearComparison()
  displayMode.value = 'summary'
  dataset.value = option
  closePicker()
}

function requestComparison() {
  displayMode.value = 'summary'
  resetGraphReadiness()
  void compare(dataset.value, proteinA.value, proteinB.value)
}

async function requestComparisonSubgraph() {
  if (!comparisonResult.value) return
  displayMode.value = 'subgraph'
  resetGraphReadiness()
  selectedComparisonProtein.value = null
  await generateComparisonSubgraph(dataset.value, proteinA.value, proteinB.value)
}

function changeComparisonGraphMode(mode: 'comparison' | 'expanded' | 'mst', confirmed = false) {
  if (mode === comparisonGraphMode.value || generatingComparisonSubgraph.value) return
  if (mode === 'expanded' && hasManyRelations.value && !confirmed) {
    expandedWarning.value?.showModal()
    return
  }
  expandedWarning.value?.close()
  resetGraphReadiness()
  selectedComparisonProtein.value = null
  void generateComparisonSubgraph(dataset.value, proteinA.value, proteinB.value, mode)
}

function controlComparisonGraph(action: 'zoom-in' | 'zoom-out' | 'fit' | 'reset-focus') {
  comparisonGraphFrame.value?.contentWindow?.postMessage({ type: 'prote-prote:graph-control', action }, '*')
}

function clearSelectedComparisonProtein() {
  selectedComparisonProtein.value = null
  controlComparisonGraph('reset-focus')
}

function requestComparisonDownload() {
  void downloadComparisonSubgraph(dataset.value, proteinA.value, proteinB.value)
}

function requestFullscreen() {
  if (document.fullscreenElement) {
    void document.exitFullscreen()
  } else {
    void subgraphPanel.value?.requestFullscreen()
  }
}

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === subgraphPanel.value
}

function handleComparisonGraphMessage(event: MessageEvent) {
  if (event.source !== comparisonGraphFrame.value?.contentWindow) return
  if (event.data === 'prote-prote:comparison-graph-ready') {
    comparisonGraphReady.value = true
  } else if (event.data?.type === 'prote-prote:protein-selected') {
    selectedComparisonProtein.value = event.data.details as ProteinDetails
  } else if (event.data?.type === 'prote-prote:protein-cleared') {
    selectedComparisonProtein.value = null
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
  window.addEventListener('message', handleComparisonGraphMessage)
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  window.removeEventListener('message', handleComparisonGraphMessage)
})

function dismissPickerOnBlur(event: FocusEvent) {
  const selector = event.currentTarget as HTMLElement
  if (!selector.contains(event.relatedTarget as Node | null)) pickerOpen.value = false
}
</script>

<template>
  <section class="compare" :aria-label="`Comparar proteínas del dataset ${dataset.name}`">
    <BackToMenu @back="emit('back')" />

    <header class="compare-header">
      <div class="comparison-inputs">
        <ProteinSelector
          id="compare-protein-a"
          v-model="proteinA"
          label="Proteína A"
          :proteins="proteins"
          :disabled="loadingProteins || comparing"
          placeholder="Ejemplo: 7157"
        />
        <ProteinSelector
          id="compare-protein-b"
          v-model="proteinB"
          label="Proteína B"
          :proteins="proteins"
          :disabled="loadingProteins || comparing"
          placeholder="Ejemplo: 4609"
        />
        <button
          class="compare-button"
          type="button"
          :disabled="loadingProteins || comparing || !proteins.length || !proteinA.trim() || !proteinB.trim()"
          @click="requestComparison"
        >{{ comparing ? 'Comparando…' : 'Comparar' }}</button>
      </div>
      <p v-if="loadingProteins" class="comparison-status" role="status">Cargando proteínas del dataset…</p>
      <p v-else-if="proteinListError" class="comparison-error" role="alert">{{ proteinListError }}</p>
      <p v-if="comparisonError" class="comparison-error" role="alert">{{ comparisonError }}</p>
    </header>

    <div class="compare-grid">
      <aside class="protein-column">
        <article v-for="protein in proteinCards" :key="protein.label" class="glass-panel protein-card">
          <h2>Proteína {{ protein.details?.id ?? protein.label }}</h2>
          <div v-if="!protein.details" class="unselected">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path d="M18 17 31 30m5-5 9-13M32 36 19 49" />
              <circle cx="15" cy="14" r="6" /><circle cx="47" cy="9" r="6" />
              <circle cx="34" cy="33" r="9" /><circle cx="16" cy="52" r="6" />
            </svg>
            <span>Sin seleccionar</span>
          </div>
          <GeneAnnotationSummary v-if="protein.details" :id="protein.details.id" />
          <dl>
            <div><dt>Vecinos</dt><dd>{{ protein.details?.degree ?? '--' }}</dd></div>
            <div><dt>Componente</dt><dd>{{ protein.details ? comparisonComponentNumber(protein.label as 'A' | 'B') : '--' }}</dd></div>
            <div><dt>Tamaño del grupo</dt><dd>{{ protein.details?.component_size ?? '--' }}</dd></div>
          </dl>
        </article>
      </aside>

      <section
        ref="subgraphPanel"
        class="glass-panel summary-panel"
        :class="{
          'subgraph-panel': displayMode === 'subgraph',
          'empty-summary-panel': displayMode === 'summary' && !comparisonResult,
        }"
      >
        <div class="panel-heading">
        <header class="dataset-info">
          <div class="dataset-selector" @keydown.esc="pickerOpen && closePicker()" @focusout="dismissPickerOnBlur">
            <button
              ref="pickerTrigger"
              class="dataset-trigger"
              type="button"
              :aria-expanded="pickerOpen"
              aria-controls="compare-dataset-picker"
              @click="pickerOpen = !pickerOpen"
            >
              Dataset {{ dataset.name }}
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
            </button>
            <Transition name="dataset-tray">
              <div v-show="pickerOpen" id="compare-dataset-picker" class="dataset-picker" role="group" aria-label="Datasets disponibles">
                <button
                  v-for="option in datasets"
                  :key="option.name"
                  type="button"
                  :aria-pressed="option.name === dataset.name"
                  @click="selectDataset(option)"
                >{{ option.name }}</button>
              </div>
            </Transition>
          </div>
          <div v-if="dataset.nodes !== undefined || dataset.edges !== undefined" class="dataset-counts">
            <span v-if="dataset.nodes !== undefined">{{ formatCount(dataset.nodes) }} proteínas</span>
            <span v-if="dataset.edges !== undefined">{{ formatCount(dataset.edges) }} asociaciones</span>
          </div>
        </header>
        <div v-if="displayMode === 'subgraph'" class="comparison-view-switch" aria-label="Tipo de visualización">
          <button type="button" :aria-pressed="comparisonGraphMode === 'comparison'" :disabled="generatingComparisonSubgraph" @click="changeComparisonGraphMode('comparison')">Vista comparativa</button>
          <button type="button" :aria-pressed="comparisonGraphMode === 'mst'" :disabled="generatingComparisonSubgraph" @click="changeComparisonGraphMode('mst')">Vista simplificada MST</button>
          <button type="button" :aria-pressed="comparisonGraphMode === 'expanded'" :disabled="generatingComparisonSubgraph" @click="changeComparisonGraphMode('expanded')">Red expandida</button>
        </div>
        </div>

        <template v-if="displayMode === 'summary'">
          <div v-if="!comparisonResult" class="empty-comparison">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path d="M18 17 31 30m5-5 9-13M32 36 19 49" />
              <circle cx="15" cy="14" r="6" /><circle cx="47" cy="9" r="6" />
              <circle cx="34" cy="33" r="9" /><circle cx="16" cy="52" r="6" />
            </svg>
            <h1>Compara dos proteínas</h1>
            <p>Ingresa dos identificadores para consultar su relación, vecinos y componentes conectados.</p>
          </div>
          <div v-else class="comparison-result">
            <div class="component-banner" :class="{ different: !comparisonResult.same_component }">
              <span class="component-icon material-symbols-outlined" aria-hidden="true">
                {{ comparisonResult.same_component ? 'check_circle' : 'cancel' }}
              </span>
              <div>
                <strong>{{ comparisonResult.same_component ? 'Mismo grupo conectado' : 'Grupos conectados diferentes' }}</strong>
                <small>
                  {{ comparisonResult.same_component
                    ? 'Existe un camino de asociaciones entre ambas proteínas.'
                    : 'No existe un camino de asociaciones entre ambas proteínas.' }}
                </small>
              </div>
            </div>
          </div>

          <div class="summary-metrics" aria-label="Resumen de comparación">
            <button class="metric-card shared-neighbors-card" type="button" :disabled="!comparisonResult" @click="openSharedNeighbors">
              <span>Vecinos compartidos</span>
              <strong>{{ comparisonResult?.shared_neighbors_count ?? '--' }}</strong>
              <small v-if="comparisonResult">Ver lista</small>
            </button>
            <div class="metric-card"><span>Diferencia de vecinos</span><strong>{{ comparisonResult?.degree_difference ?? '--' }}</strong></div>
            <div class="metric-card"><span>Asociación directa</span><strong>{{ comparisonResult ? (comparisonResult.directly_connected ? 'Sí' : 'No') : '--' }}</strong></div>
          </div>

          <section v-if="comparisonResult" class="comparison-detail" aria-label="Detalle de la comparación">
            <div class="venn-section" aria-label="Diagrama de vecinos compartidos">
              <div class="venn-diagram" :class="{ disjoint: comparisonResult.shared_neighbors_count === 0 }">
                <div class="venn-circle venn-a">
                  <strong>{{ exclusiveNeighborsA }}</strong>
                  <span>Solo A</span>
                </div>
                <div class="venn-circle venn-b">
                  <strong>{{ exclusiveNeighborsB }}</strong>
                  <span>Solo B</span>
                </div>
                <div v-if="comparisonResult.shared_neighbors_count > 0" class="venn-shared">
                  <strong>{{ comparisonResult.shared_neighbors_count }}</strong>
                  <span>comunes</span>
                </div>
              </div>
            </div>
            <article
              v-if="biologicalInterpretation"
              class="biological-interpretation"
              :class="{ 'no-shared-neighbors': comparisonResult.shared_neighbors_count === 0 }"
            >
              <p>Interpretación biológica</p>
              <h2>{{ biologicalInterpretation.title }}</h2>
              <span>{{ biologicalInterpretation.description }}</span>
              <ScientificComparisonInsight
                :protein-a="comparisonResult.protein_a.id"
                :protein-b="comparisonResult.protein_b.id"
                :degree-a="comparisonResult.protein_a.degree"
                :degree-b="comparisonResult.protein_b.degree"
                :shared-neighbors="comparisonResult.shared_neighbors_count"
                :same-component="comparisonResult.same_component"
              />
            </article>
          </section>

          <div v-if="comparisonResult" class="summary-bottom">
            <p class="direct-relation">
              {{ comparisonResult.directly_connected ? 'Las proteínas tienen una asociación directa.' : 'No existe una asociación directa entre ambas.' }}
            </p>
            <details class="technical-details">
              <summary>Detalles técnicos</summary>
              <div>
                <span>Algoritmo: UFDS</span>
                <span>Tiempo: {{ comparisonResult.elapsed_ms.toFixed(2) }} ms</span>
              </div>
            </details>
            <footer class="summary-footer">
              <button type="button" :disabled="generatingComparisonSubgraph" @click="requestComparisonSubgraph">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="m8 11 8-4m-8 6 8 4"/></svg>
                Visualizar ambas en un subgrafo
              </button>
            </footer>
          </div>
          <footer v-else class="summary-footer">
            <button type="button" disabled>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="m8 11 8-4m-8 6 8 4"/></svg>
              Visualizar ambas en un subgrafo
            </button>
          </footer>
        </template>

        <template v-else>
          <div v-if="comparisonGraphMode !== 'mst'" class="subgraph-heading">
            <div class="graph-toolbar" aria-label="Herramientas del subgrafo">
              <button type="button" aria-label="Acercar" :disabled="!comparisonGraphReady" @click="controlComparisonGraph('zoom-in')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7v7M7 10.5h7"/></svg>
              </button>
              <button type="button" aria-label="Alejar" :disabled="!comparisonGraphReady" @click="controlComparisonGraph('zoom-out')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M7 10.5h7"/></svg>
              </button>
              <button
                type="button"
                aria-label="Centrar grafo"
                title="Centrar grafo"
                :disabled="!comparisonGraphReady"
                @click="controlComparisonGraph('fit')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
              </button>
              <span class="toolbar-divider"></span>
              <button
                type="button"
                :aria-label="isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'"
                :title="isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'"
                :aria-pressed="isFullscreen"
                :disabled="!hasComparisonGraph"
                @click="requestFullscreen"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg>
              </button>
              <button
                type="button"
                aria-label="Descargar subgrafo"
                :title="downloadingComparisonSubgraph ? 'Preparando imagen PNG…' : 'Descargar subgrafo como PNG'"
                :disabled="!hasComparisonGraph || downloadingComparisonSubgraph"
                @click="requestComparisonDownload"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>
              </button>
            </div>
          </div>

          <div v-if="generatingComparisonSubgraph" class="empty-subgraph" role="status">
            <img src="/images/mascot.png" alt="Mascota de Prote-Prote" />
            <h2>Generando subgrafo conjunto…</h2>
            <p v-if="comparisonGraphMode === 'mst'">Prim está simplificando los vecindarios sin eliminar proteínas.</p>
            <p v-else>BFS multiorigen está explorando el entorno de ambas proteínas.</p>
          </div>
          <div v-else-if="comparisonSubgraphError" class="empty-subgraph" role="alert">
            <img src="/images/mascot.png" alt="Mascota de Prote-Prote" />
            <h2>No se pudo generar el subgrafo</h2>
            <p>{{ comparisonSubgraphError }}</p>
          </div>
          <div v-else-if="comparisonGraphMode === 'mst' && mstComparisonResult" class="mst-comparison-grid">
            <ProteinComparisonGraph
              :graph="mstComparisonResult.graph_a"
              :protein-id="mstComparisonResult.protein_a.id"
              side="A"
              @ready="markMstGraphReady"
            />
            <ProteinComparisonGraph
              :graph="mstComparisonResult.graph_b"
              :protein-id="mstComparisonResult.protein_b.id"
              side="B"
              @ready="markMstGraphReady"
            />
          </div>
          <div v-else-if="comparisonSubgraphHtml" class="comparison-graph-area">
            <iframe
              ref="comparisonGraphFrame"
              class="comparison-graph-frame"
              title="Subgrafo conjunto de las proteínas comparadas"
              :srcdoc="comparisonSubgraphHtml"
            ></iframe>
            <div v-if="!comparisonGraphReady" class="graph-loading-overlay" role="status">
              <span class="loading-spinner" aria-hidden="true"></span>
              Estabilizando el grafo…
            </div>
          </div>
          <div v-else class="empty-subgraph">
            <img src="/images/mascot.png" alt="Mascota de Prote-Prote" />
            <h2>Subgrafo sin datos</h2>
            <p>Compara dos proteínas para visualizar aquí sus conexiones.</p>
          </div>

          <aside v-if="selectedComparisonProtein" class="selected-node-details" aria-live="polite">
            <div>
              <strong>Proteína {{ selectedComparisonProtein.id }}</strong>
              <GeneAnnotationSummary :id="selectedComparisonProtein.id" compact />
              <span>Vecinos: {{ selectedComparisonProtein.degree }}</span>
              <span>Tamaño del grupo: {{ selectedComparisonProtein.component_size }}</span>
            </div>
            <button type="button" aria-label="Cerrar detalles y restaurar red" @click="clearSelectedComparisonProtein">×</button>
          </aside>

          <footer class="subgraph-footer">
            <div v-if="graphLegendReady" class="graph-legend" aria-label="Leyenda de colores del grafo">
              <strong>Leyenda</strong>
              <span><i class="legend-dot protein-a-color"></i>Proteína A</span>
              <span><i class="legend-dot protein-b-color"></i>Proteína B</span>
              <span>
                <i class="legend-dot shared-color"></i>
                Vecino compartido
              </span>
              <span><i class="legend-dot exclusive-color"></i>Vecino exclusivo</span>
              <span v-if="comparisonGraphMode !== 'mst'">
                <i class="legend-line network-edge"></i>Asociación con vecino
              </span>
              <span v-if="comparisonGraphMode === 'mst' || comparisonResult?.directly_connected">
                <i class="legend-line" :class="{ 'mst-edge': comparisonGraphMode === 'mst' }"></i>
                {{ comparisonGraphMode === 'mst' ? 'Asociación con vecino' : 'Asociación directa' }}
              </span>
            </div>
            <button type="button" @click="displayMode = 'summary'">Vista resumida</button>
          </footer>
        </template>
        <dialog ref="sharedNeighborsDialog" class="shared-neighbors-dialog" aria-labelledby="shared-neighbors-title">
          <header>
            <div>
              <h2 id="shared-neighbors-title">Vecinos compartidos</h2>
              <p>{{ comparisonResult?.shared_neighbors_count ?? 0 }} proteínas conectadas con A y B</p>
            </div>
            <form method="dialog"><button aria-label="Cerrar lista"><span class="material-symbols-outlined" aria-hidden="true">close</span></button></form>
          </header>
          <ul v-if="comparisonResult?.shared_neighbors.length">
            <li v-for="neighbor in comparisonResult.shared_neighbors" :key="neighbor">Proteína {{ neighbor }}</li>
          </ul>
          <p v-else class="empty-shared-list">No existen vecinos compartidos entre estas proteínas.</p>
        </dialog>
        <dialog ref="expandedWarning" class="expanded-warning" aria-labelledby="expanded-warning-title" aria-describedby="expanded-warning-message">
          <h2 id="expanded-warning-title">¿Ver la red expandida?</h2>
          <p id="expanded-warning-message">Estas proteínas tienen muchas relaciones. La red expandida puede tardar en cargar y ser más difícil de explorar. ¿Seguro que quieres continuar?</p>
          <form method="dialog" class="expanded-warning-actions">
            <button autofocus>Cancelar</button>
            <button type="button" @click="changeComparisonGraphMode('expanded', true)">Ver red expandida</button>
          </form>
        </dialog>
      </section>
    </div>
  </section>
</template>

<style scoped>
.compare { display: flex; flex: 1; min-height: 0; flex-direction: column; padding: clamp(4px, 0.8dvh, 10px) 4px 0; color: #12333f; }
.compare :is(button, input):focus-visible { outline: 2px solid #08485d; outline-offset: 3px; }
.compare > .back-button { margin-bottom: 2px; }
.compare-header { display: grid; gap: 6px; margin-bottom: clamp(6px, 1dvh, 10px); }
.dataset-info { display: flex; width: fit-content; max-width: 100%; flex-direction: column; align-items: flex-start; gap: 0; padding-bottom: 5px; font-size: 0.88rem; line-height: 1.15; }
.dataset-counts { display: flex; flex-wrap: wrap; gap: 1px 10px; color: #34535e; font-size: 0.78rem; }
.dataset-selector { position: relative; }
.dataset-trigger { display: inline-flex; align-items: center; gap: 4px; border: 0; padding: 2px 0; background: transparent; color: inherit; cursor: pointer; font: inherit; font-weight: 700; }
.dataset-trigger:hover { text-decoration: underline; text-underline-offset: 3px; }
.dataset-trigger svg { width: 13px; fill: none; stroke: currentColor; stroke-width: 1.75; }
.dataset-trigger[aria-expanded='true'] svg { transform: rotate(180deg); }
.dataset-picker { position: absolute; z-index: 3; top: calc(100% + 4px); left: 0; display: grid; min-width: 170px; gap: 4px; padding: 6px; border: 1px solid rgb(255 255 255 / 80%); border-radius: 12px; background: linear-gradient(#edfaff, #c8ebf1); box-shadow: 0 6px 16px rgb(12 76 103 / 24%); }
.dataset-picker button { border: 1px solid rgb(255 255 255 / 75%); border-radius: 10px; padding: 7px 14px; background: linear-gradient(#f2fdff, #c0e8ef); color: inherit; cursor: pointer; font: inherit; text-align: left; }
.dataset-picker button[aria-pressed='true'] { background: linear-gradient(#28758b, #134a61); color: white; }
.dataset-tray-enter-active, .dataset-tray-leave-active { transition: opacity 160ms ease, transform 160ms ease; }
.dataset-tray-enter-from, .dataset-tray-leave-to { opacity: 0; transform: translateY(-6px); }
.comparison-inputs { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(130px, 0.48fr); align-items: end; gap: clamp(8px, 1.5vw, 24px); padding: 0 8px; }
.comparison-inputs label { display: grid; gap: 3px; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; }
.comparison-inputs input { width: 100%; min-height: 34px; border: 1px solid #8aafbb; border-radius: 9px; padding: 5px 10px; background: #f5fcff; color: inherit; font: inherit; font-size: 0.92rem; }
.comparison-inputs input::placeholder { color: #6a858e; }
.comparison-error { margin: 0 10px; color: #792434; font-weight: 700; text-align: center; }
.compare-button, .summary-footer button, .subgraph-footer button { min-height: 36px; border: 1px solid rgb(255 255 255 / 35%); border-radius: 999px; background: linear-gradient(#22c0d3, #1550bd); box-shadow: inset 0 1px 0 rgb(255 255 255 / 45%), 0 4px 10px rgb(12 76 103 / 20%); color: white; cursor: pointer; font: inherit; font-size: 0.92rem; font-weight: 700; }
.compare-button { min-height: 44px; }
.compare-button:disabled, .summary-footer button:disabled { cursor: not-allowed; opacity: 0.78; }
.summary-footer button:hover, .subgraph-footer button:hover { filter: brightness(1.06); }
.compare-grid { display: grid; flex: 1; min-height: 0; grid-template-columns: minmax(230px, 0.66fr) minmax(0, 3fr); align-items: stretch; gap: clamp(8px, 1vw, 16px); }
.protein-column { display: grid; min-height: 0; grid-template-rows: 1fr 1fr; gap: clamp(8px, 1dvh, 12px); }
.protein-card { overflow-y: auto; overscroll-behavior: contain; padding: clamp(9px, 1vw, 14px); }
.protein-card h2 { margin: 0 0 3px; font-size: clamp(1.05rem, 1.3vw, 1.35rem); }
.unselected { display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 2px; color: #34535e; }
.unselected svg, .empty-comparison svg { width: 48px; fill: white; stroke: white; stroke-linecap: round; stroke-width: 4; }
.protein-card dl { margin: 0; }
.protein-card dl div { display: flex; justify-content: space-between; gap: 6px; padding: 4px 1px; border-bottom: 1px solid rgb(43 100 104 / 20%); font-size: 0.82rem; }
.protein-card dd { margin: 0; color: #34535e; }
.summary-panel { overflow-y: auto; overscroll-behavior: contain; container-type: inline-size; display: grid; width: 100%; height: 100%; min-height: 0; grid-template-rows: auto auto auto minmax(230px, 1fr) auto; align-self: stretch; align-content: stretch; padding: clamp(10px, 1.2vw, 18px); }
.empty-summary-panel { height: 100%; align-self: stretch; grid-template-rows: auto minmax(130px, 1fr) auto auto; }
.empty-comparison { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.empty-comparison svg { width: clamp(52px, 5vw, 74px); }
.empty-comparison h1 { margin: 6px 0; font-size: clamp(1.3rem, 1.8vw, 1.8rem); }
.empty-comparison p { max-width: 600px; margin: 0; font-size: clamp(0.85rem, 1vw, 1rem); line-height: 1.35; }
.comparison-result { display: flex; min-height: max-content; flex-direction: column; justify-content: center; padding: 3px 0 8px; }
.component-banner { display: flex; width: 100%; min-height: clamp(64px, 5.4vw, 82px); align-items: center; gap: clamp(9px, 1vw, 14px); padding: clamp(10px, 1vw, 15px) clamp(12px, 1.35vw, 20px); border: 1px solid #d9ffff; border-radius: 10px; background: #a9e4e1; color: #075f63; text-align: left; }
.component-banner.different { border-color: rgb(255 255 255 / 65%); background: rgb(255 214 187 / 58%); color: #7b3c25; }
.component-icon { display: grid; width: clamp(29px, 2.5vw, 36px); height: clamp(29px, 2.5vw, 36px); flex: none; place-items: center; color: currentColor; font-family: 'Material Symbols Outlined'; font-size: clamp(1.75rem, 2.4vw, 2.15rem); font-variation-settings: 'FILL' 0, 'wght' 450, 'GRAD' 0, 'opsz' 40; line-height: 1; }
.component-banner div { display: grid; gap: 2px; }
.component-banner strong { font-size: clamp(0.82rem, 0.92vw, 0.95rem); overflow-wrap: anywhere; }
.component-banner small { color: #294d57; font-size: clamp(0.68rem, 0.78vw, 0.8rem); overflow-wrap: anywhere; }
.summary-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: clamp(8px, 1.2vw, 18px); }
.summary-metrics .metric-card { display: grid; min-height: clamp(76px, 6.2vw, 94px); place-items: center; gap: 4px; padding: clamp(9px, 0.9vw, 13px) clamp(10px, 1vw, 15px); border: 1px solid rgb(255 255 255 / 72%); border-radius: 10px; background: rgb(232 248 250 / 62%); color: inherit; font: inherit; text-align: left; }
.summary-metrics button.metric-card { cursor: pointer; }
.summary-metrics button.metric-card:hover { border-color: #56aabb; background: rgb(240 253 255 / 78%); }
.summary-metrics button.metric-card:disabled { cursor: default; }
.shared-neighbors-card small { width: 100%; color: #176b83; font-size: 0.68rem; font-weight: 700; }
.summary-metrics span { width: 100%; color: #173f4c; font-size: clamp(0.72rem, 0.82vw, 0.84rem); font-weight: 700; overflow-wrap: anywhere; }
.summary-metrics strong { width: 100%; color: #092f3d; font-size: clamp(1.25rem, 1.55vw, 1.6rem); font-weight: 800; }
.summary-metrics strong { font-size: 1.05rem; }
.empty-summary-panel .summary-metrics { width: min(100%, 940px); justify-self: center; gap: clamp(8px, 1.3vw, 20px); }
.empty-summary-panel .summary-metrics .metric-card { min-height: 62px; padding: 7px 10px; font-size: 0.82rem; }
.empty-summary-panel .summary-metrics strong { font-size: 1rem; }
.empty-summary-panel .summary-footer { margin-top: clamp(12px, 2dvh, 20px); }
.empty-summary-panel .summary-footer button { min-width: min(100%, 300px); padding: 6px 18px; }
.comparison-detail { display: grid; min-height: 230px; grid-template-columns: minmax(340px, 0.82fr) minmax(360px, 1.18fr); align-items: center; gap: clamp(18px, 2.5vw, 42px); padding: 8px 0 12px; }
.venn-section { display: flex; min-width: 0; flex-direction: column; }
.venn-title { margin: 8px 0 0; color: #092f3d; font-size: 0.84rem; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; }
.venn-diagram { --venn-circle-size: clamp(132px, 11vw, 190px); position: relative; width: clamp(240px, 20vw, 340px); height: clamp(150px, 13vw, 205px); margin: 0 auto; }
.venn-circle { position: absolute; top: 6px; display: flex; width: var(--venn-circle-size); height: var(--venn-circle-size); flex-direction: column; align-items: center; justify-content: center; border: 3px solid; border-radius: 50%; color: #092f3d; }
.venn-circle strong { font-size: clamp(1.35rem, 1.6vw, 1.7rem); font-weight: 800; }
.venn-circle span, .venn-shared span { color: #173f4c; font-size: clamp(0.72rem, 0.78vw, 0.82rem); font-weight: 700; }
.venn-a { left: 0; padding-right: clamp(24px, 2.6vw, 44px); border-color: #f17800; background: rgb(255 148 31 / 48%); }
.venn-b { right: 0; padding-left: clamp(24px, 2.6vw, 44px); border-color: #008f95; background: rgb(32 201 195 / 48%); }
.venn-shared { position: absolute; z-index: 2; top: 50%; left: 50%; display: flex; width: clamp(58px, 4.7vw, 76px); aspect-ratio: 1; flex-direction: column; align-items: center; justify-content: center; border: 2px solid rgb(91 73 173 / 82%); border-radius: 50%; background: rgb(122 104 207 / 88%); color: #fff; transform: translate(-50%, -50%); }
.venn-shared strong { font-size: clamp(1.1rem, 1.25vw, 1.35rem); font-weight: 800; }
.venn-shared span { color: #fff; }
.venn-diagram.disjoint { width: min(100%, 410px); }
.venn-diagram.disjoint .venn-circle { width: min(var(--venn-circle-size), 44%); height: auto; aspect-ratio: 1; }
.venn-diagram.disjoint .venn-a { left: 0; padding-right: 0; }
.venn-diagram.disjoint .venn-b { right: 0; padding-left: 0; }
.biological-interpretation { display: flex; min-width: 0; min-height: 160px; flex-direction: column; justify-content: flex-start; margin-top: 0; border-left: 4px solid #176b83; padding: 0 0 10px 22px; }
.biological-interpretation p { margin: 0 0 10px; color: #176b83; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.025em; text-transform: uppercase; }
.biological-interpretation h2 { margin: 0 0 9px; color: #092f3d; font-size: clamp(1.25rem, 1.55vw, 1.55rem); font-weight: 800; }
.biological-interpretation.no-shared-neighbors h2 { font-size: clamp(1.05rem, 1.25vw, 1.25rem); }
.biological-interpretation span { max-width: 760px; color: #173f4c; font-size: 0.96rem; font-weight: 500; line-height: 1.5; }
.summary-bottom { display: flex; align-self: end; align-items: center; justify-content: space-between; gap: 16px; width: 100%; margin-top: 6px; border-top: 1px solid rgb(255 255 255 / 42%); padding-top: 10px; }
.direct-relation { flex: 1; margin: 0; color: #34535e; font-size: 0.85rem; }
.technical-details { position: relative; flex: none; color: #164c5c; font-size: 0.76rem; }
.technical-details summary { cursor: pointer; font-weight: 800; }
.technical-details > div { position: absolute; z-index: 4; right: 0; bottom: calc(100% + 6px); display: grid; min-width: 170px; gap: 4px; padding: 9px 12px; border: 1px solid #8aafbb; border-radius: 10px; background: #e7f8fb; box-shadow: 0 5px 14px rgb(12 76 103 / 20%); }
.summary-footer { display: flex; align-items: end; justify-content: flex-end; gap: 16px; margin-top: clamp(10px, 2dvh, 22px); }
.summary-bottom .summary-footer { flex: none; margin-top: 0; }
.summary-footer button { display: inline-flex; min-width: min(100%, 340px); align-items: center; justify-content: center; gap: 9px; padding: 8px 22px; }
.summary-footer button svg { width: 19px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.subgraph-panel { position: relative; display: flex; flex-direction: column; overflow: hidden; }
.panel-heading { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 8px 16px; }
.subgraph-panel .panel-heading { flex: none; margin-bottom: 6px; }
.subgraph-heading { display: flex; flex: none; justify-content: flex-end; padding-bottom: 5px; }
.comparison-view-switch { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; margin-left: auto; }
.subgraph-panel > :is(.mst-comparison-grid, .comparison-graph-area, .empty-subgraph) { flex: 1; }
.subgraph-panel > :is(.selected-node-details, .subgraph-footer) { flex: none; }
.comparison-view-switch button { border: 1px solid #8aafbb; border-radius: 999px; padding: 5px 10px; background: rgb(237 250 255 / 60%); color: #164c5c; cursor: pointer; font: inherit; font-size: 0.78rem; }
.comparison-view-switch button[aria-pressed='true'] { background: linear-gradient(#28758b, #134a61); color: white; }
.comparison-view-switch button:disabled { cursor: wait; opacity: 0.65; }
.expanded-warning { width: min(440px, calc(100% - 32px)); padding: 20px; border: 1px solid #8aafbb; border-radius: 16px; background: #e4f7fb; color: #12333f; }
.expanded-warning::backdrop { background: rgb(18 51 63 / 55%); }
.expanded-warning h2 { margin: 0 0 8px; font-size: 1.25rem; }
.expanded-warning p { margin: 0 0 16px; }
.expanded-warning-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.expanded-warning-actions button { border: 1px solid #8aafbb; border-radius: 999px; padding: 8px 16px; background: #f5fcff; color: #164c5c; cursor: pointer; font: inherit; }
.expanded-warning-actions button:last-child { background: linear-gradient(#28758b, #134a61); color: white; }
.shared-neighbors-dialog { width: min(470px, calc(100% - 32px)); max-height: min(620px, calc(100dvh - 40px)); padding: 0; border: 1px solid #16566d; border-radius: 7px; overflow: hidden; background: #fff; color: #12333f; box-shadow: 0 18px 52px rgb(5 47 63 / 38%); }
.shared-neighbors-dialog::backdrop { background: rgb(18 51 63 / 55%); backdrop-filter: blur(2px); }
.shared-neighbors-dialog header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 11px 13px; border-bottom: 0; background: #16566d; color: #fff; }
.shared-neighbors-dialog h2 { margin: 0; font-size: 1.05rem; }
.shared-neighbors-dialog header p { margin: 3px 0 0; color: #d9f3f7; font-size: 0.78rem; }
.shared-neighbors-dialog header button { display: grid; width: 27px; height: 27px; place-items: center; border: 0; border-radius: 3px; padding: 0; background: transparent; color: #fff; cursor: pointer; }
.shared-neighbors-dialog header button:hover { background: rgb(255 255 255 / 18%); }
.shared-neighbors-dialog header button .material-symbols-outlined { font-family: 'Material Symbols Outlined'; font-size: 19px; font-variation-settings: 'FILL' 0, 'wght' 550, 'GRAD' 0, 'opsz' 24; }
.shared-neighbors-dialog ul { display: grid; max-height: 430px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 7px; margin: 0; padding: 14px 20px 20px; overflow-y: auto; list-style: none; }
.shared-neighbors-dialog li { border: 1px solid rgb(138 175 187 / 70%); border-radius: 3px; padding: 7px 10px; background: #fff; font-size: 0.82rem; }
.empty-shared-list { margin: 0; padding: 22px 20px; color: #34535e; }
.graph-toolbar { display: flex; align-items: center; gap: 3px; padding: 3px 6px; border: 1px solid rgb(205 240 246 / 55%); border-radius: 12px; background: linear-gradient(rgb(203 237 243 / 82%), rgb(161 219 232 / 72%)); box-shadow: 0 3px 8px rgb(12 76 103 / 15%); }
.graph-toolbar button { display: grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 7px; padding: 0; background: transparent; color: #154858; }
.graph-toolbar button:not(:disabled):hover { background: rgb(213 238 240 / 75%); cursor: pointer; }
.graph-toolbar button:disabled { cursor: not-allowed; opacity: 0.5; }
.graph-toolbar button:focus-visible { outline: 2px solid #08485d; outline-offset: 2px; }
.graph-toolbar svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.8; }
.toolbar-divider { width: 1px; height: 20px; margin: 0 2px; background: #8aafbb; }
.empty-subgraph { display: flex; min-height: 0; flex-direction: column; align-items: center; justify-content: center; padding: 12px; text-align: center; }
.empty-subgraph img { width: clamp(80px, min(11vw, 18dvh), 145px); height: auto; margin-bottom: 12px; }
.empty-subgraph h2 { margin: 0; font-size: clamp(1.25rem, 2vw, 2rem); }
.empty-subgraph p { margin: 8px 0 0; color: #34535e; font-size: clamp(0.95rem, 1.2vw, 1.15rem); }
.comparison-graph-frame { display: block; width: 100%; height: 100%; min-height: 0; border: 0; background: transparent; }
.comparison-graph-area { position: relative; min-width: 0; min-height: 0; }
.mst-comparison-grid { display: grid; min-width: 0; min-height: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.graph-loading-overlay { position: absolute; z-index: 2; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; background: rgb(181 229 237 / 82%); color: #164c5c; font-weight: 700; }
.loading-spinner { width: 24px; height: 24px; border: 3px solid rgb(22 76 92 / 20%); border-top-color: #16566d; border-radius: 50%; animation: comparison-spin 700ms linear infinite; }
@keyframes comparison-spin { to { transform: rotate(360deg); } }
.graph-legend { display: flex; flex: 1; min-width: 0; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 7px 16px; padding: 8px 4px 3px; border-top: 2px solid rgb(9 47 61 / 32%); color: #042936; font-size: 0.72rem; font-weight: 900; }
.graph-legend strong { margin-right: 0; padding-right: 16px; border-right: 2px solid rgb(6 43 57 / 58%); color: #031f2a; font-weight: 950; }
.graph-legend span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.legend-dot { display: inline-block; width: 13px; height: 13px; border: 1px solid rgb(255 255 255 / 90%); border-radius: 50%; box-shadow: 0 0 0 1px rgb(9 47 61 / 25%); }
.protein-a-color { background: #ff941f; }
.protein-b-color { background: #20c9c3; }
.shared-color { background: #7a68cf; }
.exclusive-color { background: #83cfee; }
.legend-line { display: inline-block; width: 22px; height: 4px; border-radius: 999px; background: #ff941f; }
.legend-line.network-edge { height: 3px; background: #176978; }
.legend-line.mst-edge { background: #176978; }
.selected-node-details { display: flex; align-items: center; justify-content: space-between; gap: 9px; margin-top: 5px; padding: 5px 9px; border: 1px solid rgb(255 255 255 / 45%); border-radius: 10px; background: rgb(237 250 255 / 35%); color: #164c5c; }
.selected-node-details > div { display: flex; min-width: 0; flex-wrap: wrap; gap: 3px 12px; align-items: center; }
.selected-node-details strong { color: #062b39; font-size: 0.76rem; font-weight: 900; }
.selected-node-details span { font-size: 0.76rem; }
.selected-node-details button { width: 22px; height: 22px; flex: none; border: 0; border-radius: 50%; background: rgb(22 86 109 / 14%); color: #164c5c; cursor: pointer; font-size: 1rem; line-height: 1; }
.summary-panel:fullscreen { width: 100vw; height: 100vh; border-radius: 0; background: linear-gradient(155deg, #c6edf3, #9fd9e4); }
.summary-panel:fullscreen .graph-toolbar { gap: 4px; padding: 4px 8px; border-radius: 14px; }
.summary-panel:fullscreen .graph-toolbar button { width: 36px; height: 36px; border-radius: 8px; }
.summary-panel:fullscreen .graph-toolbar svg { width: 22px; height: 22px; }
.summary-panel:fullscreen .toolbar-divider { height: 24px; margin-inline: 3px; }
.summary-panel:fullscreen .selected-node-details { align-items: flex-start; gap: 14px; margin-top: 9px; padding: 12px 15px; border-radius: 12px; }
.summary-panel:fullscreen .selected-node-details > div { gap: 7px 20px; }
.summary-panel:fullscreen .selected-node-details span,
.summary-panel:fullscreen .selected-node-details strong,
.summary-panel:fullscreen .selected-node-details :deep(.gene-symbol),
.summary-panel:fullscreen .selected-node-details :deep(.gene-name),
.summary-panel:fullscreen .selected-node-details :deep(.gene-status) { font-size: 1rem; line-height: 1.3; }
.summary-panel:fullscreen .selected-node-details span { font-weight: 650; }
.summary-panel:fullscreen .selected-node-details strong { font-weight: 950; }
.summary-panel:fullscreen .selected-node-details button { width: 26px; height: 26px; font-size: 1.2rem; }
.summary-panel:fullscreen .graph-legend { gap: 9px 20px; padding: 11px 6px 5px; font-size: 0.92rem; }
.summary-panel:fullscreen .graph-legend strong { padding-right: 20px; border-right-width: 3px; }
.summary-panel:fullscreen .legend-dot { width: 15px; height: 15px; }
.summary-panel:fullscreen .legend-line { width: 28px; height: 4px; }
.subgraph-footer { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: clamp(7px, 1dvh, 11px); }
.subgraph-footer button { flex: none; min-width: min(100%, 180px); padding: 8px 22px; }

@container (max-width: 760px) {
  .summary-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .summary-metrics > div:last-child { grid-column: 1 / -1; }
  .comparison-detail { min-height: 0; grid-template-columns: 1fr; }
  .biological-interpretation { margin-top: 0; }
}

@container (max-width: 470px) {
  .component-banner { align-items: flex-start; }
  .summary-metrics { grid-template-columns: 1fr; }
  .summary-metrics > div:last-child { grid-column: auto; }
}

@media (max-width: 900px) {
  .comparison-inputs { grid-template-columns: 1fr 1fr; }
  .compare-button { grid-column: 1 / -1; }
  .compare-grid { flex: 1; min-height: 0; grid-template-columns: 1fr; overflow-y: auto; overscroll-behavior: contain; }
  .protein-column { grid-template-columns: 1fr 1fr; grid-template-rows: none; }
  .summary-panel { height: auto; }
  .subgraph-panel { min-height: 500px; }
  .subgraph-heading { align-items: stretch; flex-direction: column; }
  .graph-toolbar { align-self: flex-end; }
  .graph-legend { gap: 6px 10px; font-size: 0.72rem; }
  .mst-comparison-grid { min-height: 520px; grid-template-columns: 1fr; grid-template-rows: repeat(2, minmax(250px, 1fr)); }
}

@media (min-width: 901px) and (max-width: 1100px) {
  .compare-grid { grid-template-columns: minmax(205px, 0.58fr) minmax(0, 2.6fr); }
  .comparison-detail { min-height: 180px; grid-template-columns: minmax(240px, 0.8fr) minmax(270px, 1.2fr); gap: 12px; }
  .biological-interpretation { margin-top: 0; padding-left: 14px; }
}

@media (max-height: 760px) and (min-width: 901px) {
  .compare { padding-top: 2px; }
  .compare-header { gap: 3px; margin-bottom: 4px; }
  .comparison-inputs input, .compare-button { min-height: 42px; }
  .compare-grid { flex: 1; min-height: 0; }
  .protein-column { min-height: 0; }
  .protein-card { padding-block: 8px; }
  .protein-card dl div { padding-block: 2px; }
  .summary-panel { height: 100%; min-height: 0; grid-template-rows: auto auto auto minmax(155px, 1fr) auto; padding-block: 9px; }
  .empty-summary-panel { grid-template-rows: auto minmax(130px, 1fr) auto auto; }
  .component-banner { min-height: 56px; padding-block: 8px; }
  .summary-metrics .metric-card { min-height: 64px; padding-block: 7px; }
  .subgraph-panel { min-height: 0; }
  .comparison-detail { min-height: 0; padding-block: 3px 5px; }
  .venn-title { margin-top: 4px; }
  .venn-diagram { --venn-circle-size: clamp(116px, 10vw, 155px); width: clamp(220px, 19vw, 290px); height: clamp(128px, 11vw, 165px); }
  .biological-interpretation { min-height: 132px; }
  .biological-interpretation { margin-top: 0; }
  .summary-bottom { margin-top: 2px; padding-top: 6px; }
  .summary-footer button { min-height: 32px; padding-block: 5px; }
}

/* Keep the panels readable in short windows; scroll within the comparison area. */
@media (max-width: 1200px) and (max-height: 650px) {
  .compare { flex: 1; min-height: 0; }
  .compare-grid { flex: 1; min-height: 0; align-items: start; overflow-y: auto; overscroll-behavior: contain; }
  .protein-column { min-height: 0; grid-template-rows: auto auto; }
  .protein-card { min-height: 210px; }
  .summary-panel {
    height: auto;
    min-height: 590px;
    grid-template-rows: auto auto auto auto auto;
  }
  .empty-summary-panel { grid-template-rows: auto minmax(230px, 1fr) auto auto; }
  .comparison-detail { min-height: 190px; }
}

@media (max-width: 520px) {
  .comparison-inputs, .protein-column, .summary-metrics { grid-template-columns: 1fr; }
  .comparison-detail { grid-template-columns: 1fr; }
  .venn-title { text-align: center; }
  .biological-interpretation { margin-top: 0; }
  .summary-bottom { align-items: stretch; flex-direction: column; }
  .summary-bottom .summary-footer button { width: 100%; }
  .summary-footer { align-items: stretch; flex-direction: column; }
  .summary-footer button { min-width: 0; width: 100%; }
  .subgraph-footer { align-items: stretch; flex-direction: column; }
  .subgraph-footer button { width: 100%; }
  .comparison-view-switch { flex-wrap: wrap; }
  .graph-toolbar { align-self: center; }
  .selected-node-details > div { display: grid; grid-template-columns: 1fr 1fr; }
}
</style>
