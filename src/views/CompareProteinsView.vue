<script setup lang="ts">
import { ref } from 'vue'
import BackToMenu from '../components/BackToMenu.vue'
import { formatCount, type Dataset } from '../datasets'

defineProps<{ datasets: readonly Dataset[] }>()
const dataset = defineModel<Dataset>({ required: true })
const emit = defineEmits<{ back: [] }>()
const proteinA = ref('')
const proteinB = ref('')
const pickerOpen = ref(false)
const pickerTrigger = ref<HTMLButtonElement | null>(null)
const displayMode = ref<'summary' | 'subgraph'>('summary')

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
      <div class="comparison-inputs">
        <label>
          <span>Proteína A</span>
          <input v-model.trim="proteinA" type="text" placeholder="Ejemplo: 7157" />
        </label>
        <label>
          <span>Proteína B</span>
          <input v-model.trim="proteinB" type="text" placeholder="Ejemplo: 4609" />
        </label>
        <button class="compare-button" type="button" disabled>Comparar</button>
      </div>
    </header>

    <div class="compare-grid">
      <aside class="protein-column">
        <article v-for="protein in ['A', 'B']" :key="protein" class="glass-panel protein-card">
          <h2>Proteína {{ protein }}</h2>
          <div class="unselected">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path d="M18 17 31 30m5-5 9-13M32 36 19 49" />
              <circle cx="15" cy="14" r="6" /><circle cx="47" cy="9" r="6" />
              <circle cx="34" cy="33" r="9" /><circle cx="16" cy="52" r="6" />
            </svg>
            <span>Sin seleccionar</span>
          </div>
          <dl>
            <div><dt>Grado</dt><dd>--</dd></div>
            <div><dt>Vecinos</dt><dd>--</dd></div>
            <div><dt>Componentes</dt><dd>--</dd></div>
            <div><dt>Tamaño del componente</dt><dd>--</dd></div>
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
          <div class="empty-comparison">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path d="M18 17 31 30m5-5 9-13M32 36 19 49" />
              <circle cx="15" cy="14" r="6" /><circle cx="47" cy="9" r="6" />
              <circle cx="34" cy="33" r="9" /><circle cx="16" cy="52" r="6" />
            </svg>
            <h1>Compara dos proteínas</h1>
            <p>Ingresa dos identificadores para consultar su relación, vecinos y componentes conectados.</p>
          </div>

          <div class="summary-metrics" aria-label="Resumen de comparación">
            <div><span>Vecinos compartidos</span><strong>--</strong></div>
            <div><span>Diferencia de grado</span><strong>--</strong></div>
            <div><span>Componente</span><strong>--</strong></div>
          </div>

          <footer class="summary-footer">
            <p>Las asociaciones requieren interpretación biológica adicional.</p>
            <button type="button" @click="displayMode = 'subgraph'">
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
.summary-panel { display: grid; min-height: 0; grid-template-rows: auto minmax(150px, 1fr) auto auto; padding: clamp(16px, 2vw, 28px); }
.empty-comparison { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.empty-comparison svg { width: clamp(62px, 7vw, 96px); }
.empty-comparison h1 { margin: 8px 0; font-size: clamp(1.5rem, 2.4vw, 2.5rem); }
.empty-comparison p { max-width: 700px; margin: 0; font-size: clamp(0.95rem, 1.3vw, 1.25rem); line-height: 1.4; }
.summary-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(8px, 2vw, 32px); }
.summary-metrics div { display: grid; min-height: 82px; place-items: center; gap: 4px; padding: 10px; border: 1px solid rgb(255 255 255 / 45%); border-radius: 10px; background: rgb(236 247 248 / 32%); text-align: center; }
.summary-metrics strong { font-size: 1.2rem; }
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
