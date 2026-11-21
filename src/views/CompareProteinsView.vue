<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BackToMenu from '../components/BackToMenu.vue'
import ProteinSelector from '../components/ProteinSelector.vue'
import ProteinComparisonGraph from '../components/ProteinComparisonGraph.vue'
import { formatCount, type Dataset } from '../datasets'
import { useProteinComparison } from '../composables/useProteinComparison'

defineProps<{ datasets: readonly Dataset[] }>()
const dataset = defineModel<Dataset>({ required: true })
const emit = defineEmits<{ back: [] }>()
const proteinA = ref('')
const proteinB = ref('')
const pickerOpen = ref(false)
const pickerTrigger = ref<HTMLButtonElement | null>(null)
const displayMode = ref<'summary' | 'subgraph'>('summary')
const { proteins, result, loadingProteins, comparing, error, compare, loadProteins } = useProteinComparison(dataset)
const cards = computed(() => [
  { label: 'A', data: result.value?.protein_a },
  { label: 'B', data: result.value?.protein_b },
])

watch(() => dataset.value.name, () => {
  proteinA.value = ''
  proteinB.value = ''
  displayMode.value = 'summary'
})

async function requestComparison() {
  if (await compare(proteinA.value, proteinB.value)) displayMode.value = 'subgraph'
}

function closePicker() {
  pickerOpen.value = false
  pickerTrigger.value?.focus()
}

function selectDataset(option: Dataset) {
  dataset.value = option
  closePicker()
}

function dismissPickerOnBlur(event: FocusEvent) {
  const selector = event.currentTarget as HTMLElement
  if (!selector.contains(event.relatedTarget as Node | null)) pickerOpen.value = false
}
</script>

