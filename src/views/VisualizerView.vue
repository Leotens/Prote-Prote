<script setup lang="ts">
import { ref } from 'vue'
import BackToMenu from '../components/BackToMenu.vue'
import { formatCount, type Dataset } from '../datasets'

defineProps<{ datasets: readonly Dataset[] }>()
const dataset = defineModel<Dataset>({ required: true })
const emit = defineEmits<{ back: [] }>()
const mode = ref<'neighborhood' | 'shortest-path'>('neighborhood')
const origin = ref('')
const destination = ref('')
const distanceLevel = ref(2)
const pickerOpen = ref(false)
const pickerTrigger = ref<HTMLButtonElement | null>(null)

function swapProteins() {
  const previousOrigin = origin.value
  origin.value = destination.value
  destination.value = previousOrigin
}

function resetPath() {
  origin.value = ''
  destination.value = ''
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
  if (!selector.contains(event.relatedTarget as Node | null)) {
    pickerOpen.value = false
  }
}
</script>

<template>
  <section class="visualizer" :aria-label="`Visualización del dataset ${dataset.name}`">
    <div class="visualizer-grid">
      <aside class="glass-panel parameters-panel">
        <BackToMenu @back="emit('back')" />
        <h2>Parámetros</h2>
        <label class="field-label" for="node-limit">Límite máximo de nodos</label>
        <input id="node-limit" class="protein-input" type="number" min="1" max="1500" placeholder="100" />
        <button class="graph-action" type="button" disabled>Generar grafo</button>
        <p class="node-note">Hasta 1500 nodos para una visualización óptima.</p>

        <div class="mode-switch" aria-label="Modo de exploración">
          <button type="button" :aria-pressed="mode === 'neighborhood'" @click="mode = 'neighborhood'">Explorar entorno</button>
          <button type="button" :aria-pressed="mode === 'shortest-path'" @click="mode = 'shortest-path'">Camino más corto</button>
        </div>

        <div v-show="mode === 'neighborhood'" class="mode-fields">
          <label class="field-label" for="protein-id">Identificador de proteína</label>
          <input id="protein-id" class="protein-input" type="text" placeholder="Ejemplo: 7157" />

          <div class="distance-control">
            <div class="distance-heading">
              <label class="field-label" for="distance-level">Distancia máxima</label>
              <span class="level-badge" aria-hidden="true">Nivel {{ distanceLevel }}</span>
            </div>
            <input
              id="distance-level"
              v-model.number="distanceLevel"
              class="distance-range"
              type="range"
              min="1"
              max="3"
              :aria-valuetext="`Nivel ${distanceLevel}`"
              :style="{ '--range-fill': `${(distanceLevel - 1) * 50}%` }"
            />
            <div class="range-values" aria-hidden="true">
              <span v-for="level in 3" :key="level" :class="{ 'current-level': level === distanceLevel }">{{ level }}</span>
            </div>
          </div>

          <button class="graph-action" type="button" disabled>Generar subgrafo</button>
        </div>

        <div v-show="mode === 'shortest-path'" class="mode-fields">
          <label class="field-label" for="origin-protein">Proteína de origen</label>
          <input id="origin-protein" v-model="origin" class="protein-input" type="text" placeholder="Ejemplo: 7157" />
          <button class="swap-button" type="button" aria-label="Intercambiar origen y destino" @click="swapProteins">
            <span aria-hidden="true">⇅</span>
          </button>
          <label class="field-label" for="destination-protein">Proteína de destino</label>
          <input id="destination-protein" v-model="destination" class="protein-input" type="text" placeholder="Ejemplo: 5728" />
          <button class="graph-action" type="button" disabled>Encontrar camino</button>
        </div>
      </aside>

      <section class="glass-panel graph-panel" aria-label="Área del grafo">
        <header class="graph-header">
          <div class="dataset-info">
            <div class="dataset-selector" @keydown.esc="pickerOpen && closePicker()" @focusout="dismissPickerOnBlur">
              <button
                ref="pickerTrigger"
                class="dataset-trigger"
                type="button"
                :aria-expanded="pickerOpen"
                aria-controls="visualizer-dataset-picker"
                @click="pickerOpen = !pickerOpen"
              >
                Dataset {{ dataset.name }}
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
              </button>
              <Transition name="dataset-tray">
                <div v-show="pickerOpen" id="visualizer-dataset-picker" class="dataset-picker" role="group" aria-label="Datasets disponibles">
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
          </div>
          <div class="graph-toolbar" aria-label="Herramientas del grafo">
            <button type="button" aria-label="Acercar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7v7M7 10.5h7"/></svg>
            </button>
            <button type="button" aria-label="Alejar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M7 10.5h7"/></svg>
            </button>
            <span class="toolbar-divider"></span>
            <button type="button" aria-label="Pantalla completa">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg>
            </button>
            <button type="button" aria-label="Descargar subgrafo" title="Disponible al generar un subgrafo" disabled>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>
            </button>
          </div>
        </header>

        <div class="empty-graph">
          <img class="mascot" src="/images/mascot.png" alt="Mascota de Prote-Prote" />
          <template v-if="mode === 'neighborhood'">
            <h2>Explora las conexiones de una proteína</h2>
            <p>Ingresa su identificador y selecciona la distancia máxima para el subgrafo.</p>
          </template>
          <template v-else>
            <h2>Camino más corto</h2>
            <p>Ingresa las proteínas de origen y destino para consultar la ruta.</p>
          </template>
        </div>
      </section>

      <aside v-if="mode === 'neighborhood'" class="glass-panel details-panel">
        <h2>Detalles de la proteína</h2>
        <p class="details-intro">Selecciona un nodo del grafo para ver sus detalles.</p>
        <dl class="protein-details">
          <div><dt>ID</dt><dd>--</dd></div>
          <div><dt>Grado</dt><dd>--</dd></div>
          <div><dt>Vecinos</dt><dd>--</dd></div>
          <div><dt>Componente conectado</dt><dd>--</dd></div>
          <div><dt>Tamaño conectado</dt><dd>--</dd></div>
        </dl>
      </aside>
      <aside v-else class="glass-panel details-panel">
        <h2>Resultados del camino</h2>
        <dl class="protein-details">
          <div><dt>Proteína inicial</dt><dd>--</dd></div>
          <div><dt>Proteína final</dt><dd>--</dd></div>
          <div><dt>Longitud mínima</dt><dd>--</dd></div>
          <div><dt>Proteínas en la ruta</dt><dd>--</dd></div>
          <div><dt>Algoritmo</dt><dd>--</dd></div>
          <div><dt>Tiempo</dt><dd>--</dd></div>
          <div><dt>Estado</dt><dd>Sin consulta</dd></div>
        </dl>
        <button class="reset-path" type="button" @click="resetPath">Nueva consulta</button>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.visualizer {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: clamp(10px, 2dvh, 20px) 4px 0;
  color: #12333f;
}

