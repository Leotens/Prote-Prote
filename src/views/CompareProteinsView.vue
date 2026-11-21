<script setup lang="ts">
import { computed, ref } from 'vue'
import BackToMenu from '../components/BackToMenu.vue'
import { useProteinComparison } from '../composables/useProteinComparison'
import { formatCount, type Dataset } from '../datasets'

defineProps<{ datasets: readonly Dataset[] }>()
const dataset = defineModel<Dataset>({ required: true })
const emit = defineEmits<{ back: [] }>()
const proteinA = ref('')
const proteinB = ref('')
const pickerOpen = ref(false)
const pickerTrigger = ref<HTMLButtonElement | null>(null)
const displayMode = ref<'summary' | 'subgraph'>('summary')
const { comparisonResult, comparisonError, comparing, compare, clearComparison } = useProteinComparison()
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

function componentNumber(label: string) {
  if (!comparisonResult.value) return '--'
  return comparisonResult.value.same_component || label === 'A' ? 1 : 2
}

function closePicker() {
  pickerOpen.value = false
  pickerTrigger.value?.focus()
}

function selectDataset(option: Dataset) {
  clearComparison()
  displayMode.value = 'summary'
  dataset.value = option
  closePicker()
}

function requestComparison() {
  displayMode.value = 'summary'
  void compare(dataset.value, proteinA.value, proteinB.value)
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
      <div class="comparison-inputs">
        <label>
          <span>Proteína A</span>
          <input v-model.trim="proteinA" type="text" placeholder="Ejemplo: 7157" @keydown.enter="requestComparison" />
        </label>
        <label>
          <span>Proteína B</span>
          <input v-model.trim="proteinB" type="text" placeholder="Ejemplo: 4609" @keydown.enter="requestComparison" />
        </label>
        <button
          class="compare-button"
          type="button"
          :disabled="comparing || !proteinA.trim() || !proteinB.trim()"
          @click="requestComparison"
        >{{ comparing ? 'Comparando…' : 'Comparar' }}</button>
      </div>
      <p v-if="comparisonError" class="comparison-error" role="alert">{{ comparisonError }}</p>
    </header>

    <div class="compare-grid">
      <aside class="protein-column">
        <article v-for="protein in proteinCards" :key="protein.label" class="glass-panel protein-card">
          <span v-if="protein.details" class="protein-id">ID: {{ protein.details.id }}</span>
          <h2>Proteína {{ protein.details?.id ?? protein.label }}</h2>
          <div v-if="!protein.details" class="unselected">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path d="M18 17 31 30m5-5 9-13M32 36 19 49" />
              <circle cx="15" cy="14" r="6" /><circle cx="47" cy="9" r="6" />
              <circle cx="34" cy="33" r="9" /><circle cx="16" cy="52" r="6" />
            </svg>
            <span>Sin seleccionar</span>
          </div>
          <p v-else class="selected-protein">Seleccionada</p>
          <dl>
            <div><dt>Grado</dt><dd>{{ protein.details?.degree ?? '--' }}</dd></div>
            <div><dt>Vecinos</dt><dd>{{ protein.details?.neighbors.length ?? '--' }}</dd></div>
            <div><dt>Componente</dt><dd>{{ protein.details ? componentNumber(protein.label) : '--' }}</dd></div>
            <div><dt>Tamaño del componente</dt><dd>{{ protein.details?.component_size ?? '--' }}</dd></div>
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
            <h1>Análisis comparativo entre ambas proteínas</h1>
            <div class="component-banner" :class="{ different: !comparisonResult.same_component }">
              <span class="component-icon" aria-hidden="true">{{ comparisonResult.same_component ? '✓' : '!' }}</span>
              <div>
                <strong>{{ comparisonResult.same_component ? 'Mismo componente conectado' : 'Componentes diferentes' }}</strong>
                <small>
                  {{ comparisonResult.same_component
                    ? 'Ambas proteínas pertenecen al mismo componente de la red.'
                    : 'Las proteínas no están conectadas dentro del dataset.' }}
                </small>
              </div>
            </div>
          </div>

          <div class="summary-metrics" aria-label="Resumen de comparación">
            <div><span>Vecinos compartidos</span><strong>{{ comparisonResult?.shared_neighbors_count ?? '--' }}</strong></div>
            <div><span>Diferencia de grado</span><strong>{{ comparisonResult?.degree_difference ?? '--' }}</strong></div>
            <div><span>Componente</span><strong>{{ comparisonResult ? (comparisonResult.same_component ? 'Mismo' : 'Diferente') : '--' }}</strong></div>
          </div>

          <section v-if="comparisonResult" class="venn-section" aria-label="Diagrama de vecinos compartidos">
            <p class="venn-title">Diagrama de Venn</p>
            <div class="venn-diagram">
              <div class="venn-circle venn-a">
                <strong>{{ exclusiveNeighborsA }}</strong>
                <span>exclusivos A</span>
              </div>
              <div class="venn-circle venn-b">
                <strong>{{ exclusiveNeighborsB }}</strong>
                <span>exclusivos B</span>
              </div>
              <div class="venn-shared">
                <strong>{{ comparisonResult.shared_neighbors_count }}</strong>
                <span>comunes</span>
              </div>
            </div>
            <p class="direct-relation">
              {{ comparisonResult.directly_connected ? 'Las proteínas tienen una asociación directa.' : 'No existe una asociación directa entre ambas.' }}
              <small>UFDS: {{ comparisonResult.elapsed_ms.toFixed(2) }} ms</small>
            </p>
          </section>

          <footer class="summary-footer">
            <p>Las asociaciones requieren interpretación biológica adicional.</p>
            <button type="button" :disabled="!comparisonResult" @click="displayMode = 'subgraph'">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="m8 11 8-4m-8 6 8 4"/></svg>
              Visualizar ambas en un subgrafo
            </button>
          </footer>
        </template>

        <template v-else>
          <div class="subgraph-heading">
            <div class="graph-toolbar" aria-label="Herramientas del subgrafo">
              <button type="button" aria-label="Acercar" disabled>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7v7M7 10.5h7"/></svg>
              </button>
              <button type="button" aria-label="Alejar" disabled>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M7 10.5h7"/></svg>
              </button>
              <span class="toolbar-divider"></span>
              <button type="button" aria-label="Pantalla completa" disabled>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg>
              </button>
              <button type="button" aria-label="Descargar subgrafo" disabled>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>
              </button>
            </div>
          </div>

          <div class="empty-subgraph">
            <img src="/images/mascot.png" alt="Mascota de Prote-Prote" />
            <h2>Subgrafo sin datos</h2>
            <p>Compara dos proteínas para visualizar aquí sus conexiones.</p>
          </div>

          <footer class="subgraph-footer">
            <p>Las asociaciones requieren interpretación biológica adicional.</p>
            <button type="button" @click="displayMode = 'summary'">Vista resumida</button>
          </footer>
        </template>
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
.comparison-error { margin: 0 10px; color: #792434; font-weight: 700; text-align: center; }
.compare-button, .summary-footer button, .subgraph-footer button { min-height: 42px; border: 1px solid rgb(255 255 255 / 35%); border-radius: 999px; background: linear-gradient(#22c0d3, #1550bd); box-shadow: inset 0 1px 0 rgb(255 255 255 / 45%), 0 4px 10px rgb(12 76 103 / 20%); color: white; cursor: pointer; font: inherit; font-size: 1rem; font-weight: 700; }
.compare-button:disabled, .summary-footer button:disabled { cursor: not-allowed; opacity: 0.78; }
.summary-footer button:hover, .subgraph-footer button:hover { filter: brightness(1.06); }
.compare-grid { display: grid; flex: 1; min-height: 0; grid-template-columns: minmax(220px, 0.7fr) minmax(0, 2.3fr); gap: clamp(10px, 1.6vw, 24px); }
.protein-column { display: grid; min-height: 0; grid-template-rows: 1fr 1fr; gap: clamp(10px, 1.5dvh, 18px); }
.protein-card { padding: clamp(12px, 1.5vw, 22px); }
.protein-card h2 { margin: 0 0 6px; font-size: clamp(1.2rem, 1.6vw, 1.7rem); }
.protein-id { display: inline-block; margin-bottom: 5px; padding: 3px 9px; border: 1px solid rgb(255 255 255 / 65%); border-radius: 999px; background: rgb(22 86 109 / 48%); color: white; font-size: 0.72rem; }
.unselected { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px; color: #34535e; }
.unselected svg, .empty-comparison svg { width: 48px; fill: white; stroke: white; stroke-linecap: round; stroke-width: 4; }
.protein-card dl { margin: 0; }
.protein-card dl div { display: flex; justify-content: space-between; gap: 8px; padding: 6px 2px; border-bottom: 1px solid rgb(43 100 104 / 20%); font-size: 0.95rem; }
.protein-card dd { margin: 0; color: #34535e; }
.selected-protein { margin: 8px 0; color: #16566d; font-weight: 700; text-align: center; }
.summary-panel { display: grid; min-height: 0; grid-template-rows: auto auto auto minmax(150px, 1fr) auto; padding: clamp(16px, 2vw, 28px); }
.empty-comparison { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.empty-comparison svg { width: clamp(62px, 7vw, 96px); }
.empty-comparison h1 { margin: 8px 0; font-size: clamp(1.5rem, 2.4vw, 2.5rem); }
.empty-comparison p { max-width: 700px; margin: 0; font-size: clamp(0.95rem, 1.3vw, 1.25rem); line-height: 1.4; }
.comparison-result { display: flex; min-height: 0; flex-direction: column; align-items: center; justify-content: center; padding: 4px 12px 12px; text-align: center; }
.comparison-result h1 { margin: 0 0 8px; font-size: clamp(1.5rem, 2.4vw, 2.5rem); }
.component-banner { display: flex; width: min(100%, 620px); align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid rgb(255 255 255 / 55%); border-radius: 9px; background: rgb(174 244 226 / 56%); color: #166053; text-align: left; }
.component-banner.different { background: rgb(255 214 187 / 58%); color: #7b3c25; }
.component-icon { display: grid; width: 28px; height: 28px; flex: none; place-items: center; border: 2px solid currentColor; border-radius: 50%; font-weight: 700; }
.component-banner div { display: grid; gap: 2px; }
.component-banner small { color: #34535e; }
.summary-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(8px, 2vw, 32px); }
.summary-metrics div { display: grid; min-height: 82px; place-items: center; gap: 4px; padding: 10px; border: 1px solid rgb(255 255 255 / 45%); border-radius: 10px; background: rgb(236 247 248 / 32%); text-align: center; }
.summary-metrics strong { font-size: 1.2rem; }
.venn-section { display: flex; min-height: 180px; flex-direction: column; }
.venn-title { margin: 8px 0 0; font-size: 0.82rem; font-weight: 700; text-transform: uppercase; }
.venn-diagram { position: relative; width: 260px; height: 145px; margin: 0 auto; }
.venn-circle { position: absolute; top: 14px; display: flex; width: 132px; height: 132px; flex-direction: column; align-items: center; justify-content: center; border: 2px solid; border-radius: 50%; }
.venn-circle strong { font-size: 1.25rem; }
.venn-circle span, .venn-shared span { font-size: 0.7rem; }
.venn-a { left: 16px; padding-right: 28px; border-color: #ff9a56; background: rgb(255 210 180 / 78%); }
.venn-b { right: 16px; padding-left: 28px; border-color: #5ccfc6; background: rgb(174 244 238 / 78%); }
.venn-shared { position: absolute; z-index: 2; top: 54px; left: 50%; display: flex; width: 58px; flex-direction: column; align-items: center; transform: translateX(-50%); }
.direct-relation { display: flex; justify-content: space-between; gap: 12px; margin: 4px 0 0; color: #34535e; font-size: 0.85rem; }
.direct-relation small { white-space: nowrap; }
.summary-footer { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-top: clamp(10px, 2dvh, 22px); }
.summary-footer p { max-width: 420px; margin: 0; font-size: 0.9rem; }
.summary-footer button { display: inline-flex; min-width: min(100%, 340px); align-items: center; justify-content: center; gap: 9px; padding: 8px 22px; }
.summary-footer button svg { width: 19px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.subgraph-panel { grid-template-rows: auto auto minmax(180px, 1fr) auto; }
.subgraph-heading { display: flex; align-items: center; justify-content: flex-end; padding: 8px 0; }
.graph-toolbar { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid rgb(205 240 246 / 55%); border-radius: 14px; background: linear-gradient(rgb(203 237 243 / 82%), rgb(161 219 232 / 72%)); box-shadow: 0 3px 8px rgb(12 76 103 / 15%); }
.graph-toolbar button { display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: 8px; padding: 0; background: transparent; color: #154858; }
.graph-toolbar button:disabled { cursor: not-allowed; opacity: 0.5; }
.graph-toolbar svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.8; }
.toolbar-divider { width: 1px; height: 24px; margin: 0 3px; background: #8aafbb; }
.empty-subgraph { display: flex; min-height: 0; flex-direction: column; align-items: center; justify-content: center; padding: 12px; text-align: center; }
.empty-subgraph img { width: clamp(80px, min(11vw, 18dvh), 145px); height: auto; margin-bottom: 12px; }
.empty-subgraph h2 { margin: 0; font-size: clamp(1.25rem, 2vw, 2rem); }
.empty-subgraph p { margin: 8px 0 0; color: #34535e; font-size: clamp(0.95rem, 1.2vw, 1.15rem); }
.subgraph-footer { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-top: 10px; }
.subgraph-footer p { max-width: 420px; margin: 0; font-size: 0.9rem; }
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
