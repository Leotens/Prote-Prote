<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GeneAnnotationSummary from './GeneAnnotationSummary.vue'
import type { ComparisonGraph, ProteinDetails } from '../infrastructure/datasetsApi'

const props = defineProps<{ graph: ComparisonGraph, proteinId: string, side: 'A' | 'B' }>()
const emit = defineEmits<{ ready: [side: 'A' | 'B'] }>()
const frame = ref<HTMLIFrameElement | null>(null)
const stage = ref<HTMLDivElement | null>(null)
const ready = ref(false)
const error = ref('')
const selectedProtein = ref<ProteinDetails | null>(null)
let resizeObserver: ResizeObserver | undefined
let pendingFit = 0
let lastWidth = 0
let lastHeight = 0

function fitGraph(force = false) {
  const bounds = stage.value?.getBoundingClientRect()
  if (!ready.value || !bounds?.width || !bounds.height) return
  if (!force && bounds.width === lastWidth && bounds.height === lastHeight) return
  lastWidth = bounds.width
  lastHeight = bounds.height
  window.cancelAnimationFrame(pendingFit)
  pendingFit = window.requestAnimationFrame(() => {
    if (ready.value) control('fit')
  })
}

watch(() => props.graph.html, (_, __, onCleanup) => {
  ready.value = false
  error.value = ''
  selectedProtein.value = null
  const timeout = window.setTimeout(() => {
    if (!ready.value) {
      ready.value = true
      error.value = 'El visor tarda en estabilizarse. Puedes mover el grafo o ajustar la vista.'
    }
  }, 5 * 60 * 1000)
  onCleanup(() => window.clearTimeout(timeout))
}, { immediate: true })

function control(action: string) {
  frame.value?.contentWindow?.postMessage({ type: 'prote-prote:graph-control', action }, '*')
}

function onMessage(event: MessageEvent) {
  if (event.source !== frame.value?.contentWindow) return
  if (event.data === 'prote-prote:graph-ready') {
    ready.value = true
    emit('ready', props.side)
    fitGraph(true)
  }
  if (event.data?.type === 'prote-prote:protein-selected') {
    selectedProtein.value = event.data.details as ProteinDetails
  }
  if (event.data?.type === 'prote-prote:protein-cleared') {
    selectedProtein.value = null
  }
  if (event.data?.type === 'prote-prote:graph-image' && typeof event.data.image === 'string' && event.data.image.startsWith('data:image/png;base64,')) {
    const anchor = document.createElement('a')
    anchor.href = event.data.image
    anchor.download = `comparacion-proteina-${props.side}.png`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  }
}

function clearSelection() {
  selectedProtein.value = null
  control('reset-focus')
}

async function fullscreen() {
  try {
    error.value = ''
    if (document.fullscreenElement === stage.value) await document.exitFullscreen()
    else await stage.value?.requestFullscreen()
  } catch {
    error.value = 'No se pudo abrir la pantalla completa en este navegador.'
  }
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  resizeObserver = new ResizeObserver(() => fitGraph())
  if (stage.value) resizeObserver.observe(stage.value)
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  resizeObserver?.disconnect()
  window.cancelAnimationFrame(pendingFit)
})
</script>

<template>
  <section ref="stage" class="comparison-graph" :aria-label="`Grafo de la proteína ${side}: ${proteinId}`">
    <header class="graph-header">
    <h2>Proteína {{ side }}</h2>
    <div class="graph-tools" :aria-label="`Herramientas del subgrafo ${side}`">
      <button type="button" aria-label="Acercar" title="Acercar" :disabled="!ready" @click="control('zoom-in')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7v7M7 10.5h7"/></svg></button>
      <button type="button" aria-label="Alejar" title="Alejar" :disabled="!ready" @click="control('zoom-out')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M7 10.5h7"/></svg></button>
      <button type="button" aria-label="Centrar grafo" title="Centrar grafo" :disabled="!ready" @click="control('fit')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg></button>
      <span class="toolbar-divider"></span>
      <button type="button" aria-label="Pantalla completa" title="Pantalla completa" @click="fullscreen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg></button>
      <button type="button" aria-label="Descargar subgrafo como PNG" title="Descargar subgrafo como PNG" :disabled="!ready" @click="control('download')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg></button>
    </div>
    </header>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="graph-stage">
      <iframe ref="frame" :srcdoc="graph.html" :title="`Árbol de expansión mínima con Prim de la proteína ${side}: ${proteinId}`" sandbox="allow-scripts" :class="{ pending: !ready }"></iframe>
      <div v-if="!ready" class="graph-loading" role="status" aria-label="Preparando el grafo">
        <img src="/images/mascot.png" alt="" />
      </div>
    </div>
    <aside v-if="selectedProtein" class="selected-protein-details" aria-live="polite">
      <div>
        <strong>Proteína {{ selectedProtein.id }}</strong>
        <GeneAnnotationSummary :id="selectedProtein.id" compact />
        <span>Vecinos: {{ selectedProtein.degree }}</span>
        <span>Tamaño del grupo: {{ selectedProtein.component_size }}</span>
      </div>
      <button type="button" aria-label="Cerrar detalles y restaurar el grafo" @click="clearSelection">×</button>
    </aside>
  </section>
