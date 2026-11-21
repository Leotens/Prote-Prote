<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ComparisonGraph } from '../infrastructure/datasetsApi'

const props = defineProps<{ graph: ComparisonGraph, proteinId: string, side: 'A' | 'B' }>()
const frame = ref<HTMLIFrameElement | null>(null)
const stage = ref<HTMLDivElement | null>(null)
const ready = ref(false)
const error = ref('')
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
    fitGraph(true)
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
    <h2>Proteína {{ side }}</h2>
    <div class="graph-tools" :aria-label="`Herramientas del subgrafo ${side}`">
      <button type="button" aria-label="Acercar" :disabled="!ready" @click="control('zoom-in')"><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M10 7v6M7 10h6"/></svg></button>
      <button type="button" aria-label="Alejar" :disabled="!ready" @click="control('zoom-out')"><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6"/></svg></button>
      <button type="button" aria-label="Centrar grafo" title="Centrar grafo" :disabled="!ready" @click="control('fit')"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg></button>
      <button type="button" aria-label="Pantalla completa" @click="fullscreen"><svg viewBox="0 0 24 24"><path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"/></svg></button>
      <button type="button" aria-label="Descargar subgrafo como PNG" :disabled="!ready" @click="control('download')"><svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></svg></button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="graph-stage">
      <iframe ref="frame" :srcdoc="graph.html" :title="`Árbol de expansión mínima con Prim de la proteína ${side}: ${proteinId}`" sandbox="allow-scripts" :class="{ pending: !ready }"></iframe>
      <div v-if="!ready" class="graph-loading" role="status" aria-label="Preparando el grafo">
        <img src="/images/mascot.png" alt="" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.comparison-graph { display: flex; min-width: 0; min-height: 0; overflow: hidden; flex-direction: column; align-items: center; padding: 12px; border: 1px solid #ccebef99; border-radius: 18px; background: #d5eef018; }
.comparison-graph:fullscreen { padding: 20px; background: #a5d6da; }
h2 { margin: 0 0 5px; font-size: clamp(1.1rem, 1.5vw, 1.6rem); text-align: center; overflow-wrap: anywhere; }
.graph-tools { display: flex; flex: none; max-width: 100%; gap: 4px; padding: 4px 10px; border-radius: 12px; background: #d5eef080; }
button { display: grid; place-items: center; width: 36px; height: 32px; border: 0; border-radius: 7px; background: transparent; color: #154858; cursor: pointer; }
button:hover { background: #d5eef0; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
button:focus-visible { outline: 2px solid #08485d; outline-offset: 2px; }
button svg { width: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.graph-stage { position: relative; flex: 1; min-height: 0; width: 100%; overflow: hidden; }
iframe { position: absolute; inset: 0; display: block; width: 100%; height: 100%; min-height: 0; border: 0; background: transparent; }
.pending { visibility: hidden; }
.graph-loading { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; }
.graph-loading img { width: 110px; }
</style>