.visualizer :is(button, input):focus-visible { outline: 2px solid #08485d; outline-offset: 3px; }

.graph-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: clamp(10px, 1.5vw, 20px);
}

.dataset-selector { position: relative; width: fit-content; max-width: 100%; }
.dataset-counts { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 0.9rem; }

.dataset-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.9fr) minmax(0, 1.05fr);
  gap: clamp(10px, 1.4vw, 24px);
}

.parameters-panel {
  display: flex;
  flex-direction: column;
  padding: clamp(10px, 2dvh, 22px) clamp(10px, 1.4vw, 22px);
}

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

.distance-control {
  margin-bottom: 12px;
  padding: 7px 10px 5px;
  border: 1px solid #96bdc8;
  border-radius: 12px;
  background: linear-gradient(rgb(204 237 243 / 70%), rgb(174 221 230 / 50%));
  box-shadow: inset 0 1px 0 rgb(218 248 251 / 45%);
}

.distance-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 4px 8px; }
.distance-heading .field-label { margin: 0; }
.level-badge { padding: 2px 7px; border-radius: 999px; background: #16566d; color: white; font-size: 0.75rem; font-weight: 700; }
.distance-range {
  --track-background: linear-gradient(to right, #166a82 var(--range-fill), #b9d7df var(--range-fill));
  appearance: none;
  display: block;
  width: 100%;
  height: 24px;
  margin: 2px 0 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.distance-range::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: var(--track-background); }
.distance-range::-moz-range-track { height: 6px; border-radius: 999px; background: var(--track-background); }
.distance-range::-webkit-slider-thumb { appearance: none; width: 20px; height: 20px; margin-top: -7px; border: 2px solid #166a82; border-radius: 50%; background: white; }
.distance-range::-moz-range-thumb { box-sizing: border-box; width: 20px; height: 20px; border: 2px solid #166a82; border-radius: 50%; background: white; }
.range-values { display: flex; justify-content: space-between; color: #34535e; font-size: 0.8rem; }
.range-values span { width: 20px; text-align: center; }
.range-values .current-level { color: #11485d; font-weight: 700; }

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
.node-note {
  margin: 6px 0 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgb(43 100 104 / 25%);
  color: #34535e;
  font-size: 0.75rem;
  line-height: 1.35;
  text-align: center;
}
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

.graph-panel { display: flex; flex-direction: column; background: linear-gradient(155deg, rgb(180 231 238 / 58%), rgb(154 217 227 / 43%) 52%, rgb(171 230 233 / 54%)); }
.graph-toolbar { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid rgb(205 240 246 / 55%); border-radius: 14px; background: linear-gradient(rgb(203 237 243 / 82%), rgb(161 219 232 / 72%)); box-shadow: 0 3px 8px rgb(12 76 103 / 15%); }
.graph-toolbar button { display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: 8px; padding: 0; background: transparent; color: #154858; cursor: pointer; }
.graph-toolbar button:enabled:hover { background: #cde9f0; }
.graph-toolbar button:disabled { opacity: 0.55; cursor: not-allowed; }
.graph-toolbar svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.8; }
.toolbar-divider { width: 1px; height: 24px; margin: 0 3px; background: #8aafbb; }

.empty-graph { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; padding: 12px; text-align: center; }
.mascot { width: clamp(90px, min(14vw, 24dvh), 190px); height: auto; margin-bottom: clamp(8px, 2dvh, 22px); object-fit: contain; }
.empty-graph h2 { margin: 0; font-size: clamp(1.15rem, 1.8vw, 1.85rem); font-weight: 700; line-height: 1.25; }
.empty-graph p { margin: clamp(8px, 1.6dvh, 20px) 0 0; font-size: clamp(1rem, 1.2vw, 1.2rem); line-height: 1.4; }

.details-panel { padding: clamp(10px, 2dvh, 22px) clamp(10px, 1.4vw, 22px); }
.details-panel h2 { margin: 0 0 clamp(8px, 1.5dvh, 18px); font-size: clamp(1.25rem, 1.65vw, 1.75rem); font-weight: 700; line-height: 1.15; }
.details-intro { margin: 0 0 clamp(8px, 1.5dvh, 18px); color: #34535e; font-size: clamp(0.95rem, 1.05vw, 1.12rem); line-height: 1.4; }
.protein-details { margin: 0; }
.protein-details div { display: flex; justify-content: space-between; gap: 8px; padding: 8px 2px; border-bottom: 1px solid rgb(43 100 104 / 25%); font-size: clamp(0.95rem, 1vw, 1.05rem); }
.protein-details dt, .protein-details dd { margin: 0; }
.protein-details dd { color: #34535e; }

@media (max-width: 850px) {
  .visualizer-grid { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr); }
  .details-panel { grid-column: 1 / -1; }
}

@media (max-width: 560px) {
  .visualizer-grid { grid-template-columns: 1fr; }
  .graph-panel { min-height: 240px; }
  .details-panel { grid-column: auto; }
}
</style>