</template>

<style scoped>
.comparison-graph { position: relative; display: flex; min-width: 0; min-height: 0; flex-direction: column; align-items: center; }
.comparison-graph:fullscreen { padding: 20px; background: #a5d6da; }
.graph-header { position: absolute; z-index: 2; inset: 10px 12px auto; display: flex; align-items: center; justify-content: space-between; gap: 6px 12px; flex-wrap: wrap; pointer-events: none; }
h2 { margin: 0; font-size: clamp(0.95rem, 1.15vw, 1.25rem); text-align: left; overflow-wrap: anywhere; }
.graph-tools { display: flex; flex: none; max-width: 100%; align-items: center; gap: 3px; padding: 3px 6px; border: 1px solid rgb(205 240 246 / 55%); border-radius: 12px; background: linear-gradient(rgb(203 237 243 / 82%), rgb(161 219 232 / 72%)); box-shadow: 0 3px 8px rgb(12 76 103 / 15%); pointer-events: auto; }
button { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 7px; padding: 0; background: transparent; color: #154858; cursor: pointer; }
button:not(:disabled):hover { background: rgb(213 238 240 / 75%); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button:focus-visible { outline: 2px solid #08485d; outline-offset: 2px; }
button svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 2.8; stroke-linecap: round; stroke-linejoin: round; }
.toolbar-divider { width: 1px; height: 20px; margin: 0 2px; background: #8aafbb; }
.comparison-graph:fullscreen .graph-tools { gap: 4px; padding: 4px 8px; border-radius: 14px; }
.comparison-graph:fullscreen button { width: 36px; height: 36px; border-radius: 8px; }
.comparison-graph:fullscreen button svg { width: 22px; height: 22px; }
.comparison-graph:fullscreen .toolbar-divider { height: 24px; margin-inline: 3px; }
.graph-stage { position: relative; flex: 1; min-height: 0; width: 100%; overflow: hidden; border: 1px solid #ccebef99; border-radius: 18px; background: #d5eef018; }
iframe { position: absolute; inset: 0; display: block; width: 100%; height: 100%; min-height: 0; border: 0; background: transparent; }
.pending { visibility: hidden; }
.graph-loading { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; }
.graph-loading img { width: 110px; }
.selected-protein-details { display: flex; width: 100%; flex: none; align-items: center; justify-content: space-between; gap: 9px; margin-top: 5px; padding: 5px 9px; border: 1px solid rgb(255 255 255 / 55%); border-radius: 10px; background: rgb(237 250 255 / 52%); color: #164c5c; }
.selected-protein-details > div { display: flex; min-width: 0; flex-wrap: wrap; align-items: center; gap: 3px 12px; }
.selected-protein-details strong { color: #062b39; font-size: 0.76rem; font-weight: 900; }
.selected-protein-details span { font-size: 0.76rem; }
.selected-protein-details > button { width: 22px; height: 22px; flex: none; border-radius: 50%; background: rgb(22 86 109 / 14%); font-size: 1rem; line-height: 1; }
.comparison-graph:fullscreen .selected-protein-details { gap: 14px; margin-top: 9px; padding: 12px 15px; border-radius: 12px; }
.comparison-graph:fullscreen .selected-protein-details > div { gap: 7px 20px; }
.comparison-graph:fullscreen .selected-protein-details :is(strong, span),
.comparison-graph:fullscreen .selected-protein-details :deep(.gene-symbol),
.comparison-graph:fullscreen .selected-protein-details :deep(.gene-name),
.comparison-graph:fullscreen .selected-protein-details :deep(.gene-status) { font-size: 1rem; line-height: 1.3; }
.comparison-graph:fullscreen .selected-protein-details > button { width: 26px; height: 26px; font-size: 1.2rem; }
@media (max-width: 420px) {
  .graph-tools { margin-left: auto; gap: 2px; padding-inline: 4px; }
  button { width: 30px; height: 30px; }
}
</style>