<template>
  <section class="compare" :aria-label="`Comparar proteínas del dataset ${dataset.name}`">
    <BackToMenu @back="emit('back')" />

    <header class="compare-header">
      <form class="comparison-inputs" @submit.prevent="requestComparison">
        <ProteinSelector id="compare-protein-a" v-model="proteinA" label="Proteína A" :proteins="proteins" :disabled="loadingProteins || comparing" placeholder="Ejemplo: 7157" />
        <ProteinSelector id="compare-protein-b" v-model="proteinB" label="Proteína B" :proteins="proteins" :disabled="loadingProteins || comparing" placeholder="Ejemplo: 4609" />
        <button class="compare-button" type="submit" :disabled="loadingProteins || comparing || !proteins.length || !proteinA.trim() || !proteinB.trim()">{{ comparing ? 'Comparando…' : 'Comparar' }}</button>
      </form>
      <p v-if="loadingProteins" role="status">Cargando proteínas del dataset…</p>
      <p v-if="error" role="alert">{{ error }} <button v-if="!proteins.length && !loadingProteins" type="button" class="retry-button" @click="loadProteins">Reintentar</button></p>
    </header>

    <div class="compare-grid">
      <aside class="protein-column">
        <article v-for="protein in cards" :key="protein.label" class="glass-panel protein-card" :class="{ 'protein-card-selected': protein.data }">
          <span v-if="protein.data" class="protein-id">Proteína {{ protein.label }} · ID: {{ protein.data.id }}</span>
          <h2>Proteína {{ protein.data?.id ?? protein.label }}</h2>
          <div v-if="!protein.data" class="unselected">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path d="M18 17 31 30m5-5 9-13M32 36 19 49" />
              <circle cx="15" cy="14" r="6" /><circle cx="47" cy="9" r="6" />
              <circle cx="34" cy="33" r="9" /><circle cx="16" cy="52" r="6" />
            </svg>
            <span>Sin seleccionar</span>
          </div>
          <dl>
            <div><dt>Grado</dt><dd>{{ protein.data ? formatCount(protein.data.degree) : '--' }}</dd></div>
            <div><dt>Vecinos</dt><dd>{{ protein.data ? formatCount(protein.data.neighbor_count) : '--' }}</dd></div>
            <div><dt>Componente</dt><dd>{{ protein.data ? `#${protein.data.component}` : '--' }}</dd></div>
            <div><dt>Tamaño del componente</dt><dd>{{ protein.data ? formatCount(protein.data.component_size) : '--' }}</dd></div>
          </dl>
        </article>
      </aside>

      <section class="glass-panel summary-panel" :class="{ 'subgraph-panel': displayMode === 'subgraph' }">
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

        <div v-show="displayMode === 'summary'" class="comparison-summary">
          <div v-if="result" class="comparison-result">
            <h1>{{ result.protein_a.id }} y {{ result.protein_b.id }}</h1>
            <p>{{ result.directly_connected ? 'Tienen una asociación directa.' : 'No tienen una asociación directa.' }}</p>
            <p>{{ result.same_component ? 'Pertenecen al mismo componente conectado.' : 'Pertenecen a componentes distintos: no existe un camino entre ellas.' }}</p>
            <details v-if="result.shared_neighbors.length">
              <summary>Ver {{ formatCount(result.shared_neighbors.length) }} vecinos compartidos</summary>
              <p class="shared-list">{{ result.shared_neighbors.join(', ') }}</p>
            </details>
          </div>
          <div v-else class="empty-comparison">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path d="M18 17 31 30m5-5 9-13M32 36 19 49" />
              <circle cx="15" cy="14" r="6" /><circle cx="47" cy="9" r="6" />
              <circle cx="34" cy="33" r="9" /><circle cx="16" cy="52" r="6" />
            </svg>
            <h1>Compara dos proteínas</h1>
            <p>Ingresa dos identificadores para consultar su relación, vecinos y componentes conectados.</p>
          </div>

          <div class="summary-metrics" aria-label="Resumen de comparación">
            <div><span>Vecinos compartidos</span><strong>{{ result ? formatCount(result.shared_neighbors.length) : '--' }}</strong></div>
            <div><span>Diferencia de grado</span><strong>{{ result ? formatCount(result.degree_difference) : '--' }}</strong></div>
            <div><span>Componente</span><strong>{{ result ? result.same_component ? 'Mismo componente' : 'Distintos componentes' : '--' }}</strong></div>
          </div>

          <footer class="summary-footer">
            <button type="button" :disabled="!result || comparing" @click="displayMode = 'subgraph'">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="m8 11 8-4m-8 6 8 4"/></svg>
              Visualizar ambas en un subgrafo
            </button>
          </footer>
        </div>

          <div v-if="result" v-show="displayMode === 'subgraph'" class="comparison-graphs">
            <ProteinComparisonGraph :graph="result.graph_a" :protein-id="result.protein_a.id" side="A" />
            <ProteinComparisonGraph :graph="result.graph_b" :protein-id="result.protein_b.id" side="B" />
          </div>

          <footer v-show="displayMode === 'subgraph'" class="subgraph-footer">
            <button type="button" @click="displayMode = 'summary'">Vista resumida</button>
          </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.compare { display: flex; flex: 1; min-height: 0; flex-direction: column; padding: clamp(8px, 1.5dvh, 16px) 4px 0; color: #12333f; }
.compare :is(button, input):focus-visible { outline: 2px solid #08485d; outline-offset: 3px; }
.compare > .back-button { margin-bottom: 2px; }
.compare-header { display: grid; gap: clamp(8px, 1.4dvh, 14px); margin-bottom: clamp(10px, 1.5dvh, 18px); }
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
.comparison-inputs { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(140px, 0.52fr); align-items: end; gap: clamp(10px, 2vw, 38px); padding: 0 10px; }
.comparison-inputs label { display: grid; gap: 5px; font-size: 0.9rem; font-weight: 700; text-transform: uppercase; }
.comparison-inputs input { width: 100%; min-height: 42px; border: 1px solid #8aafbb; border-radius: 10px; padding: 8px 12px; background: #f5fcff; color: inherit; font: inherit; font-size: 1rem; }
.comparison-inputs input::placeholder { color: #6a858e; }
.compare-button, .summary-footer button, .subgraph-footer button { min-height: 42px; border: 1px solid rgb(255 255 255 / 35%); border-radius: 999px; background: linear-gradient(#22c0d3, #1550bd); box-shadow: inset 0 1px 0 rgb(255 255 255 / 45%), 0 4px 10px rgb(12 76 103 / 20%); color: white; cursor: pointer; font: inherit; font-size: 1rem; font-weight: 700; }
.compare-button:disabled, .summary-footer button:disabled { cursor: not-allowed; opacity: 0.78; }
.summary-footer button:hover, .subgraph-footer button:hover { filter: brightness(1.06); }
.compare-grid { display: grid; flex: 1; min-height: 0; grid-template-columns: minmax(220px, 0.7fr) minmax(0, 2.3fr); gap: clamp(10px, 1.6vw, 24px); }
.protein-column { display: grid; min-height: 0; grid-template-rows: 1fr 1fr; gap: clamp(10px, 1.5dvh, 18px); }
.protein-card { padding: clamp(12px, 1.5vw, 22px); }
.protein-card h2 { margin: 0 0 6px; font-size: clamp(1.2rem, 1.6vw, 1.7rem); }
.unselected { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px; color: #34535e; }
.unselected svg, .empty-comparison svg { width: 48px; fill: white; stroke: white; stroke-linecap: round; stroke-width: 4; }
.protein-card dl { margin: 0; }
.protein-card dl div { display: flex; justify-content: space-between; gap: 8px; padding: 6px 2px; border-bottom: 1px solid rgb(43 100 104 / 20%); font-size: 0.95rem; }
.protein-card dd { margin: 0; color: #34535e; }
.protein-card h2, .protein-card dd { overflow-wrap: anywhere; }
.protein-card dd { text-align: right; }
.protein-card-selected { display: flex; flex-direction: column; justify-content: center; gap: 12px; }
.protein-id { align-self: flex-start; max-width: 100%; overflow-wrap: anywhere; padding: 4px 10px; border: 1px solid #d2f3f5; border-radius: 9px; background: #16566d66; color: white; font-size: 0.75rem; }
.comparison-result { display: flex; min-width: 0; flex-direction: column; justify-content: center; padding: 20px 0; }
.comparison-result h1 { margin: 0 0 12px; font-size: clamp(1.4rem, 2.4vw, 2.5rem); overflow-wrap: anywhere; }
.comparison-result p { margin: 5px 0; }
.comparison-result details { margin-top: 15px; }
.comparison-result summary { cursor: pointer; }
.shared-list { max-height: 140px; overflow-y: auto; overflow-wrap: anywhere; line-height: 1.5; }
.retry-button { border: 1px solid #8aafbb; border-radius: 7px; padding: 4px 10px; background: #e4f7fb; color: inherit; cursor: pointer; font: inherit; }
.summary-panel { display: flex; flex-direction: column; min-height: 0; padding: clamp(16px, 2vw, 28px); }
.comparison-summary { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.comparison-summary > :is(.empty-comparison, .comparison-result) { flex: 1; min-height: 150px; }
.empty-comparison { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.empty-comparison svg { width: clamp(62px, 7vw, 96px); }
.empty-comparison h1 { margin: 8px 0; font-size: clamp(1.5rem, 2.4vw, 2.5rem); }
.empty-comparison p { max-width: 700px; margin: 0; font-size: clamp(0.95rem, 1.3vw, 1.25rem); line-height: 1.4; }
.summary-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(8px, 2vw, 32px); }
.summary-metrics div { display: grid; min-height: 82px; place-items: center; gap: 4px; padding: 10px; border: 1px solid rgb(255 255 255 / 45%); border-radius: 10px; background: rgb(236 247 248 / 32%); text-align: center; }
.summary-metrics strong { font-size: 1.2rem; }
.summary-footer { display: flex; align-items: end; justify-content: flex-end; gap: 16px; margin-top: clamp(10px, 2dvh, 22px); }
.summary-footer button { display: inline-flex; min-width: min(100%, 340px); align-items: center; justify-content: center; gap: 9px; padding: 8px 22px; }
.summary-footer button svg { width: 19px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.summary-panel.subgraph-panel { min-height: 480px; }
.comparison-graphs { display: grid; flex: 1; min-width: 0; min-height: 380px; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(380px, 1fr); gap: 12px; }
@media (max-width: 1000px) {
  .comparison-graphs { grid-template-columns: 1fr; }
  .summary-panel.subgraph-panel { min-height: 880px; }
  .comparison-graphs { min-height: 772px; }
}
.subgraph-footer { display: flex; align-items: end; justify-content: flex-end; gap: 16px; margin-top: 10px; }
.subgraph-footer button { min-width: min(100%, 240px); padding: 8px 22px; }

@media (max-width: 760px) {
  .comparison-inputs { grid-template-columns: 1fr 1fr; }
  .compare-button { grid-column: 1 / -1; }
  .compare-grid { grid-template-columns: 1fr; overflow: visible; }
  .protein-column { grid-template-columns: 1fr 1fr; grid-template-rows: none; }
  .summary-panel { min-height: 430px; }
}

@media (max-width: 520px) {
  .comparison-inputs, .protein-column, .summary-metrics { grid-template-columns: 1fr; }
  .summary-footer { align-items: stretch; flex-direction: column; }
  .summary-footer button { min-width: 0; width: 100%; }
  .subgraph-footer { align-items: stretch; flex-direction: column; }
  .subgraph-footer button { width: 100%; }
}
</style>
